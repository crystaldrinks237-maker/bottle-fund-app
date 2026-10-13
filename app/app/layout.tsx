import '@fontsource-variable/inter';
import '@fontsource-variable/nunito';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import Providers from './providers';

export const metadata: Metadata = { metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://www.crystaldrinks.pk'), title: { default: 'Crystal Drinks', template: '%s · Crystal Drinks' }, description: 'Crystal Drinks — clean, safe drinking water in PET bottles.', icons: { icon: '/icon.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1877B4' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><a href="#main" className="sr-only">Skip to content</a><Providers>{children}</Providers></body>
    </html>
  );
}
