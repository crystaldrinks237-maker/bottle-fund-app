// End-to-end scenario test against a running server + real Postgres.
// Usage: BASE=http://localhost:3100 DATABASE_URL=... node scripts/e2e.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3100';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const section = t => console.log('\n' + t);

class Client {
  jar = {};
  async req(path, { method = 'GET', json, form } = {}) {
    const headers = { Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') };
    let body; if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); } if (form) body = form;
    const r = await fetch(BASE + path, { method, headers, body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data };
  }
  async login(username, password) {
    const { data } = await this.req('/api/auth/csrf');
    const body = new URLSearchParams({ csrfToken: data.csrfToken, username, password, json: 'true' });
    const r = await fetch(BASE + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const me = await this.req('/api/me'); return me.status === 200;
  }
}
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
let n = 0;
const png = () => new Blob([Buffer.concat([PNG, Buffer.from(`unique-${Date.now()}-${n++}-${Math.random()}`)])], { type: 'image/png' });
const invest = (c, needId, amount, acct, key) => {
  const f = new FormData(); f.set('funding_need_id', needId); f.set('amount', amount); f.set('idempotency_key', key || crypto.randomUUID());
  if (acct) f.set('expected_account_id', acct); f.set('proof', png(), 'proof.png'); return c.req('/api/investments', { method: 'POST', form: f });
};
const signup = (u, extra = {}) => new Client().req('/api/signup', { method: 'POST', json: { username: u, password: 'password-12345', ...extra } });
const sql = async (q, p) => (await db.query(q, p)).rows;

const admin = new Client(), inv1 = new Client(), inv2 = new Client(), g1 = new Client(), g2 = new Client(), anon = new Client();
const S = Date.now().toString(36);

section('Setup / security basics');
ok(await admin.login('admin', 'admin-password-1'), 'bootstrap admin can sign in');
ok((await anon.req('/api/investments')).status === 401, 'unauthenticated API call → 401');
const su = await signup('mallory' + S, { role: 'ADMIN', roles: ['ADMIN'] });
ok(su.status === 200, 'signup with injected role=ADMIN is accepted as a normal signup…');
ok((await sql(`SELECT roles FROM users WHERE username='mallory${S}'`))[0].roles.join() === 'INVESTOR', '…and the user is only an INVESTOR (33: cannot self-promote)');
const mal = new Client(); await mal.login('mallory' + S, 'password-12345');
ok((await mal.req('/api/admin/overview')).status === 403, 'non-admin cannot reach admin API (32)');
ok((await mal.req('/api/funding-needs', { method: 'POST', json: {} })).status === 403, 'non-admin cannot create funding needs');
const gg = await admin.req('/api/guarantors', { method: 'POST', json: { username: 'guar1' + S, password: 'password-12345', full_name: 'Guar One' } });
ok(gg.status === 200, 'admin creates guarantor account');
await admin.req('/api/guarantors', { method: 'POST', json: { username: 'guar2' + S, password: 'password-12345' } });
ok(await g1.login('guar1' + S, 'password-12345') && await g2.login('guar2' + S, 'password-12345'), 'guarantors sign in');
await signup('inv1' + S, { guarantor_username: 'guar1' + S }); await signup('inv2' + S);
ok(await inv1.login('inv1' + S, 'password-12345') && await inv2.login('inv2' + S, 'password-12345'), 'investors sign in');
const bad = await signup('x' + S, { guarantor_username: 'nobody' + S });
ok(bad.status === 400, 'signup with unknown guarantor rejected');

section('1–3  Two funding needs, same day, both open, accounts assigned');
const mkAcct = async (name, total, daily) => (await admin.req('/api/payment-accounts', { method: 'POST', json: { account_name: name, provider: 'BANK', bank_name: 'HBL', account_holder_name: 'Crystal Drinks', account_number: '1234-' + name, iban: 'PK36SCBL0000001123456702', instructions: 'Use your username as reference', total_limit: total, daily_limit: daily } })).data;
const acctA = await mkAcct('A' + S, null), acctW = (await admin.req('/api/payment-accounts', { method: 'POST', json: { account_name: 'Wallet' + S, provider: 'EASYPAISA', account_holder_name: 'Crystal Drinks', account_number: '0300-1234567' } })).data;
ok(acctA.id && acctW.id, 'bank + wallet accounts created (wallet without bank name/IBAN)');
const badAcct = await admin.req('/api/payment-accounts', { method: 'POST', json: { account_name: 'nobank', provider: 'BANK', account_holder_name: 'x', account_number: '1234' } });
ok(badAcct.status === 400, 'bank account without bank name rejected');
const need1 = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'Premium 1.5L ' + S, product: 'Premium', quantity: 10000, cost_price: '25', sell_price: '40', op_cost: '5', investor_pct: '40', guarantor_pct: '10', account_ids: [acctA.id], open_now: true } })).data;
const need2 = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'Standard 500ml ' + S, product: 'Standard', quantity: 4000, cost_price: '10', sell_price: '16', op_cost: '2', investor_pct: '30', guarantor_pct: '5', account_ids: [acctW.id], open_now: true } })).data;
ok(need1.status === 'OPEN' && need2.status === 'OPEN' && need1.total_capital === '250000.00', 'both needs OPEN simultaneously; capital = qty × cost');
ok((await admin.req('/api/funding-needs', { method: 'POST', json: { title: 't', product: 'p', quantity: 10, cost_price: '10', sell_price: '11', op_cost: '5', investor_pct: '10', guarantor_pct: '0' } })).status === 400, 'sell < cost + op cost rejected server-side');
ok((await admin.req('/api/funding-needs', { method: 'POST', json: { title: 't', product: 'p', quantity: 10, cost_price: '10.005', sell_price: '20', investor_pct: '10', guarantor_pct: '0' } })).status === 400, 'sub-paisa amounts rejected');
const catalogue = (await inv1.req('/api/funding-needs')).data.rows;
ok(catalogue.length >= 2 && !('guarantor_pct' in catalogue[0]) && !('created_by' in catalogue[0]), 'investor catalogue lists both needs and hides internal fields');

