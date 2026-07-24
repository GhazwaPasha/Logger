import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, authDb } from "@/lib/auth";
import { oauthApplication } from "@work-ledger/db/schema";
import { ConsentCard } from "./ConsentCard";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ consent_code?: string; client_id?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const consentCode = params.consent_code;
  const clientId = params.client_id;

  if (!consentCode || !clientId) {
    return (
      <ConsentErrorScreen message="This connection link is missing required parameters. Please restart the connection from the app you're trying to connect." />
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?${qs}`)}`);
  }

  const [client] = await authDb
    .select({ name: oauthApplication.name, icon: oauthApplication.icon })
    .from(oauthApplication)
    .where(eq(oauthApplication.clientId, clientId))
    .limit(1);

  const scopes = (params.scope ?? "").split(" ").filter(Boolean);

  return (
    <ConsentCard
      consentCode={consentCode}
      clientName={client?.name ?? "An application"}
      clientIcon={client?.icon ?? null}
      scopes={scopes}
      userEmail={session.user.email}
    />
  );
}

function ConsentErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] px-4">
      <div className="surface-elevated w-full max-w-md rounded-2xl border border-[var(--border-subtle)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{message}</p>
      </div>
    </main>
  );
}
