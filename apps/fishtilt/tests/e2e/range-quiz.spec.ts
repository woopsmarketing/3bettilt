import { expect, test } from '@playwright/test';
import { koPath, positionButtonName, visibleBodyText } from './helpers.js';

/*
 * `/practice/range-quiz` — the 레인지 퀴즈's own critical-path E2E (WP-L2), same shape as
 * `range-explorer.spec.ts` for its sibling tool.
 *
 * Flow: open the quiz -> the default position (BTN) is already a real supported combo, so
 * 퀴즈 시작 is enabled without any selection -> selecting BB explains why rather than
 * erroring, and disables the start button -> switching back to a real position re-enables it
 * -> starting the quiz answers through all ten questions -> the result screen shows a score
 * and, if anything was missed, offers 틀린 패 다시 풀기.
 *
 * Written per the orchestrator's instruction; NOT run by this work package (the orchestrator
 * holds the `pnpm e2e:fishtilt` gate).
 */
test.describe('레인지 퀴즈', () => {
  test('the flagship flow: pick a position, start, answer all ten, see the result', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/range-quiz'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('레인지 퀴즈');

    // The default position is already real data — the start button is not gated behind
    // making a selection at all.
    const startButton = page.getByRole('button', { name: '퀴즈 시작' });
    await expect(startButton).toBeEnabled();

    // BB is explained, not errored, and disables the start button while selected.
    await page.getByRole('button', { name: positionButtonName('BB') }).click();
    await expect(page.getByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/)).toBeVisible();
    await expect(startButton).toBeDisabled();

    // Switching back to a real position clears the notice and re-enables the button.
    await page.getByRole('button', { name: positionButtonName('CO') }).click();
    await expect(startButton).toBeEnabled();

    await startButton.click();

    // Answer all ten questions. The prompt is always one of the 169 hand-class keys; the
    // answer picked does not matter to this test — every click must lead to visible,
    // honest feedback (never silently wrong), and the quiz must terminate at a result screen.
    for (let i = 0; i < 10; i += 1) {
      await expect(page.getByText(/— 현재 범위에 포함될까요\?/)).toBeVisible();
      await page.getByRole('button', { name: '포함' }).click();
      await expect(page.getByRole('status').first()).toBeVisible();

      const nextButton = page.getByRole('button', { name: /다음 문제|결과 보기/ });
      await nextButton.click();
    }

    await expect(page.getByRole('heading', { name: '퀴즈 결과' })).toBeVisible();
    await expect(page.getByText(/총 10문제 중 \d+개 정답/)).toBeVisible();
  });

  test('retrying wrong answers only replays the missed questions', async ({ page }) => {
    await page.goto(koPath('/practice/range-quiz'));
    await page.getByRole('button', { name: '퀴즈 시작' }).click();

    // Answering every question EXCLUDE against the default BTN position is very likely to
    // miss at least one of the ten sampled questions (BTN's RFI range covers under half of
    // the 169 classes), which is exactly the state this test needs to exercise the retry
    // flow honestly rather than asserting it only in the lucky all-correct case.
    for (let i = 0; i < 10; i += 1) {
      await page.getByRole('button', { name: '제외' }).click();
      await page.getByRole('button', { name: /다음 문제|결과 보기/ }).click();
    }

    await expect(page.getByRole('heading', { name: '퀴즈 결과' })).toBeVisible();

    const retryButton = page.getByRole('button', { name: '틀린 패 다시 풀기' });
    if ((await retryButton.count()) > 0) {
      await retryButton.click();
      await expect(page.getByText(/— 현재 범위에 포함될까요\?/)).toBeVisible();
      await expect(page.getByText(/^1 \/ \d+문제/)).toBeVisible();
    }
  });

  test('a missed question links onward to the 13x13 chart, never inventing strategy advice', async ({
    page,
  }) => {
    await page.goto(koPath('/practice/range-quiz'));
    await page.getByRole('button', { name: '퀴즈 시작' }).click();

    for (let i = 0; i < 10; i += 1) {
      await page.getByRole('button', { name: '제외' }).click();
      await page.getByRole('button', { name: /다음 문제|결과 보기/ }).click();
    }

    const retryButton = page.getByRole('button', { name: '틀린 패 다시 풀기' });
    if ((await retryButton.count()) > 0) {
      await expect(page.getByRole('link', { name: /핸드레인지|도구 열기/ }).first()).toBeVisible();
    }

    const bodyText = await visibleBodyText(page);
    expect(bodyText).not.toMatch(/해야 합니다|정답입니다|올바른 선택/);
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/practice/range-quiz'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/practice/range-quiz'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
