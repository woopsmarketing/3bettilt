/**
 * `recommendPostflop` end to end.
 *
 * Every fixture is built through the real machinery — A3's range propagation, B1's board and
 * hand analysis, B2's equity engine — so a test here fails when any of them changes behaviour
 * rather than when a mock drifts.
 */
import { describe, expect, it } from 'vitest';
import { recommendPostflop } from './policy.js';
import {
  aggressionBandFor,
  applyMultiwayScale,
  continueBandFor,
  multiwayContinuePenaltyBpsFor,
  multiwayScaleBpsFor,
  penalizedContinueBps,
  raiseShareBandFor,
} from './score.js';
import {
  AGGRESSION_BANDS,
  CONTINUE_BANDS,
  MULTIWAY_AGGRESSION_SCALE_BPS,
  RAISE_SHARE_BANDS,
} from './scoreModel.js';
import {
  bet,
  call,
  check,
  fold,
  makePostflopQuery,
  pfCall,
  pfFold,
  pfRaise,
  raise,
  shove,
  type PostflopActionSpec,
  type PostflopQuerySpec,
} from './testQuery.js';
import type { PostflopRecommendation } from './recommendation.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SRP: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfFold('SB'),
  pfCall('BB', 2.5),
];

const SRP_3WAY: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfCall('SB', 2.5),
  pfCall('BB', 2.5),
];

function recommend(spec: PostflopQuerySpec): PostflopRecommendation {
  const result = recommendPostflop(makePostflopQuery(spec));
  if (!result.ok)
    throw new Error(`recommendation failed: ${result.error.code} ${result.error.message}`);
  return result.value;
}

const flopSpot = (
  overrides: Partial<PostflopQuerySpec> & { actions?: readonly PostflopActionSpec[] } = {},
): PostflopQuerySpec => ({
  hero: 'BTN',
  street: 'FLOP',
  board: 'Ah7d2c',
  heroCards: 'AcQs',
  actions: [...SRP, check('FLOP', 'BB')],
  ...overrides,
});

const frequencyOf = (rec: PostflopRecommendation, kind: string): number =>
  rec.actions.find((action) => action.kind === kind)?.frequencyBps ?? 0;

const aggressiveFrequency = (rec: PostflopRecommendation): number =>
  frequencyOf(rec, 'BET') + frequencyOf(rec, 'RAISE') + frequencyOf(rec, 'ALL_IN');

// ---------------------------------------------------------------------------

describe('recommendPostflop — the frequency contract', () => {
  const cases: readonly (readonly [string, PostflopQuerySpec])[] = [
    ['flop c-bet with top pair', flopSpot()],
    ['flop c-bet with air', flopSpot({ heroCards: '6c5c' })],
    ['flop facing a half-pot bet', flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] })],
    [
      'flop facing a raise',
      flopSpot({
        actions: [...SRP, check('FLOP', 'BB'), bet('FLOP', 'BTN', 2), raise('FLOP', 'BB', 7)],
      }),
    ],
    ['flop facing a shove', flopSpot({ actions: [...SRP, shove('FLOP', 'BB', 97.5)] })],
    [
      'turn probe out of position',
      {
        hero: 'BB',
        street: 'TURN',
        board: 'Ah7d2c9s',
        heroCards: '9c9d',
        actions: [...SRP, check('FLOP', 'BB'), check('FLOP', 'BTN')],
      },
    ],
    [
      'river with the nuts',
      {
        hero: 'BTN',
        street: 'RIVER',
        board: 'AhKhQh2c3d',
        heroCards: 'JhTh',
        actions: [
          ...SRP,
          check('FLOP', 'BB'),
          check('FLOP', 'BTN'),
          check('TURN', 'BB'),
          check('TURN', 'BTN'),
          check('RIVER', 'BB'),
        ],
      },
    ],
    [
      'three-way flop c-bet',
      flopSpot({ actions: [...SRP_3WAY, check('FLOP', 'SB'), check('FLOP', 'BB')] }),
    ],
  ];

  for (const [name, spec] of cases) {
    it(`emits multiples of 500 summing to exactly 10000 — ${name}`, () => {
      const rec = recommend(spec);
      let total = 0;
      for (const action of rec.actions) {
        expect(action.frequencyBps % 500, action.kind).toBe(0);
        expect(action.frequencyBps).toBeGreaterThan(0);
        total += action.frequencyBps;
      }
      expect(total).toBe(10000);
    });

    it(`names a primary action that is one of the emitted ones — ${name}`, () => {
      const rec = recommend(spec);
      expect(rec.actions).toContain(rec.primaryAction);
      const highest = Math.max(...rec.actions.map((a) => a.frequencyBps));
      expect(rec.primaryAction.frequencyBps).toBe(highest);
    });

    it(`emits only legal actions with legal amounts — ${name}`, () => {
      const query = makePostflopQuery(spec);
      const rec = recommend(spec);
      for (const action of rec.actions) {
        if (action.kind === 'FOLD') expect(query.legalActions.canFold).toBe(true);
        if (action.kind === 'CHECK') expect(query.legalActions.canCheck).toBe(true);
        if (action.kind === 'CALL') expect(query.legalActions.call).not.toBeNull();
        if (action.kind === 'BET' || action.kind === 'RAISE') {
          const wager = query.legalActions.wager;
          expect(wager).not.toBeNull();
          expect(action.kind).toBe(wager?.kind);
          expect(action.toAmountMbb ?? 0).toBeGreaterThanOrEqual(wager?.minToAmountMbb ?? 0);
          expect(action.toAmountMbb ?? 0).toBeLessThanOrEqual(wager?.maxToAmountMbb ?? 0);
        }
      }
    });
  }

  it('is deterministic: the same query gives a bit-identical recommendation', () => {
    const spec = flopSpot();
    expect(JSON.stringify(recommend(spec))).toBe(JSON.stringify(recommend(spec)));
    const facing = flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] });
    expect(JSON.stringify(recommend(facing))).toBe(JSON.stringify(recommend(facing)));
  });

  it('never orders an action before a less committing one', () => {
    const rec = recommend(flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }));
    const order = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'];
    const indices = rec.actions.map((action) => order.indexOf(action.kind));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });
});

