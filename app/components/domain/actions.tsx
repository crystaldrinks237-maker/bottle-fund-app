'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { formatMoney, formatMonth } from '@/lib/format';

type Dlg = null | 'verify' | 'reject' | 'process' | 'pay' | 'review' | 'resolve' | 'rejectClaim' | 'note';

export function ProofButton({ proofId, label = 'View proof' }: { proofId: number | null; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!proofId) return <span className="faint">No proof</span>;
  return (<>
    <button className="btn btn-sm" onClick={() => setOpen(true)}>{label}</button>
    {open && <Modal title="Payment proof" onClose={() => setOpen(false)} size="wide"><img className="proof-thumb" style={{ margin: '0 auto' }} src={`/api/proofs/${proofId}`} alt="Payment proof screenshot" /></Modal>}
  </>);
}

export function InvestmentActions({ inv, onDone }: { inv: any; onDone: () => void }) {
  const [d, setD] = useState<Dlg>(null); const toast = useToast();
  if (inv.display_status !== 'PENDING_VERIFICATION') return null;
  return (<>
    <button className="btn btn-sm btn-success" onClick={() => setD('verify')}>Verify</button>
    <button className="btn btn-sm btn-danger" onClick={() => setD('reject')}>Reject</button>
    {d === 'verify' && <ConfirmDialog title="Verify this payment?" tone="success" confirmLabel="Verify payment" onClose={() => setD(null)}
      description={<>Confirm that <b>{formatMoney(inv.amount)}</b> from <b>{inv.investor_username}</b> reached <b>{inv.account_name || 'the assigned account'}</b>. The exact 7-day (168-hour) countdown starts the moment you confirm, using the server clock.</>}
      onConfirm={async () => { await api(`/api/investments/${inv.id}/verify`, { method: 'POST' }); toast.success('Payment verified — countdown started'); onDone(); }} />}
    {d === 'reject' && <ConfirmDialog title="Reject this payment?" tone="danger" confirmLabel="Reject payment" onClose={() => setD(null)}
      description="The investor will see your reason. No countdown starts and the reserved capacity is released."
      fields={[{ name: 'reason', label: 'Reason shown to the investor', type: 'textarea', required: true, minLength: 3, placeholder: 'e.g. Amount in the screenshot does not match' }]}
      onConfirm={async v => { await api(`/api/investments/${inv.id}/reject`, { method: 'POST', json: { reason: v.reason } }); toast.success('Investment rejected'); onDone(); }} />}
  </>);
}

export function PayoutActions({ p, onDone }: { p: any; onDone: () => void }) {
  const [d, setD] = useState<Dlg>(null); const toast = useToast();
  const s = p.display_status;
  if (s === 'SCHEDULED') return <span className="small muted">Not due yet</span>;
  if (!['DUE', 'PROCESSING'].includes(s)) return null;
  const cash = p.cash_amount ?? p.amount;
  const needsRoll = !!p.reinvest_requested && !(Number(p.reinvested_amount) > 0);
  return (<>
    {needsRoll && s === 'DUE' && <RolloverButton p={p} onDone={onDone} />}
    {!needsRoll && s === 'DUE' && <button className="btn btn-sm" onClick={() => setD('process')}>Mark processing</button>}
    {!needsRoll && <button className="btn btn-sm btn-success" onClick={() => setD('pay')}>Mark paid</button>}
    {d === 'process' && <ConfirmDialog title="Mark as processing?" confirmLabel="Mark processing" tone="primary" onClose={() => setD(null)} description="Flags that you have started sending this payout."
      onConfirm={async () => { await api(`/api/payouts/${p.id}`, { method: 'PATCH', json: { action: 'process' } }); toast.success('Marked as processing'); onDone(); }} />}
    {d === 'pay' && <ConfirmDialog title="Record payout as paid" tone="success" confirmLabel="Confirm payment sent" onClose={() => setD(null)}
      description={<>Send <b>{formatMoney(cash)}</b>{Number(p.reinvested_amount) > 0 && <> (profit only — {formatMoney(p.reinvested_amount)} was reinvested)</>} to <b>{p.investor_username}</b>{p.payout_account ? <> — {p.payout_method}: <b>{p.payout_account}</b></> : <> (no payout account on file — contact them)</>}. The investor will see the transaction ID.</>}
      fields={[{ name: 'transaction_id', label: 'Transaction ID', required: true, minLength: 3 }, { name: 'notes', label: 'Internal note (never shown to the investor)', type: 'textarea' }]}
      onConfirm={async v => { await api(`/api/payouts/${p.id}`, { method: 'PATCH', json: { action: 'pay', transaction_id: v.transaction_id, notes: v.notes || null } }); toast.success('Payout recorded as paid'); onDone(); }} />}
  </>);
}

