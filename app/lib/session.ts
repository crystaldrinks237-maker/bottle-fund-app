import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { query } from './db';
import { ApiError } from './api';
import type { Role } from './config';

export interface CurrentUser { id: number; username: string; full_name: string | null; roles: Role[]; phone: string | null }

/** Authoritative identity: the session only carries the user id; roles/active flag are re-read from the DB on every call. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await getServerSession(authOptions);
  const id = Number((s?.user as any)?.id);
  if (!id) return null;
  const rows = await query<any>('SELECT id, username, full_name, roles, phone, is_active FROM users WHERE id = $1', [id]);
  const u = rows[0];
  if (!u || !u.is_active) return null;
  return { id: u.id, username: u.username, full_name: u.full_name, roles: u.roles, phone: u.phone };
}

export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, 'Please sign in to continue.');
  if (roles.length && !roles.some(r => u.roles.includes(r))) throw new ApiError(403, 'You do not have permission to do that.');
  return u;
}
export const isAdmin = (u: CurrentUser) => u.roles.includes('ADMIN');
