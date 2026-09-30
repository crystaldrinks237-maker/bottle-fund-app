'use client';
import Link from 'next/link';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { PayoutActions } from '@/components/domain/actions';
import { formatDateTime } from '@/lib/format';

export default function AdminPayouts() {
  return (
    <>
      <PageHeader title="Investor Payouts" subtitle="Payouts become payable exactly 7 days (168 hours) after verification." />
      <ListView endpoint="/api/payouts" exportPath="/api/payouts" search="Search investor, transaction ID, investment ID" defaultSort="due"
        summary={d => <>{d.total.toLocaleString()} payout(s) totalling <MoneyDisplay value={d.total_amount} /></>}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'DUE', label: 'Due now' }, { value: 'PROCESSING', label: 'Processing' }, { value: 'SCHEDULED', label: 'Scheduled (countdown)' }, { value: 'PAID', label: 'Paid' }, { value: 'CLAIMED_NOT_RECEIVED', label: 'Reported not received' }, { value: 'RESOLVED', label: 'Resolved' }] }, { key: 'from', label: 'Due from', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        empty={{ title: 'No payouts yet', text: 'Payouts are created when investments are verified.' }}
        columns={[
          { key: 'i', header: 'Investor', render: r => <><b>{r.investor_username}</b><div className="sub"><Link href={`/admin/investments/${r.investment_id}`}>Investment #{r.investment_id}</Link> · {r.snap_title}</div></> },
          { key: 'amt', header: 'Payout', sort: 'amount', align: 'right', render: r => <><MoneyDisplay value={r.amount} strong /><div className="sub">profit <MoneyDisplay value={r.profit} /></div></> },
          { key: 'to', header: 'Send to', render: r => (r.payout_account ? `${r.payout_method || ''} ${r.payout_account}` : <span className="muted">Not provided</span>) },
          { key: 'due', header: 'Due', sort: 'due', render: r => <>{formatDateTime(r.due_at)}{r.overdue && <div className="sub" style={{ color: 'var(--red)', fontWeight: 700 }}>Overdue</div>}</> },
          { key: 's', header: 'Status', render: r => <StatusBadge status={r.display_status} /> },
          { key: 't', header: 'Transaction ID', render: r => (r.transaction_id ? <span className="mono">{r.transaction_id}</span> : '—') },
          { key: 'a', header: '', actions: true, render: (r, { reload }) => <PayoutActions p={r} onDone={reload} /> },
        ]} />
    </>
  );
}