describe('score -> frequency tables', () => {
  it('maps every aggression band boundary to its documented frequency', () => {
    for (const band of AGGRESSION_BANDS) {
      if (band.atLeast === -Infinity) {
        expect(aggressionBandFor(-1000).id).toBe(band.id);
        continue;
      }
      expect(aggressionBandFor(band.atLeast).id).toBe(band.id);
      expect(aggressionBandFor(band.atLeast).aggressionBps).toBe(band.aggressionBps);
      expect(aggressionBandFor(band.atLeast - 1).id).not.toBe(band.id);
    }
  });

  it('maps every continue band boundary to its documented frequency', () => {
    for (const band of CONTINUE_BANDS) {
      if (band.atLeast === -Infinity) {
        expect(continueBandFor(-1000).id).toBe(band.id);
        continue;
      }
      expect(continueBandFor(band.atLeast).id).toBe(band.id);
      expect(continueBandFor(band.atLeast).continueBps).toBe(band.continueBps);
      expect(continueBandFor(band.atLeast - 1).id).not.toBe(band.id);
    }
  });

  it('maps every raise-share band boundary to its documented share', () => {
    for (const band of RAISE_SHARE_BANDS) {
      if (band.atLeast === -Infinity) {
        expect(raiseShareBandFor(-1000).id).toBe(band.id);
        continue;
      }
      expect(raiseShareBandFor(band.atLeast).id).toBe(band.id);
      expect(raiseShareBandFor(band.atLeast).raiseShareBps).toBe(band.raiseShareBps);
      expect(raiseShareBandFor(band.atLeast - 1).id).not.toBe(band.id);
    }
  });

  it('is total above and below the table', () => {
    expect(aggressionBandFor(1000).id).toBe('DOMINANT');
    expect(continueBandFor(1000).id).toBe('ALWAYS');
    expect(raiseShareBandFor(1000).raiseShareBps).toBe(RAISE_SHARE_BANDS[0]?.raiseShareBps);
  });
});

describe('multiway adjustments', () => {
  it('scales every non-zero band frequency strictly down for each extra opponent', () => {
    for (const band of AGGRESSION_BANDS) {
      let previous = band.aggressionBps;
      for (let opponents = 2; opponents < MULTIWAY_AGGRESSION_SCALE_BPS.length; opponents += 1) {
        const scaled = applyMultiwayScale(band.aggressionBps, opponents);
        expect(scaled).toBeLessThanOrEqual(previous);
        if (band.aggressionBps > 0) expect(scaled).toBeLessThan(band.aggressionBps);
        previous = scaled;
      }
    }
  });

  it('leaves a heads-up frequency untouched', () => {
    expect(multiwayScaleBpsFor(1)).toBe(10000);
    for (const band of AGGRESSION_BANDS) {
      expect(applyMultiwayScale(band.aggressionBps, 1)).toBe(band.aggressionBps);
    }
  });

  it('keeps every scaled frequency on the 5-point grid', () => {
    for (const band of AGGRESSION_BANDS) {
      for (let opponents = 1; opponents <= 5; opponents += 1) {
        expect(applyMultiwayScale(band.aggressionBps, opponents) % 500).toBe(0);
      }
    }
  });

  it('penalizes continuing more with each extra opponent', () => {
    expect(multiwayContinuePenaltyBpsFor(1)).toBe(0);
    for (let opponents = 3; opponents <= 5; opponents += 1) {
      expect(multiwayContinuePenaltyBpsFor(opponents)).toBeGreaterThan(
        multiwayContinuePenaltyBpsFor(opponents - 1),
      );
    }
  });

  it('bets the SAME hand on the SAME board less often three-way than heads-up', () => {
    const hu = recommend(flopSpot());
    const threeWay = recommend(
      flopSpot({ actions: [...SRP_3WAY, check('FLOP', 'SB'), check('FLOP', 'BB')] }),
    );
    expect(threeWay.metrics.activeOpponentCount).toBe(2);
    expect(aggressiveFrequency(threeWay)).toBeLessThan(aggressiveFrequency(hu));
  });

  it('bluffs the SAME air hand less often three-way than heads-up', () => {
    const hu = recommend(flopSpot({ heroCards: '6c5c' }));
    const threeWay = recommend(
      flopSpot({
        heroCards: '6c5c',
        actions: [...SRP_3WAY, check('FLOP', 'SB'), check('FLOP', 'BB')],
      }),
    );
    expect(aggressiveFrequency(threeWay)).toBeLessThan(aggressiveFrequency(hu));
  });

  it('continues less often three-way than heads-up against the same bet', () => {
    const hu = recommend(
      flopSpot({ heroCards: 'Kh9h', actions: [...SRP, bet('FLOP', 'BB', 2.75)] }),
    );
    const threeWay = recommend(
      flopSpot({
        heroCards: 'Kh9h',
        actions: [...SRP_3WAY, check('FLOP', 'SB'), bet('FLOP', 'BB', 3.75)],
      }),
    );
    const continueOf = (rec: PostflopRecommendation) => 10000 - frequencyOf(rec, 'FOLD');
    expect(continueOf(threeWay)).toBeLessThan(continueOf(hu));
  });

  it('degrades confidence and records the multiway rule when more than one opponent is live', () => {
    const threeWay = recommend(
      flopSpot({ actions: [...SRP_3WAY, check('FLOP', 'SB'), check('FLOP', 'BB')] }),
    );
    expect(threeWay.provenance.ruleIds).toContain('MULTIWAY_DEGRADE');
    expect(threeWay.confidence).not.toBe('HIGH');
  });
});

/**
 * R1 regression: `HERO_EQUITY_BANDS` is a 0.5-centred table and was fed RAW pooled equity, so
 * five ways every hand at or below 0.20 — including one holding 92% of its fair share — landed
 * in the bottom band together. These assertions are on the SCORED band, because that is where
 * the defect lived; the mapping's own properties are in `scoreModel.test.ts`.
 */
