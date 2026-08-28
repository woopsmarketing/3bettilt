/**
 * Turn order, round closure, call amounts, minimum/maximum raise-TO and action legality.
 *
 * Raise-TO semantics everywhere (`docs/UX.md`): a wager's `toAmount` is the seat's
 * street contribution AFTER the action.
 */
import { Money, ok, type MilliBB } from '@gto-self/shared';
import { engineErr, type EngineErrorCode, type EngineResult } from './errors.js';
import type { SeatIndex } from './seat.js';
import { seatsAbleToAct, type HandState } from './state.js';

export interface CallOption {
  readonly toAmount: MilliBB;
  readonly amount: MilliBB;
  readonly isAllIn: boolean;
}

export interface WagerOption {
  readonly kind: 'BET' | 'RAISE';
  readonly minToAmount: MilliBB;
  readonly maxToAmount: MilliBB;
  readonly minAdditional: MilliBB;
  readonly maxAdditional: MilliBB;
  /**
   * true when `minToAmount === maxToAmount ===` the seat's all-in level, i.e. the only
   * legal aggression is a short all-in. The UX renders "Raise" as "All-in".
   */
  readonly onlyAllIn: boolean;
}

export interface AllInOption {
  readonly toAmount: MilliBB;
  readonly amount: MilliBB;
  /** What the shove functions as. Derived, never stored on the event. */
  readonly effect: 'CALL' | 'BET' | 'RAISE';
  readonly isFullRaise: boolean;
}

export interface LegalActions {
  readonly seat: SeatIndex | null;
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly call: CallOption | null;
  readonly wager: WagerOption | null;
  readonly allIn: AllInOption | null;
  /**
   * Populated when `wager` is null, so the UI can label the disabled control honestly:
   * 'RAISE_NOT_REOPENED' | 'NO_OPPONENT_CAN_RESPOND' | 'INSUFFICIENT_STACK'.
   */
  readonly wagerBlockedBy: EngineErrorCode | null;
}

export interface WagerClassification {
  readonly effect: 'CALL' | 'BET' | 'RAISE';
  readonly amount: MilliBB;
  readonly isAllIn: boolean;
  readonly isFullRaise: boolean;
}

const NO_ACTIONS: LegalActions = {
  seat: null,
  canFold: false,
  canCheck: false,
  call: null,
  wager: null,
  allIn: null,
  wagerBlockedBy: null,
};

/**
 * Total. The highest CURRENT-STREET contribution among the seats that can still win the
 * pot, EXCLUDING `seat` itself. Folded seats are excluded: their chips are dead money in
 * the pot and can never demand a response.
 *
 * This — not `round.currentBet` — is what makes an action MANDATORY. The two agree
 * everywhere except under `rules.shortBlindSetsFullLevel`, where `seedPreflopRound` sets
 * `currentBet` to the NOMINAL big blind even though no opponent could post it; see
 * `mustAct`.
 */
export function highestOpposingContribution(state: HandState, seat: SeatIndex): MilliBB {
  let highest = Money.ZERO;
  for (const other of state.dealtInSeats) {
    if (other === seat) continue;
    const s = state.seats[other];
    if (s.status === 'FOLDED') continue;
    highest = Money.max(highest, s.streetContribution);
  }
  return highest;
}

/**
 * Total. A seat still owes the round an action:
 * `IN_HAND && (streetContribution < highestOpposingContribution
 *              || (never acted && >= 2 seats able to act))`.
 *
 * Clause 1 tests a REAL obligation — money a live opponent actually wagered — and not
 * `round.currentBet`. The distinction only bites under `rules.shortBlindSetsFullLevel`
 * (spec 7.5), where a big blind who cannot cover the blind still sets `currentBet` to the
 * nominal 1 BB. Keying off `currentBet` there puts a seat on the clock that has already
 * matched every opponent and that nobody can raise: folding would forfeit chips no poker
 * rule can take, and calling would write a `CALL` into `state.actions` for an action that
 * never happened. `callAmount`/`fullCallAmount` deliberately stay keyed to `currentBet`,
 * so the nominal 1 BB price of entry is unchanged for the seats that genuinely face
 * action. See spec 7.6 and assumption 6.
 *
 * `rules.bigBlindHasOption === false` is the one carve-out: preflop, the big blind's
 * blind post then counts as its action.
 */
