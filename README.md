# ReviewFlow

Multi-tenant SaaS for restaurants: collect guest feedback with smart QR codes. Guests scan at tables, rate their overall visit, food, and service, optionally add a detail, then receive an editable AI-generated review draft to use if they choose to continue to Google.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · PostgreSQL (Neon / Supabase) · Prisma · Render Web Service

---

## Direct Activation Workflow (No Gateway Middlemen)

1. **Lead & Sales:** A sales rep or you visit a restaurant and collect details (Restaurant Name, City, Owner Name & Email, Google Review link, Referred By).
2. **Direct Payment:** The restaurant owner transfers payment directly to you via UPI or bank transfer (no platform transaction fees, no payout delays, no seller cash-handling).
3. **Super Admin Setup (`/super-admin`):**
   - Click **"+ Add Restaurant & Owner"**: Creates the restaurant and owner account with a secure temporary password. Copy the pre-formatted WhatsApp onboarding message in one click.
   - Click **"+ Create & Activate QR"**: Select the restaurant, specify the placement (e.g. Table 1, Billing Counter), and record the payment (Amount, Method: UPI / Bank / Cash, UTR / Reference).
   - This immediately activates the QR code for **365 days** and issues an auto-incrementing invoice number (`RF-2026-00001`).
4. **Owner Experience (`/dashboard`):**
   - Owner logs in with their credentials.
   - Downloads high-resolution print-ready files (**PNG** and vector **SVG**).
   - Views real-time scan analytics, guest ratings, and selected feedback suggestions.
   - Owners cannot create or alter QR code validities directly.
5. **Renewal (`/super-admin`):**
   - Upon renewal payment, the Super Admin clicks **"Renew (+1 yr)"** on the QR row, logs the new payment UTR, and validity extends by 365 days. The printed physical QR never changes.

---

## Roles & Areas

| Role | Area | Description |
|---|---|---|
| **Guest (no login)** | `/r/[slug]` | Customer scans the QR, rates the overall visit, food, and service, optionally adds a comment, and receives an editable AI review draft before choosing whether to continue to Google. |
| **ADMIN (Restaurant Owner)** | `/dashboard` | View feedback, ratings breakdown, and download high-res QR codes. |
| **SUPER_ADMIN (Platform Owner)** | `/super-admin` | Full control: onboard restaurants, create & activate 365-day QRs, log direct payments, renew, suspend, enable/disable QRs, and share credentials. |

---

## Setup & Running Locally

1. `npm install`
2. Create a Postgres database (Neon or Supabase). Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` (pooled) and `DIRECT_URL` (direct)
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - Firebase web app settings (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`) for Google sign-in
   - `ANTHROPIC_API_KEY` (for rating-based AI feedback suggestions; rule-based suggestions are used if omitted)
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and optional `SEED_ADMIN_PHONE` (for the super admin account)
   - `RESEND_API_KEY` and `EMAIL_FROM` (required to deliver new account email verification links)
3. Apply the checked-in database migrations with `npx prisma migrate deploy`.
4. `npm run db:seed` (creates the Super Admin user)
5. `npm run dev` and navigate to `http://localhost:3000`

### Google sign-in

Create a Firebase project and register a web app, then enable the Google provider
under **Authentication → Sign-in method**. Add the web app settings listed above
to `.env` and configure the app's authorized domains in Firebase Authentication.
Google sign-in is available for restaurant admins on the login and signup pages;
Super Admin accounts continue to use password sign-in. Firebase ID tokens are
verified by the server before a ReviewFlow session is created.
Password sign-up and email changes require verification through a one-time email
link before the account can sign in. Configure Resend with a verified sender in
`EMAIL_FROM` so those links can be delivered.
Only Firebase web app configuration is used by the browser; do not put any
Firebase service-account or other private server credentials in `NEXT_PUBLIC_*`
variables.

### Google Business Profile URL

The initial version does not connect to or retrieve data from Google Business
Profile. The restaurant owner pastes a public Maps or Business Profile URL into
**Dashboard → Profile**; the app validates the URL format locally and saves it
to the existing restaurant record. Super Admin can review and open the submitted
URL from **Restaurants & Owners**. No Google Cloud OAuth credentials, Business
Profile API access, or Google API key is used for this workflow.

```text
Firebase Authentication
    ↓
Restaurant Owner Login
    ↓
Restaurant Dashboard
    ↓
Manually enter Google Business Profile URL
    ↓
Save URL in database
    ↓
Super Admin reviews URL
    ↓
Existing QR/payment workflow
```

For UPI QR payments, set `UPI_VPA` to the receiving UPI ID and optionally set
`UPI_PAYEE_NAME` to the account name shown to customers. Approved QR requests then show a QR
with the request total prefilled; owners scan it with a UPI app and submit the
payment reference for admin verification.

### Render deployment

Deploy this project as a Render **Web Service**, not as a Static Site. It uses
Next.js server routes, middleware, and authenticated dashboards. The checked-in
`render.yaml` defines the Node service, build and start commands, health check,
and environment-variable names. Connect the GitHub repository
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
