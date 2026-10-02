import { z } from 'zod';
import { query, tx } from '../db';
import { audit } from '../audit';
import { notify, notifyAdmins } from '../notify';
import { ApiError, conflict, notFound, Where, likeTerm, pageParams, sortParam } from '../api';
import type { CurrentUser } from '../session';

const text = (min: number, max: number, label: string) => z.string().trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`);
const base = {
  display_name: text(2, 60, 'Name'), city: z.string().trim().max(60).optional().nullable(),
  rating: z.coerce.number().int().min(1, 'Choose a star rating').max(5), body: text(20, 600, 'Your review'),
};
const mineSchema = z.object({ ...base, consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the box to allow us to show your review' }) }) });
const adminSchema = z.object({ ...base, permission_note: text(3, 300, 'Permission note'), consent_confirmed: z.literal(true, { errorMap: () => ({ message: 'Confirm that this customer gave permission' }) }) });

/** Only people who have really been paid out can review — that is what makes the badge on the public page truthful. */
export async function reviewState(user: CurrentUser) {
  const [{ n }] = await query(`SELECT COUNT(*)::int AS n FROM investments WHERE investor_id = $1 AND status = 'COMPLETED'`, [user.id]);
  const [review] = await query('SELECT id, display_name, city, rating, body, status, admin_note, updated_at FROM testimonials WHERE investor_id = $1', [user.id]);
  const [u] = await query('SELECT full_name FROM users WHERE id = $1', [user.id]);
  return { eligible: n > 0, review: review ? { ...review, admin_note: undefined, rejected: review.status === 'REJECTED' } : null, suggested_name: u?.full_name || '' };
}

export async function submitMine(user: CurrentUser, raw: unknown) {
  const v: any = mineSchema.parse(raw);
  if (!(await reviewState(user)).eligible) throw new ApiError(403, 'Reviews are open to investors who have received a payout.');
  return tx(async t => {
    const [row] = await t.q(
      `INSERT INTO testimonials (investor_id, source, display_name, city, rating, body, consent_display, status, created_by)
       VALUES ($1,'INVESTOR',$2,$3,$4,$5,true,'PENDING',$1)
       ON CONFLICT (investor_id) WHERE investor_id IS NOT NULL DO UPDATE
         SET display_name = EXCLUDED.display_name, city = EXCLUDED.city, rating = EXCLUDED.rating, body = EXCLUDED.body,
             status = 'PENDING', reviewed_by = NULL, reviewed_at = NULL, updated_at = now()   -- any edit goes back through approval
       RETURNING id, status`, [user.id, v.display_name, v.city || null, v.rating, v.body]);
    await audit(t, user.id, 'testimonial.submitted', 'testimonial', row.id, { rating: v.rating });
    await notifyAdmins(t, { type: 'TESTIMONIAL_PENDING', title: 'New review to approve', body: `${v.display_name} · ${v.rating}★`, link: '/admin/testimonials?status=PENDING' });
    return row;
  });
}

export async function adminCreate(admin: CurrentUser, raw: unknown) {
  const v: any = adminSchema.parse(raw);
  return tx(async t => {
    const [row] = await t.q(
      `INSERT INTO testimonials (source, display_name, city, rating, body, consent_display, status, admin_note, created_by, reviewed_by, reviewed_at)
       VALUES ('ADMIN_ENTERED',$1,$2,$3,$4,true,'APPROVED',$5,$6,$6,now()) RETURNING id`, [v.display_name, v.city || null, v.rating, v.body, v.permission_note, admin.id]);
    await audit(t, admin.id, 'testimonial.created_by_admin', 'testimonial', row.id, { permission_note: v.permission_note });
    return row;
  });
}

export async function listTestimonials(url: URL) {
  const { page, size, offset } = pageParams(url);
  const w = new Where(); const sp = url.searchParams;
  const q = sp.get('q')?.trim(); if (q) { const l = likeTerm(q); w.add('(t.display_name ILIKE ? OR t.body ILIKE ? OR t.city ILIKE ?)', l, l, l); }
  const st = sp.get('status'); if (st) w.add('t.status = ?', st);
  const order = sortParam(url, { created: 't.created_at', rating: 't.rating', status: 't.status' }, '-created');
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM testimonials t ${w.sql}`, w.params);
  const rows = await query(`SELECT t.*, u.username AS investor_username FROM testimonials t LEFT JOIN users u ON u.id = t.investor_id ${w.sql} ORDER BY ${order}, t.id DESC LIMIT ${size} OFFSET ${offset}`, w.params);
  return { rows, total: count, page, size };
}

const actionSchema = z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(300).optional().nullable() });
export async function actOnTestimonial(admin: CurrentUser, id: number, raw: unknown) {
  const b = actionSchema.parse(raw);
  return tx(async t => {
    const [cur] = await t.q('SELECT * FROM testimonials WHERE id = $1 FOR UPDATE', [id]);
    if (!cur) throw notFound('Review not found');
    const next = b.action === 'approve' ? 'APPROVED' : 'REJECTED';
    if (cur.status === next) throw conflict(`This review is already ${next.toLowerCase()}.`);
    const [row] = await t.q(`UPDATE testimonials SET status = $2, reviewed_by = $3, reviewed_at = now(), admin_note = COALESCE($4, admin_note), updated_at = now() WHERE id = $1 RETURNING *`, [id, next, admin.id, b.note || null]);
    await audit(t, admin.id, `testimonial.${b.action === 'approve' ? 'approved' : 'rejected'}`, 'testimonial', id, { note: b.note || null });
    if (cur.investor_id && b.action === 'approve') await notify(t, cur.investor_id, { type: 'TESTIMONIAL_APPROVED', title: 'Your review is now live', body: 'Thank you for sharing your experience.', link: '/dashboard' });
    return row;
  });
}

/** Public view: approved only, and only the fields that were consented to — no user id, username or notes. */
export async function publicTestimonials() {
  const rows = await query(`SELECT id, display_name, city, rating, body, source, created_at FROM testimonials WHERE status = 'APPROVED' ORDER BY created_at DESC LIMIT 9`);
  const [s] = await query(`SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1) AS average FROM testimonials WHERE status = 'APPROVED'`);
  return { rows: rows.map((r: any) => ({ ...r, verified: r.source === 'INVESTOR' })), count: s.count, average: s.average };
}
