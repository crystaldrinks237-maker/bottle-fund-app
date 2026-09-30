'use client';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Field } from '@/components/ui/kit';

export default function Login() {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    const res = await signIn('credentials', { username, password, redirect: false });
    if (res?.error) { setErr('Wrong username or password, or the account is temporarily locked after repeated failures.'); setBusy(false); return; }
    window.location.href = '/';
  }
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Crystal Drinks account.">
      <form onSubmit={submit} className="stack" noValidate>
        <Field label="Username"><input className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} required autoFocus /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></Field>
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%', height: 44 }} disabled={busy || !username || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">New investor? <Link href="/signup">Create an account</Link></p>
      </form>
    </AuthShell>
  );
}
