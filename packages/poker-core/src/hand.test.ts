import { describe, expect, it } from 'vitest';
import { Money, sequentialIdFactory, unwrap } from '@gto-self/shared';
import {
  allIn,
  awardPots,
  betTo,
  call,
  check,
  dealBoard,
  fold,
  raiseTo,
  setHoleCards,
  type HandCommand,
} from './commands.js';
import {
  applyCommand,
  applyCommands,
  canUndo,
  handAtCommand,
  loadHand,
  replayCommands,
  replayHand,
  startHand,
  undo,
  undoDepth,
  type Hand,
} from './hand.js';
import { foldEvents } from './reduce.js';
import {
  ANTE_PRESET,
  BB,
  buildTable,
  cards,
  errCode,
  ids,
  play,
  sixHanded,
  start,
} from './testing.js';
import type { HandEvent } from './events.js';

const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

/** A complete six-handed hand: preflop raise, flop bet, turn and river checks, showdown. */
const FULL_HAND: readonly HandCommand[] = [
  setHoleCards(0, cards('As Kd'), false),
  fold(),
  fold(),
  fold(),
  raiseTo(BB(3)),
  fold(),
  call(),
  dealBoard(cards('7c 8d 9h')),
  check(),
  betTo(BB(4)),
  call(),
  dealBoard(cards('2s')),
  check(),
  check(),
  dealBoard(cards('Jd')),
  check(),
  check(),
  awardPots([{ potIndex: 0, winners: [0] }]),
];

describe('state is exactly the fold of the events', () => {
  it('holds after every command of a full hand', () => {
    const factory = ids();
    let hand = start(sixHanded(ANTE_PRESET), factory);
    expect(hand.state).toEqual(foldEvents(hand.events));
    for (const command of FULL_HAND) {
      hand = unwrap(applyCommand(hand, command, factory));
      expect(hand.state).toEqual(foldEvents(hand.events));
    }
    expect(hand.state.phase).toBe('COMPLETE');
  });

  it('loadHand reproduces the same state object', () => {
    const factory = ids();
    const hand = play(start(sixHanded(ANTE_PRESET), factory), FULL_HAND, factory);
    const loaded = unwrap(loadHand(hand.events));
    expect(loaded.state).toEqual(hand.state);
    expect(loaded.events).toEqual(hand.events);
  });
});

describe('replay determinism', () => {
  it('two runs with sequentialIdFactory produce byte-identical logs', () => {
    const a = play(start(sixHanded(ANTE_PRESET), ids()), FULL_HAND, ids());
    const b = play(start(sixHanded(ANTE_PRESET), ids()), FULL_HAND, ids());
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.state).toEqual(b.state);
  });

  it('replayCommands reproduces the same hand from a command list', () => {
    const factory = ids();
    const direct = play(start(sixHanded(ANTE_PRESET), factory), FULL_HAND, factory);
    const replayed = unwrap(
      replayCommands(sixHanded(ANTE_PRESET), { handId: direct.state.handId }, FULL_HAND, ids()),
    );
    expect(JSON.stringify(replayed.events)).toBe(JSON.stringify(direct.events));
  });

  it('replayCommands reports the index of the failing command', () => {
    const result = replayCommands(
      sixHanded(),
      { handId: unwrap(startHand(sixHanded(), { handId: 'h1' as never }, ids())).state.handId },
      [fold(), check()],
      ids(),
    );
    expect(errCode(result)).toBe('CHECK_NOT_ALLOWED');
    if (result.ok) throw new Error('expected failure');
    expect(result.error.context.commandIndex).toBe(1);
  });

  it('strict replayHand accepts a log the engine produced', () => {
    const factory = ids();
    const hand = play(start(sixHanded(ANTE_PRESET), factory), FULL_HAND, factory);
    const replayed = unwrap(replayHand(hand.events));
    expect(replayed.events).toBe(hand.events);
    expect(replayed.state).toEqual(hand.state);
  });

  it('strict replayHand rejects a log whose amounts were tampered with', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    const tampered = hand.events.map((event) =>
      event.kind === 'CALL' ? { ...event, toAmount: BB(2), amount: BB(2) } : event,
    ) as readonly HandEvent[];
    expect(errCode(replayHand(tampered))).toBe('CORRUPT_LOG');
  });

  it('strict replayHand rejects an action that was never legal', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold()], factory);
    const forged = [
      ...hand.events,
      {
        id: 'forged' as never,
        seq: hand.events.length,
        commandSeq: 2,
        origin: 'USER' as const,
        kind: 'CHECK' as const,
        seat: 4 as const,
      },
    ] as readonly HandEvent[];
    expect(errCode(replayHand(forged))).toBe('CORRUPT_LOG');
    // The structural loader also refuses, because CHECK facing a bet breaks arithmetic.
    expect(errCode(loadHand(forged))).toBe('CORRUPT_LOG');
  });

  it('structural loadHand tolerates a rule change that strict replay rejects', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c')), betTo(BB(1)), call(), fold()], factory);
    expect(hand.state.potTotal).toBe(BB(5));

    // Re-stamp the stored config with a 50 BB minimum bet. The recorded 1 BB flop bet
    // is now below the minimum, so STRICT replay refuses it — but a corrected rule must
    // never make stored history unloadable, so the STRUCTURAL loader still rehydrates it.
    const rewritten = hand.events.map((event) =>
      event.kind === 'HAND_STARTED'
        ? { ...event, config: { ...event.config, minBet: BB(50) } }
        : event,
    ) as readonly HandEvent[];
    expect(errCode(replayHand(rewritten))).toBe('CORRUPT_LOG');
    expect(loadHand(rewritten).ok).toBe(true);
    expect(unwrap(loadHand(rewritten)).state.potTotal).toBe(BB(5));
  });

  it('rejects a log that is not dense or does not start with HAND_STARTED', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold()], factory);
    expect(errCode(loadHand([]))).toBe('CORRUPT_LOG');
    expect(errCode(loadHand(hand.events.slice(1)))).toBe('CORRUPT_LOG');
    const gapped = hand.events.filter((_e, index) => index !== 3);
    expect(errCode(loadHand(gapped))).toBe('CORRUPT_LOG');
    expect(errCode(replayHand(gapped))).toBe('CORRUPT_LOG');
  });
});