describe('multiway hero equity is scored against the fair share', () => {
  const FIVE_WAY: readonly PostflopActionSpec[] = [
    pfCall('UTG', 1),
    pfCall('HJ', 1),
    pfCall('CO', 1),
    pfCall('BTN', 1),
    pfFold('SB'),
  ];

  const fiveWaySpot = (heroCards: string): PostflopQuerySpec => ({
    hero: 'BB',
    street: 'FLOP',
    board: 'Ah7d2c',
    heroCards,
    actions: [...FIVE_WAY],
  });

  const equityComponent = (rec: PostflopRecommendation) => {
    const entry = rec.scoring.aggression.components.find((c) => c.id === 'HERO_EQUITY');
    if (entry === undefined) throw new Error('the aggression model must score HERO_EQUITY');
    return entry;
  };

  it('is a genuine five-way pot in which hero holds close to a fair share', () => {
    const rec = recommend(fiveWaySpot('2s3d'));
    expect(rec.metrics.activeOpponentCount).toBe(4);
    // ~0.92x the 0.20 fair share. The premise: raw equity is far below 0.25, the old table's
    // second-worst edge, so the raw-banded version could only ever say CRUSHED.
    const equity = rec.metrics.heroEquity;
    expect(equity).toBeLessThan(0.25);
    expect(equity * 5).toBeGreaterThan(0.85);
    expect(equity * 5).toBeLessThan(1.05);
  });

  it('lands a near-fair-share five-way hand in the NEUTRAL band, not CRUSHED', () => {
    const rec = recommend(fiveWaySpot('2s3d'));
    const scored = equityComponent(rec);
    expect(scored.label).toBe('EVEN');
    expect(scored.points).toBeGreaterThan(0);
    // The ACTUAL pooled equity is still what is reported (CLAUDE.md rule 3) — the
    // normalization changed how it is SCORED, not what the recommendation says hero has.
    expect(scored.rawValue).toBe(rec.metrics.heroEquity);
  });

  it('still scores a five-way hand far below its fair share as CRUSHED', () => {
    const rec = recommend(fiveWaySpot('Qs8h'));
    // ~0.42x the fair share: genuinely bad, and it must not be dragged up by the mapping.
    expect(rec.metrics.heroEquity * 5).toBeLessThan(0.6);
    const scored = equityComponent(rec);
    expect(scored.label).toBe('CRUSHED');
    expect(scored.points).toBeLessThan(0);
  });

  it('orders three five-way hands by fair-share ratio, which the raw table could not', () => {
    const nearlyDead = equityComponent(recommend(fiveWaySpot('Qs8h')));
    const nearFair = equityComponent(recommend(fiveWaySpot('2s3d')));
    const wellAhead = equityComponent(recommend(fiveWaySpot('AcKc')));
    expect(nearFair.points).toBeGreaterThan(nearlyDead.points);
    expect(wellAhead.points).toBeGreaterThan(nearFair.points);
    // Well above fair share (~3.3x) scores positively rather than merely "less negative".
    expect(wellAhead.points).toBeGreaterThan(0);
  });

  it('reports the normalization, its inputs and the rule that applied it', () => {
    const rec = recommend(fiveWaySpot('2s3d'));
    const featureOf = (id: string) => rec.explanation.features.find((f) => f.id === id);
    expect(featureOf('HERO_EQUITY')?.ratioValue).toBe(rec.metrics.heroEquity);
    expect(featureOf('HERO_EQUITY_FAIR_SHARE')?.ratioValue).toBe(0.2);
    expect(featureOf('HERO_EQUITY_FAIR_SHARE')?.countValue).toBe(4);
    expect(featureOf('HERO_EQUITY_NORMALIZED')?.ratioValue).toBeGreaterThan(0.45);
    expect(featureOf('HERO_EQUITY_NORMALIZED')?.ratioValue).toBeLessThan(0.5);
    expect(rec.provenance.ruleIds).toContain('HERO_EQUITY_FAIR_SHARE_NORMALIZATION');
    expect(
      rec.provenance.notes.some((note) => note.startsWith('HERO_EQUITY_FAIR_SHARE_NORMALIZATION:')),
    ).toBe(true);
    // ADR-0056 still holds on the answer this changed.
    const frequencies = rec.actions.map((action) => action.frequencyBps);
    for (const bps of frequencies) expect(bps % 500).toBe(0);
    expect(frequencies.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('leaves the heads-up answer bit-identical', () => {
    // The control that pins "HU is numerically unchanged": the worked-example spot's scored
    // equity band is read off the raw number because heads-up the fair share IS 0.5.
    const hu = recommend(flopSpot());
    expect(hu.metrics.activeOpponentCount).toBe(1);
    const scored = equityComponent(hu);
    expect(scored.rawValue).toBe(hu.metrics.heroEquity);
    expect(scored.label).toBe('CRUSHING');
    expect(scored.points).toBe(80);
    const featureOf = (id: string) => hu.explanation.features.find((f) => f.id === id);
    expect(featureOf('HERO_EQUITY_NORMALIZED')?.ratioValue).toBe(hu.metrics.heroEquity);
    expect(hu.provenance.ruleIds).not.toContain('HERO_EQUITY_FAIR_SHARE_NORMALIZATION');
  });
});

describe('facing a bet — the pot-odds paths', () => {
  it('never folds a hand that beats the price by a wide margin', () => {
    const rec = recommend(flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }));
    expect(rec.family).toBe('FACING_BET');
    expect(frequencyOf(rec, 'FOLD')).toBe(0);
    expect(frequencyOf(rec, 'CALL')).toBeGreaterThan(0);
    expect(rec.metrics.requiredEquity).toBeCloseTo(2750 / (8250 + 2750), 10);
    expect(rec.metrics.heroEquity).toBeGreaterThan(rec.metrics.requiredEquity ?? 1);
  });

  it('mostly folds a hand that is clearly short of the price', () => {
    const rec = recommend(
      flopSpot({ heroCards: '6c5c', actions: [...SRP, bet('FLOP', 'BB', 5.5)] }),
    );
    expect(frequencyOf(rec, 'FOLD')).toBeGreaterThan(5000);
    expect(rec.primaryAction.kind).toBe('FOLD');
  });

  it('reaches all three of fold, call and raise across a range of holdings', () => {
    const observed = new Set<string>();
    let mixed = 0;
    for (const heroCards of ['AcQs', 'Ad9d', 'Kh9h', '6c5c']) {
      for (const size of [1.5, 2.75, 5.5]) {
        const rec = recommend(flopSpot({ heroCards, actions: [...SRP, bet('FLOP', 'BB', size)] }));
        for (const action of rec.actions) {
          expect(['FOLD', 'CALL', 'RAISE']).toContain(action.kind);
          observed.add(action.kind);
        }
        if (rec.actions.length >= 2) mixed += 1;
      }
    }
    expect([...observed].sort()).toEqual(['CALL', 'FOLD', 'RAISE']);
    expect(mixed).toBeGreaterThan(0);
  }, 60_000);

  it('folds more against a bigger bet with the same hand', () => {
    const small = recommend(
      flopSpot({ heroCards: 'Kh9h', actions: [...SRP, bet('FLOP', 'BB', 1.5)] }),
    );
    const large = recommend(
      flopSpot({ heroCards: 'Kh9h', actions: [...SRP, bet('FLOP', 'BB', 5.5)] }),
    );
    expect(frequencyOf(large, 'FOLD')).toBeGreaterThan(frequencyOf(small, 'FOLD'));
  });

  it('records the sourced required-equity rule whenever hero faces a bet, and not otherwise', () => {
    const facing = recommend(flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }));
    const unbet = recommend(flopSpot());
    expect(facing.provenance.ruleIds).toContain('POSTFLOP_REQUIRED_EQUITY');
    expect(unbet.provenance.ruleIds).not.toContain('POSTFLOP_REQUIRED_EQUITY');
    expect(unbet.metrics.requiredEquity).toBeNull();
  });

  it('never emits a FOLD when checking is free', () => {
    for (const heroCards of ['AcQs', '6c5c', 'Kh9h', 'JdTd']) {
      const rec = recommend(flopSpot({ heroCards }));
      expect(frequencyOf(rec, 'FOLD')).toBe(0);
    }
  });
});

