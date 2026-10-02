'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { Countdown } from '@/components/ui/Countdown';
import { EmptyState, ErrorState, LoadingState, MoneyDisplay, PageHeader, StatCard, StatusBadge } from '@/components/ui/kit';
import { ListView } from '@/components/ui/ListView';
import { formatDate } from '@/lib/format';
import { ReviewPrompt } from '@/components/domain/ReviewPrompt';

export default function Dashboard() {
  const { data, error, loading, refetch, reload } = useApi<any>('/api/me/dashboard');
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your investments and upcoming payouts at a glance." actions={<Link href="/funding-needs" className="btn btn-primary">Browse funding needs</Link>} />
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : data && (
        <div className="stack">
          <div className="stats">
            <StatCard icon="wallet" label="Total invested" value={<MoneyDisplay value={data.cards.total_invested} />} sub={`${data.cards.pending_amount !== '0.00' ? 'Plus ' : ''}${Number(data.cards.pending_amount) ? `PKR ${Number(data.cards.pending_amount).toLocaleString()} awaiting verification` : 'Verified investments'}`} />
            <StatCard icon="layers" label="Active investments" value={data.cards.active_investments} sub="Pending, in cycle or due" />
            <StatCard icon="clock" label="In 7-day cycle" value={<MoneyDisplay value={data.cards.in_cycle} />} sub="Countdown running" />
            <StatCard icon="calendar" label="Upcoming payout" value={data.next_payout ? <MoneyDisplay value={data.next_payout.amount} /> : '—'} sub={data.next_payout ? `Due ${formatDate(data.next_payout.due_at)}` : 'Nothing scheduled'} />
            <StatCard icon="cash" label="Completed payouts" value={data.cards.completed_count} sub={<MoneyDisplay value={data.cards.completed_amount} />} tone="good" />
          </div>
          <ReviewPrompt />
          {Number(data.cards.due_now) > 0 && <div className="notice warn"><b>{Number(data.cards.due_now).toLocaleString()} PKR is due to you now.</b> Payouts are being sent — you’ll see the transaction ID on the investment.</div>}
          {data.next_payout && (
            <div className="card card-pad row between"><div><div className="muted small" style={{ fontWeight: 600 }}>Next payout · {data.next_payout.snap_title}</div><Countdown dueAt={data.next_payout.due_at} serverNow={data.server_now} onElapsed={reload} /></div>
              <Link className="btn" href={`/investments/${data.next_payout.id}`}>View investment</Link></div>)}
          <div><h2 style={{ marginBottom: 12 }}>Recent investments</h2>
            <ListView endpoint="/api/investments" extraParams={{ size: '6', scope: 'mine' }} rowKey="id" empty={{ title: 'No investments yet', text: 'Choose a funding need to make your first investment.', action: <Link className="btn btn-primary" href="/funding-needs">Browse funding needs</Link> }}
              columns={[{ key: 'id', header: 'Investment', render: r => <Link href={`/investments/${r.id}`}>#{r.id} · {r.snap_title}</Link> }, { key: 'amount', header: 'Amount', align: 'right', render: r => <MoneyDisplay value={r.amount} /> },
                { key: 'st', header: 'Status', render: r => <StatusBadge status={r.display_status} /> }, { key: 'due', header: 'Payout due', render: r => (r.due_at ? formatDate(r.due_at) : '—') }]} />
          </div>
        </div>)}
    </>
  );
}
