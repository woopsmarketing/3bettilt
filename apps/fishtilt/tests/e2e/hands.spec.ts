import { expect, test } from '@playwright/test';
import { koPath, visibleBodyText } from './helpers.js';

/*
 * `/hands` + `/hands/[hand]` — same template contract as `/learn`/`/blog`/`/glossary`, plus
 * the properties unique to this kind (`docs/FISHTILT_STATE.md` ruling 17, Stage 3
 * WP-S3-13a): the 13x13 chart highlights the page's own hand with `RangeMatrix`'s
 * `selectedKey`, drawn with no membership legend (it is not a range query); the template
 * renders the comparison table, the supported-range seats and the graph-derived onward
 * groups from data; and the hub is a static 13x13 index plus grouped lists, not a card wall.
 */
const HAND = koPath('/hands/aks');
const HUB = koPath('/hands');
const MATRIX_NAV = '13×13 표에서 고르기';

test.describe('hands index', () => {
  test('lists every hand, links only what is written', async ({ page }) => {
    await page.goto(HUB);
    await expect(
      page.getByRole('heading', { level: 1, name: '홀덤 시작 핸드 목록' }),
    ).toBeVisible();

    /*
     * Every row in the region named 전체 핸드 is either a real link (published) or inert text
     * carrying a 준비 중 badge (planned), never both, never neither. That holds no matter how
     * many of the 20 hand pages have shipped, and it still fails the day a published hand
     * stops linking or a planned one starts.
     */
    const section = page.getByRole('region', { name: '전체 핸드' });
    const rows = section.locator('li');
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
        await expect(row.locator('a')).toHaveAttribute('href', new RegExp(`^${koPath('/hands')}/`));
      }
    }

    // Cross-check against the page's own published count, so a bug that miscounts both sides
    // the same way can't hide behind a coincidental match.
    await expect(
      page.getByText(`전체 ${rowCount}개 중 ${linkedCount}개를 읽을 수 있습니다.`),
    ).toBeVisible();

    // The static 13x13 index links exactly the same published hands, and nothing else.
    const matrix = page.getByRole('navigation', { name: MATRIX_NAV });
    await expect(matrix).toBeVisible();
    expect(await matrix.locator('[data-row]').count()).toBe(169);
    expect(await matrix.locator('a').count()).toBe(linkedCount);
    expect(await matrix.locator('button').count()).toBe(0);

    const hand = section.getByRole('link', { name: /^AKs/ });
    await expect(hand).toBeVisible();
    await hand.click();
    await expect(page).toHaveURL(new RegExp(`${HAND}$`));
  });

  test('groups the hands into three families, strongest first, and is not a card grid', async ({
    page,
  }) => {
    await page.goto(HUB);
    const families = page.locator('[data-hand-family]');
    await expect(families).toHaveCount(3);
    await expect(page.getByRole('heading', { level: 3, name: '페어' })).toBeVisible();
    // The first row of the pairs group is the strongest pair the registry covers.
    const firstPair = families.first().locator('li').first();
    await expect(firstPair).toContainText('AA');
    await expect(firstPair).toContainText('1위');
  });

  test('the hero links the ranking lesson and the explorer (keyword map C9)', async ({ page }) => {
    await page.goto(HUB);
    await expect(page.getByRole('link', { name: '169개 순위표 열기' })).toHaveAttribute(
      'href',
      koPath('/tools/starting-hand'),
    );
    await expect(
      page.getByRole('link', { name: '시작 패는 어떤 순서로 강할까요?' }),
    ).toHaveAttribute('href', koPath('/learn/starting-hand-ranking'));
  });

  test('is prerendered — the 13x13 index is in the HTML with JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(HUB);
    const matrix = page.getByRole('navigation', { name: MATRIX_NAV });
    expect(await matrix.locator('a').count()).toBeGreaterThan(0);
    await context.close();
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`hub has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(HUB);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});

test.describe('hand page', () => {
  test('is prerendered — the cards, lead sentence and comparison table are in the HTML with JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(HAND);
    await expect(page.getByRole('heading', { level: 1, name: /AKs/ })).toBeVisible();
    await expect(page.getByText('같은 무늬로 받은 시작 패', { exact: false })).toBeVisible();
    await expect(page.locator('[data-comparison="AKs"] table')).toBeVisible();
    await context.close();
  });

  test('the 13x13 chart opens with this hand already selected, no membership legend', async ({
    page,
  }) => {
    await page.goto(HAND);
    await expect(page.getByRole('button', { name: 'AKs' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('레인지에 포함되는 핸드')).toHaveCount(0);
  });

  test('renders the computed sections before the article discussion (plan §4.2)', async ({
    page,
  }) => {
    /*
     * `docs/reports/REVIEW_BEGINNER_UX_SEO.md` M13. §4.2 puts the four computed sections at
     * 3-6, between the one-line answer and the discussion. Asserted as a rule about the FIRST
     * FOUR h2s rather than about one article's headings: it holds for all twenty pages,
     * including one whose MDX adds no headings of its own, and it fails the moment the
     * author's prose climbs back above the computed sections.
     */
    await page.goto(HAND);
    const headings = (await page.locator('main h2').allTextContents()).map((text) => text.trim());
    expect(headings.slice(0, 4)).toEqual([
      '이 패는 어떤 패인가요',
      '13×13 표에서는 여기입니다',
      '얼마나 강한가요',
      '어느 자리에서 처음 레이즈에 쓰이나요',
    ]);

    // …and the one-line answer (§4.2 position 2) still comes before all of them, and after
    // the reference-sheet header (cards + fact strip).
    const text = await page.locator('main').innerText();
    expect(text.indexOf('같은 무늬로 받은 시작 패')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('같은 무늬로 받은 시작 패')).toBeLessThan(
      text.indexOf('이 패는 어떤 패인가요'),
    );
    expect(text.indexOf('강도 순위')).toBeLessThan(text.indexOf('같은 무늬로 받은 시작 패'));
  });

  test('the comparison table lists rank neighbours and the offsuit twin, linking the ones with pages', async ({
    page,
  }) => {
    await page.goto(HAND);
    const table = page.locator('[data-comparison="AKs"] table');
    await expect(table).toBeVisible();
    await expect(table.locator('caption')).toContainText('비기는 경우는 절반만');
    // The hand itself is a row header, not a link; its twin AKo has a page and links.
    await expect(table.getByRole('rowheader', { name: /AKs/ })).toContainText('이 페이지');
    await expect(table.getByRole('link', { name: 'AKo' })).toHaveAttribute(
      'href',
      koPath('/hands/ako'),
    );
    expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(5);
  });

  test('the supported-range section draws the seats on the diagram and names the unsupported situations', async ({
    page,
  }) => {
    await page.goto(HAND);
    const seats = page.locator('[data-rfi-seats]');
    await expect(seats).toHaveCount(1);
    const listed = await seats.getAttribute('data-rfi-seats');
    expect(listed).not.toBeNull();
    expect(listed).not.toBe('none');
    // The diagram highlights exactly the seats the sentence lists — one computation, two views.
    await expect(seats.locator('[data-highlight]')).toHaveAttribute('data-highlight', listed!);
    await expect(seats).toContainText('학습용 기본 레인지');
    await expect(seats).toContainText('지원하지 않음');
  });

  test('states the equity figure as a pot share with ties split, not as a win rate', async ({
    page,
  }) => {
    /*
     * `docs/reports/WP_P1_POKER_CORRECTNESS_REVIEW.md` F4 + the fix round's D1.
     * `HAND_EQUITY_VS_RANDOM` is hero's expected share of the pot WITH TIES SPLIT; described
     * as the proportion of the time hero wins it is wrong by up to 2.87pp on a figure printed
     * to two decimals. 승률 is not renamed site-wide, but this page must not assert P(win),
     * and the ties-split meaning has to be reachable from this page.
     */
    await page.goto(HAND);
    const text = await page.locator('main').innerText();
    expect(text).toContain('팟에서 가져갈 것으로 기대되는 몫');
    expect(text).toContain('비기는 경우는 절반만 이긴 것으로 계산에 들어갑니다');
    expect(text).not.toContain('끝까지 갔을 때의 승률');
  });

  test('states its rank and equity from the packages, and never says GTO', async ({ page }) => {
    await page.goto(HAND);
    await expect(page.getByText('169개 시작 패 중', { exact: false }).first()).toBeVisible();
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  test('never claims the ranking is a profitability verdict', async ({ page }) => {
    await page.goto(HAND);

    /*
     * The page's own honesty disclaimer (Callout heading "이 순위가 뜻하지 않는 것") DENIES
     * exactly the claim this test polices. A whole-`<body>` substring match cannot tell an
     * assertion of a claim from its own negation, so: assert the disclaimer is present and
     * really does deny both phrases, then assert the forbidden phrases appear nowhere OUTSIDE
     * that one disclaimer element. Do not "simplify" this back into a whole-body match.
     */
    const disclaimer = page.locator('aside').filter({ hasText: '이 순위가 뜻하지 않는 것' });
    await expect(disclaimer).toHaveCount(1);
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText('항상 레이즈');
    await expect(disclaimer).toContainText('수익성이 있다는 뜻은 아닙니다');

    const outsideDisclaimerText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      // Next.js inlines the full RSC flight payload as <script> text for hydration, so it
      // must be stripped first, or the disclaimer's own words leak back in.
      for (const script of Array.from(clone.querySelectorAll('script'))) {
        script.remove();
      }
      const target = Array.from(clone.querySelectorAll('aside')).find((el) =>
        (el.textContent ?? '').includes('이 순위가 뜻하지 않는 것'),
      );
      target?.remove();
      return clone.textContent ?? '';
    });
    expect(outsideDisclaimerText).not.toContain('수익성이 있습니다');
    expect(outsideDisclaimerText).not.toContain('항상 레이즈');
  });

  test('the in-article tool CTA is a live link', async ({ page }) => {
    await page.goto(HAND);
    const cta = page.getByRole('link', { name: '핸드레인지 열기' });
    await expect(cta).toHaveAttribute('href', koPath('/tools/range'));
  });

  test('the onward groups carry the Stage 3 labels, and stories show the disclosure', async ({
    page,
  }) => {
    await page.goto(HAND);
    for (const label of [
      '관련 가이드',
      '비슷한 핸드',
      '직접 확인하기',
      '더 배우기',
      '같이 알아둘 용어',
    ]) {
      await expect(page.getByRole('region', { name: label }), label).toBeVisible();
    }
    // A guide that names this hand in its own relatedHands is listed even though the hand's
    // record does not declare it (derived from the graph).
    await expect(
      page.getByRole('region', { name: '관련 가이드' }).getByRole('link', { name: /AK는 좋은 패/ }),
    ).toBeVisible();

    // QQ was dealt to the hero in a shipped story: the story group appears, disclosure visible.
    await page.goto(koPath('/hands/qq'));
    const stories = page.getByRole('region', { name: '이런 이야기도 있어요' });
    await expect(stories).toBeVisible();
    await expect(stories).toContainText('학습과 재미를 위해 재구성한 핸드 시나리오입니다.');
    await expect(stories).toContainText('주인공이 이 패를 들었습니다');
  });

  test('emits FAQPage markup only when the article renders a question list', async ({ page }) => {
    await page.goto(HAND);
    const faqBlocks = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('script[type="application/ld+json"]')).filter((s) =>
          (s.textContent ?? '').includes('"FAQPage"'),
        ).length,
    );
    const visibleQuestions = await page
      .locator('main article h3')
      .evaluateAll((nodes) => nodes.filter((n) => (n.textContent ?? '').trim().length > 0).length);
    // At most one block, and never a block without at least two visible questions.
    expect(faqBlocks).toBeLessThanOrEqual(1);
    if (faqBlocks === 1) expect(visibleQuestions).toBeGreaterThanOrEqual(2);
  });

  test('an unknown hand slug 404s rather than rendering an empty page', async ({ page }) => {
    const response = await page.goto(koPath('/hands/not-a-real-hand'));
    expect(response?.status()).toBe(404);
  });

  for (const width of [360, 390, 768, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(HAND);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
