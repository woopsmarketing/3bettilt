import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Money, parseCard, sequentialIdFactory } from '@gto-self/shared';
import type { Card, MilliBB } from '@gto-self/shared';
import { SEAT_INDEXES, setSeatStack } from '@gto-self/poker-core';
import type { HandCommand, HandState, HandView, SeatIndex, TableState } from '@gto-self/poker-core';
import { makeTestTable, testNicknames } from '../../lib/table/testTable.js';
import type { TableStore } from '../../lib/table/tableStore.js';
import { AwardPanel, type AwardPanelProps } from './AwardPanel.js';
import { CardPalette, useCardEntry } from './CardPalette.js';
import { TableStoreProvider, useTableStore, useTableStoreApi } from './TableStoreProvider.js';

/**
 * The award panel after the Alpha findings: a misclick must not split a pot, and a hand an
 * opponent showed must be recordable.
 *
 * Every assertion is made against ENGINE STATE (`store.getState().hand.state`) or against
 * `HandView`, never against which handler ran: what the panel is for is producing the right
 * `poker-core` command, and only the engine can testify to that.
 */

const card = (text: string): Card => {
  const parsed = parseCard(text);
  if (!parsed.ok) throw new Error(`bad test card ${text}: ${parsed.error}`);
  return parsed.value;
};

/**
 * The panel plus a mount counter. Defined at module scope so React keeps ONE instance
 * across re-renders: a test that means to keep the panel mounted across a hand boundary
 * has to be able to prove it stayed mounted, and `onMount` is that proof.
 */
function TrackedAwardPanel({
  onMount,
  ...props
}: AwardPanelProps & { readonly onMount: () => void }) {
  useEffect(onMount, [onMount]);
  return <AwardPanel {...props} />;
}

interface HarnessOptions {
  /**
   * Render the panel UNCONDITIONALLY, the way a table that never unmounted it would. The
   * panel itself renders nothing unless the engine is awaiting an award, so this changes
   * only whether its `useState` survives a hand boundary.
   */
  readonly alwaysMounted?: boolean;
  /** Called once per mount of the panel. */
  readonly onPanelMount?: () => void;
}

/**
 * The panel and the palette over ONE real store, wired exactly as `TableRoot` wires them:
 * the reveal target is lifted above both, so `SHOW` in the panel is what opens the palette.
 */
