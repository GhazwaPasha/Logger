import Link from "next/link";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { LogBaseMark } from "@/components/brand/LogBaseMark";

const wordmark = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Delete your account — LogBase",
  description: "How to delete your LogBase account and what happens to your data.",
};

const CONTACT_EMAIL = "ghazwairshad@gmail.com";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-[var(--fg)]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--muted)]">{children}</div>
    </section>
  );
}

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-[var(--surface-base)] text-[var(--fg)]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-4">
          <Link
            href="/"
            className={`flex items-center gap-2.5 rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${wordmark.className}`}
          >
            <LogBaseMark variant="marketing" decorative className="shrink-0" />
            <span className="text-xl font-bold tracking-[-0.04em] text-[var(--fg)]">LogBase</span>
          </Link>
          <Link href="/" className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]">
            ← Back home
          </Link>
        </header>

        <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Your data</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--fg)] sm:text-4xl">Delete your account</h1>
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--muted)]">
            You can delete your LogBase account at any time, from the web app or the Android app. This page explains
            how, and exactly what is erased and what is kept.
          </p>

          <div className="mt-10 space-y-10">
            <Section id="how-to-delete" title="How to delete your account">
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  <Link href="/login" className="text-[var(--fg)] underline underline-offset-2">
                    Sign in
                  </Link>{" "}
                  to LogBase.
                </li>
                <li>
                  Open the account menu (top right) and choose <strong className="text-[var(--fg)]">Your settings</strong>.
                </li>
                <li>
                  Scroll to <strong className="text-[var(--fg)]">Delete account</strong>, choose{" "}
                  <strong className="text-[var(--fg)]">Delete account…</strong>, type{" "}
                  <strong className="text-[var(--fg)]">DELETE</strong> to confirm, and select{" "}
                  <strong className="text-[var(--fg)]">Permanently delete my account</strong>.
                </li>
              </ol>
              <p>
                Deletion takes effect immediately and cannot be undone. If you are the only owner of a workspace,
                you will first need to make another member an owner or delete that workspace.
              </p>
            </Section>

            <Section id="what-is-deleted" title="What is deleted">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Your name and email address.</li>
                <li>Your profile picture and your linked Discord and Google sign-ins.</li>
                <li>Your password (if you signed up with email) and all active sessions.</li>
                <li>Your API keys, connected apps and push-notification subscriptions.</li>
                <li>Your membership in every workspace. Tasks assigned to you become unassigned.</li>
              </ul>
            </Section>

            <Section id="what-is-kept" title="What is kept, anonymously">
              <p>
                LogBase is a shared record of work, so the tasks, comments, activity history and time entries you
                created inside your workspaces remain there for the people you worked with. After you delete your
                account they are attributed to <strong className="text-[var(--fg)]">&ldquo;Deleted user&rdquo;</strong>{" "}
                and are no longer linked to your name, email address or any other personal information stored about you.
                Your account is replaced with a random placeholder identifier. Files you attached to tasks stay with those tasks; if you want a specific file removed, ask a
                workspace owner to delete it before you delete your account.
              </p>
              <p>
                Workspace owners can separately delete a workspace, which permanently removes everything in it,
                including data created by its members.
              </p>
            </Section>

            <Section id="cant-sign-in" title="Can't sign in?">
              <p>
                If you no longer have access to your account, email us at{" "}
                <a href={`mailto:${CONTACT_EMAIL}?subject=LogBase%20account%20deletion%20request`} className="text-[var(--fg)] underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>{" "}
                from the address registered to your account, with the subject &ldquo;LogBase account deletion
                request&rdquo;. We may need to verify your identity, and will complete the request within 30 days.
              </p>
            </Section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          See also our{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--fg)]">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
