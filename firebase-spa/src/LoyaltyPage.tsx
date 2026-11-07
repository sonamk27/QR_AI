import { useEffect, useState } from "react";
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { LoyaltySettingsView } from "../../components/loyalty/LoyaltySettingsView";
import type { PendingStampRequest } from "../../components/loyalty/OwnerStampRequestsPanel";
import { getFirebaseServices } from "./firebase";
import { useAuthState } from "./AuthState";
import { useOutletContext } from "react-router-dom";
import type { DashboardOutletContext } from "./DashboardShell";

function date(value: any): Date | null { if (value?.toDate) return value.toDate(); if (value instanceof Date) return value; return null; }
function defaultProgram(id: string, ownerUid: string, restaurantId: string) { return { id, ownerUid, restaurantId, title: "Rewards Program", isActive: true, discountType: "FLAT", stampsRequired: 10, minBillAmount: 20000, rewardTitle: "₹100 Off Your Bill", rewardDiscount: 10000, rewardExpiryDays: 30, terminalPin: "1234" }; }
function publicProgram(program: any) { return { id: program.restaurantId, programId: program.id, restaurantId: program.restaurantId, ownerUid: program.ownerUid, title: program.title, isActive: program.isActive, discountType: program.discountType, stampsRequired: program.stampsRequired, minBillAmount: program.minBillAmount, rewardTitle: program.rewardTitle, rewardDiscount: program.rewardDiscount, rewardExpiryDays: program.rewardExpiryDays }; }

