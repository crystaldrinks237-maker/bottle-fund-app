-- ============================================================================
-- Crystal Drinks — database upgrade for Neon SQL Editor  (migration 005: referral links)
--
-- WHAT IT DOES
--   * gives EVERY user a personal referral code (existing users get one now; new users get one automatically)
--   * lets every investor also act as a guarantor (adds the guarantor role to everyone who can invest)
--
-- SAFE TO RUN MORE THAN ONCE. Nothing is dropped; no money, investment or payout data is touched.
-- Requires the earlier upgrade (003/004) to have been run already.
--
-- HOW: Neon -> SQL Editor -> paste this whole file -> Run.  (Optional: make a Neon branch first as a backup.)
-- THEN: in Vercel -> Settings -> Environment Variables add   DEFAULT_GUARANTOR_USERNAME = <your admin username>
--       and redeploy. That account becomes guarantor of everyone who joins without a referral link.
-- ============================================================================

-- Referral links: every user has a personal code; anyone who signs up with it gets that person as guarantor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
UPDATE users SET referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) WHERE referral_code IS NULL;
ALTER TABLE users ALTER COLUMN referral_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));  -- any insert path gets a code
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_referral_code ON users (referral_code);
-- Everyone who can invest can also be a guarantor (by sharing their link).
UPDATE users SET roles = array_append(roles, 'GUARANTOR') WHERE 'INVESTOR' = ANY(roles) AND NOT ('GUARANTOR' = ANY(roles));

CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO schema_migrations (name) VALUES ('005_referrals.sql') ON CONFLICT DO NOTHING;

-- CHECK (run on its own afterwards): every user should have a code, and both numbers should match.
-- SELECT count(*) AS users, count(referral_code) AS with_code, count(DISTINCT referral_code) AS distinct_codes FROM users;
