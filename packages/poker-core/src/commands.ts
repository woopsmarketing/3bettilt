/**
 * Commands in, events out. `expandCommand` emits the USER event, folds it, then drains
 * the engine-derived consequences into the SAME `commandSeq` to a fixed point, so one
 * `Z` (undo) removes one whole logical action — `FOLD, RETURN_UNCALLED, POT_AWARDED,
 * HAND_FINISHED` included.
 */
import {
  invariant,
  isCard,
  Money,
  ok,
  type Card,
  type HandId,
  type IdFactory,
  type MilliBB,
  type PlayerId,
} from '@gto-self/shared';
import {
  callAmount,
  callToAmount,
  checkActorPreconditions,
  maxWagerToAmount,
  validateWagerTo,
} from './betting.js';
import { validateTableConfig, type TableConfig } from './config.js';
import { engineErr, type EngineResult } from './errors.js';
import { makeEvent, type HandEvent, type HandEventPayload, type EventOrigin } from './events.js';
import { deadCards } from './metrics.js';
import { unawardedPots } from './pots.js';
import { autoAwardUncontested, planAwards, type PotAwardInput } from './settlement.js';
import { applyEvent, initialHandState } from './reduce.js';
import { orderClockwise, type SeatIndex } from './seat.js';
import { contenders, type HandState } from './state.js';
import { assignBlinds } from './positions.js';
import { boardCardsForStreet } from './street.js';
import { dealtInSeats, type TableState } from './table.js';

/**
 * `seat` is optional on action commands: the UI omits it (it is whoever is on the clock),
 * the Phase 11 parser supplies it and gets a free NOT_ACTORS_TURN consistency check.
 * `cards` is `readonly Card[]` rather than a tuple, so a wrong count is a Result error
 * (WRONG_CARD_COUNT) instead of a compile error at the palette.
 */
export type ActionCommand =
  | { readonly kind: 'FOLD'; readonly seat?: SeatIndex }
  | { readonly kind: 'CHECK'; readonly seat?: SeatIndex }
  | { readonly kind: 'CALL'; readonly seat?: SeatIndex }
  | { readonly kind: 'BET'; readonly toAmount: MilliBB; readonly seat?: SeatIndex }
  | { readonly kind: 'RAISE'; readonly toAmount: MilliBB; readonly seat?: SeatIndex }
  | { readonly kind: 'ALL_IN'; readonly seat?: SeatIndex };

export type HandCommand =
  | ActionCommand
  | { readonly kind: 'DEAL_BOARD'; readonly cards: readonly Card[] }
  | {
      readonly kind: 'SET_HOLE_CARDS';
      readonly seat: SeatIndex;
      readonly cards: readonly Card[];
      readonly revealed: boolean;
    }
  /** Must cover EVERY unawarded pot, so the per-hand rake cap is computed once. */
  | { readonly kind: 'AWARD_POTS'; readonly awards: readonly PotAwardInput[] };

export type HandCommandKind = HandCommand['kind'];

export interface StartHandOptions {
  readonly handId: HandId;
  /** Defaults to `table.buttonSeat`. Must be an ACTIVE, dealt-in seat. */
  readonly buttonSeat?: SeatIndex;
  /** Defaults to `table.handNumber`. */
  readonly handNumber?: number;
}

/** Roster entry used by both `buildStartEvents` and strict replay. */
export interface RosterEntry {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly startingStack: MilliBB;
}

// --- command constructors ---------------------------------------------------

