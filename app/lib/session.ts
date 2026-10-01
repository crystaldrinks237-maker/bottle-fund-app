import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { query } from './db';
import { ApiError } from './api';
import type { Role } from './config';

export interface CurrentUser {
  id: number; username: string; full_name: string | null; roles: Role[]; phone: string | null;
  /** Set only while an admin is using "View as user": the real admin behind this session. */
  viewing_as_by?: { id: number; username: string };
}

// ---- "View as user" (admin impersonation) -------------------------------------------------------------
export const VIEW_AS_COOKIE = 'cd_view_as';
export const VIEW_AS_TTL_SECONDS = 60 * 60; // 1 hour

const b64 = (b: Buffer) => b.toString('base64url');
function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured');
  return b64(createHmac('sha256', secret).update(`view-as:${payload}`).digest());
}

/** Signed, expiring token that binds one admin to one target user. */
export function makeViewAsCookie(adminId: number, targetId: number): string {
  const payload = `${adminId}.${targetId}.${Math.floor(Date.now() / 1000) + VIEW_AS_TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

function readViewAs(): { adminId: number; targetId: number } | null {
  const raw = cookies().get(VIEW_AS_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const [a, t, exp, sig] = parts;
  let expected: string;
  try { expected = sign(`${a}.${t}.${exp}`); } catch { return null; }
  const x = Buffer.from(sig), y = Buffer.from(expected);
  if (x.length !== y.length || !timingSafeEqual(x, y)) return null;
  const adminId = Number(a), targetId = Number(t);
  if (!Number.isInteger(adminId) || !Number.isInteger(targetId) || Number(exp) * 1000 < Date.now()) return null;
  return { adminId, targetId };
}

/** The person who is actually signed in (ignores "View as user"). Roles/active flag are re-read from the DB on every call. */
export async function getRealUser(): Promise<CurrentUser | null> {
  const s = await getServerSession(authOptions);
  const id = Number((s?.user as any)?.id);
  if (!id) return null;
  const rows = await query<any>('SELECT id, username, full_name, roles, phone, is_active FROM users WHERE id = $1', [id]);
  const u = rows[0];
  if (!u || !u.is_active) return null;
  return { id: u.id, username: u.username, full_name: u.full_name, roles: u.roles, phone: u.phone };
}

/**
 * Effective identity used by the whole app. Normally the signed-in user; while a real, active ADMIN has a valid
 * "View as user" cookie it is the (active, non-admin) target instead. Anything invalid falls back to the real user.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const real = await getRealUser();
  if (!real) return null;
  const va = readViewAs();
  if (!va || va.adminId !== real.id || !real.roles.includes('ADMIN')) return real;
  const [t] = await query<any>('SELECT id, username, full_name, roles, phone, is_active FROM users WHERE id = $1', [va.targetId]);
  if (!t || !t.is_active || t.roles.includes('ADMIN')) return real;
  return { id: t.id, username: t.username, full_name: t.full_name, roles: t.roles, phone: t.phone, viewing_as_by: { id: real.id, username: real.username } };
}

/** Like requireUser, but always the real signed-in person (used to start "View as user"). */
export async function requireRealUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getRealUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}

export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}
export const isAdmin = (u: CurrentUser) => u.roles.includes('ADMIN');