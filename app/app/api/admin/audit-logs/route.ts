import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { listAuditLogs } from '@/lib/services/admin';
import { csvResponse, toCsv } from '@/lib/csv';

export const GET = handler(async req => {
  await requireUser('ADMIN');
  const url = new URL(req.url);
  const csv = url.searchParams.get('format') === 'csv';
  const out = await listAuditLogs(url, csv);
  if (csv) return csvResponse('activity-log', toCsv(out.rows, [{ key: 'created_at', label: 'Time (UTC)' }, { key: 'actor', label: 'Actor' }, { key: 'action', label: 'Action' }, { key: 'entity_type', label: 'Entity' }, { key: 'entity_id', label: 'Entity ID' }, { key: 'metadata', label: 'Details' }]));
  return out;
});
