import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handler, readJson, ApiError, conflict, bad } from '@/lib/api';
import { tx } from '@/lib/db';
import { audit } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notify';
import { passwordSchema, phoneSchema, usernameSchema } from '@/lib/validators';

// The schema deliberately has NO role field: anything a client sends beyond these keys is discarded, and
// every self-registered account is an INVESTOR. Admins and guarantors are created by an admin only.
const schema = z.object({
  username: usernameSchema, password: passwordSchema,
  full_name: z.string().trim().max(80).optional().nullable(),
  phone: phoneSchema,
  guarantor_username: z.string().trim().toLowerCase().max(32).optional().nullable(),
});

export const POST = handler(async req => {
  if (process.env.ALLOW_SIGNUP === 'false') throw new ApiError(403, 'Sign-ups are currently closed. Contact Crystal Drinks to get an account.');
  const v = schema.parse(await readJson(req));
  const hash = await bcrypt.hash(v.password, 12);
  await tx(async t => {
    if ((await t.q('SELECT 1 FROM users WHERE lower(username) = $1', [v.username])).length) throw conflict('That username is taken');
    let guarantorId: number | null = null;
    if (v.guarantor_username) {
      const [g] = await t.q(`SELECT id FROM users WHERE lower(username) = $1 AND 'GUARANTOR' = ANY(roles) AND is_active`, [v.guarantor_username]);
      if (!g) throw bad('We could not find a guarantor with that username. Leave it empty if you were not referred.');
      guarantorId = g.id;
    }
    const [u] = await t.q(`INSERT INTO users (username, password_hash, roles, full_name, phone) VALUES ($1,$2,ARRAY['INVESTOR'],$3,$4) RETURNING id`, [v.username, hash, v.full_name || null, v.phone || null]);
    if (guarantorId) await t.q('INSERT INTO guarantor_relationships (investor_id, guarantor_id, created_by) VALUES ($1,$2,$1)', [u.id, guarantorId]);
    await audit(t, u.id, 'user.signed_up', 'user', u.id, { guarantor_id: guarantorId });
  });
  return { ok: true };
});
