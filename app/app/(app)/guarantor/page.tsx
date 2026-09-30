'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { EmptyState, ErrorState, LoadingState, MoneyDisplay, PageHeader, StatCard, StatusBadge } from '@/components/ui/kit';
import { formatDate, formatDateTime } from '@/lib/format';

export default function GuarantorHome() {
  const { data, error, loading, refetch } = useApi<any>('/api/guarantor/dashboard');
  return (
    <>
      <PageHeader title="Guarantor dashboard" subtitle="Your referral earnings. Payments are made once a month." actions={<Link className="btn" href="/guarantor/payments">Payment history</Link>} />
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : data && (
        <div className="stack">
          <div className="stats">
            <StatCard icon="calendar" label="Earnings this month" value={<MoneyDisplay value={data.cards.earnings_this_month} />} sub="From investments verified this month" />
            <StatCard icon="clock" label="Pending earnings" value={<MoneyDisplay value={data.cards.pending_earnings} />} sub="Not yet paid to you" tone="warn" />
            <StatCard icon="cash" label="Paid earnings" value={<MoneyDisplay value={data.cards.paid_earnings} />} tone="good" sub={Number(data.cards.disputed_earnings) ? `${Number(data.cards.disputed_earnings).toLocaleString()} PKR reported not received` : undefined} />
            <StatCard icon="users" label="Referred investors" value={data.cards.referred_investors} />
            <StatCard icon="wallet" label="Active referred investments" value={data.cards.active_referred_investments} />
          </div>
          <div className="card"><div className="card-head"><div><h2>Your referred investors</h2><p>Only the information needed to track your earnings.</p></div></div>
            {!data.referred.length ? <EmptyState icon="users" title="No referred investors yet">Investors who name you as their guarantor when signing up will appear here.</EmptyState> : (
              <div className="table-wrap"><table className="tbl responsive"><thead><tr><th>Investor</th><th>Joined</th><th className="right">Verified investments</th><th className="right">Invested</th><th className="right">Your earnings</th></tr></thead>
                <tbody>{data.referred.map((r: any) => <tr key={r.id}><td data-label="Investor"><b>{r.username}</b></td><td data-label="Joined">{formatDate(r.joined_at)}</td><td data-label="Investments" className="right">{r.investments}</td><td data-label="Invested" className="right"><MoneyDisplay value={r.invested} /></td><td data-label="Earnings" className="right"><MoneyDisplay value={r.earnings} strong /></td></tr>)}</tbody></table></div>)}
          </div>
          <div className="card"><div className="card-head"><h2>Recent earnings</h2></div>
            {!data.recent.length ? <EmptyState icon="cash" title="No earnings yet" /> : (
              <div className="table-wrap"><table className="tbl responsive"><thead><tr><th>Verified</th><th>Investor</th><th>Funding need</th><th className="right">Investment</th><th className="right">Your earning</th><th>Status</th></tr></thead>
                <tbody>{data.recent.map((r: any) => <tr key={r.id}><td data-label="Verified">{formatDateTime(r.verified_at)}</td><td data-label="Investor">{r.investor_username}</td><td data-label="Funding need">{r.snap_title}</td><td data-label="Investment" className="right"><MoneyDisplay value={r.amount} /></td><td data-label="Earning" className="right"><MoneyDisplay value={r.guarantor_profit} strong /></td><td data-label="Status"><StatusBadge status={r.display_status} /></td></tr>)}</tbody></table></div>)}
          </div>
        </div>)}
    </>
  );
}
