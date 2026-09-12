import { expect, test } from '@playwright/test';
import { koPath, koUrl, matrixCellName, visibleBodyText } from './helpers.js';

/*
 * `/tools/starting-hand` — the Starting Hand Explorer's critical path in a real browser
 * (WP-E2). The properties worth a browser test here, beyond the unit/component suites: the
 * full 169-cell matrix actually renders in a real DOM, the slider is a real, keyboard-
 * reachable control that changes the highlighted set live, the ranking is right at both
 * extremes (AA strongest, included at the smallest slider position; the weakest classes only
 * appear once the slider reaches 100%), clicking a cell shows a real detail panel, and the
 * 13x13 grid does not break the page layout on a phone — the same check
 * `range-explorer.spec.ts` and `hand-checker.spec.ts` already run for their own matrices.
 */
test.describe('시작 핸드 탐색기', () => {
  test('opens on "상위 X% 보기" at 15%, with all 169 cells rendered', async ({ page }) => {
    await page.goto(koPath('/tools/starting-hand'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '169개 시작 패, 강한 순서로 보기',
    );

    const modeToggle = page.getByRole('button', { name: '상위 X% 보기' });
    await expect(modeToggle).toHaveAttribute('aria-pressed', 'true');

    const slider = page.getByRole('slider');
    await expect(slider).toHaveValue('15');

    // Every one of the 169 classes renders as a real button, whichever side of the cut it
    // falls on — the matrix never hides a class, it only marks membership.
    const cells = page.getByRole('button', { name: /^[2-9TJQKA]{2}[so]? .+, 레인지/u });
    await expect(cells).toHaveCount(169);
  });

  test('rank ordering is right at the extremes: AA is included at the smallest slider position, 32o only at 100%', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/starting-hand'));
    const slider = page.getByRole('slider');

    await slider.fill('1');
    await expect(
      page.getByRole('button', { name: matrixCellName('AA', ', 레인지 포함') }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: matrixCellName('32o', ', 레인지 밖') }),
    ).toBeVisible();

    await slider.fill('100');
    await expect(
      page.getByRole('button', { name: matrixCellName('32o', ', 레인지 포함') }),
    ).toBeVisible();
  });

  test('moving the slider with the keyboard changes the highlighted set live', async ({ page }) => {
    await page.goto(koPath('/tools/starting-hand'));
    const slider = page.getByRole('slider');
    await slider.focus();

    // At 15% the weakest included class is A6s (rank 31); the next-ranked class, A8o
    // (rank 32), is the first one excluded — verified against the shipped dataset.
    await expect(
      page.getByRole('button', { name: matrixCellName('A6s', ', 레인지 포함') }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: matrixCellName('A8o', ', 레인지 밖') }),
    ).toBeVisible();

    // ArrowUp on a range input increases its value by one step (1%).
    for (let i = 0; i < 15; i += 1) await page.keyboard.press('ArrowUp');
    await expect(slider).toHaveValue('30');
    await expect(
      page.getByRole('button', { name: matrixCellName('A8o', ', 레인지 포함') }),
    ).toBeVisible();
  });

  test('selecting a hand shows its rank, top-share and equity in the detail panel', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/starting-hand'));
    await page.getByRole('button', { name: matrixCellName('AA', ',') }).click();

    // Scoped to the result panel: since WP-S3-14 the guide under the tool prints the same
    // dataset rows (AA's reading, rank and equity), so a page-wide probe would be ambiguous.
    const panel = page.getByRole('region', { name: '선택한 패' });
    await expect(panel.getByText('포켓 에이스')).toBeVisible();
    await expect(panel.getByText('169개 중 1위')).toBeVisible();
    await expect(panel.getByText('상위 0.45%')).toBeVisible();
    await expect(panel.getByText('85.20%')).toBeVisible();
  });

  test('switching to "강한 패 순서" hides the slider and shows every class unhighlighted', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/starting-hand'));
    await page.getByRole('button', { name: '강한 패 순서' }).click();

    await expect(page.getByRole('slider')).toHaveCount(0);
    await expect(page.getByRole('button', { name: matrixCellName('AA') })).toBeVisible();
  });

  test('is reachable from /tools, not only by typing the URL', async ({ page }) => {
    await page.goto(koPath('/tools'));
    // Scoped to the tool section: since WP-4 the hub also lists one prerequisite lesson
    // per tool, whose meta line names that tool, so two links on the page carry this
    // label in their accessible name. What is being proven is unchanged — the hub's own
    // tool card opens the tool.
    await page
      .getByRole('region', { name: '지금 사용할 수 있는 도구' })
      .getByRole('link', { name: /시작 핸드 탐색기/ })
      .click();
    await expect(page).toHaveURL(koUrl('/tools/starting-hand'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '169개 시작 패, 강한 순서로 보기',
    );
  });

  test('hands the reader on to the Equity Calculator and the Range Explorer', async ({ page }) => {
    await page.goto(koPath('/tools/starting-hand'));
    await expect(page.getByRole('link', { name: '승률 계산기 열기' })).toHaveAttribute(
      'href',
      koPath('/tools/equity'),
    );
    await expect(page.getByRole('link', { name: '핸드레인지 표 열기' })).toHaveAttribute(
      'href',
      koPath('/tools/range'),
    );
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools/starting-hand'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools/starting-hand'));
      await expect(page.getByRole('slider')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
