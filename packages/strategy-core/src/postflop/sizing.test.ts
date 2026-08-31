/**
 * Sizing: bucket selection per feature combination, the milliBB arithmetic, and the
 * clamp-and-degrade legality policy in both directions.
 *
 * The selection tests drive `selectSizing` through a synthetic context so one feature moves at
 * a time; the arithmetic and legality tests go through the real machinery.
 */
import { describe, expect, it } from 'vitest';
import { Money, type MilliBB } from '@gto-self/shared';
import { clampPostflopSizing, selectSizing, sizingRequestFor } from './sizing.js';
import { buildPostflopContext, type PostflopContext } from './context.js';
import {
  ALL_IN_GATE,
  POT_FRACTION_BUCKETS,
  SIZING_BASE_INDEX_BY_BAND,
  SIZING_MODIFIERS,
  type AggressionBandId,
} from './scoreModel.js';
import {
  bet,
  check,
  makePostflopQuery,
  pfCall,
  pfFold,
  pfRaise,
  type PostflopActionSpec,
} from './testQuery.js';
import type { StrategyWagerOption } from '../types.js';

const SRP: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfFold('SB'),
  pfCall('BB', 2.5),
];

const realContext = (
  actions: readonly PostflopActionSpec[] = [check('FLOP', 'BB')],
  board = 'Ah7d2c',
  street: 'FLOP' | 'TURN' | 'RIVER' = 'FLOP',
): PostflopContext => {
  const built = buildPostflopContext(
    makePostflopQuery({
      hero: 'BTN',
      street,
      board,
      heroCards: 'AcQs',
      actions: [...SRP, ...actions],
    }),
  );
  if (!built.ok) throw new Error(`context build failed: ${built.error.message}`);
  return built.value;
};

/**
 * A synthetic context carrying only the fields `selectSizing` reads, so one feature can be
 * moved at a time. Every other field is filled from a real context so nothing is invented.
 */
function withFeatures(
  base: PostflopContext,
  overrides: {
    tendency?: 'STATIC' | 'SEMI_DYNAMIC' | 'DYNAMIC';
    nutAdvantage?: number;
    rangeAdvantage?: number;
    spr?: number | null;
    opponents?: number;
    street?: 'FLOP' | 'TURN' | 'RIVER';
    facingBet?: boolean;
  },
): PostflopContext {
  return {
    ...base,
    board: {
      ...base.board,
      tendency: {
        ...base.board.tendency,
        value: overrides.tendency ?? base.board.tendency.value,
      },
    },
    nut: { ...base.nut, nutAdvantage: overrides.nutAdvantage ?? base.nut.nutAdvantage },
    rangeAdvantage: overrides.rangeAdvantage ?? base.rangeAdvantage,
    spr: overrides.spr === undefined ? base.spr : overrides.spr,
    spot: {
      ...base.spot,
      activeOpponentCount: overrides.opponents ?? base.spot.activeOpponentCount,
      street: overrides.street ?? base.spot.street,
      facingBet: overrides.facingBet ?? base.spot.facingBet,
    },
  } as PostflopContext;
}

/** A neutral context: nothing fires except the base rung. SPR is inside both gates. */
const neutral = (base: PostflopContext): PostflopContext =>
  withFeatures(base, {
    tendency: 'SEMI_DYNAMIC',
    nutAdvantage: 0,
    rangeAdvantage: 0,
    spr: 4,
    opponents: 1,
    street: 'FLOP',
    facingBet: false,
  });

