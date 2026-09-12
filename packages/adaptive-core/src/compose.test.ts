/**
 * The ADAPTIVE composition, pinned on real numbers.
 *
 * Every expected value in this file was computed from the formulas in `profile.ts`,
 * `frequencyModel.ts` and `frequency.ts` BY HAND and is written as a literal, in the same style
 * as `profile.test.ts`. A test that recomputes the formula it is testing asserts only that the
 * code agrees with itself, which is exactly the property a wrong formula preserves.
 *
 * Covers WP-J design contract §10 rows 1, 2, 3, 4, 5, 10, 11 and 12. Row 9 (the structural
 * sweep) is `policy/invariants.test.ts`; rows 6, 7 and 8 belong to `apps/web`.
 */
import { describe, expect, it } from 'vitest';
import { composeAdaptive, type AdaptiveComposeContext } from './compose.js';
import type { AdaptiveAction, AdaptiveRecommendation } from './recommendation.js';
import type { AdaptiveRuleId } from './recommendation.js';
import {
  MAX_TOTAL_SHIFT_BPS_HEADS_UP,
  MAX_TOTAL_SHIFT_BPS_MULTIWAY,
} from './policy/frequencyModel.js';
import { FIXTURE_WAGER, baselineOf, learned, ordering, profileOf } from './testBaseline.js';
import type { PlayerAdjustmentProfile } from './profile.js';
import type { AdaptiveBaseline } from './baseline.js';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const heroFacingNobody = (playerId: string): AdaptiveComposeContext => ({
  opponents: [ordering(playerId)],
  wager: FIXTURE_WAGER,
});

const frequencyOf = (result: AdaptiveRecommendation, kind: AdaptiveAction['kind']): number =>
  result.actions.find((entry) => entry.kind === kind)?.frequencyBps ?? -1;

const adjustmentOf = (result: AdaptiveRecommendation, ruleId: AdaptiveRuleId) =>
  result.adjustments.find((entry) => entry.ruleId === ruleId) ?? null;

const contributionOf = (result: AdaptiveRecommendation, ruleId: AdaptiveRuleId): number =>
  adjustmentOf(result, ruleId)?.contributionBps ?? 0;

/** The nit: folds to 75% of flop c-bets over 100 observations. */
const nit = (playerId = 'nit'): PlayerAdjustmentProfile =>
  profileOf(playerId, [learned('FOLD_TO_CBET_FLOP', 7500, 100)]);

/** The calling station: reaches showdown often, almost never folds to a c-bet. */
const station = (playerId = 'station'): PlayerAdjustmentProfile =>
  profileOf(playerId, [learned('WTSD', 4500, 200), learned('FOLD_TO_CBET_FLOP', 2000, 100)]);

/** The check-raiser: 30% on the flop against an 800 bps anchor. */
const checkRaiser = (playerId = 'raiser'): PlayerAdjustmentProfile =>
  profileOf(playerId, [learned('CHECK_RAISE_FLOP', 3000, 100)]);

/* -------------------------------------------------------------------------- */
/* Row 1 — the same baseline reads differently against two different players    */
/* -------------------------------------------------------------------------- */

