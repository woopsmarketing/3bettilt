import { describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Money, sequentialIdFactory } from '@gto-self/shared';
import type { MilliBB } from '@gto-self/shared';
import type { ActionRecord, HandState, SeatIndex, TableState } from '@gto-self/poker-core';
import { makeTestTable } from '../../lib/table/testTable.js';
import type { TableStore } from '../../lib/table/tableStore.js';
import { ActionDock } from './ActionDock.js';
import { TableStoreProvider, useTableStore, useTableStoreApi } from './TableStoreProvider.js';

/**
 * Phase 6 — the action path.
 *
 * Every assertion below is made against ENGINE STATE (`store.getState().hand.state`) and
 * not against which handler ran: the point of the phase is that a key produces the right
 * `poker-core` command, and only the engine can testify to that.
 */

/** Renders the dock over a real store and hands the store back for state assertions. */
function renderDock(table: TableState): TableStore {
  let captured: TableStore | null = null;

  function Capture() {
    captured = useTableStoreApi();
    const view = useTableStore((state) => state.view);
    return <ActionDock view={view} />;
  }

  render(
    <TableStoreProvider
      init={{
        sessionId: 'session-1',
        table,
        autoTopUp: null,
        ids: sequentialIdFactory('test'),
      }}
    >
      <Capture />
    </TableStoreProvider>,
  );

  if (captured === null) throw new Error('store was not captured');
  return captured;
}

/** Four handed, hero on the button, so preflop opens on seat 3 facing a 1 BB call. */
const fourHanded = (): TableState =>
  makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 0 });

const start = (store: TableStore): void => {
  act(() => {
    store.getState().startHand();
  });
};

const press = (key: string): void => {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
};

/**
 * Fires a keydown carrying both `key` and `code`, so a Korean (or other non-Latin) IME
 * can be simulated: the IME rewrites `key` to a jamo or to `'Process'` while composing,
 * but never touches `code`, the physical key position.
 */
const pressPhysical = (key: string, code: string): void => {
  act(() => {
    fireEvent.keyDown(window, { key, code });
  });
};

const handState = (store: TableStore): HandState => {
  const hand = store.getState().hand;
  if (hand === null) throw new Error('no hand in progress');
  return hand.state;
};

const actorSeat = (store: TableStore): SeatIndex => {
  const view = store.getState().view;
  if (view === null || view.phase.kind !== 'AWAITING_ACTION') throw new Error('nobody to act');
  return view.phase.actor.seat;
};

const actorOf = (store: TableStore) => {
  const view = store.getState().view;
  if (view === null || view.phase.kind !== 'AWAITING_ACTION') throw new Error('nobody to act');
  return view.phase.actor;
};

const lastAction = (store: TableStore): ActionRecord => {
  const actions = handState(store).actions;
  const record = actions[actions.length - 1];
  if (record === undefined) throw new Error('no action recorded');
  return record;
};

/** Pot and every dealt-in stack — the values undo must restore exactly. */
interface Snapshot {
  readonly actor: SeatIndex;
  readonly pot: MilliBB;
  readonly stacks: readonly MilliBB[];
  readonly contributions: readonly MilliBB[];
}

const snapshot = (store: TableStore): Snapshot => {
  const state = handState(store);
  return {
    actor: actorSeat(store),
    pot: state.potTotal,
    stacks: state.dealtInSeats.map((seat) => state.seats[seat].stack),
    contributions: state.dealtInSeats.map((seat) => state.seats[seat].streetContribution),
  };
};

