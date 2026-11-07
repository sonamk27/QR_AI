import { Link } from "react-router-dom";

export default function FirebaseMigrationNotice() {
  return <section className="rounded-2xl border border-[#E8DFD1] bg-white p-6 shadow-subtle"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9A7441]">ReviewFlow</p><h1 className="mt-2 font-serif text-xl font-bold text-[#24211E]">This section is being moved to Firebase</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#716B64]">The design and workflow are being preserved as the app moves from server routes and PostgreSQL to Firebase Authentication and Firestore.</p><Link to="/dashboard" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#B58A4B] px-4 text-xs font-bold text-white">Back to dashboard</Link></section>;
}
