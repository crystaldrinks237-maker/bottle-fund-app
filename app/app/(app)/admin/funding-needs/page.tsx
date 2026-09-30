'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { NeedForm } from '@/components/domain/NeedForm';
import { formatDate, pct } from '@/lib/format';

export default function Needs() {
  const [creating, setCreating] = useState(false); const [k, setK] = useState(0);
  return (
    <>
      <PageHeader title="Funding Needs" subtitle="Independent funding requests. Any number can be open at once." actions={<button className="btn btn-primary" onClick={() => setCreating(true)}>New funding need</button>} />
      <ListView key={k} endpoint="/api/funding-needs" search="Search title, product or ID" defaultSort="-created"
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'COMPLETED', 'CANCELLED'].map(s => ({ value: s, label: s.toLowerCase() })) }, { key: 'from', label: 'Created from', type: 'date' }, { key: 'to', label: 'To', type: 'date' }]}
        empty={{ title: 'No funding needs yet', text: 'Create your first funding need to start taking investments.', action: <button className="btn btn-primary" onClick={() => setCreating(true)}>New funding need</button> }}
        columns={[
          { key: 'title', header: 'Funding need', sort: 'title', render: r => <><Link href={`/admin/funding-needs/${r.id}`}><b>{r.title}</b></Link><div className="sub">{r.product} · {Number(r.quantity).toLocaleString()} bottles</div></> },
          { key: 'status', header: 'Status', sort: 'status', render: r => <StatusBadge status={r.status} /> },
          { key: 'cap', header: 'Capital', sort: 'capital', align: 'right', render: r => <MoneyDisplay value={r.total_capital} /> },
          { key: 'funded', header: 'Funded', sort: 'funded', align: 'right', render: r => <><MoneyDisplay value={r.funded_amount} /><div className="sub">{Math.round((Number(r.funded_amount) / Number(r.total_capital)) * 100)}%</div></> },
          { key: 'split', header: 'Inv / Guar / Biz', render: r => <span className="small">{pct(r.investor_pct)} / {pct(r.guarantor_pct)} / {pct(r.business_pct)}</span> },
          { key: 'pend', header: 'Pending', render: r => (r.pending_count ? <span className="badge warning">{r.pending_count}</span> : '—') },
          { key: 'created', header: 'Created', sort: 'created', render: r => formatDate(r.created_at) },
        ]} />
      {creating && <NeedForm onClose={() => setCreating(false)} onSaved={() => setK(k + 1)} />}
    </>
  );
}
