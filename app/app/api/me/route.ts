import { z } from 'zod';
import { handler, readJson, bad } from '@/lib/api';
import { query, tx } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/session';
import { phoneSchema } from '@/lib/validators';

export const GET = handler(async () => {
  const u = await requireUser();
  const [row] = await query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.roles, u.payout_method, u.payout_account, u.created_at, g.id AS guarantor_id, g.username AS guarantor_username
       FROM users u LEFT JOIN guarantor_relationships r ON r.investor_id = u.id LEFT JOIN users g ON g.id = r.guarantor_id WHERE u.id = $1`, [u.id]);
  return row;
});

const schema = z.object({
  full_name: z.string().trim().max(80).optional().nullable(), phone: phoneSchema,
  payout_method: z.string().trim().max(40).optional().nullable(), payout_account: z.string().trim().max(80).optional().nullable(),
  guarantor_username: z.string().trim().toLowerCase().max(32).optional().nullable(),
});
export const PATCH = handler(async req => {
  const u = await requireUser();
  const v = schema.parse(await readJson(req));
  await tx(async t => {
    await t.q(`UPDATE users SET full_name = $2, phone = $3, payout_method = $4, payout_account = $5, updated_at = now() WHERE id = $1`,
      [u.id, v.full_name || null, v.phone || null, v.payout_method || null, v.payout_account || null]);
    // A guarantor can be self-declared exactly once (only if none is set). Changes afterwards are admin-only.
    if (v.guarantor_username) {
      if ((await t.q('SELECT 1 FROM guarantor_relationships WHERE investor_id = $1', [u.id])).length) throw bad('Your guarantor is already set. Contact an administrator to change it.');
      const [g] = await t.q(`SELECT id FROM users WHERE lower(username) = $1 AND 'GUARANTOR' = ANY(roles) AND is_active AND id <> $2`, [v.guarantor_username, u.id]);
      if (!g) throw bad('We could not find a guarantor with that username.');
      await t.q('INSERT INTO guarantor_relationships (investor_id, guarantor_id, created_by) VALUES ($1,$2,$1)', [u.id, g.id]);
      await audit(t, u.id, 'guarantor.self_assigned', 'user', u.id, { guarantor_id: g.id });
    }
  });
  return { ok: true };
});
