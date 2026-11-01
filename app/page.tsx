import Link from "next/link";
import Image from "next/image";

const features = [
  {
    icon: "💬",
    title: "AI-Powered Review Assistance",
    description:
      "Guests rate their visit, pick what they enjoyed, and receive an authentic draft in seconds. They edit and post it on Google themselves.",
  },
  {
    icon: "☕",
    title: "Digital Loyalty Stamps",
    description:
      "Replace easily lost paper punch cards with instant, frictionless digital stamps tracked directly on customer smartphones.",
  },
  {
    icon: "🎁",
    title: "Customizable Rewards",
    description:
      "Set stamp milestones, percent discounts, fixed deductions, or free menu items with flexible expiry windows.",
  },
  {
    icon: "📊",
    title: "Real-Time Business Dashboard",
    description:
      "Monitor new customer acquisition, stamp requests, voucher redemptions, and review conversions live.",
  },
];

function ReviewPreview() {
  return (
    <div
      aria-label="Preview of the guest review experience"
      className="mx-auto w-full max-w-xs rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-subtle"
    >
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5ED] text-base text-[#B58A4B] border border-[#E8D8BA]">
          ☕
        </div>
        <p className="text-[11px] font-medium text-[#716B64] uppercase tracking-wider">The Daily Brew</p>
        <h2 className="mt-1 font-serif text-lg font-bold text-[#24211E]">Share Your Experience</h2>
        <div className="mt-2 text-2xl text-[#B58A4B] tracking-wider" aria-label="5 out of 5 stars">
          <span aria-hidden="true">★★★★★</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-xs">
        <span className="rounded-full bg-[#24211E] px-3 py-1 font-semibold text-white text-[11px]">Great coffee</span>
        <span className="rounded-full bg-[#24211E] px-3 py-1 font-semibold text-white text-[11px]">Cozy ambience</span>
        <span className="rounded-full border border-[#E8DFD1] bg-[#FAF7F2] px-3 py-1 text-[#716B64] text-[11px]">Friendly staff</span>
      </div>

      <blockquote className="mt-4 rounded-xl border border-[#E8D8BA] bg-[#FAF5ED] p-3 text-xs leading-relaxed italic text-[#24211E]">
        &ldquo;The coffee was excellent, the ambience is cozy, and the staff is very friendly. Highly recommended!&rdquo;
      </blockquote>

      <div className="mt-4 rounded-xl bg-[#B58A4B] px-4 py-2.5 text-center text-xs font-bold text-white shadow-2xs">
        Copy &amp; Review on Google
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F2E9] text-[#24211E]">
      {/* Top Banner Header matching Reference Mockup */}
      <div className="border-b border-[#E8DFD1] bg-[#FAF7F2]">
        <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-4">
          <div className="flex w-full min-w-0 items-center gap-2.5 sm:w-auto">
            <Image src="/logo.png" alt="ReviewFlow" width={128} height={64} className="shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              <Link href="/" className="font-serif text-xl font-bold tracking-tight text-[#24211E]">
                ReviewFlow
              </Link>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-[#716B64] uppercase tracking-wider">
                • QR AI Review &amp; Loyalty System
              </span>
            </div>
          </div>
          <nav aria-label="Main navigation" className="flex w-full items-center gap-2.5 sm:w-auto">
            <Link
              href="/login"
              className="flex-1 rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2 text-center text-xs font-semibold text-[#24211E] shadow-2xs transition hover:bg-[#FAF7F2] sm:flex-none"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex-1 rounded-xl bg-[#B58A4B] px-4 py-2 text-center text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438] sm:flex-none"
            >
              Get Your QR
            </Link>
          </nav>
        </header>
      </div>

      {/* Hero Section */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-12 pt-8 sm:gap-10 sm:px-8 sm:pb-16 sm:pt-14 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:pb-20">
        <div>
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#E8D8BA] bg-[#FAF5ED] px-3 py-1 text-[11px] font-bold leading-relaxed text-[#7A5826] sm:px-3.5 sm:text-xs">
            <span>✨</span>
            <span>More Reviews. Happier Customers. Stronger Loyalty.</span>
          </span>

          <h1 className="mt-4 font-serif text-3xl font-extrabold leading-tight tracking-tight text-[#24211E] sm:text-5xl">
            QR AI Review System for Restaurants
          </h1>
          <p className="mt-4 max-w-lg text-sm sm:text-base leading-relaxed text-[#716B64]">
            A simple, seamless and delightful experience — from scan to reward.
            Guests scan table QRs, collect digital stamps, unlock customizable vouchers, and generate genuine reviews with AI assistance.
          </p>

          <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link
              href="/signup"
              className="rounded-2xl bg-[#B58A4B] px-4 py-3.5 text-center text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] sm:px-6"
            >
              Start Free Restaurant Trial →
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-[#E8DFD1] bg-white px-4 py-3.5 text-center text-xs font-bold text-[#24211E] shadow-2xs transition hover:bg-[#FAF7F2] sm:px-5"
            >
              Owner Portal Sign In
            </Link>
          </div>

          <p className="mt-4 text-xs text-[#716B64]/70">
            ₹999 per QR code per year • Seamless table stand activation
          </p>
        </div>

        <ReviewPreview />
      </section>

      {/* Features Grid */}
      <section
        aria-label="Features"
        className="mx-auto grid w-full max-w-6xl gap-4 border-t border-[#E8DFD1] px-4 py-10 sm:grid-cols-2 sm:gap-6 sm:px-8 sm:py-12 lg:grid-cols-4"
      >
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-[#E8DFD1] bg-white p-4 shadow-subtle transition hover:border-[#B58A4B] sm:p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF5ED] text-xl border border-[#E8D8BA]">
              {feature.icon}
            </span>
            <h2 className="mt-3 font-serif text-base font-bold text-[#24211E]">{feature.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#716B64]">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
