import { describe, expect, it } from 'vitest';
import { Money, unwrap } from '@gto-self/shared';
import {
  allIn,
  awardPots,
  betTo,
  buildStartEvents,
  call,
  check,
  dealBoard,
  expectedBoardCardCount,
  fold,
  raiseTo,
  setHoleCards,
  validateCommand,
} from './commands.js';
import { applyCommand } from './hand.js';
import { seatPlayer, setButtonSeat, setSeatOccupancy, vacateSeat, createTable } from './table.js';
import {
  ANTE_PRESET,
  BB,
  NO_ANTE_PRESET,
  buildTable,
  c,
  cards,
  errCode,
  ids,
  play,
  sixHanded,
  start,
} from './testing.js';
import { asId, type HandId, type PlayerId } from '@gto-self/shared';

const HAND_ID = asId<'Hand'>('h1') as HandId;
const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

describe('buildStartEvents preconditions', () => {
  it('refuses fewer than two dealt-in seats', () => {
    const table = buildTable({ stacks: { 0: BB(100) }, buttonSeat: 0 });
    expect(errCode(buildStartEvents(table, { handId: HAND_ID }, ids()))).toBe('NOT_ENOUGH_PLAYERS');
  });

  it('refuses when there is no button', () => {
    const table = vacateSeat(buildTable({ stacks: { 0: BB(100), 1: BB(100) }, buttonSeat: 0 }), 0);
    const reseated = unwrap(seatPlayer(table, 0, asId<'Player'>('z') as PlayerId, BB(100)));
    expect(errCode(buildStartEvents(reseated, { handId: HAND_ID }, ids()))).toBe('NO_BUTTON_SEAT');
  });

  it('refuses a button on a seat that is not dealt in', () => {
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    const sittingOut = unwrap(setSeatOccupancy(table, 2, 'SITTING_OUT'));
    const withButton = { ...sittingOut, buttonSeat: 2 as const };
    expect(errCode(buildStartEvents(withButton, { handId: HAND_ID }, ids()))).toBe(
      'BUTTON_SEAT_NOT_DEALT_IN',
    );
  });

  it('refuses the same player in two seats', () => {
    let table = unwrap(createTable(NO_ANTE_PRESET));
    const clone = asId<'Player'>('same') as PlayerId;
    table = unwrap(seatPlayer(table, 0, clone, BB(100)));
    table = unwrap(seatPlayer(table, 1, clone, BB(100)));
    table = unwrap(setButtonSeat(table, 0));
    expect(errCode(buildStartEvents(table, { handId: HAND_ID }, ids()))).toBe('DUPLICATE_PLAYER');
  });

  it('refuses an invalid embedded config', () => {
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100) }, buttonSeat: 0 });
    const broken = { ...table, config: { ...table.config, minBet: Money.ZERO } };
    expect(errCode(buildStartEvents(broken, { handId: HAND_ID }, ids()))).toBe('INVALID_CONFIG');
  });

  it('honours a button override and a hand number override', () => {
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    const hand = start(table, ids(), 'h9', { buttonSeat: 2, handNumber: 41 });
    expect(hand.state.buttonSeat).toBe(2);
    expect(hand.state.handNumber).toBe(41);
    expect(hand.state.blinds.smallBlindSeat).toBe(0);
  });

  it('drops a hero seat that was not dealt in', () => {
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100) },
      buttonSeat: 0,
      heroSeat: 2,
    });
    const heroOut = unwrap(setSeatOccupancy(table, 2, 'SITTING_OUT'));
    const withButton = unwrap(setButtonSeat(heroOut, 0));
    const hand = start(withButton, ids());
    expect(hand.state.heroSeat).toBeNull();
  });

  it('parks in AWAITING_BOARD when the antes put everyone all-in', () => {
    const config = {
      ...ANTE_PRESET,
      ante: { ...ANTE_PRESET.ante, amount: Money.mbb(100) },
    };
    const table = buildTable({
      config,
      stacks: { 0: Money.mbb(100), 1: Money.mbb(100), 2: Money.mbb(100) },
      buttonSeat: 0,
    });
    const hand = start(table, ids());
    expect(hand.state.dealtInSeats.every((s) => hand.state.seats[s].status === 'ALL_IN')).toBe(
      true,
    );
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.potTotal).toBe(Money.mbb(300));
  });
});

describe('board card entry', () => {
  it('tells the palette exactly how many cards it needs', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    expect(expectedBoardCardCount(hand.state)).toBe(0);
    hand = play(hand, LIMP_TO_FLOP, factory);
    expect(expectedBoardCardCount(hand.state)).toBe(3);
    hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), check(), check()], factory);
    expect(expectedBoardCardCount(hand.state)).toBe(1);
  });

  it('refuses the wrong card count', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    expect(errCode(applyCommand(hand, dealBoard(cards('As Kd')), factory))).toBe(
      'WRONG_CARD_COUNT',
    );
    expect(errCode(applyCommand(hand, dealBoard(cards('As Kd 7c 2h')), factory))).toBe(
      'WRONG_CARD_COUNT',
    );
  });

  it('refuses a card already in play', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    hand = play(hand, [setHoleCards(0, cards('As Kd'), false)], factory);
    hand = play(hand, LIMP_TO_FLOP, factory);
    expect(errCode(applyCommand(hand, dealBoard(cards('As 2h 3d')), factory))).toBe(
      'DUPLICATE_CARD',
    );
    expect(errCode(applyCommand(hand, dealBoard([c('2h'), c('2h'), c('3d')]), factory))).toBe(
      'DUPLICATE_CARD',
    );
    expect(applyCommand(hand, dealBoard(cards('2h 3d 4s')), factory).ok).toBe(true);
  });

  it('refuses a deal when the engine is not waiting for one', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    expect(errCode(applyCommand(hand, dealBoard(cards('As Kd 7c')), factory))).toBe(
      'NOT_AWAITING_BOARD',
    );
  });
});

