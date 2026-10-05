-- ============================================================================
-- Crystal Drinks — database upgrade for Neon SQL Editor  (adds migrations 003 + 004)
--
-- WHAT IT DOES
--   003: minimum investment per funding need, "fallback guarantor" bookkeeping, Google sign-in columns
--   004: testimonials table
--
-- SAFE TO RUN MORE THAN ONCE: every statement uses IF NOT EXISTS, nothing is dropped or rewritten,
-- no existing data is touched.
--
-- BEFORE YOU RUN IT
--   1. Make a safety copy: Neon console -> Branches -> Create branch (instant, free). Optional but wise.
--   2. Run the CHECK at the very bottom of this file first if you are unsure what you already have.
--      You need has_001 = true. If it says false, tell me — you need the first migrations instead.
--
-- HOW: open Neon -> SQL Editor -> paste this whole file -> Run.  Then push the new code to GitHub.
-- ============================================================================

-- ---------- 003 ----------
-- Per-need minimum investment, fallback guarantor bookkeeping, Google sign-in identity.
ALTER TABLE funding_needs ADD COLUMN IF NOT EXISTS min_investment NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (min_investment >= 0);

-- true when the guarantor share on an investment was credited to the fallback account (investor had no guarantor)
ALTER TABLE investments ADD COLUMN IF NOT EXISTS guarantor_is_fallback BOOLEAN NOT NULL DEFAULT false;

-- Email only ever comes from a Google-VERIFIED address (never typed in by a user), so it can't be used to hijack accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password BOOLEAN NOT NULL DEFAULT true; -- false for accounts created via Google
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;

-- ---------- 004 ----------
-- Customer testimonials. Only real, consenting customers; nothing is public until an admin approves it.
CREATE TABLE IF NOT EXISTS testimonials (
  id             SERIAL PRIMARY KEY,
  investor_id    INTEGER REFERENCES users(id),                       -- set for reviews written by the investor themselves
  source         TEXT NOT NULL CHECK (source IN ('INVESTOR','ADMIN_ENTERED')),
  display_name   TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  city           TEXT CHECK (city IS NULL OR char_length(city) <= 60),
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body           TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 600),
  consent_display BOOLEAN NOT NULL CHECK (consent_display),           -- cannot be stored without consent to show name + review publicly
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  admin_note     TEXT,                                                -- for ADMIN_ENTERED: how permission was given (required by the API)
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by    INTEGER REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  CONSTRAINT t_source_matches CHECK ((source = 'INVESTOR') = (investor_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_testimonial_investor ON testimonials (investor_id) WHERE investor_id IS NOT NULL;  -- one review per investor
CREATE INDEX IF NOT EXISTS ix_testimonials_status ON testimonials (status, created_at DESC);

-- Record these as applied (only matters if you ever use `npm run db:migrate` later; harmless otherwise).
CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO schema_migrations (name)
  SELECT n FROM (VALUES ('001_core_schema.sql'), ('002_legacy_import.sql')) AS v(n) WHERE to_regclass('public.funding_needs') IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations (name) VALUES ('003_min_investment_fallback_google.sql'), ('004_testimonials.sql') ON CONFLICT DO NOTHING;

-- ============================================================================
-- CHECK (run this on its own, before or after, to see where you stand)
-- All four should be true AFTER the upgrade. has_001 must be true BEFORE it.
-- ============================================================================
-- SELECT
--   to_regclass('public.funding_needs') IS NOT NULL AS has_001,
--   EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_needs' AND column_name = 'min_investment') AS has_min_investment,
--   EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_sub') AS has_google_columns,
--   to_regclass('public.testimonials') IS NOT NULL AS has_testimonials;
