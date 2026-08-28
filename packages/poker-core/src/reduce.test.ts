import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { fold, call, check, raiseTo, dealBoard } from './commands.js';
import { finalizeRoster, foldEvents, initialHandState, seedPreflopRound } from './reduce.js';
import {
  ANTE_PRESET,
  BB,
  NO_ANTE_PRESET,
  buildTable,
  c,
  cards,
  ids,
  play,
  sixHanded,
  start,
} from './testing.js';
import type { HandEvent } from './events.js';
import { applyEvent } from './reduce.js';
import { asId, type EventId } from '@gto-self/shared';

/** UTG, HJ and CO fold; the button limps; the small blind completes; the big blind checks. */
const LIMP_TO_FLOP = [fold(), fold(), fold(), call(), call(), check()];

describe('command group 0: dealing in, antes and blinds', () => {
  it('emits HAND_STARTED, then PLAYER_DEALT_IN ascending, then antes from the SB, then SB and BB', () => {
    const factory = ids();
    const hand = start(sixHanded(ANTE_PRESET), factory);
    const kinds = hand.events.map((e) => e.kind);
    expect(kinds).toEqual([
      'HAND_STARTED',
      ...Array<string>(6).fill('PLAYER_DEALT_IN'),
      ...Array<string>(6).fill('POST_ANTE'),
      'POST_SB',
      'POST_BB',
    ]);
    expect(hand.events.filter((e) => e.kind === 'PLAYER_DEALT_IN').map(seatOf)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    // Ring order from the small blind (seat 1), not ascending physical order.
    expect(hand.events.filter((e) => e.kind === 'POST_ANTE').map(seatOf)).toEqual([
      1, 2, 3, 4, 5, 0,
    ]);
    expect(hand.events.every((e) => e.commandSeq === 0)).toBe(true);
    expect(hand.events.map((e) => e.seq)).toEqual([...Array(15).keys()]);
  });

  it('marks the start USER and every derived posting ENGINE', () => {
    const hand = start(sixHanded(ANTE_PRESET), ids());
    expect(hand.events[0]?.origin).toBe('USER');
    expect(hand.events.slice(1).every((e) => e.origin === 'ENGINE')).toBe(true);
  });

  it('antes are dead money: they never raise the price to call', () => {
    const hand = start(sixHanded(ANTE_PRESET), ids());
    const state = hand.state;
    expect(state.round.currentBet).toBe(BB(1));
    for (const seat of state.dealtInSeats) {
      expect(state.seats[seat].deadContribution).toBe(Money.mbb(160));
    }
    // 6 antes + SB + BB.
    expect(state.potTotal).toBe(Money.mbb(160 * 6 + 500 + 1000));
    expect(state.seats[3].streetContribution).toBe(Money.ZERO);
    expect(state.seats[3].totalContribution).toBe(Money.mbb(160));
    expect(state.seats[1].streetContribution).toBe(BB(0.5));
    expect(state.seats[2].streetContribution).toBe(BB(1));
  });

  it('scales the ante with the number of dealt-in players', () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const stacks = Object.fromEntries(
        Array.from({ length: count }, (_unused, seat) => [seat, BB(100)]),
      );
      const table = buildTable({ config: ANTE_PRESET, stacks, buttonSeat: 0 });
      const hand = start(table, ids());
      expect(hand.state.dealtInSeats).toHaveLength(count);
      expect(hand.state.potTotal).toBe(Money.mbb(160 * count + 500 + 1000));
    }
  });

  it('posts blinds correctly with only two dealt-in seats (button posts the SB)', () => {
    const table = buildTable({ stacks: { 2: BB(100), 5: BB(100) }, buttonSeat: 5 });
    const hand = start(table, ids());
    expect(hand.state.blinds).toEqual({
      buttonSeat: 5,
      smallBlindSeat: 5,
      bigBlindSeat: 2,
      headsUp: true,
    });
    expect(hand.state.seats[5].streetContribution).toBe(BB(0.5));
    expect(hand.state.seats[2].streetContribution).toBe(BB(1));
    expect(hand.state.actorSeat).toBe(5);
  });

  it('clamps a blind a short stack cannot cover and puts that seat all-in', () => {
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(0.3), 2: BB(100) },
      buttonSeat: 0,
    });
    const hand = start(table, ids());
    expect(hand.state.seats[1].streetContribution).toBe(BB(0.3));
    expect(hand.state.seats[1].status).toBe('ALL_IN');
    expect(hand.state.seats[1].stack).toBe(Money.ZERO);
  });

  it('a short big blind still sets the full price of entry (shortBlindSetsFullLevel)', () => {
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(0.4) },
      buttonSeat: 0,
    });
    const hand = start(table, ids());
    expect(hand.state.seats[2].streetContribution).toBe(BB(0.4));
    expect(hand.state.round.currentBet).toBe(BB(1));
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(1));
  });

  it('with the flag off, a short big blind lowers the price of entry', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...NO_ANTE_PRESET.rules, shortBlindSetsFullLevel: false },
    };
    const table = buildTable({
      config,
      stacks: { 0: BB(100), 1: BB(100), 2: BB(0.4) },
      buttonSeat: 0,
    });
    const hand = start(table, ids());
    expect(hand.state.round.currentBet).toBe(BB(0.5));
  });

  it('clamps antes too, and an ante that busts a seat leaves it all-in', () => {
    const table = buildTable({
      config: ANTE_PRESET,
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(0.1) },
      buttonSeat: 0,
    });
    const hand = start(table, ids());
    const ante = hand.events.find((e) => e.kind === 'POST_ANTE' && e.seat === 3);
    expect(ante && 'amount' in ante ? ante.amount : null).toBe(BB(0.1));
    expect(hand.state.seats[3].status).toBe('ALL_IN');
  });
});

