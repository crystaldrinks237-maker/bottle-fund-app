'use client';
import Link from 'next/link';
import { api, useApi } from '@/lib/client';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/kit';
import { formatDateTime } from '@/lib/format';

export default function Notifications() {
  const { data, error, loading, refetch, reload } = useApi<any>('/api/notifications?all=1');
  return (
    <>
      <PageHeader title="Notifications" actions={data?.unread > 0 && <button className="btn" onClick={async () => { await api('/api/notifications', { method: 'POST', json: {} }); reload(); }}>Mark all as read</button>} />
      <div className="card">{loading && !data ? <LoadingState /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data.rows.length ? <EmptyState icon="bell" title="No notifications yet">Important events like verified payments and payouts show up here.</EmptyState> :
        data.rows.map((n: any) => (
          <Link key={n.id} href={n.link || '#'} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => !n.read_at && api('/api/notifications', { method: 'POST', json: { id: n.id } })}>
            <b>{n.title}</b>{n.body && <span>{n.body}</span>}<span className="faint" style={{ display: 'block' }}>{formatDateTime(n.created_at)}</span>
          </Link>))}</div>
    </>
  );
}