describe('undo', () => {
  it('cannot undo the hand start', () => {
    const hand = start(sixHanded(), ids());
    expect(canUndo(hand)).toBe(false);
    expect(undoDepth(hand)).toBe(0);
    expect(errCode(undo(hand))).toBe('NOTHING_TO_UNDO');
  });

  it('undoes each action type back to the previous state exactly', () => {
    const factory = ids();
    const table = sixHanded(ANTE_PRESET);
    let hand = start(table, factory);
    const history: Hand[] = [hand];
    for (const command of FULL_HAND) {
      hand = unwrap(applyCommand(hand, command, factory));
      history.push(hand);
    }
    for (let index = history.length - 1; index > 0; index -= 1) {
      const previous = history[index - 1];
      const current = history[index];
      if (previous === undefined || current === undefined) throw new Error('bad history');
      const undone = unwrap(undo(current));
      expect(undone.events).toEqual(previous.events);
      expect(undone.state).toEqual(previous.state);
    }
  });

  it('drops the whole command group a hand-ending fold produced', () => {
    const factory = ids();
    const before = play(start(sixHanded(), factory), [fold(), fold(), fold(), fold()], factory);
    const after = play(before, [fold()], factory);
    expect(after.state.phase).toBe('COMPLETE');
    expect(after.events.length - before.events.length).toBe(4);
    expect(after.events.slice(-4).map((e) => e.kind)).toEqual([
      'FOLD',
      'RETURN_UNCALLED',
      'POT_AWARDED',
      'HAND_FINISHED',
    ]);
    const undone = unwrap(undo(after));
    expect(undone.events).toEqual(before.events);
    expect(undone.state.phase).toBe('BETTING');
    expect(undone.state.actorSeat).toBe(1);
  });

  it('never renumbers or regenerates ids on the surviving events', () => {
    const factory = ids();
    const before = play(start(sixHanded(), factory), [fold(), fold()], factory);
    const after = play(before, [fold()], factory);
    const undone = unwrap(undo(after));
    expect(undone.events.map((e) => e.id)).toEqual(before.events.map((e) => e.id));
    expect(undone.events.map((e) => e.seq)).toEqual(before.events.map((e) => e.seq));
  });

  it('undoes a board deal and returns to AWAITING_BOARD', () => {
    const factory = ids();
    const beforeFlop = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    const withFlop = play(beforeFlop, [dealBoard(cards('As Kd 7c'))], factory);
    expect(withFlop.state.street).toBe('FLOP');
    const undone = unwrap(undo(withFlop));
    expect(undone.state.phase).toBe('AWAITING_BOARD');
    expect(undone.state.street).toBe('PREFLOP');
    expect(undone.state.board).toEqual([]);
  });

  it('undoes an award and returns to AWAITING_AWARD with the pot intact', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), check(), check(), check(), dealBoard(cards('2h'))],
      factory,
    );
    hand = play(hand, [check(), check(), check(), dealBoard(cards('9s'))], factory);
    hand = play(hand, [check(), check(), check()], factory);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    const awarded = play(hand, [awardPots([{ potIndex: 0, winners: [1] }])], factory);
    expect(awarded.state.phase).toBe('COMPLETE');
    const undone = unwrap(undo(awarded));
    expect(undone.state.phase).toBe('AWAITING_AWARD');
    expect(undone.state.totalRake).toBe(Money.ZERO);
    expect(undone.state.potTotal).toBe(BB(3));
    expect(undone.state.awards).toEqual([]);
  });

  it('undoes an all-in and restores the seat to IN_HAND', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(20) }, buttonSeat: 0 });
    const before = play(start(table, factory), [raiseTo(BB(5))], factory);
    const shoved = play(before, [fold(), allIn()], factory);
    expect(shoved.state.seats[2].status).toBe('ALL_IN');
    const undone = unwrap(undo(shoved));
    expect(undone.state.actorSeat).toBe(2);
    expect(undone.state.seats[2].status).toBe('IN_HAND');
    expect(undone.state.seats[2].stack).toBe(BB(19));
  });

  it('reports how many times Z can still be pressed', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold(), fold(), fold()], factory);
    expect(undoDepth(hand)).toBe(3);
    expect(undoDepth(unwrap(undo(hand)))).toBe(2);
  });
});

