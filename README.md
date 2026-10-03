# ReviewFlow

Multi-tenant SaaS for restaurants: collect guest feedback with smart QR codes. Guests scan at tables, rate their overall visit, food, and service, optionally add a detail, then receive an editable AI-generated review draft to use if they choose to continue to Google.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · PostgreSQL (Neon / Supabase) · Prisma · Claude 3.5 Haiku · Vercel Cron

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
   - `ANTHROPIC_API_KEY` (for rating-based AI feedback suggestions; rule-based suggestions are used if omitted)
   - `SEED_ADMIN_EMAIL` & `SEED_ADMIN_PASSWORD` (for super admin account)
3. Apply the checked-in database migrations with `npx prisma migrate deploy`.
4. `npm run db:seed` (creates the Super Admin user)
5. `npm run dev` and navigate to `http://localhost:3000`

### Connect Google Business Profiles

To connect a restaurant from **Super Admin → Restaurants & Owners**:

1. In Google Cloud Console, enable the Google Business Profile Account Management
   and Business Information APIs, and create an OAuth client for a web application.
2. Add `http://localhost:3000/api/super-admin/google/callback` as an authorized
   redirect URI for local testing. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` in `.env`.
   Generate the encryption key with `openssl rand -hex 32`.
3. Start the app, sign in as Super Admin, and click **Connect Google** for a
   restaurant. Authorize using a Google account that can manage that restaurant's
   Business Profile, then choose the matching location in the admin table.
4. In production, set `GOOGLE_REDIRECT_URI` to the exact public HTTPS callback
   URL and register that same URL in Google Cloud Console. Add all four variables
   to the hosting service environment; never commit `.env` or OAuth secrets.
   Keep the token encryption key unchanged while connections are stored; changing
   it makes existing Google connections unreadable and they must be reauthorized.

Google may require Business Profile API access to be approved for the Cloud
project. This feature stores the association and encrypted refresh token; it
does not import reviews or post replies.

For UPI QR payments, set `UPI_VPA` to the receiving UPI ID and optionally set
`UPI_PAYEE_NAME` to the account name shown to customers. Add both variables to
the Render service environment as well. Approved QR requests then show a QR
with the request total prefilled; owners scan it with a UPI app and submit the
payment reference for admin verification.

### Render deployment

In the Render service environment, set `APP_URL` to the public HTTPS URL for your
service (for example, `https://your-service.onrender.com`). QR downloads and
dashboard links use this value to build `/r/<slug>` scan URLs. On Render,
`RENDER_EXTERNAL_URL` is also used as a fallback when `APP_URL` is not set.
Production QR generation fails rather than silently embedding a localhost URL
when neither public URL is configured.

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

- Daily cron job runs at `/api/cron/expire` (configured in `vercel.json`).
- Changes status: `ACTIVE` → `GRACE` (7 days) → `EXPIRED`.
- Scan routes dynamically calculate validity dates in real-time, ensuring customer scans are always accurate even before the cron runs.

---

## Google Compliance Built In

- **No Gating / Filtering:** Every rating tier gets the same Google Review link (strictly compliant with Google Review Guidelines).
- **Guest Control:** AI drafts review text from the guest's ratings and optional comments. Guests can edit or ignore the draft, and choose what to post on Google themselves.
- **Fair-use Protection:** Capped at 3,000 feedback submissions per QR per month to safeguard API usage.
