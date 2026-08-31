/**
 * TEST-ONLY builders for synthetic POSTFLOP `StrategyQuery` values.
 *
 * Not exported from `src/postflop/index.ts`, mirroring `preflop/testQuery.ts` and
 * `adapter/testHands.ts`. The postflop policy is a pure function of a `StrategyQuery`, so its
 * tests describe spots directly; the engine-backed coverage of the seam already lives in
 * `src/adapter/`.
 *
 * Nothing here encodes strategy. It builds legal-looking neutral queries only, and every money
 * value it computes goes through `Money` in integer milliBB (CLAUDE.md rule 1).
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
  StrategyStreet,
} from '../types.js';

export const BB = (bb: number): MilliBB => Money.fromBB(bb);

export const LADDERS: Readonly<Record<number, readonly StrategyPosition[]>> = {
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  2: ['SB', 'BB'],
};

export function ladderFor(dealtInCount: number): readonly StrategyPosition[] {
  const ladder = LADDERS[dealtInCount];
  invariant(ladder !== undefined, `no ladder for ${dealtInCount} dealt in`);
  return ladder;
}

/** SB acts first postflop, then BB, then the rest of the ladder in order. */
function postflopOrders(ladder: readonly StrategyPosition[]): Map<StrategyPosition, number> {
  const out = new Map<StrategyPosition, number>();
  let next = 0;
  for (const position of ['SB', 'BB'] as const) {
    if (ladder.includes(position)) out.set(position, next++);
  }
  for (const position of ladder) {
    if (!out.has(position)) out.set(position, next++);
  }
  return out;
}

export interface PostflopActionSpec {
  readonly street: StrategyStreet;
  readonly position: StrategyPosition;
  readonly kind: StrategyActionKind;
  /** The street contribution AFTER the action, in BB. Required for CALL / BET / RAISE / ALL_IN. */
  readonly toBB?: number;
  readonly allIn?: boolean;
}

export interface PostflopQuerySpec {
  readonly hero: StrategyPosition;
  readonly street: 'FLOP' | 'TURN' | 'RIVER';
  /** e.g. `'Ah7d2c'`. Must hold 3 / 4 / 5 cards for FLOP / TURN / RIVER. */
  readonly board: string;
  /** e.g. `'AsKd'`. */
  readonly heroCards: string;
  readonly dealtInCount?: number;
  /** Every voluntary action of the hand, in engine order, across all streets. */
  readonly actions?: readonly PostflopActionSpec[];
  readonly startingStackBB?: number;
  /**
   * Per-position starting stacks in BB, overriding `startingStackBB` for those seats. Needed for
   * any spot whose POINT is unequal stacks — a short shove with a deep player still to act, for
   * instance. Absent, every seat gets `startingStackBB` and nothing about a fixture moves.
   */
  readonly stacksBB?: Readonly<Partial<Record<StrategyPosition, number>>>;
  readonly anteEnabled?: boolean;
  readonly legalOverrides?: Partial<StrategyLegalActions>;
  readonly wagerMinToBB?: number;
  readonly wagerMaxToBB?: number;
  readonly noWager?: boolean;
  readonly wagerOnlyAllIn?: boolean;
}

const STREET_ORDER: readonly StrategyStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

function cardsOf(text: string): readonly Card[] {
  if (text.length === 0) return [];
  const parsed = parseCards(text);
  invariant(parsed.ok, `bad test cards "${text}"`);
  return parsed.value;
}

/**
 * Builds a coherent postflop `StrategyQuery`. Blinds are 0.5 / 1 BB.
 *
 * The replay is deliberately simple-minded but exact about the things the policy reads: per
 * street contributions, the pot, who folded, who is all in, the current bet, hero's price, and
 * the aggression history. Street contributions RESET at every street boundary, as they do in
 * the engine.
 */
