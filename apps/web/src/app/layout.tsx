import type { Metadata, Viewport } from 'next';
import {
  Geist,
  Geist_Mono,
  Vazirmatn,
  IBM_Plex_Sans_Arabic,
} from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import NextTopLoader from 'nextjs-toploader';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';
import { InstallPrompt } from '@/components/InstallPrompt';
import { TranslateLayer } from '@/components/TranslateLayer';

// Geist — Latin product UI sans. NOTE: non-colliding variable names
// (--font-geist / --font-geist-mono) so they don't clash with the Tailwind
// @theme --font-sans / --font-mono in globals.css (the old same-name collision
// made those @theme values cyclic → invalid → wrong fonts rendered).
const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
});

// Vazirmatn — DISPLAY/HEADINGS (and, in the V6 clean card skin, body too)
const vazirmatn = Vazirmatn({
  variable: '--font-arabic-display',
  subsets: ['arabic', 'latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// IBM Plex Sans Arabic — BODY (more character at small sizes)
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic', 'latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Antagna · Volt Production',
  description:
    'نظام التشغيل الداخلي لشركة Volt Production — مشاريع، معدات، عملاء، فريق',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Antagna',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F0F12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geist.variable} ${geistMono.variable} ${vazirmatn.variable} ${plexArabic.variable} locale-${locale} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)]">
        {/* Global navigation progress — a thin brand-colored bar at the top that
            shows the moment any link/route navigation starts, so a click always
            gives immediate "something is loading" feedback. */}
        <NextTopLoader
          color="#FF6B1A"
          height={2}
          showSpinner={false}
          shadow={false}
          crawlSpeed={180}
          speed={250}
        />
        <NextIntlClientProvider>
          {children}
          <TranslateLayer enabled={locale === 'en'} />
          <PWARegister />
          <InstallPrompt />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