describe('selectSizing — the base rung', () => {
  it('uses the documented base rung for every aggression band with no modifier firing', () => {
    const base = neutral(realContext());
    const bands: readonly AggressionBandId[] = [
      'DOMINANT',
      'STRONG',
      'MODERATE',
      'NEUTRAL',
      'WEAK',
      'POOR',
      'GIVE_UP',
    ];
    for (const band of bands) {
      const selection = selectSizing(base, band);
      // DOMINANT at SPR 4 is above the all-in gate, so every band reaches a bucket here.
      expect(selection.allIn).toBe(false);
      expect(selection.baseIndex).toBe(SIZING_BASE_INDEX_BY_BAND[band]);
      expect(selection.finalIndex).toBe(SIZING_BASE_INDEX_BY_BAND[band]);
      expect(selection.modifiers).toHaveLength(0);
      expect(selection.bucket).toBe(POT_FRACTION_BUCKETS[SIZING_BASE_INDEX_BY_BAND[band]]);
    }
  });
});

describe('selectSizing — one modifier at a time', () => {
  const base = () => neutral(realContext());

  it('sizes down on a STATIC board and up on a DYNAMIC one', () => {
    const staticBoard = selectSizing(withFeatures(base(), { tendency: 'STATIC' }), 'STRONG');
    const dynamic = selectSizing(withFeatures(base(), { tendency: 'DYNAMIC' }), 'STRONG');
    const semi = selectSizing(base(), 'STRONG');
    expect(staticBoard.finalIndex).toBe(semi.finalIndex - 1);
    expect(dynamic.finalIndex).toBe(semi.finalIndex + 1);
    expect(staticBoard.modifiers.map((m) => m.ruleId)).toContain('SIZING_TEXTURE_MODIFIER');
  });

  it('sizes up with a nut advantage and down without one', () => {
    const ahead = selectSizing(
      withFeatures(base(), { nutAdvantage: SIZING_MODIFIERS.NUT_ADVANTAGE_MARGIN }),
      'STRONG',
    );
    const behind = selectSizing(
      withFeatures(base(), { nutAdvantage: -SIZING_MODIFIERS.NUT_ADVANTAGE_MARGIN }),
      'STRONG',
    );
    const level = selectSizing(base(), 'STRONG');
    expect(ahead.finalIndex).toBe(level.finalIndex + 1);
    expect(behind.finalIndex).toBe(level.finalIndex - 1);
  });

  it('does not move for a nut advantage inside the documented margin', () => {
    const inside = selectSizing(
      withFeatures(base(), { nutAdvantage: SIZING_MODIFIERS.NUT_ADVANTAGE_MARGIN - 0.001 }),
      'STRONG',
    );
    expect(inside.modifiers.map((m) => m.ruleId)).not.toContain('SIZING_NUT_ADVANTAGE_MODIFIER');
  });

  it('applies the small-and-frequent discount only on a STATIC board', () => {
    const staticEdge = selectSizing(
      withFeatures(base(), {
        tendency: 'STATIC',
        rangeAdvantage: SIZING_MODIFIERS.RANGE_ADVANTAGE_MARGIN,
      }),
      'STRONG',
    );
    const dynamicEdge = selectSizing(
      withFeatures(base(), {
        tendency: 'DYNAMIC',
        rangeAdvantage: SIZING_MODIFIERS.RANGE_ADVANTAGE_MARGIN,
      }),
      'STRONG',
    );
    expect(staticEdge.modifiers.map((m) => m.ruleId)).toContain('SIZING_RANGE_ADVANTAGE_MODIFIER');
    expect(dynamicEdge.modifiers.map((m) => m.ruleId)).not.toContain(
      'SIZING_RANGE_ADVANTAGE_MODIFIER',
    );
    // STATIC (-1) plus the range-advantage discount (-1) is two rungs below the base.
    expect(staticEdge.finalIndex).toBe(SIZING_BASE_INDEX_BY_BAND.STRONG - 2);
  });

  it('sizes up at low SPR and down at high SPR', () => {
    const low = selectSizing(
      withFeatures(base(), { spr: SIZING_MODIFIERS.LOW_SPR - 0.01 }),
      'MODERATE',
    );
    const high = selectSizing(
      withFeatures(base(), { spr: SIZING_MODIFIERS.HIGH_SPR + 0.01 }),
      'MODERATE',
    );
    const mid = selectSizing(base(), 'MODERATE');
    expect(low.finalIndex).toBe(mid.finalIndex + 1);
    expect(high.finalIndex).toBe(mid.finalIndex - 1);
  });

  it('does not move at exactly the SPR gate values', () => {
    const atLow = selectSizing(withFeatures(base(), { spr: SIZING_MODIFIERS.LOW_SPR }), 'MODERATE');
    const atHigh = selectSizing(
      withFeatures(base(), { spr: SIZING_MODIFIERS.HIGH_SPR }),
      'MODERATE',
    );
    expect(atLow.modifiers.map((m) => m.ruleId)).not.toContain('SIZING_SPR_MODIFIER');
    expect(atHigh.modifiers.map((m) => m.ruleId)).not.toContain('SIZING_SPR_MODIFIER');
  });

  it('sizes down against three or more opponents but not against two', () => {
    const two = selectSizing(withFeatures(base(), { opponents: 2 }), 'STRONG');
    const three = selectSizing(withFeatures(base(), { opponents: 3 }), 'STRONG');
    expect(two.modifiers.map((m) => m.ruleId)).not.toContain('SIZING_MULTIWAY_MODIFIER');
    expect(three.finalIndex).toBe(two.finalIndex - 1);
  });

  it('sizes up on the river', () => {
    const river = selectSizing(withFeatures(base(), { street: 'RIVER' }), 'STRONG');
    expect(river.finalIndex).toBe(SIZING_BASE_INDEX_BY_BAND.STRONG + 1);
    expect(river.modifiers.map((m) => m.token)).toContain('RIVER');
  });

  it('sizes a raise one rung above a bet', () => {
    const raiseSizing = selectSizing(withFeatures(base(), { facingBet: true }), 'STRONG');
    expect(raiseSizing.finalIndex).toBe(SIZING_BASE_INDEX_BY_BAND.STRONG + 1);
    expect(raiseSizing.modifiers.map((m) => m.ruleId)).toContain('SIZING_RAISE_MODIFIER');
  });

  it('sums modifiers and never leaves the ladder in either direction', () => {
    const allDown = selectSizing(
      withFeatures(base(), {
        tendency: 'STATIC',
        nutAdvantage: -0.5,
        rangeAdvantage: 0.5,
        spr: 50,
        opponents: 5,
      }),
      'POOR',
    );
    expect(allDown.finalIndex).toBe(0);
    const allUp = selectSizing(
      withFeatures(base(), {
        tendency: 'DYNAMIC',
        nutAdvantage: 0.5,
        spr: 4,
        street: 'RIVER',
        facingBet: true,
      }),
      'DOMINANT',
    );
    expect(allUp.finalIndex).toBe(POT_FRACTION_BUCKETS.length - 1);
    expect(allUp.bucket?.percent).toBe(150);
  });
});

