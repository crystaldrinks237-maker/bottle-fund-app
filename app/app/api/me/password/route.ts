import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { handler, readJson, bad } from '@/lib/api';
import { query } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireUser, forbidWhileViewingAs } from '@/lib/session';
import { passwordSchema } from '@/lib/validators';

const schema = z.object({ current_password: z.string().min(1), new_password: passwordSchema });
export const POST = handler(async req => {
  const u = await requireUser();
  forbidWhileViewingAs(u);
  const v = schema.parse(await readJson(req));
  const [row] = await query('SELECT password_hash FROM users WHERE id = $1', [u.id]);
  if (!(await bcrypt.compare(v.current_password, row.password_hash))) throw bad('Your current password is incorrect');
  await query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [u.id, await bcrypt.hash(v.new_password, 12)]);
  await audit(null, u.id, 'user.password_changed', 'user', u.id);
  return { ok: true };
});
