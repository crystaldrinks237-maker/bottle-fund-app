'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ListView } from '@/components/ui/ListView';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ErrorState, LoadingState, MoneyDisplay, PageHeader, StatusBadge } from '@/components/ui/kit';
import { AccountForm } from '@/components/domain/AccountForm';
import { providerLabel } from '@/components/domain/bits';
import { formatDateTime } from '@/lib/format';

function Usage({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, error, loading, refetch } = useApi<any>(`/api/payment-accounts/${id}`);
  return (
    <Modal title={data ? `${data.account.account_name} · usage` : 'Usage'} onClose={onClose} size="wide">
      {loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : data && (<div className="stack">
        <div className="stats"><div className="stat"><div className="k">Pending verification</div><div className="v"><MoneyDisplay value={data.totals.pending} /></div></div><div className="stat"><div className="k">Verified</div><div className="v"><MoneyDisplay value={data.totals.verified} /></div></div><div className="stat"><div className="k">Received today</div><div className="v"><MoneyDisplay value={data.account.today_amount} /></div></div></div>
        <div><h3 style={{ marginBottom: 6 }}>Assigned to</h3>{data.assigned_needs.length ? data.assigned_needs.map((n: any) => <div key={n.id}><Link href={`/admin/funding-needs/${n.id}`}>{n.title}</Link> <StatusBadge status={n.status} /></div>) : <span className="muted">No funding needs.</span>}</div>
        <div><h3 style={{ marginBottom: 6 }}>Recent investments</h3>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>ID</th><th>Investor</th><th>Funding need</th><th className="right">Amount</th><th>Status</th><th>Submitted</th></tr></thead>
            <tbody>{data.recent_investments.map((i: any) => <tr key={i.id}><td><Link href={`/admin/investments/${i.id}`}>#{i.id}</Link></td><td>{i.investor}</td><td>{i.funding_need}</td><td className="right"><MoneyDisplay value={i.amount} /></td><td><StatusBadge status={i.status} /></td><td>{formatDateTime(i.created_at)}</td></tr>)}</tbody></table></div></div>
      </div>)}
    </Modal>
  );
}

export default function Accounts() {
  const [form, setForm] = useState<any>(null); const [usage, setUsage] = useState<number | null>(null); const [toggle, setToggle] = useState<any>(null); const [k, setK] = useState(0); const toast = useToast();
  return (
    <>
      <PageHeader title="Payment Accounts" subtitle="Where investors send money. Historical investments keep the account details they were shown." actions={<button className="btn btn-primary" onClick={() => setForm({})}>Add account</button>} />
      <ListView key={k} endpoint="/api/payment-accounts" exportPath="/api/payment-accounts" search="Search name, holder or number"
        filters={[{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] }, { key: 'availability', label: 'Availability', type: 'select', options: [{ value: 'ACTIVE', label: 'Available' }, { value: 'NEAR_LIMIT', label: 'Near limit' }, { value: 'LIMIT_REACHED', label: 'Limit reached' }, { value: 'DAILY_LIMIT_REACHED', label: 'Daily limit reached' }] }, { key: 'provider', label: 'Provider', type: 'select', options: ['BANK', 'EASYPAISA', 'JAZZCASH', 'OTHER'].map(p => ({ value: p, label: providerLabel(p) })) }]}
        empty={{ title: 'No payment accounts yet', text: 'Add the bank or wallet accounts investors will pay into.', action: <button className="btn btn-primary" onClick={() => setForm({})}>Add account</button> }}
        columns={[
          { key: 'a', header: 'Account', render: r => <><b>{r.account_name}</b><div className="sub">{r.account_holder_name} · {r.account_number}</div></> },
          { key: 'p', header: 'Provider', render: r => providerLabel(r.provider) },
          { key: 's', header: 'Status', render: r => <StatusBadge status={r.availability} /> },
          { key: 'l', header: 'Limit', align: 'right', render: r => (r.total_limit ? <><MoneyDisplay value={r.total_limit} />{r.daily_limit && <div className="sub">Daily <MoneyDisplay value={r.daily_limit} /></div>}</> : <span className="muted">No limit{r.daily_limit ? <div className="sub">Daily <MoneyDisplay value={r.daily_limit} /></div> : null}</span>) },
          { key: 'u', header: 'Used', align: 'right', render: r => <MoneyDisplay value={r.allocated_amount} /> },
          { key: 'rem', header: 'Remaining', align: 'right', render: r => (r.remaining_amount == null ? '—' : <MoneyDisplay value={r.remaining_amount} strong />) },
          { key: 'n', header: 'Assigned needs', align: 'right', render: r => r.assigned_needs },
          { key: 'up', header: 'Last updated', render: r => formatDateTime(r.updated_at) },
          { key: 'x', header: '', actions: true, render: r => (<>
            <button className="btn btn-sm" onClick={() => setUsage(r.id)}>Usage</button><button className="btn btn-sm" onClick={() => setForm(r)}>Edit</button>
            {r.status === 'ACTIVE' ? <button className="btn btn-sm btn-danger" onClick={() => setToggle({ r, action: 'deactivate' })}>Deactivate</button> : <button className="btn btn-sm btn-success" onClick={() => setToggle({ r, action: 'reactivate' })}>Reactivate</button>}</>) },
        ]} />
      {form && <AccountForm account={form.id ? form : undefined} onClose={() => setForm(null)} onSaved={() => setK(k + 1)} />}
      {usage && <Usage id={usage} onClose={() => setUsage(null)} />}
      {toggle && <ConfirmDialog title={toggle.action === 'deactivate' ? `Deactivate ${toggle.r.account_name}?` : `Reactivate ${toggle.r.account_name}?`} tone={toggle.action === 'deactivate' ? 'danger' : 'success'} confirmLabel={toggle.action === 'deactivate' ? 'Deactivate' : 'Reactivate'} onClose={() => setToggle(null)}
        description={toggle.action === 'deactivate' ? 'New investments can no longer be assigned to this account. Existing investments keep their snapshot and history. You can reactivate it later.' : 'The account becomes available for new investments again (subject to its limits).'}
        onConfirm={async () => { const r = await api(`/api/payment-accounts/${toggle.r.id}/status`, { method: 'POST', json: { action: toggle.action } }); toast.success(toggle.action === 'deactivate' ? 'Account deactivated' : 'Account reactivated'); (r.warnings || []).forEach((w: string) => toast.error(w)); setK(k + 1); }} />}
    </>
  );
}
