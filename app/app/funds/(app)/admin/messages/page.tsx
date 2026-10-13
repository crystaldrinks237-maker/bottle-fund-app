'use client';
import { api, useApi } from '@/lib/client';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

export default function Messages() {
  const { data, error, loading, refetch } = useApi<{ rows: any[] }>('/api/admin/messages'); const toast = useToast();
  async function mark(id: number, is_read: boolean) { try { await api(`/api/admin/messages/${id}`, { method: 'PUT', json: { is_read } }); refetch(); } catch (x: any) { toast.error(x.message); } }
  return (
    <>
      <PageHeader title="Website messages" subtitle="Enquiries sent through the contact form on the homepage (also emailed to you when email is configured)." />
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : !data?.rows.length ? <div className="card"><EmptyState icon="list" title="No messages yet">Messages from the website form will appear here.</EmptyState></div> : (
        <div className="stack-sm">{data.rows.map(m => (
          <div className="card card-pad" key={m.id} style={{ opacity: m.is_read ? .7 : 1 }}>
            <div className="row between"><div><b>{m.name}</b> · <a href={`https://wa.me/${String(m.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{m.phone}</a></div>
              <span className="small muted">{new Date(m.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })}{m.emailed ? '' : ' · not emailed'}</span></div>
            <p style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{m.message}</p>
            <button className="btn btn-sm" onClick={() => mark(m.id, !m.is_read)}>{m.is_read ? 'Mark unread' : 'Mark as read'}</button>
          </div>))}</div>)}
    </>
  );
}