/** The `F` key. */
export const fold = (seat?: SeatIndex): HandCommand => ({ kind: 'FOLD', seat });
/** The `X` key. */
export const check = (seat?: SeatIndex): HandCommand => ({ kind: 'CHECK', seat });
/** The `C` key. */
export const call = (seat?: SeatIndex): HandCommand => ({ kind: 'CALL', seat });
/** The `A` key. */
export const allIn = (seat?: SeatIndex): HandCommand => ({ kind: 'ALL_IN', seat });
/** Raise-TO semantics: `toAmount` is the seat's street contribution AFTER the bet. */
export const betTo = (toAmount: MilliBB, seat?: SeatIndex): HandCommand => ({
  kind: 'BET',
  toAmount,
  seat,
});
/** Raise-TO semantics: `toAmount` is the seat's street contribution AFTER the raise. */
export const raiseTo = (toAmount: MilliBB, seat?: SeatIndex): HandCommand => ({
  kind: 'RAISE',
  toAmount,
  seat,
});
export const dealBoard = (cards: readonly Card[]): HandCommand => ({ kind: 'DEAL_BOARD', cards });
export const setHoleCards = (
  seat: SeatIndex,
  cards: readonly Card[],
  revealed: boolean,
): HandCommand => ({ kind: 'SET_HOLE_CARDS', seat, cards, revealed });
export const awardPots = (awards: readonly PotAwardInput[]): HandCommand => ({
  kind: 'AWARD_POTS',
  awards,
});

// --- validation -------------------------------------------------------------

function resolveSeat(state: HandState, seat: SeatIndex | undefined): EngineResult<SeatIndex> {
  if (seat !== undefined) return ok(seat);
  if (state.phase === 'COMPLETE') {
    return engineErr('HAND_ALREADY_FINISHED', 'The hand is already complete');
  }
  if (state.actorSeat === null) {
    return engineErr('NOT_BETTING_PHASE', `No seat is on the clock (phase ${state.phase})`);
  }
  return ok(state.actorSeat);
}

function validateCards(
  state: HandState,
  cards: readonly Card[],
  expectedCount: number,
  exceptSeat: SeatIndex | null,
): EngineResult<null> {
  if (cards.length !== expectedCount) {
    return engineErr('WRONG_CARD_COUNT', `Expected ${expectedCount} card(s), got ${cards.length}`);
  }
  for (const card of cards) {
    if (!isCard(card)) {
      return engineErr('WRONG_CARD_COUNT', `${card} is not a card index in 0..51`);
    }
  }
  if (new Set(cards).size !== cards.length) {
    return engineErr('DUPLICATE_CARD', 'The same card was supplied twice');
  }
  const known = new Set<number>(
    exceptSeat === null
      ? deadCards(state)
      : deadCards(state).filter((card) => !state.seats[exceptSeat].holeCards.includes(card)),
  );
  for (const card of cards) {
    if (known.has(card)) {
      return engineErr('DUPLICATE_CARD', `Card ${card} is already in play`);
    }
  }
  return ok(null);
}

/**
 * Result. Pure precondition check with no event construction, so the UI can enable and
 * disable keys without dry-running. Never throws.
 */
