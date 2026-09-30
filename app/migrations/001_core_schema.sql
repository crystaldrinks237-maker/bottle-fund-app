-- Crystal Drinks Funding Platform — core schema (v2)
-- Safe on both a FRESH database and the ORIGINAL prototype database:
--   * prototype tables (weeks / investments / guarantor_payouts) are RENAMED to legacy_*, never dropped
--   * `users` is extended in place so existing accounts and password hashes keep working
--   * 002_legacy_import.sql then copies legacy rows into the new model

-- ---------------------------------------------------------------- legacy park
DO $$
BEGIN
  IF to_regclass('public.weeks') IS NOT NULL AND to_regclass('public.funding_needs') IS NULL THEN
    ALTER TABLE weeks RENAME TO legacy_weeks;
    IF to_regclass('public.investments') IS NOT NULL THEN ALTER TABLE investments RENAME TO legacy_investments; END IF;
    IF to_regclass('public.guarantor_payouts') IS NOT NULL THEN ALTER TABLE guarantor_payouts RENAME TO legacy_guarantor_payouts; END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_method TEXT;   -- e.g. Easypaisa / JazzCash / Bank
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account TEXT;  -- where we send this person's money
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role') THEN
    EXECUTE $q$UPDATE users SET roles = CASE WHEN role = 'admin' THEN ARRAY['ADMIN']::text[] ELSE ARRAY['INVESTOR']::text[] END WHERE roles IS NULL$q$;
    ALTER TABLE users ALTER COLUMN role DROP NOT NULL;   -- deprecated; superseded by users.roles
  END IF;
END $$;
UPDATE users SET roles = ARRAY['INVESTOR']::text[] WHERE roles IS NULL;
ALTER TABLE users ALTER COLUMN roles SET NOT NULL;
ALTER TABLE users ALTER COLUMN roles SET DEFAULT ARRAY['INVESTOR']::text[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_roles_valid') THEN
    ALTER TABLE users ADD CONSTRAINT users_roles_valid
      CHECK (cardinality(roles) > 0 AND roles <@ ARRAY['ADMIN','INVESTOR','GUARANTOR']::text[]);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_lower ON users (lower(username));

-- ------------------------------------------------------------- funding needs
CREATE TABLE funding_needs (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  product          TEXT NOT NULL,
  description      TEXT,
  quantity         BIGINT NOT NULL CHECK (quantity > 0),
  cost_price       NUMERIC(12,2) NOT NULL CHECK (cost_price > 0),
  sell_price       NUMERIC(12,2) NOT NULL CHECK (sell_price >= 0),
  op_cost          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (op_cost >= 0),
  investor_pct     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (investor_pct BETWEEN 0 AND 100),
  guarantor_pct    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (guarantor_pct BETWEEN 0 AND 100),
  business_pct     NUMERIC(5,2) GENERATED ALWAYS AS (100 - investor_pct - guarantor_pct) STORED,
  total_capital    NUMERIC(16,2) NOT NULL CHECK (total_capital > 0),
  funded_amount    NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (funded_amount >= 0),
  remaining_amount NUMERIC(16,2) GENERATED ALWAYS AS (total_capital - funded_amount) STORED,
  status           TEXT NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','OPEN','FULL','CLOSED','COMPLETED','CANCELLED')),
  cancel_reason    TEXT,
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at        TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  legacy_week_id   INTEGER,
  CONSTRAINT fn_pct_sum CHECK (investor_pct + guarantor_pct <= 100),
  CONSTRAINT fn_funded_le_capital CHECK (funded_amount <= total_capital)
);
CREATE INDEX ix_fn_status ON funding_needs (status, created_at DESC);

-- ----------------------------------------------------------- payment accounts
CREATE TABLE payment_accounts (
  id                  SERIAL PRIMARY KEY,
  account_name        TEXT NOT NULL,
  provider            TEXT NOT NULL CHECK (provider IN ('BANK','EASYPAISA','JAZZCASH','OTHER')),
  bank_name           TEXT,
  account_holder_name TEXT NOT NULL,
  account_number      TEXT NOT NULL,
  iban                TEXT,
  instructions        TEXT,
  daily_limit         NUMERIC(16,2) CHECK (daily_limit IS NULL OR daily_limit > 0),   -- NULL = no daily cap
  total_limit         NUMERIC(16,2) CHECK (total_limit IS NULL OR total_limit > 0),   -- NULL = no lifetime cap
  allocated_amount    NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0), -- money routed to this account (pending + verified)
  status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pa_alloc_le_total CHECK (total_limit IS NULL OR allocated_amount <= total_limit)
);
CREATE INDEX ix_pa_status ON payment_accounts (status);

