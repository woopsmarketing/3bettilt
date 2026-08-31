/**
 * THE SEAM. `docs/GTO_DESIGN_NOTES.md` note F: there is exactly one documented place where
 * poker state becomes a strategy query, and this is it.
 *
 * This directory is the ONLY part of `@gto-self/strategy-core` allowed to import
 * `@gto-self/poker-core` (enforced by the `packages/strategy-core/src/adapter/**` block in
 * `eslint.config.js`). Everything downstream consumes the neutral `StrategyQuery` in
 * `../types.ts` and can therefore never re-derive a poker rule: positions, legality, call
 * amounts, pots, SPR and pot odds are all read from the engine, never recomputed.
 *
 * Pure and deterministic: no clock, no ids, no I/O. Same `HandState` in, same query out.
 *
 * It REFUSES rather than guessing. Every refusal is a typed `StrategyError`:
 *
 *   NOT_A_DECISION_POINT   the hand is not in a betting phase — nobody is on the clock
 *   HERO_UNKNOWN           no hero seat on the state and none supplied
 *   HERO_NOT_DEALT_IN      the hero seat is not in this hand
 *   HERO_NOT_ACTOR         hero is in the hand but it is not hero's turn
 *   NO_LEGAL_ACTIONS       the engine offers hero no action (should follow from the above)
 *   UNSUPPORTED_LINEUP     fewer than 2 or more than 6 dealt-in seats
 *   POSITION_UNAVAILABLE   a dealt-in seat, or a past action, carries no position label
 *   UNSUPPORTED_ACTION_KIND a recorded action is not one of the six voluntary kinds
 *   INVALID_HERO_CARDS     hero's holding is entered but is not exactly two cards
 *   INVALID_BOARD          the board is not 0, 3, 4 or 5 cards
 *
 * A stack below the smallest bucket is NOT a refusal: it is carried as an `OUT_OF_RANGE`
 * stack bucket, because the query is still a truthful description of the spot.
 */
import { assertNever, Money, ok, type Card, type MilliBB } from '@gto-self/shared';
import {
  callAmount,
  callToAmount,
  contenders,
  effectiveStackFor,
  legalActions,
  potBeforeAction,
  potOdds,
  spr,
  type ActionRecord,
  type HandEventKind,
  type HandState,
  type Position,
  type SeatHandState,
  type SeatIndex,
  type SeatPosition,
  type Street,
} from '@gto-self/poker-core';
import { strategyErr, type StrategyResult } from '../errors.js';
import { classifyStackBucket } from '../stackBucket.js';
import type {
  StrategyActionKind,
  StrategyActionRecord,
  StrategyAggression,
  StrategyEnvironment,
  StrategyLegalActions,
  StrategyPosition,
  StrategyQuery,
  StrategySeatProfile,
  StrategySeatStatus,
  StrategyStreet,
} from '../types.js';

export interface BuildStrategyQueryOptions {
  /**
   * Overrides `state.heroSeat`. Supply it when analysing the spot from another seat's point
   * of view; the analysis is then honestly about that seat, not about hero.
   */
  readonly heroSeat?: SeatIndex;
}

/** Exhaustive by construction: adding a `Street` member fails to compile here. */
function mapStreet(street: Street): StrategyStreet {
  switch (street) {
    case 'PREFLOP':
      return 'PREFLOP';
    case 'FLOP':
      return 'FLOP';
    case 'TURN':
      return 'TURN';
    case 'RIVER':
      return 'RIVER';
    default:
      return assertNever(street, 'unknown street');
  }
}

/** Exhaustive by construction: adding a `Position` member fails to compile here. */
function mapPosition(position: Position): StrategyPosition {
  switch (position) {
    case 'UTG':
      return 'UTG';
    case 'HJ':
      return 'HJ';
    case 'CO':
      return 'CO';
    case 'BTN':
      return 'BTN';
    case 'SB':
      return 'SB';
    case 'BB':
      return 'BB';
    default:
      return assertNever(position, 'unknown position');
  }
}

/** `null` for any event kind that is not one of the six voluntary actions. */
function mapActionKind(kind: HandEventKind): StrategyActionKind | null {
  switch (kind) {
    case 'FOLD':
      return 'FOLD';
    case 'CHECK':
      return 'CHECK';
    case 'CALL':
      return 'CALL';
    case 'BET':
      return 'BET';
    case 'RAISE':
      return 'RAISE';
    case 'ALL_IN':
      return 'ALL_IN';
    default:
      return null;
  }
}

function mapSeatStatus(seat: SeatHandState): StrategySeatStatus | null {
  switch (seat.status) {
    case 'IN_HAND':
      return 'IN_HAND';
    case 'FOLDED':
      return 'FOLDED';
    case 'ALL_IN':
      return 'ALL_IN';
    case 'NOT_DEALT_IN':
      return null;
    default:
      return assertNever(seat.status, 'unknown seat status');
  }
}

/**
 * A `BET`/`RAISE` is aggression by definition. An `ALL_IN` is aggression exactly when it
 * raises the price — `toAmount > currentBetBefore` — which is the same test the engine's
 * `classifyWager` applies. Derived once here so no consumer re-derives it differently.
 */
