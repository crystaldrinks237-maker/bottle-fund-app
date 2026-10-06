import type { Tx } from './db';
import { bad } from './api';
import { notify } from './notify';

export const REF_COOKIE = 'cd_ref';
export const normRef = (s?: string | null) => { const v = (s || '').trim().toUpperCase(); return /^[A-Z0-9]{6,12}$/.test(v) ? v : null; };

export async function findReferrer(t: Tx, code: string | null): Promise<number | null> {
  if (!code) return null;
  const [u] = await t.q('SELECT id FROM users WHERE referral_code = $1 AND is_active', [code]);
  return u ? u.id : null;
}

/**
 * The account that earns the guarantor share when nobody referred an investor: the user named by the
 * DEFAULT_GUARANTOR_USERNAME environment variable. It is given the guarantor role automatically so the earnings,
 * monthly payments and claims screens work for it. Returns null when the variable is unset or the user doesn't exist.
 */
export async function defaultGuarantorId(t: Tx): Promise<number | null> {
  const name = (process.env.DEFAULT_GUARANTOR_USERNAME || '').trim().toLowerCase();
  if (!name) return null;
  const [u] = await t.q('SELECT id, roles FROM users WHERE lower(username) = $1 AND is_active', [name]);
  if (!u) return null;
  if (!u.roles.includes('GUARANTOR')) await t.q(`UPDATE users SET roles = array_append(roles, 'GUARANTOR'), updated_at = now() WHERE id = $1`, [u.id]);
  return u.id;
}

/**
 * Decides a brand-new user's guarantor. An explicit code typed/passed in the sign-up form must be valid (a typo must not
 * silently lose the referrer). A code that only came from the remembered link cookie is best-effort. No code → default guarantor.
 */
export async function assignGuarantorForNewUser(t: Tx, newUser: { id: number; username: string }, explicit: string | null, remembered: string | null): Promise<number | null> {
  let gid: number | null = null;
  const ex = normRef(explicit);
  if ((explicit || '').trim() && !ex) throw bad('That referral code does not look right. Check it, or leave it empty.');
  if (ex) { gid = await findReferrer(t, ex); if (!gid) throw bad('We could not find that referral code. Check it, or leave it empty.'); }
  else gid = await findReferrer(t, normRef(remembered));
  const referred = !!gid;
  if (!gid) gid = await defaultGuarantorId(t);
  if (!gid || gid === newUser.id) return null;
  await t.q('INSERT INTO guarantor_relationships (investor_id, guarantor_id, created_by) VALUES ($1,$2,$1) ON CONFLICT (investor_id) DO NOTHING', [newUser.id, gid]);
  if (referred) await notify(t, gid, { type: 'REFERRAL_JOINED', title: 'Someone joined with your link', body: `@${newUser.username} signed up as your referral.`, link: '/guarantor' });
  return gid;
}
