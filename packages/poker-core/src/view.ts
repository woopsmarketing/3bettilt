/**
 * `toView(hand)` — the UI's single read model. A pure projection that introduces no rule
 * that is not already in `state` / `betting` / `metrics`.
 *
 * The actor lives INSIDE the phase union, so reading a call amount when nobody is on the
 * clock is a compile error and a raise slider always has its bounds.
 */
import { Money, ok, type Card, type HandId, type MilliBB, type PlayerId } from '@gto-self/shared';
import { callAmount, legalActions, type LegalActions } from './betting.js';
import type { TableConfig } from './config.js';
import { engineErr, type EngineResult } from './errors.js';
import type { Hand } from './hand.js';
import type { HandCommand } from './commands.js';
import { canUndo } from './hand.js';
import { deadCards, effectiveStackFor, potOdds, spr } from './metrics.js';
import type { Position } from './positions.js';
import { potAfterCall, potBeforeAction, unawardedPots, type Pot } from './pots.js';
import { allocateFee, resolveFee } from './fee.js';
import { allocateRake, computeRake } from './rake.js';
import { makeBySeat, type BySeat, type SeatIndex } from './seat.js';
import { handResult, sawFlop, type HandResult } from './settlement.js';
import { contenders, type ActionRecord, type HandState, type SeatStatus } from './state.js';
import { boardCardsForStreet, type PostflopStreet, type Street } from './street.js';

/**
 * Everything in the `docs/UX.md` raise-input preview and the strategy panel's ACTUAL
 * column, in one object.
 */
export interface ActorView {
  readonly seat: SeatIndex;
  readonly position: Position | null;
  readonly playerId: PlayerId | null;
  readonly stack: MilliBB;
  readonly streetContribution: MilliBB;
  readonly callAmount: MilliBB;
  readonly pot: MilliBB;
  readonly potIfCalls: MilliBB;
  readonly effectiveStack: MilliBB;
  readonly spr: number | null;
  readonly potOdds: number | null;
  readonly legal: LegalActions;
}

export interface AwardablePot {
  readonly index: number;
  readonly kind: 'MAIN' | 'SIDE';
  readonly amount: MilliBB;
  readonly eligibleSeats: readonly SeatIndex[];
  /** What the rake would be if all remaining pots were awarded now. Display only. */
  readonly projectedRake: MilliBB;
  /**
   * What the fee would be if all remaining pots were awarded now, with NOTHING supplied.
   * Display only, and it is ZERO under every shipped `fee.triggerPolicy`: there is no
   * automatic fee, so no fee exists until an `AWARD_POTS` command carries an observed
   * one (ADR-0032). Computed through the real allocator rather than written as a
   * constant, so a future automatic trigger needs no new field here.
   */
  readonly projectedFee: MilliBB;
  readonly awarded: boolean;
}

export type ViewPhase =
  | { readonly kind: 'SETUP' }
  | { readonly kind: 'AWAITING_ACTION'; readonly actor: ActorView }
  | {
      readonly kind: 'AWAITING_BOARD';
      readonly street: PostflopStreet;
      readonly cardsNeeded: 1 | 3;
    }
  | { readonly kind: 'AWAITING_AWARD'; readonly pots: readonly AwardablePot[] }
  | { readonly kind: 'COMPLETE'; readonly result: HandResult };

export interface SeatView {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly position: Position | null;
  readonly status: SeatStatus;
  readonly stack: MilliBB;
  readonly startingStack: MilliBB;
  readonly streetContribution: MilliBB;
  readonly totalContribution: MilliBB;
  readonly holeCards: readonly Card[];
  readonly isButton: boolean;
  /**
   * Heads-up, the button seat has `isButton` and `isSmallBlind` both true while
   * `position` is whatever `rules.headsUpButtonLabel` says.
   */
  readonly isSmallBlind: boolean;
  readonly isBigBlind: boolean;
  readonly isHero: boolean;
  readonly isActor: boolean;
  readonly lastAction: ActionRecord | null;
}

export interface HandView {
  readonly handId: HandId;
  readonly handNumber: number;
  readonly config: TableConfig;
  readonly phase: ViewPhase;
  readonly street: Street;
  readonly board: readonly Card[];
  readonly seats: BySeat<SeatView>;
  readonly buttonSeat: SeatIndex;
  readonly smallBlindSeat: SeatIndex;
  readonly bigBlindSeat: SeatIndex;
  readonly dealtInSeats: readonly SeatIndex[];
  readonly contenderSeats: readonly SeatIndex[];
  readonly pot: MilliBB;
  readonly pots: readonly Pot[];
  readonly currentBet: MilliBB;
  readonly fullRaiseCount: number;
  readonly lastAggressorSeat: SeatIndex | null;
  readonly deadCards: readonly Card[];
  readonly actions: readonly ActionRecord[];
  readonly canUndo: boolean;
  readonly result: HandResult | null;
}

function actorView(state: HandState, seat: SeatIndex): ActorView {
  const s = state.seats[seat];
  return {
    seat,
    position: state.positions[seat]?.position ?? null,
    playerId: s.playerId,
    stack: s.stack,
    streetContribution: s.streetContribution,
    callAmount: callAmount(state, seat),
    pot: potBeforeAction(state),
    potIfCalls: potAfterCall(state, seat),
    effectiveStack: effectiveStackFor(state, seat, 'REMAINING'),
    spr: spr(state, seat),
    potOdds: potOdds(state, seat),
    legal: legalActions(state, seat),
  };
}

/**
 * Internal. Rake and fee each remaining pot would bear if every one were awarded right
 * now with no fee supplied. Uses the settlement path's own functions, so the preview
 * cannot drift from the award.
 */
