import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { parseCard, sequentialIdFactory } from '@gto-self/shared';
import type { Card, MilliBB } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { HandCommand, HandState, HandView, TableState } from '@gto-self/poker-core';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import { makeTestTable, testNicknames } from '../../lib/table/testTable.js';
import type { TableStore } from '../../lib/table/tableStore.js';
import { ActionDock } from './ActionDock.js';
import { AwardPanel } from './AwardPanel.js';
import { CardPalette, useCardEntry } from './CardPalette.js';
import { TableRoot } from './TableRoot.js';
import { TableStoreProvider, useTableStore, useTableStoreApi } from './TableStoreProvider.js';

/**
 * Phase 7 — card entry.
 *
 * Every assertion is made against ENGINE STATE (`store.getState().hand.state` / `view`),
 * not against which handler ran: the palette's job is to produce the right `poker-core`
 * command and to disable exactly the cards the engine calls dead, and only the engine can
 * testify to either.
 */

const card = (text: string): Card => {
  const parsed = parseCard(text);
  if (!parsed.ok) throw new Error(`bad test card ${text}: ${parsed.error}`);
  return parsed.value;
};

/**
 * The palette, the award panel and the dock over ONE real store — the same three
 * components `TableRoot` mounts, wired the same way, with the store handed back for state
 * assertions. `TableRoot` itself is exercised at the bottom of this file.
 */
function renderHarness(table: TableState): TableStore {
  let captured: TableStore | null = null;

  function Harness() {
    captured = useTableStoreApi();
    const view = useTableStore((state) => state.view);
    const heroSeat = useTableStore((state) => state.table.heroSeat);
    const lastError = useTableStore((state) => state.lastError);
    const entry = useCardEntry({ view, heroSeat });
    return (
      <>
        <CardPalette entry={entry} view={view} />
        <AwardPanel view={view} />
        <ActionDock view={view} hotkeysSuppressed={entry.capturing} />
        <p data-testid="harness-error">{lastError === null ? '' : lastError.code}</p>
      </>
    );
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
      <Harness />
    </TableStoreProvider>,
  );

  if (captured === null) throw new Error('store was not captured');
  return captured;
}

/** Four handed, hero on the button: seat 0 BTN/hero, 1 SB, 2 BB, 3 UTG. */
const fourHanded = (): TableState =>
  makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 0 });

const start = (store: TableStore): void => {
  act(() => {
    store.getState().startHand();
  });
};

const handState = (store: TableStore): HandState => {
  const hand = store.getState().hand;
  if (hand === null) throw new Error('no hand in progress');
  return hand.state;
};

/** Every seat's stack, in seat order — the money assertion the award tests make. */
const stacks = (store: TableStore): readonly MilliBB[] =>
  SEAT_INDEXES.map((seat) => handState(store).seats[seat].stack);

const viewOf = (store: TableStore): HandView => {
  const view = store.getState().view;
  if (view === null) throw new Error('no view');
  return view;
};

const applyCmd = (store: TableStore, command: HandCommand): void => {
  act(() => {
    store.getState().apply(command);
  });
};

/** One check or call from whoever is on the clock. The engine decides which is legal. */
const proceed = (store: TableStore): void => {
  const view = viewOf(store);
  if (view.phase.kind !== 'AWAITING_ACTION') throw new Error(`not awaiting action`);
  applyCmd(store, view.phase.actor.legal.canCheck ? { kind: 'CHECK' } : { kind: 'CALL' });
};

/** Runs the betting round out until the engine asks for something else. */
const proceedUntilBettingEnds = (store: TableStore): void => {
  for (let guard = 0; guard < 12; guard += 1) {
    const view = viewOf(store);
    if (view.phase.kind !== 'AWAITING_ACTION') return;
    proceed(store);
  }
  throw new Error('betting round did not end');
};

const clickCard = (text: string): void => {
  fireEvent.click(screen.getByTestId(`palette-${text}`));
};

const paletteEl = (): HTMLElement => screen.getByTestId('card-palette');

const focusPalette = (): void => {
  act(() => {
    paletteEl().focus();
  });
};

/** A key typed at the focused palette. It bubbles to the window, exactly as a real one does. */
const typeAtPalette = (key: string): void => {
  act(() => {
    fireEvent.keyDown(paletteEl(), { key });
  });
};

