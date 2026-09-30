import { z } from 'zod';
import { query, tx, Tx } from '../db';
import { audit } from '../audit';
import { bad, conflict, notFound, Where, likeTerm, pageParams, sortParam } from '../api';
import { calcNeed, validatePricing } from '../calc';
import { needSchema, reasonSchema } from '../validators';
import { toPaisa } from '../money';
import type { CurrentUser } from '../session';
import { ACCOUNT_SELECT } from './accounts';

export const NEED_SELECT = `fn.*, (SELECT COUNT(*) FROM investments i WHERE i.funding_need_id = fn.id)::int AS investments_count,
  (SELECT COUNT(*) FROM investments i WHERE i.funding_need_id = fn.id AND i.status = 'PENDING_VERIFICATION')::int AS pending_count,
  (SELECT COUNT(*) FROM funding_need_accounts f WHERE f.funding_need_id = fn.id)::int AS accounts_count`;

export async function listNeedsAdmin(url: URL) {
  const { page, size, offset } = pageParams(url);
  const w = new Where();
  const q = url.searchParams.get('q')?.trim();
  if (q) w.add('(fn.title ILIKE ? OR fn.product ILIKE ? OR fn.id::text = ?)', likeTerm(q), likeTerm(q), q.replace(/^#/, ''));
  const st = url.searchParams.get('status'); if (st) w.add('fn.status = ?', st);
  const from = url.searchParams.get('from'); if (from) w.add('fn.created_at >= ?::date', from);
  const to = url.searchParams.get('to'); if (to) w.add("fn.created_at < (?::date + 1)", to);
  const order = sortParam(url, { created: 'fn.created_at', title: 'fn.title', capital: 'fn.total_capital', funded: 'fn.funded_amount', status: 'fn.status' }, '-created');
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM funding_needs fn ${w.sql}`, w.params);
  const rows = await query(`SELECT ${NEED_SELECT} FROM funding_needs fn ${w.sql} ORDER BY ${order} LIMIT ${size} OFFSET ${offset}`, w.params);
  return { rows, total: count, page, size };
}

/** Investor-facing catalogue: OPEN needs only, no internal fields (guarantor share, creator, notes). */
export async function listNeedsInvestor() {
  const rows = await query(
    `SELECT fn.id, fn.title, fn.product, fn.description, fn.quantity, fn.cost_price, fn.sell_price, fn.op_cost, fn.investor_pct,
            fn.total_capital, fn.funded_amount, fn.remaining_amount, fn.status, fn.opened_at, fn.guarantor_pct,
            (SELECT COUNT(*) FROM funding_need_accounts f JOIN payment_accounts p ON p.id = f.payment_account_id WHERE f.funding_need_id = fn.id AND p.status='ACTIVE')::int AS active_accounts
       FROM funding_needs fn WHERE fn.status IN ('OPEN','FULL') ORDER BY fn.opened_at DESC NULLS LAST, fn.id DESC`);
  return { rows: rows.map(investorNeedView) };
}

export function investorNeedView(n: any) {
  const c = calcNeed(n);
  const { guarantor_pct, ...safe } = n;
  return {
    ...safe,
    calc: { investor_return_per_bottle: c.investor_return_per_bottle, investor_profit_per_bottle: c.investor_profit_per_bottle, investor_return_pct: c.investor_return_pct },
  };
}

async function accountsFor(id: number) {
  return query(`SELECT ${ACCOUNT_SELECT}, fna.priority FROM funding_need_accounts fna JOIN payment_accounts pa ON pa.id = fna.payment_account_id WHERE fna.funding_need_id = $1 ORDER BY fna.priority, pa.id`, [id]);
}

export async function getNeedAdmin(id: number) {
  const [n] = await query(`SELECT ${NEED_SELECT}, u.username AS created_by_username FROM funding_needs fn LEFT JOIN users u ON u.id = fn.created_by WHERE fn.id = $1`, [id]);
  if (!n) throw notFound('Funding need not found');
  const [accounts, sums, activity, guarantorImpact] = await Promise.all([
    accountsFor(id),
    query(`SELECT COALESCE(SUM(amount) FILTER (WHERE status='PENDING_VERIFICATION'),0) AS pending_amount,
                  COALESCE(SUM(amount) FILTER (WHERE status IN ('VERIFIED','PAYOUT_DUE','COMPLETED')),0) AS verified_amount,
                  COALESCE(SUM(expected_total_return) FILTER (WHERE status IN ('VERIFIED','PAYOUT_DUE')),0) AS outstanding_payouts,
                  COALESCE(SUM(expected_total_return) FILTER (WHERE status = 'COMPLETED'),0) AS paid_payouts,
                  COALESCE(SUM(expected_investor_profit) FILTER (WHERE status IN ('VERIFIED','PAYOUT_DUE','COMPLETED')),0) AS investor_profit,
                  COALESCE(SUM(business_profit) FILTER (WHERE status IN ('VERIFIED','PAYOUT_DUE','COMPLETED')),0) AS business_profit
             FROM investments WHERE funding_need_id = $1`, [id]),
    query(`SELECT a.id, a.action, a.metadata, a.created_at, u.username AS actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
            WHERE (a.entity_type = 'funding_need' AND a.entity_id = $1::text)
               OR (a.entity_type = 'investment' AND a.entity_id IN (SELECT id::text FROM investments WHERE funding_need_id = $1))
            ORDER BY a.created_at DESC LIMIT 30`, [id]),
    query(`SELECT g.username AS guarantor, COUNT(*)::int AS investments, COALESCE(SUM(i.guarantor_profit),0) AS earnings
             FROM investments i JOIN users g ON g.id = i.guarantor_id
            WHERE i.funding_need_id = $1 AND i.status IN ('VERIFIED','PAYOUT_DUE','COMPLETED') GROUP BY g.username ORDER BY earnings DESC`, [id]),
  ]);
  return { need: n, calc: calcNeed(n), accounts, summary: sums[0], activity, guarantor_impact: guarantorImpact };
}

async function assignAccounts(t: Tx, user: CurrentUser, needId: number, ids: number[]) {
  const uniq = Array.from(new Set(ids));
  if (uniq.length) {
    const found = await t.q('SELECT id FROM payment_accounts WHERE id = ANY($1::int[])', [uniq]);
    if (found.length !== uniq.length) throw bad('One or more payment accounts do not exist');
  }
  const before = (await t.q('SELECT payment_account_id AS id FROM funding_need_accounts WHERE funding_need_id = $1', [needId])).map((r: any) => r.id);
  await t.q('DELETE FROM funding_need_accounts WHERE funding_need_id = $1 AND NOT (payment_account_id = ANY($2::int[]))', [needId, uniq]);
  for (let i = 0; i < uniq.length; i++)
    await t.q(`INSERT INTO funding_need_accounts (funding_need_id, payment_account_id, priority, assigned_by) VALUES ($1,$2,$3,$4)
               ON CONFLICT (funding_need_id, payment_account_id) DO UPDATE SET priority = EXCLUDED.priority`, [needId, uniq[i], i, user.id]);
  const added = uniq.filter(x => !before.includes(x)), removed = before.filter((x: number) => !uniq.includes(x));
  if (added.length || removed.length) await audit(t, user.id, 'funding_need.accounts_assigned', 'funding_need', needId, { added, removed, order: uniq });
}

export async function createNeed(user: CurrentUser, raw: unknown) {
  const v: any = needSchema.parse(raw);
  const p = validatePricing(v);
  const c = calcNeed({ ...v, ...p });
  if (v.open_now && !(v.account_ids && v.account_ids.length)) throw bad('Assign at least one payment account before opening a funding need.');
  return tx(async t => {
    const [row] = await t.q(
      `INSERT INTO funding_needs (title, product, description, quantity, cost_price, sell_price, op_cost, investor_pct, guarantor_pct, total_capital, status, opened_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [v.title, v.product, v.description || null, v.quantity, p.cost_price, p.sell_price, p.op_cost, p.investor_pct, p.guarantor_pct, c.total_capital,
       v.open_now ? 'OPEN' : 'DRAFT', v.open_now ? new Date() : null, user.id]);
    if (v.account_ids?.length) await assignAccounts(t, user, row.id, v.account_ids);
    await audit(t, user.id, 'funding_need.created', 'funding_need', row.id, { title: v.title, total_capital: c.total_capital, status: row.status });
    return row;
  });
}

