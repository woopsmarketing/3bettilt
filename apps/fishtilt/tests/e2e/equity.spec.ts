import { expect, test } from '@playwright/test';
import { equityPendingMessages } from '../../src/features/tools/equity.js';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/tools/equity` — the equity calculator's critical path in a real browser.
 *
 * The property worth a browser test here, beyond the unit/component suites, is that a
 * beginner can pick real cards through real clicks and get the right percentages on the
 * same screen, that a card already chosen anywhere cannot be chosen again, that an
 * in-between board length is honestly blocked rather than silently computed, and that reset
 * and swap actually change what is on screen rather than merely hiding the old answer.
 */
test.describe('승률 계산기', () => {
  test('opens on a worked example already evaluated: AA vs KK preflop, and the three percentages sum to 100%', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/equity'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('승률 계산기');
    // Exact match: the page also has an explanation heading ("정확 계산이 무슨 뜻인가요?")
    // that legitimately contains this phrase as a substring — Playwright's default
    // substring match makes `getByText('정확 계산')` a strict-mode violation (two matches).
    // The method label's own text is exactly "정확 계산" with nothing appended, so `exact:
    // true` targets it unambiguously without touching the (unrelated) explanation heading.
    await expect(page.getByText('정확 계산', { exact: true })).toBeVisible();

    const percents = await page.getByText(/^\d{1,3}\.\d%$/).allTextContents();
    expect(percents).toHaveLength(3);
    const total = percents.reduce(
      (sum, text) => sum + Math.round(Number(text.replace('%', '')) * 10),
      0,
    );
    expect(total).toBe(1000);
  });

  test('a card chosen on one side is disabled everywhere else — no duplicate is possible', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/equity'));
    await page.getByRole('button', { name: '카드 초기화' }).click();

    const heroGroup = page.getByRole('group', { name: '내 핸드 카드 선택' });
    const villainGroup = page.getByRole('group', { name: '상대 핸드 카드 선택' });
    const boardGroup = page.getByRole('group', { name: '보드 카드 선택' });

    await heroGroup.getByRole('button', { name: '스페이드 Q 선택' }).click();

    const villainCopy = villainGroup.getByRole('button', { name: '스페이드 Q 사용됨' });
    await expect(villainCopy).toBeVisible();
    await expect(villainCopy).toBeDisabled();

    const boardCopy = boardGroup.getByRole('button', { name: '스페이드 Q 사용됨' });
    await expect(boardCopy).toBeDisabled();
  });

  test('an incomplete (1- or 2-card) board is blocked with a clear explanation, never silently computed', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/equity'));
    const boardGroup = page.getByRole('group', { name: '보드 카드 선택' });

    await boardGroup.getByRole('button', { name: '스페이드 2 선택' }).click();
    // DERIVED, not transcribed. This spec used to hold the sentence as a literal and went
    // stale the moment the site's 플랍 spelling canon reached this message — a whole gate run
    // spent on a copy edit the assertion was never about. What this spec owns is that the app
    // puts the module's refusal on screen; the wording belongs to `features/tools/equity.ts`
    // and is pinned by that module's own tests.
    // `heroNeeded: 0, villainNeeded: 0` so the ONLY message produced is the board one — the
    // function returns one message per unmet condition, and asking for just this condition is
    // what makes the assertion specific without naming the sentence.
    const boardMessages = equityPendingMessages({
      status: 'PENDING',
      heroNeeded: 0,
      villainNeeded: 0,
      boardInvalid: true,
      boardCount: 1,
    });
    expect(boardMessages, 'an invalid board length produces exactly one message').toHaveLength(1);
    // First sentence only — the legal-street list, which is what this assertion is about. The
    // rest names the current board count, which the next two assertions check as it changes.
    const legalStreets = (boardMessages[0] ?? '').split('. ')[0] ?? '';
    await expect(page.getByText(legalStreets, { exact: false })).toBeVisible();
    await expect(page.getByText(/지금 보드에 1장이 선택되어 있어서/)).toBeVisible();

    await boardGroup.getByRole('button', { name: '다이아몬드 3 선택' }).click();
    await expect(page.getByText(/지금 보드에 2장이 선택되어 있어서/)).toBeVisible();

    // A third card completes a legal flop — the block lifts and a real result appears.
    await boardGroup.getByRole('button', { name: '하트 4 선택' }).click();
    await expect(page.getByText('보드는 0장(프리플롭)', { exact: false })).not.toBeVisible();
    // See the worked-example test above: exact match avoids the strict-mode collision with
    // the "정확 계산이 무슨 뜻인가요?" explanation heading.
    await expect(page.getByText('정확 계산', { exact: true })).toBeVisible();
  });

  test('reset clears every picker back to an empty, incomplete state', async ({ page }) => {
    await page.goto(koPath('/tools/equity'));
    // Opens already evaluated (the worked example) — reset has something real to clear.
    await expect(page.getByText('정확 계산', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '카드 초기화' }).click();
    await expect(page.getByText('내 핸드 카드를 2장 더 선택해주세요.')).toBeVisible();
    await expect(page.getByText('상대 핸드 카드를 2장 더 선택해주세요.')).toBeVisible();

    const heroGroup = page.getByRole('group', { name: '내 핸드 카드 선택' });
    await expect(heroGroup.getByRole('button', { name: '스페이드 A 선택' })).toBeEnabled();
  });

  test('swap exchanges hero and opponent hands', async ({ page }) => {
    await page.goto(koPath('/tools/equity'));
    await page.getByRole('button', { name: '카드 초기화' }).click();

    const heroGroup = page.getByRole('group', { name: '내 핸드 카드 선택' });
    const villainGroup = page.getByRole('group', { name: '상대 핸드 카드 선택' });

    await heroGroup.getByRole('button', { name: '스페이드 A 선택' }).click();
    await heroGroup.getByRole('button', { name: '하트 A 선택' }).click();
    await villainGroup.getByRole('button', { name: '스페이드 K 선택' }).click();
    await villainGroup.getByRole('button', { name: '하트 K 선택' }).click();

    await page.getByRole('button', { name: '핸드 바꾸기' }).click();

    await expect(heroGroup.getByRole('button', { name: '스페이드 K 선택됨' })).toBeVisible();
    await expect(villainGroup.getByRole('button', { name: '스페이드 A 선택됨' })).toBeVisible();
  });

  test('is reachable from the tools hub, not only by typing the URL', async ({ page }) => {
    await page.goto(koPath('/tools'));
    // Scoped to the tool section: since WP-4 the hub also lists one prerequisite lesson
    // per tool, whose meta line names that tool, so two links on the page carry this
    // label in their accessible name. What is being proven is unchanged — the hub's own
    // tool card opens the tool.
    await page
      .getByRole('region', { name: '지금 사용할 수 있는 도구' })
      .getByRole('link', { name: /승률 계산기/ })
      .click();
    await expect(page).toHaveURL(koUrl('/tools/equity'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('승률 계산기');
  });

  test('hands the reader on to the pot odds calculator', async ({ page }) => {
    await page.goto(koPath('/tools/equity'));
    await page.getByRole('link', { name: '팟 오즈 계산기 열기' }).click();
    await expect(page).toHaveURL(koUrl('/tools/pot-odds'));
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools/equity'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools/equity'));
      // Exact match — see the worked-example test's comment above.
      await expect(page.getByText('정확 계산', { exact: true })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