const typeAtWindow = (key: string): void => {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
};

describe('CardPalette — hero hole cards', () => {
  it('opens itself on a new hand and asks for exactly two cards', () => {
    const store = renderHarness(fourHanded());
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();

    start(store);
    expect(paletteEl()).toHaveAttribute('data-needed', '2');
    expect(handState(store).seats[0].holeCards).toHaveLength(0);
  });

  it('dispatches SET_HOLE_CARDS on the second card and closes itself', () => {
    const store = renderHarness(fourHanded());
    start(store);

    clickCard('As');
    expect(handState(store).seats[0].holeCards).toHaveLength(0);

    clickCard('Kd');
    expect(handState(store).seats[0].holeCards).toEqual(
      expect.arrayContaining([card('As'), card('Kd')]),
    );
    expect(handState(store).seats[0].holeCards).toHaveLength(2);
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
  });

  it('dispatches nothing when only one card is selected', () => {
    const store = renderHarness(fourHanded());
    start(store);

    clickCard('As');
    expect(handState(store).seats[0].holeCards).toHaveLength(0);
    expect(handState(store).actions).toHaveLength(0);
    expect(paletteEl()).toHaveAttribute('data-needed', '1');
  });

  it('disables a card the engine calls dead because ANOTHER seat holds it', () => {
    const store = renderHarness(fourHanded());
    start(store);
    applyCmd(store, {
      kind: 'SET_HOLE_CARDS',
      seat: 2,
      cards: [card('As'), card('Kd')],
      revealed: true,
    });

    // The engine's own set, not a React-side tally.
    expect(viewOf(store).deadCards).toEqual(expect.arrayContaining([card('As'), card('Kd')]));

    const dead = screen.getByTestId('palette-As');
    expect(dead).toBeDisabled();
    expect(dead).toHaveAttribute('data-dead', 'true');

    fireEvent.click(dead);
    expect(handState(store).seats[0].holeCards).toHaveLength(0);
  });

  it('makes a duplicate impossible inside one unsubmitted selection', () => {
    const store = renderHarness(fourHanded());
    start(store);

    clickCard('As');
    expect(screen.getByTestId('palette-As')).toBeDisabled();
    fireEvent.click(screen.getByTestId('palette-As'));
    expect(paletteEl()).toHaveAttribute('data-needed', '1');
    expect(handState(store).seats[0].holeCards).toHaveLength(0);
  });

  it('Z after a submitted pair removes it and re-opens the palette', () => {
    const store = renderHarness(fourHanded());
    start(store);
    clickCard('As');
    clickCard('Kd');
    expect(handState(store).seats[0].holeCards).toHaveLength(2);

    typeAtWindow('z');
    expect(handState(store).seats[0].holeCards).toHaveLength(0);
    expect(paletteEl()).toHaveAttribute('data-needed', '2');
    expect(screen.getByTestId('palette-As')).toBeEnabled();
  });

  it('Esc discards an unsubmitted selection and dispatches nothing', () => {
    const store = renderHarness(fourHanded());
    start(store);
    const before = handState(store);

    clickCard('As');
    focusPalette();
    typeAtPalette('Escape');

    expect(handState(store)).toBe(before);
    expect(store.getState().lastError).toBeNull();
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-palette-open')).toBeInTheDocument();
  });
});

describe('CardPalette — the mode gate', () => {
  it('the dock still owns A and C while the palette is merely open', () => {
    const store = renderHarness(fourHanded());
    start(store);
    expect(paletteEl()).toHaveAttribute('data-capturing', 'false');

    // Seat 3 (UTG) is on the clock and nobody has touched the palette.
    typeAtWindow('a');
    expect(handState(store).seats[3].status).toBe('ALL_IN');
  });

  it('suppresses the dock hotkeys while the palette is capturing', () => {
    const store = renderHarness(fourHanded());
    start(store);
    const actorBefore = viewOf(store).phase;
    const stackBefore = handState(store).seats[3].stack;

    focusPalette();
    expect(paletteEl()).toHaveAttribute('data-capturing', 'true');

    // `a` is the ace, not All-in; `c` is clubs, not Check/Call.
    typeAtPalette('a');
    typeAtPalette('c');

    expect(handState(store).seats[3].status).toBe('IN_HAND');
    expect(handState(store).seats[3].stack).toBe(stackBefore);
    expect(handState(store).actions).toHaveLength(0);
    expect(viewOf(store).phase).toEqual(actorBefore);
    // The two keys built the ace of clubs instead.
    expect(screen.getByTestId('pick-Ac')).toBeInTheDocument();
    expect(paletteEl()).toHaveAttribute('data-needed', '1');
  });
});

