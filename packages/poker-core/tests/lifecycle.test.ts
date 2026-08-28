/**
 * Hand start degenerate cases, the command-list entry point, and handing a finished
 * hand back to the table.
 */
import { describe, expect, it } from 'vitest';
import { asId, Money, type HandId } from '@gto-self/shared';
import { allIn, call, dealBoard, fold, raiseTo, type HandCommand } from '../src/commands.js';
import { replayCommands, startHand } from '../src/hand.js';
import { advanceButton, applyHandResult, createTable, setButtonSeat } from '../src/table.js';
import { ANTE_PRESET, BB, buildTable, cards, ids, sixHanded, start } from '../src/testing.js';
import { awardAllTo, stacks, step } from './_helpers.js';

describe('starting a hand', () => {
  it('refuses fewer than two dealt-in seats', () => {
    const table = buildTable({ stacks: { 0: BB(100) }, buttonSeat: 0 });
    expect(startHand(table, { handId: asId<'Hand'>('h') as HandId }, ids())).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_PLAYERS' },
    });
  });

  it('refuses a table with no button', () => {
    const empty = createTable(ANTE_PRESET);
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(startHand(empty.value, { handId: asId<'Hand'>('h') as HandId }, ids())).toMatchObject({
      ok: false,
    });
  });

  it('parks in AWAITING_BOARD when the antes put everybody all-in', () => {
    // Every stack is smaller than the 0.16 BB ante.
    const table = buildTable({
      config: ANTE_PRESET,
      stacks: {
        0: Money.mbb(100),
        1: Money.mbb(100),
        2: Money.mbb(100),
        3: Money.mbb(100),
        4: Money.mbb(100),
        5: Money.mbb(100),
      },
      buttonSeat: 0,
    });
    const st = start(table, ids()).state;

    expect(st.potTotal).toBe(600); // 6 x 100, nothing left for the blinds
    for (const seat of st.dealtInSeats) {
      expect(st.seats[seat].status).toBe('ALL_IN');
      expect(st.seats[seat].stack).toBe(0);
    }
    // Nobody can possibly be put on the clock.
    expect(st.actorSeat).toBeNull();
    expect(st.phase).toBe('AWAITING_BOARD');
    expect(st.pendingStreet).toBe('FLOP');
  });

  it('lets the hero fold without ending the hand', () => {
    const f = ids();
    let hand = start(sixHanded(), f); // hero is seat 0
    expect(hand.state.heroSeat).toBe(0);
    hand = step(hand, fold(), f); // UTG
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN — the hero
    expect(hand.state.seats[0].status).toBe('FOLDED');
    expect(hand.state.phase).toBe('BETTING'); // SB and BB are still live
    expect(hand.state.actorSeat).toBe(1);
  });
});

describe('replayCommands', () => {
  const SCRIPT: readonly HandCommand[] = [
    raiseTo(Money.mbb(3000)),
    fold(),
    fold(),
    call(),
    fold(),
    call(),
    dealBoard(cards('Ah Kd 7c')),
  ];

  it('reproduces the same hand as applying the commands one at a time', () => {
    const table = sixHanded();
    const f = ids();
    let stepwise = start(table, f);
    for (const command of SCRIPT) stepwise = step(stepwise, command, f);

    const replayed = replayCommands(table, { handId: asId<'Hand'>('h1') as HandId }, SCRIPT, ids());
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(replayed.value.events).toEqual(stepwise.events);
      expect(replayed.value.state).toEqual(stepwise.state);
    }
  });

  it('reports the failing command rather than half-applying the list', () => {
    const bad = [...SCRIPT.slice(0, 1), raiseTo(Money.mbb(3500)), ...SCRIPT.slice(2)];
    const result = replayCommands(
      sixHanded(),
      { handId: asId<'Hand'>('h1') as HandId },
      bad,
      ids(),
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'AMOUNT_BELOW_MINIMUM' } });
  });
});

describe('handing a finished hand back to the table', () => {
  it('writes the ending stacks back and bumps the hand number', () => {
    const f = ids();
    const table = sixHanded();
    let hand = start(table, f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f); // a walk

    const next = applyHandResult(table, hand);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value.seats[1].stack).toBe(99500);
    expect(next.value.seats[2].stack).toBe(100500);
    expect(next.value.seats[0].stack).toBe(100000);
    expect(next.value.handNumber).toBe(table.handNumber + 1);
    // Advancing the button is a separate, explicit step.
    expect(next.value.buttonSeat).toBe(0);
    const moved = advanceButton(next.value);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.value.buttonSeat).toBe(1);
  });

  it('refuses a hand that is not complete', () => {
    const table = sixHanded();
    const hand = start(table, ids());
    expect(applyHandResult(table, hand)).toMatchObject({
      ok: false,
      error: { code: 'HAND_NOT_COMPLETE' },
    });
  });

  it('skips busted seats when the button moves', () => {
    const f = ids();
    const table = buildTable({
      stacks: {
        0: BB(100),
        1: BB(100),
        2: Money.mbb(60_000),
        3: Money.mbb(20_000),
        4: BB(100),
        5: BB(100),
      },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, allIn(), f); // UTG (3)
    hand = step(hand, fold(), f);
    hand = step(hand, fold(), f);
    hand = step(hand, call(), f); // BTN (0)
    hand = step(hand, fold(), f);
    hand = step(hand, allIn(), f); // BB (2)
    hand = step(hand, call(), f); // BTN calls
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    hand = step(hand, awardAllTo(hand.state, 0), f);
    expect(stacks(hand.state)[2]).toBe(0);
    expect(stacks(hand.state)[3]).toBe(0);

    const settled = applyHandResult(table, hand);
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    const onSeatOne = setButtonSeat(settled.value, 1);
    expect(onSeatOne.ok).toBe(true);
    if (!onSeatOne.ok) return;
    // Seats 2 and 3 are broke, so the button jumps to seat 4.
    const moved = advanceButton(onSeatOne.value);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.value.buttonSeat).toBe(4);
  });
});
