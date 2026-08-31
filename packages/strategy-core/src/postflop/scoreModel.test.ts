/**
 * The model config's own invariants, and every band boundary.
 *
 * These tests are about the DATA, not about any spot: they assert that the config is
 * structurally sound (total, descending, on the 5-point grid, inside the sizing ladder), that
 * no component can carry a decision on its own, and that every threshold in every table lands
 * on the side it is documented to land on.
 */
import { describe, expect, it } from 'vitest';
import {
  AGGRESSION_BANDS,
  AGGRESSION_TOTAL_WEIGHT,
  AGGRESSION_WEIGHTS,
  ALL_IN_CALL_BANDS,
  ALL_IN_CALL_MARGIN,
  ALL_IN_GATE,
  BLOCKER_CAP,
  BLOCKER_POINTS,
  CONTINUE_BANDS,
  CONTINUE_TOTAL_WEIGHT,
  CONTINUE_WEIGHTS,
  DRAW_QUALITY,
  FACED_BET_SIZE_BANDS,
  HAND_STRENGTH_POINTS,
  HERO_EQUITY_BANDS,
  MAX_SINGLE_COMPONENT_WEIGHT_SHARE,
  MULTIWAY_AGGRESSION_POINTS,
  MULTIWAY_AGGRESSION_SCALE_BPS,
  MULTIWAY_CONTINUE_PENALTY_BPS,
  MULTIWAY_CONTINUE_POINTS,
  NUT_ADVANTAGE_BANDS,
  NUT_SHARE_PERCENTILE,
  POT_FRACTION_BUCKETS,
  POT_ODDS_MARGIN_BANDS,
  RAISE_SHARE_BANDS,
  RANGE_ADVANTAGE_BANDS,
  RANGE_RANK_BANDS,
  SIZING_BASE_INDEX_BY_BAND,
  SPR_PRESSURE_BANDS,
  UNKNOWN_SPR,
  bandFor,
  priceImpliedContinueBps,
  fairShareEquity,
  normalizeHeroEquity,
  type ScoreBand,
} from './scoreModel.js';
import { POSTFLOP_RULES, postflopRule } from './rules.js';

const EPS = 1e-9;

/** Every threshold in a table, checked from both sides. */
function assertBoundaries(bands: readonly ScoreBand[], name: string): void {
  for (const band of bands) {
    if (band.atLeast === -Infinity) continue;
    expect(bandFor(bands, band.atLeast), `${name} at ${band.atLeast}`).toBe(band);
    const below = bandFor(bands, band.atLeast - EPS);
    expect(below.points, `${name} just below ${band.atLeast}`).not.toBe(band.points);
  }
}

