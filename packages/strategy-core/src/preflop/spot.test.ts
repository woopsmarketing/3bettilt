/**
 * Neutral spot-classification tests: synthetic `StrategyQuery` values, no poker-core.
 *
 * They cover the branches a legal hand cannot reach (hero facing its own aggression, a
 * 5-bet-plus tree, a query already on a later street) plus the table-driven family matrix.
 * The lines that a real hand CAN produce are tested against the engine in
 * `../adapter/preflopSpot.test.ts`.
 */
import { Money, type MilliBB } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import type {
  StrategyActionKind,
  StrategyActionRecord,
  StrategyPosition,
  StrategyQuery,
  StrategySeatProfile,
  StrategyStreet,
} from '../types.js';
import { classifyPreflopSpot } from './spot.js';

const BB = (bb: number): MilliBB => Money.fromBB(bb);

const ORDERS: Readonly<
  Record<StrategyPosition, { readonly preflop: number; readonly postflop: number }>
> = {
  UTG: { preflop: 0, postflop: 2 },
  HJ: { preflop: 1, postflop: 3 },
  CO: { preflop: 2, postflop: 4 },
  BTN: { preflop: 3, postflop: 5 },
  SB: { preflop: 4, postflop: 0 },
  BB: { preflop: 5, postflop: 1 },
};

const SIX_MAX: readonly StrategyPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function seat(
  position: StrategyPosition,
  hero: StrategyPosition,
  folded: boolean,
): StrategySeatProfile {
  return {
    position,
    seatIndex: ORDERS[position].preflop,
    isHero: position === hero,
    status: folded ? 'FOLDED' : 'IN_HAND',
    startingStackMbb: BB(100),
    remainingStackMbb: BB(100),
    totalContributionMbb: Money.ZERO,
    streetContributionMbb: Money.ZERO,
    deadContributionMbb: Money.ZERO,
    preflopOrder: ORDERS[position].preflop,
    postflopOrder: ORDERS[position].postflop,
    isButton: position === 'BTN',
    blindRole: position === 'SB' ? 'SB' : position === 'BB' ? 'BB' : null,
  };
}

interface ActionSpec {
  readonly position: StrategyPosition;
  readonly kind: StrategyActionKind;
  readonly toAmountMbb?: MilliBB;
  readonly aggressive?: boolean;
  readonly allIn?: boolean;
}

function action(spec: ActionSpec, seq: number): StrategyActionRecord {
  return {
    seq,
    street: 'PREFLOP',
    position: spec.position,
    kind: spec.kind,
    toAmountMbb: spec.toAmountMbb ?? null,
    amountMbb: spec.toAmountMbb ?? Money.ZERO,
    potBeforeMbb: BB(1.5),
    potAfterMbb: BB(1.5),
    currentBetBeforeMbb: BB(1),
    effectiveStackBeforeMbb: BB(100),
    isAllIn: spec.allIn === true,
    isFullRaise: spec.aggressive === true,
    isAggressive: spec.aggressive === true,
  };
}

interface QuerySpec {
  readonly hero: StrategyPosition;
  readonly actions?: readonly ActionSpec[];
  readonly folded?: readonly StrategyPosition[];
  readonly street?: StrategyStreet;
  readonly callAmountMbb?: MilliBB;
  readonly activeOpponentCount?: number;
}

