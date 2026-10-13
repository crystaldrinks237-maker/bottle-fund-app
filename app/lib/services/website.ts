import { z } from 'zod';
import { query } from '../db';
import { audit } from '../audit';
import { bad, notFound } from '../api';
import type { CurrentUser } from '../session';

export interface PriceRow { id: number; name: string; bottles_per_pack: number; pack_price: string | null; note: string | null; sort_order: number; is_active: boolean }

export async function publicPrices(): Promise<PriceRow[]> {
  return query<PriceRow>('SELECT id, name, bottles_per_pack, pack_price, note, sort_order, is_active FROM bottle_prices WHERE is_active ORDER BY sort_order, id');
}
export async function getSiteSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>('SELECT key, value FROM site_settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

const priceSchema = z.object({
  name: z.string().trim().min(1, 'Enter a size name').max(60),
  bottles_per_pack: z.coerce.number().int().min(1).max(500),
  pack_price: z.union([z.literal(''), z.null(), z.coerce.number().min(0).max(100000000)]).transform(v => (v === '' || v === null ? null : v)),
  note: z.string().trim().max(120).optional().nullable().transform(v => v || null),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
});

export const adminPrices = () => query<PriceRow>('SELECT * FROM bottle_prices ORDER BY sort_order, id');
export async function createPrice(u: CurrentUser, body: unknown) {
  const v = priceSchema.parse(body);
  const [r] = await query<PriceRow>('INSERT INTO bottle_prices (name, bottles_per_pack, pack_price, note, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [v.name, v.bottles_per_pack, v.pack_price, v.note, v.sort_order, v.is_active]);
  await audit(null, u.id, 'PRICE_CREATED', 'bottle_price', r.id, v);
  return r;
}
export async function updatePrice(u: CurrentUser, id: number, body: unknown) {
  const v = priceSchema.parse(body);
  const [old] = await query<PriceRow>('SELECT * FROM bottle_prices WHERE id = $1', [id]);
  if (!old) throw notFound();
  const [r] = await query<PriceRow>('UPDATE bottle_prices SET name=$2, bottles_per_pack=$3, pack_price=$4, note=$5, sort_order=$6, is_active=$7, updated_at=now() WHERE id=$1 RETURNING *',
    [id, v.name, v.bottles_per_pack, v.pack_price, v.note, v.sort_order, v.is_active]);
  await audit(null, u.id, 'PRICE_UPDATED', 'bottle_price', id, { from: old.pack_price, to: v.pack_price, name: v.name });
  return r;
}
export async function deletePrice(u: CurrentUser, id: number) {
  const r = await query('DELETE FROM bottle_prices WHERE id = $1 RETURNING id', [id]);
  if (!r.length) throw notFound();
  await audit(null, u.id, 'PRICE_DELETED', 'bottle_price', id);
  return { ok: true };
}
export async function updateSiteSettings(u: CurrentUser, body: any) {
  const address = String(body?.address ?? '').trim().slice(0, 300);
  let embed = String(body?.map_embed ?? '').trim();
  // Accept either the bare URL or the whole <iframe …> snippet Google gives you; keep only a google.com/maps/embed src.
  const m = embed.match(/src="([^"]+)"/); if (m) embed = m[1];
  if (embed && !/^https:\/\/www\.google\.com\/maps\/embed/.test(embed)) throw bad('Map embed must be the link from Google Maps → Share → Embed a map.');
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