describe('ActionDock — C: one key, the engine picks CHECK or CALL', () => {
  it('dispatches CALL when the engine says the call amount is positive', () => {
    const store = renderDock(fourHanded());
    start(store);

    const actor = actorOf(store);
    expect(actor.legal.call).not.toBeNull();
    expect(Money.isPositive(actor.legal.call!.amount)).toBe(true);
    const expectedTo = actor.legal.call!.toAmount;
    const stackBefore = actor.stack;

    press('c');

    const record = lastAction(store);
    expect(record.kind).toBe('CALL');
    expect(record.seat).toBe(actor.seat);
    const seat = handState(store).seats[actor.seat];
    expect(seat.streetContribution).toBe(expectedTo);
    expect(seat.stack).toBe(Money.sub(stackBefore, actor.legal.call!.amount));
  });

  it('dispatches CHECK when the engine says the call amount is zero', () => {
    const store = renderDock(fourHanded());
    start(store);
    // Fold to the big blind, then let the small blind complete so BB faces nothing.
    press('f');
    press('f');
    press('c'); // small blind completes: this is still a CALL
    expect(lastAction(store).kind).toBe('CALL');

    const actor = actorOf(store);
    expect(actor.legal.call).toBeNull();
    expect(actor.legal.canCheck).toBe(true);
    const contributionBefore = actor.streetContribution;

    press('c');

    const record = lastAction(store);
    expect(record.kind).toBe('CHECK');
    expect(record.seat).toBe(actor.seat);
    // A check moves no money.
    expect(handState(store).seats[actor.seat].streetContribution).toBe(contributionBefore);
    // Preflop is closed: the engine now wants a flop.
    expect(store.getState().view?.phase.kind).toBe('AWAITING_BOARD');
  });

  it('the C button produces the same engine state as the C key', () => {
    const byKey = renderDock(fourHanded());
    start(byKey);
    press('c');
    const keyHand = byKey.getState().hand;
    // Unmount before the second run so `screen` addresses exactly one dock.
    cleanup();

    const byClick = renderDock(fourHanded());
    start(byClick);
    act(() => {
      fireEvent.click(screen.getByTestId('dock-C'));
    });

    // Identical id factories, so an identical command yields a byte-identical event log.
    expect(byClick.getState().hand).toEqual(keyHand);
  });
});

describe('ActionDock — F, A, Z', () => {
  it('F folds the seat on the clock', () => {
    const store = renderDock(fourHanded());
    start(store);
    const seat = actorSeat(store);

    press('f');

    expect(lastAction(store).kind).toBe('FOLD');
    expect(handState(store).seats[seat].status).toBe('FOLDED');
  });

  it('A commits the seat’s whole stack at the engine’s all-in level', () => {
    const store = renderDock(fourHanded());
    start(store);
    const actor = actorOf(store);
    expect(actor.legal.allIn).not.toBeNull();
    const expectedTo = actor.legal.allIn!.toAmount;

    press('a');

    expect(lastAction(store).kind).toBe('ALL_IN');
    const seat = handState(store).seats[actor.seat];
    expect(seat.stack).toBe(Money.ZERO);
    expect(seat.streetContribution).toBe(expectedTo);
  });

  it('Z removes the last logical command', () => {
    const store = renderDock(fourHanded());
    start(store);
    const before = handState(store).actions.length;

    press('f');
    expect(handState(store).actions.length).toBe(before + 1);

    press('z');
    expect(handState(store).actions.length).toBe(before);
  });

  it('F, C, A and Z are inert before a hand exists', () => {
    const store = renderDock(fourHanded());

    for (const key of ['f', 'c', 'a', 'z', 'r']) press(key);

    expect(store.getState().hand).toBeNull();
    // Inert means nothing was dispatched at all — not "dispatched and rejected".
    expect(store.getState().lastError).toBeNull();
    for (const key of ['F', 'C', 'A', 'Z']) {
      expect(screen.getByTestId(`dock-${key}`)).toBeDisabled();
    }
    expect(screen.getByTestId('raise-input')).toBeDisabled();
  });

  it('Z is inert when the engine says there is nothing to undo', () => {
    const store = renderDock(fourHanded());
    start(store);
    // A freshly dealt hand is one command deep; undo it and the hand is gone from the
    // engine's point of view, so `canUndo` is false and Z must do nothing.
    expect(store.getState().view?.canUndo).toBe(false);
    const before = store.getState().hand;

    press('z');

    expect(store.getState().hand).toEqual(before);
    expect(store.getState().lastError).toBeNull();
    expect(screen.getByTestId('dock-Z')).toBeDisabled();
  });
});

