"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Stars } from "@/components/Stars";
import { addDoc, collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getFirebaseServices } from "@/firebase-spa/src/firebase";
import { getBusinessFeedbackConfig, getBusinessType, type BusinessType } from "@/lib/business-type";
import { createReviewDraft } from "@/lib/review-copy";

export type CustomerJourneyProps = {
  slug: string;
  restaurant: {
    id: string;
    name: string;
    businessType?: BusinessType | string;
    city?: string | null;
    logoUrl?: string | null;
    brandColor?: string;
    googleReviewUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    shareCaption?: string | null;
  };
  initialProgram: {
    id: string;
    title: string;
    discountType?: string;
    stampsRequired: number;
    minBillAmount: number;
    rewardTitle: string;
    rewardDiscount: number;
    rewardExpiryDays: number;
    isActive: boolean;
    requireOwnerVerification?: boolean;
  };
  initialPhone?: string | null;
  initialName?: string | null;
  initialView?: "welcome" | "card" | "review";
  firebaseContext?: { qrId: string; ownerUid: string; restaurantId: string };
};

type RewardItem = {
  id: string;
  code: string;
  rewardTitle: string;
  discountAmount: number;
  status: "UNREDEEMED" | "REDEEMED" | "EXPIRED";
  expiresAt: string;
  redeemedAt: string | null;
};

type TransactionItem = {
  id: string;
  stampsCount: number;
  billAmount: number | null;
  billReference: string | null;
  createdAt: string;
  staffNote?: string | null;
};

type CustomerData = {
  id: string;
  name: string | null;
  phone: string;
  currentStamps: number;
  lifetimeStamps: number;
  cycleNumber: number;
  stampCycleStartedAt: string | null;
  cycleEndsAt: string | null;
  lastVisitAt: string | null;
  rewards: RewardItem[];
  transactions: TransactionItem[];
};

