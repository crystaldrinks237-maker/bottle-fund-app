import { z } from 'zod';
import { handler, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const GET = handler(async req => {
  const u = await requireUser();
  const all = new URL(req.url).searchParams.get('all') === '1';
  const rows = await query(`SELECT id, type, title, body, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${all ? 100 : 12}`, [u.id]);
  const [{ n }] = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [u.id]);
  return { rows, unread: n };
});
export const POST = handler(async req => {
  const u = await requireUser();
  const b = z.object({ id: z.number().int().positive().optional() }).parse(await readJson(req));
  await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL ${b.id ? 'AND id = $2' : ''}`, b.id ? [u.id, b.id] : [u.id]);
  return { ok: true };
});
