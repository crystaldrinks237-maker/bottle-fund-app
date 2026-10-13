'use client';
import React from 'react';
import { ArrowUpRightIcon, MapPinIcon, PhoneIcon } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { ContactForm } from './ContactForm';
import { LiquidButton } from './LiquidButton';
import { Reveal } from './Reveal';
import { contact, images } from './content';
import { MAPS_LINK } from '@/lib/site';
import { whatsappLink } from '@/lib/site';

export function ContactSection({ address, mapEmbed }: { address: string; mapEmbed: string }) {
  return (
    <section id="contact" aria-labelledby="contact-title" className="relative isolate w-full overflow-hidden bg-midnight text-white">
      <img src={images.waterTexture} alt="" aria-hidden="true" loading="lazy" className="caustic-drift absolute inset-0 -z-10 h-full w-full object-cover opacity-25 mix-blend-screen" />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-24 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-36">
        <div className="lg:col-span-5">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-label text-silver">Contact</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 id="contact-title" className="mt-6 font-serif text-[clamp(2.5rem,5vw,4.75rem)] uppercase leading-[0.95]">
              Your water.
              <br />
              <span className="italic text-ice">Just a message away.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-md text-[17px] font-light leading-relaxed text-silver">
              Tell us what you need. We'll help you confirm the available sizes, pricing and delivery details.
            </p>
          </Reveal>
          <Reveal delay={0.14} className="mt-10">
            <LiquidButton href={whatsappLink('Hello Crystal Drinks, I would like to place an order.')} external icon={<WhatsAppIcon className="h-4 w-4" />}>
              Chat with Crystal Drinks
            </LiquidButton>
          </Reveal>

          <Reveal delay={0.18}>
            <dl className="mt-14 border-t border-white/10">
              <div className="flex gap-5 border-b border-white/10 py-5">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-silver" strokeWidth={1.25} aria-hidden="true" />
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-silver">WhatsApp &amp; phone</dt>
                  <dd className="mt-1.5">
                    <a href={contact.phoneHref} className="text-lg text-white underline-offset-4 hover:underline">{contact.phoneDisplay}</a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-5 border-b border-white/10 py-5">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-silver" strokeWidth={1.25} aria-hidden="true" />
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-silver">Find us</dt>
                  <dd className="mt-1.5 max-w-xs leading-relaxed text-white">{address}</dd>
                </div>
              </div>
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-7">
          <ContactForm />
        </Reveal>
      </div>

      <div id="find-us" className="mx-auto max-w-7xl px-6 pb-24 lg:px-10 lg:pb-32">
        <Reveal>
          <div className="relative h-[360px] overflow-hidden border border-white/10 md:h-[440px]">
            <iframe
              title="Crystal Drinks location on Google Maps"
              src={mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full grayscale-[35%] contrast-[1.05]" />
            
          </div>
          <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm text-silver">{address}</p>
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-medium uppercase tracking-[0.2em] text-white">
              
              Open in Google Maps
              <ArrowUpRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
            </a>
          </div>
        </Reveal>
      </div>
    </section>);

}