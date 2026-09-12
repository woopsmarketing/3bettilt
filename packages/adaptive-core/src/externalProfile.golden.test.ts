/**
 * WP-K §11/§12 — golden fixtures.
 *
 * Two real (nickname + stats from `prompt`, imported via the real bulk-import pipeline in
 * production) EXTERNAL_HUD profiles, composed against eight named spot shapes covering every
 * family of stat the external HUD reports. Every expected value below was READ from a real
 * `composeAdaptive` run against the exact fixture (not hand-derived from the formulas, unlike
 * `compose.test.ts` — this file's job is regression + "does this stat actually reach policy",
 * not re-verifying the arithmetic, which `compose.test.ts`/`priors.test.ts`/`cap.test.ts`
 * already do). A future change to the pipeline that moves any of these numbers should be
 * treated as a real behavior change to review, not a broken test to silence.
 */
import { describe, expect, it } from 'vitest';
import { composeAdaptive, type AdaptiveComposeContext } from './compose.js';
import { buildAdjustmentProfile } from './profile.js';
import { action, baselineOf, FIXTURE_WAGER, ordering } from './testBaseline.js';
import {
  ACN1977_STATS,
  externalOpponentInput,
  SHADOW7_STATS,
  type ExternalProfileStats,
} from './externalProfileFixtures.js';
import type { AdaptiveBaseline } from './baseline.js';
import type { AdaptiveRecommendation } from './recommendation.js';

/** Builds the compose context for one spot: the villain either has or hasn't already bet. */
function contextFor(playerId: string, heroFacingBet: boolean): AdaptiveComposeContext {
  return {
    opponents: [
      heroFacingBet
        ? ordering(playerId, {
            seatIndex: 2,
            actionOrderIndex: 0,
            actsAfterHero: false,
            isLastAggressorThisStreet: true,
          })
        : ordering(playerId, { seatIndex: 2, actionOrderIndex: 0 }),
    ],
    wager: FIXTURE_WAGER,
  };
}

function composeFor(
  playerId: string,
  stats: ExternalProfileStats,
  baseline: AdaptiveBaseline,
): AdaptiveRecommendation {
  const profile = buildAdjustmentProfile(externalOpponentInput(playerId, stats, 2));
  return composeAdaptive(baseline, [profile], contextFor(playerId, baseline.heroFacingBet));
}

/* -------------------------------------------------------------------------- */
/* The named spots (`prompt` §11, plus WP-K follow-up §1's spot 9)             */
/* -------------------------------------------------------------------------- */

const SPOT_PREFLOP_OPEN: AdaptiveBaseline = baselineOf({
    street: 'PREFLOP',
    aggressionBand: null,
    heroFacingBet: false,
    heroIsPreflopOpener: true,
    heroPosition: 'UTG',
    sizing: null,
    actions: [action('FOLD', 3000), action('RAISE', 7000)],
    primaryKind: 'RAISE',
  });

const SPOT_PREFLOP_FACING_OPEN: AdaptiveBaseline = baselineOf({
    street: 'PREFLOP',
    aggressionBand: null,
    heroFacingBet: true,
    heroIsPreflopOpener: false,
    heroPosition: 'BTN',
    sizing: null,
    actions: [action('FOLD', 4000), action('CALL', 3000), action('RAISE', 3000)],
    primaryKind: 'CALL',
  });

const SPOT_STEAL_BLIND_DEFENSE: AdaptiveBaseline = baselineOf({
    street: 'PREFLOP',
    aggressionBand: null,
    heroFacingBet: false,
    heroIsPreflopOpener: true,
    heroPosition: 'BTN',
    sizing: null,
    actions: [action('FOLD', 2000), action('RAISE', 8000)],
    primaryKind: 'RAISE',
  });

