import type { NavLink } from './types';
import { PHONE_HREF, WHATSAPP_DISPLAY } from '@/lib/site';

export const contact = { phoneDisplay: WHATSAPP_DISPLAY, phoneHref: PHONE_HREF };

export const navLinks: NavLink[] = [
  { label: 'Our Story', href: '#story' },
  { label: 'Water Sizes & Prices', href: '#sizes' },
  { label: 'How to Order', href: '#order' },
  { label: 'Contact', href: '#contact' },
];

export const images = { heroBottle: '/site/hero-bottle.jpg', storyWater: '/site/story-water.jpg', waterTexture: '/site/water-texture.jpg' };

export const principles = [
  { title: 'Care in every delivery', text: 'Water for your family, shop or office — packed with care, every batch.' },
  { title: 'Clear, straightforward pricing', text: 'One simple price list for every bottle size. No surprises when you order.' },
  { title: 'Convenient ordering through WhatsApp', text: 'Message us and tell us what you need. We take it from there.' },
];

export const steps = [
  { number: '01', title: 'Choose your size', text: 'Explore the available bottle sizes and pack quantities.' },
  { number: '02', title: 'Message us', text: 'Send your order directly through WhatsApp.' },
  { number: '03', title: 'Confirm your delivery', text: 'We confirm quantity, pricing and delivery details with you.' },
];
