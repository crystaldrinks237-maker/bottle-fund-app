# Implementation summary

## What was wrong with the prototype (Phase 2)
`weeks` table assumed one opportunity per week; `verified`/`returned` booleans instead of a lifecycle; referrer was free text; payment screenshots were base64 in the DB; `GET /api/weeks/[id]/investments` was readable without proper ownership checks; first signup became admin; remaining-capital was a read-then-write race; money used JS floats; Next 14.2.5 predates the middleware-bypass fix (now ^14.2.25, and no route relies on middleware alone).

## What was built
Everything in the brief is implemented against PostgreSQL: Funding Needs (any number open at once), Payment Accounts with per-need assignment, priority and total/daily limits, investment flow with account + terms snapshots, verification queue, exact 168-hour payout cycle, investor payouts with transaction IDs, guarantor relationships + monthly settlements, payment claims (guarantor **and** investor), internal notifications, audit log, admin overview with an attention panel, CSV exports, settings.

## Database (`migrations/001`, `002`)
New: `funding_needs`, `payment_accounts`, `funding_need_accounts`, `investments`, `payment_proofs`, `payouts`, `guarantor_relationships`, `guarantor_payments`, `guarantor_payment_items`, `payment_claims`, `notifications`, `audit_logs`, `settings`, `schema_migrations`. `users` is extended in place (roles[], is_active, lockout fields, payout destination). Money is `NUMERIC(…,2)`, percentages `NUMERIC(5,2)`, all times `timestamptz`.
Integrity enforced by the database, not just code: `CHECK (due_at = verified_at + interval '168 hours')`, funded ≤ capital, allocated ≤ account limit, one guarantor per investor, one live claim per payment, one settlement per guarantor-month, each guarantor earning linked to exactly one settlement, unique idempotency key per investor.

