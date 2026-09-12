import { expect, test } from '@playwright/test';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/practice` — the quiz hub (WP-L1). Same shape as `tools-hub.spec.ts`: the header's own
 * nav now links here for real, and a "준비 중" card carries no link a visitor could click
 * into a 404.
 *
 * The "준비 중" assertion is read off the rendered "준비 중인 퀴즈" region as a whole, never
 * off one named quiz — naming one would make this test expire the day that quiz ships,
 * exactly the trap `docs/FISHTILT_STATE.md` ruling 26 documents (and exactly what happened
 * to `tools-hub.spec.ts` once). This holds at every point on the road to WP-L2/L3 shipping
 * all three quizzes, including the last one.
 */
test.describe('퀴즈 허브', () => {
  test('is in the site header and lists the whole quiz plan honestly', async ({ page }) => {
    await page.goto(koPath('/'));
    await page.getByLabel('주요 메뉴').getByRole('link', { name: '퀴즈' }).click();
    await expect(page).toHaveURL(koUrl('/practice'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const main = page.locator('main');
    await expect(main.getByText(/읽었으면 직접 풀어보세요/)).toBeVisible();

    const planned = page.getByRole('region', { name: '준비 중인 퀴즈' });
    if ((await planned.count()) > 0) {
      await expect(planned.getByText('준비 중').first()).toBeVisible();
      await expect(planned.getByRole('link')).toHaveCount(0);
    } else {
      // Every quiz shipped. Then no card anywhere may still claim to be pending.
      await expect(main.getByText('준비 중')).toHaveCount(0);
    }
  });

  test('every link on the hub resolves rather than 404ing', async ({ page, request }) => {
    await page.goto(koPath('/practice'));
    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/practice'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/practice'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});

test.describe('퀴즈 허브 — Stage 3', () => {
  test('each ready quiz is a row that says what it trains, not an identical card', async ({
    page,
  }) => {
    await page.goto(koPath('/practice'));
    const rows = page.locator('main [data-quiz]');
    expect(await rows.count()).toBeGreaterThan(0);
    const ready = page.getByRole('region', { name: '지금 풀 수 있는 퀴즈' });
    await expect(ready).toBeVisible();
    const trains = ready.getByText('이 퀴즈가 훈련하는 것');
    expect(await trains.count()).toBe(await ready.locator('[data-quiz]').count());
    // The rows differ visibly: the drawings beside them are not the same element.
    await expect(ready.locator('[data-quiz] svg, [data-quiz] [aria-label]').first()).toBeVisible();
  });

  test('explains how a round runs and points back to the lessons', async ({ page }) => {
    await page.goto(koPath('/practice'));
    await expect(page.getByRole('region', { name: '어떻게 진행되나요' })).toBeVisible();
    await expect(page.getByRole('list', { name: '퀴즈 진행 순서' })).toBeVisible();
    await expect(page.getByRole('link', { name: '배우기로 가기' })).toHaveAttribute(
      'href',
      koPath('/learn'),
    );
  });
});