describe('hole cards', () => {
  it('accepts one or two cards and replaces a previous holding', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    hand = play(hand, [setHoleCards(0, cards('As'), true)], factory);
    expect(hand.state.seats[0].holeCards).toEqual([c('As')]);
    expect(hand.state.seats[0].holeCardsRevealed).toBe(true);
    hand = play(hand, [setHoleCards(0, cards('Kd Qc'), false)], factory);
    expect(hand.state.seats[0].holeCards).toEqual([c('Kd'), c('Qc')]);
    expect(hand.state.seats[0].holeCardsRevealed).toBe(false);
    // The replaced As is free again.
    expect(applyCommand(hand, setHoleCards(1, cards('As Jh'), false), factory).ok).toBe(true);
  });

  it('refuses a wrong count, duplicates and a seat that is not dealt in', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 });
    const hand = start(table, factory);
    expect(errCode(applyCommand(hand, setHoleCards(0, cards('As Kd Qc'), false), factory))).toBe(
      'WRONG_CARD_COUNT',
    );
    expect(errCode(applyCommand(hand, setHoleCards(0, [], false), factory))).toBe(
      'WRONG_CARD_COUNT',
    );
    expect(errCode(applyCommand(hand, setHoleCards(0, [c('As'), c('As')], false), factory))).toBe(
      'DUPLICATE_CARD',
    );
    expect(errCode(applyCommand(hand, setHoleCards(5, cards('As Kd'), false), factory))).toBe(
      'SEAT_NOT_DEALT_IN',
    );
  });

  it('refuses a card another seat already holds', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    hand = play(hand, [setHoleCards(0, cards('As Kd'), false)], factory);
    expect(errCode(applyCommand(hand, setHoleCards(1, cards('As Qc'), true), factory))).toBe(
      'DUPLICATE_CARD',
    );
  });

  it('does not consume a command slot in the betting order', () => {
    const factory = ids();
    let hand = start(sixHanded(), factory);
    const actor = hand.state.actorSeat;
    hand = play(hand, [setHoleCards(0, cards('As Kd'), false)], factory);
    expect(hand.state.actorSeat).toBe(actor);
  });
});

describe('validateCommand is a pure precondition check', () => {
  it('agrees with applyCommand without constructing any event', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    const before = hand.events.length;
    expect(validateCommand(hand.state, fold()).ok).toBe(true);
    expect(errCode(validateCommand(hand.state, check()))).toBe('CHECK_NOT_ALLOWED');
    expect(errCode(validateCommand(hand.state, betTo(BB(3))))).toBe('BET_NOT_ALLOWED');
    expect(errCode(validateCommand(hand.state, awardPots([])))).toBe('NOT_AWAITING_AWARD');
    expect(hand.events.length).toBe(before);
  });

  it('refuses every action once the hand is complete', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), fold(), fold()],
      factory,
    );
    for (const command of [fold(), check(), call(), allIn(), raiseTo(BB(3)), betTo(BB(3))]) {
      expect(errCode(validateCommand(hand.state, command))).toBe('HAND_ALREADY_FINISHED');
    }
    expect(errCode(validateCommand(hand.state, dealBoard(cards('As Kd 7c'))))).toBe(
      'HAND_ALREADY_FINISHED',
    );
  });
});

describe('the command cascade', () => {
  it('groups one keystroke and every derived consequence under one commandSeq', () => {
    const factory = ids();
    const before = play(start(sixHanded(), factory), [fold(), fold(), fold(), fold()], factory);
    const after = play(before, [fold()], factory);
    const group = after.events.filter((e) => e.commandSeq === 5);
    expect(group.map((e) => `${e.origin}:${e.kind}`)).toEqual([
      'USER:FOLD',
      'ENGINE:RETURN_UNCALLED',
      'ENGINE:POT_AWARDED',
      'ENGINE:HAND_FINISHED',
    ]);
  });

  it('never auto-deals a board and never auto-awards a contested pot', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), check(), check(), check(), dealBoard(cards('2h'))],
      factory,
    );
    hand = play(hand, [check(), check(), check(), dealBoard(cards('9s'))], factory);
    hand = play(hand, [check(), check(), check()], factory);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.awards).toEqual([]);
    expect(hand.events.some((e) => e.kind === 'POT_AWARDED')).toBe(false);
  });

  it('emits the award as USER origin when the user supplied the winner', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(
      hand,
      [dealBoard(cards('As Kd 7c')), check(), check(), check(), dealBoard(cards('2h'))],
      factory,
    );
    hand = play(hand, [check(), check(), check(), dealBoard(cards('9s'))], factory);
    hand = play(hand, [check(), check(), check()], factory);
    hand = play(hand, [awardPots([{ potIndex: 0, winners: [2] }])], factory);
    const award = hand.events.find((e) => e.kind === 'POT_AWARDED');
    expect(award?.origin).toBe('USER');
    expect(hand.events.at(-1)?.kind).toBe('HAND_FINISHED');
    expect(hand.events.at(-1)?.origin).toBe('ENGINE');
  });
});
