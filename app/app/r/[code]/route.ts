import { NextResponse } from 'next/server';
import { normRef, REF_COOKIE } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

// Short shareable link: crystal.example/r/AB12CD34. Remembers the code for 30 days (so it still counts if the visitor
// browses first and signs up later, including with Google), then opens the sign-up page.
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const code = normRef(params.code);
  const url = new URL(code ? `/signup?ref=${code}` : '/', req.url);
  const res = NextResponse.redirect(url);
  if (code) res.cookies.set(REF_COOKIE, code, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
