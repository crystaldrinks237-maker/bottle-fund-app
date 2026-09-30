'use client';
import Link from 'next/link';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { InvestmentActions, ProofButton } from '@/components/domain/actions';
import { formatDateTime, titleCase } from '@/lib/format';

export default function AdminInvestments() {
  return (
    <>
      <PageHeader title="Investments" subtitle="Verification queue and every investment. Filter by status to see what needs a decision." />
      <ListView endpoint="/api/investments" exportPath="/api/investments" search="Search investor, guarantor, funding need, ID, transaction ID or account" defaultSort="-created"
        summary={d => <>Showing {d.total.toLocaleString()} investment(s) totalling <MoneyDisplay value={d.total_amount} /></>}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['PENDING_VERIFICATION', 'VERIFIED', 'PAYOUT_DUE', 'COMPLETED', 'REJECTED'].map(s => ({ value: s, label: titleCase(s) })) }, { key: 'from', label: 'Submitted from', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        empty={{ title: 'No investments yet' }}
        columns={[
          { key: 'id', header: 'Investment', render: r => <><Link href={`/admin/investments/${r.id}`}><b>#{r.id}</b> · {r.investor_username}</Link><div className="sub">{r.snap_title}</div></> },
          { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: r => <MoneyDisplay value={r.amount} strong /> },
          { key: 'acct', header: 'Account used', render: r => r.account_name || '—' },
          { key: 'g', header: 'Guarantor', render: r => r.guarantor_username || '—' },
          { key: 'created', header: 'Submitted', sort: 'created', render: r => formatDateTime(r.created_at) },
          { key: 'st', header: 'Status', sort: 'status', render: r => <StatusBadge status={r.display_status} /> },
          { key: 'a', header: '', actions: true, render: (r, { reload }) => (<><ProofButton proofId={r.proof_id} /><InvestmentActions inv={r} onDone={reload} /></>) },
        ]} />
    </>
  );
}
