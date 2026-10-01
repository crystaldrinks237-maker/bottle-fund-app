import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { handler, bad, conflict } from '@/lib/api';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { googleEnabled, LINK_COOKIE } from '@/lib/auth';
import { requireUser } from '@/lib/session';

// Step 1 of "Connect Google": remember (10 min, signed, httpOnly) which logged-in user is linking.
export const POST = handler(async () => {
  const u = await requireUser();
  if (!googleEnabled) throw bad('Google sign-in is not configured.');
  const [row] = await query('SELECT google_sub FROM users WHERE id = $1', [u.id]);
  if (row.google_sub) throw conflict('A Google account is already connected.');
  const token = await encode({ token: { purpose: 'google-link', uid: u.id }, secret: process.env.NEXTAUTH_SECRET!, maxAge: 600 });
  cookies().set(LINK_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  return { ok: true };
});

export const DELETE = handler(async () => {
  const u = await requireUser();
  const [row] = await query('SELECT has_password FROM users WHERE id = $1', [u.id]);
  if (!row.has_password) throw bad('Set a password first — otherwise you would be locked out of this account.');
  await query('UPDATE users SET google_sub = NULL, email = NULL, updated_at = now() WHERE id = $1', [u.id]);
  await audit(null, u.id, 'user.google_unlinked', 'user', u.id);
  return { ok: true };
});
