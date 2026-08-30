import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { stackOf, startSession } from './helpers.js';

/**
 * Phase 7 — a COMPLETE practice hand entered by hand, in a real browser.
 *
 * What this proves that a component test cannot:
 *  - the whole Alpha path (session -> hole cards -> streets -> settlement -> COMPLETE)
 *    works in the shipped bundle;
 *  - card entry fires NO network request, so it is genuinely local and synchronous
 *    (`prompt` D1);
 *  - a physical card already in play is unavailable in every later palette.
 */

const startFiveHandedSession = (page: Page): Promise<void> =>
  startSession(page, {
    nicknames: ['P7 Hero', 'P7 Small', 'P7 Big', 'P7 Under', 'P7 Cutoff'],
    heroSeat: 0,
    buttonSeat: 0,
  });

test('enters a complete hand: hole cards, three streets, settlement', async ({ page }) => {
  const requests: string[] = [];
  await startFiveHandedSession(page);
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('pot')).toHaveText('2.3 BB');

  // --- hero hole cards: the palette opened itself, and closes on the second card ------
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '2');
  await expect(page.getByTestId('card-palette')).toContainText('내 카드');
  await expect(page.getByTestId('card-palette-remaining')).toHaveText('2장 남음');
  await page.getByTestId('palette-As').click();
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '1');
  await page.getByTestId('palette-Kd').click();
  await expect(page.getByTestId('card-palette')).toHaveCount(0);
  await expect(page.getByTestId('hero-cards')).toContainText('As');
  await expect(page.getByTestId('hero-cards')).toContainText('Kd');

  // --- preflop: F, F, R 9 Enter, C, C -----------------------------------------------
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'FOLDED');
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-4')).toHaveAttribute('data-status', 'FOLDED');

  await page.keyboard.press('r');
  await page.keyboard.type('9');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pot')).toHaveText('11.3 BB');
  await expect(stackOf(page, 0)).toHaveText('90.84 BB');

  await page.keyboard.press('c');
  await expect(page.getByTestId('pot')).toHaveText('19.8 BB');
  await page.keyboard.press('c');
  await expect(page.getByTestId('pot')).toHaveText('27.8 BB');

  // --- flop: the palette asks for exactly three, and As is gone from the deck --------
  await expect(page.getByTestId('phase')).toContainText('플랍 대기');
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '3');
  await expect(page.getByTestId('palette-As')).toBeDisabled();
  await expect(page.getByTestId('palette-Kd')).toBeDisabled();

  await page.getByTestId('palette-2c').click();
  await page.getByTestId('palette-7d').click();
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '1');
  await page.getByTestId('palette-9h').click();
  await expect(page.getByTestId('card-palette')).toHaveCount(0);
  await expect(page.getByTestId('board')).toContainText('2c');
  await expect(page.getByTestId('board')).toContainText('7d');
  await expect(page.getByTestId('board')).toContainText('9h');

  // --- three checks to the turn, one card, three checks to the river -----------------
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('턴 대기');
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '1');
  await expect(page.getByTestId('palette-2c')).toBeDisabled();
  await page.getByTestId('palette-3s').click();
  await expect(page.getByTestId('board')).toContainText('3s');

  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('리버 대기');
  await page.getByTestId('palette-4s').click();
  await expect(page.getByTestId('board')).toContainText('4s');

  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.keyboard.press('c');

  // --- settlement: the user picks the winner, the engine settles ---------------------
  await expect(page.getByTestId('phase')).toContainText('정산 대기');
  await expect(page.getByTestId('award-panel')).toBeVisible();
  await expect(page.getByTestId('award-panel')).toContainText('각 팟의 승자를 고르세요');
  await expect(page.getByTestId('award-amount-0')).toHaveText('27.8 BB');
  await page.getByTestId('award-seat-0-0').click();
  await page.getByTestId('award-submit').click();

  await expect(page.getByTestId('phase')).toContainText('완료');
  await expect(page.getByTestId('card-palette')).toHaveCount(0);
  await expect(page.getByTestId('award-panel')).toHaveCount(0);
  await expect(page.getByTestId('dock-N')).toBeEnabled();

  // The next hand asks for hole cards again: the palette's open/close rule is per hand,
  // not a one-shot.
  await page.keyboard.press('n');
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '2');
  await expect(page.getByTestId('palette-As')).toBeEnabled();

  expect(requests).toEqual([]);
});

test('the palette owns A and C while it is capturing, and the dock owns them otherwise', async ({
  page,
}) => {
  await startFiveHandedSession(page);
  await page.getByTestId('start-hand').click();

  // Focus the palette: it now owns the keyboard, so `a` is an ace and `c` is clubs.
  await page.getByTestId('card-palette').focus();
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-capturing', 'true');
  await page.keyboard.press('a');
  await page.keyboard.press('c');
  await expect(page.getByTestId('card-palette')).toContainText('Ac');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'IN_HAND');

  // Esc discards the unsubmitted pick without dispatching, and hands the keyboard back.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('card-palette')).toHaveCount(0);
  await expect(page.getByTestId('hero-cards')).not.toContainText('Ac');
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'FOLDED');
});

