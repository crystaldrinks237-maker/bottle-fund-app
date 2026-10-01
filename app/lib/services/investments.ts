import crypto from 'node:crypto';
import { query, tx } from '../db';
import { audit } from '../audit';
import { notify, notifyAdmins } from '../notify';
import { ApiError, bad, conflict, notFound, Where, likeTerm, pageParams, sortParam } from '../api';
import { calcInvestment } from '../calc';
import { reasonSchema } from '../validators';
import { toPaisa, fromPaisa } from '../money';
import { APP_TIMEZONE, ALLOWED_PROOF_TYPES, MAX_PROOF_BYTES } from '../config';
import { formatMoney, formatDateTime } from '../format';
import { DAY_START_SQL } from './accounts';
import type { CurrentUser } from '../session';
import { isAdmin } from '../session';

/** Effective status: derived from due_at so it is correct even if nothing has "run" since the deadline passed. */
export const EFF = `(CASE WHEN i.status = 'VERIFIED' AND i.due_at <= now() THEN 'PAYOUT_DUE' ELSE i.status END)`;

export const NO_ACCOUNT_MSG = 'No payment account is currently available for this funding need. Please try again later.';

/** Lazily flips VERIFIED → PAYOUT_DUE once due_at has passed and emits the notifications exactly once. No cron needed. */
export async function materializeDue() {
  const due = await query(`SELECT 1 FROM investments WHERE status = 'VERIFIED' AND due_at <= now() LIMIT 1`);
  if (!due.length) return;
  await tx(async t => {
    const rows = await t.q(
      `UPDATE investments SET status = 'PAYOUT_DUE', updated_at = now() WHERE status = 'VERIFIED' AND due_at <= now()
       RETURNING id, investor_id, expected_total_return`);
    for (const r of rows) {
      await notify(t, r.investor_id, { type: 'PAYOUT_DUE', title: 'Your payout is due', body: `Investment #${r.id}: ${formatMoney(r.expected_total_return)} is now due and will be sent shortly.`, link: `/investments/${r.id}` });
      await notifyAdmins(t, { type: 'PAYOUT_DUE', title: 'Investor payout due', body: `Investment #${r.id} — ${formatMoney(r.expected_total_return)}`, link: '/admin/payouts?status=DUE' });
    }
  });
}

const ACCT_CAND_SQL = `SELECT pa.*, f.priority,
    COALESCE((SELECT SUM(i.amount) FROM investments i WHERE i.payment_account_id = pa.id AND i.status <> 'REJECTED' AND i.created_at >= ${DAY_START_SQL}), 0) AS today_amount
  FROM funding_need_accounts f JOIN payment_accounts pa ON pa.id = f.payment_account_id
  WHERE f.funding_need_id = $1 AND pa.status = 'ACTIVE' ORDER BY pa.id`;

/** Accounts that can take `amount` right now, best (lowest priority number) first. */
export function eligibleAccounts(cands: any[], amount: bigint) {
  return cands
    .filter(a => a.total_limit == null || toPaisa(a.allocated_amount) + amount <= toPaisa(a.total_limit))
    .filter(a => a.daily_limit == null || toPaisa(a.today_amount) + amount <= toPaisa(a.daily_limit))
    .sort((a, b) => a.priority - b.priority || a.id - b.id);
}
const accountPublic = (a: any) => ({ account_id: a.id, account_name: a.account_name, provider: a.provider, bank_name: a.bank_name, account_holder_name: a.account_holder_name, account_number: a.account_number, iban: a.iban, instructions: a.instructions });

