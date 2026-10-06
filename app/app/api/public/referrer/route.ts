import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { normRef } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

// Public, minimal: just a first name (or username) so a visitor can see who invited them.
export async function GET(req: Request) {
  const code = normRef(new URL(req.url).searchParams.get('code'));
  if (!code) return NextResponse.json({ valid: false });
  const [u] = await query('SELECT username, full_name FROM users WHERE referral_code = $1 AND is_active', [code]);
  if (!u) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, name: (u.full_name || '').trim().split(/\s+/)[0] || u.username });
}
