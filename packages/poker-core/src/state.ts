/**
 * `HandState` — the fold of a hand's event log. Every field is DERIVED from the events;
 * nothing here is authored directly except through `applyEvent`.
 */
import { Money, type Card, type HandId, type MilliBB, type PlayerId } from '@gto-self/shared';
import type { TableConfig } from './config.js';
import type { HandEndReason, HandEventKind, PotShare } from './events.js';
import type {
  BlindAssignment,
  BlindSeatOverride,
  Position,
  PositionMap,
} from './positions.js';
import type { Pot } from './pots.js';
import { orderClockwise, type BySeat, type SeatIndex } from './seat.js';
import type { Street } from './street.js';

export type SeatStatus = 'NOT_DEALT_IN' | 'IN_HAND' | 'FOLDED' | 'ALL_IN';

/**
 * SETUP                    inside command group 0 while the roster accumulates
 * BETTING                  a seat is on the clock (`actorSeat` non-null)
 * AWAITING_UNCALLED_RETURN a round closed with an unmatched excess; transient
 * AWAITING_BOARD           the palette must supply `pendingStreet`'s cards
 * AWAITING_AWARD           two or more contenders; the winner is an INPUT in Phase 1
 * COMPLETE                 every pot awarded, HAND_FINISHED applied
 */
export type HandPhase =
  | 'SETUP'
  | 'BETTING'
  | 'AWAITING_UNCALLED_RETURN'
  | 'AWAITING_BOARD'
  | 'AWAITING_AWARD'
  | 'COMPLETE';

export interface SeatHandState {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly status: SeatStatus;
  /** ACTUAL stack when the hand was dealt. */
  readonly startingStack: MilliBB;
  /**
   * Chips still behind. `status === 'ALL_IN'` iff the seat has committed its whole
   * `startingStack` (`totalContribution === startingStack`) and has not folded — which
   * is the same as "this is ZERO" for the entire hand, and stops being the same only at
   * settlement, where `POT_AWARDED` credits a winner's stack without un-committing
   * anything. `RETURN_UNCALLED` is the converse: it lowers `totalContribution` and
   * therefore returns the seat to `IN_HAND`.
   */
  readonly stack: MilliBB;
  /** Live wager on the CURRENT street. Equals `contributionByStreet[state.street]`. */
  readonly streetContribution: MilliBB;
  /** Antes and dead blinds this hand. Dead money: never counts toward a call. */
  readonly deadContribution: MilliBB;
  /**
   * `deadContribution` + every street's live contribution, net of RETURN_UNCALLED.
   * The side-pot layering basis.
   */
  readonly totalContribution: MilliBB;
  readonly contributionByStreet: Readonly<Record<Street, MilliBB>>;
  readonly holeCards: readonly Card[];
  readonly holeCardsRevealed: boolean;
  /**
   * null  = has not voluntarily acted in the current betting round.
   * else  = `round.fullRaiseCount` at the moment this seat last acted.
   * `mayReopen(seat) === (value === null || value < round.fullRaiseCount)`.
   * Blind and ante posts leave it null — that is the big blind's option. A short
   * all-in does not increment `fullRaiseCount` — that is the no-reopen rule.
   */
  readonly actedAtFullRaiseCount: number | null;
  readonly lastAction: HandEventKind | null;
  readonly returnedUncalled: MilliBB;
  /** Every pot share this seat won, BEFORE its rake and fee attribution. */
  readonly wonGross: MilliBB;
  readonly rakePaid: MilliBB;
  /** Splash fee attributed to this seat. Recorded separately from `rakePaid` (ADR-0032). */
  readonly feePaid: MilliBB;
}

export interface BettingRound {
  readonly street: Street;
  /** The live street contribution a seat must match to continue. */
  readonly currentBet: MilliBB;
  /**
   * Delta required to make a FULL raise. Seeded to bigBlind preflop / minBet postflop;
   * updated ONLY by a full bet or raise.
   */
  readonly lastFullRaiseSize: MilliBB;
  /**
   * Bet level established by the last FULL bet/raise. Preflop seeded to the nominal
   * big blind. Used only by `shortAllInMinRaiseBasis === 'LAST_FULL_RAISE'`.
   */
  readonly lastFullRaiseTo: MilliBB;
  /**
   * Increments ONLY on a full bet/raise. Preflop starts at 1 (the BB is the bring-in),
   * postflop at 0. The reopening clock.
   */
  readonly fullRaiseCount: number;
  readonly lastAggressorSeat: SeatIndex | null;
  readonly lastActedSeat: SeatIndex | null;
  /**
   * This street's action order over dealt-in seats. Turn-taking is index arithmetic
   * over this array — never Set/Map iteration.
   */
  readonly actionOrder: readonly SeatIndex[];
  readonly closed: boolean;
}

export interface UncalledReturn {
  readonly seat: SeatIndex;
  readonly amount: MilliBB;
}

export interface PotAwardRecord {
  readonly potIndex: number;
  readonly winners: readonly SeatIndex[];
  readonly grossAmount: MilliBB;
  readonly rake: MilliBB;
  /** ZERO when no fee applies. `netAmount === grossAmount - rake - fee`. */
  readonly fee: MilliBB;
  readonly netAmount: MilliBB;
  readonly shares: readonly PotShare[];
}

