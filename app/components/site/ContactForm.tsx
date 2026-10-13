'use client';
import { useState } from 'react';
import { api } from '@/lib/client';

export function ContactForm() {
  const [f, setF] = useState({ name: '', phone: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle'); const [err, setErr] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF(s => ({ ...s, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState('busy'); setErr('');
    try { await api('/api/public/contact', { method: 'POST', json: f }); setState('done'); }
    catch (x: any) { setErr(x.message); setState('idle'); }
  }
  if (state === 'done') return <div className="site-card site-thanks"><h3>Thank you!</h3><p>We have received your message and will contact you shortly.</p></div>;
  return (
    <form className="site-card site-form" onSubmit={submit}>
      <h3>Send us a message</h3>
      <label>Your name<input className="input" value={f.name} onChange={set('name')} required maxLength={80} autoComplete="name" /></label>
      <label>Phone / WhatsApp number<input className="input" value={f.phone} onChange={set('phone')} required maxLength={30} inputMode="tel" autoComplete="tel" /></label>
      <label>What do you need?<textarea className="input" rows={4} value={f.message} onChange={set('message')} required maxLength={1500} placeholder="e.g. 20 packs of 500 ml bottles, delivery to…" /></label>
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }} />
      {err && <p className="site-err" role="alert">{err}</p>}
      <button className="btn btn-primary site-btn" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
