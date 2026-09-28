'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit() {
    setErr('');
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, phone, password }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error); return; }
    await signIn('credentials', { username, password, redirect: false });
    router.push('/');
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2>Create your account</h2>
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} />
        <label>Phone (optional, for notifications later)</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={submit}>Sign up</button>
        {err && <div className="err">{err}</div>}
        <div className="small" style={{ marginTop: 10 }}>Already have an account? <a href="/login">Log in</a></div>
      </div>
    </div>
  );
}
