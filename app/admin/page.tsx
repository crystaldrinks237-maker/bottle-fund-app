'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

function PostWeekForm({ onPosted }: { onPosted: () => void }) {
  const [f, setF] = useState({ quality: '', qty: '', sell_price: '', cost_price: '', op_cost: '', investor_pct: '', guarantor_pct: '' });
  const [err, setErr] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setErr('');
    const res = await fetch('/api/weeks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quality: f.quality, qty: Number(f.qty), sell_price: Number(f.sell_price),
        cost_price: Number(f.cost_price), op_cost: Number(f.op_cost),
        investor_pct: Number(f.investor_pct), guarantor_pct: Number(f.guarantor_pct),
      }),
    });
    if (!res.ok) { setErr((await res.json()).error); return; }
    setF({ quality: '', qty: '', sell_price: '', cost_price: '', op_cost: '', investor_pct: '', guarantor_pct: '' });
    onPosted();
  }

  return (
    <div className="card">
      <h3>Post this week's need</h3>
      <div className="row">
        <div><label>Quality / grade</label><input value={f.quality} onChange={set('quality')} /></div>
        <div><label>Bottles needed</label><input type="number" value={f.qty} onChange={set('qty')} /></div>
      </div>
      <div className="row">
        <div><label>Purchase cost / bottle (PKR)</label><input type="number" value={f.cost_price} onChange={set('cost_price')} /></div>
        <div><label>Sell price / bottle (PKR)</label><input type="number" value={f.sell_price} onChange={set('sell_price')} /></div>
      </div>
      <div className="row">
        <div><label>Production + delivery cost / bottle (PKR)</label><input type="number" value={f.op_cost} onChange={set('op_cost')} /></div>
        <div></div>
      </div>
      <div className="row">
        <div><label>Investor share of profit (%)</label><input type="number" value={f.investor_pct} onChange={set('investor_pct')} /></div>
        <div><label>Guarantor share of profit (%)</label><input type="number" value={f.guarantor_pct} onChange={set('guarantor_pct')} /></div>
      </div>
      <button onClick={submit}>Post week</button>
      {err && <div className="err">{err}</div>}
    </div>
  );
}

function VerifyQueue({ weeks }: { weeks: any[] }) {
  const [rows, setRows] = useState<Record<number, any[]>>({});

  async function loadAll() {
    const out: Record<number, any[]> = {};
    for (const w of weeks) {
      const res = await fetch(`/api/weeks/${w.id}/investments`);
      out[w.id] = await res.json();
    }
    setRows(out);
  }
  useEffect(() => { if (weeks.length) loadAll(); }, [weeks]);

  async function verify(id: number) { await fetch(`/api/investments/${id}/verify`, { method: 'POST' }); loadAll(); }
  async function markPaid(id: number) { await fetch(`/api/investments/${id}/paid`, { method: 'POST' }); loadAll(); }

  const pending = weeks.flatMap(w => (rows[w.id] || []).filter(v => !v.verified).map(v => ({ ...v, quality: w.quality })));
  const dueToday = weeks.flatMap(w => (rows[w.id] || []).filter(v => v.verified && !v.returned && new Date(v.due_date) <= new Date()).map(v => ({ ...v, quality: w.quality })));

  return (
    <>
      <div className="card">
        <h3>Awaiting payment verification ({pending.length})</h3>
        {pending.length === 0 && <div className="small">Nothing pending.</div>}
        {pending.map(v => (
          <div key={v.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <div className="small">{v.quality} - {v.investor_username} - {fmt(v.amount)} PKR {v.referrer_username ? `- via ${v.referrer_username}` : ''}</div>
            {v.proof_data && <img src={v.proof_data} style={{ maxWidth: 160, borderRadius: 6, marginTop: 6 }} />}
            <div><button onClick={() => verify(v.id)}>Verify payment received</button></div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Owed today / overdue ({dueToday.length})</h3>
        {dueToday.length === 0 && <div className="small">Nothing due right now.</div>}
        {dueToday.map(v => (
          <div key={v.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <div className="small">{v.quality} - {v.investor_username} - owed {fmt((v.amount / 1) )} PKR principal (see week for exact return)</div>
            <div><button onClick={() => markPaid(v.id)}>Mark paid out</button></div>
          </div>
        ))}
      </div>
    </>
  );
}

function GuarantorSummary() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => { fetch('/api/admin/guarantor-summary').then(r => r.json()).then(setData); }, []);
  return (
    <div className="card">
      <h3>Guarantor earnings this month</h3>
      {data.length === 0 && <div className="small">No verified, referred investments yet this month.</div>}
      {data.map((r, i) => (
        <div key={i} className="small" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
          {r.referrer_username}: {fmt(Number(r.total_owed))} PKR ({fmt(Number(r.bottles_funded))} bottles)
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { data: session, status } = useSession();
  const [weeks, setWeeks] = useState<any[]>([]);

  useEffect(() => { fetch('/api/weeks').then(r => r.json()).then(setWeeks); }, []);

  if (status === 'loading') return null;
  if (!session || (session.user as any).role !== 'admin') {
    return <div className="wrap"><div className="card">Admins only.</div></div>;
  }

  return (
    <div className="wrap">
      <h2>Admin panel</h2>
      <PostWeekForm onPosted={() => fetch('/api/weeks').then(r => r.json()).then(setWeeks)} />
      <VerifyQueue weeks={weeks} />
      <GuarantorSummary />
    </div>
  );
}