section('4–6  Investor submits; account assigned and snapshotted');
const q1 = (await inv1.req(`/api/funding-needs/${need1.id}/quote?amount=50000`)).data;
ok(q1.account?.account_id === acctA.id && q1.calc.investor_profit === '8000.00' && q1.calc.total_return === '58000.00', 'server quote: profit 8,000 and return 58,000 on 50,000');
const key = crypto.randomUUID();
const s1 = await invest(inv1, need1.id, '50000', acctA.id, key);
ok(s1.status === 200 && s1.data.investment.status === 'PENDING_VERIFICATION', 'investment created PENDING_VERIFICATION');
const i1 = s1.data.investment.id;
ok(s1.data.investment.payment_account_id === acctA.id && s1.data.investment.payment_snapshot.account_number === '1234-A' + S, 'payment account assigned and details snapshotted');
ok(s1.data.investment.verified_at === null && s1.data.investment.due_at === null, 'no countdown at submission');
const dup = await invest(inv1, need1.id, '50000', acctA.id, key);
ok(dup.status === 200 && dup.data.duplicate === true && dup.data.investment.id === i1, 'retry with same idempotency key returns the same investment (no duplicate)');
ok((await sql('SELECT count(*)::int n FROM investments WHERE investor_id=(SELECT id FROM users WHERE username=$1)', ['inv1' + S]))[0].n === 1, 'exactly one row exists after retry');
const reuse = new FormData(); reuse.set('funding_need_id', need1.id); reuse.set('amount', '1000'); reuse.set('idempotency_key', crypto.randomUUID()); reuse.set('expected_account_id', acctA.id);
const proofBytes = (await sql('SELECT data FROM payment_proofs ORDER BY id DESC LIMIT 1'))[0].data; reuse.set('proof', new Blob([proofBytes], { type: 'image/png' }), 'again.png');
ok((await inv2.req('/api/investments', { method: 'POST', form: reuse })).status === 409, 'the same screenshot cannot be submitted twice');
const notImg = new FormData(); notImg.set('funding_need_id', need1.id); notImg.set('amount', '1000'); notImg.set('idempotency_key', crypto.randomUUID()); notImg.set('proof', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
ok((await inv2.req('/api/investments', { method: 'POST', form: notImg })).status === 400, 'non-image disguised as PNG rejected (magic-byte check)');
ok((await invest(inv2, need1.id, '999999999', acctA.id)).status === 409, 'amount above remaining capital rejected');
ok((await invest(inv2, need1.id, '-5', acctA.id)).status === 400, 'negative amount rejected');
ok((await invest(inv2, need1.id, '10.555', acctA.id)).status === 400, 'amount with 3 decimals rejected');
ok((await admin.req('/api/investments', { method: 'POST', form: new FormData() })).status === 403, 'admin account cannot submit investments');
const queue = (await admin.req('/api/investments?status=PENDING_VERIFICATION')).data;
ok(queue.rows.some(r => r.id === i1 && r.account_name === 'A' + S && r.guarantor_username === 'guar1' + S), 'admin verification queue shows investor, need, account, guarantor');
ok((await sql(`SELECT count(*)::int n FROM notifications WHERE type='VERIFICATION_PENDING'`))[0].n >= 1, 'admin notified of pending verification');

section('30–31  Isolation between users');
ok((await inv2.req(`/api/investments/${i1}`)).status === 404, 'another investor cannot read this investment (30)');
const proofId = (await sql('SELECT proof_id FROM investments WHERE id=$1', [i1]))[0].proof_id;
ok((await inv2.req(`/api/proofs/${proofId}`)).status === 404, 'another investor cannot read the payment proof');
ok((await inv1.req(`/api/proofs/${proofId}`)).status === 200 && (await admin.req(`/api/proofs/${proofId}`)).status === 200, 'owner and admin can read the proof');
ok((await inv1.req(`/api/investments/${i1}/verify`, { method: 'POST' })).status === 403, 'investor cannot verify their own payment');

section('7–9  Verification: verified_at from DB clock, due_at = +168h exactly');
const [v1, v2] = await Promise.all([admin.req(`/api/investments/${i1}/verify`, { method: 'POST' }), admin.req(`/api/investments/${i1}/verify`, { method: 'POST' })]);
ok([v1.status, v2.status].sort().join() === '200,409', 'two simultaneous verifies: exactly one wins, other gets 409');
const row = (await sql(`SELECT verified_at, due_at, extract(epoch from (due_at - verified_at)) AS secs, expected_investor_profit, expected_total_return, guarantor_profit, business_profit, status FROM investments WHERE id=$1`, [i1]))[0];
ok(row.verified_at && Number(row.secs) === 604800, 'due_at − verified_at = 604,800 seconds (7 × 24h) exactly');
ok(row.expected_total_return === '58000.00' && row.expected_investor_profit === '8000.00' && row.guarantor_profit === '2000.00' && row.business_profit === '10000.00', 'frozen amounts: investor 8,000 · guarantor 2,000 · business 10,000 · return 58,000');
ok((await sql('SELECT count(*)::int n FROM payouts WHERE investment_id=$1', [i1]))[0].n === 1, 'exactly one payout row created');
try { await db.query(`UPDATE investments SET due_at = due_at + interval '1 hour' WHERE id=$1`, [i1]); ok(false, 'DB rejects a due_at that is not verified_at + 168h'); } catch { ok(true, 'DB constraint rejects any due_at that is not verified_at + 168h'); }

section('10–12  Countdown source of truth survives refresh / logout / login');
const d1 = (await inv1.req(`/api/investments/${i1}`)).data;
ok(d1.display_status === 'VERIFIED' && d1.server_now && new Date(d1.due_at) > new Date(d1.server_now), 'detail returns status, due_at and server_now for the countdown');
const inv1b = new Client(); await inv1b.login('inv1' + S, 'password-12345');
const d1b = (await inv1b.req(`/api/investments/${i1}`)).data;
ok(d1b.due_at === d1.due_at && d1b.verified_at === d1.verified_at, 'after a fresh login due_at is identical (no client state involved)');

section('13–15  Payout, transaction ID, immutability');
const pid = (await sql('SELECT id FROM payouts WHERE investment_id=$1', [i1]))[0].id;
ok((await admin.req(`/api/payouts/${pid}`, { method: 'PATCH', json: { action: 'pay', transaction_id: 'TXN-EARLY' } })).data.code === 'NOT_DUE', 'cannot pay before the 7 days have elapsed');
ok((await inv1.req(`/api/payouts/${pid}`, { method: 'PATCH', json: { action: 'pay', transaction_id: 'X1234' } })).status === 403, 'investor cannot mark payouts paid');
// time travel: pretend verification happened 8 days ago (moves both timestamps together so the 168h constraint holds)
await db.query(`UPDATE investments SET verified_at = verified_at - interval '8 days', due_at = due_at - interval '8 days' WHERE id=$1`, [i1]);
await db.query(`UPDATE payouts SET due_at = due_at - interval '8 days' WHERE id=$1`, [pid]);
const d2 = (await inv1.req(`/api/investments/${i1}`)).data;
ok(d2.display_status === 'PAYOUT_DUE', 'status becomes PAYOUT_DUE purely from due_at (no cron, no browser)');
ok((await sql(`SELECT count(*)::int n FROM notifications WHERE type='PAYOUT_DUE' AND link='/investments/${i1}'`))[0].n === 1, 'payout-due notification emitted exactly once');
await inv1.req('/api/me/dashboard'); await admin.req('/api/admin/overview');
ok((await sql(`SELECT count(*)::int n FROM notifications WHERE type='PAYOUT_DUE' AND link='/investments/${i1}'`))[0].n === 1, '…and not duplicated by later reads');
const ov = (await admin.req('/api/admin/overview')).data;
ok(ov.cards.payouts_due_count >= 1 && ov.cards.overdue_count >= 1, 'admin overview counts the payout as due and overdue');
await admin.req(`/api/payouts/${pid}`, { method: 'PATCH', json: { action: 'note', notes: 'INTERNAL: call investor first' } });
const [p1, p2] = await Promise.all([admin.req(`/api/payouts/${pid}`, { method: 'PATCH', json: { action: 'pay', transaction_id: 'TXN-PAID-' + S } }), admin.req(`/api/payouts/${pid}`, { method: 'PATCH', json: { action: 'pay', transaction_id: 'TXN-PAID2-' + S } })]);
ok([p1.status, p2.status].sort().join() === '200,409', 'paying twice concurrently: one succeeds, one 409 (13)');
const winTxn = p1.status === 200 ? 'TXN-PAID-' + S : 'TXN-PAID2-' + S;
const pay = (await inv1.req('/api/payouts')).data.rows[0];
ok(pay.status === 'PAID' && pay.transaction_id === winTxn && pay.paid_at, 'investor sees Paid + transaction ID + date (14)');
ok(!('notes' in pay) && !('paid_to' in pay), 'internal admin notes are NOT exposed to the investor');
ok((await inv1.req(`/api/investments/${i1}`)).data.display_status === 'COMPLETED', 'investment COMPLETED after payout');
ok((await admin.req(`/api/payouts/${pid}`, { method: 'PATCH', json: { action: 'pay', transaction_id: winTxn } })).status === 409, 'already-paid payout cannot be re-paid');
const beforeAmt = (await sql('SELECT amount FROM payouts WHERE id=$1', [pid]))[0].amount;
const edit = await admin.req(`/api/funding-needs/${need1.id}`, { method: 'PATCH', json: { title: need1.title, product: 'Premium', quantity: 10000, cost_price: '25', sell_price: '60', op_cost: '5', investor_pct: '40', guarantor_pct: '10', account_ids: [acctA.id] } });
ok(edit.status === 409, 'repricing a need that already has investments is refused');
const edit2 = await admin.req(`/api/funding-needs/${need1.id}`, { method: 'PATCH', json: { title: need1.title + ' (renamed)', product: 'Premium', quantity: 12000, cost_price: '25', sell_price: '40', op_cost: '5', investor_pct: '40', guarantor_pct: '10', account_ids: [acctA.id] } });
ok(edit2.status === 200, 'title/quantity edits still allowed');
await db.query(`UPDATE funding_needs SET sell_price = 99 WHERE id=$1`, [need1.id]); // even a raw DB change must not affect history
const after = (await sql('SELECT i.expected_total_return, p.amount FROM investments i JOIN payouts p ON p.investment_id=i.id WHERE i.id=$1', [i1]))[0];
ok(after.amount === beforeAmt && after.expected_total_return === '58000.00', 'historical payout & expected return unchanged after terms change (15)');
await db.query(`UPDATE funding_needs SET sell_price = 40 WHERE id=$1`, [need1.id]);

section('24–28  Account limits, deactivation, reassignment');
const acctL = await mkAcct('LIM' + S, '30000');
const need3 = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'Limit test ' + S, product: 'L', quantity: 100000, cost_price: '10', sell_price: '20', investor_pct: '50', guarantor_pct: '0', account_ids: [acctL.id], open_now: true } })).data;
const l1 = await invest(inv1, need3.id, '20000', acctL.id);
ok(l1.status === 200, 'first 20,000 fits the 30,000 account limit');
const l2 = await invest(inv2, need3.id, '20000', acctL.id);
ok(l2.status === 409 && l2.data.code === 'NO_ACCOUNT' && /No payment account is currently available/.test(l2.data.error), 'second 20,000 refused with the “No payment account is currently available” message (25)');
const acctState = (await admin.req(`/api/payment-accounts/${acctL.id}`)).data.account;
ok(acctState.remaining_amount === '10000.00' && acctState.availability === 'ACTIVE', 'account shows 10,000 remaining');
ok((await invest(inv2, need3.id, '10000', acctL.id)).status === 200, 'a smaller amount that still fits is accepted');
ok((await admin.req(`/api/payment-accounts/${acctL.id}`)).data.account.availability === 'LIMIT_REACHED', 'account now flagged LIMIT_REACHED (24)');
const q3 = (await inv1.req(`/api/funding-needs/${need3.id}/quote?amount=100`)).data;
ok(q3.account === null && q3.unavailable_message, 'quote reports no account for new investments');
const acctB = await mkAcct('B' + S, null);
await admin.req(`/api/funding-needs/${need3.id}/accounts`, { method: 'PUT', json: { account_ids: [acctL.id, acctB.id] } });
const q4 = (await inv1.req(`/api/funding-needs/${need3.id}/quote?amount=100`)).data;
ok(q4.account?.account_id === acctB.id, 'assigning another account makes investing possible again (28)');
const stale = await invest(inv1, need3.id, '100', acctL.id);
ok(stale.status === 409 && stale.data.code === 'ACCOUNT_CHANGED', 'submitting against the OLD shown account is refused, never silently switched');
const deact = await admin.req(`/api/payment-accounts/${acctB.id}/status`, { method: 'POST', json: { action: 'deactivate' } });
ok(deact.status === 200, 'admin deactivates an account (26)');
ok((await invest(inv1, need3.id, '100')).status === 409, 'deactivated account is not offered for new investments');
await admin.req(`/api/payment-accounts/${acctB.id}/status`, { method: 'POST', json: { action: 'reactivate' } });
const hist = (await inv1.req(`/api/investments/${l1.data.investment.id}`)).data;
ok(hist.payment_snapshot.account_number === '1234-LIM' + S, 'historical investment keeps its snapshot (27)');
await admin.req(`/api/payment-accounts/${acctL.id}`, { method: 'PATCH', json: { account_name: 'LIM renamed', provider: 'BANK', bank_name: 'MCB', account_holder_name: 'NEW HOLDER', account_number: '9999-NEW', total_limit: '30000' } });
const hist2 = (await inv1.req(`/api/investments/${l1.data.investment.id}`)).data;
ok(hist2.payment_snapshot.account_number === '1234-LIM' + S && hist2.payment_snapshot.account_holder_name === 'Crystal Drinks', 'editing the account later never changes what an existing investment displays');
ok((await admin.req(`/api/payment-accounts/${acctL.id}`, { method: 'PATCH', json: { account_name: 'xx', provider: 'BANK', bank_name: 'MCB', account_holder_name: 'yy', account_number: '1234', total_limit: '1000' } })).status === 409, 'limit cannot be lowered below what is already routed');
// reject → capacity released
const rej = await admin.req(`/api/investments/${l1.data.investment.id}/reject`, { method: 'POST', json: { reason: '' } });
ok(rej.status === 400, 'rejection requires a reason');
ok((await admin.req(`/api/investments/${l1.data.investment.id}/reject`, { method: 'POST', json: { reason: 'Amount mismatch in screenshot' } })).status === 200, 'admin rejects with a reason');
const rj = (await inv1.req(`/api/investments/${l1.data.investment.id}`)).data;
ok(rj.display_status === 'REJECTED' && rj.rejection_reason === 'Amount mismatch in screenshot' && rj.due_at === null, 'investor sees rejection reason; no countdown');
ok((await admin.req(`/api/payment-accounts/${acctL.id}`)).data.account.allocated_amount === '10000.00', 'rejected amount released from account capacity');

