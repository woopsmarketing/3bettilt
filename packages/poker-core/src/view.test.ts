import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { awardPots, call, check, dealBoard, fold, raiseTo, setHoleCards } from './commands.js';
import { toView, wagerCommand } from './view.js';
import {
  ANTE_PRESET,
  BB,
  buildTable,
  c,
  cards,
  errCode,
  ids,
  play,
  sixHanded,
  start,
} from './testing.js';

const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

describe('the actor lives inside the phase', () => {
  it('exposes everything the raise-input preview needs when a seat is on the clock', () => {
    const view = toView(start(sixHanded(), ids()));
    expect(view.phase.kind).toBe('AWAITING_ACTION');
    if (view.phase.kind !== 'AWAITING_ACTION') throw new Error('no actor');
    const actor = view.phase.actor;
    expect(actor.seat).toBe(3);
    expect(actor.position).toBe('UTG');
    expect(actor.callAmount).toBe(BB(1));
    expect(actor.pot).toBe(BB(1.5));
    expect(actor.potIfCalls).toBe(BB(2.5));
    expect(actor.stack).toBe(BB(100));
    // Versus the deepest live opponent: three seats still have their full 100 BB behind.
    expect(actor.effectiveStack).toBe(BB(100));
    expect(actor.potOdds).toBeCloseTo(0.4, 10);
    expect(actor.legal.wager?.minToAmount).toBe(BB(2));
    expect(actor.legal.wager?.maxToAmount).toBe(BB(100));
  });

  it('asks for board cards with the right arity', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    let view = toView(hand);
    expect(view.phase).toEqual({ kind: 'AWAITING_BOARD', street: 'FLOP', cardsNeeded: 3 });
    hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), check(), check()], factory);
    view = toView(hand);
    expect(view.phase).toEqual({ kind: 'AWAITING_BOARD', street: 'TURN', cardsNeeded: 1 });
  });

  it('offers the awardable pots with a projected rake', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), check(), check(), check(), dealBoard(cards('2h'))],
      factory,
    );
    hand = play(hand, [check(), check(), check(), dealBoard(cards('9s'))], factory);
    hand = play(hand, [check(), check(), check()], factory);
    const view = toView(hand);
    expect(view.phase.kind).toBe('AWAITING_AWARD');
    if (view.phase.kind !== 'AWAITING_AWARD') throw new Error('no pots');
    expect(view.phase.pots).toEqual([
      {
        index: 0,
        kind: 'MAIN',
        amount: BB(3),
        eligibleSeats: [0, 1, 2],
        projectedRake: Money.mbb(150),
        awarded: false,
      },
    ]);
  });

  it('carries the finished result when the hand is complete', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    const view = toView(hand);
    expect(view.phase.kind).toBe('COMPLETE');
    if (view.phase.kind !== 'COMPLETE') throw new Error('not complete');
    expect(view.phase.result.reason).toBe('ALL_FOLDED');
    expect(view.phase.result.seats).toHaveLength(6);
    expect(view.result).not.toBeNull();
  });
});

describe('seat projection', () => {
  it('marks button, blinds, hero and actor', () => {
    const view = toView(start(sixHanded(ANTE_PRESET), ids()));
    expect(view.seats[0].isButton).toBe(true);
    expect(view.seats[0].isHero).toBe(true);
    expect(view.seats[1].isSmallBlind).toBe(true);
    expect(view.seats[2].isBigBlind).toBe(true);
    expect(view.seats[3].isActor).toBe(true);
    expect(view.buttonSeat).toBe(0);
    expect(view.smallBlindSeat).toBe(1);
    expect(view.bigBlindSeat).toBe(2);
  });

  it('heads-up the button is both button and small blind', () => {
    const table = buildTable({ stacks: { 1: BB(100), 4: BB(100) }, buttonSeat: 4 });
    const view = toView(start(table, ids()));
    expect(view.seats[4].isButton).toBe(true);
    expect(view.seats[4].isSmallBlind).toBe(true);
    expect(view.seats[4].position).toBe('BTN');
    expect(view.seats[1].isBigBlind).toBe(true);
  });

  it('shows the last action taken on the CURRENT street only', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    expect(toView(hand).seats[2].lastAction?.kind).toBe('CHECK');
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    expect(toView(hand).seats[2].lastAction).toBeNull();
  });

  it('reports contenders, dead cards, pot and undo availability', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    hand = play(hand, [setHoleCards(0, cards('As Kd'), false)], factory);
    hand = play(hand, [fold(), fold()], factory);
    const view = toView(hand);
    expect(view.contenderSeats).toEqual([1, 2, 5, 0]);
    expect(view.deadCards).toEqual([c('As'), c('Kd')]);
    expect(view.pot).toBe(BB(1.5));
    expect(view.canUndo).toBe(true);
    expect(view.actions).toHaveLength(2);
  });
});

describe('wagerCommand picks the verb for the R key', () => {
  it('produces RAISE when facing a bet', () => {
    const view = toView(start(sixHanded(), ids()));
    const command = wagerCommand(view, BB(3));
    expect(command.ok).toBe(true);
    if (!command.ok) throw new Error('no command');
    expect(command.value).toEqual({ kind: 'RAISE', toAmount: BB(3), seat: 3 });
  });

  it('produces BET when facing none', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    const command = wagerCommand(toView(hand), BB(2));
    if (!command.ok) throw new Error('no command');
    expect(command.value).toEqual({ kind: 'BET', toAmount: BB(2), seat: 1 });
  });

  it('reports why the control is disabled instead of guessing', () => {
    const factory = ids();
    const done = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    expect(errCode(wagerCommand(toView(done), BB(3)))).toBe('NOT_BETTING_PHASE');

    const table = buildTable({
      stacks: { 0: BB(4), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    const blocked = play(
      start(table, ids()),
      [raiseTo(BB(3)), fold(), call(), { kind: 'ALL_IN' }, fold(), fold()],
      ids(),
    );
    expect(errCode(wagerCommand(toView(blocked), BB(10)))).toBe('RAISE_NOT_REOPENED');
  });
});

describe('the view is a pure projection', () => {
  it('never mutates the hand and is stable across calls', () => {
    const factory = ids();
    const hand = play(start(sixHanded(ANTE_PRESET), factory), LIMP_TO_FLOP, factory);
    const before = JSON.stringify(hand.state);
    const first = toView(hand);
    const second = toView(hand);
    expect(JSON.stringify(hand.state)).toBe(before);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('projects a finished hand awarded by the user', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), check(), check(), check(), dealBoard(cards('2h'))],
      factory,
    );
    hand = play(hand, [check(), check(), check(), dealBoard(cards('9s'))], factory);
    hand = play(hand, [check(), check(), check()], factory);
    hand = play(hand, [awardPots([{ potIndex: 0, winners: [1, 2] }])], factory);
    const view = toView(hand);
    if (view.phase.kind !== 'COMPLETE') throw new Error('not complete');
    expect(view.phase.result.reason).toBe('SHOWDOWN');
    expect(view.phase.result.totalRake).toBe(Money.mbb(150));
    expect(view.board).toHaveLength(5);
  });
});
