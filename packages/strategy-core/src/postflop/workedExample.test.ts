/**
 * WORKED EXAMPLE B — the single spot `docs/reports/STRATEGY_WP_B3.md` derives end to end.
 *
 * BTN opens 2.5 BB, SB folds, BB calls. Flop `Ah 7d 2c`. BB checks. Hero is BTN with `Ac Qs`.
 *
 * Everything below is built by the REAL machinery: A3's preflop range propagation gives both
 * ranges, B1's `analyzeBoard` / `analyzeHeroHand` give the hand and board features, B2's equity
 * engine gives every equity number, and `scoreModel.ts` supplies every weight and threshold.
 * Nothing is stubbed and no number is asserted that the policy did not compute.
 *
 * The assertions are deliberately EXACT. This file is the regression fence around the tuning:
 * if a weight, a threshold, a band edge or a sizing rung moves, this test fails and the report
 * has to be re-derived rather than silently going stale.
 */
import { describe, expect, it } from 'vitest';
import { recommendPostflop } from './policy.js';
import { check, makePostflopQuery, pfCall, pfFold, pfRaise } from './testQuery.js';
import {
  AGGRESSION_TOTAL_WEIGHT,
  AGGRESSION_BANDS,
  POT_FRACTION_BUCKETS,
  SIZING_BASE_INDEX_BY_BAND,
} from './scoreModel.js';
import type { PostflopExplanationFeature } from './recommendation.js';

const QUERY = makePostflopQuery({
  hero: 'BTN',
  street: 'FLOP',
  board: 'Ah7d2c',
  heroCards: 'AcQs',
  actions: [
    pfFold('UTG'),
    pfFold('HJ'),
    pfFold('CO'),
    pfRaise('BTN', 2.5),
    pfFold('SB'),
    pfCall('BB', 2.5),
    check('FLOP', 'BB'),
  ],
});

const RESULT = recommendPostflop(QUERY);
if (!RESULT.ok) throw new Error(`the worked example must be answerable: ${RESULT.error.code}`);
const REC = RESULT.value;

const featureOf = (id: string): PostflopExplanationFeature | undefined =>
  REC.explanation.features.find((f) => f.id === id);

const componentOf = (id: string) =>
  REC.scoring.aggression.components.find((entry) => entry.id === id);

describe('Worked example B — the spot', () => {
  it('is a single-raised pot of 5.5 BB with hero in position and nothing to call', () => {
    expect(QUERY.potBeforeDecisionMbb).toBe(5500);
    expect(QUERY.callAmountMbb).toBe(0);
    expect(QUERY.legalActions.canCheck).toBe(true);
    expect(QUERY.legalActions.wager?.kind).toBe('BET');
    expect(QUERY.legalActions.wager?.minToAmountMbb).toBe(1000);
    expect(QUERY.legalActions.wager?.maxToAmountMbb).toBe(97500);
    expect(REC.family).toBe('CBET');
    expect(REC.potType).toBe('SINGLE_RAISED');
    expect(REC.heroPosition).toBe('BTN');
    expect(REC.handClass.key).toBe('AQo');
    expect(REC.street).toBe('FLOP');
  });

  it('classifies the board and the hand', () => {
    expect(featureOf('BOARD_TENDENCY')?.token).toBe('STATIC');
    expect(featureOf('BOARD_PAIRING')?.token).toBe('UNPAIRED');
    expect(featureOf('BOARD_CONNECTIVITY')?.token).toBe('DISCONNECTED');
    expect(featureOf('FLOP_SUIT_PATTERN')?.token).toBe('RAINBOW');
    expect(featureOf('MADE_HAND_CLASS')?.token).toBe('TOP_PAIR');
    expect(featureOf('RELATIVE_POSITION')?.token).toBe('IP');
    expect(featureOf('BLOCKER')?.token).toBe('TOP_PAIR_BLOCKER');
    expect(featureOf('CHECKS_TO_HERO')?.countValue).toBe(1);
    expect(featureOf('PREVIOUS_STREET_AGGRESSOR')?.token).toBe('BTN');
  });
});