export function GuarantorPaymentActions({ gp, onDone }: { gp: any; onDone: () => void }) {
  const [d, setD] = useState<Dlg>(null); const toast = useToast();
  if (!['PENDING', 'PROCESSING'].includes(gp.status)) return null;
  return (<>
    {gp.status === 'PENDING' && <button className="btn btn-sm" onClick={() => setD('process')}>Mark processing</button>}
    <button className="btn btn-sm btn-success" onClick={() => setD('pay')}>Mark paid</button>
    {d === 'process' && <ConfirmDialog title="Mark as processing?" confirmLabel="Mark processing" tone="primary" onClose={() => setD(null)}
      onConfirm={async () => { await api(`/api/guarantor-payments/${gp.id}`, { method: 'PATCH', json: { action: 'process' } }); toast.success('Marked as processing'); onDone(); }} />}
    {d === 'pay' && <ConfirmDialog title="Record guarantor payment as paid" tone="success" confirmLabel="Confirm payment sent" onClose={() => setD(null)}
      description={<>Pay <b>{formatMoney(gp.amount)}</b> to <b>{gp.guarantor_username}</b> for {formatMonth(gp.period_month)}{gp.payout_account ? <> — {gp.payout_method}: <b>{gp.payout_account}</b></> : ''}.</>}
      fields={[{ name: 'transaction_id', label: 'Transaction ID', required: true, minLength: 3 }, { name: 'notes', label: 'Internal note', type: 'textarea' }]}
      onConfirm={async v => { await api(`/api/guarantor-payments/${gp.id}`, { method: 'PATCH', json: { action: 'pay', transaction_id: v.transaction_id, notes: v.notes || null } }); toast.success('Payment recorded as paid'); onDone(); }} />}
  </>);
}

export function ClaimActions({ c, onDone }: { c: any; onDone: () => void }) {
  const [d, setD] = useState<Dlg>(null); const toast = useToast();
  const patch = (json: any) => api(`/api/payment-claims/${c.id}`, { method: 'PATCH', json });
  return (<>
    <button className="btn btn-sm" onClick={() => setD('note')}>Add note</button>
    {c.status === 'OPEN' && <button className="btn btn-sm" onClick={() => setD('review')}>Start review</button>}
    {['OPEN', 'UNDER_REVIEW'].includes(c.status) && <>
      <button className="btn btn-sm btn-success" onClick={() => setD('resolve')}>Resolve</button>
      <button className="btn btn-sm btn-danger" onClick={() => setD('rejectClaim')}>Reject</button></>}
    {d === 'note' && <ConfirmDialog title="Add internal note" confirmLabel="Save note" tone="primary" onClose={() => setD(null)} fields={[{ name: 'note', label: 'Note (internal only)', type: 'textarea', required: true }]}
      onConfirm={async v => { await patch({ action: 'note', note: v.note }); toast.success('Note added'); onDone(); }} />}
    {d === 'review' && <ConfirmDialog title="Start reviewing this claim?" confirmLabel="Start review" tone="primary" onClose={() => setD(null)} description="The claimant will be told their claim is being reviewed."
      onConfirm={async () => { await patch({ action: 'review' }); toast.success('Claim is under review'); onDone(); }} />}
    {d === 'resolve' && <ConfirmDialog title="Resolve claim" confirmLabel="Resolve claim" tone="success" onClose={() => setD(null)}
      description={<>Original payment: <b>{formatMoney(c.amount)}</b>, transaction <b>{c.transaction_id || '—'}</b>. Resolving marks the payment as resolved; it does not move money — record a replacement transaction if you paid again.</>}
      fields={[{ name: 'resolution_note', label: 'Resolution note (shown to the claimant)', type: 'textarea', required: true, minLength: 3 }, { name: 'replacement_transaction_id', label: 'Replacement transaction ID', hint: 'Only if a new payment was sent' }]}
      onConfirm={async v => { await patch({ action: 'resolve', resolution_note: v.resolution_note, replacement_transaction_id: v.replacement_transaction_id || null }); toast.success('Claim resolved'); onDone(); }} />}
    {d === 'rejectClaim' && <ConfirmDialog title="Reject claim" confirmLabel="Reject claim" tone="danger" onClose={() => setD(null)}
      description="The original payment stands and goes back to Paid. The claimant sees your explanation."
      fields={[{ name: 'resolution_note', label: 'Explanation (shown to the claimant)', type: 'textarea', required: true, minLength: 3 }]}
      onConfirm={async v => { await patch({ action: 'reject', resolution_note: v.resolution_note }); toast.success('Claim rejected'); onDone(); }} />}
  </>);
}

