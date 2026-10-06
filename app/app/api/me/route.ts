import { z } from 'zod';
import { handler, readJson, bad } from '@/lib/api';
import { query, tx } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/session';
import { googleEnabled } from '@/lib/auth';
import { phoneSchema } from '@/lib/validators';

export const GET = handler(async () => {
  const u = await requireUser();
  const [row] = await query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.roles, u.payout_method, u.payout_account, u.created_at, u.email, u.referral_code, (u.google_sub IS NOT NULL) AS google_linked, u.has_password, g.id AS guarantor_id, g.username AS guarantor_username
       FROM users u LEFT JOIN guarantor_relationships r ON r.investor_id = u.id LEFT JOIN users g ON g.id = r.guarantor_id WHERE u.id = $1`, [u.id]);
  return { ...row, google_enabled: googleEnabled };
});

const schema = z.object({
  full_name: z.string().trim().max(80).optional().nullable(), phone: phoneSchema,
  payout_method: z.string().trim().max(40).optional().nullable(), payout_account: z.string().trim().max(80).optional().nullable(),
});
export const PATCH = handler(async req => {
  const u = await requireUser();
  const v = schema.parse(await readJson(req));
  await tx(async t => {
    await t.q(`UPDATE users SET full_name = $2, phone = $3, payout_method = $4, payout_account = $5, updated_at = now() WHERE id = $1`,
      [u.id, v.full_name || null, v.phone || null, v.payout_method || null, v.payout_account || null]);
  });
  return { ok: true };
});
