'use client';
import Link from 'next/link';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { ReportNotReceived } from '@/components/domain/actions';
import { formatDateTime } from '@/lib/format';

export default function Payouts() {
  return (
    <>
      <PageHeader title="Payouts" subtitle="Money owed to you and money already sent, with transaction IDs." />
      <ListView endpoint="/api/payouts" defaultSort="due" search={undefined}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['SCHEDULED', 'DUE', 'PROCESSING', 'PAID', 'CLAIMED_NOT_RECEIVED', 'RESOLVED'].map(s => ({ value: s, label: s === 'DUE' ? 'Due now' : s.toLowerCase().replace(/_/g, ' ') })) }]}
        empty={{ title: 'No payouts yet', text: 'A payout appears here once an investment is verified.' }}
        columns={[
          { key: 'inv', header: 'Investment', render: r => <Link href={`/investments/${r.investment_id}`}>#{r.investment_id} · {r.snap_title}</Link> },
          { key: 'amount', header: 'Payout', sort: 'amount', align: 'right', render: r => <MoneyDisplay value={r.amount} strong /> },
          { key: 'due', header: 'Due', sort: 'due', render: r => formatDateTime(r.due_at) },
          { key: 'st', header: 'Status', render: r => <StatusBadge status={r.display_status} /> },
          { key: 'txn', header: 'Transaction ID', render: r => (r.transaction_id ? <span className="mono">{r.transaction_id}</span> : '—') },
          { key: 'paid', header: 'Paid on', sort: 'paid', render: r => formatDateTime(r.paid_at) },
          { key: 'act', header: '', actions: true, render: (r, { reload }) => (r.status === 'PAID' ? <ReportNotReceived target={{ payout_id: r.id }} onDone={reload} /> : null) },
        ]} />
    </>
  );
}
