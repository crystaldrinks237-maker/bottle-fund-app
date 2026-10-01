'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { BarChart } from '@/components/ui/BarChart';
import { EmptyState, ErrorState, LoadingState, MoneyDisplay, PageHeader, ProgressBar, StatCard, StatusBadge } from '@/components/ui/kit';
import { formatDateTime, formatDate, titleCase } from '@/lib/format';

export default function Overview() {
  const { data, error, loading, refetch } = useApi<any>('/api/admin/overview');
  if (loading && !data) return <><PageHeader title="Overview" /><div className="card"><LoadingState rows={6} /></div></>;
  if (error || !data) return <><PageHeader title="Overview" /><div className="card"><ErrorState message={error || ''} onRetry={refetch} /></div></>;
  const c = data.cards; const n = (v: any) => Number(v);
  const attn = [
    { href: '/admin/investments?status=PENDING_VERIFICATION', label: 'Pending verification', n: c.pending_count, sub: <MoneyDisplay value={c.pending_amount} />, hot: c.pending_count > 0 },
    { href: '/admin/payouts?status=DUE', label: 'Payouts due', n: c.payouts_due_count, sub: <MoneyDisplay value={c.payouts_due_amount} />, hot: c.payouts_due_count > 0 },
    { href: '/admin/payouts?overdue=1', label: 'Overdue payouts', n: c.overdue_count, sub: c.overdue_count ? <MoneyDisplay value={c.overdue_amount} /> : '> 24h past due', hot: c.overdue_count > 0 },
    { href: '/admin/guarantor-payments', label: 'Guarantor payments', n: c.gp_pending_count + c.gp_unsettled_guarantors, sub: c.gp_unsettled_guarantors ? `${c.gp_unsettled_guarantors} guarantor(s) not yet settled` : <MoneyDisplay value={c.gp_pending_amount} />, hot: c.gp_pending_count + c.gp_unsettled_guarantors > 0 },
    { href: '/admin/claims?status=OPEN', label: 'Payment claims', n: c.open_claims, sub: 'Open or under review', hot: c.open_claims > 0 },
    { href: '/admin/payment-accounts', label: 'Accounts near limit', n: data.near_limit.length, sub: 'Near, at limit or daily cap', hot: data.near_limit.length > 0 },
  ];
  const chart = data.cashflow.map((d: any) => ({ label: d.day ? formatDate(String(d.day).slice(0, 10) + 'T12:00:00Z').slice(0, 6) : 'Due now', value: n(d.amount), hot: !d.day, title: `${d.count} payout(s) · PKR ${n(d.amount).toLocaleString()}` }));
  return (
    <>
      <PageHeader title="Overview" subtitle="What needs your attention right now." actions={<Link className="btn btn-primary" href="/admin/funding-needs">Manage funding needs</Link>} />
      <div className="stack">
        <div className="card"><div className="card-head"><h2>Needs attention</h2></div>
          <div className="attention">{attn.map(a => <Link key={a.label} href={a.href} className={`attn ${a.hot ? 'hot' : 'zero'}`}><span className="n">{a.n}</span><span><b>{a.label}</b><small>{a.sub}</small></span></Link>)}</div></div>
        <div className="stats">
          <StatCard icon="layers" label="Active funding needs" value={c.active_needs} sub={c.full_needs ? `${c.full_needs} fully funded` : 'Open now'} href="/admin/funding-needs?status=OPEN" />
          <StatCard icon="wallet" label="Total capital required" value={<MoneyDisplay value={c.capital_required} />} sub="Open and fully funded needs" />
          <StatCard icon="cash" label="Total capital funded" value={<MoneyDisplay value={c.capital_funded} />} sub={n(c.capital_required) ? `${Math.round((n(c.capital_funded) / n(c.capital_required)) * 100)}% of required` : undefined} tone="good" />
          <StatCard icon="check" label="Pending verification" value={c.pending_count} sub={<MoneyDisplay value={c.pending_amount} />} href="/admin/investments?status=PENDING_VERIFICATION" tone={c.pending_count ? 'warn' : undefined} />
          <StatCard icon="clock" label="Payouts due" value={c.payouts_due_count} sub={<MoneyDisplay value={c.payouts_due_amount} />} href="/admin/payouts?status=DUE" tone={c.payouts_due_count ? 'warn' : undefined} />
          <StatCard icon="alert" label="Overdue payouts" value={c.overdue_count} sub="More than 24h past due" href="/admin/payouts?overdue=1" tone={c.overdue_count ? 'danger' : undefined} />
          <StatCard icon="calendar" label="Guarantor payments pending" value={c.gp_pending_count} sub={<MoneyDisplay value={c.gp_pending_amount} />} href="/admin/guarantor-payments" />
          <StatCard icon="flag" label="Open payment claims" value={c.open_claims} href="/admin/claims?status=OPEN" tone={c.open_claims ? 'danger' : undefined} />
        </div>
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="card"><div className="card-head"><div><h2>Payout obligations · next 14 days</h2><p>Money you need ready, by due day. “Due now” is already payable.</p></div></div>
            <div className="card-pad">{chart.length ? <BarChart data={chart} /> : <EmptyState icon="calendar" title="No outstanding payouts" />}</div></div>
          <div className="card"><div className="card-head"><h2>Funding progress</h2><Link href="/admin/funding-needs" className="small">All needs</Link></div>
            <div className="card-pad stack">{data.needs.length ? data.needs.map((x: any) => (
              <div key={x.id}><div className="row between" style={{ marginBottom: 6 }}><Link href={`/admin/funding-needs/${x.id}`}><b>{x.title}</b></Link><StatusBadge status={x.status} /></div><ProgressBar funded={x.funded_amount} total={x.total_capital} /></div>)) : <EmptyState icon="layers" title="No open funding needs" />}</div></div>
        </div>
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="card"><div className="card-head"><h2>Payment accounts to watch</h2><Link href="/admin/payment-accounts" className="small">Manage</Link></div>
            {!data.near_limit.length ? <p className="muted" style={{ padding: 20 }}>All active accounts have comfortable capacity.</p> : data.near_limit.map((a: any) => (
              <div key={a.id} className="row between" style={{ padding: '12px 20px', borderTop: '1px solid var(--line)' }}><div><b>{a.account_name}</b><div className="small muted">Remaining <MoneyDisplay value={a.remaining_amount} /></div></div><StatusBadge status={a.availability} /></div>))}</div>
          <div className="card"><div className="card-head"><h2>Recent activity</h2><Link href="/admin/activity" className="small">View all</Link></div>
            {data.recent.map((a: any) => <div key={a.id} className="row between" style={{ padding: '10px 20px', borderTop: '1px solid var(--line)' }}><span><b className="small">{titleCase(a.action.replace('.', ' · '))}</b><div className="small muted">{a.actor || 'system'} · {a.entity_type} {a.entity_id}</div></span><span className="small muted nowrap">{formatDateTime(a.created_at)}</span></div>)}</div>
        </div>
      </div>
    </>
  );
}
