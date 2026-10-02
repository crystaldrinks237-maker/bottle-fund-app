import { cookies } from 'next/headers';
import { z } from 'zod';
import { handler, readJson, bad, notFound } from '@/lib/api';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireRealUser, getRealUser, isViewingAs, makeViewAsCookie, VIEW_AS_COOKIE, VIEW_AS_TTL_SECONDS } from '@/lib/session';

const schema = z.object({ user_id: z.number().int().positive(), landing: z.enum(['investor', 'guarantor']).optional() });

// Start "view as": admins only, never another admin or yourself, 30 minutes, read-only, recorded in the activity log.
export const POST = handler(async req => {
  const admin = await requireRealUser('ADMIN');
  const v = schema.parse(await readJson(req));
  if (v.user_id === admin.id) throw bad('You are already signed in as yourself.');
  const [u] = await query<any>('SELECT id, username, roles, is_active FROM users WHERE id = $1', [v.user_id]);
  if (!u) throw notFound('User not found');
  if (u.roles.includes('ADMIN')) throw bad('You cannot view another administrator’s account.');
  if (!u.is_active) throw bad('That account is disabled.');
  cookies().set(VIEW_AS_COOKIE, await makeViewAsCookie(admin.id, u.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: VIEW_AS_TTL_SECONDS });
  await audit(null, admin.id, 'admin.view_as_started', 'user', u.id, { target: u.username, minutes: VIEW_AS_TTL_SECONDS / 60 });
  const guarantorOnly = u.roles.includes('GUARANTOR') && !u.roles.includes('INVESTOR');
  return { redirect: v.landing === 'guarantor' || (guarantorOnly && v.landing !== 'investor') ? '/guarantor' : '/dashboard', expires_in: VIEW_AS_TTL_SECONDS };
}, { allowWhileViewing: true });

export const DELETE = handler(async () => {
  const admin = await requireRealUser('ADMIN');
  const was = await isViewingAs();
  cookies().set(VIEW_AS_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  if (was) await audit(null, admin.id, 'admin.view_as_ended', 'user', null, {});
  return { redirect: '/admin' };
}, { allowWhileViewing: true });

export const GET = handler(async () => ({ viewing: await isViewingAs(), real: !!(await getRealUser()) }));