describe('J10.1 — one baseline, two opponents', () => {
  const baseline = baselineOf();
  const tight = composeAdaptive(baseline, [nit()], heroFacingNobody('nit'));
  const loose = composeAdaptive(baseline, [station()], heroFacingNobody('station'));

  it('produces different ADAPTIVE mixes for a nit and a station', () => {
    expect(tight.status).toBe('ADAPTED');
    expect(loose.status).toBe('ADAPTED');
    expect(tight.actions).not.toEqual(loose.actions);
  });

  /**
   * WHICH WAY THE COMPARISON POINTS DEPENDS ON WHAT HERO HOLDS, and that is the point.
   *
   * This assertion used to read "the nit is bet at MORE often than the station" against
   * `baselineOf()`'s own STRONG band alone, which was true only because `FOLD_TO_CBET_LOW`
   * had no band condition and so cut a VALUE bet against the one opponent least likely to
   * fold to it (WP-K follow-up §1). The fixtures are unchanged; the claim is now checked on
   * BOTH sides of the band split, so the test pins the SIGN FLIP rather than one half of it.
   */
  it('bets the station MORE with a value hand and the nit MORE with a bluff', () => {
    const value = baselineOf({ aggressionBand: 'STRONG' });
    const bluff = baselineOf({ aggressionBand: 'WEAK' });

    const nitValue = composeAdaptive(value, [nit()], heroFacingNobody('nit'));
    const stationValue = composeAdaptive(value, [station()], heroFacingNobody('station'));
    // A hand that wants a call is bet more often at the player who calls.
    expect(frequencyOf(stationValue, 'BET')).toBeGreaterThan(frequencyOf(nitValue, 'BET'));

    const nitBluff = composeAdaptive(bluff, [nit()], heroFacingNobody('nit'));
    const stationBluff = composeAdaptive(bluff, [station()], heroFacingNobody('station'));
    // A hand that needs a fold is bet more often at the player who folds.
    expect(frequencyOf(nitBluff, 'BET')).toBeGreaterThan(frequencyOf(stationBluff, 'BET'));
  });

  it('echoes a deep-equal baseline in both — REFERENCE is untouched at this layer', () => {
    expect(tight.baseline).toEqual(loose.baseline);
    expect(tight.baseline).toEqual(baseline);
    expect(JSON.stringify(tight.baseline)).toBe(JSON.stringify(loose.baseline));
  });
});

/* -------------------------------------------------------------------------- */
/* Row 2 — a big sample moves the strategy strictly more than an extreme one    */
/* -------------------------------------------------------------------------- */

describe('J10.2 — sample size, not headline number, decides how far we move', () => {
  // prior 4500, K 40.
  //   75% over n=100 -> conf 7143, estimate 6643, deviation +2143
  //     raw    = floor(2143 * 4000 / 10000) = 857
  //     scaled = floor(857 * 7143 / 10000)  = 612
  //     capped = min(612, 1000)             = 612
  //   100% over n=2  -> conf 476, which is below the 2500 gate: the rule never fires.
  const many = composeAdaptive(
    baselineOf(),
    [profileOf('many', [learned('FOLD_TO_CBET_FLOP', 7500, 100)])],
    heroFacingNobody('many'),
  );
  const few = composeAdaptive(
    baselineOf(),
    [profileOf('few', [learned('FOLD_TO_CBET_FLOP', 10000, 2)])],
    heroFacingNobody('few'),
  );

  it('contributes 612 bps on 75% over 100 observations', () => {
    const adjustment = adjustmentOf(many, 'FOLD_TO_CBET_HIGH');
    expect(adjustment).not.toBeNull();
    expect(adjustment?.estimateBps).toBe(6643);
    expect(adjustment?.deviationBps).toBe(2143);
    expect(adjustment?.confidenceBps).toBe(7143);
    expect(adjustment?.rawContributionBps).toBe(857);
    expect(adjustment?.contributionBps).toBe(612);
    expect(adjustment?.cappedBy).toBeNull();
  });

  it('contributes nothing at all on 100% over 2 observations', () => {
    expect(few.status).toBe('INSUFFICIENT_DATA');
    expect(few.adjustments).toEqual([]);
    expect(few.notes.map((note) => note.code)).toContain('FREQUENCY_CONFIDENCE_GATE_NOT_MET');
  });

  it('moves the mix strictly more on the larger sample', () => {
    expect(contributionOf(many, 'FOLD_TO_CBET_HIGH')).toBeGreaterThan(
      contributionOf(few, 'FOLD_TO_CBET_HIGH'),
    );
    expect(many.totalShiftBps).toBeGreaterThan(few.totalShiftBps);
    // BET 60% -> 65%: [4000, 6000] + 612 to AGGRESSION = [3388, 6612] -> grid [3400, 6600].
    expect(frequencyOf(many, 'BET')).toBe(6600);
    expect(frequencyOf(many, 'CHECK')).toBe(3400);
    expect(many.totalShiftBps).toBe(600);
  });
});

/* -------------------------------------------------------------------------- */
/* Row 3 — the calling station                                                 */
/* -------------------------------------------------------------------------- */

