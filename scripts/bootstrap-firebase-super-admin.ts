import "./load-env";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

async function main() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.FIREBASE_SUPER_ADMIN_NAME?.trim();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!projectId || !email || !serviceAccountJson) {
    throw new Error("Set NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_SUPER_ADMIN_EMAIL, and FIREBASE_SERVICE_ACCOUNT_JSON.");
  }

  const app = getApps()[0] ?? initializeApp({ projectId, credential: cert(JSON.parse(serviceAccountJson)) });
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const existingAdmins = await firestore.collection("users").where("role", "==", "super_admin").limit(1).get();
  if (!existingAdmins.empty) throw new Error("A Super Admin already exists. This one-time bootstrap is only for an empty Firebase project.");

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found")) throw error;
  }

  console.log(`Firebase project: ${projectId}`);
  console.log(`Initial Super Admin: ${email}`);
  console.log(user
    ? `An existing Firebase Auth account (${user.uid}) will be linked as the first Super Admin.`
    : "A new email-verified account will be created without a password. Set one using the app's Forgot password flow.");
  if (!process.argv.includes("--execute")) {
    console.log("Mode: DRY RUN (no Firebase changes). Add -- --execute to create the account.");
    return;
  }

  const createdUser = user ?? await auth.createUser({ email, displayName: name || undefined, emailVerified: true, disabled: false });
  try {
    await firestore.collection("users").doc(createdUser.uid).create({
      uid: createdUser.uid,
      email,
      name: name || "Super Admin",
      role: "super_admin",
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    if (!user) await auth.deleteUser(createdUser.uid).catch(() => undefined);
    throw error;
  }
  console.log(`Created Super Admin profile for ${createdUser.uid}. ${user ? "The existing Firebase Auth account is linked; use its current password or reset it with Forgot password." : "The email is marked verified. Use Forgot password to set the password, then sign in."}`);
}

main().catch((error) => {
  console.error("Firebase Super Admin bootstrap stopped:", error);
  process.exitCode = 1;
});
