'use client';
import React, { FormEvent, useState } from 'react';
import { StarIcon, CheckCircle2Icon } from 'lucide-react';
import { LiquidButton } from './LiquidButton';
import { api } from '@/lib/client';

export function ReviewForm() {
  const [business, setBusiness] = useState(''); const [rating, setRating] = useState(0); const [hover, setHover] = useState(0);
  const [body, setBody] = useState(''); const [consent, setConsent] = useState(false); const [trap, setTrap] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (business.trim().length < 2) return setErr('Please enter your business name.');
    if (!rating) return setErr('Please choose a star rating.');
    if (body.trim().length < 10) return setErr('Please write at least a short sentence.');
    if (!consent) return setErr('Please tick the box to allow us to show your review.');
    setBusy(true);
    try { await api('/api/public/review', { method: 'POST', json: { business_name: business, rating, body, consent, website: trap } }); setDone(true); }
    catch (x: any) { setErr(x?.message || 'Something went wrong. Please try again.'); }
    setBusy(false);
  }

  if (done) return (
    <div className="border border-white/10 bg-white/[0.03] p-8 text-center md:p-12">
      <CheckCircle2Icon className="mx-auto h-10 w-10 text-ice" strokeWidth={1.25} />
      <h2 className="mt-5 font-serif text-4xl text-white">Thank you!</h2>
      <p className="mx-auto mt-3 max-w-sm text-silver">We appreciate your feedback. Your review will appear on our website once it has been checked.</p>
    </div>);

  const shown = hover || rating;
  const input = 'mt-3 block w-full border-0 border-b border-white/20 bg-transparent px-0 pb-3 pt-1 text-base text-white placeholder:text-silver/40 transition-colors duration-200 hover:border-white/40 focus:border-ice focus:outline-none focus:ring-0';
  const label = 'text-[11px] font-medium uppercase tracking-[0.2em] text-silver';
  return (
    <form onSubmit={submit} noValidate className="relative border border-white/10 bg-white/[0.03] p-6 md:p-10">
      <div>
        <label htmlFor="biz" className={label}>Your business name</label>
        <input id="biz" className={input} value={business} maxLength={80} onChange={(e) => setBusiness(e.target.value)} autoComplete="organization" placeholder="e.g. Al-Madina General Store" />
      </div>
      <div className="mt-8">
        <span className={label} id="rating-label">How was your experience?</span>
        <div className="mt-3 flex gap-1" role="radiogroup" aria-labelledby="rating-label" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
              className="p-1 transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ice">
              <StarIcon className={`h-9 w-9 ${n <= shown ? 'fill-champagne text-champagne' : 'text-white/25'}`} strokeWidth={1.25} />
            </button>))}
        </div>
      </div>
      <div className="mt-8">
        <label htmlFor="body" className={label}>Your review</label>
        <textarea id="body" rows={4} className={`${input} resize-none`} value={body} maxLength={600} onChange={(e) => setBody(e.target.value)} placeholder="Tell us about the water, the service and the delivery…" />
        <p className="mt-2 text-right text-xs text-silver/50">{body.length}/600</p>
      </div>
      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-silver">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#C9E8F5]" />
        <span>I agree that my review and business name may be shown on the Crystal Drinks website.</span>
      </label>
      <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {err && <p role="alert" className="mt-6 text-sm text-danger">{err}</p>}
      <div className="mt-8"><LiquidButton type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit review'}</LiquidButton></div>
    </form>);
}
