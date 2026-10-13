import React from 'react';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './site.css';
import { Navigation } from './Navigation';
import { Hero } from './Hero';
import { BrandStory } from './BrandStory';
import { ProductCatalogue } from './catalogue/ProductCatalogue';
import { HowToOrder } from './HowToOrder';
import { ContactSection } from './ContactSection';
import { Footer } from './Footer';
import { WhatsAppFloat } from './WhatsAppFloat';
import type { Product } from './types';

export function SiteHome({ products, address, mapEmbed }: { products: Product[]; address: string; mapEmbed: string }) {
  return (
    <div className="mp w-full bg-midnight font-sans">
      <Navigation />
      <main id="main">
        <Hero />
        <BrandStory />
        <ProductCatalogue products={products} />
        <HowToOrder />
        <ContactSection address={address} mapEmbed={mapEmbed} />
      </main>
      <Footer address={address} />
      <WhatsAppFloat />
    </div>);
}
