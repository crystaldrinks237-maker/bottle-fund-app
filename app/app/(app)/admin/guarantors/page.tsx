'use client';
import { ListView } from '@/components/ui/ListView';
import { MoneyDisplay, PageHeader } from '@/components/ui/kit';
import { formatDate } from '@/lib/format';
import { ViewAsButton } from '@/components/domain/ViewAsButton';

export default function Guarantors() {
  return (
    <>
      <PageHeader title="Guarantors" subtitle="Everyone can be a guarantor by sharing their referral link. This lists people who have referred someone or earned something — there is nothing to set up." />
      <ListView endpoint="/api/guarantors" search="Search username or name" defaultSort="-earnings" empty={{ title: 'No referrals yet', text: 'Once people sign up through someone’s referral link, that person appears here.' }}
        columns={[
          { key: 'u', header: 'Guarantor', sort: 'username', render: r => <><b>{r.username}</b><div className="sub">{r.full_name || '—'} · {r.phone || 'no phone'}</div></> },
          { key: 'r', header: 'Referred investors', sort: 'referred', align: 'right', render: r => r.referred_investors },
          { key: 'a', header: 'Active investments', align: 'right', render: r => r.active_investments },
          { key: 'l', header: 'Lifetime earnings', sort: 'earnings', align: 'right', render: r => <MoneyDisplay value={r.lifetime} /> },
          { key: 'un', header: 'Unsettled', align: 'right', render: r => <MoneyDisplay value={r.unsettled} /> },
          { key: 'p', header: 'Paid', align: 'right', render: r => <MoneyDisplay value={r.paid} /> },
          { key: 'c', header: 'Since', sort: 'created', render: r => formatDate(r.created_at) },
          { key: 'v', header: '', actions: true, render: r => <ViewAsButton user={r} landing="guarantor" /> },
        ]} />
    </>
  );
}
