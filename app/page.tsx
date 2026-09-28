'use client';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

function calc(w: any) {
  const dist = w.sell_price - w.cost_price - w.op_cost;
  const investorPerBottle = dist * (w.investor_pct / 100);
  const guarantorPerBottle = dist * (w.guarantor_pct / 100);
  const totalCapital = w.qty * w.cost_price;
  const investorReturnPerBottle = w.cost_price + investorPerBottle;
  return { dist, investorPerBottle, guarantorPerBottle, totalCapital, investorReturnPerBottle };
}
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

function statusOf(v: any) {
  if (v.returned) return { label: 'Paid', cls: 'paid' };
  if (v.verified) {
    const left = new Date(v.due_date).getTime() - Date.now();
    if (left <= 0) return { label: 'Overdue - payout due', cls: 'overdue' };
    const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
    return { label: `Verified - ${d}d ${h}h left`, cls: 'verified' };
  }
  return { label: 'Awaiting proof verification', cls: 'pending' };
}

function WeekCard({ week, myId }: { week: any; myId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [referrer, setReferrer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const c = calc(week);

  async function load() {
    const res = await fetch(`/api/weeks/${week.id}/investments`);
    setItems(await res.json());
  }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [week.id]);

  const sum = items.reduce((a, v) => a + Number(v.amount), 0);
  const remaining = Math.max(0, c.totalCapital - sum);
  const pct = Math.min(100, (sum / c.totalCapital) * 100 || 0);
  const quotaFull = remaining <= 0;

  function toDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => { img.onload = () => {
        const scale = Math.min(1, 500 / img.width);
        const cnv = document.createElement('canvas');
        cnv.width = img.width * scale; cnv.height = img.height * scale;
        cnv.getContext('2d')!.drawImage(img, 0, 0, cnv.width, cnv.height);
        resolve(cnv.toDataURL('image/jpeg', 0.6));
      }; img.onerror = reject; img.src = e.target!.result as string; };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function invest() {
    setErr('');
    const amt = Number(amount);
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return; }
    if (!file) { setErr('Attach a screenshot of your payment'); return; }
    const proof = await toDataUrl(file);
    const res = await fetch(`/api/weeks/${week.id}/investments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, referrer, proof }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    setAmount(''); setReferrer(''); setFile(null); load();
  }

  return (
    <div className="card">
      <h3>{week.quality} <span className="small">({week.status})</span></h3>
      <div className="small">{Number(week.qty).toLocaleString()} bottles - purchase {week.cost_price} PKR - sells {week.sell_price} PKR</div>
      <div className="small">You get back {fmt(c.investorReturnPerBottle)} PKR / bottle funded - {fmt(sum)} / {fmt(c.totalCapital)} PKR funded</div>
      <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, margin: '8px 0', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)' }} />
      </div>

      {items.map(v => {
        const st = statusOf(v);
        return (
          <div key={v.id} className="small" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
            {v.investor_username}{v.investor_id === myId ? ' (you)' : ''}{v.referrer_username ? ` - via ${v.referrer_username}` : ''}
            {' - '}{fmt(v.amount)} PKR <span className={`status ${st.cls}`}>{st.label}</span>
          </div>
        );
      })}

      {week.status === 'open' && !quotaFull && (
        <div>
          <label>Invest (max {fmt(remaining)} PKR)</label>
          <div className="row">
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount PKR" />
            <input value={referrer} onChange={e => setReferrer(e.target.value)} placeholder="Referred by (optional)" />
          </div>
          {amount && Number(amount) > 0 && Number(amount) <= remaining && (
            <div className="small" style={{ color: 'var(--accent)' }}>
              You'll get exactly {fmt((Number(amount) / week.cost_price) * c.investorReturnPerBottle)} PKR back once verified + 7 days.
            </div>
          )}
          <label>Payment screenshot</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button onClick={invest}>Commit & submit proof</button>
          {err && <div className="err">{err}</div>}
        </div>
      )}
      {quotaFull && week.status === 'open' && (
        <div className="err" style={{ marginTop: 10 }}>Quota reached for this week - please wait for next week's post.</div>
      )}
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [weeks, setWeeks] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/weeks').then(r => r.json()).then(setWeeks);
  }, []);

  if (status === 'loading') return null;
  if (!session) {
    return (
      <div className="wrap">
        <div className="card">
          <h2>Weekly Bottle Fund</h2>
          <p className="small">Please <a href="/login">log in</a> or <a href="/signup">sign up</a> to view and fund this week's needs.</p>
        </div>
      </div>
    );
  }

  const role = (session.user as any).role;
  const myId = (session.user as any).id;

  return (
    <div className="wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Weekly Bottle Fund</h2>
        <div className="small">
          {(session.user as any).username} {role === 'admin' && <a href="/admin"> - Admin panel</a>}
          {' - '}<a href="#" onClick={() => signOut()}>Log out</a>
        </div>
      </div>
      {weeks.length === 0 && <div className="small">No weeks posted yet.</div>}
      {weeks.map(w => <WeekCard key={w.id} week={w} myId={myId} />)}
    </div>
  );
}
