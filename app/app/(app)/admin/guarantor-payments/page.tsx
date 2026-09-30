'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ConfirmDialog } from '@/components/ui/Modal';
import { ListView } from '@/components/ui/ListView';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, Field, MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { GuarantorPaymentActions } from '@/components/domain/actions';
import { GuarantorPaymentDetail } from '@/components/domain/GuarantorPaymentDetail';
import { formatDateTime, formatMonth } from '@/lib/format';

function thisMonth() { return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Karachi', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7); }

export default function GuarantorPayments() {
  const [month, setMonth] = useState(thisMonth()); const [confirm, setConfirm] = useState(false); const [k, setK] = useState(0); const [open, setOpen] = useState<number | null>(null); const toast = useToast();
  const preview = useApi<any>(`/api/guarantor-payments?preview=1&month=${month}`);
  const refresh = () => { setK(k + 1); preview.refetch(); };
  const rows = preview.data?.rows || [];
  const generatable = rows.filter((r: any) => !r.payment_status || r.payment_status === 'PENDING');
  return (
    <>
      <PageHeader title="Guarantor Payments" subtitle="Monthly settlements. Each guarantor earning is linked to exactly one payment, so nothing is paid twice or missed." />
      <div className="stack">
        <div className="card">
          <div className="card-head"><div><h2>Monthly settlement</h2><p>Includes every verified guarantor earning not yet settled, up to the end of the chosen month.</p></div>
            <div className="row"><Field label="Month"><input className="input" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></Field></div></div>
          {!rows.length ? <EmptyState icon="calendar" title={`Nothing to settle for ${formatMonth(month + '-01')}`}>All guarantor earnings up to then are already part of a payment.</EmptyState> : (<>
            <div className="table-wrap"><table className="tbl responsive"><thead><tr><th>Guarantor</th><th className="right">Investments</th><th className="right">Earnings</th><th>Payment</th></tr></thead>
              <tbody>{rows.map((r: any) => <tr key={r.guarantor_id}><td data-label="Guarantor"><b>{r.username}</b></td><td data-label="Investments" className="right">{r.investments}</td><td data-label="Earnings" className="right"><MoneyDisplay value={r.amount} strong /></td><td data-label="Payment">{r.payment_status ? <StatusBadge status={r.payment_status} /> : <span className="muted">Not created yet</span>}</td></tr>)}</tbody></table></div>
            <div style={{ padding: 16, borderTop: '1px solid var(--line)' }}><button className="btn btn-primary" disabled={!generatable.length} onClick={() => setConfirm(true)}>Create payments for {formatMonth(month + '-01')}</button>
              {!generatable.length && <span className="small muted" style={{ marginLeft: 12 }}>Payments already exist and are in progress.</span>}</div></>)}
        </div>
        <ListView key={k} endpoint="/api/guarantor-payments" exportPath="/api/guarantor-payments" search="Search guarantor or transaction ID" defaultSort="-month" empty={{ title: 'No guarantor payments yet' }}
          filters={[{ key: 'status', label: 'Status', type: 'select', options: ['PENDING', 'PROCESSING', 'PAID', 'CLAIMED_NOT_RECEIVED', 'RESOLVED'].map(s => ({ value: s, label: s.toLowerCase().replace(/_/g, ' ') })) }, { key: 'month', label: 'Month', type: 'date' }]}
          summary={d => <>{d.total} payment(s) totalling <MoneyDisplay value={d.total_amount} /></>}
          columns={[
            { key: 'g', header: 'Guarantor', sort: 'guarantor', render: r => <><b>{r.guarantor_username}</b><div className="sub">{r.payout_account ? `${r.payout_method || ''} ${r.payout_account}` : 'No payout account on file'}</div></> },
            { key: 'm', header: 'Month', sort: 'month', render: r => formatMonth(r.period_month) },
            { key: 'a', header: 'Amount', sort: 'amount', align: 'right', render: r => <MoneyDisplay value={r.amount} strong /> },
            { key: 's', header: 'Status', render: r => <StatusBadge status={r.status} /> },
            { key: 't', header: 'Transaction ID', render: r => (r.transaction_id ? <span className="mono">{r.transaction_id}</span> : '—') },
            { key: 'p', header: 'Paid', render: r => formatDateTime(r.paid_at) },
            { key: 'x', header: '', actions: true, render: (r, { reload }) => (<><button className="btn btn-sm" onClick={() => setOpen(r.id)}>Review</button><GuarantorPaymentActions gp={r} onDone={() => { reload(); preview.refetch(); }} /></>) },
          ]} />
      </div>
      {open && <GuarantorPaymentDetail id={open} admin onClose={() => setOpen(null)} />}
      {confirm && <ConfirmDialog title={`Create payments for ${formatMonth(month + '-01')}?`} confirmLabel="Create payments" tone="primary" onClose={() => setConfirm(false)}
        description="One pending payment is created per guarantor from their unsettled earnings, and each guarantor is notified. Payments you’ve already started processing are left untouched."
        onConfirm={async () => { const r = await api('/api/guarantor-payments', { method: 'POST', json: { month } }); toast.success(`${r.created} created, ${r.refreshed} refreshed${r.skipped ? `, ${r.skipped} skipped (already in progress)` : ''}`); refresh(); }} />}
    </>
  );
}
