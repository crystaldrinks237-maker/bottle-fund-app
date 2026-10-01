'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { EmptyState, ErrorState, LoadingState, MoneyDisplay, PageHeader, ProgressBar, StatusBadge } from '@/components/ui/kit';
import { pct } from '@/lib/format';

export default function Needs() {
  const { data, error, loading, refetch } = useApi<any>('/api/funding-needs?view=investor');
  return (
    <>
      <PageHeader title="Funding Needs" subtitle="Open production batches you can fund. Several can be open at once." />
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : !data?.rows.length ? <div className="card"><EmptyState icon="layers" title="No open funding needs right now">New opportunities will appear here as soon as they open.</EmptyState></div> : (
        <div className="cards">{data.rows.map((n: any) => (
          <div className="card need-card" key={n.id}>
            <div className="row between"><div><h3>{n.title}</h3><div className="muted small">{n.product} · {Number(n.quantity).toLocaleString()} bottles</div></div><StatusBadge status={n.status} /></div>
            <ProgressBar funded={n.funded_amount} total={n.total_capital} />
            <div className="row between small"><span className="muted">Your profit share</span><b>{pct(n.investor_pct)}</b></div>
            <div className="row between small"><span className="muted">Return on principal</span><b>{pct(n.calc.investor_return_pct)}</b></div>
            {Number(n.min_investment) > 0 && <div className="row between small"><span className="muted">Minimum investment</span><b><MoneyDisplay value={n.min_investment} /></b></div>}
            <Link href={`/funding-needs/${n.id}`} className={`btn ${n.status === 'OPEN' ? 'btn-primary' : ''}`}>{n.status === 'OPEN' ? 'Invest' : 'View'}</Link>
          </div>))}</div>)}
    </>
  );
}
