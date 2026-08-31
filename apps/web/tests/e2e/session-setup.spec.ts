import { expect, test } from '@playwright/test';
import { setupSeat, startSession } from './helpers.js';

/**
 * Session setup end to end in a real browser: configure a session, start it, and land on
 * the practice table with the seats that were entered.
 *
 * Controls are addressed by `data-testid`, so a copy change cannot break the behaviour
 * these tests exist to prove. The Korean copy is asserted deliberately and separately.
 */
test('configures a session and lands on the practice table', async ({ page }) => {
  await page.goto('/');
  // The landing page is Korean, and its one link goes to setup.
  await expect(page.getByTestId('new-session-link')).toHaveText('새 세션');
  await page.getByTestId('new-session-link').click();
  await expect(page).toHaveURL(/\/session\/new$/u);

  const start = page.getByTestId('setup-submit');
  await expect(start).toHaveText('세션 시작');
  // Disabled, with the actual first problem stated — never a bare "invalid form". The
  // sentence is the DOMAIN's own (`lib/session-setup/plan.ts`) and is shown verbatim.
  await expect(start).toBeDisabled();
  await expect(page.locator('#start-session-reason')).toContainText('needs a nickname');
  await expect(page.locator('#start-session-reason')).toContainText('좌석 1');

  await startSession(page, {
    nicknames: ['E2E Hero', 'E2E Villain', 'E2E Fish'],
    stacks: ['100', '93.701', '100'],
    heroSeat: 0,
    buttonSeat: 2,
    label: 'e2e session',
  });

  const main = page.locator('main');
  await expect(main).toContainText('e2e session');
  await expect(main).toContainText('E2E Hero');
  // The ACTUAL entered stack, to full milliBB precision — never rounded for display.
  await expect(main).toContainText('93.701 BB');
  // Hero's marker is Korean; BTN stays in its international form.
  await expect(page.getByTestId('seat-0')).toContainText('나');
  await expect(page.getByTestId('seat-2')).toContainText('BTN');
});

test('keeps a rejected stack on screen with the domain’s own reason', async ({ page }) => {
  await page.goto('/session/new');
  const seat = setupSeat(page, 1);
  await seat.stack.fill('1o0');

  // Rule 3: what was typed is still there, and the parser's own words are shown.
  await expect(seat.stack).toHaveValue('1o0');
  await expect(page.getByTestId('setup-submit')).toBeDisabled();
  await expect(page.locator('form')).toContainText('not a number');
  await expect(page.locator('form')).toContainText('문제:');
});

/**
 * Phase 5: the table is a real surface. Starting a hand is a synchronous `poker-core`
 * call in the browser, so the markers, the actor and the posted blinds must all be on
 * screen with nothing awaited.
 */
test('starts a hand on the table and shows what the engine says', async ({ page }) => {
  await startSession(page, {
    nicknames: ['P5 Hero', 'P5 Villain', 'P5 Fish'],
    heroSeat: 0,
    buttonSeat: 2,
  });

  // Before the deal there is no pot and no street.
  await expect(page.getByTestId('pot')).toHaveText('—');
  await expect(page.getByTestId('street')).toHaveText('핸드 없음');

  await page.getByTestId('start-hand').click();

  // Hero is drawn bottom-centre and stays there.
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-hero', 'true');
  // The button the user chose is the button the engine dealt.
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'true');
  // Exactly one seat is on the clock.
  await expect(page.locator('[data-actor="true"]')).toHaveCount(1);
  // The blinds and antes are in the pot and in the history, in Korean.
  await expect(page.getByTestId('pot')).not.toHaveText('—');
  await expect(page.getByTestId('action-history')).toContainText('스몰 블라인드');
  await expect(page.getByTestId('action-history')).toContainText('빅 블라인드');
  // Phase 6: the dock is live, and it is live exactly where the engine says it is.
  await expect(page.getByTestId('dock-F')).toBeEnabled();
  await expect(page.getByTestId('dock-F')).toContainText('폴드');
  // No hand can be started while one is in progress.
  await expect(page.getByTestId('dock-N')).toBeDisabled();

  // Esc returns the right panel to its default. Hero is not the seat on the clock here
  // (the button is seat 3), so that default is the action log.
  await page.getByTestId('seat-1').click();
  await expect(page.getByTestId('player-profile')).toBeVisible();
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-panel', 'PLAYER');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('player-profile')).toHaveCount(0);
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-panel', 'HISTORY');
});

/**
 * The right column's priority, and the honesty requirement that goes with it: when hero is
 * the one who has to decide the panel leads, and until hero's cards are entered it REFUSES
 * with the engine's own code rather than showing a frequency for a hand nobody named.
 */
test('leads with the strategy panel on hero’s decision, and refuses before the cards exist', async ({
  page,
}) => {
  // Heads-up with hero on the button: hero is first to act preflop.
  await startSession(page, { nicknames: ['P9 Hero', 'P9 Villain'], heroSeat: 0, buttonSeat: 0 });
  await page.getByTestId('start-hand').click();

  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');
  await expect(page.getByTestId('right-panel')).toHaveAttribute('data-panel', 'STRATEGY');

  const strategy = page.getByTestId('strategy-panel');
  await expect(strategy).toContainText('기본전략 · REFERENCE');
  await expect(strategy).toHaveAttribute('data-state', 'REFUSED');
  await expect(page.getByTestId('strategy-refusal')).toHaveAttribute(
    'data-code',
    'INVALID_HERO_CARDS',
  );
  // `CLAUDE.md` rule 2: the reserved solved-output label appears nowhere on the page.
  await expect(page.locator('body')).not.toContainText('GTO');
});

test('a session id that does not exist is a 404', async ({ page }) => {
  const response = await page.goto('/table/no-such-session');
  expect(response?.status()).toBe(404);
});
