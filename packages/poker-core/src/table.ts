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

/**
 * Auto top-up is a between-hands TABLE operation, not a poker rule: the intended
 * sequence is `applyHandResult` -> `applyAutoTopUp` -> `advanceButton`, run once per
 * completed hand. Running top-up before the button search matters — a seat this policy
 * revives must be eligible again by the time the button looks for the next dealt-in
 * seat (see `table.test.ts` / `tests/auto-top-up.test.ts` for the worked sequence).
 */
export interface AutoTopUpPolicy {
  readonly enabled: boolean;
  /** Stack to top a seat back up TO. Typically config.referenceStack. */
  readonly targetStack: MilliBB;
  /** Only seats with a stack STRICTLY BELOW this are topped up. */
  readonly threshold: MilliBB;
}

/** Total. Off by default; tops any seat below the buy-in back up to the buy-in. */
export function defaultAutoTopUpPolicy(config: TableConfig): AutoTopUpPolicy {
  return { enabled: false, targetStack: config.referenceStack, threshold: config.referenceStack };
}

/**
 * Total. The per-seat deltas a top-up would apply, so the UI can preview it before
 * `applyAutoTopUp` commits it. Empty when `policy.enabled` is false — that is the
 * whole meaning of the flag, so an unchecked toggle previews as "nothing changes".
 *
 * A seat qualifies when it is ACTIVE with a player seated (never SITTING_OUT, never
 * EMPTY — see ASSUMPTION below) and its stack is strictly below BOTH
 * `policy.threshold` AND `policy.targetStack`. Top-up only ever ADDS chips: requiring
 * both means that when `threshold > targetStack`, the effective rule is "top up only
 * seats below targetStack" — a threshold set above the target can never shrink anyone,
 * and can never be satisfied by matching only the (looser) target check.
 *
 * ASSUMPTION: a busted (zero-stack) seat IS a qualifying seat, exactly like any other
 * short stack. This is a practice tool for reviewing strategy, not a bankroll/rebuy
 * simulator, so a bust does not by itself demand a rebuy decision. To model a real
 * rebuy decision instead, use `policy.enabled` (turn top-up off) or `policy.threshold`
 * (e.g. `Money.ZERO`, so a zero stack no longer counts as "below threshold").
 *
 * ASSUMPTION: a SITTING_OUT seat is never topped up even when its stack qualifies.
 * The user brings the seat back ACTIVE with the `S` toggle (`setSeatOccupancy`,
 * `docs/UX.md`) first — that is also the natural moment to decide against a rebuy.
 *
 * Trusts `policy` is a valid shape; `applyAutoTopUp` is the boundary that validates
 * untrusted policy values, the same way `setSeatStack` (not this function) validates
 * untrusted stack values.
 *
 * `seats` optionally SCOPES the plan: only the listed seats are considered, and every
 * qualification rule above still applies to each of them. Omitting it considers all six,
 * which is what the session-wide policy means. The scope narrows the candidates; it never
 * makes a seat qualify that would not have. Order is always ascending physical seat,
 * whatever order `seats` is given in, and a seat named twice is planned once.
 */
export function topUpPlan(
  table: TableState,
  policy: AutoTopUpPolicy,
  seats?: readonly SeatIndex[],
): readonly { readonly seat: SeatIndex; readonly from: MilliBB; readonly to: MilliBB }[] {
  if (!policy.enabled) return [];
  const scope = seats === undefined ? null : new Set<SeatIndex>(seats);
  return ([0, 1, 2, 3, 4, 5] as const)
    .filter((seat) => {
      if (scope !== null && !scope.has(seat)) return false;
      const s = table.seats[seat];
      return (
        s.occupancy === 'ACTIVE' &&
        s.playerId !== null &&
        s.stack < policy.threshold &&
        s.stack < policy.targetStack
      );
    })
    .map((seat) => ({ seat, from: table.seats[seat].stack, to: policy.targetStack }));
}

