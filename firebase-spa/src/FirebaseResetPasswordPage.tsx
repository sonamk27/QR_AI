import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseServices } from "./firebase";

export default function FirebaseResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await sendPasswordResetEmail(getFirebaseServices().auth, email.trim());
      setMessage("If a Firebase account exists for that email, a password reset link has been sent.");
    } catch {
      setMessage("Firebase could not send the reset email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="screen-enter rounded-3xl border border-[#E8DFD1] bg-white p-6 shadow-subtle sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Firebase account</p>
        <h1 className="mt-2 text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-ink/70">We’ll email a secure Firebase password reset link.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-email" className="mb-1.5 block text-xs font-semibold text-[#716B64]">Email</label>
            <input id="reset-email" className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {message && <p role="status" className="text-sm text-[#716B64]">{message}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
        <Link to="/login" className="mt-5 inline-flex text-sm font-semibold text-[#7A5826] underline">Return to sign in</Link>
      </section>
    </main>
  );
}
