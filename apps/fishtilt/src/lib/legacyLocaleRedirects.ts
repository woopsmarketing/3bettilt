/**
 * The `/ko/*` → prefixless URL migration (D-S3-23).
 *
 * Until this migration every Korean page lived under `/ko/…` and `/` redirected to `/ko`.
 * Those URLs were deployed, submitted in `sitemap.xml` and discovered by search engines, so
 * each one must keep answering: permanently (308), in one hop, at EXACTLY its equivalent
 * prefixless page — `/ko/tools/equity` → `/tools/equity`, never `/`.
 *
 * ## Why a frozen list and not a `/ko/:path*` pattern
 *
 * A pattern would also redirect addresses that never existed (`/ko/does-not-exist` →
 * `/does-not-exist`), turning a plain 404 into a redirect nobody asked for. This list is the
 * complete set of pages the `/ko` build prerendered (141 indexable pages + `/search`), taken
 * from that build's `prerender-manifest.json`, so anything outside it keeps the ordinary 404.
 *
 * It is frozen on purpose: it describes URLs that EXISTED, and a page added after the
 * migration never had a `/ko` address to preserve. `legacyLocaleRedirects.test.ts` checks
 * every entry still names a live page, so removing a page fails a test instead of silently
 * redirecting its old address to a 404.
 *
 * This module imports nothing: `next.config.ts` loads it through Next's config require hook,
 * which resolves only literal `.ts` paths (see `tsconfig.json`). The legacy prefix is passed
 * in by the config rather than spelt here, so `locale.test.ts`'s literal guard still holds.
 */

/** Site paths (prefixless) of every page that was served under the legacy `/ko` prefix. */
export const LEGACY_PREFIXED_SITE_PATHS: readonly string[] = [
  '/',
  '/about',
  '/blog',
  '/blog/a2345-wheel',
  '/blog/aa-loses',
  '/blog/ak-flop-miss',
  '/blog/aks-vs-ako',
  '/blog/btn-why-wide',
  '/blog/flush-vs-straight',
  '/blog/full-house-loses',
  '/blog/full-house-vs-flush',
  '/blog/how-often-aa',
  '/blog/is-ak-good',
  '/blog/next-best-after-aa',
  '/blog/outs-nine',
  '/blog/playing-the-board',
  '/blog/pot-odds-quick',
  '/blog/qq-three-bet-frustration',
  '/blog/qq-vs-72o-flop-227',
  '/blog/qq-vs-ak',
  '/blog/river-changes-everything',
  '/blog/small-pocket-pairs',
  '/blog/what-is-kicker',
  '/blog/why-72o-is-weak',
  '/blog/why-blinds-exist',
  '/blog/why-called-3bet',
  '/blog/why-suited-matters',
  '/blog/why-use-range',
  '/glossary',
  '/glossary/action',
  '/glossary/all-in',
  '/glossary/ante',
  '/glossary/bet',
  '/glossary/big-blind',
  '/glossary/blind',
  '/glossary/bluff',
  '/glossary/board',
  '/glossary/broadway',
  '/glossary/button',
  '/glossary/c-bet',
  '/glossary/call',
  '/glossary/check',
  '/glossary/combo',
  '/glossary/community-cards',
  '/glossary/connector',
  '/glossary/cutoff',
  '/glossary/draw',
  '/glossary/equity',
  '/glossary/flop',
  '/glossary/flush',
  '/glossary/fold',
  '/glossary/four-bet',
  '/glossary/four-of-a-kind',
  '/glossary/full-house',
  '/glossary/gutshot',
  '/glossary/hand',
  '/glossary/hand-matrix',
  '/glossary/hand-ranking',
  '/glossary/heads-up',
  '/glossary/high-card',
  '/glossary/hijack',
  '/glossary/ip-oop',
  '/glossary/kicker',
  '/glossary/limp',
  '/glossary/nuts',
  '/glossary/offsuit',
  '/glossary/one-pair',
  '/glossary/open-ended',
  '/glossary/open-raise',
  '/glossary/outs',
  '/glossary/pfr',
  '/glossary/pocket-pair',
  '/glossary/position',
  '/glossary/pot',
  '/glossary/pot-odds',
  '/glossary/preflop',
  '/glossary/raise',
  '/glossary/range',
  '/glossary/river',
  '/glossary/set-vs-trips',
  '/glossary/showdown',
  '/glossary/small-blind',
  '/glossary/split-pot',
  '/glossary/stack',
  '/glossary/straight',
  '/glossary/straight-flush',
  '/glossary/suited',
  '/glossary/three-bet',
  '/glossary/three-of-a-kind',
  '/glossary/turn',
  '/glossary/two-pair',
  '/glossary/utg',
  '/glossary/vpip',
  '/hands',
  '/hands/22',
  '/hands/77',
  '/hands/88',
  '/hands/99',
  '/hands/a5s',
  '/hands/aa',
  '/hands/ajs',
  '/hands/ako',
  '/hands/aks',
  '/hands/aqo',
  '/hands/aqs',
  '/hands/jj',
  '/hands/jts',
  '/hands/kjs',
  '/hands/kk',
  '/hands/kqs',
  '/hands/qjs',
  '/hands/qq',
  '/hands/t9s',
  '/hands/tt',
  '/learn',
  '/learn/equity',
  '/learn/flop-turn-river',
  '/learn/hand-matrix',
  '/learn/holdem-basics',
  '/learn/outs',
  '/learn/poker-actions',
  '/learn/poker-hand-rankings',
  '/learn/poker-range',
  '/learn/position',
  '/learn/positions-6max',
  '/learn/pot-odds',
  '/learn/preflop',
  '/learn/starting-hand-ranking',
  '/learn/starting-hands',
  '/learn/three-bet',
  '/practice',
  '/practice/hand-ranking-quiz',
  '/practice/range-quiz',
  '/practice/starting-hand-quiz',
  '/search',
  '/tools',
  '/tools/equity',
  '/tools/hand-checker',
  '/tools/outs',
  '/tools/pot-odds',
  '/tools/range',
  '/tools/starting-hand',
];

export interface LegacyRedirect {
  readonly source: string;
  readonly destination: string;
  readonly permanent: true;
}

/**
 * One permanent redirect per legacy page: `${prefix}${sitePath}` → `sitePath`, with the root
 * as the bare prefix (`/ko` → `/`). `prefix` is the legacy locale prefix (`/ko`).
 */
export function legacyLocaleRedirects(prefix: string): LegacyRedirect[] {
  if (!/^\/[a-z]{2}$/u.test(prefix)) {
    throw new Error(`legacyLocaleRedirects expects a locale prefix like "/xx", got: ${prefix}`);
  }
  return LEGACY_PREFIXED_SITE_PATHS.map((sitePath) => ({
    source: sitePath === '/' ? prefix : `${prefix}${sitePath}`,
    destination: sitePath,
    permanent: true,
  }));
}
