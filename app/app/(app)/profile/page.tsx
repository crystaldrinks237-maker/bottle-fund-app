'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/client';
import { signIn } from 'next-auth/react';
import { GOOGLE_ERRORS } from '@/components/layout/GoogleButton';
import { ErrorState, Field, LoadingState, PageHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

export default function Profile() {
  const { data, error, loading, refetch } = useApi<any>('/api/me');
  const [f, setF] = useState<any>(null); const [pw, setPw] = useState({ current_password: '', new_password: '' }); const toast = useToast(); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ full_name: data.full_name || '', phone: data.phone || '', payout_method: data.payout_method || '', payout_account: data.payout_account || '' }); }, [data]);
  useEffect(() => { const e = new URLSearchParams(window.location.search).get('error'); if (e) toast.error(GOOGLE_ERRORS[e] || 'Something went wrong.'); }, []); // eslint-disable-line
  async function connectGoogle() { try { await api('/api/me/google-link', { method: 'POST' }); await signIn('google', { callbackUrl: '/profile' }); } catch (x: any) { toast.error(x.message); } }
  async function disconnectGoogle() { try { await api('/api/me/google-link', { method: 'DELETE' }); toast.success('Google disconnected'); refetch(); } catch (x: any) { toast.error(x.message); } }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api('/api/me', { method: 'PATCH', json: f }); toast.success('Profile saved'); refetch(); } catch (x: any) { toast.error(x.message); } setBusy(false); }
  async function changePw(e: React.FormEvent) { e.preventDefault(); try { await api('/api/me/password', { method: 'POST', json: pw }); toast.success('Password changed'); setPw({ current_password: '', new_password: '' }); } catch (x: any) { toast.error(x.message); } }
  return (
    <>
      <PageHeader title="Profile" subtitle="Where we reach you and where we send your money." />
      {loading && !f ? <div className="card"><LoadingState /></div> : error ? <div className="card"><ErrorState message={error} onRetry={refetch} /></div> : f && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <form className="card card-pad stack" onSubmit={save}>
            <h2>Your details</h2>
            <Field label="Username"><input className="input" value={data.username} disabled /></Field>
            <Field label="Full name"><input className="input" value={f.full_name} onChange={set('full_name')} /></Field>
            <Field label="Phone"><input className="input" type="tel" value={f.phone} onChange={set('phone')} /></Field>
            <div className="grid2"><Field label="Payout method" hint="e.g. Easypaisa, JazzCash, Bank"><input className="input" value={f.payout_method} onChange={set('payout_method')} /></Field>
              <Field label="Payout account / number"><input className="input" value={f.payout_account} onChange={set('payout_account')} /></Field></div>
            {data.guarantor_username && <Field label="Invited by" hint="Your guarantor — set automatically when you joined."><input className="input" value={data.guarantor_username} disabled /></Field>}
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
          <form className="card card-pad stack" onSubmit={changePw}>
            <h2>{data.has_password ? 'Change password' : 'Set a password'}</h2>
            {data.has_password && <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} /></Field>}
            <Field label="New password" hint="At least 10 characters"><input className="input" type="password" autoComplete="new-password" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <button className="btn" disabled={(data.has_password && !pw.current_password) || pw.new_password.length < 10}>{data.has_password ? 'Update password' : 'Set password'}</button>
            {data.google_enabled && (<div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }} className="stack-sm">
              <h2>Google sign-in</h2>
              {data.google_linked ? (<><p className="muted">Connected as <b>{data.email}</b>. You can sign in with Google or your password.</p>
                <button type="button" className="btn btn-danger" onClick={disconnectGoogle}>Disconnect Google</button></>) : (<><p className="muted">Connect your Google account to sign in without typing your password.</p>
                <button type="button" className="btn" onClick={connectGoogle}>Connect Google account</button></>)}
            </div>)}
          </form>
        </div>)}
    </>
  );
}
