import { expect, test } from '@playwright/test';
import { koPath, koUrl } from './helpers.js';

/*
 * Stage 3 (D-S3-01/02): every page lives under a locale segment. This file is the one place
 * that proves the three edges of that rule which no per-page spec is positioned to check —
 * the bare `/` redirect, the unprefixed/unknown-locale 404, and the localised root's own
 * response — rather than restating them once per page.
 */
test.describe('locale routing', () => {
  test('the bare / redirects permanently to /ko', async ({ request, page }) => {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status(), 'the redirect off the unprefixed root must be permanent').toBe(308);

    const location = response.headers()['location'];
    expect(location, 'a redirect response must carry a location header').toBeTruthy();
    const destination = new URL(location ?? '', response.url());
    expect(destination.pathname).toBe(koPath('/'));

    await page.goto('/');
    await expect(page).toHaveURL(koUrl('/'));
  });

  test('an unprefixed page route and an unknown locale both 404, on the site’s own 404 page', async ({
    request,
  }) => {
    for (const path of ['/learn', '/xx/learn']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      const body = await response.text();
      expect(body, `${path} must serve the site's own 404 document, not a blank body`).toContain(
        '<main',
      );
    }
  });

  test('the localised root loads and declares its language', async ({ page }) => {
    const response = await page.goto(koPath('/'));
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  });

  test('the localised root advertises its own hreflang pair and the unprefixed root none', async ({
    request,
  }) => {
    // D-S3-06: one locale, so `ko-KR` and `x-default` both name the same canonical — and
    // they appear only on a served document. The bare `/` is a redirect, not a page, and
    // must carry no alternate that a crawler could mistake for an edition.
    const html = await (await request.get(koPath('/'))).text();
    const links = [...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/giu)].map(([tag]) => ({
      hreflang: /hreflang="([^"]+)"/iu.exec(tag)?.[1],
      href: /href="([^"]+)"/iu.exec(tag)?.[1],
    }));
    const byLang = new Map(links.map((link) => [link.hreflang, link.href]));
    expect(byLang.get('ko-KR')).toBeDefined();
    expect(byLang.get('x-default')).toBe(byLang.get('ko-KR'));
    expect([...byLang.keys()].sort()).toEqual(['ko-KR', 'x-default']);

    const root = await request.get('/', { maxRedirects: 0 });
    expect(root.status()).toBe(308);
    expect(await root.text()).not.toContain('hreflang');
  });
});
