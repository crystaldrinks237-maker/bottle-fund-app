// CENTRAL financial model. Every figure the platform shows or stores is produced here, server-side.
//   distributable profit / bottle = sell − cost − op cost
//   investor profit   = distributable × investor %
//   guarantor profit  = distributable × guarantor %
//   business profit   = remainder (so the three always sum exactly to total profit)
//   total return      = principal + investor profit
// An investment of A buys A / cost_price bottles of funding, so its profit is A × dist / cost.
import { toPaisa, toBp, fromPaisa, divRound, MoneyError } from './money';

export interface PricingInput {
  cost_price: string | number; sell_price: string | number; op_cost: string | number;
  investor_pct: string | number; guarantor_pct: string | number;
}
export interface NeedInput extends PricingInput { quantity: number | string }

function parse(p: PricingInput) {
  const cost = toPaisa(p.cost_price), sell = toPaisa(p.sell_price), op = toPaisa(p.op_cost);
  const inv = toBp(p.investor_pct), guar = toBp(p.guarantor_pct);
  if (cost <= 0n) throw new MoneyError('Cost price must be greater than zero');
  if (op < 0n) throw new MoneyError('Operational cost cannot be negative');
  if (inv < 0n || guar < 0n || inv > 10000n || guar > 10000n) throw new MoneyError('Percentages must be between 0 and 100');
  if (inv + guar > 10000n) throw new MoneyError('Investor % + guarantor % cannot exceed 100');
  const dist = sell - cost - op;
  if (dist < 0n) throw new MoneyError('Sell price must cover cost price plus operational cost');
  return { cost, sell, op, inv, guar, dist, biz: 10000n - inv - guar };
}

/** Validates pricing and returns normalised 2dp strings. Throws MoneyError on invalid input. */
export function validatePricing(p: PricingInput) {
  const x = parse(p);
  return {
    cost_price: fromPaisa(x.cost), sell_price: fromPaisa(x.sell), op_cost: fromPaisa(x.op),
    investor_pct: fromPaisa(x.inv), guarantor_pct: fromPaisa(x.guar), business_pct: fromPaisa(x.biz),
  };
}

export function calcNeed(n: NeedInput) {
  const x = parse(n);
  const qty = BigInt(n.quantity);
  if (qty <= 0n) throw new MoneyError('Quantity must be greater than zero');
  const totalProfit = qty * x.dist;
  const investorPool = divRound(totalProfit * x.inv, 10000n);
  const guarantorPool = divRound(totalProfit * x.guar, 10000n);
  return {
    total_capital: fromPaisa(qty * x.cost),
    distributable_per_bottle: fromPaisa(x.dist),
    investor_profit_per_bottle: fromPaisa(divRound(x.dist * x.inv, 10000n)),
    guarantor_profit_per_bottle: fromPaisa(divRound(x.dist * x.guar, 10000n)),
    business_profit_per_bottle: fromPaisa(x.dist - divRound(x.dist * x.inv, 10000n) - divRound(x.dist * x.guar, 10000n)),
    investor_return_per_bottle: fromPaisa(x.cost + divRound(x.dist * x.inv, 10000n)),
    total_profit_pool: fromPaisa(totalProfit),
    investor_profit_pool: fromPaisa(investorPool),
    guarantor_profit_pool: fromPaisa(guarantorPool),
    business_profit_pool: fromPaisa(totalProfit - investorPool - guarantorPool),
    investor_return_pct: fromPaisa(divRound(x.dist * x.inv * 10000n, x.cost * 10000n)), // % of principal earned (2dp)
  };
}

export function calcInvestment(p: PricingInput, amount: string | number | bigint) {
  const x = parse(p);
  const a = toPaisa(amount);
  if (a <= 0n) throw new MoneyError('Amount must be greater than zero');
  const denom = x.cost * 10000n;
  const total = divRound(a * x.dist * 10000n, denom);
  const investor = divRound(a * x.dist * x.inv, denom);
  const guarantor = divRound(a * x.dist * x.guar, denom);
  return {
    principal: fromPaisa(a),
    total_profit: fromPaisa(total),
    investor_profit: fromPaisa(investor),
    guarantor_profit: fromPaisa(guarantor),
    business_profit: fromPaisa(total - investor - guarantor),
    total_return: fromPaisa(a + investor),
  };
}
