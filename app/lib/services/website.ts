import { z } from 'zod';
import { query } from '../db';
import { audit } from '../audit';
import { bad, notFound } from '../api';
import type { CurrentUser } from '../session';

export const QUALITIES = ['Clear', 'Getron', 'Mix', 'Pure'] as const;
type Q = (typeof QUALITIES)[number];

export async function getSiteSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM site_settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/** What the public homepage shows: only active sizes with at least one available quality. Stock levels are never exposed. */
export async function publicCatalogue() {
  const sizes = await query<any>('SELECT * FROM water_sizes WHERE is_active ORDER BY sort_order, id');
  const quals = await query<any>('SELECT * FROM water_qualities WHERE is_active ORDER BY size_id, array_position(ARRAY[\'Clear\',\'Getron\',\'Mix\',\'Pure\'], quality)');
  const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  return sizes.map((s: any) => {
    const qs = quals.filter((q: any) => q.size_id === s.id);
    if (!qs.length) return null;
    const prices: Record<string, { price: number; perBottle: string }> = {};
    for (const q of qs) if (q.pack_price != null) {
      const price = Number(q.pack_price);
      prices[q.quality] = { price, perBottle: s.bottles_per_pack ? `Rs ${money(Math.round((price / s.bottles_per_pack) * 100) / 100)}` : '' };
    }
    const names: Q[] = qs.map((q: any) => q.quality);
    return {
      id: `size-${s.id}`, size: s.size_value, unit: s.unit, label: s.label, qualities: names,
      defaultQuality: (names.find(n => prices[n]) || names[0]) as Q,
      pack: s.bottles_per_pack as number | null, prices, note: s.note || undefined,
      image: s.image_url || '/site/500ml.jpg', imageAlt: `${s.label} PET water bottle`,
    };
  }).filter(Boolean) as any[];
}

// ---- admin: sizes with their qualities -------------------------------------------------------------------
const sizeSchema = z.object({
  label: z.string().trim().min(1, 'Enter a size name, e.g. 500 ml').max(30),
  size_value: z.string().trim().min(1, 'Enter the number, e.g. 500 or 1.5').max(10),
  unit: z.enum(['ml', 'L']),
  bottles_per_pack: z.union([z.literal(''), z.null(), z.coerce.number().int().min(1).max(500)]).transform(v => (v === '' || v === null ? null : v)),
  note: z.string().trim().max(160).optional().nullable().transform(v => v || null),
  image_url: z.string().trim().max(300).optional().nullable().transform(v => v || null)
    .refine(v => !v || /^(\/|https:\/\/)/.test(v), 'Image must start with / or https://'),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
  qualities: z.array(z.object({
    quality: z.enum(QUALITIES),
    is_active: z.boolean(),
    pack_price: z.union([z.literal(''), z.null(), z.coerce.number().min(0).max(100000000)]).transform(v => (v === '' || v === null ? null : v)),
  })).max(4),
});

export async function adminSizes() {
  const sizes = await query<any>('SELECT * FROM water_sizes ORDER BY sort_order, id');
  const quals = await query<any>('SELECT * FROM water_qualities');
  return sizes.map((s: any) => ({
    ...s,
    qualities: QUALITIES.map(q => { const r = quals.find((x: any) => x.size_id === s.id && x.quality === q); return { quality: q, is_active: r ? r.is_active : false, pack_price: r?.pack_price ?? null }; }),
  }));
}
async function saveQualities(sizeId: number, list: { quality: string; is_active: boolean; pack_price: number | null }[]) {
  for (const q of list) {
    await query(`INSERT INTO water_qualities (size_id, quality, pack_price, is_active) VALUES ($1,$2,$3,$4)
                 ON CONFLICT (size_id, quality) DO UPDATE SET pack_price = EXCLUDED.pack_price, is_active = EXCLUDED.is_active`, [sizeId, q.quality, q.pack_price, q.is_active]);
  }
}
export async function createSize(u: CurrentUser, body: unknown) {
  const v = sizeSchema.parse(body);
  const [r] = await query<any>('INSERT INTO water_sizes (label, size_value, unit, bottles_per_pack, note, image_url, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [v.label, v.size_value, v.unit, v.bottles_per_pack, v.note, v.image_url, v.sort_order, v.is_active]);
  await saveQualities(r.id, v.qualities);
  await audit(null, u.id, 'SIZE_CREATED', 'water_size', r.id, { label: v.label });
  return { id: r.id };
}
export async function updateSize(u: CurrentUser, id: number, body: unknown) {
  const v = sizeSchema.parse(body);
  const [old] = await query<any>('SELECT * FROM water_sizes WHERE id = $1', [id]);
  if (!old) throw notFound();
  const oldQ = await query<any>('SELECT quality, pack_price, is_active FROM water_qualities WHERE size_id = $1', [id]);
  await query('UPDATE water_sizes SET label=$2, size_value=$3, unit=$4, bottles_per_pack=$5, note=$6, image_url=$7, sort_order=$8, is_active=$9, updated_at=now() WHERE id=$1',
    [id, v.label, v.size_value, v.unit, v.bottles_per_pack, v.note, v.image_url, v.sort_order, v.is_active]);
  await saveQualities(id, v.qualities);
  await audit(null, u.id, 'SIZE_UPDATED', 'water_size', id, { label: v.label, before: oldQ, after: v.qualities });
  return { ok: true };
}
export async function deleteSize(u: CurrentUser, id: number) {
  const r = await query('DELETE FROM water_sizes WHERE id = $1 RETURNING id', [id]);
  if (!r.length) throw notFound();
  await audit(null, u.id, 'SIZE_DELETED', 'water_size', id);
  return { ok: true };
}
export async function updateSiteSettings(u: CurrentUser, body: any) {
  const address = String(body?.address ?? '').trim().slice(0, 300);
  let embed = String(body?.map_embed ?? '').trim();
  // Accept either the bare URL or the whole <iframe …> snippet Google gives you; keep only a google.com/maps/embed src.
  const m = embed.match(/src="([^"]+)"/); if (m) embed = m[1];
  if (embed && !/^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com\/maps\?)/.test(embed)) throw bad('Map embed must be the link from Google Maps → Share → Embed a map.');
  for (const [k, v] of [['address', address], ['map_embed', embed]]) await query('INSERT INTO site_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
  await audit(null, u.id, 'SITE_SETTINGS_UPDATED', 'site_settings', null);
  return { address, map_embed: embed };
}