describe('J10.3 — against a calling station', () => {
  // WTSD  4500 over n=200, K 50 -> conf 8000, estimate 4140, deviation +1440
  // FOLD_TO_CBET_FLOP 2000 over n=100, K 40 -> conf 7143, estimate 2714, deviation -1786
  const value = composeAdaptive(
    baselineOf({ aggressionBand: 'STRONG' }),
    [station()],
    heroFacingNobody('station'),
  );
  const weak = composeAdaptive(
    baselineOf({ aggressionBand: 'WEAK' }),
    [station()],
    heroFacingNobody('station'),
  );

  it('sizes UP one rung with a value hand: 75% pot -> 100% pot', () => {
    expect(value.sizing).not.toBeNull();
    expect(value.sizing?.fromBucketIndex).toBe(4);
    expect(value.sizing?.toBucketIndex).toBe(5);
    expect(value.sizing?.bucketDelta).toBe(1);
    expect(value.sizing?.fromPotFractionPercent).toBe(75);
    expect(value.sizing?.toPotFractionPercent).toBe(100);
    // 10 BB pot, nothing to call, hero has nothing in: 100% of pot = 10,000 milliBB.
    expect(value.sizing?.fromToAmountMbb).toBe(7_500);
    expect(value.sizing?.toToAmountMbb).toBe(10_000);
    expect(value.sizing?.requestedToAmountMbb).toBe(10_000);
    expect(value.sizing?.clamp).toBe('NONE');
  });

  it('clips the two agreeing station rules back to a single rung', () => {
    expect(adjustmentOf(value, 'SIZE_STATION_VALUE_UP')?.sizingSteps).toBe(1);
    expect(adjustmentOf(value, 'SIZE_STATION_VALUE_UP_FOLD')?.sizingSteps).toBe(1);
    expect(adjustmentOf(value, 'SIZE_STATION_VALUE_UP')?.cappedBy).toBe('SIZING_BUCKET_DELTA');
    expect(value.sizing?.bucketDelta).toBe(1);
  });

  it('reports zero frequency contribution for a sizing rule', () => {
    expect(adjustmentOf(value, 'SIZE_STATION_VALUE_UP')?.contributionBps).toBe(0);
    expect(adjustmentOf(value, 'SIZE_STATION_VALUE_UP')?.ruleKind).toBe('SIZING');
  });

  it('lowers aggression with a weak hand: BET 60% -> 50%', () => {
    // FOLD_TO_CBET_LOW  raw floor(1786*4000/10000)=714, scaled floor(714*7143/10000)=510 -> -510
    // WTSD_HIGH_BLUFF_DOWN raw floor(1440*3000/10000)=432, scaled floor(432*8000/10000)=345 -> -345
    // net -855: [4000,6000] -> [4855,5145] -> grid [4900,5100]
    expect(contributionOf(weak, 'FOLD_TO_CBET_LOW')).toBe(-510);
    expect(contributionOf(weak, 'WTSD_HIGH_BLUFF_DOWN')).toBe(-345);
    expect(frequencyOf(weak, 'BET')).toBe(5100);
    expect(frequencyOf(weak, 'CHECK')).toBe(4900);
    expect(weak.totalShiftBps).toBe(900);
  });

  it('does not size up a weak hand against a station', () => {
    expect(weak.sizing?.bucketDelta).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Row 4 — the nit                                                             */
/* -------------------------------------------------------------------------- */

describe('J10.4 — against a nit who folds to 75% of flop c-bets', () => {
  const value = composeAdaptive(
    baselineOf({ aggressionBand: 'STRONG' }),
    [nit()],
    heroFacingNobody('nit'),
  );
  const bluff = composeAdaptive(
    baselineOf({ aggressionBand: 'WEAK' }),
    [nit()],
    heroFacingNobody('nit'),
  );

  it('bets more often in both bands', () => {
    expect(contributionOf(value, 'FOLD_TO_CBET_HIGH')).toBe(612);
    expect(contributionOf(bluff, 'FOLD_TO_CBET_HIGH')).toBe(612);
    expect(frequencyOf(value, 'BET')).toBe(6600);
    expect(frequencyOf(bluff, 'BET')).toBe(6600);
  });

  it('sizes DOWN one rung when the extra bets are bluffs: 75% pot -> 67% pot', () => {
    expect(bluff.sizing?.bucketDelta).toBe(-1);
    expect(bluff.sizing?.toBucketIndex).toBe(3);
    expect(bluff.sizing?.toPotFractionPercent).toBe(67);
    // round(10,000 * 2/3) = 6,667 milliBB.
    expect(bluff.sizing?.toToAmountMbb).toBe(6_667);
    expect(adjustmentOf(bluff, 'SIZE_FOLDY_BLUFF_DOWN')?.sizingSteps).toBe(-1);
  });

  it('leaves a value hand at the size the engine chose', () => {
    expect(value.sizing?.bucketDelta).toBe(0);
    expect(value.sizing?.toToAmountMbb).toBe(7_500);
  });
});

/* -------------------------------------------------------------------------- */
/* Row 5 — the check-raiser                                                    */
/* -------------------------------------------------------------------------- */

describe('J10.5 — against a habitual check-raiser', () => {
  // CHECK_RAISE_FLOP 3000 over n=100, prior 800, K 40 -> conf 7143, estimate 2371, deviation +1571
  //   raw    = floor(1571 * 6000 / 10000) = 942
  //   scaled = floor(942 * 7143 / 10000)  = 672
  const result = composeAdaptive(
    baselineOf({ aggressionBand: 'MODERATE' }),
    [checkRaiser()],
    heroFacingNobody('raiser'),
  );

  it('lowers aggression with a marginal hand: BET 60% -> 55%', () => {
    const adjustment = adjustmentOf(result, 'CHECK_RAISE_HIGH');
    expect(adjustment?.estimateBps).toBe(2371);
    expect(adjustment?.deviationBps).toBe(1571);
    expect(adjustment?.contributionBps).toBe(-672);
    expect(adjustment?.target).toBe('AGGRESSION');
    expect(frequencyOf(result, 'BET')).toBe(5300);
    expect(frequencyOf(result, 'CHECK')).toBe(4700);
  });
});

/* -------------------------------------------------------------------------- */
/* Row 10 — no evidence, no adaptation                                          */
/* -------------------------------------------------------------------------- */

describe('J10.10 — an opponent we know nothing about', () => {
  const baseline = baselineOf();
  const empty = profileOf('ghost', []);
  const zeroSamples = profileOf('ghost2', [
    learned('FOLD_TO_CBET_FLOP', 9000, 0),
    learned('WTSD', 100, 0),
    learned('CHECK_RAISE_FLOP', 5000, 0),
  ]);

  it('reports INSUFFICIENT_DATA and echoes the baseline frequencies exactly', () => {
    for (const profile of [empty, zeroSamples]) {
      const result = composeAdaptive(baseline, [profile], heroFacingNobody(profile.playerId));
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.adjustments).toEqual([]);
      expect(result.totalShiftBps).toBe(0);
      expect(result.capApplied).toBe(false);
      expect(result.actions.map((entry) => entry.frequencyBps)).toEqual([4000, 6000]);
      expect(result.actions.every((entry) => entry.deltaBps === 0)).toBe(true);
      expect(result.sizing?.bucketDelta).toBe(0);
      expect(result.sizing?.toToAmountMbb).toBe(baseline.sizing?.toAmountMbb);
      expect(result.notes.map((note) => note.code)).toContain('FREQUENCY_CONFIDENCE_GATE_NOT_MET');
    }
  });

  it('names the gate that was not met', () => {
    const result = composeAdaptive(baseline, [empty], heroFacingNobody('ghost'));
    const note = result.notes.find((entry) => entry.code === 'FREQUENCY_CONFIDENCE_GATE_NOT_MET');
    expect(note?.detail).toBe('2500');
  });

  it('distinguishes "not enough evidence" from "no rule is about this spot"', () => {
    // Preflop, hero neither opening nor facing an open: all three preflop rules are out of
    // scope, so telling the user their sample was too small would be false.
    const outOfScope = composeAdaptive(
      baselineOf({
        street: 'PREFLOP',
        aggressionBand: null,
        heroIsPreflopOpener: false,
        heroFacingBet: false,
        sizing: null,
        actions: [
          { kind: 'CHECK', frequencyBps: 4000, toAmountMbb: null, isAllIn: false },
          { kind: 'RAISE', frequencyBps: 6000, toAmountMbb: null, isAllIn: false },
        ],
      }),
      [nit()],
      heroFacingNobody('nit'),
    );
    expect(outOfScope.status).toBe('INSUFFICIENT_DATA');
    expect(outOfScope.notes.map((note) => note.code)).toEqual(['NO_RULE_APPLIED_TO_SPOT']);
  });

  it('reports INSUFFICIENT_DATA when the caller names no primary villain', () => {
    const result = composeAdaptive(baseline, [nit()], { opponents: [], wager: FIXTURE_WAGER });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.notes.map((note) => note.code)).toContain('NO_PRIMARY_OPPONENT');
    expect(result.actions.map((entry) => entry.frequencyBps)).toEqual([4000, 6000]);
    // The profile is still reported, with no role that can influence anything.
    expect(result.opponents.map((entry) => entry.role)).toEqual(['OTHER']);
  });
});

/* -------------------------------------------------------------------------- */
/* Row 11 — multiway                                                           */
/* -------------------------------------------------------------------------- */

describe('J10.11 — multiway is bounded at half the heads-up cap', () => {
  // FOLD_TO_CBET_FLOP 100% over n=400 -> conf 9091, estimate 9500, deviation +5000
  //   raw floor(5000*4000/10000)=2000, scaled floor(2000*9091/10000)=1818, capped at 1000
  // WTSD 500 over n=400, K 50 -> conf 8889, estimate 744, deviation -1956
  //   raw floor(1956*3000/10000)=586, scaled floor(586*8889/10000)=520, cap 600 -> +520
  const extreme = profileOf('extreme', [
    learned('FOLD_TO_CBET_FLOP', 10000, 400),
    learned('WTSD', 500, 400),
  ]);

  const headsUp = composeAdaptive(
    baselineOf({ aggressionBand: 'MODERATE', activeOpponentCount: 1 }),
    [extreme],
    heroFacingNobody('extreme'),
  );
  const multiway = composeAdaptive(
    baselineOf({ aggressionBand: 'MODERATE', activeOpponentCount: 3 }),
    [extreme],
    heroFacingNobody('extreme'),
  );

  it('caps the heads-up shift at 2000 and the multiway shift at 1000', () => {
    expect(MAX_TOTAL_SHIFT_BPS_HEADS_UP).toBe(2000);
    expect(MAX_TOTAL_SHIFT_BPS_MULTIWAY).toBe(1000);
    expect(headsUp.totalShiftBps).toBe(1500);
    expect(headsUp.capApplied).toBe(false);
    expect(multiway.totalShiftBps).toBe(1000);
    expect(multiway.capApplied).toBe(true);
    expect(multiway.totalShiftBps).toBeLessThan(headsUp.totalShiftBps);
  });

  it('scales every contribution by the same ratio rather than truncating one', () => {
    // ratio = floor(1000 * 10000 / 1520) = 6578
    expect(contributionOf(headsUp, 'FOLD_TO_CBET_HIGH')).toBe(1000);
    expect(contributionOf(headsUp, 'WTSD_LOW_BLUFF_UP')).toBe(520);
    expect(contributionOf(multiway, 'FOLD_TO_CBET_HIGH')).toBe(657);
    expect(contributionOf(multiway, 'WTSD_LOW_BLUFF_UP')).toBe(342);
    expect(adjustmentOf(multiway, 'FOLD_TO_CBET_HIGH')?.cappedBy).toBe('TOTAL_SHIFT');
    expect(multiway.notes.map((note) => note.code)).toContain('TOTAL_SHIFT_CAP_APPLIED');
  });

  it('records the per-rule ceiling on the rule that hit it', () => {
    expect(adjustmentOf(headsUp, 'FOLD_TO_CBET_HIGH')?.cappedBy).toBe('RULE_MAX');
    expect(adjustmentOf(headsUp, 'FOLD_TO_CBET_HIGH')?.rawContributionBps).toBe(2000);
  });
});

describe('J10.11 — a known aggressor still to act refuses escalation, not de-escalation', () => {
  // PRIMARY acts first behind hero; a second opponent acts after that.
  const context: AdaptiveComposeContext = {
    opponents: [
      ordering('primary', { seatIndex: 2, actionOrderIndex: 0 }),
      ordering('lurker', { seatIndex: 4, actionOrderIndex: 1 }),
    ],
    wager: FIXTURE_WAGER,
  };
  const primary = profileOf(
    'primary',
    [learned('FOLD_TO_CBET_FLOP', 7500, 100), learned('CHECK_RAISE_FLOP', 3000, 100)],
    2,
  );
  const lurker = profileOf('lurker', [learned('CHECK_RAISE_FLOP', 3000, 100)], 4);

  const baseline = baselineOf({ aggressionBand: 'MODERATE', activeOpponentCount: 2 });
  const guarded = composeAdaptive(baseline, [primary, lurker], context);

  // The CONTROL: nobody still to act is an above-prior aggressor.
  //
  // Review R1 (MAJOR 1) corrected the guard to inspect every LIVE opponent STILL TO ACT,
  // the PRIMARY included — because when hero is not facing a bet the primary is itself a
  // player behind. So the control's primary must ALSO be free of a check-raise read; the
  // old fixture reused `primary`, whose own 30% check-raise now arms the guard, which made
  // it a second guarded case rather than a control.
  const calmPrimary = profileOf('primary', [learned('FOLD_TO_CBET_FLOP', 7500, 100)], 2);
  const unguarded = composeAdaptive(baseline, [calmPrimary, profileOf('lurker', [], 4)], context);

  it('assigns exactly one PRIMARY and marks the rest BEHIND', () => {
    expect(guarded.opponents.map((entry) => entry.role)).toEqual(['PRIMARY', 'BEHIND']);
  });

  it('zeroes the positive aggression contribution', () => {
    const adjustment = adjustmentOf(guarded, 'FOLD_TO_CBET_HIGH');
    expect(adjustment?.contributionBps).toBe(0);
    expect(adjustment?.cappedBy).toBe('AGGRESSIVE_PLAYER_BEHIND');
    expect(guarded.notes.map((note) => note.code)).toContain('AGGRESSIVE_PLAYER_BEHIND');
  });

  it('keeps the negative contribution from the PRIMARY', () => {
    const adjustment = adjustmentOf(guarded, 'CHECK_RAISE_HIGH');
    expect(adjustment?.contributionBps).toBe(-672);
    expect(adjustment?.cappedBy).toBeNull();
    // Aggression therefore goes DOWN, where the control's lone positive rule raises it.
    expect(frequencyOf(guarded, 'BET')).toBeLessThan(6000);
    expect(frequencyOf(guarded, 'BET')).toBeLessThan(frequencyOf(unguarded, 'BET'));
  });

  it('leaves the control untouched when nobody behind is an aggressor', () => {
    expect(contributionOf(unguarded, 'FOLD_TO_CBET_HIGH')).toBe(612);
    expect(adjustmentOf(unguarded, 'FOLD_TO_CBET_HIGH')?.cappedBy).toBeNull();
    expect(unguarded.notes.map((note) => note.code)).not.toContain('AGGRESSIVE_PLAYER_BEHIND');
  });

  it('only zeroes AGGRESSION, not every rule at the table', () => {
    // The guard is about escalation. A de-escalating rule on the same profile survives it.
    expect(contributionOf(guarded, 'CHECK_RAISE_HIGH')).toBe(-672);
  });
});

/* -------------------------------------------------------------------------- */
/* R1 MAJOR 1 — the heads-up hole: the guard's own case, with no third party    */
/* -------------------------------------------------------------------------- */

describe('R1 MAJOR 1 — heads-up, the one opponent still to act arms the guard', () => {
  // The bug this pins: PRIMARY and BEHIND are mutually exclusive roles, so a guard that
  // only inspected `BEHIND` could never see the ONLY opponent in a heads-up pot. The same
  // check-raise read then RAISED a bluff when the primary held it and LOWERED it when a
  // third party did. Heads-up, hero first to act, one known check-raiser is the single most
  // common spot at this table, and it was the one spot the guard could not protect.
  const soleOpponent = profileOf(
    'villain',
    [
      learned('FOLD_TO_CBET_FLOP', 7500, 100),
      learned('CHECK_RAISE_FLOP', 3000, 100),
      learned('WTSD', 500, 400),
    ],
    2,
  );
  const context: AdaptiveComposeContext = {
    opponents: [ordering('villain', { seatIndex: 2, actionOrderIndex: 0 })],
    wager: FIXTURE_WAGER,
  };
  const baseline = baselineOf({ aggressionBand: 'WEAK', activeOpponentCount: 1 });
  const result = composeAdaptive(baseline, [soleOpponent], context);
  const betBaseline = baseline.actions.find((entry) => entry.kind === 'BET')?.frequencyBps ?? 0;

  it('classifies the sole opponent PRIMARY and still to act', () => {
    expect(result.opponents.map((entry) => entry.role)).toEqual(['PRIMARY']);
  });

  it('zeroes every positive AGGRESSION contribution', () => {
    for (const id of ['FOLD_TO_CBET_HIGH', 'WTSD_LOW_BLUFF_UP'] as const) {
      const adjustment = adjustmentOf(result, id);
      if (adjustment === null) continue;
      expect(adjustment.contributionBps).toBe(0);
      expect(adjustment.cappedBy).toBe('AGGRESSIVE_PLAYER_BEHIND');
    }
  });

  it('does NOT increase the bluff against a known check-raiser', () => {
    expect(frequencyOf(result, 'BET')).toBeLessThanOrEqual(betBaseline);
  });

  it('still lets the check-raise read lower the bluff', () => {
    expect(contributionOf(result, 'CHECK_RAISE_HIGH')).toBeLessThan(0);
  });
});

describe('R1 MAJOR 1 — facing a bet, the bettor has already acted and does not arm it', () => {
  // The other side of the correction: the guard must not over-fire. When hero faces a bet
  // the PRIMARY is the player who made it, so `actsAfterHero` is false and their own
  // check-raise history is not a reason to refuse hero a raise.
  const bettor = profileOf(
    'bettor',
    [learned('CHECK_RAISE_FLOP', 3000, 100), learned('CBET_FLOP', 7500, 100)],
    2,
  );
  const context: AdaptiveComposeContext = {
    opponents: [
      ordering('bettor', { seatIndex: 2, actionOrderIndex: 0, actsAfterHero: false, isLastAggressorThisStreet: true }),
    ],
    wager: FIXTURE_WAGER,
  };
  const result = composeAdaptive(
    baselineOf({ aggressionBand: 'MODERATE', activeOpponentCount: 1, heroFacingBet: true }),
    [bettor],
    context,
  );

  it('does not arm the guard', () => {
    expect(result.notes.map((note) => note.code)).not.toContain('AGGRESSIVE_PLAYER_BEHIND');
    for (const adjustment of result.adjustments) {
      expect(adjustment.cappedBy).not.toBe('AGGRESSIVE_PLAYER_BEHIND');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Row 12 — determinism                                                        */
/* -------------------------------------------------------------------------- */

describe('J10.12 — the same input always produces the same bytes', () => {
  const buildBaseline = (): AdaptiveBaseline =>
    baselineOf({ aggressionBand: 'MODERATE', activeOpponentCount: 2 });
  const buildContext = (): AdaptiveComposeContext => ({
    opponents: [
      ordering('primary', { seatIndex: 2, actionOrderIndex: 0 }),
      ordering('lurker', { seatIndex: 4, actionOrderIndex: 1 }),
    ],
    wager: FIXTURE_WAGER,
  });
  const buildProfiles = (): readonly PlayerAdjustmentProfile[] => [
    profileOf(
      'primary',
      [
        learned('FOLD_TO_CBET_FLOP', 7500, 100),
        learned('WTSD', 4500, 200),
        learned('CHECK_RAISE_FLOP', 1200, 60),
      ],
      2,
    ),
    profileOf('lurker', [learned('THREE_BET', 1500, 120)], 4),
  ];

  const first = composeAdaptive(buildBaseline(), buildProfiles(), buildContext());
  const second = composeAdaptive(buildBaseline(), buildProfiles(), buildContext());

  it('is deep-equal across two runs on separately-constructed equal inputs', () => {
    expect(first).toEqual(second);
  });

  it('serializes to the identical string, key order included', () => {
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('does not depend on the order the opponent profiles were listed in', () => {
    const profiles = buildProfiles();
    const reversed = composeAdaptive(buildBaseline(), [...profiles].reverse(), buildContext());
    expect(reversed.actions).toEqual(first.actions);
    expect(reversed.adjustments).toEqual(first.adjustments);
    expect(reversed.totalShiftBps).toBe(first.totalShiftBps);
  });

  it('stamps the policy version and never claims anything but HEURISTIC', () => {
    expect(first.provenance).toBe('HEURISTIC');
    expect(first.label).toBe('ADAPTIVE');
    expect(first.policyVersion).toMatch(/^adaptive-/);
  });
});

/* -------------------------------------------------------------------------- */
/* `changedFromBaseline` — did the OUTPUT move, as opposed to did a rule fire?  */
/* -------------------------------------------------------------------------- */

describe('changedFromBaseline separates "a rule fired" from "the answer moved"', () => {
  const context: AdaptiveComposeContext = {
    opponents: [
      ordering('primary', { seatIndex: 2, actionOrderIndex: 0 }),
      ordering('lurker', { seatIndex: 4, actionOrderIndex: 1 }),
    ],
    wager: FIXTURE_WAGER,
  };
  // The PRIMARY folds to c-bets far too often, which is a reason to bet more. The player
  // BEHIND is a habitual check-raiser, which is the §9 guard rail's exact case: the raise
  // is zeroed. Nothing else is known, so this is the ONLY rule in play.
  const primary = profileOf('primary', [learned('FOLD_TO_CBET_FLOP', 7500, 100)], 2);
  const lurker = profileOf('lurker', [learned('CHECK_RAISE_FLOP', 3000, 100)], 4);
  const baseline = baselineOf({ aggressionBand: 'MODERATE', activeOpponentCount: 2 });
  const held = composeAdaptive(baseline, [primary, lurker], context);

  it('still reports ADAPTED, because the reasoning is real and worth showing', () => {
    expect(held.status).toBe('ADAPTED');
    expect(adjustmentOf(held, 'FOLD_TO_CBET_HIGH')?.cappedBy).toBe('AGGRESSIVE_PLAYER_BEHIND');
  });

  it('reports changedFromBaseline false — every frequency is the baseline verbatim', () => {
    expect(held.changedFromBaseline).toBe(false);
    expect(held.actions.every((entry) => entry.deltaBps === 0)).toBe(true);
    for (const entry of held.actions) {
      const from = baseline.actions.find((row) => row.kind === entry.kind);
      expect(entry.frequencyBps).toBe(from?.frequencyBps);
    }
    expect(held.sizing?.bucketDelta).toBe(0);
  });

  it('reports changedFromBaseline true once the guard is lifted', () => {
    const moved = composeAdaptive(baseline, [primary, profileOf('lurker', [], 4)], context);
    expect(moved.changedFromBaseline).toBe(true);
    expect(moved.actions.some((entry) => entry.deltaBps !== 0)).toBe(true);
  });

  it('is false whenever there is no evidence at all', () => {
    const blank = composeAdaptive(baseline, [profileOf('primary', [], 2)], {
      opponents: [ordering('primary', { seatIndex: 2, actionOrderIndex: 0 })],
      wager: FIXTURE_WAGER,
    });
    expect(blank.status).toBe('INSUFFICIENT_DATA');
    expect(blank.changedFromBaseline).toBe(false);
  });

  it('is true when only the SIZE moved and the mix did not', () => {
    // A single sizing rule, no frequency rule: the rung moves, every frequency stays put.
    const station = profileOf('primary', [learned('WTSD', 3200, 60)], 2);
    const sized = composeAdaptive(baselineOf({ aggressionBand: 'STRONG' }), [station], {
      opponents: [ordering('primary', { seatIndex: 2, actionOrderIndex: 0 })],
      wager: FIXTURE_WAGER,
    });
    // The frequency rule DOES fire (+37 bps toward aggression) but 37 is below half a
    // 100-bps rung, so quantization rounds it away and the mix is the baseline verbatim.
    // The size still moves, and that alone is a real change.
    expect(sized.adjustments.map((entry) => entry.ruleId)).toContain('WTSD_HIGH_VALUE_UP');
    expect(sized.actions.every((entry) => entry.deltaBps === 0)).toBe(true);
    expect(sized.sizing?.bucketDelta).toBe(1);
    expect(sized.changedFromBaseline).toBe(true);
  });
});