section('29  Concurrency: simultaneous investments cannot exceed capacity');
const acctC = await mkAcct('CONC' + S, '100000');
const need4 = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'Concurrency ' + S, product: 'C', quantity: 1000000, cost_price: '10', sell_price: '20', investor_pct: '50', guarantor_pct: '0', account_ids: [acctC.id], open_now: true } })).data;
const racers = []; for (let k = 0; k < 6; k++) { const u = 'racer' + k + S; await signup(u); const c = new Client(); await c.login(u, 'password-12345'); racers.push(c); }
const results = await Promise.all(racers.map(c => invest(c, need4.id, '30000', acctC.id)));
const wins = results.filter(r => r.status === 200).length;
ok(wins === 3, `6 simultaneous 30,000 submissions against a 100,000 account → exactly 3 succeed (got ${wins})`);
const fin = (await admin.req(`/api/payment-accounts/${acctC.id}`)).data.account;
ok(fin.allocated_amount === '90000.00' && Number(fin.remaining_amount) === 10000, 'account allocated = 90,000; never exceeds its limit');
const needRace = (await sql('SELECT funded_amount FROM funding_needs WHERE id=$1', [need4.id]))[0].funded_amount;
ok(needRace === '90000.00', 'funding need funded_amount consistent with the winners');
// need-level race: need almost full
const acctBig = await mkAcct('BIG' + S, null);
const need5 = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'Tiny ' + S, product: 'T', quantity: 100, cost_price: '10', sell_price: '20', investor_pct: '50', guarantor_pct: '0', account_ids: [acctBig.id], open_now: true } })).data;
const r2 = await Promise.all(racers.map(c => invest(c, need5.id, '500', acctBig.id)));
ok(r2.filter(r => r.status === 200).length === 2 && (await sql('SELECT status, funded_amount FROM funding_needs WHERE id=$1', [need5.id]))[0].status === 'FULL', 'need with 1,000 capital accepts exactly two 500 submissions among 6 racers, then turns FULL');
ok((await admin.req(`/api/funding-needs/${need5.id}/status`, { method: 'POST', json: { action: 'cancel', reason: 'testing' } })).status === 409, 'cannot cancel a need that has pending investments');