## How the tricky requirements work
- **7 days**: `verified_at = now()` and `due_at = now() + interval '168 hours'` in one SQL statement (hours, so DST/timezone can't shift it). Status `PAYOUT_DUE` is *derived* from `due_at <= now()` in every query; a lazy, idempotent "materialise" step flips the stored status and sends notifications once. No cron. The browser timer only renders, calibrated against the server's `now()`.
- **Race safety**: submissions run in one transaction that locks the funding need row, then the candidate accounts in id order (`FOR UPDATE`), re-checks limits, then writes. Verify/pay/resolve use row locks + status checks so a second admin gets a clean 409.
- **No silent account switch**: the investor is shown account A; submit is bound to A and refuses (with refreshed instructions) if A stopped being eligible, rather than assigning B after they already paid A.
- **Snapshots**: payment-account details and pricing inputs are copied onto the investment at submission; expected profit/return/guarantor/business amounts are frozen at verification. Pricing edits are refused once a need has investments.
- **Security**: bcrypt(12), 12h JWT carrying only the user id — roles/active flag re-read from the DB on every request; role checks in every API route and layout; ownership returns 404 (not 403); signup schema has no role field; login lock after 5 failures (15 min); server-side zod validation; file type checked by magic bytes; proofs served only through an authenticated route; CSV formula-injection guarded; security headers.
- **Money**: `lib/money.ts`/`lib/calc.ts` use BigInt paise and basis points; admin form previews and investor quotes come from server endpoints, so UI and backend cannot disagree.

## Verified
`npm run build` succeeds. `scripts/e2e.mjs` runs **122 checks** against real PostgreSQL 16 through the running production server, covering your scenarios 1–33 (including 6 simultaneous submissions vs. a 100,000 account → exactly 3 succeed; double-verify; double-pay; double-claim; time-travelled payouts). The legacy migration was run against a prototype-shaped database (roles, referrers→guarantors, proofs, payouts, frozen figures).

## Not verified / be aware
- **Mobile layout and visual polish were not checked in a real browser** (no browser in my environment). The CSS is responsive by design (drawer nav, stacked table rows ≤720px) but please look at it on a phone.
- The Neon serverless driver path (`@neondatabase/serverless` Pool over WebSocket) could not be exercised here; I tested the same code through `pg` on local Postgres. Both share the same `query/connect` API, but do a smoke test on Vercel.
- Proofs are stored in Postgres (`bytea`, separate table) rather than Vercel Blob: that keeps them private behind auth with zero new env vars. Swap `getProofFile`/the insert in `lib/services/investments.ts` if you later want object storage.

## New routes
Pages: `/login /signup`; investor `/dashboard /investments(/[id]) /funding-needs(/[id]) /payouts /profile`; guarantor `/guarantor /guarantor/payments`; admin `/admin`, `/admin/{funding-needs(/[id]),investments(/[id]),payment-accounts,investors,guarantors,payouts,guarantor-payments,claims,activity,settings}`; `/notifications`.
API: `/api/funding-needs[/id|/id/status|/id/accounts|/id/quote|/id/investments|/preview]`, `/api/payment-accounts[/id|/id/status]`, `/api/investments[/id|/id/verify|/id/reject]`, `/api/proofs/[id]`, `/api/payouts[/id]`, `/api/guarantors[/id/payments]`, `/api/guarantor/dashboard`, `/api/guarantor-payments[/id]`, `/api/payment-claims[/id]`, `/api/admin/{overview,investors,investors/[id]/guarantor,audit-logs,settings}`, `/api/me[/password|/dashboard]`, `/api/notifications`, `/api/signup`. Old `/api/weeks*` routes are removed.

## Roles
`ADMIN`, `INVESTOR`, `GUARANTOR` (a user can hold several). Public signup creates INVESTORs only. Admins/guarantors are created via the script or by an admin.

## Environment variables
Required (unchanged): `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Optional: `NEXT_PUBLIC_APP_TIMEZONE` (display/month bucketing, default `Asia/Karachi`), `ALLOW_SIGNUP=false` to close signup. Script-only: `ADMIN_USERNAME`, `ADMIN_PASSWORD`. No new services needed.

## Migration instructions (existing production DB)
1. **Back up the Neon database** (branch it in Neon — instant).
2. Test on the branch: `DATABASE_URL=<branch url> npm run db:migrate`.
3. Production: `DATABASE_URL=<prod url> npm run db:migrate`. Old tables are *renamed* `legacy_weeks / legacy_investments / legacy_guarantor_payouts` and copied into the new model, never dropped; existing users and password hashes keep working (old `users.role` is mapped into `roles`). Each migration runs in a transaction and rolls back on error.
4. Promote your admin: `ADMIN_USERNAME=<your existing username> ADMIN_PASSWORD=<anything ≥10 chars> npm run db:bootstrap-admin` (an existing user is promoted; password unchanged).
5. Deploy. In Vercel confirm the three required env vars (NEXTAUTH_URL = your production URL). Migrations are deliberately **not** run in the Vercel build.
Imported data notes: weeks become funding needs titled "Week #N – quality"; imported payouts marked returned have no transaction ID; referrers who had no account remain as text (`legacy_referrer_username`) — create them as guarantors and use Admin → Investors → Set guarantor going forward.

## Decisions you confirmed (now implemented)
- **No-guarantor share → you.** Admin → Settings → *Fallback guarantor*. When an investment is verified and the investor has no guarantor, the guarantor share is credited to the chosen account (your admin account gets the Guarantor role automatically so you see a "Guarantor" menu with earnings, monthly payments and claims). It uses the normal settlement flow, is marked "fallback share" on the investment, and only applies to investments verified *after* you set it. Choose "None" to send the share back to business profit. Investments verified before you turn it on are not changed.
- **Guarantor earning month**: verification date; unsettled earnings roll into the next settlement (tested).
- **Overdue** = 24h past due. **Payout destination** fields on profiles.
- **Minimum investment** is set per funding need (New/Edit funding need form). The final remaining slice of a need may be smaller than the minimum so a need can always be filled. Editable even after investments exist.

## Google sign-in
Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel (Google Cloud Console → Credentials → OAuth client, type Web; authorised redirect URI `https://<your-domain>/api/auth/callback/google`). The Google buttons appear automatically once both are set; without them nothing changes.
Security design: Google email must be verified by Google; email is stored only from Google (never typed in); an existing password account is **never** linked automatically by matching email — the owner signs in with their password and clicks *Connect Google* in Profile (a signed 10-minute intent cookie ties the link to them). New Google users become INVESTORs only; admins/guarantors link Google themselves after being created. Google-created accounts have no password until they set one in Profile (they can't disconnect Google before that). `ALLOW_SIGNUP=false` also blocks Google sign-ups.
Note: the Google OAuth round-trip itself can't be tested without real credentials; the account-resolution rules are tested (`npx tsx scripts/google-test.ts`), but please try one real sign-in and one "Connect Google" after configuring it.

## Still to do later
- **Two-step verification** (planned for when the domain/email exist). Until then, give admin accounts a long unique password; once you connect Google to the admin account, Google's own 2-step verification protects that sign-in path too (but the password path stays open — don't skip real 2FA).
- Email notifications/password reset need a sender domain too.

## Migration addendum
New migration `003_min_investment_fallback_google.sql` (adds `funding_needs.min_investment`, `investments.guarantor_is_fallback`, `users.email/google_sub/has_password`). `npm run db:migrate` applies 001–003 in order.

## Welcome page & calculator
`/` is now the public welcome page (signed-in users are redirected to their dashboard; `/login` and `/signup` are unchanged). It has a live profit calculator, how-it-works, the currently open funding needs, a guarantor section, FAQ and sign-up calls to action. The calculator calls `GET /api/public/calculator`, which uses the same `lib/calc.ts` as real investments and returns only profit shares and results — never cost, sell price, operating cost or the business share. Drafts are never public. Optional env: `NEXT_PUBLIC_CONTACT_WHATSAPP` / `NEXT_PUBLIC_CONTACT_EMAIL` add an "ask us to make me a guarantor" button.

## Testing
`scripts/e2e.mjs` (API, 182 checks incl. a sweep that opens every admin list/detail endpoint), `scripts/google-test.ts`, and `scripts/browser-smoke.py` (Playwright: loads every page as admin/investor/guarantor, desktop + mobile, failing on console errors, error screens or mobile overflow).

## Testimonials (real customers only)
New migration `004_testimonials.sql`. Investors who have received a payout see a "Write a review" card on their dashboard (stars + text + the name/city they choose + a consent tick-box; the database refuses a testimonial without consent). Every review is **pending until an admin approves it** (Admin → Testimonials); editing a published review sends it back to pending. Admins can also add a testimonial for a real customer who agreed to be quoted — a consent confirmation and a "how did they give permission" note are mandatory and go to the audit log. The welcome page shows the section **only when approved reviews exist** (no placeholders), shows an average once there are ≥3, and marks only investor-written reviews "Verified investor" (they have been paid out). Public output exposes only name, city, rating and text. Do not seed invented reviews: fabricated testimonials mislead visitors and can breach consumer-protection and advertising rules. Claims such as "halal" in a customer's words are statements about your business — publish only if you can support them (get a written Shariah opinion).

## Admin "View as user" (read-only)
Admin → Investors / Guarantors → **View as**. Opens the app exactly as that user sees it for up to 30 minutes. Rules (all tested): admins only; never another admin or yourself; **strictly read-only** (every non-GET request is refused with `VIEW_ONLY`, so nothing — investments, profile, password, even "mark notifications read" — can change); a yellow banner with an **Exit view** button is shown on every page; admin screens/APIs are closed while viewing; the signed cookie is bound to the admin it was issued to, so copying or forging it does nothing; start and end are recorded in the activity log under the real admin. Code: `lib/session.ts` (`getRealUser`, `requireRealUser`, `makeViewAsCookie`, `VIEW_AS_COOKIE`, `VIEW_AS_TTL_SECONDS`), `app/api/admin/impersonate/route.ts`, guard in `lib/api.ts`.