describe('Worked example B — the measurements', () => {
  it('measures SPR from the query and never recomputes it', () => {
    expect(REC.metrics.spr).toBe(QUERY.spr);
    expect(REC.metrics.spr).toBeCloseTo(97500 / 5500, 12);
  });

  it("enumerates hero's own equity exactly", () => {
    expect(REC.metrics.heroEquityMethod).toBe('EXACT');
    expect(REC.metrics.heroEquity).toBeCloseTo(0.88038136, 7);
  });

  it("measures hero's range against BB's, and labels the subsampling honestly", () => {
    expect(REC.metrics.rangeEquity).toBeCloseTo(0.53061106, 7);
    expect(REC.metrics.rangeEquityMethod).toBe('SUBSAMPLED');
    expect(REC.metrics.rangeAdvantage).toBeCloseTo(0.03061106, 7);
    expect(featureOf('EQUITY_METHOD')?.token).toBe('EXACT/SUBSAMPLED');
  });

  it('measures the nut advantage as a difference of two board-referenced shares', () => {
    const hero = featureOf('NUT_SHARE_HERO')?.ratioValue ?? 0;
    const villain = featureOf('NUT_SHARE_VILLAIN')?.ratioValue ?? 0;
    expect(REC.metrics.nutAdvantage).toBeCloseTo(hero - villain, 12);
    expect(REC.metrics.nutAdvantage).toBeCloseTo(0.02706923, 7);
  });

  it("ranks hero's actual hand inside hero's own range", () => {
    expect(REC.metrics.rangeRank).toBeCloseTo(0.90532544, 7);
  });

  it('has no pot odds to report, because hero is not facing a bet', () => {
    expect(REC.metrics.potOdds).toBeNull();
    expect(REC.metrics.requiredEquity).toBeNull();
    expect(REC.metrics.callAmountMbb).toBe(0);
  });
});

describe('Worked example B — the aggression score, component by component', () => {
  // id -> [weight, points, weightedPoints, label]. This IS the table in the report.
  const EXPECTED: readonly (readonly [string, number, number, string])[] = [
    ['HAND_STRENGTH', 3, 40, 'TOP_PAIR'],
    ['HERO_EQUITY', 3, 80, 'CRUSHING'],
    ['RANGE_ADVANTAGE', 2, 15, 'SLIGHT_EDGE'],
    ['NUT_ADVANTAGE', 2, 15, 'SLIGHT_EDGE'],
    ['RANGE_RANK', 2, 35, 'TOP_15'],
    ['DRAW_QUALITY', 2, 0, 'NONE'],
    ['BLOCKER_QUALITY', 1, 8, 'BLOCKERS_1'],
    ['POSITION', 2, 20, 'IP'],
    ['INITIATIVE', 2, 25, 'HERO_PREV/NONE_NOW'],
    ['BOARD_TEXTURE', 1, 10, 'STATIC_WITH_RANGE_EDGE'],
    ['SPR_PRESSURE', 1, -15, 'VERY_DEEP'],
    ['MULTIWAY', 2, 0, 'OPPONENTS_1'],
    ['FACED_BET_SIZE', 1, 0, 'NOT_FACING_A_BET'],
    ['POT_TYPE', 1, 0, 'SINGLE_RAISED'],
    ['STREET_ACTION', 1, 12, 'CHECKS_TO_HERO_1'],
  ];

  it("scores all fifteen components, in the model's declared order", () => {
    expect(REC.scoring.aggression.components.map((entry) => entry.id)).toEqual(
      EXPECTED.map(([id]) => id),
    );
  });

  for (const [id, weight, points, label] of EXPECTED) {
    it(`scores ${id} as ${points} x ${weight} (${label})`, () => {
      const entry = componentOf(id);
      expect(entry, id).toBeDefined();
      expect(entry?.weight).toBe(weight);
      expect(entry?.points).toBe(points);
      expect(entry?.label).toBe(label);
      expect(entry?.weightedPoints).toBe(points * weight);
    });
  }

  it('is the weighted mean of those components and nothing else', () => {
    const sum = EXPECTED.reduce((acc, [, weight, points]) => acc + weight * points, 0);
    expect(sum).toBe(595);
    expect(AGGRESSION_TOTAL_WEIGHT).toBe(26);
    expect(REC.scoring.aggression.totalWeight).toBe(26);
    expect(Math.round(sum / 26)).toBe(23);
    expect(REC.scoring.aggression.score).toBe(23);
  });

  it('lands in the STRONG band, which is 80% aggression', () => {
    const strong = AGGRESSION_BANDS.find((band) => band.id === 'STRONG');
    expect(strong?.atLeast).toBe(16);
    expect(strong?.aggressionBps).toBe(8000);
    expect(REC.scoring.aggressionBand.id).toBe('STRONG');
    expect(REC.scoring.aggressionBps).toBe(8000);
  });

  it('applies no multiway scale heads-up, and runs no continue model with no bet to face', () => {
    expect(REC.scoring.multiwayScaleApplied).toBe(false);
    expect(REC.scoring.multiwayScaleBps).toBe(10000);
    expect(REC.scoring.continueModel).toBeNull();
    expect(REC.scoring.continueBand).toBeNull();
    expect(REC.scoring.raiseShareBand).toBeNull();
    expect(REC.scoring.allInBandLabel).toBeNull();
  });

  it('produces the raw mix directly from the band', () => {
    expect(REC.scoring.mix).toEqual({ foldBps: 0, passiveBps: 2000, aggressiveBps: 8000 });
  });
});

