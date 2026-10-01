import { handler, readJson, idParam, notFound } from '@/lib/api';
import { query } from '@/lib/db';
import { requireUser, isAdmin } from '@/lib/session';
import { getNeedAdmin, updateNeed, investorNeedView } from '@/lib/services/needs';

export const GET = handler(async (req, { params }) => {
  const u = await requireUser();
  const id = idParam(params.id);
  if (isAdmin(u) && new URL(req.url).searchParams.get('view') !== 'investor') return getNeedAdmin(id);
  const [n] = await query(`SELECT fn.*, (SELECT COUNT(*) FROM funding_need_accounts f JOIN payment_accounts p ON p.id = f.payment_account_id WHERE f.funding_need_id = fn.id AND p.status='ACTIVE')::int AS active_accounts
                            FROM funding_needs fn WHERE fn.id = $1 AND fn.status IN ('OPEN','FULL')`, [id]);
  if (!n) throw notFound('Funding need not found');
  const v: any = investorNeedView(n);
  for (const k of ['created_by', 'cancel_reason', 'business_pct', 'legacy_week_id']) delete v[k];
  return { need: v };
});
export const PATCH = handler(async (req, { params }) => updateNeed(await requireUser('ADMIN'), idParam(params.id), await readJson(req)));
