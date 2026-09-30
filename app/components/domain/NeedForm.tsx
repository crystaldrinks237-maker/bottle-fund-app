'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/client';
import { Modal } from '../ui/Modal';
import { Field, MoneyDisplay } from '../ui/kit';
import { useToast } from '../ui/Toast';
import { statusMeta } from '@/lib/status';

export function NeedForm({ need, accountIds, onClose, onSaved }: { need?: any; accountIds?: number[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const editing = !!need;
  const [f, setF] = useState({ title: need?.title || '', product: need?.product || '', description: need?.description || '', quantity: String(need?.quantity ?? ''), cost_price: need?.cost_price ?? '', sell_price: need?.sell_price ?? '', op_cost: need?.op_cost ?? '0', investor_pct: need?.investor_pct ?? '', guarantor_pct: need?.guarantor_pct ?? '' });
  const [sel, setSel] = useState<number[]>(accountIds || []); const [openNow, setOpenNow] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [prev, setPrev] = useState<any>(null); const [prevErr, setPrevErr] = useState('');
  const { data: accts } = useApi<any>('/api/payment-accounts');
  const locked = editing && need.investments_count > 0;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  // Money is never computed in the browser: the preview comes from the same server calculator used for saving.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!f.quantity || f.cost_price === '' || f.sell_price === '') { setPrev(null); setPrevErr(''); return; }
      try { setPrev((await api('/api/funding-needs/preview', { method: 'POST', json: f })).calc); setPrevErr(''); } catch (e: any) { setPrev(null); setPrevErr(e.message); }
    }, 400);
    return () => clearTimeout(t);
  }, [f.quantity, f.cost_price, f.sell_price, f.op_cost, f.investor_pct, f.guarantor_pct]); // eslint-disable-line

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { ...f, account_ids: sel, open_now: editing ? undefined : openNow };
      if (editing) await api(`/api/funding-needs/${need.id}`, { method: 'PATCH', json: body }); else await api('/api/funding-needs', { method: 'POST', json: body });
      toast.success(editing ? 'Funding need updated' : 'Funding need created'); onSaved(); onClose();
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  const toggle = (id: number) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const rows = accts?.rows || [];
  return (
    <Modal title={editing ? `Edit ${need.title}` : 'New funding need'} subtitle="Each funding need is independent — any number can be open at the same time." onClose={onClose} size="wide"
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" form="need-form" disabled={busy || !f.title || !f.product}>{busy ? 'Saving…' : editing ? 'Save changes' : openNow ? 'Create and open' : 'Create draft'}</button></>}>
      <form id="need-form" onSubmit={save} className="stack">
        {locked && <div className="notice warn">Investments already exist, so pricing and profit shares are locked to protect their agreed terms. Title, notes, quantity (not below what’s funded) and accounts can still change.</div>}
        <div className="grid2"><Field label="Title"><input className="input" value={f.title} onChange={set('title')} required maxLength={120} /></Field><Field label="Product / quality"><input className="input" value={f.product} onChange={set('product')} required maxLength={120} /></Field></div>
        <Field label="Description / notes"><textarea className="input" value={f.description} onChange={set('description')} maxLength={2000} /></Field>
        <div className="grid3">
          <Field label="Quantity (bottles)"><input className="input" inputMode="numeric" value={f.quantity} onChange={set('quantity')} required /></Field>
          <Field label="Cost price / bottle"><input className="input" inputMode="decimal" value={f.cost_price} onChange={set('cost_price')} disabled={locked} required /></Field>
          <Field label="Sell price / bottle"><input className="input" inputMode="decimal" value={f.sell_price} onChange={set('sell_price')} disabled={locked} required /></Field>
          <Field label="Operational cost / bottle"><input className="input" inputMode="decimal" value={f.op_cost} onChange={set('op_cost')} disabled={locked} /></Field>
          <Field label="Investor profit %"><input className="input" inputMode="decimal" value={f.investor_pct} onChange={set('investor_pct')} disabled={locked} required /></Field>
          <Field label="Guarantor profit %"><input className="input" inputMode="decimal" value={f.guarantor_pct} onChange={set('guarantor_pct')} disabled={locked} required /></Field>
        </div>
        {prevErr ? <div className="notice bad">{prevErr}</div> : prev && (
          <div className="notice"><div className="grid3" style={{ gap: 8 }}>
            <div>Capital required<br /><b><MoneyDisplay value={prev.total_capital} /></b></div><div>Profit / bottle<br /><b><MoneyDisplay value={prev.distributable_per_bottle} /></b></div><div>Business share<br /><b><MoneyDisplay value={prev.business_profit_pool} /></b></div>
            <div>Investor pool<br /><b><MoneyDisplay value={prev.investor_profit_pool} /></b></div><div>Guarantor pool<br /><b><MoneyDisplay value={prev.guarantor_profit_pool} /></b></div><div>Investor return / principal<br /><b>{prev.investor_return_pct}%</b></div>
          </div><div className="small" style={{ marginTop: 6 }}>Calculated by the server. Business profit is the remainder after investor and guarantor shares.</div></div>)}
        <div><div className="lbl" style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--navy-2)', marginBottom: 6 }}>Payment accounts investors can pay into (first = preferred)</div>
          {!rows.length ? <div className="notice warn">No payment accounts exist yet. Create one under Payment Accounts first.</div> : (
            <div className="stack-sm">{rows.map((a: any) => (
              <label className="check" key={a.id}><input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} />
                <span><b>{a.account_name}</b> <span className="muted">· {a.provider.toLowerCase()} · {a.account_number}</span> <span className={`badge ${statusMeta(a.availability)[1] === 'neutral' ? '' : statusMeta(a.availability)[1]}`}>{statusMeta(a.availability)[0]}</span>
                  {sel.includes(a.id) && sel.length > 1 && <span className="small muted"> · priority {sel.indexOf(a.id) + 1}</span>}</span></label>))}</div>)}
        </div>
        {!editing && <label className="check"><input type="checkbox" checked={openNow} onChange={e => setOpenNow(e.target.checked)} disabled={!sel.length} /><span>Open for investment immediately <span className="muted">(requires at least one account)</span></span></label>}
        {err && <div className="errbox" role="alert">{err}</div>}
      </form>
    </Modal>
  );
}
