import { expect, test, type Page } from '@playwright/test';
import { startSession } from './helpers.js';

/**
 * C0 — a completed hand becomes durable history (ADR-0059).
 *
 * The two things only a browser can prove:
 *  - the persist really fires at the COMPLETE transition, as a server call that SUCCEEDS
 *    (asserted on the response, not on the request alone);
 *  - the hand is still there after a full page reload, read back by the SERVER at page load.
 *    The stored count is rendered from `listCompletedHandsForSession`, so a count that
 *    survives a reload is a row that survived it.
 *
 * The action path itself is untouched: `action-dock.spec.ts` still asserts the captured
 * request list is empty through a whole betting sequence, which ends before the award. This
 * spec starts where that one stops.
 */

const CARDS = ['As', 'Kd', '2c', '7d', '9h', '3s', '4s'] as const;

/**
 * Play one whole hand heads up — hero's hole cards, a checked-down board, an award — and
 * wait for the persist to come back. The persist is a server action POST back to this route,
 * so the wait is ARMED BEFORE the submit that completes the hand.
 */
async function playAndStoreOneHand(page: Page): Promise<void> {
  await page.getByTestId('start-hand').click();
  await page.getByTestId(`palette-${CARDS[0]}`).click();
  await page.getByTestId(`palette-${CARDS[1]}`).click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();
  for (const card of CARDS.slice(2, 5)) await page.getByTestId(`palette-${card}`).click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId(`palette-${CARDS[5]}`).click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId(`palette-${CARDS[6]}`).click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();

  await expect(page.getByTestId('award-panel')).toBeVisible();
  await page.getByTestId('award-seat-0-1').click();

  const persisted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/table\/[^/]+$/u.test(new URL(response.url()).pathname),
  );
  await page.getByTestId('award-submit').click();
  const response = await persisted;
  expect(response.ok()).toBe(true);
}

test('stores a completed hand and still has it after a reload', async ({ page }) => {
  await startSession(page, {
    nicknames: ['C0 Hero', 'C0 Villain'],
    heroSeat: 0,
    buttonSeat: 0,
  });

  // Nothing stored yet: this session has never finished a hand.
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 0');

  await playAndStoreOneHand(page);

  // The client saw a success, and said so.
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');
  await expect(page.getByTestId('hand-save-error')).toHaveCount(0);

  // Durability: reload, and the count comes from the DATABASE on the server this time.
  await page.reload();
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');
  // The live hand is gone, as ADR-0059 says it is — only the finished history survived.
  await expect(page.getByTestId('street')).toHaveText('핸드 없음');
  await expect(page.getByTestId('start-hand')).toBeEnabled();
});

/**
 * The step the suite used to stop one short of (review R1/B1).
 *
 * A reloaded page used to hand the store a hand counter of 0, because `sessions.hand_number`
 * was written once at session creation and never again. The next hand was then numbered over
 * one already stored, `UNIQUE(session_id, hand_number)` refused it, and RETRY re-sent the
 * identical log and failed identically — forever. Every hand of that page life was
 * permanently unstorable while the header still promised "세션은 저장됩니다".
 *
 * Reloading and reading the count back proves nothing about this: only PLAYING after the
 * reload does. So this test plays a second complete hand on a reloaded page and requires the
 * stored count to grow with no failure banner.
 */
test('a hand played AFTER a reload still stores', async ({ page }) => {
  await startSession(page, {
    nicknames: ['B1 Hero', 'B1 Villain'],
    heroSeat: 0,
    buttonSeat: 0,
  });

  await playAndStoreOneHand(page);
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');

  await page.reload();
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');

  // The whole point: a fresh page life, numbering resumed from what the DATABASE holds.
  await playAndStoreOneHand(page);
  await expect(page.getByTestId('hand-save-error')).toHaveCount(0);
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 2');

  // And it is durable, not just believed: the count after a SECOND reload is read by the
  // server out of `hands`.
  await page.reload();
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 2');
});