section('16–19  Guarantor earnings, monthly payment');
const gd = (await g1.req('/api/guarantor/dashboard')).data;
const gId = (await sql('SELECT id FROM users WHERE username=$1', ['guar1' + S]))[0].id;
const expMonth = (await sql(`SELECT COALESCE(SUM(guarantor_profit),0) AS s FROM investments WHERE guarantor_id=$1 AND status IN ('VERIFIED','PAYOUT_DUE','COMPLETED') AND verified_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')`, [gId]))[0].s;
ok(gd.cards.referred_investors === 1 && Number(gd.cards.earnings_this_month) === Number(expMonth) && Number(gd.cards.pending_earnings) === 2000, 'guarantor dashboard: this-month earnings match the DB; pending 2,000 (16)');
ok(Number((await g2.req('/api/guarantor/dashboard')).data.cards.earnings_this_month) === 0, 'other guarantor sees none of it');
ok((await inv1.req('/api/guarantor/dashboard')).status === 403, 'investor cannot open guarantor dashboard');
const month = new Date().toISOString().slice(0, 7);
const prev = (await admin.req(`/api/guarantor-payments?preview=1&month=${month}`)).data.rows;
ok(prev.length === 1 && prev[0].amount === '2000.00', 'settlement preview: one guarantor, 2,000');
ok((await g1.req('/api/guarantor-payments', { method: 'POST', json: { month } })).status === 403, 'guarantor cannot create settlements');
const gen = await admin.req('/api/guarantor-payments', { method: 'POST', json: { month } });
ok(gen.status === 200 && gen.data.created === 1, 'admin creates the monthly guarantor payment (17)');
const gen2 = await admin.req('/api/guarantor-payments', { method: 'POST', json: { month } });
ok(gen2.data.created === 0 && (await sql('SELECT count(*)::int n FROM guarantor_payments')).at(0).n === 1, 'creating again is idempotent (no duplicate payment)');
const gp = (await g1.req('/api/guarantor-payments')).data.rows[0];
ok(gp.status === 'PENDING' && gp.amount === '2000.00' && !('notes' in gp), 'guarantor sees the payment (no internal notes)');
ok((await admin.req(`/api/guarantor-payments/${gp.id}`, { method: 'PATCH', json: { action: 'process' } })).status === 200, 'admin marks processing');
ok((await admin.req(`/api/guarantor-payments/${gp.id}`, { method: 'PATCH', json: { action: 'pay', transaction_id: winTxn } })).status === 409, 'a transaction ID already used elsewhere is refused');
ok((await admin.req(`/api/guarantor-payments/${gp.id}`, { method: 'PATCH', json: { action: 'pay', transaction_id: 'GTX-' + S, notes: 'internal' } })).status === 200, 'admin enters transaction ID and marks paid (18)');
const gp2 = (await g1.req('/api/guarantor-payments')).data.rows[0];
ok(gp2.status === 'PAID' && gp2.transaction_id === 'GTX-' + S, 'guarantor sees payment and transaction ID (19)');
ok((await g2.req(`/api/guarantor-payments/${gp.id}`)).status === 404 && (await g2.req(`/api/guarantors/${(await sql('SELECT id FROM users WHERE username=$1', ['guar1' + S]))[0].id}/payments`)).status === 404, 'another guarantor cannot read this payment (31)');
ok((await inv1.req('/api/guarantor-payments')).status === 403, 'investor cannot list guarantor payments');

