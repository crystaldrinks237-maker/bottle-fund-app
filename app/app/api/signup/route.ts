import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { handler, readJson, ApiError, conflict } from '@/lib/api';
import { assignGuarantorForNewUser, REF_COOKIE } from '@/lib/referrals';
import { tx } from '@/lib/db';
import { audit } from '@/lib/audit';
import { passwordSchema, phoneSchema, usernameSchema } from '@/lib/validators';

// The schema deliberately has NO role field: anything a client sends beyond these keys is discarded, and
// every self-registered account is an INVESTOR. Admins and guarantors are created by an admin only.
const schema = z.object({
  username: usernameSchema, password: passwordSchema,
  full_name: z.string().trim().max(80).optional().nullable(),
  phone: phoneSchema,
  ref: z.string().trim().max(24).optional().nullable(),
});

export const POST = handler(async req => {
  if (process.env.ALLOW_SIGNUP === 'false') throw new ApiError(403, 'Sign-ups are currently closed. Contact Crystal Drinks to get an account.');
  const v = schema.parse(await readJson(req));
  const hash = await bcrypt.hash(v.password, 12);
  const remembered = cookies().get(REF_COOKIE)?.value || null;
  let guarantorId: number | null = null;
  await tx(async t => {
    if ((await t.q('SELECT 1 FROM users WHERE lower(username) = $1', [v.username])).length) throw conflict('That username is taken');
    const [u] = await t.q(`INSERT INTO users (username, password_hash, roles, full_name, phone) VALUES ($1,$2,ARRAY['INVESTOR','GUARANTOR'],$3,$4) RETURNING id, username`, [v.username, hash, v.full_name || null, v.phone || null]);
    guarantorId = await assignGuarantorForNewUser(t, u, v.ref || null, remembered);
    await audit(t, u.id, 'user.signed_up', 'user', u.id, { guarantor_id: guarantorId });
  });
  return { ok: true };
});
