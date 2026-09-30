import { z } from 'zod';
import { query, tx, Tx } from '../db';
import { audit } from '../audit';
import { notify } from '../notify';
import { bad, conflict, notFound, Where, likeTerm, pageParams, sortParam } from '../api';
import { noteSchema, txnSchema } from '../validators';
import { APP_TIMEZONE } from '../config';
import { formatMoney } from '../format';
import type { CurrentUser } from '../session';
import { isAdmin } from '../session';
import { materializeDue } from './investments';

export const PAYOUT_DISPLAY = `(CASE WHEN p.status = 'DUE' AND p.due_at > now() THEN 'SCHEDULED' ELSE p.status END)`;
const OVERDUE_HOURS = 24; // business assumption: a payout is "overdue" once it is >24h past due_at

export async function assertTxnUnused(t: Tx, txn: string, exclude: { payout?: number; gp?: number } = {}) {
  const dup = await t.q(
    `SELECT 'payout #' || id AS ref FROM payouts WHERE lower(transaction_id) = lower($1) AND id <> $2
     UNION ALL SELECT 'guarantor payment #' || id FROM guarantor_payments WHERE lower(transaction_id) = lower($1) AND id <> $3 LIMIT 1`,
    [txn, exclude.payout ?? 0, exclude.gp ?? 0]);
  if (dup.length) throw conflict(`Transaction ID "${txn}" is already recorded on ${dup[0].ref}.`, 'DUPLICATE_TXN');
}

export async function listPayouts(user: CurrentUser, url: URL, unpaged = false) {
  await materializeDue();
  const admin = isAdmin(user);
  const { page, size, offset } = pageParams(url);
  const w = new Where();
  if (!admin) w.add('p.investor_id = ?', user.id);
  const sp = url.searchParams;
  const q = sp.get('q')?.trim();
  if (q && admin) { const l = likeTerm(q); w.add('(u.username ILIKE ? OR p.transaction_id ILIKE ? OR p.investment_id::text = ? OR p.id::text = ? OR i.snap_title ILIKE ?)', l, l, q.replace(/^#/, ''), q.replace(/^#/, ''), l); }
  const st = sp.get('status'); if (st) w.add(`${PAYOUT_DISPLAY} = ?`, st);
  if (sp.get('overdue') === '1') w.add(`p.status IN ('DUE','PROCESSING') AND p.due_at <= now() - interval '${OVERDUE_HOURS} hours'`);
  const from = sp.get('from'); if (from) w.add(`p.due_at >= (?::date::timestamp AT TIME ZONE '${APP_TIMEZONE}')`, from);
  const to = sp.get('to'); if (to) w.add(`p.due_at < ((?::date + 1)::timestamp AT TIME ZONE '${APP_TIMEZONE}')`, to);
  const order = sortParam(url, { due: 'p.due_at', amount: 'p.amount', paid: 'p.paid_at', created: 'p.created_at' }, 'due');
  const cols = `p.id, p.investment_id, p.investor_id, p.amount, p.principal, p.profit, p.status, ${PAYOUT_DISPLAY} AS display_status, p.due_at, p.transaction_id, p.paid_at, p.created_at,
                i.snap_title, u.username AS investor_username,
                (p.status IN ('DUE','PROCESSING') AND p.due_at <= now() - interval '${OVERDUE_HOURS} hours') AS overdue
                ${admin ? ', p.notes, p.paid_to, u.payout_method, u.payout_account, p.replacement_transaction_id' : ', p.replacement_transaction_id'}`;
  const from_ = 'FROM payouts p JOIN investments i ON i.id = p.investment_id JOIN users u ON u.id = p.investor_id';
  const [{ count, total_amount }] = await query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(p.amount),0) AS total_amount ${from_} ${w.sql}`, w.params);
  const rows = await query(`SELECT ${cols} ${from_} ${w.sql} ORDER BY ${order}, p.id DESC LIMIT ${unpaged ? 5000 : size} OFFSET ${unpaged ? 0 : offset}`, w.params);
  return { rows, total: count, total_amount, page, size };
}

const payActionSchema = z.object({ action: z.enum(['process', 'pay', 'note']), transaction_id: z.string().optional(), notes: noteSchema });

export async function actOnPayout(admin: CurrentUser, id: number, raw: unknown) {
  const b = payActionSchema.parse(raw);
  return tx(async t => {
    const [p] = await t.q(`SELECT p.*, (p.due_at <= now()) AS is_due FROM payouts p WHERE p.id = $1 FOR UPDATE`, [id]);
    if (!p) throw notFound('Payout not found');
    if (b.action === 'note') {
      const [row] = await t.q('UPDATE payouts SET notes = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, b.notes || null]);
      await audit(t, admin.id, 'payout.note_updated', 'payout', id, {});
      return row;
    }
    if (!['DUE', 'PROCESSING'].includes(p.status)) throw conflict(`This payout is already ${p.status.toLowerCase().replace(/_/g, ' ')}.`, 'ALREADY_PROCESSED');
    if (!p.is_due) throw conflict('This payout is not due yet — the 7-day period has not elapsed.', 'NOT_DUE');
    if (b.action === 'process') {
      if (p.status === 'PROCESSING') throw conflict('This payout is already being processed.', 'ALREADY_PROCESSED');
      const [row] = await t.q(`UPDATE payouts SET status = 'PROCESSING', processed_by = $2, notes = COALESCE($3, notes), updated_at = now() WHERE id = $1 RETURNING *`, [id, admin.id, b.notes || null]);
      await audit(t, admin.id, 'payout.processing', 'payout', id, { amount: p.amount });
      return row;
    }
    const txn = txnSchema.parse(b.transaction_id);
    await assertTxnUnused(t, txn, { payout: id });
    const [u] = await t.q('SELECT payout_method, payout_account FROM users WHERE id = $1', [p.investor_id]);
    const paidTo = u?.payout_account ? `${u.payout_method || 'Account'}: ${u.payout_account}` : 'No payout account on file';
    const [row] = await t.q(
      `UPDATE payouts SET status = 'PAID', transaction_id = $2, paid_at = now(), paid_to = $3, processed_by = $4, notes = COALESCE($5, notes), updated_at = now() WHERE id = $1 RETURNING *`,
      [id, txn, paidTo, admin.id, b.notes || null]);
    await t.q(`UPDATE investments SET status = 'COMPLETED', updated_at = now() WHERE id = $1`, [p.investment_id]);
    await audit(t, admin.id, 'payout.paid', 'payout', id, { amount: p.amount, transaction_id: txn, investment_id: p.investment_id });
    await notify(t, p.investor_id, { type: 'PAYOUT_PAID', title: 'Payout sent', body: `${formatMoney(p.amount)} has been sent. Transaction ID: ${txn}`, link: `/investments/${p.investment_id}` });
    return row;
  });
}
