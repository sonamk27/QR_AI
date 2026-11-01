# ReviewFlow

ReviewFlow is a static Next.js frontend deployed on Firebase Hosting. Firebase Authentication handles accounts and Cloud Firestore stores restaurant profiles, QR codes, feedback, and loyalty data. The app has no deployed Node server or API routes.

The deployable client lives in `static-client/`. `npm run build` exports it to `static-client/out`, which Firebase Hosting serves. The root `app/` tree is the previous server implementation and is not used by the Firebase build.

## Firebase setup

The project is preselected as `qrai-37f73` in `.firebaserc`.

1. Keep the Firebase project on the **Spark** plan for no-billing static hosting.
2. In Firebase Console, create a Cloud Firestore database.
3. Enable Email/Password and Google providers in Authentication. Enable Anonymous sign-in for guest loyalty cards.
4. Set the Firebase web app settings in the root `.env` using `.env.example` as a guide. The build helper copies only the four public Firebase web settings into the ignored `static-client/.env.local`; it does not copy server secrets.
5. Deploy the Firestore rules and static site:

   ```sh
   npm ci
   npm run build
   npm install --global firebase-tools
   firebase login
   firebase deploy --only firestore:rules,hosting
   ```

The Firebase web app settings are public browser configuration. Never put service-account keys or private API keys in `NEXT_PUBLIC_*` variables or in the static client.

## Create the first Super Admin

Create and verify the initial administrator account in Firebase Authentication. In Firestore, create `users/{AUTH_UID}` with these fields:

```text
uid: AUTH_UID
email: admin email
name: administrator name
role: super_admin
```

Create this profile through the Firebase Console, which uses privileged project access. Public account creation is restricted to the `restaurant_admin` role by `firestore.rules`.

## Local development

```sh
npm ci
npm run dev
```

The static client supports account sign-in, restaurant settings, QR code requests and downloads, guest feedback, and a stamp-card flow. Email verification is handled by Firebase Authentication. The suggested review text is generated locally in the browser; AI API keys and other private server integrations cannot be used safely in a static client. Payment processing, scheduled expiry jobs, and the old server-only admin workflows are not part of this Firebase Spark build.

## Existing data

Switching from Neon/PostgreSQL to Firestore does not copy existing records or password hashes. Existing accounts and restaurant data need a separate migration and account-linking/password-reset process before using this build with production data. Keep the Neon database intact until that migration is planned and completed.

Firestore Spark includes daily free quotas. If a quota is exceeded, that product can be unavailable until its quota resets. See [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) and [Firestore quotas](https://firebase.google.com/docs/firestore/pricing).