describe('facing an all-in', () => {
  const allInSpot = (heroCards: string): PostflopQuerySpec => ({
    hero: 'BTN',
    street: 'RIVER',
    board: 'Ah7d2c9s3h',
    heroCards,
    actions: [
      ...SRP,
      check('FLOP', 'BB'),
      check('FLOP', 'BTN'),
      check('TURN', 'BB'),
      check('TURN', 'BTN'),
      shove('RIVER', 'BB', 97.5),
    ],
  });

  it('reduces the decision to call or fold — never a raise', () => {
    for (const heroCards of ['AcQs', '6c5c', 'Kh9h']) {
      const rec = recommend(allInSpot(heroCards));
      expect(rec.family).toBe('FACING_ALL_IN');
      for (const action of rec.actions) {
        expect(['FOLD', 'CALL']).toContain(action.kind);
      }
      expect(rec.provenance.ruleIds).toContain('FACING_ALL_IN_POT_ODDS');
      expect(rec.provenance.ruleIds).not.toContain('RAISE_SHARE_BANDS');
    }
  });

  it('calls a huge overlay outright and folds a hopeless one outright', () => {
    const strong = recommend(allInSpot('AcQs'));
    expect(frequencyOf(strong, 'CALL')).toBe(10000);
    const hopeless = recommend(allInSpot('6c5c'));
    expect(frequencyOf(hopeless, 'FOLD')).toBe(10000);
  });

  it('reports the all-in band it used', () => {
    const rec = recommend(allInSpot('AcQs'));
    expect(rec.scoring.allInBandLabel).toBe('CLEAR_CALL');
    const feature = rec.explanation.features.find((f) => f.id === 'ALL_IN_BAND');
    expect(feature?.token).toBe('CLEAR_CALL');
  });

  it('still computes and reports the aggression model, so the explanation is complete', () => {
    const rec = recommend(allInSpot('AcQs'));
    expect(rec.scoring.aggression.components.length).toBeGreaterThan(10);
    expect(rec.scoring.aggressionBps).toBe(0);
  });
});

/**
 * R1B MAJOR-3 (the multiway continue penalty was subtracted from a band whose contract is
 * "never folds") and MAJOR-5 (aggression was hard-zeroed facing an all-in even with a legal
 * raise and a live opponent behind). The two overlap on the shove fixture below, which is why
 * it asserts both properties at once.
 */
