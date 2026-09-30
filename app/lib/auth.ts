import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from './db';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Constant-time-ish decoy so unknown usernames cost the same as wrong passwords.
const DECOY = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5nZ3vB5x1o0kP5m5cTkq5tQe4cQ9x8K';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [
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
    // Only the id is trusted from the token; everything else is looked up server-side per request (lib/session.ts).
    async jwt({ token, user }) { if (user) token.id = (user as any).id; return token; },
    async session({ session, token }) { if (session.user) (session.user as any).id = token.id; return session; },
  },
};
