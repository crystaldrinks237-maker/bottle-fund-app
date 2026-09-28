import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// How much each guarantor (referrer) earned this month, computed live from
// every verified investment they're credited on. Run this at month-end,
// then record the payout in guarantor_payouts once you've actually paid them.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // 'YYYY-MM', defaults to current month

  const rows = await sql`
    SELECT
      i.referrer_username,
      date_trunc('month', i.verified_at) AS month,
      SUM((i.amount / w.cost_price) * (w.sell_price - w.cost_price - w.op_cost) * (w.guarantor_pct / 100.0)) AS total_owed,
      SUM(i.amount / w.cost_price) AS bottles_funded
    FROM investments i
    JOIN weeks w ON w.id = i.week_id
    WHERE i.verified = true
      AND i.referrer_username IS NOT NULL
      AND i.referrer_username <> ''
      ${month ? sql`AND to_char(i.verified_at, 'YYYY-MM') = ${month}` : sql``}
    GROUP BY i.referrer_username, date_trunc('month', i.verified_at)
    ORDER BY month DESC, total_owed DESC`;

  return NextResponse.json(rows);
}
