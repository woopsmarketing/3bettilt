import { expect, test } from '@playwright/test';
import { stackOf, startSession } from './helpers.js';

/**
 * ADR-0075 / WP-5 — the session's seat state survives a reload.
 *
 * This closes a gap that had been open since the Alpha and listed in `docs/STATE.md` the whole
 * time: `updateSessionTable` existed in `packages/db` and was called from nowhere, so stacks,
 * occupancy and the button advanced in memory only and a reload silently returned the table to
 * the numbers typed into the setup form. A corrected stack that does not survive a reload is
 * not a correction, so this is asserted through a REAL reload rather than through the store.
 *
 * `hand-history.spec.ts` proves the same thing for completed hands and is the pattern followed
 * here; what is new is that this is BETWEEN-HANDS state, which ADR-0059 explicitly does not
 * persist for a live hand. Nothing below asserts that a live hand survives, because it must not.
 *
 * The hand NUMBER is deliberately not asserted after the reload: `sessions.hand_number` keeps
 * its existing owner (`insertCompletedHand`, reconciled by `loadSessionView`), and ADR-0075
 * says in as many words that a quick-skipped number is not persisted. Only seat state is.
 */

test('a corrected stack, a sat-out seat and a moved button all survive a page reload', async ({
  page,
}) => {
  await startSession(page, {
    nicknames: ['P5 Hero', 'P5 Two', 'P5 Three'],
    heroSeat: 0,
    buttonSeat: 0,
    stacks: '100',
  });
  await expect(stackOf(page, 0)).toHaveText('100 BB');

  // --- WP-5: the stack is corrected ON the number, with no panel to open ---------------
  await page.getByTestId('seat-0-stack').click();
  await page.getByTestId('seat-0-stack-input').fill('55.5');
  await page.getByTestId('seat-0-stack-input').press('Enter');
  await expect(stackOf(page, 0)).toHaveText('55.5 BB');

  await page.getByTestId('seat-1-stack').click();
  await page.getByTestId('seat-1-stack-input').fill('66.25');
  await page.getByTestId('seat-1-stack-input').press('Enter');
  await expect(stackOf(page, 1)).toHaveText('66.25 BB');

  // --- WP-1 and WP-6 ride the same boundary -------------------------------------------
  await page.getByTestId('seat-2-occupancy-toggle').click();
  await expect(page.getByTestId('seat-2-occupancy')).toHaveAttribute('data-sitting-out', 'true');

  await page.getByTestId('seat-1-correction-toggle').click();
  await page.getByTestId('seat-1-correction-button-seat').click();
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');
  await page.getByTestId('seat-1-correction-toggle').click(); // close the panel

  // The writes are unawaited by design, so wait for them to land — and require that none of
  // them failed. A silent failure here is exactly the state this ADR refuses to hide.
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('seat-state-save-error')).toHaveCount(0);
  await expect(page.getByTestId('occupancy-save-error')).toHaveCount(0);

  // --- the reload: everything below is read back from SQLite by the server -------------
  await page.reload();

  await expect(stackOf(page, 0)).toHaveText('55.5 BB');
  await expect(stackOf(page, 1)).toHaveText('66.25 BB');
  await expect(stackOf(page, 2)).toHaveText('100 BB');
  await expect(page.getByTestId('seat-2-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-button', 'false');

  // ...and the restored state is what the engine actually deals from, not just what is drawn:
  // the sat-out seat gets no cards and the restored button posts the restored blinds.
  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('engine-error')).toHaveCount(0);
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-button', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-bb', 'true');
});