describe('ActionDock — the raise-to editor', () => {
  it('R 9 Enter makes the actor’s street contribution exactly 9 BB', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const seat = actorSeat(store);

    press('r');
    const input = screen.getByTestId('raise-input');
    expect(input).toHaveFocus();
    await user.type(input, '9');
    await user.keyboard('{Enter}');

    const contribution = handState(store).seats[seat].streetContribution;
    expect(contribution).toBe(Money.fromBB(9));
    expect(Number.isInteger(contribution)).toBe(true);
    expect(contribution).toBe(9000);
    expect(lastAction(store).kind).toBe('RAISE');
    // The field is cleared only because the amount was consumed by a real action.
    expect(screen.getByTestId('raise-input')).toHaveValue('');
  });

  it('refuses an amount below the engine’s minimum, names the bound and keeps the text', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const wager = actorOf(store).legal.wager!;
    const before = handState(store).actions.length;

    press('r');
    const input = screen.getByTestId('raise-input');
    await user.type(input, '1.5');
    await user.keyboard('{Enter}');

    expect(handState(store).actions.length).toBe(before);
    expect(store.getState().lastError).toBeNull();
    expect(screen.getByTestId('raise-input')).toHaveValue('1.5');
    expect(screen.getByTestId('raise-problem')).toHaveTextContent(
      `최소 ${Money.formatBB(wager.minToAmount, { maxDecimals: 3 })} BB`,
    );
  });

  it('refuses an amount above the engine’s maximum, names the bound and keeps the text', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const wager = actorOf(store).legal.wager!;
    const before = handState(store).actions.length;
    const tooMuch = Money.formatBB(Money.add(wager.maxToAmount, Money.fromBB(1)), {
      maxDecimals: 3,
    });

    press('r');
    await user.type(screen.getByTestId('raise-input'), tooMuch);
    await user.keyboard('{Enter}');

    expect(handState(store).actions.length).toBe(before);
    expect(screen.getByTestId('raise-input')).toHaveValue(tooMuch);
    expect(screen.getByTestId('raise-problem')).toHaveTextContent(
      `최대 ${Money.formatBB(wager.maxToAmount, { maxDecimals: 3 })} BB`,
    );
  });

  it.each(['abc', '1.2.3', '-5', '9.9999'])(
    'refuses garbage input %s without dispatching and without clearing the field',
    async (text) => {
      const user = userEvent.setup();
      const store = renderDock(fourHanded());
      start(store);
      const before = handState(store).actions.length;

      press('r');
      await user.type(screen.getByTestId('raise-input'), text);
      await user.keyboard('{Enter}');

      expect(handState(store).actions.length).toBe(before);
      expect(store.getState().lastError).toBeNull();
      expect(screen.getByTestId('raise-input')).toHaveValue(text);
      expect(screen.getByTestId('raise-problem')).toBeInTheDocument();
    },
  );

  it('an empty confirm is refused and says what is missing', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const before = handState(store).actions.length;

    press('r');
    await user.keyboard('{Enter}');

    expect(handState(store).actions.length).toBe(before);
    expect(screen.getByTestId('raise-problem')).toHaveTextContent('레이즈 금액');
  });

  it('Esc cancels without dispatching and keeps what was typed', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const before = handState(store).actions.length;

    press('r');
    await user.type(screen.getByTestId('raise-input'), '9');
    await user.keyboard('{Escape}');

    expect(handState(store).actions.length).toBe(before);
    expect(screen.queryByTestId('raise-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('raise-input')).toHaveValue('9');
  });

  it('shows the engine’s own preview numbers, never its own arithmetic', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const actor = actorOf(store);
    const wager = actor.legal.wager!;

    press('r');
    await user.type(screen.getByTestId('raise-input'), '9');

    expect(screen.getByTestId('raise-preview-to')).toHaveTextContent('9 BB');
    expect(screen.getByTestId('raise-preview-additional')).toHaveTextContent(
      Money.formatBB(Money.sub(Money.fromBB(9), actor.streetContribution), {
        maxDecimals: 3,
        unit: true,
      }),
    );
    expect(screen.getByTestId('raise-preview-min')).toHaveTextContent(
      Money.formatBB(wager.minToAmount, { maxDecimals: 3, unit: true }),
    );
    expect(screen.getByTestId('raise-preview-max')).toHaveTextContent(
      Money.formatBB(wager.maxToAmount, { maxDecimals: 3, unit: true }),
    );
  });

  it('the raise button produces the same engine state as R … Enter', async () => {
    const user = userEvent.setup();
    const byKey = renderDock(fourHanded());
    start(byKey);
    press('r');
    await user.type(screen.getByTestId('raise-input'), '9');
    await user.keyboard('{Enter}');
    const keyHand = byKey.getState().hand;
    cleanup();

    const byClick = renderDock(fourHanded());
    start(byClick);
    await user.type(screen.getByTestId('raise-input'), '9');
    act(() => {
      fireEvent.click(screen.getByTestId('raise-confirm'));
    });

    expect(byClick.getState().hand).toEqual(keyHand);
  });
});

