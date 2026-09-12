/**
 * The global shift cap, AFTER quantization.
 *
 * `MAX_TOTAL_SHIFT_BPS_*` is the promise that ADAPTIVE is a correction to REFERENCE and not
 * a replacement for it, and `AdaptiveRecommendation.totalShiftBps` documents itself as
 * "never above the cap". Two separate mechanisms deliver that: contributions are scaled
 * proportionally BEFORE the mix is projected, and `trimToCap` hands grid units back AFTER
 * `quantizeFrequenciesToGrid` has rounded onto ADAPTIVE's 100-bps grid.
 *
 * Only the first had coverage. Review R1 (MAJOR 2) showed `trimToCap` could be replaced by
 * `return false` with the entire suite still green, including the enumerated sweep whose
 * fifth invariant IS the cap: rounding pushes a mix over the line only for particular
 * baselines, and no committed test used one. The fixtures below are those baselines, found
 * by brute force with the trim disabled and pinned here so the guarantee is tested rather
 * than asserted.
 */
import { describe, expect, it } from 'vitest';
import { composeAdaptive, type AdaptiveComposeContext } from '../compose.js';
import { MAX_TOTAL_SHIFT_BPS_HEADS_UP, MAX_TOTAL_SHIFT_BPS_MULTIWAY } from './frequencyModel.js';
import {
  FIXTURE_WAGER,
  action,
  baselineOf,
  learned,
  ordering,
  profileOf,
} from '../testBaseline.js';
import type { AdaptiveRecommendation } from '../recommendation.js';

/** The measured movement of a finished mix off its baseline, in basis points. */
const shiftOf = (result: AdaptiveRecommendation): number =>
  result.actions.reduce((sum, entry) => sum + Math.abs(entry.deltaBps), 0) / 2;

/**
 * A station read (folds to c-bets far too rarely, goes to showdown far too often) against a
 * three-row FOLD/CALL/RAISE baseline. Every one of these overshoots to 1500 bps — half again
 * the multiway cap — when the post-quantization trim is removed.
 */
const STATION = [learned('FOLD_TO_CBET_FLOP', 200, 400), learned('WTSD', 9800, 400)] as const;

function compose(
  frequencies: readonly [number, number, number],
  activeOpponentCount: number,
): AdaptiveRecommendation {
  const context: AdaptiveComposeContext = {
    opponents: [ordering('v', { seatIndex: 2, actionOrderIndex: 0 })],
    wager: FIXTURE_WAGER,
  };
  return composeAdaptive(
    baselineOf({
      aggressionBand: 'MODERATE',
      activeOpponentCount,
      heroFacingBet: false,
      actions: [
        action('FOLD', frequencies[0]),
        action('CALL', frequencies[1]),
        action('RAISE', frequencies[2]),
      ],
      primaryKind: 'CALL',
    }),
    [profileOf('v', [...STATION], 2)],
    context,
  );
}

