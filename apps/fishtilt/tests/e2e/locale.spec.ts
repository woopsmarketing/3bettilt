import { expect, test } from '@playwright/test';
import { koPath } from './helpers.js';

/*
 * D-S3-23: the default locale (Korean) is prefixless and every page that used to live under
 * `/ko/…` answers with a permanent, one-hop redirect to exactly its prefixless page. This file
 * proves the edges no per-page spec is positioned to check — the root is a real page, the
 * representative old URLs land where they should, and addresses that never existed (or
 * locales the site does not have) stay plain 404s — rather than restating them per page.
 */

const NEW_ROUTES = [
  '/',
  '/learn',
  '/learn/pot-odds',
  '/tools',
  '/tools/equity',
  '/blog',
  '/blog/aks-vs-ako',
  '/glossary',
  '/glossary/three-bet',
  '/hands',
  '/hands/aa',
  '/practice',
  '/practice/hand-ranking-quiz',
  '/about',
];

/** The legacy URL and the one page it must land on. Spelt literally: this IS the migration. */
const OLD_TO_NEW: readonly (readonly [string, string])[] = [
  ['/ko', '/'],
  ['/ko/learn', '/learn'],
  ['/ko/learn/pot-odds', '/learn/pot-odds'],
  ['/ko/tools', '/tools'],
  ['/ko/tools/equity', '/tools/equity'],
  ['/ko/blog/aks-vs-ako', '/blog/aks-vs-ako'],
  ['/ko/glossary/three-bet', '/glossary/three-bet'],
  ['/ko/hands/aa', '/hands/aa'],
  ['/ko/practice/hand-ranking-quiz', '/practice/hand-ranking-quiz'],
  ['/ko/about', '/about'],
  ['/ko/search', '/search'],
];

test.describe('locale routing', () => {
  test('the bare / is the Korean homepage itself: 200, no redirect', async ({ request, page }) => {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const html = await response.text();
    // The root canonical is the bare origin — the same URL as `origin/`, as Next renders it.
    expect(html).toMatch(/<link rel="canonical" href="https?:\/\/[^"/]+"/u);

    const loaded = await page.goto('/');
    expect(loaded?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  });

  test('representative prefixless pages answer 200 at their own URL', async ({ request }) => {
    for (const path of NEW_ROUTES) {
      const response = await request.get(koPath(path), { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      const canonical = /<link rel="canonical" href="([^"]+)"/u.exec(html)?.[1] ?? '';
      expect(new URL(canonical).pathname, `${path} canonical`).toBe(path);
    }
  });

  test('each old /ko URL redirects permanently, in one hop, to exactly its new page', async ({
    request,
  }) => {
    for (const [oldPath, newPath] of OLD_TO_NEW) {
      const response = await request.get(oldPath, { maxRedirects: 0 });
      expect(response.status(), oldPath).toBe(308);
      const location = new URL(response.headers()['location'] ?? '', response.url());
      expect(location.pathname, oldPath).toBe(newPath);
      expect(location.search, oldPath).toBe('');

      const landed = await request.get(location.pathname, { maxRedirects: 0 });
      expect(landed.status(), `${oldPath} -> ${newPath} must land on a 200, not another hop`).toBe(
        200,
      );
    }
  });

  test('addresses that never existed, and locales the site does not have, 404', async ({
    request,
  }) => {
    for (const path of [
      '/does-not-exist',
      '/ko/does-not-exist',
      '/ko/learn/does-not-exist',
      '/en',
      '/en/learn',
      '/xx/learn',
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      const body = await response.text();
      expect(body, `${path} must serve the site's own 404 document, not a blank body`).toContain(
        '<main',
      );
    }
  });

  test('the root advertises only its own ko-KR / x-default pair', async ({ request }) => {
    // D-S3-06: one locale, so `ko-KR` and `x-default` both name the same canonical — and no
    // English (or any other) alternate exists yet.
    const html = await (await request.get('/')).text();
    const links = [...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/giu)].map(([tag]) => ({
      hreflang: /hreflang="([^"]+)"/iu.exec(tag)?.[1],
      href: /href="([^"]+)"/iu.exec(tag)?.[1],
    }));
    const byLang = new Map(links.map((link) => [link.hreflang, link.href]));
    expect(new URL(byLang.get('ko-KR') ?? '').pathname).toBe('/');
    expect(byLang.get('x-default')).toBe(byLang.get('ko-KR'));
    expect([...byLang.keys()].sort()).toEqual(['ko-KR', 'x-default']);
  });
});
