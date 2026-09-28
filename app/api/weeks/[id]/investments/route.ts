import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { calcWeek } from '@/lib/calc';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rows = await sql`
    SELECT i.*, u.username AS investor_username
    FROM investments i JOIN users u ON u.id = i.investor_id
    WHERE i.week_id = ${params.id} ORDER BY i.created_at ASC`;
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const b = await req.json();
  const amount = Number(b.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

  const weekRows = await sql`SELECT * FROM weeks WHERE id = ${params.id}`;
  const week = weekRows[0];
  if (!week || week.status !== 'open') return NextResponse.json({ error: 'This week is not open' }, { status: 400 });

  const c = calcWeek(week as any);
  const fundedRows = await sql`SELECT COALESCE(SUM(amount),0)::numeric AS sum FROM investments WHERE week_id = ${params.id}`;
  const alreadyFunded = Number(fundedRows[0].sum);
  const remaining = c.totalCapital - alreadyFunded;

  if (amount > remaining) {
    return NextResponse.json({ error: `Only ${remaining.toFixed(2)} PKR left this week - quota reached` }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO investments (week_id, investor_id, amount, referrer_username, proof_data)
    VALUES (${params.id}, ${(session.user as any).id}, ${amount}, ${b.referrer || null}, ${b.proof || null})
    RETURNING *`;
  return NextResponse.json(rows[0]);
}
