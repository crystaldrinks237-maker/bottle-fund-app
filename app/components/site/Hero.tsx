'use client';
import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {  } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { LiquidButton } from './LiquidButton';
import { images } from './content';
import { whatsappLink } from '@/lib/site';

const ease = [0.23, 1, 0.32, 1] as const;
const imageMask =
'radial-gradient(ellipse 48% 62% at 50% 46%, #000 60%, transparent 100%)';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const bottleY = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const bottleScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
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
    <section ref={ref} id="top" aria-labelledby="hero-title" className="relative isolate min-h-[100svh] w-full overflow-hidden bg-midnight">
      {/* Water caustics */}
      <motion.div style={reduce ? undefined : { y: bgY }} className="absolute inset-0 -z-20" aria-hidden="true">
        <motion.img
          src={images.waterTexture}
          alt=""
          {...reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 0.32 }, transition: { duration: 0.3 } }}
          className="caustic-drift h-full w-full object-cover opacity-30 mix-blend-screen" />
        
        <div className="absolute inset-0 bg-midnight/55" />
      </motion.div>

      {/* The bottle — representative PET image; replace with official Crystal Drinks campaign photography */}
      <motion.div
        style={reduce ? undefined : { y: bottleY, scale: bottleScale }}
        className="absolute inset-x-0 bottom-0 top-[22%] -z-10 flex justify-center md:top-[12%] lg:top-[6%]">
        
        <motion.div
          {...reduce ? {} : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.3, delay: 0.05, ease } }}
          className="relative h-full">
          
          <img
            src={images.heroBottle}
            alt="Crystal Drinks water in a clear PET bottle, beaded with condensation under studio light"
            className="h-full w-auto max-w-none object-contain"
            style={{ WebkitMaskImage: imageMask, maskImage: imageMask }} />
          
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-[12%] left-[37%] w-[27%] overflow-hidden mix-blend-overlay">
            <div className="light-sweep absolute inset-y-0 left-0 w-1/3 bg-white/60 blur-md" />
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        style={reduce ? undefined : { opacity: textOpacity, y: textY }}
        className="relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-6 pb-8 pt-28 md:pb-10 lg:px-12 lg:pt-32">
        
        <motion.p {...enter(0.15)} className="text-[11px] font-medium uppercase tracking-label text-silver">
          Crystal Drinks <span className="mx-2 text-champagne">·</span> Everyday Hydration
        </motion.p>

        <h1
          id="hero-title"
          className="mt-6 font-serif text-[clamp(3.6rem,13vw,13.5rem)] font-normal uppercase leading-[0.84] tracking-[-0.02em] text-white [text-shadow:0_2px_40px_rgba(6,23,43,0.6)] lg:mt-auto">
          
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
          className="mt-auto flex flex-col gap-6 border-t border-white/15 pt-6 lg:mt-12 lg:flex-row lg:items-end lg:justify-between">
          
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
    </section>);

}