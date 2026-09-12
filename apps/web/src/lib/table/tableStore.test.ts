import { describe, expect, it } from 'vitest';
import { Money, sequentialIdFactory } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import { setSeatOccupancy, setSeatStack, toView } from '@gto-self/poker-core';
import { asId, type PlayerId } from '@gto-self/shared';
import type { AutoTopUpPolicy, EngineResult, SeatIndex, TableState } from '@gto-self/poker-core';
import {
  canStartHand,
  createTableStore,
  nextDirtySeat,
  seedSeatAutoTopUp,
  type TableStore,
} from './tableStore.js';
import { makeTestTable, testPlayerId } from './testTable.js';

function store(): TableStore {
  return createTableStore({
    sessionId: 'session-1',
    table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
    autoTopUp: null,
    ids: sequentialIdFactory('test'),
  });
}

// ---------------------------------------------------------------------------
// Per-seat auto top-up helpers
// ---------------------------------------------------------------------------

/** One seat's policy, in the only shape a seat row can hold: threshold === target. */
function at(bb: number, enabled = true): AutoTopUpPolicy {
  const target = Money.fromBB(bb);
  return { enabled, targetStack: target, threshold: target };
}

function unwrap(result: EngineResult<TableState>): TableState {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** The three-handed fixture with a per-seat starting stack. */
function tableWithStacks(stacks: Readonly<Partial<Record<SeatIndex, number>>>): TableState {
  let table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
  for (const seat of [0, 1, 2] as const) {
    const bb = stacks[seat];
    if (bb === undefined) continue;
    table = unwrap(setSeatStack(table, seat, Money.fromBB(bb)));
  }
  return table;
}

function topUpStore(
  table: TableState,
  seatAutoTopUp: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>,
  autoTopUp: AutoTopUpPolicy | null = null,
): TableStore {
  return createTableStore({
    sessionId: 'session-1',
    table,
    autoTopUp,
    seatAutoTopUp,
    ids: sequentialIdFactory('test'),
  });
}

/**
 * Deal, fold the hand out, and read back the stacks the ENGINE settled to — the numbers the
 * next `startHand` will top up from. Three-handed with the button on seat 0, two folds end
 * it, so seats 0 and 1 end short (they paid) and seat 2 wins the pot.
 */
function playOneHand(s: TableStore): Readonly<Record<SeatIndex, number>> {
  s.getState().startHand();
  s.getState().apply({ kind: 'FOLD' });
  s.getState().apply({ kind: 'FOLD' });
  expect(s.getState().view!.phase.kind).toBe('COMPLETE');
  const finished = s.getState().hand!;
  const settled = {} as Record<SeatIndex, number>;
  for (const seat of [0, 1, 2, 3, 4, 5] as const) settled[seat] = finished.state.seats[seat].stack;
  return settled;
}

describe('tableStore', () => {
  it('starts with no hand and no view', () => {
    const s = store();
    expect(s.getState().hand).toBeNull();
    expect(s.getState().view).toBeNull();
    expect(canStartHand(s.getState())).toBe(true);
  });

  it('startHand produces a hand whose view is toView(hand)', () => {
    const s = store();
    s.getState().startHand();

    const { hand, view, lastError } = s.getState();
    expect(lastError).toBeNull();
    expect(hand).not.toBeNull();
    expect(view).not.toBeNull();
    expect(view).toEqual(toView(hand!));
    // Blinds are posted by the engine as part of starting the hand.
    expect(view!.pot).toBeGreaterThan(0);
    expect(view!.phase.kind).toBe('AWAITING_ACTION');
  });

  it('refuses to replace a live hand and leaves it untouched', () => {
    const s = store();
    s.getState().startHand();
    const before = s.getState().hand;

    s.getState().startHand();

    expect(s.getState().hand).toBe(before);
    expect(s.getState().lastError?.code).toBe('HAND_NOT_COMPLETE');
    expect(canStartHand(s.getState())).toBe(false);
  });

  it('applies a legal command and keeps view in step with hand', () => {
    const s = store();
    s.getState().startHand();
    const actorSeat = s.getState().view!.phase.kind === 'AWAITING_ACTION' ? 0 : -1;
    expect(actorSeat).toBe(0);

    s.getState().apply({ kind: 'FOLD' });

    const { hand, view, lastError } = s.getState();
    expect(lastError).toBeNull();
    expect(view!.actions.some((record) => record.kind === 'FOLD')).toBe(true);
    expect(view).toEqual(toView(hand!));
  });

  it('a rejected command sets lastError and changes nothing else', () => {
    const s = store();
    s.getState().startHand();
    const before = s.getState().hand;
    const viewBefore = s.getState().view;

    // Preflop facing the big blind, CHECK is not a legal verb.
    s.getState().apply({ kind: 'CHECK' });

    expect(s.getState().hand).toBe(before);
    expect(s.getState().view).toBe(viewBefore);
    expect(s.getState().lastError?.code).toBe('CHECK_NOT_ALLOWED');
  });

  it('apply with no hand in progress is an error, not a throw', () => {
    const s = store();
    s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().hand).toBeNull();
    expect(s.getState().lastError?.code).toBe('NOT_BETTING_PHASE');
  });

  it('undo reverses the last command', () => {
    const s = store();
    s.getState().startHand();
    const events = s.getState().hand!.events.length;
    const actions = s.getState().view!.actions.length;

    s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().hand!.events.length).toBeGreaterThan(events);

    s.getState().undo();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand!.events.length).toBe(events);
    expect(s.getState().view!.actions.length).toBe(actions);
    expect(s.getState().view).toEqual(toView(s.getState().hand!));
  });

  it('undo with nothing to undo reports the engine error', () => {
    const s = store();
    s.getState().startHand();
    s.getState().undo();
    expect(s.getState().lastError?.code).toBe('NOTHING_TO_UNDO');
    expect(s.getState().hand).not.toBeNull();
  });

  it('dismissError clears the last error only', () => {
    const s = store();
    s.getState().startHand();
    s.getState().apply({ kind: 'CHECK' });
    expect(s.getState().lastError).not.toBeNull();

    s.getState().dismissError();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand).not.toBeNull();
  });

  it('selectSeat drives the panel selection', () => {
    const s = store();
    expect(s.getState().selectedSeat).toBeNull();
    s.getState().selectSeat(2);
    expect(s.getState().selectedSeat).toBe(2);
    s.getState().selectSeat(null);
    expect(s.getState().selectedSeat).toBeNull();
  });

  it('settles and advances the table before dealing the next hand', () => {
    const s = store();
    s.getState().startHand();

    // Fold everyone but one contender: the engine finishes the hand by itself.
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().view!.phase.kind).toBe('COMPLETE');

    const buttonBefore = s.getState().table.buttonSeat;
    const handNumberBefore = s.getState().table.handNumber;

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(handNumberBefore + 1);
    expect(s.getState().table.buttonSeat).not.toBe(buttonBefore);
    expect(s.getState().view!.phase.kind).toBe('AWAITING_ACTION');
    expect(s.getState().view).toEqual(toView(s.getState().hand!));
  });

  it('carries the winner’s settled stack into the next hand', () => {
    const s = store();
    s.getState().startHand();
    const startingStacks = s.getState().table.seats;

    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    const finished = s.getState().hand!;
    s.getState().startHand();

    // The engine's own ending stacks, written back verbatim.
    for (const seat of [0, 1, 2] as const) {
      expect(s.getState().table.seats[seat].stack).toBe(finished.state.seats[seat].stack);
    }
    expect(s.getState().table.seats).not.toBe(startingStacks);
  });
});

/**
 * Per-seat auto top-up. Auto top-up is a SEAT preference, not one session-wide switch, and
 * every number below is the engine's: the store hands `applySeatAutoTopUps` the seats'
 * own policies and writes back exactly what comes out.
 */