describe('multiway continue penalty and the live all-in tree', () => {
  const CHECKED_TO_RIVER_3WAY: readonly PostflopActionSpec[] = [
    ...SRP_3WAY,
    check('FLOP', 'SB'),
    check('FLOP', 'BB'),
    check('FLOP', 'BTN'),
    check('TURN', 'SB'),
    check('TURN', 'BB'),
    check('TURN', 'BTN'),
  ];
  const CHECKED_TO_RIVER_HU: readonly PostflopActionSpec[] = [
    ...SRP,
    check('FLOP', 'BB'),
    check('FLOP', 'BTN'),
    check('TURN', 'BB'),
    check('TURN', 'BTN'),
  ];

  /** Board 7h7d2c9s3h, hero holds 7s7c: quads, unbeatable, no runout left to lose. */
  const quadsRiver3Way = (): PostflopQuerySpec => ({
    hero: 'BTN',
    street: 'RIVER',
    board: '7h7d2c9s3h',
    heroCards: '7s7c',
    actions: [...CHECKED_TO_RIVER_3WAY, bet('RIVER', 'SB', 5), call('RIVER', 'BB', 5)],
  });

  const quadsRiverHu = (): PostflopQuerySpec => ({
    hero: 'BTN',
    street: 'RIVER',
    board: '7h7d2c9s3h',
    heroCards: '7s7c',
    actions: [...CHECKED_TO_RIVER_HU, bet('RIVER', 'BB', 5)],
  });

  /**
   * 3-way flop 7h7d2c, hero (BTN, 100 BB) holds quads. A 25 BB SB shoves; BB has 100 BB and
   * has not acted, so the tree is live and a raise IS legal.
   */
  const quadsVsShove = (heroCards: string): PostflopQuerySpec => ({
    hero: 'BTN',
    street: 'FLOP',
    board: '7h7d2c',
    heroCards,
    stacksBB: { SB: 25 },
    actions: [...SRP_3WAY, shove('FLOP', 'SB', 22.5)],
  });

  it('never folds 100%-equity quads three-way facing a bet and a call', () => {
    const rec = recommend(quadsRiver3Way());
    expect(rec.metrics.activeOpponentCount).toBe(2);
    expect(rec.metrics.heroEquity).toBe(1);
    expect(frequencyOf(rec, 'FOLD')).toBe(0);
    // The penalty itself is unchanged and still reported — it is the floor that is new.
    expect(rec.scoring.multiwayContinuePenaltyBps).toBe(multiwayContinuePenaltyBpsFor(2));
    expect(rec.scoring.continueBand?.id).toBe('ALWAYS');
    expect(rec.scoring.continueBps).toBe(10000);
  });

  it('gives that hand the same zero fold frequency heads-up as three-way', () => {
    const hu = recommend(quadsRiverHu());
    expect(hu.metrics.activeOpponentCount).toBe(1);
    expect(frequencyOf(hu, 'FOLD')).toBe(0);
    expect(hu.scoring.continueBps).toBe(10000);
  });

  it('never folds quads facing a shove with a deep opponent still live, and can isolate', () => {
    const rec = recommend(quadsVsShove('7s7c'));
    expect(rec.family).toBe('FACING_ALL_IN');
    expect(rec.metrics.heroEquity).toBeGreaterThan(0.99);
    expect(frequencyOf(rec, 'FOLD')).toBe(0);
    // MAJOR-5: the isolation raise is reachable, at a real frequency rather than a token one.
    // Measured 1500 bps: the aggression score is damped by the overbet shove it faces and by
    // the multiway aggression scale, both of which are the model working as documented.
    const aggressive = aggressiveFrequency(rec);
    expect(aggressive).toBeGreaterThanOrEqual(1000);
    expect(rec.scoring.raiseShareBand).not.toBeNull();
    expect(rec.provenance.ruleIds).toContain('FACING_ALL_IN_ISOLATION');
    expect(rec.provenance.ruleIds).toContain('RAISE_SHARE_BANDS');
    const tree = rec.explanation.features.find((f) => f.id === 'ALL_IN_TREE');
    expect(tree?.token).toBe('LIVE');
  });

  it('still collapses a weak hand facing the same shove to fold or call', () => {
    const rec = recommend(quadsVsShove('6c5c'));
    expect(rec.family).toBe('FACING_ALL_IN');
    for (const action of rec.actions) expect(['FOLD', 'CALL']).toContain(action.kind);
    expect(aggressiveFrequency(rec)).toBe(0);
  });

  it('reports the tree as COLLAPSED heads-up, where there really is nothing to raise into', () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'RIVER',
      board: 'Ah7d2c9s3h',
      heroCards: 'AcQs',
      actions: [...CHECKED_TO_RIVER_HU, shove('RIVER', 'BB', 97.5)],
    });
    const tree = rec.explanation.features.find((f) => f.id === 'ALL_IN_TREE');
    expect(tree?.token).toBe('COLLAPSED');
    expect(rec.scoring.aggressionBps).toBe(0);
    expect(rec.provenance.ruleIds).not.toContain('RAISE_SHARE_BANDS');
  });

  it('still makes a marginal multiway hand continue less often than heads-up', () => {
    // Below the price line the penalty applies in full, exactly as before the floor existed.
    const shortOfThePrice = -0.5;
    for (const band of CONTINUE_BANDS) {
      for (const opponents of [2, 3, 4, 5]) {
        const multiway = penalizedContinueBps(band.continueBps, opponents, shortOfThePrice);
        const headsUp = penalizedContinueBps(band.continueBps, 1, shortOfThePrice);
        expect(headsUp).toBe(band.continueBps);
        expect(multiway).toBe(
          Math.max(0, band.continueBps - multiwayContinuePenaltyBpsFor(opponents)),
        );
        expect(multiway).toBeLessThanOrEqual(headsUp);
      }
    }
    // A marginal band with two opponents is STRICTLY tighter than heads-up.
    expect(penalizedContinueBps(5500, 2, shortOfThePrice)).toBe(4500);
    // And it keeps biting on a hand the model likes but the price does not settle: an ALWAYS
    // band at a modest overlay still gives up 1000 three-handed.
    expect(penalizedContinueBps(10000, 2, 0.05)).toBe(9000);
    // A band BELOW the price-implied frequency is not protected at all, however good the price.
    expect(penalizedContinueBps(3500, 5, 0.5)).toBe(500);
  });

  it('floors the penalty at the price-implied frequency and never above the band', () => {
    // A wide overlay on a band that never folds: nothing is subtracted, at any opponent count.
    expect(penalizedContinueBps(10000, 2, 0.5)).toBe(10000);
    expect(penalizedContinueBps(10000, 5, 0.5)).toBe(10000);
    // The floor is a bound on the REDUCTION, never a way to raise a frequency.
    expect(penalizedContinueBps(0, 5, 0.5)).toBe(0);
    // At a break-even price the floor is the price table's own 5000, so a marginal band gives
    // up 500 rather than the full 1000.
    expect(penalizedContinueBps(5500, 2, -0.01)).toBe(5000);
    // With no price at all (hero is not facing a bet) there is no floor.
    expect(penalizedContinueBps(5500, 2, null)).toBe(4500);
  });
});

describe('recommending an all-in', () => {
  it('shoves at low SPR with a strong hand, gated by the documented rule', () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      startingStackBB: 40,
      actions: [
        pfFold('UTG'),
        pfFold('HJ'),
        pfFold('CO'),
        pfRaise('BTN', 2.5),
        pfFold('SB'),
        pfRaise('BB', 10),
        pfCall('BTN', 10),
        check('FLOP', 'BB'),
      ],
    });
    expect(rec.metrics.spr ?? 99).toBeLessThanOrEqual(1.5);
    const aggressive = rec.actions.find((a) => a.kind === 'BET' || a.kind === 'RAISE');
    expect(aggressive?.isAllIn).toBe(true);
    expect(rec.provenance.ruleIds).toContain('ALL_IN_SPR_GATE');
    const gate = rec.explanation.features.find((f) => f.id === 'ALL_IN_GATE');
    expect(gate?.token).toBe('SELECTED');
  });

  it('does not shove at a deep SPR even with the nuts', () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'RIVER',
      board: 'AhKhQh2c3d',
      heroCards: 'JhTh',
      actions: [
        ...SRP,
        check('FLOP', 'BB'),
        check('FLOP', 'BTN'),
        check('TURN', 'BB'),
        check('TURN', 'BTN'),
        check('RIVER', 'BB'),
      ],
    });
    const aggressive = rec.actions.find((a) => a.kind === 'BET');
    expect(aggressive?.isAllIn).toBe(false);
    const gate = rec.explanation.features.find((f) => f.id === 'ALL_IN_GATE');
    expect(gate?.token).toBe('BLOCKED_BY_SPR');
  });
});

