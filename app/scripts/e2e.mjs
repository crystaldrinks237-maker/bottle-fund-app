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
ok(gd.cards.referred_investors === 1 && Number(gd.cards.earnings_this_month) === 2000 && Number(gd.cards.pending_earnings) === 2000, 'guarantor dashboard: earnings this month 2,000 (16)');
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

console.log(`\n${pass} passed, ${fail} failed`); await db.end(); process.exit(fail ? 1 : 0);
