import { describe, expect, it } from 'vitest';
import { asId, parseCard, sequentialIdFactory } from '@gto-self/shared';
import type { Card, HandId } from '@gto-self/shared';
import { applyCommand, startHand, toView } from '@gto-self/poker-core';
import type { Hand, HandView } from '@gto-self/poker-core';
import { cardEntryRequest, commandForCards } from './cardEntry.js';
import { makeTestTable } from './testTable.js';

/**
 * `cardEntry` is the palette's whole lifecycle, and Phase 7's rule that it computes no
 * poker fact still holds: every view below comes out of the real engine.
 */

const card = (text: string): Card => {
  const parsed = parseCard(text);
  if (!parsed.ok) throw new Error(`bad test card ${text}: ${parsed.error}`);
  return parsed.value;
};

const ids = () => sequentialIdFactory('test');

/** Four handed, hero on the button: seat 0 BTN/hero, 1 SB, 2 BB, 3 UTG. */
function dealt(): Hand {
  const factory = ids();
  const table = makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 0 });
  const started = startHand(table, { handId: asId<'Hand'>(factory.next()) as HandId }, factory);
  if (!started.ok) throw new Error(started.error.message);
  return started.value;
}

const send = (hand: Hand, ...commands: Parameters<typeof applyCommand>[1][]): Hand => {
  let next = hand;
  for (const command of commands) {
    const result = applyCommand(next, command, ids());
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    next = result.value;
  }
  return next;
};

/** Checks and calls until the engine stops asking for an action. */
function runBetting(hand: Hand): Hand {
  let next = hand;
  for (let guard = 0; guard < 12; guard += 1) {
    const phase = toView(next).phase;
    if (phase.kind !== 'AWAITING_ACTION') return next;
    next = send(next, phase.actor.legal.canCheck ? { kind: 'CHECK' } : { kind: 'CALL' });
  }
  throw new Error('betting round did not end');
}

/** A four-handed showdown: the engine is waiting for a winner. */
function showdown(): HandView {
  let hand = runBetting(dealt());
  hand = runBetting(
    send(hand, { kind: 'DEAL_BOARD', cards: [card('2c'), card('7d'), card('9h')] }),
  );
  hand = runBetting(send(hand, { kind: 'DEAL_BOARD', cards: [card('3s')] }));
  hand = runBetting(send(hand, { kind: 'DEAL_BOARD', cards: [card('4s')] }));
  const view = toView(hand);
  if (view.phase.kind !== 'AWAITING_AWARD') throw new Error(`phase is ${view.phase.kind}`);
  return view;
}

describe('cardEntryRequest — reveal target', () => {
  it('asks for nothing at AWAITING_AWARD until the user nominates a seat', () => {
    const view = showdown();
    expect(cardEntryRequest(view, 0)).toBeNull();
    expect(cardEntryRequest(view, 0, null)).toBeNull();
  });

  it('asks for the nominated seat’s two cards, labelled with its position', () => {
    const view = showdown();
    const request = cardEntryRequest(view, 0, 2);

    expect(request).not.toBeNull();
    if (request === null || request.kind !== 'REVEAL') throw new Error('expected a REVEAL');
    expect(request.seat).toBe(2);
    expect(request.count).toBe(2);
    expect(request.key).toBe(`${view.handNumber}:REVEAL:2`);
    const position = view.seats[2].position;
    if (position === null) throw new Error('the engine gave this seat no position');
    expect(request.label).toContain(position);
    expect(request.label).toContain('seat 3');
  });

  it('does not ask again for a seat whose cards are known', () => {
    let hand = runBetting(dealt());
    hand = runBetting(
      send(hand, { kind: 'DEAL_BOARD', cards: [card('2c'), card('7d'), card('9h')] }),
    );
    hand = runBetting(send(hand, { kind: 'DEAL_BOARD', cards: [card('3s')] }));
    hand = runBetting(send(hand, { kind: 'DEAL_BOARD', cards: [card('4s')] }));
    hand = send(hand, {
      kind: 'SET_HOLE_CARDS',
      seat: 2,
      cards: [card('As'), card('Kd')],
      revealed: true,
    });

    expect(cardEntryRequest(toView(hand), 0, 2)).toBeNull();
  });

  it('never invents a target: a seat that was not dealt in is not asked', () => {
    const view = showdown();
    expect(view.dealtInSeats).not.toContain(5);
    expect(cardEntryRequest(view, 0, 5)).toBeNull();
  });

  it('leaves HERO and BOARD entry exactly as they were', () => {
    // A live hand still asks the hero for hole cards, reveal target or not.
    const view = toView(dealt());
    const hero = cardEntryRequest(view, 0, 2);
    if (hero === null || hero.kind !== 'HERO') throw new Error('expected a HERO request');
    expect(hero.seat).toBe(0);
    expect(hero.key).toBe(`${view.handNumber}:HERO:0`);

    // And a street the engine is waiting for still wins outright.
    const board = toView(runBetting(dealt()));
    if (board.phase.kind !== 'AWAITING_BOARD') throw new Error('expected AWAITING_BOARD');
    const request = cardEntryRequest(board, 0, 2);
    if (request === null || request.kind !== 'BOARD') throw new Error('expected a BOARD request');
    expect(request.count).toBe(board.phase.cardsNeeded);
  });
});

describe('commandForCards', () => {
  it('marks a reveal as revealed and the hero’s own entry as not', () => {
    const view = showdown();
    const reveal = cardEntryRequest(view, 0, 2);
    if (reveal === null) throw new Error('expected a request');
    expect(commandForCards(reveal, [card('As'), card('Kd')])).toEqual({
      kind: 'SET_HOLE_CARDS',
      seat: 2,
      cards: [card('As'), card('Kd')],
      revealed: true,
    });

    const hero = cardEntryRequest(toView(dealt()), 0);
    if (hero === null) throw new Error('expected a request');
    expect(commandForCards(hero, [card('As'), card('Kd')])).toEqual({
      kind: 'SET_HOLE_CARDS',
      seat: 0,
      cards: [card('As'), card('Kd')],
      revealed: false,
    });
  });

  it('still deals a board street', () => {
    const board = toView(runBetting(dealt()));
    const request = cardEntryRequest(board, 0);
    if (request === null) throw new Error('expected a request');
    const cards = [card('2c'), card('7d'), card('9h')];
    expect(commandForCards(request, cards)).toEqual({ kind: 'DEAL_BOARD', cards });
  });
});
