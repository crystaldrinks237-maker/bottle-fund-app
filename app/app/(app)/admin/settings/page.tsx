'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/client';
import { ErrorState, Field, LoadingState, PageHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';
import { KV } from '@/components/domain/bits';

export default function Settings() {
  const { data, error, loading, refetch } = useApi<any>('/api/admin/settings'); const [pct, setPct] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  useEffect(() => { if (data) setPct(String(data.near_limit_pct)); }, [data]);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api('/api/admin/settings', { method: 'PUT', json: { near_limit_pct: Number(pct) } }); toast.success('Settings saved'); refetch(); } catch (x: any) { toast.error(x.message); } setBusy(false); }
  return (
    <>
      <PageHeader title="Settings" subtitle="Operational thresholds. Changes are recorded in the activity log." />
      {loading && !data ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : data && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <form className="card card-pad stack" onSubmit={save}><h2>Payment accounts</h2>
            <Field label="“Near limit” threshold (%)" hint="An account is flagged Near limit once this share of its total limit is used."><input className="input" inputMode="numeric" value={pct} onChange={e => setPct(e.target.value)} /></Field>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></form>
          <div className="card card-pad stack"><h2>System rules</h2><p className="muted small">Fixed by the platform (not editable here).</p>
            <KV items={[['Timezone (display)', data.timezone], ['Stored as', 'UTC (timestamptz)'], ['Payout cycle', `${data.payout_cycle_hours} hours (7 × 24h) from verification`], ['“Overdue” means', `${data.overdue_after_hours}h past the due time`], ['Signups', 'Investor accounts only; admins and guarantors are created by an admin']]} /></div>
        </div>)}
    </>
  );
}
