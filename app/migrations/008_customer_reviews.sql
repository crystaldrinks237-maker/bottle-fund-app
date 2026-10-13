-- Reviews from water customers, left via the public link /review (no account needed).
-- Nothing is shown on the homepage until an admin approves it. Separate from the funding-platform "testimonials" table.
CREATE TABLE IF NOT EXISTS customer_reviews (
  id            SERIAL PRIMARY KEY,
  business_name TEXT NOT NULL CHECK (char_length(business_name) BETWEEN 2 AND 80),
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 600),
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_customer_reviews_status ON customer_reviews (status, created_at DESC);
