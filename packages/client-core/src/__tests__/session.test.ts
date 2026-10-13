import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ApiClient } from "../http-client.js";
import { ApiError, SessionLostError } from "../errors.js";
import { TokenManager } from "../token-manager.js";

/** Unsigned JWT-shaped string with the given `exp` — enough for expiry decoding. */
function fakeJwt(id: number, expSecondsFromNow = 900): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ sub: "u1", jti: id, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(server: (token: string | undefined, call: number) => Response) {
  let mints = 0;
  let calls = 0;
  const lost: string[] = [];
  const tokens = new TokenManager({ mint: async () => fakeJwt(++mints), onSessionLost: (r) => lost.push(r) });
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokens,
    fetch: async (_url, init) => {
      const auth = new Headers(init?.headers).get("Authorization") ?? undefined;
      return server(auth?.replace("Bearer ", ""), ++calls);
    },
  });
  return { client, tokens, lost, mints: () => mints, calls: () => calls };
}

test("concurrent requests share a single token mint", async () => {
  const s = setup(() => json(200, { ok: true }));
  await Promise.all(Array.from({ length: 20 }, () => s.client.json("/x")));
  assert.equal(s.mints(), 1);
});

test("an expired token is re-minted once and the request retried once", async () => {
  let rejectedOnce = false;
  const s = setup(() => {
    if (!rejectedOnce) {
      rejectedOnce = true;
      return json(401, { statusCode: 401, code: "TOKEN_EXPIRED", message: "expired" });
    }
    return json(200, { ok: true });
  });
  assert.deepEqual(await s.client.json("/x"), { ok: true });
  assert.equal(s.mints(), 2);
  assert.equal(s.calls(), 2);
});

test("a server that rejects every token trips the breaker instead of looping (Oct 11 regression)", async () => {
  const s = setup(() => json(401, { statusCode: 401, code: "TOKEN_INVALID", message: "nope" }));
  await assert.rejects(s.client.json("/x"), SessionLostError);
  assert.deepEqual(s.lost, ["rejected"]);
  const callsAtTrip = s.calls();
  const mintsAtTrip = s.mints();

  // Everything after the trip fails locally: no network, no mints.
  for (let i = 0; i < 50; i++) await assert.rejects(s.client.json("/x"), SessionLostError);
  assert.equal(s.calls(), callsAtTrip);
  assert.equal(s.mints(), mintsAtTrip);
});

test("repeated rejection-driven refreshes are capped per window", async () => {
  const tokens = new TokenManager({ mint: async () => fakeJwt(Math.random()), maxRejectionRefreshes: 3 });
  let token = await tokens.getToken();
  for (let i = 0; i < 3; i++) token = await tokens.refreshAfterRejection(token);
  await assert.rejects(tokens.refreshAfterRejection(token), SessionLostError);
  assert.equal(tokens.state, "lost");
  tokens.reset();
  assert.equal(tokens.state, "idle");
  await tokens.getToken();
});

test("N requests failing with the same stale token cause one re-mint, not N", async () => {
  let mints = 0;
  const tokens = new TokenManager({ mint: async () => fakeJwt(++mints) });
  const stale = await tokens.getToken();
  await Promise.all(Array.from({ length: 10 }, () => tokens.refreshAfterRejection(stale)));
  assert.equal(mints, 2);
});

test("NOT_A_MEMBER is surfaced as a typed error and never refreshes the token", async () => {
  const s = setup(() => json(403, { statusCode: 403, code: "NOT_A_MEMBER", message: "no" }));
  await assert.rejects(s.client.json("/x"), (e: unknown) => e instanceof ApiError && e.code === "NOT_A_MEMBER");
  assert.equal(s.mints(), 1);
});

test("429 holds the whole client until Retry-After instead of letting callers hammer", async () => {
  const s = setup((_t, call) =>
    call === 1
      ? json(429, { statusCode: 429, code: "RATE_LIMITED", message: "slow", retryAfterSeconds: 120 })
      : json(200, { ok: true }),
  );
  await assert.rejects(s.client.json("/x"), (e: unknown) => e instanceof ApiError && e.code === "RATE_LIMITED");
  // The hold (120s) exceeds the request budget, so this fails fast without reaching the server.
  await assert.rejects(s.client.json("/x", { timeoutMs: 1_000 }), (e: unknown) => e instanceof ApiError && e.code === "RATE_LIMITED");
  assert.equal(s.calls(), 1);
});

test("a signed-out session fails fast", async () => {
  const lost: string[] = [];
  const tokens = new TokenManager({ mint: async () => null, onSessionLost: (r) => lost.push(r) });
  await assert.rejects(tokens.getToken(), SessionLostError);
  assert.deepEqual(lost, ["signed_out"]);
});

test("GETs revalidate with the remembered ETag and a 304 returns the remembered body", async () => {
  const seen: (string | null)[] = [];
  let mints = 0;
  const tokens = new TokenManager({ mint: async () => fakeJwt(++mints) });
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokens,
    fetch: async (_url, init) => {
      const inm = new Headers(init?.headers).get("If-None-Match");
      seen.push(inm);
      if (inm === 'W/"v1"') return new Response(null, { status: 304, headers: { ETag: 'W/"v1"' } });
      return new Response(JSON.stringify({ rows: [1, 2, 3] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ETag: 'W/"v1"' },
      });
    },
  });
  const first = await client.json<{ rows: number[] }>("/feed");
  const second = await client.json<{ rows: number[] }>("/feed");
  assert.deepEqual(seen, [null, 'W/"v1"']);
  assert.equal(second, first);

  // A new session never reuses another session's remembered bodies.
  tokens.reset();
  await client.json("/feed");
  assert.equal(seen[2], null);
});
