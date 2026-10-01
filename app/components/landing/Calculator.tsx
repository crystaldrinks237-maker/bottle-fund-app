'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/format';

const CHIPS = ['10000', '50000', '100000', '250000'];

/** All numbers come from /api/public/calculator (server-side lib/calc.ts) — this component never does money maths. */
export function Calculator({ initial }: { initial: any }) {
  const [needId, setNeedId] = useState<number | null>(initial.need?.id ?? null);
  const [amount, setAmount] = useState('50000'); const [referred, setReferred] = useState('');
  const [d, setD] = useState<any>(initial); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initial.need) return;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const qs = new URLSearchParams({ need_id: String(needId ?? ''), amount: amount.trim(), referred: referred.trim() });
        const r = await fetch(`/api/public/calculator?${qs}`); const j = await r.json();
        if (!r.ok) { setErr(j.error || 'Could not calculate'); } else { setD(j); setErr(''); }
      } catch { setErr('Connection problem — please try again.'); }
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [needId, amount, referred, initial.need]);

  if (!initial.need) return (
    <div className="calc card" id="calculator"><div className="calc-body"><h2>Profit calculator</h2>
      <p className="muted" style={{ marginTop: 8 }}>No funding needs are open right now, so there’s nothing to calculate yet. New opportunities appear here the moment they open.</p>
      <Link className="btn btn-primary" style={{ marginTop: 16 }} href="/signup">Create an account to be notified</Link></div></div>
  );
  const n = d.need, inv = d.invest, ref = d.referral;
  return (
    <div className="calc card" id="calculator" aria-busy={busy}>
      <div className="calc-body">
        <h2>See what you’d earn</h2>
        <label className="field" style={{ marginTop: 14 }}><span className="lbl">Funding need</span>
          <select className="input" value={needId ?? ''} onChange={e => setNeedId(Number(e.target.value))}>{d.needs.map((x: any) => <option key={x.id} value={x.id}>{x.title} — {x.product}{x.status === 'FULL' ? ' (fully funded)' : ''}</option>)}</select></label>
        <div className="calc-facts">
          <span><b>{Number(n.investor_pct)}%</b> investor profit share</span><span><b>{formatMoney(n.remaining_amount)}</b> still needed</span>
          {Number(n.min_investment) > 0 && <span>Minimum <b>{formatMoney(n.min_investment)}</b></span>}
        </div>

        <label className="field" style={{ marginTop: 16 }}><span className="lbl">If you invest (PKR)</span>
          <div className="input-affix"><span className="pre">PKR</span><input className="input calc-input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter any amount" /></div></label>
        <div className="chips" role="group" aria-label="Quick amounts">{CHIPS.map(c => <button key={c} type="button" className={`chip ${amount === c ? 'on' : ''}`} onClick={() => setAmount(c)}>{formatMoney(c, { symbol: false })}</button>)}</div>

        {err ? <div className="errbox" role="alert" style={{ marginTop: 14 }}>{err}</div> : inv ? (
          <div className="calc-result" aria-live="polite">
            <div className="small muted">After exactly 7 days you receive</div>
            <div className="calc-big">{formatMoney(inv.total_return)}</div>
            <dl className="calc-rows"><div><dt>You invest</dt><dd>{formatMoney(inv.principal)}</dd></div><div><dt>Your profit</dt><dd className="pos">+ {formatMoney(inv.profit)}</dd></div><div><dt>Return on your money</dt><dd>{Number(inv.return_pct)}%</dd></div></dl>
          </div>
        ) : <p className="muted small" style={{ marginTop: 14 }}>Enter an amount to see your return.</p>}

        <div className="calc-guar">
          <h3>Want more — without adding your own money?</h3>
          {Number(n.guarantor_pct) > 0 ? (<>
            <p className="small muted">As a guarantor you earn <b>{Number(n.guarantor_pct)}%</b> of the profit on everything the people you refer invest.</p>
            <label className="field" style={{ marginTop: 10 }}><span className="lbl">Total invested by people you refer (PKR)</span>
              <div className="input-affix"><span className="pre">PKR</span><input className="input" inputMode="decimal" value={referred} onChange={e => setReferred(e.target.value)} placeholder="e.g. 500,000" /></div></label>
            {ref && (<div className="calc-result alt" aria-live="polite">
              <div className="small muted">You’d earn as their guarantor</div><div className="calc-big sm">{formatMoney(ref.guarantor_earnings)}</div>
              {d.combined && inv && <div className="small" style={{ marginTop: 6 }}>Together with your own profit: <b>{formatMoney(d.combined.total_profit)}</b></div>}
            </div>)}
          </>) : <p className="small muted">This funding need doesn’t include a guarantor share. Pick another need above to see guarantor earnings.</p>}
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn btn-primary" style={{ height: 44 }} href="/signup">Start investing</Link>
          <Link className="btn" style={{ height: 44 }} href="/login">Sign in</Link>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>Figures use the terms of the funding need you select. Your payout is due 7 days (168 hours) after we verify your payment; guarantor earnings are paid once a month. This is a calculation, not a promise — only commit what you’re comfortable having tied up for the cycle.</p>
      </div>
    </div>
  );
}
