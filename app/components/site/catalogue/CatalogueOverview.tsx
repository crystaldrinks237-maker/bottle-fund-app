'use client';
import React from 'react';
import { Reveal } from '../Reveal';
import type { Product } from '../types';

type CatalogueOverviewProps = {
  products: Product[];
  onSelect: (id: string) => void;
};

export function CatalogueOverview({ products, onSelect }: CatalogueOverviewProps) {
  return (
    <Reveal className="mt-24">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-silver">At a glance</h3>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[620px] border-t border-white/15 text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.2em] text-silver/70">
              <th scope="col" className="py-4 font-medium">Size</th>
              <th scope="col" className="py-4 font-medium">Qualities</th>
              <th scope="col" className="py-4 font-medium">Bottles per pack</th>
              <th scope="col" className="py-4 text-right font-medium">Price per pack</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const priced = Object.entries(p.prices);
              return (
                <tr key={p.id} className="border-t border-white/10">
                  <th scope="row" className="py-5 font-normal">
                    <a
                      href="#sizes"
                      onClick={() => onSelect(p.id)}
                      className="group inline-flex items-center gap-3 font-serif text-2xl text-white">
                      
                      {p.label}
                      <span className="h-px w-0 bg-ice transition-[width] duration-200 ease-out group-hover:w-6" />
                    </a>
                  </th>
                  <td className="py-5 text-sm text-silver">{p.qualities.join(' · ')}</td>
                  <td className="py-5 text-sm text-silver">{p.pack ?? '—'}</td>
                  <td className="py-5 text-right text-sm">
                    {priced.length > 0 ?
                    priced.map(([q, v]) =>
                    <div key={q} className="text-white">
                          Rs {v?.price} <span className="text-silver">({q}){v?.perBottle ? ` · ${v.perBottle}/bottle` : ''}</span>
                        </div>
                    ) :

                    <span className="text-ice">Ask on WhatsApp</span>
                    }
                  </td>
                </tr>);

            })}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-silver/60">
        Prices may change. Message us to confirm the current price, availability and delivery for your area. Product imagery is representative.
      </p>
    </Reveal>);

}