export function mustAct(state: HandState, seat: SeatIndex): boolean {
  const s = state.seats[seat];
  if (s.status !== 'IN_HAND') return false;
  if (s.streetContribution < highestOpposingContribution(state, seat)) return true;
  if (s.actedAtFullRaiseCount !== null) return false;
  if (
    !state.config.rules.bigBlindHasOption &&
    state.street === 'PREFLOP' &&
    seat === state.blinds.bigBlindSeat
  ) {
    return false;
  }
  return seatsAbleToAct(state).length >= 2;
}

/**
 * Total. THE reopening rule, stated once:
 * `actedAtFullRaiseCount === null || actedAtFullRaiseCount < round.fullRaiseCount`.
 */
export function mayReopen(state: HandState, seat: SeatIndex): boolean {
  const acted = state.seats[seat].actedAtFullRaiseCount;
  return acted === null || acted < state.round.fullRaiseCount;
}

/**
 * Total. `mayReopen` && (some OTHER contender has chips behind ||
 * `rules.allowRaiseWithNoCaller`) && `stack > 0`.
 */
export function mayAggress(state: HandState, seat: SeatIndex): boolean {
  return aggressionBlocker(state, seat) === null;
}

/** Internal: which of the three aggression preconditions fails first, or null. */
function aggressionBlocker(state: HandState, seat: SeatIndex): EngineErrorCode | null {
  if (!mayReopen(state, seat)) return 'RAISE_NOT_REOPENED';
  const others = seatsAbleToAct(state).filter((other) => other !== seat);
  if (others.length === 0 && !state.config.rules.allowRaiseWithNoCaller) {
    return 'NO_OPPONENT_CAN_RESPOND';
  }
  if (Money.isZero(state.seats[seat].stack)) return 'SEAT_ALL_IN';
  return null;
}

/** Total. Every dealt-in seat that still owes the round an action, in seat order. */
export function seatsThatMustAct(state: HandState): readonly SeatIndex[] {
  return state.dealtInSeats.filter((seat) => mustAct(state, seat));
}

/** Total. True when no dealt-in seat satisfies `mustAct`. */
export function isBettingRoundClosed(state: HandState): boolean {
  return seatsThatMustAct(state).length === 0;
}

/**
 * Total. Walks `round.actionOrder` from one past `round.lastActedSeat` (index 0 when
 * null) and returns the first seat where `mustAct` holds; null when the round is closed.
 * Pure index arithmetic over an array — never Set/Map iteration.
 */
export function nextActor(state: HandState): SeatIndex | null {
  const order = state.round.actionOrder;
  if (order.length === 0) return null;
  const last = state.round.lastActedSeat;
  const from = last === null ? 0 : order.indexOf(last) + 1;
  for (let step = 0; step < order.length; step += 1) {
    const seat = order[(from + step) % order.length];
    if (seat !== undefined && mustAct(state, seat)) return seat;
  }
  return null;
}

/**
 * Total. `Money.min(currentBet - streetContribution, stack)` — clamped, so a short call
 * needs no special case anywhere else. ZERO when facing no bet.
 */
export function callAmount(state: HandState, seat: SeatIndex): MilliBB {
  const s = state.seats[seat];
  const owed = Money.sub(state.round.currentBet, s.streetContribution);
  if (owed <= 0) return Money.ZERO;
  return Money.min(owed, s.stack);
}

/**
 * Total. Unclamped requirement, so the UI can show
 * "call 12 BB (all-in for 4.3 BB)".
 */
export function fullCallAmount(state: HandState, seat: SeatIndex): MilliBB {
  const owed = Money.sub(state.round.currentBet, state.seats[seat].streetContribution);
  return owed <= 0 ? Money.ZERO : owed;
}

/** Total. `streetContribution + callAmount` — the CALL event's `toAmount`. */
export function callToAmount(state: HandState, seat: SeatIndex): MilliBB {
  return Money.add(state.seats[seat].streetContribution, callAmount(state, seat));
}

