import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { startSession } from './helpers.js';

/**
 * 기본전략 · REFERENCE in a real browser, driven from the keyboard through a whole hand.
 *
 * What this suite proves that a component test cannot:
 *  - the panel is populated on every street of one continuously driven hand, from a real
 *    session created through the real setup form;
 *  - the analysis fires NO network request — the strategy path is as local as the action
 *    path (ADR-0043), and the captured request list is asserted empty;
 *  - the action dock stays interactive while the panel is populated, and typing into the
 *    raise editor is not delayed by the analysis.
 *
 * Everything is addressed by `data-testid` and by the structured `data-*` attributes the
 * panel exposes, never by copy — the Korean copy is asserted once, deliberately, in
 * `session-setup.spec.ts` and once here for the engine's own name.
 *
 * Determinism: every card is clicked out of the palette and every size is typed, so the
 * same recommendation is produced on every run.
 */

const panel = (page: Page): Locator => page.getByTestId('strategy-panel');
const percentOf = (page: Page, kind: string): Locator =>
  page.getByTestId(`strategy-action-${kind}`);

/** Six seats so every position exists; the button is seat 0, so SB=1 BB=2 UTG=3 HJ=4 CO=5. */
async function startSixHanded(page: Page, heroSeat: number): Promise<void> {
  await startSession(page, {
    nicknames: ['S Btn', 'S Small', 'S Big', 'S Under', 'S Jack', 'S Cut'],
    heroSeat,
    buttonSeat: 0,
  });
  await page.getByTestId('start-hand').click();
}

/** Clicks cards out of the palette. The palette closes itself once it has what it asked for. */
async function enterCards(page: Page, cards: readonly string[]): Promise<void> {
  for (const card of cards) await page.getByTestId(`palette-${card}`).click();
}

/** `R` -> type -> `Enter`. The engine validates the size; nothing here computes one. */
async function raiseTo(page: Page, amount: string): Promise<void> {
  await page.keyboard.press('r');
  await expect(page.getByTestId('raise-input')).toBeFocused();
  await page.keyboard.type(amount);
  await page.keyboard.press('Enter');
}

/** Waits for the scheduled analysis to land rather than reading a half-computed panel. */
async function readyPanel(page: Page): Promise<Locator> {
  const located = panel(page);
  await expect(located).toHaveAttribute('data-state', 'READY');
  await expect(located).toHaveAttribute('data-stale', 'false');
  return located;
}

test('a 6-handed button open shows the RFI recommendation with a raise-TO size', async ({
  page,
}) => {
  await startSixHanded(page, 0);
  await enterCards(page, ['Ah', 'Kh']);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('f');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');

  const strategy = await readyPanel(page);
  await expect(strategy).toHaveAttribute('data-street', 'PREFLOP');
  await expect(strategy).toHaveAttribute('data-family', 'RFI');
  await expect(strategy).toHaveAttribute('data-primary', 'RAISE');
  await expect(page.getByTestId('strategy-engine-label')).toHaveText('기본전략 · REFERENCE');
  await expect(page.getByTestId('strategy-position')).toHaveText('BTN');
  await expect(page.getByTestId('strategy-hand-class')).toHaveText('AKs');

  // The aggressive row is named from the spot, and the frequency is a whole percent.
  await expect(percentOf(page, 'RAISE')).toHaveAttribute('data-name', 'OPEN');
  await expect(percentOf(page, 'RAISE')).toHaveAttribute('data-percent', '100');
  await expect(page.getByTestId('strategy-frequency-RAISE')).toHaveText('100%');
  await expect(page.getByTestId('strategy-primary-badge')).toHaveText('추천');

  // Raise-TO in BB, exactly as `docs/UX.md` specifies.
  await expect(page.getByTestId('strategy-sizing')).toContainText('추천 사이즈 OPEN TO 2.5 BB');

  // ACTUAL beside MODEL, always.
  await expect(page.getByTestId('strategy-actual-stack')).toContainText('유효 스택');
  await expect(page.getByTestId('strategy-model-bucket')).toHaveText('80-119 BB');
  // `CLAUDE.md` rule 2: the label reserved for solved output is nowhere on the page.
  await expect(page.locator('body')).not.toContainText('GTO');
});

