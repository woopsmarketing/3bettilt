import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { foldOut, handNumber, recordServerActions, startSession } from './helpers.js';

/**
 * The ACTIVE <-> SITTING_OUT seat toggle, in a real browser, under the V2 contract.
 *
 * ADR-0073 replaced this feature's original promise. Sitting a seat out used to mean "from the
 * next hand" — the live hand had snapshotted its lineup and could not observe the change — and
 * this file used to assert exactly that: the pending 다음 핸드부터 label, the seat still dealt
 * into the live hand, and nothing at all reaching the server. All three are now WRONG, and each
 * one is replaced below by the stronger claim the new contract makes:
 *
 *  - the change is applied AT ONCE and the live hand is REBASED — discarded whole and re-dealt
 *    from the corrected lineup, so the seat is not dealt in any more;
 *  - the rebase is a CORRECTION and not a skip, so `handNumber` does not move, the button does
 *    not rotate, and no seat is marked 확인 필요;
 *  - the discarded hand is never silent: `hand-rebased-notice` says so and can be dismissed;
 *  - the toggle persists through the ONE narrow occupancy write (ADR-0075) and does not also
 *    fire the whole-table seat sync.
 *
 * Every control is addressed by `data-testid`, never by copy (`helpers.ts`).
 */

const startFourHandedSession = (page: Page): Promise<void> =>
  startSession(page, {
    nicknames: ['A1 Hero', 'A1 Two', 'A1 Three', 'A1 Four'],
    heroSeat: 0,
    buttonSeat: 0,
  });

test('a seat sat out mid-hand REBASES the live hand at the same hand number', async ({ page }) => {
  await startFourHandedSession(page);
  await page.getByTestId('start-hand').click();

  // Seat 3 is genuinely part of the hand on screen, and there IS a hand on screen.
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('skip-hand')).toBeEnabled();
  const handBefore = await handNumber(page);
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  // 3-handed and 4-handed post the same blinds, so the pot alone cannot show the re-deal.
  // Who is DEALT IN can, and that is what is asserted below.

  const posts = recordServerActions(page);

  // Toggled MID-HAND. There is no longer a pending state for it to be in.
  await page.getByTestId('seat-3-occupancy-toggle').click();
  await expect(page.getByTestId('seat-3-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  await expect(page.getByTestId('seat-3-occupancy-state')).toHaveText('켬');

  // ADR-0073: the hand was rebuilt from the corrected lineup, AT ONCE. Seat 3 holds no cards
  // in the hand that is on screen right now — not in some later one.
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-1')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('engine-error')).toHaveCount(0);

  // A CORRECTION, not a skip: same hand number, same button, no seat left 확인 필요, and a
  // live hand still in progress to play.
  expect(await handNumber(page)).toBe(handBefore);
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  for (const seat of [0, 1, 2, 3]) {
    await expect(page.getByTestId(`seat-${seat}`)).toHaveAttribute('data-dirty', 'false');
    await expect(page.getByTestId(`seat-${seat}-dirty`)).toHaveCount(0);
  }
  await expect(page.getByTestId('skip-hand')).toBeEnabled();

  // The discarded hand is announced rather than swallowed, and the notice is dismissable.
  await expect(page.getByTestId('hand-rebased-notice')).toBeVisible();
  await page.getByTestId('hand-rebased-dismiss').click();
  await expect(page.getByTestId('hand-rebased-notice')).toHaveCount(0);

  // ADR-0075 §4: occupancy is persisted through `updateSeatOccupancyAction` — the ONE narrow
  // column write — and the toggle does NOT also fire the whole-table `syncSessionSeatsAction`.
  // Two round trips here would mean a second writer appeared on this path.
  await expect.poll(() => posts.length).toBeGreaterThan(0);
  await page.waitForLoadState('networkidle');
  expect(posts).toHaveLength(1);

  // The rebased hand is a real, playable hand: 3-handed, so two folds end it uncontested.
  await foldOut(page, 2);
  await expect(page.getByTestId('start-hand')).toBeEnabled();
});

/**
 * R1/B2 in a real browser: the seat wearing the BTN badge is the most natural one to sit
 * out, and before the fix doing it before the first deal bricked the table for the life of
 * the page (`NO_BUTTON_SEAT` on every Start Hand). The button now stays put through the
 * toggle and moves clockwise when the hand is actually dealt.
 */
test('sitting the BUTTON seat out before the first deal still deals, with the button moved on', async ({
  page,
}) => {
  await startSession(page, {
    nicknames: ['A1 Hero', 'A1 Two', 'A1 Three', 'A1 Four'],
    heroSeat: 0,
    buttonSeat: 1,
  });
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');

  // The button seat sits out, before anything has been dealt. The button does not vanish, and
  // with no hand in progress there is nothing to rebase, so nothing is announced.
  await page.getByTestId('seat-1-occupancy-toggle').click();
  await expect(page.getByTestId('seat-1-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('hand-rebased-notice')).toHaveCount(0);

  await page.getByTestId('start-hand').click();

  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'false');
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
});

/**
 * The other direction of the same rebase: a player who comes BACK mid-hand is dealt into the
 * hand that is on screen, not into some later one.
 */
test('a sitting-out player who returns is rebased INTO the live hand', async ({ page }) => {
  await startFourHandedSession(page);

  // Sat out BEFORE any hand is dealt: hand 1 deals three-handed from the start.
  await page.getByTestId('seat-3-occupancy-toggle').click();
  await expect(page.getByTestId('seat-3-occupancy')).toHaveAttribute('data-sitting-out', 'true');

  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  const handBefore = await handNumber(page);

  // The player returns MID-HAND. The hand is rebuilt with them in it, at the same hand number
  // and on the same button — the seat they came back to is dealt in RIGHT NOW.
  await page.getByTestId('seat-3-occupancy-toggle').click();
  await expect(page.getByTestId('seat-3-occupancy')).toHaveAttribute('data-sitting-out', 'false');
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('hand-rebased-notice')).toBeVisible();
  expect(await handNumber(page)).toBe(handBefore);
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-dirty', 'false');

  // Four-handed again, so three folds end it, and the NEXT hand still includes seat 3.
  await foldOut(page, 3);
  await expect(page.getByTestId('start-hand')).toBeEnabled();
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
});