describe('selectSizing — the ALL_IN gate', () => {
  it('selects ALL_IN only when the SPR and the band both allow it', () => {
    const committed = withFeatures(neutral(realContext()), { spr: ALL_IN_GATE.MAX_SPR });
    expect(selectSizing(committed, 'DOMINANT').allIn).toBe(true);
    expect(selectSizing(committed, 'STRONG').allIn).toBe(true);
    expect(selectSizing(committed, 'MODERATE').allIn).toBe(false);
    expect(selectSizing(committed, 'MODERATE').allInGate).toBe('BLOCKED_BY_BAND');
  });

  it('blocks ALL_IN just above the SPR gate', () => {
    const deep = withFeatures(neutral(realContext()), { spr: ALL_IN_GATE.MAX_SPR + 0.01 });
    const selection = selectSizing(deep, 'DOMINANT');
    expect(selection.allIn).toBe(false);
    expect(selection.allInGate).toBe('BLOCKED_BY_SPR');
    expect(selection.bucket).not.toBeNull();
  });

  it('blocks ALL_IN when the SPR is unknown', () => {
    const noSpr = withFeatures(neutral(realContext()), { spr: null });
    expect(selectSizing(noSpr, 'DOMINANT').allInGate).toBe('BLOCKED_BY_SPR');
  });
});

