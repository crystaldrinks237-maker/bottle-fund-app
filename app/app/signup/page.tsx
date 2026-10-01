'use client';
import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Field } from '@/components/ui/kit';
import { GoogleButton } from '@/components/layout/GoogleButton';
import { api } from '@/lib/client';

export default function Signup() {
  const [f, setF] = useState({ username: '', full_name: '', phone: '', password: '', guarantor_username: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api('/api/signup', { method: 'POST', json: { ...f, guarantor_username: f.guarantor_username || null } });
      const res = await signIn('credentials', { username: f.username, password: f.password, redirect: false });
      window.location.href = res?.error ? '/login' : '/';
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <AuthShell title="Create your investor account" subtitle="It takes a minute. You’ll choose a funding need after signing in.">
      <div className="stack" style={{ marginBottom: 6 }}><GoogleButton label="Sign up with Google" /></div>
      <form onSubmit={submit} className="stack" noValidate>
        <div className="grid2">
          <Field label="Username" hint="Letters, numbers, dot, dash, underscore"><input className="input" autoComplete="username" autoCapitalize="none" value={f.username} onChange={set('username')} required /></Field>
          <Field label="Full name"><input className="input" autoComplete="name" value={f.full_name} onChange={set('full_name')} /></Field>
        </div>
        <div className="grid2">
          <Field label="Phone" hint="For payout follow-up"><input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Guarantor username" hint="Only if someone referred you"><input className="input" autoCapitalize="none" value={f.guarantor_username} onChange={set('guarantor_username')} /></Field>
        </div>
        <Field label="Password" hint="At least 10 characters"><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={10} /></Field>
        {err && <div className="errbox" role="alert">{err}</div>}
        <button className="btn btn-primary" style={{ width: '100%', height: 44 }} disabled={busy || !f.username || f.password.length < 10}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="muted small">Already registered? <Link href="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
