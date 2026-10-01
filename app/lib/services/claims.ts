import { z } from 'zod';
import { query, tx } from '../db';
import { audit } from '../audit';
import { notify, notifyAdmins } from '../notify';
import { bad, conflict, notFound, Where, likeTerm, pageParams, sortParam } from '../api';
import { noteSchema, reasonSchema, txnSchema } from '../validators';
import { formatMoney, formatMonth } from '../format';
import type { CurrentUser } from '../session';
import { isAdmin } from '../session';
import { assertTxnUnused } from './payouts';

const createSchema = z.object({ guarantor_payment_id: z.coerce.number().int().positive().optional(), payout_id: z.coerce.number().int().positive().optional(), reason: reasonSchema })
  .refine(v => (v.guarantor_payment_id ? 1 : 0) + (v.payout_id ? 1 : 0) === 1, 'Specify exactly one payment');

/** "I did not receive this payment". Never reverses the payment — it opens a claim and flags the payment. Idempotent. */
export async function createClaim(user: CurrentUser, raw: unknown) {
  const v = createSchema.parse(raw);
  return tx(async t => {
    const isGp = !!v.guarantor_payment_id;
    const table = isGp ? 'guarantor_payments' : 'payouts';
    const targetId = (isGp ? v.guarantor_payment_id : v.payout_id)!;
    const [target] = await t.q(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [targetId]);
    const ownerId = target && (isGp ? target.guarantor_id : target.investor_id);
    if (!target || ownerId !== user.id) throw notFound('Payment not found');   // 404, not 403: don't reveal other people's payments
    const col = isGp ? 'guarantor_payment_id' : 'payout_id';
    const [open] = await t.q(`SELECT * FROM payment_claims WHERE ${col} = $1 AND status IN ('OPEN','UNDER_REVIEW')`, [targetId]);
    if (open) return { claim: open, duplicate: true };
    if (target.status !== 'PAID') throw conflict(target.status === 'RESOLVED' ? 'This payment was already reviewed and resolved.' : 'You can only report a payment after it has been marked as paid.', 'NOT_CLAIMABLE');
    const [prev] = await t.q(`SELECT 1 FROM payment_claims WHERE ${col} = $1 AND status = 'REJECTED' LIMIT 1`, [targetId]);
    if (prev) throw conflict('An earlier claim for this payment was reviewed and rejected. Please contact the administrator directly.', 'CLAIM_REJECTED_BEFORE');
    const [claim] = await t.q(`INSERT INTO payment_claims (${col}, claimant_id, reason) VALUES ($1,$2,$3) RETURNING *`, [targetId, user.id, v.reason]);
    await t.q(`UPDATE ${table} SET status = 'CLAIMED_NOT_RECEIVED', updated_at = now() WHERE id = $1`, [targetId]);
    await audit(t, user.id, 'payment_claim.opened', 'payment_claim', claim.id, { [col]: targetId, amount: target.amount, transaction_id: target.transaction_id });
    await notifyAdmins(t, { type: 'CLAIM_OPENED', title: 'Payment claim opened', body: `${user.username} reports not receiving ${formatMoney(target.amount)}.`, link: `/admin/claims?id=${claim.id}` });
    await notify(t, user.id, { type: 'CLAIM_SUBMITTED', title: 'Your claim has been submitted', body: 'An administrator will review the payment and update you here.', link: isGp ? '/guarantor/payments' : `/payouts` });
    return { claim, duplicate: false };
  });
}

const CLAIM_FROM = `FROM payment_claims c JOIN users cu ON cu.id = c.claimant_id
  LEFT JOIN guarantor_payments gp ON gp.id = c.guarantor_payment_id LEFT JOIN payouts p ON p.id = c.payout_id`;
const kind = `CASE WHEN c.guarantor_payment_id IS NOT NULL THEN 'GUARANTOR_PAYMENT' ELSE 'INVESTOR_PAYOUT' END`;

