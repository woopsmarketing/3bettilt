import { expect, test } from '@playwright/test';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/about` — a single static page. No registry data, no dynamic slug, so the only
 * properties worth a browser test are the ones a unit test cannot see: it renders for real
 * with JavaScript disabled, and it carries none of the surface CLAUDE.md forbids (no "GTO",
 * no affiliate/deposit language).
 */
test.describe('about page', () => {
  test('is prerendered — the content is in the HTML with JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(koPath('/about'));
    await expect(
      page.getByRole('heading', { level: 1, name: '3BetTilt는 무엇인가요' }),
    ).toBeVisible();
    await context.close();
  });

  test('is reachable from the footer of an ordinary page, not only by typing the URL', async ({
    page,
  }) => {
    /*
     * `docs/reports/REVIEW_BEGINNER_UX_SEO.md` M11: `/about` returned 200 and sat in
     * sitemap.xml, but a full crawl from `/` reached 130 URLs and never found it — the one
     * page stating "제휴하지 않았습니다" and where the numbers come from was reachable by no
     * human. It is now in the footer, which is on every page, so this walks there by click.
     */
    await page.goto(koPath('/'));
    await page.getByRole('contentinfo').getByRole('link', { name: '소개' }).click();
    await expect(page).toHaveURL(koUrl('/about'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('the footer also surfaces the two other pages that were in no global nav', async ({
    page,
  }) => {
    // Same finding (M12): `/blog` and `/hands` — twenty hand pages — were in neither the
    // header nor the footer, so `/hands` was reachable from no global navigation at all.
    await page.goto(koPath('/'));
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: '블로그' })).toHaveAttribute(
      'href',
      koPath('/blog'),
    );
    await expect(footer.getByRole('link', { name: '핸드 목록' })).toHaveAttribute(
      'href',
      koPath('/hands'),
    );
  });

  test('states plainly that it is not affiliated with any poker room, and never says GTO', async ({
    page,
  }) => {
    await page.goto(koPath('/about'));
    await expect(page.getByText('제휴하지 않았습니다', { exact: false })).toBeVisible();
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  test('carries no affiliate or deposit link', async ({ page }) => {
    await page.goto(koPath('/about'));
    const links = await page
      .locator('a[href]')
      .evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    for (const href of links) {
      expect(href.startsWith('http://') || href.startsWith('https://')).toBe(false);
    }
  });

  for (const width of [360, 390, 768, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/about'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});

test.describe('about page — Stage 3 trust sections', () => {
  test('answers the trust questions as h2 sections reachable from a table of contents', async ({
    page,
  }) => {
    await page.goto(koPath('/about'));
    const toc = page.getByRole('navigation', { name: '목차' });
    await expect(toc).toBeVisible();
    const links = toc.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(10);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(count);
    for (const text of ['숫자는 어떻게 계산하는가?', '정확성 원칙', '하지 않는 것']) {
      await expect(page.getByRole('heading', { level: 2, name: text, exact: true })).toBeVisible();
    }
    // A TOC entry actually lands on its section.
    await links.last().click();
    await expect(page).toHaveURL(/#not$/u);
  });

  test('names no team, company, date or contact address — the site has none to show', async ({
    page,
  }) => {
    await page.goto(koPath('/about'));
    const text = await page.getByRole('main').evaluate((main) => {
      const clone = main.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script').forEach((script) => script.remove());
      return clone.textContent ?? '';
    });
    expect(text).not.toMatch(/@/u);
    expect(text).not.toMatch(/(19|20)\d\d년/u);
    expect(text).not.toMatch(/주식회사|Inc\.|Ltd|사업자|대표|창업자|설립/u);
  });
});
