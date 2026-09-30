'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, ErrorState, LoadingState, MoneyDisplay, PageHeader, ProgressBar, StatusBadge, Tabs } from '@/components/ui/kit';
import { ListView } from '@/components/ui/ListView';
import { NeedForm } from '@/components/domain/NeedForm';
import { InvestmentActions, ProofButton } from '@/components/domain/actions';
import { KV } from '@/components/domain/bits';
import { formatDateTime, pct, titleCase } from '@/lib/format';

export default function NeedDetail({ params }: { params: { id: string } }) {
  const { data, error, loading, refetch, reload } = useApi<any>(`/api/funding-needs/${params.id}`);
  const [tab, setTab] = useState('overview'); const [dlg, setDlg] = useState<string | null>(null); const [edit, setEdit] = useState(false); const toast = useToast();
  if (loading && !data) return <div className="card"><LoadingState rows={6} /></div>;
  if (error || !data) return <div className="card"><ErrorState message={error || 'Not found'} onRetry={refetch} /></div>;
  const { need: n, calc: c, accounts, summary: s } = data;
  const st = (action: string, reason?: string) => api(`/api/funding-needs/${n.id}/status`, { method: 'POST', json: { action, reason } });
  const editable = !['CANCELLED', 'COMPLETED'].includes(n.status);
  return (
    <>
      <p style={{ marginBottom: 14 }}><Link href="/admin/funding-needs">← Funding needs</Link></p>
      <PageHeader title={n.title} subtitle={<>{n.product} · {Number(n.quantity).toLocaleString()} bottles · <StatusBadge status={n.status} /></>}
        actions={<>
          {editable && <button className="btn" onClick={() => setEdit(true)}>Edit</button>}
          {['DRAFT', 'CLOSED'].includes(n.status) && <button className="btn btn-success" onClick={() => setDlg('open')}>{n.status === 'DRAFT' ? 'Open for investment' : 'Reopen'}</button>}
          {['OPEN', 'FULL'].includes(n.status) && <button className="btn" onClick={() => setDlg('close')}>Close</button>}
          {n.status === 'CLOSED' && <button className="btn" onClick={() => setDlg('complete')}>Mark completed</button>}
          {editable && <button className="btn btn-danger" onClick={() => setDlg('cancel')}>Cancel</button>}</>} />
      <div className="card card-pad" style={{ marginBottom: 18 }}><ProgressBar funded={n.funded_amount} total={n.total_capital} />
        {n.pending_count > 0 && <p className="small muted" style={{ marginTop: 8 }}><MoneyDisplay value={s.pending_amount} /> of this is still awaiting verification.</p>}</div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'investments', label: `Investments (${n.investments_count})` }, { id: 'accounts', label: `Accounts (${accounts.length})` }, { id: 'payouts', label: 'Payouts & guarantors' }, { id: 'activity', label: 'Activity' }]} />
      {tab === 'overview' && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="card"><div className="card-head"><h2>Terms</h2></div><div className="card-pad"><KV items={[['Cost / bottle', <MoneyDisplay value={n.cost_price} key="a" />], ['Sell / bottle', <MoneyDisplay value={n.sell_price} key="b" />], ['Operational cost / bottle', <MoneyDisplay value={n.op_cost} key="c" />],
            ['Profit / bottle', <MoneyDisplay value={c.distributable_per_bottle} key="d" strong />], ['Investor share', pct(n.investor_pct)], ['Guarantor share', pct(n.guarantor_pct)], ['Business share (remainder)', pct(n.business_pct)],
            ['Description', n.description || '—'], ['Created', `${formatDateTime(n.created_at)} by ${n.created_by_username || '—'}`], ['Opened', formatDateTime(n.opened_at)], ['Closed', formatDateTime(n.closed_at)], ...(n.cancel_reason ? [['Cancel reason', n.cancel_reason] as [string, string]] : [])]} /></div></div>
          <div className="card"><div className="card-head"><h2>Full-funding projection</h2></div><div className="card-pad"><KV items={[['Total profit pool', <MoneyDisplay value={c.total_profit_pool} key="a" strong />], ['Investors', <MoneyDisplay value={c.investor_profit_pool} key="b" />], ['Guarantors', <MoneyDisplay value={c.guarantor_profit_pool} key="c" />], ['Business', <MoneyDisplay value={c.business_profit_pool} key="d" />], ['Investor return / principal', `${c.investor_return_pct}%`]]} />
            <p className="small muted" style={{ marginTop: 10 }}>Projection at current terms. Verified investments keep the terms they were submitted under.</p></div></div>
        </div>)}
      {tab === 'investments' && <ListView endpoint={`/api/funding-needs/${n.id}/investments`} search="Search investor, ID or transaction" defaultSort="-created" empty={{ title: 'No investments yet' }}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: ['PENDING_VERIFICATION', 'VERIFIED', 'PAYOUT_DUE', 'COMPLETED', 'REJECTED'].map(x => ({ value: x, label: titleCase(x) })) }]}
        columns={[{ key: 'id', header: 'Investment', render: r => <Link href={`/admin/investments/${r.id}`}>#{r.id} · {r.investor_username}</Link> }, { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', render: r => <MoneyDisplay value={r.amount} /> },
          { key: 'acct', header: 'Account', render: r => r.account_name || '—' }, { key: 'st', header: 'Status', render: r => <StatusBadge status={r.display_status} /> }, { key: 'due', header: 'Due', sort: 'due', render: r => formatDateTime(r.due_at) },
          { key: 'a', header: '', actions: true, render: (r, { reload: rl }) => (<><ProofButton proofId={r.proof_id} /><InvestmentActions inv={r} onDone={() => { rl(); reload(); }} /></>) }]} />}
      {tab === 'accounts' && (
        <div className="card">{!accounts.length ? <EmptyState icon="card" title="No payment accounts assigned" action={<button className="btn btn-primary" onClick={() => setEdit(true)}>Assign accounts</button>}>Investors can’t submit until at least one active account is assigned.</EmptyState> : (
          <div className="table-wrap"><table className="tbl responsive"><thead><tr><th>Priority</th><th>Account</th><th>Availability</th><th className="right">Used</th><th className="right">Remaining</th></tr></thead>
            <tbody>{accounts.map((a: any, i: number) => <tr key={a.id}><td data-label="Priority">{i + 1}</td><td data-label="Account"><b>{a.account_name}</b><div className="sub">{a.provider.toLowerCase()} · {a.account_number}</div></td><td data-label="Availability"><StatusBadge status={a.availability} /></td><td data-label="Used" className="right"><MoneyDisplay value={a.allocated_amount} /></td><td data-label="Remaining" className="right">{a.remaining_amount == null ? 'No limit' : <MoneyDisplay value={a.remaining_amount} />}</td></tr>)}</tbody></table></div>)}
          <div style={{ padding: 16, borderTop: '1px solid var(--line)' }}><button className="btn" onClick={() => setEdit(true)}>Change assigned accounts</button></div></div>)}
      {tab === 'payouts' && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="card"><div className="card-head"><h2>Investor payouts</h2></div><div className="card-pad"><KV items={[['Verified capital', <MoneyDisplay value={s.verified_amount} key="a" />], ['Investor profit committed', <MoneyDisplay value={s.investor_profit} key="b" />], ['Outstanding payouts', <MoneyDisplay value={s.outstanding_payouts} key="c" strong />], ['Paid so far', <MoneyDisplay value={s.paid_payouts} key="d" />], ['Business profit (verified)', <MoneyDisplay value={s.business_profit} key="e" />]]} /></div></div>
          <div className="card"><div className="card-head"><h2>Guarantor impact</h2></div>{!data.guarantor_impact.length ? <p className="muted" style={{ padding: 20 }}>No guarantor-linked investments yet.</p> : (
            <div className="table-wrap"><table className="tbl"><thead><tr><th>Guarantor</th><th className="right">Investments</th><th className="right">Earnings</th></tr></thead><tbody>{data.guarantor_impact.map((g: any) => <tr key={g.guarantor}><td>{g.guarantor}</td><td className="right">{g.investments}</td><td className="right"><MoneyDisplay value={g.earnings} /></td></tr>)}</tbody></table></div>)}</div>
        </div>)}
      {tab === 'activity' && <div className="card">{!data.activity.length ? <EmptyState title="No activity yet" /> : data.activity.map((a: any) => <div key={a.id} className="row between" style={{ padding: '11px 20px', borderBottom: '1px solid var(--line)' }}><span><b className="small">{titleCase(a.action.replace('.', ' · '))}</b><div className="small muted">{a.actor || 'system'}</div></span><span className="small muted">{formatDateTime(a.created_at)}</span></div>)}</div>}

      {edit && <NeedForm need={n} accountIds={accounts.map((a: any) => a.id)} onClose={() => setEdit(false)} onSaved={reload} />}
      {dlg === 'open' && <ConfirmDialog title="Open for investment?" tone="success" confirmLabel="Open" onClose={() => setDlg(null)} description="Investors will immediately see this funding need and can submit payments." onConfirm={async () => { await st('open'); toast.success('Funding need is open'); reload(); }} />}
      {dlg === 'close' && <ConfirmDialog title="Close this funding need?" confirmLabel="Close" tone="primary" onClose={() => setDlg(null)} description="No new investments will be accepted. Existing ones continue normally." onConfirm={async () => { await st('close'); toast.success('Funding need closed'); reload(); }} />}
      {dlg === 'complete' && <ConfirmDialog title="Mark as completed?" confirmLabel="Complete" tone="primary" onClose={() => setDlg(null)} description="Only possible when every investment is paid out or rejected." onConfirm={async () => { await st('complete'); toast.success('Funding need completed'); reload(); }} />}
      {dlg === 'cancel' && <ConfirmDialog title="Cancel this funding need?" confirmLabel="Cancel funding need" tone="danger" onClose={() => setDlg(null)} description="Only possible when no investment is pending or awaiting payout. This cannot be undone."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 3 }]} onConfirm={async v => { await st('cancel', v.reason); toast.success('Funding need cancelled'); reload(); }} />}
    </>
  );
}
