import { z } from 'zod';
import { handler, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/session';

// An ADMIN can switch the INVESTOR side on or off for their OWN account — nothing else, for nobody else.
// (No role other than INVESTOR can be changed here, and non-admins get 403, so this cannot be used to gain privileges.)
export const POST = handler(async req => {
  const u = await requireUser('ADMIN');
  const { investor } = z.object({ investor: z.boolean() }).parse(await readJson(req));
  const [row] = await query(
    `UPDATE users SET roles = CASE WHEN $2 THEN (CASE WHEN 'INVESTOR' = ANY(roles) THEN roles ELSE array_append(roles, 'INVESTOR') END) ELSE array_remove(roles, 'INVESTOR') END,
            updated_at = now() WHERE id = $1 RETURNING roles`, [u.id, investor]);
  await audit(null, u.id, 'user.role_changed', 'user', u.id, { investor_side: investor });
  return { roles: row.roles };
});
