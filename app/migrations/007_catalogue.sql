-- Homepage catalogue: sizes → qualities → price. Managed in Admin → Website. (Supersedes the flat bottle_prices table from 006, which is left untouched but no longer used.)
CREATE TABLE IF NOT EXISTS water_sizes (
  id               SERIAL PRIMARY KEY,
  label            TEXT NOT NULL,                 -- shown on the tab, e.g. "500 ml"
  size_value       TEXT NOT NULL,                 -- big number, e.g. "500" or "1.5"
  unit             TEXT NOT NULL,                 -- "ml" or "L"
  bottles_per_pack INT CHECK (bottles_per_pack IS NULL OR bottles_per_pack > 0),   -- NULL = sold individually / confirm on WhatsApp
  note             TEXT,
  image_url        TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS water_qualities (
  id         SERIAL PRIMARY KEY,
  size_id    INT NOT NULL REFERENCES water_sizes(id) ON DELETE CASCADE,
  quality    TEXT NOT NULL CHECK (quality IN ('Clear','Getron','Mix','Pure')),
  pack_price NUMERIC(12,2) CHECK (pack_price IS NULL OR pack_price >= 0),   -- NULL = "Ask on WhatsApp"
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,                                 -- untick when a quality is out of stock
  UNIQUE (size_id, quality)
);
-- Starting catalogue (only when empty). Only the 500 ml Mix price (Rs 220 / 12 bottles) was confirmed; set the rest in Admin → Website.
INSERT INTO water_sizes (label, size_value, unit, bottles_per_pack, note, image_url, sort_order)
SELECT * FROM (VALUES
  ('500 ml','500','ml',12,'For bulk orders and negotiation, contact us on WhatsApp.','/site/500ml.jpg',1),
  ('1.5 L','1.5','L',6,NULL,'/site/1500ml.jpg',2),
  ('6 L','6','L',NULL::int,NULL,'/site/6l.jpg',3),
  ('12 L','12','L',NULL::int,NULL,'/site/12l.jpg',4),
  ('19 L','19','L',NULL::int,NULL,'/site/19l.jpg',5)
) v(label, size_value, unit, bottles_per_pack, note, image_url, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM water_sizes);
INSERT INTO water_qualities (size_id, quality, pack_price, is_active)
SELECT s.id, q.quality, CASE WHEN s.label = '500 ml' AND q.quality = 'Mix' THEN 220 END, TRUE
FROM water_sizes s
JOIN (VALUES ('500 ml','Clear'),('500 ml','Getron'),('500 ml','Mix'),('500 ml','Pure'),
             ('1.5 L','Clear'),('1.5 L','Getron'),('1.5 L','Mix'),('1.5 L','Pure'),
             ('6 L','Clear'),('12 L','Mix'),('19 L','Mix'),('19 L','Pure')) q(label, quality) ON q.label = s.label
ON CONFLICT DO NOTHING;