section('20–22  Payment claim');
ok((await g2.req('/api/payment-claims', { method: 'POST', json: { guarantor_payment_id: gp.id, reason: 'not mine' } })).status === 404, 'another guarantor cannot claim on this payment');
const [c1, c2] = await Promise.all([1, 2].map(() => g1.req('/api/payment-claims', { method: 'POST', json: { guarantor_payment_id: gp.id, reason: 'Nothing arrived in my account' } })));
ok(c1.status === 200 && c2.status === 200 && (c1.data.duplicate !== c2.data.duplicate), 'double-click: one claim created, the other returns the existing one (20)');
ok((await sql('SELECT count(*)::int n FROM payment_claims')).at(0).n === 1, 'only one claim row');
ok((await sql('SELECT status FROM guarantor_payments WHERE id=$1', [gp.id]))[0].status === 'CLAIMED_NOT_RECEIVED' && (await sql('SELECT transaction_id FROM guarantor_payments WHERE id=$1', [gp.id]))[0].transaction_id === 'GTX-' + S, 'payment flagged, NOT reversed (transaction ID kept)');
const claims = (await admin.req('/api/payment-claims?status=OPEN')).data.rows;
ok(claims.length === 1 && claims[0].claimant === 'guar1' + S && claims[0].transaction_id === 'GTX-' + S, 'admin sees the claim with payment and transaction (21)');
const cid = claims[0].id;
ok((await g1.req(`/api/payment-claims/${cid}`, { method: 'PATCH', json: { action: 'resolve', resolution_note: 'me' } })).status === 403, 'claimant cannot resolve their own claim');
ok((await admin.req(`/api/payment-claims/${cid}`, { method: 'PATCH', json: { action: 'review' } })).status === 200, 'admin starts review');
await admin.req(`/api/payment-claims/${cid}`, { method: 'PATCH', json: { action: 'note', note: 'Checked bank statement' } });
ok((await admin.req(`/api/payment-claims/${cid}`, { method: 'PATCH', json: { action: 'resolve', resolution_note: '' } })).status === 400, 'resolution requires a note');
ok((await admin.req(`/api/payment-claims/${cid}`, { method: 'PATCH', json: { action: 'resolve', resolution_note: 'Re-sent payment', replacement_transaction_id: 'REPL-' + S } })).status === 200, 'admin resolves with replacement transaction (22)');
const mine = (await g1.req('/api/payment-claims')).data.rows[0];
ok(mine.status === 'RESOLVED' && mine.resolution_note === 'Re-sent payment' && !('admin_notes' in mine), 'guarantor sees resolution; internal notes hidden');
ok((await sql('SELECT status, replacement_transaction_id FROM guarantor_payments WHERE id=$1', [gp.id]))[0].status === 'RESOLVED', 'payment marked RESOLVED with replacement transaction recorded');
ok((await admin.req(`/api/payment-claims/${cid}`, { method: 'PATCH', json: { action: 'resolve', resolution_note: 'again' } })).status === 409, 'a closed claim cannot be resolved twice');
const ic = await inv1.req('/api/payment-claims', { method: 'POST', json: { payout_id: pid, reason: 'Investor says missing' } });
ok(ic.status === 200, 'investor can also report a payout as not received');
ok((await admin.req(`/api/payment-claims/${ic.data.claim.id}`, { method: 'PATCH', json: { action: 'reject', resolution_note: 'Bank confirms receipt' } })).status === 200 && (await sql('SELECT status FROM payouts WHERE id=$1', [pid]))[0].status === 'PAID', 'rejecting a claim returns the payment to PAID');