describe('tableStore — per-seat auto top-up', () => {
  it('tops a seat below its own target up to exactly that target', () => {
    const s = topUpStore(tableWithStacks({}), { 0: at(100), 1: at(100), 2: at(100) });
    const settled = playOneHand(s);

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    // The hand really did leave someone short and someone ahead, or this proves nothing.
    expect(settled[0]).toBeLessThan(Money.fromBB(100));
    expect(settled[1]).toBeLessThan(Money.fromBB(100));
    for (const seat of [0, 1] as const) {
      expect(s.getState().table.seats[seat].stack).toBe(Money.fromBB(100));
    }
  });

  it('never trims a seat that is ABOVE its target', () => {
    const s = topUpStore(tableWithStacks({}), { 0: at(100), 1: at(100), 2: at(100) });
    const settled = playOneHand(s);

    // Seat 2 won the pot uncontested: it ends the hand ahead of its 100 BB target.
    expect(settled[2]).toBeGreaterThan(Money.fromBB(100));

    s.getState().startHand();

    // Top-up only ever ADDS chips. The winner's stack is the settled one, untouched.
    expect(s.getState().table.seats[2].stack).toBe(settled[2]);
    expect(s.getState().table.seats[2].stack).toBeGreaterThan(Money.fromBB(100));
  });

  it('applies two different targets in the same boundary', () => {
    const s = topUpStore(tableWithStacks({ 0: 50, 1: 30 }), { 0: at(60), 1: at(120) });
    const settled = playOneHand(s);
    expect(settled[0]).toBeLessThan(Money.fromBB(60));
    expect(settled[1]).toBeLessThan(Money.fromBB(120));

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[0].stack).toBe(Money.fromBB(60));
    expect(s.getState().table.seats[1].stack).toBe(Money.fromBB(120));
    // Seat 2 records no policy at all, so it is not considered.
    expect(s.getState().table.seats[2].stack).toBe(settled[2]);
  });

  it('leaves a seat switched OFF alone while its neighbour tops up', () => {
    const s = topUpStore(tableWithStacks({ 0: 50, 1: 50 }), {
      0: at(100, false),
      1: at(100, true),
    });
    const settled = playOneHand(s);

    s.getState().startHand();

    expect(s.getState().table.seats[0].stack).toBe(settled[0]);
    expect(s.getState().table.seats[0].stack).toBeLessThan(Money.fromBB(100));
    expect(s.getState().table.seats[1].stack).toBe(Money.fromBB(100));
  });

  it('does NOT top up a switched-off seat from the session-level default', () => {
    // The exact bug this feature removes: one session-wide switch overriding the seat.
    const s = topUpStore(
      tableWithStacks({ 0: 50, 1: 50 }),
      { 0: at(100, false), 1: at(100, true), 2: at(100, true) },
      at(100, true),
    );
    const settled = playOneHand(s);

    s.getState().startHand();

    expect(s.getState().autoTopUp).toEqual(at(100, true));
    expect(s.getState().table.seats[0].stack).toBe(settled[0]);
    expect(s.getState().table.seats[0].stack).toBeLessThan(Money.fromBB(100));
  });

  it('seeds a legacy session (no per-seat rows) from the session default', () => {
    const s = topUpStore(tableWithStacks({ 0: 50, 1: 50 }), {}, at(100, true));

    // Occupied seats only: an empty seat records nothing.
    expect(s.getState().seatAutoTopUp).toEqual({ 0: at(100), 1: at(100), 2: at(100) });
    expect(s.getState().seatAutoTopUp[3]).toBeUndefined();

    playOneHand(s);
    s.getState().startHand();

    expect(s.getState().table.seats[0].stack).toBe(Money.fromBB(100));
  });

  it('setSeatAutoTopUp writes the seat and touches nothing else', () => {
    const s = topUpStore(tableWithStacks({}), { 0: at(100) });
    s.getState().startHand();
    const hand = s.getState().hand;
    const view = s.getState().view;
    const table = s.getState().table;

    s.getState().setSeatAutoTopUp(1, at(75));

    expect(s.getState().seatAutoTopUp).toEqual({ 0: at(100), 1: at(75) });
    // The live hand is untouched: this is a preference, not a poker transition.
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().view).toBe(view);
    expect(s.getState().table).toBe(table);
    expect(s.getState().lastError).toBeNull();
  });

  it('setSeatAutoTopUp(seat, null) removes the seat’s entry', () => {
    const s = topUpStore(tableWithStacks({}), { 0: at(100), 1: at(100) });

    s.getState().setSeatAutoTopUp(0, null);

    expect(s.getState().seatAutoTopUp[0]).toBeUndefined();
    expect(s.getState().seatAutoTopUp[1]).toEqual(at(100));
  });

  it('a seat turned off through setSeatAutoTopUp stops being topped up', () => {
    const s = topUpStore(tableWithStacks({ 0: 50, 1: 50 }), { 0: at(100), 1: at(100) });
    s.getState().setSeatAutoTopUp(0, at(100, false));
    const settled = playOneHand(s);

    s.getState().startHand();

    expect(s.getState().table.seats[0].stack).toBe(settled[0]);
    expect(s.getState().table.seats[1].stack).toBe(Money.fromBB(100));
  });
});

describe('seedSeatAutoTopUp', () => {
  const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });

  it('seeds nothing at all when the session records no default', () => {
    expect(seedSeatAutoTopUp(table, null, {})).toEqual({});
  });

  it('seeds every occupied seat and no empty one', () => {
    expect(seedSeatAutoTopUp(table, at(100), {})).toEqual({
      0: at(100),
      1: at(100),
      2: at(100),
    });
  });

  it('never overwrites a seat that already has its own policy', () => {
    const stored = { 0: at(40, false) };
    expect(seedSeatAutoTopUp(table, at(100), stored)).toEqual({
      0: at(40, false),
      1: at(100),
      2: at(100),
    });
  });

  it('seeds a SITTING_OUT seat that still holds a player', () => {
    const sittingOut = unwrap(setSeatOccupancy(table, 2, 'SITTING_OUT'));
    expect(seedSeatAutoTopUp(sittingOut, at(100), {})[2]).toEqual(at(100));
  });

  it('returns the stored policies unchanged when there is nothing to seed', () => {
    const stored = { 0: at(100), 1: at(100), 2: at(100) };
    expect(seedSeatAutoTopUp(table, at(100), stored)).toBe(stored);
  });
});

// ---------------------------------------------------------------------------
// Seat occupancy — the `S` hotkey / table-side toggle (Work Package A1)
// ---------------------------------------------------------------------------

