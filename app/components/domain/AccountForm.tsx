'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/kit';
import { useToast } from '../ui/Toast';

export function AccountForm({ account, onClose, onSaved }: { account?: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const editing = !!account;
  const [f, setF] = useState({ account_name: account?.account_name || '', provider: account?.provider || 'BANK', bank_name: account?.bank_name || '', account_holder_name: account?.account_holder_name || '',
    account_number: account?.account_number || '', iban: account?.iban || '', instructions: account?.instructions || '', daily_limit: account?.daily_limit ?? '', total_limit: account?.total_limit ?? '', notes: account?.notes || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const bank = f.provider === 'BANK';
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { ...f, bank_name: bank ? f.bank_name : null, iban: bank ? f.iban || null : null, daily_limit: f.daily_limit === '' ? null : f.daily_limit, total_limit: f.total_limit === '' ? null : f.total_limit };
      if (editing) await api(`/api/payment-accounts/${account.id}`, { method: 'PATCH', json: body }); else await api('/api/payment-accounts', { method: 'POST', json: body });
      toast.success(editing ? 'Account updated' : 'Account created'); onSaved(); onClose();
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <Modal title={editing ? 'Edit payment account' : 'Add payment account'} onClose={onClose} size="wide"
      subtitle={editing ? 'Edits apply to new investments only. Existing investments keep the details they were shown.' : undefined}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" form="acct-form" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button></>}>
      <form id="acct-form" onSubmit={save} className="stack">
        <div className="grid2">
          <Field label="Provider"><select className="input" value={f.provider} onChange={set('provider')}><option value="BANK">Bank account</option><option value="EASYPAISA">Easypaisa</option><option value="JAZZCASH">JazzCash</option><option value="OTHER">Other channel</option></select></Field>
          <Field label="Internal name" hint="How you’ll recognise it, e.g. “HBL main”"><input className="input" value={f.account_name} onChange={set('account_name')} required /></Field>
        </div>
        {bank && <Field label="Bank name"><input className="input" value={f.bank_name} onChange={set('bank_name')} required /></Field>}
        <div className="grid2">
          <Field label="Account holder name"><input className="input" value={f.account_holder_name} onChange={set('account_holder_name')} required /></Field>
          <Field label={bank ? 'Account number' : 'Mobile / wallet number'}><input className="input" value={f.account_number} onChange={set('account_number')} required /></Field>
        </div>
        {bank && <Field label="IBAN" hint="Optional"><input className="input" value={f.iban} onChange={set('iban')} /></Field>}
        <Field label="Instructions shown to investors" hint="e.g. “Add your username in the transfer note”"><textarea className="input" value={f.instructions} onChange={set('instructions')} maxLength={1000} /></Field>
        <div className="grid2">
          <Field label="Total receiving limit (PKR)" hint="Leave empty for no limit. Account stops being offered when reached."><input className="input" inputMode="decimal" value={f.total_limit} onChange={set('total_limit')} /></Field>
          <Field label="Daily limit (PKR)" hint="Leave empty for no daily cap."><input className="input" inputMode="decimal" value={f.daily_limit} onChange={set('daily_limit')} /></Field>
        </div>
        <Field label="Internal notes"><textarea className="input" value={f.notes} onChange={set('notes')} /></Field>
        {err && <div className="errbox" role="alert">{err}</div>}
      </form>
    </Modal>
  );
}