section('23  Audit log');
const audits = (await admin.req('/api/admin/audit-logs?size=100')).data.rows.map(r => r.action);
for (const a of ['funding_need.created', 'funding_need.updated', 'funding_need.accounts_assigned', 'payment_account.created', 'payment_account.deactivated', 'investment.submitted', 'investment.verified', 'investment.rejected', 'payout.paid', 'guarantor_payment.created', 'guarantor_payment.paid', 'payment_claim.opened', 'payment_claim.resolved'])
  ok(audits.includes(a) || (await sql('SELECT 1 FROM audit_logs WHERE action=$1 LIMIT 1', [a])).length > 0, `audit: ${a}`);
ok((await inv1.req('/api/admin/audit-logs')).status === 403, 'audit log is admin-only');
ok((await admin.req('/api/admin/settings', { method: 'PUT', json: { near_limit_pct: 80 } })).status === 200 && (await sql(`SELECT 1 FROM audit_logs WHERE action='settings.changed'`)).length === 1, 'settings change is audited');

section('Reports / exports');
const csv = await fetch(BASE + '/api/investments?format=csv', { headers: { Cookie: Object.entries(admin.jar).map(([k, v]) => `${k}=${v}`).join('; ') } });
ok(csv.status === 200 && (csv.headers.get('content-type') || '').includes('text/csv') && (await csv.text()).includes('Investment ID'), 'admin CSV export works');
ok((await inv1.req('/api/investments?format=csv')).status === 400, 'investors cannot export');

section('New: minimum investment per funding need');
ok((await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'bad min', product: 'p', quantity: 10, cost_price: '10', sell_price: '20', investor_pct: '10', guarantor_pct: '0', min_investment: '999999' } })).status === 400, 'minimum above required capital rejected');
const need6 = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'MinTest ' + S, product: 'M', quantity: 500, cost_price: '10', sell_price: '20', investor_pct: '50', guarantor_pct: '0', min_investment: '1000', account_ids: [acctBig.id], open_now: true } })).data;
ok(need6.min_investment === '1000.00', 'need saved with min_investment 1,000');
const mq = (await inv1.req(`/api/funding-needs/${need6.id}/quote?amount=500`)).data;
ok(/minimum/i.test(mq.amount_error || '') && mq.min_amount === '1000.00', 'quote reports the minimum');
const mb = await invest(inv1, need6.id, '500', acctBig.id);
ok(mb.status === 409 && mb.data.code === 'BELOW_MIN', 'submission below the minimum refused');
ok((await invest(inv1, need6.id, '1000', acctBig.id)).status === 200, 'exactly the minimum accepted');
ok((await invest(inv2, need6.id, '3500', acctBig.id)).status === 200, 'larger amount accepted (500 left)');
ok((await invest(inv1, need6.id, '400', acctBig.id)).status === 409, '400 (< min, not the last slice) refused');
ok((await invest(inv1, need6.id, '500', acctBig.id)).status === 200, 'final remaining slice (500 < min) is allowed');
ok((await sql('SELECT status FROM funding_needs WHERE id=$1', [need6.id]))[0].status === 'FULL', 'need is FULL');
ok((await admin.req(`/api/funding-needs/${need6.id}`, { method: 'PATCH', json: { title: 'MinTest ' + S, product: 'M', quantity: 500, cost_price: '10', sell_price: '20', op_cost: '0', investor_pct: '50', guarantor_pct: '0', min_investment: '2000', account_ids: [acctBig.id] } })).status === 200, 'admin can change the minimum even after investments exist');

