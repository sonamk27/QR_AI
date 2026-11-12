import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { BusinessLogoInput } from "../../components/BusinessLogoInput";
import { isSupportedLogo } from "../../lib/logo-url";
import { getFirebaseServices } from "./firebase";

type Portal = "restaurant_admin" | "super_admin";
type Props = { mode: "login" | "signup"; portal?: Portal };

export default function FirebaseAuthForm({ mode, portal }: Props) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoProcessing, setLogoProcessing] = useState(false);
  const authAttemptInProgress = useRef(false);

  async function provisionRestaurant(uid: string, email: string, name: string, restaurantName: string, city: string, refCode: string, logo: string) {
    const { db } = getFirebaseServices();
    const userRef = doc(db, "users", uid);
    const existing = await getDoc(userRef);
    if (existing.exists()) return existing.data().role as string;

    const restaurantRef = doc(db, "restaurants", uid);
    const publicRestaurantRef = doc(db, "publicRestaurants", uid);
    const batch = writeBatch(db);
    batch.set(userRef, {
      uid,
      email: email.toLowerCase(),
      name,
      role: "restaurant_admin",
      createdAt: serverTimestamp(),
    });
    batch.set(restaurantRef, {
      ownerUid: uid,
      name: restaurantName,
      businessType: "RESTAURANT",
      city: city || null,
      logoUrl: logo || null,
      referredByName: refCode || null,
      brandColor: "#1F6F5C",
      status: "ACTIVE",
      aiEnabled: false,
      createdAt: serverTimestamp(),
    });
    batch.set(publicRestaurantRef, {
      restaurantId: uid,
      name: restaurantName,
      businessType: "RESTAURANT",
      city: city || null,
      logoUrl: logo || null,
      brandColor: "#1F6F5C",
      status: "ACTIVE",
    });
    const program = {
      id: uid, ownerUid: uid, restaurantId: uid, title: "Rewards Program", isActive: true,
      discountType: "FLAT", stampsRequired: 10, minBillAmount: 20000,
      rewardTitle: "₹100 Off Your Bill", rewardDiscount: 10000, rewardExpiryDays: 30,
      terminalPin: "1234", createdAt: serverTimestamp(),
    };
    batch.set(doc(db, "loyaltyPrograms", uid), program);
    batch.set(doc(db, "loyaltyPublicPrograms", uid), {
      id: uid, programId: uid, restaurantId: uid, ownerUid: uid,
      title: program.title, isActive: program.isActive, discountType: program.discountType,
      stampsRequired: program.stampsRequired, minBillAmount: program.minBillAmount,
      rewardTitle: program.rewardTitle, rewardDiscount: program.rewardDiscount,
      rewardExpiryDays: program.rewardExpiryDays,
    });
    await batch.commit();
    return "restaurant_admin";
  }

  async function completeLogin(user: User) {
    const { db } = getFirebaseServices();
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("No ReviewFlow profile is linked to this Firebase account. Create an account or contact your administrator.");
    const profile = snap.data();
    const role = profile.role as string;
    if (portal && role !== portal) {
      throw new Error(role === "super_admin" ? "This account is for the Super Admin portal." : "This account is for the Restaurant Admin portal.");
    }
    navigate(role === "super_admin" ? "/super-admin" : "/dashboard");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (String(data.website ?? "").trim()) {
      setError("Unable to submit this request. Please try again.");
      return;
    }
    if (mode === "signup" && (!String(data.name ?? "").trim() || !String(data.restaurantName ?? "").trim())) {
      setError("Enter your name and business name to create an account.");
      return;
    }
    if (mode === "signup" && String(data.logoUrl ?? "").trim() && !isSupportedLogo(String(data.logoUrl).trim())) {
      setError("Upload a PNG, JPG, or WebP logo, or enter a secure HTTPS image URL up to 2,000 characters.");
      return;
    }
    if (mode === "signup" && logoProcessing) {
      setError("Wait for the logo to finish processing before creating your account.");
      return;
    }
    if (mode === "signup" && (String(data.name).trim().length > 100 || String(data.restaurantName).trim().length > 100 || String(data.city ?? "").trim().length > 80)) {
      setError("Names must be 100 characters or fewer and city must be 80 characters or fewer.");
      return;
    }
    if (mode === "signup" && portal) {
      setError("Sign-up is only available for restaurant accounts.");
      return;
    }
    if (authAttemptInProgress.current) return;
    authAttemptInProgress.current = true;
    setBusy(true);
    setError("");
    try {
      const { auth } = getFirebaseServices();
      const credential = mode === "signup"
        ? await createUserWithEmailAndPassword(auth, String(data.email).trim(), String(data.password))
        : await signInWithEmailAndPassword(auth, String(data.email).trim(), String(data.password));
      if (mode === "signup") {
        try {
          await provisionRestaurant(credential.user.uid, credential.user.email ?? String(data.email), String(data.name), String(data.restaurantName), String(data.city ?? ""), String(data.refCode ?? ""), String(data.logoUrl ?? ""));
        } catch (provisionError) {
          await deleteUser(credential.user).catch((cleanupError) => console.error("Could not remove incomplete Firebase signup", cleanupError));
          throw provisionError;
        }
      }
      await completeLogin(credential.user);
    } catch (caught) {
      const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
      if (mode === "signup" && code === "permission-denied") {
        setError("Firebase denied saving the business profile. Deploy the latest Firestore rules, then try again.");
        return;
      }
      const mapped: Record<string, string> = {
        "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/weak-password": "Choose a stronger password (at least 8 characters).",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/too-many-requests": "Firebase has temporarily limited email requests. Wait before trying again.",
      };
      setError(mapped[code] ?? (caught instanceof Error ? caught.message : "Unable to sign in. Please try again."));
    } finally {
      authAttemptInProgress.current = false;
      setBusy(false);
    }
  }

  async function googleSignIn() {
    const form = document.querySelector<HTMLFormElement>("form[data-auth-form]");
    const data = form ? Object.fromEntries(new FormData(form).entries()) : {};
    if (String(data.website ?? "").trim()) {
      setError("Unable to submit this request. Please try again.");
      return;
    }
    if (mode === "signup" && (!String(data.name ?? "").trim() || !String(data.restaurantName ?? "").trim())) {
      setError("Enter your name and business name to create an account.");
      return;
    }
    if (mode === "signup" && String(data.logoUrl ?? "").trim() && !isSupportedLogo(String(data.logoUrl).trim())) {
      setError("Upload a PNG, JPG, or WebP logo, or enter a secure HTTPS image URL up to 2,000 characters.");
      return;
    }
    if (mode === "signup" && logoProcessing) {
      setError("Wait for the logo to finish processing before creating your account.");
      return;
    }
    if (mode === "signup" && (String(data.name).trim().length > 100 || String(data.restaurantName).trim().length > 100 || String(data.city ?? "").trim().length > 80)) {
      setError("Names must be 100 characters or fewer and city must be 80 characters or fewer.");
      return;
    }
    if (authAttemptInProgress.current) return;
    authAttemptInProgress.current = true;
    setBusy(true);
    setError("");
    try {
      const { auth } = getFirebaseServices();
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      if (mode === "signup") {
        try {
          await provisionRestaurant(credential.user.uid, credential.user.email ?? "", String(data.name), String(data.restaurantName), String(data.city ?? ""), String(data.refCode ?? ""), String(data.logoUrl ?? ""));
        } catch (provisionError) {
          if (getAdditionalUserInfo(credential)?.isNewUser) {
            await deleteUser(credential.user).catch((cleanupError) => console.error("Could not remove incomplete Google signup", cleanupError));
          }
          throw provisionError;
        }
      }
      await completeLogin(credential.user);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Google sign-in failed.";
      if (!message.includes("popup-closed-by-user") && !message.includes("cancelled-popup-request")) setError(message);
    } finally {
      authAttemptInProgress.current = false;
      setBusy(false);
    }
  }

  const field = (name: string, label: string, type = "text", required = true, autocomplete = "off") => (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#716B64]" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} autoComplete={autocomplete}
        autoCapitalize={type === "email" ? "none" : undefined} spellCheck={type === "email" ? false : undefined}
        className="w-full rounded-xl border border-[#E8DFD1] bg-white px-3.5 py-2.5 text-sm text-[#24211E] outline-none transition focus:border-[#B58A4B] focus:ring-1 focus:ring-[#B58A4B]"
        minLength={type === "password" ? 8 : undefined}
        maxLength={type === "password" ? 128 : type === "email" ? 254 : name === "city" ? 80 : name === "refCode" ? 64 : 100} />
    </div>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <section className="w-full">
        <Link to="/" aria-label="ReviewFlow home" className="inline-flex w-fit items-center gap-3 rounded-xl">
          <span className="flex h-12 w-24 items-center justify-center rounded-xl border border-[#E8DFD1] bg-white px-2 shadow-sm">
            <img src="/logo.svg" alt="ReviewFlow logo" width={48} height={48} className="h-auto w-full object-contain" />
          </span>
          <span className="font-display text-xl font-semibold">ReviewFlow</span>
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink/50">
          {portal === "super_admin" ? "Platform management" : portal === "restaurant_admin" ? "Restaurant portal" : "Secure account access"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{mode === "login" ? portal === "super_admin" ? "Super Admin sign in" : portal === "restaurant_admin" ? "Restaurant Admin sign in" : "Sign in" : "Create your business account"}</h1>
        <form data-auth-form onSubmit={submit} autoComplete={mode === "signup" ? "off" : "on"} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label htmlFor="website">Leave this field empty</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
          )}
          {mode === "signup" && field("name", "Your name", "text", true, "name")}
          {mode === "signup" && field("restaurantName", "Business name", "text", true, "organization")}
          {mode === "signup" && (
            <BusinessLogoInput
              value={logoUrl}
              onChange={setLogoUrl}
              disabled={busy}
              onProcessingChange={setLogoProcessing}
            />
          )}
          {mode === "signup" && field("city", "City", "text", false, "address-level2")}
          {field("email", "Email", "email", true, mode === "signup" ? "off" : "username")}
          {field("password", mode === "signup" ? "Password (8+ characters)" : "Password", "password", true, mode === "signup" ? "new-password" : "current-password")}
          {mode === "signup" && field("refCode", "Referral code (optional)", "text", false)}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="btn w-full" disabled={busy || logoProcessing}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        {portal !== "super_admin" && <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink/45"><span className="h-px flex-1 bg-line" /><span>OR</span><span className="h-px flex-1 bg-line" /></div>
          <button type="button" onClick={googleSignIn} disabled={busy || logoProcessing} className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-paper disabled:opacity-60">
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M5.84 9.91c.87-2.6 3.3-4.53 6.16-4.53 1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
            </svg>
            Continue with Google
          </button>
        </>}
        {mode === "login" && <Link to="/reset-password" className="mt-4 inline-flex text-sm font-medium text-[#7A5826] underline">Forgot password?</Link>}
        {mode === "signup" && <p className="mt-6 text-sm text-ink/70">Already have an account? <Link className="underline" to="/login">Sign in</Link></p>}
      </section>
    </main>
  );
}
