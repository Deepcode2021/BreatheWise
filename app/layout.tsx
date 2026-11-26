import type { Metadata, Viewport } from 'next';
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