describe('river extremes', () => {
  const riverSpot = (board: string, heroCards: string): PostflopQuerySpec => ({
    hero: 'BTN',
    street: 'RIVER',
    board,
    heroCards,
    actions: [
      ...SRP,
      check('FLOP', 'BB'),
      check('FLOP', 'BTN'),
      check('TURN', 'BB'),
      check('TURN', 'BTN'),
      check('RIVER', 'BB'),
    ],
  });

  it('bets the nuts at near-pure frequency but never at 100%', () => {
    const rec = recommend(riverSpot('AhKhQh2c3d', 'JhTh'));
    expect(rec.metrics.heroEquity).toBe(1);
    expect(aggressiveFrequency(rec)).toBeGreaterThanOrEqual(9000);
    expect(aggressiveFrequency(rec)).toBeLessThan(10000);
    expect(rec.scoring.aggressionBand.id).toBe('DOMINANT');
  });

  it('never turns river air into a pure bluff', () => {
    const rec = recommend(riverSpot('AhKdQc7s2h', '6c5c'));
    expect(rec.metrics.heroEquity).toBeLessThan(0.1);
    expect(aggressiveFrequency(rec)).toBeLessThan(5000);
    expect(rec.primaryAction.kind).toBe('CHECK');
  });

  it('never jams river air: any bluff it does make is a sized bucket, not the stack', () => {
    const rec = recommend(riverSpot('AhKdQc7s2h', '6c5c'));
    const aggressive = rec.actions.find((a) => a.kind === 'BET');
    if (aggressive === undefined) return;
    expect(aggressive.isAllIn).toBe(false);
    expect(aggressive.toAmountMbb ?? 0).toBeLessThan(rec.metrics.effectiveStackMbb);
  });

  it('is more aggressive with the nuts than with air on the same board', () => {
    const nuts = recommend(riverSpot('AhKhQh2c3d', 'JhTh'));
    const air = recommend(riverSpot('AhKhQh2c3d', '6c5c'));
    expect(aggressiveFrequency(nuts)).toBeGreaterThan(aggressiveFrequency(air));
  });
});

describe('legality substitution and clamping', () => {
  it('checks instead of betting when the engine offers no wager', () => {
    const rec = recommend(flopSpot({ noWager: true }));
    expect(rec.actions.map((a) => a.kind)).toEqual(['CHECK']);
    expect(rec.provenance.ruleIds).toContain('LEGALITY_SUBSTITUTION');
    // The jam is NOT substituted in: at SPR 17.7 the all-in gate blocks it.
    expect(rec.provenance.ruleIds).toContain('ALL_IN_SPR_GATE');
  });

  it('refuses to promote a 50%-pot plan into a 97 BB jam when only a shove is legal', () => {
    const rec = recommend(flopSpot({ wagerOnlyAllIn: true }));
    expect(rec.actions.map((a) => a.kind)).toEqual(['CHECK']);
    expect(rec.provenance.ruleIds).toContain('LEGALITY_SUBSTITUTION');
    expect(rec.provenance.ruleIds).toContain('ALL_IN_SPR_GATE');
  });

  it('reports no sizing rule or bet amount for an answer with no sized action (R1 MINOR-4)', () => {
    const rec = recommend(flopSpot({ wagerOnlyAllIn: true }));
    expect(rec.actions.every((action) => action.sizing === null)).toBe(true);
    for (const id of ['SIZING_BUCKET', 'SIZING_MODIFIER', 'SIZING_RULE', 'SIZING_CLAMPED']) {
      expect(rec.explanation.features.some((f) => f.id === id)).toBe(false);
    }
    for (const id of [
      'SIZING_BUCKET_SET',
      'SIZING_BASE_BY_BAND',
      'SIZING_POT_FRACTION_TO_AMOUNT',
    ]) {
      expect(rec.provenance.ruleIds).not.toContain(id);
    }
    // What DID happen is still reported: the gate that suppressed the aggression.
    expect(rec.explanation.features.some((f) => f.id === 'ALL_IN_GATE')).toBe(true);
    expect(rec.provenance.ruleIds).toContain('ALL_IN_SPR_GATE');
  });

  it('DOES substitute the jam when the all-in gate permits it', () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      startingStackBB: 40,
      wagerOnlyAllIn: true,
      actions: [
        pfFold('UTG'),
        pfFold('HJ'),
        pfFold('CO'),
        pfRaise('BTN', 2.5),
        pfFold('SB'),
        pfRaise('BB', 10),
        pfCall('BTN', 10),
        check('FLOP', 'BB'),
      ],
    });
    expect(rec.metrics.spr ?? 99).toBeLessThanOrEqual(1.5);
    expect(rec.actions.map((a) => a.kind).sort()).toEqual(['ALL_IN', 'CHECK']);
    const allIn = rec.actions.find((a) => a.kind === 'ALL_IN');
    expect(allIn?.isAllIn).toBe(true);
    expect(allIn?.toAmountMbb).toBe(30000);
  });

  it('raises a too-small size to the engine minimum and says so', () => {
    const rec = recommend(flopSpot({ wagerMinToBB: 5, wagerMaxToBB: 90 }));
    const sizing = rec.actions.find((a) => a.sizing !== null)?.sizing;
    expect(sizing?.clamp).toBe('RAISED_TO_MINIMUM');
    expect(sizing?.toAmountMbb).toBe(5000);
    expect(sizing?.requestedToAmountMbb).toBeLessThan(5000);
    expect(rec.provenance.ruleIds).toContain('LEGALITY_CLAMP');
    expect(rec.explanation.features.some((f) => f.id === 'SIZING_CLAMPED')).toBe(true);
  });

  it('lowers a too-large size to the engine maximum and says so', () => {
    const rec = recommend(flopSpot({ wagerMinToBB: 1, wagerMaxToBB: 1.5 }));
    const sizing = rec.actions.find((a) => a.sizing !== null)?.sizing;
    expect(sizing?.clamp).toBe('LOWERED_TO_MAXIMUM');
    expect(sizing?.toAmountMbb).toBe(1500);
    expect(sizing?.requestedToAmountMbb).toBeGreaterThan(1500);
  });

  it('keeps every emitted size legal under deliberately tight bounds', () => {
    for (const bounds of [
      [4, 4.5],
      [1, 1.2],
      [10, 60],
    ] as const) {
      const [min, max] = bounds;
      for (const heroCards of ['AcQs', '6c5c', 'Kh9h']) {
        const rec = recommend(flopSpot({ heroCards, wagerMinToBB: min, wagerMaxToBB: max }));
        for (const action of rec.actions) {
          if (action.sizing === null) continue;
          expect(action.toAmountMbb ?? 0).toBeGreaterThanOrEqual(min * 1000);
          expect(action.toAmountMbb ?? 0).toBeLessThanOrEqual(max * 1000);
        }
      }
    }
  });
});