/**
 * Total. Facing no bet: `config.minBet`. Facing a bet: `currentBet + lastFullRaiseSize`
 * under `'CURRENT_BET'`, or `lastFullRaiseTo + lastFullRaiseSize` under
 * `'LAST_FULL_RAISE'` when that exceeds `currentBet`.
 *
 * NOT clamped to the stack — the true legal minimum is reported even when unreachable.
 */
export function minWagerToAmount(state: HandState, seat: SeatIndex): MilliBB {
  void seat;
  const round = state.round;
  if (Money.isZero(round.currentBet)) return state.config.minBet;
  const fromCurrent = Money.add(round.currentBet, round.lastFullRaiseSize);
  if (state.config.rules.shortAllInMinRaiseBasis === 'LAST_FULL_RAISE') {
    const fromLastFull = Money.add(round.lastFullRaiseTo, round.lastFullRaiseSize);
    return fromLastFull > round.currentBet ? fromLastFull : fromCurrent;
  }
  return fromCurrent;
}

/** Total. `streetContribution + stack` — the seat's all-in level. */
export function maxWagerToAmount(state: HandState, seat: SeatIndex): MilliBB {
  const s = state.seats[seat];
  return Money.add(s.streetContribution, s.stack);
}

/**
 * Total. `increment = toAmount - currentBet`; a wager is a full raise when the
 * increment reaches `lastFullRaiseSize` (or, facing no bet, when `toAmount` reaches
 * `config.minBet`).
 */
export function classifyWager(
  state: HandState,
  seat: SeatIndex,
  toAmount: MilliBB,
): WagerClassification {
  const s = state.seats[seat];
  const amount = Money.sub(toAmount, s.streetContribution);
  const currentBet = state.round.currentBet;
  const isAllIn = amount === s.stack;
  if (toAmount <= currentBet) {
    return { effect: 'CALL', amount, isAllIn, isFullRaise: false };
  }
  if (Money.isZero(currentBet)) {
    return { effect: 'BET', amount, isAllIn, isFullRaise: toAmount >= state.config.minBet };
  }
  const increment = Money.sub(toAmount, currentBet);
  return {
    effect: 'RAISE',
    amount,
    isAllIn,
    isFullRaise: increment >= state.round.lastFullRaiseSize,
  };
}

/**
 * Total. Returns an all-false/null struct with `seat: null` when the phase is not
 * BETTING or the seat is not on the clock, so callers never branch on phase first.
 */
export function legalActions(state: HandState, seat?: SeatIndex): LegalActions {
  const target = seat ?? state.actorSeat;
  if (state.phase !== 'BETTING' || target === null || target !== state.actorSeat) {
    return NO_ACTIONS;
  }
  const s = state.seats[target];
  const call = callAmount(state, target);
  const maxTo = maxWagerToAmount(state, target);
  const currentBet = state.round.currentBet;

  const blocker = aggressionBlocker(state, target);
  let wager: WagerOption | null = null;
  let wagerBlockedBy: EngineErrorCode | null = blocker;
  if (blocker === null) {
    if (maxTo <= currentBet) {
      wagerBlockedBy = 'INSUFFICIENT_STACK';
    } else {
      const rawMin = minWagerToAmount(state, target);
      const onlyAllIn = rawMin > maxTo;
      const minTo = onlyAllIn ? maxTo : rawMin;
      wager = {
        kind: Money.isZero(currentBet) ? 'BET' : 'RAISE',
        minToAmount: minTo,
        maxToAmount: maxTo,
        minAdditional: Money.sub(minTo, s.streetContribution),
        maxAdditional: s.stack,
        onlyAllIn,
      };
      wagerBlockedBy = null;
    }
  }

  let allIn: AllInOption | null = null;
  if (!Money.isZero(s.stack)) {
    const classified = classifyWager(state, target, maxTo);
    if (classified.effect === 'CALL' || blocker === null) {
      allIn = {
        toAmount: maxTo,
        amount: s.stack,
        effect: classified.effect,
        isFullRaise: classified.isFullRaise,
      };
    }
  }

  return {
    seat: target,
    canFold: true,
    canCheck: Money.isZero(call),
    call: Money.isZero(call)
      ? null
      : { toAmount: callToAmount(state, target), amount: call, isAllIn: call === s.stack },
    wager,
    allIn,
    wagerBlockedBy,
  };
}