test('facing a button open, the big blind sees a full fold / call / 3BET mix', async ({
  page,
}) => {
  await startSixHanded(page, 2);
  await enterCards(page, ['Ah', '5h']);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('f');
  await raiseTo(page, '2.5');
  await page.keyboard.press('f'); // the small blind folds
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-actor', 'true');

  const strategy = await readyPanel(page);
  await expect(strategy).toHaveAttribute('data-family', 'VS_OPEN');
  await expect(page.getByTestId('strategy-hand-class')).toHaveText('A5s');

  // Mixed strategies are never hidden: all three actions, each a whole 5-point step.
  await expect(percentOf(page, 'FOLD')).toHaveAttribute('data-percent', '35');
  await expect(percentOf(page, 'CALL')).toHaveAttribute('data-percent', '35');
  await expect(percentOf(page, 'RAISE')).toHaveAttribute('data-percent', '30');
  await expect(percentOf(page, 'RAISE')).toHaveAttribute('data-name', '3BET');
  await expect(page.getByTestId('strategy-sizing')).toContainText('추천 사이즈 3BET TO 10 BB');

  // Facing a bet: pot odds are shown, and the ACTUAL open size sits opposite the bucket.
  await expect(page.getByTestId('strategy-pot-odds')).toHaveText('팟오즈 23%');
  await expect(page.getByTestId('strategy-actual-aggression')).toHaveText('BTN 2.5 BB');
});

test('facing a 3-bet, the opener sees a 4BET-named answer for that spot', async ({ page }) => {
  await startSixHanded(page, 0);
  await enterCards(page, ['Ah', 'Kh']);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('f');
  await raiseTo(page, '2.5'); // hero opens from the button
  await page.keyboard.press('f'); // the small blind folds
  await raiseTo(page, '10'); // the big blind 3-bets
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');

  const strategy = await readyPanel(page);
  await expect(strategy).toHaveAttribute('data-street', 'PREFLOP');
  await expect(strategy).toHaveAttribute('data-family', 'OPENER_VS_3BET');
  await expect(page.getByTestId('strategy-family')).toHaveText('3BET 당함');
  await expect(percentOf(page, 'RAISE')).toHaveAttribute('data-name', '4BET');
  await expect(page.getByTestId('strategy-pot-odds')).toContainText('팟오즈');
});

/**
 * One continuously driven hand across every street, with the request list captured from
 * the moment the table is on screen. Flop, turn, river and a postflop bet are all covered
 * here rather than in four separate sessions, because the thing being proved — the panel
 * keeps up with a hand as it is played — is a property of the whole sequence.
 */
