'use client';
import React from 'react';

type LogoProps = {
  tone?: 'light' | 'dark';
};

/*
 * Brand mark placeholder. Swap the SVG for the official Crystal Drinks
 * logo file (e.g. <img src="…/crystal-drinks-logo.svg" />) when available.
 */
export function Logo({ tone = 'light' }: LogoProps) {
  const color = tone === 'light' ? 'text-white' : 'text-midnight';
  return (
    <span className={`inline-flex items-center gap-3 ${color}`}>
      <svg width="22" height="28" viewBox="0 0 22 28" fill="none" aria-hidden="true">
        <path
          d="M11 1.5C11 1.5 2 11.6 2 18a9 9 0 0 0 18 0C20 11.6 11 1.5 11 1.5Z"
          stroke="currentColor"
          strokeWidth="1.2" />
        
        <path d="M6 19.5c1.6-1.2 3.4-1.2 5 0s3.4 1.2 5 0" stroke="#C9E8F5" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[22px] font-medium tracking-wide">Crystal</span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.42em] opacity-70">Drinks</span>
      </span>
    </span>);

}