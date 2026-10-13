'use client';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader } from '@/components/ui/kit';
import { formatDate } from '@/lib/format';
import { ViewAsButton } from '@/components/domain/ViewAsButton';

export default function Investors() {
  return (
    <>
      <PageHeader title="Investors" subtitle="Everyone who has registered. Each person's guarantor is set automatically when they sign up (their inviter, or your default guarantor)." />
      <ListView endpoint="/api/admin/investors" search="Search username, name or phone" defaultSort="-created" empty={{ title: 'No investors yet' }}
        columns={[
          { key: 'u', header: 'Investor', sort: 'username', render: r => <><b>{r.username}</b><div className="sub">{r.full_name || '—'} · {r.phone || 'no phone'}</div></> },
          { key: 'g', header: 'Guarantor', render: r => r.guarantor_username || <span className="muted">None</span> },
          { key: 'i', header: 'Investments', align: 'right', render: r => r.investments },
          { key: 'v', header: 'Verified invested', sort: 'invested', align: 'right', render: r => <MoneyDisplay value={r.invested} /> },
          { key: 'p', header: 'Payout account', render: r => (r.payout_account ? `${r.payout_method || ''} ${r.payout_account}` : <span className="muted">Not set</span>) },
          { key: 'c', header: 'Joined', sort: 'created', render: r => formatDate(r.created_at) },
          { key: 'a', header: '', actions: true, render: r => (<ViewAsButton user={r} landing="investor" />) },
        ]} />
    </>
  );
}
