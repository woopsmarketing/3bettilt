import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { handNumber, pickCards, selectSeat, stackOf, startSession } from './helpers.js';

/**
 * WP-10 — the long hands-on session, end to end, in a real browser over the real database.
 *
 * This is the one spec that walks the whole V2 story in the order a person actually lives it:
 * a lineup that turns out to be wrong, a seat that changes hands, a fold that ends the user's
 * interest in a hand, five stacks to resync, a button to fix, and only then a hand that is
 * really played and really stored. Everything else in this suite covers one transition at a
 * time; what this covers is that the transitions do not corrupt each other.
 *
 * ## The invariants it exists to pin (design contract §1, ADR-0073 / ADR-0074 / ADR-0076)
 *
 * 1. **A CORRECTION IS NOT A SKIP.** Sitting a seat out, replacing a seat's player and moving
 *    the button all rebuild the live hand at the SAME `handNumber` with NO button rotation.
 * 2. **A QUICK NEXT HAND IS EXACTLY ONE OF EACH.** One rotation, `handNumber` + 1, and a
 *    `skipped_hands` audit row — never a stored hand.
 * 3. **A FOLDED SEAT IS EXACTLY KNOWN.** After a quick next hand a seat that had folded shows
 *    `startingStack − totalContribution` and is NOT 확인 필요; every other dealt-in seat is.
 * 4. **NO FAKE COMPLETED HAND.** Two rebases and a quick skip later, the stored count is still
 *    zero. It becomes one only when a hand is genuinely played to an award.
 * 5. **NO DUPLICATE PLAYER.** A nickname that already exists resolves to the SAME player, and
 *    that player cannot be put in a second seat of the same session.
 * 6. **THE LATEST EXTERNAL HUD WINS, AND A BLANK STAYS UNKNOWN.** Editing appends a new
 *    snapshot; the profile shows the new number for the stat that was typed and 알 수 없음 for
 *    the ones that were left blank — never a zero.
 * 7. **REFERENCE DOES NOT MOVE.** The whole REFERENCE reading is captured before an external
 *    HUD edit and compared afterwards, from outside the app.
 *
 * Everything is addressed by `data-testid` (`helpers.ts`); the hand counter is the single
 * documented exception, because the header has no test id for it.
 */

/** Unique to this file: `players.normalized_nickname` is UNIQUE and the suite runs parallel. */
const LINEUP = ['W10 Btn', 'W10 Sb', 'W10 Hero', 'W10 Utg', 'W10 Cut', 'W10 Six'] as const;
const VILLAIN = 'W10 Villain';

