// Runs against a server started with DEFAULT_GUARANTOR_USERNAME=admin.  Usage: BASE=http://localhost:3101 DATABASE_URL=... node scripts/e2e-default-guarantor.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3101';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗ FAIL:', m); };
const sql = async (q, p) => (await db.query(q, p)).rows;
class Client { jar = {};
  async req(path, { method = 'GET', json, form } = {}) { const headers = { Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') }; let body; if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); } if (form) body = form;
    const r = await fetch(BASE + path, { method, headers, body, redirect: 'manual' }); for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; } return { status: r.status, data }; }
  async login(u, p) { const { data } = await this.req('/api/auth/csrf'); const r = await fetch(BASE + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: new URLSearchParams({ csrfToken: data.csrfToken, username: u, password: p, json: 'true' }) });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); } return (await this.req('/api/me')).status === 200; } }
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'); let n = 0;
const invest = (c, need, amt, acct) => { const f = new FormData(); f.set('funding_need_id', need); f.set('amount', amt); f.set('idempotency_key', crypto.randomUUID()); f.set('expected_account_id', acct); f.set('proof', new Blob([Buffer.concat([PNG, Buffer.from('u' + Date.now() + n++ + Math.random())])], { type: 'image/png' }), 'p.png'); return c.req('/api/investments', { method: 'POST', form: f }); };
const S = Date.now().toString(36); const admin = new Client(), alice = new Client(), bob = new Client();
const su = (u, extra = {}) => new Client().req('/api/signup', { method: 'POST', json: { username: u, password: 'password-12345', ...extra } });

console.log('\nDefault guarantor (DEFAULT_GUARANTOR_USERNAME=admin)');
ok(await admin.login('admin', 'admin-password-1'), 'admin signs in');
const settings = (await admin.req('/api/admin/settings')).data;
ok(settings.default_guarantor_username === 'admin' && settings.default_guarantor_configured, 'Settings shows the configured default guarantor');
await su('alice' + S);                       // no code → default guarantor
const aliceRow = (await sql(`SELECT r.guarantor_id, g.username FROM guarantor_relationships r JOIN users g ON g.id=r.guarantor_id JOIN users i ON i.id=r.investor_id WHERE i.username=$1`, ['alice' + S]))[0];
ok(aliceRow?.username === 'admin', 'a sign-up with NO referral code automatically gets the default guarantor (admin)');
ok((await sql(`SELECT roles FROM users WHERE username='admin'`))[0].roles.includes('GUARANTOR'), 'the default guarantor account is given the guarantor role automatically');
const aliceCode = (await sql('SELECT referral_code FROM users WHERE username=$1', ['alice' + S]))[0].referral_code;
await su('bob' + S, { ref: aliceCode });     // referred by alice
ok((await sql(`SELECT g.username FROM guarantor_relationships r JOIN users g ON g.id=r.guarantor_id JOIN users i ON i.id=r.investor_id WHERE i.username=$1`, ['bob' + S]))[0].username === 'alice' + S, 'a sign-up WITH alice’s code gets alice, not the admin');
ok((await sql(`SELECT count(*)::int n FROM notifications WHERE user_id=(SELECT id FROM users WHERE username=$1) AND type='REFERRAL_JOINED'`, ['alice' + S]))[0].n === 1, 'alice is notified that someone joined with her link');
ok(await alice.login('alice' + S, 'password-12345') && await bob.login('bob' + S, 'password-12345'), 'users sign in');

const acct = (await admin.req('/api/payment-accounts', { method: 'POST', json: { account_name: 'DG' + S, provider: 'EASYPAISA', account_holder_name: 'CD', account_number: '0300-1234567' } })).data;
const need = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'DG ' + S, product: 'P', quantity: 10000, cost_price: '25', sell_price: '40', op_cost: '5', investor_pct: '40', guarantor_pct: '10', account_ids: [acct.id], open_now: true } })).data;
const ia = (await invest(alice, need.id, '10000', acct.id)).data.investment.id, ib = (await invest(bob, need.id, '10000', acct.id)).data.investment.id;
await admin.req(`/api/investments/${ia}/verify`, { method: 'POST' }); await admin.req(`/api/investments/${ib}/verify`, { method: 'POST' });
const rows = await sql(`SELECT i.id, g.username AS guarantor, i.guarantor_profit, i.guarantor_is_fallback FROM investments i LEFT JOIN users g ON g.id=i.guarantor_id WHERE i.id = ANY($1)`, [[ia, ib]]);
const A = rows.find(r => r.id === ia), B = rows.find(r => r.id === ib);
ok(A.guarantor === 'admin' && A.guarantor_profit === '400.00' && A.guarantor_is_fallback === false, 'alice’s 10,000 → admin earns the 400 guarantor share (as her guarantor)');
ok(B.guarantor === 'alice' + S && B.guarantor_profit === '400.00', 'bob’s 10,000 → alice earns 400');
const ad = (await admin.req('/api/guarantor/dashboard')).data;
ok(ad.cards.referred_investors >= 1 && Number(ad.cards.earnings_this_month) >= 400, 'admin sees the earning on their referrals dashboard');
const ald = (await alice.req('/api/guarantor/dashboard')).data;
ok(ald.cards.referred_investors === 1 && ald.referred[0].username === 'bob' + S && Number(ald.cards.earnings_this_month) === 400, 'alice (an ordinary investor) has a working guarantor dashboard with bob in it');

// legacy-style user with no relationship: safety net at verification time
const legacy = (await sql(`INSERT INTO users (username, password_hash, roles) VALUES ($1, $2, ARRAY['INVESTOR','GUARANTOR']) RETURNING id`, ['legacy' + S, (await (await import('bcryptjs')).default.hash('password-12345', 10))]))[0].id;
const lc = new Client(); await lc.login('legacy' + S, 'password-12345');
const il = (await invest(lc, need.id, '5000', acct.id)).data.investment.id; await admin.req(`/api/investments/${il}/verify`, { method: 'POST' });
const L = (await sql(`SELECT g.username, i.guarantor_is_fallback, i.guarantor_profit FROM investments i LEFT JOIN users g ON g.id=i.guarantor_id WHERE i.id=$1`, [il]))[0];
ok(L.username === 'admin' && L.guarantor_is_fallback === true && L.guarantor_profit === '200.00', 'an older account with no guarantor on record still credits the default guarantor at verification (flagged as fallback)');

// admin investing themselves must never pay themselves a guarantor share
await admin.req('/api/me/roles', { method: 'POST', json: { investor: true } });
const iad = (await invest(admin, need.id, '5000', acct.id)).data.investment.id; await admin.req(`/api/investments/${iad}/verify`, { method: 'POST' });
const AD = (await sql(`SELECT guarantor_id, guarantor_profit FROM investments WHERE id=$1`, [iad]))[0];
ok(AD.guarantor_id === null && AD.guarantor_profit === '0.00', 'the default guarantor investing their own money does not earn a guarantor share on it');

const month = new Date().toISOString().slice(0, 7);
const prev = (await admin.req(`/api/guarantor-payments?preview=1&month=${month}`)).data.rows;
ok(prev.some(r => r.username === 'admin') && prev.some(r => r.username === 'alice' + S), 'settlement preview includes both the default guarantor and alice');
console.log(`\n${pass} passed, ${fail} failed`); await db.end(); process.exit(fail ? 1 : 0);