describe('CardPalette — keyboard ownership survives a mouse click', () => {
  /**
   * The failure this pins: clicking a card focuses that button, the pick then disables it,
   * and the browser drops focus to `<body>` without an event React sees. Ownership must
   * therefore be explicit state, not a reading of `document.activeElement` — otherwise
   * NEITHER the dock nor the palette hears the keyboard (ADR-0048 forbids exactly that).
   */
  it('still takes rank+suit keys for the remaining card after one card is clicked', async () => {
    const user = userEvent.setup();
    const store = renderHarness(fourHanded());
    start(store);

    await user.click(screen.getByTestId('palette-As'));

    expect(paletteEl()).toHaveAttribute('data-capturing', 'true');
    expect(paletteEl()).toHaveTextContent('keyboard: palette');

    // Typed at whatever really has focus — not at the section by fiat.
    await user.keyboard('kd');

    expect(handState(store).seats[0].holeCards).toEqual(
      expect.arrayContaining([card('As'), card('Kd')]),
    );
    expect(handState(store).seats[0].holeCards).toHaveLength(2);
    expect(store.getState().lastError).toBeNull();
  });

  it('leaves no keyboard without an owner: F is inert for the palette, live after Esc', async () => {
    const user = userEvent.setup();
    const store = renderHarness(fourHanded());
    start(store);

    await user.click(screen.getByTestId('palette-As'));
    // The palette owns the keyboard, so a dock hotkey is inert BY DESIGN...
    await user.keyboard('f');
    expect(handState(store).seats[3].status).toBe('IN_HAND');
    // ...and the palette is provably the owner: it is still hearing keys.
    await user.keyboard('q');
    expect(screen.getByTestId('card-palette-pending')).toHaveTextContent('Q?');

    // Esc must reach the palette even though the dock's listener is suppressed.
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
    expect(handState(store).seats[0].holeCards).toHaveLength(0);

    // The dock owns the keyboard again.
    await user.keyboard('f');
    expect(handState(store).seats[3].status).toBe('FOLDED');
  });

  it('completes a clicked flop by keyboard', async () => {
    const user = userEvent.setup();
    const store = renderHarness(fourHanded());
    start(store);
    proceedUntilBettingEnds(store);
    expect(paletteEl()).toHaveAttribute('data-needed', '3');

    await user.click(screen.getByTestId('palette-2c'));
    expect(paletteEl()).toHaveAttribute('data-capturing', 'true');
    await user.keyboard('7d');
    expect(paletteEl()).toHaveAttribute('data-needed', '1');
    await user.keyboard('9h');

    expect(viewOf(store).board).toEqual([card('2c'), card('7d'), card('9h')]);
  });

  it('negative control: an untouched open palette leaves A to the dock', async () => {
    const user = userEvent.setup();
    const store = renderHarness(fourHanded());
    start(store);

    expect(paletteEl()).toHaveAttribute('data-capturing', 'false');
    expect(paletteEl()).toHaveTextContent('keyboard: action dock');
    await user.keyboard('a');

    expect(handState(store).seats[3].status).toBe('ALL_IN');
  });
});

