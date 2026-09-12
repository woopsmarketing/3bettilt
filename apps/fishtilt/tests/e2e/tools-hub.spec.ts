import { expect, test } from '@playwright/test';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/tools` — the hub. Two things a browser proves that a unit test cannot: the header's own
 * nav now links here (the route registry flip is real in the shipped HTML), and a "준비 중"
 * card carries no link a visitor could click into a 404.
 */
test.describe('무료 도구 허브', () => {
  test('is in the site header and lists the whole toolbox honestly', async ({ page }) => {
    await page.goto(koPath('/'));
    // The footer lists the same route, so the header's own nav is named explicitly.
    await page.getByLabel('주요 메뉴').getByRole('link', { name: '무료 도구' }).click();
    await expect(page).toHaveURL(koUrl('/tools'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('무료 포커 도구');

    // Scoped to the TOOL section, not to `main`: the header and footer link the same
    // tools-section routes, and since WP-4 the hub also carries a lesson card per tool whose
    // meta line names the tool it belongs to. The contract being pinned is unchanged — a
    // built tool is a visible link on this hub — but "the hub's tool cards" is now a region
    // with a name rather than "everything inside main".
    const cards = page.locator('main');
    const toolCards = page.getByRole('region', { name: '지금 사용할 수 있는 도구' });
    await expect(toolCards.getByRole('link', { name: /팟 오즈 계산기/ })).toBeVisible();
    await expect(toolCards.getByRole('link', { name: /아웃 계산기/ })).toBeVisible();
    await expect(toolCards.getByRole('link', { name: /핸드레인지/ })).toBeVisible();
    await expect(toolCards.getByRole('link', { name: /핸드 체커/ })).toBeVisible();

    // WP-4: the hub reaches the site's own writing at all. It used to reach none of it.
    const lessons = page.getByRole('region', { name: '도구를 이해하는 데 필요한 레슨' });
    await expect(lessons.getByRole('link')).toHaveCount(
      await toolCards.getByRole('link').count(),
    );
    for (const href of await lessons
      .locator('a[href]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))) {
      expect(href, 'a tool hub lesson card must point into /learn').toMatch(
        new RegExp(`^${koPath('/learn')}/`, 'u'),
      );
    }

    // A tool that is not built is readable text with a badge, never a link. This is derived
    // from the rendered page rather than naming one unbuilt tool, because naming one makes
    // the assertion expire the day that tool ships — which is exactly what happened when
    // WP-F2C built 핸드 체커 and this test, which had hard-coded it, started failing. The
    // contract is about the "준비 중" section as a whole, and it holds at every point on the
    // road to shipping every tool, including the last one.
    const planned = page.getByRole('region', { name: '준비 중인 도구' });
    if ((await planned.count()) > 0) {
      await expect(planned.getByText('준비 중').first()).toBeVisible();
      await expect(planned.getByRole('link')).toHaveCount(0);
    } else {
      // Every tool shipped. Then no card anywhere may still claim to be pending.
      await expect(cards.getByText('준비 중')).toHaveCount(0);
    }
  });

  test('every link on the hub resolves rather than 404ing', async ({ page, request }) => {
    await page.goto(koPath('/tools'));
    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
