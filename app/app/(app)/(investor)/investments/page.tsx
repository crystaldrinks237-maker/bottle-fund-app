'use client';
import Link from 'next/link';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { formatDateTime } from '@/lib/format';

const STATUSES = ['PENDING_VERIFICATION', 'VERIFIED', 'PAYOUT_DUE', 'COMPLETED', 'REJECTED'];
export default function MyInvestments() {
  return (
    <>
      <PageHeader title="My Investments" subtitle="Every investment you’ve submitted, with its exact payout time." actions={<Link href="/funding-needs" className="btn btn-primary">New investment</Link>} />
      <ListView endpoint="/api/investments" search="Search by funding need or investment ID" defaultSort="-created"
        filters={[{ key: 'status', label: 'Status', type: 'select', options: STATUSES.map(s => ({ value: s, label: s === 'VERIFIED' ? 'Verified (countdown)' : s.toLowerCase().replace(/_/g, ' ') })) }, { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        empty={{ title: 'No investments yet', text: 'Your submitted investments will appear here.' }}
        columns={[
          { key: 'id', header: 'Investment', sort: 'created', render: r => <Link href={`/investments/${r.id}`}><b>#{r.id}</b> · {r.snap_title}</Link> },
          { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: r => <MoneyDisplay value={r.amount} /> },
          { key: 'ret', header: 'Expected return', align: 'right', render: r => <MoneyDisplay value={r.expected_total_return} /> },
          { key: 'status', header: 'Status', sort: 'status', render: r => <StatusBadge status={r.display_status} /> },
          { key: 'due', header: 'Payout due', sort: 'due', render: r => (r.due_at ? formatDateTime(r.due_at) : '—') },
          { key: 'go', header: '', actions: true, render: r => <Link className="btn btn-sm" href={`/investments/${r.id}`}>Details</Link> },
        ]} />
    </>
  );
}
