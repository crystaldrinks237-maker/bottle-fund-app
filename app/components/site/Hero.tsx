'use client';
import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {  } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { LiquidButton } from './LiquidButton';
import { images } from './content';
import { whatsappLink } from '@/lib/site';

const ease = [0.23, 1, 0.32, 1] as const;
const lineupMask =
  'linear-gradient(to bottom, transparent 0%, #000 34%), linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const bottleY = useTransform(scrollYProgress, [0, 1], ['0%', '6%']);
    const textOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-14%']);

  const enter = (delay: number, y = 0) =>
  reduce ?
  {} :
  {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay, ease }
  };

  return (
    <section ref={ref} id="top" aria-labelledby="hero-title" className="relative isolate w-full overflow-hidden bg-midnight">
      {/* Water caustics */}
      <motion.div style={reduce ? undefined : { y: bgY }} className="absolute inset-0 -z-20" aria-hidden="true">
        <motion.img
          src={images.waterTexture}
          alt=""
          {...reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 0.32 }, transition: { duration: 0.3 } }}
          className="caustic-drift h-full w-full object-cover opacity-30 mix-blend-screen" />
        
        <div className="absolute inset-0 bg-midnight/55" />
      </motion.div>

      <motion.div
        style={reduce ? undefined : { opacity: textOpacity, y: textY }}
        className="relative mx-auto flex max-w-[1440px] flex-col px-6 pt-28 lg:px-12 lg:pt-32">
        
        <motion.p {...enter(0.15)} className="text-[11px] font-medium uppercase tracking-label text-silver">
          Crystal Drinks <span className="mx-2 text-champagne">·</span> Everyday Hydration
        </motion.p>

        <h1
          id="hero-title"
          className="mt-6 font-serif text-[clamp(3rem,10vw,10rem)] font-normal uppercase leading-[0.84] tracking-[-0.02em] text-white [text-shadow:0_2px_40px_rgba(6,23,43,0.6)]">
          
          <span className="block overflow-hidden pb-[0.06em]">
            <motion.span className="block" {...reduce ? {} : { initial: { y: '105%' }, animate: { y: '0%' }, transition: { duration: 0.3, delay: 0.22, ease } }}>
              Pure water.
            </motion.span>
          </span>
          <span className="block overflow-hidden pb-[0.06em] lg:text-right">
            <motion.span className="block italic text-ice" {...reduce ? {} : { initial: { y: '105%' }, animate: { y: '0%' }, transition: { duration: 0.3, delay: 0.34, ease } }}>
              Elevated.
            </motion.span>
          </span>
        </h1>

        <motion.div
          {...enter(0.48, 12)}
          className="mt-8 flex flex-col gap-6 border-t border-white/15 pt-6 lg:mt-10 lg:flex-row lg:items-end lg:justify-between">
          
          <p className="max-w-sm text-[15px] font-light leading-relaxed text-silver">
            Clean, refreshing drinking water for homes, shops and businesses — delivered with simplicity and care.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <LiquidButton
              href={whatsappLink('Hello Crystal Drinks, I would like to place an order.')}
              external
              icon={<WhatsAppIcon className="h-4 w-4" />}>
              
              Order on WhatsApp
            </LiquidButton>
            <LiquidButton href="#sizes" variant="outline" className="bg-midnight/40 backdrop-blur-sm">
              Explore our sizes
            </LiquidButton>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        style={reduce ? undefined : { y: bottleY }}
        className="relative mx-auto -mt-2 w-full max-w-[1700px] md:mt-2">
        <motion.img
          {...reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.3, ease } }}
          src={images.heroLineup}
          alt="The full Crystal Drinks range of PET water bottles, from 500 ml to 19 litres"
          className="block h-auto w-full"
          style={{
            WebkitMaskImage: lineupMask, maskImage: lineupMask,
            WebkitMaskComposite: 'source-in', maskComposite: 'intersect'
          }} />
      </motion.div>
    </section>);

}