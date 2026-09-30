import { z } from 'zod';
import { query, tx } from '../db';
import { APP_TIMEZONE } from '../config';
import { audit } from '../audit';
import { bad, conflict, notFound, Where, likeTerm } from '../api';
import { accountSchema } from '../validators';
import { toPaisa, fromPaisa } from '../money';
import type { CurrentUser } from '../session';

/** Start of "today" in the app timezone, as timestamptz. */
export const DAY_START_SQL = `(date_trunc('day', now() AT TIME ZONE '${APP_TIMEZONE.replace(/'/g, '')}') AT TIME ZONE '${APP_TIMEZONE.replace(/'/g, '')}')`;

export const ACCOUNT_SELECT = `
  pa.*,
  CASE WHEN pa.total_limit IS NULL THEN NULL ELSE pa.total_limit - pa.allocated_amount END AS remaining_amount,
  COALESCE((SELECT SUM(i.amount) FROM investments i WHERE i.payment_account_id = pa.id AND i.status <> 'REJECTED' AND i.created_at >= ${DAY_START_SQL}), 0) AS today_amount,
  (SELECT COUNT(*) FROM funding_need_accounts f WHERE f.payment_account_id = pa.id)::int AS assigned_needs,
  (SELECT COUNT(*) FROM investments i WHERE i.payment_account_id = pa.id)::int AS investments_count,
  CASE
    WHEN pa.status = 'INACTIVE' THEN 'INACTIVE'
    WHEN pa.total_limit IS NOT NULL AND pa.allocated_amount >= pa.total_limit THEN 'LIMIT_REACHED'
    WHEN pa.daily_limit IS NOT NULL AND COALESCE((SELECT SUM(i.amount) FROM investments i WHERE i.payment_account_id = pa.id AND i.status <> 'REJECTED' AND i.created_at >= ${DAY_START_SQL}), 0) >= pa.daily_limit THEN 'DAILY_LIMIT_REACHED'
    WHEN pa.total_limit IS NOT NULL AND pa.allocated_amount * 100 >= pa.total_limit * COALESCE((SELECT (value #>> '{}')::numeric FROM settings WHERE key = 'near_limit_pct'), 90) THEN 'NEAR_LIMIT'
    ELSE 'ACTIVE'
  END AS availability`;

export async function listAccounts(url: URL) {
  const w = new Where();
  const q = url.searchParams.get('q')?.trim();
  if (q) w.add('(pa.account_name ILIKE ? OR pa.account_holder_name ILIKE ? OR pa.account_number ILIKE ?)', likeTerm(q), likeTerm(q), likeTerm(q));
  const st = url.searchParams.get('status');
  if (st === 'ACTIVE' || st === 'INACTIVE') w.add('pa.status = ?', st);
  const prov = url.searchParams.get('provider');
  if (prov) w.add('pa.provider = ?', prov);
  const rows = await query(`SELECT ${ACCOUNT_SELECT} FROM payment_accounts pa ${w.sql} ORDER BY pa.status ASC, pa.updated_at DESC`, w.params);
  const filter = url.searchParams.get('availability');
  return { rows: filter ? rows.filter((r: any) => r.availability === filter) : rows };
}

