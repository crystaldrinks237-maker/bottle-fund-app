import { z } from 'zod';
import { query, tx, Tx } from '../db';
import { audit } from '../audit';
import { notify, notifyAdmins } from '../notify';
import { bad, conflict, notFound } from '../api';
import { toPaisa, fromPaisa } from '../money';
import { formatMoney } from '../format';
import type { CurrentUser } from '../session';
import { verifyWithin } from './investments';

/**
 * Reinvest option. For one week at a time, an investor can ask to leave the principal of a verified investment with the
 * business and receive only the profit. The choice is switched off again once the principal has been rolled over.
 */
const flagSchema = z.object({ reinvest: z.boolean() });

export async function setReinvest(user: CurrentUser, investmentId: number, raw: unknown) {
  const { reinvest } = flagSchema.parse(raw);
  const row = await setReinvestFlag(user, investmentId, reinvest);
  // If the payout is already due, reinvest straight away instead of waiting for the next page load.
  if (reinvest) { try { await autoRollOverPending(); } catch { /* admin can roll it manually */ } }
  return row;
}

async function setReinvestFlag(user: CurrentUser, investmentId: number, reinvest: boolean) {
  return tx(async t => {
    const [i] = await t.q('SELECT * FROM investments WHERE id = $1 AND investor_id = $2 FOR UPDATE', [investmentId, user.id]);
    if (!i) throw notFound('Investment not found');
    const [p] = await t.q('SELECT * FROM payouts WHERE investment_id = $1 FOR UPDATE', [investmentId]);
    if (!p || !['VERIFIED', 'PAYOUT_DUE'].includes(i.status)) throw conflict('Reinvesting can be chosen once your payment is verified and before the payout is made.', 'NOT_ELIGIBLE');
    if (p.status !== 'DUE' || Number(p.reinvested_amount) > 0) throw conflict('This payout is already being processed, so it can no longer be changed.', 'TOO_LATE');
    if (i.reinvest_requested === reinvest) return i;
    const [row] = await t.q('UPDATE investments SET reinvest_requested = $2, updated_at = now() WHERE id = $1 RETURNING *', [investmentId, reinvest]);
    await audit(t, user.id, reinvest ? 'investment.reinvest_requested' : 'investment.reinvest_cancelled', 'investment', investmentId, { principal: i.amount });
    if (reinvest)
      await notifyAdmins(t, { type: 'REINVEST_REQUESTED', title: 'Investor wants to reinvest', body: `${user.username} — ${formatMoney(i.amount)} from investment #${investmentId}. It goes into an open funding need automatically when the payout is due.`, link: '/funds/admin/payouts' });
    return row;
  });
}

const rollSchema = z.object({ funding_need_id: z.number().int().positive() });
type Actor = { id: number | null };