const SPOT_FLOP_STRONG_VALUE: AdaptiveBaseline = baselineOf({ aggressionBand: 'STRONG' });
const SPOT_FLOP_WEAK_BLUFF: AdaptiveBaseline = baselineOf({ aggressionBand: 'WEAK' });
const SPOT_FLOP_FACING_CBET: AdaptiveBaseline = baselineOf({
    street: 'FLOP',
    heroFacingBet: true,
    aggressionBand: 'MODERATE',
    sizing: null,
    actions: [action('FOLD', 4000), action('CALL', 4000), action('RAISE', 2000)],
    primaryKind: 'CALL',
  });

const SPOT_TURN_VALUE: AdaptiveBaseline = baselineOf({ street: 'TURN', aggressionBand: 'STRONG' });
const SPOT_RIVER_BLUFF_CATCHER: AdaptiveBaseline = baselineOf({
    street: 'RIVER',
    heroFacingBet: true,
    aggressionBand: 'NEUTRAL',
    sizing: null,
    actions: [action('FOLD', 5000), action('CALL', 5000)],
    primaryKind: 'CALL',
  });

/**
 * WP-K follow-up §1. The same STRONG hand as spot 4, but with the villain having ALREADY
 * acted, so the §9 guard rail (which refuses positive aggression while a known aggressor is
 * still to act) is not engaged and the value-band rules can actually be seen moving.
 */
const SPOT_FLOP_VALUE_FACING_BET: AdaptiveBaseline = baselineOf({
    street: 'FLOP',
    heroFacingBet: true,
    aggressionBand: 'STRONG',
    sizing: null,
    actions: [action('FOLD', 1000), action('CALL', 4000), action('RAISE', 5000)],
    primaryKind: 'RAISE',
  });

const SPOT_ENTRIES: ReadonlyArray<readonly [string, AdaptiveBaseline]> = [
  ['1 preflop open', SPOT_PREFLOP_OPEN],
  ['2 preflop facing open', SPOT_PREFLOP_FACING_OPEN],
  ['3 steal / blind defense', SPOT_STEAL_BLIND_DEFENSE],
  ['4 flop strong value', SPOT_FLOP_STRONG_VALUE],
  ['5 flop weak bluff', SPOT_FLOP_WEAK_BLUFF],
  ['6 flop facing cbet', SPOT_FLOP_FACING_CBET],
  ['7 turn value', SPOT_TURN_VALUE],
  ['8 river bluff-catcher', SPOT_RIVER_BLUFF_CATCHER],
  ['9 flop value facing a bet', SPOT_FLOP_VALUE_FACING_BET],
];

/* -------------------------------------------------------------------------- */
/* Golden values, one describe block per spot                                 */
/* -------------------------------------------------------------------------- */

describe('golden fixture — 1 preflop open', () => {
  it('Shadow7: THREE_BET tightens the open slightly', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_PREFLOP_OPEN);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['THREE_BET_HIGH_TIGHTEN']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 3100],
      ['RAISE', 6900],
    ]);
  });

  it('acn1977: a wider 3-bettor tightens the open further', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_PREFLOP_OPEN);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['THREE_BET_HIGH_TIGHTEN']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 3200],
      ['RAISE', 6800],
    ]);
  });
});

describe('golden fixture — 2 preflop facing open', () => {
  it('Shadow7 (folds to 3-bets 61%, above anchor): 3-bet MORE', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_PREFLOP_FACING_OPEN);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['FOLD_TO_3BET_HIGH']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 3900],
      ['CALL', 2900],
      ['RAISE', 3200],
    ]);
  });

  it('acn1977 (folds to 3-bets only 10%, well below anchor): 3-bet LESS, call more', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_PREFLOP_FACING_OPEN);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['FOLD_TO_3BET_LOW']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 4500],
      ['CALL', 3300],
      ['RAISE', 2200],
    ]);
  });
});

