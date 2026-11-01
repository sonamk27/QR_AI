"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  writeBatch,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import QRCode from "qrcode";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-client";

type Profile = { uid: string; name: string; email: string; role: "restaurant_admin" | "super_admin"; restaurantId?: string };
type Restaurant = { id: string; ownerUid: string; name: string; city?: string; status: string; googleReviewUrl?: string };
type QrCodeRecord = { id: string; restaurantId: string; restaurantName: string; googleReviewUrl?: string; name: string; slug: string; status: string; validUntil?: unknown };
type Feedback = { id: string; restaurantId: string; qrId: string; overallRating: number; foodRating?: number; serviceRating?: number; chips: string[]; freeText?: string; createdAt?: { toDate?: () => Date } };
type RequestRecord = { id: string; restaurantId: string; ownerUid: string; restaurantName: string; name: string; quantity: number; note?: string; status: string; createdAt?: { toDate?: () => Date } };
type LoyaltyProgram = { id: string; restaurantId: string; title: string; isActive: boolean; stampsRequired: number; rewardTitle: string; rewardExpiryDays: number };

const db = () => getFirebaseDb();
const auth = () => getFirebaseAuth();
const pageHref = (path: string) => { window.location.href = path; };
const makeSlug = () => crypto.randomUUID().replaceAll("-", "");
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

