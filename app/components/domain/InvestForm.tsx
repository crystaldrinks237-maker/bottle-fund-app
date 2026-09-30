'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiFail, useApi } from '@/lib/client';
import { formatMoney, pct } from '@/lib/format';
import { ConfirmDialog } from '../ui/Modal';
import { ErrorState, Field, LoadingState, MoneyDisplay, ProgressBar } from '../ui/kit';
import { AccountBox, KV } from './bits';
import { useToast } from '../ui/Toast';

// Phone photos are often >4 MB; shrink client-side before upload (server still validates type and size).
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file); const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

export function InvestForm({ need }: { need: any }) {
  const router = useRouter(); const toast = useToast();
  const key = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const [amount, setAmount] = useState(''); const [debounced, setDebounced] = useState('');
  const [file, setFile] = useState<File | null>(null); const [fileErr, setFileErr] = useState(''); const [confirm, setConfirm] = useState(false); const [banner, setBanner] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(amount.trim()), 350); return () => clearTimeout(t); }, [amount]);
  const { data: q, error, loading, refetch } = useApi<any>(`/api/funding-needs/${need.id}/quote${debounced ? `?amount=${encodeURIComponent(debounced)}` : ''}`);
  const full = need.status === 'FULL';
  const valid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0;
  const ready = valid && amount.trim() === debounced && q && !q.amount_error && q.account && file && !full;

  function pick(f: File | undefined) {
    setFileErr(''); setFile(null); if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setFileErr('Please choose a JPG, PNG or WebP screenshot.');
    shrink(f).then(x => { if (x.size > 4 * 1024 * 1024) setFileErr('That image is too large (max 4 MB).'); else setFile(x); });
  }
  async function submit() {
    const fd = new FormData();
    fd.set('funding_need_id', String(need.id)); fd.set('amount', amount.trim()); fd.set('idempotency_key', key.current);
    fd.set('expected_account_id', String(q.account.account_id)); fd.set('proof', file!);
    try {
      const r = await api('/api/investments', { method: 'POST', body: fd });
      toast.success(r.duplicate ? 'This investment was already submitted.' : 'Investment submitted for verification.');
      router.push(`/investments/${r.investment.id}`);
    } catch (e: any) {
      if (e instanceof ApiFail && ['ACCOUNT_CHANGED', 'NO_ACCOUNT', 'NEED_FULL', 'OVER_REMAINING'].includes(e.code || '')) { setBanner(e.message); refetch(); setConfirm(false); return; }
      throw e;
    }
  }
  return (
    <div className="grid2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="card card-pad stack">
          <ProgressBar funded={need.funded_amount} total={need.total_capital} />
          <KV items={[['Product / quality', need.product], ['Quantity', `${Number(need.quantity).toLocaleString()} bottles`], ['Cost per bottle', <MoneyDisplay value={need.cost_price} key="c" />],
            ['Sell price per bottle', <MoneyDisplay value={need.sell_price} key="s" />], ['Your profit share', pct(need.investor_pct)],
            ['Return per bottle funded', <MoneyDisplay value={need.calc?.investor_return_per_bottle} key="r" />], ['Return on principal', pct(need.calc?.investor_return_pct)], ['Payout', 'Exactly 7 days (168 hours) after we verify your payment']]} />
          {need.description && <p className="muted">{need.description}</p>}
        </div>
      </div>
      <div className="stack">
        <div className="card card-pad stack">
          <h2>Invest in this need</h2>
          {full && <div className="notice">This funding need is fully funded. Check other funding needs.</div>}
          {banner && <div className="notice warn" role="alert">{banner}</div>}
          {loading && !q ? <LoadingState rows={3} /> : error ? <ErrorState message={error} onRetry={refetch} /> : q && (<>
            {q.account ? <div><div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>1 · Send your payment to this account</div><AccountBox a={q.account} /></div>
              : <div className="notice bad" role="alert">{q.unavailable_message || 'No payment account is currently available for this funding need. Please try again later.'}</div>}
            <Field label="2 · Amount you sent (PKR)" hint={`You can invest up to ${formatMoney(q.max_amount)} right now.`} error={valid && q.amount_error ? q.amount_error : undefined}>
              <div className="input-affix"><span className="pre">PKR</span><input className="input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" disabled={full || !q.account && !amount} /></div>
            </Field>
            {q.calc && valid && (
              <div className="notice good" aria-live="polite">
                <div className="row between"><span>Expected profit</span><b><MoneyDisplay value={q.calc.investor_profit} /></b></div>
                <div className="row between"><span>Expected total return</span><b><MoneyDisplay value={q.calc.total_return} /></b></div>
                <div className="small" style={{ marginTop: 6 }}>Calculated by our server at your profit share of {pct(q.calc.investor_profit_pct)}. Final once verified.</div>
              </div>)}
            <Field label="3 · Payment screenshot" hint="JPG, PNG or WebP, up to 4 MB." error={fileErr}>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e.target.files?.[0])} disabled={full} />
            </Field>
            <button className="btn btn-primary" style={{ height: 44 }} disabled={!ready} onClick={() => setConfirm(true)}>Review and submit</button>
          </>)}
        </div>
      </div>
      {confirm && q?.account && (
        <ConfirmDialog title="Confirm your investment" tone="primary" confirmLabel="Submit investment" onClose={() => setConfirm(false)}
          description={<>You are about to submit <b>{formatMoney(amount)}</b> for <b>{need.title}</b>, paid to <b>{q.account.account_name}</b> ({q.account.account_number}). Only submit after you have actually sent this payment. The 7-day countdown starts when we verify it.</>}
          onConfirm={submit} />
      )}
    </div>
  );
}