export function validateCommand(state: HandState, command: HandCommand): EngineResult<null> {
  switch (command.kind) {
    case 'FOLD': {
      const seat = resolveSeat(state, command.seat);
      if (!seat.ok) return seat;
      return checkActorPreconditions(state, seat.value);
    }
    case 'CHECK': {
      const seat = resolveSeat(state, command.seat);
      if (!seat.ok) return seat;
      const pre = checkActorPreconditions(state, seat.value);
      if (!pre.ok) return pre;
      if (!Money.isZero(callAmount(state, seat.value))) {
        return engineErr(
          'CHECK_NOT_ALLOWED',
          `Seat ${seat.value} faces a bet of ${callAmount(state, seat.value)} and cannot check`,
          { seat: seat.value },
        );
      }
      return ok(null);
    }
    case 'CALL': {
      const seat = resolveSeat(state, command.seat);
      if (!seat.ok) return seat;
      const pre = checkActorPreconditions(state, seat.value);
      if (!pre.ok) return pre;
      if (Money.isZero(callAmount(state, seat.value))) {
        return engineErr('CALL_NOT_ALLOWED', `Seat ${seat.value} faces no bet to call`, {
          seat: seat.value,
        });
      }
      return ok(null);
    }
    case 'BET': {
      const seat = resolveSeat(state, command.seat);
      if (!seat.ok) return seat;
      const pre = checkActorPreconditions(state, seat.value);
      if (!pre.ok) return pre;
      if (!Money.isZero(state.round.currentBet)) {
        return engineErr(
          'BET_NOT_ALLOWED',
          `There is already a bet of ${state.round.currentBet}; raise instead`,
          { seat: seat.value },
        );
      }
      const wager = validateWagerTo(state, seat.value, command.toAmount);
      return wager.ok ? ok(null) : wager;
    }
    case 'RAISE': {
      const seat = resolveSeat(state, command.seat);
      if (!seat.ok) return seat;
      const pre = checkActorPreconditions(state, seat.value);
      if (!pre.ok) return pre;
      if (Money.isZero(state.round.currentBet)) {
        return engineErr('RAISE_NOT_ALLOWED', 'There is no bet to raise; bet instead', {
          seat: seat.value,
        });
      }
      const wager = validateWagerTo(state, seat.value, command.toAmount);
      return wager.ok ? ok(null) : wager;
    }
    case 'ALL_IN': {
      const seat = resolveSeat(state, command.seat);
      if (!seat.ok) return seat;
      const pre = checkActorPreconditions(state, seat.value);
      if (!pre.ok) return pre;
      const maxTo = maxWagerToAmount(state, seat.value);
      if (maxTo <= state.round.currentBet) return ok(null); // functions as a (short) call
      const wager = validateWagerTo(state, seat.value, maxTo);
      return wager.ok ? ok(null) : wager;
    }
    case 'DEAL_BOARD': {
      if (state.phase === 'COMPLETE') {
        return engineErr('HAND_ALREADY_FINISHED', 'The hand is already complete');
      }
      if (state.phase !== 'AWAITING_BOARD' || state.pendingStreet === null) {
        return engineErr(
          'NOT_AWAITING_BOARD',
          `The engine is not waiting for board cards (phase ${state.phase})`,
        );
      }
      return validateCards(state, command.cards, boardCardsForStreet(state.pendingStreet), null);
    }
    case 'SET_HOLE_CARDS': {
      if (!state.dealtInSeats.includes(command.seat)) {
        return engineErr('SEAT_NOT_DEALT_IN', `Seat ${command.seat} is not dealt into this hand`, {
          seat: command.seat,
        });
      }
      return validateCards(state, command.cards, command.cards.length === 1 ? 1 : 2, command.seat);
    }
    case 'AWARD_POTS': {
      if (state.phase === 'COMPLETE') {
        return engineErr('HAND_ALREADY_FINISHED', 'The hand is already complete');
      }
      if (state.phase !== 'AWAITING_AWARD') {
        return engineErr(
          'NOT_AWAITING_AWARD',
          `The engine is not waiting for a winner (phase ${state.phase})`,
        );
      }
      const plan = planAwards(state, command.awards);
      return plan.ok ? ok(null) : plan;
    }
  }
}

/**
 * Total. 0 unless `phase === 'AWAITING_BOARD'`; otherwise the number of cards
 * `pendingStreet` needs. Drives the palette's automatic open and close (`docs/UX.md`).
 */
export function expectedBoardCardCount(state: HandState): number {
  if (state.phase !== 'AWAITING_BOARD' || state.pendingStreet === null) return 0;
  return boardCardsForStreet(state.pendingStreet);
}

// --- event construction -----------------------------------------------------

interface Emitter {
  readonly events: HandEvent[];
  state: HandState;
  seq: number;
}

function emit(
  emitter: Emitter,
  payload: HandEventPayload,
  origin: EventOrigin,
  commandSeq: number,
  ids: IdFactory,
): void {
  const event = makeEvent(payload, { seq: emitter.seq, commandSeq, origin }, ids);
  emitter.seq += 1;
  emitter.events.push(event);
  emitter.state = applyEvent(emitter.state, event);
}

