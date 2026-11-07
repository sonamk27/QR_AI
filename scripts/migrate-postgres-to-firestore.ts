import "./load-env";
import { PrismaClient } from "@prisma/client";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ModelName =
  | "user" | "restaurant" | "qrCode" | "scan" | "feedbackSession" | "draft" | "payment"
  | "qrRequest" | "auditLog" | "socialClick" | "loyaltyProgram" | "loyaltyCustomer"
  | "loyaltyTransaction" | "loyaltyReward" | "anonymousCustomer"
  | "anonymousVisit" | "anonymousStampTransaction" | "anonymousReward" | "anonymousRedemption" | "stampRequest";

const models: { model: ModelName; collection: string }[] = [
  { model: "user", collection: "users" },
  { model: "restaurant", collection: "restaurants" },
  { model: "qrCode", collection: "qrCodes" },
  { model: "scan", collection: "scans" },
  { model: "feedbackSession", collection: "feedbackSessions" },
  { model: "draft", collection: "drafts" },
  { model: "payment", collection: "payments" },
  { model: "qrRequest", collection: "qrRequests" },
  { model: "auditLog", collection: "auditLogs" },
  { model: "socialClick", collection: "socialClicks" },
  { model: "loyaltyProgram", collection: "loyaltyPrograms" },
  { model: "loyaltyCustomer", collection: "loyaltyCustomers" },
  { model: "loyaltyTransaction", collection: "loyaltyTransactions" },
  { model: "loyaltyReward", collection: "loyaltyRewards" },
  { model: "anonymousCustomer", collection: "anonymousCustomers" },
  { model: "anonymousVisit", collection: "anonymousVisits" },
  { model: "anonymousStampTransaction", collection: "anonymousStampTransactions" },
  { model: "anonymousReward", collection: "anonymousRewards" },
  { model: "anonymousRedemption", collection: "anonymousRedemptions" },
  { model: "stampRequest", collection: "stampRequests" },
];

const prisma = new PrismaClient();

function clean(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("toNumber" in value && typeof (value as { toNumber?: unknown }).toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]));
  }
  return value;
}

