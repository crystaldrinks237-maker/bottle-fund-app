'use client';
import React, { KeyboardEvent, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ProductStage } from './ProductStage';
import { CatalogueOverview } from './CatalogueOverview';
import { Reveal } from '../Reveal';
import type { Product, Quality } from '../types';

export function ProductCatalogue({ products }: { products: Product[] }) {
  const [activeId, setActiveId] = useState(products[0]?.id ?? '');
  const [qualities, setQualities] = useState<Record<string, Quality>>(
    () => Object.fromEntries(products.map((p) => [p.id, p.defaultQuality]))
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = products.find((p) => p.id === activeId) ?? products[0];
  const lastLabel = products[products.length - 1]?.label;

  const select = (id: string) => setActiveId(id);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + products.length) % products.length;
    select(products[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="sizes" aria-labelledby="sizes-title" className="w-full bg-midnight text-white">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-36">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-[11px] font-medium uppercase tracking-label text-silver">Water Sizes &amp; Prices</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="sizes-title" className="mt-6 font-serif text-[clamp(2.5rem,5vw,4.5rem)] uppercase leading-[0.95]">
                The collection.
                <br />
                <span className="italic text-ice">{products.length > 1 ? `From ${products[0].label} to ${lastLabel}.` : 'Clean, simple, ready.'}</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="flex items-end lg:col-span-4 lg:col-start-9">
            <p className="text-[16px] font-light leading-relaxed text-silver">
              Choose a bottle size, then the quality you prefer. Where a price is listed it is shown here; for everything else, we'll confirm on WhatsApp.
            </p>
          </Reveal>
        </div>

        {!active ? (
          <p className="mt-16 text-silver">Message us on WhatsApp for our current sizes and prices.</p>
        ) : (<>
        {/* Size selector */}
        <Reveal delay={0.12} className="mt-16 overflow-x-auto [scrollbar-width:none]">
          <div role="tablist" aria-label="Bottle sizes" className="flex min-w-max border-b border-white/10">
            {products.map((p, i) => {
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  ref={(el) => tabRefs.current[i] = el}
                  role="tab"
                  id={`tab-${p.id}`}
                  aria-selected={selected}
                  aria-controls="size-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(p.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`relative whitespace-nowrap px-5 pb-5 pt-2 font-serif text-3xl transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:text-white md:px-8 md:text-4xl ${
                  i === 0 ? 'pl-0 md:pl-0' : ''} ${
                  selected ? 'text-white' : 'text-silver/50 hover:text-silver'}`}>
                  
                  {p.label}
                  {selected &&
                  <motion.span
                    layoutId="size-indicator"
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className={`absolute -bottom-px h-px bg-ice ${i === 0 ? 'left-0 right-5 md:right-8' : 'inset-x-5 md:inset-x-8'}`} />

                  }
                </button>);

            })}
          </div>
        </Reveal>

        <div id="size-panel" role="tabpanel" aria-labelledby={`tab-${activeId}`} className="mt-12">
          <Reveal delay={0.14}>
            <ProductStage
              product={active}
              quality={qualities[active.id]}
              onQualityChange={(q) => setQualities((s) => ({ ...s, [active.id]: q }))} />
            
          </Reveal>
        </div>

        <CatalogueOverview products={products} onSelect={(id) => select(id)} />
        </>)}
      </div>
    </section>);

}