const CASCADE_LIMIT = 64;

/**
 * Internal. Drains the engine-derived consequences of a user event into the same
 * command group, to a fixed point (spec 7.10). Board cards are never auto-emitted and
 * contested pots are never auto-awarded.
 */
function drainCascade(emitter: Emitter, commandSeq: number, ids: IdFactory): void {
  for (let guard = 0; guard <= CASCADE_LIMIT; guard += 1) {
    invariant(guard < CASCADE_LIMIT, 'the engine cascade did not reach a fixed point');
    const state = emitter.state;
    if (state.pendingUncalled !== null) {
      emit(
        emitter,
        {
          kind: 'RETURN_UNCALLED',
          seat: state.pendingUncalled.seat,
          amount: state.pendingUncalled.amount,
        },
        'ENGINE',
        commandSeq,
        ids,
      );
      continue;
    }
    const pending = unawardedPots(state);
    if (pending.length > 0 && contenders(state).length === 1) {
      const plan = autoAwardUncontested(state);
      invariant(plan.ok, 'an uncontested pot could not be awarded automatically');
      if (!plan.ok) return;
      for (const record of plan.value.records) {
        emit(emitter, { kind: 'POT_AWARDED', ...record }, 'ENGINE', commandSeq, ids);
      }
      continue;
    }
    if (state.pots.length > 0 && pending.length === 0 && state.endReason === null) {
      emit(
        emitter,
        {
          kind: 'HAND_FINISHED',
          reason: contenders(state).length === 1 ? 'ALL_FOLDED' : 'SHOWDOWN',
          totalRake: state.totalRake,
        },
        'ENGINE',
        commandSeq,
        ids,
      );
      continue;
    }
    return;
  }
}

function userPayloadsFor(
  state: HandState,
  command: HandCommand,
  seat: SeatIndex,
): readonly HandEventPayload[] {
  switch (command.kind) {
    case 'FOLD':
      return [{ kind: 'FOLD', seat }];
    case 'CHECK':
      return [{ kind: 'CHECK', seat }];
    case 'CALL':
      return [
        {
          kind: 'CALL',
          seat,
          toAmount: callToAmount(state, seat),
          amount: callAmount(state, seat),
        },
      ];
    case 'BET':
      return [
        {
          kind: 'BET',
          seat,
          toAmount: command.toAmount,
          amount: Money.sub(command.toAmount, state.seats[seat].streetContribution),
        },
      ];
    case 'RAISE':
      return [
        {
          kind: 'RAISE',
          seat,
          toAmount: command.toAmount,
          amount: Money.sub(command.toAmount, state.seats[seat].streetContribution),
        },
      ];
    case 'ALL_IN':
      return [
        {
          kind: 'ALL_IN',
          seat,
          toAmount: maxWagerToAmount(state, seat),
          amount: state.seats[seat].stack,
        },
      ];
    case 'SET_HOLE_CARDS':
      return [
        {
          kind: 'HOLE_CARDS_SET',
          seat: command.seat,
          cards: [...command.cards],
          revealed: command.revealed,
        },
      ];
    case 'DEAL_BOARD': {
      const street = state.pendingStreet;
      invariant(street !== null, 'DEAL_BOARD without a pending street');
      if (street === 'FLOP') {
        const [a, b, c] = command.cards;
        invariant(
          a !== undefined && b !== undefined && c !== undefined,
          'a flop needs three cards',
        );
        return [{ kind: 'FLOP_DEALT', cards: [a, b, c] }];
      }
      const [card] = command.cards;
      invariant(card !== undefined, 'a turn or river needs one card');
      return [{ kind: street === 'TURN' ? 'TURN_DEALT' : 'RIVER_DEALT', card }];
    }
    case 'AWARD_POTS': {
      const plan = planAwards(state, command.awards);
      invariant(plan.ok, 'AWARD_POTS was validated but could not be planned');
      if (!plan.ok) return [];
      return plan.value.records.map((record) => ({ kind: 'POT_AWARDED', ...record }));
    }
  }
}

