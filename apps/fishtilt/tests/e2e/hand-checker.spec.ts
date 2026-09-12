import { expect, test } from '@playwright/test';
import { makeCard } from '@gto-self/shared';
import { evaluateHandRank } from '../../src/features/tools/handRank.js';
import { koPath, koUrl, visibleBodyText } from './helpers.js';

/*
 * `/tools/hand-checker` — the calculator's critical path in a real browser.
 *
 * The property worth a browser test here, beyond the unit/component suites, is that a
 * beginner can pick real cards through real clicks and get the right answer on the same
 * screen, that a card already chosen anywhere cannot be chosen again, and that resetting
 * actually clears the board rather than merely hiding the old answer.
 */
test.describe('핸드 체커', () => {
  test('opens on a worked example already evaluated: two pair, aces and kings', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/hand-checker'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('핸드 체커');
    await expect(page.getByText('에이스와 킹 투페어')).toBeVisible();
    await expect(page.getByText('9개 족보 중 7번째로 강한 족보입니다.')).toBeVisible();
  });

  test('picking a full house through real clicks names both ranks in order', async ({ page }) => {
    await page.goto(koPath('/tools/hand-checker'));
    await page.getByRole('button', { name: '카드 초기화' }).click();

    const holeGroup = page.getByRole('group', { name: '핸드 카드 선택' });
    const boardGroup = page.getByRole('group', { name: '보드 카드 선택' });

    await holeGroup.getByRole('button', { name: '하트 A 선택' }).click();
    await holeGroup.getByRole('button', { name: '다이아몬드 A 선택' }).click();
    await boardGroup.getByRole('button', { name: '스페이드 A 선택' }).click();
    await boardGroup.getByRole('button', { name: '클럽 K 선택' }).click();
    await boardGroup.getByRole('button', { name: '다이아몬드 K 선택' }).click();

    await expect(page.getByText('풀하우스', { exact: true })).toBeVisible();
    await expect(page.getByText('에이스 풀하우스, 킹 포함')).toBeVisible();

    // The best five, shown on their own, isolated from anything not used.
    await expect(page.getByRole('group', { name: '카드', exact: true })).toBeVisible();
  });

  test('a card chosen on one side is disabled on the other — no duplicate is possible', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/hand-checker'));
    await page.getByRole('button', { name: '카드 초기화' }).click();

    const holeGroup = page.getByRole('group', { name: '핸드 카드 선택' });
    const boardGroup = page.getByRole('group', { name: '보드 카드 선택' });

    await holeGroup.getByRole('button', { name: '스페이드 Q 선택' }).click();
    const boardCopy = boardGroup.getByRole('button', { name: '스페이드 Q 사용됨' });
    await expect(boardCopy).toBeVisible();
    await expect(boardCopy).toBeDisabled();
  });

  test('reset clears both pickers back to an empty, incomplete state', async ({ page }) => {
    await page.goto(koPath('/tools/hand-checker'));
    const holeGroup = page.getByRole('group', { name: '핸드 카드 선택' });
    // Opens already evaluated (the worked example) — reset has something real to clear.
    await expect(page.getByText('에이스와 킹 투페어')).toBeVisible();

    await page.getByRole('button', { name: '카드 초기화' }).click();
    await expect(page.getByText('카드를 더 선택하면 족보를 확인할 수 있어요.')).toBeVisible();
    await expect(page.getByText(/지금은 0장을 골랐습니다/)).toBeVisible();
    // Every card is selectable again on both sides.
    await expect(holeGroup.getByRole('button', { name: '하트 A 선택' })).toBeEnabled();
  });

  test('says the board plays alone when the board already beats both hole cards', async ({
    page,
  }) => {
    await page.goto(koPath('/tools/hand-checker'));
    await page.getByRole('button', { name: '카드 초기화' }).click();

    const holeGroup = page.getByRole('group', { name: '핸드 카드 선택' });
    const boardGroup = page.getByRole('group', { name: '보드 카드 선택' });

    await holeGroup.getByRole('button', { name: '스페이드 2 선택' }).click();
    await holeGroup.getByRole('button', { name: '다이아몬드 3 선택' }).click();
    await boardGroup.getByRole('button', { name: '하트 T 선택' }).click();
    await boardGroup.getByRole('button', { name: '하트 J 선택' }).click();
    await boardGroup.getByRole('button', { name: '하트 Q 선택' }).click();
    await boardGroup.getByRole('button', { name: '하트 K 선택' }).click();
    await boardGroup.getByRole('button', { name: '하트 A 선택' }).click();

    await expect(page.getByText('로열 플러시 (Royal Flush)')).toBeVisible();

    // DERIVED, not transcribed — the same correction WP-Q2 made to `HandChecker.test.tsx`.
    // This spec held the note as a literal and so kept asserting the sentence WP-P1's F11
    // removed for being FALSE: when the board plays, the board IS the player's hand, so it
    // cannot be "stronger than" it. A transcribed assertion does not just go stale, it pins
    // the defect. The note's wording belongs to `features/tools/handRank.ts` and is pinned
    // there; what this spec owns is that the page actually renders it.
    const evaluated = evaluateHandRank(
      [makeCard('2', 's'), makeCard('3', 'd')],
      [
        makeCard('T', 'h'),
        makeCard('J', 'h'),
        makeCard('Q', 'h'),
        makeCard('K', 'h'),
        makeCard('A', 'h'),
      ],
    );
    if (evaluated.status === 'INCOMPLETE') throw new Error('fixture: seven cards must evaluate');
    expect(evaluated.note, 'the board-plays case must carry a teaching note').not.toBeNull();
    await expect(page.getByText(evaluated.note ?? '')).toBeVisible();
  });

  test('is reachable from the site navigation, not only by typing the URL', async ({ page }) => {
    await page.goto(koPath('/tools'));
    // Scoped to the tool section: since WP-4 the hub also lists one prerequisite lesson
    // per tool, whose meta line names that tool, so two links on the page carry this
    // label in their accessible name. What is being proven is unchanged — the hub's own
    // tool card opens the tool.
    await page
      .getByRole('region', { name: '지금 사용할 수 있는 도구' })
      .getByRole('link', { name: /핸드 체커/ })
      .click();
    await expect(page).toHaveURL(koUrl('/tools/hand-checker'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('핸드 체커');
  });

  test('hands the reader on to the outs calculator', async ({ page }) => {
    await page.goto(koPath('/tools/hand-checker'));
    await page.getByRole('link', { name: '아웃 계산기 열기' }).click();
    await expect(page).toHaveURL(koUrl('/tools/outs'));
  });

  test('never mentions GTO', async ({ page }) => {
    await page.goto(koPath('/tools/hand-checker'));
    expect(await visibleBodyText(page)).not.toContain('GTO');
  });

  for (const width of [390, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(koPath('/tools/hand-checker'));
      await expect(page.getByText('에이스와 킹 투페어')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
