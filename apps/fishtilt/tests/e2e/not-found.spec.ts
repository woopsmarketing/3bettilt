import { expect, test } from '@playwright/test';
import { koPath, visibleBodyText } from './helpers.js';

/*
 * The 404 page — the one document on this site a visitor reaches by accident.
 *
 * Four other specs already assert that an unknown slug answers 404 (`learn`, `blog`,
 * `glossary`, `hands`), and that is ALL they assert. The Stage-2 independent review found
 * what that left uncovered: for the whole of Stage 2 the site shipped Next's built-in
 * English `NotFound`, which renders a second `<title>` inside the root layout's document.
 * Two `<title>` tags is invalid HTML, the FIRST one wins everywhere, and the first one was
 * the root layout's `무료 홀덤 학습 · 3BetTilt` — so every 404 introduced itself as the
 * homepage, in a language the page was not written in, with no `<main>` landmark to escape
 * from. A status-code assertion is true of all of that.
 *
 * So these tests read the document. They are deliberately about the SHAPE a 404 must have
 * (one Korean title of its own, a landmark, working ways out) rather than about the exact
 * words, which are free to change.
 */
const MISSING = koPath('/glossary/이런-용어는-없습니다');

test.describe('404', () => {
  test('answers 404 and is a page in Korean, not the homepage wearing a 404 status', async ({
    page,
  }) => {
    const response = await page.goto(MISSING);
    expect(response?.status()).toBe(404);

    /*
     * Exactly one title, and it is this page's own. The `<= 1` shape of the old bug is why
     * this counts rather than just matching: the homepage's title WAS present and correct
     * on its own terms — it was simply on the wrong document.
     */
    const titles = await page.locator('title').count();
    expect(titles, 'a 404 with two <title> tags is the Next built-in leaking through').toBe(1);
    await expect(page).toHaveTitle(/[가-힣]/);
    await expect(page).not.toHaveTitle('무료 홀덤 학습 · 3BetTilt');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('claims no address of its own', async ({ page }) => {
    /*
     * Metadata MERGES with the root layout's, so a 404 that simply omits these inherits the
     * layout's — which point at `/`. The first build of `not-found.tsx` did exactly that and
     * emitted a canonical to the site root: the "404 pretends to be the homepage" defect
     * moved out of the `<title>` and into the `<link>`, where nothing was looking.
     */
    await page.goto(MISSING);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
    /*
     * There are TWO robots tags here and both are wanted. Next emits one by itself because
     * the response carries a 404 status; `not-found.tsx` exports the other, because that
     * automatic one is driven by the STATUS and vanishes the moment this same body is served
     * at 200 — which is exactly what a static host does when it serves a 404 document. So
     * the assertion is not "there is one" but "every one of them is a noindex": a second tag
     * that disagreed would be the only way this could go wrong.
     */
    const robots = page.locator('meta[name="robots"]');
    expect(await robots.count()).toBeGreaterThan(0);
    for (const content of await robots.evaluateAll((tags) =>
      tags.map((tag) => tag.getAttribute('content') ?? ''),
    )) {
      expect(content).toMatch(/noindex/u);
    }
  });

  test('is a way out, not a dead end', async ({ page, request }) => {
    await page.goto(MISSING);

    /*
     * The site chrome is still here — a 404 inside the root layout keeps the header and the
     * footer, which is most of the recovery on its own.
     */
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    /*
     * And every destination the page offers has to resolve. A 404 whose own links 404 is
     * worse than no 404 page: it turns one wrong turn into a loop. Links inside `<main>`
     * only — the header and footer are covered by their own spec.
     */
    const hrefs = await page
      .getByRole('main')
      .getByRole('link')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
      );
    expect(hrefs.length, 'the 404 offers nowhere to go').toBeGreaterThan(4);
    for (const href of hrefs) {
      expect(href, 'a 404 must not link off into an unresolved destination').toMatch(/^\//u);
      expect((await request.get(href)).status(), `${href} from the 404 page`).toBe(200);
    }
  });

  test('never blames the reader and never shows an English fallback string', async ({ page }) => {
    await page.goto(MISSING);
    const text = await visibleBodyText(page);
    expect(text).not.toContain('This page could not be found');
    expect(text).not.toContain('404: This page');
  });
});

test.describe('404 — Stage 3', () => {
  test('carries a search box that submits to /search as a plain GET, JavaScript or not', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(MISSING);
    const form = page.getByRole('search', { name: '사이트 검색' });
    await form.getByLabel('검색어').fill('팟 오즈');
    await form.getByRole('button', { name: '검색' }).click();
    await expect(page).toHaveURL(new RegExp(`${koPath('/search')}\\?q=`, 'u'));
    await context.close();
  });

  test('has no horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(MISSING);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