/**
 * Result. Emits the USER event(s), folds them, then drains the engine cascade into the
 * SAME `commandSeq` to a fixed point. Bounded by a hard iteration limit with an
 * invariant throw, so a termination bug fails loud instead of hanging.
 */
export function expandCommand(
  state: HandState,
  command: HandCommand,
  meta: { readonly commandSeq: number; readonly startSeq: number },
  ids: IdFactory,
): EngineResult<readonly HandEvent[]> {
  const validated = validateCommand(state, command);
  if (!validated.ok) return validated;

  // Board deals and awards concern no single seat; the placeholder is never read.
  let seat: SeatIndex = 0;
  if (command.kind !== 'DEAL_BOARD' && command.kind !== 'AWARD_POTS') {
    const resolved = resolveSeat(state, command.seat);
    if (!resolved.ok) return resolved;
    seat = resolved.value;
  }

  const emitter: Emitter = { events: [], state, seq: meta.startSeq };
  for (const payload of userPayloadsFor(state, command, seat)) {
    emit(emitter, payload, 'USER', meta.commandSeq, ids);
  }
  drainCascade(emitter, meta.commandSeq, ids);
  return ok(emitter.events);
}

// --- hand start -------------------------------------------------------------

/**
 * Internal. Command group 0, in the fixed order HAND_STARTED, PLAYER_DEALT_IN (ascending
 * seat), POST_ANTE (ring order from the small blind), POST_SB, POST_BB — then the same
 * engine cascade, so a table where the antes put everyone all-in lands in AWAITING_BOARD
 * rather than an impossible AWAITING_ACTION.
 */