const PRICING_FIELDS = ['cost_price', 'sell_price', 'op_cost', 'investor_pct', 'guarantor_pct'] as const;

export async function updateNeed(user: CurrentUser, id: number, raw: unknown) {
  const v: any = needSchema.parse(raw);
  const p = validatePricing(v);
  return tx(async t => {
    const [cur] = await t.q('SELECT * FROM funding_needs WHERE id = $1 FOR UPDATE', [id]);
    if (!cur) throw notFound('Funding need not found');
    if (cur.status === 'CANCELLED' || cur.status === 'COMPLETED') throw conflict(`A ${cur.status.toLowerCase()} funding need cannot be edited.`);
    const [{ n }] = await t.q('SELECT COUNT(*)::int AS n FROM investments WHERE funding_need_id = $1', [id]);
    const pricingChanged = PRICING_FIELDS.some(k => toPaisa((p as any)[k]) !== toPaisa(cur[k]));
    if (pricingChanged && n > 0)
      throw conflict('Pricing and profit shares are locked because investments already exist for this funding need. Existing investments keep their original terms; create a new funding need for new terms.');
    const c = calcNeed({ ...v, ...p });
    if (toPaisa(c.total_capital) < toPaisa(cur.funded_amount))
      throw conflict(`Required capital cannot drop below the PKR ${cur.funded_amount} already committed.`);
    const status = cur.status === 'OPEN' && toPaisa(c.total_capital) === toPaisa(cur.funded_amount) ? 'FULL'
      : cur.status === 'FULL' && toPaisa(c.total_capital) > toPaisa(cur.funded_amount) ? 'OPEN' : cur.status;
    const [row] = await t.q(
      `UPDATE funding_needs SET title=$2, product=$3, description=$4, quantity=$5, cost_price=$6, sell_price=$7, op_cost=$8, investor_pct=$9,
              guarantor_pct=$10, total_capital=$11, status=$12, updated_at=now() WHERE id=$1 RETURNING *`,
      [id, v.title, v.product, v.description || null, v.quantity, p.cost_price, p.sell_price, p.op_cost, p.investor_pct, p.guarantor_pct, c.total_capital, status]);
    if (v.account_ids) await assignAccounts(t, user, id, v.account_ids);
    const changed: Record<string, [any, any]> = {};
    for (const k of ['title', 'product', 'description', 'quantity', 'cost_price', 'sell_price', 'op_cost', 'investor_pct', 'guarantor_pct', 'total_capital'])
      if (String(cur[k] ?? '') !== String(row[k] ?? '')) changed[k] = [cur[k], row[k]];
    await audit(t, user.id, 'funding_need.updated', 'funding_need', id, { changed });
    return row;
  });
}