describe('tableStore — seat occupancy', () => {
  function sixHandedStore(): TableStore {
    return createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
  }

  /**
   * Folds every dealt-in seat but one, exactly as `playOneHand` does for three seats. The
   * count comes off the hand's OWN `dealtInSeats`, so this stays correct no matter how many
   * seats the hand was actually dealt.
   */
  function foldHandOut(s: TableStore): void {
    const toFold = s.getState().hand!.state.dealtInSeats.length - 1;
    for (let i = 0; i < toFold; i += 1) s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().view!.phase.kind).toBe('COMPLETE');
  }

  /**
   * ADR-0073 rewrote what a mid-hand sit-out MEANS. It used to be a preference that took
   * effect next hand (ADR-0057); it is now a report that the lineup already on screen is
   * wrong, so the hand is rebuilt immediately from the corrected one. The 6 -> 5 -> 4 -> 5
   * dealt-in sequence this test has always pinned is unchanged; WHEN each change lands is not.
   */
  it('runs a full 6 -> 5 -> 4 -> 5 dealt-in sequence, each change landing immediately', () => {
    const s = sixHandedStore();

    // Hand 1: nobody has sat out yet.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.getState().table.handNumber).toBe(0);

    // Marked away MID-HAND. The hand is rebuilt NOW, at the same hand number and the same
    // button — a correction, never a skip.
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[3].occupancy).toBe('SITTING_OUT');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);
    expect(s.getState().view!.seats[3].status).toBe('NOT_DEALT_IN');
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_OCCUPANCY',
      seat: 3,
      redealt: true,
      // Seat 3 is not the button, so the re-deal moved nothing.
      buttonMovedTo: null,
    });
    foldHandOut(s);
    // The COMPLETED hand settled 5-handed, because 5-handed is what it was rebuilt as.
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);

    // Hand 2: still 5-handed. The button rotates exactly once, here, at the real boundary.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(1);
    expect(s.getState().table.buttonSeat).toBe(1);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);
    s.getState().setSeatOccupancy(4, 'SITTING_OUT');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 5]);
    expect(s.getState().table.handNumber).toBe(1);
    foldHandOut(s);

    // Hand 3: 4-handed.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(2);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 5]);
    expect(s.getState().view!.seats[3].status).toBe('NOT_DEALT_IN');
    expect(s.getState().view!.seats[4].status).toBe('NOT_DEALT_IN');
    // Seat 3 returns while hand 3 is live — it rejoins THIS hand, which is rebuilt for it.
    s.getState().setSeatOccupancy(3, 'ACTIVE');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 5]);
    expect(s.getState().table.handNumber).toBe(2);
    foldHandOut(s);

    // Hand 4: 5-handed. Seat 3 is back; seat 4 is still out.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(3);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 5]);
    expect(s.getState().view!.seats[3].status).not.toBe('NOT_DEALT_IN');
    expect(s.getState().view!.seats[4].status).toBe('NOT_DEALT_IN');
  });

  it('a toggle mid-hand rebuilds hand and view from the corrected lineup', () => {
    const s = sixHandedStore();
    s.getState().startHand();
    const { hand, view, table } = s.getState();

    s.getState().setSeatOccupancy(2, 'SITTING_OUT');

    expect(s.getState().hand).not.toBe(hand);
    expect(s.getState().view).not.toBe(view);
    expect(s.getState().table).not.toBe(table);
    expect(s.getState().table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(s.getState().lastError).toBeNull();
    // `view` is still exactly `toView(hand)` — the rebase goes through the same commit rule.
    expect(s.getState().view).toEqual(toView(s.getState().hand!));
  });

  it('keeps the button where it is when the button seat sits out, and the next deal moves it on', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    s.getState().startHand();
    foldHandOut(s);
    expect(s.getState().table.buttonSeat).toBe(0);

    s.getState().setSeatOccupancy(0, 'SITTING_OUT');
    // Occupancy is not rotation state: the button stays on the seat rotation counts FROM.
    expect(s.getState().table.buttonSeat).toBe(0);

    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    // `advanceButton` searches clockwise from seat 0, which is now sitting out: seat 1.
    expect(s.getState().table.buttonSeat).toBe(1);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([1, 2]);
  });

  /**
   * R1/B2. The button seat sits out BEFORE the page session has dealt anything, so
   * `startHand` has no completed hand to run the between-hands sequence off. The deal must
   * still happen, with the button on the next eligible seat clockwise.
   */
  it('deals after the button seat sits out before the FIRST hand of the session', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 3 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    expect(s.getState().table.buttonSeat).toBe(3);

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand).not.toBeNull();
    expect(s.getState().table.buttonSeat).toBe(4);
    expect(s.getState().hand!.state.buttonSeat).toBe(4);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);
  });

  it('deals after the button seat sits out before the first hand — wrapping past seat 5', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 5 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    s.getState().setSeatOccupancy(5, 'SITTING_OUT');
    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4]);
  });

  it('a net-zero sit-out/sit-in before the first hand leaves the chosen button untouched', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 3 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    s.getState().setSeatOccupancy(3, 'ACTIVE');
    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(3);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);
  });

  /**
   * R1/M2. `S` then `S` on the button seat is a net-zero user action, so the next hand's
   * button must land exactly where plain rotation would have put it.
   */
  it('a net-zero sit-out/sit-in on the button seat does not move the next button', () => {
    function nextButtonAfterOneHand(roundTrip: boolean): SeatIndex | null {
      const s = createTableStore({
        sessionId: 'session-1',
        table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 3 }),
        autoTopUp: null,
        ids: sequentialIdFactory('test'),
      });
      s.getState().startHand();
      foldHandOut(s);
      if (roundTrip) {
        s.getState().setSeatOccupancy(3, 'SITTING_OUT');
        s.getState().setSeatOccupancy(3, 'ACTIVE');
        expect(s.getState().table.buttonSeat).toBe(3);
      }
      s.getState().startHand();
      expect(s.getState().lastError).toBeNull();
      expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);
      return s.getState().table.buttonSeat;
    }

    expect(nextButtonAfterOneHand(false)).toBe(4);
    expect(nextButtonAfterOneHand(true)).toBe(4);
  });

  /**
   * R1/B2 + M2 together, now under ADR-0073: the 6 -> 5 -> 4 -> 5 sequence with the BUTTON
   * among the sit-outs, every sit-out landing MID-HAND.
   *
   * Sitting the button seat out never moves `buttonSeat` itself (ADR-0058). What moves it is
   * the DEAL, and a rebase re-deals — so the badge advances clockwise at that moment through
   * exactly the rule `startHand` uses, and never rotates a second time for the same hand.
   */
  it('runs a 6 -> 5 -> 4 -> 5 sequence with the button seat among the sit-outs', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 2 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    // Hand 1: 6-handed on the chosen button, sat out BEFORE any deal and put back. With no
    // hand in progress there is nothing to rebuild, so no notice is raised.
    s.getState().setSeatOccupancy(2, 'SITTING_OUT');
    s.getState().setSeatOccupancy(2, 'ACTIVE');
    expect(s.getState().rebaseNotice).toBeNull();
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);

    // The BUTTON seat is marked away mid-hand. The re-deal cannot deal off a seat that is not
    // dealt in, so the badge advances clockwise 2 -> 3 at deal time — once, not twice, and the
    // hand number does not move.
    s.getState().setSeatOccupancy(2, 'SITTING_OUT');
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(3);
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 3, 4, 5]);
    foldHandOut(s);

    // Hand 2: 5-handed, button clockwise from 3 -> 4 at the real hand boundary.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(1);
    expect(s.getState().table.buttonSeat).toBe(4);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 3, 4, 5]);

    // A NON-button seat sits out mid-hand: the button does not move at all.
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    expect(s.getState().table.buttonSeat).toBe(4);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 4, 5]);
    foldHandOut(s);

    // Hand 3: 4-handed, button clockwise from 4 -> 5.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(2);
    expect(s.getState().table.buttonSeat).toBe(5);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 4, 5]);

    // Seat 2 comes back mid-hand and rejoins immediately.
    s.getState().setSeatOccupancy(2, 'ACTIVE');
    expect(s.getState().table.buttonSeat).toBe(5);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);
    foldHandOut(s);

    // Hand 4: 5-handed, button clockwise from 5 -> 0.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(3);
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);
  });

  /**
   * A table that genuinely has NO button (a legacy or hand-built state) must fail loudly.
   * `startHand` never invents one: the engine's own `NO_BUTTON_SEAT` reaches `lastError`.
   */
  it('surfaces NO_BUTTON_SEAT rather than picking a button for a table that has none', () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const s = createTableStore({
      sessionId: 'session-1',
      table: { ...table, buttonSeat: null },
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    s.getState().startHand();

    expect(s.getState().lastError?.code).toBe('NO_BUTTON_SEAT');
    expect(s.getState().hand).toBeNull();
    expect(s.getState().table.buttonSeat).toBeNull();
  });

  it('refuses to toggle an EMPTY seat and surfaces SEAT_EMPTY without touching the table', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    expect(s.getState().table.seats[5].occupancy).toBe('EMPTY');
    const before = s.getState().table;

    s.getState().setSeatOccupancy(5, 'SITTING_OUT');

    expect(s.getState().lastError?.code).toBe('SEAT_EMPTY');
    expect(s.getState().table).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Skip Hand (feature A) and quick manual seat sync (feature B)
// ---------------------------------------------------------------------------

describe('tableStore — skipHand', () => {
  it('discards the live hand, advances handNumber and the button by exactly one, and marks the dealt-in seats dirty', () => {
    const s = store(); // three-handed, seats 0/1/2, button on 0
    s.getState().startHand();
    const dealtIn = s.getState().hand!.state.dealtInSeats;
    const handNumberBefore = s.getState().table.handNumber;
    const buttonBefore = s.getState().table.buttonSeat;
    const stacksBefore = s.getState().table.seats;

    s.getState().skipHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand).toBeNull();
    expect(s.getState().view).toBeNull();
    expect(s.getState().table.handNumber).toBe(handNumberBefore + 1);
    // `advanceButton`'s own rule: clockwise from the current button to the next dealt-in seat.
    expect(s.getState().table.buttonSeat).toBe(1);
    expect(s.getState().table.buttonSeat).not.toBe(buttonBefore);
    // No result was ever settled: no seat's stack changed.
    expect(s.getState().table.seats).toBe(stacksBefore);
    expect(new Set(s.getState().dirtySeats)).toEqual(new Set(dealtIn));
  });

  it('is a no-op error when there is no live hand', () => {
    const s = store();
    const tableBefore = s.getState().table;

    s.getState().skipHand();

    expect(s.getState().lastError?.code).toBe('NOT_BETTING_PHASE');
    expect(s.getState().hand).toBeNull();
    expect(s.getState().table).toBe(tableBefore);
    expect(s.getState().dirtySeats.size).toBe(0);
  });

  it('refuses a hand that already reached COMPLETE — that is startHand’s job, not this one', () => {
    const s = store();
    s.getState().startHand();
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().view!.phase.kind).toBe('COMPLETE');
    const handBefore = s.getState().hand;
    const tableBefore = s.getState().table;

    s.getState().skipHand();

    expect(s.getState().lastError?.code).toBe('HAND_ALREADY_FINISHED');
    expect(s.getState().hand).toBe(handBefore);
    expect(s.getState().table).toBe(tableBefore);
  });

  it('never touches useCompletedHandSaves’ trigger — the hand never reaches COMPLETE', () => {
    const s = store();
    s.getState().startHand();
    s.getState().skipHand();
    // The only observable surface `useCompletedHandSaves` watches is `hand`, and this is null.
    expect(s.getState().hand).toBeNull();
  });
});

