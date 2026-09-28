'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit() {
    setErr('');
    const res = await signIn('credentials', { username, password, redirect: false });
    if (res?.error) { setErr('Wrong username or password'); return; }
    router.push('/');
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2>Log in</h2>
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={submit}>Log in</button>
        {err && <div className="err">{err}</div>}
        <div className="small" style={{ marginTop: 10 }}>No account? <a href="/signup">Sign up</a></div>
      </div>
    </div>
  );
}
