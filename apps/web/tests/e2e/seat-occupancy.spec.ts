import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startSession } from './helpers.js';

/**
 * Work Package A1 — the between-hands ACTIVE <-> SITTING_OUT seat toggle, in a real browser.
 *
 * The two things this proves that `TableRoot.test.tsx` and `tableStore.test.ts` cannot on
 * their own: the toggle really survives a real page (no network request on the toggle's own
 * click path — persistence, when it exists, is unawaited), and a hand actually dealt from
 * the felt reflects the new lineup, not just the store's in-memory state.
 *
 * Every control is addressed by `data-testid`, never by copy (`helpers.ts`).
 */

const startFourHandedSession = (page: Page): Promise<void> =>
  startSession(page, {
    nicknames: ['A1 Hero', 'A1 Two', 'A1 Three', 'A1 Four'],
    heroSeat: 0,
    buttonSeat: 0,
  });

/** Folds the current actor `count` times, mirroring how `action-dock.spec.ts` ends a hand. */
async function foldOut(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await page.getByTestId('dock-F').click();
  }
}

test('a seat sat out mid-hand deals one fewer seat on the NEXT hand, leaving the live hand untouched', async ({
  page,
}) => {
  await startFourHandedSession(page);
  await page.getByTestId('start-hand').click();

  // Seat 3 is genuinely part of hand 1.
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  const potBefore = await page.getByTestId('pot').textContent();

  // Toggled MID-HAND. The toggle says so: this hand still has the seat dealt in.
  await page.getByTestId('seat-3-occupancy-toggle').click();
  await expect(page.getByTestId('seat-3-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  await expect(page.getByTestId('seat-3-occupancy-state')).toContainText('다음 핸드부터');

  // The LIVE hand is provably unaffected: still dealt in, and no network request fired.
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  expect(await page.getByTestId('pot').textContent()).toBe(potBefore);

  // Finish hand 1: three folds ends a four-handed hand uncontested.
  await foldOut(page, 3);
  await expect(page.getByTestId('start-hand')).toBeEnabled();

  // Hand 2 deals one fewer seat. Seat 3 receives no cards, no blinds, nothing.
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-1')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  // The toggle no longer claims to be pending: there is no hand holding it up anymore.
  await expect(page.getByTestId('seat-3-occupancy-state')).toContainText('켬');

  expect(requests).toEqual([]);
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

  // The button seat sits out, before anything has been dealt. The button does not vanish.
  await page.getByTestId('seat-1-occupancy-toggle').click();
  await expect(page.getByTestId('seat-1-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');

  await page.getByTestId('start-hand').click();

  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'false');
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
});

test('a sitting-out player who returns is included in the following hand', async ({ page }) => {
  await startFourHandedSession(page);

  // Sat out BEFORE any hand is dealt: hand 1 deals three-handed from the start.
  await page.getByTestId('seat-3-occupancy-toggle').click();
  await expect(page.getByTestId('seat-3-occupancy')).toHaveAttribute('data-sitting-out', 'true');

  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'NOT_DEALT_IN');

  // The player returns mid-hand 1. Seat 3 was never dealt into THIS hand, so there is
  // nothing for the toggle to hold up — the change is not "pending" anything.
  await page.getByTestId('seat-3-occupancy-toggle').click();
  await expect(page.getByTestId('seat-3-occupancy')).toHaveAttribute('data-sitting-out', 'false');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'NOT_DEALT_IN');

  // Finish hand 1: two folds ends a three-handed hand uncontested.
  await foldOut(page, 2);
  await expect(page.getByTestId('start-hand')).toBeEnabled();

  // Hand 2 includes seat 3 again.
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-3')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
});