describe('tableStore — correctSeatStack / correctSeatButton', () => {
  it('correctSeatStack updates the seat and clears its dirty flag', () => {
    const s = store();
    s.getState().startHand();
    s.getState().skipHand();
    expect(s.getState().dirtySeats.has(1)).toBe(true);

    s.getState().correctSeatStack(1, Money.fromBB(37));

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[1].stack).toBe(Money.fromBB(37));
    expect(s.getState().dirtySeats.has(1)).toBe(false);
    // A seat NOT corrected stays dirty.
    expect(s.getState().dirtySeats.has(0)).toBe(true);
  });

  it('correctSeatStack refuses a non-positive or non-integer value and touches nothing', () => {
    const s = store();
    const tableBefore = s.getState().table;

    s.getState().correctSeatStack(1, -1 as MilliBB);
    expect(s.getState().lastError?.code).toBe('STACK_NOT_POSITIVE');
    expect(s.getState().table).toBe(tableBefore);

    // ZERO is a real ENGINE state (a busted seat) but not a real RESYNC: an empty or mistyped
    // field must not silently bust a seat. The client refuses exactly what the server refuses.
    s.getState().correctSeatStack(1, Money.ZERO);
    expect(s.getState().lastError?.code).toBe('STACK_NOT_POSITIVE');
    expect(s.getState().table).toBe(tableBefore);

    s.getState().correctSeatStack(1, 1500.5 as MilliBB);
    expect(s.getState().lastError?.code).toBe('AMOUNT_OUT_OF_RANGE');
    expect(s.getState().table).toBe(tableBefore);
  });

  it('correctSeatButton updates table.buttonSeat', () => {
    const s = store();
    expect(s.getState().table.buttonSeat).toBe(0);

    s.getState().correctSeatButton(2);

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(2);
  });

  it('correctSeatButton refuses an empty seat and leaves the button untouched', () => {
    const s = store();

    s.getState().correctSeatButton(5);

    expect(s.getState().lastError?.code).toBe('SEAT_EMPTY');
    expect(s.getState().table.buttonSeat).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CORRECTION (rebase) — WP-1/2/6, ADR-0073. The opposite event from a skip.
// ---------------------------------------------------------------------------

describe('tableStore — correction rebase (ADR-0073)', () => {
  function sixHanded(): TableStore {
    return createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
  }

  /**
   * The load-bearing distinction. A correction is NOT a hand that happened: the hand number
   * must not move, the button must not rotate, and nothing may enter the `skipped_hands`
   * audit path (whose only store-side surface is `lastSkip`).
   */
  it('is not a skip: no handNumber advance, no button rotation, no audit fact', () => {
    const s = sixHanded();
    s.getState().startHand();
    const handNumberBefore = s.getState().table.handNumber;

    s.getState().setSeatOccupancy(4, 'SITTING_OUT');

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(handNumberBefore);
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().hand!.state.handNumber).toBe(handNumberBefore);
    // The audit row is only ever produced by `skipHand`.
    expect(s.getState().lastSkip).toBeNull();
    // No seat is marked "확인 필요": nobody's chips moved.
    expect(s.getState().dirtySeats.size).toBe(0);
  });

  it('rebuilds blinds, positions and action order from the corrected lineup', () => {
    const s = sixHanded();
    s.getState().startHand();
    // Button 0 -> SB 1, BB 2, and UTG (seat 3) is first to act.
    expect(s.getState().view!.smallBlindSeat).toBe(1);
    expect(s.getState().view!.bigBlindSeat).toBe(2);
    expect(s.getState().view!.seats[3].isActor).toBe(true);
    const potBefore = s.getState().view!.pot;

    // The small blind was never actually at the table.
    s.getState().setSeatOccupancy(1, 'SITTING_OUT');

    const view = s.getState().view!;
    expect(view.seats[1].status).toBe('NOT_DEALT_IN');
    // SB/BB slide onto the new lineup, so the actor and the posted money both change.
    expect(view.seats[1].position).toBeNull();
    expect(view.smallBlindSeat).toBe(2);
    expect(view.bigBlindSeat).toBe(3);
    expect(view.seats[3].isActor).toBe(false);
    expect(view.seats[4].isActor).toBe(true);
    expect(view.pot).not.toBe(potBefore);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 2, 3, 4, 5]);
  });

  it('discards every action, card and board of the hand it rebuilds — never splices', () => {
    const s = sixHanded();
    s.getState().startHand();
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    const before = s.getState().hand!;
    expect(before.state.seats[3].status).toBe('FOLDED');
    expect(before.state.seats[4].status).toBe('FOLDED');
    const eventsBefore = before.events.length;

    s.getState().setSeatOccupancy(5, 'SITTING_OUT');

    const after = s.getState().hand!;
    expect(after.state.handId).not.toBe(before.state.handId);
    // Nobody has folded in the rebuilt hand: the fold history did not survive.
    expect(after.state.seats[3].status).not.toBe('FOLDED');
    expect(after.state.seats[4].status).not.toBe('FOLDED');
    // A rebuilt hand is a FRESH log — posts only, never the old log with a seat spliced out.
    expect(after.events.length).toBeLessThan(eventsBefore);
    expect(after.state.board).toEqual([]);
  });

  it('keeps the corrected table and reports the engine refusal when it cannot re-deal', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    s.getState().startHand();
    s.getState().setSeatOccupancy(2, 'SITTING_OUT');
    expect(s.getState().hand).not.toBeNull();

    // Down to one dealt-in seat: the engine cannot deal, and nothing is invented to help it.
    s.getState().setSeatOccupancy(1, 'SITTING_OUT');

    expect(s.getState().lastError?.code).toBe('NOT_ENOUGH_PLAYERS');
    expect(s.getState().hand).toBeNull();
    expect(s.getState().view).toBeNull();
    // The correction itself SURVIVES — the user's statement about the table is not rolled back.
    expect(s.getState().table.seats[1].occupancy).toBe('SITTING_OUT');
    expect(s.getState().table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_OCCUPANCY',
      seat: 1,
      redealt: false,
      // Nothing was dealt, so nothing advanced a button.
      buttonMovedTo: null,
    });
  });

  it('rejects an impossible change without touching the live hand at all', () => {
    const s = sixHanded();
    s.getState().startHand();
    const hand = s.getState().hand;
    const table = s.getState().table;

    // Seat 5 is occupied here, so use the genuinely empty case: a three-handed table.
    const t = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    t.getState().startHand();
    const liveHand = t.getState().hand;

    t.getState().setSeatOccupancy(5, 'SITTING_OUT');

    expect(t.getState().lastError?.code).toBe('SEAT_EMPTY');
    expect(t.getState().hand).toBe(liveHand);
    expect(t.getState().rebaseNotice).toBeNull();

    // ...and the six-handed store is untouched by all of that.
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().table).toBe(table);
  });

  it('correctSeatButton rebases onto the named seat without rotating or counting a hand', () => {
    const s = sixHanded();
    s.getState().startHand();
    expect(s.getState().hand!.state.buttonSeat).toBe(0);

    s.getState().correctSeatButton(4);

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(4);
    // The hand itself is rebuilt with the corrected button — not just the badge.
    expect(s.getState().hand!.state.buttonSeat).toBe(4);
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().lastSkip).toBeNull();
    expect(s.getState().dirtySeats.size).toBe(0);
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'BUTTON_SEAT',
      seat: 4,
      redealt: true,
      // The user moved the button themselves; the DEAL moved nothing, so there is nothing
      // to announce (ADR-0078(c) reports the deal-time advance only).
      buttonMovedTo: null,
    });
  });

  it('dismissRebaseNotice clears the notice and nothing else', () => {
    const s = sixHanded();
    s.getState().startHand();
    s.getState().setSeatOccupancy(4, 'SITTING_OUT');
    const hand = s.getState().hand;

    s.getState().dismissRebaseNotice();

    expect(s.getState().rebaseNotice).toBeNull();
    expect(s.getState().hand).toBe(hand);
  });

  it('makes no notice and no rebuild when there is no live hand', () => {
    const s = sixHanded();
    s.getState().setSeatOccupancy(4, 'SITTING_OUT');
    expect(s.getState().rebaseNotice).toBeNull();
    expect(s.getState().hand).toBeNull();
    expect(s.getState().table.seats[4].occupancy).toBe('SITTING_OUT');
  });

  /**
   * A COMPLETE hand is a real result awaiting `startHand`'s settle path (and possibly
   * `useCompletedHandSaves`). Rebuilding it would destroy a hand that actually happened.
   */
  it('does not rebuild a hand that already reached COMPLETE', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    s.getState().startHand();
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    const finished = s.getState().hand;
    expect(finished!.state.phase).toBe('COMPLETE');

    s.getState().setSeatOccupancy(2, 'SITTING_OUT');

    expect(s.getState().hand).toBe(finished);
    expect(s.getState().rebaseNotice).toBeNull();
    expect(s.getState().table.seats[2].occupancy).toBe('SITTING_OUT');
  });
});

