/**
 * TEST-ONLY builders for synthetic `StrategyQuery` values.
 *
 * Not exported from the package barrel, mirroring `src/adapter/testHands.ts`. The preflop
 * policy is a pure function of a `StrategyQuery`, so its tests describe spots directly rather
 * than driving the poker engine — the engine-backed coverage of the SAME spot families
 * already exists in `src/adapter/preflopSpot.test.ts`.
 *
 * Nothing here encodes strategy. It builds legal-looking neutral queries only.
 */
import { invariant, Money, parseCards, type Card, type MilliBB } from '@gto-self/shared';
import { classifyStackBucket } from '../stackBucket.js';
import type {
  StrategyActionKind,
  StrategyActionRecord,
  StrategyLegalActions,
  StrategyPosition,
  StrategyQuery,
  StrategySeatProfile,
} from '../types.js';

export const BB = (bb: number): MilliBB => Money.fromBB(bb);

/**
 * The seat ladder for each dealt-in count, in preflop order.
 *
 * HEADS-UP mirrors poker-core, not intuition: the button POSTS THE SMALL BLIND, acts FIRST
 * preflop and LAST postflop, and `rules.headsUpButtonLabel` decides whether that seat is
 * called `BTN` (the default, `config.ts:154`) or `SB`. The default ladder is therefore
 * `['BTN', 'BB']`; pass `headsUpButtonLabel: 'SB'` for the other setting.
 */
export const LADDERS: Readonly<Record<number, readonly StrategyPosition[]>> = {
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  2: ['BTN', 'BB'],
};

export function ladderFor(
  dealtInCount: number,
  headsUpButtonLabel: 'BTN' | 'SB' = 'BTN',
): readonly StrategyPosition[] {
  if (dealtInCount === 2) return [headsUpButtonLabel, 'BB'];
  const ladder = LADDERS[dealtInCount];
  invariant(ladder !== undefined, `no ladder for ${dealtInCount} dealt in`);
  return ladder;
}

/**
 * The blind each seat posts. Heads-up the BUTTON posts the small blind whatever it is
 * called, so the role cannot be read off the position name alone.
 */
function blindRoleOf(
  position: StrategyPosition,
  ladder: readonly StrategyPosition[],
): 'SB' | 'BB' | null {
  if (position === 'BB') return 'BB';
  if (ladder.length === 2) return 'SB';
  return position === 'SB' ? 'SB' : null;
}

/** The small blind acts first postflop, then the big blind, then the rest of the ladder. */
function postflopOrders(ladder: readonly StrategyPosition[]): Map<StrategyPosition, number> {
  const out = new Map<StrategyPosition, number>();
  let next = 0;
  for (const role of ['SB', 'BB'] as const) {
    for (const position of ladder) {
      if (!out.has(position) && blindRoleOf(position, ladder) === role) out.set(position, next++);
    }
  }
  for (const position of ladder) {
    if (!out.has(position)) out.set(position, next++);
  }
  return out;
}

export interface ActionSpec {
  readonly position: StrategyPosition;
  readonly kind: StrategyActionKind;
  /** Raise-TO in BB. Required for CALL / RAISE / ALL_IN. */
  readonly toBB?: number;
  readonly allIn?: boolean;
  /**
   * Did this aggression reach a FULL raise? The adapter derives it from the engine
   * (`isFullRaise`); a synthetic query has to state it, and the default — "every aggression
   * is a full raise" — is the ordinary case. Set it false to model a short all-in that raised
   * the price without reopening the betting.
   */
  readonly fullRaise?: boolean;
}

export interface QuerySpec {
  readonly hero: StrategyPosition;
  readonly dealtInCount?: number;
  readonly actions?: readonly ActionSpec[];
  /** e.g. `'AsKd'`. Empty string means "hero's holding not entered". */
  readonly heroCards?: string;
  readonly startingStackBB?: number;
  readonly anteEnabled?: boolean;
  /** Overrides for the legal-action mirror. Bounds are in milliBB. */
  readonly legalOverrides?: Partial<StrategyLegalActions>;
  readonly wagerMinToBB?: number;
  readonly wagerMaxToBB?: number;
  readonly noWager?: boolean;
  readonly wagerOnlyAllIn?: boolean;
  /** Heads-up only: which label poker-core gives the button seat. Default `'BTN'`. */
  readonly headsUpButtonLabel?: 'BTN' | 'SB';
}

