import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { startSession } from './helpers.js';

/**
 * C1 — 세션 분석 및 반영, end to end in a real browser (prompt §40).
 *
 * One spec, one session, because every step depends on the history the previous step created:
 * hands are played, stored, analysed, re-analysed, and a sat-out seat must be missing from
 * exactly the hand it sat out of. Splitting that into six specs would mean rebuilding the same
 * history six times.
 *
 * What only a browser can prove here:
 *  - the button really is disabled while a hand is live and enabled between hands;
 *  - the summary is produced by the real service over hands the real persist path stored;
 *  - a second click over unchanged history reports 변경 없음 and does NOT double any count;
 *  - a seat that sat out is attributed correctly — its model does not grow, the others' do;
 *  - the Strategy Panel's recommendation is BIT-identical before and after analysis
 *    (prompt §29, ADR-0062g), asserted through the same UI a user reads it from.
 *
 * Controls are addressed by `data-testid`; the Korean copy is asserted deliberately, where it
 * is the thing under test (the disclaimer and the 변경 없음 status).
 */

const NICKNAMES = ['C1D One', 'C1D Two', 'C1D Three', 'C1D Four', 'C1D Five', 'C1D Six'] as const;

const analysisButton = (page: Page): Locator => page.getByTestId('run-analysis');

/** The summary row for one nickname, whose player id the test never needs to know. */
const summaryRow = (page: Page, nickname: string): Locator =>
  page.getByTestId('analysis-players').locator('li').filter({ hasText: nickname });

/** Waits for the scheduled strategy analysis to land rather than reading a half-built panel. */
async function readyStrategy(page: Page): Promise<Locator> {
  const panel = page.getByTestId('strategy-panel');
  await expect(panel).toHaveAttribute('data-state', 'READY');
  await expect(panel).toHaveAttribute('data-stale', 'false');
  return panel;
}

/** Everything about the BTN RFI recommendation that a user reads off the panel. */
async function readRecommendation(page: Page): Promise<readonly string[]> {
  const panel = await readyStrategy(page);
  return Promise.all([
    panel.getAttribute('data-family').then((v) => `family=${v}`),
    panel.getAttribute('data-primary').then((v) => `primary=${v}`),
    page.getByTestId('strategy-hand-class').innerText(),
    page.getByTestId('strategy-frequency-RAISE').innerText(),
    page.getByTestId('strategy-sizing').innerText(),
    page.getByTestId('strategy-model-bucket').innerText(),
  ]);
}

/** Opens 세션 분석 및 반영 and waits for the summary. */
async function runAnalysis(page: Page): Promise<void> {
  await expect(analysisButton(page)).toBeEnabled();
  await analysisButton(page).click();
  await expect(page.getByTestId('analysis-overlay')).toBeVisible();
  await expect(page.getByTestId('analysis-totals')).toBeVisible();
}

async function closeAnalysis(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('analysis-overlay')).toHaveCount(0);
}

