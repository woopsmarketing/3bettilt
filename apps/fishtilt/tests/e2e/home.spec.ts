import { expect, test } from '@playwright/test';
import { koPath, positionButtonName, visibleBodyText } from './helpers.js';

/*
 * `/` — the front door (WP-S3-05; prefixless since D-S3-23).
 *
 * What a browser proves here that a unit test cannot: the twelve bands survive the trip
 * through a production build into prerendered HTML, every link the page ships actually
 * resolves on the running server, the chart preview really re-renders under a click, the
 * hero's five cards are prerendered with no client JavaScript, and the hero's primary CTA
 * really sits on the first screen of a phone.
 *
 * Nothing below names a specific article, lesson or count. Content is being published into
 * this repository continuously (stories are being written as this ships), so the assertions
 * are the RULES the homepage must satisfy at every point on the way to being finished.
 */

const HERO = '3BetTilt 한 줄 소개';
const PREVIEW_SECTION = '자리를 바꾸면 표가 달라집니다';
const STORIES_SECTION = '3BetTilt 스토리';

/** Bands whose names do not depend on a count (the roadmap's does; it is asserted by shape). */
const SECTIONS = [
  HERO,
  '어디서 시작할까요?',
  PREVIEW_SECTION,
  '궁금한 숫자를 그 자리에서',
  '3BetTilt가 가르치는 방식',
  STORIES_SECTION,
  '검색창에 치는 질문, 바로 답합니다',
  '읽었으면, 한 번 풀어보세요.',
  '모르는 말이 나오면',
  '자주 묻는 질문',
  '지금 시작하기',
];