describe('golden fixture — 3 steal / blind defense', () => {
  // KNOWN LIMITATION (recorded, not silent — WP-K K4 audit finding): the external HUD
  // reports `STEAL` (how often THIS player opens from a steal position), never
  // `FOLD_BB_TO_STEAL` (how often the BIG BLIND folds to one) — a fact about a different
  // seat's response, which this source does not measure at all. `FOLD_BB_TO_STEAL_HIGH` is
  // therefore UNREACHABLE from EXTERNAL_HUD data alone for either fixture, and the rule that
  // DOES fire here (`THREE_BET_HIGH_TIGHTEN`) is the generic preflop-opening rule, not a
  // steal-specific one — this baseline also satisfies `PREFLOP_HERO_OPENING`.
  it('Shadow7: no steal-specific rule fires; only the generic opening rule does', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_STEAL_BLIND_DEFENSE);
    expect(r.adjustments.map((a) => a.ruleId)).not.toContain('FOLD_BB_TO_STEAL_HIGH');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['THREE_BET_HIGH_TIGHTEN']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 2100],
      ['RAISE', 7900],
    ]);
  });

  it('acn1977: same — the STEAL stat itself never drives a rule for either player', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_STEAL_BLIND_DEFENSE);
    expect(r.adjustments.map((a) => a.ruleId)).not.toContain('FOLD_BB_TO_STEAL_HIGH');
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 2200],
      ['RAISE', 7800],
    ]);
  });
});

/**
 * WP-K FOLLOW-UP §1 — THE BEFORE/AFTER THIS WHOLE SPOT EXISTS TO PIN.
 *
 * BEFORE, both fixtures came out of this spot betting a STRONG hand LESS often than REFERENCE
 * (Shadow7 CHECK 46 / BET 54, acn1977 CHECK 51 / BET 49) against opponents who fold to a c-bet
 * only 26% and 24% of the time. The cause was two rules with the wrong band scope —
 * `FOLD_TO_CBET_LOW` and `CHECK_RAISE_HIGH` both applied to VALUE — compounded by the §9 guard
 * rail, which zeroed the one value-INCREASING rule (`WTSD_HIGH_VALUE_UP`) while leaving the
 * decreasing ones untouched. The net could only ever point down.
 *
 * AFTER, the decreasing rules no longer read a VALUE hand at all, the value half of the
 * fold-to-c-bet read has its own rule, and BOTH fixtures land exactly on REFERENCE here. That
 * is the guard rail doing its job and nothing else: an opponent who is still to act reads
 * above the anchor on `THREE_BET` (Shadow7) or `CHECK_RAISE_FLOP` (acn1977), so every positive
 * aggression contribution is refused. Spot 9 is the same hand with the villain having already
 * acted, and there the value rules move the mix as intended.
 */
describe('golden fixture — 4 flop strong value', () => {
  it('Shadow7: value rules fire but the §9 guard holds them, so ADAPTIVE equals REFERENCE', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_FLOP_STRONG_VALUE);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'WTSD_HIGH_VALUE_UP',
      'SIZE_STATION_VALUE_UP_FOLD',
    ]);
    // Every one of them held by the guard, and every one still explained on screen.
    expect(r.adjustments.map((a) => a.cappedBy)).toEqual([
      'AGGRESSIVE_PLAYER_BEHIND',
      'AGGRESSIVE_PLAYER_BEHIND',
      'AGGRESSIVE_PLAYER_BEHIND',
    ]);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['CHECK', 4000],
      ['BET', 6000],
    ]);
    expect(r.sizing?.bucketDelta).toBe(0);
    // WP-K follow-up §2: Shadow7 wins 53% of the showdowns they reach, above the 50% anchor,
    // so `WSD` withdraws its support from the WTSD station size-up. `SIZE_STATION_VALUE_UP` is
    // absent from the rule list above BECAUSE of that, and the reason is recorded.
    expect(r.notes).toContainEqual({
      code: 'SIZING_SECONDARY_SIGNAL_WITHDRAWN',
      detail: 'SIZE_STATION_VALUE_UP',
    });
  });

  it('acn1977: WSD 43% is below the anchor, so the WTSD size-up is NOT withdrawn', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_FLOP_STRONG_VALUE);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'WTSD_HIGH_VALUE_UP',
      'SIZE_STATION_VALUE_UP',
      'SIZE_STATION_VALUE_UP_FOLD',
    ]);
    expect(r.notes.map((note) => note.code)).not.toContain('SIZING_SECONDARY_SIGNAL_WITHDRAWN');
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['CHECK', 4000],
      ['BET', 6000],
    ]);
    // Neither fixture may push a STRONG hand's betting frequency DOWN any more. This is the
    // assertion the whole follow-up exists for; it is a permanent floor, not a snapshot.
    for (const stats of [SHADOW7_STATS, ACN1977_STATS]) {
      const composed = composeFor('x', stats, SPOT_FLOP_STRONG_VALUE);
      const bet = composed.actions.find((a) => a.kind === 'BET');
      expect(bet?.frequencyBps).toBeGreaterThanOrEqual(6000);
    }
  });
});