export async function setNeedAccounts(user: CurrentUser, id: number, ids: number[]) {
  return tx(async t => {
    const [cur] = await t.q('SELECT id, status FROM funding_needs WHERE id = $1 FOR UPDATE', [id]);
    if (!cur) throw notFound('Funding need not found');
    if (cur.status === 'OPEN' && !ids.length) throw conflict('An open funding need needs at least one payment account.');
    await assignAccounts(t, user, id, ids);
    return { ok: true };
  });
}

export async function changeNeedStatus(user: CurrentUser, id: number, action: string, rawReason?: unknown) {
  return tx(async t => {
    const [cur] = await t.q('SELECT * FROM funding_needs WHERE id = $1 FOR UPDATE', [id]);
    if (!cur) throw notFound('Funding need not found');
    const active = async () => (await t.q(`SELECT COUNT(*)::int AS n FROM investments WHERE funding_need_id = $1 AND status IN ('PENDING_VERIFICATION','VERIFIED','PAYOUT_DUE')`, [id]))[0].n;
    let next: string, extra = '', params: any[] = [id];
    switch (action) {
      case 'open': {
        if (!['DRAFT', 'CLOSED'].includes(cur.status)) throw conflict(`Cannot open a funding need that is ${cur.status}.`);
        const [{ n }] = await t.q('SELECT COUNT(*)::int AS n FROM funding_need_accounts WHERE funding_need_id = $1', [id]);
        if (!n) throw conflict('Assign at least one payment account before opening.');
        next = toPaisa(cur.funded_amount) >= toPaisa(cur.total_capital) ? 'FULL' : 'OPEN';
        extra = ', opened_at = COALESCE(opened_at, now()), closed_at = NULL'; break;
      }
      case 'close':
        if (!['OPEN', 'FULL'].includes(cur.status)) throw conflict(`Cannot close a funding need that is ${cur.status}.`);
        next = 'CLOSED'; extra = ', closed_at = now()'; break;
      case 'complete':
        if (cur.status !== 'CLOSED') throw conflict('Close the funding need before completing it.');
        if (await active()) throw conflict('Some investments are still pending or awaiting payout.');
        next = 'COMPLETED'; break;
      case 'cancel': {
        const reason = reasonSchema.parse(rawReason);
        if (['CANCELLED', 'COMPLETED'].includes(cur.status)) throw conflict(`This funding need is already ${cur.status.toLowerCase()}.`);
        const n = await active();
        if (n) throw conflict(`${n} investment(s) are still active. Reject or complete them before cancelling.`);
        next = 'CANCELLED'; extra = ', cancel_reason = $2, closed_at = now()'; params = [id, reason]; break;
      }
      default: throw bad('Unknown action');
    }
    const [row] = await t.q(`UPDATE funding_needs SET status = '${next}', updated_at = now()${extra} WHERE id = $1 RETURNING *`, params);
    await audit(t, user.id, `funding_need.${action === 'open' ? 'opened' : action === 'close' ? 'closed' : action === 'cancel' ? 'cancelled' : 'completed'}`, 'funding_need', id, { from: cur.status, to: next, reason: action === 'cancel' ? params[1] : undefined });
    return row;
  });
}