function makeQuery(spec: QuerySpec): StrategyQuery {
  const folded = new Set(spec.folded ?? []);
  const seats = SIX_MAX.map((position) => seat(position, spec.hero, folded.has(position)));
  const actions = (spec.actions ?? []).map(action);
  return {
    street: spec.street ?? 'PREFLOP',
    board: [],
    dealtInCount: 6,
    positionsInHand: SIX_MAX,
    heroPosition: spec.hero,
    heroSeatIndex: ORDERS[spec.hero].preflop,
    heroCards: [],
    seats,
    effectiveStackMbb: BB(100),
    effectiveStackRemainingMbb: BB(100),
    stackBucket: {
      kind: 'BUCKET',
      bucket: {
        id: 'BB_80_119',
        minMbb: BB(80),
        maxExclusiveMbb: BB(120),
        minBB: 80,
        displayMaxBB: 119,
        label: '80-119 BB',
        isPrimary: true,
      },
      effectiveStackMbb: BB(100),
    },
    potBeforeDecisionMbb: BB(1.5),
    potTotalMbb: BB(1.5),
    currentBetMbb: BB(1),
    callAmountMbb: spec.callAmountMbb ?? BB(1),
    callToAmountMbb: BB(1),
    spr: null,
    potOdds: null,
    legalActions: {
      canFold: true,
      canCheck: false,
      call: null,
      wager: null,
      allIn: null,
      wagerBlockedReason: null,
    },
    actions,
    aggressionHistory: [],
    lastAggressorByStreet: { PREFLOP: null, FLOP: null, TURN: null, RIVER: null },
    activeOpponentCount: spec.activeOpponentCount ?? 6 - folded.size - 1,
    heroInPosition: false,
    environment: {
      smallBlindMbb: BB(0.5),
      bigBlindMbb: BB(1),
      minBetMbb: BB(1),
      anteEnabled: false,
      anteAmountMbb: Money.ZERO,
      deadMoneyMbb: Money.ZERO,
      rake: {
        numerator: 5,
        denominator: 100,
        capMbb: BB(3),
        quantumMbb: BB(0.01),
        triggerPolicy: 'NO_FLOP_NO_DROP',
        allocation: 'PROPORTIONAL',
      },
      feeTriggerPolicy: 'NEVER',
      feeCapMbb: Money.ZERO,
    },
  };
}

const raise = (position: StrategyPosition, toBB: number): ActionSpec => ({
  position,
  kind: 'RAISE',
  toAmountMbb: BB(toBB),
  aggressive: true,
});
const flat = (position: StrategyPosition): ActionSpec => ({
  position,
  kind: 'CALL',
  toAmountMbb: BB(1),
});
const drop = (position: StrategyPosition): ActionSpec => ({ position, kind: 'FOLD' });

describe('family matrix', () => {
  const cases: readonly (readonly [string, QuerySpec, string])[] = [
    ['first in', { hero: 'BTN', actions: [drop('UTG'), drop('HJ'), drop('CO')] }, 'RFI'],
    ['two limpers', { hero: 'BTN', actions: [flat('UTG'), flat('HJ'), drop('CO')] }, 'VS_LIMP'],
    [
      'single open',
      { hero: 'BTN', actions: [raise('UTG', 2.5), drop('HJ'), drop('CO')] },
      'VS_OPEN',
    ],
    [
      'iso-raise over a limper still counts as one open',
      { hero: 'BTN', actions: [flat('UTG'), raise('HJ', 4), drop('CO')] },
      'VS_OPEN',
    ],
    [
      'open plus cold caller, hero not yet in',
      { hero: 'BTN', actions: [raise('UTG', 2.5), flat('HJ'), drop('CO')] },
      'SQUEEZE',
    ],
    [
      'open plus cold caller, hero already in',
      { hero: 'UTG', actions: [flat('UTG'), raise('HJ', 3), flat('CO'), drop('BTN')] },
      'OPEN_PLUS_CALLER',
    ],
    [
      'hero opened, now faces a 3-bet',
      { hero: 'UTG', actions: [raise('UTG', 2.5), drop('HJ'), raise('CO', 8)] },
      'OPENER_VS_3BET',
    ],
    [
      'open and 3-bet in front, hero untouched',
      { hero: 'BTN', actions: [raise('UTG', 2.5), raise('HJ', 8), drop('CO')] },
      'COLD_4BET',
    ],
    [
      'hero 3-bet and faces a 4-bet',
      { hero: 'CO', actions: [raise('UTG', 2.5), raise('CO', 8), raise('UTG', 20)] },
      'VS_4BET',
    ],
    [
      'blind versus blind',
      {
        hero: 'BB',
        folded: ['UTG', 'HJ', 'CO', 'BTN'],
        actions: [drop('UTG'), drop('HJ'), drop('CO'), drop('BTN'), raise('SB', 3)],
      },
      'BLIND_VS_BLIND',
    ],
    [
      'facing a shove',
      {
        hero: 'BTN',
        actions: [
          { position: 'UTG', kind: 'ALL_IN', toAmountMbb: BB(100), aggressive: true, allIn: true },
          drop('HJ'),
          drop('CO'),
        ],
      },
      'VS_ALLIN',
    ],
  ];

  for (const [label, spec, expected] of cases) {
    it(`${label} -> ${expected}`, () => {
      const spot = classifyPreflopSpot(makeQuery(spec));
      expect(spot.kind).toBe('SPOT');
      if (spot.kind === 'SPOT') expect(spot.family).toBe(expected);
    });
  }
});

