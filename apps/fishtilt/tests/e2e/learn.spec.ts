import { expect, test } from '@playwright/test';
import { koPath, koUrl, positionButtonName, visibleBodyText } from './helpers.js';

/*
 * The learn surface, end to end — build spec §68's "Article → inline tool → internal
 * related link" flow, plus the two properties that CANNOT be checked anywhere else.
 *
 * The glossary tooltip is the reason this file exists. §32 forbids a hover-only
 * explanation, and `Term` meets that with the native Popover API — which happy-dom does not
 * implement, so a unit test can only prove the markup is wired, never that a TAP opens the
 * definition and that a press elsewhere closes it. That is a real browser's job.
 *
 * The other is prerendering: this whole site's placement depends on the article being static
 * HTML, so the test asserts the prose is in the document before any JavaScript could have
 * put it there.
 */
const LESSON = koPath('/learn/poker-range');

test.describe('learn hub', () => {
  test('lists the whole curriculum, links only what is written', async ({ page }) => {
    await page.goto(koPath('/learn'));
    await expect(page.getByRole('heading', { level: 1, name: '홀덤 처음 배우기' })).toBeVisible();

    // Scoped to the roadmap: the hub lists every lesson twice (mode A, the ordered roadmap;
    // mode B, the category browse), so an unscoped link query is ambiguous by design.
    const lesson = page
      .getByRole('region', { name: '학습 순서' })
      .getByRole('link', { name: /핸드레인지란\?/ });
    await expect(lesson).toBeVisible();

    /*
     * docs/FISHTILT_STATE.md ruling 26 (fired here once already, per
     * docs/reports/WP_QA_E2E_FIXES.md §4): this used to name one lesson ("어떤 족보가 더
     * 강할까요?") as the still-unwritten example, and it broke the moment WP-H1 published
     * it. An e2e spec can't mock the content registry the way the unit tests do, so — same
     * pattern as `glossary.spec.ts`/`blog.spec.ts` — assert the rule against whatever the
     * hub actually renders: every row is either a real link (published) or inert text
     * carrying a 준비 중 badge (planned), never both, never neither. That holds no matter
     * how much of the curriculum has shipped, including all of it, and it still fails the
     * day a published lesson stops linking or a planned one starts.
     */
    const section = page.getByRole('region', { name: '학습 순서' });
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
        await expect(row.locator('a')).toHaveAttribute('href', new RegExp(`^${koPath('/learn')}/`));
      }
    }

    // Cross-check against the page's own published count, so a bug that miscounts both sides
    // the same way can't hide behind a coincidental match.
    await expect(
      page.getByText(`전체 ${rowCount}편 중 ${linkedCount}편을 읽을 수 있습니다.`),
    ).toBeVisible();

    await lesson.click();
    await expect(page).toHaveURL(new RegExp(`${LESSON}$`));
  });

  test('offers two modes — the ordered roadmap and the category browse — without JavaScript', async ({
    browser,
  }) => {
    // No JS at all: both modes must be in the HTML and reachable by plain anchors (contract AR).
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(koPath('/learn'));

    const modes = page.getByRole('navigation', { name: '배우는 방법' });
    await expect(modes.getByRole('link', { name: /처음부터 배우기/ })).toHaveAttribute(
      'href',
      '#roadmap',
    );
    await expect(modes.getByRole('link', { name: /특정 주제 배우기/ })).toHaveAttribute(
      'href',
      '#topics',
    );

    const roadmap = page.getByRole('region', { name: '학습 순서' });
    await expect(roadmap).toBeVisible();
    // The roadmap reads as stages, and the first step carries lesson number 1.
    await expect(roadmap.getByText('1단계')).toBeVisible();
    await expect(roadmap.locator('li[data-order="1"]')).toBeVisible();

    const topics = page.getByRole('region', { name: '주제별로 배우기' });
    const chips = topics.getByRole('navigation', { name: '주제 고르기' }).getByRole('link');
    await expect(chips).toHaveCount(7);
    await chips.filter({ hasText: '레인지' }).click();
    await expect(page).toHaveURL(/#topic-range$/);
    const range = topics.locator('section#topic-range');
    await expect(range).toBeVisible();
    await expect(range.getByRole('link', { name: /핸드레인지란\?/ })).toHaveAttribute(
      'href',
      LESSON,
    );
    await context.close();
  });

  for (const width of [320, 390]) {
    test(`hub has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(koPath('/learn'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});

test.describe('lesson article', () => {
  test('is prerendered — the prose is in the HTML with JavaScript disabled', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { level: 1, name: '핸드레인지란?' })).toBeVisible();
    await expect(
      page.getByText('레인지는 예언이 아니라 목록입니다.', { exact: false }),
    ).toBeVisible();
    await context.close();
  });

  test('states its numbers from the packages, and never says GTO', async ({ page }) => {
    await page.goto(LESSON);
    // 1,326 combos and 169 classes are `<Fact>`s, computed at render.
    await expect(page.getByText('1,326').first()).toBeVisible();
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  test('the mini matrix changes when the reader switches position', async ({ page }) => {
    await page.goto(LESSON);
    const chart = page.getByRole('region', { name: /UTG와 BTN을 번갈아/ });
    const summary = chart.getByText(/이 레인지에 포함됩니다/);
    const before = await summary.textContent();

    await chart.getByRole('button', { name: positionButtonName('UTG') }).click();
    await expect(summary).not.toHaveText(before ?? '');
    // The conditions stay visible whichever position is showing (audit §6).
    await expect(
      chart.getByText('6인 · 100BB · 아무도 참여하지 않았을 때 (First In)'),
    ).toBeVisible();
  });

  test('a glossary term opens on TAP, on a touch device, and closes again', async ({ browser }) => {
    // A pure touch context: no mouse at all, so nothing here can be passing by hover.
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(LESSON);

    const definition = page.getByText(
      '어떤 상황에서 한 사람이 들고 있을 수 있는 시작 패 전부를 하나로 묶어 부르는 말입니다.',
    );
    await expect(definition).toBeHidden();

    await page
      .getByRole('button', { name: /핸드레인지/ })
      .first()
      .tap();
    await expect(definition).toBeVisible();

    await page.getByRole('button', { name: '닫기' }).first().tap();
    await expect(definition).toBeHidden();
    await context.close();
  });

  test('the mid-article tool CTA deep-links into the Range Explorer with context', async ({
    page,
  }) => {
    await page.goto(LESSON);
    const cta = page.getByRole('link', { name: '13×13 핸드레인지 열기' });
    await expect(cta).toHaveAttribute('href', koPath('/tools/range?hero=BTN&spot=RFI&stack=100'));
    await cta.click();
    await expect(page).toHaveURL(koUrl('/tools/range', true));
  });

  test('the related-content block uses the D-S3-16 labels, not "관련 글"', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { name: '더 배우기' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '직접 확인하기' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '같이 알아둘 용어' })).toBeVisible();
    expect(await visibleBodyText(page)).not.toContain('관련 글');
  });

  test('the header says which lesson this is and links its category back to the hub', async ({
    page,
  }) => {
    await page.goto(LESSON);
    await expect(page.getByText('레슨 6 / 15')).toBeVisible();
    const category = page.locator('a[data-lesson="category"]');
    await expect(category).toHaveText('레인지');
    await expect(category).toHaveAttribute('href', koPath('/learn#topic-range'));
    await expect(page.getByText('먼저 읽으면 좋아요')).toBeVisible();
    await category.click();
    await expect(page).toHaveURL(new RegExp(`${koPath('/learn')}#topic-range$`));
    await expect(page.locator('section#topic-range')).toBeVisible();
  });

  test('previous/next follow the curriculum order, not the editorial next-lessons', async ({
    page,
  }) => {
    await page.goto(LESSON);
    const nav = page.getByRole('navigation', { name: '다음으로 읽기' });
    await expect(nav.locator('a[data-direction="prev"]')).toHaveAttribute(
      'href',
      koPath('/learn/hand-matrix'),
    );
    await expect(nav.locator('a[data-direction="next"]')).toHaveAttribute(
      'href',
      koPath('/learn/position'),
    );
  });

  test('the last lesson ends the roadmap honestly instead of inventing a next lesson', async ({
    page,
  }) => {
    await page.goto(koPath('/learn/outs'));
    await expect(page.getByText('레슨 15 / 15')).toBeVisible();
    const nav = page.getByRole('navigation', { name: '다음으로 읽기' });
    await expect(nav.locator('a[data-direction="prev"]')).toHaveAttribute(
      'href',
      koPath('/learn/pot-odds'),
    );
    await expect(nav.locator('[data-direction="next"]')).toHaveCount(0);
    await expect(page.getByText('로드맵의 마지막 레슨입니다')).toBeVisible();
    await expect(page.getByRole('link', { name: '퀴즈로 확인하기' })).toHaveAttribute(
      'href',
      koPath('/practice'),
    );
  });

  test('the pilot lesson renders its goals and summary slots in the prerendered HTML', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(koPath('/learn/holdem-basics'));
    await expect(page.getByRole('region', { name: '이 레슨에서 배우는 것' })).toBeVisible();
    await expect(page.getByText('한눈에 정리')).toBeVisible();
    await context.close();
  });

  test('an unknown lesson slug 404s rather than rendering an empty article', async ({ page }) => {
    const response = await page.goto(koPath('/learn/not-a-lesson'));
    expect(response?.status()).toBe(404);
  });

  for (const width of [360, 390, 768, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(LESSON);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
