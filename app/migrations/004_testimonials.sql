-- Customer testimonials. Only real, consenting customers; nothing is public until an admin approves it.
CREATE TABLE testimonials (
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
CREATE UNIQUE INDEX ux_testimonial_investor ON testimonials (investor_id) WHERE investor_id IS NOT NULL;  -- one review per investor
CREATE INDEX ix_testimonials_status ON testimonials (status, created_at DESC);
