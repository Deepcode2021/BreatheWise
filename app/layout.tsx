import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'BreatheWise — Your Personal Clean Air Companion',
  description:
    'AI-powered urban air quality assistant. Monitor AQI, get personalized clean-air routines, indoor air quality tips, and sustainable lifestyle recommendations.',
  keywords: 'air quality, AQI, pollution, clean air, India, BreatheWise, Gemini AI',
  authors: [{ name: 'BreatheWise' }],
  openGraph: {
    title: 'BreatheWise — Your Personal Clean Air Companion',
    description: 'AI-powered urban air quality assistant for families',
    type: 'website',
  },
  verification: {
    google: "FR1fFH6GlS8cEw4jXnj67sC6d-obQeuYDd06I7ehioA",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Opt into dynamic SSR per request so proxy.ts CSP nonces are bound to scripts and inlined styles.
  await connection();

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