/**
 * Result. Applies `topUpPlan` one seat at a time through `setSeatStack`, so the same
 * table-TOTAL range check `setSeatStack` already runs (six individually valid stacks
 * can still sum past `Money.MAX_MILLI_BB`) governs a top-up too, with nothing
 * duplicated or able to drift from it. Errors AMOUNT_OUT_OF_RANGE if applying the plan
 * would push the table's total past that limit; a plan built by `topUpPlan` cannot
 * otherwise fail against a table that already validated (SEAT_EMPTY / STACK_NEGATIVE
 * cannot fire), but any such error is still returned rather than swallowed.
 *
 * `policy.enabled: false` returns `table` UNCHANGED (same reference, no seat read or
 * rewritten) before anything else, including validation below — a disabled policy is
 * always inert, even one with garbage `targetStack`/`threshold` values sitting in a UI
 * form. Only once the policy is live is its shape checked, so a real top-up can never
 * silently no-op: errors STACK_NOT_POSITIVE (`targetStack <= 0`), STACK_NEGATIVE
 * (`threshold < 0`), AMOUNT_OUT_OF_RANGE (either value not a whole milliBB number
 * within +/-Money.MAX_MILLI_BB).
 *
 * `seats` scopes the plan exactly as it does in `topUpPlan`; it changes WHICH seats are
 * considered and nothing else. Validation of the policy itself is unscoped: a live policy
 * with a garbage target is refused even when its scope happens to select no seat, so the
 * same policy cannot be accepted at one seat and refused at another.
 */
export function applyAutoTopUp(
  table: TableState,
  policy: AutoTopUpPolicy,
  seats?: readonly SeatIndex[],
): EngineResult<TableState> {
  if (!policy.enabled) return ok(table);

  if (!isMoneyValue(policy.targetStack) || !isMoneyValue(policy.threshold)) {
    return engineErr(
      'AMOUNT_OUT_OF_RANGE',
      `AutoTopUpPolicy.targetStack and threshold must be whole numbers of milliBB within +/-${Money.MAX_MILLI_BB}`,
    );
  }
  if (policy.targetStack <= 0) {
    return engineErr('STACK_NOT_POSITIVE', 'AutoTopUpPolicy.targetStack must be positive');
  }
  if (policy.threshold < 0) {
    return engineErr('STACK_NEGATIVE', 'AutoTopUpPolicy.threshold must not be negative');
  }

  const plan = topUpPlan(table, policy, seats);
  if (plan.length === 0) return ok(table);

  let next = table;
  for (const { seat, to } of plan) {
    const result = setSeatStack(next, seat, to);
    if (!result.ok) return result;
    next = result.value;
  }
  return ok(next);
}

/**
 * Result. Applies each seat's OWN policy, in ascending seat order, through the scoped
 * `applyAutoTopUp`. Auto top-up is a per-seat preference — one seat may be topped to 100 BB
 * while its neighbour is off entirely — and this is the one place that fold lives, so the
 * presentation layer never loops over money logic itself (`CLAUDE.md` rule 1).
 *
 * A seat with no entry in `policies` is not considered at all, which is a different fact
 * from an entry whose `enabled` is false: the first records no preference, the second
 * records a preference that is switched off. Both leave the seat untouched.
 *
 * The FIRST error is returned unchanged, and with it the caller's own `table` — every
 * intermediate value is discarded, so a run that fails at seat 4 never leaves seats 0..3
 * topped up. Nothing here is partially applied.
 */
export function applySeatAutoTopUps(
  table: TableState,
  policies: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>,
): EngineResult<TableState> {
  let next = table;
  for (const seat of [0, 1, 2, 3, 4, 5] as const) {
    const policy = policies[seat];
    if (policy === undefined) continue;
    const result = applyAutoTopUp(next, policy, [seat]);
    if (!result.ok) return result;
    next = result.value;
  }
  return ok(next);
}
