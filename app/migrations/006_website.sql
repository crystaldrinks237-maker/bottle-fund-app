-- Public website: price table (managed from the admin dashboard), small site settings, and contact-form messages.
CREATE TABLE IF NOT EXISTS bottle_prices (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                       -- e.g. "500 ml"
  bottles_per_pack INT NOT NULL CHECK (bottles_per_pack > 0),
  pack_price  NUMERIC(12,2) CHECK (pack_price IS NULL OR pack_price >= 0),  -- NULL = "ask on WhatsApp"
  note        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  message     TEXT NOT NULL,
  emailed     BOOLEAN NOT NULL DEFAULT FALSE,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Starter rows with NO prices: the site shows "Ask on WhatsApp" until you set them in Admin → Website.
-- Rename / add / remove sizes there to match what you actually sell.
INSERT INTO bottle_prices (name, bottles_per_pack, sort_order)
SELECT * FROM (VALUES ('500 ml', 12, 1), ('1 litre', 6, 2), ('1.5 litre', 6, 3), ('2.25 litre', 6, 4)) v(name, bottles_per_pack, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM bottle_prices);
INSERT INTO site_settings (key, value) VALUES ('address', ''), ('map_embed', '') ON CONFLICT DO NOTHING;
