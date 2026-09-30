import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, tx } from '../db';
import { audit } from '../audit';
import { notify } from '../notify';
import { bad, conflict, notFound, Where, likeTerm, pageParams, sortParam } from '../api';
import { noteSchema, passwordSchema, phoneSchema, txnSchema, usernameSchema } from '../validators';
import { APP_TIMEZONE } from '../config';
import { formatMoney, formatMonth } from '../format';
import type { CurrentUser } from '../session';
import { isAdmin } from '../session';
import { assertTxnUnused } from './payouts';

const TZ = APP_TIMEZONE.replace(/'/g, '');
const EARNING_STATUSES = `('VERIFIED','PAYOUT_DUE','COMPLETED')`;
export const monthStartSql = (p: string) => `((${p}::date)::timestamp AT TIME ZONE '${TZ}')`;
const monthEndSql = (p: string) => `(((${p}::date) + interval '1 month')::timestamp AT TIME ZONE '${TZ}')`;
export const currentMonthSql = `(date_trunc('month', now() AT TIME ZONE '${TZ}'))::date`;

export function normaliseMonth(v: string | null | undefined): string {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})(-\d{2})?$/.exec(v.trim());
  if (!m || +m[2] < 1 || +m[2] > 12) throw bad('Month must look like 2026-09');
  return `${m[1]}-${m[2]}-01`;
}

/* --------------------------------------------------------------- accounts */
const createSchema = z.object({ username: usernameSchema, password: passwordSchema.optional(), full_name: z.string().trim().max(80).optional().nullable(), phone: phoneSchema });

export async function createOrGrantGuarantor(admin: CurrentUser, raw: unknown) {
  const v = createSchema.parse(raw);
  return tx(async t => {
    const [ex] = await t.q('SELECT id, roles FROM users WHERE lower(username) = $1 FOR UPDATE', [v.username]);
    if (ex) {
      if (ex.roles.includes('GUARANTOR')) throw conflict('That user is already a guarantor.');
      await t.q(`UPDATE users SET roles = array_append(roles, 'GUARANTOR'), updated_at = now() WHERE id = $1`, [ex.id]);
      await audit(t, admin.id, 'guarantor.role_granted', 'user', ex.id, { username: v.username });
      return { id: ex.id, created: false };
    }
    if (!v.password) throw bad('Set an initial password for the new guarantor account.');
    const hash = await bcrypt.hash(v.password, 12);
    const [u] = await t.q(`INSERT INTO users (username, password_hash, roles, full_name, phone) VALUES ($1,$2,ARRAY['GUARANTOR'],$3,$4) RETURNING id`, [v.username, hash, v.full_name || null, v.phone || null]);
    await audit(t, admin.id, 'guarantor.created', 'user', u.id, { username: v.username });
    return { id: u.id, created: true };
  });
}

export async function assignGuarantor(admin: CurrentUser, investorId: number, guarantorId: number | null) {
  return tx(async t => {
    const [inv] = await t.q('SELECT id, username, roles FROM users WHERE id = $1', [investorId]);
    if (!inv) throw notFound('Investor not found');
    if (guarantorId) {
      const [g] = await t.q('SELECT id, roles, is_active FROM users WHERE id = $1', [guarantorId]);
      if (!g || !g.roles.includes('GUARANTOR') || !g.is_active) throw bad('Choose an active guarantor account');
      if (guarantorId === investorId) throw bad('A user cannot be their own guarantor');
      await t.q(`INSERT INTO guarantor_relationships (investor_id, guarantor_id, created_by) VALUES ($1,$2,$3)
                 ON CONFLICT (investor_id) DO UPDATE SET guarantor_id = EXCLUDED.guarantor_id, created_by = EXCLUDED.created_by, created_at = now()`, [investorId, guarantorId, admin.id]);
    } else await t.q('DELETE FROM guarantor_relationships WHERE investor_id = $1', [investorId]);
    await audit(t, admin.id, 'guarantor.assigned', 'user', investorId, { guarantor_id: guarantorId, note: 'Applies to future investments only; existing investments keep their guarantor.' });
    return { ok: true };
  });
}