// ---------------------------------------------------------------------------
// Player replacement — WP-2
// ---------------------------------------------------------------------------

describe('tableStore — replaceSeatPlayer', () => {
  const newcomer = asId<'Player'>('player-newcomer') as PlayerId;

  function sixHanded(): TableStore {
    return createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 2 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
  }

  it('marks the seat dirty — the new occupant’s stack is unknown, never inherited silently', () => {
    const s = sixHanded();
    const stackBefore = s.getState().table.seats[4].stack;

    s.getState().replaceSeatPlayer(4, newcomer);

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[4].playerId).toBe(newcomer);
    // The stack is left as it was AND flagged — it is displayed, but not trusted.
    expect(s.getState().table.seats[4].stack).toBe(stackBefore);
    expect(s.getState().dirtySeats.has(4)).toBe(true);
    expect(s.getState().dirtySeats.size).toBe(1);
  });

  it('naming the player already in the seat does nothing at all', () => {
    const s = sixHanded();
    s.getState().startHand();
    const { table, hand, view } = s.getState();

    s.getState().replaceSeatPlayer(4, testPlayerId(4));

    expect(s.getState().table).toBe(table);
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().view).toBe(view);
    expect(s.getState().dirtySeats.size).toBe(0);
    expect(s.getState().rebaseNotice).toBeNull();
  });

  it('never moves the button or the hero pointer', () => {
    const s = sixHanded();
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().table.heroSeat).toBe(0);

    // Both the button seat and the hero seat change hands.
    s.getState().replaceSeatPlayer(2, newcomer);
    s.getState().replaceSeatPlayer(0, asId<'Player'>('player-other') as PlayerId);

    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().table.heroSeat).toBe(0);
  });

  it('rebases a live hand at the same hand number and button', () => {
    const s = sixHanded();
    s.getState().startHand();
    const before = s.getState().hand!;

    s.getState().replaceSeatPlayer(4, newcomer);

    const after = s.getState().hand!;
    expect(after.state.handId).not.toBe(before.state.handId);
    expect(after.state.seats[4].playerId).toBe(newcomer);
    expect(after.state.handNumber).toBe(before.state.handNumber);
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().lastSkip).toBeNull();
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_PLAYER',
      seat: 4,
      redealt: true,
      buttonMovedTo: null,
    });
  });

  it('refuses an EMPTY seat and leaves the table alone', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    const before = s.getState().table;

    s.getState().replaceSeatPlayer(5, newcomer);

    expect(s.getState().lastError?.code).toBe('SEAT_EMPTY');
    expect(s.getState().table).toBe(before);
    expect(s.getState().dirtySeats.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// QUICK NEXT HAND accounting — WP-4, ADR-0074
// ---------------------------------------------------------------------------

describe('tableStore — quick next hand accounting (ADR-0074)', () => {
  function sixHanded(): TableStore {
    return createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
  }

  /**
   * Button 0 -> SB 1, BB 2, and preflop runs 3, 4, 5, 0, 1, 2. UTG calls so the big blind
   * still has its option and the hand stays LIVE after the folds; hero (seat 0) and the small
   * blind both fold, which gives one folded seat that paid only an ante and one that paid a
   * blind on top of it.
   */
  function foldedAroundToTheBigBlind(s: TableStore): void {
    s.getState().startHand();
    s.getState().apply({ kind: 'CALL' }); // seat 3
    s.getState().apply({ kind: 'FOLD' }); // seat 4
    s.getState().apply({ kind: 'FOLD' }); // seat 5
    s.getState().apply({ kind: 'FOLD' }); // seat 0 — hero
    s.getState().apply({ kind: 'FOLD' }); // seat 1 — small blind
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().view!.phase.kind).toBe('AWAITING_ACTION');
  }

  it('settles every FOLDED seat to exactly startingStack - totalContribution, not dirty', () => {
    const s = sixHanded();
    foldedAroundToTheBigBlind(s);
    const hand = s.getState().hand!;
    const tableBefore = s.getState().table;

    s.getState().skipHand();

    expect(s.getState().lastError).toBeNull();
    for (const seat of [4, 5, 0, 1] as const) {
      const handSeat = hand.state.seats[seat];
      expect(handSeat.status).toBe('FOLDED');
      // Non-trivial: each of these seats really did put chips in and really did lose them.
      expect(handSeat.totalContribution).toBeGreaterThan(0);
      expect(s.getState().table.seats[seat].stack).toBe(
        Money.sub(handSeat.startingStack, handSeat.totalContribution),
      );
      expect(s.getState().table.seats[seat].stack).toBeLessThan(tableBefore.seats[seat].stack);
      expect(s.getState().dirtySeats.has(seat)).toBe(false);
    }
    // The small blind paid strictly more than the antes-only seats, and it shows.
    expect(s.getState().table.seats[1].stack).toBeLessThan(s.getState().table.seats[4].stack);
  });

  it('leaves every other dealt-in seat’s stack alone and marks it dirty', () => {
    const s = sixHanded();
    foldedAroundToTheBigBlind(s);
    const tableBefore = s.getState().table;

    s.getState().skipHand();

    // Seat 3 called, seat 2 is the big blind with its option: both outcomes are unknown.
    for (const seat of [2, 3] as const) {
      expect(s.getState().table.seats[seat].stack).toBe(tableBefore.seats[seat].stack);
      expect(s.getState().dirtySeats.has(seat)).toBe(true);
    }
    expect(new Set(s.getState().dirtySeats)).toEqual(new Set<SeatIndex>([2, 3]));
  });

  it('never touches a seat that was not dealt in', () => {
    const s = sixHanded();
    s.getState().setSeatOccupancy(5, 'SITTING_OUT');
    s.getState().startHand();
    const tableBefore = s.getState().table;
    expect(s.getState().hand!.state.dealtInSeats).not.toContain(5);

    s.getState().skipHand();

    expect(s.getState().table.seats[5].stack).toBe(tableBefore.seats[5].stack);
    expect(s.getState().dirtySeats.has(5)).toBe(false);
  });

  it('rotates the button exactly once and advances handNumber by exactly one', () => {
    const s = sixHanded();
    foldedAroundToTheBigBlind(s);
    const handNumberBefore = s.getState().table.handNumber;

    s.getState().skipHand();

    expect(s.getState().table.handNumber).toBe(handNumberBefore + 1);
    // Clockwise from 0 to the next dealt-in seat, once. Seat 1 is still occupied and ACTIVE.
    expect(s.getState().table.buttonSeat).toBe(1);
  });

  it('derives HERO_FOLDED_UNOBSERVED when hero was dealt in and folded', () => {
    const s = sixHanded();
    foldedAroundToTheBigBlind(s);
    const skippedNumber = s.getState().hand!.state.handNumber;

    s.getState().skipHand();

    expect(s.getState().lastSkip).toEqual({
      handNumber: skippedNumber,
      reason: 'HERO_FOLDED_UNOBSERVED',
    });
  });

  it('derives QUICK_SKIP while hero is still live', () => {
    const s = sixHanded();
    s.getState().startHand();
    s.getState().apply({ kind: 'FOLD' }); // seat 3
    s.getState().apply({ kind: 'FOLD' }); // seat 4
    expect(s.getState().view!.seats[5].isActor).toBe(true);
    expect(s.getState().hand!.state.seats[0].status).toBe('IN_HAND');

    s.getState().skipHand();

    expect(s.getState().lastSkip?.reason).toBe('QUICK_SKIP');
    // Hero gets no special treatment either way: still live means still dirty.
    expect(s.getState().dirtySeats.has(0)).toBe(true);
  });

  it('derives QUICK_SKIP when hero was not dealt in at all', () => {
    const s = sixHanded();
    s.getState().setSeatOccupancy(0, 'SITTING_OUT');
    s.getState().startHand();
    expect(s.getState().hand!.state.seats[0].status).toBe('NOT_DEALT_IN');

    s.getState().skipHand();

    expect(s.getState().lastSkip?.reason).toBe('QUICK_SKIP');
    expect(s.getState().dirtySeats.has(0)).toBe(false);
  });

  it('does not clear a dirty mark left by an EARLIER unobserved hand', () => {
    const s = sixHanded();
    // Hand 1 leaves seat 2 unconfirmed.
    s.getState().startHand();
    s.getState().skipHand();
    expect(s.getState().dirtySeats.has(2)).toBe(true);

    // Hand 2: seat 2 folds, so THIS hand's arithmetic for it is exact — but the number it
    // was computed from is still one the user never confirmed.
    foldedAroundToTheBigBlind(s);
    s.getState().skipHand();

    expect(s.getState().dirtySeats.has(2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nextDirtySeat — the resync focus order (WP-5)
// ---------------------------------------------------------------------------

describe('nextDirtySeat', () => {
  const dirty = new Set<SeatIndex>([4, 1, 5]);

  it('walks ascending physical seat order, not Set insertion order', () => {
    expect(nextDirtySeat(dirty)).toBe(1);
    expect(nextDirtySeat(dirty, 1)).toBe(4);
    expect(nextDirtySeat(dirty, 4)).toBe(5);
  });

  it('wraps exactly once past seat 5', () => {
    expect(nextDirtySeat(dirty, 5)).toBe(1);
  });

  it('returns null when nothing is dirty, and the seat itself when it is the only one', () => {
    expect(nextDirtySeat(new Set<SeatIndex>())).toBeNull();
    expect(nextDirtySeat(new Set<SeatIndex>(), 3)).toBeNull();
    expect(nextDirtySeat(new Set<SeatIndex>([3]), 3)).toBe(3);
  });

  it('is the store’s own dirty set, in a deterministic order', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    s.getState().startHand();
    s.getState().skipHand();

    const walked: SeatIndex[] = [];
    let seat = nextDirtySeat(s.getState().dirtySeats);
    while (seat !== null && walked.length < 6) {
      walked.push(seat);
      seat = nextDirtySeat(s.getState().dirtySeats, seat);
      if (seat === walked[0]) break;
    }
    expect(walked).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

/**
 * `seatPlayer` — somebody sits down at an EMPTY seat (WP-2).
 *
 * The counterpart to `replaceSeatPlayer`, and the one that closes the gap that forced the
 * table to tell the user to reload: the in-memory table can now hold the player the server
 * just seated, so the ordinary seat-state write applies to this case like any other.
 *
 * Every refusal below belongs to `poker-core`'s own `seatPlayer` and is asserted here only to
 * prove the store surfaces it rather than swallowing it or pre-empting it with a second rule.
 */
describe('tableStore — seatPlayer', () => {
  const newcomer = asId<'Player'>('player-newcomer') as PlayerId;

  /** Seats 0/1/2 occupied, 3/4/5 EMPTY. Hero is seat 0, the button is seat 0. */
  function withEmptySeats(): TableStore {
    return createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
  }

  it('fills an EMPTY seat with the counted stack, and does NOT mark it dirty', () => {
    const s = withEmptySeats();
    expect(s.getState().table.seats[4].occupancy).toBe('EMPTY');

    s.getState().seatPlayer(4, newcomer, Money.fromBB(63.5));

    expect(s.getState().lastError).toBeNull();
    const seat = s.getState().table.seats[4];
    expect(seat.occupancy).toBe('ACTIVE');
    expect(seat.playerId).toBe(newcomer);
    expect(seat.stack).toBe(Money.fromBB(63.5));
    // The user supplied the actual figure in this very call, so asking them to confirm it
    // again would be asking them to re-enter what they just entered.
    expect(s.getState().dirtySeats.size).toBe(0);
  });

  it('leaves the button and the hero pointer exactly where they were', () => {
    const s = withEmptySeats();
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().table.heroSeat).toBe(0);

    s.getState().seatPlayer(5, newcomer, Money.fromBB(100));

    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().table.heroSeat).toBe(0);
  });

  it('makes no notice and touches no hand when there is none in progress', () => {
    const s = withEmptySeats();

    s.getState().seatPlayer(3, newcomer, Money.fromBB(100));

    expect(s.getState().rebaseNotice).toBeNull();
    expect(s.getState().hand).toBeNull();
  });

  it('REBASES a live hand at the same hand number and the same button (ADR-0073)', () => {
    const s = withEmptySeats();
    s.getState().startHand();
    const before = s.getState().hand;
    expect(before).not.toBeNull();
    const handNumberBefore = before!.state.handNumber;
    const buttonBefore = s.getState().table.buttonSeat;
    expect(toView(before!).seats[3].status).toBe('NOT_DEALT_IN');

    s.getState().seatPlayer(3, newcomer, Money.fromBB(100));

    const after = s.getState().hand;
    expect(s.getState().lastError).toBeNull();
    expect(after).not.toBeNull();
    // A CORRECTION, not a skip: the number does not move and the button does not rotate.
    expect(after!.state.handNumber).toBe(handNumberBefore);
    expect(s.getState().table.buttonSeat).toBe(buttonBefore);
    // The hand was rebuilt WHOLE, not spliced: the new seat is dealt in from the start.
    expect(after).not.toBe(before);
    expect(s.getState().view!.seats[3].status).not.toBe('NOT_DEALT_IN');
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_SEATED',
      seat: 3,
      redealt: true,
      buttonMovedTo: null,
    });
    // Still not dirty, even through a rebase.
    expect(s.getState().dirtySeats.size).toBe(0);
  });

  it('refuses an OCCUPIED seat with the engine’s own code, changing nothing', () => {
    const s = withEmptySeats();
    const table = s.getState().table;

    s.getState().seatPlayer(1, newcomer, Money.fromBB(100));

    expect(s.getState().lastError?.code).toBe('SEAT_OCCUPIED');
    expect(s.getState().table).toBe(table);
  });

  it('refuses a non-positive stack, and never seats anybody for one', () => {
    const s = withEmptySeats();

    s.getState().seatPlayer(3, newcomer, 0 as MilliBB);

    expect(s.getState().lastError?.code).toBe('STACK_NOT_POSITIVE');
    expect(s.getState().table.seats[3].occupancy).toBe('EMPTY');

    s.getState().seatPlayer(3, newcomer, -1000 as MilliBB);

    expect(s.getState().lastError?.code).toBe('STACK_NOT_POSITIVE');
    expect(s.getState().table.seats[3].occupancy).toBe('EMPTY');
  });

  it('refuses a non-integer milliBB stack', () => {
    const s = withEmptySeats();

    s.getState().seatPlayer(3, newcomer, 1000.5 as MilliBB);

    expect(s.getState().lastError?.code).toBe('AMOUNT_OUT_OF_RANGE');
    expect(s.getState().table.seats[3].occupancy).toBe('EMPTY');
  });

  it('leaves a LIVE hand completely untouched when the engine refuses', () => {
    const s = withEmptySeats();
    s.getState().startHand();
    const { table, hand, view } = s.getState();

    s.getState().seatPlayer(3, newcomer, 0 as MilliBB);

    expect(s.getState().lastError?.code).toBe('STACK_NOT_POSITIVE');
    expect(s.getState().table).toBe(table);
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().view).toBe(view);
    expect(s.getState().rebaseNotice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The deal-time button advance is ANNOUNCED, not repaired — ADR-0078(c)
// ---------------------------------------------------------------------------

describe('tableStore — a rebase that moves the button says so (ADR-0078(c))', () => {
  /**
   * There is exactly ONE deal rule (ADR-0058(c)): a button that is not dealt in advances
   * clockwise at the moment of dealing. Reached MID-HAND through a rebase that advance is
   * permanent — sitting the button seat back in does not bring the button back, because
   * nothing in the deal path ever rotates backwards.
   *
   * This test pins that asymmetry deliberately. It is not a defect to be fixed here: fixing it
   * would mean a second deal rule for rebases, which is exactly what ADR-0078(c) refuses. What
   * it demands instead is that the move be VISIBLE, so the notice names the new button seat
   * and the user can undo it with `correctSeatButton` (`[버튼으로 지정]`, WP-6).
   */
  it('advances the button when the button seat sits out, and does not bring it back on sit-in', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 2 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    s.getState().startHand();
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3]);

    // The BUTTON seat is marked away mid-hand: the re-deal cannot deal off it, so the badge
    // advances 2 -> 3 — and the notice carries the new seat rather than leaving it silent.
    s.getState().setSeatOccupancy(2, 'SITTING_OUT');

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(3);
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().hand!.state.buttonSeat).toBe(3);
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_OCCUPANCY',
      seat: 2,
      redealt: true,
      buttonMovedTo: 3,
    });

    // Sitting back in re-deals from a button that IS dealt in, so the deal moves nothing —
    // the button stays on 3. Pinned as the accepted behaviour, not as a wish.
    s.getState().setSeatOccupancy(2, 'ACTIVE');

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(3);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3]);
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_OCCUPANCY',
      seat: 2,
      redealt: true,
      buttonMovedTo: null,
    });

    // ...and `[버튼으로 지정]` is the documented way back, with nothing to announce because
    // the user moved it themselves.
    s.getState().correctSeatButton(2);
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().rebaseNotice?.buttonMovedTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A stack correction is a lineup correction — ADR-0078(a)
// ---------------------------------------------------------------------------

describe('tableStore — correctSeatStack while a hand is live (ADR-0078(a))', () => {
  it('rebases at the same hand number and re-deals from the corrected stack', () => {
    const s = store(); // three-handed, 100 BB each, button 0
    s.getState().startHand();
    const before = s.getState().hand!;
    expect(before.state.seats[2].startingStack).toBe(Money.fromBB(100));

    s.getState().correctSeatStack(2, Money.fromBB(42));

    const after = s.getState().hand!;
    expect(s.getState().lastError).toBeNull();
    // A rebase, not a splice: a brand-new hand at the SAME number, no rotation, no audit fact.
    expect(after.state.handId).not.toBe(before.state.handId);
    expect(after.state.handNumber).toBe(before.state.handNumber);
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().lastSkip).toBeNull();
    // The corrected number is what the replacement hand was DEALT from — the value shown and
    // the value edited are finally the same number.
    expect(after.state.seats[2].startingStack).toBe(Money.fromBB(42));
    expect(s.getState().table.seats[2].stack).toBe(Money.fromBB(42));
    expect(s.getState().rebaseNotice).toEqual({
      trigger: 'SEAT_STACK',
      seat: 2,
      redealt: true,
      buttonMovedTo: null,
    });
  });

  /**
   * The MAJOR itself (`CLAUDE.md` rule 3). Before ADR-0078(a) the correction landed on `table`
   * only, and the next settlement wrote it back over from the hand's own `startingStack` — the
   * user's 42 BB replaced by a number derived from the 100 BB the hand had been dealt from.
   *
   * Asserted against a CONTROL store that simply started at 42 BB, so the claim is the strong
   * one — a mid-hand correction is indistinguishable from having been right all along — and it
   * stays rake- and ante-independent.
   */
  it('the corrected number survives the next settlement instead of being overwritten', () => {
    const corrected = store();
    corrected.getState().startHand();
    corrected.getState().correctSeatStack(2, Money.fromBB(42));
    corrected.getState().apply({ kind: 'FOLD' });
    corrected.getState().apply({ kind: 'FOLD' });
    expect(corrected.getState().view!.phase.kind).toBe('COMPLETE');
    corrected.getState().startHand(); // settles the completed hand, then deals the next
    expect(corrected.getState().lastError).toBeNull();

    const control = createTableStore({
      sessionId: 'session-1',
      table: tableWithStacks({ 2: 42 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    control.getState().startHand();
    control.getState().apply({ kind: 'FOLD' });
    control.getState().apply({ kind: 'FOLD' });
    control.getState().startHand();

    expect(corrected.getState().table.seats[2].stack).toBe(
      control.getState().table.seats[2].stack,
    );
    // And it really is a 42-BB-derived number, not the ~100 BB one the ORIGINAL hand held.
    expect(corrected.getState().table.seats[2].stack).toBeLessThan(Money.fromBB(50));
    expect(corrected.getState().table.handNumber).toBe(1);
  });

  /**
   * `skipHand`'s folded-seat arithmetic is the OTHER writer that used to destroy the
   * correction (`startingStack - totalContribution` off the pre-correction number). Seat 0 is
   * corrected and then folds, so the skip computes it exactly — from 42 BB, because that is
   * what the rebuilt hand was dealt from.
   */
  it('a quick skip settles the folded seat from the corrected number, not the old one', () => {
    const s = store();
    s.getState().startHand();
    s.getState().correctSeatStack(0, Money.fromBB(42));
    expect(s.getState().hand!.state.seats[0].startingStack).toBe(Money.fromBB(42));

    s.getState().apply({ kind: 'FOLD' }); // seat 0 acts first three-handed, and folds

    s.getState().skipHand();

    expect(s.getState().lastError).toBeNull();
    // Exactly known, so NOT dirty — and strictly below the corrected stack (it paid the ante),
    // never anywhere near the 100 BB the original hand was dealt from.
    expect(s.getState().dirtySeats.has(0)).toBe(false);
    expect(s.getState().table.seats[0].stack).toBeLessThan(Money.fromBB(42));
    expect(s.getState().table.seats[0].stack).toBeGreaterThan(Money.fromBB(40));
  });

  it('a refused value never costs the user the live hand', () => {
    const s = store();
    s.getState().startHand();
    const hand = s.getState().hand;
    const table = s.getState().table;

    s.getState().correctSeatStack(2, Money.ZERO);
    expect(s.getState().lastError?.code).toBe('STACK_NOT_POSITIVE');
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().table).toBe(table);
    expect(s.getState().rebaseNotice).toBeNull();

    s.getState().correctSeatStack(2, 1500.5 as MilliBB);
    expect(s.getState().lastError?.code).toBe('AMOUNT_OUT_OF_RANGE');
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().table).toBe(table);
    expect(s.getState().rebaseNotice).toBeNull();

    // An ENGINE refusal is no different: the correction never happened, so nothing is rebuilt.
    s.getState().correctSeatStack(5, Money.fromBB(20));
    expect(s.getState().lastError).not.toBeNull();
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().table).toBe(table);
    expect(s.getState().rebaseNotice).toBeNull();
  });

  it('clears the seat’s dirty mark on the rebase path too', () => {
    const s = store();
    s.getState().startHand();
    s.getState().skipHand(); // seats 0/1/2 dealt in and still live -> all dirty
    s.getState().startHand(); // a fresh LIVE hand, dirty marks intact
    expect(s.getState().dirtySeats.has(2)).toBe(true);

    s.getState().correctSeatStack(2, Money.fromBB(42));

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand).not.toBeNull();
    expect(s.getState().dirtySeats.has(2)).toBe(false);
    // Seats the user did not speak for stay dirty.
    expect(s.getState().dirtySeats.has(0)).toBe(true);
    expect(s.getState().dirtySeats.has(1)).toBe(true);
  });

  it('between hands it still just writes the table — no re-deal, no notice', () => {
    const s = store();
    s.getState().correctSeatStack(1, Money.fromBB(37));

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[1].stack).toBe(Money.fromBB(37));
    expect(s.getState().hand).toBeNull();
    expect(s.getState().view).toBeNull();
    expect(s.getState().rebaseNotice).toBeNull();
    expect(s.getState().table.handNumber).toBe(0);
    expect(s.getState().table.buttonSeat).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The rebase notice never outlives the hand it describes
// ---------------------------------------------------------------------------

describe('tableStore — rebaseNotice lifetime', () => {
  function fourHanded(): TableStore {
    return createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
  }

  it('skipHand clears it — the rebuilt hand it announced no longer exists', () => {
    const s = fourHanded();
    s.getState().startHand();
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    expect(s.getState().rebaseNotice).not.toBeNull();

    s.getState().skipHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand).toBeNull();
    expect(s.getState().rebaseNotice).toBeNull();
    // The skip's own facts are unaffected by the clearing.
    expect(s.getState().lastSkip).not.toBeNull();
  });

  it('startHand clears it', () => {
    const s = fourHanded();
    s.getState().startHand();
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    expect(s.getState().rebaseNotice).not.toBeNull();

    const toFold = s.getState().hand!.state.dealtInSeats.length - 1;
    for (let i = 0; i < toFold; i += 1) s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().view!.phase.kind).toBe('COMPLETE');

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().rebaseNotice).toBeNull();
  });

  it('a REJECTED startHand leaves the notice alone — nothing changed', () => {
    const s = fourHanded();
    s.getState().startHand();
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    const notice = s.getState().rebaseNotice;
    expect(notice).not.toBeNull();

    s.getState().startHand(); // the hand is still live: HAND_NOT_COMPLETE

    expect(s.getState().lastError?.code).toBe('HAND_NOT_COMPLETE');
    expect(s.getState().rebaseNotice).toBe(notice);
  });
});

// ---------------------------------------------------------------------------
// Restored unverified stacks — ADR-0078(b)
// ---------------------------------------------------------------------------

describe('tableStore — dirtySeats seed', () => {
  it('seeds the 확인 필요 marks the stored session carried', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      dirtySeats: [1, 2],
      ids: sequentialIdFactory('test'),
    });

    expect(new Set(s.getState().dirtySeats)).toEqual(new Set<SeatIndex>([1, 2]));
    // A restored mark is an ordinary mark: the sweep walks it and the resync clears it.
    expect(nextDirtySeat(s.getState().dirtySeats)).toBe(1);
    s.getState().correctSeatStack(1, Money.fromBB(55));
    expect(s.getState().dirtySeats.has(1)).toBe(false);
    expect(s.getState().dirtySeats.has(2)).toBe(true);
  });

  it('defaults to nothing marked when the caller supplies none', () => {
    expect(store().getState().dirtySeats.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The settlement window: what a correction may do while a COMPLETE hand waits
// ---------------------------------------------------------------------------

/**
 * `applyHandResult` (`poker-core/src/table.ts`) is the only thing that runs over a COMPLETE
 * hand, and it writes back exactly ONE field per DEALT-IN seat: `stack`. Everything else on
 * the seat is carried through (`{ ...tableSeat, stack: handSeat.stack }`), and a seat that was
 * not dealt in is not visited at all.
 *
 * That single fact decides which corrections are safe in this window and which are not, and
 * each one below is pinned so the answer cannot drift if the engine's write-back changes.
 */
describe('tableStore — corrections while a COMPLETE hand awaits settlement', () => {
  /** Three-handed (seats 0/1/2, button 0), played to COMPLETE and NOT yet settled. */
  function completed(): TableStore {
    const s = store();
    s.getState().startHand();
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().hand!.state.phase).toBe('COMPLETE');
    return s;
  }

  it('correctSeatStack is refused, and nothing at all changes', () => {
    const s = completed();
    const table = s.getState().table;
    const hand = s.getState().hand;
    const view = s.getState().view;
    const dirtySeats = s.getState().dirtySeats;

    s.getState().correctSeatStack(2, Money.fromBB(42));

    // `applyHandResult` would overwrite seat 2's stack from the finished hand at the next
    // `startHand`, so accepting the number here would destroy it exactly as the ADR-0078(a)
    // MAJOR did — only through a narrower window.
    expect(s.getState().lastError?.code).toBe('HAND_ALREADY_FINISHED');
    expect(s.getState().table).toBe(table);
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().view).toBe(view);
    expect(s.getState().dirtySeats).toBe(dirtySeats);
    expect(s.getState().rebaseNotice).toBeNull();
  });

  it('...and the same correction succeeds, and survives, once the hand is settled', () => {
    const s = completed();
    s.getState().correctSeatStack(2, Money.fromBB(42));
    expect(s.getState().lastError?.code).toBe('HAND_ALREADY_FINISHED');

    s.getState().startHand(); // settles the finished hand, then deals the next one
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(1);

    s.getState().correctSeatStack(2, Money.fromBB(42));

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[2].stack).toBe(Money.fromBB(42));
    expect(s.getState().hand!.state.seats[2].startingStack).toBe(Money.fromBB(42));

    // ...and it is still 42-BB-derived after the NEXT settlement, not overwritten.
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[2].stack).toBeLessThan(Money.fromBB(50));
  });

  /**
   * Occupancy is carried through the write-back untouched, so it is NOT destroyed and is left
   * alone. Pinned rather than argued.
   */
  it('setSeatOccupancy survives settlement — occupancy is never written back', () => {
    const s = completed();

    s.getState().setSeatOccupancy(2, 'SITTING_OUT');

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[2].occupancy).toBe('SITTING_OUT');
    // A COMPLETE hand is a real result, so it is not rebuilt (ADR-0073) and no notice is made.
    expect(s.getState().hand!.state.phase).toBe('COMPLETE');
    expect(s.getState().rebaseNotice).toBeNull();

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1]);
  });

  /**
   * `seatPlayer` only ever fills an EMPTY seat, and an empty seat cannot be among a completed
   * hand's `dealtInSeats`, so `applyHandResult` never visits it. The stack the user counted
   * survives untouched.
   */
  it('seatPlayer survives settlement — an empty seat is never in dealtInSeats', () => {
    const s = completed();
    const newcomer = asId<'Player'>('player-newcomer') as PlayerId;
    expect(s.getState().table.seats[3].occupancy).toBe('EMPTY');

    s.getState().seatPlayer(3, newcomer, Money.fromBB(55));

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[3].stack).toBe(Money.fromBB(55));

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[3].playerId).toBe(newcomer);
    // The number the user counted in front of the new player is exactly what was dealt.
    expect(s.getState().table.seats[3].stack).toBe(Money.fromBB(55));
    expect(s.getState().hand!.state.seats[3].startingStack).toBe(Money.fromBB(55));
  });

  /**
   * `applyHandResult` carries `buttonSeat` through untouched. `startHand` then rotates from it
   * — which is the ordinary between-hands rotation, so the corrected seat is CONSUMED as the
   * rotation's input, never overwritten by a derived value. Pinned as the designed behaviour.
   */
  it('correctSeatButton is consumed by the ordinary rotation, not overwritten', () => {
    const s = completed();
    expect(s.getState().table.buttonSeat).toBe(0);

    s.getState().correctSeatButton(2);

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().hand!.state.phase).toBe('COMPLETE');

    s.getState().startHand();

    // Exactly one rotation clockwise from the seat the user named: 2 -> 0.
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(0);
    expect(s.getState().hand!.state.buttonSeat).toBe(0);
  });

  /**
   * `applyHandResult` guards on `playerId`, so swapping the occupant of a seat the finished
   * hand DEALT IN used to strand that hand: every `startHand` failed HAND_TABLE_MISMATCH and
   * `skipHand` refuses a COMPLETE hand, leaving no exit but naming the previous occupant back
   * exactly. A loud error with no way out is still a trap, so the entrance is closed.
   */
  it('replaceSeatPlayer is refused for a seat the finished hand dealt in, and nothing changes', () => {
    const s = completed();
    const newcomer = asId<'Player'>('player-newcomer') as PlayerId;
    expect(s.getState().hand!.state.dealtInSeats).toContain(2);
    const table = s.getState().table;
    const hand = s.getState().hand;
    const view = s.getState().view;
    const dirtySeats = s.getState().dirtySeats;

    s.getState().replaceSeatPlayer(2, newcomer);

    expect(s.getState().lastError?.code).toBe('HAND_ALREADY_FINISHED');
    expect(s.getState().table).toBe(table);
    expect(s.getState().hand).toBe(hand);
    expect(s.getState().view).toBe(view);
    expect(s.getState().dirtySeats).toBe(dirtySeats);
    expect(s.getState().rebaseNotice).toBeNull();

    // The dead end is now unreachable: settlement still works, which is the whole point.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(1);
    expect(s.getState().table.seats[2].playerId).toBe(testPlayerId(2));

    // ...and the swap the user wanted succeeds the moment the hand is settled.
    s.getState().replaceSeatPlayer(2, newcomer);
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[2].playerId).toBe(newcomer);
  });

  /**
   * The rule is NOT flattened. A seat the finished hand never dealt in is never visited by
   * `applyHandResult`, so there is no mismatch to trigger and no trap to fall into — swapping
   * there stays allowed, and settlement afterwards still succeeds.
   */
  it('replaceSeatPlayer is allowed for a seat the finished hand did NOT deal in', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 0 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });
    // Seat 3 is OCCUPIED but sitting out before the deal, so it is not dealt in.
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    s.getState().startHand();
    s.getState().apply({ kind: 'FOLD' });
    s.getState().apply({ kind: 'FOLD' });
    expect(s.getState().hand!.state.phase).toBe('COMPLETE');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2]);

    const newcomer = asId<'Player'>('player-newcomer') as PlayerId;
    s.getState().replaceSeatPlayer(3, newcomer);

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.seats[3].playerId).toBe(newcomer);
    expect(s.getState().dirtySeats.has(3)).toBe(true);
    // A COMPLETE hand is still never rebuilt (ADR-0073), so there is no notice.
    expect(s.getState().hand!.state.phase).toBe('COMPLETE');
    expect(s.getState().rebaseNotice).toBeNull();

    s.getState().startHand();

    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.handNumber).toBe(1);
    expect(s.getState().table.seats[3].playerId).toBe(newcomer);
  });
});
