import { handler, readJson } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { calcNeed, validatePricing } from '@/lib/calc';

// The admin form never computes money itself: it asks this endpoint, which uses the same lib/calc.ts as the writes.
export const POST = handler(async req => {
  await requireUser('ADMIN');
  const b = await readJson(req);
  const p = validatePricing({ cost_price: b.cost_price, sell_price: b.sell_price, op_cost: b.op_cost ?? '0', investor_pct: b.investor_pct ?? '0', guarantor_pct: b.guarantor_pct ?? '0' });
  return { pricing: p, calc: calcNeed({ ...p, quantity: Number(b.quantity) }) };
});
