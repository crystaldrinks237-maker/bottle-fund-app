'use client';
import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { HandHeartIcon, MessageCircleIcon, ReceiptTextIcon } from 'lucide-react';
import { Reveal } from './Reveal';
import { images, principles } from './content';

const icons = [HandHeartIcon, ReceiptTextIcon, MessageCircleIcon];

export function BrandStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <section id="story" className="w-full bg-white text-midnight">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-24 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-36">
        <div className="flex flex-col justify-center lg:col-span-6 lg:pr-12">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-label text-ocean/60">Our Story</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-6 font-serif text-[clamp(2.5rem,5vw,4.5rem)] uppercase leading-[0.95]">
              The simple thing.
              <br />
              <span className="italic text-ocean/80">Done beautifully.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-8 max-w-md text-[17px] font-light leading-relaxed text-ocean/80">
              We believe ordering drinking water should be simple, reliable and transparent. Crystal Drinks brings together practical packaging, straightforward pricing and convenient ordering for everyday life.
            </p>
          </Reveal>

          <ul className="mt-14 border-t border-midnight/10">
            {principles.map((p, i) => {
              const Icon = icons[i];
              return (
                <li key={p.title} className="border-b border-midnight/10">
                  <Reveal delay={0.05 * i} className="flex gap-6 py-6">
                    <Icon className="mt-1 h-5 w-5 shrink-0 text-ocean/50" strokeWidth={1.1} aria-hidden="true" />
                    <div>
                      <h3 className="text-[15px] font-medium text-midnight">{p.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ocean/70">{p.text}</p>
                    </div>
                  </Reveal>
                </li>);

            })}
          </ul>
        </div>

        <div ref={ref} className="relative lg:col-span-6">
          <Reveal className="relative h-[460px] overflow-hidden bg-midnight md:h-[620px] lg:h-full lg:min-h-[720px]">
            <motion.img
              src={images.storyWater}
              alt="A single droplet falling into still, clear water"
              loading="lazy"
              style={reduce ? undefined : { y: imgY }}
              className="absolute inset-0 h-[116%] w-full -translate-y-[8%] object-cover" />
            
            <p className="absolute bottom-6 left-6 right-6 font-serif text-xl italic text-white/90 md:text-2xl">
              Clean drinking water, easy to get and fair to pay for.
            </p>
          </Reveal>
        </div>
      </div>
    </section>);

}