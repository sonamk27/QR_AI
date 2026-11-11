import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { openCookiePreferences } from "./consent";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F7F2E9] px-4 py-8 text-[#24211E] sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-subtle sm:p-10">
        <Link to="/" className="text-sm font-bold text-[#573E1B] underline">ReviewFlow</Link>
        <h1 className="mt-5 font-serif text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-[#4A453F]">ReviewFlow provides QR guest feedback and digital loyalty tools for restaurants.</p>
        <div className="legal-copy mt-8 space-y-7 text-sm leading-7 text-[#3B3630]">{children}</div>
        <nav aria-label="Legal pages" className="mt-10 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#E8DFD1] pt-5 text-sm font-semibold text-[#573E1B]">
          <Link to="/privacy" className="underline">Privacy Policy</Link>
          <Link to="/terms" className="underline">Terms of Service</Link>
          <button type="button" onClick={openCookiePreferences} className="underline">Cookie settings</button>
          <Link to="/" className="underline">Home</Link>
        </nav>
      </article>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <section>
        <h2>Information the service uses</h2>
        <p>
          ReviewFlow processes account details provided by restaurant owners, such as a name, email address,
          restaurant name, and city. When guests use a restaurant QR page, the service processes the feedback,
          ratings, and loyalty activity they submit so the restaurant can provide the requested experience.
        </p>
      </section>
      <section>
        <h2>How information is used</h2>
        <p>
          Information is used to authenticate accounts, operate restaurant dashboards and guest QR pages,
          manage feedback and loyalty requests, provide support, and protect the service from misuse.
          Review drafts are editable suggestions; guests decide whether to share them with Google.
        </p>
      </section>
      <section>
        <h2>Service providers and sharing</h2>
        <p>
          Firebase Authentication and Cloud Firestore provide account and application data services.
          Google sign-in is optional. If a guest chooses to open a restaurant's Google review link, Google's
          own privacy terms apply to that interaction. ReviewFlow does not sell personal information.
        </p>
      </section>
      <section>
        <h2>Cookies and local storage</h2>
        <p>
          Essential browser storage supports sign-in, guest sessions, and saved privacy preferences.
          Optional Firebase Analytics is enabled only after consent and only when configured for this deployment.
          You can change that choice at any time using Cookie settings on this page.
        </p>
        <button
          type="button"
          onClick={openCookiePreferences}
          className="mt-3 rounded-xl border border-[#D8CBB6] px-4 py-2 text-xs font-semibold text-[#24211E] hover:bg-[#FAF7F2]"
        >
          Manage cookie preferences
        </button>
      </section>
      <section>
        <h2>Retention and your choices</h2>
        <p>
          Contact us to ask about access, correction, or deletion of information associated with your account.
          Some records may need to be retained for security, dispute resolution, or legal obligations. Restaurant
          owners may also be able to access feedback submitted to their restaurant.
        </p>
      </section>
      <section>
        <h2>Security and contact</h2>
        <p>
          We use service-provider security controls and access restrictions to protect application data, but no
          internet service can guarantee absolute security. For privacy questions, email{" "}
          <a className="font-semibold underline" href="mailto:billing@reviewflow.in">billing@reviewflow.in</a>.
        </p>
      </section>
    </LegalLayout>
  );
}

export function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service">
      <section>
        <h2>Using ReviewFlow</h2>
        <p>
          These terms apply when you access ReviewFlow's restaurant account, QR feedback, and loyalty features.
          Keep your account details accurate, protect your sign-in credentials, and use only accounts you are
          authorized to access.
        </p>
      </section>
      <section>
        <h2>Restaurant and guest responsibilities</h2>
        <p>
          Restaurant owners are responsible for the business details, reward rules, and QR placements they submit.
          Guests should provide honest feedback and use rewards according to the participating restaurant's
          displayed terms. Do not misuse the service, interfere with its operation, or submit unlawful content.
        </p>
      </section>
      <section>
        <h2>Reviews and third-party services</h2>
        <p>
          ReviewFlow may provide an editable review draft based on guest input. It does not publish reviews on
          a guest's behalf or guarantee that a third-party platform will accept or display a review. Firebase,
          Google sign-in, and external review links are subject to their providers' terms and availability.
        </p>
      </section>
      <section>
        <h2>Pricing and availability</h2>
        <p>
          Applicable QR pricing and payment instructions are shown in the service before an order is submitted.
          QR activation can depend on payment review. Features may change, and temporary interruptions can occur.
          Contact support before paying if an amount or activation status is unclear.
        </p>
      </section>
      <section>
        <h2>Suspension and contact</h2>
        <p>
          Access may be restricted when necessary to protect users, investigate misuse, or comply with law.
          For questions about these terms, email{" "}
          <a className="font-semibold underline" href="mailto:billing@reviewflow.in">billing@reviewflow.in</a>.
        </p>
      </section>
      <p className="rounded-xl bg-[#FAF7F2] p-4 text-xs leading-relaxed text-[#4A453F]">
        These terms and the Privacy Policy are general service notices, not legal advice. Have them reviewed for
        your organization and applicable jurisdiction before relying on them as final legal documents.
      </p>
    </LegalLayout>
  );
}