/** Every seat's 확인 필요 flag, as one comparable object. */
async function dirtyMap(page: Page): Promise<Record<number, string>> {
  const entries = await Promise.all(
    [0, 1, 2, 3, 4, 5].map(async (seat) => {
      const value = await page.getByTestId(`seat-${seat}`).getAttribute('data-dirty');
      return [seat, value ?? ''] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** The REFERENCE half of the strategy panel, as one comparable value (`adaptive-strategy`). */
async function referenceReading(page: Page): Promise<Record<string, string | null>> {
  const panel = page.getByTestId('strategy-panel');
  await expect(panel).toHaveAttribute('data-state', 'READY');
  await expect(panel).toHaveAttribute('data-stale', 'false');
  const [fold, call, raise] = await Promise.all([
    page.getByTestId('strategy-action-FOLD').getAttribute('data-percent'),
    page.getByTestId('strategy-action-CALL').getAttribute('data-percent'),
    page.getByTestId('strategy-action-RAISE').getAttribute('data-percent'),
  ]);
  return {
    fold,
    call,
    raise,
    primary: await panel.getAttribute('data-primary'),
    family: await panel.getAttribute('data-family'),
    position: await page.getByTestId('strategy-position').textContent(),
    handClass: await page.getByTestId('strategy-hand-class').textContent(),
    sizing: await page.getByTestId('strategy-sizing').textContent(),
    potOdds: await page.getByTestId('strategy-pot-odds').textContent(),
  };
}

test('drives a whole hands-on session: rebases, a quick next hand, a resync, and one stored hand', async ({
  page,
}) => {
  test.slow();

  // --- 1. six players, hero in seat 2, button on seat 0 --------------------------------
  await startSession(page, { nicknames: LINEUP, heroSeat: 2, buttonSeat: 0 });
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 0');
  await expect(page.getByTestId('quick-next-hand-description')).toBeVisible();

  // --- 2. the first hand ---------------------------------------------------------------
  await page.getByTestId('start-hand').click();
  const firstHand = await handNumber(page);
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-sb', 'true');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-bb', 'true');
  for (const seat of [0, 1, 2, 3, 4, 5]) {
    await expect(page.getByTestId(`seat-${seat}`)).not.toHaveAttribute(
      'data-status',
      'NOT_DEALT_IN',
    );
  }

  // --- 3. one player is not actually there: the SMALL BLIND sits out, mid-hand ---------
  // The most demanding case on purpose: the seat that leaves is the one carrying a blind, so
  // an implementation that only removed the seat from the lineup would leave the pot, the
  // blinds and the action order describing a table that does not exist.
  await page.getByTestId('seat-1-occupancy-toggle').click();
  await expect(page.getByTestId('seat-1-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  await expect(page.getByTestId('hand-rebased-notice')).toBeVisible();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);

  // --- 4. the blinds and the positions moved; the hand number and the button did not ----
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-sb', 'true');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-bb', 'false');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-bb', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  expect(await handNumber(page)).toBe(firstHand);
  // A correction adds no 확인 필요 mark anywhere (ADR-0073).
  expect(await dirtyMap(page)).toEqual({
    0: 'false',
    1: 'false',
    2: 'false',
    3: 'false',
    4: 'false',
    5: 'false',
  });
  await page.getByTestId('hand-rebased-dismiss').click();
  await expect(page.getByTestId('hand-rebased-notice')).toHaveCount(0);

  // --- 5/6. seat 5 is a different person, with a PARTIAL external HUD ------------------
  await page.getByTestId('seat-5-swap-toggle').click();
  await page.getByTestId('seat-5-swap-mode-new').click();
  await page.getByTestId('seat-5-swap-nickname').fill(VILLAIN);
  // Replacing an occupant never asks for a stack — the seat becomes 확인 필요 instead, so the
  // real figure is typed rather than inherited from the last person to sit there (ADR-0076).
  await expect(page.getByTestId('seat-5-swap-replace-hint')).toBeVisible();
  await expect(page.getByTestId('seat-5-swap-stack')).toHaveCount(0);
  // Two stats typed, eight left BLANK. The form says on its face what a blank means.
  await expect(page.getByTestId('seat-5-swap-hud-unknown-hint')).toBeVisible();
  await page.getByTestId('seat-5-swap-hud-VPIP').fill('30');
  await page.getByTestId('seat-5-swap-hud-FOLD_TO_THREE_BET').fill('70');
  await page.getByTestId('seat-5-swap-submit').click();

  // The swap closes on success, the seat is relabelled, and the SAME rebase runs.
  await expect(page.getByTestId('seat-5-swap')).toHaveCount(0);
  await expect(page.getByTestId('seat-5')).toContainText(VILLAIN);
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('hand-rebased-notice')).toBeVisible();
  // Still the same hand number and the same button: a player replacement is a CORRECTION.
  expect(await handNumber(page)).toBe(firstHand);
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'true');
  // The one dirty mark a correction DOES make: nobody knows what the new occupant has.
  await expect(page.getByTestId('seat-5')).toHaveAttribute('data-dirty', 'true');
  await expect(page.getByTestId('seat-5-dirty')).toBeVisible();
  await page.getByTestId('hand-rebased-dismiss').click();
  await expect(page.getByTestId('hand-rebased-notice')).toHaveCount(0);

  // --- 7. hero folds, with the hand still live -----------------------------------------
  // Five-handed off a seat-0 button: UTG(4) -> 5 -> 0 -> SB(2, hero) -> BB(3).
  await page.getByTestId('dock-F').click(); // seat 4
  await expect(page.getByTestId('seat-4')).toHaveAttribute('data-status', 'FOLDED');
  await page.getByTestId('dock-C').click(); // seat 5 (the new opponent) calls
  await page.getByTestId('dock-F').click(); // seat 0
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-actor', 'true');
  await page.getByTestId('dock-F').click(); // hero
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-status', 'FOLDED');
  // The big blind has still not acted, so there IS a live hand to move on from.
  await expect(page.getByTestId('skip-hand')).toBeEnabled();

  // --- 8. 빠른 다음 핸드 ----------------------------------------------------------------
  await page.getByTestId('skip-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);

  // Exactly one hand-number increment and exactly one button rotation — over the seat that
  // is sitting out, which is not eligible to hold it.
  expect(await handNumber(page)).toBe(firstHand + 1);
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'false');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'false');

  // --- 9. ADR-0074's accounting: a folded seat is EXACT, everyone else is 확인 필요 -----
  expect(await dirtyMap(page)).toEqual({
    0: 'false', // folded on the button
    1: 'false', // never dealt in
    2: 'false', // hero, folded
    3: 'true', // the big blind, still live when the hand was abandoned
    4: 'false', // folded from under the gun
    5: 'true', // called and was still live (and was already dirty from the swap)
  });
  // ...and "exact" means exact: five-handed with the ante on, every seat posted 0.16 BB, the
  // small blind another 0.5. These are the engine's own numbers, not a guess.
  await expect(stackOf(page, 0)).toHaveText('99.84 BB'); // button: ante only
  await expect(stackOf(page, 4)).toHaveText('99.84 BB'); // UTG: ante only
  await expect(stackOf(page, 2)).toHaveText('99.34 BB'); // hero: ante + the small blind
  // A quick-skipped hand is NEVER a stored hand (design contract §1).
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 0');
  await expect(page.getByTestId('hand-save-error')).toHaveCount(0);

  // --- 10. resync the two unknown stacks, walking on with Enter ------------------------
  await page.getByTestId('seat-3-dirty-action').click();
  await expect(page.getByTestId('seat-3-stack-input')).toBeFocused();
  // The client refuses exactly what the store and the server refuse, and keeps the field open.
  await page.getByTestId('seat-3-stack-input').fill('0');
  await page.getByTestId('seat-3-stack-input').press('Enter');
  await expect(page.getByTestId('seat-3-stack-error')).toBeVisible();
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-dirty', 'true');

  await page.getByTestId('seat-3-stack-input').fill('88.5');
  await page.getByTestId('seat-3-stack-input').press('Enter');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-dirty', 'false');
  await expect(stackOf(page, 3)).toHaveText('88.5 BB');
  // WP-5's whole point: Enter hands the keyboard straight to the NEXT unconfirmed seat.
  await expect(page.getByTestId('seat-5-stack-input')).toBeFocused();

  await page.getByTestId('seat-5-stack-input').fill('77.25');
  await page.getByTestId('seat-5-stack-input').press('Enter');
  await expect(page.getByTestId('seat-5')).toHaveAttribute('data-dirty', 'false');
  await expect(stackOf(page, 5)).toHaveText('77.25 BB');
  // Nothing is left to confirm, so the walk stops rather than wrapping onto a clean seat.
  await expect(page.locator('[data-testid$="-stack-input"]')).toHaveCount(0);
  await expect(page.getByTestId('seat-state-save-error')).toHaveCount(0);

  // --- 5b. the same person cannot be given a second seat ------------------------------
  // Typing a nickname that already exists REUSES that player (`resolvePlayer`), so searching
  // for the opponent created above finds exactly one — and it is refused, with a reason,
  // because they are already sitting in seat 5 (ADR-0076).
  await page.getByTestId('seat-3-swap-toggle').click();
  await page.getByTestId('seat-3-swap-search').fill(VILLAIN);
  const matches = page.getByTestId('seat-3-swap-matches').locator('button');
  await expect(matches).toHaveCount(1);
  await expect(matches.first()).toBeDisabled();
  await expect(
    page.locator('[data-testid^="seat-3-swap-match-"][data-testid$="-rejection"]'),
  ).toHaveCount(1);
  await page.getByTestId('seat-3-swap-close').click();
  await expect(page.getByTestId('seat-3-swap')).toHaveCount(0);

  // --- 11. the button was wrong too ----------------------------------------------------
  const secondHand = await handNumber(page);
  await page.getByTestId('seat-5-correction-toggle').click();
  await page.getByTestId('seat-5-correction-button-seat').click();
  await expect(page.getByTestId('seat-5')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'false');
  // Between hands there is nothing to rebuild, so nothing is announced and nothing renumbers.
  await expect(page.getByTestId('hand-rebased-notice')).toHaveCount(0);
  expect(await handNumber(page)).toBe(secondHand);
  await page.getByTestId('seat-5-correction-toggle').click(); // close the panel

  // --- 12. the second hand, dealt from the corrected table -----------------------------
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  expect(await handNumber(page)).toBe(secondHand);
  await expect(page.getByTestId('seat-5')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-sb', 'true');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-bb', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-status', 'NOT_DEALT_IN');

  // --- 15a. hero's cards, out of the enlarged palette (WP-8) ---------------------------
  const palette = page.getByTestId('card-palette');
  await expect(palette).toHaveAttribute('data-needed', '2');
  await expect(page.getByTestId('card-palette-title')).toBeVisible();
  await expect(page.getByTestId('card-palette-slot-0')).toBeVisible();
  await expect(page.getByTestId('card-palette-slot-1')).toBeVisible();
  await pickCards(page, ['Ah', '5h']);
  await expect(palette).toHaveCount(0);
  await expect(page.getByTestId('hero-cards')).toContainText('Ah');

  // Preflop: UTG(3) and 4 fold, the BUTTON — the opponent with the external HUD — opens to
  // 2.5 BB, the small blind folds, and hero is on the clock in the big blind.
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await page.keyboard.press('r');
  await expect(page.getByTestId('raise-input')).toBeFocused();
  await page.keyboard.type('2.5');
  await page.keyboard.press('Enter');
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-actor', 'true');

  // --- 13. both engines, at once (ADR-0077) --------------------------------------------
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-panel', 'STRATEGY');
  await expect(page.getByTestId('strategy-mode-REFERENCE')).toHaveCount(0);
  await expect(page.getByTestId('strategy-reference-section')).toBeVisible();
  await expect(page.getByTestId('strategy-adaptive-section')).toBeVisible();
  await expect(page.getByTestId('strategy-panel')).not.toContainText('GTO');
  const reference = await referenceReading(page);

  // --- 14/6. the opponent's profile, in the drawer under the strategy ------------------
  await selectSeat(page, 5);
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-panel', 'STRATEGY');
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-drawer', 'PLAYER');
  await expect(page.getByTestId('right-panel-lead')).toBeVisible();
  await expect(page.getByTestId('right-panel-drawer')).toBeVisible();
  await expect(page.getByTestId('strategy-reference-section')).toBeVisible();

  // What was typed at the table is what is stored, and a BLANK stayed unknown rather than
  // becoming a zero (`CLAUDE.md` rule 2 / ADR-0076).
  await expect(page.getByTestId('external-hud-stat-FOLD_TO_THREE_BET')).toContainText('70%');
  await expect(page.getByTestId('external-hud-stat-VPIP')).toContainText('30%');
  await expect(page.getByTestId('external-hud-stat-WSD')).toHaveText(/알 수 없음/u);
  await expect(page.getByTestId('external-hud-stat-WSD')).not.toContainText('%');

  // An edit APPENDS a new snapshot; the panel says so before it is used.
  await expect(page.getByTestId('external-hud-append-notice')).toBeVisible();
  await expect(page.getByTestId('external-hud-input-unknown-hint')).toBeVisible();
  await page.getByTestId('external-hud-input-FOLD_TO_THREE_BET').fill('85');
  await page.getByTestId('external-hud-save-button').click();
  await expect(page.getByTestId('external-hud-result')).toBeVisible();
  await expect(page.getByTestId('external-hud-error')).toHaveCount(0);
  // The LATEST snapshot is the one that is shown and used, and the stat left blank in the new
  // snapshot is unknown in it — an append never back-fills a value from an older reading.
  await expect(page.getByTestId('external-hud-stat-FOLD_TO_THREE_BET')).toContainText('85%');
  await expect(page.getByTestId('external-hud-stat-WSD')).toHaveText(/알 수 없음/u);

  // --- 7 (contract §0). REFERENCE DID NOT MOVE -----------------------------------------
  expect(await referenceReading(page)).toEqual(reference);

  // --- 14b. ...and ADAPTIVE is keyed to that named opponent ----------------------------
  const adaptive = page.getByTestId('adaptive-panel');
  await expect(adaptive).toHaveAttribute('data-status', 'ADAPTED');
  await expect(page.getByTestId('adaptive-opponent')).toContainText(VILLAIN);
  // FAST TABLE UX V3: 추천 이유 is collapsed by default — the reason row (and the source
  // note inside it) is in the DOM but not visible until the disclosure is opened.
  await page.getByTestId('adaptive-reason-detail').locator('summary').click();
  const reason = page.getByTestId('adaptive-reason-FOLD_TO_3BET_HIGH');
  await expect(reason).toHaveAttribute('data-stat', 'FOLD_TO_THREE_BET');
  await expect(page.getByTestId('adaptive-source-note-EXTERNAL_HUD')).toBeVisible();
  await expect(page.getByTestId('adaptive-provenance')).toContainText('HEURISTIC');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-drawer', 'NONE');
  expect(await referenceReading(page)).toEqual(reference);

  // --- 16. hero calls, and the board is entered street by street -----------------------
  await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText('플랍 대기');
  await pickCards(page, ['7c', '2d', 'Ts']);
  await expect(page.getByTestId('board')).toContainText('7c');
  await page.keyboard.press('c');
  await page.keyboard.press('c');

  await expect(page.getByTestId('phase')).toContainText('턴 대기');
  await pickCards(page, ['4d']);
  await page.keyboard.press('c');
  await page.keyboard.press('c');

  await expect(page.getByTestId('phase')).toContainText('리버 대기');
  await pickCards(page, ['9s']);
  await page.keyboard.press('c');
  await page.keyboard.press('c');

  // --- 17. the hand is settled and STORED ----------------------------------------------
  await expect(page.getByTestId('award-panel')).toBeVisible();
  const persisted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/table\/[^/]+$/u.test(new URL(response.url()).pathname),
  );
  await page.getByTestId('award-seat-0-2').click();
  await page.getByTestId('award-submit').click();
  expect((await persisted).ok()).toBe(true);

  // Exactly ONE hand reached the database out of this whole session: the two rebased hands and
  // the quick-skipped one were never completions and were never written.
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');
  await expect(page.getByTestId('hand-save-error')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');
});

/** Unique to this test: keeps the swap flow independent of the long walkthrough above. */
const QUICKLINE_LINEUP = ['W10Q Hero', 'W10Q Two', 'W10Q Three'] as const;
const QUICKLINE_VILLAIN = 'W10Q Villain';

test('the quick HUD line pre-fills the detailed external-HUD fields for a new player', async ({
  page,
}) => {
  await startSession(page, { nicknames: QUICKLINE_LINEUP, heroSeat: 0, buttonSeat: 0 });

  // Canonical order: VPIP PFR THREE_BET FOLD_TO_THREE_BET STEAL CBET_ANY_STREET
  // FOLD_TO_CBET_ANY_STREET CHECK_RAISE_ANY_STREET WTSD WSD.
  await page.getByTestId('seat-1-swap-toggle').click();
  await page.getByTestId('seat-1-swap-mode-new').click();
  await page.getByTestId('seat-1-swap-hud-quickline').fill('27 20 11 58 57 31 39 12 30 52');
  await page.getByTestId('seat-1-swap-hud-quickline-apply').click();
  await expect(page.getByTestId('seat-1-swap-hud-quickline-error')).toHaveCount(0);

  await expect(page.getByTestId('seat-1-swap-hud-VPIP')).toHaveValue('27');
  await expect(page.getByTestId('seat-1-swap-hud-PFR')).toHaveValue('20');
  await expect(page.getByTestId('seat-1-swap-hud-THREE_BET')).toHaveValue('11');
  await expect(page.getByTestId('seat-1-swap-hud-FOLD_TO_THREE_BET')).toHaveValue('58');
  await expect(page.getByTestId('seat-1-swap-hud-STEAL')).toHaveValue('57');
  await expect(page.getByTestId('seat-1-swap-hud-CBET_ANY_STREET')).toHaveValue('31');
  await expect(page.getByTestId('seat-1-swap-hud-FOLD_TO_CBET_ANY_STREET')).toHaveValue('39');
  await expect(page.getByTestId('seat-1-swap-hud-CHECK_RAISE_ANY_STREET')).toHaveValue('12');
  await expect(page.getByTestId('seat-1-swap-hud-WTSD')).toHaveValue('30');
  await expect(page.getByTestId('seat-1-swap-hud-WSD')).toHaveValue('52');

  // The quickline pre-fills the SAME detailed form the manual flow already submits through —
  // typing the nickname and submitting seats the new player exactly as the existing swap flow
  // does.
  await page.getByTestId('seat-1-swap-nickname').fill(QUICKLINE_VILLAIN);
  await page.getByTestId('seat-1-swap-submit').click();
  await expect(page.getByTestId('seat-1-swap')).toHaveCount(0);
  await expect(page.getByTestId('seat-1')).toContainText(QUICKLINE_VILLAIN);
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-dirty', 'true');
  await expect(page.getByTestId('seat-1-dirty')).toBeVisible();

  await selectSeat(page, 1);
  await expect(page.getByTestId('external-hud-stat-VPIP')).toContainText('27%');
  await expect(page.getByTestId('external-hud-stat-WSD')).toContainText('52%');

  // `-` means "left unknown", not zero (`CLAUDE.md` rule 3) — re-open the panel on a fresh
  // seat and confirm the field the line marked unknown stays BLANK, never becomes '0'.
  await page.keyboard.press('Escape');
  await page.getByTestId('seat-2-swap-toggle').click();
  await page.getByTestId('seat-2-swap-mode-new').click();
  await page.getByTestId('seat-2-swap-hud-quickline').fill('27 20 11 58 57 31 39 12 30 -');
  await page.getByTestId('seat-2-swap-hud-quickline-apply').click();
  await expect(page.getByTestId('seat-2-swap-hud-quickline-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-2-swap-hud-WSD')).toHaveValue('');
  await expect(page.getByTestId('seat-2-swap-hud-WTSD')).toHaveValue('30');
});
