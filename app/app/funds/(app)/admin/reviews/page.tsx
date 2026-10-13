'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/client';
import { CopyButton, EmptyState, ErrorState, LoadingState, PageHeader, Tabs } from '@/components/ui/kit';
import { Stars } from '@/components/ui/Stars';
import { useToast } from '@/components/ui/Toast';

const LINK = 'https://www.crystaldrinks.pk/review';
const SHARE = `Thank you for choosing Crystal Drinks! We'd love your feedback — it takes a minute: ${LINK}`;

export default function WebsiteReviews() {
  const [tab, setTab] = useState('PENDING'); const toast = useToast();
  const { data, error, loading, refetch } = useApi<any>(`/api/admin/reviews${tab === 'ALL' ? '' : `?status=${tab}`}`);
  async function act(id: number, action: string) { try { await api(`/api/admin/reviews/${id}`, { method: 'PUT', json: { action } }); toast.success(action === 'approve' ? 'Approved — now on the homepage' : 'Updated'); refetch(); } catch (x: any) { toast.error(x.message); } }
  async function del(id: number) { if (!confirm('Delete this review permanently?')) return; try { await api(`/api/admin/reviews/${id}`, { method: 'DELETE' }); refetch(); } catch (x: any) { toast.error(x.message); } }
  const c = data?.counts || {};
  return (
    <>
      <PageHeader title="Website reviews" subtitle="Customer reviews left through your review link. Only approved reviews appear on the homepage." />
      <div className="card card-pad stack-sm" style={{ marginBottom: 16 }}>
        <h2>Review link to share with customers</h2>
        <div className="row"><code className="mono">{LINK}</code><CopyButton text={LINK} label="Copy link" /><CopyButton text={SHARE} label="Copy WhatsApp message" /></div>
        <p className="small muted">No account needed — customers open the link, add their business name, rating and a few words. You approve it here before it shows.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'PENDING', label: `Pending${c.PENDING ? ` (${c.PENDING})` : ''}` }, { id: 'APPROVED', label: 'Approved' }, { id: 'REJECTED', label: 'Rejected' }, { id: 'ALL', label: 'All' }]} />
      <div style={{ marginTop: 14 }}>
        {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : !data?.rows?.length ? <div className="card"><EmptyState icon="star" title="Nothing here">Reviews will appear in this list.</EmptyState></div> : (
          <div className="stack-sm">{data.rows.map((r: any) => (
            <div className="card card-pad" key={r.id}>
              <div className="row between"><div><b>{r.business_name}</b> <span style={{ marginLeft: 8 }}><Stars value={r.rating} size={16} /></span></div><span className="small muted">{new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })} · {r.status}</span></div>
              <p style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{r.body}</p>
              <div className="row">
                {r.status !== 'APPROVED' && <button className="btn btn-sm btn-primary" onClick={() => act(r.id, 'approve')}>Approve &amp; show on homepage</button>}
                {r.status === 'APPROVED' && <button className="btn btn-sm" onClick={() => act(r.id, 'pending')}>Hide from homepage</button>}
                {r.status === 'PENDING' && <button className="btn btn-sm" onClick={() => act(r.id, 'reject')}>Reject</button>}
                <button className="btn btn-sm" onClick={() => del(r.id)}>Delete</button>
              </div>
            </div>))}</div>)}
      </div>
    </>
  );
}
