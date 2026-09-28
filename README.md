# Weekly Bottle Fund

A real, hosted version of the investment portal: accounts, Neon Postgres,
an admin panel, payment-screenshot verification, and a 7-day payout countdown.

## 1. Create a Neon database
1. Go to https://neon.tech, sign up (free tier is fine), create a project.
2. Copy the pooled connection string it gives you.
3. In the Neon SQL editor, paste and run the contents of `schema.sql`.

## 2. Configure environment variables
Copy `.env.example` to `.env.local` and fill in:
- `DATABASE_URL` - the Neon connection string from step 1
- `NEXTAUTH_SECRET` - any long random string (e.g. run `openssl rand -base64 32`)
- `NEXTAUTH_URL` - `http://localhost:3000` while testing locally
- `FIRST_ADMIN_USERNAME` - optional; the very first person to sign up is made
  admin automatically, so you can leave this blank and just sign up first.

## 3. Run it locally
```
npm install
npm run dev
```
Visit http://localhost:3000, sign up (you'll become admin as the first user),
then post a week from /admin.

## 4. Deploy for real (Vercel)
1. Push this folder to a GitHub repo.
2. Import it at https://vercel.com/new.
3. Add the same environment variables in the Vercel project settings
   (set `NEXTAUTH_URL` to your real Vercel URL once you have it).
4. Deploy. Share the URL with your brother and your friends.

## How the pieces map to what you asked for
- **Accounts / usernames** - real signup + login (`/signup`, `/login`), password
  hashed with bcrypt, stored in the `users` table.
- **Admin panel, separate** - `/admin`, gated by `role = 'admin'` both in the
  page and in every admin API route, plus `middleware.ts` blocking unauthenticated
  access at the route level.
- **What we owe, to whom, today** - the "Owed today / overdue" list on the admin
  page is any verified investment whose `due_date` has passed and hasn't been
  marked paid yet.
- **Guarantor paid monthly** - `/api/admin/guarantor-summary` sums, per referrer,
  every verified investment's guarantor cut for the current calendar month.
  Use the `guarantor_payouts` table to record once you've actually paid them.
- **Countdown starts on verification** - the moment admin clicks "Verify payment
  received," the API stamps `verified_at = now()` and `due_date = now() + 7 days`
  in the same database write. Nothing needs to be scheduled separately.
- **Multiple weeks at once** - `weeks` is just a table of rows; posting a second
  quality/type two days later is simply another row with `status = 'open'`.

## Still to add (not in this scaffold)
- **Notifications** - no WhatsApp/SMS is wired up yet. The `users.phone` column
  is there and ready; the natural next step is a small function in the `POST
  /api/weeks` route that loops over registered phone numbers and sends a
  WhatsApp Cloud API or Twilio message when a new week goes live.
- **Screenshot storage** - proofs are stored as base64 text directly in Postgres
  for simplicity. Fine at friends-and-family scale; if it grows, swap
  `proof_data` for a URL pointing at Vercel Blob or Cloudflare R2 instead.
