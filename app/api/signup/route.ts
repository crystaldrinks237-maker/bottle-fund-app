import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  const { username, phone, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length) {
    return NextResponse.json({ error: 'That username is taken' }, { status: 400 });
  }
  const hash = await bcrypt.hash(password, 10);
  // First-ever user, or a username matching FIRST_ADMIN_USERNAME, becomes admin.
  const countRows = await sql`SELECT COUNT(*)::int AS c FROM users`;
  const isFirstUser = countRows[0].c === 0;
  const role = isFirstUser || username === process.env.FIRST_ADMIN_USERNAME ? 'admin' : 'investor';
  await sql`INSERT INTO users (username, phone, password_hash, role) VALUES (${username}, ${phone || null}, ${hash}, ${role})`;
  return NextResponse.json({ ok: true });
}