function dateString(value: any): string | null {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

export function CustomerJourneyView({
  slug,
  restaurant,
  initialProgram,
  initialPhone,
  initialName,
  initialView = "welcome",
  firebaseContext,
}: CustomerJourneyProps) {
  const businessType = getBusinessType(restaurant.businessType);
  const businessFeedback = getBusinessFeedbackConfig(businessType);
  const isCafeFeedback = businessFeedback.layout === "cafe";

  function updateReviewRating(index: number, rating: number) {
    setReviewRatings((current) => {
      const next: [number, number, number] = [...current];
      next[index] = rating;
      return next;
    });
    setAiGenerated(false);
    setAiDraft("");
    setReviewGenerationError("");
  }

  // Navigation View State
  const [currentView, setCurrentView] = useState<
    "welcome" | "register" | "request_pending" | "card" | "stamp_added" | "review" | "reward_details" | "reward_redeemed"
  >(initialView);

  // Customer & Card Data
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [program, setProgram] = useState(initialProgram);
  const [loadingCard, setLoadingCard] = useState(false);
  const [refreshingCard, setRefreshingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [collectingStamp, setCollectingStamp] = useState(false);
  const [stampFeedbackMessage, setStampFeedbackMessage] = useState<string | null>(null);

  // Stamp Request to Owner State
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingTableNo, setPendingTableNo] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Registration Form State (Step 3: Enter Details)
  const [fullName, setFullName] = useState(initialName || "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || "");
  const [agreedUpdates, setAgreedUpdates] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [newCustomerReviewRequired, setNewCustomerReviewRequired] = useState(false);
  const registerLockRef = useRef(false);
  const collectLockRef = useRef(false);

  // Review & AI Assist State (Step 7: Share Your Experience)
  const [reviewRatings, setReviewRatings] = useState<[number, number, number]>([0, 0, 0]);
  const [aiDraft, setAiDraft] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [reviewGenerationError, setReviewGenerationError] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [googlePopupBlocked, setGooglePopupBlocked] = useState(false);
  const [reviewVariantIndex, setReviewVariantIndex] = useState(0);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseContext) return;
    const { db, auth } = getFirebaseServices();
    void addDoc(collection(db, "scans"), {
      qrId: firebaseContext.qrId,
      ownerUid: firebaseContext.ownerUid,
      guestUid: auth.currentUser?.uid ?? null,
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: serverTimestamp(),
    }).catch((error) => console.error("Could not record QR scan", error));
  }, [firebaseContext?.qrId, firebaseContext?.ownerUid]);

  // Reward Voucher QR Modal / Screen State
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [rewardQrDataUrl, setRewardQrDataUrl] = useState<string | null>(null);

  // Theme Accent: Muted Gold #B58A4B
  const accentGold = "#B58A4B";

  const brandColor = restaurant.brandColor || "#B58A4B";

  // Check on mount for remembered phone — pre-fill but always show the register prompt
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const savedPhone =
        initialPhone ||
        localStorage.getItem(`loyalty_phone_${slug}`) ||
        localStorage.getItem("loyalty_phone");

      const savedName =
        initialName ||
        localStorage.getItem(`loyalty_name_${slug}`);

      if (savedName) setFullName(savedName);
      if (savedPhone) setPhoneNumber(savedPhone);

      // Keep deep links on their requested view; the normal welcome flow still
      // asks the customer to confirm their phone number on each scan.
      setCurrentView(initialView === "welcome" ? "register" : initialView);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [slug, initialPhone, initialName, initialView]);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
      setCurrentView(initialView);
    }
    isMounted.current = true;
  }, [initialView]);

  // Live polling: automatically refresh card in background
  useEffect(() => {
    if (currentView !== "card") return;
    const phoneToPoll = customer?.phone || phoneNumber;
    if (!phoneToPoll) return;

    const interval = setInterval(() => {
      fetchLoyaltyCard(phoneToPoll, true);
    }, 4000);

    return () => clearInterval(interval);
  }, [currentView, customer?.phone, phoneNumber]);

  // Auto-load card data when entering card view without customer data (safety net)
  const cardLoadRef = useRef(false);
  useEffect(() => {
    if (currentView !== "card") {
      cardLoadRef.current = false;
      return;
    }
    if (customer || cardLoadRef.current) return;
    const phoneToUse = phoneNumber;
    if (!phoneToUse) return;
    cardLoadRef.current = true;
    fetchLoyaltyCard(phoneToUse);
  }, [currentView, phoneNumber]);

  async function fetchLoyaltyCard(phoneToFetch: string, silent = false) {
    if (!silent) {
      setLoadingCard(true);
      setCardError(null);
    }
    try {
      if (firebaseContext) {
        const { db, auth } = getFirebaseServices();
        const guest = auth.currentUser;
        if (!guest) throw new Error("Guest session is still initializing.");
        const customerId = `anon_${guest.uid}_${firebaseContext.restaurantId}`;
        const customerSnap = await getDoc(doc(db, "anonymousCustomers", customerId));
        if (!customerSnap.exists()) throw new Error("No loyalty card is registered for this visit yet.");
        const customerRow = customerSnap.data();
        const [rewardSnap, transactionSnap] = await Promise.all([
          getDocs(query(collection(db, "anonymousRewards"), where("guestUid", "==", guest.uid), where("customerId", "==", customerId))),
          getDocs(query(collection(db, "anonymousStampTransactions"), where("guestUid", "==", guest.uid), where("customerId", "==", customerId))),
        ]);
        const firebaseCustomer: CustomerData = {
          id: customerId, name: customerRow.name ?? null, phone: customerRow.phone ?? phoneToFetch,
          currentStamps: Number(customerRow.currentStamps ?? 0), lifetimeStamps: Number(customerRow.lifetimeStamps ?? 0),
          cycleNumber: Number(customerRow.cycleNumber ?? 1), stampCycleStartedAt: dateString(customerRow.stampCycleStartedAt),
          cycleEndsAt: dateString(customerRow.cycleEndsAt), lastVisitAt: dateString(customerRow.lastVisitAt),
          rewards: rewardSnap.docs.map((d) => ({ id: d.id, code: String(d.data().code ?? ""), rewardTitle: String(d.data().rewardTitle ?? "Reward"), discountAmount: Number(d.data().discountAmount ?? 0), status: d.data().status, expiresAt: dateString(d.data().expiresAt) ?? new Date(0).toISOString(), redeemedAt: dateString(d.data().redeemedAt) })),
          transactions: transactionSnap.docs.map((d) => ({ id: d.id, stampsCount: Number(d.data().amount ?? 1), billAmount: null, billReference: d.data().staffNote ?? null, createdAt: dateString(d.data().createdAt) ?? new Date(0).toISOString(), staffNote: d.data().staffNote ?? null })).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        };
        setCustomer(firebaseCustomer);
        localStorage.setItem(`loyalty_phone_${slug}`, firebaseCustomer.phone);
        if (firebaseCustomer.name) setFullName(firebaseCustomer.name);
        if (!silent) setCurrentView("card");
        return;
      }
      const res = await fetch(
        `/api/loyalty/card?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(phoneToFetch)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load loyalty card");

      if (data.customer) {
        setCustomer({
          ...data.customer,
          cycleNumber: data.customer.cycleNumber ?? 1,
          stampCycleStartedAt: data.customer.stampCycleStartedAt ?? null,
          cycleEndsAt: data.customer.cycleEndsAt ?? null,
          lastVisitAt: data.customer.lastVisitAt ?? null,
        });
        if (data.program) setProgram(data.program);
        localStorage.setItem(`loyalty_phone_${slug}`, phoneToFetch);
        if (data.customer.name) {
          setFullName(data.customer.name);
          localStorage.setItem(`loyalty_name_${slug}`, data.customer.name);
        }
        // If we loaded the card, navigate to card view (only on first non-silent load)
        if (!silent) {
          setCurrentView("card");
        }
      }
    } catch (err: any) {
      if (!silent) {
        setCardError(err.message || "Failed to load loyalty card");
      }
    } finally {
      if (!silent) {
        setLoadingCard(false);
      }
    }
  }

  async function handleRefreshCard() {
    const phoneToFetch = customer?.phone || phoneNumber;
    if (!phoneToFetch || refreshingCard) return;
    setRefreshingCard(true);
    try {
      await fetchLoyaltyCard(phoneToFetch);
    } finally {
      setRefreshingCard(false);
    }
  }

  // Poll status when a stamp request is pending with owner
  useEffect(() => {
    if (!pendingRequestId && currentView !== "request_pending") return;

    let isCancelled = false;

    async function checkStatus() {
      if (firebaseContext) {
        if (!pendingRequestId) return;
        try {
          const { db } = getFirebaseServices();
          const snap = await getDoc(doc(db, "stampRequests", pendingRequestId));
          if (isCancelled || !snap.exists()) return;
          const request = snap.data();
          if (request.guestUid !== getFirebaseServices().auth.currentUser?.uid) return;
          if (request.status === "APPROVED") {
            setPendingRequestId(null);
            await fetchLoyaltyCard(customer?.phone || phoneNumber, true);
            setStampFeedbackMessage(request.staffNote || "Your visit has been recorded. You're one step closer to your reward!");
            setCurrentView("stamp_added");
          } else if (request.status === "REJECTED") {
            setPendingRequestId(null);
            setRequestError(request.staffNote || "Your stamp request was declined by the restaurant staff.");
          }
        } catch (err) { console.error("Firebase stamp status check failed", err); }
        return;
      }
      const phoneToUse = customer?.phone || phoneNumber;
      const url = pendingRequestId
        ? `/api/loyalty/request-stamp/status?requestId=${encodeURIComponent(pendingRequestId)}`
        : `/api/loyalty/request-stamp/status?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(phoneToUse)}`;

      try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (isCancelled) return;

        if (data.status === "APPROVED") {
          setPendingRequestId(null);
          if (data.customer) {
            setCustomer({
              ...data.customer,
              cycleNumber: data.customer.cycleNumber ?? 1,
              lastVisitAt: data.customer.lastVisitAt ?? null,
            });
          }
          if (data.program) setProgram(data.program);
          setStampFeedbackMessage(data.message || "Your visit has been recorded. You're one step closer to your reward!");
          setCurrentView("stamp_added");
        } else if (data.status === "REJECTED") {
          setPendingRequestId(null);
          setRequestError(data.message || "Your stamp request was declined by the restaurant staff.");
        } else if (data.status === "PENDING") {
          if (!pendingRequestId && data.requestId) {
            setPendingRequestId(data.requestId);
          }
          if (data.tableNo && !pendingTableNo) {
            setPendingTableNo(data.tableNo);
          }
        }
      } catch (err) {
        console.error("Status check failed:", err);
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 2500);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [pendingRequestId, currentView, customer?.phone, phoneNumber, slug, pendingTableNo]);

  // Collect Stamp Handler (Customer sends request to owner)
  async function handleCollectStampClick(phoneOverride?: string) {
    if (collectLockRef.current) return;
    if (newCustomerReviewRequired && !reviewSubmitted) {
      setCurrentView("review");
      return;
    }
    const phoneToUse = phoneOverride || customer?.phone || phoneNumber;
    if (!phoneToUse) {
      setCurrentView("register");
      return;
    }

    if (!phoneOverride && hasCollectedStampToday) {
      setStampFeedbackMessage("You already received a stamp for today's visit!");
      setCurrentView("card");
      return;
    }

    collectLockRef.current = true;
    setCollectingStamp(true);
    setCardError(null);
    setRequestError(null);
    try {
      if (firebaseContext) {
        const { db, auth } = getFirebaseServices();
        const guest = auth.currentUser;
        if (!guest) throw new Error("Guest session is still initializing. Please try again.");
        if (!program.isActive || !program.id) throw new Error("This restaurant's loyalty program is not available right now.");
        const customerId = `anon_${guest.uid}_${firebaseContext.restaurantId}`;
        const customerRef = doc(db, "anonymousCustomers", customerId);
        const requestId = `guest_${guest.uid}_${firebaseContext.qrId}_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
        const requestRef = doc(db, "stampRequests", requestId);
        const outcome = await runTransaction(db, async (tx) => {
          const [customerSnap, requestSnap] = await Promise.all([tx.get(customerRef), tx.get(requestRef)]);
          if (!customerSnap.exists()) throw new Error("Please register your name and phone number first.");
          if (requestSnap.exists() && requestSnap.data().status === "PENDING") return { pending: true };
          const lastVisit = customerSnap.data().lastVisitAt?.toDate?.() as Date | undefined;
          if (lastVisit && Date.now() - lastVisit.getTime() < 24 * 60 * 60 * 1000) return { already: true };
          tx.set(requestRef, {
            id: requestRef.id, ownerUid: firebaseContext.ownerUid, guestUid: guest.uid,
            restaurantId: firebaseContext.restaurantId, qrId: firebaseContext.qrId, programId: program.id,
            anonCustomerId: customerId, customerName: fullName.trim() || customer?.name || "Customer",
            customerPhone: phoneToUse, tableNo: null, qrSlug: slug, status: "PENDING", stampsAwarded: 1,
            createdAt: serverTimestamp(), reviewedAt: null, reviewedByUid: null, staffNote: null,
          });
          return { pending: true };
        });
        if (outcome.already) {
          setStampFeedbackMessage("You already received a stamp for today's visit!");
          await fetchLoyaltyCard(phoneToUse, true);
          setCurrentView("card");
        } else {
          setPendingRequestId(requestId);
          setPendingTableNo(null);
          setCurrentView("request_pending");
        }
        return;
      }
      const res = await fetch("/api/loyalty/request-stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          phone: phoneToUse,
          name: fullName || customer?.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit stamp request");

      if (data.alreadyCollected) {
        setStampFeedbackMessage(data.message || "You already received a stamp for today's visit!");
        await fetchLoyaltyCard(phoneToUse);
        setCurrentView("card");
        return;
      }

      setPendingRequestId(data.requestId);
      setPendingTableNo(data.tableNo || null);
      setCurrentView("request_pending");
    } catch (err: any) {
      setCardError(err.message || "Failed to submit stamp request");
    } finally {
      setCollectingStamp(false);
      collectLockRef.current = false;
    }
  }

  // Step 3 Handler: Register with Name & Phone
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (registerLockRef.current) return;
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const finalPhone = cleanPhone.length > 10 && cleanPhone.startsWith("91") ? cleanPhone.slice(2) : cleanPhone;

    if (finalPhone.length < 10) {
      setRegisterError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!fullName.trim()) {
      setRegisterError("Please enter your name");
      return;
    }

    registerLockRef.current = true;
    setRegistering(true);
    setRegisterError("");
    try {
      localStorage.setItem(`loyalty_phone_${slug}`, finalPhone);
      localStorage.setItem(`loyalty_name_${slug}`, fullName.trim());

      if (firebaseContext) {
        const { auth, db } = getFirebaseServices();
        const guest = auth.currentUser;
        if (!guest) throw new Error("Guest session is still initializing. Please try again.");
        const customerId = `anon_${guest.uid}_${firebaseContext.restaurantId}`;
        const customerRef = doc(db, "anonymousCustomers", customerId);
        await runTransaction(db, async (tx) => {
          const existing = await tx.get(customerRef);
          const existingData = existing.data();
          if (existing.exists() && (existingData?.guestUid !== guest.uid || existingData?.ownerUid !== firebaseContext.ownerUid)) throw new Error("This guest profile is linked to another visit.");
          tx.set(customerRef, {
            id: customerId, ownerUid: firebaseContext.ownerUid, guestUid: guest.uid,
            restaurantId: firebaseContext.restaurantId, programId: program.id,
            name: fullName.trim(), phone: finalPhone,
            currentStamps: Number(existingData?.currentStamps ?? 0), lifetimeStamps: Number(existingData?.lifetimeStamps ?? 0),
            cycleNumber: Number(existingData?.cycleNumber ?? 1), stampCycleStartedAt: existingData?.stampCycleStartedAt ?? null,
            lastVisitAt: existingData?.lastVisitAt ?? null, createdAt: existingData?.createdAt ?? serverTimestamp(),
          });
        });
        setPhoneNumber(finalPhone);
        await fetchLoyaltyCard(finalPhone, true);
        setNewCustomerReviewRequired(false);
        setReviewSubmitted(false);
        setReviewRatings([0, 0, 0]);
        setAiGenerated(false);
        setAiDraft("");
        setCurrentView("review");
        return;
      }

      const lookup = await fetch(`/api/loyalty/customer/exists?slug=${encodeURIComponent(slug)}&phone=${encodeURIComponent(finalPhone)}`, { cache: "no-store" });
      const lookupData = await lookup.json().catch(() => ({}));
      if (!lookup.ok) throw new Error(lookupData.error || "Could not check this phone number. Please try again.");
      if (lookupData.exists) {
        setNewCustomerReviewRequired(false);
        await handleCollectStampClick(finalPhone);
        return;
      }

      setPhoneNumber(finalPhone);
      setNewCustomerReviewRequired(true);
      setReviewSubmitted(false);
      setReviewRatings([0, 0, 0]);
      setAiGenerated(false);
      setAiDraft("");
      setCurrentView("review");
    } catch (err: any) {
      setRegisterError(err.message || "Registration failed. Please try again.");
    } finally {
      setRegistering(false);
      registerLockRef.current = false;
    }
  }

  // Step 7 Handler: AI Review Generator
  async function handleGenerateAiReview() {
    const [primaryRating, secondaryRating, atmosphereRating] = reviewRatings;
    const starRating = Math.round((primaryRating + secondaryRating + atmosphereRating) / 3);
    if (starRating < 1 || starRating > 5) return;
    setGeneratingAi(true);
    setReviewGenerationError("");
    try {
      if (firebaseContext) {
        const { db, auth } = getFirebaseServices();
        const chips = [`${businessFeedback.aspectLabels[2]} rating: ${atmosphereRating}/5`];
        const guestUid = auth.currentUser?.uid;
        if (!guestUid) throw new Error("Guest session is still initializing. Please try again.");
        const text = createReviewDraft({
          businessName: restaurant.name,
          overall: starRating,
          aspects: [
            { label: businessFeedback.aspectLabels[0], score: primaryRating },
            { label: businessFeedback.aspectLabels[1], score: secondaryRating },
            { label: businessFeedback.aspectLabels[2], score: atmosphereRating },
          ],
          variation: reviewVariantIndex,
        });
        if (reviewSessionId) {
          const draftRef = doc(db, "drafts", reviewSessionId);
          const existing = await getDoc(draftRef);
          if (!existing.exists() || existing.data().guestUid !== guestUid) {
            throw new Error("Your review draft could not be verified. Please start again.");
          }
          await updateDoc(draftRef, { text, editedText: null, regenerations: Number(existing.data().regenerations ?? 0) + 1 });
        } else {
          const session = await addDoc(collection(db, "feedbackSessions"), {
            qrId: firebaseContext.qrId,
            ownerUid: firebaseContext.ownerUid,
            guestUid,
            overallRating: starRating,
            foodRating: primaryRating,
            serviceRating: secondaryRating,
            chips,
            freeText: null,
            completedAt: serverTimestamp(),
            googleClickedAt: null,
          });
          await setDoc(doc(db, "drafts", session.id), {
            id: session.id,
            sessionId: session.id,
            ownerUid: firebaseContext.ownerUid,
            guestUid,
            text,
            editedText: null,
            regenerations: 0,
            googleClickedAt: null,
            createdAt: serverTimestamp(),
          });
          setReviewSessionId(session.id);
        }
        setAiDraft(text);
        setAiGenerated(true);
        setReviewVariantIndex((i) => i + 1);
        return;
      }
      const variants = ["short", "casual", "detailed"] as const;
      const variant = variants[reviewVariantIndex % variants.length];
      const res = await fetch("/api/public/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          // The API accepts an omitted sessionId, not null. JSON null caused
          // first-time review generation to fail schema validation (400).
          sessionId: reviewSessionId || undefined,
          overall: starRating,
          food: primaryRating,
          service: secondaryRating,
          environment: atmosphereRating,
          chips: [],
          variant,
          variationId: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          previousDraft: aiGenerated ? aiDraft : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.text) {
        throw new Error(data.error || "Could not generate your review. Please try again.");
      }
      setAiDraft(data.text);
      setAiGenerated(true);
      setReviewSessionId(data.sessionId);
      setReviewVariantIndex((i) => i + 1);
    } catch (error) {
      setReviewGenerationError(
        error instanceof Error ? error.message : "Could not generate your review. Please try again.",
      );
    } finally {
      setGeneratingAi(false);
    }
  }

  // Copy & Post to Google Review
  async function handleCopyAndGoogleReview() {
    // ⚠️ Open Google window SYNCHRONOUSLY (before any await) so browsers allow it.
    // If opened after an async call, most browsers treat it as a popup and block it.
    let googleWin: Window | null = null;
    const googleUrl = restaurant.googleReviewUrl;
    if (googleUrl) {
      googleWin = window.open(googleUrl, "_blank", "noopener,noreferrer");
    }

    try {
      await navigator.clipboard.writeText(aiDraft);
      setCopiedReview(true);
    } catch {
      // Continue if clipboard write fails
    }

    if (firebaseContext && reviewSessionId) {
      const { db } = getFirebaseServices();
      await Promise.all([
        updateDoc(doc(db, "feedbackSessions", reviewSessionId), { googleClickedAt: serverTimestamp() }),
        updateDoc(doc(db, "drafts", reviewSessionId), { googleClickedAt: serverTimestamp(), editedText: aiDraft }),
      ]).catch((error) => console.error("Could not record Google review click", error));
    } else {
      navigator.sendBeacon?.(
        "/api/public/google-click",
        new Blob(
          [JSON.stringify({ sessionId: reviewSessionId, editedText: aiDraft })],
          { type: "application/json" },
        )
      );
    }

    // Fallback: if popup was blocked, navigate in same tab
    if (restaurant.googleReviewUrl && (!googleWin || googleWin.closed)) {
      window.location.href = restaurant.googleReviewUrl;
    }

    setReviewSubmitted(true);
  }

  function recordSocialClick(platform: "instagram" | "facebook") {
    if (!firebaseContext) return;
    const { auth, db } = getFirebaseServices();
    void addDoc(collection(db, "socialClicks"), {
      qrId: firebaseContext.qrId,
      ownerUid: firebaseContext.ownerUid,
      guestUid: auth.currentUser?.uid ?? null,
      platform,
      createdAt: serverTimestamp(),
    }).catch((error) => console.error("Could not record social link click", error));
  }

  // Show Reward Voucher QR Code
  async function handleOpenRewardQr(reward: RewardItem) {
    setSelectedReward(reward);
    try {
      const qr = await QRCode.toDataURL(reward.code, {
        width: 260,
        margin: 2,
        color: { dark: "#24211E", light: "#FFFFFF" },
      });
      setRewardQrDataUrl(qr);
      setCurrentView("reward_details");
    } catch {
      setRewardQrDataUrl(null);
      setCurrentView("reward_details");
    }
  }

  const stampsRequired = program?.stampsRequired || 5;
  const currentStamps = customer?.currentStamps || 0;
  const stampsRemaining = Math.max(0, stampsRequired - currentStamps);
  const activeRewards = customer?.rewards?.filter((r) => r.status === "UNREDEEMED") || [];

  // Check if customer already collected a stamp today (1 stamp per visit/day)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hasCollectedStampToday = Boolean(
    customer?.transactions?.some((tx) => {
      if (!tx.stampsCount || tx.stampsCount <= 0) return false;
      const txDate = new Date(tx.createdAt);
      return txDate >= twentyFourHoursAgo;
    })
  );

  const isPercent = program?.discountType === "PERCENT";
  const discountDisplay = isPercent
    ? `${program.rewardDiscount}% OFF`
    : program.discountType === "FREE_ITEM"
      ? "Free Item"
      : `₹${(program.rewardDiscount / 100).toFixed(0)} OFF`;

  return (
    <div
      className="min-h-screen font-sans text-[#24211E] antialiased"
      style={{ backgroundColor: businessFeedback.pageColor }}
    >
      {/* ─────────────────────────────────────────────────────────────
          STEP 2: WELCOME PAGE (Branded Landing Page with Two Clear Options)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "welcome" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-between px-5 py-7">
          {/* Top Brand Header */}
          <div className="text-center pt-1">
            <div className="inline-flex items-center justify-center">
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="h-12 w-12 rounded-full border object-cover shadow-2xs"
                  style={{ borderColor: businessFeedback.borderColor }}
                />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border bg-white font-serif text-xl font-bold shadow-2xs"
                  style={{ borderColor: businessFeedback.borderColor, color: businessFeedback.accentColor }}
                >
                  {restaurant.name.trim().charAt(0).toUpperCase() || "R"}
                </div>
              )}
            </div>
            <h2 className="mt-2 font-serif text-lg font-bold text-[#24211E] tracking-tight">
              {restaurant.name}
            </h2>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#716B64]">
              {businessFeedback.displayLabel}{restaurant.city ? ` • ${restaurant.city}` : ""}
            </p>
          </div>

          {/* Hero Welcome Card */}
          <div className="my-auto py-4 text-center">
            {businessFeedback.layout === "restaurant" ? (
              <div className="mx-auto mb-6 flex h-48 w-full max-w-[300px] items-center justify-center rounded-3xl border bg-[#F1E8D9] p-5 shadow-subtle" style={{ borderColor: businessFeedback.borderColor }}>
                <div className="w-full rounded-2xl border bg-white p-4 text-left shadow-sm" style={{ borderColor: businessFeedback.borderColor }}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#716B64]">Visit card</p>
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: businessFeedback.softColor, color: businessFeedback.accentColor }}>{program.rewardTitle || "Rewards"}</span>
                  </div>
                  <div className="my-5 flex items-center justify-between gap-2" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={index} className="flex h-9 w-9 items-center justify-center rounded-full border text-sm" style={index === 0 ? { borderColor: businessFeedback.accentColor, backgroundColor: businessFeedback.accentColor, color: "#FFFFFF" } : { borderStyle: "dashed", borderColor: businessFeedback.borderColor, backgroundColor: businessFeedback.softColor, color: "#B8B1A8" }}>
                        {index === 0 ? "✓" : "·"}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-[#24211E]">Every visit brings you closer to a reward</p>
                </div>
              </div>
            ) : businessFeedback.layout === "general-store" ? (
              <div
                className="mx-auto mb-6 flex h-48 w-full max-w-[300px] flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-subtle"
                style={{ borderColor: businessFeedback.borderColor, background: `linear-gradient(145deg, #FFFFFF 0%, ${businessFeedback.softColor} 100%)` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: businessFeedback.accentColor }}>Your local store</p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#24211E]">A little of everything</p>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-2xl shadow-sm" aria-hidden="true">🛍️</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["🥬", "Fresh"],
                    ["🥫", "Pantry"],
                    ["🧴", "Daily care"],
                  ].map(([icon, label]) => (
                    <div key={label} className="rounded-xl border bg-white/80 px-2 py-2" style={{ borderColor: businessFeedback.borderColor }}>
                      <span className="block text-xl" aria-hidden="true">{icon}</span>
                      <span className="mt-1 block text-[9px] font-semibold text-[#51484B]">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full px-3 py-2 text-[10px] font-bold" style={{ backgroundColor: businessFeedback.accentColor, color: "#FFFFFF" }}>{program.rewardTitle || "Rewards"}</span>
                  <span className="text-[10px] font-semibold" style={{ color: businessFeedback.accentColor }}>Choose · Shop · Enjoy</span>
                </div>
              </div>
            ) : (
              <div
                className={`mx-auto mb-6 flex h-48 w-full max-w-[300px] flex-col justify-between rounded-[2rem] border p-5 text-left shadow-subtle ${businessFeedback.layout === "salon" ? "rotate-[-1deg]" : ""}`}
                style={{ borderColor: businessFeedback.borderColor, background: `linear-gradient(145deg, #FFFFFF 0%, ${businessFeedback.softColor} 100%)` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: businessFeedback.accentColor }}>{businessFeedback.heroEyebrow}</p>
                    <p className="mt-2 max-w-[175px] font-serif text-xl font-bold leading-tight text-[#24211E]">{businessFeedback.heroMessage}</p>
                  </div>
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-sm" aria-hidden="true">{businessFeedback.heroIcon}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {businessFeedback.layout === "salon" ? (
                    ["Service", "Results", "Relax"].map((step, index) => (
                      <div key={step} className="flex-1 rounded-xl bg-white/80 px-2 py-2 text-center shadow-sm">
                        <span className="block text-[9px] font-bold" style={{ color: businessFeedback.accentColor }}>0{index + 1}</span>
                        <span className="text-[10px] font-semibold text-[#51484B]">{step}</span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-full bg-white/80 px-3 py-2 text-[10px] font-semibold text-[#3F5E4A] shadow-sm">Sip <span aria-hidden="true">·</span> Stay <span aria-hidden="true">·</span> Share</p>
                  )}
                  <span className="rounded-full px-3 py-2 text-[10px] font-bold" style={{ backgroundColor: businessFeedback.accentColor, color: "#FFFFFF" }}>{program.rewardTitle || "Rewards"}</span>
                </div>
              </div>
            )}

            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-[#24211E] leading-tight">
              {businessFeedback.welcomeHeadline[0]}<br />{businessFeedback.welcomeHeadline[1]}
            </h1>
            <p className="mx-auto mt-2.5 max-w-xs text-xs text-[#716B64] leading-relaxed">
              {businessFeedback.welcomeSupportingText}
            </p>

            {/* Two Clear Options: Collect My Stamp & Share Your Experience */}
            <div className="mt-7 space-y-3">
              <button
                onClick={() => handleCollectStampClick()}
                disabled={collectingStamp}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-xs transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: businessFeedback.accentColor }}
                onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.accentHoverColor; }}
                onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.accentColor; }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-sm">✓</span>
                <span>{collectingStamp ? "Collecting Stamp..." : "Collect My Stamp"}</span>
              </button>

              <button
                onClick={() => setCurrentView("review")}
                className="w-full rounded-2xl border bg-white py-3.5 text-sm font-bold text-[#24211E] shadow-2xs transition active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ borderColor: businessFeedback.borderColor }}
                onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.softColor; }}
                onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "#FFFFFF"; }}
              >
                <span>⭐</span>
                <span>Share Your Experience</span>
              </button>
            </div>
          </div>

          {/* Three Value Badges at Bottom */}
          <div className="flex items-center justify-center gap-6 border-t pt-5 text-center text-xs font-medium text-[#716B64]" style={{ borderColor: businessFeedback.borderColor }}>
            <div className="flex items-center gap-1.5">
              <span>★</span>
              <span>{businessFeedback.welcomeBadges[0]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>🤎</span>
              <span>{businessFeedback.welcomeBadges[1]}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>✨</span>
              <span>{businessFeedback.welcomeBadges[2]}</span>
            </div>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 3: ENTER DETAILS ("Join Our Rewards" — matching Phone 3)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "register" && (
        <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-6">
          <div>
            <button
              onClick={() => setCurrentView("welcome")}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#716B64] hover:text-[#24211E] transition"
            >
              <span>←</span> Back
            </button>

            <div className="mt-4 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6EFE3] text-xl text-[#B58A4B] border border-[#E8D8BA]">
                🌿
              </div>
              <h1 className="mt-3 font-serif text-2xl font-bold text-[#24211E]">
                Join Our Rewards
              </h1>
              <p className="mt-1 text-xs text-[#716B64]">
                A few details to get started
              </p>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleRegister} className="mt-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-[#E8DFD1] bg-white px-4 py-3 text-sm font-medium text-[#24211E] outline-none focus:border-[#B58A4B] focus:ring-1 focus:ring-[#B58A4B] shadow-2xs transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#716B64] mb-1.5">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-[#E8DFD1] bg-white shadow-2xs focus-within:border-[#B58A4B] focus-within:ring-1 focus-within:ring-[#B58A4B] transition overflow-hidden">
                  <span className="flex items-center pl-4 pr-2 text-sm font-semibold text-[#716B64]">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Enter your phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-transparent py-3 pr-4 text-sm font-medium text-[#24211E] outline-none"
                    required
                  />
                </div>
              </div>

              {/* Opt-in updates checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="optin"
                  checked={agreedUpdates}
                  onChange={(e) => setAgreedUpdates(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#E8DFD1] text-[#B58A4B] accent-[#B58A4B] focus:ring-0"
                />
                <label htmlFor="optin" className="text-[11px] leading-tight text-[#716B64]">
                  I agree to receive important updates about my rewards, offers and news. You can opt out anytime.
                </label>
              </div>

              {registerError && (
                <div className="rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-3 text-xs font-medium text-[#A83B3B]">
                  {registerError}
                </div>
              )}

              <button
                type="submit"
                disabled={registering}
                className="mt-3 w-full rounded-2xl bg-[#B58A4B] py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60"
              >
                {registering ? "Creating Your Card..." : "Create Loyalty Card"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] text-[#716B64]/70">
            🔒 Fast 1-click registration • Secure &amp; confidential.
          </p>
        </main>
      )}

      {/* STEP 4: Waiting for owner approval */}
      {currentView === "request_pending" && (
        <main className="request-pending-screen mx-auto flex min-h-screen max-w-sm flex-col justify-between px-5 py-7">
          <div className="pt-2">
            <span className="request-pending-restaurant font-mono text-xs font-bold uppercase tracking-wider">
              {restaurant.name}
            </span>

            <div className="pending-stamp mx-auto my-7" role="img" aria-label="Stamp request verification in progress">
              <span className="pending-stamp__orbit" />
              <span className="pending-stamp__arc" />
              <div className="pending-stamp__seal">
                <span className="pending-stamp__letters">RF</span>
                <span className="pending-stamp__caption">Visit stamp</span>
              </div>
            </div>

            <span className="request-pending-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold">
              <span className="request-pending-chip__dot" />
              Stamp Request Sent to Staff
            </span>

            <h1 className="request-pending-heading mt-4 text-2xl font-extrabold">
              Verify Your Visit
            </h1>
            <p className="request-pending-copy mt-2 max-w-xs text-xs leading-relaxed">
              We notified the counter at <strong>{restaurant.name}</strong>. Once verified, your stamp will appear automatically on your card!
            </p>

            {requestError && (
              <div className="request-pending-error mt-4 rounded-xl border p-3 text-xs font-semibold">
                {requestError}
              </div>
            )}

            <div className="request-ticket mx-auto my-6 w-full max-w-xs rounded-2xl border p-4 text-left shadow-sm">
              <div className="request-ticket__details space-y-3">
                <div className="flex items-start justify-between gap-4 text-xs">
                  <span className="request-ticket__label">Guest</span>
                  <span className="request-ticket__value font-bold text-right">
                    {fullName || customer?.name || "Guest"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 text-xs">
                  <span className="request-ticket__label">Mobile</span>
                  <span className="request-ticket__value font-mono font-medium text-right">
                    +91 {phoneNumber}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 text-xs">
                  <span className="request-ticket__label">Location</span>
                  <span className="request-ticket__location font-semibold text-right">
                    {pendingTableNo || "Table Visit"}
                  </span>
                </div>
              </div>
              <div className="request-ticket__tear" aria-hidden="true" />
              <div className="request-ticket__status" role="status" aria-live="polite">
                <span className="request-ticket__pulse" aria-hidden="true" />
                <div>
                  <p className="request-ticket__label font-mono text-[9px] uppercase tracking-[0.12em]">Status</p>
                  <p className="request-ticket__value mt-0.5 text-xs font-bold">Awaiting staff confirmation</p>
                </div>
                <span className="request-ticket__checking ml-auto font-mono text-[9px] font-semibold uppercase tracking-wide">
                  Checking
                </span>
              </div>
            </div>

            <p className="request-pending-hint mx-auto max-w-xs text-[11px]">
              Approval checks automatically every 2.5 seconds.
            </p>
          </div>

          <div className="w-full max-w-xs space-y-3 mx-auto pb-2">
            <button
              onClick={() => setCurrentView("card")}
              className="request-pending-button w-full rounded-2xl py-3.5 text-sm font-bold shadow-sm transition"
            >
              View My Loyalty Card Meanwhile →
            </button>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 5: MY LOYALTY CARD (Matching Phone 5 in reference mockup)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "card" && (
        <main className="mx-auto min-h-screen max-w-sm px-5 py-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b pb-3.5" style={{ borderColor: businessFeedback.borderColor }}>
            {!firebaseContext && <button
              onClick={() => setCurrentView("welcome")}
              className="text-xs font-semibold text-[#716B64] hover:text-[#24211E] transition flex items-center gap-1"
            >
              <span aria-label="Back to business home">←</span>
            </button>}
            <div className="text-center">
              <h2 className="font-serif text-base font-bold text-[#24211E] leading-tight">
                My Rewards
              </h2>
              <p className="text-[11px] text-[#716B64]">{restaurant.name}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRefreshCard}
                disabled={refreshingCard}
                className="rounded-xl border border-[#E8DFD1] bg-white px-2.5 py-1.5 text-xs text-[#716B64] hover:bg-[#FAF7F2] transition disabled:opacity-60"
                title="Refresh Stamps"
                aria-label={refreshingCard ? "Refreshing rewards" : "Refresh rewards"}
              >
                <span className={refreshingCard ? "inline-block animate-spin" : "inline-block"} aria-hidden="true">↻</span>
              </button>
              <button
                onClick={() => setCurrentView("review")}
                className="rounded-xl bg-[#FAF5ED] border border-[#E8D8BA] px-2.5 py-1 text-xs font-bold text-[#7A5826] hover:bg-[#F6EFE3] transition"
              >
                ⭐ Review
              </button>
            </div>
          </div>

          {/* Pending Stamp Request Banner on Card */}
          {pendingRequestId && (
            <div className="mt-3.5 flex items-center justify-between rounded-2xl border border-[#E8D8BA] bg-[#FAF5ED] p-3 text-xs text-[#7A5826] shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#B58A4B] animate-ping shrink-0" />
                <span>Stamp request sent to staff! Waiting for approval...</span>
              </div>
              <button
                onClick={() => setCurrentView("request_pending")}
                className="ml-2 font-bold underline text-[#7A5826] shrink-0"
              >
                View
              </button>
            </div>
          )}

          {loadingCard && !customer ? (
            <div className="py-20 text-center text-xs font-medium text-[#716B64]">
              Loading your reward stamps...
            </div>
          ) : cardError ? (
            <div className="mt-8 rounded-2xl border border-[#F7D6D6] bg-white p-6 text-center shadow-subtle">
              <p className="text-xs text-[#A83B3B]">{cardError}</p>
              <button
                onClick={() => fetchLoyaltyCard(phoneNumber)}
                className="mt-3 rounded-xl bg-[#24211E] px-4 py-2 text-xs font-bold text-white hover:bg-stone-800"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {/* STAMP CARD (Matching Phone 5 Mockup) */}
              <div className="rounded-3xl border border-[#E8DFD1] bg-white p-5 shadow-subtle">
                <div className="flex items-center justify-between border-b border-[#E8DFD1]/60 pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E8DFD1] bg-[#FAF7F2] text-xl text-[#B58A4B]">
                      {restaurant.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-full w-full bg-white object-contain p-1" />
                      ) : businessFeedback.heroIcon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-serif text-sm font-bold text-[#24211E]">
                        {restaurant.name}
                      </h3>
                      <p className="text-[11px] text-[#716B64]">
                        {customer?.name || "Valued Customer"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-2xl font-black text-[#B58A4B]">
                      {currentStamps}
                    </span>
                    <span className="text-xs font-bold text-[#716B64]">/{stampsRequired}</span>
                    <span className="block text-[9px] uppercase tracking-wider text-[#716B64]">Stamps</span>
                  </div>
                </div>

                {/* Stamp Icons Row (Circles with Cups / Gift Box in Gold) */}
                <div className="my-5 grid grid-cols-5 gap-2.5">
                  {Array.from({ length: stampsRequired }).map((_, index) => {
                    const isStamped = index < currentStamps;
                    const isTarget = index === stampsRequired - 1;

                    return (
                      <div
                        key={index}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl transition-all ${isStamped
                            ? "bg-[#B58A4B] text-white shadow-xs scale-105"
                            : isTarget
                              ? "border-2 border-dashed border-[#B58A4B] bg-[#FAF5ED] text-[#B58A4B]"
                              : "border border-[#E8DFD1] bg-[#FAF7F2] text-[#B8B1A8]"
                          }`}
                      >
                        {isStamped ? (
                          <span className="text-lg">☕</span>
                        ) : isTarget ? (
                          <span className="text-lg">🎁</span>
                        ) : (
                          <span className="text-sm font-medium">☕</span>
                        )}
                        <span
                          className={`text-[8px] font-bold ${isStamped ? "text-white/90" : "text-[#716B64]"
                            }`}
                        >
                          {index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Subtitle */}
                <div className="rounded-2xl bg-[#FAF5ED] border border-[#E8D8BA] p-3 text-center">
                  <p className="text-xs font-bold text-[#7A5826]">
                    {currentStamps >= stampsRequired
                      ? "🎉 Goal Reached! Your reward voucher is ready to redeem!"
                      : stampsRemaining === 1
                        ? "4/5 Stamps — One more visit to unlock your reward!"
                        : `${currentStamps}/${stampsRequired} Stamps — ${stampsRemaining} more visits to unlock your reward!`}
                  </p>
                  {customer?.cycleEndsAt && customer.currentStamps > 0 && (
                    <p className="mt-1 text-[10px] text-[#7A5826]/80">
                      ⏳ Stamps valid until{" "}
                      <strong>
                        {new Date(customer.cycleEndsAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                    </p>
                  )}
                </div>

                {/* Collect Today's Stamp CTA on Card */}
                <div className="mt-4 pt-3 border-t border-[#E8DFD1]/60">
                  {hasCollectedStampToday ? (
                    <div className="w-full rounded-2xl py-3 text-xs font-bold text-[#2E6B4F] bg-[#EEF6F2] border border-[#D1E7DC] text-center flex items-center justify-center gap-2 shadow-2xs">
                      <span>✓</span>
                      <span>Today&apos;s Visit Stamp Collected ({currentStamps}/{stampsRequired})</span>
                    </div>
                  ) : (
                    <button
                      onClick={pendingRequestId ? () => setCurrentView("request_pending") : () => handleCollectStampClick()}
                      disabled={collectingStamp}
                      className="w-full rounded-2xl bg-[#B58A4B] py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <span>☕</span>
                      <span>
                        {pendingRequestId
                          ? "Approval Pending with Staff →"
                          : collectingStamp
                            ? "Sending Request..."
                            : "Collect Visit Stamp"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* NEXT REWARD CARD (Golden Gift Box Banner matching Phone 5) */}
              <div className="rounded-3xl border border-[#E8D8BA] bg-gradient-to-br from-[#FAF5ED] via-[#F4ECE1] to-[#FAF7F2] p-5 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="inline-block rounded-md bg-[#F4ECDD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7A5826]">
                    Next Reward
                  </span>
                  <span className="text-[11px] font-semibold text-[#7A5826]">
                    Valid for {program.rewardExpiryDays || 30} days
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-serif text-xl font-extrabold text-[#24211E]">
                      {discountDisplay}
                    </h4>
                    <p className="text-xs text-[#716B64] mt-0.5">
                      {program.rewardTitle || "on your next visit"}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6EFE3] text-2xl border border-[#E8D8BA] shadow-2xs">
                    🎁
                  </div>
                </div>
              </div>

              {/* Active Unredeemed Rewards / Vouchers */}
              {activeRewards.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#716B64]">
                    Available Vouchers ({activeRewards.length})
                  </h4>
                  {activeRewards.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-2xl border-2 border-dashed border-[#B58A4B] bg-white p-4 shadow-2xs"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-[#7A5826] uppercase">
                          Unlocked Voucher
                        </span>
                        <h5 className="text-sm font-bold text-[#24211E]">{r.rewardTitle}</h5>
                        <p className="font-mono text-xs font-semibold text-[#716B64]">
                          {r.code}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenRewardQr(r)}
                        className="rounded-xl bg-[#B58A4B] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#9E7438] transition"
                      >
                        Redeem →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Links: View Reward Details & Visit History */}
              <div className="divide-y divide-[#E8DFD1]/60 rounded-2xl border border-[#E8DFD1] bg-white shadow-subtle overflow-hidden">
                <button
                  onClick={() => {
                    if (activeRewards[0]) {
                      handleOpenRewardQr(activeRewards[0]);
                    } else {
                      alert(`Collect ${stampsRemaining} more stamps to unlock your reward voucher!`);
                    }
                  }}
                  className="flex w-full items-center justify-between p-4 text-xs font-bold text-[#24211E] hover:bg-[#FAF7F2] transition"
                >
                  <span className="flex items-center gap-2">
                    <span>🎟️</span>
                    <span>View Reward Details</span>
                  </span>
                  <span className="text-stone-400">›</span>
                </button>

                <div className="p-4">
                  <h5 className="text-xs font-bold text-[#24211E] flex items-center gap-2 mb-2">
                    <span>📜</span>
                    <span>Visit History ({customer?.transactions?.length || 0})</span>
                  </h5>
                  {customer?.transactions && customer.transactions.length > 0 ? (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {customer.transactions.map((tx) => (
                        <div key={tx.id} className="flex justify-between text-[11px] text-[#716B64] border-b border-[#E8DFD1]/40 pb-1">
                          <span>
                            {tx.stampsCount > 0 ? `+${tx.stampsCount} Stamp(s) Awarded` : "Offer Redeemed"}
                            {tx.billReference ? ` (${tx.billReference})` : ""}
                          </span>
                          <span className="text-[#716B64]/60">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#716B64]/70">No previous visits recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Action: Share Your Experience */}
              <button
                onClick={() => setCurrentView("review")}
                className="w-full rounded-2xl border border-[#E8DFD1] bg-white py-3 text-xs font-bold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition flex items-center justify-center gap-2"
              >
                <span>⭐</span>
                <span>Share Your Experience &amp; Review</span>
              </button>

              {/* Staff instruction */}
              <p className="text-center text-[11px] text-[#716B64]">
                Show your number (<strong>+91 {customer?.phone}</strong>) at the counter to verify your visit.
              </p>
            </div>
          )}
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 6: STAFF ISSUES STAMP (Celebration Screen matching Phone 6)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "stamp_added" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 py-8 text-center">
          {/* A clear success mark instead of decorative food imagery */}
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-[#EEF6F2] text-5xl font-semibold text-[#2E6B4F] shadow-subtle">
            <span aria-hidden="true">✓</span>
          </div>

          <span className="rounded-full bg-[#EEF6F2] px-3.5 py-1 text-xs font-bold text-[#2E6B4F] border border-[#D1E7DC] mb-3">
            ✨ Visit Recorded &amp; Stamped
          </span>

          <h1 className="font-serif text-3xl font-extrabold text-[#24211E]">
            Stamp Added!
          </h1>
          <p className="mt-2 max-w-xs text-xs text-[#716B64] leading-relaxed">
            {stampFeedbackMessage || "Your visit has been recorded. You're one step closer to your reward!"}
          </p>

          {/* Mini Stamp Dots visual preview */}
          <div className="my-6 flex items-center justify-center gap-2 rounded-2xl bg-white p-3.5 border border-[#E8DFD1] shadow-2xs">
            {Array.from({ length: stampsRequired }).map((_, index) => {
              const isStamped = index < currentStamps;
              return (
                <div
                  key={index}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${isStamped
                      ? "bg-[#B58A4B] text-white shadow-2xs scale-110"
                      : "border border-[#E8DFD1] bg-[#FAF7F2] text-[#B8B1A8]"
                    }`}
                >
                  {isStamped ? "✓" : index + 1}
                </div>
              );
            })}
          </div>

          <div className="w-full max-w-xs space-y-2.5">
            <button
              onClick={() => setCurrentView("card")}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.98]"
              style={{ backgroundColor: brandColor }}
            >
              View My Rewards ({currentStamps}/{stampsRequired}) →
            </button>

            <button
              onClick={() => setCurrentView("review")}
              className="w-full rounded-2xl border border-[#E8DFD1] bg-white py-3 text-xs font-bold text-[#24211E] shadow-2xs hover:bg-[#FAF7F2] transition flex items-center justify-center gap-1.5"
            >
              <span>⭐</span>
              <span>Share Experience (Optional)</span>
            </button>
          </div>
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 7: SHARE YOUR EXPERIENCE (Matching Phone 7 in reference mockup)
      ───────────────────────────────────────────────────────────── */}
      {currentView === "review" && (
        <main className="mx-auto min-h-screen max-w-sm px-5 py-6">
          <div
            className={`flex items-center justify-between border-b pb-3.5 ${
              isCafeFeedback ? "border-[#D2E0D3]" : "border-[#E8DFD1]"
            }`}
          >
            <button
              onClick={() => setCurrentView("welcome")}
              aria-label="Back to welcome page"
              className={isCafeFeedback
                ? "flex h-10 w-10 items-center justify-center rounded-full border border-[#D2E0D3] bg-white text-lg text-[#557A65] shadow-sm transition hover:bg-[#E6EFE6]"
                : "flex items-center gap-1 text-xs font-semibold text-[#716B64] transition hover:text-[#24211E]"}
            >
              <span aria-hidden="true">←</span>
            </button>
            <div className="min-w-0 text-center">
              {isCafeFeedback && (
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#557A65]">
                  A little pause in your day
                </p>
              )}
              <h2 className="font-serif text-base font-bold leading-tight text-[#24211E]">
                {businessFeedback.reviewTopbar}
              </h2>
              <p className="text-[11px] text-[#716B64]">{restaurant.name}</p>
            </div>
            <div className="w-6" />
          </div>

          <div
            className={isCafeFeedback
              ? "mt-5 rounded-[2rem] border p-5 text-center shadow-sm"
              : "mt-5 text-center"}
            style={isCafeFeedback
              ? {
                  borderColor: businessFeedback.borderColor,
                  background: `linear-gradient(145deg, #FFFFFF 0%, ${businessFeedback.softColor} 100%)`,
                }
              : undefined}
          >
            {isCafeFeedback ? (
              <div
                className="mx-auto mb-4 grid h-16 w-16 place-items-center overflow-hidden rounded-[1.25rem] border bg-white text-3xl shadow-sm"
                style={{ borderColor: businessFeedback.borderColor, color: businessFeedback.accentColor }}
              >
                {restaurant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-full w-full object-cover" />
                ) : businessFeedback.heroIcon}
              </div>
            ) : restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="mx-auto mb-3 h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm" />
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[#F6EFE3] font-serif text-xl font-bold text-[#B58A4B] shadow-sm">
                {restaurant.name.trim().charAt(0).toUpperCase() || "R"}
              </div>
            )}
            {isCafeFeedback && (
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#557A65]">
                Your visit, your way
              </p>
            )}
            <h3 className={`font-serif font-bold text-[#24211E] ${isCafeFeedback ? "text-3xl leading-tight" : "text-2xl"}`}>
              {businessFeedback.layout === "restaurant"
                ? `How was your visit to ${restaurant.name}?`
                : businessFeedback.reviewHeading}
            </h3>
            <p className={`mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[#716B64] ${isCafeFeedback ? "text-sm" : ""}`}>
              {restaurant.shareCaption || businessFeedback.reviewPrompt}
            </p>

            <div className={isCafeFeedback ? "mt-6 text-left" : "my-5"}>
              <p className={`mb-3 font-semibold text-[#24211E] ${isCafeFeedback ? "text-xs uppercase tracking-wide" : "text-sm"}`}>
                {businessFeedback.reviewInstruction}
              </p>
              {isCafeFeedback && (
                <div className="mb-4 rounded-2xl border bg-white/80 px-4 py-3" style={{ borderColor: businessFeedback.borderColor }}>
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold">
                    <span className="text-[#716B64]">Your tasting notes</span>
                    <span style={{ color: businessFeedback.accentColor }}>{reviewRatings.filter(Boolean).length} of 3 rated</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#E6EFE6]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(reviewRatings.filter(Boolean).length / 3) * 100}%`,
                        backgroundColor: businessFeedback.accentColor,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-3 text-left">
                {businessFeedback.questions.map((question, index) => (
                  businessFeedback.layout === "salon" ? (
                    <div key={question} className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: businessFeedback.borderColor }}>
                      <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ backgroundColor: businessFeedback.softColor }} aria-hidden="true">{businessFeedback.questionIcons[index]}</span>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: businessFeedback.accentColor }}>Salon detail 0{index + 1}</p>
                            <p className="mt-1 text-sm font-semibold text-[#24211E]">{question}</p>
                          </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: businessFeedback.borderColor }}>
                          <span className="text-[10px] font-medium text-[#716B64]">Tap to rate</span>
                          <Stars size={32} value={reviewRatings[index]} onChange={(rating) => updateReviewRating(index, rating)} label={question} activeColor={businessFeedback.accentColor} inactiveColor={businessFeedback.borderColor} />
                      </div>
                    </div>
                  ) : businessFeedback.layout === "cafe" ? (
                    <div key={question} className="rounded-[1.35rem] border bg-white p-4 shadow-sm transition-shadow hover:shadow-md" style={{ borderColor: businessFeedback.borderColor }}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ backgroundColor: businessFeedback.softColor }} aria-hidden="true">{businessFeedback.questionIcons[index]}</span>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: businessFeedback.accentColor }}>
                            {businessFeedback.aspectLabels[index]}
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#24211E]">{question}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: businessFeedback.borderColor }}>
                        <span className="shrink-0 text-[10px] font-medium text-[#716B64]">
                          {reviewRatings[index] ? `${reviewRatings[index]} / 5` : "Tap to rate"}
                        </span>
                        <Stars size={30} value={reviewRatings[index]} onChange={(rating) => updateReviewRating(index, rating)} label={question} activeColor={businessFeedback.accentColor} inactiveColor={businessFeedback.borderColor} />
                      </div>
                    </div>
                  ) : businessFeedback.layout === "general-store" ? (
                    <div key={question} className="rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor: businessFeedback.borderColor }}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg" style={{ backgroundColor: businessFeedback.softColor }} aria-hidden="true">{businessFeedback.questionIcons[index]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: businessFeedback.accentColor }}>Shopping detail 0{index + 1}</p>
                          <p className="mt-1 text-xs font-semibold text-[#24211E]">{question}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-2" style={{ borderColor: businessFeedback.borderColor }}>
                        <span className="text-[10px] font-medium text-[#716B64]">Tap to rate</span>
                        <Stars size={30} value={reviewRatings[index]} onChange={(rating) => updateReviewRating(index, rating)} label={question} activeColor={businessFeedback.accentColor} inactiveColor={businessFeedback.borderColor} />
                      </div>
                    </div>
                  ) : (
                    <div key={question} className="flex min-h-[68px] items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2" style={{ borderColor: businessFeedback.borderColor }}>
                      <span className="min-w-0 text-xs font-semibold text-[#24211E]">{question}</span>
                      <Stars size={34} value={reviewRatings[index]} onChange={(rating) => updateReviewRating(index, rating)} label={question} activeColor={businessFeedback.accentColor} inactiveColor={businessFeedback.borderColor} />
                    </div>
                  )
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#716B64]" aria-live="polite">
                {reviewRatings.filter(Boolean).length === 3
                  ? businessFeedback.ratingThankYou
                  : isCafeFeedback
                    ? "A quick rating for each part of your visit helps us make your next cup even better."
                    : `Tap 1–5 stars for ${businessFeedback.aspectLabels.map((aspect) => aspect.toLowerCase()).join(", and ")}.`}
              </p>
            </div>
          </div>

          <div
            className={`space-y-4 border bg-white p-5 shadow-subtle ${isCafeFeedback ? "rounded-[1.75rem]" : "rounded-3xl"}`}
            style={{ borderColor: businessFeedback.borderColor }}
          >
            {aiGenerated && (
              <div>
                <label htmlFor="generated-review" className="mb-2 block text-xs font-semibold text-[#716B64]">
                  Your review draft (you can edit it)
                </label>
                <textarea
                  id="generated-review"
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border bg-white p-3 text-sm text-[#24211E] outline-none transition focus:bg-white"
                  style={{ borderColor: businessFeedback.borderColor }}
                />
                <button
                  type="button"
                  onClick={handleGenerateAiReview}
                  disabled={generatingAi || reviewRatings.some((rating) => rating === 0)}
                  className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border bg-white py-2 text-xs font-bold transition hover:bg-[#FAF7F2] disabled:opacity-60"
                  style={{ borderColor: businessFeedback.borderColor, color: businessFeedback.accentColor }}
                  aria-label="Generate another review draft"
                >
                  <span className={generatingAi ? "inline-block animate-spin" : "inline-block"} aria-hidden="true">↻</span>
                  <span>{generatingAi ? "Creating another draft..." : "Generate another version"}</span>
                </button>
              </div>
            )}

            {/* Button: create a review draft (AI in Next.js, local template on Firebase Hosting) */}
            <button
              onClick={aiGenerated ? handleCopyAndGoogleReview : handleGenerateAiReview}
              disabled={generatingAi || reviewRatings.some((rating) => rating === 0)}
              className={`sticky bottom-3 z-20 flex min-h-12 w-full items-center justify-center gap-2 border border-white/40 py-3 text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 ${isCafeFeedback ? "rounded-full" : "rounded-2xl"}`}
              style={{ backgroundColor: businessFeedback.accentColor }}
              onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.accentHoverColor; }}
              onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = businessFeedback.accentColor; }}
              aria-live="polite"
            >
              <span>{businessFeedback.heroIcon}</span>
              <span>
                {generatingAi
                  ? firebaseContext ? "Creating your review draft..." : "Crafting Review with AI..."
                  : aiGenerated
                    ? "Continue to Google Reviews"
                    : firebaseContext ? "Create review draft" : "Continue"}
              </span>
            </button>

            {reviewGenerationError && (
              <p role="alert" className="rounded-xl border border-[#F7D6D6] bg-[#FDF2F2] p-3 text-xs font-semibold text-[#A83B3B]">
                {reviewGenerationError}
              </p>
            )}

            {restaurant.instagramUrl && (
              <a
                href={restaurant.instagramUrl}
                onClick={() => recordSocialClick("instagram")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E8DFD1] bg-white px-4 text-sm font-bold text-[#24211E] transition hover:bg-[#FAF7F2]"
              >
                <span aria-hidden="true">◎</span> Follow {restaurant.name} on Instagram
              </a>
            )}

            {aiGenerated && (
              <div className="space-y-3 border-t border-[#E8DFD1] pt-4">
                {reviewSubmitted && (
                  <div className="space-y-1.5 text-center text-xs text-[#2E6B4F]">
                    <p className="font-bold">✅ Review copied to clipboard!</p>
                    <p>Paste your copied review into the Google review box that opened.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Stamp CTA */}
          {(firebaseContext ? program.isActive : true) && <div className={`mt-5 rounded-2xl border p-4 text-center ${isCafeFeedback ? "bg-white/85" : "bg-white"}`} style={{ borderColor: businessFeedback.borderColor }}>
            <p className="text-xs font-semibold text-[#716B64]">
              Want to collect a loyalty stamp for your visit?
            </p>
            <button
              onClick={() => handleCollectStampClick(phoneNumber)}
              disabled={newCustomerReviewRequired && !reviewSubmitted}
              className="mt-1.5 text-xs font-bold underline text-[#24211E] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {newCustomerReviewRequired && !reviewSubmitted ? "Complete your review to continue" : "Collect My Stamp Now →"}
            </button>
          </div>}
        </main>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: REWARD REDEMPTION SCREENS (Matching Reference Mockup)
      ───────────────────────────────────────────────────────────── */}
      {/* SCREEN 2: YOUR REWARD (Voucher QR Modal) */}
      {currentView === "reward_details" && selectedReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-[#E8DFD1]">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#FAF5ED] border border-[#E8D8BA] px-2.5 py-0.5 text-[10px] font-bold text-[#7A5826]">
                🎁 Redeem at Counter
              </span>
              <button
                onClick={() => setCurrentView("card")}
                className="text-[#716B64] hover:text-[#24211E] text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              {restaurant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-10 w-10 rounded-lg border border-[#E8DFD1] bg-white object-contain p-1" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#E8DFD1] bg-[#FAF7F2] text-lg" aria-hidden="true">
                  {businessFeedback.heroIcon}
                </span>
              )}
              <span className="text-xs font-semibold text-[#716B64]">{restaurant.name}</span>
            </div>

            <h4 className="mt-3 font-serif text-2xl font-bold text-[#24211E]">
              Your Reward
            </h4>
            <p className="text-sm font-bold text-[#B58A4B] mt-0.5">
              {selectedReward.rewardTitle}
            </p>

            {/* Generated QR Code */}
            <div className="my-4 flex justify-center">
              {rewardQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rewardQrDataUrl}
                  alt={`Voucher ${selectedReward.code}`}
                  className="h-52 w-52 rounded-2xl border border-[#E8DFD1] p-2 shadow-inner"
                />
              ) : (
                <div className="h-52 w-52 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-xs text-[#716B64]">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#FAF7F2] border border-[#E8DFD1] p-2.5">
              <span className="text-[10px] font-semibold text-[#716B64] uppercase tracking-wider block">
                Voucher Code
              </span>
              <span className="font-mono text-base font-black text-[#24211E] tracking-wider">
                {selectedReward.code}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-[#716B64]">
              Valid until {new Date(selectedReward.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>

            <p className="mt-2 text-[11px] text-[#716B64] leading-tight">
              Show this code to staff to redeem your reward.
            </p>

            <button
              onClick={() => setCurrentView("card")}
              className="mt-5 w-full rounded-xl bg-[#24211E] py-3 text-xs font-bold text-white transition hover:bg-stone-800"
            >
              Back to My Rewards
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 3: REWARD REDEEMED CELEBRATION */}
      {currentView === "reward_redeemed" && (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 py-8 text-center">
          {restaurant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="mb-4 h-12 w-12 rounded-xl border border-[#E8DFD1] bg-white object-contain p-1" />
          )}
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[#FAF5ED] text-5xl shadow-subtle border-4 border-white text-[#B58A4B]">
            ✓
          </div>

          <h1 className="font-serif text-3xl font-extrabold text-[#24211E]">
            Reward Redeemed!
          </h1>
          <p className="mt-2 max-w-xs text-xs text-[#716B64] leading-relaxed">
            Enjoy your discount on your visit today.
          </p>

          <button
            onClick={() => setCurrentView("card")}
            className="mt-8 w-full max-w-xs rounded-2xl bg-[#B58A4B] py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#9E7438] active:scale-[0.98]"
          >
            Back to My Rewards
          </button>
        </main>
      )}
    </div>
  );
}