describe('Worked example B — the size', () => {
  it('starts from the STRONG band rung of 75% pot', () => {
    expect(SIZING_BASE_INDEX_BY_BAND.STRONG).toBe(4);
    expect(POT_FRACTION_BUCKETS[4]?.percent).toBe(75);
  });

  it('steps down once for the static board and once for the deep SPR', () => {
    const modifiers = REC.explanation.features.filter((f) => f.id === 'SIZING_MODIFIER');
    expect(modifiers.map((f) => [f.token, f.countValue])).toEqual([
      ['SIZING_TEXTURE_MODIFIER.STATIC', -1],
      ['SIZING_SPR_MODIFIER.HIGH_SPR', -1],
    ]);
  });

  it('lands on the 50%-pot rung', () => {
    expect(featureOf('SIZING_BUCKET')?.token).toBe('POT_50');
    expect(featureOf('SIZING_BUCKET')?.countValue).toBe(2);
    expect(POT_FRACTION_BUCKETS[2]?.percent).toBe(50);
  });

  it('converts 50% of a 5500 mBB pot to a legal bet-to of 2750 mBB, unclamped', () => {
    const bet = REC.actions.find((action) => action.kind === 'BET');
    expect(bet?.toAmountMbb).toBe(2750);
    expect(bet?.amountMbb).toBe(2750);
    expect(bet?.isAllIn).toBe(false);
    expect(bet?.sizing?.ruleId).toBe('SIZING_POT_FRACTION_TO_AMOUNT');
    expect(bet?.sizing?.requestedToAmountMbb).toBe(2750);
    expect(bet?.sizing?.clamp).toBe('NONE');
    expect(bet?.sizing?.minToAmountMbb).toBe(1000);
    expect(bet?.sizing?.maxToAmountMbb).toBe(97500);
    expect(bet?.sizing?.provenance).toBe('HEURISTIC');
  });

  it('does not consider an all-in: the SPR gate blocks it', () => {
    expect(featureOf('ALL_IN_GATE')?.token).toBe('BLOCKED_BY_SPR');
  });
});

