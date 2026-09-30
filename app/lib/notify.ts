// Internal notification system. Channels (SMS / WhatsApp / email) can later be added inside `notify()`
// without touching any call site.
import type { Tx } from './db';
import { pool } from './db';

export interface Notice { type: string; title: string; body?: string; link?: string }

export async function notify(t: Tx | null, userId: number, n: Notice) {
  await (t || pool).q('INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5)',
    [userId, n.type, n.title, n.body ?? null, n.link ?? null]);
}
export async function notifyAdmins(t: Tx | null, n: Notice) {
  await (t || pool).q(
    `INSERT INTO notifications (user_id, type, title, body, link)
     SELECT id, $1, $2, $3, $4 FROM users WHERE 'ADMIN' = ANY(roles) AND is_active`,
    [n.type, n.title, n.body ?? null, n.link ?? null]);
}
