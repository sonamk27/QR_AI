import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F2E9] px-5 py-12 text-[#24211E]">
      <section className="w-full max-w-lg rounded-3xl border border-[#E8DFD1] bg-white p-8 text-center shadow-subtle sm:p-12">
        <p className="font-serif text-7xl font-bold text-[#B58A4B]">404</p>
        <h1 className="mt-4 font-serif text-2xl font-bold sm:text-3xl">This page took a wrong turn</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#716B64]">
          The link may be outdated, or the page may have moved. Head back to ReviewFlow and find your way from there.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex rounded-xl bg-[#B58A4B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#9E7438]"
        >
          Return to ReviewFlow
        </Link>
      </section>
    </main>
  );
}
