'use client';
import { useState } from 'react';
import { useApi } from '@/lib/client';

/** Everyone's personal link. Anyone who signs up through it automatically has this person as their guarantor. */
export function ReferralCard() {
  const { data } = useApi<any>('/api/me'); const [copied, setCopied] = useState(false);
  if (!data?.referral_code) return null;
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${data.referral_code}`;
  const text = `Join Crystal Drinks — fund bottle production and get paid in exactly 7 days: ${link}`;
  return (
    <div className="card card-pad stack-sm" id="referral">
      <div className="row between"><div><b>Your referral link</b><div className="muted small">Share it. Everyone who signs up through it becomes your referral, and you earn the guarantor share of the profit on their verified investments — without adding your own money.</div></div></div>
      <div className="row" style={{ gap: 8 }}>
        <input className="input mono" style={{ flex: 1, minWidth: 220 }} readOnly value={link} aria-label="Your referral link" onFocus={e => e.currentTarget.select()} />
        <button className="btn btn-primary" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>Share on WhatsApp</a>
      </div>
      <div className="small muted">Your code: <b className="mono">{data.referral_code}</b></div>
    </div>
  );
}
