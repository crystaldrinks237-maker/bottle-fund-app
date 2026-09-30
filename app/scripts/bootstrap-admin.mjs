// Creates (or promotes) the initial admin. The ONLY supported way to get the first admin.
// Usage: ADMIN_USERNAME=... ADMIN_PASSWORD=... DATABASE_URL=... npm run db:bootstrap-admin
import bcrypt from 'bcryptjs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
if (!url || !username || password.length < 10) {
  console.error('Set DATABASE_URL, ADMIN_USERNAME and ADMIN_PASSWORD (min 10 chars).'); process.exit(1);
}
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  const hash = await bcrypt.hash(password, 12);
  const ex = await client.query('SELECT id, roles FROM users WHERE lower(username) = $1', [username]);
  if (ex.rows[0]) {
    await client.query(`UPDATE users SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || ARRAY['ADMIN']) r), is_active = true, updated_at = now() WHERE id = $1`, [ex.rows[0].id]);
    console.log(`Existing user "${username}" now has the ADMIN role (password unchanged).`);
  } else {
    await client.query(`INSERT INTO users (username, password_hash, roles, full_name) VALUES ($1, $2, ARRAY['ADMIN'], 'Administrator')`, [username, hash]);
    console.log(`Admin "${username}" created.`);
  }
} finally { await client.end(); }
