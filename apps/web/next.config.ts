import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

// Cookie-based locale (no [locale] URL segment) — see src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Skip ESLint during Vercel builds — we lint via turbo + CI separately.
  eslint: { ignoreDuringBuilds: true },

  // pdfjs-dist@5 (transitive of pdf-parse@2) ships browser-only code that
  // references DOMMatrix / ImageData at module load. Bundling it into the
  // serverless function makes the whole route 500. Mark these as external
  // so Node loads them via require() at runtime — the lazy import in
  // email-intel/attachments.ts then catches the failure and degrades.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG ?? 'antagna',
  project: process.env.SENTRY_PROJECT ?? 'antagna-web',

  // Upload source maps to Sentry — needs SENTRY_AUTH_TOKEN in env to actually upload.
  // When the token is absent (most local builds), source maps generate but aren't pushed.
  silent: !process.env.CI,

  // Hide source maps from the public bundle (they're uploaded to Sentry instead).
  hideSourceMaps: true,

  // Tree-shake debug logger out of production bundles.
  disableLogger: true,

  // Tunnel /monitoring requests through this app to avoid ad-blockers.
  tunnelRoute: '/monitoring',
});
