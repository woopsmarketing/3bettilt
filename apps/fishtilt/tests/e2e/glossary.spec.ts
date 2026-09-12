import { expect, test } from '@playwright/test';
import { GLOSSARY_INITIALS, initialOf } from '../../src/content/registry/glossary/initials.js';
import { koPath, visibleBodyText } from './helpers.js';

/*
 * `/glossary` + `/glossary/[slug]` — WP-S3-11's dictionary hub and term template. Same
 * template contract as `/learn` and `/blog`, plus two properties unique to this kind: the
 * names (headword, Latin term, aliases) are real, visible text in the static HTML, and the
 * hub's search narrows the index in place while degrading to the site search without JS.
 */
const ENTRY = koPath('/glossary/range');

test.describe('glossary index', () => {
  test('lists every term by headword, links only what is written, counts honestly', async ({
    page,
  }) => {
    await page.goto(koPath('/glossary'));
    await expect(page.getByRole('heading', { level: 1, name: '포커 용어 사전' })).toBeVisible();

    const index = page.getByRole('region', { name: '전체 용어' });
    const entry = index.getByRole('link', { name: '레인지', exact: true });
    await expect(entry).toBeVisible();

    /*
     * Ruling 26: assert the rule against whatever the index renders rather than naming one
     * unwritten term. Every row is either a real link (published) or inert text carrying a
     * 준비 중 badge (planned) — never both, never neither.
     */
    const rows = index.locator('[data-glossary-row]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    let linkedCount = 0;
    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i);
      const badgeCount = await row.getByText('준비 중', { exact: true }).count();
      const linkCount = await row.locator('a').count();
      expect(badgeCount + linkCount, `row ${i} must be exactly one of linked or 준비 중`).toBe(1);
      if (linkCount === 1) {
        linkedCount += 1;
        await expect(row.locator('a')).toHaveAttribute(
          'href',
          new RegExp(`^${koPath('/glossary')}/`),
        );
      }
    }

    // Cross-checked against the page's own count sentence.
    await expect(
      page.getByText(`전체 ${rowCount}개 중 ${linkedCount}개를 읽을 수 있습니다.`),
    ).toBeVisible();

    await entry.click();
    await expect(page).toHaveURL(new RegExp(`${ENTRY}$`));
  });

  test('is a dictionary: ㄱ ㄴ ㄷ tabs in order, Latin names visible, no cards', async ({
    page,
  }) => {
    await page.goto(koPath('/glossary'));
    const index = page.getByRole('region', { name: '전체 용어' });
    const rows = index.locator('[data-glossary-row]');
    const rowCount = await rows.count();

    // The headword is the row's first link/strong text; its tab never goes backwards.
    let lastRank = -1;
    for (let i = 0; i < rowCount; i += 1) {
      const headword = (
        await rows.nth(i).locator('p').first().locator('a, span').first().innerText()
      ).trim();
      const rank = GLOSSARY_INITIALS.indexOf(initialOf(headword));
      expect(rank, `${headword} filed out of order`).toBeGreaterThanOrEqual(lastRank);
      lastRank = rank;
    }

    // "쓰리벳 · 3-Bet · 3bet": the Latin names sit on the row, visibly.
    const threeBet = index.locator('[data-glossary-row][data-slug="three-bet"]');
    await expect(threeBet).toContainText('쓰리벳');
    await expect(threeBet).toContainText('3-Bet');
    await expect(threeBet).toContainText('3bet');

    // Category chips and initial tabs are same-page anchors that resolve.
    const chip = page.getByRole('navigation', { name: '분류로 찾기' }).getByRole('link').first();
    const href = await chip.getAttribute('href');
    expect(href?.startsWith('#')).toBe(true);
    await expect(page.locator(href ?? '#none')).toHaveCount(1);
    const tab = page
      .getByRole('navigation', { name: '첫 글자로 찾기' })
      .getByRole('link', { name: 'ㅋ' });
    await tab.click();
    await expect(page).toHaveURL(/#initial-k$/u);
  });

  test('search narrows the index in place and hands off to site search when nothing matches', async ({
    page,
  }) => {
    await page.goto(koPath('/glossary'));
    const input = page.getByRole('searchbox', { name: '용어 찾기' });
    await input.fill('3bet');
    await expect(page.getByText('1개 용어가 맞습니다.')).toBeVisible();
    const index = page.getByRole('region', { name: '전체 용어' });
    await expect(index.locator('[data-glossary-row]:visible')).toHaveCount(1);
    await expect(index.locator('[data-glossary-row][data-slug="three-bet"]')).toBeVisible();
    // The category map steps aside while a query is active…
    await expect(page.getByRole('region', { name: '주제별로 보기' })).toBeHidden();
    // …and comes back when it is cleared.
    await input.fill('');
    await expect(page.getByRole('region', { name: '주제별로 보기' })).toBeVisible();
    await expect(index.locator('[data-glossary-row]:visible')).toHaveCount(
      await index.locator('[data-glossary-row]').count(),
    );

    // Korean with a space, upper case: normalised like the row keys.
    await input.fill('쓰리 벳');
    await expect(index.locator('[data-glossary-row][data-slug="three-bet"]')).toBeVisible();

    // No match here → the form is allowed through to the site search.
    await input.fill('없는말');
    await expect(page.getByRole('link', { name: '사이트 전체에서 찾기' })).toBeVisible();
    await input.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${koPath('/search')}\\?q=`));
  });

  test('without JavaScript the whole index is in the HTML and the search field is a plain GET form', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(koPath('/glossary'));
    const index = page.getByRole('region', { name: '전체 용어' });
    expect(await index.locator('[data-glossary-row]').count()).toBeGreaterThan(50);
    const form = page.getByRole('search');
    await expect(form).toHaveAttribute('action', koPath('/search'));
    await page.getByRole('searchbox', { name: '용어 찾기' }).fill('키커');
    await page.getByRole('searchbox', { name: '용어 찾기' }).press('Enter');
    await expect(page).toHaveURL(new RegExp(`${koPath('/search')}\\?q=`));
    await context.close();
  });
});

test.describe('glossary entry', () => {
  test('is prerendered — the definition is in the HTML with JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(ENTRY);
    await expect(
      page.getByRole('heading', { level: 1, name: '레인지 (Range) — 패의 묶음' }),
    ).toBeVisible();
    await expect(page.locator('[data-glossary-definition]')).toBeVisible();
    await context.close();
  });

  test('renders headword, Latin term and every alias as visible text, and the one-line definition', async ({
    page,
  }) => {
    await page.goto(koPath('/glossary/three-bet'));
    await expect(page.locator('[data-glossary-headword="쓰리벳"]')).toBeVisible();
    await expect(page.locator('[data-glossary-term="3-Bet"]')).toBeVisible();
    for (const alias of ['3벳', '쓰리 벳', '3-bet', '3bet', '삼벳']) {
      await expect(page.locator(`[data-glossary-alias="${alias}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-glossary-definition]')).toContainText(
      '오픈 레이즈에 다시 레이즈',
    );
    // The category chip goes back to the hub's section for it.
    const category = page.locator('[data-glossary="category"]');
    await expect(category).toHaveText('베팅·액션');
    await expect(category).toHaveAttribute('href', `${koPath('/glossary')}#cat-betting`);
    // Related slots under the D-S3-16 labels.
    await expect(page.getByRole('region', { name: '같이 알아둘 용어' })).toBeVisible();
    await expect(page.getByRole('region', { name: '더 배우기' })).toBeVisible();
    await expect(page.getByRole('region', { name: '직접 확인하기' })).toBeVisible();
  });

  test('a card term carries a deterministic visual in its header', async ({ page }) => {
    await page.goto(koPath('/glossary/flush'));
    const visual = page.locator('[data-glossary="header"] [data-glossary="visual"]');
    await expect(visual).toBeVisible();
    await expect(visual).toHaveAttribute('data-kind', 'made-hand');
    await page.goto(koPath('/glossary/three-bet'));
    await expect(page.locator('[data-glossary="visual"]')).toHaveCount(0);
  });

  test('publishes a DefinedTerm whose fields are on screen', async ({ page }) => {
    await page.goto(koPath('/glossary/kicker'));
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const term = blocks
      .map((text) => JSON.parse(text) as Record<string, unknown>)
      .find((block) => block['@type'] === 'DefinedTerm');
    expect(term).toBeDefined();
    expect(term?.['name']).toBe('키커');
    await expect(page.locator('[data-glossary-headword="키커"]')).toBeVisible();
    await expect(page.locator('[data-glossary-definition]')).toHaveText(
      String(term?.['description']),
    );
    const set = term?.['inDefinedTermSet'] as Record<string, unknown>;
    expect(String(set['url'])).toMatch(new RegExp(`${koPath('/glossary')}$`));
  });

  test('never says GTO', async ({ page }) => {
    await page.goto(ENTRY);
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  test('an unknown glossary slug 404s rather than rendering an empty page', async ({ page }) => {
    const response = await page.goto(koPath('/glossary/not-a-real-term'));
    expect(response?.status()).toBe(404);
  });

  for (const width of [360, 390, 768, 1440]) {
    test(`has no horizontal overflow at ${width}px (hub and entry)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [koPath('/glossary'), ENTRY]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(overflow, path).toBe(false);
      }
    });
  }
});