// ---- contact form -------------------------------------------------------------------------------------------
const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  phone: z.string().trim().min(7, 'Please enter a phone / WhatsApp number').max(30).regex(/^[0-9+\-\s()]+$/, 'Phone number looks invalid'),
  message: z.string().trim().min(5, 'Please write a short message').max(1500),
  website: z.string().optional(), // honeypot — real users never fill this
});
const hits = new Map<string, number[]>();

export async function submitContact(ip: string, body: unknown) {
  const v = contactSchema.parse(body);
  if (v.website) return { ok: true }; // bot: pretend success, store nothing
  const now = Date.now(); const recent = (hits.get(ip) || []).filter(t => now - t < 10 * 60_000);
  if (recent.length >= 3) throw bad('Too many messages — please wait a few minutes or message us on WhatsApp.');
  hits.set(ip, [...recent, now]);
  const [row] = await query<{ id: number }>('INSERT INTO contact_messages (name, phone, message) VALUES ($1,$2,$3) RETURNING id', [v.name, v.phone, v.message]);
  const sent = await sendContactEmail(v.name, v.phone, v.message);
  if (sent) await query('UPDATE contact_messages SET emailed = TRUE WHERE id = $1', [row.id]);
  return { ok: true };
}

async function sendContactEmail(name: string, phone: string, message: string): Promise<boolean> {
  const to = process.env.CONTACT_TO_EMAIL; // kept in server env only — never rendered on the site
  if (!to) return false; // not configured: the message is still saved and shown in Admin → Messages
  const subject = `New website enquiry from ${name}`, text = `Name: ${name}\nPhone: ${phone}\n\n${message}`;
  try {
    if (process.env.RESEND_API_KEY) { // simplest option: https://resend.com (free tier)
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RESEND_FROM || 'Crystal Drinks <onboarding@resend.dev>', to: [to], subject, text }) });
      return r.ok;
    }
    if (process.env.SMTP_USER && process.env.SMTP_PASS) return await smtpSend(process.env.SMTP_USER, process.env.SMTP_PASS, to, subject, text);
  } catch (e) { console.error('[contact email]', e); }
  return false;
}

// Minimal SMTP-over-TLS client (Gmail: smtp.gmail.com:465 with an App Password) — no extra dependency.
async function smtpSend(user: string, pass: string, to: string, subject: string, text: string): Promise<boolean> {
  const tls = await import('node:tls');
  const clean = (v: string) => v.replace(/[\r\n]+/g, ' ');
  return new Promise<boolean>(resolve => {
    const sock = tls.connect({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), servername: process.env.SMTP_HOST || 'smtp.gmail.com' });
    sock.setTimeout(15000, () => { sock.destroy(); resolve(false); });
    const b64 = (v: string) => Buffer.from(v).toString('base64');
    const body = text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const steps: [string | null, string][] = [
      [null, '220'], [`EHLO crystaldrinks.pk`, '250'], ['AUTH LOGIN', '334'], [b64(user), '334'], [b64(pass), '235'],
      [`MAIL FROM:<${clean(user)}>`, '250'], [`RCPT TO:<${clean(to)}>`, '250'], ['DATA', '354'],
      [`From: Crystal Drinks website <${clean(user)}>\r\nTo: ${clean(to)}\r\nSubject: ${clean(subject)}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.`, '250'], ['QUIT', '221'],
    ];
    let i = 0, buf = '';
    sock.on('data', d => {
      buf += d.toString();
      const lines = buf.split('\r\n'); if (lines.length < 2) return;
      const last = lines[lines.length - 2]; if (/^\d{3}-/.test(last)) return; // multi-line reply not finished
      buf = '';
      if (!last.startsWith(steps[i][1])) { sock.destroy(); return resolve(false); }
      i++;
      if (i >= steps.length) { sock.end(); return resolve(true); }
      sock.write(steps[i][0] + '\r\n');
    });
    sock.on('error', () => resolve(false));
  });
}

export const adminMessages = () => query('SELECT id, name, phone, message, emailed, is_read, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200');
export async function markMessage(id: number, read: boolean) { await query('UPDATE contact_messages SET is_read = $2 WHERE id = $1', [id, read]); return { ok: true }; }
