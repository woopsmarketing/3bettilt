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

/**
 * The seat card's stack figure.
 *
 * WP-5 turned the number itself into the inline stack editor's trigger, so it now carries a
 * `data-testid` of its own and this no longer has to reach for "the first tabular span in the
 * card" — a positional read that the dirty badge and the contribution figure were both one
 * layout change away from breaking.
 */
export const stackOf = (page: Page, seat: number) => page.getByTestId(`seat-${seat}-stack`);

/**
 * Selects a seat by clicking the card's own top-left corner.
 *
 * The card is one big `div[role=button]`, but it now contains a nested control that stops
 * propagation: the stack figure, which WP-5 turned into the inline editor's trigger. Playwright
 * clicks an element's CENTRE, and the centre of a seat card lands on or beside that figure, so
 * `getByTestId('seat-3').click()` can open the stack editor instead of selecting the seat.
 *
 * The corner is inside the card's own padding, above and left of every child, so the click
 * always reaches the card's handler — which is the gesture these specs mean. It is a position
 * rather than an inner test id because there is no child that is BOTH always rendered and
 * always non-empty: the status line, the obvious candidate, is deliberately blank for a seat
 * whose status is `IN_HAND` (`SEAT_STATUS_LABEL`), and a zero-size span cannot be clicked.
 */
export const selectSeat = (page: Page, seat: number): Promise<void> =>
  page.getByTestId(`seat-${seat}`).click({ position: { x: 4, y: 4 } });

/**
 * The table header's hand counter — the single most load-bearing invariant of the V2 contract
 * (ADR-0073/ADR-0074: a correction never moves it, a quick next hand moves it by exactly one).
 *
 * It is addressed by `data-testid`, like every other locator in this suite. It used to be the
 * one exception, matched against the rendered Korean sentence, because the number had no
 * handle of its own; WP-4 gave it one (`TableRoot`: `<span data-testid="hand-number">`), so
 * the exception — and the sentence-shaped regex that came with it — is gone. A behaviour
 * assertion that a translator can break was testing the wrong thing.
 */
export const handCounter = (page: Page) => page.getByTestId('hand-number');

export async function handNumber(page: Page): Promise<number> {
  const text = ((await handCounter(page).textContent()) ?? '').trim();
  // The element holds the digits and nothing else, so anything else is a real failure of the
  // header rather than a counter this helper simply could not find. `Number('')` is 0 and
  // would pass an `isInteger` check, which is exactly the silent zero this must not return.
  if (!/^\d+$/u.test(text)) throw new Error(`no hand counter in ${JSON.stringify(text)}`);
  return Number(text);
}

/** Folds the current actor `count` times, from the dock (works while the palette has focus). */
export async function foldOut(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await page.getByTestId('dock-F').click();
}

/** Picks cards out of the palette, in order. */
export async function pickCards(page: Page, cards: readonly string[]): Promise<void> {
  for (const card of cards) await page.getByTestId(`palette-${card}`).click();
}

/**
 * Records every server-action POST this page makes from now on.
 *
 * A Next server action is a POST back to the page's own route, so the URL cannot tell two of
 * them apart — what the count proves is HOW MANY server round trips a gesture made, which is
 * what the persistence contract (ADR-0075 §4) is actually about: an occupancy toggle writes
 * the one narrow occupancy column and does NOT also fire the whole-table seat sync.
 */
export function recordServerActions(page: Page): readonly string[] {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (!/^\/table\/[^/]+$/u.test(new URL(request.url()).pathname)) return;
    posts.push(request.url());
  });
  return posts;
}

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

  // The URL changing is not the table being READY. `TableRoot` mounts and then fires its
  // boundary reads — today that is the ADAPTIVE opponent-input load (WP-J), tomorrow it
  // could be another. Those are mount-time loads, not action-path traffic, but a spec that
  // starts recording requests the instant this helper returns will catch them and blame the
  // action path for a request that had nothing to do with a keystroke.
  //
  // So the helper's contract is "the table is on screen AND its mount has settled". That
  // keeps `action-dock`/`card-palette`'s `requests === []` assertion at FULL strength — a
  // real request on the key -> poker-core -> render path still fails them (ADR-0043) —
  // instead of weakening it to an allowlist that would let a genuine regression through.
  await expect(page.getByTestId('start-hand')).toBeEnabled();
  await page.waitForLoadState('networkidle');
}
