import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { env } from "@/lib/env";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  const name = env.appName;
  const operator = env.operatorName || `the operator of this ${name} instance`;
  const days = env.auditRetentionDays;
  const updated = "20 October 2026";

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-6">
        <article className="card p-6 sm:p-10">
          <p className="text-xs uppercase tracking-wider text-faint">Last updated {updated}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy policy &amp; cookies</h1>
          <p className="mt-4 text-muted">
            {name} helps people find themselves and others in the photos of a shared Google Drive folder. Face search is a sensitive
            feature, so we are deliberately transparent about what is stored, why, and for how long. This policy is provided by{" "}
            <strong className="text-ink">{operator}</strong>.
          </p>

          <Section title="1. The short version">
            <ul>
              <li>Face matching runs <strong>on this server only</strong>. Nothing is sent to third-party AI services.</li>
              <li>
                Every face search is <strong>recorded in an audit log</strong>: the photo you uploaded or captured, the time, which folder was
                searched, how many matches were found, your Google account (if you signed in), your IP address and browser details.
              </li>
              <li>Audit entries and uploaded photos are deleted automatically after <strong>{days} days</strong>.</li>
              <li>The app only ever <strong>reads</strong> from Google Drive. It never modifies, moves or deletes anything.</li>
            </ul>
          </Section>

          <Section title="2. What we collect and why">
            <h3>When you run “Find me” or “Find someone”</h3>
            <ul>
              <li>
                <strong>The query photos</strong> – the selfie you take or the photos you upload (up to five reference photos per search), downscaled
                to at most 1280 px. Stored so that misuse of face search (for example searching for someone without a legitimate reason) can be
                investigated.
              </li>
              <li>
                <strong>Search details</strong> – date and time, search mode, the folder searched, number of faces detected in your photo, number
                of photos scanned and number of matches, how long the scan took and whether it completed or was cancelled.
              </li>
              <li>
                <strong>Who searched</strong> – your Google account e-mail and name if you signed in, your IP address and your browser’s
                user-agent string.
              </li>
              <li>
                <strong>Your consent record</strong> – when you accepted or declined this notice, with IP address and browser details.
              </li>
            </ul>
            <h3>Face templates</h3>
            <p>
              To find matches this server computes a numeric <em>face template</em> (512 numbers) for every face in the drive’s photos and for
              the faces in your query photos. Templates of the drive’s photos, together with the position of each face, are kept in an index on
              this server so that searches by you or other people with access to the same folder are fast. Templates cannot be turned back into
              a picture. They are stored per photo and replaced when a photo changes, or removed when the server’s data directory is cleared.
              The models used (face detection and recognition) run locally on the server; no image or template leaves it.
            </p>
            <h3>When you browse photos</h3>
            <p>
              Thumbnails are proxied through this server so they can be displayed and analysed. The server does not keep copies of the photos
              in the drive beyond short-lived caching needed to serve them.
            </p>
          </Section>

          <Section title="3. Google account data">
            <p>
              If the folder is private you sign in with Google and grant <code>drive.readonly</code> access. The access token is stored in an
              encrypted, HTTP-only cookie on your device and used only to list folders and fetch photo thumbnails from Google Drive on your
              behalf. Signing out (menu → Sign out) deletes it. {name}’s use of information received from Google APIs adheres to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </Section>

          <Section title="4. Cookies and local storage">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Purpose</th>
                  <th>Lifetime</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>filomina_consent</code></td>
                  <td>Remembers whether you accepted or declined this notice.</td>
                  <td>1 year</td>
                </tr>
                <tr>
                  <td><code>filomina_session</code></td>
                  <td>Encrypted Google sign-in session (private folders only).</td>
                  <td>30 days</td>
                </tr>
                <tr>
                  <td><code>filomina_oauth</code></td>
                  <td>Protects the Google sign-in hand-off against forgery.</td>
                  <td>10 minutes</td>
                </tr>
                <tr>
                  <td><code>filomina_admin</code></td>
                  <td>Audit-log administrator session.</td>
                  <td>12 hours</td>
                </tr>
                <tr>
                  <td><code>filomina_root</code> (local storage)</td>
                  <td>The Drive folder you connected.</td>
                  <td>Until cleared</td>
                </tr>
              </tbody>
            </table>
            <p>We do not use advertising or third-party analytics cookies. You can change your choice any time via “Cookie settings” in the footer.</p>
          </Section>

          <Section title="5. Retention and deletion">
            <p>
              Uploaded query photos and audit entries are deleted automatically {days} days after they were created. Face templates of the
              drive’s photos stay in the index until the photo changes or the server data is cleared. Session cookies expire as listed above. To
              have your data removed earlier, contact us (section 8).
            </p>
          </Section>

          <Section title="6. Who can see the audit log">
            <p>
              Only administrators of this {name} instance, using a secret key, can view the audit log and the stored query photos. It is used to
              detect and investigate misuse, to answer complaints from people who appear in the drive’s photos, and for security.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>
              Depending on where you live you may have the right to access, correct or delete personal data we hold about you, to object to its
              processing, or to lodge a complaint with a supervisory authority. If you appear in photos in the drive and do not want to be
              findable, contact the drive owner to remove the photos, or contact us to purge cached face templates.
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              Questions or requests:{" "}
              {env.privacyEmail ? (
                <a href={`mailto:${env.privacyEmail}`}>{env.privacyEmail}</a>
              ) : (
                <span className="text-muted">the operator has not configured a contact address yet (PRIVACY_CONTACT_EMAIL).</span>
              )}
            </p>
          </Section>

          <p className="mt-10 text-sm text-faint">
            <Link href="/" className="underline decoration-dotted underline-offset-2 hover:text-ink">
              ← Back to {name}
            </Link>
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="prose-filomina mt-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted [&_a]:text-accent [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-ink [&_em]:text-ink [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-faint [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
