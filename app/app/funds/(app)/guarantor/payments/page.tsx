'use client';
import { useState } from 'react';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { ReportNotReceived } from '@/components/domain/actions';
import { GuarantorPaymentDetail } from '@/components/domain/GuarantorPaymentDetail';
import { formatDateTime, formatMonth } from '@/lib/format';

export default function GuarantorPayments() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHeader title="Monthly payments" subtitle="One payment per month, with its transaction ID once sent." />
      <ListView endpoint="/api/guarantor-payments" extraParams={{ scope: 'mine' }} defaultSort="-month" empty={{ title: 'No payments yet', text: 'Your first payment appears once an administrator finalises a month.' }}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['PENDING', 'PROCESSING', 'PAID', 'CLAIMED_NOT_RECEIVED', 'RESOLVED'].map(s => ({ value: s, label: s.toLowerCase().replace(/_/g, ' ') })) }]}
        columns={[
          { key: 'm', header: 'Month', sort: 'month', render: r => <b>{formatMonth(r.period_month)}</b> },
          { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: r => <MoneyDisplay value={r.amount} strong /> },
          { key: 'st', header: 'Status', render: r => <StatusBadge status={r.status} /> },
          { key: 'txn', header: 'Transaction ID', render: r => (r.transaction_id ? <span className="mono">{r.transaction_id}</span> : '—') },
          { key: 'paid', header: 'Paid on', render: r => formatDateTime(r.paid_at) },
          { key: 'a', header: '', actions: true, render: (r, { reload }) => (<>
            <button className="btn btn-sm" onClick={() => setOpen(r.id)}>Details</button>
            {r.status === 'PAID' && !r.had_rejected_claim && <ReportNotReceived target={{ guarantor_payment_id: r.id }} onDone={reload} />}
            {r.status === 'CLAIMED_NOT_RECEIVED' && <span className="small muted">Your claim has been submitted.</span>}</>) },
        ]} />
      {open && <GuarantorPaymentDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