/* ------------------------------------------------------------- admin lists */
export async function listGuarantors(url: URL) {
  const { page, size, offset } = pageParams(url);
  const w = new Where(); w.parts = ["'GUARANTOR' = ANY(u.roles)"];
  const q = url.searchParams.get('q')?.trim();
  if (q) w.add('(u.username ILIKE ? OR u.full_name ILIKE ?)', likeTerm(q), likeTerm(q));
  const order = sortParam(url, { username: 'u.username', earnings: 'lifetime', created: 'u.created_at' }, 'username');
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM users u ${w.sql}`, w.params);
  const rows = await query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.is_active, u.payout_method, u.payout_account, u.created_at,
            (SELECT COUNT(*) FROM guarantor_relationships r WHERE r.guarantor_id = u.id)::int AS referred_investors,
            (SELECT COUNT(*) FROM investments i WHERE i.guarantor_id = u.id AND i.status IN ('VERIFIED','PAYOUT_DUE'))::int AS active_investments,
            COALESCE((SELECT SUM(i.guarantor_profit) FROM investments i WHERE i.guarantor_id = u.id AND i.status IN ${EARNING_STATUSES}), 0) AS lifetime,
            COALESCE((SELECT SUM(i.guarantor_profit) FROM investments i WHERE i.guarantor_id = u.id AND i.status IN ${EARNING_STATUSES}
                        AND NOT EXISTS (SELECT 1 FROM guarantor_payment_items x WHERE x.investment_id = i.id)), 0) AS unsettled,
            COALESCE((SELECT SUM(gp.amount) FROM guarantor_payments gp WHERE gp.guarantor_id = u.id AND gp.status IN ('PAID','RESOLVED','CLAIMED_NOT_RECEIVED')), 0) AS paid
       FROM users u ${w.sql} ORDER BY ${order}, u.id LIMIT ${size} OFFSET ${offset}`, w.params);
  return { rows, total: count, page, size };
}

export async function listInvestorsAdmin(url: URL) {
  const { page, size, offset } = pageParams(url);
  const w = new Where(); w.parts = ["'INVESTOR' = ANY(u.roles)"];
  const q = url.searchParams.get('q')?.trim();
  if (q) w.add('(u.username ILIKE ? OR u.full_name ILIKE ? OR u.phone ILIKE ?)', likeTerm(q), likeTerm(q), likeTerm(q));
  const order = sortParam(url, { username: 'u.username', invested: 'invested', created: 'u.created_at' }, '-created');
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM users u ${w.sql}`, w.params);
  const rows = await query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.is_active, u.created_at, u.payout_method, u.payout_account,
            g.id AS guarantor_id, g.username AS guarantor_username,
            (SELECT COUNT(*) FROM investments i WHERE i.investor_id = u.id AND i.status <> 'REJECTED')::int AS investments,
            COALESCE((SELECT SUM(i.amount) FROM investments i WHERE i.investor_id = u.id AND i.status IN ${EARNING_STATUSES}), 0) AS invested
       FROM users u LEFT JOIN guarantor_relationships r ON r.investor_id = u.id LEFT JOIN users g ON g.id = r.guarantor_id
       ${w.sql} ORDER BY ${order}, u.id LIMIT ${size} OFFSET ${offset}`, w.params);
  return { rows, total: count, page, size };
}

