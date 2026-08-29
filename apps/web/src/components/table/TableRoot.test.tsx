import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Money, asId, sequentialIdFactory } from '@gto-self/shared';
import type { HandId, IdFactory } from '@gto-self/shared';
import { SEAT_INDEXES, startHand, toView } from '@gto-self/poker-core';
import type { HandView, SeatIndex, TableState } from '@gto-self/poker-core';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import { makeTestTable, testNicknames } from '../../lib/table/testTable.js';
import { TableRoot } from './TableRoot.js';

/**
 * The engine's own answer for the hand the store is about to deal, computed with an
 * identical id factory. Every DOM assertion below is made against THIS, so the test
 * proves the UI reflects `HandView` rather than re-stating whatever the UI happened to
 * render.
 */
function expectedView(table: TableState): HandView {
  const ids: IdFactory = sequentialIdFactory('test');
  const started = startHand(table, { handId: asId<'Hand'>(ids.next()) as HandId }, ids);
  if (!started.ok) throw new Error(started.error.message);
  return toView(started.value);
}

const noProfile: LoadPlayerProfileAction = async () => ({
  ok: false,
  message: 'not called in this test',
});

function renderTable(
  table: TableState,
  overrides: { readonly loadPlayerProfile?: LoadPlayerProfileAction } = {},
) {
  return render(
    <TableRoot
      sessionId="session-1"
      label="Test session"
      table={table}
      autoTopUp={null}
      nicknames={testNicknames(SEAT_INDEXES)}
      warnings={[]}
      loadPlayerProfile={overrides.loadPlayerProfile ?? noProfile}
      ids={sequentialIdFactory('test')}
    />,
  );
}

const seatEl = (seat: SeatIndex): HTMLElement => screen.getByTestId(`seat-${seat}`);

