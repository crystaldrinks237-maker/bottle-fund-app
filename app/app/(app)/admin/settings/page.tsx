'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ErrorState, Field, LoadingState, PageHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';
import { KV } from '@/components/domain/bits';

export default function Settings() {
  const { data, error, loading, refetch } = useApi<any>('/api/admin/settings'); const me = useApi<any>('/api/me'); const [pct, setPct] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  useEffect(() => { if (data) setPct(String(data.near_limit_pct)); }, [data]);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api('/api/admin/settings', { method: 'PUT', json: { near_limit_pct: Number(pct) } }); toast.success('Settings saved'); refetch(); } catch (x: any) { toast.error(x.message); } setBusy(false); }
  async function toggleInvestor(on: boolean) { try { await api('/api/me/roles', { method: 'POST', json: { investor: on } }); window.location.href = on ? '/dashboard' : '/admin/settings'; } catch (x: any) { toast.error(x.message); } }
  const investorOn = !!me.data?.roles?.includes('INVESTOR');
  return (
    <>
      <PageHeader title="Settings" subtitle="Operational thresholds. Changes are recorded in the activity log." />
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : data && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <form className="card card-pad stack" onSubmit={save}><h2>Operations</h2>
            <Field label="“Near limit” threshold (%)" hint="An account is flagged Near limit once this share of its total limit is used."><input className="input" inputMode="numeric" value={pct} onChange={e => setPct(e.target.value)} /></Field>
            <div className="field"><span className="lbl">Default guarantor</span>
              {data.default_guarantor_username ? <div className="notice good">Investors who join without a referral link get <b>@{data.default_guarantor_username}</b> as their guarantor, so that account earns their guarantor share. Set by the <span className="mono">DEFAULT_GUARANTOR_USERNAME</span> environment variable.</div>
                : data.default_guarantor_configured ? <div className="notice warn"><span className="mono">DEFAULT_GUARANTOR_USERNAME</span> is set, but no active account with that username exists. Check the spelling.</div>
                : <div className="notice warn">Not set. Investors who join without a referral link have no guarantor, so their guarantor share stays in business profit. To change that, add <span className="mono">DEFAULT_GUARANTOR_USERNAME</span> (your admin username) in Vercel → Settings → Environment Variables, then redeploy.</div>}</div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></form>
          <div className="card card-pad stack"><h2>My account</h2>
            <p className="muted">Use Crystal Drinks as an investor too, with your own investments, payouts and notifications, alongside the admin tools. You’ll see both menus in the sidebar.</p>
            {me.data && <div className="row between"><span>Investor side: <b>{investorOn ? 'On' : 'Off'}</b></span>
              <button className={`btn ${investorOn ? '' : 'btn-primary'}`} onClick={() => toggleInvestor(!investorOn)}>{investorOn ? 'Turn off' : 'Turn on investor side'}</button></div>}
            <p className="small muted">Investments you make are verified and paid like anyone else’s. If you verify or pay your own, the activity log flags it as a self-review.</p></div>
          <div className="card card-pad stack"><h2>System rules</h2><p className="muted small">Fixed by the platform (not editable here).</p>
            <KV items={[['Timezone (display)', data.timezone], ['Stored as', 'UTC (timestamptz)'], ['Payout cycle', `${data.payout_cycle_hours} hours (7 × 24h) from verification`], ['“Overdue” means', `${data.overdue_after_hours}h past the due time`], ['Signups', 'Investor accounts only (password or Google); admins and guarantors are created by an admin']]} /></div>
        </div>)}
    </>
  );
}
