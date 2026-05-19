import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Cairo } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

const cairo = Cairo({
  variable: '--font-arabic',
  subsets: ['arabic', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Antagna',
  description: 'Internal operating system for Volt Production',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${inter.variable} ${mono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[--bg] text-[--text]">{children}</body>
    </html>
  );
}
