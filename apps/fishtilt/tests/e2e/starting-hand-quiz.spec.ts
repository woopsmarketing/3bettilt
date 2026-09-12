import { expect, test } from '@playwright/test';
import { koPath, visibleBodyText } from './helpers.js';

/*
 * `/practice/starting-hand-quiz` — the 시작 핸드 퀴즈's critical path in a real browser
 * (WP-L3).
 *
 * This route is not yet registered in `src/lib/routes.ts` (the orchestrator's job), so every
 * test navigates with a direct `page.goto` rather than through `/practice` or the site nav —
 * do not add a nav-reachability test here until the route is registered.
 *
 * The full-quiz test always picks the FIRST answer option (`button[aria-pressed]` — the
 * class-key buttons all carry this attribute, `다음 문제`/`결과 보기` do not) and pins the
 * resulting score. That is legitimate only because the question bank
 * (`startingHandQuestions.ts`) and the seed (`STARTING_HAND_QUIZ_SEED`) are both fixed and
 * owned by this WP — checked against the real shuffled order while writing this file, the
 * same way `hand-ranking-quiz.spec.ts` and `starting-hand.spec.ts` pin their own frozen data.
 */
test.describe('시작 핸드 퀴즈', () => {
  test('opens on the first question, with the exact prompt and three answers', async ({ page }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('시작 핸드 퀴즈');
    await expect(page.getByText('1 / 10문제 · 맞힌 문제 0개')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '어느 쪽이 더 강할까요?' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '동률' })).toBeVisible();
  });

  test("answering states each hand's value on the metric, never advice", async ({ page }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));
    await page.locator('button[aria-pressed]').first().click();

    const feedback = await page.getByRole('status').textContent();
    expect(feedback).toMatch(/정답이에요|아쉬워요/u);
    expect(feedback).toMatch(/프리플랍 기본 강도/u);
    expect(feedback).toMatch(/%/u);
    expect(feedback ?? '').not.toMatch(/해야\s?합니다|하세요|추천|권장/u);
  });

  test('동률 is offered as a genuine option, not hidden, even when it scores wrong today', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));
    const tieButton = page.getByRole('button', { name: '동률' });
    await expect(tieButton).toBeEnabled();
    await tieButton.click();
    await expect(page.getByRole('status')).toBeVisible();
    await expect(tieButton).toBeDisabled();
  });

  test('completing all ten questions by always picking the first hand scores 7/10 on this fixed seed, and offers retry-wrong-only', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));

    for (let index = 1; index <= 10; index += 1) {
      await expect(page.getByText(new RegExp(`^${index} / 10문제`))).toBeVisible();
      await page.locator('button[aria-pressed]').first().click();
      await page.getByRole('button', { name: /다음 문제|결과 보기/u }).click();
    }

    await expect(page.getByRole('heading', { name: '퀴즈 결과' })).toBeVisible();
    await expect(page.getByText('총 10문제 중 7개 정답')).toBeVisible();

    const retryButton = page.getByRole('button', { name: '틀린 패 다시 풀기' });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    // 3 questions were missed (checked against the fixed seed's real shuffle order).
    await expect(page.getByText('1 / 3문제 · 맞힌 문제 0개')).toBeVisible();
  });

  test('links back to the starting-hand lesson and the Starting Hand Explorer', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));
    await expect(page.getByText('이 순위를 글로 차근차근 다시 읽고 싶다면')).toBeVisible();
    await expect(page.getByRole('link', { name: '시작 핸드 탐색기 열기' })).toHaveAttribute(
      'href',
      koPath('/tools/starting-hand'),
    );
  });

  test('states plainly that this is a comparison, not advice', async ({ page }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));
    await expect(page.getByText('이 퀴즈는 "잘 플레이하는 법"을 알려주지 않습니다')).toBeVisible();
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/practice/starting-hand-quiz'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/practice/starting-hand-quiz'));
      await expect(page.getByRole('button', { name: '동률' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
