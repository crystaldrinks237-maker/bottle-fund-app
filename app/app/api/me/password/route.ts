import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handler, readJson, bad } from '@/lib/api';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/session';
import { passwordSchema } from '@/lib/validators';

const schema = z.object({ current_password: z.string().optional(), new_password: passwordSchema });
export const POST = handler(async req => {
  const u = await requireUser();
  const v = schema.parse(await readJson(req));
  const [row] = await query('SELECT password_hash, has_password FROM users WHERE id = $1', [u.id]);
  // Google-created accounts have no password yet, so they may set one without a "current" one.
  if (row.has_password && !(await bcrypt.compare(v.current_password || '', row.password_hash))) throw bad('Your current password is incorrect');
  await query('UPDATE users SET password_hash = $2, has_password = true, updated_at = now() WHERE id = $1', [u.id, await bcrypt.hash(v.new_password, 12)]);
  await audit(null, u.id, 'user.password_changed', 'user', u.id);
  return { ok: true };
});
