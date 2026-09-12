/**
 * WP-J design contract §10 row 9: THE STRUCTURAL SWEEP.
 *
 * The behavioural tests in `compose.test.ts` assert what the engine SAYS. This file asserts what
 * it can never say, over a matrix of every spot shape the composition can be handed: four
 * streets x eight band states x three lineup sizes x facing-a-bet-or-not x six action sets
 * (including sets with a zero-frequency row, a single row, and an ALL_IN row) x four opponent
 * profiles. Roughly 4,600 compositions, every one of them checked against the same five
 * invariants.
 *
 * These are exactly the properties a downstream consumer is entitled to assume without reading
 * this package: a mix it can display on the 5-point grid, a mix that sums, no action kind it did
 * not ask about, a legal amount, and a bounded distance from the REFERENCE answer it is shown
 * beside. A property-style sweep is the right shape for them because the failure they guard
 * against is a rare COMBINATION — an empty target plus a capped rule plus a ladder end — not a
 * wrong number in a spot someone thought to write a test for.
 *
 * No RNG: the matrix is enumerated, so a failure reproduces exactly and names its own case.
 */
import { describe, expect, it } from 'vitest';
import { ADAPTIVE_NOTE_CODES, ADAPTIVE_NOTE_SCOPE } from './reasons.js';
import { AGGRESSION_BAND_IDS, type AggressionBandId } from '@gto-self/strategy-core';
import { Money, type MilliBB } from '@gto-self/shared';
import { composeAdaptive, type AdaptiveComposeContext } from '../compose.js';
import type { AdaptiveBaseline, AdaptiveBaselineAction, AdaptiveStreet } from '../baseline.js';
import type { PlayerAdjustmentProfile } from '../profile.js';
import {
  ADAPTIVE_FREQUENCY_RULES,
  BEHIND_AGGRESSION_GATE_BPS,
  FREQUENCY_MIN_CONFIDENCE_BPS,
  MAX_TOTAL_SHIFT_BPS_HEADS_UP,
  MAX_TOTAL_SHIFT_BPS_MULTIWAY,
  maxTotalShiftBpsFor,
} from './frequencyModel.js';
import {
  ADAPTIVE_SIZING_RULES,
  MAX_SIZING_BUCKET_DELTA,
  SIZING_MIN_CONFIDENCE_BPS_HEADS_UP,
  SIZING_MIN_CONFIDENCE_BPS_MULTIWAY,
} from './sizingModel.js';
import {
  FIXTURE_MAX_TO_MBB,
  FIXTURE_MIN_TO_MBB,
  FIXTURE_POT_MBB,
  FIXTURE_WAGER,
  action,
  learned,
  ordering,
  profileOf,
} from '../testBaseline.js';

/* -------------------------------------------------------------------------- */
/* The matrix                                                                  */
/* -------------------------------------------------------------------------- */

const STREETS: readonly AdaptiveStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

/** Every band the engine can report, plus the no-band state a preflop spot carries. */
const BANDS: readonly (AggressionBandId | null)[] = [...AGGRESSION_BAND_IDS, null];

/** Heads-up, three-handed, and a full six-handed pot. */
const OPPONENT_COUNTS: readonly number[] = [1, 2, 5];

/**
 * Six action sets. Between them they cover every shape the transfer arithmetic has a branch for:
 * all three targets present, only two, only one, a ZERO-frequency row that is nonetheless a
 * legal kind, and an aggressive set containing `ALL_IN`.
 */
const ACTION_SETS: readonly (readonly AdaptiveBaselineAction[])[] = [
  [action('FOLD', 2000), action('CALL', 3000), action('RAISE', 5000, Money.mbb(7_500))],
  [action('CHECK', 4000), action('BET', 6000, Money.mbb(7_500))],
  // A legal kind the policy takes 0% of the time: `apportion` cannot divide by its weight.
  [action('FOLD', 0), action('CALL', 5000), action('RAISE', 5000, Money.mbb(7_500))],
  // One row only: no target has anything to trade with, so every rule must be TARGET_ABSENT.
  [action('CHECK', 10000)],
  [
    action('FOLD', 1000),
    action('CALL', 2000),
    action('RAISE', 3500, Money.mbb(7_500)),
    action('ALL_IN', 3500, FIXTURE_MAX_TO_MBB, true),
  ],
  [action('CHECK', 0), action('BET', 10000, Money.mbb(7_500))],
];