/** Non-locking preview used by the investment form: what the investor would be told to pay, and how much they can put in. */
export async function quoteInvestment(needId: number, amountRaw: string | null) {
  const [need] = await query('SELECT * FROM funding_needs WHERE id = $1', [needId]);
  if (!need || !['OPEN', 'FULL'].includes(need.status)) throw notFound('Funding need not found');
  const cands = await query(ACCT_CAND_SQL, [needId]);
  let amt = 1n, calc: any = null, amountError: string | null = null;
  if (amountRaw) {
    try {
      amt = toPaisa(amountRaw);
      if (amt <= 0n) throw new Error('Enter an amount greater than zero');
      if (amt > toPaisa(need.remaining_amount)) amountError = `Only ${formatMoney(need.remaining_amount)} is still needed.`;
      else if (amt < toPaisa(need.min_investment) && amt !== toPaisa(need.remaining_amount)) amountError = `The minimum investment is ${formatMoney(need.min_investment)}.`;
      else calc = calcInvestment(need, amt);
      if (!amountError) calc = { ...calc, investor_profit_pct: need.investor_pct };
    } catch (e: any) { amountError = e.message; amt = 1n; }
  }
  const eligible = eligibleAccounts(cands, amt);
  const cap = (a: any) => {
    const left: bigint[] = [];
    if (a.total_limit != null) left.push(toPaisa(a.total_limit) - toPaisa(a.allocated_amount));
    if (a.daily_limit != null) left.push(toPaisa(a.daily_limit) - toPaisa(a.today_amount));
    return left.length ? left.reduce((m, x) => (x < m ? x : m)) : null;
  };
  let best: bigint | null = 0n, unlimited = false;
  for (const a of cands) { const c = cap(a); if (c === null) unlimited = true; else if (c > (best as bigint)) best = c; }
  const remaining = toPaisa(need.remaining_amount);
  const maxAmt = cands.length === 0 ? 0n : unlimited ? remaining : (best as bigint) < remaining ? (best as bigint) : remaining;
  return {
    account: eligible[0] ? accountPublic(eligible[0]) : null,
    max_amount: fromPaisa(maxAmt < 0n ? 0n : maxAmt),
    remaining_amount: need.remaining_amount, min_amount: need.min_investment,
    calc, amount_error: amountError,
    unavailable_message: !eligible[0] && !amountError ? NO_ACCOUNT_MSG : null,
    server_now: (await query('SELECT now() AS now'))[0].now,
  };
}

export function sniffImage(buf: Buffer): (typeof ALLOWED_PROOF_TYPES)[number] | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function withExpected(r: any) {
  if (r.expected_total_return != null) return { ...r, expected_is_final: true };
  const c = calcInvestment({ cost_price: r.snap_cost_price, sell_price: r.snap_sell_price, op_cost: r.snap_op_cost, investor_pct: r.snap_investor_pct, guarantor_pct: r.snap_guarantor_pct }, r.amount);
  return { ...r, expected_total_return: c.total_return, expected_investor_profit: c.investor_profit, expected_is_final: false };
}

