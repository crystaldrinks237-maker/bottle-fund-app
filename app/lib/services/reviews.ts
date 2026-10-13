import { z } from 'zod';
import { query } from '../db';
import { audit } from '../audit';
import { notifyAdmins } from '../notify';
import { bad, notFound } from '../api';
import type { CurrentUser } from '../session';

const reviewSchema = z.object({
  business_name: z.string().trim().min(2, 'Please enter your business name').max(80, 'Business name is too long'),
  rating: z.coerce.number().int().min(1, 'Please choose a star rating').max(5),
  body: z.string().trim().min(10, 'Please write at least a short sentence').max(600, 'Please keep your review under 600 characters'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the box to allow us to show your review' }) }),
  website: z.string().optional(), // honeypot
});
const hits = new Map<string, number[]>();

export async function submitReview(ip: string, raw: unknown) {
  const v = reviewSchema.parse(raw);
  if (v.website) return { ok: true }; // bot: pretend success
  const now = Date.now(); const recent = (hits.get(ip) || []).filter(t => now - t < 10 * 60_000);
  if (recent.length >= 5) throw bad('Too many reviews from this connection — please try again in a few minutes.');
  hits.set(ip, [...recent, now]);
  const [row] = await query<{ id: number }>('INSERT INTO customer_reviews (business_name, rating, body) VALUES ($1,$2,$3) RETURNING id', [v.business_name, v.rating, v.body]);
  try { await notifyAdmins(null, { type: 'WEBSITE_REVIEW_PENDING', title: 'New website review to approve', body: `${v.business_name} · ${v.rating}★`, link: '/funds/admin/reviews?status=PENDING' }); } catch (e) { console.error('[review notify]', e); }
  return { ok: true, id: row.id };
}

/** Approved reviews only — what the homepage shows. */
export async function publicReviews() {
  const rows = await query<any>(`SELECT id, business_name, rating, body FROM customer_reviews WHERE status = 'APPROVED' ORDER BY reviewed_at DESC NULLS LAST, id DESC LIMIT 9`);
  const [s] = await query<any>(`SELECT COUNT(*)::int AS n, COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS avg FROM customer_reviews WHERE status = 'APPROVED'`);
  return { rows, count: s?.n ?? 0, average: s?.avg ?? 0 };
}

export async function adminReviews(status: string | null) {
  const ok = ['PENDING', 'APPROVED', 'REJECTED'];
  const rows = status && ok.includes(status)
    ? await query('SELECT * FROM customer_reviews WHERE status = $1 ORDER BY created_at DESC LIMIT 200', [status])
    : await query('SELECT * FROM customer_reviews ORDER BY created_at DESC LIMIT 200');
  const counts = await query<any>('SELECT status, COUNT(*)::int AS n FROM customer_reviews GROUP BY status');
  return { rows, counts: Object.fromEntries(counts.map(c => [c.status, c.n])) };
}
export async function reviewAction(u: CurrentUser, id: number, action: string) {
  const map: Record<string, string> = { approve: 'APPROVED', reject: 'REJECTED', pending: 'PENDING' };
  const st = map[action]; if (!st) throw bad('Unknown action');
  const r = await query('UPDATE customer_reviews SET status = $2, reviewed_at = now() WHERE id = $1 RETURNING id', [id, st]);
  if (!r.length) throw notFound();
  await audit(null, u.id, `WEBSITE_REVIEW_${st}`, 'customer_review', id);
  return { ok: true };
}
export async function deleteReview(u: CurrentUser, id: number) {
  const r = await query('DELETE FROM customer_reviews WHERE id = $1 RETURNING id', [id]);
  if (!r.length) throw notFound();
  await audit(null, u.id, 'WEBSITE_REVIEW_DELETED', 'customer_review', id);
  return { ok: true };
}
