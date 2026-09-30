import { query, tx } from '../db';
import { audit } from '../audit';
import { APP_TIMEZONE } from '../config';
import { bad, Where, likeTerm, pageParams } from '../api';
import { ACCOUNT_SELECT } from './accounts';
import { materializeDue } from './investments';
import { currentMonthSql } from './guarantors';
import type { CurrentUser } from '../session';

const TZ = APP_TIMEZONE.replace(/'/g, '');

/** One round-trip-friendly aggregate for the admin overview (no per-record fan-out). */
export async function overview() {
  await materializeDue();
  const [cards] = await query(`
    SELECT
      (SELECT COUNT(*) FROM funding_needs WHERE status = 'OPEN')::int AS active_needs,
      (SELECT COUNT(*) FROM funding_needs WHERE status = 'FULL')::int AS full_needs,
      COALESCE((SELECT SUM(total_capital) FROM funding_needs WHERE status IN ('OPEN','FULL')), 0) AS capital_required,
      COALESCE((SELECT SUM(funded_amount) FROM funding_needs WHERE status IN ('OPEN','FULL')), 0) AS capital_funded,
      (SELECT COUNT(*) FROM investments WHERE status = 'PENDING_VERIFICATION')::int AS pending_count,
      COALESCE((SELECT SUM(amount) FROM investments WHERE status = 'PENDING_VERIFICATION'), 0) AS pending_amount,
      (SELECT COUNT(*) FROM payouts WHERE status IN ('DUE','PROCESSING') AND due_at <= now())::int AS payouts_due_count,
      COALESCE((SELECT SUM(amount) FROM payouts WHERE status IN ('DUE','PROCESSING') AND due_at <= now()), 0) AS payouts_due_amount,
      (SELECT COUNT(*) FROM payouts WHERE status IN ('DUE','PROCESSING') AND due_at <= now() - interval '24 hours')::int AS overdue_count,
      COALESCE((SELECT SUM(amount) FROM payouts WHERE status IN ('DUE','PROCESSING') AND due_at <= now() - interval '24 hours'), 0) AS overdue_amount,
      (SELECT COUNT(*) FROM guarantor_payments WHERE status IN ('PENDING','PROCESSING'))::int AS gp_pending_count,
      COALESCE((SELECT SUM(amount) FROM guarantor_payments WHERE status IN ('PENDING','PROCESSING')), 0) AS gp_pending_amount,
      (SELECT COUNT(DISTINCT i.guarantor_id) FROM investments i WHERE i.guarantor_id IS NOT NULL AND i.status IN ('VERIFIED','PAYOUT_DUE','COMPLETED') AND COALESCE(i.guarantor_profit,0) > 0
         AND NOT EXISTS (SELECT 1 FROM guarantor_payment_items x WHERE x.investment_id = i.id))::int AS gp_unsettled_guarantors,
      (SELECT COUNT(*) FROM payment_claims WHERE status IN ('OPEN','UNDER_REVIEW'))::int AS open_claims`);
  const [nearLimit, needs, cashflow, recent] = await Promise.all([
    query(`SELECT * FROM (SELECT ${ACCOUNT_SELECT} FROM payment_accounts pa WHERE pa.status = 'ACTIVE') x WHERE availability IN ('NEAR_LIMIT','LIMIT_REACHED','DAILY_LIMIT_REACHED') ORDER BY allocated_amount DESC LIMIT 6`),
    query(`SELECT id, title, product, total_capital, funded_amount, remaining_amount, status FROM funding_needs WHERE status IN ('OPEN','FULL') ORDER BY opened_at DESC NULLS LAST LIMIT 6`),
    // obligations by local calendar day: everything already due collapses into "now", the rest by due day, next 14 days
    query(`SELECT CASE WHEN due_at <= now() THEN NULL ELSE (due_at AT TIME ZONE '${TZ}')::date END AS day, COUNT(*)::int AS count, SUM(amount) AS amount
             FROM payouts WHERE status IN ('DUE','PROCESSING') AND due_at <= now() + interval '14 days' GROUP BY 1 ORDER BY 1 NULLS FIRST`),
    query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.username AS actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 8`),
  ]);
  return { cards, near_limit: nearLimit, needs, cashflow, recent };
}

export async function listAuditLogs(url: URL, unpaged = false) {
  const { page, size, offset } = pageParams(url, 30);
  const w = new Where();
  const sp = url.searchParams;
  const q = sp.get('q')?.trim();
  if (q) { const l = likeTerm(q); w.add('(a.action ILIKE ? OR u.username ILIKE ? OR a.entity_id = ? OR a.metadata::text ILIKE ?)', l, l, q, l); }
  const action = sp.get('action'); if (action) w.add('a.action ILIKE ?', action.replace(/[%_]/g, '') + '%');
  const et = sp.get('entity_type'); if (et) w.add('a.entity_type = ?', et);
  const actor = sp.get('actor'); if (actor) w.add('u.username ILIKE ?', likeTerm(actor));
  const from = sp.get('from'); if (from) w.add(`a.created_at >= (?::date::timestamp AT TIME ZONE '${TZ}')`, from);
  const to = sp.get('to'); if (to) w.add(`a.created_at < ((?::date + 1)::timestamp AT TIME ZONE '${TZ}')`, to);
  const [{ count }] = await query(`SELECT COUNT(*)::int AS count FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${w.sql}`, w.params);
  const rows = await query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at, u.username AS actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
                            ${w.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ${unpaged ? 5000 : size} OFFSET ${unpaged ? 0 : offset}`, w.params);
  return { rows, total: count, page, size };
}

export async function getSettings() {
  const rows = await query('SELECT key, value FROM settings');
  const s: Record<string, any> = {};
  for (const r of rows) s[r.key] = r.value;
  return { near_limit_pct: Number(s.near_limit_pct ?? 90), timezone: APP_TIMEZONE, payout_cycle_hours: 168, overdue_after_hours: 24 };
}
export async function updateSettings(admin: CurrentUser, body: any) {
  const pct = Number(body?.near_limit_pct);
  if (!Number.isInteger(pct) || pct < 50 || pct > 100) throw bad('Near-limit threshold must be a whole number between 50 and 100');
  return tx(async t => {
    const [cur] = await t.q(`SELECT value FROM settings WHERE key = 'near_limit_pct'`);
    await t.q(`INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('near_limit_pct', $1::jsonb, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [JSON.stringify(pct), admin.id]);
    await audit(t, admin.id, 'settings.changed', 'settings', 'near_limit_pct', { from: cur?.value ?? null, to: pct });
    return getSettings();
  });
}

export async function investorDashboard(userId: number) {
  await materializeDue();
  const [cards] = await query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE status IN ('VERIFIED','PAYOUT_DUE','COMPLETED')), 0) AS total_invested,
       COUNT(*) FILTER (WHERE status IN ('PENDING_VERIFICATION','VERIFIED','PAYOUT_DUE'))::int AS active_investments,
       COALESCE(SUM(amount) FILTER (WHERE status = 'VERIFIED' AND due_at > now()), 0) AS in_cycle,
       COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING_VERIFICATION'), 0) AS pending_amount,
       COALESCE(SUM(expected_total_return) FILTER (WHERE status = 'PAYOUT_DUE'), 0) AS due_now,
       COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count,
       COALESCE(SUM(expected_total_return) FILTER (WHERE status = 'COMPLETED'), 0) AS completed_amount
     FROM investments WHERE investor_id = $1`, [userId]);
  const [next] = await query(`SELECT id, expected_total_return AS amount, due_at, snap_title FROM investments WHERE investor_id = $1 AND status = 'VERIFIED' AND due_at > now() ORDER BY due_at LIMIT 1`, [userId]);
  const [{ now }] = await query('SELECT now() AS now');
  return { cards, next_payout: next || null, server_now: now };
}
