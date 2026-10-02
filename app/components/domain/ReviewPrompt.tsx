'use client';
import { useState } from 'react';
import { api, useApi } from '@/lib/client';
import { Modal } from '../ui/Modal';
import { Field, StatusBadge } from '../ui/kit';
import { Stars } from '../ui/Stars';
import { StarInput } from '../ui/StarInput';
import { useToast } from '../ui/Toast';

function ReviewForm({ state, onClose, onSaved }: { state: any; onClose: () => void; onSaved: () => void }) {
  const r = state.review; const toast = useToast();
  const [f, setF] = useState({ display_name: r?.display_name || state.suggested_name || '', city: r?.city || '', rating: r?.rating || 0, body: r?.body || '', consent: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/testimonials', { method: 'POST', json: f }); toast.success('Thank you! Your review will appear once our team approves it.'); onSaved(); onClose(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title={r ? 'Edit your review' : 'Share your experience'} subtitle="Your review is shown on our welcome page after our team approves it." onClose={onClose}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" form="review-form" disabled={busy || !f.rating || !f.consent || f.body.trim().length < 20 || f.display_name.trim().length < 2}>{busy ? 'Sending…' : 'Submit review'}</button></>}>
      <form id="review-form" onSubmit={save} className="stack">
        <div><div className="lbl" style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--navy-2)', marginBottom: 4 }}>Your rating</div><StarInput value={f.rating} onChange={n => setF({ ...f, rating: n })} /></div>
        <Field label="Your review" hint={`${f.body.trim().length}/600 · at least 20 characters. Tell others in your own words what it was like.`}><textarea className="input" maxLength={600} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
        <div className="grid2"><Field label="Name to show" hint="e.g. “Ahmed R.” — you choose how much to share"><input className="input" value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} maxLength={60} /></Field>
          <Field label="City (optional)"><input className="input" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} maxLength={60} /></Field></div>
        <label className="check"><input type="checkbox" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} /><span>I agree that Crystal Drinks may publicly show this review with the name and city above.</span></label>
        {err && <div className="errbox" role="alert">{err}</div>}
      </form>
    </Modal>
  );
}

/** Shown only to investors who have actually been paid out. */
export function ReviewPrompt() {
  const { data, reload } = useApi<any>('/api/testimonials/mine'); const [open, setOpen] = useState(false);
  if (!data || !data.eligible) return null;
  const r = data.review;
  return (
    <>
      <div className="card card-pad row between">
        {!r ? (<><div><b>How was your experience?</b><div className="muted small">You’ve received a payout — tell others what it was like. It takes a minute.</div></div><button className="btn btn-primary" onClick={() => setOpen(true)}>Write a review</button></>)
          : (<><div><div className="row" style={{ gap: 8 }}><b>Your review</b><Stars value={r.rating} size={16} /><StatusBadge status={r.status === 'APPROVED' ? 'ACTIVE' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING'} label={r.status === 'APPROVED' ? 'Published' : r.status === 'REJECTED' ? 'Not published' : 'Awaiting approval'} /></div>
            <div className="muted small" style={{ marginTop: 4 }}>“{r.body.length > 110 ? r.body.slice(0, 110) + '…' : r.body}”</div></div><button className="btn" onClick={() => setOpen(true)}>Edit</button></>)}
      </div>
      {open && <ReviewForm state={data} onClose={() => setOpen(false)} onSaved={reload} />}
    </>
  );
}