describe('time travel', () => {
  it('returns the state at any command boundary', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    const history: Hand[] = [hand];
    for (const command of LIMP_TO_FLOP) {
      hand = unwrap(applyCommand(hand, command, factory));
      history.push(hand);
    }
    for (let index = 0; index < history.length; index += 1) {
      const expected = history[index];
      if (expected === undefined) throw new Error('bad history');
      expect(unwrap(handAtCommand(hand, index)).state).toEqual(expected.state);
    }
  });

  it('refuses a boundary that does not exist', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), [fold()], factory);
    expect(errCode(handAtCommand(hand, -1))).toBe('CORRUPT_LOG');
    expect(errCode(handAtCommand(hand, 99))).toBe('CORRUPT_LOG');
  });
});

describe('applyCommands', () => {
  it('short-circuits on the first Err and leaves the hand untouched', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    const result = applyCommands(hand, [fold(), check(), fold()], factory);
    expect(errCode(result)).toBe('CHECK_NOT_ALLOWED');
    expect(hand.state.actorSeat).toBe(3);
  });

  it('ids stay injected: the engine never calls crypto.randomUUID', () => {
    const factory = sequentialIdFactory('deterministic');
    const hand = play(start(sixHanded(), factory), [fold()], factory);
    expect(hand.events.every((e) => e.id.startsWith('deterministic-'))).toBe(true);
  });
});

describe('bookkeeping counters and late reveals', () => {
  it('eventCount and commandCount track the log exactly', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    expect(hand.state.eventCount).toBe(hand.events.length);
    expect(hand.state.commandCount).toBe(1);
    for (const command of LIMP_TO_FLOP) {
      hand = unwrap(applyCommand(hand, command, factory));
      expect(hand.state.eventCount).toBe(hand.events.length);
    }
    expect(hand.state.commandCount).toBe(LIMP_TO_FLOP.length + 1);
  });

  it('accepts a showdown reveal after the hand is complete', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(hand.state.phase).toBe('COMPLETE');
    const revealed = play(hand, [setHoleCards(2, cards('As Kd'), true)], factory);
    expect(revealed.state.seats[2].holeCards).toHaveLength(2);
    expect(revealed.state.seats[2].holeCardsRevealed).toBe(true);
    expect(revealed.state.phase).toBe('COMPLETE');
    expect(unwrap(undo(revealed)).state).toEqual(hand.state);
    expect(replayHand(revealed.events).ok).toBe(true);
  });
});
