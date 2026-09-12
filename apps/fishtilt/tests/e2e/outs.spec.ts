import { expect, test } from '@playwright/test';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/tools/outs` — the calculator's critical path in a real browser.
 *
 * The property worth a browser test here is the one the page exists for: the exact answer
 * and the ×2/×4 shortcut are both visible at once, with the gap between them stated. A unit
 * test can prove the numbers; only this can prove they are on the same screen at 390px
 * without pushing the page sideways.
 */
test.describe('아웃 계산기', () => {
  test('a beginner’s whole flow: pick a draw, read both answers, switch streets', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/outs'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('아웃 계산기');

    // Show first: a flush draw is already priced. 9/47 = 19.1%, by the river 35.0%.
    await expect(page.getByLabel('내 아웃은 몇 장인가요?')).toHaveValue('9');
    await expect(page.getByText('35.0%').first()).toBeVisible();
    await expect(page.getByText('19.1%').first()).toBeVisible();

    // Exact and shortcut, side by side, with the gap in words as well as digits.
    // `exact`, because "×4 규칙" is also a substring of two headings on this page.
    await expect(page.getByText('×4 규칙', { exact: true })).toBeVisible();
    await expect(page.getByText('36.0%')).toBeVisible();
    await expect(page.getByText('+1.0%p')).toBeVisible();
    await expect(page.getByText('규칙이 실제보다 높게 잡습니다').first()).toBeVisible();

    // A preset fills the count and shows where the count came from.
    await page.getByText('플러시 드로우 + 양차', { exact: true }).click();
    await expect(page.getByLabel('내 아웃은 몇 장인가요?')).toHaveValue('15');
    // The case the domain's own doc names: ×4 claims 60.0% against a true 54.1%.
    await expect(page.getByText('60.0%')).toBeVisible();
    await expect(page.getByText('54.1%').first()).toBeVisible();

    // The stepper moves one card at a time.
    await page.getByRole('button', { name: '아웃 한 장 늘리기' }).click();
    await expect(page.getByLabel('내 아웃은 몇 장인가요?')).toHaveValue('16');

    // On the turn there is one card left, so there is one comparison, not two.
    await page.getByRole('button', { name: '턴 (카드 1장 남음)' }).click();
    await expect(page.getByText('리버 한 장', { exact: true })).toBeVisible();
    await expect(page.getByText('×4 규칙', { exact: true })).toHaveCount(0);
  });

  test('an impossible out count is explained, never clamped', async ({ page }) => {
    await page.goto(koPath('/tools/outs'));
    await page.getByLabel('내 아웃은 몇 장인가요?').fill('60');
    await expect(page.getByLabel('내 아웃은 몇 장인가요?')).toHaveValue('60');
    await expect(page.getByText('이 개수는 계산할 수 없습니다')).toBeVisible();
    await expect(page.getByText(/47장입니다/).first()).toBeVisible();
  });

  test('is reachable from the site navigation, not only by typing the URL', async ({ page }) => {
    await page.goto(koPath('/tools'));
    // Scoped to the tool section: since WP-4 the hub also lists one prerequisite lesson
    // per tool, whose meta line names that tool, so two links on the page carry this
    // label in their accessible name. What is being proven is unchanged — the hub's own
    // tool card opens the tool.
    await page
      .getByRole('region', { name: '지금 사용할 수 있는 도구' })
      .getByRole('link', { name: /아웃 계산기/ })
      .click();
    await expect(page).toHaveURL(koUrl('/tools/outs'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('아웃 계산기');
  });

  test('hands the reader on to the pot odds calculator', async ({ page }) => {
    await page.goto(koPath('/tools/outs'));
    await page.getByRole('link', { name: '팟 오즈 계산기 열기' }).click();
    await expect(page).toHaveURL(koUrl('/tools/pot-odds'));
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools/outs'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  /*
   * WP-4. This tool's control column is the tall one — a street row, a stepper and a vertical
   * list of draw presets — and on a phone the two columns collapse to controls-THEN-result, so
   * tapping the preset at the bottom of that list changed a number the reader could not see
   * (`REVIEW_BEGINNER_UX_SEO.md` M8, found here at 375px).
   *
   * It fails against both wrong layouts: result-below is off the bottom from the presets, and
   * result-above-but-not-sticky has scrolled off the top by the time the presets are reached.
   */
  test('keeps 계산 결과 on screen while a draw is being picked at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(koPath('/tools/outs'));

    const result = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 2, name: '계산 결과', exact: true }) })
      .first();
    const answer = result.getByText(/^\d{1,3}\.\d%$/).first();
    await expect(answer).toHaveText('35.0%');

    // The last preset is the deepest control on the page — where a reader actually is when
    // they choose the draw they hold.
    const preset = page.getByText('플러시 드로우 + 양차', { exact: true });
    await preset.scrollIntoViewIfNeeded();
    await expect(result, '결과 left the screen at the preset list').toBeInViewport();
    await expect(answer, 'the answer left the screen at the preset list').toBeInViewport();

    await preset.click();
    // 15 outs by the river: the case the domain's own doc names.
    await expect(answer).toHaveText('54.1%');
    await expect(answer, 'the answer was not visible after the last tap').toBeInViewport();

    const box = await result.boundingBox();
    expect(box, 'the result panel must have a box').not.toBeNull();
    if (box === null) return;
    expect(box.y).toBeLessThan(667);
    expect(box.height).toBeLessThan(667 * 0.6);
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools/outs'));
      // The widest state: the longest preset label and both shortcut cards rendered.
      await page.getByText('플러시 드로우 + 양차', { exact: true }).click();
      await expect(page.getByText('리버까지 두 장')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