function isNotFound(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "auth/user-not-found";
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Set NEXT_PUBLIC_FIREBASE_PROJECT_ID before running the migration.");
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault();
  const adminApp = getApps()[0] ?? initializeApp({ projectId, credential });
  const auth = getAuth(adminApp);
  const firestore = getFirestore(adminApp);
  const execute = process.argv.includes("--execute");
  const collectionArg = process.argv.find((arg) => arg.startsWith("--collections="))?.slice("--collections=".length);
  const selectedCollections = collectionArg ? collectionArg.split(",").map((value) => value.trim()).filter(Boolean) : models.map(({ collection }) => collection);
  if (!selectedCollections.length) throw new Error("Select at least one Firestore collection.");
  const unknownCollections = selectedCollections.filter((name) => !models.some((entry) => entry.collection === name));
  if (unknownCollections.length) throw new Error(`Unknown Firestore collection(s): ${unknownCollections.join(", ")}. Allowed: ${models.map(({ collection }) => collection).join(", ")}`);
  if (new Set(selectedCollections).size !== selectedCollections.length) throw new Error("List each Firestore collection only once.");
  const selectedModels = models.filter(({ collection }) => selectedCollections.includes(collection));
  const afterIdArg = process.argv.find((arg) => arg.startsWith("--after-id="))?.slice("--after-id=".length);
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length);
  const pageLimit = limitArg === undefined ? undefined : Number(limitArg);
  if (pageLimit !== undefined && (!Number.isSafeInteger(pageLimit) || pageLimit < 1)) throw new Error("--limit must be a positive whole number.");
  if ((afterIdArg !== undefined || pageLimit !== undefined) && selectedModels.length !== 1) throw new Error("--after-id and --limit can only be used with exactly one --collections value.");

  const rows = Object.fromEntries(await Promise.all(models.map(async ({ model }) => {
    const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<Record<string, any>[]> }>)[model];
    return [model, await delegate.findMany()];
  }))) as Record<ModelName, Record<string, any>[]>;

  const importRows = Object.fromEntries(models.map(({ model, collection }) => {
    let selectedRows = selectedModels.some((entry) => entry.model === model) ? rows[model] : [];
    if (selectedRows.length && selectedModels.length === 1 && (afterIdArg !== undefined || pageLimit !== undefined)) {
      selectedRows = [...selectedRows].sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
      if (afterIdArg !== undefined) selectedRows = selectedRows.filter((row) => String(row.id) > afterIdArg);
      if (pageLimit !== undefined) selectedRows = selectedRows.slice(0, pageLimit);
    }
    return [model, selectedRows];
  })) as Record<ModelName, Record<string, any>[]>;
  const invoiceCounterByYear = new Map<string, number>();
  if (selectedModels.some(({ model }) => model === "payment")) {
    for (const payment of rows.payment) {
      const match = /^RF-(\d{4})-(\d+)$/.exec(String(payment.invoiceNo ?? ""));
      if (match) invoiceCounterByYear.set(match[1], Math.max(invoiceCounterByYear.get(match[1]) ?? 0, Number(match[2])));
    }
  }
  const invoiceCounterValues = Array.from(invoiceCounterByYear, ([year, value]) => ({ year, value }));
  const migratesRestaurantsAndPrograms = selectedModels.some(({ model }) => model === "restaurant")
    && selectedModels.some(({ model }) => model === "loyaltyProgram");
  const restaurantsWithLegacyPrograms = new Set(rows.loyaltyProgram.map((program) => String(program.restaurantId)));
  const restaurantsNeedingDefaultProgram = migratesRestaurantsAndPrograms
    ? importRows.restaurant.filter((restaurant) => !restaurantsWithLegacyPrograms.has(String(restaurant.id)))
    : [];

  const userUidByLegacyId = new Map<string, string>();
  const authUserByLegacyId = new Map<string, UserRecord>();
  const createdAuthUserIds = new Set<string>();
  for (const user of rows.user) {
    let authUser: UserRecord | undefined;
    try {
      authUser = await auth.getUserByEmail(user.email);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    const isIncludedUser = importRows.user.some((candidate) => candidate.id === user.id);
    if (!authUser && execute && isIncludedUser) {
      try {
        authUser = await auth.createUser({
          uid: user.id,
          email: user.email,
          emailVerified: Boolean(user.emailVerifiedAt),
          displayName: user.name,
        });
        createdAuthUserIds.add(user.id);
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "auth/email-already-exists") {
          authUser = await auth.getUserByEmail(user.email);
        } else {
          throw error;
        }
      }
    }
    const uid = authUser?.uid ?? user.id;
    userUidByLegacyId.set(user.id, uid);
    if (authUser) authUserByLegacyId.set(user.id, authUser);
  }

  const byId = (model: ModelName) => new Map(rows[model].map((row) => [String(row.id), row]));
  const restaurantRows = byId("restaurant");
  const qrRows = byId("qrCode");
  const sessionRows = byId("feedbackSession");
  const programRows = byId("loyaltyProgram");
  const loyaltyCustomerRows = byId("loyaltyCustomer");
  const anonymousCustomerRows = byId("anonymousCustomer");
  const anonymousRewardRows = byId("anonymousReward");

  const restaurantOwner = new Map<string, string>();
  for (const restaurant of rows.restaurant) {
    const ownerUid = userUidByLegacyId.get(restaurant.ownerId);
    if (ownerUid) restaurantOwner.set(restaurant.id, ownerUid);
  }
  const openRequestByRestaurant = new Map<string, string>();
  for (const request of rows.qrRequest) {
    if (request.status === "PENDING_APPROVAL" || request.status === "APPROVED_PAYMENT_DUE") {
      openRequestByRestaurant.set(request.restaurantId, request.id);
    }
  }
  const primaryQrByRestaurant = new Map<string, string>();
  for (const qr of rows.qrCode) {
    if (qr.status !== "PENDING_PAYMENT") primaryQrByRestaurant.set(qr.restaurantId, qr.id);
  }
  const ownerFor = (model: ModelName, row: Record<string, any>): string | undefined => {
    if (model === "user") return userUidByLegacyId.get(row.id);
    if (model === "restaurant") return restaurantOwner.get(row.id);
    if (row.restaurantId) return restaurantOwner.get(row.restaurantId);
    if (row.qrId) {
      const qr = qrRows.get(row.qrId);
      return qr ? restaurantOwner.get(qr.restaurantId) : undefined;
    }
    if (row.sessionId) {
      const session = sessionRows.get(row.sessionId);
      const qr = session ? qrRows.get(session.qrId) : undefined;
      return qr ? restaurantOwner.get(qr.restaurantId) : undefined;
    }
    if (row.programId) {
      const program = programRows.get(row.programId);
      return program ? restaurantOwner.get(program.restaurantId) : undefined;
    }
    if (row.customerId) {
      const loyaltyCustomer = loyaltyCustomerRows.get(row.customerId);
      const anonCustomer = anonymousCustomerRows.get(row.customerId);
      const program = loyaltyCustomer ? programRows.get(loyaltyCustomer.programId) : undefined;
      return program ? restaurantOwner.get(program.restaurantId) : anonCustomer ? restaurantOwner.get(anonCustomer.restaurantId) : undefined;
    }
    if (row.rewardId) {
      const reward = anonymousRewardRows.get(row.rewardId);
      const customer = reward ? anonymousCustomerRows.get(reward.customerId) : undefined;
      return customer ? restaurantOwner.get(customer.restaurantId) : undefined;
    }
    return undefined;
  };

  const publicQrRows = importRows.qrCode.filter((row) => (row.status === "ACTIVE" || row.status === "GRACE") && typeof row.slug === "string" && row.slug);
  const documentCount = selectedModels.reduce((sum, { model }) => sum + importRows[model].length, 0)
    + importRows.restaurant.length
    + importRows.loyaltyProgram.length + publicQrRows.length + invoiceCounterValues.length
    + restaurantsNeedingDefaultProgram.length * 2;
  console.log(`Project: ${projectId}`);
  console.log(`Collections selected: ${selectedCollections.join(", ")}`);
  for (const entry of selectedModels) console.log(`${entry.collection}: ${rows[entry.model].length} total; ${importRows[entry.model].length} in this batch`);
  console.log(`Firestore documents to write: ${documentCount} (includes public profiles, QR lookup pages, and invoice counters)`);
  console.log(`Firebase Auth users to create: ${execute ? createdAuthUserIds.size : importRows.user.filter((user) => !authUserByLegacyId.has(user.id)).length}`);
  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN (no Firebase Auth or Firestore changes)"}`);
  console.log("Email verification tokens and PostgreSQL password hashes are intentionally not imported.");
  if (!execute) return;
  if (documentCount > 18_000) {
    throw new Error("This batch exceeds the 18,000-write daily safety budget for Firebase Spark. Select fewer collections or paginate one collection with --collections=<name> --after-id=<last-id> --limit=<count>.");
  }

  const writes: { collection: string; id: string; data: Record<string, unknown> }[] = [];
  for (const { model, collection: collectionName } of selectedModels) {
    for (const row of importRows[model]) {
      const legacyId = String(row.id);
      const id = model === "user" ? userUidByLegacyId.get(legacyId)! : legacyId;
      const data: Record<string, unknown> = { ...row, id };
      if (model === "user") {
        delete data.passwordHash;
        delete data.restaurants;
        delete data.emailVerificationToken;
        data.uid = id;
        data.legacyId = legacyId;
        if (createdAuthUserIds.has(legacyId)) data.passwordResetRequired = true;
        else delete data.passwordResetRequired;
      }
      if (model === "restaurant") {
        delete data.ownerId;
        data.ownerUid = restaurantOwner.get(legacyId);
        const openRequestId = openRequestByRestaurant.get(legacyId);
        const primaryQrId = primaryQrByRestaurant.get(legacyId);
        if (openRequestId) data.openQrRequestId = openRequestId;
        if (primaryQrId) data.primaryQrId = primaryQrId;
      }
      if (model === "qrRequest") {
        data.qrCodeIds = rows.qrCode.filter((qr) => qr.qrRequestId === legacyId).map((qr) => qr.id);
      }
      if (model === "payment" && data.recordedById) {
        data.recordedByUid = userUidByLegacyId.get(String(data.recordedById)) ?? null;
        delete data.recordedById;
      }
      if (model === "qrRequest" && data.reviewedById) {
        data.reviewedByUid = userUidByLegacyId.get(String(data.reviewedById)) ?? null;
        delete data.reviewedById;
      }
      if (model === "auditLog") {
        data.actorUid = userUidByLegacyId.get(String(data.actorId)) ?? String(data.actorId);
        delete data.actorId;
      }
      if (model === "anonymousVisit" && data.verifiedByStaffId) {
        data.verifiedByStaffUid = userUidByLegacyId.get(String(data.verifiedByStaffId)) ?? null;
        delete data.verifiedByStaffId;
      }
      if (model === "anonymousRedemption" && data.staffId) {
        data.staffUid = userUidByLegacyId.get(String(data.staffId)) ?? null;
        delete data.staffId;
      }
      if (model === "stampRequest" && data.reviewedById) {
        data.reviewedByUid = userUidByLegacyId.get(String(data.reviewedById)) ?? null;
        delete data.reviewedById;
      }
      const ownerUid = ownerFor(model, row);
      if (ownerUid) data.ownerUid = ownerUid;
      if (model === "anonymousCustomer") {
        // The legacy PostgreSQL schema does not link anonymous customers to
        // authenticated users. Keep the record restaurant-owned; do not invent
        // a guest identity association during migration.
        delete data.guestUid;
        data.restaurantId = String(row.restaurantId ?? "");
      }
      if (model === "anonymousStampTransaction" || model === "anonymousReward") {
        // Guest identity cannot be recovered from the old anonymous-customer
        // schema. The restaurant owner can still review these historical rows.
        delete data.guestUid;
      }
      if (model === "stampRequest" && row.anonCustomerId) {
        delete data.guestUid;
      }
      writes.push({ collection: collectionName, id, data: clean(data) as Record<string, unknown> });
      if (model === "restaurant") {
        writes.push({
          collection: "publicRestaurants",
          id: legacyId,
          data: clean({
            restaurantId: legacyId,
            name: row.name,
            businessType: row.businessType ?? "RESTAURANT",
            city: row.city ?? null,
            logoUrl: row.logoUrl ?? null,
            brandColor: row.brandColor ?? "#B58A4B",
            googleReviewUrl: row.googleReviewUrl ?? null,
            instagramUrl: row.instagramUrl ?? null,
            facebookUrl: row.facebookUrl ?? null,
            shareCaption: row.shareCaption ?? null,
            status: row.status ?? "ACTIVE",
          }) as Record<string, unknown>,
        });
      }
      if (model === "qrCode" && (row.status === "ACTIVE" || row.status === "GRACE") && typeof row.slug === "string" && row.slug) {
        writes.push({
          collection: "publicQrPages",
          id: row.slug,
          data: clean({ qrId: id, ownerUid, restaurantId: row.restaurantId, slug: row.slug, status: row.status, validUntil: row.validUntil ?? null }) as Record<string, unknown>,
        });
      }
      if (model === "loyaltyProgram") {
        const publicData = {
          id: String(row.restaurantId),
          programId: legacyId,
          restaurantId: String(row.restaurantId),
          ownerUid,
          title: row.title,
          isActive: row.isActive,
          discountType: row.discountType,
          stampsRequired: row.stampsRequired,
          minBillAmount: row.minBillAmount,
          rewardTitle: row.rewardTitle,
          rewardDiscount: row.rewardDiscount,
          rewardExpiryDays: row.rewardExpiryDays,
        };
        writes.push({ collection: "loyaltyPublicPrograms", id: String(row.restaurantId), data: clean(publicData) as Record<string, unknown> });
      }
    }
  }

  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = firestore.batch();
    for (const write of writes.slice(offset, offset + 400)) {
      batch.set(firestore.collection(write.collection).doc(write.id), write.data, { merge: true });
    }
    await batch.commit();
    console.log(`Imported ${Math.min(offset + 400, writes.length)} / ${writes.length} documents`);
  }
  for (const { year, value } of invoiceCounterValues) {
    const counterRef = firestore.collection("invoiceCounters").doc(year);
    await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(counterRef);
      const current = Number(existing.data()?.value ?? 0);
      transaction.set(counterRef, { value: Math.max(current, value), updatedAt: new Date() }, { merge: true });
    });
  }
  for (const restaurant of restaurantsNeedingDefaultProgram) {
    const restaurantId = String(restaurant.id);
    const ownerUid = restaurantOwner.get(restaurantId);
    if (!ownerUid) continue;
    const programRef = firestore.collection("loyaltyPrograms").doc(restaurantId);
    await firestore.runTransaction(async (transaction) => {
      const [existing, sameId] = await Promise.all([
        transaction.get(firestore.collection("loyaltyPrograms").where("restaurantId", "==", restaurantId).limit(1)),
        transaction.get(programRef),
      ]);
      if (!existing.empty || sameId.exists) return;
      const publicProgramRef = firestore.collection("loyaltyPublicPrograms").doc(restaurantId);
      const program = {
        id: restaurantId, ownerUid, restaurantId, title: "Rewards Program", isActive: true,
        discountType: "FLAT", stampsRequired: 10, minBillAmount: 20000,
        rewardTitle: "₹100 Off Your Bill", rewardDiscount: 10000, rewardExpiryDays: 30,
        terminalPin: "1234", createdAt: new Date(),
      };
      transaction.create(programRef, program);
      transaction.set(publicProgramRef, {
        id: restaurantId, programId: restaurantId, restaurantId, ownerUid,
        title: program.title, isActive: program.isActive, discountType: program.discountType,
        stampsRequired: program.stampsRequired, minBillAmount: program.minBillAmount,
        rewardTitle: program.rewardTitle, rewardDiscount: program.rewardDiscount,
        rewardExpiryDays: program.rewardExpiryDays,
      });
    });
  }
  if (pageLimit !== undefined && selectedModels.length === 1) {
    const batchRows = importRows[selectedModels[0].model];
    const lastId = batchRows.length ? String(batchRows[batchRows.length - 1].id) : "";
    if (batchRows.length === pageLimit && rows[selectedModels[0].model].some((row) => String(row.id) > lastId)) {
      console.log(`Next page: --collections=${selectedModels[0].collection} --after-id=${lastId}`);
    }
  }
  console.log("Migration finished. Users without a Firebase password must use Forgot password to set one.");
}

main().catch((error) => {
  console.error("Migration stopped:", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