/** The rungs a sweep baseline is placed on: ALL_IN, the bottom, the middle, and the top. */
const SIZING_CASES: readonly {
  readonly bucketIndex: number;
  readonly percent: number | null;
  readonly toAmount: number;
}[] = [
  { bucketIndex: -1, percent: null, toAmount: 200_000 },
  { bucketIndex: 0, percent: 25, toAmount: 2_500 },
  { bucketIndex: 4, percent: 75, toAmount: 7_500 },
  { bucketIndex: 7, percent: 150, toAmount: 15_000 },
];

/** Four opponents spanning the reads the table is written for, plus one we know nothing about. */
const PROFILES: readonly PlayerAdjustmentProfile[] = [
  profileOf('unknown', []),
  profileOf('station', [
    learned('WTSD', 4500, 200),
    learned('FOLD_TO_CBET_FLOP', 1500, 100),
    learned('FOLD_TO_CBET_TURN', 1500, 80),
    learned('FOLD_TO_CBET_RIVER', 1500, 60),
    learned('CBET_FLOP', 7500, 100),
    learned('CBET_TURN', 7000, 80),
    learned('CBET_RIVER', 6500, 60),
    learned('FOLD_TO_THREE_BET', 3000, 120),
  ]),
  profileOf('nit', [
    learned('WTSD', 1500, 200),
    learned('FOLD_TO_CBET_FLOP', 8000, 100),
    learned('FOLD_TO_CBET_TURN', 8000, 80),
    learned('FOLD_TO_CBET_RIVER', 8000, 60),
    learned('CBET_FLOP', 2000, 100),
    learned('CBET_TURN', 2000, 80),
    learned('CBET_RIVER', 2000, 60),
    learned('THREE_BET', 1500, 150),
    learned('FOLD_TO_THREE_BET', 8000, 120),
    learned('FOLD_BB_TO_STEAL', 8500, 140),
  ]),
  profileOf('maniac', [
    learned('WTSD', 4000, 200),
    learned('CHECK_RAISE_FLOP', 3000, 100),
    learned('CHECK_RAISE_TURN', 2500, 80),
    learned('CHECK_RAISE_RIVER', 2000, 60),
    learned('FOLD_TO_CBET_FLOP', 6000, 100),
    learned('THREE_BET', 1800, 150),
  ]),
];

/** Two opponents behind hero, so the guard rail and the multiway cap are both exercised. */
const context: AdaptiveComposeContext = {
  opponents: [
    ordering('primary', { seatIndex: 2, actionOrderIndex: 0, isLastAggressorThisStreet: true }),
    ordering('lurker', { seatIndex: 4, actionOrderIndex: 1 }),
  ],
  wager: FIXTURE_WAGER,
};

/** The lurker: a real check-raiser, so the §9 guard trips on part of the matrix. */
const LURKER = profileOf('lurker', [learned('CHECK_RAISE_FLOP', 3000, 100)], 4);

function baselineFor(
  street: AdaptiveStreet,
  band: AggressionBandId | null,
  opponentCount: number,
  facingBet: boolean,
  actions: readonly AdaptiveBaselineAction[],
  sizingCase: (typeof SIZING_CASES)[number],
): AdaptiveBaseline {
  const hasAggression = actions.some(
    (entry) => entry.kind === 'BET' || entry.kind === 'RAISE' || entry.kind === 'ALL_IN',
  );
  const callAmountMbb: MilliBB = facingBet ? Money.mbb(3_000) : Money.mbb(0);
  return {
    street,
    heroFacingBet: facingBet,
    activeOpponentCount: opponentCount,
    aggressionBand: band,
    actions,
    primaryKind: actions[0]?.kind ?? 'CHECK',
    sizing: hasAggression
      ? {
          kind: facingBet ? 'RAISE' : 'BET',
          bucketIndex: sizingCase.bucketIndex,
          potFractionPercent: sizingCase.percent,
          toAmountMbb: Money.mbb(sizingCase.toAmount),
          minToAmountMbb: FIXTURE_MIN_TO_MBB,
          maxToAmountMbb: FIXTURE_MAX_TO_MBB,
          heroStreetContributionMbb: Money.mbb(0),
          potBeforeDecisionMbb: FIXTURE_POT_MBB,
          callAmountMbb,
          allIn: sizingCase.bucketIndex === -1,
        }
      : null,
    // Maximises rule coverage preflop: every preflop scope can match somewhere in the matrix.
    heroIsPreflopOpener: true,
    heroPosition: 'CO',
  };
}

