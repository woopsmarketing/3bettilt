/**
 * Session-level table state: occupancy, stacks, hero and button. NOT event-sourced —
 * a hand's log embeds everything it needs, and this is the between-hands scaffolding.
 */
import { invariant, Money, ok, type MilliBB, type PlayerId } from '@gto-self/shared';
import { validateTableConfig, type TableConfig } from './config.js';
import { engineErr, type EngineResult } from './errors.js';
import type { Hand } from './hand.js';
import {
  makeBySeat,
  nextSeat,
  setBySeat,
  type BySeat,
  type SeatIndex,
  type SeatOccupancy,
} from './seat.js';

export interface TableSeat {
  readonly seat: SeatIndex;
  readonly occupancy: SeatOccupancy;
  /** null iff `occupancy === 'EMPTY'`. */
  readonly playerId: PlayerId | null;
  /** Chips at the table right now. ZERO when EMPTY. Preserved while SITTING_OUT. */
  readonly stack: MilliBB;
}

export interface TableState {
  readonly config: TableConfig;
  readonly seats: BySeat<TableSeat>;
  readonly buttonSeat: SeatIndex | null;
  /** Identity, not a poker rule. UX pins hero bottom-centre and Phase 8 needs it. */
  readonly heroSeat: SeatIndex | null;
  readonly handNumber: number;
}

function emptyTableSeat(seat: SeatIndex): TableSeat {
  return { seat, occupancy: 'EMPTY', playerId: null, stack: Money.ZERO };
}

function isMoneyValue(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= Money.MAX_MILLI_BB;
}

/**
 * Internal. The table's total chips if `seat` held `stack` instead of what it holds now,
 * as a plain number. Six per-seat stacks that are each inside `Money.MAX_MILLI_BB` can
 * still sum past it, and the reducer's `Money.sum` over starting stacks would then THROW
 * out of `startHand`. Range is owned by the boundary that takes the user's typed value.
 */
function tableTotalWith(table: TableState, seat: SeatIndex, stack: number): number {
  let total = stack;
  for (const other of [0, 1, 2, 3, 4, 5] as const) {
    if (other !== seat) total += table.seats[other].stack;
  }
  return total;
}

/** Result. All six seats EMPTY, no button, no hero, handNumber 0. Errors INVALID_CONFIG. */
export function createTable(config: TableConfig): EngineResult<TableState> {
  const validated = validateTableConfig(config);
  if (!validated.ok) return validated;
  return ok({
    config: validated.value,
    seats: makeBySeat(emptyTableSeat),
    buttonSeat: null,
    heroSeat: null,
    handNumber: 0,
  });
}

/** Total. `BySeat` lookups are total under ADR-0005. */
export function tableSeatAt(table: TableState, seat: SeatIndex): TableSeat {
  return table.seats[seat];
}

/**
 * Result. Seats a player with a starting stack. Errors SEAT_OCCUPIED,
 * AMOUNT_OUT_OF_RANGE (the value itself, or the table total it would produce),
 * STACK_NOT_POSITIVE.
 */
export function seatPlayer(
  table: TableState,
  seat: SeatIndex,
  playerId: PlayerId,
  stack: MilliBB,
): EngineResult<TableState> {
  if (table.seats[seat].occupancy !== 'EMPTY') {
    return engineErr('SEAT_OCCUPIED', `Seat ${seat} is already occupied`, { seat });
  }
  if (!isMoneyValue(stack)) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `Stack must be a whole number of milliBB within +/-${Money.MAX_MILLI_BB}`,
      { seat },
    );
  }
  if (stack <= 0) {
    return engineErr('STACK_NOT_POSITIVE', `Seat ${seat} needs a positive stack`, { seat });
  }
  if (tableTotalWith(table, seat, stack) > Money.MAX_MILLI_BB) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `Seating ${stack} at seat ${seat} would put the table's total chips past +/-${Money.MAX_MILLI_BB} milliBB`,
      { seat },
    );
  }
  return ok({
    ...table,
    seats: setBySeat(table.seats, seat, { seat, occupancy: 'ACTIVE', playerId, stack }),
  });
}

/**
 * Total. Clears the seat to EMPTY with no player and a zero stack; clears hero and
 * button if they pointed here (the button becomes null).
 */
export function vacateSeat(table: TableState, seat: SeatIndex): TableState {
  return {
    ...table,
    seats: setBySeat(table.seats, seat, emptyTableSeat(seat)),
    buttonSeat: table.buttonSeat === seat ? null : table.buttonSeat,
    heroSeat: table.heroSeat === seat ? null : table.heroSeat,
  };
}

/**
 * Result. ACTIVE <-> SITTING_OUT is the UX `S` toggle. Errors SEAT_EMPTY when the seat
 * holds no player. Moving to EMPTY is `vacateSeat`, not this.
 */
export function setSeatOccupancy(
  table: TableState,
  seat: SeatIndex,
  occupancy: 'ACTIVE' | 'SITTING_OUT',
): EngineResult<TableState> {
  const current = table.seats[seat];
  if (current.occupancy === 'EMPTY' || current.playerId === null) {
    return engineErr('SEAT_EMPTY', `Seat ${seat} holds no player`, { seat });
  }
  const seats = setBySeat(table.seats, seat, { ...current, occupancy });
  return ok({
    ...table,
    seats,
    buttonSeat: occupancy === 'SITTING_OUT' && table.buttonSeat === seat ? null : table.buttonSeat,
  });
}