/** Everyone calls preflop and checks down: five seats, one main pot, five eligible. */
async function playToShowdown(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('플랍 대기');
  await page.getByTestId('palette-2c').click();
  await page.getByTestId('palette-7d').click();
  await page.getByTestId('palette-9h').click();

  for (let i = 0; i < 5; i += 1) await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('턴 대기');
  await page.getByTestId('palette-3s').click();

  for (let i = 0; i < 5; i += 1) await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('리버 대기');
  await page.getByTestId('palette-4s').click();

  for (let i = 0; i < 5; i += 1) await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('정산 대기');
}

test('a second hand starts with no winner ticked, and pays only the seat ticked now', async ({
  page,
}) => {
  await startFiveHandedSession(page);

  // --- hand 1: the pot goes to seat 3 ------------------------------------------------
  await page.getByTestId('start-hand').click();
  await playToShowdown(page);
  await page.getByTestId('award-seat-0-2').click();
  await expect(page.getByTestId('award-seat-0-2')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('award-submit').click();
  await expect(page.getByTestId('phase')).toContainText('완료');

  // --- hand 2: nothing is carried over ----------------------------------------------
  await page.keyboard.press('n');
  await playToShowdown(page);
  for (const seat of [0, 1, 2, 3, 4]) {
    await expect(page.getByTestId(`award-seat-0-${seat}`)).toHaveAttribute('aria-pressed', 'false');
  }

  const before = await Promise.all([0, 1, 2, 3, 4].map((seat) => stackOf(page, seat).innerText()));
  await page.getByTestId('award-seat-0-1').click();
  await page.getByTestId('award-submit').click();
  await expect(page.getByTestId('phase')).toContainText('완료');
  const after = await Promise.all([0, 1, 2, 3, 4].map((seat) => stackOf(page, seat).innerText()));

  const bb = (text: string): number => Number.parseFloat(text.replace(' BB', ''));
  // The seat the user ticked in hand 2 is paid...
  expect(bb(after[1]!)).toBeGreaterThan(bb(before[1]!));
  // ...and hand 1's winner is not paid again, nor split with.
  expect(after[2]).toBe(before[2]);
  expect(after[0]).toBe(before[0]);
  expect(after[3]).toBe(before[3]);
  expect(after[4]).toBe(before[4]);
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
});

test('a mouse click on a card leaves the palette owning the keyboard', async ({ page }) => {
  await startFiveHandedSession(page);
  await page.getByTestId('start-hand').click();

  // Untouched: the dock owns the keyboard and the header says so.
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-capturing', 'false');
  await expect(page.getByTestId('card-palette-owner')).toHaveText('키보드: 액션');

  // One real mouse click on a card. This is what used to leave focus on `<body>`.
  await page.getByTestId('palette-As').click();
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-capturing', 'true');
  await expect(page.getByTestId('card-palette-owner')).toHaveText('키보드: 카드 입력');

  // Esc still reaches the palette even though the dock's listener is suppressed...
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('card-palette')).toHaveCount(0);
  await expect(page.getByTestId('hero-cards')).not.toContainText('As');
  // ...and the dock has the keyboard back.
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'FOLDED');

  // Click one card, type the other: the palette is still listening after the click.
  await page.getByTestId('card-palette-open').click();
  await page.getByTestId('palette-As').click();
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '1');
  await page.keyboard.press('k');
  await page.keyboard.press('d');
  await expect(page.getByTestId('hero-cards')).toContainText('As');
  await expect(page.getByTestId('hero-cards')).toContainText('Kd');
  await expect(page.getByTestId('card-palette')).toHaveCount(0);

  // The dock owns the keyboard again the moment the palette has what it asked for.
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-4')).toHaveAttribute('data-status', 'FOLDED');

  // --- mid-board: click one of three flop cards, type the other two ------------------
  await page.keyboard.press('c'); // button calls
  await page.keyboard.press('c'); // small blind completes
  await page.keyboard.press('c'); // big blind checks
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '3');

  await page.getByTestId('palette-2c').click();
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-capturing', 'true');
  await page.keyboard.press('7');
  await page.keyboard.press('d');
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '1');
  await page.keyboard.press('9');
  await page.keyboard.press('h');
  await expect(page.getByTestId('board')).toContainText('2c');
  await expect(page.getByTestId('board')).toContainText('7d');
  await expect(page.getByTestId('board')).toContainText('9h');
  await expect(page.getByTestId('card-palette')).toHaveCount(0);
});

test('negative control: an open but untouched palette leaves A to the dock', async ({ page }) => {
  await startFiveHandedSession(page);
  await page.getByTestId('start-hand').click();

  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-needed', '2');
  await expect(page.getByTestId('card-palette')).toHaveAttribute('data-capturing', 'false');
  await page.keyboard.press('a');

  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'ALL_IN');
});
