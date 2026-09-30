import type { Tx } from './db';
import { pool } from './db';

export async function audit(t: Tx | null, actorId: number | null, action: string, entityType: string, entityId: string | number | null, metadata: Record<string, any> = {}) {
  await (t || pool).q(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)',
    [actorId, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(metadata)]);
}
