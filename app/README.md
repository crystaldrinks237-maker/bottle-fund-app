# Crystal Drinks — Funding Management Platform

Next.js 14 · NextAuth · Neon PostgreSQL · deployed on Vercel. See **IMPLEMENTATION.md** for the full change summary.

## Setup
```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
npm run db:migrate                # applies ./migrations (safe on a fresh DB or the old prototype DB)
ADMIN_USERNAME=admin ADMIN_PASSWORD='a-long-password' npm run db:bootstrap-admin
npm run dev
```
Tests: with a server running, `DATABASE_URL=… BASE=http://localhost:3000 node scripts/e2e.mjs` (use a scratch database — it creates data and time-travels timestamps).

## Layout
`migrations/` SQL schema · `lib/calc.ts` + `lib/money.ts` all money maths (BigInt, no floats) · `lib/services/*` business logic & transactions · `app/api/*` thin REST handlers · `components/ui` reusable kit · `components/domain` feature components.
