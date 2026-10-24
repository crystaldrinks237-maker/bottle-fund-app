-- Reinvest option: an investor can leave the principal of a verified investment with the business for the next week
-- and receive only the profit ("commission"). Run once in the Neon SQL editor; safe to re-run.
ALTER TABLE investments ADD COLUMN IF NOT EXISTS reinvest_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS rolled_from_investment_id INTEGER REFERENCES investments(id);
-- portion of a payout that was rolled into a new investment instead of being paid out in cash
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reinvested_amount NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (reinvested_amount >= 0);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reinvested_into INTEGER REFERENCES investments(id);
CREATE INDEX IF NOT EXISTS ix_inv_rolled_from ON investments (rolled_from_investment_id) WHERE rolled_from_investment_id IS NOT NULL;
