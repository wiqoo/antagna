import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Skip ESLint during Vercel builds — we lint via turbo + CI separately.
  eslint: { ignoreDuringBuilds: true },
};

export default withSentryConfig(nextConfig, {
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
