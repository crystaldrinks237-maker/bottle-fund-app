'use client';
import { ListView } from '@/components/ui/ListView';
import { PageHeader } from '@/components/ui/kit';
import { formatDateTime } from '@/lib/format';

const GROUPS = ['funding_need', 'payment_account', 'investment', 'payout', 'guarantor', 'guarantor_payment', 'payment_claim', 'settings', 'user'];
export default function Activity() {
  return (
    <>
      <PageHeader title="Activity Log" subtitle="Every important administrative and financial action, newest first." />
      <ListView endpoint="/api/admin/audit-logs" exportPath="/api/admin/audit-logs" search="Search action, actor, entity ID or details" rowKey="id"
        filters={[{ key: 'action', label: 'Area', type: 'select', options: GROUPS.map(g => ({ value: g + '.', label: g.replace('_', ' ') })) }, { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        empty={{ title: 'No activity yet' }}
        columns={[
          { key: 't', header: 'Time', render: r => <span className="nowrap">{formatDateTime(r.created_at)}</span> },
          { key: 'a', header: 'Actor', render: r => r.actor || <span className="muted">system</span> },
          { key: 'ac', header: 'Action', render: r => <span className="mono">{r.action}</span> },
          { key: 'e', header: 'Entity', render: r => `${r.entity_type.replace('_', ' ')} ${r.entity_id ?? ''}` },
          { key: 'm', header: 'Details', render: r => (Object.keys(r.metadata || {}).length ? <details><summary className="small" style={{ cursor: 'pointer' }}>View</summary><pre className="mono small" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0', maxWidth: 420 }}>{JSON.stringify(r.metadata, null, 2)}</pre></details> : '—') },
        ]} />
    </>
  );
}
