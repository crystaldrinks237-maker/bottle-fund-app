'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { ListView } from '@/components/ui/ListView';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Field, MoneyDisplay, PageHeader } from '@/components/ui/kit';
import { formatDate } from '@/lib/format';

function AddGuarantor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ username: '', full_name: '', phone: '', password: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); try { const r = await api('/api/guarantors', { method: 'POST', json: { ...f, password: f.password || undefined } }); toast.success(r.created ? 'Guarantor account created' : 'Guarantor role granted to existing user'); onSaved(); onClose(); } catch (x: any) { setErr(x.message); setBusy(false); } }
  return (
    <Modal title="Add guarantor" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="g-form" disabled={busy || !f.username}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <form id="g-form" onSubmit={save} className="stack">
        <div className="notice">Enter an existing username to grant them the guarantor role, or a new one with an initial password to create the account.</div>
        <Field label="Username"><input className="input" value={f.username} onChange={set('username')} autoCapitalize="none" required /></Field>
        <div className="grid2"><Field label="Full name"><input className="input" value={f.full_name} onChange={set('full_name')} /></Field><Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field></div>
        <Field label="Initial password (new accounts only)" hint="At least 10 characters. Share it securely; they can change it in their profile."><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        {err && <div className="errbox" role="alert">{err}</div>}
      </form>
    </Modal>
  );
}

export default function Guarantors() {
  const [add, setAdd] = useState(false); const [k, setK] = useState(0);
  return (
    <>
      <PageHeader title="Guarantors" subtitle="Referrers and their earnings." actions={<button className="btn btn-primary" onClick={() => setAdd(true)}>Add guarantor</button>} />
      <ListView key={k} endpoint="/api/guarantors" search="Search username or name" defaultSort="username" empty={{ title: 'No guarantors yet', action: <button className="btn btn-primary" onClick={() => setAdd(true)}>Add guarantor</button> }}
        columns={[
          { key: 'u', header: 'Guarantor', sort: 'username', render: r => <><b>{r.username}</b><div className="sub">{r.full_name || '—'} · {r.phone || 'no phone'}</div></> },
          { key: 'r', header: 'Referred investors', align: 'right', render: r => r.referred_investors },
          { key: 'a', header: 'Active investments', align: 'right', render: r => r.active_investments },
          { key: 'l', header: 'Lifetime earnings', sort: 'earnings', align: 'right', render: r => <MoneyDisplay value={r.lifetime} /> },
          { key: 'un', header: 'Unsettled', align: 'right', render: r => <MoneyDisplay value={r.unsettled} /> },
          { key: 'p', header: 'Paid', align: 'right', render: r => <MoneyDisplay value={r.paid} /> },
          { key: 'c', header: 'Since', sort: 'created', render: r => formatDate(r.created_at) },
        ]} />
      {add && <AddGuarantor onClose={() => setAdd(false)} onSaved={() => setK(k + 1)} />}
    </>
  );
}