test('populates the panel on flop, turn and river with no network request at all', async ({
  page,
}) => {
  await startSixHanded(page, 2);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

  await enterCards(page, ['Ah', 'Kh']);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('f');
  await raiseTo(page, '2.5');
  await page.keyboard.press('f');

  // --- hero calls the open and the flop is entered ------------------------------------
  await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('플랍 대기');
  await enterCards(page, ['Qh', '7s', '2d']);

  const flop = await readyPanel(page);
  await expect(flop).toHaveAttribute('data-street', 'FLOP');
  await expect(flop).toHaveAttribute('data-family', 'PROBE');
  await expect(percentOf(page, 'CHECK')).toHaveAttribute('data-percent', '50');
  await expect(percentOf(page, 'BET')).toHaveAttribute('data-percent', '50');
  // Postflop sizing is a BUCKET plus an amount (`docs/UX.md`).
  await expect(page.getByTestId('strategy-sizing')).toContainText('추천 사이즈 33% POT · ');
  await expect(page.getByTestId('strategy-sizing')).toContainText(' BB');
  await expect(page.getByTestId('strategy-equity')).toContainText('Equity 60%');
  await expect(page.getByTestId('strategy-spr')).toContainText('SPR ');

  // --- hero checks, the button bets: hero is now facing a bet -------------------------
  await page.keyboard.press('c');
  await raiseTo(page, '3');
  const facing = await readyPanel(page);
  await expect(facing).toHaveAttribute('data-family', 'FACING_BET');
  await expect(percentOf(page, 'FOLD')).toHaveAttribute('data-percent', '10');
  await expect(percentOf(page, 'CALL')).toHaveAttribute('data-percent', '80');
  await expect(percentOf(page, 'RAISE')).toHaveAttribute('data-percent', '10');
  await expect(page.getByTestId('strategy-pot-odds')).toHaveText('팟오즈 24%');
  await expect(page.getByTestId('strategy-equity')).toContainText('Equity 60%');
  await expect(page.getByTestId('strategy-primary-badge')).toHaveText('추천');

  // The dock is live while the panel is populated: the call goes through immediately.
  await expect(page.getByTestId('dock-C')).toHaveAttribute('data-legal', 'true');
  await page.keyboard.press('c');

  // --- turn --------------------------------------------------------------------------
  await expect(page.getByTestId('phase')).toContainText('턴 대기');
  await enterCards(page, ['9c']);
  const turn = await readyPanel(page);
  await expect(turn).toHaveAttribute('data-street', 'TURN');
  await expect(page.getByTestId('strategy-equity')).toContainText('Equity ');
  await expect(page.getByTestId('strategy-sizing')).toContainText('% POT · ');

  // --- river -------------------------------------------------------------------------
  await page.keyboard.press('c'); // hero checks
  await page.keyboard.press('c'); // the button checks back
  await expect(page.getByTestId('phase')).toContainText('리버 대기');
  await enterCards(page, ['3s']);
  const river = await readyPanel(page);
  await expect(river).toHaveAttribute('data-street', 'RIVER');
  await expect(page.getByTestId('strategy-quality')).toContainText('품질');

  // ADR-0043: nothing on the action OR the strategy path left the browser.
  expect(requests).toEqual([]);
});

/**
 * The performance contract, measured rather than asserted in prose. The postflop analysis
 * is the most expensive thing the table does; it must not sit in front of the keyboard.
 *
 * The bounds are deliberately loose — this runs on shared CI hardware and the point is a
 * missing stall per keystroke, not a microbenchmark.
 *
 * What this proves, exactly: the analysis is not flushed synchronously ahead of the first
 * keystroke, which is what the effect-body design did. It does NOT prove the analysis can be
 * interrupted once it has begun — nothing can interrupt it, there is no yield point and no
 * worker (see `StrategyPanel.tsx`). A keystroke that lands inside the computation's own window
 * still waits for the remainder of it. Nor is the worst case ~87 ms: R1 (MAJOR-2) measured a
 * 6-way flop at 130-153 ms, a shape the benchmark never covered.
 */
test('keeps the raise editor responsive while a postflop analysis is scheduled', async ({
  page,
}) => {
  await startSixHanded(page, 2);
  await enterCards(page, ['Ah', 'Kh']);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('f');
  await raiseTo(page, '2.5');
  await page.keyboard.press('f');
  await page.keyboard.press('c');
  await enterCards(page, ['Qh', '7s', '2d']);

  // The analysis for the flop has just been scheduled. Start typing immediately, without
  // waiting for it: the first keystroke is the one a blocking design would swallow.
  await page.keyboard.press('r');
  await expect(page.getByTestId('raise-input')).toBeFocused();

  const started = Date.now();
  await page.keyboard.type('12.345');
  const elapsed = Date.now() - started;

  await expect(page.getByTestId('raise-input')).toHaveValue('12.345');
  await expect(page.getByTestId('raise-preview-to')).toContainText('12.345 BB');
  // Six keystrokes. A design that ran the analysis inside the effect body would flush it
  // synchronously ahead of the first of them.
  expect(elapsed).toBeLessThan(1500);

  // Typing did not disturb the analysis either: it lands, and it is not stale.
  await readyPanel(page);
  // ...and the editor still holds exactly what was typed (`CLAUDE.md` rule 3).
  await expect(page.getByTestId('raise-input')).toHaveValue('12.345');
});