describe('ActionDock — raise-TO, where raise-to and raise-by differ', () => {
  /**
   * `R 9 Enter` means "make my street contribution 9 BB", never "put another 9 BB in".
   * Every test above acts from UTG, whose street contribution is 0, where the two
   * readings coincide. These act from seats that are already in for something, so they
   * separate. Each asserts the engine's own resulting state, in whole milliBB.
   */
  const raiseTo = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    press('r');
    await user.type(screen.getByTestId('raise-input'), text);
    await user.keyboard('{Enter}');
  };

  it('the small blind raising to 9 is in for exactly 9 BB, not 9.5', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    press('f'); // UTG
    press('f'); // button

    const actor = actorOf(store);
    expect(actor.seat).toBe(1);
    // The premise: this seat is ALREADY in for the small blind.
    expect(Money.isPositive(actor.streetContribution)).toBe(true);
    expect(actor.streetContribution).toBe(Money.fromBB(0.5));
    const stackBefore = actor.stack;

    await raiseTo(user, '9');

    const seat = handState(store).seats[1];
    expect(lastAction(store).kind).toBe('RAISE');
    expect(seat.streetContribution).toBe(Money.fromBB(9));
    expect(seat.streetContribution).toBe(9000);
    expect(Number.isInteger(seat.streetContribution)).toBe(true);
    // Only the DIFFERENCE leaves the stack: 8.5 BB, not 9.
    expect(seat.stack).toBe(Money.sub(stackBefore, Money.fromBB(8.5)));
    expect(lastAction(store).toAmount).toBe(Money.fromBB(9));
  });

  it('the big blind raising to 9 is in for exactly 9 BB, not 10', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    press('f'); // UTG
    press('f'); // button
    press('c'); // small blind completes

    const actor = actorOf(store);
    expect(actor.seat).toBe(2);
    expect(actor.streetContribution).toBe(Money.fromBB(1));
    const stackBefore = actor.stack;

    await raiseTo(user, '9');

    const seat = handState(store).seats[2];
    expect(seat.streetContribution).toBe(Money.fromBB(9));
    expect(seat.streetContribution).toBe(9000);
    expect(Number.isInteger(seat.streetContribution)).toBe(true);
    expect(seat.stack).toBe(Money.sub(stackBefore, Money.fromBB(8)));
  });

  it('a re-raise over a raise is to the typed amount, not the typed amount more', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);

    expect(actorSeat(store)).toBe(3);
    await raiseTo(user, '3'); // UTG opens to 3
    expect(handState(store).seats[3].streetContribution).toBe(Money.fromBB(3));

    expect(actorSeat(store)).toBe(0);
    await raiseTo(user, '9'); // button three-bets to 9
    press('f'); // small blind
    press('f'); // big blind

    const actor = actorOf(store);
    expect(actor.seat).toBe(3);
    expect(actor.streetContribution).toBe(Money.fromBB(3));
    const stackBefore = actor.stack;

    await raiseTo(user, '20');

    const seat = handState(store).seats[3];
    expect(seat.streetContribution).toBe(Money.fromBB(20));
    expect(seat.streetContribution).toBe(20000);
    expect(Number.isInteger(seat.streetContribution)).toBe(true);
    expect(seat.stack).toBe(Money.sub(stackBefore, Money.fromBB(17)));
    expect(lastAction(store).toAmount).toBe(Money.fromBB(20));
  });
});

describe('ActionDock — hotkeys never fire while the user is typing', () => {
  it('typing f into the raise editor does not fold', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const seat = actorSeat(store);
    const before = handState(store).actions.length;

    press('r');
    await user.type(screen.getByTestId('raise-input'), 'f');

    expect(handState(store).actions.length).toBe(before);
    expect(handState(store).seats[seat].status).not.toBe('FOLDED');
    expect(screen.getByTestId('raise-input')).toHaveValue('f');
  });

  it('a keydown from any text field is ignored', () => {
    const store = renderDock(fourHanded());
    start(store);
    const before = handState(store).actions.length;

    const field = document.createElement('input');
    document.body.appendChild(field);
    act(() => {
      fireEvent.keyDown(field, { key: 'f' });
      fireEvent.keyDown(field, { key: 'a' });
    });
    field.remove();

    expect(handState(store).actions.length).toBe(before);
  });

  it('a browser chord such as Cmd+R is not intercepted', () => {
    const store = renderDock(fourHanded());
    start(store);
    const before = handState(store).actions.length;

    act(() => {
      fireEvent.keyDown(window, { key: 'f', metaKey: true });
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    });

    expect(handState(store).actions.length).toBe(before);
  });
});