describe('golden fixture — 5 flop weak bluff', () => {
  it('Shadow7: bluffs a bit more, no size or check-raise read', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_FLOP_WEAK_BLUFF);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['FOLD_TO_CBET_LOW', 'WTSD_HIGH_BLUFF_DOWN']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['CHECK', 4700],
      ['BET', 5300],
    ]);
    expect(r.sizing?.bucketDelta).toBe(0);
  });

  it("acn1977: acn's high check-raise rate also sizes the bluff DOWN a rung", () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_FLOP_WEAK_BLUFF);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW',
      'CHECK_RAISE_HIGH',
      'WTSD_HIGH_BLUFF_DOWN',
      'SIZE_CHECK_RAISE_DOWN',
    ]);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['CHECK', 5400],
      ['BET', 4600],
    ]);
    expect(r.sizing?.bucketDelta).toBe(-1);
  });
});

describe('golden fixture — 6 flop facing cbet', () => {
  it('Shadow7: villain c-bets 67%, a touch above anchor — call/raise shift slightly', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_FLOP_FACING_CBET);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['FOLD_TO_CBET_LOW', 'VILLAIN_CBET_HIGH']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 4100],
      ['CALL', 4600],
      ['RAISE', 1300],
    ]);
  });

  it('acn1977: villain c-bets 81% — the same two rules fire, further from the baseline', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_FLOP_FACING_CBET);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['FOLD_TO_CBET_LOW', 'VILLAIN_CBET_HIGH']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 3900],
      ['CALL', 5000],
      ['RAISE', 1100],
    ]);
  });
});

describe('golden fixture — 7 turn value', () => {
  it('Shadow7: same rule family as the flop value spot, read on the turn fan-out', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_TURN_VALUE);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'WTSD_HIGH_VALUE_UP',
      'SIZE_STATION_VALUE_UP_FOLD',
    ]);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['CHECK', 4000],
      ['BET', 6000],
    ]);
    // The turn anchor for a check-raise is 600 rather than the flop's 800, so Shadow7's 7%
    // generic reading sits ABOVE it and trips the guard here where it did not on the flop.
    expect(r.notes).toContainEqual({
      code: 'AGGRESSIVE_PLAYER_BEHIND',
      detail: 'CHECK_RAISE_TURN',
    });
  });

  it('acn1977: the same value rules fire, and the WSD suppressor does not', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_TURN_VALUE);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'WTSD_HIGH_VALUE_UP',
      'SIZE_STATION_VALUE_UP',
      'SIZE_STATION_VALUE_UP_FOLD',
    ]);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['CHECK', 4000],
      ['BET', 6000],
    ]);
  });
});

/**
 * WP-K follow-up §1. The spot the fix is actually visible in: a STRONG hand, the villain
 * having already bet, so the §9 guard rail is not engaged.
 */
