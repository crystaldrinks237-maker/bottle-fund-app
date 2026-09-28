-- Run this once against your Neon database (Neon SQL editor, or `psql $DATABASE_URL -f schema.sql`)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'investor', -- 'investor' | 'admin'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weeks (
  id SERIAL PRIMARY KEY,
  quality TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL,      -- what's paid to buy the empty bottles (what investors fund)
  sell_price NUMERIC NOT NULL,
  op_cost NUMERIC NOT NULL,         -- production (filling/capping/labeling/packing) + delivery, per bottle
  investor_pct NUMERIC NOT NULL DEFAULT 0,   -- % of distributable profit to investors
  guarantor_pct NUMERIC NOT NULL DEFAULT 0,  -- % of distributable profit to guarantors
  status TEXT NOT NULL DEFAULT 'open',       -- 'open' | 'closed'
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  week_id INTEGER REFERENCES weeks(id) ON DELETE CASCADE,
  investor_id INTEGER REFERENCES users(id),
  amount NUMERIC NOT NULL,
  referrer_username TEXT,           -- who introduced this investor (guarantor credit)
  proof_data TEXT,                  -- base64 payment screenshot (MVP; move to blob storage later if it grows)
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,             -- set to verified_at + 7 days at the moment of verification
  returned BOOLEAN NOT NULL DEFAULT false,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investments_week ON investments(week_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_referrer ON investments(referrer_username);

-- Tracks when a guarantor was actually paid their monthly total (manual, admin-marked)
CREATE TABLE IF NOT EXISTS guarantor_payouts (
  id SERIAL PRIMARY KEY,
  referrer_username TEXT NOT NULL,
  period_month DATE NOT NULL,       -- first day of the month this payout covers
  total_amount NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_username, period_month)
);
