import { z } from 'zod';
import { tx } from '../db';
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
      await notifyAdmins(t, { type: 'REINVEST_REQUESTED', title: 'Investor wants to reinvest', body: `${user.username} — ${formatMoney(i.amount)} from investment #${investmentId} (profit only payout)`, link: '/funds/admin/payouts' });
    return row;
  });
}

const rollSchema = z.object({ funding_need_id: z.number().int().positive() });

/** Admin: put the principal of a due payout into an open funding need. The profit is then paid out as usual. */
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
    if (principal < toPaisa(need.min_investment) && principal !== toPaisa(need.remaining_amount)) throw conflict(`The minimum investment for that funding need is ${formatMoney(need.min_investment)}.`, 'BELOW_MIN');

    const [rel] = await t.q('SELECT guarantor_id FROM guarantor_relationships WHERE investor_id = $1', [p.investor_id]);
    const [n] = await t.q(
      `INSERT INTO investments (funding_need_id, investor_id, guarantor_id, amount, rolled_from_investment_id,
                                snap_title, snap_product, snap_cost_price, snap_sell_price, snap_op_cost, snap_investor_pct, snap_guarantor_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [needId, p.investor_id, rel?.guarantor_id ?? null, p.principal, i.id,
       need.title, need.product, need.cost_price, need.sell_price, need.op_cost, need.investor_pct, need.guarantor_pct]);
    await t.q(`UPDATE funding_needs SET funded_amount = $2, status = CASE WHEN $2::numeric >= total_capital THEN 'FULL' ELSE status END, updated_at = now() WHERE id = $1`,
      [needId, fromPaisa(toPaisa(need.funded_amount) + principal)]);
    // The money never left the business, so the new investment is verified straight away and its own 7 days start now.
    const verified = await verifyWithin(t, admin, n.id);
    await t.q('UPDATE payouts SET reinvested_amount = principal, reinvested_into = $2, updated_at = now() WHERE id = $1', [payoutId, n.id]);
    await t.q('UPDATE investments SET reinvest_requested = false, updated_at = now() WHERE id = $1', [i.id]);
    await audit(t, admin.id, 'payout.rolled_over', 'payout', payoutId, { principal: p.principal, new_investment_id: n.id, funding_need_id: needId });
    await notify(t, p.investor_id, {
      type: 'PAYOUT_REINVESTED', title: 'Your principal was reinvested',
      body: `${formatMoney(p.principal)} went into ${need.title} for another week. Your profit of ${formatMoney(p.profit)} will be sent to you.`, link: `/funds/investments/${n.id}`,
    });
    return { payout_id: payoutId, new_investment_id: n.id, due_at: verified.due_at };
  });
}
