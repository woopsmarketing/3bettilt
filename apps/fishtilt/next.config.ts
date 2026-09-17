import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import { legacyLocaleRedirects } from './src/lib/legacyLocaleRedirects.ts';
import { DEFAULT_LOCALE } from './src/lib/locale.ts';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ['ts', 'tsx', 'mdx'],
  /*
   * Workspace packages are consumed as TypeScript source, so Next must compile them.
   * `poker-core` is listed even though FishTilt never imports it directly and ESLint
   * forbids doing so: `strategy-core`'s source imports it, and an untranspiled transitive
   * package fails the build rather than the lint.
   */
  transpilePackages: [
    '@gto-self/shared',
    '@gto-self/poker-core',
    '@gto-self/strategy-core',
    '@gto-self/learn-core',
  ],
  /*
   * Featured visuals (`public/visuals/`, editorial upgrade) are served through `next/image`:
   * AVIF first, WebP as the fallback, resized to the slot's `sizes`. Masters are JPEG so the
   * OG renderer (`lib/og/renderOg.tsx`, which cannot read AVIF/WebP) shares the same file.
   */
  images: { formats: ['image/avif', 'image/webp'] },
  typedRoutes: false,
  // This repository has one set of agent rules at its root and must not grow a second,
  // competing copy inside an app (same reason as `apps/web`).
  agentRules: false,
  // Next 16's dev server 403s asset and HMR requests from an origin it does not
  // recognise, leaving the page rendered but never hydrated. Playwright's default
  // `baseURL` uses the numeric loopback address.
  allowedDevOrigins: ['127.0.0.1'],
  /*
   * THE LEGACY `/ko` REDIRECTS (D-S3-23, superseding D-S3-03). The default locale is
   * prefixless: `/` is the Korean homepage itself (HTTP 200), not a redirect. Every page that
   * used to be served under `/ko/…` answers with a permanent redirect, one hop, to exactly its
   * prefixless page — generated from the frozen list in `legacyLocaleRedirects.ts`, so an
   * address that never existed (`/ko/does-not-exist`) still simply 404s. The prefix is
   * derived from the locale constant rather than spelt here. Old unprefixed-era routes and
   * unsupported locales (`/en`, `/en/learn`) have no rule and 404.
   */
  async redirects() {
    return legacyLocaleRedirects(`/${DEFAULT_LOCALE}`);
  },
  /*
   * Preview deployments must not be indexed (WP-S3-19, DEPLOY §5.2). Vercel sets
   * `VERCEL_ENV` to `preview` on every non-production deployment; only then does every
   * response carry `X-Robots-Tag: noindex`. Production (`VERCEL_ENV === 'production'`) and
   * local builds (unset) return no headers at all, so `routes-manifest.json` keeps
   * `headers: []` and the page-level `<meta name="robots">` from `seo/policy.ts` stays the
   * only index signal there. Canonical/og:url/sitemap still point at the production origin on
   * a preview (D-S3-05) — that is unchanged; this header only tells crawlers not to index the
   * preview host itself.
   */
  async headers() {
    if (process.env.VERCEL_ENV !== 'preview') return [];
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
