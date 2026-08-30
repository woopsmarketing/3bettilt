import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Shared session-setup driving for the E2E suite.
 *
 * Everything here addresses controls by `data-testid`, never by copy: this suite exists to
 * prove BEHAVIOUR, and a behaviour test that breaks when a label is translated was testing
 * the wrong thing. Each spec still asserts, separately and deliberately, that the Korean
 * copy renders — see the `copy` assertions in the specs themselves.
 */

/** Seat ids in the setup form are 0-based, matching the domain's `SeatIndex`. */
export const setupSeat = (page: Page, seat: number) => ({
  occupancy: page.getByTestId(`setup-seat-${seat}-occupancy`),
  nickname: page.getByTestId(`setup-seat-${seat}-nickname`),
  stack: page.getByTestId(`setup-seat-${seat}-stack`),
  hero: page.getByTestId(`setup-seat-${seat}-hero`),
  button: page.getByTestId(`setup-seat-${seat}-button`),
});

/** The seat card's stack, which is the first tabular figure inside the card. */
export const stackOf = (page: Page, seat: number) =>
  page.getByTestId(`seat-${seat}`).locator('span.tabular').first();

export interface SessionOptions {
  readonly nicknames: readonly string[];
  /** Per-seat stack text, or one value for every seat. Defaults to `'100'`. */
  readonly stacks?: readonly string[] | string;
  /** 0-based. Defaults to seat 0. */
  readonly heroSeat?: number;
  /** 0-based. Defaults to seat 0. */
  readonly buttonSeat?: number;
  readonly label?: string;
}

/**
 * Configures and starts a session, leaving the browser on `/table/[sessionId]`.
 *
 * Seats beyond `nicknames.length` are emptied, so the table deals exactly the lineup the
 * caller asked for.
 */
export async function startSession(page: Page, options: SessionOptions): Promise<void> {
  await page.goto('/session/new');
  const { nicknames } = options;
  for (let seat = 0; seat < 6; seat += 1) {
    const controls = setupSeat(page, seat);
    const nickname = nicknames[seat];
    if (nickname === undefined) {
      await controls.occupancy.selectOption('EMPTY');
      continue;
    }
    await controls.nickname.fill(nickname);
    const stacks = options.stacks ?? '100';
    await controls.stack.fill(typeof stacks === 'string' ? stacks : (stacks[seat] ?? '100'));
  }
  await setupSeat(page, options.heroSeat ?? 0).hero.check();
  await setupSeat(page, options.buttonSeat ?? 0).button.check();
  if (options.label !== undefined) await page.getByTestId('setup-label').fill(options.label);

  await expect(page.getByTestId('setup-submit')).toBeEnabled();
  await page.getByTestId('setup-submit').click();
  await page.waitForURL(/\/table\/[^/]+$/u);
}
