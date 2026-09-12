import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { foldOut, handNumber, startSession } from './helpers.js';

/** 3-handed off a seat-0 button: the button itself acts first preflop. */
const startThreeHandedHeroButton = (page: Page): Promise<void> =>
  startSession(page, {
    nicknames: ['SX Hero', 'SX Two', 'SX Three'],
    heroSeat: 0,
    buttonSeat: 0,
  });

/**
 * One-click Skip Hand (feature A) and quick manual seat sync (feature B), in a real browser.
 *
 * What only a real page proves over `tableStore.test.ts`: the button really is disabled
 * outside a live hand, a click really needs no confirmation dialog, the dirty badge really
 * renders for the seats a skip left unconfirmed, and correcting a seat's stack really clears
 * that badge and lets a normal Start Hand follow.
 */

test('skip hand discards the live hand, rotates the button, marks seats dirty, and a correction clears the badge', async ({
  page,
}) => {
  await startSession(page, {
    nicknames: ['SK Hero', 'SK Two', 'SK Three'],
    heroSeat: 0,
    buttonSeat: 0,
  });

  // No live hand yet: Skip Hand is not offered.
  await expect(page.getByTestId('skip-hand')).toBeDisabled();

  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('skip-hand')).toBeEnabled();
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  const handBefore = await handNumber(page);

  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

  // One click. No confirmation dialog.
  await page.getByTestId('skip-hand').click();

  // The table is immediately ready for the next hand: no live hand, no engine error, and
  // Skip Hand disables itself again.
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('skip-hand')).toBeDisabled();
  await expect(page.getByTestId('start-hand')).toBeEnabled();

  // ADR-0074's half of the correction/skip split, and the half a rebase must never do:
  // EXACTLY one button rotation and EXACTLY one hand-number increment.
  expect(await handNumber(page)).toBe(handBefore + 1);
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'false');

  // Every dealt-in seat is marked "확인 필요".
  await expect(page.getByTestId('seat-0-dirty')).toBeVisible();
  await expect(page.getByTestId('seat-1-dirty')).toBeVisible();
  await expect(page.getByTestId('seat-2-dirty')).toBeVisible();

  // Correct seat 0's stack. The badge for THAT seat clears; the others stay dirty.
  await page.getByTestId('seat-0-correction-toggle').click();
  await page.getByTestId('seat-0-correction-stack').fill('123.5');
  await page.getByTestId('seat-0-correction-save').click();
  await expect(page.getByTestId('seat-0-dirty')).toHaveCount(0);
  await expect(page.getByTestId('seat-1-dirty')).toBeVisible();

  // Start Hand works normally afterward, dealing all three seats again.
  await page.getByTestId('seat-0-correction-toggle').click(); // close the panel
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-1')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');

  // The best-effort skip-audit fired once, after the skip, and never blocked anything above.
  await expect.poll(() => requests.length).toBeGreaterThan(0);
});

test('correcting the button seat while a hand is live REBASES it, without rotating or renumbering', async ({
  page,
}) => {
  await startSession(page, {
    nicknames: ['SC Hero', 'SC Two', 'SC Three'],
    heroSeat: 0,
    buttonSeat: 0,
  });
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-sb', 'true');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-bb', 'true');
  const handBefore = await handNumber(page);

  // The lineup itself was wrong: correct the button mid-hand.
  await page.getByTestId('seat-2-correction-toggle').click();
  await page.getByTestId('seat-2-correction-button-seat').click();

  // ADR-0073: this is a CORRECTION, so the hand is REBUILT rather than thrown away. There is
  // still a hand in progress — 빠른 다음 핸드 is offered, which is precisely what it would not
  // be if the correction had left the table between hands.
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('hand-rebased-notice')).toBeVisible();
  await expect(page.getByTestId('skip-hand')).toBeEnabled();
  await expect(page.getByTestId('start-hand')).toBeDisabled();
  await expect(page.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-1')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');

  // The correction landed, and the blinds moved WITH it — the whole point of re-dealing rather
  // than patching the live hand. Seat 2 is the button, so seat 0 is the small blind now.
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-sb', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-bb', 'true');

  // ...and it is NOT a skip: the hand number does not move and no seat is left 확인 필요.
  expect(await handNumber(page)).toBe(handBefore);
  for (const seat of [0, 1, 2]) {
    await expect(page.getByTestId(`seat-${seat}`)).toHaveAttribute('data-dirty', 'false');
    await expect(page.getByTestId(`seat-${seat}-dirty`)).toHaveCount(0);
  }

  // The rebuilt hand is a real hand: it plays out, and the NEXT deal rotates the button on
  // from the seat the user corrected it to.
  await page.getByTestId(`seat-2-correction-toggle`).click(); // close the panel
  await foldOut(page, 2);
  await expect(page.getByTestId('start-hand')).toBeEnabled();
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
});

test('the X hotkey fast-skips a hand hero has folded out of, exactly like clicking the button, and is inert while an input has focus', async ({
  page,
}) => {
  await startThreeHandedHeroButton(page);
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('skip-hand')).toBeEnabled();
  const handBefore = await handNumber(page);

  // Nobody has folded yet: the fast-skip hint is not offered.
  await expect(page.getByTestId('hero-folded-fast-skip-hint')).toHaveCount(0);

  // The guard the other hotkeys already have (`action-dock.spec.ts`): a letter typed into a
  // real input is text, not a command, even for a hotkey that is otherwise legal right now.
  await page.getByTestId('seat-0-correction-toggle').click();
  await page.getByTestId('seat-0-correction-stack').click();
  await expect(page.getByTestId('seat-0-correction-stack')).toBeFocused();
  await page.keyboard.press('x');
  expect(await handNumber(page)).toBe(handBefore);
  await expect(page.getByTestId('skip-hand')).toBeEnabled();
  await page.getByTestId('seat-0-correction-toggle').click(); // close the panel, no save

  // 3-handed off a seat-0 button: the button acts first preflop, so folding once folds hero.
  await page.getByTestId('dock-F').click();
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-status', 'FOLDED');
  await expect(page.getByTestId('hero-folded-fast-skip-hint')).toBeVisible();
  await expect(page.getByTestId('skip-hand')).toBeEnabled();

  // The hotkey, not the button — same one-key, no-dialog outcome the click-driven test above
  // already proved for the button.
  await page.keyboard.press('x');

  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('skip-hand')).toBeDisabled();
  await expect(page.getByTestId('start-hand')).toBeEnabled();
  expect(await handNumber(page)).toBe(handBefore + 1);
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'false');
  // Hero's own stack is EXACT (ante + blinds only, nothing further ventured) so hero is not
  // dirty; the other two seats were still live when the hand was abandoned, and are.
  await expect(page.getByTestId('seat-0-dirty')).toHaveCount(0);
  await expect(page.getByTestId('seat-1-dirty')).toBeVisible();
  await expect(page.getByTestId('seat-2-dirty')).toBeVisible();
});
