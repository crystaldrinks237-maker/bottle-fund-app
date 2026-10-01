import { query } from '../db';
import { ApiError, notFound } from '../api';
import { calcInvestment, calcNeed } from '../calc';
import { toPaisa, fromPaisa, MoneyError } from '../money';

const MAX = 1_000_000_000n * 100n; // 1 billion PKR — sanity cap for a public, unauthenticated endpoint

/** What a visitor may see about a funding need. Cost, sell price, operating cost and the business share stay private. */
function publicView(n: any) {
  const c = calcNeed(n);
  const per100k = calcInvestment(n, '100000');
  return {
    id: n.id, title: n.title, product: n.product, quantity: n.quantity, status: n.status,
    total_capital: n.total_capital, funded_amount: n.funded_amount, remaining_amount: n.remaining_amount, min_investment: n.min_investment,
    investor_pct: n.investor_pct, guarantor_pct: n.guarantor_pct, return_pct: c.investor_return_pct,
    per_100k: { investor_profit: per100k.investor_profit, total_return: per100k.total_return, guarantor_profit: per100k.guarantor_profit },
  };
}

export async function publicNeeds() {
  const rows = await query(`SELECT * FROM funding_needs WHERE status IN ('OPEN','FULL') ORDER BY (status = 'OPEN') DESC, opened_at DESC NULLS LAST, id DESC`);
  return rows.map(publicView);
}

function money(raw: string | null, label: string): bigint {
  if (raw === null || raw.trim() === '') return 0n;
  let p: bigint;
  try { p = toPaisa(raw.replace(/,/g, '').trim()); } catch (e) { if (e instanceof MoneyError) throw new ApiError(400, `${label}: enter a valid amount`); throw e; }
  if (p < 0n || p > MAX) throw new ApiError(400, `${label}: amount is out of range`);
  return p;
}

/** Calculator: everything comes from lib/calc.ts — the same numbers an investor would actually get. */
export async function publicCalculator(needIdRaw: string | null, amountRaw: string | null, referredRaw: string | null) {
  const needs = await publicNeeds();
  if (!needs.length) return { needs: [], need: null, invest: null, referral: null, combined: null };
  const id = needIdRaw ? parseInt(needIdRaw, 10) : needs[0].id;
  const [row] = await query(`SELECT * FROM funding_needs WHERE id = $1 AND status IN ('OPEN','FULL')`, [id]);
  if (!row) throw notFound('That funding need is not available');
  const amount = money(amountRaw, 'Your investment'), referred = money(referredRaw, 'Referred investments');
  const mine = amount > 0n ? calcInvestment(row, amount) : null;
  const theirs = referred > 0n ? calcInvestment(row, referred) : null;
  const myProfit = mine ? toPaisa(mine.investor_profit) : 0n, guar = theirs ? toPaisa(theirs.guarantor_profit) : 0n;
  return {
    needs: needs.map(n => ({ id: n.id, title: n.title, product: n.product, status: n.status })),
    need: publicView(row),
    invest: mine && { principal: mine.principal, profit: mine.investor_profit, total_return: mine.total_return, return_pct: calcNeed(row).investor_return_pct, days: 7 },
    referral: theirs && { referred_amount: fromPaisa(referred), guarantor_earnings: theirs.guarantor_profit, guarantor_pct: row.guarantor_pct },
    combined: mine || theirs ? { total_profit: fromPaisa(myProfit + guar) } : null,
  };
}
