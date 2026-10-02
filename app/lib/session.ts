import { getServerSession } from 'next-auth';
import { encode, decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import { authOptions } from './auth';
import { query } from './db';
import { ApiError } from './api';
import type { Role } from './config';

export interface CurrentUser {
  id: number; username: string; full_name: string | null; roles: Role[]; phone: string | null;
  /** Set when an admin is looking at the app as this user ("view as"). Everything is then read-only. */
  viewingAs?: { adminId: number; adminUsername: string };
}

export const VIEW_AS_COOKIE = 'cd_view_as';
export const VIEW_AS_TTL_SECONDS = 30 * 60;

const COLS = 'id, username, full_name, roles, phone, is_active';
const pick = (u: any): CurrentUser => ({ id: u.id, username: u.username, full_name: u.full_name, roles: u.roles, phone: u.phone });

/** The person actually signed in (ignores "view as"). Roles / active flag are re-read from the DB on every call. */
export async function getRealUser(): Promise<CurrentUser | null> {
  const s = await getServerSession(authOptions);
  const id = Number((s?.user as any)?.id);
  if (!id) return null;
  const [u] = await query<any>(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
  return u && u.is_active ? pick(u) : null;
}
export async function requireRealUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getRealUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}

export async function makeViewAsCookie(adminId: number, targetId: number): Promise<string> {
  return encode({ token: { purpose: 'view-as', admin: adminId, target: targetId }, secret: process.env.NEXTAUTH_SECRET!, maxAge: VIEW_AS_TTL_SECONDS });
}

/**
 * The target of an active "view as", or null. The signed cookie only counts if: it is unexpired, it was issued to THIS
 * signed-in admin (a copied/stale cookie on anyone else's browser does nothing), the admin still has ADMIN, and the
 * target is an active non-admin. Anything else → ignored.
 */
async function viewAsTarget(real: CurrentUser): Promise<CurrentUser | null> {
  if (!real.roles.includes('ADMIN')) return null;
  let raw: string | undefined; try { raw = cookies().get(VIEW_AS_COOKIE)?.value; } catch { return null; }
  if (!raw) return null;
  let t: any; try { t = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET! }); } catch { return null; }
  if (!t || t.purpose !== 'view-as' || t.admin !== real.id || !Number.isInteger(t.target) || t.target === real.id) return null;
  const [u] = await query<any>(`SELECT ${COLS} FROM users WHERE id = $1`, [t.target]);
  if (!u || !u.is_active || u.roles.includes('ADMIN')) return null;
  return { ...pick(u), viewingAs: { adminId: real.id, adminUsername: real.username } };
}

export async function isViewingAs(): Promise<boolean> {
  const real = await getRealUser();
  return !!real && !!(await viewAsTarget(real));
}

/** Effective identity used by every page and API: the viewed user while "view as" is active, otherwise the signed-in user. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const real = await getRealUser();
  if (!real) return null;
  return (await viewAsTarget(real)) || real;
}

export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}
export const isAdmin = (u: CurrentUser) => u.roles.includes('ADMIN');