function seatOf(event: HandEvent): number | null {
  return 'seat' in event ? event.seat : null;
}

describe('roster finalization', () => {
  it('produces SETUP with an empty roster and no positions', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    const started = hand.events[0];
    expect(started?.kind).toBe('HAND_STARTED');
    if (started === undefined || started.kind !== 'HAND_STARTED') throw new Error('bad log');
    const initial = initialHandState(started);
    expect(initial.phase).toBe('SETUP');
    expect(initial.dealtInSeats).toEqual([]);
    expect(initial.pots).toEqual([]);
    expect(initial.round.actionOrder).toEqual([]);
    expect(initial.positions[0]).toBeNull();
  });

  it('assigns blinds, positions and the preflop round exactly once', () => {
    const factory = ids();
    const hand = start(sixHanded(), factory);
    const roster = hand.events.filter(
      (e) => e.kind === 'HAND_STARTED' || e.kind === 'PLAYER_DEALT_IN',
    );
    const setup = foldEvents(roster);
    expect(setup.phase).toBe('SETUP');
    const finalized = finalizeRoster(setup);
    expect(finalized.blinds.smallBlindSeat).toBe(1);
    expect(finalized.positions[3]?.position).toBe('UTG');
    expect(finalized.round.actionOrder).toEqual([3, 4, 5, 0, 1, 2]);
    expect(() => finalizeRoster(finalized)).toThrow(/exactly once/);
  });

  it('seeds the preflop round with fullRaiseCount 1 and the BB as the aggressor', () => {
    const hand = start(sixHanded(), ids());
    const round = seedPreflopRound(hand.state);
    expect(round).toMatchObject({
      street: 'PREFLOP',
      currentBet: BB(1),
      lastFullRaiseSize: BB(1),
      lastFullRaiseTo: BB(1),
      fullRaiseCount: 1,
      lastAggressorSeat: 2,
      lastActedSeat: null,
    });
  });
});