function Button({ children, onClick, type = "button", kind = "primary", disabled = false }: {
  children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; kind?: "primary" | "light" | "danger"; disabled?: boolean;
}) {
  return <button className={`button ${kind}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

function SiteHeader({ user, role, onLogout }: { user: User | null; role?: Profile["role"]; onLogout: () => void }) {
  return <header className="site-header"><a className="brand" href="/"><img src="/logo.png" alt=""/><span><b>ReviewFlow</b><small>People · Experiences · Loyalty</small></span></a><nav>{user ? <><a href={role === "super_admin" ? "/super-admin" : "/dashboard"}>Dashboard</a><button className="link-button" onClick={onLogout}>Sign out</button></> : <><a href="/login">Sign in</a><a className="button primary small" href="/signup">Get your QR</a></>}</nav></header>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props}/></label>;
}

export default function StaticApp() {
  const [path, setPath] = useState("/");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");

  useEffect(() => {
    setPath(window.location.pathname + window.location.search);
    try {
      const unsubscribe = onAuthStateChanged(auth(), async (current) => {
        if (current && !current.isAnonymous && !current.emailVerified) {
          await signOut(auth()); setUser(null); setProfile(null); setLoading(false); return;
        }
        setUser(current);
        if (!current) { setProfile(null); setLoading(false); return; }
        try {
          const snapshot = await getDoc(doc(db(), "users", current.uid));
          setProfile(snapshot.exists() ? snapshot.data() as Profile : null);
        } catch (error) { setFatal(messageOf(error)); }
        finally { setLoading(false); }
      }, (error) => { setFatal(error.message); setLoading(false); });
      return unsubscribe;
    } catch (error) { setFatal(messageOf(error)); setLoading(false); }
  }, []);

  const route = useMemo(() => {
    const parsed = new URL(path || "/", "https://reviewflow.local");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "login" || parts[0] === "signup" || parts[0] === "verify-email") return { name: parts[0], code: parsed.searchParams.get("oobCode") ?? "" };
    if (parts[0] === "dashboard") return { name: "dashboard" };
    if (parts[0] === "super-admin") return { name: "super-admin" };
    if (parts[0] === "r" && parts[1]) return { name: "guest", slug: parts[1], loyalty: parts[2] === "loyalty" };
    return { name: "not-found" };
  }, [path]);

  async function logout() { await signOut(auth()); setProfile(null); pageHref("/"); }
  if (fatal) return <main className="center"><section className="panel"><h1>Firebase setup needed</h1><p>{fatal}</p><p>Confirm Firebase Authentication and Cloud Firestore are enabled for the project.</p></section></main>;

  return <><SiteHeader user={user?.isAnonymous ? null : user} role={profile?.role} onLogout={logout}/>{route.name === "home" && <Home/>}{route.name === "login" && <AccountForm mode="login"/>}{route.name === "signup" && <AccountForm mode="signup"/>}{route.name === "verify-email" && <VerifyEmail actionCode={route.code ?? ""}/ >}{route.name === "guest" && (route.loyalty ? <GuestLoyalty slug={route.slug ?? ""}/> : <GuestPage slug={route.slug ?? ""}/ >)}{route.name === "dashboard" && <>{loading ? <Loading/> : user && profile?.role === "restaurant_admin" ? <OwnerDashboard user={user} profile={profile}/> : <AccessMessage text="Sign in with a restaurant account to open the dashboard." action="/login"/>}</>}{route.name === "super-admin" && <>{loading ? <Loading/> : user && profile?.role === "super_admin" ? <SuperAdminDashboard profile={profile}/> : <AccessMessage text="Sign in with a Super Admin account to manage the platform." action="/login"/>}</>}{route.name === "not-found" && <AccessMessage text="We couldn't find that page." action="/"/>}<footer className="site-footer">© {new Date().getFullYear()} ReviewFlow · A simple QR experience for restaurants</footer></>;
}

function Home() {
  return <main className="wrap"><section className="hero"><div><span className="eyebrow">More reviews. Happier customers. Stronger loyalty.</span><h1>Make every guest visit count.</h1><p>A thoughtful QR experience for restaurants: invite guests to share feedback, build loyalty with digital stamps, and turn great visits into lasting relationships.</p><a className="button primary" href="/signup">Start your restaurant account</a></div><div className="preview"><span className="coffee">☕</span><small>THE DAILY BREW</small><h2>Share your experience</h2><div className="stars">★★★★★</div><p>Great coffee · Cozy ambience · Friendly staff</p><blockquote>“The coffee was excellent, the ambience is cozy, and the staff is very friendly.”</blockquote></div></section><section className="feature-grid"><article><span>💬</span><h2>Guest feedback</h2><p>Give guests a quick way to share what they enjoyed.</p></article><article><span>☕</span><h2>Digital loyalty</h2><p>Replace paper punch cards with a simple phone experience.</p></article><article><span>🎁</span><h2>Flexible rewards</h2><p>Recognize repeat visits with rewards that fit your restaurant.</p></article><article><span>📈</span><h2>Clear insights</h2><p>See guest feedback and QR scans in one place.</p></article></section></main>;
}

function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [email, setEmail] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth(), String(data.email).trim().toLowerCase(), String(data.password));
        const restaurantRef = doc(collection(db(), "restaurants"));
        const batch=writeBatch(db());
        batch.set(restaurantRef, { id: restaurantRef.id, ownerUid: credential.user.uid, name: String(data.restaurantName).trim(), city: String(data.city ?? "").trim(), status: "ACTIVE", brandColor: "#1F6F5C", googleReviewUrl: "", createdAt: serverTimestamp() });
        batch.set(doc(db(), "users", credential.user.uid), { uid: credential.user.uid, email: credential.user.email, name: String(data.name).trim(), role: "restaurant_admin", restaurantId: restaurantRef.id, createdAt: serverTimestamp() });
        await batch.commit();
        await sendEmailVerification(credential.user, { url: `${window.location.origin}/verify-email`, handleCodeInApp: true });
        await signOut(auth()); pageHref("/verify-email"); return;
      }
      const credential = await signInWithEmailAndPassword(auth(), String(data.email).trim().toLowerCase(), String(data.password));
      if (!credential.user.emailVerified) { await sendEmailVerification(credential.user, { url: `${window.location.origin}/verify-email`, handleCodeInApp: true }); await signOut(auth()); throw new Error("Verify your email first. We sent you a new verification link."); }
      const snapshot = await getDoc(doc(db(), "users", credential.user.uid));
      const role = snapshot.data()?.role;
      if (role !== "restaurant_admin" && role !== "super_admin") { await signOut(auth()); throw new Error("This account has not been given access to ReviewFlow."); }
      pageHref(role === "super_admin" ? "/super-admin" : "/dashboard");
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function googleSignIn() {
    setBusy(true); setError("");
    try {
      const credential = await signInWithPopup(auth(), new GoogleAuthProvider());
      const userRef = doc(db(), "users", credential.user.uid); const userSnap = await getDoc(userRef);
      if (mode === "signup" && !userSnap.exists()) {
        const restaurantName = window.prompt("Restaurant name");
        if (!restaurantName?.trim()) { await signOut(auth()); return; }
        const restaurantRef = doc(collection(db(), "restaurants"));
        const batch=writeBatch(db());
        batch.set(restaurantRef, { id: restaurantRef.id, ownerUid: credential.user.uid, name: restaurantName.trim(), city: "", status: "ACTIVE", brandColor: "#1F6F5C", googleReviewUrl: "", createdAt: serverTimestamp() });
        batch.set(userRef, { uid: credential.user.uid, email: credential.user.email, name: credential.user.displayName ?? "Restaurant owner", role: "restaurant_admin", restaurantId: restaurantRef.id, createdAt: serverTimestamp() });
        await batch.commit();
        pageHref("/dashboard"); return;
      }
      const role = userSnap.data()?.role;
      if (role !== "restaurant_admin" && role !== "super_admin") throw new Error("No ReviewFlow profile found for this Google account. Choose Create account first.");
      pageHref(role === "super_admin" ? "/super-admin" : "/dashboard");
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <main className="center"><section className="panel auth-panel"><a className="brand" href="/"><img src="/logo.png" alt=""/><b>ReviewFlow</b></a><h1>{mode === "signup" ? "Create your restaurant account" : "Sign in"}</h1><p className="muted">{mode === "signup" ? "Set up your restaurant workspace." : "Welcome back to your restaurant workspace."}</p><form onSubmit={submit} className="form">{mode === "signup" && <><Field name="name" label="Your name" required/><Field name="restaurantName" label="Restaurant name" required/><Field name="city" label="City"/></>}<Field name="email" label="Email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Field name="password" label="Password (8+ characters)" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required/><Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Button>{error && <p className="error" role="alert">{error}</p>}</form><div className="divider">or</div><Button kind="light" onClick={googleSignIn} disabled={busy}>Continue with Google</Button><p className="muted small-text">{mode === "signup" ? <>Already registered? <a href="/login">Sign in</a></> : <>New to ReviewFlow? <a href="/signup">Create an account</a></>}</p></section></main>;
}

function VerifyEmail({ actionCode }: { actionCode: string }) {
  const [message, setMessage] = useState(actionCode ? "Verifying your email…" : "Check your inbox for a Firebase verification link.");
  useEffect(() => { if (!actionCode) return; import("firebase/auth").then(({ applyActionCode }) => applyActionCode(auth(), actionCode)).then(() => setMessage("Your email is verified. You can sign in now.")).catch(() => setMessage("This verification link is invalid or expired. Sign in to request another link.")); }, [actionCode]);
  return <main className="center"><section className="panel"><h1>Verify your email</h1><p>{message}</p><a className="button primary" href="/login">Go to sign in</a></section></main>;
}

function Loading() { return <main className="center"><section className="panel"><p>Loading your workspace…</p></section></main>; }
function AccessMessage({ text, action }: { text: string; action: string }) { return <main className="center"><section className="panel"><h1>ReviewFlow</h1><p>{text}</p><a className="button primary" href={action}>{action === "/" ? "Back home" : "Sign in"}</a></section></main>; }

function OwnerDashboard({ user, profile }: { user: User; profile: Profile }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null); const [qrs, setQrs] = useState<QrCodeRecord[]>([]); const [feedback, setFeedback] = useState<Feedback[]>([]); const [tab, setTab] = useState("Overview"); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null); const [stampRequests, setStampRequests] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  async function refresh() {
    if (!profile.restaurantId) return;
    const [r, q, f, p, sr] = await Promise.all([
      getDoc(doc(db(), "restaurants", profile.restaurantId)),
      getDocs(query(collection(db(), "qrCodes"), where("restaurantId", "==", profile.restaurantId))),
      getDocs(query(collection(db(), "feedback"), where("restaurantId", "==", profile.restaurantId))),
      getDoc(doc(db(), "loyaltyPrograms", profile.restaurantId)),
      getDocs(query(collection(db(), "stampRequests"), where("restaurantId", "==", profile.restaurantId))),
    ]);
    setRestaurant(r.exists() ? r.data() as Restaurant : null);
    setQrs(q.docs.map(d => ({ ...d.data(), id: d.id }) as QrCodeRecord));
    setFeedback(f.docs.map(d => ({ ...d.data(), id: d.id }) as Feedback).sort((a,b)=>(b.createdAt?.toDate?.().getTime() ?? 0)-(a.createdAt?.toDate?.().getTime() ?? 0)));
    setProgram(p.exists() ? p.data() as LoyaltyProgram : null);
    setStampRequests(sr.docs.map(d => ({ ...d.data(), id: d.id }) as Record<string, unknown> & { id: string }));
  }
  useEffect(() => { refresh().catch(e=>setNotice(messageOf(e))); }, [profile.restaurantId]);
  async function requestQr(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=event.currentTarget; if (!restaurant || !profile.restaurantId) return;
    setBusy(true); setNotice(""); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { await addDoc(collection(db(), "qrRequests"), { restaurantId: profile.restaurantId, ownerUid: user.uid, restaurantName: restaurant.name, name: String(data.name), quantity: Number(data.quantity) || 1, note: String(data.note ?? ""), status: "PENDING_APPROVAL", createdAt: serverTimestamp() }); setNotice("QR request sent to the platform administrator."); form.reset(); }
    catch (e) { setNotice(messageOf(e)); } finally { setBusy(false); }
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!restaurant) return; const data=Object.fromEntries(new FormData(event.currentTarget).entries()); setBusy(true);
    try { await updateDoc(doc(db(), "restaurants", restaurant.id), { name: String(data.name), city: String(data.city), googleReviewUrl: String(data.googleReviewUrl), updatedAt: serverTimestamp() }); await refresh(); setNotice("Restaurant details saved."); } catch(e){setNotice(messageOf(e));} finally{setBusy(false);}
  }
  async function saveProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!restaurant) return; const data=Object.fromEntries(new FormData(event.currentTarget).entries()); setBusy(true);
    try { await setDoc(doc(db(), "loyaltyPrograms", restaurant.id), { id: restaurant.id, restaurantId: restaurant.id, title: String(data.title), isActive: data.isActive === "on", stampsRequired: Math.max(2, Number(data.stampsRequired) || 10), rewardTitle: String(data.rewardTitle), rewardExpiryDays: Math.max(1, Number(data.rewardExpiryDays) || 30), updatedAt: serverTimestamp() }); await refresh(); setNotice("Loyalty program saved."); } catch(e){setNotice(messageOf(e));} finally{setBusy(false);}
  }
  async function reviewStampRequest(requestId: string, approved: boolean) {
    setBusy(true); setNotice("");
    try {
      await runTransaction(db(), async transaction => {
        const requestRef=doc(db(),"stampRequests",requestId); const requestSnap=await transaction.get(requestRef);
        if(!requestSnap.exists()) throw new Error("This stamp request no longer exists.");
        const request=requestSnap.data(); const customerUid=String(request.customerUid ?? "");
        if(!approved){transaction.update(requestRef,{status:"REJECTED",reviewedAt:serverTimestamp()});return;}
        if(!customerUid) throw new Error("The customer profile is missing.");
        const customerRef=doc(db(),"loyaltyCustomers",customerUid); const customerSnap=await transaction.get(customerRef);
        const programRef=doc(db(),"loyaltyPrograms",String(request.restaurantId)); const programSnap=await transaction.get(programRef);
        if(!programSnap.exists()) throw new Error("The loyalty program is no longer active.");
        const current=customerSnap.exists()?Number(customerSnap.data().currentStamps??0):0;
        const lifetime=customerSnap.exists()?Number(customerSnap.data().lifetimeStamps??0):0;
        const required=Number(programSnap.data().stampsRequired??10); const next=current+1;
        transaction.set(customerRef,{uid:customerUid,restaurantId:request.restaurantId,name:request.customerName??"",phone:request.customerPhone??"",currentStamps:next>=required?0:next,lifetimeStamps:lifetime+1,updatedAt:serverTimestamp()},{merge:true});
        transaction.update(requestRef,{status:"APPROVED",reviewedAt:serverTimestamp(),reviewedByUid:user.uid});
        if(next>=required){const rewardRef=doc(collection(db(),"loyaltyRewards"));transaction.set(rewardRef,{id:rewardRef.id,restaurantId:request.restaurantId,customerUid,code:makeSlug().slice(0,10).toUpperCase(),title:programSnap.data().rewardTitle??"Reward",status:"UNREDEEMED",createdAt:serverTimestamp()});}
      });
      setNotice(approved?"Stamp approved and customer card updated.":"Stamp request rejected."); await refresh();
    } catch(e){setNotice(messageOf(e));} finally{setBusy(false);}
  }
  const average = feedback.length ? feedback.reduce((sum,f)=>sum+f.overallRating,0)/feedback.length : 0;
  if (!profile.restaurantId) return <AccessMessage text="This account has no restaurant workspace." action="/"/>;
  return <main className="dashboard wrap"><aside className="dash-nav"><b>{restaurant?.name ?? "Restaurant workspace"}</b><small>{profile.name} · Restaurant admin</small>{["Overview","QR codes","Feedback","QR requests","Loyalty","Restaurant settings"].map(item=><button className={tab===item?"selected":""} key={item} onClick={()=>setTab(item)}>{item}</button>)}<a className="button light" href="/">Public home</a></aside><section className="dash-content"><p className="eyebrow">Restaurant portal</p><h1>{tab}</h1>{notice && <p className="notice">{notice}</p>}{tab === "Overview" && <><div className="stats"><Metric label="QR codes" value={qrs.length}/><Metric label="Guest responses" value={feedback.length}/><Metric label="Average rating" value={feedback.length ? average.toFixed(1)+" ★" : "—"}/></div><h2>Your QR codes</h2><QrList records={qrs}/><p className="muted">Feedback and QR information is stored in Cloud Firestore.</p></>}{tab === "QR codes" && <><h2>Your QR codes</h2><QrList records={qrs}/></>}{tab === "Feedback" && <FeedbackList feedback={feedback}/ >}{tab === "QR requests" && <><form className="form panel inline-form" onSubmit={requestQr}><h2>Request a QR code</h2><Field name="name" label="Placement name (for example, Table 1)" required/><Field name="quantity" label="Quantity" type="number" min={1} max={50} defaultValue={1}/><Field name="note" label="Notes"/><Button type="submit" disabled={busy}>{busy?"Sending…":"Submit request"}</Button></form><p className="muted">QR requests are reviewed by your platform administrator. Payment and activation are handled outside this free static deployment.</p></>}{tab === "Loyalty" && <><form className="form panel inline-form" onSubmit={saveProgram}><h2>Program setup</h2><Field name="title" label="Program title" defaultValue={program?.title ?? "Rewards Program"}/><Field name="stampsRequired" label="Stamps for a reward" type="number" min={2} max={100} defaultValue={program?.stampsRequired ?? 10}/><Field name="rewardTitle" label="Reward" defaultValue={program?.rewardTitle ?? "Free reward"}/><Field name="rewardExpiryDays" label="Reward validity (days)" type="number" min={1} max={365} defaultValue={program?.rewardExpiryDays ?? 30}/><label className="field"><span><input name="isActive" type="checkbox" defaultChecked={program?.isActive ?? true}/> Program active</span></label><Button type="submit" disabled={busy}>Save program</Button></form><h2>Pending stamp requests</h2>{stampRequests.filter(r=>r.status==="PENDING").length===0?<p className="empty">No pending stamp requests.</p>:stampRequests.filter(r=>r.status==="PENDING").map(r=><article className="panel request" key={r.id}><div><b>{String(r.customerName??"Guest")}</b><p>{String(r.customerPhone??"")}</p></div><div className="actions"><Button onClick={()=>reviewStampRequest(r.id,true)} disabled={busy}>Approve</Button><Button kind="danger" onClick={()=>reviewStampRequest(r.id,false)} disabled={busy}>Reject</Button></div></article>)}</>}{tab === "Restaurant settings" && restaurant && <form className="form panel" onSubmit={saveProfile}><Field name="name" label="Restaurant name" defaultValue={restaurant.name}/><Field name="city" label="City" defaultValue={restaurant.city}/><Field name="googleReviewUrl" label="Google review URL" type="url" defaultValue={restaurant.googleReviewUrl}/><Button type="submit" disabled={busy}>Save settings</Button></form>}</section></main>;
}

function Metric({ label, value }: { label:string; value:string|number }) { return <article className="metric"><small>{label}</small><b>{value}</b></article>; }

function QrList({ records }: { records: QrCodeRecord[] }) {
  const [images,setImages]=useState<Record<string,string>>({});
  useEffect(()=>{let live=true;Promise.all(records.map(async qr=>[qr.id,await QRCode.toDataURL(`${window.location.origin}/r/${qr.slug}`,{width:240,margin:1})] as const)).then(items=>{if(live)setImages(Object.fromEntries(items));}).catch(()=>{});return()=>{live=false;};},[records]);
  if (!records.length) return <p className="empty">No active QR codes yet.</p>;
  return <div className="qr-grid">{records.map(qr=><article className="qr-card" key={qr.id}>{images[qr.id]&&<img src={images[qr.id]} alt={`QR code for ${qr.name}`}/>}<b>{qr.name}</b><small>{qr.status}</small><a href={`/r/${qr.slug}`}>Open feedback page</a><a href={`/r/${qr.slug}/loyalty`}>Open loyalty card</a>{images[qr.id]&&<a href={images[qr.id]} download={`${qr.name.replace(/\W+/g,"-")}-qr.png`}>Download PNG</a>}</article>)}</div>;
}

function FeedbackList({ feedback }: { feedback: Feedback[] }) {
  if (!feedback.length) return <p className="empty">No guest feedback yet.</p>;
  return <div className="feedback-list">{feedback.map(item=><article className="panel" key={item.id}><div className="stars">{"★".repeat(item.overallRating)}{"☆".repeat(5-item.overallRating)}</div><p>{item.freeText || item.chips.join(" · ") || "Guest left a rating."}</p><small>{item.createdAt?.toDate?.().toLocaleString() ?? "Just now"}</small></article>)}</div>;
}

function SuperAdminDashboard({ profile }: { profile: Profile }) {
  const [requests,setRequests]=useState<RequestRecord[]>([]); const [restaurants,setRestaurants]=useState<Restaurant[]>([]); const [notice,setNotice]=useState(""); const [tab,setTab]=useState("QR requests");
  async function refresh(){const [r,q]=await Promise.all([getDocs(collection(db(),"restaurants")),getDocs(collection(db(),"qrRequests"))]);setRestaurants(r.docs.map(d=>({...d.data(),id:d.id}) as Restaurant));setRequests(q.docs.map(d=>({...d.data(),id:d.id}) as RequestRecord).sort((a,b)=>(b.createdAt?.toDate?.().getTime()??0)-(a.createdAt?.toDate?.().getTime()??0)));}
  useEffect(()=>{refresh().catch(e=>setNotice(messageOf(e)));},[]);
  async function approve(request:RequestRecord){try{for(let i=0;i<Math.max(1,request.quantity);i++){const qrRef=doc(collection(db(),"qrCodes"));const slug=makeSlug();const restaurant=restaurants.find(r=>r.id===request.restaurantId);await setDoc(qrRef,{id:qrRef.id,restaurantId:request.restaurantId,restaurantName:restaurant?.name??request.restaurantName,googleReviewUrl:restaurant?.googleReviewUrl??"",name:request.quantity>1?`${request.name} ${i+1}`:request.name,slug,status:"ACTIVE",createdAt:serverTimestamp()});}await updateDoc(doc(db(),"qrRequests",request.id),{status:"ACTIVE",reviewedAt:serverTimestamp(),reviewedByUid:profile.uid});setNotice("QR request approved and codes created.");await refresh();}catch(e){setNotice(messageOf(e));}}
  async function reject(request:RequestRecord){try{await updateDoc(doc(db(),"qrRequests",request.id),{status:"REJECTED",reviewedAt:serverTimestamp(),reviewedByUid:profile.uid});setNotice("Request rejected.");await refresh();}catch(e){setNotice(messageOf(e));}}
  return <main className="dashboard wrap"><aside className="dash-nav"><b>ReviewFlow</b><small>Platform administrator</small>{["QR requests","Restaurants"].map(item=><button className={tab===item?"selected":""} key={item} onClick={()=>setTab(item)}>{item}</button>)}<p className="muted small-text">{profile.email}</p></aside><section className="dash-content"><p className="eyebrow">Super Admin</p><h1>{tab}</h1>{notice&&<p className="notice">{notice}</p>}{tab==="QR requests"?requests.map(r=><article className="panel request" key={r.id}><div><b>{r.restaurantName}</b><p>{r.name} · Qty {r.quantity}</p><small>{r.note} · {r.status}</small></div>{r.status==="PENDING_APPROVAL"&&<div className="actions"><Button onClick={()=>approve(r)}>Approve</Button><Button kind="danger" onClick={()=>reject(r)}>Reject</Button></div>}</article>):<div className="feedback-list">{restaurants.map(r=><article className="panel" key={r.id}><b>{r.name}</b><p>{r.city} · {r.status}</p><small>{r.id}</small></article>)}</div>}</section></main>;
}

function GuestPage({ slug }: { slug: string }) {
  const [qr,setQr]=useState<QrCodeRecord|null>(null); const [error,setError]=useState(""); const [rating,setRating]=useState(5); const [chips,setChips]=useState<string[]>([]); const [text,setText]=useState(""); const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false); const [draft,setDraft]=useState("");
  useEffect(()=>{getDocs(query(collection(db(),"qrCodes"),where("slug","==",slug),limit(1))).then(s=>{if(!s.empty)setQr({...s.docs[0].data(),id:s.docs[0].id} as QrCodeRecord);else setError("This QR code isn't active.");}).catch(e=>setError(messageOf(e)));},[slug]);
  const options=["Great coffee","Delicious food","Friendly staff","Cozy ambience","Quick service","Lovely atmosphere"];
  async function submit(event:React.FormEvent){event.preventDefault();if(!qr)return;setBusy(true);setError("");try{const ref=await addDoc(collection(db(),"feedback"),{restaurantId:qr.restaurantId,qrId:qr.id,overallRating:rating,chips,freeText:text.trim(),createdAt:serverTimestamp()});const compliment=chips.length?chips.join(", "):"the visit";const sentence=text.trim()?` ${text.trim()}`:"";setDraft(`We had a ${rating}-star experience at ${qr.restaurantName}. We especially enjoyed ${compliment}.${sentence}`);setSent(true);void ref;}catch(e){setError(messageOf(e));}finally{setBusy(false);}}
  if(error&&!qr)return <main className="center"><section className="panel"><h1>QR code unavailable</h1><p>{error}</p></section></main>;
  if(!qr)return <Loading/>;
  return <main className="center"><section className="panel guest-panel"><div className="coffee">☕</div><small>{qr.restaurantName}</small><h1>{sent?"Thanks for visiting!":"Share your experience"}</h1>{sent?<><p>Your feedback helps {qr.restaurantName} improve.</p><div className="draft">{draft}</div><button className="button primary" onClick={()=>qr.googleReviewUrl&&window.open(qr.googleReviewUrl,"_blank","noopener,noreferrer")} disabled={!qr.googleReviewUrl}>Continue to Google</button><p className="muted small-text">You can edit or ignore this suggested text before posting.</p><p className="small-text"><a href={`/r/${slug}/loyalty`}>Open loyalty card →</a></p></>:<form onSubmit={submit} className="form"><label className="rating">{[1,2,3,4,5].map(i=><button type="button" aria-label={`${i} stars`} key={i} onClick={()=>setRating(i)}>{i<=rating?"★":"☆"}</button>)}</label><div className="chips">{options.map(option=><button type="button" key={option} className={chips.includes(option)?"chip active":"chip"} onClick={()=>setChips(c=>c.includes(option)?c.filter(x=>x!==option):[...c,option])}>{option}</button>)}</div><label className="field"><span>Anything else? (optional)</span><textarea rows={3} maxLength={500} value={text} onChange={e=>setText(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<Button type="submit" disabled={busy}>{busy?"Sending…":"Send feedback"}</Button></form>}</section></main>;
}

function GuestLoyalty({ slug }: { slug: string }) {
  const [qr,setQr]=useState<QrCodeRecord|null>(null); const [program,setProgram]=useState<LoyaltyProgram|null>(null); const [card,setCard]=useState<Record<string,unknown>|null>(null); const [rewards,setRewards]=useState<Array<Record<string,unknown>>>([]); const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>{getDocs(query(collection(db(),"qrCodes"),where("slug","==",slug),limit(1))).then(async result=>{if(result.empty)throw new Error("This QR code isn't active.");const item={...result.docs[0].data(),id:result.docs[0].id} as QrCodeRecord;setQr(item);const p=await getDoc(doc(db(),"loyaltyPrograms",item.restaurantId));if(p.exists())setProgram(p.data() as LoyaltyProgram);}).catch(e=>setNotice(messageOf(e)));},[slug]);
  async function loadCard(customerUid:string,restaurantId:string){const customerId=`${restaurantId}_${customerUid}`;const c=await getDoc(doc(db(),"loyaltyCustomers",customerId));if(c.exists()){setCard(c.data());setName(String(c.data().name??""));setPhone(String(c.data().phone??""));}const r=await getDocs(query(collection(db(),"loyaltyRewards"),where("restaurantId","==",restaurantId),where("customerUid","==",customerUid)));setRewards(r.docs.map(d=>d.data()));}
  useEffect(()=>{if(!qr)return;let cancel=false;const run=async()=>{let current=auth().currentUser;if(!current)current=(await signInAnonymously(auth())).user;if(!cancel)await loadCard(current.uid,qr.restaurantId);};run().catch(e=>setNotice(messageOf(e)));return()=>{cancel=true;};},[qr?.id]);
  async function enroll(event:React.FormEvent){event.preventDefault();const currentUser=auth().currentUser;if(!qr||!currentUser)return;setBusy(true);setNotice("");try{const uid=currentUser.uid;const customerId=`${qr.restaurantId}_${uid}`;await setDoc(doc(db(),"loyaltyCustomers",customerId),{id:customerId,customerUid:uid,restaurantId:qr.restaurantId,name:name.trim(),phone:phone.trim(),currentStamps:Number(card?.currentStamps??0),lifetimeStamps:Number(card?.lifetimeStamps??0),updatedAt:serverTimestamp()},{merge:true});setCard({...(card??{}),id:customerId,customerUid:uid,restaurantId:qr.restaurantId,name:name.trim(),phone:phone.trim()});setNotice("Your loyalty card is ready.");}catch(e){setNotice(messageOf(e));}finally{setBusy(false);}}
  async function requestStamp(){const currentUser=auth().currentUser;if(!qr||!program||!currentUser)return;setBusy(true);setNotice("");try{const uid=currentUser.uid;const customerId=`${qr.restaurantId}_${uid}`;if(!card){setNotice("Save your name and phone number first.");return;}await addDoc(collection(db(),"stampRequests"),{customerUid:uid,customerId,restaurantId:qr.restaurantId,programId:qr.restaurantId,qrId:qr.id,qrSlug:slug,customerName:name,customerPhone:phone,status:"PENDING",createdAt:serverTimestamp()});setNotice("Stamp request sent. The restaurant will review it shortly.");}catch(e){setNotice(messageOf(e));}finally{setBusy(false);}}
  if(!qr)return <main className="center"><section className="panel"><h1>Loyalty card</h1><p>{notice||"Loading…"}</p></section></main>;
  if(!program||!program.isActive)return <main className="center"><section className="panel"><h1>{qr.restaurantName}</h1><p>This restaurant hasn't enabled a loyalty program yet.</p><a href={`/r/${slug}`}>Share feedback</a></section></main>;
  return <main className="center"><section className="panel guest-panel"><div className="coffee">☕</div><small>{qr.restaurantName}</small><h1>{program.title}</h1><p>Collect {program.stampsRequired} stamps for: {program.rewardTitle}</p>{card?<><div className="stamp-row">{Array.from({length:program.stampsRequired},(_,i)=><span key={i} className={i<Number(card.currentStamps??0)?"stamp filled":"stamp"}>{i<Number(card.currentStamps??0)?"★":"·"}</span>)}</div><p className="muted">{Number(card.currentStamps??0)} of {program.stampsRequired} stamps · {name} · {phone}</p><Button onClick={requestStamp} disabled={busy}>Request a visit stamp</Button><h2>Your rewards</h2>{rewards.length?rewards.map((reward,i)=><p className="notice" key={i}>{String(reward.title)} · {String(reward.code)} · {String(reward.status)}</p>):<p className="muted">Rewards appear here after you collect enough stamps.</p>}</>:<form className="form" onSubmit={enroll}><Field label="Your name" value={name} onChange={e=>setName(e.target.value)} required/><Field label="Phone number" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required/><Button type="submit" disabled={busy}>Create my card</Button></form>}{notice&&<p className="notice">{notice}</p>}<p className="small-text muted"><a href={`/r/${slug}`}>Back to feedback</a></p></section></main>;
}
