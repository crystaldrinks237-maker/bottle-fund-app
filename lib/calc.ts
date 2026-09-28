// Same payout math the artifact prototype used - kept in one place so the
// API and the UI never disagree on numbers.
export function calcWeek(w: {
  cost_price: number; sell_price: number; op_cost: number;
  investor_pct: number; guarantor_pct: number; qty: number;
}) {
  const dist = w.sell_price - w.cost_price - w.op_cost;
  const investorPerBottle = dist * (w.investor_pct / 100);
  const guarantorPerBottle = dist * (w.guarantor_pct / 100);
  const businessPerBottle = dist - investorPerBottle - guarantorPerBottle;
  const totalCapital = w.qty * w.cost_price;
  const investorReturnPerBottle = w.cost_price + investorPerBottle; // principal + profit
  return { dist, investorPerBottle, guarantorPerBottle, businessPerBottle, totalCapital, investorReturnPerBottle };
}
