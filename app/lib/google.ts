import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { tx } from './db';
import { audit } from './audit';

export interface GoogleProfile { sub?: string; email?: string; email_verified?: boolean; name?: string }
export type GoogleResult = { id: number } | { error: string };

/**
 * Decides which local account a Google sign-in belongs to. Security rules:
 *  - the Google email must be verified by Google;
 *  - an existing password account is NEVER linked automatically by matching email — the owner must be signed in
 *    and explicitly connect Google from Profile (`linkUserId`), proving control of both;
 *  - brand-new Google users become INVESTORs only (admins/guarantors are created by an admin, then link Google themselves).
 */
export async function resolveGoogleUser(p: GoogleProfile, linkUserId: number | null): Promise<GoogleResult> {
  if (!p.sub || !p.email || p.email_verified !== true) return { error: 'google_unverified' };
  const email = p.email.trim().toLowerCase();
  return tx<GoogleResult>(async t => {
    const [bySub] = await t.q('SELECT id, is_active FROM users WHERE google_sub = $1', [p.sub]);
    if (bySub) {
      if (linkUserId && linkUserId !== bySub.id) return { error: 'google_taken' };
      return bySub.is_active ? { id: bySub.id } : { error: 'account_disabled' };
    }
    if (linkUserId) {
      const [u] = await t.q('SELECT id, google_sub, is_active FROM users WHERE id = $1 FOR UPDATE', [linkUserId]);
      if (!u || !u.is_active) return { error: 'account_disabled' };
      if (u.google_sub) return { error: 'google_already_linked' };
      const [other] = await t.q('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [email, linkUserId]);
      if (other) return { error: 'google_taken' };
      await t.q('UPDATE users SET google_sub = $2, email = $3, updated_at = now() WHERE id = $1', [linkUserId, p.sub, email]);
      await audit(t, linkUserId, 'user.google_linked', 'user', linkUserId, { email });
      return { id: linkUserId };
    }
    const [same] = await t.q('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (same) return { error: 'google_taken' };
    if (process.env.ALLOW_SIGNUP === 'false') return { error: 'signup_closed' };
    const base = (email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'investor').slice(0, 24).padEnd(3, '0');
    let username = base;
    for (let n = 0; (await t.q('SELECT 1 FROM users WHERE lower(username) = $1', [username])).length; n++) username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10); // nobody knows this password
    const [row] = await t.q(
      `INSERT INTO users (username, password_hash, roles, full_name, email, google_sub, has_password) VALUES ($1,$2,ARRAY['INVESTOR'],$3,$4,$5,false) RETURNING id`,
      [username, unusable, (p.name || '').slice(0, 80) || null, email, p.sub]);
    await audit(t, row.id, 'user.signed_up_google', 'user', row.id, { email });
    return { id: row.id };
  });
}
