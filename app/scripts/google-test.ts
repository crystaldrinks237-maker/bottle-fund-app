// Tests the Google account-resolution rules (lib/google.ts) against a real database. The OAuth round trip with
// Google itself needs real credentials and cannot be simulated here.  Usage: DATABASE_URL=... npx tsx scripts/google-test.ts
import { query } from '../lib/db';
import { resolveGoogleUser } from '../lib/google';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗ FAIL:', m); };
const R = Math.random().toString(36).slice(2, 7);
const g = (sub: string, email: string, verified = true) => ({ sub: 'sub-' + sub + R, email: `${email}${R}@example.com`, email_verified: verified, name: 'Test ' + email });

(async () => {
  ok('error' in await resolveGoogleUser(g('u1', 'unv', false), null), 'unverified Google email refused');
  const a: any = await resolveGoogleUser(g('a', 'newbie'), null);
  const [ua] = await query('SELECT roles, has_password, email, username FROM users WHERE id=$1', [a.id]);
  ok(a.id && ua.roles.join() === 'INVESTOR,GUARANTOR' && ua.has_password === false && ua.username.startsWith('newbie'), 'new Google user → INVESTOR account with no usable password');
  ok((await resolveGoogleUser(g('a', 'newbie'), null) as any).id === a.id, 'same Google account signs into the same user');
  ok('error' in await resolveGoogleUser({ ...g('a', 'newbie'), sub: 'other-sub' + R }, null), 'different Google identity with a taken email does not get in');

  const [pw] = await query(`INSERT INTO users (username, password_hash, roles) VALUES ($1,'x',ARRAY['ADMIN']) RETURNING id`, ['pwadmin' + R]);
  const b: any = await resolveGoogleUser(g('b', 'pwadmin'), null);
  ok(b.id && b.id !== pw.id, 'existing password account is NEVER auto-linked by email (Google sign-in makes a separate investor)');
  ok((await query('SELECT roles FROM users WHERE id=$1', [b.id]))[0].roles.join() === 'INVESTOR,GUARANTOR', 'and that new account has no admin rights — no privilege inheritance');

  const l: any = await resolveGoogleUser(g('c', 'linked'), pw.id);
  ok(l.id === pw.id && (await query('SELECT google_sub FROM users WHERE id=$1', [pw.id]))[0].google_sub === 'sub-c' + R, 'signed-in user can explicitly connect Google to their own account');
  ok((await resolveGoogleUser(g('c', 'linked'), null) as any).id === pw.id, 'afterwards Google signs into that (admin) account');
  ok((await resolveGoogleUser(g('d', 'second'), pw.id) as any).error === 'google_already_linked', 'a second Google account cannot be attached to the same user');
  const [other] = await query(`INSERT INTO users (username, password_hash) VALUES ($1,'x') RETURNING id`, ['other' + R]);
  ok((await resolveGoogleUser(g('c', 'linked'), other.id) as any).error === 'google_taken', 'a Google account already used cannot be linked to another user');

  await query(`UPDATE users SET is_active=false WHERE id=$1`, [pw.id]);
  ok('error' in await resolveGoogleUser(g('c', 'linked'), null), 'deactivated user cannot sign in via Google');
  process.env.ALLOW_SIGNUP = 'false';
  ok((await resolveGoogleUser(g('e', 'late'), null) as any).error === 'signup_closed', 'ALLOW_SIGNUP=false also blocks Google sign-ups');
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
