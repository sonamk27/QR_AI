# ReviewFlow

Multi-tenant SaaS for restaurants: boost genuine Google reviews with smart QR codes. Guests scan at tables, rate their experience, get an AI-drafted review in their own voice, and post it to Google.

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
   - Views real-time scan analytics, guest ratings, feedback breakdown, and AI review drafts.
   - Owners cannot create or alter QR code validities directly.
5. **Renewal (`/super-admin`):**
   - Upon renewal payment, the Super Admin clicks **"Renew (+1 yr)"** on the QR row, logs the new payment UTR, and validity extends by 365 days. The printed physical QR never changes.

---

## Roles & Areas

| Role | Area | Description |
|---|---|---|
| **Guest (no login)** | `/r/[slug]` | Customer scans QR at the table, submits rating and tags, receives AI review draft to copy & post to Google. |
| **ADMIN (Restaurant Owner)** | `/dashboard` | View feedback, ratings breakdown, AI review drafts, and download high-res QR codes. |
| **SUPER_ADMIN (Platform Owner)** | `/super-admin` | Full control: onboard restaurants, create & activate 365-day QRs, log direct payments, renew, suspend, enable/disable QRs, and share credentials. |

---

## Setup & Running Locally

1. `npm install`
2. Create a Postgres database (Neon or Supabase). Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` (pooled) and `DIRECT_URL` (direct)
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `ANTHROPIC_API_KEY` (for AI review draft generation)
   - `SEED_ADMIN_EMAIL` & `SEED_ADMIN_PASSWORD` (for super admin account)
3. Apply the checked-in database migrations with `npx prisma migrate deploy`.
4. `npm run db:seed` (creates the Super Admin user)
5. `npm run dev` and navigate to `http://localhost:3000`

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
- **Guest Control:** AI generates a draft based exclusively on guest-selected chips and feedback; the guest edits and posts from their own Google account.
- **Fair-use Protection:** Capped at 3,000 AI draft generations per QR per month to safeguard API usage.