describe('scoreModel — structure', () => {
  it('gives no aggression component more than the documented weight share', () => {
    for (const entry of AGGRESSION_WEIGHTS) {
      expect(entry.weight / AGGRESSION_TOTAL_WEIGHT).toBeLessThanOrEqual(
        MAX_SINGLE_COMPONENT_WEIGHT_SHARE,
      );
    }
    // The heaviest aggression component is 3 of 26 — under 12%, so no single measurement can
    // move the score across more than one band on its own.
    const heaviest = Math.max(...AGGRESSION_WEIGHTS.map((entry) => entry.weight));
    expect(heaviest / AGGRESSION_TOTAL_WEIGHT).toBeLessThan(0.12);
  });

  it('gives no continue component more than the documented weight share', () => {
    for (const entry of CONTINUE_WEIGHTS) {
      expect(entry.weight / CONTINUE_TOTAL_WEIGHT).toBeLessThanOrEqual(
        MAX_SINGLE_COMPONENT_WEIGHT_SHARE,
      );
    }
  });

  it('cannot let one aggression component cross the whole band table', () => {
    // A component's widest possible swing on the score scale: from -100 points to +100.
    const widest = Math.max(
      ...AGGRESSION_WEIGHTS.map((entry) => (entry.weight * 200) / AGGRESSION_TOTAL_WEIGHT),
    );
    const thresholds = AGGRESSION_BANDS.map((band) => band.atLeast).filter(Number.isFinite);
    const tableSpan = Math.max(...thresholds) - Math.min(...thresholds);
    // It CAN cross one band (otherwise weighting it would be pointless) but it cannot on its
    // own carry a spot from GIVE_UP to DOMINANT. That is the structural no-single-feature rule.
    const narrowestBand = Math.min(
      ...AGGRESSION_BANDS.slice(0, -2).map((band, index) => {
        const next = AGGRESSION_BANDS[index + 1];
        return next === undefined ? Infinity : band.atLeast - next.atLeast;
      }),
    );
    expect(widest).toBeGreaterThan(narrowestBand);
    expect(widest).toBeLessThan(tableSpan);
  });

  it('has a rationale on every weight entry', () => {
    for (const entry of [...AGGRESSION_WEIGHTS, ...CONTINUE_WEIGHTS]) {
      expect(entry.rationale.length).toBeGreaterThan(40);
    }
  });

  it('lists no component twice in either model', () => {
    expect(new Set(AGGRESSION_WEIGHTS.map((e) => e.id)).size).toBe(AGGRESSION_WEIGHTS.length);
    expect(new Set(CONTINUE_WEIGHTS.map((e) => e.id)).size).toBe(CONTINUE_WEIGHTS.length);
  });

  it('totals the weights it says it does', () => {
    expect(AGGRESSION_TOTAL_WEIGHT).toBe(26);
    expect(CONTINUE_TOTAL_WEIGHT).toBe(14);
  });
});

describe('scoreModel — band tables are total and ordered', () => {
  const tables: readonly (readonly [string, readonly ScoreBand[]])[] = [
    ['HERO_EQUITY', HERO_EQUITY_BANDS],
    ['RANGE_ADVANTAGE', RANGE_ADVANTAGE_BANDS],
    ['NUT_ADVANTAGE', NUT_ADVANTAGE_BANDS],
    ['RANGE_RANK', RANGE_RANK_BANDS],
    ['SPR_PRESSURE', SPR_PRESSURE_BANDS],
    ['FACED_BET_SIZE', FACED_BET_SIZE_BANDS],
    ['POT_ODDS_MARGIN', POT_ODDS_MARGIN_BANDS],
    ['ALL_IN_CALL', ALL_IN_CALL_BANDS],
  ];

  for (const [name, bands] of tables) {
    it(`${name} ends at -Infinity so the lookup is total`, () => {
      expect(bands[bands.length - 1]?.atLeast).toBe(-Infinity);
      expect(bandFor(bands, -1e9)).toBe(bands[bands.length - 1]);
    });

    it(`${name} thresholds land on the documented side`, () => {
      assertBoundaries(bands, name);
    });

    it(`${name} has unique labels`, () => {
      expect(new Set(bands.map((b) => b.label)).size).toBe(bands.length);
    });
  }

  it('orders HERO_EQUITY so more equity is never fewer points', () => {
    for (let i = 1; i < HERO_EQUITY_BANDS.length; i += 1) {
      expect(HERO_EQUITY_BANDS[i - 1]?.points ?? 0).toBeGreaterThan(
        HERO_EQUITY_BANDS[i]?.points ?? 0,
      );
    }
  });
});

/**
 * `HERO_EQUITY_BANDS` is a 0.5-centred table and is fed POOLED equity, which is not on that
 * scale multiway. These are the data-level properties of the mapping that fixes it; the
 * end-to-end consequence is asserted in `policy.test.ts`.
 */
