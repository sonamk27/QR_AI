# ReviewFlow

Multi-tenant restaurant feedback and loyalty app. Guests scan a QR code, rate their visit, and receive an editable review draft they can choose to use on Google.

**Current stack:** TypeScript · React · Vite · Tailwind CSS · Firebase Authentication · Cloud Firestore · Firebase Hosting (Spark)

The Next.js/PostgreSQL app is retained only as a migration source and rollback
until the Firebase data migration is complete.

---

## Main Workflows

1. **Account setup:** A restaurant owner signs up with Firebase Authentication. The app creates the owner's Firestore profile and restaurant record, then asks the owner to verify their email.
2. **QR request:** The owner submits a request from `/dashboard/qr-requests`. The QR remains locked while the Super Admin reviews it.
3. **Payment:** After approval, the owner scans the amount-prefilled UPI QR and submits the UTR or bank reference. The Super Admin verifies the payment and activates the QR for 365 days.
4. **Guest experience:** Guests scan the restaurant QR, submit ratings, create an editable review draft, and can use the restaurant's loyalty program. Guest sessions use Firebase Anonymous Authentication.
5. **Management:** Owners manage restaurant settings, QR activity, feedback, loyalty, and payment history. Super Admins manage requests, users, restaurants, QR status, payments, and audit entries.

---

## Roles & Areas

| Role | Area | Description |
|---|---|---|
| **Guest (anonymous Firebase session)** | `/r/[slug]` | Guest scans the QR, rates the visit, receives an editable review draft, and can use the restaurant's loyalty program. |
| **ADMIN (Restaurant Owner)** | `/dashboard` | View feedback, ratings breakdown, and download high-res QR codes. |
| **SUPER_ADMIN (Platform Owner)** | `/super-admin` | Manage users and restaurants, review QR requests, verify payments, activate or disable QR codes, and review audit entries. |

---

## Setup & Running Locally

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and set the Firebase web app values plus `VITE_UPI_VPA`, `VITE_UPI_PAYEE_NAME`, and `VITE_QR_PRICE_PAISE`.
3. In Firebase, enable **Email/Password**, **Google**, and **Anonymous** Authentication. Create a Cloud Firestore database and add your local/Hosting domains to Authentication's authorized domains.
4. Run `npm run dev` and open the URL printed by Vite (usually `http://localhost:5173`).

To run against local Firebase emulators, set `VITE_FIREBASE_EMULATORS="true"` in
`.env.local`, start `firebase emulators:start --only auth,firestore` in one
terminal, then run `npm run dev` in another. The checked-in `firebase.json`
declares the Auth and Firestore emulator ports. Leave this setting `false` for
Firebase Hosting builds so the app connects to the configured Firebase project.

For a new Firebase project, bootstrap its first Super Admin with the one-time
script described in the Firebase deployment section below. Existing PostgreSQL
users need Firebase Auth accounts; their old password hashes are not imported,
so they set a Firebase password through the password reset flow.

### Google Business Profile URL

The app does not retrieve data from Google Business Profile. The owner pastes a
public Maps or Business Profile URL into **Dashboard → Profile**; the app
validates the URL format locally and saves it to the restaurant's Firestore
document. Super Admin can review it from **Restaurants & Owners**. No Google
Cloud OAuth credentials, Business Profile API access, or Google API key is used.

```text
Firebase Authentication
    ↓
Restaurant Owner Login
    ↓
Restaurant Dashboard
    ↓
Manually enter Google Business Profile URL
    ↓
Save URL in Firestore
    ↓
Super Admin reviews URL
    ↓
Firebase QR and payment workflow
```

For UPI QR payments, set `UPI_VPA` and `UPI_PAYEE_NAME` for the legacy Next.js
app. The Firebase SPA uses the public client settings `VITE_UPI_VPA`,
`VITE_UPI_PAYEE_NAME`, and `VITE_QR_PRICE_PAISE` (amounts are in paise). Its
approved QR requests show the matching payment QR; owners submit the UTR or
payment reference for Super Admin verification. Keep the client price value in
sync with the amount the administrator verifies.

### Legacy Render deployment (Next.js/PostgreSQL only)