export async function listClaims(user: CurrentUser, url: URL) {
  const admin = isAdmin(user) && url.searchParams.get('scope') !== 'mine';
  const { page, size, offset } = pageParams(url);
  const w = new Where();
  if (!admin) w.add('c.claimant_id = ?', user.id);
  const sp = url.searchParams;
  const q = sp.get('q')?.trim();
  if (q && admin) { const l = likeTerm(q); w.add('(cu.username ILIKE ? OR COALESCE(gp.transaction_id, p.transaction_id) ILIKE ? OR c.id::text = ?)', l, l, q.replace(/^#/, '')); }
  const st = sp.get('status'); if (st) w.add('c.status = ?', st);
  const k = sp.get('kind'); if (k === 'GUARANTOR_PAYMENT') w.add('c.guarantor_payment_id IS NOT NULL'); if (k === 'INVESTOR_PAYOUT') w.add('c.payout_id IS NOT NULL');
  const order = sortParam(url, { created: 'c.created_at', status: 'c.status' }, '-created');
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count ${CLAIM_FROM} ${w.sql}`, w.params);
  const rows = await query(
    `SELECT c.id, c.status, c.reason, c.resolution_note, c.replacement_transaction_id, c.created_at, c.resolved_at, ${kind} AS kind,
            c.guarantor_payment_id, c.payout_id, cu.username AS claimant,
            COALESCE(gp.amount, p.amount) AS amount, COALESCE(gp.transaction_id, p.transaction_id) AS transaction_id, COALESCE(gp.paid_at, p.paid_at) AS paid_at,
            gp.period_month ${admin ? ', c.admin_notes' : ''}
       ${CLAIM_FROM} ${w.sql} ORDER BY ${order}, c.id DESC LIMIT ${size} OFFSET ${offset}`, w.params);
  return { rows, total: count, page, size };
}

const actionSchema = z.object({
  action: z.enum(['review', 'note', 'resolve', 'reject']),
  note: noteSchema, resolution_note: z.string().trim().max(1000).optional(), replacement_transaction_id: z.string().optional().nullable(),
});

export async function actOnClaim(admin: CurrentUser, id: number, raw: unknown) {
  const b = actionSchema.parse(raw);
  return tx(async t => {
    const [c] = await t.q('SELECT * FROM payment_claims WHERE id = $1 FOR UPDATE', [id]);
    if (!c) throw notFound('Claim not found');
    const isGp = !!c.guarantor_payment_id;
    const table = isGp ? 'guarantor_payments' : 'payouts', tid = isGp ? c.guarantor_payment_id : c.payout_id;
    if (b.action === 'note') {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const text = (b.note || '').trim(); if (!text) throw bad('Write a note first');
      const [row] = await t.q(`UPDATE payment_claims SET admin_notes = COALESCE(admin_notes || E'\\n', '') || $2, updated_at = now() WHERE id = $1 RETURNING *`, [id, `[${stamp} UTC · ${admin.username}] ${text}`]);
      await audit(t, admin.id, 'payment_claim.note_added', 'payment_claim', id, {});
      return row;
    }
    if (!['OPEN', 'UNDER_REVIEW'].includes(c.status)) throw conflict(`This claim is already ${c.status.toLowerCase().replace(/_/g, ' ')}.`, 'ALREADY_PROCESSED');
    if (b.action === 'review') {
      if (c.status === 'UNDER_REVIEW') throw conflict('This claim is already under review.', 'ALREADY_PROCESSED');
      const [row] = await t.q(`UPDATE payment_claims SET status = 'UNDER_REVIEW', updated_at = now() WHERE id = $1 RETURNING *`, [id]);
      await audit(t, admin.id, 'payment_claim.under_review', 'payment_claim', id, {});
      await notify(t, c.claimant_id, { type: 'CLAIM_UPDATED', title: 'Your claim is being reviewed', link: isGp ? '/guarantor/payments' : '/payouts' });
      return row;
    }
    const note = reasonSchema.parse(b.resolution_note);
    const repl = b.replacement_transaction_id ? txnSchema.parse(b.replacement_transaction_id) : null;
    if (repl && b.action === 'resolve') await assertTxnUnused(t, repl, isGp ? { gp: tid } : { payout: tid });
    const resolved = b.action === 'resolve';
    const [row] = await t.q(
      `UPDATE payment_claims SET status = $2, resolution_note = $3, replacement_transaction_id = $4, resolved_at = now(), resolved_by = $5, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, resolved ? 'RESOLVED' : 'REJECTED', note, resolved ? repl : null, admin.id]);
    // rejected → payment reverts to PAID (the original payment stands); resolved → RESOLVED (+ replacement transaction if issued)
    await t.q(`UPDATE ${table} SET status = $2, replacement_transaction_id = COALESCE($3, replacement_transaction_id), updated_at = now() WHERE id = $1`, [tid, resolved ? 'RESOLVED' : 'PAID', resolved ? repl : null]);
    await audit(t, admin.id, resolved ? 'payment_claim.resolved' : 'payment_claim.rejected', 'payment_claim', id, { [isGp ? 'guarantor_payment_id' : 'payout_id']: tid, replacement_transaction_id: repl, resolution_note: note });
    await notify(t, c.claimant_id, { type: 'CLAIM_UPDATED', title: resolved ? 'Your claim was resolved' : 'Your claim was reviewed', body: note + (repl ? ` Replacement transaction ID: ${repl}` : ''), link: isGp ? '/guarantor/payments' : '/payouts' });
    return row;
  });
}