/* -------------------------------------------------------- guarantor's own */
export async function guarantorDashboard(user: CurrentUser) {
  const id = user.id;
  const [cards] = await query(
    `SELECT
       COALESCE((SELECT SUM(i.guarantor_profit) FROM investments i WHERE i.guarantor_id = $1 AND i.status IN ${EARNING_STATUSES}
                  AND i.verified_at >= ${monthStartSql(currentMonthSql)} AND i.verified_at < ${monthEndSql(currentMonthSql)}), 0) AS earnings_this_month,
       COALESCE((SELECT SUM(i.guarantor_profit) FROM investments i WHERE i.guarantor_id = $1 AND i.status IN ${EARNING_STATUSES}
                  AND NOT EXISTS (SELECT 1 FROM guarantor_payment_items x WHERE x.investment_id = i.id)), 0)
       + COALESCE((SELECT SUM(gp.amount) FROM guarantor_payments gp WHERE gp.guarantor_id = $1 AND gp.status IN ('PENDING','PROCESSING')), 0) AS pending_earnings,
       COALESCE((SELECT SUM(gp.amount) FROM guarantor_payments gp WHERE gp.guarantor_id = $1 AND gp.status IN ('PAID','RESOLVED')), 0) AS paid_earnings,
       COALESCE((SELECT SUM(gp.amount) FROM guarantor_payments gp WHERE gp.guarantor_id = $1 AND gp.status = 'CLAIMED_NOT_RECEIVED'), 0) AS disputed_earnings,
       (SELECT COUNT(*) FROM guarantor_relationships r WHERE r.guarantor_id = $1)::int AS referred_investors,
       (SELECT COUNT(*) FROM investments i WHERE i.guarantor_id = $1 AND i.status IN ('VERIFIED','PAYOUT_DUE'))::int AS active_referred_investments`, [id]);
  const referred = await query(
    `SELECT u.id, u.username, r.created_at AS joined_at,
            (SELECT COUNT(*) FROM investments i WHERE i.investor_id = u.id AND i.guarantor_id = $1 AND i.status IN ${EARNING_STATUSES})::int AS investments,
            COALESCE((SELECT SUM(i.amount) FROM investments i WHERE i.investor_id = u.id AND i.guarantor_id = $1 AND i.status IN ${EARNING_STATUSES}), 0) AS invested,
            COALESCE((SELECT SUM(i.guarantor_profit) FROM investments i WHERE i.investor_id = u.id AND i.guarantor_id = $1 AND i.status IN ${EARNING_STATUSES}), 0) AS earnings
       FROM guarantor_relationships r JOIN users u ON u.id = r.investor_id WHERE r.guarantor_id = $1 ORDER BY r.created_at DESC`, [id]);
  const recent = await query(
    `SELECT i.id, u.username AS investor_username, i.snap_title, i.amount, i.guarantor_profit, i.verified_at,
            CASE WHEN i.status = 'VERIFIED' AND i.due_at <= now() THEN 'PAYOUT_DUE' ELSE i.status END AS display_status
       FROM investments i JOIN users u ON u.id = i.investor_id
      WHERE i.guarantor_id = $1 AND i.status IN ${EARNING_STATUSES} ORDER BY i.verified_at DESC LIMIT 15`, [id]);
  return { cards, referred, recent };
}

/* ------------------------------------------------------------- settlements */
function unsettledFilter(monthParam: string) {
  return `i.guarantor_id IS NOT NULL AND i.status IN ${EARNING_STATUSES} AND COALESCE(i.guarantor_profit,0) > 0
          AND NOT EXISTS (SELECT 1 FROM guarantor_payment_items x WHERE x.investment_id = i.id)
          AND i.verified_at < ${monthEndSql(monthParam)}`;
}

/** What a settlement for `month` would contain right now. Deterministic: sums frozen guarantor_profit values. */
export async function settlementPreview(month: string) {
  const m = normaliseMonth(month);
  return query(
    `SELECT g.id AS guarantor_id, g.username, COUNT(*)::int AS investments, SUM(i.guarantor_profit) AS amount,
            (SELECT gp.id FROM guarantor_payments gp WHERE gp.guarantor_id = g.id AND gp.period_month = $1::date) AS payment_id,
            (SELECT gp.status FROM guarantor_payments gp WHERE gp.guarantor_id = g.id AND gp.period_month = $1::date) AS payment_status
       FROM investments i JOIN users g ON g.id = i.guarantor_id WHERE ${unsettledFilter('$1')} GROUP BY g.id, g.username ORDER BY g.username`, [m]);
}

/**
 * Creates (or refreshes, while still PENDING) one payment per guarantor for `month`.
 * Rule: every not-yet-settled guarantor earning verified before the end of that month is linked to exactly one payment
 * (guarantor_payment_items.investment_id is a primary key), so nothing can be paid twice or missed.
 */