describe('automatic street transitions', () => {
  it('parks in AWAITING_BOARD after preflop closes and never invents a card', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('FLOP');
    expect(hand.state.board).toEqual([]);
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.events.some((e) => e.kind === 'FLOP_DEALT')).toBe(false);
  });

  it('the deal event IS the transition: no STREET_ADVANCED event exists', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    expect(hand.state.street).toBe('FLOP');
    expect(hand.state.board).toHaveLength(3);
    expect(hand.state.phase).toBe('BETTING');
    // Postflop the first live seat left of the button acts first: the small blind.
    expect(hand.state.actorSeat).toBe(1);
    expect(hand.state.round.currentBet).toBe(Money.ZERO);
    expect(hand.state.round.fullRaiseCount).toBe(0);
    expect(hand.state.round.lastFullRaiseSize).toBe(BB(1));
  });

  it('rolls street contributions into contributionByStreet and clears the acted marks', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    const sb = hand.state.seats[1];
    expect(sb.contributionByStreet.PREFLOP).toBe(BB(1));
    expect(sb.contributionByStreet.FLOP).toBe(Money.ZERO);
    expect(sb.streetContribution).toBe(Money.ZERO);
    expect(sb.totalContribution).toBe(BB(1));
    expect(sb.actedAtFullRaiseCount).toBeNull();
  });

  it('walks flop -> turn -> river and then asks for a winner', () => {
    const factory = ids();
    let hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    // Three seats saw the flop: BTN, SB and BB.
    hand = play(hand, [dealBoard(cards('As Kd 7c')), check(), check(), check()], factory);
    expect(hand.state.pendingStreet).toBe('TURN');
    hand = play(hand, [dealBoard(cards('2h')), check(), check(), check()], factory);
    expect(hand.state.pendingStreet).toBe('RIVER');
    hand = play(hand, [dealBoard(cards('9s')), check(), check(), check()], factory);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
    expect(hand.state.street).toBe('RIVER');
    expect(hand.state.board).toHaveLength(5);
  });

  it('runs an all-in board out street by street with nobody ever on the clock', () => {
    const factory = ids();
    const table = buildTable({ stacks: { 0: BB(20), 1: BB(20), 2: BB(20) }, buttonSeat: 0 });
    let hand = play(start(table, factory), [raiseTo(BB(20)), fold(), call()], factory);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.actorSeat).toBeNull();
    hand = play(hand, [dealBoard(cards('As Kd 7c'))], factory);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('TURN');
    expect(hand.state.actorSeat).toBeNull();
    hand = play(hand, [dealBoard(cards('2h'))], factory);
    expect(hand.state.pendingStreet).toBe('RIVER');
    hand = play(hand, [dealBoard(cards('9s'))], factory);
    expect(hand.state.phase).toBe('AWAITING_AWARD');
  });

  it('the command cascade always drains an uncalled return before the engine rests', () => {
    const factory = ids();
    const hand = play(
      start(sixHanded(), factory),
      [fold(), fold(), fold(), raiseTo(BB(3)), fold(), fold()],
      factory,
    );
    // BTN raised to 3 and both blinds folded: the return, the award and the finish all
    // land inside the SAME command group as the last fold, and no state ever rests in
    // AWAITING_UNCALLED_RETURN.
    expect(hand.state.pendingUncalled).toBeNull();
    expect(hand.state.phase).toBe('COMPLETE');
    const lastGroup = hand.events.filter((e) => e.commandSeq === 6).map((e) => e.kind);
    expect(lastGroup).toEqual(['FOLD', 'RETURN_UNCALLED', 'POT_AWARDED', 'HAND_FINISHED']);
  });

  it('throws rather than dealing a board while an uncalled bet is still owed', () => {
    const factory = ids();
    const hand = play(start(sixHanded(), factory), LIMP_TO_FLOP, factory);
    const owed = { ...hand.state, pendingUncalled: { seat: 0 as const, amount: BB(1) } };
    const flop = hand.events.length;
    expect(() =>
      applyEvent(owed, {
        id: asId<'Event'>('x') as EventId,
        seq: flop,
        commandSeq: 99,
        origin: 'USER',
        kind: 'FLOP_DEALT',
        cards: [c('As'), c('Kd'), c('7c')],
      }),
    ).toThrow(/uncalled bet/);
  });
});
