import Link from "next/link";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { LogBaseMark } from "@/components/brand/LogBaseMark";

const wordmark = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Privacy Policy — LogBase",
  description: "How LogBase collects, uses, and protects your data.",
};

const LAST_UPDATED = "July 24, 2026";
const CONTACT_EMAIL = "ghazwairshad@gmail.com";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-[var(--fg)]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--muted)]">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--fg)] sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Last updated: {LAST_UPDATED}</p>

          <p className="mt-6 text-[15px] leading-relaxed text-[var(--muted)]">
            This Privacy Policy explains what information LogBase (&ldquo;LogBase,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects when
            you use the LogBase application (the &ldquo;Service&rdquo;), how we use it, who we share it with, and the
            choices you have. By using LogBase, you agree to the collection and use of information described here.
          </p>

          <div className="mt-10 space-y-10">
            <Section id="information-we-collect" title="1. Information we collect">
              <p>
                <strong className="text-[var(--fg)]">Account information.</strong> When you sign up, we collect your
                name, email address, and (for email/password accounts) a securely hashed password. You may instead
                sign in with Google or Discord, in which case we receive your name, email address, and profile
                picture from that provider, along with an internal reference to your provider account and the OAuth
                access/refresh tokens needed to keep that sign-in working.
              </p>
              <p>
                <strong className="text-[var(--fg)]">Session &amp; device information.</strong> When you sign in, we
                store a session token together with the IP address and browser user-agent string associated with
                that session, so we can keep you signed in and detect suspicious activity.
              </p>
              <p>
                <strong className="text-[var(--fg)]">Workspace &amp; task content.</strong> Anything you or your
                organization enters into LogBase — organizations, departments, lists, tasks, subtasks, due dates,
                priorities, comments, @mentions, dependencies, time-tracking entries, and file attachments — is
                stored so the Service can display and sync it. LogBase also keeps an append-only activity ledger
                (a durable log of task events such as status changes, reassignments, and comments) as a core part
                of the product.
              </p>
              <p>
                <strong className="text-[var(--fg)]">File attachments.</strong> Files you upload to tasks are stored
                in our object storage along with the filename, size, MIME type, and who uploaded them.
              </p>
              <p>
                <strong className="text-[var(--fg)]">Discord integration.</strong> If an organization owner connects
                a Discord server, we store that server&apos;s (guild) ID and use it to post task attachments to a
                channel you designate, via a bot we operate.
              </p>
              <p>
                <strong className="text-[var(--fg)]">Webhooks you configure.</strong> Organization owners can create
                outbound webhooks. We store the destination URL, a signing secret we generate, the event types
                selected, and a log of delivery attempts (including response status and response body) so you can
                debug your integration.
              </p>
              <p>
                <strong className="text-[var(--fg)]">Notifications &amp; push.</strong> We maintain an in-app
                notification inbox. If you enable browser push notifications, we store the push subscription
                endpoint and keys your browser provides so we can deliver notifications to it.
              </p>
              <p>
                <strong className="text-[var(--fg)]">AI-assisted task creation.</strong> If you use the natural-language
                &ldquo;fill task from text&rdquo; feature, the text you type — along with limited context such as your
                organization&apos;s member list, the current time, and your timezone — is sent to Google&apos;s Gemini
                API to generate a structured task draft. Avoid entering sensitive personal data into this feature.
              </p>
            </Section>

            <Section id="how-we-use-it" title="2. How we use this information">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>To create and secure your account and keep you signed in.</li>
                <li>To operate core features: tasks, activity logs, comments, time tracking, and search.</li>
                <li>To deliver notifications, browser push alerts, and Discord messages you or your organization configure.</li>
                <li>To send event data to webhook endpoints your organization owners set up.</li>
                <li>To generate AI-assisted task drafts when you use that feature.</li>
                <li>To maintain the security, integrity, and reliability of the Service, including detecting abuse.</li>
                <li>To communicate with you about your account or material changes to the Service.</li>
              </ul>
            </Section>

            <Section id="sharing" title="3. Who we share information with">
              <p>We do not sell your personal information. We share data only as needed to run the Service:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><strong className="text-[var(--fg)]">Google</strong> — for Google sign-in, and for the Gemini API used by the AI task-fill feature.</li>
                <li><strong className="text-[var(--fg)]">Discord</strong> — for Discord sign-in and for the optional bot integration that posts attachments to a channel you choose.</li>
                <li><strong className="text-[var(--fg)]">Hosting, database, and file-storage providers</strong> — infrastructure vendors that store and serve application data and uploaded files on our behalf, under contractual confidentiality obligations.</li>
                <li><strong className="text-[var(--fg)]">Authentication infrastructure providers</strong> — used to operate secure sign-in (session issuance, token signing).</li>
                <li><strong className="text-[var(--fg)]">Webhook endpoints you or your organization configure</strong> — event payloads are sent to URLs your organization&apos;s owners explicitly add; they are responsible for what they connect.</li>
                <li>Other members of your organization, to the extent LogBase is a shared workspace product — task content, comments, and activity are visible to people you invite into that organization.</li>
                <li>When required by law, legal process, or to protect the rights, property, or safety of LogBase, our users, or the public.</li>
              </ul>
            </Section>

            <Section id="retention" title="4. Data retention">
              <p>
                We retain account and workspace data for as long as your account or organization remains active,
                because the activity ledger is designed to be a durable record. If you delete your account or an
                organization deletes its workspace, associated data is removed or anonymized within a reasonable
                period, except where we are required to retain it for legal, security, or legitimate business
                reasons (for example, fraud prevention or dispute resolution).
              </p>
            </Section>

            <Section id="cookies" title="5. Cookies &amp; local storage">
              <p>
                LogBase uses a session cookie to keep you signed in and a small local-storage entry to remember your
                light/dark theme preference. We do not use third-party advertising or tracking cookies.
              </p>
            </Section>

            <Section id="your-rights" title="6. Your choices &amp; rights">
              <p>
                Depending on where you live, you may have rights to access, correct, export, or delete your personal
                data, or to object to certain processing. You can update most account details from within the app,
                or contact us at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--fg)] underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>{" "}
                to request access, correction, or deletion of your data. We will respond within a reasonable time
                and may need to verify your identity first.
              </p>
            </Section>

            <Section id="security" title="7. Security">
              <p>
                We use industry-standard measures — encrypted transport, hashed passwords, signed session tokens,
                and access controls — to protect your data. No method of transmission or storage is 100% secure,
                and we cannot guarantee absolute security.
              </p>
            </Section>

            <Section id="childrens-privacy" title="8. Children's privacy">
              <p>
                LogBase is not directed at children and is not intended for use by anyone under 16. We do not
                knowingly collect personal information from children. If you believe a child has provided us with
                personal information, contact us and we will delete it.
              </p>
            </Section>

            <Section id="international" title="9. International use">
              <p>
                LogBase may be accessed from and its infrastructure may be located in different countries. By using
                the Service, you understand your information may be processed outside your country of residence,
                under protections that may differ from those of your home jurisdiction.
              </p>
            </Section>

            <Section id="changes" title="10. Changes to this policy">
              <p>
                We may update this Privacy Policy from time to time. If we make material changes, we will update
                the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you through the Service.
              </p>
            </Section>

            <Section id="contact" title="11. Contact us">
              <p>
                Questions about this policy or your data can be sent to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--fg)] underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Also see our <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--fg)]">Terms of Service</Link>.
        </p>
      </div>
    </main>
  );
}