/**
 * Result. The `docs/UX.md` inline stack editor. Zero is allowed (a busted seat);
 * negative is STACK_NEGATIVE; out-of-range is AMOUNT_OUT_OF_RANGE, checked BEFORE any
 * `Money` call so `Money` never throws on user input. The TABLE TOTAL is range-checked
 * too, because six individually valid stacks can sum past `Money.MAX_MILLI_BB`.
 */
export function setSeatStack(
  table: TableState,
  seat: SeatIndex,
  stack: MilliBB,
): EngineResult<TableState> {
  const current = table.seats[seat];
  if (current.occupancy === 'EMPTY') {
    return engineErr('SEAT_EMPTY', `Seat ${seat} holds no player`, { seat });
  }
  if (!isMoneyValue(stack)) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `Stack must be a whole number of milliBB within +/-${Money.MAX_MILLI_BB}`,
      { seat },
    );
  }
  if (stack < 0) {
    return engineErr('STACK_NEGATIVE', `Seat ${seat} cannot have a negative stack`, { seat });
  }
  if (tableTotalWith(table, seat, stack) > Money.MAX_MILLI_BB) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `Setting seat ${seat} to ${stack} would put the table's total chips past +/-${Money.MAX_MILLI_BB} milliBB`,
      { seat },
    );
  }
  return ok({ ...table, seats: setBySeat(table.seats, seat, { ...current, stack }) });
}

/** Result. Errors SEAT_EMPTY. Hero is a single seat, so this clears it everywhere else. */
export function setHeroSeat(table: TableState, seat: SeatIndex): EngineResult<TableState> {
  if (table.seats[seat].occupancy === 'EMPTY') {
    return engineErr('SEAT_EMPTY', `Seat ${seat} holds no player`, { seat });
  }
  return ok({ ...table, heroSeat: seat });
}

/** Result. The manual BTN override. The seat must be ACTIVE and occupied. */
export function setButtonSeat(table: TableState, seat: SeatIndex): EngineResult<TableState> {
  const current = table.seats[seat];
  if (current.occupancy !== 'ACTIVE' || current.playerId === null) {
    return engineErr('SEAT_EMPTY', `Seat ${seat} is not an active occupied seat`, { seat });
  }
  return ok({ ...table, buttonSeat: seat });
}

/**
 * Total. ACTIVE, occupied, stack > 0 — ascending seat order. SITTING_OUT and EMPTY seats
 * are excluded structurally: they post nothing and receive no cards.
 */
export function dealtInSeats(table: TableState): readonly SeatIndex[] {
  return ([0, 1, 2, 3, 4, 5] as const).filter((seat) => {
    const s = table.seats[seat];
    return s.occupancy === 'ACTIVE' && s.playerId !== null && s.stack > 0;
  });
}

/**
 * Result. Moves the button to the next dealt-in-eligible seat clockwise, or the lowest
 * one when there is no button yet. Errors NOT_ENOUGH_PLAYERS.
 *
 * ASSUMPTION: the button moves simply. Dead-button and missed-blind rules are NOT
 * modelled in Phase 1; the user corrects with `setButtonSeat`.
 */
export function advanceButton(table: TableState): EngineResult<TableState> {
  const eligible = dealtInSeats(table);
  if (eligible.length < 2) {
    return engineErr('NOT_ENOUGH_PLAYERS', 'At least two dealt-in seats are needed');
  }
  const first = eligible[0];
  invariant(first !== undefined, 'dealtInSeats returned an empty non-empty list');
  if (table.buttonSeat === null) return ok({ ...table, buttonSeat: first });

  let candidate = nextSeat(table.buttonSeat);
  for (let step = 0; step < 6; step += 1) {
    if (eligible.includes(candidate)) return ok({ ...table, buttonSeat: candidate });
    candidate = nextSeat(candidate);
  }
  return ok({ ...table, buttonSeat: first });
}

/**
 * Result. Writes each dealt-in seat's ending stack back from a COMPLETE hand and
 * increments `handNumber`. Errors HAND_NOT_COMPLETE and HAND_TABLE_MISMATCH.
 * Does NOT advance the button — that is a separate explicit call.
 */
export function applyHandResult(table: TableState, hand: Hand): EngineResult<TableState> {
  if (hand.state.phase !== 'COMPLETE') {
    return engineErr('HAND_NOT_COMPLETE', `The hand is still in phase ${hand.state.phase}`);
  }
  let seats = table.seats;
  for (const seat of hand.state.dealtInSeats) {
    const handSeat = hand.state.seats[seat];
    const tableSeat = table.seats[seat];
    if (tableSeat.playerId !== handSeat.playerId) {
      return engineErr(
        'HAND_TABLE_MISMATCH',
        `Seat ${seat} holds a different player than when the hand was dealt`,
        { seat },
      );
    }
    seats = setBySeat(seats, seat, { ...tableSeat, stack: handSeat.stack });
  }
  return ok({ ...table, seats, handNumber: table.handNumber + 1 });
}
