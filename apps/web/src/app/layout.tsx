import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Vazirmatn } from 'next/font/google';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

// Vercel's Geist — modern product UI sans (2024)
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

// Vazirmatn — modern Arabic typeface designed for screens, pairs with Geist
const vazirmatn = Vazirmatn({
  variable: '--font-arabic',
  subsets: ['arabic', 'latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Antagna · Volt Production',
  description:
    'نظام التشغيل الداخلي لشركة Volt Production — مشاريع، معدات، عملاء، فريق',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Antagna',
  },
};

export const viewport: Viewport = {
  themeColor: '#FBFAF7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geist.variable} ${geistMono.variable} ${vazirmatn.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)]">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