/** Internal. Phase / seat / turn / status preconditions shared by every action. */
export function checkActorPreconditions(state: HandState, seat: SeatIndex): EngineResult<null> {
  if (state.phase === 'COMPLETE') {
    return engineErr('HAND_ALREADY_FINISHED', 'The hand is already complete');
  }
  if (state.phase !== 'BETTING') {
    return engineErr('NOT_BETTING_PHASE', `No seat is on the clock (phase ${state.phase})`);
  }
  if (!state.dealtInSeats.includes(seat)) {
    return engineErr('SEAT_NOT_DEALT_IN', `Seat ${seat} is not dealt into this hand`, { seat });
  }
  if (state.actorSeat !== seat) {
    return engineErr(
      'NOT_ACTORS_TURN',
      `It is seat ${state.actorSeat ?? '-'}'s turn, not seat ${seat}'s`,
      { seat },
    );
  }
  const status = state.seats[seat].status;
  if (status === 'FOLDED') {
    return engineErr('SEAT_ALREADY_FOLDED', `Seat ${seat} has already folded`, { seat });
  }
  if (status === 'ALL_IN') {
    return engineErr('SEAT_ALL_IN', `Seat ${seat} is already all-in`, { seat });
  }
  return ok(null);
}

/**
 * Result. Validation order and error codes are fixed (spec 7.2). Checks that `toAmount`
 * is a safe integer within the milliBB range BEFORE any `Money` call, so `Money` never
 * throws on user input. Returns the classification a valid wager would produce.
 */
export function validateWagerTo(
  state: HandState,
  seat: SeatIndex,
  toAmount: MilliBB,
): EngineResult<WagerClassification> {
  const pre = checkActorPreconditions(state, seat);
  if (!pre.ok) return pre;

  const blocker = aggressionBlocker(state, seat);
  if (blocker === 'RAISE_NOT_REOPENED') {
    return engineErr(
      'RAISE_NOT_REOPENED',
      'Betting was not reopened to this seat: an all-in for less than a full raise does not reopen it',
      { seat },
    );
  }
  if (blocker === 'NO_OPPONENT_CAN_RESPOND') {
    return engineErr(
      'NO_OPPONENT_CAN_RESPOND',
      'No opponent has chips behind to respond to a raise',
      { seat },
    );
  }
  if (blocker === 'SEAT_ALL_IN') {
    return engineErr('SEAT_ALL_IN', `Seat ${seat} has no chips behind`, { seat });
  }

  if (!Number.isSafeInteger(toAmount) || Math.abs(toAmount) > Money.MAX_MILLI_BB) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `Raise-to must be a whole number of milliBB within +/-${Money.MAX_MILLI_BB}`,
      { seat },
    );
  }

  const currentBet = state.round.currentBet;
  if (toAmount <= currentBet) {
    return engineErr(
      'AMOUNT_NOT_INCREASING',
      `Raise-to ${toAmount} must exceed the current bet ${currentBet}`,
      { seat, actual: toAmount, min: Money.add(currentBet, Money.mbb(1)) },
    );
  }

  const maxTo = maxWagerToAmount(state, seat);
  if (toAmount > maxTo) {
    return engineErr(
      'INSUFFICIENT_STACK',
      `Raise-to ${toAmount} exceeds the seat's all-in level ${maxTo}`,
      { seat, max: maxTo, actual: toAmount },
    );
  }

  const minTo = minWagerToAmount(state, seat);
  if (toAmount < minTo && toAmount !== maxTo) {
    return engineErr(
      'AMOUNT_BELOW_MINIMUM',
      `Raise-to ${toAmount} is below the minimum ${minTo}; a smaller wager is legal only all-in`,
      { seat, min: minTo, max: maxTo, actual: toAmount },
    );
  }

  return ok(classifyWager(state, seat, toAmount));
}
