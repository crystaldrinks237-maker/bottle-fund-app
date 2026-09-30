import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { query } from './db';
import { ApiError } from './api';
import type { Role } from './config';

export interface CurrentUser {
  id: number; username: string; full_name: string | null; roles: Role[]; phone: string | null;
  /** Set only while an administrator is using "View as user". `id`/`roles` above are then the VIEWED user's. */
  impersonator?: { id: number; username: string };
}

// ---- "View as user" (admin impersonation) ---------------------------------------------------------------
// A signed, httpOnly cookie "realAdminId.targetUserId.expiry.hmac". It is honoured ONLY when the real signed-in
// session belongs to an active ADMIN whose id is inside the signature, so it cannot be forged, replayed by a
// different user, or outlive its 2-hour expiry.
export const VIEW_AS_COOKIE = 'cd_view_as';
export const VIEW_AS_TTL_SECONDS = 2 * 60 * 60;
const sign = (payload: string) => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update('view-as:' + payload).digest('hex');
};
export function makeViewAsCookie(adminId: number, targetId: number) {
  const p = `${adminId}.${targetId}.${Math.floor(Date.now() / 1000) + VIEW_AS_TTL_SECONDS}`;
  return `${p}.${sign(p)}`;
}
function readViewAsTarget(adminId: number): number | null {
  const raw = cookies().get(VIEW_AS_COOKIE)?.value;
  const parts = raw ? raw.split('.') : [];
  if (parts.length !== 4) return null;
  const [a, t, e, sig] = parts;
  const good = Buffer.from(sign(`${a}.${t}.${e}`)); const got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  if (Number(a) !== adminId || Number(e) < Date.now() / 1000) return null;
  return Number(t) || null;
}

export function hasViewAsCookie(): boolean { try { return !!cookies().get(VIEW_AS_COOKIE)?.value; } catch { return false; } }

async function loadUser(id: number): Promise<CurrentUser | null> {
  const rows = await query<any>('SELECT id, username, full_name, roles, phone, is_active FROM users WHERE id = $1', [id]);
  const u = rows[0];
  if (!u || !u.is_active) return null;
  return { id: u.id, username: u.username, full_name: u.full_name, roles: u.roles, phone: u.phone };
}

/** The person who is really signed in (ignores "View as user"). Use for admin-only actions about impersonation itself. */
export async function getRealUser(): Promise<CurrentUser | null> {
  const s = await getServerSession(authOptions);
  const id = Number((s?.user as any)?.id);
  return id ? loadUser(id) : null;
}

/** Effective identity: the session only carries the user id; roles/active flag are re-read from the DB on every call.
 *  While an admin is viewing as someone else, this returns THAT user, so every page and API behaves exactly as they would see it. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const real = await getRealUser();
  if (!real || !real.roles.includes('ADMIN')) return real;
  let targetId: number | null = null;
  try { targetId = readViewAsTarget(real.id); } catch { targetId = null; }
  if (!targetId || targetId === real.id) return real;
  const target = await loadUser(targetId);
  if (!target || target.roles.includes('ADMIN')) return real;
  return { ...target, impersonator: { id: real.id, username: real.username } };
}

export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}
export async function requireRealUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getRealUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}
/** Sensitive account changes (e.g. password) are never allowed while viewing as someone else. */
export function forbidWhileViewingAs(u: CurrentUser) {
  if (u.impersonator) throw new ApiError(403, 'Not available while viewing as another user. Exit “View as user” first.');
}
export const isAdmin = (u: CurrentUser) => u.roles.includes('ADMIN');
