import { describe, expect, it } from 'vitest';
import { Money, sequentialIdFactory } from '@gto-self/shared';
import { setSeatOccupancy, setSeatStack, toView } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, EngineResult, SeatIndex, TableState } from '@gto-self/poker-core';
import {
  canStartHand,
  createTableStore,
  seedSeatAutoTopUp,
  type TableStore,
} from './tableStore.js';
import { makeTestTable } from './testTable.js';

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

  it('runs a full 6 -> 5 -> 4 -> 5 dealt-in sequence across startHand calls', () => {
    const s = sixHandedStore();

    // Hand 1: nobody has sat out yet.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);

    // Sat out MID-HAND. The current hand's dealt-in lineup is provably unaffected.
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    expect(s.getState().table.seats[3].occupancy).toBe('SITTING_OUT');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);
    foldHandOut(s);
    // The COMPLETED hand still settled 6-handed.
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);

    // Hand 2: 5-handed. Seat 3 is excluded and received no cards or blinds.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 4, 5]);
    expect(s.getState().view!.seats[3].status).toBe('NOT_DEALT_IN');
    s.getState().setSeatOccupancy(4, 'SITTING_OUT');
    foldHandOut(s);

    // Hand 3: 4-handed.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 5]);
    expect(s.getState().view!.seats[3].status).toBe('NOT_DEALT_IN');
    expect(s.getState().view!.seats[4].status).toBe('NOT_DEALT_IN');
    // Seat 3 returns while hand 3 is still live — it does not rejoin THIS hand.
    s.getState().setSeatOccupancy(3, 'ACTIVE');
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 5]);
    foldHandOut(s);

    // Hand 4: 5-handed again. Seat 3 is back; seat 4 is still out.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 5]);
    expect(s.getState().view!.seats[3].status).not.toBe('NOT_DEALT_IN');
    expect(s.getState().view!.seats[4].status).toBe('NOT_DEALT_IN');
  });

  it('a toggle mid-hand changes ONLY table, never hand or view', () => {
    const s = sixHandedStore();
    s.getState().startHand();
    const { hand, view, table } = s.getState();

    s.getState().setSeatOccupancy(2, 'SITTING_OUT');

    expect(s.getState().hand).toBe(hand);
    expect(s.getState().view).toBe(view);
    expect(s.getState().table).not.toBe(table);
    expect(s.getState().table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(s.getState().lastError).toBeNull();
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

  /** R1/B2 + M2 together: the 6 -> 5 -> 4 -> 5 sequence with the BUTTON among the sit-outs. */
  it('runs a 6 -> 5 -> 4 -> 5 sequence with the button seat among the sit-outs', () => {
    const s = createTableStore({
      sessionId: 'session-1',
      table: makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat: 0, buttonSeat: 2 }),
      autoTopUp: null,
      ids: sequentialIdFactory('test'),
    });

    // Hand 1: 6-handed on the chosen button, sat out BEFORE any deal and put back.
    s.getState().setSeatOccupancy(2, 'SITTING_OUT');
    s.getState().setSeatOccupancy(2, 'ACTIVE');
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(2);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 2, 3, 4, 5]);

    // The BUTTON seat sits out between hands.
    s.getState().setSeatOccupancy(2, 'SITTING_OUT');
    expect(s.getState().table.buttonSeat).toBe(2);
    foldHandOut(s);

    // Hand 2: 5-handed, button clockwise from 2 -> 3.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(3);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 3, 4, 5]);

    // The new button seat sits out too.
    s.getState().setSeatOccupancy(3, 'SITTING_OUT');
    foldHandOut(s);

    // Hand 3: 4-handed, button clockwise from 3 -> 4.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(4);
    expect(s.getState().hand!.state.dealtInSeats).toEqual([0, 1, 4, 5]);

    // Seat 2 comes back.
    s.getState().setSeatOccupancy(2, 'ACTIVE');
    foldHandOut(s);

    // Hand 4: 5-handed, button clockwise from 4 -> 5.
    s.getState().startHand();
    expect(s.getState().lastError).toBeNull();
    expect(s.getState().table.buttonSeat).toBe(5);
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
