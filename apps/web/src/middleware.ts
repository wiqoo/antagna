import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Canonical domain: forward any *.vercel.app PAGE request to antagna.me so
  // redirects/links never strand the user on the deployment URL. /api and
  // /monitoring are excluded so the worker's server-to-server calls (which hit
  // antagna-v2.vercel.app/api/*) keep working.
  const host = request.headers.get('host') ?? '';
  const path = request.nextUrl.pathname;
  if (
    host.endsWith('.vercel.app') &&
    !path.startsWith('/api') &&
    !path.startsWith('/monitoring')
  ) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.host = 'antagna.me';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (static files)
     *  - _next/image (image optimization)
     *  - favicon.ico, sitemap.xml, robots.txt
     *  - sw.js, manifest.json, manifest.webmanifest, workbox-*.js (PWA — must be reachable to anon to install/update)
     *  - .svg / .png / .jpg / .jpeg / .gif / .webp / .ico / .js (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|sw\\.js|workbox-.*\\.js|manifest\\.json|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