/** Investor/guarantor "I did not receive this payment" — creates a claim, never reverses anything. */
export function ReportNotReceived({ target, onDone }: { target: { guarantor_payment_id?: number; payout_id?: number }; onDone: () => void }) {
  const [open, setOpen] = useState(false); const toast = useToast();
  return (<>
    <button className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>I did not receive this payment</button>
    {open && <ConfirmDialog title="Report a payment you didn’t receive" confirmLabel="Submit claim" tone="danger" onClose={() => setOpen(false)}
      description="This does not cancel or reverse the payment. It asks an administrator to check the transaction with you."
      fields={[{ name: 'reason', label: 'What happened?', type: 'textarea', required: true, minLength: 3, placeholder: 'e.g. Nothing arrived in my Easypaisa account' }]}
      onConfirm={async v => { const r = await api('/api/payment-claims', { method: 'POST', json: { ...target, reason: v.reason } }); toast.success(r.duplicate ? 'You already have an open claim for this payment' : 'Your claim has been submitted.'); onDone(); }} />}
  </>);
}


/** Admin: the investor asked to reinvest, so pick the funding need that receives the principal. The profit is paid out afterwards. */
function RolloverButton({ p, onDone }: { p: any; onDone: () => void }) {
  const [open, setOpen] = useState(false); const toast = useToast();
  const [needs, setNeeds] = useState<any[] | null>(null); const [needId, setNeedId] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => {
    if (!open || needs) return;
    api('/api/funding-needs?status=OPEN&size=100').then(r => setNeeds(r.rows || [])).catch(e => setErr(e.message));
  }, [open, needs]);
  const fits = (n: any) => Number(n.remaining_amount) >= Number(p.principal);
  async function go() {
    setBusy(true); setErr('');
    try { await api(`/api/payouts/${p.id}/rollover`, { method: 'POST', json: { funding_need_id: Number(needId) } }); toast.success('Principal reinvested'); setOpen(false); onDone(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (<>
    <button className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>Roll over principal</button>
    {open && <Modal title="Reinvest principal" onClose={() => setOpen(false)}>
      <div className="stack-sm">
        <p><b>{p.investor_username}</b> asked to reinvest <b>{formatMoney(p.principal)}</b> for another week and receive only the profit of <b>{formatMoney(p.profit)}</b>. Choose the funding need that receives the principal. The money is already with the business, so no payment proof is needed. The new investment is verified now and its 7 days start now.</p>
        {err && <div className="notice bad">{err}</div>}
        {!needs && !err ? <p className="muted">Loading open funding needs…</p> : needs && needs.length === 0 ? <p className="muted">There is no open funding need. Open one first, then come back.</p> : (
          <select className="input" value={needId} onChange={e => setNeedId(e.target.value)} aria-label="Funding need">
            <option value="">Choose a funding need…</option>
            {(needs || []).map(n => <option key={n.id} value={n.id} disabled={!fits(n)}>{n.title} — {formatMoney(n.remaining_amount)} still needed{fits(n) ? '' : ' (too small)'}</option>)}
          </select>)}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={!needId || busy} onClick={go}>{busy ? 'Working…' : 'Reinvest principal'}</button>
        </div>
      </div>
    </Modal>}
  </>);
}

/** Investor: tick to leave the principal with the business for next week and receive only the profit. */
export function ReinvestToggle({ inv, onDone }: { inv: any; onDone: () => void }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const on = !!inv.reinvest_requested;
  async function set(v: boolean) {
    setBusy(true);
    try { await api(`/api/investments/${inv.id}/reinvest`, { method: 'POST', json: { reinvest: v } }); toast.success(v ? 'We will reinvest your principal' : 'Reinvesting turned off'); onDone(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="card"><div className="card-head"><h2>Reinvest for next week</h2></div><div className="card-pad stack-sm">
      <p>Leave your <b>{formatMoney(inv.amount)}</b> with Crystal Drinks for another week and receive only your profit of <b>{formatMoney(inv.expected_investor_profit)}</b> when this payout is due. Your principal goes into next week&apos;s funding and earns its own profit after its own 7 days.</p>
      {on && <div className="notice good">Reinvest is on. We will send only the profit and move your principal into next week&apos;s funding.</div>}
      <div><button className={`btn ${on ? '' : 'btn-primary'}`} disabled={busy} onClick={() => set(!on)}>{on ? 'Turn off — pay me everything' : 'Reinvest my principal'}</button></div>
      <p className="small muted">This applies to this week only. You can change your mind until your payout is processed.</p>
    </div></div>
  );
}
