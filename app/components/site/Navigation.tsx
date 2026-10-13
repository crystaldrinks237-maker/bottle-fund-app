'use client';
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MenuIcon, XIcon } from 'lucide-react';
import { Logo } from './Logo';
import { LiquidButton } from './LiquidButton';
import { navLinks } from './content';
import { useScrolled } from './useScrolled';
import { whatsappLink } from '@/lib/site';

export function Navigation() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ease-out ${
      scrolled || open ?
      'border-b border-white/10 bg-midnight/85 backdrop-blur-xl' :
      'border-b border-transparent bg-transparent'}`
      }>
      
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6 lg:px-10" aria-label="Main">
        <a href="#top" aria-label="Crystal Drinks — back to top" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice">
          <Logo />
        </a>

        <ul className="hidden items-center gap-10 lg:flex">
          {navLinks.map((link) =>
          <li key={link.href}>
              <a
              href={link.href}
              className="group relative whitespace-nowrap py-2 text-[13px] tracking-wide text-silver transition-colors duration-200 ease-out hover:text-white focus-visible:text-white focus-visible:outline-none">
              
                {link.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-ice transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100" />
              </a>
            </li>
          )}
        </ul>

        <div className="flex items-center gap-3">
          <LiquidButton href={whatsappLink('Hello Crystal Drinks, I would like to place an order.')} external variant="outline" className="!px-5 !py-2.5 !text-[11px]">
            Order now
          </LiquidButton>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center text-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}>
            
            {open ? <XIcon className="h-5 w-5" strokeWidth={1.5} /> : <MenuIcon className="h-5 w-5" strokeWidth={1.5} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open &&
        <motion.div
          id="mobile-menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="border-t border-white/10 lg:hidden">
          
            <ul className="mx-auto flex max-w-7xl flex-col px-6 py-4">
              {navLinks.map((link) =>
            <li key={link.href} className="border-b border-white/5 last:border-0">
                  <a href={link.href} onClick={() => setOpen(false)} className="block py-4 font-serif text-2xl text-white">
                    {link.label}
                  </a>
                </li>
            )}
            </ul>
          </motion.div>
        }
      </AnimatePresence>
    </header>);

}