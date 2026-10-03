import Link from "next/link";

const features = [
  {
    title: "The guest stays in control",
    description:
      "They edit the draft and post on Google with their own account. Nothing is posted for them.",
  },
  {
    title: "Honest by design",
    description:
      "Every rating gets the same Google link. Drafts only use what the guest said, so a 3-star visit reads like one.",
  },
  {
    title: "See what guests notice",
    description:
      "Ratings, what they enjoyed, and how many continued to Google — all in one simple dashboard.",
  },
];

function ReviewPreview() {
  return (
    <div
      aria-label="Preview of the guest review experience"
      className="mx-auto w-full max-w-xs rounded-[2rem] border-[3px] border-ink bg-white p-4 shadow-[0_16px_32px_rgba(16,48,47,0.12)] sm:p-5"
    >
      <div className="text-center">
        <p className="text-xs text-ink/50">Spice Route</p>
        <h2 className="mt-1 text-lg font-semibold">How was the food?</h2>
        <div className="mt-2 text-[26px] leading-none tracking-wide text-saffron" aria-label="4 out of 5 stars">
          <span aria-hidden="true">★★★★</span>
          <span className="text-line" aria-hidden="true">★</span>
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-2 text-xs">
        <span className="rounded-full bg-leaf px-3 py-1 text-white">Food</span>
        <span className="rounded-full bg-leaf px-3 py-1 text-white">Staff</span>
        <span className="rounded-full border border-line px-3 py-1 text-ink/70">Speed</span>
      </div>

      <blockquote className="mt-4 rounded-lg bg-paper p-3 text-sm leading-relaxed text-ink/90">
        “The biryani was great and the staff were quick to help. We enjoyed our
        evening.”
      </blockquote>

      <div className="mt-3 rounded-lg bg-ink px-4 py-2.5 text-center text-sm font-medium text-white">
        Continue to Google
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          ReviewFlow
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium transition hover:border-ink"
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn bg-leaf hover:bg-ink">
            Get your QR
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 lg:pb-20 lg:pt-10">
        <div>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            Your guests already have something to say. Make it easy to say it.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink/70 sm:text-lg">
            Put a QR code on the table. Guests rate their visit, answer two
            quick questions, and get a draft in their own voice. They edit it,
            then post it on Google themselves.
          </p>
          <div className="mt-7">
            <Link href="/signup" className="btn">
              Create your account
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink/55">
            ₹999 per QR code, per year. Renewing keeps the same printed code.
          </p>
        </div>
        <ReviewPreview />
      </section>

      <section
        aria-label="Why ReviewFlow"
        className="mx-auto grid w-full max-w-5xl gap-8 border-t border-line px-5 py-10 sm:grid-cols-3 sm:px-8 sm:py-12"
      >
        {features.map((feature) => (
          <article key={feature.title}>
            <h2 className="font-display text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
