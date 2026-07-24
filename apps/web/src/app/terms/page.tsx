import Link from "next/link";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { LogBaseMark } from "@/components/brand/LogBaseMark";

const wordmark = Outfit({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Terms of Service — LogBase",
  description: "The terms that govern your use of LogBase.",
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

export default function TermsOfServicePage() {
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--fg)] sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Last updated: {LAST_UPDATED}</p>

          <p className="mt-6 text-[15px] leading-relaxed text-[var(--muted)]">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of LogBase (the
            &ldquo;Service&rdquo;). By creating an account or otherwise using LogBase, you agree to these Terms. If
            you are using LogBase on behalf of an organization, you are agreeing on that organization&apos;s behalf
            and confirming you have authority to do so.
          </p>

          <div className="mt-10 space-y-10">
            <Section id="accounts" title="1. Accounts">
              <p>
                You must provide accurate information when creating an account and are responsible for safeguarding
                your credentials and any Google or Discord account you use to sign in. You are responsible for all
                activity that occurs under your account. You must be at least 16 years old to use LogBase.
              </p>
            </Section>

            <Section id="use-of-service" title="2. Acceptable use">
              <p>You agree not to:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Use LogBase for any unlawful purpose or in violation of any applicable law or regulation.</li>
                <li>Attempt to gain unauthorized access to another user&apos;s account, another organization&apos;s workspace, or the Service&apos;s infrastructure.</li>
                <li>Interfere with, overload, or disrupt the Service, including its authentication, webhook delivery, or AI-assisted features.</li>
                <li>Upload malicious files, or use the file attachment or Discord-posting features to distribute harmful content.</li>
                <li>Configure webhooks that are used to attack, spam, or abuse third-party systems.</li>
                <li>Submit content to the AI task-fill feature that is illegal, infringing, or that you do not have the right to share.</li>
                <li>Reverse-engineer, scrape, or resell the Service without our written consent.</li>
              </ul>
            </Section>

            <Section id="organizations" title="3. Organizations &amp; workspace data">
              <p>
                LogBase is organized around organizations, departments, and roles (owner, manager, member). Content
                you create inside an organization — tasks, comments, attachments, activity history — is visible to
                other members of that organization according to the roles and permissions its owners configure.
                Organization owners are responsible for who they invite and for any integrations (webhooks, Discord
                connections) they set up. LogBase is not responsible for actions taken by other members of your
                organization or by third-party systems your organization connects.
              </p>
            </Section>

            <Section id="third-party" title="4. Third-party services">
              <p>
                LogBase integrates with third-party services, including Google and Discord (for sign-in and, for
                Discord, optional bot posting) and Google&apos;s Gemini API (for AI-assisted task drafting). Your use
                of those integrations is also subject to the respective third party&apos;s own terms and privacy
                policies. We are not responsible for the availability, accuracy, or content of third-party services,
                including AI-generated output, which may be incomplete or inaccurate and should be reviewed before
                you rely on it.
              </p>
            </Section>

            <Section id="webhooks" title="5. Webhooks &amp; API use">
              <p>
                If you configure outbound webhooks, you are responsible for the security of the endpoints you
                register and for the signing secret we issue you. You must not point a webhook at a system you do
                not own or have permission to send data to.
              </p>
            </Section>

            <Section id="ip" title="6. Intellectual property">
              <p>
                LogBase and its branding, design, and underlying software are owned by us or our licensors and are
                protected by intellectual property laws. You retain ownership of the content you create in LogBase
                (tasks, comments, attachments, and similar workspace content). By using the Service, you grant us a
                limited license to host, process, and display that content solely to operate and provide the
                Service to you and your organization.
              </p>
            </Section>

            <Section id="termination" title="7. Suspension &amp; termination">
              <p>
                We may suspend or terminate your access to the Service if you violate these Terms, create risk or
                legal exposure for us, or if required by law. You may stop using LogBase and request deletion of
                your account at any time by contacting us.
              </p>
            </Section>

            <Section id="disclaimer" title="8. Disclaimer of warranties">
              <p>
                The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
                kind, express or implied, including implied warranties of merchantability, fitness for a particular
                purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free,
                or that AI-generated content will be accurate.
              </p>
            </Section>

            <Section id="liability" title="9. Limitation of liability">
              <p>
                To the maximum extent permitted by law, LogBase and its operators will not be liable for any
                indirect, incidental, special, consequential, or punitive damages, or any loss of data, revenue, or
                profits, arising from your use of, or inability to use, the Service.
              </p>
            </Section>

            <Section id="governing-law" title="10. Governing law">
              <p>
                These Terms are intended to be interpreted under generally applicable principles of contract law.
                Where a specific governing law and venue is required to resolve a dispute, that law and venue will
                be the one that applies to LogBase&apos;s place of operation at the time of the dispute, or as
                otherwise agreed in writing between the parties.
              </p>
            </Section>

            <Section id="changes" title="11. Changes to these terms">
              <p>
                We may modify these Terms from time to time. If we make material changes, we will update the
                &ldquo;Last updated&rdquo; date above and, where appropriate, notify you through the Service.
                Continued use of LogBase after changes take effect constitutes acceptance of the revised Terms.
              </p>
            </Section>

            <Section id="contact" title="12. Contact us">
              <p>
                Questions about these Terms can be sent to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--fg)] underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Also see our <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--fg)]">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
