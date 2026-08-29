import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Phase 6 — a whole hand played from the keyboard, in a real browser.
 *
 * The two things this proves that a component test cannot:
 *  - the key -> `poker-core` -> render path fires NO network request, so the interaction
 *    is genuinely local and synchronous (`prompt` D1);
 *  - focus really moves into the raise editor, and a hotkey typed there does not act.
 */

const stackOf = (page: Page, seat: number) =>
  page.getByTestId(`seat-${seat}`).locator('span.tabular').first();

async function startFiveHandedSession(page: Page): Promise<void> {
  await page.goto('/session/new');
  const nicknames = ['P6 Hero', 'P6 Small', 'P6 Big', 'P6 Under', 'P6 Jack'];
  for (let seat = 1; seat <= 6; seat += 1) {
    if (seat <= 5) {
      await page.getByLabel(`Seat ${seat} nickname`).fill(nicknames[seat - 1] ?? '');
      await page.getByLabel(`Seat ${seat} stack in BB`).fill('100');
    } else {
      await page.getByLabel(`Seat ${seat} occupancy`).selectOption('EMPTY');
    }
  }
  await page.getByLabel('Seat 1 is Hero').check();
  await page.getByLabel('Seat 1 has the button').check();
  await page.getByRole('button', { name: 'Start Session' }).click();
  await page.waitForURL(/\/table\/[^/]+$/u);
}

test('plays a hand from the keyboard with no network request on the action path', async ({
  page,
}) => {
  const requests: string[] = [];
  await startFiveHandedSession(page);
  // Only what happens AFTER the table is on screen counts: the action path itself.
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('pot')).toHaveText('2.3 BB');

  // Two folds: UTG then the hijack, leaving the button (Hero) on the clock.
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-3')).toHaveAttribute('data-status', 'FOLDED');
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-4')).toHaveAttribute('data-status', 'FOLDED');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');
  await expect(page.getByTestId('pot')).toHaveText('2.3 BB');

  // R focuses the editor; the preview comes from the engine, not from the page.
  await page.keyboard.press('r');
  await expect(page.getByTestId('raise-input')).toBeFocused();
  await page.keyboard.type('9');
  await expect(page.getByTestId('raise-preview-min')).toContainText('Min 2 BB');
  await expect(page.getByTestId('raise-preview-max')).toContainText('Max 99.84 BB');
  await expect(page.getByTestId('raise-preview-to')).toContainText('Raise to 9 BB');

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pot')).toHaveText('11.3 BB');
  await expect(page.getByTestId('seat-0-contribution')).toHaveText('9 BB');
  await expect(stackOf(page, 0)).toHaveText('90.84 BB');

  // The small blind calls, the big blind shoves.
  await page.keyboard.press('c');
  await expect(page.getByTestId('pot')).toHaveText('19.8 BB');
  await expect(stackOf(page, 1)).toHaveText('90.84 BB');

  await page.keyboard.press('a');
  await expect(page.getByTestId('pot')).toHaveText('118.64 BB');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-status', 'ALL_IN');
  await expect(stackOf(page, 2)).toHaveText('0 BB');

  // Undo puts the actor, the pot and the stack back exactly.
  await page.keyboard.press('z');
  await expect(page.getByTestId('pot')).toHaveText('19.8 BB');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-status', 'IN_HAND');
  await expect(page.getByTestId('seat-2')).toHaveAttribute('data-actor', 'true');
  await expect(stackOf(page, 2)).toHaveText('98.84 BB');
  await expect(page.getByTestId('seat-2-contribution')).toHaveText('1 BB');

  // A call instead closes the round, and the engine asks for a flop.
  await page.keyboard.press('c');
  await expect(page.getByTestId('phase')).toContainText(/awaiting flop/iu);
  await expect(page.getByTestId('pot')).toHaveText('27.8 BB');

  expect(requests).toEqual([]);
});

test('a hotkey typed into the raise editor does not act on the hand', async ({ page }) => {
  await startFiveHandedSession(page);
  await page.getByTestId('start-hand').click();

  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');

  await page.keyboard.press('r');
  await page.keyboard.type('f');

  // The letter landed in the field; nobody folded.
  await expect(page.getByTestId('raise-input')).toHaveValue('f');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-status', 'IN_HAND');
  await expect(page.getByTestId('raise-problem')).toContainText('Not a valid amount');

  // Enter refuses it and the typed text survives (`CLAUDE.md` rule 3).
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('raise-input')).toHaveValue('f');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');
});
