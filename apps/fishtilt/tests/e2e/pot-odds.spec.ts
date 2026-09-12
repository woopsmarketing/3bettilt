import { expect, test } from '@playwright/test';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/tools/pot-odds` — the calculator's critical path in a real browser.
 *
 * What a unit test cannot prove and this file can: the page is reachable from the site's own
 * navigation, the client island actually hydrates in a production build, and the layout does
 * not overflow the viewport on a phone. happy-dom has no layout engine, so every element
 * there is 0px wide and nothing ever overflows — overflow is only knowable here.
 */
test.describe('팟 오즈 계산기', () => {
  test('a beginner’s whole flow: read the default answer, change the numbers, price an all-in', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/pot-odds'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('팟 오즈 계산기');

    // Show first: the answer is already on screen before anything is typed.
    await expect(page.getByText('25.0%').first()).toBeVisible();
    await expect(page.getByText('4.0번 중 1번')).toBeVisible();
    await expect(page.getByText('3.0 : 1')).toBeVisible();

    // Change the pot — the answer follows. 20 + 5 + 5 = 30, and 5/30 is 16.7%.
    const pot = page.getByLabel('지금 팟에 있는 돈');
    await pot.fill('20');
    await expect(page.getByText('16.7%').first()).toBeVisible();
    await expect(page.getByText('30 BB').first()).toBeVisible();

    // A pot-fraction shortcut writes the exact amount it used into the visible field.
    await page.getByRole('button', { name: '1/2 팟' }).click();
    await expect(page.getByLabel('상대가 베팅한 금액')).toHaveValue('10');

    // Price an all-in for less: the uncalled part goes back and the page says so.
    await page.getByLabel(/내 스택이 모자라서/).check();
    const call = page.getByLabel('내가 실제로 낼 수 있는 금액');
    await call.fill('4');
    await expect(page.getByText('상대에게 돌아가는 금액')).toBeVisible();
    await expect(page.getByText('6 BB').first()).toBeVisible();
  });

  test('an impossible call is explained, never silently corrected', async ({ page }) => {
    await page.goto(koPath('/tools/pot-odds'));
    await page.getByLabel('상대가 베팅한 금액').fill('0');
    await expect(page.getByText('이 상황은 계산할 수 없습니다')).toBeVisible();
    await expect(page.getByText(/콜 금액은 0보다 커야 합니다/)).toBeVisible();
    // The reader's own entry is still there — nothing was rewritten behind them.
    await expect(page.getByLabel('상대가 베팅한 금액')).toHaveValue('0');
  });

  test('is reachable from the site navigation, not only by typing the URL', async ({ page }) => {
    await page.goto(koPath('/tools'));
    // Scoped to the tool section: since WP-4 the hub also lists one prerequisite lesson
    // per tool, whose meta line names that tool, so two links on the page carry this
    // label in their accessible name. What is being proven is unchanged — the hub's own
    // tool card opens the tool.
    await page
      .getByRole('region', { name: '지금 사용할 수 있는 도구' })
      .getByRole('link', { name: /팟 오즈 계산기/ })
      .click();
    await expect(page).toHaveURL(koUrl('/tools/pot-odds'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('팟 오즈 계산기');
  });

  test('hands the reader on to the outs calculator', async ({ page }) => {
    await page.goto(koPath('/tools/pot-odds'));
    await page.getByRole('link', { name: '아웃 계산기 열기' }).click();
    await expect(page).toHaveURL(koUrl('/tools/outs'));
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools/pot-odds'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  /*
   * WP-4. The two columns collapse to one on a phone, and before this the single column was
   * inputs-THEN-result: three fields, four pot-fraction buttons and the all-in checkbox stood
   * between the control a reader had just touched and the number it changed — the same defect
   * `REVIEW_BEGINNER_UX_SEO.md` M8 found on the two card-picker tools.
   *
   * This fails against BOTH wrong layouts, which is why the reader is moved to the bottom of
   * the form before anything is clicked: result-below fails immediately (the answer is off the
   * bottom), and result-above-but-not-sticky fails at the same point (the answer has scrolled
   * off the top). Only "first in the DOM and stuck to the top" passes.
   */
  test('keeps 계산 결과 on screen while the fields are being changed at 375px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(koPath('/tools/pot-odds'));

    const result = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 2, name: '계산 결과', exact: true }) })
      .first();
    const answer = result.getByText(/^\d{1,3}\.\d%$/).first();
    await expect(answer).toHaveText('25.0%');

    // Stand where a reader stands when they reach the last control on the form.
    await page.getByLabel(/내 스택이 모자라서/).scrollIntoViewIfNeeded();
    await expect(result, '결과 left the screen at the foot of the form').toBeInViewport();
    await expect(answer, 'the answer left the screen at the foot of the form').toBeInViewport();

    // Change the bet from down there. A pot-sized bet into the default 10 BB pot makes the
    // final pot 10 + 10 + 10, and 10/30 is 33.3%.
    await page.getByRole('button', { name: '팟 사이즈' }).click();
    await expect(answer).toHaveText('33.3%');
    await expect(answer, 'the answer was not visible after the last tap').toBeInViewport();

    const box = await result.boundingBox();
    expect(box, 'the result panel must have a box').not.toBeNull();
    if (box === null) return;
    // On screen, and not so tall that there is no room left to type in.
    expect(box.y).toBeLessThan(667);
    expect(box.height).toBeLessThan(667 * 0.6);
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools/pot-odds'));
      // Exercise the widest state the page can reach: the short-stack field open and a long
      // three-decimal amount in every box.
      await page.getByLabel('지금 팟에 있는 돈').fill('1234.567');
      await page.getByLabel(/내 스택이 모자라서/).check();
      await expect(page.getByLabel('내가 실제로 낼 수 있는 금액')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