export async function generateSettlement(admin: CurrentUser, month: string) {
  const m = normaliseMonth(month);
  if (!m) throw bad('Choose a month');
  return tx(async t => {
    const groups = await t.q(`SELECT DISTINCT i.guarantor_id FROM investments i WHERE ${unsettledFilter('$1')} ORDER BY i.guarantor_id`, [m]);
    let created = 0, refreshed = 0, skipped = 0;
    for (const { guarantor_id: gid } of groups) {
      let [gp] = await t.q('SELECT * FROM guarantor_payments WHERE guarantor_id = $1 AND period_month = $2::date FOR UPDATE', [gid, m]);
      let isNew = false;
      if (gp && gp.status !== 'PENDING') { skipped++; continue; }
      if (!gp) {
        // amount is patched right after the items are linked; insert a positive placeholder that the same transaction corrects
        [gp] = await t.q(`INSERT INTO guarantor_payments (guarantor_id, period_month, amount) VALUES ($1,$2::date,0.01) RETURNING *`, [gid, m]);
        created++; isNew = true;
      } else refreshed++;
      await t.q(`INSERT INTO guarantor_payment_items (investment_id, guarantor_payment_id, amount)
                 SELECT i.id, $3, i.guarantor_profit FROM investments i WHERE i.guarantor_id = $1 AND ${unsettledFilter('$2')} ON CONFLICT DO NOTHING`, [gid, m, gp.id]);
      const [{ total }] = await t.q('SELECT COALESCE(SUM(amount),0) AS total FROM guarantor_payment_items WHERE guarantor_payment_id = $1', [gp.id]);
      const [row] = await t.q('UPDATE guarantor_payments SET amount = $2, updated_at = now() WHERE id = $1 RETURNING *', [gp.id, total]);
      await audit(t, admin.id, isNew ? 'guarantor_payment.created' : 'guarantor_payment.refreshed', 'guarantor_payment', gp.id, { guarantor_id: gid, period_month: m, amount: row.amount });
      await notify(t, gid, { type: 'EARNINGS_FINALIZED', title: `${formatMonth(m)} earnings finalized`, body: `${formatMoney(row.amount)} will be paid to you.`, link: '/guarantor/payments' });
    }
    return { created, refreshed, skipped };
  });
}

const GP_COLS = `gp.id, gp.guarantor_id, gp.period_month, gp.amount, gp.status, gp.transaction_id, gp.replacement_transaction_id, gp.paid_at, gp.created_at, gp.updated_at,
                 g.username AS guarantor_username,
                 (SELECT COUNT(*) FROM guarantor_payment_items x WHERE x.guarantor_payment_id = gp.id)::int AS items`;

