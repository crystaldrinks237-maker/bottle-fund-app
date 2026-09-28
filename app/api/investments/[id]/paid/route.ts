import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }
  const rows = await sql`
    UPDATE investments SET returned = true, returned_at = now()
    WHERE id = ${params.id} RETURNING *`;
  return NextResponse.json(rows[0]);
}
