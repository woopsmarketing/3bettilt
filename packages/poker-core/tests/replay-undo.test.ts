/**
 * "State is a pure fold over an ordered event list" and "undo = drop the last logical
 * user command group and replay" (CLAUDE.md, §6).
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import {
  betTo,
  call,
  check,
  dealBoard,
  fold,
  raiseTo,
  setHoleCards,
  type HandCommand,
} from '../src/commands.js';
import { applyCommand, canUndo, handAtCommand, loadHand, replayHand, undo } from '../src/hand.js';
import { foldEvents } from '../src/reduce.js';
import { encodeHandEvents, jsonRoundTrip } from '../src/serialization.js';
import { cards, ids, sixHanded, start } from '../src/testing.js';
import { awardAllTo, snapshot, step } from './_helpers.js';

/** A full hand, one command at a time, so every command kind is exercised. */
const SCRIPT: readonly HandCommand[] = [
  setHoleCards(0, cards('Ac Qh'), false),
  fold(), // UTG
  raiseTo(Money.mbb(3000)), // HJ
  fold(), // CO
  call(), // BTN
  fold(), // SB
  call(), // BB
  dealBoard(cards('Ah Kd 7c')),
  check(), // BB
  betTo(Money.mbb(5000)), // HJ
  call(), // BTN
  raiseTo(Money.mbb(15000)), // BB
  fold(), // HJ
  call(), // BTN
  dealBoard(cards('2d')),
  check(),
  check(),
  dealBoard(cards('Js')),
  betTo(Money.mbb(20000)),
  { kind: 'ALL_IN' }, // BTN jams
  call(), // BB calls all-in
];

function playScript() {
  const f = ids();
  let hand = start(sixHanded(), f);
  const before: ReturnType<typeof snapshot>[] = [];
  for (const command of SCRIPT) {
    before.push(snapshot(hand));
    hand = step(hand, command, f);
  }
  return { hand, before, f };
}

describe('replay determinism', () => {
  it('reduces the same event list to deeply equal state twice', () => {
    const { hand } = playScript();
    const a = foldEvents(hand.events);
    const b = foldEvents(hand.events);
    expect(a).toEqual(b);
    expect(a).toEqual(hand.state);
  });

  it('loadHand and replayHand both reproduce the live state exactly', () => {
    const { hand } = playScript();

    const loaded = loadHand(hand.events);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.state).toEqual(hand.state);
      expect(loaded.value.events).toEqual(hand.events);
    }

    const replayed = replayHand(hand.events);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.value.state).toEqual(hand.state);
      // ADR-0007: replay never renumbers or regenerates ids.
      expect(replayed.value.events).toEqual(hand.events);
    }
  });

  it('survives a JSON round trip byte for byte', () => {
    const { hand } = playScript();
    const round = jsonRoundTrip(hand.events);
    expect(round.ok).toBe(true);
    if (round.ok) {
      expect(round.value).toEqual(hand.events);
      expect(encodeHandEvents(round.value)).toEqual(encodeHandEvents(hand.events));
      const refolded = loadHand(round.value);
      expect(refolded.ok).toBe(true);
      if (refolded.ok) expect(refolded.value.state).toEqual(hand.state);
    }
  });

  it('produces identical logs from two independent runs of the same script', () => {
    const a = playScript().hand;
    const b = playScript().hand;
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
  });

  it('keeps seq dense and ascending and commandSeq non-decreasing', () => {
    const { hand } = playScript();
    hand.events.forEach((e, i) => expect(e.seq).toBe(i));
    for (let i = 1; i < hand.events.length; i += 1) {
      const prev = hand.events[i - 1]?.commandSeq ?? 0;
      const now = hand.events[i]?.commandSeq ?? 0;
      expect(now).toBeGreaterThanOrEqual(prev);
    }
  });
});

describe('undo', () => {
  it('restores the exact state before every command in a whole hand', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (const command of SCRIPT) {
      const before = snapshot(hand);
      const after = step(hand, command, f);
      const undone = undo(after);
      expect(undone.ok).toBe(true);
      if (!undone.ok) return;
      expect(undone.value.events).toEqual(before.events);
      expect(undone.value.state).toEqual(before.state);
      hand = after;
    }
  });

  it('undoes a hand-ending fold, its uncalled return, its award and its finish together', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, fold(), f);
    const before = snapshot(hand);
    expect(hand.state.phase).toBe('BETTING');

    hand = step(hand, fold(), f); // the SB folds and ends the hand
    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.events.length - before.events.length).toBe(4);

    const undone = undo(hand);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.value.events).toEqual(before.events);
      expect(undone.value.state).toEqual(before.state);
      expect(undone.value.state.phase).toBe('BETTING');
      expect(undone.value.state.actorSeat).toBe(1);
    }
  });

  it('undoes an AWARD_POTS command back to AWAITING_AWARD', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (const command of SCRIPT.slice(0, 19)) hand = step(hand, command, f);
    hand = step(hand, call(), f); // BTN calls the river bet
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    const before = snapshot(hand);

    const awarded = step(hand, awardAllTo(hand.state, 0), f);
    expect(awarded.state.phase).toBe('COMPLETE');
    const undone = undo(awarded);
    expect(undone.ok).toBe(true);
    if (undone.ok) {
      expect(undone.value.state).toEqual(before.state);
      expect(undone.value.state.phase).toBe('AWAITING_AWARD');
      expect(undone.value.state.totalRake).toBe(0);
    }
  });

  it('refuses to undo the hand start', () => {
    const hand = start(sixHanded(), ids());
    expect(canUndo(hand)).toBe(false);
    expect(undo(hand)).toMatchObject({ ok: false, error: { code: 'NOTHING_TO_UNDO' } });
  });

  it('time-travels to any command boundary and matches the incremental state', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    const seen = [snapshot(hand)];
    for (const command of SCRIPT.slice(0, 8)) {
      hand = step(hand, command, f);
      seen.push(snapshot(hand));
    }
    seen.forEach((expected, i) => {
      const at = handAtCommand(hand, i);
      expect(at.ok).toBe(true);
      if (at.ok) expect(at.value.state).toEqual(expected.state);
    });
  });

  it('leaves the hand untouched when a command is rejected', () => {
    const f = ids();
    const hand = start(sixHanded(), f);
    const before = snapshot(hand);
    const rejected = applyCommand(hand, check(), f); // UTG cannot check facing the BB
    expect(rejected.ok).toBe(false);
    expect(hand).toEqual(before);
  });
});