function renderHarness(table: TableState, options: HarnessOptions = {}): TableStore {
  let captured: TableStore | null = null;
  const noop = () => {};

  function Harness() {
    captured = useTableStoreApi();
    const view = useTableStore((state) => state.view);
    const heroSeat = useTableStore((state) => state.table.heroSeat);
    const lastError = useTableStore((state) => state.lastError);
    const [revealSeat, setRevealSeat] = useState<SeatIndex | null>(null);
    const entry = useCardEntry({ view, heroSeat, revealSeat });
    const nicknames = testNicknames(SEAT_INDEXES);
    const awarding = view !== null && view.phase.kind === 'AWAITING_AWARD';
    return (
      <>
        <CardPalette entry={entry} view={view} />
        {(options.alwaysMounted === true || awarding) && (
          <TrackedAwardPanel
            view={view}
            nicknameForSeat={(seat) => nicknames[`player-${seat}`] ?? null}
            revealSeat={revealSeat}
            onRevealSeat={setRevealSeat}
            onMount={options.onPanelMount ?? noop}
          />
        )}
        <p data-testid="harness-error">{lastError === null ? '' : lastError.code}</p>
      </>
    );
  }

  render(
    <TableStoreProvider
      init={{ sessionId: 'session-1', table, autoTopUp: null, ids: sequentialIdFactory('test') }}
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

const eventsOf = (store: TableStore) => {
  const hand = store.getState().hand;
  if (hand === null) throw new Error('no hand in progress');
  return hand.events;
};

const viewOf = (store: TableStore): HandView => {
  const view = store.getState().view;
  if (view === null) throw new Error('no view');
  return view;
};

const stacks = (store: TableStore): readonly MilliBB[] =>
  SEAT_INDEXES.map((seat) => handState(store).seats[seat].stack);

const applyCmd = (store: TableStore, command: HandCommand): void => {
  act(() => {
    store.getState().apply(command);
  });
};

/** One check or call from whoever is on the clock. The engine decides which is legal. */
const proceed = (store: TableStore): void => {
  const view = viewOf(store);
  if (view.phase.kind !== 'AWAITING_ACTION') throw new Error('not awaiting action');
  applyCmd(store, view.phase.actor.legal.canCheck ? { kind: 'CHECK' } : { kind: 'CALL' });
};

const proceedUntilBettingEnds = (store: TableStore): void => {
  for (let guard = 0; guard < 12; guard += 1) {
    if (viewOf(store).phase.kind !== 'AWAITING_ACTION') return;
    proceed(store);
  }
  throw new Error('betting round did not end');
};

/** Everyone limps and checks to a four-handed showdown. One pot, four eligible seats. */
const toShowdown = (store: TableStore): void => {
  start(store);
  proceedUntilBettingEnds(store);
  applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('2c'), card('7d'), card('9h')] });
  proceedUntilBettingEnds(store);
  applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('3s')] });
  proceedUntilBettingEnds(store);
  applyCmd(store, { kind: 'DEAL_BOARD', cards: [card('4s')] });
  proceedUntilBettingEnds(store);
  if (viewOf(store).phase.kind !== 'AWAITING_AWARD') throw new Error('expected AWAITING_AWARD');
};

const clickCard = (text: string): void => {
  fireEvent.click(screen.getByTestId(`palette-${text}`));
};

const click = (testId: string): void => {
  fireEvent.click(screen.getByTestId(testId));
};

const pressed = (testId: string): string | null =>
  screen.getByTestId(testId).getAttribute('aria-pressed');

