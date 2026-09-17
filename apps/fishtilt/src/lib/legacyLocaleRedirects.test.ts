/**
 * @vitest-environment node
 *
 * The `/ko/*` → prefixless migration redirects (D-S3-23): every legacy page keeps answering,
 * permanently, in one hop, at exactly its own prefixless page — and nothing that never existed
 * is redirected.
 */
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.js';
import { LEGACY_PREFIXED_SITE_PATHS, legacyLocaleRedirects } from './legacyLocaleRedirects.js';
import { DEFAULT_LOCALE } from './locale.js';
import { ROUTES } from './routes.js';
import { sitemapPaths } from './seo/index.js';

const PREFIX = `/${DEFAULT_LOCALE}`;
const REDIRECTS = legacyLocaleRedirects(PREFIX);
/** Every page the site serves today: the sitemap plus the noindex routes (`/search`). */
const LIVE = new Set([...sitemapPaths(), ...ROUTES.filter((r) => r.available).map((r) => r.path)]);

describe('legacy /ko redirects', () => {
  it('covers the whole pre-migration /ko site: 141 indexable pages + /search', () => {
    expect(LEGACY_PREFIXED_SITE_PATHS).toHaveLength(142);
    expect(new Set(LEGACY_PREFIXED_SITE_PATHS).size).toBe(142);
    const indexable = LEGACY_PREFIXED_SITE_PATHS.filter((path) => path !== '/search');
    expect(new Set(indexable)).toEqual(new Set(sitemapPaths()));
  });

  it('maps each legacy URL to exactly its prefixless equivalent, permanently', () => {
    expect(REDIRECTS).toHaveLength(142);
    for (const { source, destination, permanent } of REDIRECTS) {
      expect(permanent).toBe(true);
      expect(source === PREFIX ? '/' : source.slice(PREFIX.length), source).toBe(destination);
    }
    const bySource = new Map(REDIRECTS.map((r) => [r.source, r.destination]));
    expect(bySource.get('/ko')).toBe('/');
    expect(bySource.get('/ko/learn')).toBe('/learn');
    expect(bySource.get('/ko/learn/pot-odds')).toBe('/learn/pot-odds');
    expect(bySource.get('/ko/tools')).toBe('/tools');
    expect(bySource.get('/ko/tools/equity')).toBe('/tools/equity');
    expect(bySource.get('/ko/blog/aks-vs-ako')).toBe('/blog/aks-vs-ako');
    expect(bySource.get('/ko/glossary/three-bet')).toBe('/glossary/three-bet');
    expect(bySource.get('/ko/hands/aa')).toBe('/hands/aa');
    expect(bySource.get('/ko/practice/hand-ranking-quiz')).toBe('/practice/hand-ranking-quiz');
    expect(bySource.get('/ko/about')).toBe('/about');
  });

  it('only ever lands on a live page, so an old URL never redirects into a 404', () => {
    for (const { destination } of REDIRECTS) expect(LIVE.has(destination), destination).toBe(true);
  });

  it('is one hop with no loop: no destination is itself a redirect source', () => {
    const sources = new Set(REDIRECTS.map((r) => r.source));
    expect(sources.size).toBe(REDIRECTS.length);
    for (const { destination } of REDIRECTS) {
      expect(sources.has(destination), destination).toBe(false);
      expect(destination.startsWith(`${PREFIX}/`) || destination === PREFIX).toBe(false);
    }
  });

  it('redirects nothing that never existed, and never sends an old URL home wholesale', () => {
    const sources = new Set(REDIRECTS.map((r) => r.source));
    expect(sources.has('/ko/does-not-exist')).toBe(false);
    expect(sources.has('/ko/learn/does-not-exist')).toBe(false);
    // No pattern rules: every source is a literal path.
    for (const { source } of REDIRECTS) expect(source).toMatch(/^\/[a-z0-9/-]+$/u);
    expect(REDIRECTS.filter((r) => r.destination === '/')).toHaveLength(1);
  });

  it('is exactly what next.config.ts serves — and the root is no longer a redirect', async () => {
    const served = await nextConfig.redirects?.();
    expect(served).toEqual(REDIRECTS);
    expect(served?.some((r) => r.source === '/')).toBe(false);
  });

  it('refuses a malformed prefix', () => {
    expect(() => legacyLocaleRedirects('ko')).toThrow(/locale prefix/u);
    expect(() => legacyLocaleRedirects('/ko/')).toThrow(/locale prefix/u);
  });
});
