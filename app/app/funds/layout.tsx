import type { Metadata } from 'next';
// The funding platform is a separate section of the site: it is not linked from the public homepage and is kept out of search results.
export const metadata: Metadata = { title: { default: 'Crystal Drinks Funding', template: '%s · Crystal Drinks Funding' }, description: 'Crystal Drinks funding management platform', robots: { index: false, follow: false } };
export default function FundsLayout({ children }: { children: React.ReactNode }) { return children; }