describe('provenance and honesty', () => {
  it('never labels a postflop answer SOURCE', () => {
    for (const spec of [
      flopSpot(),
      flopSpot({ heroCards: '6c5c' }),
      flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }),
    ]) {
      const rec = recommend(spec);
      expect(rec.provenance.quality).not.toBe('SOURCE');
      expect(rec.provenance.quality).toBe('HEURISTIC');
    }
  });

  it('carries a mandatory note for a HEURISTIC answer', () => {
    const rec = recommend(flopSpot());
    expect(rec.provenance.quality).toBe('HEURISTIC');
    expect(rec.provenance.notes.length).toBeGreaterThan(0);
    for (const note of rec.provenance.notes) expect(note).toMatch(/^[A-Z_]+: /);
  });

  it('is labelled REFERENCE and never GTO, anywhere in the whole object', () => {
    for (const spec of [
      flopSpot(),
      flopSpot({ heroCards: '6c5c' }),
      flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }),
      flopSpot({ actions: [...SRP, shove('FLOP', 'BB', 97.5)] }),
    ]) {
      const rec = recommend(spec);
      expect(rec.label).toBe('REFERENCE');
      expect(JSON.stringify(rec)).not.toMatch(/GTO/i);
    }
  });

  it('reports every rule it used, with no duplicates', () => {
    const rec = recommend(flopSpot());
    expect(new Set(rec.provenance.ruleIds).size).toBe(rec.provenance.ruleIds.length);
    expect(rec.provenance.ruleIds).toContain('AGGRESSION_SCORE_MODEL');
    expect(rec.provenance.ruleIds).toContain('VILLAIN_RANGE_FROM_PREFLOP');
    expect(rec.provenance.ruleIds).toContain('FREQUENCY_QUANTIZATION');
    expect(rec.provenance.ruleIds).toContain('PRIMARY_ACTION_TIE_BREAK');
  });

  it('always says the villain range was not narrowed by postflop actions', () => {
    const rec = recommend(flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }));
    expect(rec.villainRangeNarrowingApplied).toBe(false);
    const feature = rec.explanation.features.find((f) => f.id === 'VILLAIN_RANGE_NARROWING');
    expect(feature?.token).toBe('NOT_APPLIED');
    expect(feature?.countValue).toBe(1);
    expect(rec.provenance.ruleIds).toContain('VILLAIN_RANGE_NOT_NARROWED');
  });

  it('reports environment compatibility with no EXACT status and flags an ante', () => {
    const plain = recommend(flopSpot());
    expect(plain.provenance.environmentCompatibility.status).toBe('APPROXIMATE');
    const ante = recommend(flopSpot({ anteEnabled: true }));
    expect(ante.provenance.environmentCompatibility.status).toBe('DIVERGENT');
    expect(
      ante.provenance.environmentCompatibility.factors.find((f) => f.id === 'ANTE')?.status,
    ).toBe('DIVERGENT');
  });

  it('degrades and flags an unmodelled stack depth', () => {
    const rec = recommend(flopSpot({ startingStackBB: 30 }));
    expect(rec.provenance.ruleIds).toContain('STACK_BUCKET_OUT_OF_RANGE');
    expect(rec.explanation.features.some((f) => f.id === 'UNMODELLED_STACK_DEPTH')).toBe(true);
  });

  it('degrades a short-handed lineup', () => {
    const rec = recommend(
      flopSpot({
        dealtInCount: 4,
        actions: [
          pfFold('CO'),
          pfRaise('BTN', 2.5),
          pfFold('SB'),
          pfCall('BB', 2.5),
          check('FLOP', 'BB'),
        ],
      }),
    );
    expect(rec.provenance.ruleIds).toContain('LINEUP_SHORT_HANDED');
  });

  it('reports HIGH confidence heads-up with an exact hero equity and no prior aggression', () => {
    const rec = recommend(flopSpot());
    expect(rec.metrics.heroEquityMethod).toBe('EXACT');
    expect(rec.confidence).toBe('HIGH');
  });
});

describe('the structured explanation', () => {
  it('carries typed features with ids and values, and never a generated sentence', () => {
    const rec = recommend(flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }));
    expect(rec.explanation.features.length).toBeGreaterThan(30);
    for (const f of rec.explanation.features) {
      expect(typeof f.id).toBe('string');
      // Every token is an enum-ish identifier: upper-case letters, digits, separators only.
      if (f.token !== null) expect(f.token).toMatch(/^[A-Za-z0-9_./+-]+$/);
      // No sentence-shaped content anywhere.
      expect(f.token ?? '').not.toMatch(/\s/);
    }
  });

  it('reports every scoring component of both models', () => {
    const rec = recommend(flopSpot({ actions: [...SRP, bet('FLOP', 'BB', 2.75)] }));
    const components = rec.explanation.features.filter((f) => f.id === 'SCORE_COMPONENT');
    expect(components.filter((f) => f.token?.startsWith('AGGRESSION.')).length).toBe(15);
    expect(components.filter((f) => f.token?.startsWith('CONTINUE.')).length).toBe(8);
    for (const component of components) {
      expect(component.countValue).not.toBeNull();
      expect(component.ratioValue).not.toBeNull();
    }
  });

  it('reports the board, the hand, the measurements and the sizing', () => {
    const rec = recommend(flopSpot());
    const ids = new Set<string>(rec.explanation.features.map((f) => f.id as string));
    for (const id of [
      'SPOT_FAMILY',
      'STREET',
      'POT_TYPE',
      'HERO_POSITION',
      'RELATIVE_POSITION',
      'MADE_HAND_CLASS',
      'BOARD_TENDENCY',
      'BOARD_PAIRING',
      'HERO_EQUITY',
      'RANGE_EQUITY',
      'NUT_ADVANTAGE',
      'RANGE_RANK',
      'AGGRESSION_SCORE',
      'AGGRESSION_BAND',
      'SIZING_BUCKET',
      'SIZING_RULE',
      'CONFIDENCE',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('names each blocker hero holds', () => {
    const rec = recommend(flopSpot());
    const blockers = rec.explanation.features.filter((f) => f.id === 'BLOCKER');
    expect(blockers.length).toBeGreaterThan(0);
    for (const blocker of blockers) expect(blocker.token).toMatch(/^[A-Z_]+$/);
  });

  it('names the draws hero holds', () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7h2c',
      heroCards: 'KhQh',
      actions: [...SRP, check('FLOP', 'BB')],
    });
    const draws = rec.explanation.features.filter((f) => f.id === 'DRAW').map((f) => f.token);
    expect(draws.some((token) => token?.startsWith('FLUSH_DRAW_'))).toBe(true);
  });
});

