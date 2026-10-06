-- Referral links: every user has a personal code; anyone who signs up with it gets that person as guarantor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
UPDATE users SET referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) WHERE referral_code IS NULL;
ALTER TABLE users ALTER COLUMN referral_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));  -- any insert path gets a code
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_referral_code ON users (referral_code);
-- Everyone who can invest can also be a guarantor (by sharing their link).
UPDATE users SET roles = array_append(roles, 'GUARANTOR') WHERE 'INVESTOR' = ANY(roles) AND NOT ('GUARANTOR' = ANY(roles));