test('analyses a played session, does not double-count a second run, and leaves 기본전략 untouched', async ({
  page,
}) => {
  test.slow();

  await startSession(page, { nicknames: [...NICKNAMES], heroSeat: 0, buttonSeat: 0 });
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 0');

  // ---------------------------------------------------------------- hand 1: BTN RFI, folded out
  await page.getByTestId('start-hand').click();
  await page.getByTestId('palette-Ah').click();
  await page.getByTestId('palette-Kh').click();

  // The button is disabled the moment a hand is live (prompt §26), and says why.
  await expect(analysisButton(page)).toBeDisabled();
  await expect(page.getByTestId('analysis-gate-reason')).toContainText('진행 중인 핸드');

  for (let i = 0; i < 3; i += 1) await page.getByTestId('dock-F').click();
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');

  // The fixture: what 기본전략 recommends here, BEFORE any analysis has ever run.
  const before = await readRecommendation(page);
  expect(before[0]).toBe('family=RFI');

  for (let i = 0; i < 2; i += 1) await page.getByTestId('dock-F').click();
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 1');
  await expect(page.getByTestId('hand-save-error')).toHaveCount(0);

  // ---------------------------------------------------- hand 2: a showdown with an opponent SHOW
  // The button has moved on: BTN=1, SB=2, BB=3, UTG=4, HJ=5, CO=0 (hero).
  await page.getByTestId('start-hand').click();
  await page.getByTestId('palette-Qs').click();
  await page.getByTestId('palette-Jd').click();
  for (let i = 0; i < 4; i += 1) await page.getByTestId('dock-F').click();
  // Seat 2 (SB) completes, seat 3 (BB) checks: heads up to a flop.
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();
  for (const card of ['2c', '7d', '9h']) await page.getByTestId(`palette-${card}`).click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('palette-3s').click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('palette-4s').click();
  await page.getByTestId('dock-C').click();
  await page.getByTestId('dock-C').click();

  await expect(page.getByTestId('award-panel')).toBeVisible();
  // Still mid-hand: the pot has not been given to anybody, so analysis is still refused.
  await expect(analysisButton(page)).toBeDisabled();

  // Seat 3 SHOWS. The cards are entered exactly as the user would enter them.
  await page.getByTestId('award-show-3').click();
  await page.getByTestId('palette-As').click();
  await page.getByTestId('palette-Kd').click();
  await expect(page.getByTestId('award-shown-3')).toBeVisible();

  await page.getByTestId('award-seat-0-2').click();
  await page.getByTestId('award-submit').click();

  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 2');
  await expect(page.getByTestId('hand-save-error')).toHaveCount(0);

  // ------------------------------------------------------------------------ the first analysis
  await expect(analysisButton(page)).toBeEnabled();
  await expect(page.getByTestId('analysis-gate-reason')).toHaveCount(0);
  await runAnalysis(page);

  await expect(page.getByTestId('analysis-total-hands')).toHaveText('2');
  await expect(page.getByTestId('analysis-total-players')).toHaveText('6');
  await expect(page.getByTestId('analysis-total-show')).toHaveText('1');
  await expect(page.getByTestId('analysis-status')).toHaveText('완료');
  // Prompt §27: the model changed, and the recommendation did not. Said in words.
  await expect(page.getByTestId('analysis-disclaimer')).toHaveText(
    '플레이어 모델이 업데이트되었습니다. 현재 기본전략 추천에는 아직 반영되지 않습니다.',
  );

  const shower = summaryRow(page, 'C1D Four');
  await expect(shower).toHaveAttribute('data-outcome', 'SNAPSHOT_CREATED');
  await expect(shower.getByTestId(/^analysis-outcome-/u)).toHaveText('반영 완료');
  await expect(shower.getByTestId(/^analysis-total-/u)).toHaveText('2 hands');
  // A first snapshot has nothing to be added to; it is a dash, not the whole history.
  await expect(shower.getByTestId(/^analysis-added-/u)).toHaveText('—');
  await expect(shower.getByTestId(/^analysis-model-/u)).toHaveText('v1');
  await expect(shower.getByTestId(/^analysis-show-/u)).toHaveText('1');

  // -------------------------------------------------------------------- the player model panel
  await shower.getByTestId(/^analysis-open-profile-/u).click();
  await expect(page.getByTestId('player-model')).toBeVisible();
  await expect(page.getByTestId('model-hand-count')).toHaveText('2');
  await expect(page.getByTestId('model-version')).toHaveText('v1');
  await expect(page.getByTestId('model-show-count')).toHaveText('1');
  await expect(page.getByTestId('model-version-1')).toContainText('v1 · 2핸드');
  // Opportunity counts, with denominators, exactly as prompt §28 requires.
  await expect(page.getByTestId('model-stat-VPIP')).toContainText('기회 2');
  const spots = page.getByTestId('model-spots').locator('li[data-testid^="model-spot-"]');
  await expect(spots.first()).toContainText('기회 ');
  expect(await spots.count()).toBeGreaterThan(0);

  // ------------------------------------------------------- a second run must not double a thing
  await closeAnalysis(page);
  await runAnalysis(page);

  await expect(page.getByTestId('analysis-total-hands')).toHaveText('2');
  await expect(page.getByTestId('analysis-status')).toHaveText('완료');
  const again = summaryRow(page, 'C1D Four');
  await expect(again).toHaveAttribute('data-outcome', 'NO_CHANGES');
  await expect(again.getByTestId(/^analysis-outcome-/u)).toHaveText('변경 없음');
  // 2, not 4: the model is a full recomputation, not an increment (prompt §14, §38).
  await expect(again.getByTestId(/^analysis-total-/u)).toHaveText('2 hands');
  await expect(again.getByTestId(/^analysis-added-/u)).toHaveText('0 hands');
  await expect(again.getByTestId(/^analysis-model-/u)).toHaveText('v1');
  await expect(page.getByTestId('analysis-disclaimer')).toContainText('그대로 유지되었습니다');
  await expect(page.getByTestId('analysis-disclaimer')).toContainText(
    '현재 기본전략 추천에는 아직 반영되지 않습니다.',
  );

  await again.getByTestId(/^analysis-open-profile-/u).click();
  await expect(page.getByTestId('model-hand-count')).toHaveText('2');
  await expect(page.getByTestId('model-version')).toHaveText('v1');
  // One version, not two: nothing was written by the second run.
  await expect(page.getByTestId('model-versions').locator('li')).toHaveCount(1);

  // ------------------------------------------------------- hand 3: 6 -> 5, attributed correctly
  await closeAnalysis(page);
  await page.getByTestId('seat-5-occupancy-toggle').click();
  await expect(page.getByTestId('seat-5-occupancy')).toHaveAttribute('data-sitting-out', 'true');

  await page.getByTestId('start-hand').click();
  await expect(page.getByTestId('seat-5')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
  // Five-handed: four folds end it uncontested.
  for (let i = 0; i < 4; i += 1) await page.getByTestId('dock-F').click();
  await expect(page.getByTestId('stored-hand-count')).toHaveText('저장된 핸드 3');

  await runAnalysis(page);
  await expect(page.getByTestId('analysis-total-hands')).toHaveText('3');

  // The five who played get a v2 over three hands...
  const played = summaryRow(page, 'C1D One');
  await expect(played).toHaveAttribute('data-outcome', 'SNAPSHOT_CREATED');
  await expect(played.getByTestId(/^analysis-total-/u)).toHaveText('3 hands');
  await expect(played.getByTestId(/^analysis-added-/u)).toHaveText('1 hands');
  await expect(played.getByTestId(/^analysis-model-/u)).toHaveText('v2');

  // ...and the seat that sat out is unchanged, still on two hands and still v1.
  const satOut = summaryRow(page, 'C1D Six');
  await expect(satOut).toHaveAttribute('data-outcome', 'NO_CHANGES');
  await expect(satOut.getByTestId(/^analysis-total-/u)).toHaveText('2 hands');
  await expect(satOut.getByTestId(/^analysis-model-/u)).toHaveText('v1');

  await satOut.getByTestId(/^analysis-open-profile-/u).click();
  await expect(page.getByTestId('model-hand-count')).toHaveText('2');
  await expect(page.getByTestId('model-versions').locator('li')).toHaveCount(1);

  // ------------------------------------- prompt §29: the recommendation is BIT-identical after
  // A fresh session with the SAME nicknames — so the very players who now have model snapshots
  // are at the table — and the same first hand. 기본전략 must answer exactly as it did before.
  await closeAnalysis(page);
  await startSession(page, { nicknames: [...NICKNAMES], heroSeat: 0, buttonSeat: 0 });
  await page.getByTestId('start-hand').click();
  await page.getByTestId('palette-Ah').click();
  await page.getByTestId('palette-Kh').click();
  for (let i = 0; i < 3; i += 1) await page.getByTestId('dock-F').click();
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-actor', 'true');

  const after = await readRecommendation(page);
  expect(after).toEqual(before);
});