/* -------------------------------------------------------------------------- */
/* The sweep                                                                   */
/* -------------------------------------------------------------------------- */

describe('J10.9 — structural invariants over the whole spot matrix', () => {
  it('holds for every combination', () => {
    let cases = 0;
    let adapted = 0;
    let capped = 0;
    let sizingMoved = 0;
    // Rotated independently of `cases`, which advances once per PROFILE: keying the rung off
    // `cases` would step by four each time and land on the same entry forever.
    let variant = 0;
    for (const street of STREETS) {
      for (const band of BANDS) {
        for (const opponentCount of OPPONENT_COUNTS) {
          for (const facingBet of [false, true]) {
            for (const actions of ACTION_SETS) {
              const sizingCase = SIZING_CASES[variant % SIZING_CASES.length];
              variant += 1;
              if (sizingCase === undefined) throw new Error('sizing case table is empty');
              const baseline = baselineFor(
                street,
                band,
                opponentCount,
                facingBet,
                actions,
                sizingCase,
              );
              for (const primary of PROFILES) {
                cases += 1;
                const named: PlayerAdjustmentProfile = {
                  ...primary,
                  playerId: 'primary',
                  seatIndex: 2,
                };
                const result = composeAdaptive(baseline, [named, LURKER], context);
                const where = `${street}/${band ?? 'NO_BAND'}/n=${opponentCount}/${
                  facingBet ? 'facing' : 'open'
                }/${actions.map((entry) => entry.kind).join('+')}/${primary.playerId}`;

                if (result.status === 'ADAPTED') adapted += 1;
                if (result.capApplied) capped += 1;
                if ((result.sizing?.bucketDelta ?? 0) !== 0) sizingMoved += 1;

                // 1. Every frequency is a non-negative multiple of 100.
                for (const entry of result.actions) {
                  expect(
                    Number.isInteger(entry.frequencyBps) &&
                      entry.frequencyBps >= 0 &&
                      entry.frequencyBps % 100 === 0,
                    `${where}: ${entry.kind} frequency ${entry.frequencyBps} is off the grid`,
                  ).toBe(true);
                }

                // 2. They sum to exactly 10000.
                const total = result.actions.reduce((sum, entry) => sum + entry.frequencyBps, 0);
                expect(total, `${where}: frequencies sum to ${total}`).toBe(10000);

                // 3. No action kind that the baseline did not contain.
                const baselineKinds = actions.map((entry) => entry.kind);
                expect(
                  result.actions.map((entry) => entry.kind),
                  `${where}: emitted kinds`,
                ).toEqual(baselineKinds);

                // 3b. No amount invented for a row that had none.
                for (let i = 0; i < result.actions.length; i += 1) {
                  expect(result.actions[i]?.toAmountMbb, `${where}: amount on row ${i}`).toBe(
                    actions[i]?.toAmountMbb ?? null,
                  );
                }

                // 4. Any sizing amount is inside the engine's legal window, and the rung moved
                //    by at most one step of the ladder.
                const sizing = result.sizing;
                if (sizing !== null) {
                  expect(
                    sizing.toToAmountMbb >= sizing.minToAmountMbb &&
                      sizing.toToAmountMbb <= sizing.maxToAmountMbb,
                    `${where}: ${sizing.toToAmountMbb} outside [${sizing.minToAmountMbb}, ${sizing.maxToAmountMbb}]`,
                  ).toBe(true);
                  expect(
                    Math.abs(sizing.bucketDelta),
                    `${where}: bucket delta ${sizing.bucketDelta}`,
                  ).toBeLessThanOrEqual(MAX_SIZING_BUCKET_DELTA);
                  // An ALL_IN rung is never moved.
                  if (sizingCase.bucketIndex === -1) expect(sizing.bucketDelta).toBe(0);
                  // Preflop sizing is out of scope for the MVP.
                  if (street === 'PREFLOP') expect(sizing.bucketDelta).toBe(0);
                }

                // 5. The total shift respects the applicable cap.
                const cap = maxTotalShiftBpsFor(opponentCount);
                expect(
                  result.totalShiftBps,
                  `${where}: shift ${result.totalShiftBps} above cap ${cap}`,
                ).toBeLessThanOrEqual(cap);
                expect(result.totalShiftBps).toBeGreaterThanOrEqual(0);

                // 6. The shift reported is the shift actually present in the output.
                const measured =
                  result.actions.reduce(
                    (sum, entry, index) =>
                      sum + Math.abs(entry.frequencyBps - (actions[index]?.frequencyBps ?? 0)),
                    0,
                  ) / 2;
                expect(result.totalShiftBps, `${where}: reported vs measured shift`).toBe(measured);

                // 7. INSUFFICIENT_DATA means the baseline, verbatim.
                if (result.status === 'INSUFFICIENT_DATA') {
                  expect(
                    result.actions.map((entry) => entry.frequencyBps),
                    `${where}: INSUFFICIENT_DATA must echo the baseline`,
                  ).toEqual(baselineKinds.map((_, index) => actions[index]?.frequencyBps ?? 0));
                  expect(result.adjustments).toEqual([]);
                }
              }
            }
          }
        }
      }
    }
    // The sweep is worthless if nothing ever adapted, or if the interesting branches were never
    // reached; pin that it actually exercised the engine, the global cap and the sizing pass.
    expect(cases).toBeGreaterThan(1000);
    expect(adapted).toBeGreaterThan(cases / 10);
    expect(capped).toBeGreaterThan(0);
    expect(sizingMoved).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The model tables are well-formed                                            */
/* -------------------------------------------------------------------------- */

describe('the policy tables as data', () => {
  it('carries exactly the thirteen frequency rules of the design contract, in order', () => {
    expect(ADAPTIVE_FREQUENCY_RULES.map((rule) => rule.id)).toEqual([
      'FOLD_TO_CBET_HIGH',
      'FOLD_TO_CBET_LOW',
      'FOLD_TO_CBET_LOW_VALUE_UP',
      'CHECK_RAISE_HIGH',
      'WTSD_HIGH_BLUFF_DOWN',
      'WTSD_LOW_BLUFF_UP',
      'WTSD_HIGH_VALUE_UP',
      'VILLAIN_CBET_HIGH',
      'VILLAIN_CBET_LOW',
      'THREE_BET_HIGH_TIGHTEN',
      'FOLD_TO_3BET_HIGH',
      'FOLD_TO_3BET_LOW',
      'FOLD_BB_TO_STEAL_HIGH',
    ]);
  });

  it('carries exactly the four sizing rules of the design contract, in order', () => {
    expect(ADAPTIVE_SIZING_RULES.map((rule) => rule.id)).toEqual([
      'SIZE_STATION_VALUE_UP',
      'SIZE_STATION_VALUE_UP_FOLD',
      'SIZE_FOLDY_BLUFF_DOWN',
      'SIZE_CHECK_RAISE_DOWN',
    ]);
  });

  /**
   * WP-K follow-up §2. A SECONDARY signal may only ever hold a rule back, so it must never be
   * the only thing a stat is read for, and it must carry the same mandatory explanation every
   * other model number in these tables does.
   */
  it('explains every secondary signal and reads it on a stat no rule of its own fires on', () => {
    const suppressors = ADAPTIVE_SIZING_RULES.flatMap((rule) =>
      rule.suppressedWhen === undefined ? [] : [[rule.id, rule.suppressedWhen] as const],
    );
    expect(suppressors.map(([ruleId]) => ruleId)).toEqual(['SIZE_STATION_VALUE_UP']);
    for (const [ruleId, suppressor] of suppressors) {
      expect(suppressor.note.length, ruleId).toBeGreaterThan(120);
      expect(suppressor.note.toUpperCase(), ruleId).not.toContain('GTO');
      expect(suppressor.note.toLowerCase(), ruleId).not.toContain('solver');
      // A suppressor's own stat may not also be a primary signal anywhere in either table:
      // that would let one reading both fire a rule and cancel another, invisibly.
      const primaryStats = [...ADAPTIVE_FREQUENCY_RULES, ...ADAPTIVE_SIZING_RULES].flatMap(
        (rule) => (rule.stat.kind === 'FIXED' ? [rule.stat.stat] : Object.values(rule.stat.byStreet)),
      );
      expect(primaryStats, ruleId).not.toContain(suppressor.stat);
    }
  });

  it('tags every rule HEURISTIC and makes every one explain itself', () => {
    for (const rule of [...ADAPTIVE_FREQUENCY_RULES, ...ADAPTIVE_SIZING_RULES]) {
      expect(rule.provenance, rule.id).toBe('HEURISTIC');
      // A note has to be a real explanation, not a restatement of the id.
      expect(rule.note.length, rule.id).toBeGreaterThan(120);
      expect(rule.note.toUpperCase(), rule.id).not.toContain('GTO');
      expect(rule.note.toLowerCase(), rule.id).not.toContain('solver');
    }
  });

  it('keeps every frequency gain and ceiling inside the global cap', () => {
    for (const rule of ADAPTIVE_FREQUENCY_RULES) {
      expect(rule.gainBps, rule.id).toBeGreaterThan(0);
      expect(rule.maxBps, rule.id).toBeGreaterThan(0);
      // No single rule may be allowed to spend the whole multiway budget on its own.
      expect(rule.maxBps, rule.id).toBeLessThanOrEqual(MAX_TOTAL_SHIFT_BPS_MULTIWAY);
    }
  });

  it('moves a sizing rule by exactly one rung, either way', () => {
    for (const rule of ADAPTIVE_SIZING_RULES) {
      expect(Math.abs(rule.steps), rule.id).toBe(MAX_SIZING_BUCKET_DELTA);
      expect(rule.bands.length, rule.id).toBeGreaterThan(0);
    }
  });

  it('pins the gates and caps at the design contract values', () => {
    expect(FREQUENCY_MIN_CONFIDENCE_BPS).toBe(2500);
    expect(MAX_TOTAL_SHIFT_BPS_HEADS_UP).toBe(2000);
    expect(MAX_TOTAL_SHIFT_BPS_MULTIWAY).toBe(1000);
    expect(BEHIND_AGGRESSION_GATE_BPS).toBe(2500);
    expect(SIZING_MIN_CONFIDENCE_BPS_HEADS_UP).toBe(5000);
    expect(SIZING_MIN_CONFIDENCE_BPS_MULTIWAY).toBe(7500);
    expect(MAX_SIZING_BUCKET_DELTA).toBe(1);
  });

  it('keeps the sizing gate strictly above the frequency gate, as J5 requires', () => {
    expect(SIZING_MIN_CONFIDENCE_BPS_HEADS_UP).toBeGreaterThan(FREQUENCY_MIN_CONFIDENCE_BPS);
    expect(SIZING_MIN_CONFIDENCE_BPS_MULTIWAY).toBeGreaterThan(SIZING_MIN_CONFIDENCE_BPS_HEADS_UP);
    expect(MAX_TOTAL_SHIFT_BPS_MULTIWAY).toBeLessThan(MAX_TOTAL_SHIFT_BPS_HEADS_UP);
  });
});

/**
 * Every structural remark belongs to exactly one of the two passes, and the split is what
 * lets a caller answer "why did the MIX not move" without reaching for a remark about SIZING.
 * The UI does exactly that (`StrategyPanel`'s 조정 없음 line), and the E2E pins the rendering;
 * what is pinned here is the classification itself, which is the part that can silently rot
 * when a new note code is added.
 */
describe('note scopes', () => {
  it('classifies every note code, with no code left out and none invented', () => {
    expect(Object.keys(ADAPTIVE_NOTE_SCOPE).sort()).toEqual([...ADAPTIVE_NOTE_CODES].sort());
  });

  it('puts every SIZING-named code in the SIZING pass, and nothing else there', () => {
    const sizing = ADAPTIVE_NOTE_CODES.filter((code) => ADAPTIVE_NOTE_SCOPE[code] === 'SIZING');
    // Named exhaustively rather than derived from the string "SIZING": `PREFLOP_SIZING_OUT_OF_
    // SCOPE` would pass a substring check by accident, and `BASELINE_HAS_NO_ACTIONS` would
    // fail one despite being correctly classified. A list is the honest assertion.
    expect([...sizing].sort()).toEqual([
      'PREFLOP_SIZING_OUT_OF_SCOPE',
      'SIZING_ALL_IN_NOT_MOVED',
      'SIZING_CONFIDENCE_GATE_NOT_MET',
      'SIZING_SECONDARY_SIGNAL_WITHDRAWN',
      'SIZING_WAGER_WINDOW_MISSING',
    ]);
  });

  it('leaves the guard rail and the global cap on the FREQUENCY side, where the mix is', () => {
    expect(ADAPTIVE_NOTE_SCOPE.AGGRESSIVE_PLAYER_BEHIND).toBe('FREQUENCY');
    expect(ADAPTIVE_NOTE_SCOPE.TOTAL_SHIFT_CAP_APPLIED).toBe('FREQUENCY');
    expect(ADAPTIVE_NOTE_SCOPE.FREQUENCY_CONFIDENCE_GATE_NOT_MET).toBe('FREQUENCY');
  });
});