export default function LoyaltyPage() {
  const { user } = useAuthState(); const { restaurant, restaurantId } = useOutletContext<DashboardOutletContext>();
  const [program, setProgram] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { if (!user || !restaurantId) return; let alive = true; void (async () => { try {
    const { db } = getFirebaseServices(); const programSnap = await getDocs(query(collection(db, "loyaltyPrograms"), where("ownerUid", "==", user.uid)));
    let current = programSnap.docs.find((d) => d.data().restaurantId === restaurantId);
    if (!current) {
      const ref = doc(db, "loyaltyPrograms", restaurantId);
      await runTransaction(db, async (tx) => { const snap = await tx.get(ref); if (!snap.exists()) { const created = defaultProgram(ref.id, user.uid, restaurantId); tx.set(ref, created); tx.set(doc(db, "loyaltyPublicPrograms", restaurantId), publicProgram(created)); } });
      current = await getDocs(query(collection(db, "loyaltyPrograms"), where("ownerUid", "==", user.uid))).then((s) => s.docs.find((d) => d.data().restaurantId === restaurantId));
    }
    if (!current) throw new Error("Could not create the loyalty program settings.");
    if (alive) setProgram({ id: current.id, ...current.data() });
  } catch (e) { console.error("Loyalty program could not be loaded", e); if (alive) setError("Could not load loyalty data. Check your Firestore rules."); }
  finally { if (alive) setLoading(false); } })(); return () => { alive = false; }; }, [user, restaurantId]);

  async function loadDashboardData() {
    if (!user || !restaurantId) throw new Error("Restaurant profile is still loading.");
    const { db } = getFirebaseServices(); const now = new Date(); const cutDaily = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); const cutMonthly = new Date(now.getFullYear(), now.getMonth() - 11, 1); const owned = (name: string, ...filters: any[]) => query(collection(db, name), where("ownerUid", "==", user.uid), ...filters);
    const [phoneCount, anonCount, txCount, anonTxCount, unredeemed, anonUnredeemed, redeemed, anonRedeemed, pendingCount, reviewCount, phoneRecent, anonRecent, phoneTx, anonTx, phoneGrowth, anonGrowth] = await Promise.all([
      getCountFromServer(owned("loyaltyCustomers")), getCountFromServer(owned("anonymousCustomers")),
      getCountFromServer(owned("loyaltyTransactions")), getCountFromServer(owned("anonymousStampTransactions")),
      getCountFromServer(owned("loyaltyRewards", where("status", "==", "UNREDEEMED"))), getCountFromServer(owned("anonymousRewards", where("status", "==", "UNREDEEMED"))),
      getCountFromServer(owned("loyaltyRewards", where("status", "==", "REDEEMED"))), getCountFromServer(owned("anonymousRewards", where("status", "==", "REDEEMED"))),
      getCountFromServer(owned("stampRequests", where("status", "==", "PENDING"))), getCountFromServer(owned("feedbackSessions", where("googleClickedAt", "!=", null))),
      getDocs(owned("loyaltyCustomers", orderBy("lastVisitAt", "desc"), limit(10))), getDocs(owned("anonymousCustomers", orderBy("lastVisitAt", "desc"), limit(10))),
      getDocs(owned("loyaltyTransactions", orderBy("createdAt", "desc"), limit(10))), getDocs(owned("anonymousStampTransactions", orderBy("createdAt", "desc"), limit(10))),
      getDocs(owned("loyaltyCustomers", where("createdAt", ">=", cutMonthly))), getDocs(owned("anonymousCustomers", where("createdAt", ">=", cutMonthly))),
    ]);
    const phoneCustomers: any[] = phoneRecent.docs.map((d) => ({ id: d.id, ...d.data() })); const anonCustomers: any[] = anonRecent.docs.map((d) => ({ id: d.id, ...d.data(), name: `Anonymous (${d.id.slice(0, 8)}…)`, phone: d.id }));
    const recentCustomers = [...phoneCustomers, ...anonCustomers].sort((a, b) => (date(b.lastVisitAt)?.getTime() ?? 0) - (date(a.lastVisitAt)?.getTime() ?? 0)).slice(0, 10).map((c) => ({ id: c.id, name: c.name || "Valued Diner", phone: c.phone || "", visits: Math.max(1, Number(c.lifetimeStamps ?? c.currentStamps ?? 0)), stamps: Number(c.currentStamps ?? 0), lastVisit: date(c.lastVisitAt)?.toLocaleDateString("en-IN") ?? "Today" }));
    const txRows = [...phoneTx.docs.map((d) => ({ id: d.id, ...d.data(), stamps: d.data().stampsCount, created: date(d.data().createdAt) })), ...anonTx.docs.map((d) => ({ id: d.id, ...d.data(), stamps: d.data().amount, created: date(d.data().createdAt) }))].sort((a: any, b: any) => (b.created?.getTime() ?? 0) - (a.created?.getTime() ?? 0)).slice(0, 15);
    const customerDocs = await Promise.all([...new Set(txRows.map((r: any) => `${r.customerId}`))].map(async (id) => { const phone = phoneCustomers.find((c) => c.id === id); const anon = anonCustomers.find((c) => c.id === id); if (phone || anon) return [id, phone ?? anon] as const; const a = await getDoc(doc(db, "loyaltyCustomers", id)); if (a.exists()) return [id, { id, ...a.data() }] as const; const b = await getDoc(doc(db, "anonymousCustomers", id)); return [id, b.exists() ? { id, ...b.data(), name: `Anonymous (${id.slice(0, 8)}…)`, phone: id } : null] as const; }));
    const customerMap = new Map(customerDocs); const recentActivity = txRows.map((tx: any) => { const c: any = customerMap.get(String(tx.customerId)); return { id: tx.id, stampsCount: Number(tx.stamps ?? 1), billAmount: tx.billAmount ?? null, billReference: tx.billReference ?? tx.verificationRef ?? null, createdAt: tx.created?.toISOString() ?? new Date(0).toISOString(), customer: { phone: c?.phone ?? "", name: c?.name ?? "Customer", currentStamps: Number(c?.currentStamps ?? 0) } }; });
    const growthPoints = (phoneRows: any[], anonRows: any[], count: number, mode: "day" | "month"): any[] => Array.from({ length: count }, (_, index) => { const offset = count - 1 - index; const d = mode === "day" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset) : new Date(now.getFullYear(), now.getMonth() - offset, 1); const next = mode === "day" ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) : new Date(d.getFullYear(), d.getMonth() + 1, 1); const countRows = (rows: any[]) => rows.filter((c) => { const created = date(c.createdAt); return !!created && created >= d && created < next; }).length; const p = countRows(phoneRows); const a = countRows(anonRows); return mode === "day" ? { date: d.toISOString().slice(0, 10), day: d.toLocaleDateString("en-IN", { weekday: "short" }), shortDate: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), label: offset === 0 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }), count: p + a, phoneCount: p, anonCount: a } : { month: d.toLocaleDateString("en-IN", { month: "short" }), label: d.toLocaleDateString("en-IN", { month: "short" }), fullMonth: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), year: d.getFullYear(), count: p + a, phoneCount: p, anonCount: a }; });
    const stats = { totalCustomers: phoneCount.data().count + anonCount.data().count, totalTransactions: txCount.data().count + anonTxCount.data().count, unredeemedRewards: unredeemed.data().count + anonUnredeemed.data().count, redeemedRewards: redeemed.data().count + anonRedeemed.data().count, pendingStampRequests: pendingCount.data().count, reviewClicks: reviewCount.data().count };
    return { stats, customers: recentCustomers, recentActivity, dailyGrowth: growthPoints(phoneGrowth.docs.map((d) => d.data()), anonGrowth.docs.map((d) => d.data()), 30, "day"), monthlyGrowth: growthPoints(phoneGrowth.docs.map((d) => d.data()), anonGrowth.docs.map((d) => d.data()), 12, "month"), program: program ?? undefined };
  }
  async function saveProgram(settings: any) {
    if (!program || !user) throw new Error("Loyalty program is still loading.");
    const { db } = getFirebaseServices(); const ref = doc(db, "loyaltyPrograms", program.id);
    const next = { ...program, title: settings.title.trim(), isActive: settings.isActive, discountType: settings.discountType, stampsRequired: Number(settings.stampsRequired), minBillAmount: Math.round(Number(settings.minBillAmountRupees) * 100), rewardTitle: settings.rewardTitle.trim(), rewardDiscount: settings.discountType === "FLAT" ? Math.round(Number(settings.rewardDiscountRupees) * 100) : Number(settings.rewardDiscountRupees), rewardExpiryDays: Number(settings.rewardExpiryDays), terminalPin: settings.terminalPin || "1234", updatedAt: serverTimestamp() };
    const { updatedAt, ...display } = next; const publicRef = doc(db, "loyaltyPublicPrograms", String(program.restaurantId)); await runTransaction(db, async (tx) => { const snap = await tx.get(ref); if (!snap.exists() || snap.data().ownerUid !== user.uid) throw new Error("Loyalty program access could not be verified."); const publicSnap = await tx.get(publicRef); tx.update(ref, next); if (publicSnap.exists()) tx.update(publicRef, publicProgram(display)); else tx.set(publicRef, publicProgram(display)); });
    setProgram(display); return display;
  }

  async function loadStampRequests() {
    if (!user || !restaurantId) return { pending: [], recent: [] };
    const { db } = getFirebaseServices();
    const [requestSnap, phoneSnap, anonSnap] = await Promise.all([
      getDocs(query(collection(db, "stampRequests"), where("ownerUid", "==", user.uid))),
      getDocs(query(collection(db, "loyaltyCustomers"), where("ownerUid", "==", user.uid))),
      getDocs(query(collection(db, "anonymousCustomers"), where("ownerUid", "==", user.uid))),
    ]);
    const phoneById = new Map(phoneSnap.docs.map((d) => [d.id, d.data()]));
    const anonById = new Map(anonSnap.docs.map((d) => [d.id, d.data()]));
    const mapped = requestSnap.docs.map((d) => {
      const row = d.data(); const isAnon = Boolean(row.anonCustomerId); const customer = isAnon ? anonById.get(String(row.anonCustomerId)) : phoneById.get(String(row.customerId));
      return { id: d.id, customerName: row.customerName ?? null, customerPhone: row.customerPhone ?? null, anonCustomerId: row.anonCustomerId ?? null, tableNo: row.tableNo ?? null, qrSlug: row.qrSlug ?? null, createdAt: date(row.createdAt)?.toISOString() ?? new Date(0).toISOString(), stampsAwarded: Number(row.stampsAwarded ?? 1), status: row.status as PendingStampRequest["status"], customer: isAnon ? null : customer ? { currentStamps: Number(customer.currentStamps ?? 0), lifetimeStamps: Number(customer.lifetimeStamps ?? 0) } : null, anonCustomer: isAnon && customer ? { currentStamps: Number(customer.currentStamps ?? 0), lifetimeStamps: Number(customer.lifetimeStamps ?? 0) } : null } satisfies PendingStampRequest;
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return { pending: mapped.filter((r) => r.status === "PENDING").slice(0, 50), recent: mapped.filter((r) => r.status !== "PENDING" && Date.parse(r.createdAt) >= cutoff).slice(0, 15) };
  }

  async function approveStampRequest(requestId: string) {
    if (!user || !program) throw new Error("The loyalty program is still loading.");
    const { db } = getFirebaseServices(); const requestRef = doc(db, "stampRequests", requestId);
    const result = await runTransaction(db, async (tx) => {
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists() || requestSnap.data().ownerUid !== user.uid) throw new Error("Stamp request not found.");
      const request = requestSnap.data();
      if (request.status === "APPROVED") return { message: "This stamp request was already approved.", currentStamps: undefined, isAnon: Boolean(request.anonCustomerId) };
      if (request.status !== "PENDING") throw new Error("This stamp request has already been reviewed.");
      const programRef = doc(db, "loyaltyPrograms", String(request.programId));
      const customerCollection = request.anonCustomerId ? "anonymousCustomers" : "loyaltyCustomers";
      const customerId = String(request.anonCustomerId ?? request.customerId ?? "");
      if (!customerId) throw new Error("Customer record is missing.");
      const customerRef = doc(db, customerCollection, customerId);
      const [programSnap, customerSnap] = await Promise.all([tx.get(programRef), tx.get(customerRef)]);
      if (!programSnap.exists() || programSnap.data().ownerUid !== user.uid || !programSnap.data().isActive) throw new Error("Loyalty program is paused or access could not be verified.");
      if (!customerSnap.exists() || customerSnap.data().ownerUid !== user.uid) throw new Error("Customer record is missing.");
      const p = programSnap.data(); const customer = customerSnap.data(); const now = new Date();
      const isAnon = Boolean(request.anonCustomerId); const current = Number(customer.currentStamps ?? 0); const lifetime = Number(customer.lifetimeStamps ?? 0); const added = Math.max(1, Number(request.stampsAwarded ?? 1));
      const lastVisit = date(customer.lastVisitAt);
      if (lastVisit && now.getTime() - lastVisit.getTime() < 24 * 60 * 60 * 1000) {
        tx.update(requestRef, { status: "APPROVED", reviewedAt: serverTimestamp(), reviewedByUid: user.uid, staffNote: "Already stamped within the last 24 hours" });
        return { message: "Already stamped within the last 24 hours; request marked as reviewed.", currentStamps: current, isAnon };
      }
      const completedCycle = current >= Number(p.stampsRequired ?? 10); const finalStamps = (completedCycle ? 0 : current) + added; const targetReached = finalStamps >= Number(p.stampsRequired ?? 10);
      const nextStamps = targetReached ? Number(p.stampsRequired ?? 10) : finalStamps;
      const note = `Approved by ${user.displayName || "restaurant staff"}`;
      const transactionRef = doc(collection(db, isAnon ? "anonymousStampTransactions" : "loyaltyTransactions"));
      if (isAnon) tx.set(transactionRef, { id: transactionRef.id, ownerUid: user.uid, guestUid: customer.guestUid ?? null, customerId, amount: added, type: "ISSUE", staffNote: note, createdAt: serverTimestamp() });
      else tx.set(transactionRef, { id: transactionRef.id, ownerUid: user.uid, programId: p.id, customerId, stampsCount: added, billAmount: Number(p.minBillAmount ?? 0), billReference: request.tableNo || `VISIT-${requestId}`, staffNote: note, createdAt: serverTimestamp() });
      tx.update(customerRef, { currentStamps: nextStamps, lifetimeStamps: lifetime + added, lastVisitAt: serverTimestamp(), ...(completedCycle ? { cycleNumber: Number(customer.cycleNumber ?? 1) + 1, stampCycleStartedAt: serverTimestamp() } : !customer.stampCycleStartedAt ? { stampCycleStartedAt: serverTimestamp() } : {}) });
      if (targetReached) {
        const rewardRef = doc(collection(db, isAnon ? "anonymousRewards" : "loyaltyRewards")); const expiry = new Date(now.getTime() + Number(p.rewardExpiryDays ?? 30) * 86_400_000);
        const code = `OFFER-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        tx.set(rewardRef, { id: rewardRef.id, ownerUid: user.uid, ...(isAnon ? { guestUid: customer.guestUid ?? null } : {}), programId: String(request.programId), customerId, code, rewardTitle: String(p.rewardTitle ?? "Reward"), discountAmount: Number(p.rewardDiscount ?? 0), status: "UNREDEEMED", expiresAt: expiry, createdAt: serverTimestamp(), ...(isAnon ? { idempotencyKey: `approval_${requestId}` } : {}) });
      }
      tx.update(requestRef, { status: "APPROVED", reviewedAt: serverTimestamp(), reviewedByUid: user.uid, staffNote: note });
      return { message: targetReached ? `Stamp approved. ${String(p.rewardTitle ?? "A reward")} unlocked!` : `Stamp approved. Customer now has ${nextStamps}/${Number(p.stampsRequired ?? 10)} stamps.`, currentStamps: nextStamps, isAnon };
    });
    return result;
  }

  async function rejectStampRequest(requestId: string) {
    if (!user) throw new Error("Sign in again and retry.");
    const { db } = getFirebaseServices(); const requestRef = doc(db, "stampRequests", requestId);
    await runTransaction(db, async (tx) => { const snap = await tx.get(requestRef); if (!snap.exists() || snap.data().ownerUid !== user.uid) throw new Error("Stamp request not found."); if (snap.data().status !== "PENDING") throw new Error("This stamp request has already been reviewed."); tx.update(requestRef, { status: "REJECTED", reviewedAt: serverTimestamp(), reviewedByUid: user.uid, staffNote: "Declined by restaurant staff" }); });
  }

  async function issueStamp(input: { customerRef: string; billReference: string; staffNote: string }) {
    if (!user || !program) throw new Error("The loyalty program is still loading.");
    if (!program.isActive) throw new Error("Loyalty program is currently paused.");
    const { db } = getFirebaseServices(); const rawRef = input.customerRef.trim(); const isAnon = rawRef.startsWith("anon_");
    let customerId = rawRef; let customerRef: ReturnType<typeof doc>;
    if (isAnon) {
      customerRef = doc(db, "anonymousCustomers", customerId);
    } else {
      const phone = rawRef.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
      if (phone.length !== 10) throw new Error("Enter a valid 10-digit mobile number.");
      const found = await getDocs(query(collection(db, "loyaltyCustomers"), where("ownerUid", "==", user.uid), where("programId", "==", program.id), where("phone", "==", phone)));
      if (found.empty) { customerRef = doc(collection(db, "loyaltyCustomers")); customerId = customerRef.id; }
      else { customerRef = doc(db, "loyaltyCustomers", found.docs[0].id); customerId = found.docs[0].id; }
    }
    const transactionId = doc(collection(db, isAnon ? "anonymousStampTransactions" : "loyaltyTransactions"));
    const rewardId = doc(collection(db, isAnon ? "anonymousRewards" : "loyaltyRewards"));
    const programRef = doc(db, "loyaltyPrograms", program.id);
    const result = await runTransaction(db, async (tx) => {
      const [programSnap, customerSnap] = await Promise.all([tx.get(programRef), tx.get(customerRef)]);
      if (!programSnap.exists() || programSnap.data().ownerUid !== user.uid || !programSnap.data().isActive) throw new Error("Loyalty program is paused or unavailable.");
      if (customerSnap.exists() && customerSnap.data().ownerUid !== user.uid) throw new Error("Customer is not linked to this restaurant.");
      const p = programSnap.data(); const prior = customerSnap.exists() ? customerSnap.data() : {};
      const now = new Date(); const cycleDays = Number(p.rewardExpiryDays || 30); const cycleStart = date(prior.stampCycleStartedAt);
      const expired = Boolean(cycleStart && now.getTime() > cycleStart.getTime() + cycleDays * 86_400_000); const completed = Number(prior.currentStamps ?? 0) >= Number(p.stampsRequired ?? 10);
      const startFresh = expired || completed; const nextStamps = (startFresh ? 0 : Number(prior.currentStamps ?? 0)) + 1; const reached = nextStamps >= Number(p.stampsRequired ?? 10);
      const stampValue = reached ? Number(p.stampsRequired ?? 10) : nextStamps; const nextCycle = Number(prior.cycleNumber ?? 1) + (startFresh ? 1 : 0);
      if (isAnon && !customerSnap.exists()) throw new Error("Anonymous customer record was not found.");
      const customerData = isAnon
        ? { currentStamps: stampValue, lifetimeStamps: Number(prior.lifetimeStamps ?? 0) + 1, lastVisitAt: serverTimestamp() }
        : { id: customerId, ownerUid: user.uid, programId: program.id, phone: rawRef.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""), name: customerSnap.exists() ? prior.name ?? null : null, currentStamps: stampValue, lifetimeStamps: Number(prior.lifetimeStamps ?? 0) + 1, lastVisitAt: serverTimestamp(), cycleNumber: nextCycle, stampCycleStartedAt: startFresh || !cycleStart ? serverTimestamp() : prior.stampCycleStartedAt, createdAt: prior.createdAt ?? serverTimestamp() };
      if (customerSnap.exists()) tx.update(customerRef, customerData); else tx.set(customerRef, customerData);
      if (isAnon) tx.set(transactionId, { id: transactionId.id, ownerUid: user.uid, guestUid: prior.guestUid ?? null, customerId, amount: 1, type: "ISSUE", staffNote: input.staffNote || "Staff award", createdAt: serverTimestamp() });
      else tx.set(transactionId, { id: transactionId.id, ownerUid: user.uid, programId: program.id, customerId, stampsCount: 1, billAmount: Number(p.minBillAmount ?? 0), billReference: input.billReference.trim() || `STAFF-${Date.now()}`, staffNote: input.staffNote || "Owner Award", createdAt: serverTimestamp() });
      if (reached) { const expiry = new Date(now.getTime() + Number(p.rewardExpiryDays || 30) * 86_400_000); const code = `OFFER-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`; tx.set(rewardId, { id: rewardId.id, ownerUid: user.uid, ...(isAnon ? { guestUid: prior.guestUid ?? null } : {}), programId: program.id, customerId, code, rewardTitle: String(p.rewardTitle ?? "Reward"), discountAmount: Number(p.rewardDiscount ?? 0), status: "UNREDEEMED", expiresAt: expiry, createdAt: serverTimestamp(), ...(isAnon ? { idempotencyKey: `manual_${transactionId.id}` } : {}) }); }
      return { currentStamps: stampValue, targetReached: reached, rewardTitle: String(p.rewardTitle ?? "Reward") };
    });
    return result.targetReached ? `1 Stamp awarded. ${result.rewardTitle} unlocked!` : `1 Stamp awarded. Customer now has ${result.currentStamps}/${program.stampsRequired} stamps.`;
  }

  async function redeemVoucher(code: string) {
    if (!user) throw new Error("Sign in again and retry.");
    const { db } = getFirebaseServices(); const [phoneRows, anonRows] = await Promise.all([
      getDocs(query(collection(db, "loyaltyRewards"), where("ownerUid", "==", user.uid), where("code", "==", code))),
      getDocs(query(collection(db, "anonymousRewards"), where("ownerUid", "==", user.uid), where("code", "==", code))),
    ]);
    const match = phoneRows.docs[0] ? { ref: doc(db, "loyaltyRewards", phoneRows.docs[0].id), row: phoneRows.docs[0].data() } : anonRows.docs[0] ? { ref: doc(db, "anonymousRewards", anonRows.docs[0].id), row: anonRows.docs[0].data() } : null;
    if (!match) throw new Error("Voucher code not found.");
    await runTransaction(db, async (tx) => { const snap = await tx.get(match.ref); if (!snap.exists() || snap.data().ownerUid !== user.uid) throw new Error("Voucher not found."); if (snap.data().status !== "UNREDEEMED") throw new Error("This voucher has already been redeemed or expired."); const expiry = date(snap.data().expiresAt); if (expiry && expiry.getTime() < Date.now()) throw new Error("This voucher has expired."); tx.update(match.ref, { status: "REDEEMED", redeemedAt: serverTimestamp(), ...(snap.data().redeemedByStaff !== undefined ? { redeemedByStaff: user.uid } : {}) }); });
    return `Voucher ${code} redeemed successfully.`;
  }

  async function issueExtraVoucher(customerRefValue: string) {
    if (!user || !program) throw new Error("The loyalty program is still loading.");
    const { db } = getFirebaseServices(); const raw = customerRefValue.trim(); const isAnon = raw.startsWith("anon_"); let customerId = raw; let customerRef: ReturnType<typeof doc>;
    if (isAnon) customerRef = doc(db, "anonymousCustomers", raw);
    else { const phone = raw.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""); const found = await getDocs(query(collection(db, "loyaltyCustomers"), where("ownerUid", "==", user.uid), where("programId", "==", program.id), where("phone", "==", phone))); if (found.empty) throw new Error("Customer not found. Check the phone number."); customerId = found.docs[0].id; customerRef = doc(db, "loyaltyCustomers", customerId); }
    const rewardRef = doc(collection(db, isAnon ? "anonymousRewards" : "loyaltyRewards")); const code = `OFFER-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`; const expiry = new Date(Date.now() + Number(program.rewardExpiryDays || 30) * 86_400_000);
    await runTransaction(db, async (tx) => { const [customerSnap, programSnap] = await Promise.all([tx.get(customerRef), tx.get(doc(db, "loyaltyPrograms", program.id))]); if (!customerSnap.exists() || customerSnap.data().ownerUid !== user.uid || !programSnap.exists() || programSnap.data().ownerUid !== user.uid) throw new Error("Customer not found for this restaurant."); tx.set(rewardRef, { id: rewardRef.id, ownerUid: user.uid, ...(isAnon ? { guestUid: customerSnap.data().guestUid ?? null } : {}), programId: program.id, customerId, code, rewardTitle: String(programSnap.data().rewardTitle ?? "Reward"), discountAmount: Number(programSnap.data().rewardDiscount ?? 0), status: "UNREDEEMED", expiresAt: expiry, createdAt: serverTimestamp(), ...(isAnon ? { idempotencyKey: `manual_${rewardRef.id}` } : {}) }); });
    return { message: "Extra voucher issued successfully.", code };
  }
  if (loading) return <div className="p-8 text-sm text-[#716B64]">Loading loyalty program…</div>;
  if (error || !program) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || "Loyalty program unavailable."}</div>;
  const empty = { totalCustomers: 0, totalTransactions: 0, unredeemedRewards: 0, redeemedRewards: 0, reviewClicks: 0 };
  return <LoyaltySettingsView initialProgram={program} stats={empty} qrSlug={undefined} firebaseActions={{ loadDashboardData, saveProgram, stampRequests: { load: loadStampRequests, approve: approveStampRequest, reject: rejectStampRequest }, issueStamp, redeemVoucher, issueExtraVoucher }} />;
}