describe('Worked example B — the answer', () => {
  it('is CHECK 20% / BET 80% at 2750 mBB', () => {
    expect(REC.actions.map((a) => [a.kind, a.frequencyBps, a.toAmountMbb])).toEqual([
      ['CHECK', 2000, null],
      ['BET', 8000, 2750],
    ]);
    expect(REC.primaryAction.kind).toBe('BET');
    expect(REC.actions.reduce((acc, a) => acc + a.frequencyBps, 0)).toBe(10000);
  });

  it('is labelled REFERENCE and is never GTO', () => {
    expect(REC.kind).toBe('PostflopRecommendation');
    expect(REC.label).toBe('REFERENCE');
    expect(JSON.stringify(REC)).not.toMatch(/GTO/i);
  });

  it('is HEURISTIC, with the exact rule set that produced it', () => {
    expect(REC.provenance.quality).toBe('HEURISTIC');
    expect(REC.provenance.ruleIds).toEqual([
      'POSTFLOP_SPOT_CLASSIFICATION',
      'VILLAIN_RANGE_FROM_PREFLOP',
      'HERO_EQUITY_MEASUREMENT',
      'RANGE_ADVANTAGE_MEASUREMENT',
      'NUT_ADVANTAGE_MEASUREMENT',
      'RANGE_PERCENTILE_MEASUREMENT',
      'AGGRESSION_SCORE_MODEL',
      'AGGRESSION_FREQUENCY_BANDS',
      'VILLAIN_RANGE_NOT_NARROWED',
      'EQUITY_SUBSAMPLED',
      'SIZING_BUCKET_SET',
      'SIZING_BASE_BY_BAND',
      'SIZING_TEXTURE_MODIFIER',
      'SIZING_SPR_MODIFIER',
      'SIZING_POT_FRACTION_TO_AMOUNT',
      'FREQUENCY_QUANTIZATION',
      'PRIMARY_ACTION_TIE_BREAK',
      'ENVIRONMENT_COMPATIBILITY',
    ]);
    expect(REC.provenance.notes.length).toBe(REC.provenance.ruleIds.length);
    expect(REC.provenance.environmentCompatibility.status).toBe('APPROXIMATE');
  });

  it('is HIGH confidence, and says the villain range was never narrowed', () => {
    expect(REC.confidence).toBe('HIGH');
    expect(featureOf('CONFIDENCE')?.countValue).toBe(0);
    expect(REC.villainRangeNarrowingApplied).toBe(false);
    expect(featureOf('VILLAIN_RANGE_NARROWING')?.token).toBe('NOT_APPLIED');
    expect(featureOf('VILLAIN_RANGE_NARROWING')?.countValue).toBe(1);
  });

  it('explains itself with 52 typed features and no prose', () => {
    expect(REC.explanation.features.length).toBe(52);
    for (const f of REC.explanation.features) {
      expect(f.token ?? '').not.toMatch(/\s/);
    }
  });

  /**
   * Heads-up, the fair-share normalization is the identity, so it is reported and changes
   * nothing. That is the property the multiway fix had to preserve.
   */
  it('reports the fair share and normalizes hero equity to itself heads-up', () => {
    expect(featureOf('HERO_EQUITY_FAIR_SHARE')?.ratioValue).toBe(0.5);
    expect(featureOf('HERO_EQUITY_FAIR_SHARE')?.countValue).toBe(1);
    expect(featureOf('HERO_EQUITY_NORMALIZED')?.ratioValue).toBe(
      featureOf('HERO_EQUITY')?.ratioValue,
    );
    expect(REC.provenance.ruleIds).not.toContain('HERO_EQUITY_FAIR_SHARE_NORMALIZATION');
  });

  it('is reproducible bit for bit', () => {
    const again = recommendPostflop(
      makePostflopQuery({
        hero: 'BTN',
        street: 'FLOP',
        board: 'Ah7d2c',
        heroCards: 'AcQs',
        actions: [
          pfFold('UTG'),
          pfFold('HJ'),
          pfFold('CO'),
          pfRaise('BTN', 2.5),
          pfFold('SB'),
          pfCall('BB', 2.5),
          check('FLOP', 'BB'),
        ],
      }),
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(JSON.stringify(again.value)).toBe(JSON.stringify(REC));
  });
});