/** Rolls a due payout's principal into `need` inside an open transaction. The caller has locked the payout and investment. */
async function rollInto(t: Tx, actor: Actor, p: any, i: any, need: any) {
  const principal = toPaisa(p.principal);
  const [rel] = await t.q('SELECT guarantor_id FROM guarantor_relationships WHERE investor_id = $1', [p.investor_id]);
  const [n] = await t.q(
    `INSERT INTO investments (funding_need_id, investor_id, guarantor_id, amount, rolled_from_investment_id,
                              snap_title, snap_product, snap_cost_price, snap_sell_price, snap_op_cost, snap_investor_pct, snap_guarantor_pct)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [need.id, p.investor_id, rel?.guarantor_id ?? null, p.principal, i.id,
     need.title, need.product, need.cost_price, need.sell_price, need.op_cost, need.investor_pct, need.guarantor_pct]);
  await t.q(`UPDATE funding_needs SET funded_amount = $2, status = CASE WHEN $2::numeric >= total_capital THEN 'FULL' ELSE status END, updated_at = now() WHERE id = $1`,
    [need.id, fromPaisa(toPaisa(need.funded_amount) + principal)]);
  // The money never left the business, so the new investment is verified straight away and its own 7 days start now.
  const verified = await verifyWithin(t, actor, n.id);
  await t.q('UPDATE payouts SET reinvested_amount = principal, reinvested_into = $2, updated_at = now() WHERE id = $1', [p.id, n.id]);
  await t.q('UPDATE investments SET reinvest_requested = false, updated_at = now() WHERE id = $1', [i.id]);
  await audit(t, actor.id, 'payout.rolled_over', 'payout', p.id, { principal: p.principal, new_investment_id: n.id, funding_need_id: need.id, automatic: actor.id == null });
  await notify(t, p.investor_id, {
    type: 'PAYOUT_REINVESTED', title: 'Your principal was reinvested',
    body: `${formatMoney(p.principal)} went into ${need.title} for another week. Your profit of ${formatMoney(p.profit)} will be sent to you.`, link: `/funds/investments/${n.id}`,
  });
  return { payout_id: p.id as number, new_investment_id: n.id as number, due_at: verified.due_at };
}

const fitsNeed = (need: any, principal: bigint) =>
  need.status === 'OPEN' && principal <= toPaisa(need.remaining_amount) &&
  (principal >= toPaisa(need.min_investment) || principal === toPaisa(need.remaining_amount));

/** Admin fallback: choose the funding need yourself (used when no open need could take the principal automatically). */
export async function rollOverPayout(admin: CurrentUser, payoutId: number, raw: unknown) {
  const { funding_need_id: needId } = rollSchema.parse(raw);
  return tx(async t => {
    const [p] = await t.q('SELECT p.*, (p.due_at <= now()) AS is_due FROM payouts p WHERE p.id = $1 FOR UPDATE', [payoutId]);
    if (!p) throw notFound('Payout not found');
    const [i] = await t.q('SELECT * FROM investments WHERE id = $1 FOR UPDATE', [p.investment_id]);
    if (!i.reinvest_requested) throw conflict('The investor has not asked to reinvest this payout.', 'NOT_REQUESTED');
    if (Number(p.reinvested_amount) > 0) throw conflict('The principal of this payout has already been rolled over.', 'ALREADY_ROLLED');
    if (p.status !== 'DUE') throw conflict(`This payout is already ${p.status.toLowerCase().replace(/_/g, ' ')}.`, 'ALREADY_PROCESSED');
    if (!p.is_due) throw conflict('This payout is not due yet — the 7-day period has not elapsed.', 'NOT_DUE');
    const [need] = await t.q('SELECT * FROM funding_needs WHERE id = $1 FOR UPDATE', [needId]);
    if (!need) throw notFound('Funding need not found');
    if (need.status !== 'OPEN') throw conflict('That funding need is not open for investment.', 'NEED_NOT_OPEN');
    const principal = toPaisa(p.principal);
    if (principal > toPaisa(need.remaining_amount)) throw conflict(`Only ${formatMoney(need.remaining_amount)} is still needed in that funding need.`, 'OVER_REMAINING');
    if (!fitsNeed(need, principal)) throw conflict(`The minimum investment for that funding need is ${formatMoney(need.min_investment)}.`, 'BELOW_MIN');
    return rollInto(t, admin, p, i, need);
  });
}

/**
 * Automatic roll-over: once a payout is due and the investor asked to reinvest, the principal goes into the oldest open
 * funding need that has room for it. Returns null (and changes nothing) if nothing is eligible, so an admin can roll it manually.
 */
export async function autoRollOver(payoutId: number): Promise<{ payout_id: number; new_investment_id: number } | null> {
  return tx(async t => {
    const [p] = await t.q('SELECT p.*, (p.due_at <= now()) AS is_due FROM payouts p WHERE p.id = $1 FOR UPDATE', [payoutId]);
    if (!p || p.status !== 'DUE' || !p.is_due || Number(p.reinvested_amount) > 0) return null;
    const [i] = await t.q('SELECT * FROM investments WHERE id = $1 FOR UPDATE', [p.investment_id]);
    if (!i || !i.reinvest_requested) return null;
    const principal = toPaisa(p.principal);
    const open = await t.q(`SELECT id FROM funding_needs WHERE status = 'OPEN' ORDER BY opened_at NULLS LAST, id`);
    for (const { id } of open) {
      const [need] = await t.q('SELECT * FROM funding_needs WHERE id = $1 FOR UPDATE', [id]);
      if (need && fitsNeed(need, principal)) return rollInto(t, { id: null }, p, i, need);
    }
    return null;
  });
}

/** Rolls over every due payout whose investor asked to reinvest. Safe to call often; failures are left for the admin. */
export async function autoRollOverPending(): Promise<number> {
  const rows = await query(
    `SELECT p.id FROM payouts p JOIN investments i ON i.id = p.investment_id
      WHERE i.reinvest_requested AND p.status = 'DUE' AND p.due_at <= now() AND p.reinvested_amount = 0 ORDER BY p.due_at`);
  let done = 0;
  for (const r of rows) { try { if (await autoRollOver(r.id)) done++; } catch { /* leave it for the admin */ } }
  return done;
}