export async function listGuarantorPayments(user: CurrentUser, url: URL, unpaged = false) {
  const admin = isAdmin(user);
  const { page, size, offset } = pageParams(url);
  const w = new Where();
  if (!admin) w.add('gp.guarantor_id = ?', user.id);
  const sp = url.searchParams;
  const gid = sp.get('guarantor_id'); if (admin && gid) w.add('gp.guarantor_id = ?', parseInt(gid, 10) || 0);
  const q = sp.get('q')?.trim();
  if (q && admin) { const l = likeTerm(q); w.add('(g.username ILIKE ? OR gp.transaction_id ILIKE ? OR gp.id::text = ?)', l, l, q.replace(/^#/, '')); }
  const st = sp.get('status'); if (st) w.add('gp.status = ?', st);
  const month = sp.get('month'); if (month) w.add('gp.period_month = ?::date', normaliseMonth(month));
  const from = sp.get('from'); if (from) w.add('gp.period_month >= date_trunc(\'month\', ?::date)', from);
  const to = sp.get('to'); if (to) w.add('gp.period_month <= ?::date', to);
  const order = sortParam(url, { month: 'gp.period_month', amount: 'gp.amount', status: 'gp.status', guarantor: 'g.username' }, '-month');
  const extra = admin ? ', gp.notes, gp.paid_to, g.payout_method, g.payout_account' : '';
  const from_ = 'FROM guarantor_payments gp JOIN users g ON g.id = gp.guarantor_id';
  const [{ count, total_amount }] = await query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(gp.amount),0) AS total_amount ${from_} ${w.sql}`, w.params);
  const rows = await query(`SELECT ${GP_COLS}${extra},
      (SELECT c.id FROM payment_claims c WHERE c.guarantor_payment_id = gp.id AND c.status IN ('OPEN','UNDER_REVIEW') LIMIT 1) AS open_claim_id,
      EXISTS (SELECT 1 FROM payment_claims c WHERE c.guarantor_payment_id = gp.id AND c.status = 'REJECTED') AS had_rejected_claim
      ${from_} ${w.sql} ORDER BY ${order}, gp.id DESC LIMIT ${unpaged ? 5000 : size} OFFSET ${unpaged ? 0 : offset}`, w.params);
  return { rows, total: count, total_amount, page, size };
}

export async function getGuarantorPayment(user: CurrentUser, id: number) {
  const admin = isAdmin(user);
  const [gp] = await query(`SELECT ${GP_COLS}${admin ? ', gp.notes, gp.paid_to, g.payout_method, g.payout_account' : ''} FROM guarantor_payments gp JOIN users g ON g.id = gp.guarantor_id
                            WHERE gp.id = $1 ${admin ? '' : 'AND gp.guarantor_id = $2'}`, admin ? [id] : [id, user.id]);
  if (!gp) throw notFound('Payment not found');
  const items = await query(
    `SELECT x.investment_id, x.amount, i.verified_at, i.snap_title, u.username AS investor_username, i.amount AS investment_amount
       FROM guarantor_payment_items x JOIN investments i ON i.id = x.investment_id JOIN users u ON u.id = i.investor_id
      WHERE x.guarantor_payment_id = $1 ORDER BY i.verified_at`, [id]);
  const claims = await query(`SELECT c.id, c.status, c.reason, c.created_at, c.resolved_at, c.resolution_note, c.replacement_transaction_id FROM payment_claims c WHERE c.guarantor_payment_id = $1 ORDER BY c.created_at DESC`, [id]);
  return { payment: gp, items, claims };
}

const gpAction = z.object({ action: z.enum(['process', 'pay', 'note']), transaction_id: z.string().optional(), notes: noteSchema });
export async function actOnGuarantorPayment(admin: CurrentUser, id: number, raw: unknown) {
  const b = gpAction.parse(raw);
  return tx(async t => {
    const [gp] = await t.q('SELECT * FROM guarantor_payments WHERE id = $1 FOR UPDATE', [id]);
    if (!gp) throw notFound('Payment not found');
    if (b.action === 'note') {
      const [row] = await t.q('UPDATE guarantor_payments SET notes = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, b.notes || null]);
      await audit(t, admin.id, 'guarantor_payment.note_updated', 'guarantor_payment', id, {});
      return row;
    }
    if (!['PENDING', 'PROCESSING'].includes(gp.status)) throw conflict(`This payment is already ${gp.status.toLowerCase().replace(/_/g, ' ')}.`, 'ALREADY_PROCESSED');
    if (b.action === 'process') {
      if (gp.status === 'PROCESSING') throw conflict('This payment is already being processed.', 'ALREADY_PROCESSED');
      const [row] = await t.q(`UPDATE guarantor_payments SET status = 'PROCESSING', processed_by = $2, notes = COALESCE($3, notes), updated_at = now() WHERE id = $1 RETURNING *`, [id, admin.id, b.notes || null]);
      await audit(t, admin.id, 'guarantor_payment.processing', 'guarantor_payment', id, { amount: gp.amount });
      return row;
    }
    const txn = txnSchema.parse(b.transaction_id);
    await assertTxnUnused(t, txn, { gp: id });
    const [g] = await t.q('SELECT payout_method, payout_account FROM users WHERE id = $1', [gp.guarantor_id]);
    const paidTo = g?.payout_account ? `${g.payout_method || 'Account'}: ${g.payout_account}` : 'No payout account on file';
    const [row] = await t.q(`UPDATE guarantor_payments SET status = 'PAID', transaction_id = $2, paid_at = now(), paid_to = $3, processed_by = $4, notes = COALESCE($5, notes), updated_at = now() WHERE id = $1 RETURNING *`,
      [id, txn, paidTo, admin.id, b.notes || null]);
    await audit(t, admin.id, 'guarantor_payment.paid', 'guarantor_payment', id, { amount: gp.amount, transaction_id: txn, period_month: gp.period_month });
    await notify(t, gp.guarantor_id, { type: 'GUARANTOR_PAID', title: 'Payment sent', body: `${formatMoney(gp.amount)} for ${formatMonth(gp.period_month)}. Transaction ID: ${txn}`, link: '/guarantor/payments' });
    return row;
  });
}