function awardablePots(state: HandState): readonly AwardablePot[] {
  const pending = unawardedPots(state);
  const gross = Money.sum(pending.map((pot) => pot.amount));
  const rake = computeRake(gross, state.config.rake, {
    sawFlop: sawFlop(state),
    contenderCount: contenders(state).length,
  }).rake;
  const rakeShares =
    pending.length === 0 ? [] : allocateRake(pending, rake, state.config.rake.allocation);
  const fee = resolveFee(null, state.config.fee, { gross, rake });
  const feeTotal = fee.ok ? fee.value : Money.ZERO;
  const feeShares =
    pending.length === 0
      ? []
      : allocateFee(pending, rakeShares, feeTotal, state.config.fee.allocation);
  const projectedRake = new Map<number, MilliBB>();
  const projectedFee = new Map<number, MilliBB>();
  pending.forEach((pot, index) => {
    projectedRake.set(pot.index, rakeShares[index] ?? Money.ZERO);
    projectedFee.set(pot.index, feeShares[index] ?? Money.ZERO);
  });
  return state.pots.map((pot) => ({
    index: pot.index,
    kind: pot.kind,
    amount: pot.amount,
    eligibleSeats: pot.eligibleSeats,
    projectedRake: projectedRake.get(pot.index) ?? Money.ZERO,
    projectedFee: projectedFee.get(pot.index) ?? Money.ZERO,
    awarded: pot.awarded,
  }));
}

function viewPhase(state: HandState): ViewPhase {
  switch (state.phase) {
    case 'SETUP':
      return { kind: 'SETUP' };
    case 'BETTING': {
      const seat = state.actorSeat;
      if (seat === null) return { kind: 'SETUP' };
      return { kind: 'AWAITING_ACTION', actor: actorView(state, seat) };
    }
    case 'AWAITING_BOARD': {
      const street = state.pendingStreet;
      if (street === null || street === 'PREFLOP') {
        return { kind: 'AWAITING_AWARD', pots: awardablePots(state) };
      }
      const needed = boardCardsForStreet(street);
      return {
        kind: 'AWAITING_BOARD',
        street,
        cardsNeeded: needed === 3 ? 3 : 1,
      };
    }
    // Transient: one `applyCommand` drains it, so the UI never observes it. It is
    // projected as AWAITING_AWARD because the pots it shows are real and unawarded.
    case 'AWAITING_UNCALLED_RETURN':
    case 'AWAITING_AWARD':
      return { kind: 'AWAITING_AWARD', pots: awardablePots(state) };
    case 'COMPLETE': {
      const result = handResult(state);
      if (result === null) return { kind: 'SETUP' };
      return { kind: 'COMPLETE', result };
    }
  }
}

/** Total. Pure and memoizable on `hand`. The UI's only read function. */
export function toView(hand: Hand): HandView {
  const state = hand.state;
  const lastActionBySeat = new Map<SeatIndex, ActionRecord>();
  for (const record of state.actions) {
    if (record.street === state.street) lastActionBySeat.set(record.seat, record);
  }

  return {
    handId: state.handId,
    handNumber: state.handNumber,
    config: state.config,
    phase: viewPhase(state),
    street: state.street,
    board: state.board,
    seats: makeBySeat<SeatView>((seat) => {
      const s = state.seats[seat];
      return {
        seat,
        playerId: s.playerId,
        position: state.positions[seat]?.position ?? null,
        status: s.status,
        stack: s.stack,
        startingStack: s.startingStack,
        streetContribution: s.streetContribution,
        totalContribution: s.totalContribution,
        holeCards: s.holeCards,
        isButton: state.dealtInSeats.includes(seat) && seat === state.blinds.buttonSeat,
        isSmallBlind: state.dealtInSeats.includes(seat) && seat === state.blinds.smallBlindSeat,
        isBigBlind: state.dealtInSeats.includes(seat) && seat === state.blinds.bigBlindSeat,
        isHero: seat === state.heroSeat,
        isActor: seat === state.actorSeat,
        lastAction: lastActionBySeat.get(seat) ?? null,
      };
    }),
    buttonSeat: state.blinds.buttonSeat,
    smallBlindSeat: state.blinds.smallBlindSeat,
    bigBlindSeat: state.blinds.bigBlindSeat,
    dealtInSeats: state.dealtInSeats,
    contenderSeats: contenders(state),
    pot: state.potTotal,
    pots: state.pots,
    currentBet: state.round.currentBet,
    fullRaiseCount: state.round.fullRaiseCount,
    lastAggressorSeat: state.round.lastAggressorSeat,
    deadCards: deadCards(state),
    actions: state.actions,
    canUndo: canUndo(hand),
    result: handResult(state),
  };
}

/**
 * Result. Picks BET or RAISE from the actor's `LegalActions`, so the `R` key handler is
 * one line and the UI never has to know the difference. The parser keeps using the
 * explicit verbs so a mismatch with the hand history is caught.
 */
export function wagerCommand(view: HandView, toAmount: MilliBB): EngineResult<HandCommand> {
  if (view.phase.kind !== 'AWAITING_ACTION') {
    return engineErr('NOT_BETTING_PHASE', 'No seat is on the clock');
  }
  const actor = view.phase.actor;
  const wager = actor.legal.wager;
  if (wager === null) {
    const code = actor.legal.wagerBlockedBy ?? 'RAISE_NOT_ALLOWED';
    return engineErr(code, 'This seat cannot bet or raise right now', { seat: actor.seat });
  }
  return ok({ kind: wager.kind, toAmount, seat: actor.seat });
}
