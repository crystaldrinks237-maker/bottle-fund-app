'use client';
import { useState } from 'react';
import { api, useApi, viewAsUser } from '@/lib/client';
import { ListView } from '@/components/ui/ListView';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Field, MoneyDisplay, PageHeader } from '@/components/ui/kit';
import { formatDate } from '@/lib/format';

function AssignGuarantor({ investor, onClose, onSaved }: { investor: any; onClose: () => void; onSaved: () => void }) {
  const { data } = useApi<any>('/api/guarantors?size=100'); const [g, setG] = useState(String(investor.guarantor_id || '')); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const toast = useToast();
  async function save() { setBusy(true); setErr(''); try { await api(`/api/admin/investors/${investor.id}/guarantor`, { method: 'PUT', json: { guarantor_id: g || null } }); toast.success('Guarantor updated'); onSaved(); onClose(); } catch (e: any) { setErr(e.message); setBusy(false); } }
  return (
    <Modal title={`Guarantor for ${investor.username}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="stack">
        <div className="notice">Applies to this investor’s <b>future</b> investments. Investments already submitted keep the guarantor they had, so earnings history stays intact.</div>
        <Field label="Guarantor"><select className="input" value={g} onChange={e => setG(e.target.value)}><option value="">No guarantor</option>{(data?.rows || []).map((x: any) => <option key={x.id} value={x.id} disabled={x.id === investor.id}>{x.username}{x.full_name ? ` — ${x.full_name}` : ''}</option>)}</select></Field>
        {err && <div className="errbox" role="alert">{err}</div>}
      </div>
    </Modal>
  );
}

export default function Investors() {
  const [sel, setSel] = useState<any>(null); const [k, setK] = useState(0); const toast = useToast();
  return (
    <>
      <PageHeader title="Investors" subtitle="Everyone who has registered to invest." />
      <ListView key={k} endpoint="/api/admin/investors" search="Search username, name or phone" defaultSort="-created" empty={{ title: 'No investors yet' }}
        columns={[
          { key: 'u', header: 'Investor', sort: 'username', render: r => <><b>{r.username}</b><div className="sub">{r.full_name || '—'} · {r.phone || 'no phone'}</div></> },
          { key: 'g', header: 'Guarantor', render: r => r.guarantor_username || <span className="muted">None</span> },
          { key: 'i', header: 'Investments', align: 'right', render: r => r.investments },
          { key: 'v', header: 'Verified invested', sort: 'invested', align: 'right', render: r => <MoneyDisplay value={r.invested} /> },
          { key: 'p', header: 'Payout account', render: r => (r.payout_account ? `${r.payout_method || ''} ${r.payout_account}` : <span className="muted">Not set</span>) },
          { key: 'c', header: 'Joined', sort: 'created', render: r => formatDate(r.created_at) },
          { key: 'a', header: '', actions: true, render: r => <div className="row"><button className="btn btn-sm" onClick={() => setSel(r)}>Set guarantor</button><button className="btn btn-sm" onClick={() => viewAsUser(r.id, 'investor').catch((e: any) => toast.error(e.message))}>View as</button></div> },
        ]} />
      {sel && <AssignGuarantor investor={sel} onClose={() => setSel(null)} onSaved={() => setK(k + 1)} />}
    </>
  );
}