section('New: fallback guarantor (share for investors with no guarantor)');
const adminId = (await sql(`SELECT id FROM users WHERE username='admin'`))[0].id;
ok((await inv1.req('/api/admin/settings', { method: 'PUT', json: { fallback_guarantor_id: adminId } })).status === 403, 'non-admin cannot change settings');
ok((await admin.req('/api/admin/settings', { method: 'PUT', json: { fallback_guarantor_id: 999999 } })).status === 400, 'unknown fallback account rejected');
const fbSet = await admin.req('/api/admin/settings', { method: 'PUT', json: { fallback_guarantor_id: adminId } });
ok(fbSet.status === 200 && fbSet.data.fallback_guarantor_id === adminId, 'admin sets themselves as the fallback guarantor');
ok((await sql(`SELECT roles FROM users WHERE id=$1`, [adminId]))[0].roles.includes('GUARANTOR'), 'admin account gained the GUARANTOR role (audited)');
const f1 = (await invest(inv2, need1.id, '10000', acctA.id)).data.investment.id;   // inv2 has no guarantor
await admin.req(`/api/investments/${f1}/verify`, { method: 'POST' });
const fr = (await sql('SELECT guarantor_id, guarantor_is_fallback, guarantor_profit, business_profit FROM investments WHERE id=$1', [f1]))[0];
ok(fr.guarantor_id === adminId && fr.guarantor_is_fallback === true && fr.guarantor_profit === '400.00', 'no-guarantor investment: 400 guarantor share credited to the admin account');
const f2 = (await invest(inv1, need1.id, '10000', acctA.id)).data.investment.id;   // inv1 has guar1
await admin.req(`/api/investments/${f2}/verify`, { method: 'POST' });
const fr2 = (await sql('SELECT guarantor_id, guarantor_is_fallback FROM investments WHERE id=$1', [f2]))[0];
ok(fr2.guarantor_is_fallback === false && fr2.guarantor_id !== adminId, 'investor WITH a guarantor is unaffected by the fallback');
const ad = (await admin.req('/api/guarantor/dashboard')).data;
ok(Number(ad.cards.earnings_this_month) === 400, 'admin sees the 400 on their guarantor dashboard');
ok(!('guarantor_is_fallback' in (await inv2.req(`/api/investments/${f1}`)).data), 'investor cannot see guarantor/fallback details');
const pv = (await admin.req(`/api/guarantor-payments?preview=1&month=${month}`)).data.rows;
ok(pv.length === 2 && pv.find(r => r.guarantor_id === adminId)?.amount === '400.00', 'settlement preview lists the admin (400) and guar1 (400)');
const g3 = await admin.req('/api/guarantor-payments', { method: 'POST', json: { month } });
ok(g3.data.created === 1 && g3.data.skipped === 1, 'settlement: admin payment created; guar1’s already-paid month is skipped (earning rolls forward, not lost)');
const late = (await sql(`SELECT count(*)::int n FROM investments i WHERE i.id=$1 AND NOT EXISTS (SELECT 1 FROM guarantor_payment_items x WHERE x.investment_id=i.id)`, [f2]))[0].n;
ok(late === 1, 'guar1’s late earning stays unsettled for the next settlement');
ok((await admin.req('/api/admin/settings', { method: 'PUT', json: { fallback_guarantor_id: null } })).status === 200, 'fallback can be switched off');
const f3 = (await invest(inv2, need1.id, '5000', acctA.id)).data.investment.id;
await admin.req(`/api/investments/${f3}/verify`, { method: 'POST' });
const fr3 = (await sql('SELECT guarantor_id, guarantor_profit, business_profit FROM investments WHERE id=$1', [f3]))[0];
ok(fr3.guarantor_id === null && fr3.guarantor_profit === '0.00', 'with fallback off, the share stays in business profit again');

section('Regression: overview / date shapes the pages rely on');
const ov2 = (await admin.req('/api/admin/overview')).data;
const future = ov2.cashflow.filter(c => c.day !== null);
ok(future.length >= 1 && future.every(c => /^\d{4}-\d{2}-\d{2}$/.test(c.day) && !isNaN(new Date(c.day + 'T12:00:00Z'))), 'overview cash-flow days are plain YYYY-MM-DD strings and form valid dates');
const gpl = (await admin.req('/api/guarantor-payments')).data.rows;
ok(gpl.length >= 1 && gpl.every(r => /^\d{4}-\d{2}-01$/.test(r.period_month)), 'guarantor period_month is a plain YYYY-MM-01 string (no timezone shift)');
const cl = (await admin.req('/api/payment-claims')).data.rows;
ok(cl.filter(r => r.kind === 'GUARANTOR_PAYMENT').every(r => /^\d{4}-\d{2}-01$/.test(r.period_month)), 'claims carry plain period_month strings too');
ok(ov2.cards.payouts_due_count !== undefined && Array.isArray(ov2.near_limit) && Array.isArray(ov2.needs) && Array.isArray(ov2.recent), 'overview payload has every section the page reads');
const st2 = (await admin.req('/api/admin/settings')).data;
ok(Array.isArray(st2.candidates) && 'fallback_guarantor_id' in st2, 'settings payload has candidates + fallback_guarantor_id');
section('New: admin can also use the investor side');
ok((await inv1.req('/api/me/roles', { method: 'POST', json: { investor: true } })).status === 403, 'non-admin cannot use the roles endpoint');
ok((await admin.req('/api/me/roles', { method: 'POST', json: { roles: ['ADMIN'], investor: true } })).status === 200 && (await sql(`SELECT roles FROM users WHERE id=$1`, [adminId]))[0].roles.includes('INVESTOR'), 'admin turns on their investor side');
ok((await sql(`SELECT roles FROM users WHERE id=$1`, [adminId]))[0].roles.includes('ADMIN'), '…and keeps ADMIN');
const aNeeds = (await admin.req('/api/funding-needs?view=investor')).data.rows;
ok(aNeeds.length > 0 && 'calc' in aNeeds[0] && !('created_by' in aNeeds[0]), 'admin gets the investor view of funding needs when asked');
ok('pending_count' in (await admin.req('/api/funding-needs')).data.rows[0], '…and still the admin view by default');
ok((await admin.req(`/api/funding-needs/${need1.id}?view=investor`)).data.need.calc, 'investor-view single need works for admin');
const ownInv = await invest(admin, need1.id, '3000', acctA.id);
ok(ownInv.status === 200 && ownInv.data.investment.investor_id === adminId, 'admin submits an investment like any investor');
const mineList = (await admin.req('/api/investments?scope=mine')).data;
ok(mineList.rows.length === 1 && mineList.rows[0].id === ownInv.data.investment.id, 'scope=mine lists ONLY the admin’s own investments');
ok((await admin.req('/api/investments')).data.rows.length > 5, 'default admin list still shows everyone’s');
ok((await admin.req(`/api/investments/${ownInv.data.investment.id}/verify`, { method: 'POST' })).status === 200, 'admin can verify their own investment (sole-admin business)');
ok((await sql(`SELECT metadata FROM audit_logs WHERE action='investment.verified' AND entity_id=$1`, [String(ownInv.data.investment.id)]))[0].metadata.self_review === true, '…and the audit log flags it as a self-review');
ok((await admin.req('/api/payouts?scope=mine')).data.rows.every(r => r.investor_id === adminId) && (await admin.req('/api/payouts?scope=mine')).data.rows.length === 1, 'scope=mine payouts: only the admin’s own');
ok((await admin.req('/api/guarantor-payments?scope=mine')).data.rows.every(r => r.guarantor_id === adminId), 'scope=mine guarantor payments: only the admin’s own');
ok((await admin.req('/api/guarantor-payments')).data.rows.length > (await admin.req('/api/guarantor-payments?scope=mine')).data.rows.length, 'default admin view of guarantor payments still shows all');
ok((await inv2.req('/api/investments?scope=all')).data.rows.every(r => r.investor_id !== adminId), 'scope parameter cannot widen a normal investor’s view');
ok((await admin.req('/api/me')).data.roles.includes('INVESTOR'), 'profile endpoint works for the admin');
ok((await admin.req('/api/me/roles', { method: 'POST', json: { investor: false } })).status === 200 && !(await sql(`SELECT roles FROM users WHERE id=$1`, [adminId]))[0].roles.includes('INVESTOR'), 'admin can turn the investor side off again');
ok((await invest(admin, need1.id, '1000', acctA.id)).status === 403, '…after which investing is refused for that account');
await admin.req('/api/me/roles', { method: 'POST', json: { investor: true } });
section('Sweep: every admin read endpoint (list + detail) answers 200 with real data');
const anyId = async (t) => (await sql(`SELECT id FROM ${t} ORDER BY id LIMIT 1`))[0]?.id;
const needIds = (await sql(`SELECT id, status FROM funding_needs ORDER BY id`));
let sweepOk = true; const sweepBad = [];
for (const n of needIds) { const r = await admin.req(`/api/funding-needs/${n.id}`); if (r.status !== 200 || !r.data.need || !r.data.calc) { sweepOk = false; sweepBad.push(`need ${n.id} (${n.status}) → ${r.status}`); }
  const r2 = await admin.req(`/api/funding-needs/${n.id}/investments`); if (r2.status !== 200) { sweepOk = false; sweepBad.push(`need ${n.id} investments → ${r2.status}`); } }
