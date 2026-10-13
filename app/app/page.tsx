import Image from 'next/image';
import type { Metadata } from 'next';
import { publicPrices, getSiteSettings } from '@/lib/services/website';
import { ContactForm } from '@/components/site/ContactForm';
import { MAPS_LINK, WHATSAPP_DISPLAY, waLink } from '@/lib/site';

export const dynamic = 'force-dynamic'; // prices come from the database, so a price change shows immediately
export const metadata: Metadata = {
  title: { absolute: 'Crystal Drinks — Clean Drinking Water in PET Bottles' },
  description: 'Crystal Drinks supplies clean, safe drinking water in PET bottles. See our bottle sizes and prices, and order on WhatsApp.',
  robots: { index: true, follow: true },
};

const rs = (n: number) => `Rs ${Number.isInteger(n) ? n.toLocaleString('en-PK') : n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const VALUES = [
  ['Clean & safe', 'Water you can trust for your family, shop or office — packed with care, every batch.'],
  ['Fair, clear prices', 'One simple price list for every bottle size. No surprises when you order.'],
  ['Easy ordering', 'Message us on WhatsApp and tell us what you need. We take it from there.'],
  ['Reliable supply', 'Regular, dependable supply for homes and businesses that cannot run out of water.'],
];
const STEPS = [['Pick your size', 'Choose from the bottle sizes in the price list below.'], ['Message us', 'Send your order on WhatsApp, or fill in the form.'], ['We confirm', 'We confirm quantity, price and delivery with you directly.']];

export default async function Home() {
  let prices: Awaited<ReturnType<typeof publicPrices>> = []; let settings: Record<string, string> = {};
  try { [prices, settings] = await Promise.all([publicPrices(), getSiteSettings()]); } catch (e) { console.error('[home]', e); }
  const orderLink = waLink('Hello Crystal Drinks, I would like to place an order.');
  return (
    <div className="site">
      <header className="site-nav">
        <a href="#top" className="site-brand"><Image src="/logo.png" alt="Crystal Drinks" width={40} height={43} priority /><span>Crystal Drinks</span></a>
        <nav aria-label="Sections"><a href="#about">About</a><a href="#prices">Prices</a><a href="#contact">Contact</a><a href="#find-us">Find us</a></nav>
        <a className="btn btn-primary btn-sm site-wa-btn" href={orderLink} target="_blank" rel="noopener noreferrer">WhatsApp us</a>
      </header>

      <main id="main">
        <section className="site-hero" id="top">
          <div className="site-wrap">
            <span className="site-eyebrow">Pure drinking water</span>
            <h1>Clean, fresh water,<br />delivered in PET bottles.</h1>
            <p className="site-lead">Crystal Drinks brings safe, great-tasting drinking water to homes, shops and offices — in the sizes you need, at prices that are always clear.</p>
            <div className="row" style={{ marginTop: 26 }}>
              <a className="btn btn-primary site-btn" href={orderLink} target="_blank" rel="noopener noreferrer">Order on WhatsApp</a>
              <a className="btn site-btn" href="#prices">See prices</a>
            </div>
          </div>
          <svg className="site-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70C200 20 380 120 620 80S1050 10 1250 60 1400 90 1440 70V120H0Z" fill="#fff" /></svg>
        </section>

        <section className="site-sec" id="about"><div className="site-wrap">
          <h2 className="site-title">Why Crystal Drinks</h2>
          <p className="site-sub">Our purpose is simple: make clean drinking water easy to get and fair to pay for.</p>
          <div className="site-grid4">{VALUES.map(([t, d]) => <div className="site-card" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>)}</div>
        </div></section>

        <section className="site-sec alt" id="prices"><div className="site-wrap">
          <h2 className="site-title">Bottle sizes &amp; prices</h2>
          <p className="site-sub">Bottles are sold in packs. Prices are per pack.</p>
          <div className="site-card site-table-wrap">
            <table className="site-table">
              <thead><tr><th>Bottle size</th><th>Bottles per pack</th><th className="r">Price per pack</th><th className="r">Per bottle</th></tr></thead>
              <tbody>
                {prices.map(p => {
                  const price = p.pack_price == null ? null : Number(p.pack_price);
                  return (
                    <tr key={p.id}>
                      <td data-label="Bottle size"><b>{p.name}</b>{p.note && <div className="small muted">{p.note}</div>}</td>
                      <td data-label="Bottles per pack">{p.bottles_per_pack}</td>
                      <td data-label="Price per pack" className="r">{price == null ? <a href={waLink(`Hello, what is the price of ${p.name}?`)} target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a> : <b>{rs(price)}</b>}</td>
                      <td data-label="Per bottle" className="r">{price == null ? '—' : rs(price / p.bottles_per_pack)}</td>
                    </tr>);
                })}
                {!prices.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>Please message us on WhatsApp for our current prices.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Prices may change. Message us to confirm the current price and delivery for your area.</p>
        </div></section>

        <section className="site-sec"><div className="site-wrap">
          <h2 className="site-title">How to order</h2>
          <ol className="site-steps">{STEPS.map(([t, d], i) => <li className="site-card" key={t}><span className="num">{i + 1}</span><h3>{t}</h3><p className="muted">{d}</p></li>)}</ol>
        </div></section>

        <section className="site-sec alt" id="contact"><div className="site-wrap site-two">
          <div>
            <h2 className="site-title" style={{ textAlign: 'left' }}>Get in touch</h2>
            <p className="site-sub" style={{ textAlign: 'left', margin: '8px 0 20px' }}>The fastest way to reach us is WhatsApp.</p>
            <a className="site-wa" href={orderLink} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.200-3.400-8.300zM12 21.700c-1.800 0-3.500-.5-5-1.400l-.4-.2-3.800 1 1-3.700-.2-.4a9.800 9.800 0 0 1-1.500-5.200C2.100 6.500 6.500 2.100 12 2.100c2.600 0 5.100 1 6.900 2.900a9.700 9.700 0 0 1 2.900 6.900c0 5.400-4.400 9.800-9.800 9.800zm5.400-7.300c-.3-.1-1.700-.8-2-.9-.3-.1-.5-.1-.7.100l-.9 1.100c-.2.200-.3.200-.6.100a8 8 0 0 1-4-3.500c-.3-.5.300-.5.800-1.600.1-.2 0-.4 0-.5l-.9-2.200c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1 1-1 2.500s1.100 2.900 1.200 3.100c.1.200 2.100 3.200 5.100 4.500 1.900.8 2.600.9 3.600.7.600-.1 1.700-.7 2-1.400.2-.7.200-1.300.2-1.400-.1-.1-.3-.2-.6-.3z" /></svg>
              <span><b>Chat on WhatsApp</b><small>{WHATSAPP_DISPLAY}</small></span>
            </a>
            <p className="muted" style={{ marginTop: 18 }}>Prefer a form? Leave your name and number and we will get back to you.</p>
          </div>
          <ContactForm />
        </div></section>

        <section className="site-sec" id="find-us"><div className="site-wrap">
          <h2 className="site-title">Find us</h2>
          {settings.address && <p className="site-sub">{settings.address}</p>}
          {settings.map_embed
            ? <div className="site-map"><iframe src={settings.map_embed} title="Crystal Drinks on Google Maps" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div>
            : <div className="site-card site-map-fallback"><h3>Visit our location</h3><p className="muted">Open our business location in Google Maps for directions.</p></div>}
          <div style={{ textAlign: 'center', marginTop: 16 }}><a className="btn site-btn" href={MAPS_LINK} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></div>
        </div></section>
      </main>

      <footer className="site-foot"><div className="site-wrap row between"><span>© {new Date().getFullYear()} Crystal Drinks</span><span className="small">WhatsApp: {WHATSAPP_DISPLAY}</span></div></footer>
      <a className="site-fab" href={orderLink} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="currentColor"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.200-6.200-3.400-8.300zM17.400 14.400c-.3-.1-1.700-.8-2-.9-.3-.1-.5-.1-.7.1l-.9 1.100c-.2.200-.3.200-.6.100a8 8 0 0 1-4-3.500c-.3-.5.300-.5.800-1.600.1-.2 0-.4 0-.5l-.9-2.200c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1 1-1 2.500s1.100 2.900 1.200 3.100c.1.200 2.100 3.200 5.100 4.500 1.900.8 2.600.9 3.600.7.600-.1 1.700-.7 2-1.400.2-.7.200-1.300.2-1.400-.1-.1-.3-.2-.6-.3z" /></svg></a>
    </div>
  );
}
