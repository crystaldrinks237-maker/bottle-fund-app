import type { Metadata } from 'next';
import { publicCatalogue, getSiteSettings } from '@/lib/services/website';
import { publicReviews } from '@/lib/services/reviews';
import { SiteHome } from '@/components/site/SiteHome';
import { DEFAULT_ADDRESS, DEFAULT_MAP_EMBED } from '@/lib/site';

export const dynamic = 'force-dynamic'; // prices come from the database, so a change in admin shows immediately
export const metadata: Metadata = {
  title: { absolute: 'Crystal Drinks — Pure Drinking Water in PET Bottles' },
  description: 'Crystal Drinks supplies clean drinking water in PET bottles for homes, shops and businesses. See our sizes and prices, and order on WhatsApp.',
  robots: { index: true, follow: true },
};

export default async function Home() {
  let products: any[] = []; let settings: Record<string, string> = {}; let reviews: any = { rows: [], count: 0, average: 0 };
  try { [products, settings] = await Promise.all([publicCatalogue(), getSiteSettings()]); } catch (e) { console.error('[home]', e); }
  try { reviews = await publicReviews(); } catch (e) { console.error('[home reviews]', e); } // table may not exist yet — the rest of the page still works
  return <SiteHome products={products} address={settings.address || DEFAULT_ADDRESS} mapEmbed={settings.map_embed || DEFAULT_MAP_EMBED} reviews={reviews} />;
}
