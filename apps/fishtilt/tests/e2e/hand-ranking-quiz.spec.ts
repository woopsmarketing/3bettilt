import { expect, test } from '@playwright/test';
import { koPath, visibleBodyText } from './helpers.js';

/*
 * `/practice/hand-ranking-quiz` — the 족보 퀴즈's critical path in a real browser (WP-L3).
 *
 * This route is not yet registered in `src/lib/routes.ts` (that is the orchestrator's job,
 * per this WP's brief), so every test navigates with a direct `page.goto` rather than
 * clicking through the `/practice` hub or the site nav — do not add a nav-reachability test
 * here until the route is registered.
 *
 * The full-quiz test always answers "핸드 A" and pins the resulting score. That is legitimate
 * ONLY because the question bank (`handRankingQuestions.ts`) and the seed
 * (`HAND_RANKING_QUIZ_SEED`) are both fixed and owned by this WP — the same reproducibility
 * guarantee `features/quiz/rng.ts`'s module doc describes ("a quiz that cannot be replayed
 * cannot be debugged"), exercised here as a real, deterministic browser flow rather than
 * asserted only at the unit level. `starting-hand.spec.ts` pins ranks from its own frozen
 * dataset the same way.
 */
test.describe('족보 퀴즈', () => {
  test('opens on the first question, with the exact prompt and all three answers', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/hand-ranking-quiz'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('족보 퀴즈');
    await expect(page.getByText('1 / 10문제 · 맞힌 문제 0개')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: '어느 쪽이 이길까요?' }),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: '핸드 A' })).toBeVisible();
    await expect(page.getByRole('button', { name: '핸드 B' })).toBeVisible();
    await expect(page.getByRole('button', { name: '무승부' })).toBeVisible();
  });

  test('answering reveals feedback, an explanation naming both hands, and lets the reader move on', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/hand-ranking-quiz'));
    await page.getByRole('button', { name: '핸드 A' }).click();

    await expect(page.getByRole('status')).toBeVisible();
    const feedback = await page.getByRole('status').textContent();
    expect(feedback).toMatch(/정답이에요|아쉬워요/u);
    expect(feedback).toMatch(/핸드 A/u);
    expect(feedback).toMatch(/핸드 B/u);

    // One-shot: the answer buttons are disabled once a pick is made.
    await expect(page.getByRole('button', { name: '핸드 A' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '다음 문제' })).toBeVisible();
  });

  test('completing all ten questions by always picking 핸드 A scores 6/10 on this fixed seed, and offers retry-wrong-only', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/hand-ranking-quiz'));

    for (let index = 1; index <= 10; index += 1) {
      await expect(page.getByText(new RegExp(`^${index} / 10문제`))).toBeVisible();
      await page.getByRole('button', { name: '핸드 A' }).click();
      await page.getByRole('button', { name: /다음 문제|결과 보기/u }).click();
    }

    await expect(page.getByRole('heading', { name: '퀴즈 결과' })).toBeVisible();
    await expect(page.getByText('총 10문제 중 6개 정답')).toBeVisible();

    const retryButton = page.getByRole('button', { name: '틀린 패 다시 풀기' });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    // 4 questions were missed (checked against the fixed seed's real shuffle order).
    await expect(page.getByText('1 / 4문제 · 맞힌 문제 0개')).toBeVisible();
  });

  test('a tie ("무승부") is a real, scoreable answer', async ({ page }) => {
    await page.goto(koPath('/practice/hand-ranking-quiz'));

    // Walk questions until a tie is the correct answer, answering 무승부 every time; a wrong
    // guess elsewhere does not affect this assertion, only whether 무승부 itself ever scores.
    let sawCorrectTie = false;
    for (let index = 0; index < 10; index += 1) {
      await page.getByRole('button', { name: '무승부' }).click();
      const feedback = await page.getByRole('status').textContent();
      if (feedback?.includes('정답이에요')) sawCorrectTie = true;
      const isLast = index === 9;
      await page.getByRole('button', { name: isLast ? '결과 보기' : '다음 문제' }).click();
    }
    expect(sawCorrectTie).toBe(true);
  });

  test('links back to the hand-rankings lesson', async ({ page }) => {
    await page.goto(koPath('/practice/hand-ranking-quiz'));
    await expect(page.getByText('족보를 처음부터 다시 확인하고 싶다면')).toBeVisible();
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/practice/hand-ranking-quiz'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/practice/hand-ranking-quiz'));
      await expect(page.getByRole('button', { name: '핸드 A' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