export async function getAccount(id: number) {
  const rows = await query(`SELECT ${ACCOUNT_SELECT} FROM payment_accounts pa WHERE pa.id = $1`, [id]);
  if (!rows[0]) throw notFound('Payment account not found');
  const needs = await query(
    `SELECT fn.id, fn.title, fn.status, fna.priority FROM funding_need_accounts fna JOIN funding_needs fn ON fn.id = fna.funding_need_id
      WHERE fna.payment_account_id = $1 ORDER BY fn.created_at DESC`, [id]);
  const recent = await query(
    `SELECT i.id, i.amount, i.status, i.created_at, u.username AS investor, fn.title AS funding_need
       FROM investments i JOIN users u ON u.id = i.investor_id JOIN funding_needs fn ON fn.id = i.funding_need_id
      WHERE i.payment_account_id = $1 ORDER BY i.created_at DESC LIMIT 25`, [id]);
  const totals = await query(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status='PENDING_VERIFICATION'),0) AS pending,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('VERIFIED','PAYOUT_DUE','COMPLETED')),0) AS verified,
            COALESCE(SUM(amount) FILTER (WHERE status='REJECTED'),0) AS rejected
       FROM investments WHERE payment_account_id = $1`, [id]);
  return { account: rows[0], assigned_needs: needs, recent_investments: recent, totals: totals[0] };
}

function normalise(v: z.infer<typeof accountSchema>) {
  const money = (x?: string | null) => (x === undefined || x === null || x === '' ? null : fromPaisa(toPaisa(x)));
  const daily = money(v.daily_limit), total = money(v.total_limit);
  if (daily !== null && toPaisa(daily) <= 0n) throw bad('Daily limit must be greater than zero');
  if (total !== null && toPaisa(total) <= 0n) throw bad('Total limit must be greater than zero');
  return {
    ...v, daily_limit: daily, total_limit: total,
    bank_name: v.provider === 'BANK' ? v.bank_name || null : null,
    iban: v.iban ? v.iban.replace(/\s/g, '') : null,
    instructions: v.instructions || null, notes: v.notes || null,
  };
}

export async function createAccount(user: CurrentUser, raw: unknown) {
  const v = normalise(accountSchema.parse(raw));
  return tx(async t => {
    const [row] = await t.q(
      `INSERT INTO payment_accounts (account_name, provider, bank_name, account_holder_name, account_number, iban, instructions, daily_limit, total_limit, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [v.account_name, v.provider, v.bank_name, v.account_holder_name, v.account_number, v.iban, v.instructions, v.daily_limit, v.total_limit, v.notes, user.id]);
    await audit(t, user.id, 'payment_account.created', 'payment_account', row.id, { account_name: v.account_name, provider: v.provider });
    return row;
  });
}

export async function updateAccount(user: CurrentUser, id: number, raw: unknown) {
  const v = normalise(accountSchema.parse(raw));
  return tx(async t => {
    const [cur] = await t.q('SELECT * FROM payment_accounts WHERE id = $1 FOR UPDATE', [id]);
    if (!cur) throw notFound('Payment account not found');
    if (v.total_limit !== null && toPaisa(v.total_limit) < toPaisa(cur.allocated_amount))
      throw conflict(`Total limit cannot be lower than the PKR ${cur.allocated_amount} already routed to this account.`);
    const [row] = await t.q(
      `UPDATE payment_accounts SET account_name=$2, provider=$3, bank_name=$4, account_holder_name=$5, account_number=$6, iban=$7,
              instructions=$8, daily_limit=$9, total_limit=$10, notes=$11, updated_at=now() WHERE id=$1 RETURNING *`,
      [id, v.account_name, v.provider, v.bank_name, v.account_holder_name, v.account_number, v.iban, v.instructions, v.daily_limit, v.total_limit, v.notes]);
    const changed: Record<string, [any, any]> = {};
    for (const k of ['account_name', 'provider', 'bank_name', 'account_holder_name', 'account_number', 'iban', 'instructions', 'daily_limit', 'total_limit', 'notes'])
      if (String(cur[k] ?? '') !== String(row[k] ?? '')) changed[k] = [cur[k], row[k]];
    await audit(t, user.id, 'payment_account.updated', 'payment_account', id, { changed, note: 'Existing investments keep their original snapshot.' });
    return row;
  });
}

export async function setAccountStatus(user: CurrentUser, id: number, action: 'deactivate' | 'reactivate') {
  return tx(async t => {
    const [cur] = await t.q('SELECT * FROM payment_accounts WHERE id = $1 FOR UPDATE', [id]);
    if (!cur) throw notFound('Payment account not found');
    const target = action === 'deactivate' ? 'INACTIVE' : 'ACTIVE';
    if (cur.status === target) return { ...cur, warnings: [] };
    const [row] = await t.q('UPDATE payment_accounts SET status=$2, updated_at=now() WHERE id=$1 RETURNING *', [id, target]);
    await audit(t, user.id, action === 'deactivate' ? 'payment_account.deactivated' : 'payment_account.reactivated', 'payment_account', id, { account_name: cur.account_name });
    const warnings: string[] = [];
    if (action === 'deactivate') {
      const stranded = await t.q(
        `SELECT fn.id, fn.title FROM funding_needs fn
          WHERE fn.status IN ('OPEN','FULL') AND EXISTS (SELECT 1 FROM funding_need_accounts f WHERE f.funding_need_id = fn.id AND f.payment_account_id = $1)
            AND NOT EXISTS (SELECT 1 FROM funding_need_accounts f JOIN payment_accounts p ON p.id = f.payment_account_id WHERE f.funding_need_id = fn.id AND p.status = 'ACTIVE')`, [id]);
      for (const n of stranded) warnings.push(`"${n.title}" now has no active payment account, so investors cannot submit until you assign another.`);
    }
    return { ...row, warnings };
  });
}
