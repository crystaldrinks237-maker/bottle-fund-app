'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Field } from '@/components/ui/kit';
import { GoogleButton, GOOGLE_ERRORS } from '@/components/layout/GoogleButton';

export default function Login() {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { const e = new URLSearchParams(window.location.search).get('error'); if (e) setErr(GOOGLE_ERRORS[e] || 'Sign-in failed. Please try again.'); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const res = await signIn('credentials', { username, password, redirect: false });
    if (res?.error) { setErr('Wrong username or password, or the account is temporarily locked after repeated failures.'); setBusy(false); return; }
    window.location.href = '/';
  }
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Crystal Drinks account.">
      <div className="stack" style={{ marginBottom: 6 }}><GoogleButton label="Continue with Google" /></div>
      <form onSubmit={submit} className="stack" noValidate>
        <Field label="Username"><input className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} required autoFocus /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></Field>
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%', height: 44 }} disabled={busy || !username || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">New investor? <Link href="/signup">Create an account</Link><br />Already have an account and want to use Google? Sign in here first, then connect Google under Profile.</p>
      </form>
    </AuthShell>
  );
}