describe('scoreModel — hero equity is banded against the fair share', () => {
  it('states the fair share as 1/(1+opponents), floored at one opponent', () => {
    expect(fairShareEquity(1)).toBe(0.5);
    expect(fairShareEquity(2)).toBeCloseTo(1 / 3, 12);
    expect(fairShareEquity(4)).toBe(0.2);
    expect(fairShareEquity(5)).toBeCloseTo(1 / 6, 12);
    // A postflop query always has a live opponent; a nonsensical 0 must not become 1.0.
    expect(fairShareEquity(0)).toBe(0.5);
  });

  it('is BIT-IDENTICAL to raw equity heads-up, across the whole range', () => {
    for (let i = 0; i <= 1000; i += 1) {
      const equity = i / 1000;
      expect(normalizeHeroEquity(equity, 1)).toBe(equity);
    }
    // Including the exact band edges, which is where an off-by-a-bit would show up.
    for (const band of HERO_EQUITY_BANDS) {
      if (band.atLeast === -Infinity) continue;
      expect(normalizeHeroEquity(band.atLeast, 1)).toBe(band.atLeast);
      expect(bandFor(HERO_EQUITY_BANDS, normalizeHeroEquity(band.atLeast, 1))).toBe(band);
    }
  });

  it('maps the fair share itself onto the neutral band at every lineup size', () => {
    for (const opponents of [1, 2, 3, 4, 5]) {
      const fair = fairShareEquity(opponents);
      expect(normalizeHeroEquity(fair, opponents)).toBeCloseTo(0.5, 12);
      expect(bandFor(HERO_EQUITY_BANDS, normalizeHeroEquity(fair, opponents)).label).toBe('EVEN');
    }
  });

  it('separates a five-way hand near its fair share from one drawing nearly dead', () => {
    // The counterexample from the review, reproduced at the data level: 0.92x fair share and
    // 0.34x fair share both scored CRUSHED when the raw number was banded.
    const nearFair = 0.92 * fairShareEquity(4);
    const nearlyDead = 0.34 * fairShareEquity(4);
    expect(bandFor(HERO_EQUITY_BANDS, nearFair).label).toBe('CRUSHED');
    expect(bandFor(HERO_EQUITY_BANDS, nearlyDead).label).toBe('CRUSHED');

    const nearFairBand = bandFor(HERO_EQUITY_BANDS, normalizeHeroEquity(nearFair, 4));
    const nearlyDeadBand = bandFor(HERO_EQUITY_BANDS, normalizeHeroEquity(nearlyDead, 4));
    expect(nearFairBand.label).toBe('EVEN');
    expect(nearlyDeadBand.label).toBe('CRUSHED');
    expect(nearFairBand.points).toBeGreaterThan(nearlyDeadBand.points);
  });

  it('scores well above the fair share positively, and saturates nowhere below 1.0', () => {
    // Five-way with 50% of the pot is 2.5x the fair share: a big edge, not a coin flip.
    expect(bandFor(HERO_EQUITY_BANDS, normalizeHeroEquity(0.5, 4)).points).toBeGreaterThan(0);
    expect(bandFor(HERO_EQUITY_BANDS, normalizeHeroEquity(0.75, 4)).label).toBe('CRUSHING');
    // The output stays inside the table's domain, so the bands keep meaning what they say.
    for (const opponents of [1, 2, 3, 4, 5]) {
      expect(normalizeHeroEquity(0, opponents)).toBe(0);
      expect(normalizeHeroEquity(1, opponents)).toBeCloseTo(1, 12);
      for (let i = 0; i <= 100; i += 1) {
        const value = normalizeHeroEquity(i / 100, opponents);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is monotone in equity, so more equity is never a worse band', () => {
    for (const opponents of [1, 2, 3, 4, 5]) {
      let previous = -1;
      for (let i = 0; i <= 1000; i += 1) {
        const value = normalizeHeroEquity(i / 1000, opponents);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it('orders FACED_BET_SIZE so a bigger bet faced is never more points', () => {
    for (let i = 1; i < FACED_BET_SIZE_BANDS.length; i += 1) {
      expect(FACED_BET_SIZE_BANDS[i - 1]?.points ?? 0).toBeLessThan(
        FACED_BET_SIZE_BANDS[i]?.points ?? 0,
      );
    }
  });
});

describe('scoreModel — frequency tables', () => {
  it('keeps every aggression frequency on the 5-point grid', () => {
    for (const band of AGGRESSION_BANDS) {
      expect(band.aggressionBps % 500).toBe(0);
      expect(band.aggressionBps).toBeGreaterThanOrEqual(0);
      expect(band.aggressionBps).toBeLessThanOrEqual(10000);
    }
  });

  it('never states a pure aggression frequency', () => {
    expect(AGGRESSION_BANDS[0]?.aggressionBps).toBe(9500);
    for (const band of AGGRESSION_BANDS) expect(band.aggressionBps).toBeLessThan(10000);
  });

  it('gives up rather than inventing a bluff at the bottom band', () => {
    expect(AGGRESSION_BANDS[AGGRESSION_BANDS.length - 1]?.aggressionBps).toBe(0);
  });

  it('maps every documented aggression score band boundary', () => {
    for (const band of AGGRESSION_BANDS) {
      if (band.atLeast === -Infinity) continue;
      const at = AGGRESSION_BANDS.find((b) => band.atLeast >= b.atLeast);
      expect(at?.id).toBe(band.id);
      const below = AGGRESSION_BANDS.find((b) => band.atLeast - 1 >= b.atLeast);
      expect(below?.id).not.toBe(band.id);
    }
  });

  it('lets the continue table reach a pure continue but the aggression table not', () => {
    expect(CONTINUE_BANDS[0]?.continueBps).toBe(10000);
    expect(CONTINUE_BANDS[CONTINUE_BANDS.length - 1]?.continueBps).toBe(0);
  });

  it('keeps every continue frequency on the 5-point grid and descending', () => {
    for (let i = 0; i < CONTINUE_BANDS.length; i += 1) {
      const band = CONTINUE_BANDS[i];
      expect(band?.continueBps ?? 0).toBeGreaterThanOrEqual(0);
      expect((band?.continueBps ?? 0) % 500).toBe(0);
      if (i > 0) {
        expect(CONTINUE_BANDS[i - 1]?.continueBps ?? 0).toBeGreaterThan(band?.continueBps ?? 0);
      }
    }
  });

  it('keeps every raise share on the grid, descending, ending at zero', () => {
    for (let i = 0; i < RAISE_SHARE_BANDS.length; i += 1) {
      const band = RAISE_SHARE_BANDS[i];
      expect((band?.raiseShareBps ?? 0) % 500).toBe(0);
      if (i > 0) {
        expect(RAISE_SHARE_BANDS[i - 1]?.raiseShareBps ?? 0).toBeGreaterThan(
          band?.raiseShareBps ?? 0,
        );
      }
    }
    expect(RAISE_SHARE_BANDS[RAISE_SHARE_BANDS.length - 1]?.raiseShareBps).toBe(0);
  });

  it('never raises more than it continues at the top share band', () => {
    expect(RAISE_SHARE_BANDS[0]?.raiseShareBps).toBeLessThan(10000);
  });

  it('has a rationale on every frequency band', () => {
    for (const band of [...AGGRESSION_BANDS, ...CONTINUE_BANDS, ...RAISE_SHARE_BANDS]) {
      expect(band.rationale.length).toBeGreaterThan(30);
    }
  });
});

describe('scoreModel — multiway adjustments', () => {
  it('scales aggression down monotonically with each extra opponent', () => {
    for (let i = 2; i < MULTIWAY_AGGRESSION_SCALE_BPS.length; i += 1) {
      expect(MULTIWAY_AGGRESSION_SCALE_BPS[i] ?? 0).toBeLessThan(
        MULTIWAY_AGGRESSION_SCALE_BPS[i - 1] ?? 0,
      );
    }
    expect(MULTIWAY_AGGRESSION_SCALE_BPS[1]).toBe(10000);
  });

  it('penalizes continuing more with each extra opponent', () => {
    for (let i = 2; i < MULTIWAY_CONTINUE_PENALTY_BPS.length; i += 1) {
      expect(MULTIWAY_CONTINUE_PENALTY_BPS[i] ?? 0).toBeGreaterThan(
        MULTIWAY_CONTINUE_PENALTY_BPS[i - 1] ?? 0,
      );
    }
    expect(MULTIWAY_CONTINUE_PENALTY_BPS[1]).toBe(0);
  });

  it('scores multiway more negatively with each extra opponent, in both models', () => {
    for (let i = 2; i < MULTIWAY_AGGRESSION_POINTS.length; i += 1) {
      expect(MULTIWAY_AGGRESSION_POINTS[i] ?? 0).toBeLessThan(
        MULTIWAY_AGGRESSION_POINTS[i - 1] ?? 0,
      );
      expect(MULTIWAY_CONTINUE_POINTS[i] ?? 0).toBeLessThan(MULTIWAY_CONTINUE_POINTS[i - 1] ?? 0);
    }
    expect(MULTIWAY_AGGRESSION_POINTS[1]).toBe(0);
    expect(MULTIWAY_CONTINUE_POINTS[1]).toBe(0);
  });
});

describe('scoreModel — hand, draw and blocker tables', () => {
  it('orders the made-hand classes by showdown family', () => {
    expect(HAND_STRENGTH_POINTS.STRAIGHT_FLUSH).toBeGreaterThanOrEqual(HAND_STRENGTH_POINTS.QUADS);
    expect(HAND_STRENGTH_POINTS.FULL_HOUSE).toBeGreaterThan(HAND_STRENGTH_POINTS.FLUSH);
    expect(HAND_STRENGTH_POINTS.FLUSH).toBeGreaterThan(HAND_STRENGTH_POINTS.STRAIGHT);
    expect(HAND_STRENGTH_POINTS.TWO_PAIR).toBeGreaterThan(HAND_STRENGTH_POINTS.OVERPAIR);
    expect(HAND_STRENGTH_POINTS.TOP_PAIR).toBeGreaterThan(HAND_STRENGTH_POINTS.MIDDLE_PAIR);
    expect(HAND_STRENGTH_POINTS.MIDDLE_PAIR).toBeGreaterThan(HAND_STRENGTH_POINTS.BOTTOM_PAIR);
    expect(HAND_STRENGTH_POINTS.NO_MADE_HAND).toBeLessThan(HAND_STRENGTH_POINTS.ACE_HIGH);
  });

  it('documents the one deliberate departure from showdown order (SET above STRAIGHT)', () => {
    expect(HAND_STRENGTH_POINTS.SET).toBeGreaterThan(HAND_STRENGTH_POINTS.STRAIGHT);
    expect(HAND_STRENGTH_POINTS.SET).toBeGreaterThan(HAND_STRENGTH_POINTS.TRIPS);
  });

  it('never makes a draw a reason to be less aggressive', () => {
    for (const value of Object.values(DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS)) {
      expect(value).toBeGreaterThan(0);
    }
    for (const value of Object.values(DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND)) {
      expect(value).toBeGreaterThan(0);
    }
    expect(DRAW_QUALITY.BACKDOOR_FLUSH_DRAW).toBeGreaterThan(0);
  });

  it('ranks a nut flush draw above a weak one and an OESD above a gutshot', () => {
    expect(DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS.NUT).toBeGreaterThan(
      DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS.SECOND_NUT,
    );
    expect(DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS.THIRD_NUT).toBeGreaterThan(
      DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS.WEAK,
    );
    expect(DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND.OESD).toBeGreaterThan(
      DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND.DOUBLE_GUTSHOT,
    );
    expect(DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND.DOUBLE_GUTSHOT).toBeGreaterThan(
      DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND.GUTSHOT,
    );
  });

  it('caps the draw sum below the two-strongest-draws sum', () => {
    const both = DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS.NUT + DRAW_QUALITY.STRAIGHT_DRAW_BY_KIND.OESD;
    expect(DRAW_QUALITY.CAP).toBeLessThan(both);
    expect(DRAW_QUALITY.CAP).toBeGreaterThan(DRAW_QUALITY.FLUSH_DRAW_BY_NUT_CLASS.NUT);
  });

  it('ranks nut blockers above their non-nut counterparts and caps the sum', () => {
    expect(BLOCKER_POINTS.NUT_FLUSH_BLOCKER).toBeGreaterThan(
      BLOCKER_POINTS.SECOND_NUT_FLUSH_BLOCKER,
    );
    expect(BLOCKER_POINTS.NUT_FLUSH_DRAW_BLOCKER).toBeGreaterThan(
      BLOCKER_POINTS.FLUSH_DRAW_BLOCKER,
    );
    expect(BLOCKER_POINTS.NUT_STRAIGHT_BLOCKER).toBeGreaterThan(BLOCKER_POINTS.STRAIGHT_BLOCKER);
    const all = Object.values(BLOCKER_POINTS).reduce((a, b) => a + b, 0);
    expect(BLOCKER_CAP).toBeLessThan(all);
    for (const value of Object.values(BLOCKER_POINTS)) expect(value).toBeGreaterThan(0);
  });
});

describe('scoreModel — sizing ladder', () => {
  it('is strictly increasing in pot fraction with exact integer rationals', () => {
    for (let i = 0; i < POT_FRACTION_BUCKETS.length; i += 1) {
      const bucket = POT_FRACTION_BUCKETS[i];
      expect(bucket).toBeDefined();
      if (bucket === undefined) continue;
      expect(Number.isInteger(bucket.numerator)).toBe(true);
      expect(Number.isInteger(bucket.denominator)).toBe(true);
      expect(bucket.denominator).toBeGreaterThan(0);
      if (i > 0) {
        const previous = POT_FRACTION_BUCKETS[i - 1];
        expect(bucket.percent).toBeGreaterThan(previous?.percent ?? 0);
        expect(bucket.numerator / bucket.denominator).toBeGreaterThan(
          (previous?.numerator ?? 0) / (previous?.denominator ?? 1),
        );
      }
    }
  });

  it('is exactly the documented eight rungs', () => {
    expect(POT_FRACTION_BUCKETS.map((b) => b.percent)).toEqual([25, 33, 50, 67, 75, 100, 125, 150]);
  });

  it('keeps every base rung inside the ladder', () => {
    for (const index of Object.values(SIZING_BASE_INDEX_BY_BAND)) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(POT_FRACTION_BUCKETS.length);
    }
  });

  it('sizes bluffing bands like the value band they represent, not smaller', () => {
    // The polarization property: WEAK and POOR borrow STRONG's rung, so a bluff and the value
    // hands it represents cannot be told apart by the size alone.
    expect(SIZING_BASE_INDEX_BY_BAND.WEAK).toBe(SIZING_BASE_INDEX_BY_BAND.STRONG);
    expect(SIZING_BASE_INDEX_BY_BAND.POOR).toBe(SIZING_BASE_INDEX_BY_BAND.STRONG);
    expect(SIZING_BASE_INDEX_BY_BAND.MODERATE).toBeLessThan(SIZING_BASE_INDEX_BY_BAND.STRONG);
  });

  it('gates ALL_IN on both a low SPR and a strong band', () => {
    expect(ALL_IN_GATE.MAX_SPR).toBeLessThanOrEqual(2);
    expect(ALL_IN_GATE.MIN_BAND).toBe('STRONG');
  });
});

describe('scoreModel — nut share and all-in margin', () => {
  it('measures the nut share at a top slice, not a majority', () => {
    expect(NUT_SHARE_PERCENTILE).toBeGreaterThan(0);
    expect(NUT_SHARE_PERCENTILE).toBeLessThanOrEqual(0.1);
  });

  it('centres the all-in break-even band on the documented margin', () => {
    const breakEven = ALL_IN_CALL_BANDS.find((band) => band.label === 'BREAK_EVEN');
    const call = ALL_IN_CALL_BANDS.find((band) => band.label === 'CALL');
    expect(breakEven?.atLeast).toBe(-ALL_IN_CALL_MARGIN);
    expect(call?.atLeast).toBe(ALL_IN_CALL_MARGIN);
    expect(breakEven?.points).toBe(5000);
  });

  it('calls an all-in with a wide overlay and folds one that is clearly short', () => {
    expect(bandFor(ALL_IN_CALL_BANDS, 0.3).points).toBe(10000);
    expect(bandFor(ALL_IN_CALL_BANDS, -0.3).points).toBe(0);
  });

  it('writes the all-in tolerance exactly once: every edge is a multiple of it', () => {
    // R1B MINOR-11: the constant used to be declared, cited as an input and read by nothing,
    // with its value written a second time inside the table.
    for (const band of ALL_IN_CALL_BANDS) {
      if (band.atLeast === -Infinity) continue;
      const multiple = band.atLeast / ALL_IN_CALL_MARGIN;
      expect(Number.isInteger(multiple), band.label).toBe(true);
    }
  });

  it('prices a continue off the same table the all-in path uses', () => {
    // The floor under the multiway continue penalty is this table, not a new constant.
    expect(priceImpliedContinueBps(0.3)).toBe(10000);
    expect(priceImpliedContinueBps(0)).toBe(5000);
    expect(priceImpliedContinueBps(-0.3)).toBe(0);
    // No price at all (hero is not facing a bet) means no floor.
    expect(priceImpliedContinueBps(null)).toBe(0);
    for (const margin of [0.3, 0.05, 0, -0.05, -0.3]) {
      expect(priceImpliedContinueBps(margin) % 500).toBe(0);
    }
  });

  it('takes the unknown-SPR default off the band table rather than authoring one', () => {
    // R1B MINOR-8: `score.ts` spelled this `4` inline, twice, undocumented.
    const medium = SPR_PRESSURE_BANDS.find((band) => band.label === 'MEDIUM');
    expect(UNKNOWN_SPR).toBe(medium?.atLeast);
    expect(bandFor(SPR_PRESSURE_BANDS, UNKNOWN_SPR).label).toBe('MEDIUM');
    expect(bandFor(SPR_PRESSURE_BANDS, UNKNOWN_SPR).points).toBe(0);
  });
});

describe('postflop rule registry', () => {
  it('never classifies a postflop rule as SOURCE', () => {
    for (const rule of POSTFLOP_RULES) {
      expect(rule.provenance, rule.id).not.toBe('SOURCE');
    }
  });

  it('cites an anchor and a rationale on every rule', () => {
    for (const rule of POSTFLOP_RULES) {
      expect(rule.anchor.length, rule.id).toBeGreaterThan(10);
      expect(rule.rationale.length, rule.id).toBeGreaterThan(40);
      expect(rule.inputs.length, rule.id).toBeGreaterThan(0);
    }
  });

  it('marks exactly the mechanical rules DERIVED and everything judgemental HEURISTIC', () => {
    const derived = POSTFLOP_RULES.filter((rule) => rule.provenance === 'DERIVED').map((r) => r.id);
    expect(derived).toEqual([
      'POSTFLOP_SPOT_CLASSIFICATION',
      'POSTFLOP_REQUIRED_EQUITY',
      // HERO_EQUITY_MEASUREMENT is deliberately NOT here: exact arithmetic over HEURISTIC
      // villain ranges is HEURISTIC (R1B MINOR-9).
      'SIZING_POT_FRACTION_TO_AMOUNT',
      'LEGALITY_CLAMP',
      'LEGALITY_SUBSTITUTION',
      'FREQUENCY_QUANTIZATION',
      'PRIMARY_ACTION_TIE_BREAK',
      'STACK_BUCKET_NEARBY',
      'ENVIRONMENT_COMPATIBILITY',
    ]);
  });

  it('resolves every id and rejects a duplicate registry', () => {
    for (const rule of POSTFLOP_RULES) expect(postflopRule(rule.id)).toBe(rule);
    expect(new Set(POSTFLOP_RULES.map((r) => r.id)).size).toBe(POSTFLOP_RULES.length);
  });

  it('never names the reference engine GTO', () => {
    const text = JSON.stringify(POSTFLOP_RULES);
    expect(text).not.toMatch(/GTO/i);
  });
});