describe('AwardPanel — picking a winner', () => {
  it('labels every candidate with the nickname and the position HandView reports', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const view = viewOf(store);

    for (const seat of [0, 1, 2, 3] as const) {
      const button = screen.getByTestId(`award-seat-0-${seat}`);
      // The nickname comes from the prop and the position from `SeatView` — a bare
      // `seat 3` is what the user could not map to a person.
      expect(button).toHaveTextContent(`Player ${seat + 1}`);
      const position = view.seats[seat].position;
      if (position === null) throw new Error('the engine gave this seat no position');
      expect(button).toHaveTextContent(position);
      expect(button).toHaveTextContent(`좌석 ${seat + 1}`);
    }
  });

  it('REPLACES the winner when a second candidate is clicked, and never splits silently', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const before = stacks(store);

    // The exact Alpha misclick: wrong seat, then the right one.
    click('award-seat-0-2');
    click('award-seat-0-1');

    expect(pressed('award-seat-0-2')).toBe('false');
    expect(pressed('award-seat-0-1')).toBe('true');
    expect(screen.getByTestId('award-summary-0')).toHaveAttribute('data-split', 'false');
    expect(screen.getByTestId('award-summary-0')).toHaveTextContent('Player 2');
    expect(screen.getByTestId('award-summary-0')).not.toHaveTextContent(/split/iu);

    click('award-submit');

    const record = handState(store).awards[0];
    if (record === undefined) throw new Error('no award record');
    expect(record.winners).toEqual([1]);
    expect(record.shares).toHaveLength(1);
    const after = stacks(store);
    expect(after[1]!).toBeGreaterThan(before[1]!);
    expect(after[2]).toBe(before[2]);
    expect(store.getState().lastError).toBeNull();
  });

  it('splits only through the pot’s own split control', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const before = stacks(store);

    expect(pressed('award-split-0')).toBe('false');
    click('award-split-0');
    expect(pressed('award-split-0')).toBe('true');

    click('award-seat-0-2');
    click('award-seat-0-1');

    // With multi-select armed, BOTH stay ticked — the deliberate case.
    expect(pressed('award-seat-0-2')).toBe('true');
    expect(pressed('award-seat-0-1')).toBe('true');
    const summary = screen.getByTestId('award-summary-0');
    expect(summary).toHaveAttribute('data-split', 'true');
    expect(summary).toHaveTextContent('2명 분할');
    expect(summary).toHaveTextContent('Player 3');
    expect(summary).toHaveTextContent('Player 2');

    click('award-submit');

    const record = handState(store).awards[0];
    if (record === undefined) throw new Error('no award record');
    expect([...record.winners].sort()).toEqual([1, 2]);
    expect(record.shares).toHaveLength(2);
    // The engine's arithmetic, not the panel's: the shares are what the pot paid.
    expect(Money.sum(record.shares.map((share) => share.amount))).toBe(record.netAmount);
    const after = stacks(store);
    expect(after[1]!).toBeGreaterThan(before[1]!);
    expect(after[2]!).toBeGreaterThan(before[2]!);
  });

  it('collapses to one winner when the split control is switched back off', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);

    click('award-split-0');
    click('award-seat-0-2');
    click('award-seat-0-1');
    click('award-split-0');

    expect(pressed('award-seat-0-2')).toBe('true');
    expect(pressed('award-seat-0-1')).toBe('false');
    expect(screen.getByTestId('award-summary-0')).toHaveAttribute('data-split', 'false');

    click('award-submit');
    const record = handState(store).awards[0];
    if (record === undefined) throw new Error('no award record');
    expect(record.winners).toEqual([2]);
  });

  it('refuses to submit with no winner picked, and dispatches nothing', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const before = handState(store);

    expect(screen.getByTestId('award-submit')).toBeDisabled();
    expect(screen.getByTestId('award-blocked')).toBeInTheDocument();
    click('award-submit');

    // Not "the engine said NO_WINNERS" — nothing was sent at all.
    expect(handState(store)).toBe(before);
    expect(store.getState().lastError).toBeNull();
    expect(screen.getByTestId('harness-error')).toHaveTextContent('');

    click('award-seat-0-1');
    expect(screen.getByTestId('award-submit')).toBeEnabled();
    expect(screen.queryByTestId('award-blocked')).not.toBeInTheDocument();
  });

  it('carries no selection, and no armed split, into the next hand', () => {
    const store = renderHarness(fourHanded());

    toShowdown(store);
    click('award-split-0');
    click('award-seat-0-2');
    click('award-seat-0-1');
    click('award-submit');
    expect(handState(store).phase).toBe('COMPLETE');

    toShowdown(store);
    for (const seat of viewOf(store).contenderSeats) {
      expect(pressed(`award-seat-0-${seat}`)).toBe('false');
    }
    expect(pressed('award-split-0')).toBe('false');
    expect(screen.getByTestId('award-submit')).toBeDisabled();

    const before = stacks(store);
    click('award-seat-0-1');
    click('award-submit');
    const record = handState(store).awards[0];
    if (record === undefined) throw new Error('no award record');
    // A leaked `[2]` from hand 1 would make this a two-way split.
    expect(record.winners).toEqual([1]);
    expect(stacks(store)[2]).toBe(before[2]);
  });

  /**
   * The same promise, with the panel MOUNTED across the hand boundary — which is the only
   * arrangement that reaches rule 5's `${handNumber}:AWARD` key guard at all. The test
   * above passes because `TableRoot` unmounts the panel between hands and React throws the
   * selection away with it; that unmount is worth pinning, but it means the guard itself
   * never runs there. Here the panel keeps its `useState` and the key is what has to drop
   * hand N's ticks.
   */
  it('drops hand N’s selection at hand N+1 while the panel stays mounted', () => {
    let mounts = 0;
    const store = renderHarness(fourHanded(), {
      alwaysMounted: true,
      onPanelMount: () => {
        mounts += 1;
      },
    });

    toShowdown(store);
    click('award-split-0');
    click('award-seat-0-2');
    click('award-seat-0-1');
    click('award-submit');
    expect(handState(store).phase).toBe('COMPLETE');
    // Between hands the panel renders nothing — but it is still there, holding its state.
    expect(screen.queryByTestId('award-panel')).not.toBeInTheDocument();

    toShowdown(store);

    // ONE mount for both hands: nothing was thrown away by unmounting, so everything below
    // is the key guard doing its job.
    expect(mounts).toBe(1);
    for (const seat of viewOf(store).contenderSeats) {
      expect(pressed(`award-seat-0-${seat}`)).toBe('false');
    }
    expect(pressed('award-split-0')).toBe('false');
    expect(screen.getByTestId('award-submit')).toBeDisabled();

    const before = stacks(store);
    click('award-seat-0-1');
    click('award-submit');
    const record = handState(store).awards[0];
    if (record === undefined) throw new Error('no award record');
    // A leaked `[2]` from hand 1 would make this a two-way split.
    expect(record.winners).toEqual([1]);
    expect(stacks(store)[2]).toBe(before[2]);
    expect(store.getState().lastError).toBeNull();
  });

  it('keeps submit disabled until EVERY pending pot has a winner', () => {
    // Seat 2 is short, so an all-in round leaves a main pot and a side pot.
    const short = setSeatStack(fourHanded(), 2, Money.fromBB(5));
    if (!short.ok) throw new Error(short.error.message);
    const store = renderHarness(short.value);

    start(store);
    for (let guard = 0; guard < 6; guard += 1) {
      if (viewOf(store).phase.kind !== 'AWAITING_ACTION') break;
      applyCmd(store, { kind: 'ALL_IN' });
    }
    while (viewOf(store).phase.kind === 'AWAITING_BOARD') {
      const phase = viewOf(store).phase;
      if (phase.kind !== 'AWAITING_BOARD') break;
      const cards = [card('2c'), card('7d'), card('9h'), card('3s'), card('4s')].slice(
        viewOf(store).board.length,
        viewOf(store).board.length + phase.cardsNeeded,
      );
      applyCmd(store, { kind: 'DEAL_BOARD', cards });
    }

    const view = viewOf(store);
    if (view.phase.kind !== 'AWAITING_AWARD') throw new Error('expected AWAITING_AWARD');
    expect(view.phase.pots.length).toBeGreaterThan(1);
    const [main, side] = view.phase.pots;
    if (main === undefined || side === undefined) throw new Error('expected two pots');

    click(`award-seat-${main.index}-${main.eligibleSeats[0]!}`);
    // One of two pots answered: still disabled, because ONE command must cover both.
    expect(screen.getByTestId('award-submit')).toBeDisabled();

    click(`award-seat-${side.index}-${side.eligibleSeats[0]!}`);
    expect(screen.getByTestId('award-submit')).toBeEnabled();

    click('award-submit');
    expect(handState(store).phase).toBe('COMPLETE');
    expect(handState(store).awards).toHaveLength(view.phase.pots.length);
    expect(store.getState().lastError).toBeNull();
  });
});

