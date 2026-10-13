'use client';
import React from 'react';
import { Logo } from './Logo';
import { contact, navLinks } from './content';
import { whatsappLink } from '@/lib/site';

export function Footer({ address }: { address: string }) {
  return (
    <footer className="w-full border-t border-white/10 bg-[#041121] text-silver">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-silver/80">
            Clean, refreshing drinking water for homes, shops and businesses — with clear prices and simple ordering.
          </p>
        </div>
        <nav aria-label="Footer" className="md:col-span-3">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-silver/60">Explore</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {navLinks.map((l) =>
            <li key={l.href}>
                <a href={l.href} className="transition-colors duration-200 hover:text-white">{l.label}</a>
              </li>
            )}
          </ul>
        </nav>
        <div className="md:col-span-4">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-silver/60">Contact</h2>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="transition-colors duration-200 hover:text-white">
                WhatsApp: {contact.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={contact.phoneHref} className="transition-colors duration-200 hover:text-white">Call: {contact.phoneDisplay}</a>
            </li>
            <li className="leading-relaxed text-silver/80">{address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-6 py-6 text-xs text-silver/60 sm:flex-row lg:px-10">
          <p>© 2026 Crystal Drinks</p>
          <p>Chakwal, Pakistan</p>
        </div>
      </div>
    </footer>);

}