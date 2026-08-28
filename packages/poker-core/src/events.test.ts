import { describe, expect, it } from 'vitest';
import { Money, sequentialIdFactory } from '@gto-self/shared';
import {
  ACTION_EVENT_KINDS,
  WAGER_EVENT_KINDS,
  eventSeat,
  eventsOfCommand,
  isActionEvent,
  isWagerEvent,
  lastCommandSeq,
  makeEvent,
} from './events.js';
import { call, fold } from './commands.js';
import { BB, ids, play, sixHanded, start } from './testing.js';

describe('makeEvent', () => {
  it('mints its id from the injected factory and never from crypto', () => {
    const factory = sequentialIdFactory('evt');
    const first = makeEvent(
      { kind: 'FOLD', seat: 3 },
      { seq: 7, commandSeq: 2, origin: 'USER' },
      factory,
    );
    expect(first).toEqual({
      id: 'evt-1',
      seq: 7,
      commandSeq: 2,
      origin: 'USER',
      kind: 'FOLD',
      seat: 3,
    });
    const second = makeEvent(
      { kind: 'POST_SB', seat: 1, amount: Money.mbb(500) },
      { seq: 8, commandSeq: 2, origin: 'ENGINE' },
      factory,
    );
    expect(second.id).toBe('evt-2');
  });
});

describe('event predicates', () => {
  it('separates voluntary actions from the wagers that carry a toAmount', () => {
    expect(ACTION_EVENT_KINDS).toEqual(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
    expect(WAGER_EVENT_KINDS).toEqual(['CALL', 'BET', 'RAISE', 'ALL_IN']);
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold(), fold(), fold(), call()], factory);
    const folded = hand.events.find((e) => e.kind === 'FOLD');
    const called = hand.events.find((e) => e.kind === 'CALL');
    const posted = hand.events.find((e) => e.kind === 'POST_BB');
    if (folded === undefined || called === undefined || posted === undefined) {
      throw new Error('missing events');
    }
    expect(isActionEvent(folded)).toBe(true);
    expect(isWagerEvent(folded)).toBe(false);
    expect(isActionEvent(called)).toBe(true);
    expect(isWagerEvent(called)).toBe(true);
    expect(isActionEvent(posted)).toBe(false);
  });

  it('reports the seat an event concerns, or null for table-wide events', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold()], factory);
    const started = hand.events[0];
    const folded = hand.events.at(-1);
    if (started === undefined || folded === undefined) throw new Error('missing events');
    expect(eventSeat(started)).toBeNull();
    expect(eventSeat(folded)).toBe(3);
  });
});

describe('command grouping', () => {
  it('collects every event of one logical command and reports the newest group', () => {
    const factory = ids();
    const before = play(start(sixHanded(), factory), [fold(), fold(), fold(), fold()], factory);
    expect(lastCommandSeq(before.events)).toBe(4);
    const after = play(before, [fold()], factory);
    expect(lastCommandSeq(after.events)).toBe(5);
    expect(eventsOfCommand(after.events, 5).map((e) => e.kind)).toEqual([
      'FOLD',
      'RETURN_UNCALLED',
      'POT_AWARDED',
      'HAND_FINISHED',
    ]);
    expect(eventsOfCommand(after.events, 0)).toHaveLength(9);
    expect(lastCommandSeq([])).toBeNull();
    expect(eventsOfCommand(after.events, 99)).toEqual([]);
    expect(BB(1)).toBe(Money.mbb(1000));
  });
});
