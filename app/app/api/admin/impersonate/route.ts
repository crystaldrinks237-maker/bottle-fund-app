import { cookies } from 'next/headers';
import { z } from 'zod';
import { handler, readJson, bad, notFound } from '@/lib/api';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireRealUser, getRealUser, makeViewAsCookie, VIEW_AS_COOKIE, VIEW_AS_TTL_SECONDS } from '@/lib/session';

const schema = z.object({ user_id: z.number().int().positive(), landing: z.enum(['investor', 'guarantor']).optional() });

/** Start "View as user". Only a real, signed-in ADMIN may do this, and never for another admin or an inactive account. */
export const POST = handler(async req => {
  const admin = await requireRealUser('ADMIN');
  const v = schema.parse(await readJson(req));
  if (v.user_id === admin.id) throw bad('That is your own account. Pick another user to view as.');
  const [t] = await query<any>('SELECT id, username, roles, is_active FROM users WHERE id = $1', [v.user_id]);
  if (!t) throw notFound('User not found');
  if (!t.is_active) throw bad('That account is deactivated.');
  if (t.roles.includes('ADMIN')) throw bad('You can only view as investors or guarantors, not other administrators.');
  cookies().set(VIEW_AS_COOKIE, makeViewAsCookie(admin.id, t.id), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: VIEW_AS_TTL_SECONDS,
  });
  await audit(null, admin.id, 'admin.view_as_started', 'user', t.id, { username: t.username });
  const guarantorFirst = (v.landing === 'guarantor' && t.roles.includes('GUARANTOR')) || !t.roles.includes('INVESTOR');
  return { ok: true, redirect: guarantorFirst ? '/guarantor' : '/dashboard' };
});

/** Stop viewing. Clearing the cookie is harmless, so any signed-in user may call it (used on sign-out too). */
export const DELETE = handler(async () => {
  const real = await getRealUser();
  cookies().set(VIEW_AS_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  if (real?.roles.includes('ADMIN')) await audit(null, real.id, 'admin.view_as_ended', 'user', real.id);
  return { ok: true };
});
