import { NextResponse } from 'next/server';

// Own installable PWA for the personal system (separate app icon from Antagna).
export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(
    {
      name: 'مساحتي — Volt',
      short_name: 'مساحتي',
      id: '/me',
      lang: 'ar',
      dir: 'rtl',
      start_url: '/me',
      scope: '/me',
      display: 'standalone',
      background_color: '#0F0F12',
      theme_color: '#FF6B1A',
      orientation: 'portrait',
      // Share from any app → lands in the inbox.
      share_target: {
        action: '/me/share',
        method: 'GET',
        params: { title: 'title', text: 'text', url: 'url' },
      },
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