describe('AwardPanel — showdown reveal', () => {
  it('offers SHOW/MUCK for exactly the engine’s contender seats', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const contenders = viewOf(store).contenderSeats;
    expect(contenders.length).toBeGreaterThan(1);

    for (const seat of contenders) {
      expect(screen.getByTestId(`award-show-${seat}`)).toBeInTheDocument();
      expect(screen.getByTestId(`award-muck-${seat}`)).toBeInTheDocument();
    }
    for (const seat of SEAT_INDEXES.filter((candidate) => !contenders.includes(candidate))) {
      expect(screen.queryByTestId(`award-reveal-${seat}`)).not.toBeInTheDocument();
    }
  });

  it('SHOW opens the palette for that seat and records the cards as revealed', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    // Nothing is asked for until the user asks: the palette is shut at AWAITING_AWARD.
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();

    click('award-show-2');
    expect(pressed('award-show-2')).toBe('true');
    const palette = screen.getByTestId('card-palette');
    expect(palette).toHaveAttribute('data-needed', '2');
    expect(palette).toHaveTextContent('좌석 3');

    clickCard('As');
    expect(handState(store).seats[2].holeCards).toHaveLength(0);
    clickCard('Kd');

    expect(handState(store).seats[2].holeCards).toEqual([card('As'), card('Kd')]);
    const last = eventsOf(store).at(-1);
    if (last === undefined || last.kind !== 'HOLE_CARDS_SET') {
      throw new Error(`expected HOLE_CARDS_SET, got ${last?.kind ?? 'nothing'}`);
    }
    expect(last.seat).toBe(2);
    // A hand the user SAW at showdown, not the hero's private entry.
    expect(last.revealed).toBe(true);

    // Known cards are rendered, and that seat is not asked again.
    expect(screen.getByTestId('award-shown-2')).toBeInTheDocument();
    expect(screen.getByTestId('card-As')).toBeInTheDocument();
    expect(screen.queryByTestId('award-show-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
  });

  it('still lets the engine refuse a dead card on a reveal', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    expect(viewOf(store).board).toContain(card('2c'));

    click('award-show-2');
    const dead = screen.getByTestId('palette-2c');
    expect(dead).toBeDisabled();
    expect(dead).toHaveAttribute('data-dead', 'true');

    // And the refusal is the ENGINE's, not the button's: the same command sent directly
    // is rejected and changes nothing.
    const before = handState(store);
    applyCmd(store, {
      kind: 'SET_HOLE_CARDS',
      seat: 2,
      cards: [card('2c'), card('Kd')],
      revealed: true,
    });
    expect(screen.getByTestId('harness-error')).toHaveTextContent('DUPLICATE_CARD');
    expect(handState(store)).toBe(before);
    expect(handState(store).seats[2].holeCards).toHaveLength(0);
  });

  it('MUCK dispatches nothing and only stops the panel asking that seat', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const before = handState(store);
    const eventCount = eventsOf(store).length;

    click('award-muck-2');

    // No command, no event, no fabricated cards — "did not show" is unknown information.
    expect(handState(store)).toBe(before);
    expect(eventsOf(store)).toHaveLength(eventCount);
    expect(handState(store).seats[2].holeCards).toHaveLength(0);
    expect(store.getState().lastError).toBeNull();
    expect(screen.getByTestId('award-notshown-2')).toHaveTextContent('오픈 안 함');
    expect(screen.queryByTestId('award-show-2')).not.toBeInTheDocument();

    // Reversible: it is a note about the hand, not a decision about it.
    click('award-unmuck-2');
    expect(screen.getByTestId('award-show-2')).toBeInTheDocument();
    expect(eventsOf(store)).toHaveLength(eventCount);
  });

  it('closes a pending SHOW when the same seat is marked as not shown', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);

    click('award-show-2');
    expect(screen.getByTestId('card-palette')).toBeInTheDocument();
    click('award-muck-2');

    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
    expect(handState(store).seats[2].holeCards).toHaveLength(0);
  });

  it('awards the pot with nobody having shown', () => {
    const store = renderHarness(fourHanded());
    toShowdown(store);
    const before = stacks(store);
    for (const seat of viewOf(store).contenderSeats) {
      expect(handState(store).seats[seat].holeCards).toHaveLength(0);
    }

    click('award-seat-0-2');
    click('award-submit');

    expect(handState(store).phase).toBe('COMPLETE');
    expect(stacks(store)[2]!).toBeGreaterThan(before[2]!);
    expect(store.getState().lastError).toBeNull();
  });
});