describe('sizingRequestFor — the milliBB arithmetic', () => {
  const wager = (min: number, max: number): StrategyWagerOption => ({
    kind: 'BET',
    minToAmountMbb: Money.mbb(min),
    maxToAmountMbb: Money.mbb(max),
    minAdditionalMbb: Money.mbb(min),
    maxAdditionalMbb: Money.mbb(max),
    onlyAllIn: false,
  });

  it('bets an exact pot fraction of the pot before the decision', () => {
    const context = realContext();
    expect(context.potBeforeDecisionMbb).toBe(5500);
    for (const bucket of POT_FRACTION_BUCKETS) {
      const selection = {
        bucket,
        allIn: false,
        baseIndex: 0,
        finalIndex: 0,
        modifiers: [],
        allInGate: 'NOT_CONSIDERED' as const,
      };
      const request = sizingRequestFor(context, selection, Money.ZERO, wager(1000, 97500));
      expect(request.toAmountMbb).toBe(
        Money.mulRatio(context.potBeforeDecisionMbb, bucket.numerator, bucket.denominator, 'round'),
      );
    }
  });

  it('produces the documented archetypal sizes on a 5.5bb pot', () => {
    const context = realContext();
    const amountFor = (percent: number): MilliBB => {
      const bucket = POT_FRACTION_BUCKETS.find((b) => b.percent === percent);
      if (bucket === undefined) throw new Error(`no bucket at ${percent}%`);
      return sizingRequestFor(
        context,
        {
          bucket,
          allIn: false,
          baseIndex: 0,
          finalIndex: 0,
          modifiers: [],
          allInGate: 'NOT_CONSIDERED',
        },
        Money.ZERO,
        wager(1000, 97500),
      ).toAmountMbb;
    };
    expect(amountFor(25)).toBe(1375);
    expect(amountFor(33)).toBe(1833); // 5500/3 rounded ONCE, half away from zero
    expect(amountFor(50)).toBe(2750);
    expect(amountFor(67)).toBe(3667);
    expect(amountFor(100)).toBe(5500);
    expect(amountFor(150)).toBe(8250);
  });

  it('raises to the fraction of the pot AS IT WOULD BE after hero calls', () => {
    // BB bets 2.75 into 5.5, so the pot before hero's decision is 8.25 and the call is 2.75.
    const context = realContext([bet('FLOP', 'BB', 2.75)]);
    expect(context.potBeforeDecisionMbb).toBe(8250);
    expect(context.callAmountMbb).toBe(2750);
    const bucket = POT_FRACTION_BUCKETS.find((b) => b.percent === 100);
    if (bucket === undefined) throw new Error('missing bucket');
    const request = sizingRequestFor(
      context,
      {
        bucket,
        allIn: false,
        baseIndex: 0,
        finalIndex: 0,
        modifiers: [],
        allInGate: 'NOT_CONSIDERED',
      },
      Money.ZERO,
      wager(5500, 97500),
    );
    // call (2750) + 100% of (8250 + 2750) = 2750 + 11000 = 13750.
    expect(request.toAmountMbb).toBe(13750);
  });

  it("adds hero's own street contribution to a bet-TO amount", () => {
    const context = realContext();
    const bucket = POT_FRACTION_BUCKETS.find((b) => b.percent === 50);
    if (bucket === undefined) throw new Error('missing bucket');
    const request = sizingRequestFor(
      context,
      {
        bucket,
        allIn: false,
        baseIndex: 0,
        finalIndex: 0,
        modifiers: [],
        allInGate: 'NOT_CONSIDERED',
      },
      Money.mbb(1000),
      wager(1000, 97500),
    );
    expect(request.toAmountMbb).toBe(3750);
  });

  it('asks the engine for its maximum when ALL_IN was selected', () => {
    const context = realContext();
    const request = sizingRequestFor(
      context,
      {
        bucket: null,
        allIn: true,
        baseIndex: 0,
        finalIndex: 0,
        modifiers: [],
        allInGate: 'SELECTED',
      },
      Money.ZERO,
      wager(1000, 42000),
    );
    expect(request.ruleId).toBe('ALL_IN_SPR_GATE');
    expect(request.toAmountMbb).toBe(42000);
  });
});

