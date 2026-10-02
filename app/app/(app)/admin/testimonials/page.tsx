'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { ListView } from '@/components/ui/ListView';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Field, PageHeader, StatusBadge } from '@/components/ui/kit';
import { Stars } from '@/components/ui/Stars';
import { StarInput } from '@/components/ui/StarInput';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';

function AddTestimonial({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const [f, setF] = useState({ display_name: '', city: '', rating: 0, body: '', permission_note: '', consent_confirmed: false }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); try { await api('/api/admin/testimonials', { method: 'POST', json: f }); toast.success('Testimonial published'); onSaved(); onClose(); } catch (x: any) { setErr(x.message); setBusy(false); } }
  return (
    <Modal title="Add a customer’s testimonial" onClose={onClose} size="wide" subtitle="Only for a real customer who has agreed to be quoted. This is published immediately."
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="t-form" disabled={busy || !f.rating || !f.consent_confirmed}>{busy ? 'Saving…' : 'Publish'}</button></>}>
      <form id="t-form" onSubmit={save} className="stack">
        <div className="notice warn">Use the customer’s own words. Don’t write, polish or invent reviews. Statements like “halal” or “guaranteed” become claims by your business — publish them only if you can stand behind them (for “halal”, get a written opinion from a qualified Shariah scholar).</div>
        <div><div className="lbl" style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--navy-2)', marginBottom: 4 }}>Rating they gave</div><StarInput value={f.rating} onChange={n => setF({ ...f, rating: n })} /></div>
        <Field label="Their words" hint="20–600 characters"><textarea className="input" maxLength={600} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
        <div className="grid2"><Field label="Name to show (as they agreed)"><input className="input" value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} /></Field><Field label="City (optional)"><input className="input" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></Field></div>
        <Field label="How did they give permission?" hint="Kept in the audit log, e.g. “WhatsApp message, 12 Oct 2026”"><input className="input" value={f.permission_note} onChange={e => setF({ ...f, permission_note: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={f.consent_confirmed} onChange={e => setF({ ...f, consent_confirmed: e.target.checked })} /><span>This is a real customer and they agreed to have this review, name and city shown publicly.</span></label>
        {err && <div className="errbox" role="alert">{err}</div>}
      </form>
    </Modal>
  );
}

export default function Testimonials() {
  const [add, setAdd] = useState(false); const [k, setK] = useState(0); const [dlg, setDlg] = useState<{ r: any; action: 'approve' | 'reject' } | null>(null); const toast = useToast();
  return (
    <>
      <PageHeader title="Testimonials" subtitle="Reviews from real customers. Nothing appears on the welcome page until you approve it." actions={<button className="btn btn-primary" onClick={() => setAdd(true)}>Add customer testimonial</button>} />
      <ListView key={k} endpoint="/api/testimonials" search="Search name, city or review" defaultSort="-created" empty={{ title: 'No reviews yet', text: 'Investors who have received a payout are invited to review on their dashboard. You can also add a testimonial from a customer who gave permission.' }}
        filters={[{ key: 'status', label: 'Status', type: 'select', options: [{ value: 'PENDING', label: 'Awaiting approval' }, { value: 'APPROVED', label: 'Published' }, { value: 'REJECTED', label: 'Not published' }] }]}
        columns={[
          { key: 'n', header: 'Reviewer', render: r => <><b>{r.display_name}</b><div className="sub">{r.city || '—'} · {r.source === 'INVESTOR' ? `investor @${r.investor_username}` : 'added by admin'}</div></> },
          { key: 'r', header: 'Rating', sort: 'rating', render: r => <Stars value={r.rating} size={16} /> },
          { key: 'b', header: 'Review', render: r => <span title={r.body}>{r.body.length > 90 ? r.body.slice(0, 90) + '…' : r.body}</span> },
          { key: 's', header: 'Status', sort: 'status', render: r => <StatusBadge status={r.status === 'APPROVED' ? 'ACTIVE' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING'} label={r.status === 'APPROVED' ? 'Published' : r.status === 'REJECTED' ? 'Not published' : 'Awaiting approval'} /> },
          { key: 'c', header: 'Submitted', sort: 'created', render: r => formatDateTime(r.created_at) },
          { key: 'a', header: '', actions: true, render: r => (<>
            {r.status !== 'APPROVED' && <button className="btn btn-sm btn-success" onClick={() => setDlg({ r, action: 'approve' })}>Publish</button>}
            {r.status !== 'REJECTED' && <button className="btn btn-sm btn-danger" onClick={() => setDlg({ r, action: 'reject' })}>{r.status === 'APPROVED' ? 'Unpublish' : 'Reject'}</button>}</>) },
        ]} />
      {add && <AddTestimonial onClose={() => setAdd(false)} onSaved={() => setK(k + 1)} />}
      {dlg && <ConfirmDialog title={dlg.action === 'approve' ? 'Publish this review?' : 'Remove this review from the public page?'} tone={dlg.action === 'approve' ? 'success' : 'danger'} confirmLabel={dlg.action === 'approve' ? 'Publish' : 'Reject'} onClose={() => setDlg(null)}
        description={<><Stars value={dlg.r.rating} size={16} /> <b>{dlg.r.display_name}</b>{dlg.r.city ? `, ${dlg.r.city}` : ''}<div style={{ marginTop: 8 }}>“{dlg.r.body}”</div>{dlg.action === 'approve' && <div className="small" style={{ marginTop: 8 }}>It will be visible to everyone on the welcome page.</div>}</>}
        fields={[{ name: 'note', label: 'Internal note' }]}
        onConfirm={async v => { await api(`/api/testimonials/${dlg.r.id}`, { method: 'PATCH', json: { action: dlg.action, note: v.note || null } }); toast.success(dlg.action === 'approve' ? 'Review published' : 'Review removed'); setK(k + 1); }} />}
    </>
  );
}
