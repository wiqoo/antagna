import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import nextBundleAnalyzer from '@next/bundle-analyzer';

// Cookie-based locale (no [locale] URL segment) — see src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Bundle analyzer — opt in with ANALYZE=true.
const withBundleAnalyzer = nextBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  // Skip ESLint during Vercel builds — we lint via turbo + CI separately.
  eslint: { ignoreDuringBuilds: true },

  // Skip the in-build `tsc` type-check on Vercel. It runs as a separate,
  // memory-heavy process AFTER webpack compile and was OOM-killing the 8 GB
  // build container (empty-message BUILD_ERROR right after "Compiled
  // successfully"). Type safety is NOT lost: we run the authoritative
  // `pnpm --filter @antagna/web exec tsc --noEmit` (same tsconfig) locally
  // before every deploy. Mirrors the ESLint handling above.
  typescript: { ignoreBuildErrors: true },

  // The app + Sentry source-map generation pushes the 8 GB Vercel build
  // container to its memory ceiling (intermittent OOM SIGKILL → missing
  // routes-manifest.json). This Next 15 flag drops retained webpack caches
  // during compilation, cutting peak RSS for a small build-time cost — no
  // runtime or Sentry-fidelity impact. Keeps prod deploys from flaking as the
  // page count grows.
  experimental: {
    webpackMemoryOptimizations: true,
  },

  // pdfjs-dist@5 (transitive of pdf-parse@2) ships browser-only code that
  // references DOMMatrix / ImageData at module load. Bundling it into the
  // serverless function makes the whole route 500. Mark these as external
  // so Node loads them via require() at runtime — the lazy import in
  // email-intel/attachments.ts then catches the failure and degrades.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  // Force-include the repo-root config files the server reads at runtime
  // (config/routines.yaml drives the per-position My Day routine). Vercel's
  // file tracing can't statically see the runtime fs read, so it'd otherwise
  // be missing from the serverless bundle. Path is relative to this app dir.
  outputFileTracingIncludes: {
    '/my-day': ['../../config/routines.yaml'],
  },
};

export default withSentryConfig(withBundleAnalyzer(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG ?? 'antagna',
  project: process.env.SENTRY_PROJECT ?? 'antagna-web',

  // Upload source maps to Sentry — needs SENTRY_AUTH_TOKEN in env to actually upload.
  // When the token is absent (most local builds), source maps generate but aren't pushed.
  silent: !process.env.CI,

  // Hide source maps from the public bundle (they're uploaded to Sentry instead).
  hideSourceMaps: true,

  // Free the generated source maps right after they're uploaded to Sentry —
  // Sentry still has them for symbolication (no loss of readable prod stack
  // traces), but they no longer sit in the build output, easing the memory +
  // disk pressure that was OOM-killing the 8 GB Vercel build container.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tree-shake debug logger out of production bundles.
  disableLogger: true,

  // Tunnel /monitoring requests through this app to avoid ad-blockers.
  tunnelRoute: '/monitoring',

  // A Sentry API hiccup (e.g. a transient 503 on `releases new` or source-map
  // upload) must NEVER fail a production deploy. By default the plugin throws
  // and aborts the build; this handler downgrades it to a warning so the
  // deploy proceeds — source maps just upload on the next successful build.
  // `errorHandler` lives on the webpack-plugin options, forwarded via the
  // documented `unstable_sentryWebpackPluginOptions` passthrough (it's not a
  // top-level SentryBuildOptions key in @sentry/nextjs v8).
  unstable_sentryWebpackPluginOptions: {
    errorHandler: (err: Error) => {
      console.warn('[sentry build] non-fatal:', err?.message ?? err);
    },
  },
});