export function composeStartEvents(
  params: {
    readonly handId: HandId;
    readonly handNumber: number;
    readonly config: TableConfig;
    readonly buttonSeat: SeatIndex | null;
    readonly heroSeat: SeatIndex | null;
    readonly roster: readonly RosterEntry[];
  },
  ids: IdFactory,
): EngineResult<readonly HandEvent[]> {
  const configResult = validateTableConfig(params.config);
  if (!configResult.ok) return configResult;

  const roster = [...params.roster].sort((a, b) => a.seat - b.seat);
  if (roster.length < 2) {
    return engineErr('NOT_ENOUGH_PLAYERS', 'A hand needs at least two dealt-in seats');
  }
  if (roster.length > 6) {
    return engineErr('TOO_MANY_PLAYERS', 'A 6-max table cannot deal in more than six seats');
  }
  let totalChips = 0;
  for (const entry of roster) {
    if (entry.startingStack <= 0) {
      return engineErr(
        'STACK_NOT_POSITIVE',
        `Seat ${entry.seat} must have a positive stack to be dealt in`,
        { seat: entry.seat },
      );
    }
    if (!Number.isSafeInteger(entry.startingStack) || entry.startingStack > Money.MAX_MILLI_BB) {
      return engineErr(
        'AMOUNT_OUT_OF_RANGE',
        `Seat ${entry.seat}'s starting stack must be a whole number of milliBB within +/-${Money.MAX_MILLI_BB}`,
        { seat: entry.seat },
      );
    }
    totalChips += entry.startingStack;
  }
  // Six individually valid stacks can still sum past the milliBB range, and the reducer's
  // `Money.sum` over starting stacks would then throw out of a Result-returning function.
  // Checked here, on plain numbers, BEFORE the first `emit`.
  if (totalChips > Money.MAX_MILLI_BB) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `The dealt-in stacks total ${totalChips} milliBB, past the +/-${Money.MAX_MILLI_BB} limit`,
    );
  }
  const players = roster.map((entry) => entry.playerId).filter((id): id is PlayerId => id !== null);
  if (new Set(players).size !== players.length) {
    return engineErr('DUPLICATE_PLAYER', 'The same player is seated twice');
  }
  if (params.buttonSeat === null) {
    return engineErr('NO_BUTTON_SEAT', 'The table has no button seat');
  }
  const buttonSeat = params.buttonSeat;
  const seats = roster.map((entry) => entry.seat);
  if (!seats.includes(buttonSeat)) {
    return engineErr(
      'BUTTON_SEAT_NOT_DEALT_IN',
      `Seat ${buttonSeat} holds the button but is not dealt in`,
      { seat: buttonSeat },
    );
  }
  const blinds = assignBlinds(seats, buttonSeat, params.config.rules);
  if (!blinds.ok) return blinds;

  const startedPayload: HandEventPayload = {
    kind: 'HAND_STARTED',
    handId: params.handId,
    handNumber: params.handNumber,
    config: params.config,
    buttonSeat,
    heroSeat: params.heroSeat !== null && seats.includes(params.heroSeat) ? params.heroSeat : null,
  };
  const started = makeEvent(startedPayload, { seq: 0, commandSeq: 0, origin: 'USER' }, ids);
  invariant(started.kind === 'HAND_STARTED', 'HAND_STARTED payload lost its discriminant');

  const emitter: Emitter = { events: [started], state: initialHandState(started), seq: 1 };
  for (const entry of roster) {
    emit(
      emitter,
      {
        kind: 'PLAYER_DEALT_IN',
        seat: entry.seat,
        playerId: entry.playerId,
        startingStack: entry.startingStack,
      },
      'ENGINE',
      0,
      ids,
    );
  }
  if (params.config.ante.enabled) {
    for (const seat of orderClockwise(seats, blinds.value.smallBlindSeat, true)) {
      emit(
        emitter,
        {
          kind: 'POST_ANTE',
          seat,
          amount: Money.min(params.config.ante.amount, emitter.state.seats[seat].stack),
        },
        'ENGINE',
        0,
        ids,
      );
    }
  }
  emit(
    emitter,
    {
      kind: 'POST_SB',
      seat: blinds.value.smallBlindSeat,
      amount: Money.min(
        params.config.blinds.smallBlind,
        emitter.state.seats[blinds.value.smallBlindSeat].stack,
      ),
    },
    'ENGINE',
    0,
    ids,
  );
  emit(
    emitter,
    {
      kind: 'POST_BB',
      seat: blinds.value.bigBlindSeat,
      amount: Money.min(
        params.config.blinds.bigBlind,
        emitter.state.seats[blinds.value.bigBlindSeat].stack,
      ),
    },
    'ENGINE',
    0,
    ids,
  );
  drainCascade(emitter, 0, ids);
  return ok(emitter.events);
}

/**
 * Result. Command group 0 for a hand dealt from `table`. Errors INVALID_CONFIG,
 * NOT_ENOUGH_PLAYERS, NO_BUTTON_SEAT, BUTTON_SEAT_NOT_DEALT_IN, STACK_NOT_POSITIVE,
 * DUPLICATE_PLAYER.
 */
export function buildStartEvents(
  table: TableState,
  options: StartHandOptions,
  ids: IdFactory,
): EngineResult<readonly HandEvent[]> {
  const seats = dealtInSeats(table);
  const roster: RosterEntry[] = seats.map((seat) => ({
    seat,
    playerId: table.seats[seat].playerId,
    startingStack: table.seats[seat].stack,
  }));
  return composeStartEvents(
    {
      handId: options.handId,
      handNumber: options.handNumber ?? table.handNumber,
      config: table.config,
      buttonSeat: options.buttonSeat ?? table.buttonSeat,
      heroSeat: table.heroSeat,
      roster,
    },
    ids,
  );
}