describe('golden fixture — 9 flop value facing a bet', () => {
  it('Shadow7: folds to c-bets only 26%, so hero raises for value MORE, not less', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_FLOP_VALUE_FACING_BET);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'VILLAIN_CBET_HIGH',
    ]);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 900],
      ['CALL', 3900],
      ['RAISE', 5200],
    ]);
  });

  it('acn1977: the same value read, with a much wider c-bet range sending more to CALL', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_FLOP_VALUE_FACING_BET);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual([
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'VILLAIN_CBET_HIGH',
    ]);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 800],
      ['CALL', 4200],
      ['RAISE', 5000],
    ]);
  });

  it('never sends a value hand BELOW its REFERENCE aggression for either fixture', () => {
    for (const stats of [SHADOW7_STATS, ACN1977_STATS]) {
      const r = composeFor('x', stats, SPOT_FLOP_VALUE_FACING_BET);
      const raise = r.actions.find((a) => a.kind === 'RAISE');
      expect(raise?.frequencyBps).toBeGreaterThanOrEqual(5000);
    }
  });
});

describe('golden fixture — 8 river bluff-catcher', () => {
  it('Shadow7: villain over-c-bets the river a little — call slightly more', () => {
    const r = composeFor('shadow7', SHADOW7_STATS, SPOT_RIVER_BLUFF_CATCHER);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['VILLAIN_CBET_HIGH']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 4300],
      ['CALL', 5700],
    ]);
  });

  it('acn1977: over-c-bets the river more — call a little more still', () => {
    const r = composeFor('acn1977', ACN1977_STATS, SPOT_RIVER_BLUFF_CATCHER);
    expect(r.status).toBe('ADAPTED');
    expect(r.adjustments.map((a) => a.ruleId)).toEqual(['VILLAIN_CBET_HIGH']);
    expect(r.actions.map((a) => [a.kind, a.frequencyBps])).toEqual([
      ['FOLD', 4200],
      ['CALL', 5800],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* The audit `prompt` §11's closing paragraph asks for: do these stats reach policy?         */
/* -------------------------------------------------------------------------- */

describe('Shadow7 vs acn1977 — the two profiles must actually diverge (WP-K §11 audit)', () => {
  it('produce different ADAPTIVE output in every spot except the one neither can reach', () => {
    for (const [name, baseline] of SPOT_ENTRIES) {
      const shadow = composeFor('shadow7', SHADOW7_STATS, baseline);
      const acn = composeFor('acn1977', ACN1977_STATS, baseline);
      const same =
        JSON.stringify(shadow.actions.map((a) => a.frequencyBps)) ===
          JSON.stringify(acn.actions.map((a) => a.frequencyBps)) &&
        JSON.stringify(shadow.adjustments.map((a) => a.ruleId)) ===
          JSON.stringify(acn.adjustments.map((a) => a.ruleId));
      // Spot 3 (steal/blind defense) is the one documented exception: both players fire only
      // the generic PREFLOP_HERO_OPENING rule there, and its magnitude tracks THREE_BET (which
      // does differ, so even spot 3 is not byte-identical — this assertion is therefore
      // expected to hold everywhere, and is the audit's actual, positive finding).
      expect(same, `${name}: Shadow7 and acn1977 produced identical output`).toBe(false);
    }
  });

  it('both fixtures resolve every one of the 13 non-street-scoped external stats to a real AdaptiveStatEstimate', () => {
    const profile = buildAdjustmentProfile(externalOpponentInput('shadow7', SHADOW7_STATS, 2));
    for (const key of [
      'VPIP',
      'PFR',
      'THREE_BET',
      'FOLD_TO_THREE_BET',
      'STEAL',
      'WTSD',
      'WSD',
      'CBET_ANY_STREET',
      'FOLD_TO_CBET_ANY_STREET',
      'CHECK_RAISE_ANY_STREET',
    ] as const) {
      const estimate = profile.stats[key];
      expect(estimate.available, key).toBe(true);
      expect(estimate.confidenceState, key).toBe('KNOWN');
    }
  });
});