test.describe('3BetTilt 홈', () => {
  test('serves the product line and the app shell', async ({ page }) => {
    await page.goto(koPath('/'));
    await expect(page).toHaveTitle(/3BetTilt/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '홀덤, 외우지 말고 이해하면서 배우세요.',
    );
    await expect(page.getByRole('banner').getByRole('link', { name: '3BETTILT' })).toBeVisible();
  });

  test('renders every band of the front page, and the roadmap band by shape', async ({ page }) => {
    await page.goto(koPath('/'));
    for (const name of SECTIONS) {
      await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
    }
    // The roadmap: one band, its name carries the live lesson count, its list is three stages.
    const roadmap = page.getByRole('region', { name: /^레슨 \d+편, \d+단계$/u });
    await expect(roadmap).toBeVisible();
    expect(await roadmap.locator('[data-stage]').count()).toBe(3);
    expect(await page.locator('main').getByRole('region').count()).toBe(SECTIONS.length + 1);
  });

  test('the two hero CTAs go where they say they go', async ({ page }) => {
    await page.goto(koPath('/'));
    const hero = page.getByRole('region', { name: HERO, exact: true });

    await expect(hero.getByRole('link', { name: '무료 도구 보기' })).toHaveAttribute(
      'href',
      koPath('/tools'),
    );

    // The other CTA opens the curriculum's first readable lesson. Its slug belongs to the
    // content graph, not to this test, so the assertion is that it is a lesson that renders.
    const startHref = await hero
      .getByRole('link', { name: '처음부터 배우기' })
      .getAttribute('href');
    expect(startHref).toMatch(new RegExp(`^${koPath('/learn')}(/|$)`, 'u'));
    await hero.getByRole('link', { name: '처음부터 배우기' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('the hero picture is the five exact cards, prerendered, inert, over one decorative photo', async ({
    page,
  }) => {
    /*
     * Contract Z: card faces are code. The picture is one `role="img"` whose name is the
     * evaluator's reading of the five cards, it has no tab stops in front of the first link
     * on the page. The scene under the cards is the VA-01 photo: one decorative image.
     */
    await page.goto(koPath('/'));
    const hero = page.getByRole('region', { name: HERO, exact: true });
    const picture = hero.getByRole('img');
    await expect(picture).toBeVisible();
    await expect(picture).toHaveAttribute('aria-label', /스페이드 A K Q J 10$/u);
    expect(await picture.locator('a, button, [tabindex], input').count()).toBe(0);
    const photo = hero.locator('[data-hero-visual] img');
    expect(await hero.locator('img').count()).toBe(1);
    await expect(photo).toHaveAttribute('alt', '');
    await expect(hero.locator('[data-hero-visual]')).toHaveAttribute('data-hero-visual', 'photo');
    await expect
      .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    // The five faces are on screen as text: A K Q J 10 with the spade glyph.
    const faces = await picture.textContent();
    expect((faces ?? '').replace(/\s+/gu, '')).toBe('A♠K♠Q♠J♠10♠');
  });

  test('the primary CTA is still on the first screen at 375px', async ({ page }) => {
    // On a phone the visual goes BELOW the buttons, never in front of them. Measured in the
    // browser rather than assumed from the DOM order.
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(koPath('/'));
    const cta = page
      .getByRole('region', { name: HERO, exact: true })
      .getByRole('link', { name: '처음부터 배우기' });
    await expect(cta).toBeInViewport();
  });

  test('the two hero CTAs are the same width when they stack on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(koPath('/'));
    const ctas = page.getByRole('group', { name: '시작하기' }).getByRole('link');
    await expect(ctas).toHaveCount(2);
    const widths = await ctas.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(widths[0]).toBe(widths[1]);
    const tops = await ctas.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(tops[0]).toBeLessThan(tops[1] ?? 0);
  });

  test('the headline is not pushed down by the hero picture', async ({ page }) => {
    /*
     * RELATIONAL, not a pixel budget: the text column sits against a 4:5 visual, and the
     * headline may not start more than a quarter of the picture's height below its top.
     */
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(koPath('/'));
    const geometry = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const visual = document.querySelector('main [data-hero-visual]');
      if (h1 === null || visual === null) return null;
      return { h1Top: h1.getBoundingClientRect().top, visual: visual.getBoundingClientRect() };
    });
    expect(geometry).not.toBeNull();
    if (geometry === null) return;
    expect(geometry.h1Top - geometry.visual.top).toBeLessThan(geometry.visual.height / 4);
  });

  test('the whole hero — CTAs and the honesty line — is on the first desktop screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(koPath('/'));
    const hero = page.getByRole('region', { name: HERO, exact: true });
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    await expect(hero.getByRole('link', { name: '처음부터 배우기' })).toBeInViewport();
    await expect(hero.getByRole('link', { name: '무료 도구 보기' })).toBeInViewport();
    await expect(hero.getByRole('link', { name: '소개' })).toBeInViewport();
  });

  test('every link on the page resolves rather than 404ing', async ({ page, request }) => {
    await page.goto(koPath('/'));
    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of Array.from(new Set(hrefs))) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  test('reaches every hub, including the two the header leaves out', async ({ page }) => {
    await page.goto(koPath('/'));
    const hrefs = new Set(
      await page
        .locator('main a[href]')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node.getAttribute('href') ?? '').split('#')[0]),
        ),
    );
    for (const path of [
      '/learn',
      '/blog',
      '/glossary',
      '/hands',
      '/tools',
      '/practice',
      '/search',
      '/about',
    ].map((sitePath) => koPath(sitePath))) {
      expect(hrefs.has(path), `the homepage does not reach ${path}`).toBe(true);
    }
  });

  test('the roadmap links every lesson in curriculum order, grouped in three stages', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const roadmap = page.getByRole('region', { name: /^레슨 \d+편, \d+단계$/u });
    const orders = await roadmap
      .locator('[data-order]')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-order'))));
    expect(orders.length).toBeGreaterThan(0);
    expect(orders).toEqual(orders.map((_, index) => index + 1));
    // Each row is exactly one link (a published lesson) XOR one "준비 중" badge.
    for (const row of await roadmap.locator('[data-order]').all()) {
      const links = await row.locator('a').count();
      const badges = await row.getByText('준비 중', { exact: true }).count();
      expect(links + badges).toBe(1);
    }
  });

  test('anything not built yet is readable text with a badge, never a link', async ({ page }) => {
    await page.goto(koPath('/'));
    const badges = page.locator('main').getByText('준비 중', { exact: true });
    for (let index = 0; index < (await badges.count()); index += 1) {
      const inInteractive = await badges
        .nth(index)
        .evaluate((node) => node.closest('a, button') !== null);
      expect(inInteractive).toBe(false);
    }
  });

  test('the chart preview changes when another position is pressed', async ({ page }) => {
    await page.goto(koPath('/'));
    const preview = page.getByRole('region', { name: PREVIEW_SECTION, exact: true });

    await expect(preview.getByRole('button', { name: positionButtonName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const before = await preview.getByRole('status').textContent();

    await preview.getByRole('button', { name: positionButtonName('UTG') }).click();

    await expect(preview.getByRole('button', { name: positionButtonName('UTG') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(preview.getByRole('button', { name: positionButtonName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(preview.getByRole('status')).not.toHaveText(before ?? '');
    await expect(preview.getByRole('group', { name: /\(UTG\) 자리의/u })).toBeVisible();
  });

  test('a position with no data is explained instead of drawn as an empty grid', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const preview = page.getByRole('region', { name: PREVIEW_SECTION, exact: true });
    await preview.getByRole('button', { name: positionButtonName('BB') }).click();
    await expect(
      preview.getByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/),
    ).toBeVisible();
    await expect(preview.getByRole('group', { name: /\) 자리의/u })).toHaveCount(0);
  });

  test('states the conditions the chart is drawn under, in the band and beside the chart', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const preview = page.getByRole('region', { name: PREVIEW_SECTION, exact: true });
    expect(await preview.getByText(/학습용 기본 레인지/).count()).toBeGreaterThanOrEqual(2);
    await expect(
      preview.getByText(/6인 · 100BB · 아무도 참여하지 않았을 때/).first(),
    ).toBeVisible();
  });

  test('the featured tool shows a computed number and every other tool with its question', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const band = page.getByRole('region', { name: '궁금한 숫자를 그 자리에서', exact: true });
    await expect(band.locator('[data-featured-tool]')).toBeVisible();
    // One percentage at the calculator's precision inside the featured example.
    await expect(band.locator('figure').getByText(/^\d{1,3}\.\d%$/u)).toBeVisible();
    expect(await band.locator('[data-tool]').count()).toBe(5);
    for (const row of await band.locator('[data-tool]').all()) {
      expect(
        (await row.locator('a').count()) +
          (await row.getByText('준비 중', { exact: true }).count()),
      ).toBe(1);
    }
  });

  test('the stories band features published stories, or states the promise without inventing one', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const band = page.getByRole('region', { name: STORIES_SECTION, exact: true });
    await expect(band).toBeVisible();
    const featured = await band.locator('[data-featured-story]').count();
    if (featured === 0) {
      await expect(band.locator('[data-stories="coming-soon"]')).toBeVisible();
      await expect(band.getByRole('link', { name: /블로그 읽을거리 보기/u })).toHaveAttribute(
        'href',
        koPath('/blog'),
      );
    } else {
      expect(featured).toBe(1);
      // A reconstructed scenario always says so, on screen.
      await expect(
        band.getByText(/학습과 재미를 위해 재구성한 핸드 시나리오입니다/).first(),
      ).toBeVisible();
      await expect(band.locator('[data-featured-story] a[href]').first()).toBeVisible();
    }
  });

  test('the FAQ answers questions about the site, with every answer already open', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const faq = page.getByRole('region', { name: '자주 묻는 질문', exact: true });
    await expect(faq).toBeVisible();
    const questions = faq.getByRole('heading', { level: 3 });
    expect(await questions.count()).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < (await questions.count()); index += 1) {
      await expect(questions.nth(index)).toBeVisible();
    }
    expect(await faq.locator('details, [aria-expanded]').count()).toBe(0);
    await expect(faq.locator(`a[href="${koPath('/about')}"]`).first()).toBeVisible();
  });

  test('declares the site once in JSON-LD, and the FAQ once, from the visible list', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => JSON.parse(node.textContent ?? '{}') as { '@type'?: string }),
      );
    const count = (type: string): number =>
      blocks.filter((block) => block['@type'] === type).length;
    expect(count('WebSite')).toBe(1);
    expect(count('Organization')).toBe(1);
    expect(count('FAQPage')).toBe(1);
    expect(count('BreadcrumbList')).toBe(0);
  });

  test('claims no popularity and no recency in any heading it writes', async ({ page }) => {
    await page.goto(koPath('/'));
    const headings = await page
      .locator('main h1, main h2, main h3')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading).not.toMatch(/인기/u);
      expect(heading).not.toMatch(/최신|새 글|신규/u);
    }
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [320, 360, 375, 390, 768, 1024, 1280, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }

  test('the chart preview does not push the page sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(koPath('/'));
    await page
      .getByRole('region', { name: PREVIEW_SECTION, exact: true })
      .getByRole('button', { name: positionButtonName('UTG') })
      .click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('opening the mobile nav at phone width causes no overflow either', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(koPath('/'));
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.getByRole('navigation', { name: '주요 메뉴 (모바일)' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('keyboard focus on the header wordmark is visible', async ({ page }) => {
    await page.goto(koPath('/'));
    // Two tabs: the skip link is deliberately the first focusable element in the document.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const wordmark = page.getByRole('banner').getByRole('link', { name: '3BETTILT' });
    await expect(wordmark).toBeFocused();
    const outlineWidth = await wordmark.evaluate((el) => getComputedStyle(el).outlineWidth);
    expect(outlineWidth).not.toBe('0px');
  });

  test('the hero CTA and the position buttons are keyboard reachable with a visible ring', async ({
    page,
  }) => {
    await page.goto(koPath('/'));
    const cta = page
      .getByRole('region', { name: HERO, exact: true })
      .getByRole('link', { name: '무료 도구 보기' });
    await cta.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
    expect(await cta.evaluate((el) => getComputedStyle(el).outlineWidth)).not.toBe('0px');

    const position = page
      .getByRole('region', { name: PREVIEW_SECTION, exact: true })
      .getByRole('button', { name: positionButtonName('CO') });
    await position.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(position).toBeFocused();
    expect(await position.evaluate((el) => getComputedStyle(el).outlineWidth)).not.toBe('0px');
  });
});
