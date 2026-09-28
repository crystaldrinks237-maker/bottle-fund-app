import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// Admin confirms the payment screenshot is legit -> this is the exact moment
// the 7-day countdown starts on the investor's side.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }
  const rows = await sql`
    UPDATE investments
    SET verified = true, verified_at = now(), due_date = now() + interval '7 days'
    WHERE id = ${params.id}
    RETURNING *`;
  return NextResponse.json(rows[0]);
}
