'use client';
import React from 'react';
import { CheckIcon, GlassWaterIcon, MessageCircleIcon } from 'lucide-react';
import { LiquidButton } from './LiquidButton';
import { Reveal } from './Reveal';
import { steps } from './content';
import { whatsappLink } from '@/lib/site';

const icons = [GlassWaterIcon, MessageCircleIcon, CheckIcon];

export function HowToOrder() {
  return (
    <section id="order" aria-labelledby="order-title" className="w-full bg-white text-midnight">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-36">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="text-[11px] font-medium uppercase tracking-label text-ocean/60">How to Order</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 id="order-title" className="mt-6 font-serif text-[clamp(2.5rem,5vw,4.5rem)] uppercase leading-[0.95]">
                Three steps.
                <span className="italic text-ocean/80"> That's all.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <LiquidButton href={whatsappLink('Hello Crystal Drinks, I would like to place an order.')} external variant="outlineDark">
              Start your order
            </LiquidButton>
          </Reveal>
        </div>

        <ol className="mt-20 grid grid-cols-1 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = icons[i];
            return (
              <li key={step.number} className={`border-t border-midnight/15 ${i > 0 ? 'md:border-l md:pl-10' : ''} ${i < 2 ? 'md:pr-10' : ''}`}>
                <Reveal delay={0.06 * i} className="flex h-full flex-col py-10">
                  <div className="flex items-start justify-between">
                    <span className="font-serif text-[clamp(4.5rem,8vw,7rem)] font-light leading-none text-midnight/90">{step.number}</span>
                    <Icon className="mt-3 h-5 w-5 text-ocean/40" strokeWidth={1.1} aria-hidden="true" />
                  </div>
                  <h3 className="mt-10 text-[13px] font-medium uppercase tracking-[0.2em]">{step.title}</h3>
                  <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-ocean/70">{step.text}</p>
                </Reveal>
              </li>);

          })}
        </ol>
      </div>
    </section>);

}