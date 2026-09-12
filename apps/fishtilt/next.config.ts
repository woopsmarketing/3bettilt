import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import { DEFAULT_LOCALE, localePath } from './src/lib/locale.ts';

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
  typedRoutes: false,
  // This repository has one set of agent rules at its root and must not grow a second,
  // competing copy inside an app (same reason as `apps/web`).
  agentRules: false,
  // Next 16's dev server 403s asset and HMR requests from an origin it does not
  // recognise, leaving the page rendered but never hydrated. Playwright's default
  // `baseURL` uses the numeric loopback address.
  allowedDevOrigins: ['127.0.0.1'],
  /*
   * THE ONE REDIRECT (D-S3-03). Every page lives under a locale segment, so the bare root
   * sends a visitor to the default locale's home, permanently. Nothing else redirects: the
   * old unprefixed routes (`/learn`, `/tools/range`, …) were never deployed anywhere, so
   * there is no link in the world to keep alive, and they simply 404.
   */
  async redirects() {
    return [{ source: '/', destination: localePath(DEFAULT_LOCALE, '/'), permanent: true }];
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