/* ------------------------------------------------------------------ submit */
export async function submitInvestment(user: CurrentUser, form: FormData) {
  const needId = parseInt(String(form.get('funding_need_id') || ''), 10);
  if (!Number.isInteger(needId) || needId <= 0) throw bad('Choose a funding need');
  const amountPaisa = toPaisa(String(form.get('amount') || '').trim());
  if (amountPaisa <= 0n) throw bad('Enter an amount greater than zero');
  const expectedAccountId = parseInt(String(form.get('expected_account_id') || ''), 10) || 0;
  const key = String(form.get('idempotency_key') || '').trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(key)) throw bad('Missing submission key. Please reload the page and try again.');
  const file = form.get('proof');
  if (!(file instanceof File) || file.size === 0) throw bad('Attach a screenshot of your payment');
  if (file.size > MAX_PROOF_BYTES) throw bad(`Payment proof is too large (max ${MAX_PROOF_BYTES / 1024 / 1024} MB)`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (!mime) throw bad('Payment proof must be a JPG, PNG or WebP image');
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const amount = fromPaisa(amountPaisa);

  const existing = async () => (await query('SELECT * FROM investments WHERE investor_id = $1 AND idempotency_key = $2', [user.id, key]))[0];
  const prior = await existing();
  if (prior) return { investment: prior, duplicate: true };

  try {
    const inv = await tx(async t => {
      const [need] = await t.q('SELECT * FROM funding_needs WHERE id = $1 FOR UPDATE', [needId]);
      if (!need) throw notFound('Funding need not found');
      if (need.status === 'FULL') throw conflict('This funding need has just been fully funded.', 'NEED_FULL');
      if (need.status !== 'OPEN') throw conflict('This funding need is not open for investment.', 'NEED_NOT_OPEN');
      if (amountPaisa > toPaisa(need.remaining_amount)) throw conflict(`Only ${formatMoney(need.remaining_amount)} is still needed. Please lower your amount.`, 'OVER_REMAINING');

      const minInv = toPaisa(need.min_investment);
      if (amountPaisa < minInv && amountPaisa !== toPaisa(need.remaining_amount))
        throw conflict(`The minimum investment for this funding need is ${formatMoney(need.min_investment)}.`, 'BELOW_MIN');

      // Lock every candidate account in a fixed (id) order, then choose by priority. Serialises concurrent submitters per account.
      const cands = await t.q(ACCT_CAND_SQL.replace('ORDER BY pa.id', 'ORDER BY pa.id FOR UPDATE OF pa'), [needId]);
      const eligible = eligibleAccounts(cands, amountPaisa);
      // Never silently switch accounts: the investor pays the account they were shown.
      const acct = expectedAccountId ? eligible.find((a: any) => a.id === expectedAccountId) : eligible[0];
      if (!acct) {
        if (expectedAccountId && eligible[0]) throw conflict('The payment account shown to you is no longer available for this amount. The payment instructions have been refreshed — please review them before paying. If you have already paid, contact support with your proof.', 'ACCOUNT_CHANGED');
        throw conflict(NO_ACCOUNT_MSG, 'NO_ACCOUNT');
      }

      const dup = await t.q(`SELECT 1 FROM payment_proofs p JOIN investments i ON i.proof_id = p.id WHERE p.sha256 = $1 AND i.status <> 'REJECTED' LIMIT 1`, [sha]);
      if (dup.length) throw conflict('This payment screenshot has already been submitted. Please attach the proof for this payment.', 'DUPLICATE_PROOF');

      const [proof] = await t.q('INSERT INTO payment_proofs (uploader_id, mime_type, size_bytes, sha256, original_name, data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [user.id, mime, buf.length, sha, (file.name || '').slice(0, 120), buf]);
      const [rel] = await t.q('SELECT guarantor_id FROM guarantor_relationships WHERE investor_id = $1', [user.id]);
      const snapshot = {
        account_id: acct.id, account_name: acct.account_name, provider: acct.provider, bank_name: acct.bank_name,
        account_holder_name: acct.account_holder_name, account_number: acct.account_number, iban: acct.iban,
        instructions: acct.instructions, snapshotted_at: new Date().toISOString(),
      };
      const [row] = await t.q(
        `INSERT INTO investments (funding_need_id, investor_id, guarantor_id, amount, idempotency_key, payment_account_id, payment_snapshot, proof_id,
                                  snap_title, snap_product, snap_cost_price, snap_sell_price, snap_op_cost, snap_investor_pct, snap_guarantor_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [needId, user.id, rel?.guarantor_id ?? null, amount, key, acct.id, JSON.stringify(snapshot), proof.id,
         need.title, need.product, need.cost_price, need.sell_price, need.op_cost, need.investor_pct, need.guarantor_pct]);
      const newFunded = toPaisa(need.funded_amount) + amountPaisa;
      await t.q(`UPDATE funding_needs SET funded_amount = $2, status = CASE WHEN $2::numeric >= total_capital THEN 'FULL' ELSE status END, updated_at = now() WHERE id = $1`, [needId, fromPaisa(newFunded)]);
      await t.q('UPDATE payment_accounts SET allocated_amount = allocated_amount + $2, updated_at = now() WHERE id = $1', [acct.id, amount]);
      await audit(t, user.id, 'investment.submitted', 'investment', row.id, { funding_need_id: needId, amount, payment_account_id: acct.id, proof_id: proof.id });
      await notify(t, user.id, { type: 'INVESTMENT_SUBMITTED', title: 'Investment submitted', body: `${formatMoney(amount)} for ${need.title} is waiting for payment verification.`, link: `/investments/${row.id}` });
      await notifyAdmins(t, { type: 'VERIFICATION_PENDING', title: 'New investment to verify', body: `${user.username} — ${formatMoney(amount)} for ${need.title}`, link: `/admin/investments?status=PENDING_VERIFICATION` });
      return row;
    });
    return { investment: inv, duplicate: false };
  } catch (e: any) {
    if (e?.code === '23505' && String(e?.constraint || '').includes('ux_inv_idem')) { const p = await existing(); if (p) return { investment: p, duplicate: true }; }
    throw e;
  }
}

/* ------------------------------------------------------------ verify/reject */
export async function verifyInvestment(admin: CurrentUser, id: number) {
  return tx(async t => {
    const [i] = await t.q('SELECT * FROM investments WHERE id = $1 FOR UPDATE', [id]);
    if (!i) throw notFound('Investment not found');
    if (i.status !== 'PENDING_VERIFICATION') throw conflict(`This investment is already ${i.status.toLowerCase().replace(/_/g, ' ')}.`, 'ALREADY_PROCESSED');
    const c = calcInvestment({ cost_price: i.snap_cost_price, sell_price: i.snap_sell_price, op_cost: i.snap_op_cost, investor_pct: i.snap_investor_pct, guarantor_pct: i.snap_guarantor_pct }, i.amount);
    // No guarantor on the investment → credit the guarantor share to the admin-chosen fallback account (Settings).
    let gid: number | null = i.guarantor_id, isFallback = false;
    if (!gid) {
      const [st] = await t.q(`SELECT value #>> '{}' AS v FROM settings WHERE key = 'fallback_guarantor_id'`);
      const fid = st?.v ? parseInt(st.v, 10) : 0;
      if (fid && fid !== i.investor_id) {
        const [fu] = await t.q(`SELECT id FROM users WHERE id = $1 AND is_active AND 'GUARANTOR' = ANY(roles)`, [fid]);
        if (fu) { gid = fu.id; isFallback = true; }
      }
    }
    // verified_at and due_at come from the database clock, in one statement: due_at = verified_at + exactly 168 hours.
    const [row] = await t.q(
      `UPDATE investments SET status = 'VERIFIED', verified_at = now(), due_at = now() + interval '168 hours', reviewed_by = $2,
              expected_investor_profit = $3, expected_total_return = $4, guarantor_profit = $5, business_profit = $6,
              guarantor_id = $7, guarantor_is_fallback = $8, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, admin.id, c.investor_profit, c.total_return, gid ? c.guarantor_profit : '0.00', c.business_profit, gid, isFallback]);
    await t.q(`INSERT INTO payouts (investment_id, investor_id, amount, principal, profit, status, due_at) VALUES ($1,$2,$3,$4,$5,'DUE',$6)`,
      [id, i.investor_id, c.total_return, i.amount, c.investor_profit, row.due_at]);
    await audit(t, admin.id, 'investment.verified', 'investment', id, { amount: i.amount, verified_at: row.verified_at, due_at: row.due_at, expected_total_return: c.total_return, ...(i.investor_id === admin.id ? { self_review: true } : {}) });
    await notify(t, i.investor_id, { type: 'PAYMENT_VERIFIED', title: 'Payment verified', body: `Your ${formatMoney(i.amount)} investment is confirmed. Payout of ${formatMoney(c.total_return)} is due on ${formatDateTime(row.due_at)}.`, link: `/investments/${id}` });
    if (gid && toPaisa(c.guarantor_profit) > 0n)
      await notify(t, gid, { type: 'REFERRAL_VERIFIED', title: isFallback ? 'Fallback guarantor share credited' : 'A referred investment was verified', body: `Earnings of ${formatMoney(c.guarantor_profit)} added to this month.`, link: '/guarantor' });
    return row;
  });
}

export async function rejectInvestment(admin: CurrentUser, id: number, rawReason: unknown) {
  const reason = reasonSchema.parse(rawReason);
  return tx(async t => {
    const [i] = await t.q('SELECT * FROM investments WHERE id = $1 FOR UPDATE', [id]);
    if (!i) throw notFound('Investment not found');
    if (i.status !== 'PENDING_VERIFICATION') throw conflict(`This investment is already ${i.status.toLowerCase().replace(/_/g, ' ')}.`, 'ALREADY_PROCESSED');
    const [row] = await t.q(`UPDATE investments SET status = 'REJECTED', rejected_at = now(), rejection_reason = $2, reviewed_by = $3, updated_at = now() WHERE id = $1 RETURNING *`, [id, reason, admin.id]);
    // release the reserved capacity (lock order: investment → need → account)
    await t.q('SELECT 1 FROM funding_needs WHERE id = $1 FOR UPDATE', [i.funding_need_id]);
    await t.q(`UPDATE funding_needs SET funded_amount = funded_amount - $2, status = CASE WHEN status = 'FULL' THEN 'OPEN' ELSE status END, updated_at = now() WHERE id = $1`, [i.funding_need_id, i.amount]);
    if (i.payment_account_id) {
      await t.q('SELECT 1 FROM payment_accounts WHERE id = $1 FOR UPDATE', [i.payment_account_id]);
      await t.q('UPDATE payment_accounts SET allocated_amount = GREATEST(0, allocated_amount - $2), updated_at = now() WHERE id = $1', [i.payment_account_id, i.amount]);
    }
    await audit(t, admin.id, 'investment.rejected', 'investment', id, { amount: i.amount, reason, ...(i.investor_id === admin.id ? { self_review: true } : {}) });
    await notify(t, i.investor_id, { type: 'PAYMENT_REJECTED', title: 'Payment could not be verified', body: `Reason: ${reason}`, link: `/investments/${id}` });
    return row;
  });
}

/* --------------------------------------------------------------------- read */
const INV_LIST_SELECT = `
  i.id, i.funding_need_id, i.investor_id, i.amount, i.status, ${EFF} AS display_status, i.created_at, i.verified_at, i.due_at,
  i.snap_title, i.snap_product, i.snap_cost_price, i.snap_sell_price, i.snap_op_cost, i.snap_investor_pct, i.snap_guarantor_pct,
  i.expected_total_return, i.expected_investor_profit, i.guarantor_profit, i.rejection_reason,
  i.guarantor_is_fallback, i.payment_account_id, i.payment_snapshot ->> 'account_name' AS account_name, i.proof_id,
  u.username AS investor_username, g.username AS guarantor_username,
  p.id AS payout_id, p.status AS payout_status, p.transaction_id, p.paid_at`;
const INV_FROM = `FROM investments i JOIN users u ON u.id = i.investor_id LEFT JOIN users g ON g.id = i.guarantor_id LEFT JOIN payouts p ON p.investment_id = i.id`;

export async function listInvestments(user: CurrentUser, url: URL, opts: { forceNeedId?: number; unpaged?: boolean } = {}) {
  await materializeDue();
  const { page, size, offset } = pageParams(url);
  const w = new Where();
  const admin = isAdmin(user) && url.searchParams.get('scope') !== 'mine';
  if (!admin) w.add('i.investor_id = ?', user.id);
  if (opts.forceNeedId) w.add('i.funding_need_id = ?', opts.forceNeedId);
  const sp = url.searchParams;
  const q = sp.get('q')?.trim();
  if (q && admin) {
    const like = likeTerm(q);
    w.add(`(u.username ILIKE ? OR g.username ILIKE ? OR i.snap_title ILIKE ? OR i.id::text = ? OR p.transaction_id ILIKE ? OR i.payment_snapshot ->> 'account_name' ILIKE ?)`, like, like, like, q.replace(/^#/, ''), like, like);
  } else if (q) w.add('(i.snap_title ILIKE ? OR i.id::text = ?)', likeTerm(q), q.replace(/^#/, ''));
  const st = sp.get('status'); if (st) w.add(`${EFF} = ?`, st);
  const acct = sp.get('account_id'); if (acct && admin) w.add('i.payment_account_id = ?', parseInt(acct, 10) || 0);
  const need = sp.get('funding_need_id'); if (need) w.add('i.funding_need_id = ?', parseInt(need, 10) || 0);
  const from = sp.get('from'); if (from) w.add(`i.created_at >= (?::date::timestamp AT TIME ZONE '${APP_TIMEZONE}')`, from);
  const to = sp.get('to'); if (to) w.add(`i.created_at < ((?::date + 1)::timestamp AT TIME ZONE '${APP_TIMEZONE}')`, to);
  const order = sortParam(url, { created: 'i.created_at', amount: 'i.amount', due: 'i.due_at', status: `${EFF}`, verified: 'i.verified_at' }, '-created');
  const [{ count, total_amount }] = await query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(i.amount),0) AS total_amount ${INV_FROM} ${w.sql}`, w.params);
  const limit = opts.unpaged ? 5000 : size;
  const rows = await query(`SELECT ${INV_LIST_SELECT} ${INV_FROM} ${w.sql} ORDER BY ${order}, i.id DESC LIMIT ${limit} OFFSET ${opts.unpaged ? 0 : offset}`, w.params);
  const safe = rows.map((r: any) => {
    const x = withExpected(r);
    if (!admin) { delete x.guarantor_profit; delete x.guarantor_username; delete x.snap_guarantor_pct; delete x.guarantor_is_fallback; }
    return x;
  });
  return { rows: safe, total: count, total_amount, page, size };
}

export async function getInvestment(user: CurrentUser, id: number) {
  await materializeDue();
  const admin = isAdmin(user);
  const [r] = await query(
    `SELECT ${INV_LIST_SELECT}, i.payment_snapshot, i.reviewed_by, i.rejected_at, i.business_profit,
            p.amount AS payout_amount, p.replacement_transaction_id AS payout_replacement_txn, p.processed_by,
            fn.status AS need_status, ru.username AS reviewed_by_username,
            u.phone AS investor_phone, u.full_name AS investor_full_name, u.payout_method, u.payout_account,
            now() AS server_now
       ${INV_FROM} JOIN funding_needs fn ON fn.id = i.funding_need_id LEFT JOIN users ru ON ru.id = i.reviewed_by
      WHERE i.id = $1 ${admin ? '' : 'AND i.investor_id = $2'}`, admin ? [id] : [id, user.id]);
  if (!r) throw notFound('Investment not found');
  const out: any = withExpected(r);
  if (!admin) {
    for (const k of ['guarantor_is_fallback', 'guarantor_profit', 'guarantor_username', 'snap_guarantor_pct', 'business_profit', 'reviewed_by', 'reviewed_by_username', 'processed_by', 'investor_phone', 'payout_method', 'payout_account', 'investor_full_name']) delete out[k];
  } else {
    out.claims = await query(`SELECT c.id, c.status, c.reason, c.created_at FROM payment_claims c JOIN payouts p ON p.id = c.payout_id WHERE p.investment_id = $1 ORDER BY c.created_at DESC`, [id]);
  }
  return out;
}

export async function getProofFile(user: CurrentUser, proofId: number) {
  const admin = isAdmin(user);
  const rows = await query(
    `SELECT p.mime_type, p.data FROM payment_proofs p WHERE p.id = $1 AND (
       $3::boolean OR EXISTS (SELECT 1 FROM investments i WHERE i.proof_id = p.id AND i.investor_id = $2))`, [proofId, user.id, admin]);
  if (!rows[0]) throw notFound('Proof not found');
  return rows[0] as { mime_type: string; data: Buffer };
}