ok(sweepOk && needIds.length > 5, `funding-need detail + investments open for all ${needIds.length} needs (draft, open, full, closed…)` + (sweepBad.length ? ' — ' + sweepBad.join('; ') : ''));
const draft = (await admin.req('/api/funding-needs', { method: 'POST', json: { title: 'Draft sweep ' + S, product: 'D', quantity: 100, cost_price: '35', sell_price: '60', op_cost: '5', investor_pct: '20', guarantor_pct: '10' } })).data;
const dr = await admin.req(`/api/funding-needs/${draft.id}`);
ok(dr.status === 200 && dr.data.need.status === 'DRAFT' && dr.data.accounts.length === 0, 'a DRAFT with no accounts and no investments opens (the case that failed in production)');
const reads = ['/api/funding-needs', '/api/investments', `/api/investments/${await anyId('investments')}`, '/api/payment-accounts', `/api/payment-accounts/${await anyId('payment_accounts')}`, '/api/payouts', '/api/guarantors', '/api/admin/investors', '/api/guarantor-payments', `/api/guarantor-payments/${await anyId('guarantor_payments')}`, '/api/payment-claims', '/api/admin/audit-logs', '/api/admin/settings', '/api/admin/overview', '/api/notifications', '/api/me', '/api/me/dashboard'];
const failed = []; for (const u of reads) { const r = await admin.req(u); if (r.status !== 200) failed.push(`${u} → ${r.status}`); }
ok(failed.length === 0, `all ${reads.length} other admin read endpoints return 200` + (failed.length ? ' — ' + failed.join('; ') : ''));
section('New: public welcome page + calculator (no login)');
const pub = new Client();
const pc = (await pub.req(`/api/public/calculator?need_id=${need1.id}&amount=50000&referred=500000`)).data;
ok(pc.invest?.profit === '8000.00' && pc.invest.total_return === '58000.00' && pc.invest.return_pct === '16.00' && pc.invest.days === 7, 'anonymous calculator: 50,000 → profit 8,000, total 58,000 after 7 days (16%)');
ok(pc.referral?.guarantor_earnings === '20000.00' && pc.combined?.total_profit === '28000.00', 'referring 500,000 earns 20,000 as guarantor; combined with own profit 28,000');
const only = (await pub.req(`/api/public/calculator?need_id=${need1.id}&referred=100000`)).data;
ok(only.invest === null && only.referral.guarantor_earnings === '4000.00' && only.combined.total_profit === '4000.00', 'guarantor-only scenario (no own money): 4,000 per 100,000 referred');
const leak = JSON.stringify(pc);
ok(!/cost_price|sell_price|op_cost|business_pct|business_profit|created_by/.test(leak), 'public payload exposes no prices, costs or business share');
ok((await pub.req('/api/public/calculator?amount=abc')).status === 400 && (await pub.req('/api/public/calculator?amount=-5')).status === 400 && (await pub.req('/api/public/calculator?amount=99999999999999')).status === 400, 'invalid / negative / absurd amounts rejected');
ok((await pub.req(`/api/public/calculator?need_id=${draft.id}`)).status === 404, 'a DRAFT need is not visible publicly');
ok(!pc.needs.some(x => x.id === draft.id), 'public list contains only open/full needs');
const home = await pub.req('/');
ok(home.status === 200 && /Profit calculator|See what you/.test(home.data) && /How it works/.test(home.data), 'welcome page renders for visitors at /');
ok(!/cost_price|sell_price|op_cost/.test(home.data), 'welcome page HTML exposes no private pricing');
ok((await admin.req('/')).status === 307, 'signed-in users are sent on to their dashboard');
ok((await pub.req('/admin')).status === 307 && (await pub.req('/dashboard')).status === 307, 'protected areas still redirect visitors to sign-in');
console.log(`\n${pass} passed, ${fail} failed`); await db.end(); process.exit(fail ? 1 : 0);