describe('CardPalette — the board', () => {
  const toFlop = (store: TableStore): void => {
    start(store);
    proceedUntilBettingEnds(store);
  };

  it('asks for three flop cards, then one turn and one river', () => {
    const store = renderHarness(fourHanded());
    toFlop(store);

    expect(viewOf(store).phase).toMatchObject({ kind: 'AWAITING_BOARD', street: 'FLOP' });
    expect(paletteEl()).toHaveAttribute('data-needed', '3');

    clickCard('2c');
    clickCard('7d');
    expect(viewOf(store).board).toHaveLength(0);
    clickCard('9h');
    expect(viewOf(store).board).toEqual([card('2c'), card('7d'), card('9h')]);

    proceedUntilBettingEnds(store);
    expect(viewOf(store).phase).toMatchObject({ kind: 'AWAITING_BOARD', street: 'TURN' });
    expect(paletteEl()).toHaveAttribute('data-needed', '1');
    clickCard('3s');
    expect(viewOf(store).board).toHaveLength(4);

    proceedUntilBettingEnds(store);
    expect(viewOf(store).phase).toMatchObject({ kind: 'AWAITING_BOARD', street: 'RIVER' });
    expect(paletteEl()).toHaveAttribute('data-needed', '1');
    clickCard('4s');
    expect(viewOf(store).board).toEqual([
      card('2c'),
      card('7d'),
      card('9h'),
      card('3s'),
      card('4s'),
    ]);
  });

  it('disables a board card that is already on the board', () => {
    const store = renderHarness(fourHanded());
    toFlop(store);
    clickCard('2c');
    clickCard('7d');
    clickCard('9h');
    proceedUntilBettingEnds(store);

    expect(screen.getByTestId('palette-2c')).toBeDisabled();
    expect(screen.getByTestId('palette-2c')).toHaveAttribute('data-dead', 'true');
  });

  it('Z after a submitted board restores the previous street', () => {
    const store = renderHarness(fourHanded());
    toFlop(store);
    clickCard('2c');
    clickCard('7d');
    clickCard('9h');
    expect(viewOf(store).board).toHaveLength(3);

    // The palette closed on the third card, so the dock owns the keyboard again.
    typeAtWindow('z');
    expect(viewOf(store).board).toHaveLength(0);
    expect(viewOf(store).phase).toMatchObject({ kind: 'AWAITING_BOARD', street: 'FLOP' });
    expect(paletteEl()).toHaveAttribute('data-needed', '3');
  });
});

