import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Work Ledger</h1>
      <p className="text-muted max-w-md text-center text-sm">
        Immutable-style activity record for organizations. Sign in to open the audit console or use the mobile app.
      </p>
      <div className="flex gap-3">
        <Link className="btn btn-primary" href="/login">
          Sign in
        </Link>
        <Link className="btn panel" href="/audit">
          Audit console
        </Link>
      </div>
    </main>
  );
}
