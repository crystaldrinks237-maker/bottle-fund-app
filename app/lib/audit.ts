import type { Tx } from './db';
import { pool } from './db';
import { getCurrentUser, hasViewAsCookie } from './session';

export async function audit(t: Tx | null, actorId: number | null, action: string, entityType: string, entityId: string | number | null, metadata: Record<string, any> = {}) {
  // If an admin is viewing as this user, record who really did it.
  try {
    if (hasViewAsCookie()) {
    const cu = await getCurrentUser();
    if (cu?.impersonator && cu.id === actorId) metadata = { ...metadata, impersonated_by: cu.impersonator.id };
    }
  } catch { /* outside a request (scripts) */ }
  await (t || pool).q(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)',
    [actorId, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(metadata)]);
}