describe('metrics', () => {
  it('passes SPR and pot values through from the query without recomputing them', () => {
    const query = makePostflopQuery(flopSpot());
    const rec = recommend(flopSpot());
    expect(rec.metrics.spr).toBe(query.spr);
    expect(rec.metrics.potBeforeDecisionMbb).toBe(query.potBeforeDecisionMbb);
    expect(rec.metrics.callAmountMbb).toBe(query.callAmountMbb);
    expect(rec.metrics.effectiveStackMbb).toBe(query.effectiveStackMbb);
    expect(rec.metrics.stackBucket).toEqual(query.stackBucket);
  });

  it('reports hero equity, range equity, range advantage, nut advantage and rank', () => {
    const rec = recommend(flopSpot());
    expect(rec.metrics.heroEquity).toBeGreaterThan(0);
    expect(rec.metrics.heroEquity).toBeLessThanOrEqual(1);
    expect(rec.metrics.rangeAdvantage).toBeCloseTo(rec.metrics.rangeEquity - 0.5, 12);
    expect(rec.metrics.rangeRank).toBeGreaterThanOrEqual(0);
    expect(rec.metrics.rangeRank).toBeLessThanOrEqual(1);
    expect(Number.isFinite(rec.metrics.nutAdvantage)).toBe(true);
  });

  it('labels the equity method so a subsampled number can never be shown as exact', () => {
    const rec = recommend(flopSpot());
    expect(['EXACT', 'SUBSAMPLED']).toContain(rec.metrics.heroEquityMethod);
    expect(['EXACT', 'SUBSAMPLED']).toContain(rec.metrics.rangeEquityMethod);
    const feature = rec.explanation.features.find((f) => f.id === 'EQUITY_METHOD');
    expect(feature?.token).toBe(`${rec.metrics.heroEquityMethod}/${rec.metrics.rangeEquityMethod}`);
  });

  it("enumerates hero's own equity exactly on the river heads-up", () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'RIVER',
      board: 'Ah7d2c9s3h',
      heroCards: 'AcQs',
      actions: [
        ...SRP,
        check('FLOP', 'BB'),
        check('FLOP', 'BTN'),
        check('TURN', 'BB'),
        check('TURN', 'BTN'),
        check('RIVER', 'BB'),
      ],
    });
    expect(rec.metrics.heroEquityMethod).toBe('EXACT');
  });
});

describe('refusals', () => {
  it('refuses a preflop query', () => {
    const query = { ...makePostflopQuery(flopSpot()), street: 'PREFLOP' as const };
    const result = recommendPostflop(query);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_A_DECISION_POINT');
  });

  it("refuses when hero's holding is not two cards", () => {
    const query = { ...makePostflopQuery(flopSpot()), heroCards: [] };
    const result = recommendPostflop(query);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_HERO_CARDS');
  });

  it('refuses when hero holds a card that is on the board', () => {
    const result = recommendPostflop(makePostflopQuery(flopSpot({ heroCards: 'Ah2d' })));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_HERO_CARDS');
  });

  it('refuses a hand nobody is left in', () => {
    const query = { ...makePostflopQuery(flopSpot()), activeOpponentCount: 0 };
    const result = recommendPostflop(query);
    expect(result.ok).toBe(false);
  });

  it('answers rather than refusing when the preflop line is one the policy does not model', () => {
    // An SB limp is off-policy for A3's raise-or-fold SB: the range is carried unchanged and
    // flagged, and hero still gets an answer.
    const rec = recommend({
      hero: 'BB',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'KdQd',
      actions: [
        pfFold('UTG'),
        pfFold('HJ'),
        pfFold('CO'),
        pfFold('BTN'),
        pfCall('SB', 1),
        check('FLOP', 'SB'),
      ],
    });
    expect(rec.actions.length).toBeGreaterThan(0);
    expect(rec.provenance.ruleIds).toContain('VILLAIN_RANGE_OFF_POLICY');
    expect(rec.explanation.features.some((f) => f.id === 'VILLAIN_RANGE_OFF_POLICY')).toBe(true);
  });
});

describe('a property sweep over hands, boards and lines', () => {
  const boards = ['Ah7d2c', 'Kh9h4h', '8s7s6d', 'QdQc2h'];
  const hands = ['AcQs', '6c5c', 'JdTd', '9c9d', 'KsQh'];
  const lines: readonly (readonly [string, readonly PostflopActionSpec[]])[] = [
    ['checked to hero', [...SRP, check('FLOP', 'BB')]],
    ['facing a half-pot bet', [...SRP, bet('FLOP', 'BB', 2.75)]],
    ['facing a pot-sized bet', [...SRP, bet('FLOP', 'BB', 5.5)]],
    [
      'facing a raise',
      [...SRP, check('FLOP', 'BB'), bet('FLOP', 'BTN', 2), raise('FLOP', 'BB', 7)],
    ],
  ];

  it('answers every combination with a legal, normalized, quantized mix', () => {
    let checked = 0;
    for (const board of boards) {
      for (const heroCards of hands) {
        for (const [, actions] of lines) {
          const query = makePostflopQuery({
            hero: 'BTN',
            street: 'FLOP',
            board,
            heroCards,
            actions,
          });
          const result = recommendPostflop(query);
          if (!result.ok) {
            // The only acceptable refusal here is a card clash between hand and board.
            expect(result.error.code).toBe('INVALID_HERO_CARDS');
            continue;
          }
          const rec = result.value;
          let total = 0;
          for (const action of rec.actions) {
            expect(action.frequencyBps % 500).toBe(0);
            total += action.frequencyBps;
            if (action.sizing !== null) {
              const wager = query.legalActions.wager;
              expect(action.toAmountMbb ?? 0).toBeGreaterThanOrEqual(wager?.minToAmountMbb ?? 0);
              expect(action.toAmountMbb ?? 0).toBeLessThanOrEqual(wager?.maxToAmountMbb ?? 0);
            }
          }
          expect(total).toBe(10000);
          expect(rec.provenance.quality).not.toBe('SOURCE');
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  }, 120_000);

  it('never bets a hand more often than a strictly stronger one in the same spot', () => {
    // A monotonicity spot-check: on a dry ace-high board, top pair must bet more than air.
    const strong = recommend(flopSpot({ heroCards: 'AcQs' }));
    const weak = recommend(flopSpot({ heroCards: '6c5c' }));
    expect(aggressiveFrequency(strong)).toBeGreaterThan(aggressiveFrequency(weak));
  });

  it('handles a seat folding on an earlier street', () => {
    const rec = recommend({
      hero: 'BTN',
      street: 'TURN',
      board: 'Ah7d2c9s',
      heroCards: 'AcQs',
      actions: [
        ...SRP_3WAY,
        check('FLOP', 'SB'),
        check('FLOP', 'BB'),
        bet('FLOP', 'BTN', 2),
        fold('FLOP', 'SB'),
        call('FLOP', 'BB', 2),
        check('TURN', 'BB'),
      ],
    });
    expect(rec.metrics.activeOpponentCount).toBe(1);
    expect(rec.family).toBe('CBET');
  });
});