export function makePostflopQuery(spec: PostflopQuerySpec): StrategyQuery {
  const dealtInCount = spec.dealtInCount ?? 6;
  const ladder = ladderFor(dealtInCount);
  invariant(ladder.includes(spec.hero), `${spec.hero} is not dealt in at ${dealtInCount}-handed`);
  const orders = postflopOrders(ladder);
  const startingStack = BB(spec.startingStackBB ?? 100);
  const stackOf = (position: StrategyPosition): MilliBB => {
    const override = spec.stacksBB?.[position];
    return override === undefined ? startingStack : BB(override);
  };
  const board = cardsOf(spec.board);
  const expectedBoard = spec.street === 'FLOP' ? 3 : spec.street === 'TURN' ? 4 : 5;
  invariant(board.length === expectedBoard, `the ${spec.street} needs ${expectedBoard} cards`);

  const streetContribution = new Map<StrategyPosition, MilliBB>();
  const totalContribution = new Map<StrategyPosition, MilliBB>();
  for (const position of ladder) {
    const blind = position === 'SB' ? BB(0.5) : position === 'BB' ? BB(1) : Money.ZERO;
    streetContribution.set(position, blind);
    totalContribution.set(position, blind);
  }
  const folded = new Set<StrategyPosition>();
  const allIn = new Set<StrategyPosition>();

  let currentStreet: StrategyStreet = 'PREFLOP';
  let currentBet: MilliBB = BB(1);
  let settledPot: MilliBB = Money.ZERO;

  const actions: StrategyActionRecord[] = [];
  const specs = spec.actions ?? [];
  specs.forEach((action, index) => {
    if (action.street !== currentStreet) {
      // Close the previous street: contributions fold into the settled pot and reset.
      settledPot = Money.add(settledPot, Money.sum([...streetContribution.values()]));
      for (const position of ladder) streetContribution.set(position, Money.ZERO);
      currentBet = Money.ZERO;
      currentStreet = action.street;
    }
    const before = streetContribution.get(action.position) ?? Money.ZERO;
    const to = action.toBB === undefined ? null : BB(action.toBB);
    const isAggressive =
      action.kind === 'BET' ||
      action.kind === 'RAISE' ||
      (action.kind === 'ALL_IN' && to !== null && to > currentBet);
    const potBefore = Money.add(settledPot, Money.sum([...streetContribution.values()]));
    if (to !== null) {
      streetContribution.set(action.position, to);
      totalContribution.set(
        action.position,
        Money.add(Money.sub(totalContribution.get(action.position) ?? Money.ZERO, before), to),
      );
    }
    if (action.kind === 'FOLD') folded.add(action.position);
    if (action.allIn === true || action.kind === 'ALL_IN') allIn.add(action.position);
    const currentBetBefore = currentBet;
    if (to !== null && to > currentBet) currentBet = to;
    actions.push({
      seq: index,
      street: action.street,
      position: action.position,
      kind: action.kind,
      toAmountMbb: to,
      amountMbb: to === null ? Money.ZERO : Money.sub(to, before),
      potBeforeMbb: potBefore,
      potAfterMbb: Money.add(settledPot, Money.sum([...streetContribution.values()])),
      currentBetBeforeMbb: currentBetBefore,
      effectiveStackBeforeMbb: stackOf(action.position),
      isAllIn: action.allIn === true || action.kind === 'ALL_IN',
      isFullRaise: isAggressive,
      isAggressive,
    });
  });

  // Close every street between the last action's street and the query's street.
  while (STREET_ORDER.indexOf(currentStreet) < STREET_ORDER.indexOf(spec.street)) {
    settledPot = Money.add(settledPot, Money.sum([...streetContribution.values()]));
    for (const position of ladder) streetContribution.set(position, Money.ZERO);
    currentBet = Money.ZERO;
    currentStreet = STREET_ORDER[STREET_ORDER.indexOf(currentStreet) + 1] ?? spec.street;
  }

  const seats: StrategySeatProfile[] = ladder.map((position, preflopOrder) => {
    const total = totalContribution.get(position) ?? Money.ZERO;
    return {
      position,
      seatIndex: preflopOrder,
      isHero: position === spec.hero,
      status: folded.has(position) ? 'FOLDED' : allIn.has(position) ? 'ALL_IN' : 'IN_HAND',
      startingStackMbb: stackOf(position),
      remainingStackMbb: Money.sub(stackOf(position), total),
      totalContributionMbb: total,
      streetContributionMbb: streetContribution.get(position) ?? Money.ZERO,
      deadContributionMbb: Money.ZERO,
      preflopOrder,
      postflopOrder: orders.get(position) ?? preflopOrder,
      isButton: position === 'BTN' || (dealtInCount === 2 && position === 'SB'),
      blindRole: position === 'SB' ? 'SB' : position === 'BB' ? 'BB' : null,
    };
  });

  const heroStreet = streetContribution.get(spec.hero) ?? Money.ZERO;
  const heroTotal = totalContribution.get(spec.hero) ?? Money.ZERO;
  const callAmount = Money.mbb(Math.max(0, currentBet - heroStreet));
  const potBeforeDecision = Money.add(settledPot, Money.sum([...streetContribution.values()]));
  const potTotal = potBeforeDecision;
  const heroRemaining = Money.sub(stackOf(spec.hero), heroTotal);

  const liveOpponents = seats.filter((seat) => !seat.isHero && seat.status !== 'FOLDED');
  // Identical to the old `startingStack` when every seat has the same stack, which is the
  // default; with `stacksBB` it is the effective stack the engine would report.
  const effectiveStack = Money.mbb(
    Math.min(
      stackOf(spec.hero),
      Math.max(0, ...liveOpponents.map((seat) => seat.startingStackMbb as number)),
    ),
  );
  const effectiveRemaining = Money.mbb(
    Math.min(
      heroRemaining,
      Math.max(0, ...liveOpponents.map((seat) => seat.remainingStackMbb as number)),
    ),
  );

  const minTo = Money.mbb(
    spec.wagerMinToBB === undefined
      ? Math.max(BB(1), currentBet === 0 ? BB(1) : currentBet * 2)
      : BB(spec.wagerMinToBB),
  );
  const maxTo =
    spec.wagerMaxToBB === undefined ? Money.add(heroStreet, heroRemaining) : BB(spec.wagerMaxToBB);

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
            kind: callAmount === 0 ? 'BET' : 'RAISE',
            minToAmountMbb: minTo,
            maxToAmountMbb: maxTo,
            minAdditionalMbb: Money.mbb(Math.max(0, minTo - heroStreet)),
            maxAdditionalMbb: Money.mbb(Math.max(0, maxTo - heroStreet)),
            onlyAllIn: spec.wagerOnlyAllIn === true,
          },
    allIn: {
      toAmountMbb: Money.add(heroStreet, heroRemaining),
      amountMbb: heroRemaining,
      effect: callAmount === 0 ? 'BET' : callAmount >= heroRemaining ? 'CALL' : 'RAISE',
    },
    wagerBlockedReason: spec.noWager === true ? 'TEST_NO_WAGER' : null,
    ...spec.legalOverrides,
  };

  const aggressionHistory = actions
    .filter((action) => action.isAggressive)
    .map((action) => ({
      street: action.street,
      position: action.position,
      seq: action.seq,
      toAmountMbb: action.toAmountMbb,
      isAllIn: action.isAllIn,
    }));
  const lastAggressorByStreet: Record<StrategyStreet, StrategyPosition | null> = {
    PREFLOP: null,
    FLOP: null,
    TURN: null,
    RIVER: null,
  };
  for (const aggression of aggressionHistory) {
    lastAggressorByStreet[aggression.street] = aggression.position;
  }

  const heroPostflop = orders.get(spec.hero) ?? 0;
  const heroInPosition = liveOpponents.every(
    (seat) => heroPostflop > (orders.get(seat.position) ?? 0),
  );

  return {
    street: spec.street,
    board,
    dealtInCount,
    positionsInHand: ladder,
    heroPosition: spec.hero,
    heroSeatIndex: ladder.indexOf(spec.hero),
    heroCards: cardsOf(spec.heroCards),
    seats,
    effectiveStackMbb: effectiveStack,
    effectiveStackRemainingMbb: effectiveRemaining,
    stackBucket: classifyStackBucket(effectiveStack),
    potBeforeDecisionMbb: potBeforeDecision,
    potTotalMbb: potTotal,
    currentBetMbb: currentBet,
    callAmountMbb: callAmount,
    callToAmountMbb: currentBet,
    spr: potTotal === 0 ? null : (effectiveRemaining as number) / (potTotal as number),
    potOdds: callAmount === 0 ? null : callAmount / (potBeforeDecision + callAmount),
    legalActions,
    actions,
    aggressionHistory,
    lastAggressorByStreet,
    activeOpponentCount: liveOpponents.length,
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

// Convenience action constructors -------------------------------------------------------

export const pfFold = (position: StrategyPosition): PostflopActionSpec => ({
  street: 'PREFLOP',
  position,
  kind: 'FOLD',
});
export const pfCall = (position: StrategyPosition, toBB: number): PostflopActionSpec => ({
  street: 'PREFLOP',
  position,
  kind: 'CALL',
  toBB,
});
export const pfRaise = (position: StrategyPosition, toBB: number): PostflopActionSpec => ({
  street: 'PREFLOP',
  position,
  kind: 'RAISE',
  toBB,
});

export const check = (street: StrategyStreet, position: StrategyPosition): PostflopActionSpec => ({
  street,
  position,
  kind: 'CHECK',
});
export const bet = (
  street: StrategyStreet,
  position: StrategyPosition,
  toBB: number,
): PostflopActionSpec => ({ street, position, kind: 'BET', toBB });
export const raise = (
  street: StrategyStreet,
  position: StrategyPosition,
  toBB: number,
): PostflopActionSpec => ({ street, position, kind: 'RAISE', toBB });
export const call = (
  street: StrategyStreet,
  position: StrategyPosition,
  toBB: number,
): PostflopActionSpec => ({ street, position, kind: 'CALL', toBB });
export const fold = (street: StrategyStreet, position: StrategyPosition): PostflopActionSpec => ({
  street,
  position,
  kind: 'FOLD',
});
export const shove = (
  street: StrategyStreet,
  position: StrategyPosition,
  toBB: number,
): PostflopActionSpec => ({ street, position, kind: 'ALL_IN', toBB, allIn: true });