CREATE TABLE funding_need_accounts (
  funding_need_id    INTEGER NOT NULL REFERENCES funding_needs(id) ON DELETE CASCADE,
  payment_account_id INTEGER NOT NULL REFERENCES payment_accounts(id),
  priority           INTEGER NOT NULL DEFAULT 0,   -- lower = tried first
  assigned_by        INTEGER REFERENCES users(id),
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (funding_need_id, payment_account_id)
);
CREATE INDEX ix_fna_account ON funding_need_accounts (payment_account_id);

-- -------------------------------------------------------------- payment proofs
-- Proof files live in their own table so list queries never drag binary data.
-- Served only through /api/proofs/[id] after an ownership / admin check.
CREATE TABLE payment_proofs (
  id            SERIAL PRIMARY KEY,
  uploader_id   INTEGER REFERENCES users(id),
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256        TEXT NOT NULL,
  original_name TEXT,
  data          BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  legacy_id     INTEGER
);
CREATE INDEX ix_proofs_sha ON payment_proofs (sha256);

-- ---------------------------------------------------------------- investments
CREATE TABLE investments (
  id                 SERIAL PRIMARY KEY,
  funding_need_id    INTEGER NOT NULL REFERENCES funding_needs(id),
  investor_id        INTEGER NOT NULL REFERENCES users(id),
  guarantor_id       INTEGER REFERENCES users(id),             -- snapshot of the investor's guarantor at submission
  legacy_referrer_username TEXT,                                -- prototype referrers without an account
  amount             NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  status             TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
                     CHECK (status IN ('PENDING_VERIFICATION','VERIFIED','PAYOUT_DUE','COMPLETED','REJECTED')),
  idempotency_key    TEXT,
  -- payment account used + immutable snapshot of what the investor was shown
  payment_account_id INTEGER REFERENCES payment_accounts(id),
  payment_snapshot   JSONB,
  proof_id           INTEGER REFERENCES payment_proofs(id),
  -- calculation inputs frozen when the investment was submitted
  snap_title         TEXT NOT NULL,
  snap_product       TEXT NOT NULL,
  snap_cost_price    NUMERIC(12,2) NOT NULL,
  snap_sell_price    NUMERIC(12,2) NOT NULL,
  snap_op_cost       NUMERIC(12,2) NOT NULL,
  snap_investor_pct  NUMERIC(5,2) NOT NULL,
  snap_guarantor_pct NUMERIC(5,2) NOT NULL,
  -- results frozen at verification (never recomputed)
  expected_investor_profit NUMERIC(16,2),
  expected_total_return    NUMERIC(16,2),
  guarantor_profit         NUMERIC(16,2),
  business_profit          NUMERIC(16,2),
  -- lifecycle timestamps (all timestamptz, UTC)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at        TIMESTAMPTZ,
  due_at             TIMESTAMPTZ,
  reviewed_by        INTEGER REFERENCES users(id),
  rejected_at        TIMESTAMPTZ,
  rejection_reason   TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  legacy_id          INTEGER,
  is_legacy          BOOLEAN NOT NULL DEFAULT false,
  -- exactly 168 hours: no calendar/DST arithmetic
  CONSTRAINT inv_due_is_168h CHECK (due_at IS NULL OR (verified_at IS NOT NULL AND due_at = verified_at + interval '168 hours')),
  CONSTRAINT inv_verified_has_times CHECK (status NOT IN ('VERIFIED','PAYOUT_DUE','COMPLETED') OR (verified_at IS NOT NULL AND due_at IS NOT NULL)),
  CONSTRAINT inv_rejected_has_reason CHECK (status <> 'REJECTED' OR (rejection_reason IS NOT NULL AND rejected_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_inv_idem ON investments (investor_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_inv_need ON investments (funding_need_id, created_at DESC);
CREATE INDEX ix_inv_investor ON investments (investor_id, created_at DESC);
CREATE INDEX ix_inv_guarantor ON investments (guarantor_id) WHERE guarantor_id IS NOT NULL;
CREATE INDEX ix_inv_status ON investments (status, created_at);
CREATE INDEX ix_inv_due ON investments (due_at) WHERE status = 'VERIFIED';
CREATE INDEX ix_inv_account ON investments (payment_account_id);

-- ------------------------------------------------------------------- payouts
CREATE TABLE payouts (
  id             SERIAL PRIMARY KEY,
  investment_id  INTEGER NOT NULL UNIQUE REFERENCES investments(id),
  investor_id    INTEGER NOT NULL REFERENCES users(id),
  amount         NUMERIC(16,2) NOT NULL CHECK (amount > 0),        -- principal + investor profit, frozen at verification
  principal      NUMERIC(16,2) NOT NULL,
  profit         NUMERIC(16,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'DUE'
                 CHECK (status IN ('DUE','PROCESSING','PAID','CLAIMED_NOT_RECEIVED','RESOLVED')),
  due_at         TIMESTAMPTZ NOT NULL,
  transaction_id TEXT,
  replacement_transaction_id TEXT,
  paid_to        TEXT,                                              -- destination recorded at payment time
  paid_at        TIMESTAMPTZ,
  notes          TEXT,                                              -- INTERNAL — never sent to investors
  processed_by   INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payout_paid_has_txn CHECK (status NOT IN ('PAID','CLAIMED_NOT_RECEIVED','RESOLVED') OR (paid_at IS NOT NULL AND (transaction_id IS NOT NULL OR notes IS NOT NULL)))
);
CREATE INDEX ix_payout_status_due ON payouts (status, due_at);
CREATE INDEX ix_payout_investor ON payouts (investor_id, created_at DESC);
CREATE INDEX ix_payout_txn ON payouts (transaction_id) WHERE transaction_id IS NOT NULL;

-- ------------------------------------------------------- guarantor relationships
CREATE TABLE guarantor_relationships (
  id           SERIAL PRIMARY KEY,
  investor_id  INTEGER NOT NULL UNIQUE REFERENCES users(id),   -- one guarantor per investor
  guarantor_id INTEGER NOT NULL REFERENCES users(id),
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gr_not_self CHECK (investor_id <> guarantor_id)
);
CREATE INDEX ix_gr_guarantor ON guarantor_relationships (guarantor_id);

CREATE TABLE guarantor_payments (
  id                 SERIAL PRIMARY KEY,
  guarantor_id       INTEGER NOT NULL REFERENCES users(id),
  period_month       DATE NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
  amount             NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','PROCESSING','PAID','CLAIMED_NOT_RECEIVED','RESOLVED')),
  transaction_id     TEXT,
  replacement_transaction_id TEXT,
  paid_to            TEXT,
  paid_at            TIMESTAMPTZ,
  notes              TEXT,                                      -- INTERNAL
  processed_by       INTEGER REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guarantor_id, period_month),
  CONSTRAINT gp_paid_has_txn CHECK (status NOT IN ('PAID','CLAIMED_NOT_RECEIVED','RESOLVED') OR (paid_at IS NOT NULL AND (transaction_id IS NOT NULL OR notes IS NOT NULL)))
);
CREATE INDEX ix_gp_status ON guarantor_payments (status, period_month);

-- every guarantor earning belongs to exactly one settlement (auditable, never double-counted)
CREATE TABLE guarantor_payment_items (
  investment_id        INTEGER PRIMARY KEY REFERENCES investments(id),
  guarantor_payment_id INTEGER NOT NULL REFERENCES guarantor_payments(id) ON DELETE CASCADE,
  amount               NUMERIC(16,2) NOT NULL CHECK (amount >= 0)
);
CREATE INDEX ix_gpi_payment ON guarantor_payment_items (guarantor_payment_id);

-- -------------------------------------------------------------- payment claims
CREATE TABLE payment_claims (
  id                    SERIAL PRIMARY KEY,
  guarantor_payment_id  INTEGER REFERENCES guarantor_payments(id),
  payout_id             INTEGER REFERENCES payouts(id),
  claimant_id           INTEGER NOT NULL REFERENCES users(id),
  reason                TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED')),
  admin_notes           TEXT,                                   -- INTERNAL
  resolution_note       TEXT,                                   -- visible to claimant
  replacement_transaction_id TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ,
  resolved_by           INTEGER REFERENCES users(id),
  CONSTRAINT pc_one_target CHECK (num_nonnulls(guarantor_payment_id, payout_id) = 1)
);
-- clicking "I did not receive this payment" repeatedly can never create a second live claim
CREATE UNIQUE INDEX ux_pc_open_gp ON payment_claims (guarantor_payment_id) WHERE guarantor_payment_id IS NOT NULL AND status IN ('OPEN','UNDER_REVIEW');
CREATE UNIQUE INDEX ux_pc_open_payout ON payment_claims (payout_id) WHERE payout_id IS NOT NULL AND status IN ('OPEN','UNDER_REVIEW');
CREATE INDEX ix_pc_status ON payment_claims (status, created_at DESC);
CREATE INDEX ix_pc_claimant ON payment_claims (claimant_id);

-- ---------------------------------------------------- notifications / audit / settings
CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_user ON notifications (user_id, created_at DESC);
CREATE INDEX ix_notif_unread ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_created ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX ix_audit_actor ON audit_logs (actor_id);
CREATE INDEX ix_audit_action ON audit_logs (action);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES ('near_limit_pct', '90'::jsonb) ON CONFLICT DO NOTHING;
