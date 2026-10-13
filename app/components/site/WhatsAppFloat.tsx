'use client';
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WhatsAppIcon } from './WhatsAppIcon';
import { useScrolled } from './useScrolled';
import { whatsappLink } from '@/lib/site';

export function WhatsAppFloat() {
  const visible = useScrolled(300);
  return (
    <AnimatePresence>
      {visible &&
      <motion.a
        href={whatsappLink('Hello Crystal Drinks, I would like to place an order.')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Crystal Drinks on WhatsApp"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] transition-colors duration-200 hover:bg-[#1ebe5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice">
        
          <WhatsAppIcon className="h-7 w-7" />
        </motion.a>
      }
    </AnimatePresence>);

}