/**
 * The fold-maintained action projection. Exists because ARCHITECTURE.md's matching
 * priority needs exact action-tree structure (#4) and postflop sizing as a fraction of
 * the pot BEFORE the action (#7). Computed once here so gto-core never re-derives it.
 * poker-core supplies the raw numbers and deliberately picks no sizing convention.
 */
export interface ActionRecord {
  readonly seq: number;
  readonly commandSeq: number;
  readonly street: Street;
  readonly seat: SeatIndex;
  readonly position: Position | null;
  readonly kind: HandEventKind;
  readonly toAmount: MilliBB | null;
  readonly amount: MilliBB;
  readonly isAllIn: boolean;
  readonly isFullRaise: boolean;
  readonly currentBetBefore: MilliBB;
  readonly fullRaiseCountAfter: number;
  readonly potBefore: MilliBB;
  readonly potAfter: MilliBB;
  readonly effectiveStackBefore: MilliBB;
}

export interface HandState {
  readonly handId: HandId;
  readonly handNumber: number;
  readonly config: TableConfig;
  readonly buttonSeat: SeatIndex;
  readonly heroSeat: SeatIndex | null;
  readonly blinds: BlindAssignment;
  /**
   * The manual SB/BB assignment carried on `HAND_STARTED`, or `null` for the ordinary
   * rotation. Held on the state because `finalizeRoster` runs `assignBlinds` lazily,
   * once the roster is complete, and must reach the same `blinds` on every replay.
   */
  readonly blindOverride: BlindSeatOverride | null;
  /** Ascending physical seat order. Fixed once the roster is finalized. */
  readonly dealtInSeats: readonly SeatIndex[];
  readonly positions: PositionMap;
  readonly seats: BySeat<SeatHandState>;

  readonly street: Street;
  /** length is always 0, 3, 4 or 5 (invariant). */
  readonly board: readonly Card[];
  readonly phase: HandPhase;
  readonly round: BettingRound;
  /** Non-null exactly when `phase === 'BETTING'`. */
  readonly actorSeat: SeatIndex | null;
  /** Non-null exactly when `phase === 'AWAITING_UNCALLED_RETURN'`. */
  readonly pendingUncalled: UncalledReturn | null;
  /** Non-null exactly when `phase === 'AWAITING_BOARD'`. */
  readonly pendingStreet: Street | null;

  /**
   * Always a LIST with eligible-player sets. Rebuilt from `totalContribution` on every
   * event, so it can never drift. Length 1 in the ordinary hand.
   */
  readonly pots: readonly Pot[];
  /** `Money.sum` of pot amounts === `Money.sum` of totalContributions (asserted). */
  readonly potTotal: MilliBB;
  readonly awards: readonly PotAwardRecord[];
  readonly totalRake: MilliBB;
  /** Summed splash fee across every award. Never merged into `totalRake` (ADR-0032). */
  readonly totalFees: MilliBB;
  readonly endReason: HandEndReason | null;

  readonly actions: readonly ActionRecord[];
  readonly eventCount: number;
  readonly commandCount: number;
}

export const ZERO_BY_STREET: Readonly<Record<Street, MilliBB>> = {
  PREFLOP: Money.ZERO,
  FLOP: Money.ZERO,
  TURN: Money.ZERO,
  RIVER: Money.ZERO,
};

/** Total. A seat that is not in the hand: no player, no chips, no contributions. */
export function emptySeatHandState(seat: SeatIndex): SeatHandState {
  return {
    seat,
    playerId: null,
    status: 'NOT_DEALT_IN',
    startingStack: Money.ZERO,
    stack: Money.ZERO,
    streetContribution: Money.ZERO,
    deadContribution: Money.ZERO,
    totalContribution: Money.ZERO,
    contributionByStreet: ZERO_BY_STREET,
    holeCards: [],
    holeCardsRevealed: false,
    actedAtFullRaiseCount: null,
    lastAction: null,
    returnedUncalled: Money.ZERO,
    wonGross: Money.ZERO,
    rakePaid: Money.ZERO,
    feePaid: Money.ZERO,
  };
}

/** Total. The per-seat hand state. `BySeat` lookups are total under ADR-0005. */
export function seatState(state: HandState, seat: SeatIndex): SeatHandState {
  return state.seats[seat];
}

/** Total. A seat still contesting the pot: IN_HAND or ALL_IN. */
export function isContender(seat: SeatHandState): boolean {
  return seat.status === 'IN_HAND' || seat.status === 'ALL_IN';
}

/** Total. Contending seats in ring order starting left of the button. */
export function contenders(state: HandState): readonly SeatIndex[] {
  const live = state.dealtInSeats.filter((seat) => isContender(state.seats[seat]));
  return orderClockwise(live, state.buttonSeat, false);
}

/**
 * Total. Contenders with chips behind (`status === 'IN_HAND'`), in ring order.
 * Fewer than two means no new betting can open; this is the structural handler for
 * "all-in players are skipped on later streets".
 */
export function seatsAbleToAct(state: HandState): readonly SeatIndex[] {
  const live = state.dealtInSeats.filter((seat) => state.seats[seat].status === 'IN_HAND');
  return orderClockwise(live, state.buttonSeat, false);
}
