import { apiFetch, apiJson } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buf = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buf);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function fetchWebPushPublicKey(): Promise<string | null> {
  const res = await apiFetch("/push/vapid-public-key");
  if (!res.ok) return null;
  const data = (await res.json()) as { publicKey?: string | null };
  const key = typeof data.publicKey === "string" ? data.publicKey.trim() : "";
  return key || null;
}

/** Subscribe this browser and register the subscription with the API (requires active session). */
export async function subscribeWebPush(token: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const publicKey = await fetchWebPushPublicKey();
  if (!publicKey) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  await apiJson("/push/subscription", {
    method: "POST",
    token,
    body: JSON.stringify(sub.toJSON()),
  });

  return true;
}

export async function unsubscribeWebPush(token: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  await apiJson("/push/subscription", {
    method: "DELETE",
    token,
    body: JSON.stringify({ endpoint: json.endpoint }),
  });
  await sub.unsubscribe().catch(() => {});
}
