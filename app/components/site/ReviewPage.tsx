import React from 'react';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import './site.css';
import { Logo } from './Logo';
import { ReviewForm } from './ReviewForm';

export function ReviewPage() {
  return (
    <div className="mp flex min-h-screen w-full flex-col bg-midnight font-sans">
      <header className="border-b border-midnight/5 bg-white">
        <div className="mx-auto flex h-[76px] max-w-3xl items-center px-6">
          <a href="/" aria-label="Crystal Drinks home"><Logo /></a>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-14 md:py-20">
        <p className="text-[11px] font-medium uppercase tracking-label text-silver">Your feedback</p>
        <h1 className="mt-5 font-serif text-[clamp(2.5rem,7vw,4.25rem)] uppercase leading-[0.95] text-white">
          How did we <span className="italic text-ice">do?</span>
        </h1>
        <p className="mt-6 max-w-md text-[17px] font-light leading-relaxed text-silver">Thank you for choosing Crystal Drinks. It takes less than a minute — and it helps other businesses trust us.</p>
        <div className="mt-10"><ReviewForm /></div>
      </main>
      <footer className="border-t border-white/10 py-6 text-center text-xs text-silver/60">© {new Date().getFullYear()} Crystal Drinks</footer>
    </div>);
}
