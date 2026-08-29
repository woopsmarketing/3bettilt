import { expect, test } from '@playwright/test';

/**
 * Session setup end to end in a real browser: configure a session, start it, and land on
 * the practice table with the seats that were entered.
 */
test('configures a session and lands on the practice table', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'New session' }).click();
  await expect(page).toHaveURL(/\/session\/new$/u);

  const start = page.getByRole('button', { name: 'Start Session' });
  // Disabled, with the actual first problem stated — never a bare "invalid form".
  await expect(start).toBeDisabled();
  await expect(page.locator('#start-session-reason')).toContainText('needs a nickname');

  const nicknames = ['E2E Hero', 'E2E Villain', 'E2E Fish'];
  for (let seat = 1; seat <= 6; seat += 1) {
    if (seat <= 3) {
      await page.getByLabel(`Seat ${seat} nickname`).fill(nicknames[seat - 1] ?? '');
      await page.getByLabel(`Seat ${seat} stack in BB`).fill(seat === 2 ? '93.701' : '100');
    } else {
      await page.getByLabel(`Seat ${seat} occupancy`).selectOption('EMPTY');
    }
  }
  await page.getByLabel('Seat 1 is Hero').check();
  await page.getByLabel('Seat 3 has the button').check();
  await page.getByLabel('Label (optional)').fill('e2e session');

  await expect(start).toBeEnabled();
  await start.click();

  await page.waitForURL(/\/table\/[^/]+$/u);
  const main = page.locator('main');
  await expect(main).toContainText('e2e session');
  await expect(main).toContainText('E2E Hero');
  // The ACTUAL entered stack, to full milliBB precision — never rounded for display.
  await expect(main).toContainText('93.701 BB');
  await expect(main).toContainText('HERO');
  await expect(main).toContainText('BTN');
});

/**
 * Phase 5: the table is a real surface. Starting a hand is a synchronous `poker-core`
 * call in the browser, so the markers, the actor and the posted blinds must all be on
 * screen with nothing awaited.
 */
test('starts a hand on the table and shows what the engine says', async ({ page }) => {
  await page.goto('/session/new');
  const nicknames = ['P5 Hero', 'P5 Villain', 'P5 Fish'];
  for (let seat = 1; seat <= 6; seat += 1) {
    if (seat <= 3) {
      await page.getByLabel(`Seat ${seat} nickname`).fill(nicknames[seat - 1] ?? '');
      await page.getByLabel(`Seat ${seat} stack in BB`).fill('100');
    } else {
      await page.getByLabel(`Seat ${seat} occupancy`).selectOption('EMPTY');
    }
  }
  await page.getByLabel('Seat 1 is Hero').check();
  await page.getByLabel('Seat 3 has the button').check();
  await page.getByRole('button', { name: 'Start Session' }).click();
  await page.waitForURL(/\/table\/[^/]+$/u);

  // Before the deal there is no pot and no street.
  await expect(page.getByTestId('pot')).toHaveText('—');

  await page.getByTestId('start-hand').click();

  // Hero is drawn bottom-centre and stays there.
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-hero', 'true');
  // The button the user chose is the button the engine dealt.
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-button', 'true');
  // Exactly one seat is on the clock.
  await expect(page.locator('[data-actor="true"]')).toHaveCount(1);
  // The blinds and antes are in the pot and in the history.
  await expect(page.getByTestId('pot')).not.toHaveText('—');
  await expect(page.getByTestId('action-history')).toContainText('small blind');
  await expect(page.getByTestId('action-history')).toContainText('big blind');
  // Phase 6: the dock is live, and it is live exactly where the engine says it is.
  await expect(page.getByTestId('dock-F')).toBeEnabled();
  // No hand can be started while one is in progress.
  await expect(page.getByTestId('dock-N')).toBeDisabled();

  // Esc returns the right panel to its default.
  await page.getByTestId('seat-1').click();
  await expect(page.getByTestId('player-profile')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('strategy-placeholder')).toBeVisible();
});

test('a session id that does not exist is a 404', async ({ page }) => {
  const response = await page.goto('/table/no-such-session');
  expect(response?.status()).toBe(404);
});
