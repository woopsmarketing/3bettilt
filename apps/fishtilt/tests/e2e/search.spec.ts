import { expect, test } from '@playwright/test';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/search` (WP-K). The route registry now marks this `available: true` and the header's
 * magnifier is a live link to it — it shipped `disabled`, with a comment claiming the
 * registry said otherwise, so a beginner who clicked the one universal affordance for "I do
 * not know this word" got nothing, on every page
 * (`docs/reports/REVIEW_BEGINNER_UX_SEO.md` M12).
 *
 * The query used throughout, "레인지" (an alias of the glossary's `term-range` entry, whose
 * `title` is "레인지 (Range) — 패의 묶음" and whose slug is `range`), is read directly out of
 * `src/content/registry/glossary/g9.ts` and confirmed `status: 'PUBLISHED'` there — the same
 * discipline `glossary.spec.ts` already follows for its own fixture term. Every assertion
 * below checks that a real link resolves, never a result COUNT — content batches ship
 * concurrently with this WP, so how many OTHER results a query also turns up is not this
 * spec's business (`docs/FISHTILT_STATE.md` ruling 26).
 */
const KNOWN_QUERY = '레인지';
const KNOWN_RESULT_NAME = /패의 묶음/;
const KNOWN_RESULT_HREF = koPath('/glossary/range');

test.describe('/search', () => {
  test('the header magnifier opens it, from an ordinary page', async ({ page }) => {
    await page.goto(koPath('/glossary'));
    await page.getByRole('banner').getByRole('link', { name: '검색' }).click();
    await expect(page).toHaveURL(koUrl('/search'));
    await expect(page.getByLabel('검색어')).toBeVisible();
  });

  test('finds a known glossary term by its Korean alias, and the result link resolves', async ({
    page,
  }) => {
    await page.goto(koPath('/search'));
    await expect(page.getByLabel('검색어')).toBeVisible();

    await page.getByLabel('검색어').fill(KNOWN_QUERY);

    const result = page.getByRole('link', { name: KNOWN_RESULT_NAME });
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('href', KNOWN_RESULT_HREF);

    await result.click();
    await expect(page).toHaveURL(new RegExp(`${KNOWN_RESULT_HREF}$`));
    await expect(page.getByRole('heading', { level: 1, name: /패의 묶음/ })).toBeVisible();
  });

  test('the query lives in the URL, so the search is linkable', async ({ page }) => {
    await page.goto(koPath('/search'));
    await page.getByLabel('검색어').fill(KNOWN_QUERY);

    await expect(page).toHaveURL(koUrl('/search', true));

    // Visiting that exact URL fresh reproduces the same result without retyping anything.
    const url = page.url();
    await page.goto(url);
    await expect(page.getByLabel('검색어')).toHaveValue(KNOWN_QUERY);
    await expect(page.getByRole('link', { name: KNOWN_RESULT_NAME })).toBeVisible();
  });

  test('the back button returns to a previous page, not to an empty search', async ({ page }) => {
    await page.goto(koPath('/glossary'));
    await page.goto(koPath(`/search?q=${encodeURIComponent(KNOWN_QUERY)}`));
    await expect(page.getByRole('link', { name: KNOWN_RESULT_NAME })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(koUrl('/glossary'));
  });

  test('announces the result count in a live region', async ({ page }) => {
    await page.goto(koPath('/search'));
    const status = page.getByRole('status');

    // Before anything is typed, this is an honest prompt, not a fabricated "0개 결과".
    await expect(status).toHaveText('검색어를 입력해보세요');

    await page.getByLabel('검색어').fill(KNOWN_QUERY);
    await expect(status).toHaveText(/^\d+개 결과$/);
  });

  test('an honest empty state for a query that matches nothing — no fabricated results, links to browse instead', async ({
    page,
  }) => {
    await page.goto(koPath('/search'));
    await page.getByLabel('검색어').fill('완전히무관한검색어질의xyz123');

    await expect(page.getByText(/결과를 찾지 못했습니다/)).toBeVisible();
    await expect(page.getByText(/찾으신 건가요/)).toHaveCount(0);

    // Scoped to the empty state's own browse group. The header nav and the footer link the same
    // hubs with the same labels, so an unscoped `getByRole('link', { name: '포커 용어' })` matches
    // three elements and fails strict mode — it was never asserting the thing this test is about.
    const browse = page.getByRole('list', { name: '둘러보기' });
    const browseLink = browse.getByRole('link', { name: '포커 용어' });
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute('href', koPath('/glossary'));
  });

  test('is keyboard-usable: type, then Tab to the first result and open it with Enter', async ({
    page,
  }) => {
    await page.goto(koPath('/search'));
    await page.getByLabel('검색어').focus();
    await page.keyboard.type(KNOWN_QUERY);

    const result = page.getByRole('link', { name: KNOWN_RESULT_NAME });
    await expect(result).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(result).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(new RegExp(`${KNOWN_RESULT_HREF}$`));
  });

  test('never says GTO', async ({ page }) => {
    await page.goto(koPath('/search'));
    await page.getByLabel('검색어').fill(KNOWN_QUERY);
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });
});

/*
 * Stage 3 (WP-S3-15). Results are grouped by kind with a count in each header, spelling
 * variants of one concept resolve to the same record, and the page holds together at the
 * narrowest width the site supports.
 */
test.describe('/search — Stage 3', () => {
  const THREE_BET_HREF = koPath('/glossary/three-bet');

  for (const query of ['3벳', '쓰리벳', '3bet', 'three bet']) {
    test(`"${query}" finds the 3-bet glossary term`, async ({ page }) => {
      await page.goto(koPath(`/search?q=${encodeURIComponent(query)}`));
      const link = page.locator(`main a[href="${THREE_BET_HREF}"]`);
      await expect(link, query).toHaveCount(1);
      await expect(link).toBeVisible();
    });
  }

  test('groups results by kind, each header naming the kind and its count', async ({ page }) => {
    await page.goto(koPath(`/search?q=${encodeURIComponent('3벳')}`));
    const groups = page.locator('main [data-search-group]');
    expect(await groups.count()).toBeGreaterThan(1);
    const headings = page.locator('main [data-search-group] h2');
    for (const text of await headings.allTextContents()) {
      expect(text).toMatch(/\d+개/u);
    }
    await expect(page.locator('main [data-search-group="glossary"] h2')).toContainText('용어');
  });

  test('offers example queries in the idle state, and each one is a real search', async ({
    page,
  }) => {
    await page.goto(koPath('/search'));
    const examples = page.getByRole('list', { name: '검색 예시' });
    const first = examples.getByRole('link').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(koUrl('/search', true));
    await expect(page.getByRole('status')).toHaveText(/^\d+개 결과$/);
  });

  test('stays noindex', async ({ page }) => {
    await page.goto(koPath('/search'));
    const robots = page.locator('meta[name="robots"]');
    expect(await robots.count()).toBeGreaterThan(0);
    for (const content of await robots.evaluateAll((tags) =>
      tags.map((tag) => tag.getAttribute('content') ?? ''),
    )) {
      expect(content).toMatch(/noindex/u);
    }
  });

  for (const width of [320, 390, 1440]) {
    test(`has no horizontal overflow at ${width}px, with results on screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(koPath(`/search?q=${encodeURIComponent('3벳')}`));
      await expect(page.getByRole('status')).toHaveText(/^\d+개 결과$/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
