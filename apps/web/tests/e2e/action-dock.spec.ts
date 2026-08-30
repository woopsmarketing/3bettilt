import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { stackOf, startSession } from './helpers.js';

/**
 * Phase 6 — a whole hand played from the keyboard, in a real browser.
 *
 * The two things this proves that a component test cannot:
 *  - the key -> `poker-core` -> render path fires NO network request, so the interaction
 *    is genuinely local and synchronous (`prompt` D1);
 *  - focus really moves into the raise editor, and a hotkey typed there does not act.
 *
 * Every control is addressed by `data-testid`. The Korean copy is asserted once, on
 * purpose, in the preview and problem lines the user actually reads.
 */

const startFiveHandedSession = (page: Page): Promise<void> =>
  startSession(page, {
    nicknames: ['P6 Hero', 'P6 Small', 'P6 Big', 'P6 Under', 'P6 Jack'],
    heroSeat: 0,
    buttonSeat: 0,
  });

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
  await expect(page.getByTestId('raise-preview-min')).toContainText('최소 2 BB');
  await expect(page.getByTestId('raise-preview-max')).toContainText('최대 99.84 BB');
  await expect(page.getByTestId('raise-preview-to')).toContainText('레이즈 9 BB');

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
  await expect(page.getByTestId('phase')).toContainText('플랍 대기');
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

  // The letter landed in the field; nobody folded. The parser's own reason is shown
  // verbatim inside the Korean sentence (`CLAUDE.md` rule 3).
  await expect(page.getByTestId('raise-input')).toHaveValue('f');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-status', 'IN_HAND');
  await expect(page.getByTestId('raise-problem')).toContainText('금액을 읽을 수 없습니다');
  await expect(page.getByTestId('raise-problem')).toContainText('not a number');

  // Enter refuses it and the typed text survives (`CLAUDE.md` rule 3).
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('raise-input')).toHaveValue('f');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');
});

/**
 * The layout guarantee the Alpha did not have: the action dock is the primary control and
 * must be inside the viewport in every phase, including while the card palette is open.
 */
test('keeps the action dock inside the viewport while the palette is open', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await startFiveHandedSession(page);
  await page.getByTestId('start-hand').click();

  // The palette opened itself for hero's hole cards: the tallest state the tray has.
  await expect(page.getByTestId('card-palette')).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const dock = await page.getByTestId('action-dock').boundingBox();
  const tray = await page.getByTestId('entry-tray').boundingBox();
  expect(dock).not.toBeNull();
  expect(tray).not.toBeNull();
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(viewport!.height);
  // Nothing scrolled: the page itself never grew past the viewport.
  const scroll = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    client: document.documentElement.clientHeight,
  }));
  expect(scroll.height).toBeLessThanOrEqual(scroll.client);

  // ...and the bottom region does not move when the palette goes away.
  const trayBefore = tray!.y;
  const dockBefore = dock!.y;
  await page.getByTestId('palette-As').click();
  await page.getByTestId('palette-Kd').click();
  await expect(page.getByTestId('card-palette')).toHaveCount(0);

  const trayAfter = await page.getByTestId('entry-tray').boundingBox();
  const dockAfter = await page.getByTestId('action-dock').boundingBox();
  expect(trayAfter!.y).toBe(trayBefore);
  expect(dockAfter!.y).toBe(dockBefore);
});

/**
 * The award panel is the one panel that moves money, and its submit button is the whole
 * point of it. The Alpha's fixed-height entry tray pinned the tray at the palette's height,
 * which is SHORTER than the award panel: the submit button landed underneath the action
 * dock, half covered, at the exact moment the user has to settle a pot.
 *
 * The tray now grows for the award panel and takes the space from the felt above it, so
 * this asserts the thing that actually matters — the button is fully clear of the dock —
 * rather than that the tray happens to be some particular height.
 */
test('the award submit button is never covered by the action dock', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await startFiveHandedSession(page);
  await page.getByTestId('start-hand').click();
  await page.getByTestId('palette-As').click();
  await page.getByTestId('palette-Kd').click();

  // Two folds, then everyone checks every street down to a showdown.
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  for (const card of ['7h', '2c', 'Ts']) await page.getByTestId(`palette-${card}`).click();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('c');
  await page.getByTestId('palette-4d').click();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('c');
  await page.getByTestId('palette-9s').click();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('c');

  await expect(page.getByTestId('award-panel')).toBeVisible();
  const submit = await page.getByTestId('award-submit').boundingBox();
  const dock = await page.getByTestId('action-dock').boundingBox();
  expect(submit).not.toBeNull();
  expect(dock).not.toBeNull();
  // Fully above the dock, not merely "on the page".
  expect(submit!.y + submit!.height).toBeLessThanOrEqual(dock!.y);
  // And the dock itself is still pinned inside the viewport.
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(800);
});
