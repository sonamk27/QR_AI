import Link from "next/link";
import Image from "next/image";

const photos = [
  {
    number: "01",
    label: "Independent shops",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1000&q=85",
    alt: "Small business owner helping a customer at checkout",
  },
  {
    number: "02",
    label: "Easy customer feedback",
    image: "https://images.pexels.com/photos/16345589/pexels-photo-16345589.jpeg?auto=compress&cs=tinysrgb&w=1000",
    alt: "Customer using a smartphone to scan a QR code",
  },
  {
    number: "03",
    label: "Services people return for",
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=85",
    alt: "Stylist providing a salon service",
  },
];

const features = [
  {
    number: "01",
    title: "Customer feedback, made easy",
    description:
      "Customers share what stood out, then shape an editable review draft they can choose to post on Google.",
  },
  {
    number: "02",
    title: "Loyalty that brings people back",
    description:
      "Digital stamps and rewards give customers a simple reason to choose your business again.",
  },
  {
    number: "03",
    title: "A clearer view of your business",
    description:
      "Keep feedback, stamp requests, and reward redemptions together in one simple dashboard.",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#A98A59] sm:text-[11px]">
      {children}
    </p>
  );
}

function ReviewCard() {
  return (
    <div className="landing-review-card absolute -bottom-5 left-4 right-4 rounded-2xl border border-white/60 bg-[#FBF8F1] p-4 shadow-[0_20px_60px_rgba(20,15,10,0.28)] sm:bottom-8 sm:left-auto sm:right-[-2rem] sm:w-64 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#776B5B]">A better kind of follow-up</span>
        <span className="text-sm tracking-[0.12em] text-[#9A7537]" aria-label="5 out of 5 stars">★★★★★</span>
      </div>
      <p className="mt-3 font-serif text-lg leading-snug text-[#24211E]">“It’s the little things that bring us back.”</p>
      <div className="mt-4 flex items-center justify-between border-t border-[#E8DFD1] pt-3">
        <span className="text-[11px] text-[#716B64]">Feedback that brings customers closer</span>
        <span className="rounded-full bg-[#24211E] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-[#E8D8BA]">RF</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F6F1E8] text-[#24211E]">
      <header className="relative z-10 border-b border-[#DCD2C2] bg-[#F6F1E8]/95">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" aria-label="ReviewFlow home" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#24211E] font-serif text-lg font-bold tracking-tight text-[#D4B77F] shadow-sm">RF</span>
            <span>
              <span className="block font-serif text-lg font-semibold leading-none tracking-tight">ReviewFlow</span>
              <span className="mt-1 hidden font-mono text-[8px] uppercase tracking-[0.16em] text-[#776B5B] sm:block">For businesses built on repeat visits</span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-6">
            <Link href="#experience" className="hidden text-xs font-medium text-[#514A43] transition hover:text-[#8B642D] sm:inline">The experience</Link>
            <Link href="#craft" className="hidden text-xs font-medium text-[#514A43] transition hover:text-[#8B642D] sm:inline">Our approach</Link>
            <Link href="/login" className="rounded-full px-3 py-2 text-xs font-semibold text-[#24211E] transition hover:bg-[#EBE4D9]">Sign in</Link>
            <Link href="/signup" className="rounded-full bg-[#24211E] px-4 py-2.5 text-center text-xs font-semibold text-[#FBF8F1] shadow-sm transition hover:bg-[#3B3630] sm:px-5">Get started <span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20 lg:px-12 lg:pt-20">
        <div className="relative z-[1]">
          <SectionLabel>ReviewFlow&nbsp; / &nbsp;For customer-first businesses</SectionLabel>
          <h1 className="mt-5 max-w-xl font-serif text-[clamp(3.1rem,7vw,5.8rem)] font-medium leading-[0.98] tracking-[-0.045em] text-[#24211E]">
            Turn every visit into a reason to <span className="italic text-[#8B642D]">return.</span>
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-[#625B52] sm:text-base">
            Make it easy for customers to share feedback, write a review, and earn rewards—with one simple QR experience for your business.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#24211E] px-6 text-sm font-semibold text-[#FBF8F1] shadow-[0_8px_24px_rgba(36,33,30,0.16)] transition hover:-translate-y-0.5 hover:bg-[#3B3630]">
              Get started for your business <span aria-hidden="true" className="text-[#D4B77F]">↗</span>
            </Link>
            <Link href="#experience" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#CFC3B1] px-6 text-sm font-semibold text-[#3B3630] transition hover:bg-white/60">
              See how it feels
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#776B5B]">
            <span className="font-mono uppercase tracking-[0.12em]">QR reviews</span>
            <span className="h-1 w-1 rounded-full bg-[#A98A59]" aria-hidden="true" />
            <span className="font-mono uppercase tracking-[0.12em]">Digital loyalty</span>
            <span className="h-1 w-1 rounded-full bg-[#A98A59]" aria-hidden="true" />
            <span className="font-mono uppercase tracking-[0.12em]">For restaurants, cafes, salons & shops</span>
          </div>
        </div>

        <div className="landing-hero-photo relative mx-auto w-full max-w-[42rem]">
          <div className="relative h-[25rem] overflow-hidden rounded-[1.75rem] bg-[#30251D] sm:h-[34rem] sm:rounded-[2rem]">
            <Image
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=85"
              alt="Small business owner helping a customer at checkout"
              width={1600}
              height={1100}
              sizes="(min-width: 1024px) 52vw, 100vw"
              priority
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17120F]/75 via-[#17120F]/10 to-[#17120F]/10" aria-hidden="true" />
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/25 bg-[#201914]/50 px-3 py-2 text-[9px] font-mono uppercase tracking-[0.14em] text-white backdrop-blur-sm sm:left-7 sm:top-7">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4B77F]" aria-hidden="true" />
              A small touch. A lasting impression.
            </div>
            <div className="absolute bottom-7 left-6 max-w-xs text-[#FBF8F1] sm:bottom-10 sm:left-8">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#E2C892]">For every customer interaction</p>
              <p className="mt-2 font-serif text-2xl leading-tight sm:text-3xl">The experience continues after the visit.</p>
            </div>
          </div>
          <ReviewCard />
          <div className="absolute -left-4 top-1/3 hidden h-24 w-24 rounded-full border border-[#B99A65]/50 sm:block" aria-hidden="true" />
        </div>
      </section>

      <section id="experience" className="bg-[#24211E] px-5 py-16 text-[#F6F1E8] sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <SectionLabel>01. The experience</SectionLabel>
              <h2 className="mt-4 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-5xl">Thoughtful by design.<br /><span className="italic text-[#D4B77F]">Simple for everyone.</span></h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#D0C6B8]">A scan opens a warm, easy path from customer feedback to a little thank-you for coming back.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.number} className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 transition hover:border-[#B99A65]/70 hover:bg-white/[0.07] sm:p-7">
                <p className="font-mono text-[10px] tracking-[0.16em] text-[#D4B77F]">{feature.number} <span className="ml-1 uppercase">/ ReviewFlow</span></p>
                <h3 className="mt-7 font-serif text-xl font-medium text-[#FBF8F1] sm:text-2xl">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#C7BEB2]">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="craft" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <div>
            <SectionLabel>02. The setting</SectionLabel>
            <h2 className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-5xl">Made for the way<br />you do business.</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#625B52] md:justify-self-end">Whether you welcome diners, serve coffee, offer personal care, or run a local shop, give every customer a consistent way to share feedback and come back.</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.number} className="group overflow-hidden rounded-2xl border border-[#E1D8CA] bg-[#FBF8F1] shadow-[0_8px_28px_rgba(36,33,30,0.05)]">
              <div className="relative h-64 overflow-hidden bg-[#D8CBB6] sm:h-72">
                <Image
                  src={photo.image}
                  alt={photo.alt}
                  width={1000}
                  height={720}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#17120F]/50 to-transparent" aria-hidden="true" />
                {photo.number !== "02" && (
                  <div aria-hidden="true" className="absolute left-1/2 top-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                    <div className="rounded-t-md border border-white/80 bg-white/40 px-4 pb-3 pt-2 shadow-[0_8px_24px_rgba(20,15,10,0.28)] backdrop-blur-[2px]">
                      <p className="mb-2 text-center font-mono text-[8px] uppercase tracking-[0.15em] text-[#3B3630]">ReviewFlow</p>
                      <svg viewBox="0 0 54 54" className="h-14 w-14 rounded-sm border border-white/80 bg-white p-1" focusable="false">
                        <path fill="#24211E" d="M2 2h18v18H2zm4 4v10h10V6zm28-4h18v18H34zm4 4v10h10V6zM2 34h18v18H2zm4 4v10h10V38zm24-14h6v6h-6zm8 0h6v6h-6zm8 0h4v8h-4zm-18 8h6v6h-6zm8 2h6v6h-6zm10 0h6v4h-6zm-18 8h6v6h-6zm8 4h6v6h-6zm8-4h8v6h-8z" />
                      </svg>
                    </div>
                    <span className="h-8 w-24 border-x border-white/70 bg-white/25 shadow-[0_4px_12px_rgba(20,15,10,0.18)] backdrop-blur-[2px]" />
                    <span className="h-2 w-28 rounded-b-sm border border-[#D4B77F]/70 bg-[#B99A65]/90 shadow-[0_5px_12px_rgba(20,15,10,0.24)]" />
                  </div>
                )}
                <span className="absolute bottom-4 left-4 rounded-full border border-white/35 bg-[#201914]/45 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-white backdrop-blur-sm">{photo.number}. {photo.label}</span>
              </div>
            </figure>
          ))}
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[1.75rem] bg-[#EAE1D2] p-7 sm:p-10 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <SectionLabel>03. Built for your next customer</SectionLabel>
            <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">Turn a great experience into the beginning of a habit.</h2>
            <p className="mt-3 text-sm leading-6 text-[#625B52]">One simple QR experience for reviews and rewards, ready for your business.</p>
          </div>
          <Link href="/signup" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-[#24211E] px-6 text-sm font-semibold text-[#FBF8F1] transition hover:bg-[#3B3630]">Get started <span className="text-[#D4B77F]" aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <footer className="border-t border-[#DCD2C2] bg-[#F1EADF] px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-xs text-[#625B52] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#24211E] font-serif text-xs font-bold text-[#D4B77F]">RF</span>
            <p>ReviewFlow helps local businesses grow customer feedback and loyalty.</p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-5 font-semibold text-[#3B3630]">
            <Link href="/privacy" className="transition hover:text-[#8B642D]">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-[#8B642D]">Terms of Service</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
