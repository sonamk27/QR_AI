import "./load-env";
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env.local or the current environment.`);
  return value;
}

function getServiceAccount() {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  const raw = file
    ? readFileSync(file, "utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (!raw) {
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT_FILE to a local service-account JSON file path.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Firebase service-account credentials are not valid JSON. Use FIREBASE_SERVICE_ACCOUNT_FILE with the downloaded JSON file.");
  }
}

async function main() {
  const projectId = requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const email = requiredEnv("FIREBASE_SUPER_ADMIN_EMAIL").toLowerCase();
  const name = process.env.FIREBASE_SUPER_ADMIN_NAME?.trim() || "Super Admin";
  const serviceAccount = getServiceAccount();

  if (serviceAccount.project_id !== projectId) {
    throw new Error(`Project mismatch: NEXT_PUBLIC_FIREBASE_PROJECT_ID is ${projectId}, but the service-account file is for ${serviceAccount.project_id ?? "an unknown project"}.`);
  }

  const app = getApps()[0] ?? initializeApp({ projectId, credential: cert(serviceAccount) });
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found") {
      throw new Error(`No Firebase Authentication account exists for ${email}. This script never creates or changes Auth accounts.`);
    }
    throw error;
  }

  if (user.disabled) throw new Error(`Firebase Authentication account ${email} is disabled. No profile was changed.`);
  if (user.email?.toLowerCase() !== email) throw new Error("Firebase returned an account with a different email. No profile was changed.");

  const profileRef = firestore.collection("users").doc(user.uid);
  const existing = await profileRef.get();
  if (existing.exists) {
    const profile = existing.data();
    if (profile?.role === "super_admin" && String(profile.email).toLowerCase() === email) {
      console.log(`Already configured: ${email} is linked to Super Admin profile ${user.uid}. No changes made.`);
      return;
    }
    throw new Error(`A Firestore profile already exists at users/${user.uid} with role ${String(profile?.role ?? "(unset)")}. It was not overwritten.`);
  }

  console.log(`Firebase project: ${projectId}`);
  console.log(`Existing Firebase Auth account: ${email}`);
  console.log(`UID: ${user.uid}`);
  console.log(`Missing profile to create: users/${user.uid} (role: super_admin)`);

  const args = process.argv.slice(2);
  if (!args.includes("--execute")) {
    console.log("Dry run only. No Firebase changes made.");
    console.log(`To create this missing profile, run with -- --execute --confirm-email ${email}`);
    return;
  }

  const confirmIndex = args.indexOf("--confirm-email");
  const confirmedEmail = confirmIndex >= 0 ? args[confirmIndex + 1]?.trim().toLowerCase() : undefined;
  if (confirmedEmail !== email) {
    throw new Error(`To execute, pass --confirm-email ${email} exactly. No Firebase changes made.`);
  }

  await firestore.runTransaction(async (transaction) => {
    const current = await transaction.get(profileRef);
    if (current.exists) {
      throw new Error(`Profile users/${user.uid} appeared during setup. It was not overwritten.`);
    }
    transaction.create(profileRef, {
      uid: user.uid,
      email,
      name,
      role: "super_admin",
      createdAt: Timestamp.now(),
    });
  });

  console.log(`Created the missing Super Admin profile for ${email} (UID: ${user.uid}). Firebase Auth credentials were left unchanged.`);
}

main().catch((error) => {
  console.error("Super Admin profile setup stopped:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