describe('the global cap survives quantization', () => {
  // Each of these lands on 1500 bps against a 1000 bps cap with `trimToCap` disabled.
  const OVERSHOOTING_BASELINES = [
    [2500, 6000, 1500],
    [6000, 2500, 1500],
  ] as const;

  it('holds every overshooting baseline at or under the multiway cap', () => {
    for (const frequencies of OVERSHOOTING_BASELINES) {
      const result = compose(frequencies, 2);
      expect(shiftOf(result)).toBeLessThanOrEqual(MAX_TOTAL_SHIFT_BPS_MULTIWAY);
      expect(result.totalShiftBps).toBe(shiftOf(result));
      expect(result.capApplied).toBe(true);
    }
  });

  it('keeps the grid and the total intact while trimming', () => {
    for (const frequencies of OVERSHOOTING_BASELINES) {
      const result = compose(frequencies, 2);
      const emitted = result.actions.map((entry) => entry.frequencyBps);
      expect(emitted.reduce((sum, value) => sum + value, 0)).toBe(10000);
      for (const value of emitted) {
        expect(value % 100).toBe(0);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      // The trim hands units back between EXISTING rows; it never invents an action.
      expect(result.actions.map((entry) => entry.kind)).toEqual(['FOLD', 'CALL', 'RAISE']);
    }
  });

  it('applies the heads-up cap to the same shapes', () => {
    for (const frequencies of OVERSHOOTING_BASELINES) {
      expect(shiftOf(compose(frequencies, 1))).toBeLessThanOrEqual(MAX_TOTAL_SHIFT_BPS_HEADS_UP);
    }
  });

  it('still emits a legal, self-consistent mix from an off-grid baseline', () => {
    // Review R1 (MINOR 10). `baseline.ts` deliberately declines to assert the 500 grid on its
    // input, so a caller CAN hand over a mix the trim's "one move = exactly 100 bps" reasoning
    // does not hold for. What this pins is what is actually reachable: the output is still on
    // the grid, still sums to 10000, and `totalShiftBps` still describes the mix that was
    // emitted rather than the one that was aimed at.
    //
    // It deliberately does NOT claim to cover `trimToCap`'s no-progress branch. That branch
    // needs a row whose own |delta| is under 50 on both sides of the transfer while the
    // per-side totals exceed the cap, which takes many rows per side to occur. A baseline has
    // at most six. The branch is a labelled net for a case these row counts make unreachable,
    // and disabling it leaves this test green, as it should.
    const OFF_GRID = [
      [2437, 6081, 1482],
      [3301, 5099, 1600],
      [1234, 7777, 989],
      [2500, 6013, 1487],
    ] as const;

    for (const frequencies of OFF_GRID) {
      expect(frequencies.reduce((sum, value) => sum + value, 0)).toBe(10000);
      const result = compose(frequencies, 2);

      const emitted = result.actions.map((entry) => entry.frequencyBps);
      expect(emitted.reduce((sum, value) => sum + value, 0)).toBe(10000);
      for (const value of emitted) expect(value % 100).toBe(0);
      expect(result.totalShiftBps).toBe(shiftOf(result));

      // One grid rounding on top of the pre-quantization cap is the honest bound here.
      expect(result.totalShiftBps).toBeLessThanOrEqual(MAX_TOTAL_SHIFT_BPS_MULTIWAY + 100);
    }
  });

  it('reports a shift that matches the mix it emitted', () => {
    // `totalShiftBps` is read off the FINAL quantized mix, so a trim that moved a unit
    // without updating the reported number would show up here.
    const result = compose([2500, 6000, 1500], 2);
    expect(result.totalShiftBps).toBe(shiftOf(result));
  });
});

describe('cap scaling shrinks a contribution, in both directions', () => {
  /**
   * `scaleDownSigned` truncates toward zero rather than flooring, and the difference only
   * shows on NEGATIVE values: `Math.floor(-672 * 0.65)` moves AWAY from zero, which would
   * make the global cap *increase* a de-escalating contribution — a cap that makes the
   * strategy move further is not a cap. The function is private, so the property is pinned
   * through the public result, which is also where a regression would actually hurt.
   */
  const shapes = [
    { frequencies: [2500, 6000, 1500] as const, opponents: 2 },
    { frequencies: [6000, 2500, 1500] as const, opponents: 2 },
    { frequencies: [2000, 5000, 3000] as const, opponents: 2 },
    { frequencies: [2000, 5000, 3000] as const, opponents: 1 },
  ];

  it('never lets |contribution| exceed |raw contribution|', () => {
    let checked = 0;
    for (const shape of shapes) {
      for (const adjustment of compose(shape.frequencies, shape.opponents).adjustments) {
        expect(Math.abs(adjustment.contributionBps)).toBeLessThanOrEqual(
          Math.abs(adjustment.rawContributionBps),
        );
        checked += 1;
      }
    }
    // Non-vacuity: the loop must actually have inspected some adjustments.
    expect(checked).toBeGreaterThan(0);
  });

  it('never flips the sign of a contribution', () => {
    for (const shape of shapes) {
      for (const adjustment of compose(shape.frequencies, shape.opponents).adjustments) {
        if (adjustment.rawContributionBps === 0) continue;
        if (adjustment.contributionBps === 0) continue;
        expect(Math.sign(adjustment.contributionBps)).toBe(
          Math.sign(adjustment.rawContributionBps),
        );
      }
    }
  });
});