Deploy this project as a Render **Web Service**, not as a Static Site. It uses
Next.js server routes, middleware, and authenticated dashboards. The checked-in
`render.yaml` defines the Node service, build and start commands, health check,
and environment-variable names. It uses the explicitly named `build:next` and
`start:next` scripts so the Render service remains the legacy deployment.
Connect the GitHub repository
`sonamk27/QR_AI` and deploy the `main` branch.

Set `DATABASE_URL`, `DIRECT_URL`, and a strong `AUTH_SECRET` in the Render
environment. Add the Firebase web app values for Google sign-in, plus
`RESEND_API_KEY` and `EMAIL_FROM` for verification email. Optional features use
`ANTHROPIC_API_KEY`, `CRON_SECRET`, and `UPI_VPA`. Never commit secret values to
this repository or expose them through `NEXT_PUBLIC_*` variables.

Render provides `RENDER_EXTERNAL_URL`; the app uses it for public QR and email
links when `APP_URL` is not set. You can set `APP_URL` to the service's public
HTTPS URL if you prefer.

Render's Free Web Services sleep after 15 minutes without traffic and can take
about a minute to wake on the next request. Free service hours and bandwidth
also have monthly limits. See [Render's free service details](https://render.com/docs/free).

### Firebase Hosting deployment (primary app)

The TypeScript React SPA is built from `firebase-spa/`.
It preserves the current Tailwind screens and uses Firebase Authentication and
Cloud Firestore for the dashboard, QR, guest review, loyalty, payment-record,
and Super Admin workflows. Its Hosting build has no Next.js server or API route
runtime. Configure the Firebase web app values from `.env.example` in
`.env.local`, enable Email/Password, Google, and Anonymous providers in Firebase
Authentication, then add the Hosting domain to Authentication's authorized
domains. The anonymous provider is used for guest QR feedback. Set the
`VITE_UPI_*` and `VITE_QR_PRICE_PAISE` values in `.env.local` if you want the
SPA to generate amount-prefilled UPI payment QRs.

For a fresh Firebase project, enable the Spark plan, create the default Cloud
Firestore database, and select the project locally. Then build and deploy the
SPA plus its access rules and indexes:

```sh
firebase login
firebase use --add
npm run build:firebase
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

The default `npm run dev` and `npm run build` commands target this React SPA.
The separate legacy Next.js build remains available through `dev:next`,
`build:next`, and `start:next` while existing PostgreSQL data is migrated.

For Firebase Hosting, set `VITE_SITE_URL` to the canonical HTTPS origin of the
custom domain before building (for example, in the deployment environment).
When it is omitted, the SEO asset generator uses the Firebase `*.web.app`
origin if `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is configured. The build emits
`robots.txt` and an absolute-URL `sitemap.xml`; canonical metadata uses the
configured origin or the current browser origin. Add the custom domain to
Firebase Hosting and Firebase Authentication's authorized domains separately.

Firebase Analytics is initialized only after a visitor accepts optional
analytics in the consent banner. Configure
`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` with the Firebase web app's measurement
ID to enable it; this ID is public client configuration, not a secret.
Optionally configure `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` with a public reCAPTCHA
v3 site key registered for the Firebase app to enable Firebase App Check.
App Check enforcement must also be enabled in the Firebase console after the
site key is registered. Never put a reCAPTCHA secret key, service account,
database credential, or server API key in a `VITE_*` or `NEXT_PUBLIC_*` value.
The Firebase dev/build lifecycle generates a compressed PNG logo and a
1200×630 PNG social preview from their SVG sources. Payment QR artwork is
intentionally left untouched so scan reliability is preserved.

The Firebase web app settings are public client configuration; the service
account JSON is private and is only used by local migration/bootstrap scripts.
Do not set up Functions or Firebase Storage for this Spark deployment.

Build with `npm run build:firebase`. Firebase Hosting serves `firebase-spa/dist`
and rewrites routes to the SPA entry point. The SPA currently uses Firestore for
owner dashboards and settings, guest review/loyalty, QR requests, payments and
the Super Admin QR, restaurant, user, and audit pages. The Next.js/Render app
remains a separate legacy build; Firebase Hosting serves only the React SPA.
Firestore rules and Hosting have not been live-validated until deployed to a
Firebase project.

Cloud Storage for Firebase requires a Blaze billing account, even when usage
would otherwise fit a no-cost storage allowance. This project currently has no
Firebase Storage integration, so keep bundled public assets in `public/` and
avoid adding Firebase Storage while remaining strictly on Spark. Business
profile logo uploads are resized to WebP and stored inline in Firestore with a
strict size limit. See [Cloud Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

The legacy app still uses PostgreSQL/Prisma; its data can be copied with the
one-time migration script
after setting `FIREBASE_SERVICE_ACCOUNT_JSON` locally and confirming the Firebase
project ID. Preview the document counts first with `npm run migrate:firestore`,
then execute with `npm run migrate:firestore -- --execute`. The script keeps
each run below an 18,000-write safety budget. For larger projects, select groups
of Firestore collection names with `--collections=users,restaurants,qrCodes,loyaltyPrograms`
and run the next group on a later day. If one collection alone exceeds the
budget, paginate it with `--collections=scans --limit=15000`, then use the
printed `--after-id` cursor on the next run. Keep the full import under the
daily Firestore Spark write quota; partial runs use merge writes and are safe to
resume from the reported cursor.
The `restaurants` collection import also creates safe `publicRestaurants`
documents for guest-visible details; full restaurant records remain private to
the owner and Super Admin. The `qrCodes` import creates slug-keyed
`publicQrPages` documents for active QR codes. If either derived collection was
added after its source records were migrated, rerun the corresponding
`restaurants` or `qrCodes` migration in manageable batches before switching the
Hosting site over. Import `restaurants` and `loyaltyPrograms` together to seed a
default loyalty program for any restaurant that did not previously have one;
the migration checks for existing Firestore programs before creating defaults.
PostgreSQL password hashes and old one-time email tokens are deliberately not
copied; migrated password users must use Firebase's password reset flow. Keep
the database variables configured until all app features have moved to Firestore.
Legacy anonymous loyalty customers are imported as restaurant-owned history.
The PostgreSQL schema does not link them to Firebase guest accounts, so their
old guest sessions are not imported and guests cannot reclaim those records
automatically. New guest visits use Firebase Anonymous Authentication.

For a new Firebase project with no migrated users, create the first Super Admin
with `FIREBASE_SUPER_ADMIN_EMAIL`, `FIREBASE_SUPER_ADMIN_NAME`, and the local
service-account JSON configured in `.env.local`. Preview first with
`npm run bootstrap:firebase-admin`, then explicitly create it with
`npm run bootstrap:firebase-admin -- --execute`. The account is created with
email verification already completed but without a password; use **Forgot
password** to set one before signing in. The command refuses to run if a Super Admin already exists or if
the chosen email already belongs to a Firebase Auth user.

To link an existing Firebase Authentication account when its Firestore profile
is missing, set `FIREBASE_SUPER_ADMIN_EMAIL`, `FIREBASE_SUPER_ADMIN_NAME`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_FILE` to the
local service-account JSON file path. Run `npm run link:firebase-super-admin`
to preview the exact UID and profile path. Apply only after checking the email
and UID with `npm run link:firebase-super-admin -- --execute --confirm-email
<email>`. The script never creates or changes Firebase Authentication accounts
and refuses to overwrite any existing Firestore profile.

For an existing database that already has the legacy schema but no Prisma migration
history, mark the matching baseline as applied once, then deploy the remaining
migrations:

```sh
npx prisma migrate resolve --applied 20261001000000_legacy_baseline
npx prisma migrate deploy
```

Use the direct, non-pooled `DIRECT_URL` for migrations. Review and test migrations
against a database branch before applying them to production.

---

## Expiry & Cron

- Schedule a daily job to call `/api/cron/expire` with
  `Authorization: Bearer <CRON_SECRET>` using an external scheduler. Render's
  free Web Service does not run scheduled jobs.
- Changes status: `ACTIVE` → `GRACE` (7 days) → `EXPIRED`.
- Scan routes dynamically calculate validity dates in real-time, ensuring customer scans are always accurate even before the cron runs.

---

## Google Compliance Built In

- **No Gating / Filtering:** Every rating tier gets the same Google Review link (strictly compliant with Google Review Guidelines).
- **Guest Control:** AI drafts review text from the guest's ratings and optional comments. Guests can edit or ignore the draft, and choose what to post on Google themselves.
- **Fair-use Protection:** Capped at 3,000 feedback submissions per QR per month to safeguard API usage.
