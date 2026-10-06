import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import { resolveGoogleUser } from './google';
import { REF_COOKIE } from './referrals';
import bcrypt from 'bcryptjs';
import { query } from './db';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Constant-time-ish decoy so unknown usernames cost the same as wrong passwords.
const DECOY = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5nZ3vB5x1o0kP5m5cTkq5tQe4cQ9x8K';

export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const LINK_COOKIE = 'cd_google_link';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [
    ...(googleEnabled ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })] : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: { username: { label: 'Username', type: 'text' }, password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        const username = String(credentials?.username || '').trim().toLowerCase();
        const password = String(credentials?.password || '');
        if (!username || !password) return null;
        const rows = await query<any>('SELECT id, username, password_hash, is_active, failed_logins, locked_until FROM users WHERE lower(username) = $1', [username]);
        const u = rows[0];
        if (!u) { await bcrypt.compare(password, DECOY); return null; }
        if (u.locked_until && new Date(u.locked_until) > new Date()) return null;
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok || !u.is_active) {
          await query(
            `UPDATE users SET failed_logins = failed_logins + 1,
               locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
             WHERE id = $1`, [u.id, MAX_FAILS, String(LOCK_MINUTES)]);
          return null;
        }
        await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [u.id]);
        return { id: String(u.id), name: u.username };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      // A signed, 10-minute "link intent" cookie is set only by /api/me/google-link for a logged-in user.
      let linkUserId: number | null = null;
      try {
        const jar = cookies(); const raw = jar.get(LINK_COOKIE)?.value;
        if (raw) {
          const t: any = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET! });
          if (t?.purpose === 'google-link' && Number.isInteger(t.uid)) linkUserId = t.uid;
          try { jar.delete(LINK_COOKIE); } catch {}
        }
      } catch {}
      let remembered: string | null = null; try { remembered = cookies().get(REF_COOKIE)?.value || null; } catch {}
      const r = await resolveGoogleUser(profile as any, linkUserId, remembered);
      if ('error' in r) return `/${linkUserId ? 'profile' : 'login'}?error=${r.error}`;
      (user as any).id = String(r.id);
      return true;
    },
    // Only the id is trusted from the token; everything else is looked up server-side per request (lib/session.ts).
    async jwt({ token, user }) { if (user) token.id = (user as any).id; return token; },
    async session({ session, token }) { if (session.user) (session.user as any).id = token.id; return session; },
  },
};
