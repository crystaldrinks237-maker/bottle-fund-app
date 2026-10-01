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