function isAggressive(record: ActionRecord): boolean {
  if (record.kind === 'BET' || record.kind === 'RAISE') return true;
  if (record.kind !== 'ALL_IN') return false;
  return record.toAmount !== null && record.toAmount > record.currentBetBefore;
}

function mapLegalActions(actions: ReturnType<typeof legalActions>): StrategyLegalActions {
  return {
    canFold: actions.canFold,
    canCheck: actions.canCheck,
    call:
      actions.call === null
        ? null
        : {
            toAmountMbb: actions.call.toAmount,
            amountMbb: actions.call.amount,
            isAllIn: actions.call.isAllIn,
          },
    wager:
      actions.wager === null
        ? null
        : {
            kind: actions.wager.kind,
            minToAmountMbb: actions.wager.minToAmount,
            maxToAmountMbb: actions.wager.maxToAmount,
            minAdditionalMbb: actions.wager.minAdditional,
            maxAdditionalMbb: actions.wager.maxAdditional,
            onlyAllIn: actions.wager.onlyAllIn,
          },
    allIn:
      actions.allIn === null
        ? null
        : {
            toAmountMbb: actions.allIn.toAmount,
            amountMbb: actions.allIn.amount,
            effect: actions.allIn.effect,
          },
    wagerBlockedReason: actions.wagerBlockedBy,
  };
}

function mapEnvironment(state: HandState, deadMoneyMbb: MilliBB): StrategyEnvironment {
  const config = state.config;
  return {
    smallBlindMbb: config.blinds.smallBlind,
    bigBlindMbb: config.blinds.bigBlind,
    minBetMbb: config.minBet,
    anteEnabled: config.ante.enabled,
    anteAmountMbb: config.ante.amount,
    deadMoneyMbb,
    rake: {
      numerator: config.rake.numerator,
      denominator: config.rake.denominator,
      capMbb: config.rake.cap,
      quantumMbb: config.rake.quantum,
      triggerPolicy: config.rake.triggerPolicy,
      allocation: config.rake.allocation,
    },
    feeTriggerPolicy: config.fee.triggerPolicy,
    feeCapMbb: config.fee.cap,
  };
}

const VALID_BOARD_LENGTHS: readonly number[] = [0, 3, 4, 5];

/**
 * Result. Converts a poker-core `HandState` into the neutral `StrategyQuery`.
 *
 * `state` must be a hand where hero is on the clock; anything else is refused with one of
 * the codes documented at the top of this file.
 */
