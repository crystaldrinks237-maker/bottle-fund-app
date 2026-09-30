'use client';
import { useState } from 'react';
import { ListView } from '@/components/ui/ListView';
import { Modal } from '@/components/ui/Modal';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { ClaimActions } from '@/components/domain/actions';
import { KV } from '@/components/domain/bits';
import { formatDateTime, formatMonth } from '@/lib/format';

export default function Claims() {
  const [open, setOpen] = useState<any>(null);
  return (
    <>
      <PageHeader title="Payment Claims" subtitle="Reports of payments that were marked paid but not received. Nothing is reversed automatically." />
      <ListView endpoint="/api/payment-claims" search="Search claimant, transaction ID or claim ID" defaultSort="-created" empty={{ title: 'No claims', text: 'Nobody has reported a missing payment.' }}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].map(s => ({ value: s, label: s.toLowerCase().replace('_', ' ') })) }, { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'GUARANTOR_PAYMENT', label: 'Guarantor payment' }, { value: 'INVESTOR_PAYOUT', label: 'Investor payout' }] }]}
        columns={[
          { key: 'id', header: 'Claim', render: r => <><b>#{r.id}</b><div className="sub">{r.kind === 'GUARANTOR_PAYMENT' ? `Guarantor · ${formatMonth(r.period_month)}` : 'Investor payout'}</div></> },
          { key: 'c', header: 'Claimant', render: r => r.claimant },
          { key: 'a', header: 'Payment', align: 'right', render: r => <><MoneyDisplay value={r.amount} /><div className="sub mono">{r.transaction_id || '—'}</div></> },
          { key: 'r', header: 'Reason', render: r => <span title={r.reason}>{r.reason.length > 60 ? r.reason.slice(0, 60) + '…' : r.reason}</span> },
          { key: 's', header: 'Status', render: r => <StatusBadge status={r.status} /> },
          { key: 'o', header: 'Opened', sort: 'created', render: r => formatDateTime(r.created_at) },
          { key: 'x', header: '', actions: true, render: (r, { reload }) => (<><button className="btn btn-sm" onClick={() => setOpen(r)}>Open</button><ClaimActions c={r} onDone={reload} /></>) },
        ]} />
      {open && <Modal title={`Claim #${open.id}`} onClose={() => setOpen(null)} size="wide"><div className="stack">
        <KV items={[['Status', <StatusBadge status={open.status} key="s" />], ['Claimant', open.claimant], ['Payment', <><MoneyDisplay value={open.amount} /> · {open.kind === 'GUARANTOR_PAYMENT' ? `guarantor payment #${open.guarantor_payment_id}` : `investor payout #${open.payout_id}`}</>], ['Transaction ID', open.transaction_id ? <span className="mono">{open.transaction_id}</span> : '—'], ['Paid on', formatDateTime(open.paid_at)], ['Opened', formatDateTime(open.created_at)], ['Claimant’s reason', open.reason], ['Internal notes', <span style={{ whiteSpace: 'pre-wrap' }} key="n">{open.admin_notes || '—'}</span>], ['Resolution shown to claimant', open.resolution_note || '—'], ['Replacement transaction', open.replacement_transaction_id || '—'], ['Resolved', formatDateTime(open.resolved_at)]]} />
        <p className="small muted">Close this window to use the row actions (review, add note, resolve, reject). Every action is recorded in the activity log.</p></div></Modal>}
    </>
  );
}