describe('ActionDock — hotkeys survive a non-Latin IME', () => {
  /**
   * The real-user bug: with a Korean (Hangul) input source active, a browser `keydown`
   * does not deliver `event.key === 'f'`. It delivers the Hangul jamo, or `'Process'`
   * while the IME is composing. The dock must still resolve the physical key.
   */
  it('F folds when the IME delivers a Hangul jamo for the physical F key', () => {
    const store = renderDock(fourHanded());
    start(store);
    const seat = actorSeat(store);

    pressPhysical('ㄹ', 'KeyF');

    expect(lastAction(store).kind).toBe('FOLD');
    expect(handState(store).seats[seat].status).toBe('FOLDED');
  });

  it('C calls when the IME reports `Process` while composing over the physical C key', () => {
    const store = renderDock(fourHanded());
    start(store);

    pressPhysical('Process', 'KeyC');

    expect(lastAction(store).kind).toBe('CALL');
  });

  it('Escape still closes the raise editor when the IME rewrites `key`', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const before = handState(store).actions.length;

    pressPhysical('ㄹ', 'KeyR'); // R opens the editor
    await user.type(screen.getByTestId('raise-input'), '9');

    // Escape is a named key: an IME never rewrites it away from the literal 'Escape'.
    pressPhysical('Escape', 'Escape');

    expect(handState(store).actions.length).toBe(before);
    expect(screen.queryByTestId('raise-panel')).not.toBeInTheDocument();
  });
});

describe('ActionDock — undo restores the table exactly', () => {
  it('restores actor, pot, stacks and contributions after a raise', async () => {
    const user = userEvent.setup();
    const store = renderDock(fourHanded());
    start(store);
    const before = snapshot(store);

    press('r');
    await user.type(screen.getByTestId('raise-input'), '9');
    await user.keyboard('{Enter}');
    expect(snapshot(store)).not.toEqual(before);

    press('z');

    expect(snapshot(store)).toEqual(before);
  });

  it('restores actor, pot, stacks and contributions after a call', () => {
    const store = renderDock(fourHanded());
    start(store);
    const before = snapshot(store);

    press('c');
    expect(snapshot(store)).not.toEqual(before);

    press('z');

    expect(snapshot(store)).toEqual(before);
  });
});

describe('ActionDock — N is a real advance, and only between hands', () => {
  it('is inert while a hand is live', () => {
    const store = renderDock(fourHanded());
    start(store);
    const before = store.getState().hand;

    press('n');

    expect(store.getState().hand).toEqual(before);
    expect(store.getState().lastError).toBeNull();
    expect(screen.getByTestId('dock-N')).toBeDisabled();
  });

  it('deals the first hand when none has been dealt', () => {
    const store = renderDock(fourHanded());
    expect(screen.getByTestId('dock-N')).toBeEnabled();

    press('n');

    expect(store.getState().hand).not.toBeNull();
    expect(store.getState().view?.phase.kind).toBe('AWAITING_ACTION');
  });

  it('advances to the next hand once the current one is COMPLETE', () => {
    const store = renderDock(fourHanded());
    start(store);
    const firstButton = handState(store).blinds.buttonSeat;
    const firstNumber = handState(store).handNumber;
    // Four handed: UTG, the button and the small blind all fold, leaving the big blind
    // alone, and the engine settles the hand itself.
    press('f');
    press('f');
    press('f');
    expect(store.getState().view?.phase.kind).toBe('COMPLETE');
    expect(screen.getByTestId('dock-N')).toBeEnabled();

    press('n');

    expect(handState(store).handNumber).toBe(firstNumber + 1);
    expect(handState(store).blinds.buttonSeat).not.toBe(firstButton);
    expect(store.getState().lastError).toBeNull();
  });
});
