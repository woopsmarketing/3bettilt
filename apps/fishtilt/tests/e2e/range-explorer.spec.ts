import { expect, test } from '@playwright/test';
import { koPath, matrixCellName, positionButtonName, visibleBodyText } from './helpers.js';

/*
 * The Range Explorer's own critical-path E2E (build spec §68 E2E-2), kept in its own file
 * per the WP-D brief rather than folded into `home.spec.ts`.
 *
 * Flow: open the explorer -> select BTN -> select 100BB -> click a hand -> detail appears ->
 * compare with UTG -> the comparison changes.
 */
test.describe('Range Explorer', () => {
  test('the flagship flow: filter, select a hand, then compare positions', async ({ page }) => {
    await page.goto(koPath('/tools/range'));
    // WP-7a renamed this page's `<h1>` to the name the `<title>` and the `WebApplication`
    // block already used, so the page stops calling one object two things: it read
    // `13×13 핸드레인지` here and `핸드레인지 탐색기` in the tab.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('13×13 핸드레인지 표');

    // Start from a different position so clicking BTN is a real filter change, not a no-op
    // on an already-selected default.
    await page.getByRole('button', { name: positionButtonName('CO') }).click();
    await page.getByRole('button', { name: positionButtonName('BTN') }).click();
    await expect(page.getByRole('button', { name: positionButtonName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // WP-S3-19 (review B-M3) replaced the stack/spot buttons — four of which could only ever
    // be disabled — with the statement that says the same thing: this tool covers one
    // situation. The scope must still be on the page, and what is NOT covered must still be
    // written down, so assert the statement rather than a control that no longer exists.
    const conditions = page.locator('[data-range-conditions]');
    await expect(conditions).toContainText('100BB');
    await expect(conditions).toContainText('한 가지 상황만 다룹니다');
    await expect(conditions).toContainText('아직 지원하지 않습니다');
    await expect(conditions.getByRole('button')).toHaveCount(0);

    // Click a hand cell -> its detail appears.
    await page.getByRole('button', { name: matrixCellName('AKs', ',') }).click();
    await expect(page.getByText('에이스 킹 수티드')).toBeVisible();
    await expect(page.getByText('지금 보고 있는 레인지에 포함되어 있어요')).toBeVisible();

    // Enter Compare mode and pick SB first, so switching to UTG afterwards is an observable
    // change rather than a no-op against the default compare partner.
    await page.getByRole('button', { name: '다른 위치와 비교' }).click();
    const compareGroup = page.getByRole('group', { name: '비교할 위치' });
    await compareGroup.getByRole('button', { name: positionButtonName('SB') }).click();

    const diffSummary = page.getByText(/에만 있는 조합/);
    await expect(diffSummary).toBeVisible();
    const beforeText = await diffSummary.textContent();

    // Compare with UTG -> the comparison changes.
    await compareGroup.getByRole('button', { name: positionButtonName('UTG') }).click();
    await expect(
      compareGroup.getByRole('button', { name: positionButtonName('UTG') }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(diffSummary).not.toHaveText(beforeText ?? '');
  });

  test('the URL is shareable: filter state round-trips through the query string', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/range'));
    await page.getByRole('button', { name: positionButtonName('SB') }).click();
    await expect(page).toHaveURL(/[?&]hero=SB(&|$)/);
    await expect(page).toHaveURL(/[?&]spot=RFI(&|$)/);
    await expect(page).toHaveURL(/[?&]stack=100(&|$)/);

    await page.reload();
    await expect(page.getByRole('button', { name: positionButtonName('SB') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('"링크 복사" copies the current URL', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permission grants are Chromium-only.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(koPath('/tools/range?hero=CO&spot=RFI&stack=100'));
    await page.getByRole('button', { name: '링크 복사' }).click();
    await expect(page.getByText('링크를 복사했습니다.')).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('hero=CO');
  });

  test('an unsupported situation is named as unsupported, never offered and never a fabricated range', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/range'));
    // WP-S3-19 (review B-M3): the unshipped spots/stacks are no longer five disabled
    // buttons; the tool states its one supported situation and names the rest as text.
    // `exact`: the summary and the FAQ also carry "조건" inside their names.
    const conditions = page.getByRole('region', { name: '조건', exact: true });
    await expect(conditions).toContainText('6인 · 100BB · 아무도 참여하지 않았을 때 (First In)');
    await expect(conditions).toContainText('Facing Open');
    await expect(conditions).toContainText('지원하지 않습니다');
    await expect(page.getByRole('button', { name: /Facing Open/ })).toHaveCount(0);
    await expect(page.getByRole('button', { disabled: true })).toHaveCount(0);

    await page.getByRole('button', { name: positionButtonName('BB') }).click();
    // Scoped to the EXPLORER, not the page: WP-4 added a FAQ entry that answers the same
    // question with the same sentence, read from `UNSUPPORTED_REASON_LABEL` so the two can
    // never drift. What is being proven here is unchanged and now more precise — selecting BB
    // makes the TOOL ITSELF say why the table is empty, rather than drawing a borrowed range.
    const notice = page
      .getByRole('complementary')
      .filter({ hasText: '아직 준비되지 않았습니다' })
      .first();
    await expect(notice.getByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/)).toBeVisible();
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools/range'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  test('the 13x13 table tells a phone reader it scrolls, and says nothing on a desktop', async ({
    page,
  }) => {
    // The grid keeps 44px touch targets rather than shrinking to fit, so on a phone it is
    // cut off at the viewport edge. Unit tests cannot catch this: happy-dom has no layout,
    // so every element there is 0px wide and nothing ever overflows.
    const cue = page.getByText('표를 옆으로 밀면 나머지 칸도 볼 수 있어요.');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(koPath('/tools/range'));
    await expect(cue).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    // Nothing to swipe at this width, so the cue must not claim otherwise.
    await expect(cue).toHaveCount(0);
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools/range'));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