describe('TableRoot', () => {
  it('renders an empty table with no hand started', () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    renderTable(table);

    for (const seat of SEAT_INDEXES) expect(seatEl(seat)).toBeInTheDocument();
    expect(screen.getByTestId('pot')).toHaveTextContent('—');
    expect(screen.getByTestId('street')).toHaveTextContent('no hand');
    expect(screen.getByTestId('action-history')).toHaveTextContent('No actions yet.');
    expect(screen.getByTestId('start-hand')).toBeEnabled();
  });

  it('pins hero bottom-centre and marks the hero seat', () => {
    const table = makeTestTable({ seats: [0, 1, 3, 5], heroSeat: 3, buttonSeat: 5 });
    renderTable(table);

    expect(seatEl(3)).toHaveAttribute('data-hero', 'true');
    // Slot 0 is bottom-centre (`lib/table/layout.ts`).
    expect(seatEl(3).parentElement?.className).toContain('col-start-2 row-start-3');
  });

  it('puts BTN/SB/BB exactly where HandView says, with the button off seat 0', () => {
    const table = makeTestTable({ seats: [0, 1, 3, 5], heroSeat: 0, buttonSeat: 3 });
    const view = expectedView(table);
    expect(view.buttonSeat).toBe(3);
    expect(view.buttonSeat).not.toBe(view.smallBlindSeat);

    renderTable(table);
    fireEvent.click(screen.getByTestId('start-hand'));

    for (const seat of SEAT_INDEXES) {
      expect(seatEl(seat).getAttribute('data-button')).toBe(String(view.seats[seat].isButton));
      expect(seatEl(seat).getAttribute('data-sb')).toBe(String(view.seats[seat].isSmallBlind));
      expect(seatEl(seat).getAttribute('data-bb')).toBe(String(view.seats[seat].isBigBlind));
    }
    expect(seatEl(view.buttonSeat)).toHaveTextContent('BTN');
    expect(seatEl(view.smallBlindSeat)).toHaveTextContent('SB');
    expect(seatEl(view.bigBlindSeat)).toHaveTextContent('BB');
  });

  it('marks exactly the seat HandView says is the actor', () => {
    const table = makeTestTable({ seats: [0, 1, 3, 5], heroSeat: 0, buttonSeat: 3 });
    const view = expectedView(table);
    expect(view.phase.kind).toBe('AWAITING_ACTION');
    const actor = view.phase.kind === 'AWAITING_ACTION' ? view.phase.actor.seat : null;
    expect(actor).not.toBeNull();

    renderTable(table);
    fireEvent.click(screen.getByTestId('start-hand'));

    for (const seat of SEAT_INDEXES) {
      expect(seatEl(seat).getAttribute('data-actor')).toBe(String(seat === actor));
    }
    expect(seatEl(actor!)).toHaveTextContent('to act');
    expect(seatEl(actor!).className).toContain('ring-actor-500');
  });

  it('renders the pot, stacks and positions HandView reports', () => {
    const table = makeTestTable({ seats: [0, 1, 3, 5], heroSeat: 0, buttonSeat: 3 });
    const view = expectedView(table);

    renderTable(table);
    fireEvent.click(screen.getByTestId('start-hand'));

    expect(screen.getByTestId('pot')).toHaveTextContent(
      Money.formatBB(view.pot, { maxDecimals: 3, unit: true }),
    );
    expect(screen.getByTestId('street')).toHaveTextContent(view.street);
    for (const seat of view.dealtInSeats) {
      expect(seatEl(seat)).toHaveTextContent(
        Money.formatBB(view.seats[seat].stack, { maxDecimals: 3, unit: true }),
      );
      const position = view.seats[seat].position;
      if (position !== null) expect(seatEl(seat)).toHaveTextContent(position);
    }
  });

  it('lists the forced posts in the action history', () => {
    const table = makeTestTable({ seats: [0, 1, 3, 5], heroSeat: 0, buttonSeat: 3 });
    renderTable(table);
    fireEvent.click(screen.getByTestId('start-hand'));

    const history = screen.getByTestId('action-history');
    expect(history).toHaveTextContent('PREFLOP');
    expect(history).toHaveTextContent('small blind');
    expect(history).toHaveTextContent('big blind');
    expect(history).toHaveTextContent('ante');
  });

  it('reflects legal actions in the dock, enabling exactly what the engine allows', () => {
    const table = makeTestTable({ seats: [0, 1, 3, 5], heroSeat: 0, buttonSeat: 3 });
    const view = expectedView(table);
    const legal = view.phase.kind === 'AWAITING_ACTION' ? view.phase.actor.legal : null;

    renderTable(table);
    fireEvent.click(screen.getByTestId('start-hand'));

    expect(screen.getByTestId('dock-F')).toHaveAttribute('data-legal', String(legal!.canFold));
    // One key: CHECK when the call is zero, CALL otherwise, so the control is live in
    // both cases.
    expect(screen.getByTestId('dock-C')).toHaveAttribute(
      'data-legal',
      String(legal!.canCheck || legal!.call !== null),
    );
    expect(screen.getByTestId('dock-R')).toHaveAttribute(
      'data-legal',
      String(legal!.wager !== null),
    );
    expect(screen.getByTestId('dock-A')).toHaveAttribute(
      'data-legal',
      String(legal!.allIn !== null),
    );
    // Undo and Next hand are the lifecycle keys: a freshly dealt hand has nothing to undo
    // and cannot be replaced by a new one.
    expect(screen.getByTestId('dock-Z')).toHaveAttribute('data-legal', String(view.canUndo));
    expect(screen.getByTestId('dock-N')).toBeDisabled();
    // `data-legal` and `disabled` are the same fact: an illegal control cannot be clicked.
    for (const key of ['F', 'C', 'R', 'A', 'Z', 'N']) {
      const button = screen.getByTestId(`dock-${key}`);
      expect(button.hasAttribute('disabled')).toBe(button.getAttribute('data-legal') === 'false');
    }
  });

  it('surfaces the engine error when a hand cannot be dealt', () => {
    // One seated player: the engine refuses, and the refusal is shown, not swallowed.
    const table = makeTestTable({ seats: [0], heroSeat: 0, buttonSeat: 0 });
    renderTable(table);
    fireEvent.click(screen.getByTestId('start-hand'));

    expect(screen.getByTestId('engine-error')).toHaveTextContent('NOT_ENOUGH_PLAYERS');
    expect(screen.getByTestId('pot')).toHaveTextContent('—');
  });

  it('opens a player profile on seat click and closes it on Esc', async () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const loadPlayerProfile = vi.fn<LoadPlayerProfileAction>().mockResolvedValue({
      ok: true,
      profile: {
        playerId: 'player-1',
        nickname: 'Player 2',
        displayAlias: null,
        archived: false,
        hud: null,
        notes: [],
        warnings: [],
      },
    });

    renderTable(table, { loadPlayerProfile });
    expect(screen.getByTestId('strategy-placeholder')).toBeInTheDocument();

    fireEvent.click(seatEl(1));
    expect(await screen.findByTestId('player-profile')).toBeInTheDocument();
    // A player with no HUD reading renders cleanly rather than blank.
    expect(screen.getByTestId('profile-no-hud')).toBeInTheDocument();
    expect(screen.getByTestId('profile-no-notes')).toBeInTheDocument();
    expect(loadPlayerProfile).toHaveBeenCalledWith('player-1');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('player-profile')).not.toBeInTheDocument();
    expect(screen.getByTestId('strategy-placeholder')).toBeInTheDocument();
  });

  it('Esc in the raise editor closes the editor only, and leaves the profile open', async () => {
    const user = userEvent.setup();
    const table = makeTestTable({ seats: [0, 1, 2, 3], heroSeat: 0, buttonSeat: 0 });
    const loadPlayerProfile = vi.fn<LoadPlayerProfileAction>().mockResolvedValue({
      ok: true,
      profile: {
        playerId: 'player-1',
        nickname: 'Player 2',
        displayAlias: null,
        archived: false,
        hud: null,
        notes: [],
        warnings: [],
      },
    });

    renderTable(table, { loadPlayerProfile });
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(seatEl(1));
    expect(await screen.findByTestId('player-profile')).toBeInTheDocument();

    await user.click(screen.getByTestId('raise-input'));
    await user.keyboard('9');
    expect(screen.getByTestId('raise-panel')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    // The editor closed and kept the text — that part was always right.
    expect(screen.queryByTestId('raise-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('raise-input')).toHaveValue('9');
    // One keypress must not also close an unrelated panel.
    expect(screen.getByTestId('player-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('strategy-placeholder')).not.toBeInTheDocument();
  });

  it('shows a profile load failure instead of an empty panel', async () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const loadPlayerProfile = vi
      .fn<LoadPlayerProfileAction>()
      .mockResolvedValue({ ok: false, message: 'That player no longer exists.' });

    renderTable(table, { loadPlayerProfile });
    fireEvent.click(seatEl(2));

    expect(await screen.findByTestId('profile-error')).toHaveTextContent(
      'That player no longer exists.',
    );
  });

  it('shows session warnings rather than hiding them', () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    render(
      <TableRoot
        sessionId="session-1"
        label={null}
        table={table}
        autoTopUp={null}
        nicknames={{}}
        warnings={['seat 2: player is gone']}
        loadPlayerProfile={noProfile}
        ids={sequentialIdFactory('test')}
      />,
    );
    expect(screen.getByTestId('session-warnings')).toHaveTextContent('seat 2: player is gone');
  });
});
