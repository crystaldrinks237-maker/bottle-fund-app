import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`SELECT * FROM weeks ORDER BY created_at DESC LIMIT 50`;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }
  const b = await req.json();
  if (!b.quality || !b.qty || !b.cost_price || !b.sell_price) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const rows = await sql`
    INSERT INTO weeks (quality, qty, cost_price, sell_price, op_cost, investor_pct, guarantor_pct, status, created_by)
    VALUES (${b.quality}, ${b.qty}, ${b.cost_price}, ${b.sell_price}, ${b.op_cost || 0}, ${b.investor_pct || 0}, ${b.guarantor_pct || 0}, 'open', ${(session.user as any).id})
    RETURNING *`;
  return NextResponse.json(rows[0]);
}
