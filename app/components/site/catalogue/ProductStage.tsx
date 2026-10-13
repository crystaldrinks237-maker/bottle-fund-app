'use client';
import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {  } from 'lucide-react';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { LiquidButton } from '../LiquidButton';
import type { Product, Quality } from '../types';
import { whatsappLink } from '@/lib/site';

type ProductStageProps = {
  product: Product;
  quality: Quality;
  onQualityChange: (q: Quality) => void;
};

const ease = [0.23, 1, 0.32, 1] as const;

export function ProductStage({ product, quality, onQualityChange }: ProductStageProps) {
  const reduce = useReducedMotion();
  const confirmed = product.prices[quality];
  const packText = product.pack ? `pack of ${product.pack} bottles` : '';
  const message = confirmed ?
  `Hello Crystal Drinks, I'd like to order ${product.label} (${quality}), ${packText} — Rs ${confirmed.price}.` :
  `Hello Crystal Drinks, could you share the current price and availability for ${product.label} (${quality})${packText ? `, ${packText}` : ''}?`;
  const otherPriced = Object.keys(product.prices).filter((q) => q !== quality);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      {/* Stage — representative image; replace with real Crystal Drinks photography per size */}
      <div className="group relative aspect-[4/5] overflow-hidden bg-midnight ring-1 ring-white/10 transition-shadow duration-300 ease-out hover:ring-ice/25 lg:col-span-7">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={product.id}
            src={product.image}
            alt={product.imageAlt}
            loading="lazy"
            initial={reduce ? false : { opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]" />
          
        </AnimatePresence>
        <span className="absolute bottom-5 left-5 text-[10px] uppercase tracking-[0.24em] text-silver/60">Representative image</span>
      </div>

      <div className="flex flex-col lg:col-span-5 lg:py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h3
            key={product.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease }}
            className="flex items-baseline gap-3 font-serif leading-[0.85] text-white">
            
            <span className="text-[clamp(6rem,12vw,10rem)] font-normal">{product.size}</span>
            <span className="text-4xl italic text-ice">{product.unit}</span>
          </motion.h3>
        </AnimatePresence>

        <fieldset className="mt-10">
          <legend className="text-[11px] font-medium uppercase tracking-[0.22em] text-silver">
            {product.qualities.length > 1 ? 'Available qualities' : 'Available quality'}
          </legend>
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup">
            {product.qualities.map((q) => {
              const active = q === quality;
              return (
                <button
                  key={q}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onQualityChange(q)}
                  className={`min-w-[84px] border px-4 py-2.5 text-[13px] tracking-wide transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice ${
                  active ? 'border-white bg-white text-midnight' : 'border-white/20 text-silver hover:border-white/50 hover:text-white'}`
                  }>
                  
                  {q}
                </button>);

            })}
          </div>
        </fieldset>

        <dl className="mt-10 border-t border-white/10">
          <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
            <dt className="text-sm text-silver">Bottles per pack</dt>
            <dd className="text-right text-white">{product.pack ?? <span className="text-sm text-silver">Confirm on WhatsApp</span>}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
            <dt className="text-sm text-silver">{product.pack ? 'Price per pack' : 'Price'}</dt>
            <dd className="text-right">
              {confirmed ?
              <span className="font-serif text-4xl text-white">Rs {confirmed.price}</span> :

              <span className="text-[12px] font-medium uppercase tracking-[0.2em] text-ice">Ask for price</span>
              }
            </dd>
          </div>
          {confirmed && confirmed.perBottle &&
          <div className="flex items-baseline justify-between gap-6 border-b border-white/10 py-4">
              <dt className="text-sm text-silver">Per bottle</dt>
              <dd className="text-white">{confirmed.perBottle}</dd>
            </div>
          }
        </dl>

        <div className="mt-4 min-h-[2.5rem] space-y-1 text-sm text-silver/80">
          {!confirmed && otherPriced.length > 0 && <p>Listed price applies to {otherPriced.join(', ')}. Ask us for {quality}.</p>}
          {product.note && <p>{product.note}</p>}
        </div>

        <div className="mt-8 lg:mt-auto">
          <LiquidButton href={whatsappLink(message)} external icon={<WhatsAppIcon className="h-4 w-4" />}>
            {confirmed ? 'Order this size' : 'Ask for price'}
          </LiquidButton>
        </div>
      </div>
    </div>);

}