describe('unsupported lines', () => {
  it('refuses a query that is no longer preflop', () => {
    const spot = classifyPreflopSpot(makeQuery({ hero: 'BTN', street: 'FLOP' }));
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind === 'UNSUPPORTED') expect(spot.reason).toBe('NOT_PREFLOP');
  });

  it('refuses when hero has no live opponent', () => {
    const spot = classifyPreflopSpot(
      makeQuery({ hero: 'BTN', activeOpponentCount: 0, actions: [drop('UTG')] }),
    );
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind === 'UNSUPPORTED') expect(spot.reason).toBe('NO_ACTIVE_OPPONENT');
  });

  it('refuses when hero would be facing its own aggression', () => {
    const spot = classifyPreflopSpot(
      makeQuery({ hero: 'UTG', actions: [raise('UTG', 2.5), drop('HJ')] }),
    );
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind === 'UNSUPPORTED') expect(spot.reason).toBe('HERO_IS_CURRENT_AGGRESSOR');
  });

  it('but calls it OPEN_PLUS_CALLER when hero opened and someone called behind', () => {
    const spot = classifyPreflopSpot(
      makeQuery({ hero: 'UTG', actions: [raise('UTG', 2.5), flat('HJ'), drop('CO')] }),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind === 'SPOT') {
      expect(spot.family).toBe('OPEN_PLUS_CALLER');
      expect(spot.callerCount).toBe(1);
    }
  });

  it('refuses a cold 5-bet spot', () => {
    const spot = classifyPreflopSpot(
      makeQuery({
        hero: 'BTN',
        actions: [raise('UTG', 2.5), raise('HJ', 8), raise('CO', 20)],
      }),
    );
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind === 'UNSUPPORTED') expect(spot.reason).toBe('COLD_FIVE_BET');
  });

  it('refuses anything beyond a 4-bet', () => {
    const spot = classifyPreflopSpot(
      makeQuery({
        hero: 'BTN',
        actions: [raise('UTG', 2.5), raise('HJ', 8), raise('UTG', 20), raise('HJ', 50)],
      }),
    );
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind === 'UNSUPPORTED') {
      expect(spot.reason).toBe('BEYOND_FOUR_BET');
      expect(spot.raiseCount).toBe(4);
    }
  });

  it('refuses a caller who now faces a 3-bet', () => {
    const spot = classifyPreflopSpot(
      makeQuery({ hero: 'HJ', actions: [raise('UTG', 2.5), flat('HJ'), raise('CO', 9)] }),
    );
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind === 'UNSUPPORTED') expect(spot.reason).toBe('CALLER_FACING_THREE_BET');
  });
});

describe('reported detail', () => {
  it('counts limpers, cold callers and callers separately', () => {
    const spot = classifyPreflopSpot(
      makeQuery({
        hero: 'BTN',
        actions: [flat('UTG'), flat('HJ'), raise('CO', 5), flat('UTG')],
      }),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.limperCount).toBe(2);
    expect(spot.coldCallerCount).toBe(1);
    expect(spot.callerCount).toBe(1);
    expect(spot.openSizeMbb).toBe(BB(5));
    expect(spot.family).toBe('SQUEEZE');
  });

  it('reports hero as OOP when the aggressor acts later postflop', () => {
    const spot = classifyPreflopSpot(
      makeQuery({ hero: 'SB', actions: [drop('UTG'), drop('HJ'), raise('CO', 2.5), drop('BTN')] }),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind === 'SPOT') expect(spot.heroVsAggressor).toBe('OOP');
  });

  it('an all-in hero does not owe chips to is not VS_ALLIN', () => {
    const spot = classifyPreflopSpot(
      makeQuery({
        hero: 'BTN',
        callAmountMbb: Money.ZERO,
        actions: [
          { position: 'UTG', kind: 'ALL_IN', toAmountMbb: BB(100), aggressive: true, allIn: true },
          drop('HJ'),
        ],
      }),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind === 'SPOT') {
      expect(spot.facingAllIn).toBe(false);
      expect(spot.family).toBe('VS_OPEN');
    }
  });

  it('is deterministic', () => {
    const spec: QuerySpec = { hero: 'BTN', actions: [raise('UTG', 2.5), flat('HJ')] };
    expect(classifyPreflopSpot(makeQuery(spec))).toEqual(classifyPreflopSpot(makeQuery(spec)));
  });
});
