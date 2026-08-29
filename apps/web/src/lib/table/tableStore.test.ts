import { describe, expect, it } from 'vitest';
import { sequentialIdFactory } from '@gto-self/shared';
import { toView } from '@gto-self/poker-core';
import { canStartHand, createTableStore, type TableStore } from './tableStore.js';
import { makeTestTable } from './testTable.js';

function store(): TableStore {
  return createTableStore({
    sessionId: 'session-1',
    table: makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }),
    autoTopUp: null,
    ids: sequentialIdFactory('test'),
  });
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