export function buildStrategyQuery(
  state: HandState,
  options: BuildStrategyQueryOptions = {},
): StrategyResult<StrategyQuery> {
  if (state.phase !== 'BETTING') {
    return strategyErr('NOT_A_DECISION_POINT', `No seat is on the clock (phase ${state.phase})`, {
      phase: state.phase,
    });
  }

  const heroSeat = options.heroSeat ?? state.heroSeat;
  if (heroSeat === null || heroSeat === undefined) {
    return strategyErr(
      'HERO_UNKNOWN',
      'No hero seat: the hand carries none and none was supplied',
      { field: 'heroSeat' },
    );
  }
  if (!state.dealtInSeats.includes(heroSeat)) {
    return strategyErr('HERO_NOT_DEALT_IN', `Seat ${heroSeat} is not dealt into this hand`, {
      seat: heroSeat,
    });
  }
  if (state.actorSeat !== heroSeat) {
    return strategyErr(
      'HERO_NOT_ACTOR',
      `Seat ${heroSeat} is not on the clock (actor is ${state.actorSeat ?? 'none'})`,
      { seat: heroSeat },
    );
  }

  const dealtInCount = state.dealtInSeats.length;
  if (dealtInCount < 2 || dealtInCount > 6) {
    return strategyErr('UNSUPPORTED_LINEUP', `${dealtInCount} dealt-in seats is not 2..6`, {
      actual: dealtInCount,
      min: 2,
      max: 6,
    });
  }

  const legal = legalActions(state, heroSeat);
  if (legal.seat === null) {
    return strategyErr('NO_LEGAL_ACTIONS', `The engine offers seat ${heroSeat} no action`, {
      seat: heroSeat,
    });
  }

  if (!VALID_BOARD_LENGTHS.includes(state.board.length)) {
    return strategyErr('INVALID_BOARD', `A board of ${state.board.length} cards is impossible`, {
      actual: state.board.length,
      expected: '0, 3, 4 or 5',
    });
  }

  const heroCards: readonly Card[] = state.seats[heroSeat].holeCards;
  if (heroCards.length !== 0 && heroCards.length !== 2) {
    return strategyErr(
      'INVALID_HERO_CARDS',
      `Hero holds ${heroCards.length} cards; expected none entered yet, or exactly two`,
      { seat: heroSeat, actual: heroCards.length, expected: '0 or 2' },
    );
  }

  // --- seats -------------------------------------------------------------
  const profiles: StrategySeatProfile[] = [];
  let deadMoney: MilliBB = Money.ZERO;
  for (const seat of state.dealtInSeats) {
    const seatPosition: SeatPosition | null = state.positions[seat];
    if (seatPosition === null) {
      return strategyErr('POSITION_UNAVAILABLE', `Seat ${seat} carries no position label`, {
        seat,
      });
    }
    const seatState = state.seats[seat];
    const status = mapSeatStatus(seatState);
    if (status === null) {
      return strategyErr(
        'UNSUPPORTED_LINEUP',
        `Seat ${seat} is listed as dealt in but its status is NOT_DEALT_IN`,
        { seat },
      );
    }
    deadMoney = Money.add(deadMoney, seatState.deadContribution);
    profiles.push({
      position: mapPosition(seatPosition.position),
      seatIndex: seat,
      isHero: seat === heroSeat,
      status,
      startingStackMbb: seatState.startingStack,
      remainingStackMbb: seatState.stack,
      totalContributionMbb: seatState.totalContribution,
      streetContributionMbb: seatState.streetContribution,
      deadContributionMbb: seatState.deadContribution,
      preflopOrder: seatPosition.preflopOrder,
      postflopOrder: seatPosition.postflopOrder,
      isButton: seatPosition.isButton,
      blindRole: seatPosition.blindRole,
    });
  }
  profiles.sort((a, b) => a.preflopOrder - b.preflopOrder);

  const heroProfile = profiles.find((profile) => profile.isHero);
  if (heroProfile === undefined) {
    return strategyErr('POSITION_UNAVAILABLE', `Hero seat ${heroSeat} produced no profile`, {
      seat: heroSeat,
    });
  }

  // --- action history ----------------------------------------------------
  const actions: StrategyActionRecord[] = [];
  const aggressionHistory: StrategyAggression[] = [];
  const lastAggressorByStreet: Record<StrategyStreet, StrategyPosition | null> = {
    PREFLOP: null,
    FLOP: null,
    TURN: null,
    RIVER: null,
  };
  for (const record of state.actions) {
    const kind = mapActionKind(record.kind);
    if (kind === null) {
      return strategyErr(
        'UNSUPPORTED_ACTION_KIND',
        `Action record ${record.seq} has kind ${record.kind}, which is not a voluntary action`,
        { index: record.seq, value: record.kind },
      );
    }
    if (record.position === null) {
      return strategyErr(
        'POSITION_UNAVAILABLE',
        `Action record ${record.seq} (seat ${record.seat}) carries no position label`,
        { index: record.seq, seat: record.seat },
      );
    }
    const street = mapStreet(record.street);
    const position = mapPosition(record.position);
    const aggressive = isAggressive(record);
    actions.push({
      seq: record.seq,
      street,
      position,
      kind,
      toAmountMbb: record.toAmount,
      amountMbb: record.amount,
      potBeforeMbb: record.potBefore,
      potAfterMbb: record.potAfter,
      currentBetBeforeMbb: record.currentBetBefore,
      effectiveStackBeforeMbb: record.effectiveStackBefore,
      isAllIn: record.isAllIn,
      isFullRaise: record.isFullRaise,
      isAggressive: aggressive,
    });
    if (aggressive) {
      aggressionHistory.push({
        street,
        position,
        seq: record.seq,
        toAmountMbb: record.toAmount,
        isAllIn: record.isAllIn,
      });
      lastAggressorByStreet[street] = position;
    }
  }

  // --- derived metrics ---------------------------------------------------
  const activeOpponents = contenders(state).filter((seat) => seat !== heroSeat);
  const heroPostflopOrder = heroProfile.postflopOrder;
  const opponentOrders = profiles
    .filter(
      (profile) => !profile.isHero && activeOpponents.includes(profile.seatIndex as SeatIndex),
    )
    .map((profile) => profile.postflopOrder);
  const heroInPosition = opponentOrders.every((order) => heroPostflopOrder > order);

  const effectiveStarting = effectiveStackFor(state, heroSeat, 'STARTING');

  const query: StrategyQuery = {
    street: mapStreet(state.street),
    board: [...state.board],
    dealtInCount,
    positionsInHand: profiles.map((profile) => profile.position),
    heroPosition: heroProfile.position,
    heroSeatIndex: heroSeat,
    heroCards: [...heroCards],
    seats: profiles,
    effectiveStackMbb: effectiveStarting,
    effectiveStackRemainingMbb: effectiveStackFor(state, heroSeat, 'REMAINING'),
    stackBucket: classifyStackBucket(effectiveStarting),
    potBeforeDecisionMbb: potBeforeAction(state),
    potTotalMbb: state.potTotal,
    currentBetMbb: state.round.currentBet,
    callAmountMbb: callAmount(state, heroSeat),
    callToAmountMbb: callToAmount(state, heroSeat),
    spr: spr(state, heroSeat),
    potOdds: potOdds(state, heroSeat),
    legalActions: mapLegalActions(legal),
    actions,
    aggressionHistory,
    lastAggressorByStreet,
    activeOpponentCount: activeOpponents.length,
    heroInPosition,
    environment: mapEnvironment(state, deadMoney),
  };
  return ok(query);
}