describe('clampPostflopSizing — clamp-and-degrade', () => {
  const wager = (min: number, max: number): StrategyWagerOption => ({
    kind: 'BET',
    minToAmountMbb: Money.mbb(min),
    maxToAmountMbb: Money.mbb(max),
    minAdditionalMbb: Money.mbb(min),
    maxAdditionalMbb: Money.mbb(max),
    onlyAllIn: false,
  });
  const request = (to: number) => ({
    ruleId: 'SIZING_POT_FRACTION_TO_AMOUNT' as const,
    toAmountMbb: Money.mbb(to),
    selection: {
      bucket: POT_FRACTION_BUCKETS[2] ?? null,
      allIn: false,
      baseIndex: 2,
      finalIndex: 2,
      modifiers: [],
      allInGate: 'NOT_CONSIDERED' as const,
    },
  });

  it('leaves a legal size alone', () => {
    const sizing = clampPostflopSizing(request(2750), wager(1000, 97500));
    expect(sizing.clamp).toBe('NONE');
    expect(sizing.toAmountMbb).toBe(2750);
    expect(sizing.requestedToAmountMbb).toBe(2750);
  });

  it('raises a too-small size to the minimum and keeps the request', () => {
    const sizing = clampPostflopSizing(request(500), wager(1000, 97500));
    expect(sizing.clamp).toBe('RAISED_TO_MINIMUM');
    expect(sizing.toAmountMbb).toBe(1000);
    expect(sizing.requestedToAmountMbb).toBe(500);
  });

  it('lowers a too-large size to the maximum and keeps the request', () => {
    const sizing = clampPostflopSizing(request(50000), wager(1000, 6000));
    expect(sizing.clamp).toBe('LOWERED_TO_MAXIMUM');
    expect(sizing.toAmountMbb).toBe(6000);
    expect(sizing.requestedToAmountMbb).toBe(50000);
  });

  it('collapses an inconsistent bound pair to the maximum rather than throwing', () => {
    const sizing = clampPostflopSizing(request(2750), wager(9000, 6000));
    expect(sizing.toAmountMbb).toBe(6000);
  });

  it('never emits a size outside the engine bounds, across the whole ladder', () => {
    const context = realContext();
    for (const bucket of POT_FRACTION_BUCKETS) {
      for (const bounds of [
        [1000, 97500],
        [6000, 6500],
        [1000, 1200],
        [90000, 97500],
      ] as const) {
        const [min, max] = bounds;
        const req = sizingRequestFor(
          context,
          {
            bucket,
            allIn: false,
            baseIndex: 0,
            finalIndex: 0,
            modifiers: [],
            allInGate: 'NOT_CONSIDERED',
          },
          Money.ZERO,
          wager(min, max),
        );
        const sizing = clampPostflopSizing(req, wager(min, max));
        expect(sizing.toAmountMbb).toBeGreaterThanOrEqual(min);
        expect(sizing.toAmountMbb).toBeLessThanOrEqual(max);
      }
    }
  });

  it('reports the worst provenance of every rule that contributed to the size', () => {
    // The arithmetic is DERIVED, but the ladder and the base rung are authored, so the size a
    // recommendation shows is HEURISTIC and never claims otherwise.
    const sizing = clampPostflopSizing(request(2750), wager(1000, 97500));
    expect(sizing.provenance).toBe('HEURISTIC');
  });
});
