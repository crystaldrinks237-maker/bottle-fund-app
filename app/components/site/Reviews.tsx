'use client';
import React from 'react';
import { StarIcon } from 'lucide-react';
import { Reveal } from './Reveal';
import { LiquidButton } from './LiquidButton';

export type PublicReview = { id: number; business_name: string; rating: number; body: string };

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} className={`h-4 w-4 ${i <= value ? 'fill-champagne text-champagne' : 'text-white/20'}`} strokeWidth={1.25} />)}
    </span>);
}

export function Reviews({ reviews, count, average }: { reviews: PublicReview[]; count: number; average: number }) {
  if (!reviews.length) return null;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="w-full bg-ocean text-white">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-36">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal><p className="text-[11px] font-medium uppercase tracking-label text-silver">Trusted by local businesses</p></Reveal>
            <Reveal delay={0.06}>
              <h2 id="reviews-title" className="mt-6 font-serif text-[clamp(2.5rem,5vw,4.5rem)] uppercase leading-[0.95]">
                In their words.
                <span className="block italic text-ice">Our customers.</span>
              </h2>
            </Reveal>
          </div>
          {count >= 3 && (
            <Reveal delay={0.1}>
              <div className="flex items-center gap-4">
                <span className="font-serif text-6xl leading-none">{average.toFixed(1)}</span>
                <div><Stars value={Math.round(average)} /><p className="mt-1 text-sm text-silver">from {count} reviews</p></div>
              </div>
            </Reveal>)}
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <li key={r.id}>
              <Reveal delay={0.05 * (i % 3)} className="flex h-full flex-col border border-white/10 bg-white/[0.04] p-8">
                <Stars value={r.rating} />
                <blockquote className="mt-5 flex-1 font-serif text-[22px] italic leading-snug text-white/90">“{r.body}”</blockquote>
                <p className="mt-6 border-t border-white/10 pt-4 text-[12px] font-medium uppercase tracking-[0.2em] text-silver">{r.business_name}</p>
              </Reveal>
            </li>))}
        </ul>
        <p className="mt-6 text-xs text-silver/60">Reviews are written by Crystal Drinks customers and shown with their permission.</p>
        <Reveal className="mt-8"><LiquidButton href="/review" variant="outline">Leave a review</LiquidButton></Reveal>
      </div>
    </section>);
}
