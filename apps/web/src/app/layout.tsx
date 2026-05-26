import type { Metadata, Viewport } from 'next';
import {
  Geist,
  Geist_Mono,
  Vazirmatn,
  IBM_Plex_Sans_Arabic,
} from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

// Geist — Latin product UI sans
const geist = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
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
        <NextIntlClientProvider>
          {children}
          <PWARegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