function cardsOf(text: string): readonly Card[] {
  if (text.length === 0) return [];
  const parsed = parseCards(text);
  invariant(parsed.ok, `bad test cards "${text}"`);
  return parsed.value;
}

/** Builds a coherent preflop `StrategyQuery`. Blinds are 0.5 / 1 BB. */
export function makeQuery(spec: QuerySpec): StrategyQuery {
  const dealtInCount = spec.dealtInCount ?? 6;
  const ladder = ladderFor(dealtInCount, spec.headsUpButtonLabel ?? 'BTN');
  invariant(ladder.includes(spec.hero), `${spec.hero} is not dealt in at ${dealtInCount}-handed`);
  const orders = postflopOrders(ladder);
  const startingStack = BB(spec.startingStackBB ?? 100);

  const contributions = new Map<StrategyPosition, MilliBB>();
  for (const position of ladder) {
    const role = blindRoleOf(position, ladder);
    contributions.set(position, role === 'SB' ? BB(0.5) : role === 'BB' ? BB(1) : Money.ZERO);
  }
  const folded = new Set<StrategyPosition>();
  const allIn = new Set<StrategyPosition>();

  const specs = spec.actions ?? [];
  const actions: StrategyActionRecord[] = [];
  let currentBet: MilliBB = BB(1);
  specs.forEach((action, index) => {
    const before = contributions.get(action.position) ?? Money.ZERO;
    const to = action.toBB === undefined ? null : BB(action.toBB);
    const isAggressive =
      action.kind === 'BET' ||
      action.kind === 'RAISE' ||
      (action.kind === 'ALL_IN' && to !== null && to > currentBet);
    const potBefore = Money.sum([...contributions.values()]);
    if (to !== null) contributions.set(action.position, to);
    if (action.kind === 'FOLD') folded.add(action.position);
    if (action.allIn === true || action.kind === 'ALL_IN') allIn.add(action.position);
    if (to !== null && to > currentBet) currentBet = to;
    actions.push({
      seq: index,
      street: 'PREFLOP',
      position: action.position,
      kind: action.kind,
      toAmountMbb: to,
      amountMbb: to === null ? Money.ZERO : Money.sub(to, before),
      potBeforeMbb: potBefore,
      potAfterMbb: Money.sum([...contributions.values()]),
      currentBetBeforeMbb: currentBet,
      effectiveStackBeforeMbb: startingStack,
      isAllIn: action.allIn === true || action.kind === 'ALL_IN',
      isFullRaise: isAggressive && action.fullRaise !== false,
      isAggressive,
    });
  });

  const seats: StrategySeatProfile[] = ladder.map((position, preflopOrder) => {
    const contribution = contributions.get(position) ?? Money.ZERO;
    return {
      position,
      seatIndex: preflopOrder,
      isHero: position === spec.hero,
      status: folded.has(position) ? 'FOLDED' : allIn.has(position) ? 'ALL_IN' : 'IN_HAND',
      startingStackMbb: startingStack,
      remainingStackMbb: Money.sub(startingStack, contribution),
      totalContributionMbb: contribution,
      streetContributionMbb: contribution,
      deadContributionMbb: Money.ZERO,
      preflopOrder,
      postflopOrder: orders.get(position) ?? preflopOrder,
      isButton: dealtInCount === 2 ? preflopOrder === 0 : position === 'BTN',
      blindRole: blindRoleOf(position, ladder),
    };
  });

  const heroContribution = contributions.get(spec.hero) ?? Money.ZERO;
  const callAmount = Money.mbb(Math.max(0, currentBet - heroContribution));
  const pot = Money.sum([...contributions.values()]);
  const heroRemaining = Money.sub(startingStack, heroContribution);

  const minTo = spec.wagerMinToBB === undefined ? Money.mbb(currentBet * 2) : BB(spec.wagerMinToBB);
  const maxTo =
    spec.wagerMaxToBB === undefined
      ? Money.add(heroContribution, heroRemaining)
      : BB(spec.wagerMaxToBB);

  const legalActions: StrategyLegalActions = {
    canFold: true,
    canCheck: callAmount === 0,
    call:
      callAmount === 0
        ? null
        : {
            toAmountMbb: currentBet,
            amountMbb: callAmount,
            isAllIn: callAmount >= heroRemaining,
          },
    wager:
      spec.noWager === true
        ? null
        : {
            kind: 'RAISE',
            minToAmountMbb: minTo,
            maxToAmountMbb: maxTo,
            minAdditionalMbb: Money.mbb(Math.max(0, minTo - heroContribution)),
            maxAdditionalMbb: Money.mbb(Math.max(0, maxTo - heroContribution)),
            onlyAllIn: spec.wagerOnlyAllIn === true,
          },
    allIn: {
      toAmountMbb: Money.add(heroContribution, heroRemaining),
      amountMbb: heroRemaining,
      effect: callAmount >= heroRemaining ? 'CALL' : 'RAISE',
    },
    wagerBlockedReason: spec.noWager === true ? 'TEST_NO_WAGER' : null,
    ...spec.legalOverrides,
  };

  const activeOpponentCount = seats.filter(
    (seat) => !seat.isHero && seat.status !== 'FOLDED',
  ).length;

  const aggressionHistory = actions
    .filter((action) => action.isAggressive)
    .map((action) => ({
      street: action.street,
      position: action.position,
      seq: action.seq,
      toAmountMbb: action.toAmountMbb,
      isAllIn: action.isAllIn,
    }));
  const lastAggressor = aggressionHistory.at(-1)?.position ?? null;

  const heroPostflop = orders.get(spec.hero) ?? 0;
  const heroInPosition = seats
    .filter((seat) => !seat.isHero && seat.status !== 'FOLDED')
    .every((seat) => heroPostflop > (orders.get(seat.position) ?? 0));

  return {
    street: 'PREFLOP',
    board: [],
    dealtInCount,
    positionsInHand: ladder,
    heroPosition: spec.hero,
    heroSeatIndex: ladder.indexOf(spec.hero),
    heroCards: cardsOf(spec.heroCards ?? 'AsKd'),
    seats,
    effectiveStackMbb: startingStack,
    effectiveStackRemainingMbb: heroRemaining,
    stackBucket: classifyStackBucket(startingStack),
    potBeforeDecisionMbb: pot,
    potTotalMbb: pot,
    currentBetMbb: currentBet,
    callAmountMbb: callAmount,
    callToAmountMbb: currentBet,
    spr: pot === 0 ? null : heroRemaining / pot,
    potOdds: callAmount === 0 ? null : callAmount / (pot + callAmount),
    legalActions,
    actions,
    aggressionHistory,
    lastAggressorByStreet: { PREFLOP: lastAggressor, FLOP: null, TURN: null, RIVER: null },
    activeOpponentCount,
    heroInPosition,
    environment: {
      smallBlindMbb: BB(0.5),
      bigBlindMbb: BB(1),
      minBetMbb: BB(1),
      anteEnabled: spec.anteEnabled === true,
      anteAmountMbb: spec.anteEnabled === true ? BB(0.16) : Money.ZERO,
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

export const fold = (position: StrategyPosition): ActionSpec => ({ position, kind: 'FOLD' });
export const check = (position: StrategyPosition): ActionSpec => ({ position, kind: 'CHECK' });
export const call = (position: StrategyPosition, toBB: number): ActionSpec => ({
  position,
  kind: 'CALL',
  toBB,
});
export const raise = (position: StrategyPosition, toBB: number): ActionSpec => ({
  position,
  kind: 'RAISE',
  toBB,
});
export const shove = (position: StrategyPosition, toBB: number): ActionSpec => ({
  position,
  kind: 'ALL_IN',
  toBB,
  allIn: true,
});