describe('AwardPanel', () => {
  /** Everyone limps and checks to a four-handed showdown. */
  const toShowdown = (store: TableStore): void => {
    start(store);
    proceedUntilBettingEnds(store);
    applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('2c'), card('7d'), card('9h')] });
    proceedUntilBettingEnds(store);
    applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('3s')] });
    proceedUntilBettingEnds(store);
    applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('4s')] });
    proceedUntilBettingEnds(store);
  };

  it('completes the hand when an eligible seat is awarded the pot', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);

    const view = viewOf(store);
    expect(view.phase.kind).toBe('AWAITING_AWARD');
    if (view.phase.kind !== 'AWAITING_AWARD') throw new Error('unreachable');
    const pot = view.phase.pots[0];
    if (pot === undefined) throw new Error('no pot');
    expect(screen.getByTestId(`award-amount-${pot.index}`)).toHaveTextContent(/\d/u);
    const stackBefore = handState(store).seats[2].stack;

    fireEvent.click(screen.getByTestId(`award-seat-${pot.index}-2`));
    fireEvent.click(screen.getByTestId('award-submit'));

    expect(handState(store).phase).toBe('COMPLETE');
    expect(handState(store).seats[2].stack).toBeGreaterThan(stackBefore);
    expect(store.getState().lastError).toBeNull();
  });

  it('refuses a winner the engine does not consider eligible, and changes nothing', () => {
    const store = renderHarness(fourHanded());
    start(store);
    applyCmd(store, { kind: 'FOLD' }); // seat 3, UTG
    proceedUntilBettingEnds(store);
    applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('2c'), card('7d'), card('9h')] });
    proceedUntilBettingEnds(store);
    applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('3s')] });
    proceedUntilBettingEnds(store);
    applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('4s')] });
    proceedUntilBettingEnds(store);

    const view = viewOf(store);
    if (view.phase.kind !== 'AWAITING_AWARD') throw new Error('expected AWAITING_AWARD');
    const pot = view.phase.pots[0];
    if (pot === undefined) throw new Error('no pot');
    expect(pot.eligibleSeats).not.toContain(3);
    // The folded seat has no button in the panel at all.
    expect(screen.queryByTestId(`award-seat-${pot.index}-3`)).not.toBeInTheDocument();

    const before = handState(store);
    applyCmd(store, {
      kind: 'AWARD_POTS',
      awards: [{ potIndex: pot.index, winners: [3] }],
      fee: null,
    });

    expect(screen.getByTestId('harness-error')).toHaveTextContent('WINNER_NOT_ELIGIBLE');
    expect(handState(store)).toBe(before);
    expect(handState(store).phase).not.toBe('COMPLETE');
  });

  it('starts the next hand with no winner pre-selected and pays only the seat ticked now', () => {
    const store = renderHarness(fourHanded());

    // --- hand 1: the user awards the main pot to seat 3 (index 2) --------------------
    toShowdown(store);
    const firstPot = viewOf(store).phase;
    if (firstPot.kind !== 'AWAITING_AWARD') throw new Error('expected AWAITING_AWARD');
    fireEvent.click(screen.getByTestId('award-seat-0-2'));
    fireEvent.click(screen.getByTestId('award-submit'));
    expect(handState(store).phase).toBe('COMPLETE');

    // --- hand 2: same mounted panel, a brand new hand --------------------------------
    toShowdown(store);
    const view = viewOf(store);
    if (view.phase.kind !== 'AWAITING_AWARD') throw new Error('expected AWAITING_AWARD');
    const pot = view.phase.pots[0];
    if (pot === undefined) throw new Error('no pot');

    // (a) nothing is carried over: no seat is ticked before the user touches anything.
    for (const seat of pot.eligibleSeats) {
      expect(screen.getByTestId(`award-seat-${pot.index}-${seat}`)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }

    // (b) the award pays exactly the seat ticked in THIS hand.
    const before = stacks(store);
    fireEvent.click(screen.getByTestId(`award-seat-${pot.index}-1`));
    fireEvent.click(screen.getByTestId('award-submit'));

    expect(store.getState().lastError).toBeNull();
    expect(handState(store).phase).toBe('COMPLETE');
    const after = stacks(store);
    expect(after[1]!).toBeGreaterThan(before[1]!);
    expect(after[2]).toBe(before[2]);
    expect(after[0]).toBe(before[0]);
    expect(after[3]).toBe(before[3]);
  });

  it('does not let a stale selection split a later pot with the seat the user ticked', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    fireEvent.click(screen.getByTestId('award-seat-0-2'));
    fireEvent.click(screen.getByTestId('award-submit'));

    toShowdown(store);
    const before = stacks(store);
    // The user ticks ONE seat in hand 2. A leaked `[2]` would make this a two-way split.
    fireEvent.click(screen.getByTestId('award-seat-0-1'));
    fireEvent.click(screen.getByTestId('award-submit'));

    const after = stacks(store);
    expect(after[2]).toBe(before[2]);
  });

  it('surfaces NO_WINNERS rather than pre-validating the selection', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);

    fireEvent.click(screen.getByTestId('award-submit'));
    expect(screen.getByTestId('harness-error')).toHaveTextContent('NO_WINNERS');
    expect(handState(store).phase).not.toBe('COMPLETE');
  });
});

describe('TableRoot wiring', () => {
  const noProfile: LoadPlayerProfileAction = async () => ({
    ok: false,
    message: 'not called in this test',
  });

  const renderTable = (table: TableState) =>
    render(
      <TableRoot
        sessionId="session-1"
        label="Test session"
        table={table}
        autoTopUp={null}
        nicknames={testNicknames(SEAT_INDEXES)}
        warnings={[]}
        loadPlayerProfile={noProfile}
        ids={sequentialIdFactory('test')}
      />,
    );

  it('mounts the palette and shows the hero cards it sets', () => {
    renderTable(fourHanded());
    fireEvent.click(screen.getByTestId('start-hand'));

    clickCard('As');
    clickCard('Kd');

    const hero = screen.getByTestId('hero-cards');
    expect(hero).toHaveTextContent('As');
    expect(hero).toHaveTextContent('Kd');
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
  });

  it('gates the real dock: a focused palette makes A inert on the real table', () => {
    renderTable(fourHanded());
    fireEvent.click(screen.getByTestId('start-hand'));

    focusPalette();
    typeAtPalette('a');

    // Seat 3 is UTG and on the clock. It must NOT be all in.
    expect(screen.getByTestId('seat-3')).toHaveAttribute('data-status', 'IN_HAND');
  });
});
