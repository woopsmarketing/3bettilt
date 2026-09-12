import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Money, asId, sequentialIdFactory } from '@gto-self/shared';
import type { HandId, IdFactory } from '@gto-self/shared';
import { SEAT_INDEXES, startHand, toView } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, HandView, SeatIndex, TableState } from '@gto-self/poker-core';
import type {
  AdaptiveOpponentInputWire,
  LoadAdaptiveInputsAction,
  LoadPlayerProfileAction,
  ReplaceSeatPlayerAction,
  SaveExternalHudSnapshotAction,
  SaveHudSnapshotAction,
  SyncSessionSeatsAction,
} from '../../lib/table/contract.js';
import type { LogSkippedHandAction } from '../../lib/table/skip-hand-contract.js';
import type {
  SearchPlayersAction,
  SeatAutoTopUpValue,
  SeatOccupancyValue,
  UpdateSeatAutoTopUpAction,
  UpdateSeatAutoTopUpResult,
  UpdateSeatOccupancyAction,
  UpdateSeatOccupancyResult,
} from '../../lib/session-setup/contract.js';
import {
  HAND_REBASED_NOTICE,
  PLAYER_EXISTS_GUIDANCE,
  PLAYER_SWAP_REJECTION_LABEL,
  QUICK_NEXT_HAND_LABEL,
  SEAT_DIRTY_BADGE,
  STACK_EDIT_REJECTION_LABEL,
  STRATEGY_ENGINE_LABEL,
  STREET_LABEL,
  playerSeatedCreatedNotice,
  playerSeatedExistingNotice,
  seatLabel,
  seatPlayerStoreRefusedNotice,
  settlementBlockedGuidance,
} from '../../lib/table/copy.js';
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

interface RenderOverrides {
  readonly loadPlayerProfile?: LoadPlayerProfileAction;
  readonly saveHudSnapshot?: SaveHudSnapshotAction;
  readonly loadAdaptiveInputs?: LoadAdaptiveInputsAction;
  readonly autoTopUp?: AutoTopUpPolicy | null;
  readonly seatAutoTopUp?: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
  readonly seatStackUnverified?: Readonly<Partial<Record<SeatIndex, true>>>;
  readonly updateSeatAutoTopUp?: UpdateSeatAutoTopUpAction;
  readonly updateSeatOccupancy?: UpdateSeatOccupancyAction;
  readonly syncSessionSeats?: SyncSessionSeatsAction;
  readonly replaceSeatPlayer?: ReplaceSeatPlayerAction;
  readonly searchPlayers?: SearchPlayersAction;
  readonly saveExternalHudSnapshot?: SaveExternalHudSnapshotAction;
  readonly logSkippedHand?: LogSkippedHandAction;
}

function renderTable(table: TableState, overrides: RenderOverrides = {}) {
  return render(
    <TableRoot
      sessionId="session-1"
      label="Test session"
      table={table}
      autoTopUp={overrides.autoTopUp ?? null}
      seatAutoTopUp={overrides.seatAutoTopUp ?? {}}
      seatStackUnverified={overrides.seatStackUnverified ?? {}}
      nicknames={testNicknames(SEAT_INDEXES)}
      warnings={[]}
      loadPlayerProfile={overrides.loadPlayerProfile ?? noProfile}
      saveHudSnapshot={overrides.saveHudSnapshot}
      loadAdaptiveInputs={overrides.loadAdaptiveInputs}
      updateSeatAutoTopUp={overrides.updateSeatAutoTopUp}
      updateSeatOccupancy={overrides.updateSeatOccupancy}
      syncSessionSeats={overrides.syncSessionSeats}
      replaceSeatPlayer={overrides.replaceSeatPlayer}
      searchPlayers={overrides.searchPlayers}
      saveExternalHudSnapshot={overrides.saveExternalHudSnapshot}
      logSkippedHand={overrides.logSkippedHand}
      ids={sequentialIdFactory('test')}
    />,
  );
}

const seatEl = (seat: SeatIndex): HTMLElement => screen.getByTestId(`seat-${seat}`);

/** What the right-hand column is leading with, as the table itself reports it. */
const panelKind = (): string | null => screen.getByTestId('right-panel').getAttribute('data-panel');

describe('TableRoot', () => {
  it('renders an empty table with no hand started', () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    renderTable(table);

    for (const seat of SEAT_INDEXES) expect(seatEl(seat)).toBeInTheDocument();
    expect(screen.getByTestId('pot')).toHaveTextContent('—');
    expect(screen.getByTestId('street')).toHaveTextContent('핸드 없음');
    expect(screen.getByTestId('action-history')).toHaveTextContent('아직 액션이 없습니다.');
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
    expect(seatEl(actor!)).toHaveTextContent('액션 차례');
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
    expect(screen.getByTestId('street')).toHaveTextContent(STREET_LABEL[view.street]);
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
    expect(history).toHaveTextContent('프리플랍');
    expect(history).toHaveTextContent('스몰 블라인드');
    expect(history).toHaveTextContent('빅 블라인드');
    expect(history).toHaveTextContent('앤티');
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
        externalHud: null,
        notes: [],
        warnings: [],
      },
    });

    renderTable(table, { loadPlayerProfile });
    // No hand is live and nothing is selected, so the column leads with the log
    // (`lib/table/rightPanel.ts`). The strategy panel belongs to hero's own decision.
    expect(panelKind()).toBe('HISTORY');
    expect(screen.queryByTestId('strategy-panel')).not.toBeInTheDocument();

    fireEvent.click(seatEl(1));
    expect(await screen.findByTestId('player-profile')).toBeInTheDocument();
    // A player with no HUD reading renders cleanly rather than blank.
    expect(screen.getByTestId('profile-no-hud')).toBeInTheDocument();
    expect(screen.getByTestId('profile-no-notes')).toBeInTheDocument();
    expect(loadPlayerProfile).toHaveBeenCalledWith('player-1');

    fireEvent.keyDown(window, { key: 'Escape' });

    // Esc still clears the selection and returns the column to its default, exactly as
    // before; that default is now the action history rather than the strategy panel.
    expect(screen.queryByTestId('player-profile')).not.toBeInTheDocument();
    expect(panelKind()).toBe('HISTORY');
    expect(screen.getByTestId('action-history')).toBeInTheDocument();
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
        externalHud: null,
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
    expect(screen.queryByTestId('strategy-panel')).not.toBeInTheDocument();
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

/**
 * The award/reveal wiring, on the REAL table rather than a harness. The reveal target is
 * lifted into `TableRoot` because two children need it — `AwardPanel` nominates the seat
 * and the palette asks for its cards — so nothing but a full render proves it is joined up.
 */
describe('TableRoot — showdown', () => {
  const clickCard = (text: string): void => {
    fireEvent.click(screen.getByTestId(`palette-${text}`));
  };

  /** One check-or-call from whoever is on the clock. The engine decides which it is. */
  const checkOrCall = (): void => {
    const button = screen.getByTestId('dock-C');
    expect(button).toHaveAttribute('data-legal', 'true');
    fireEvent.click(button);
  };

  /** Heads up, hero on the button, to a checked-down showdown. */
  const toShowdown = (): void => {
    fireEvent.click(screen.getByTestId('start-hand'));
    clickCard('As');
    clickCard('Kd');
    checkOrCall();
    checkOrCall();
    clickCard('2c');
    clickCard('7d');
    clickCard('9h');
    checkOrCall();
    checkOrCall();
    clickCard('3s');
    checkOrCall();
    checkOrCall();
    clickCard('4s');
    checkOrCall();
    checkOrCall();
  };

  it('names the candidates, records a shown hand and awards the pot', () => {
    const table = makeTestTable({ seats: [0, 1], heroSeat: 0, buttonSeat: 0 });
    const view = expectedView(table);
    renderTable(table);
    toShowdown();

    const panel = screen.getByTestId('award-panel');
    expect(panel).toBeInTheDocument();

    // The candidate is a person, not a bare seat number: nickname (prop) + position (view).
    const candidate = screen.getByTestId('award-seat-0-1');
    expect(candidate).toHaveTextContent('Player 2');
    const position = view.seats[1].position;
    if (position === null) throw new Error('the engine gave this seat no position');
    expect(candidate).toHaveTextContent(position);

    // SHOW reaches the palette through `TableRoot`'s lifted reveal target.
    fireEvent.click(screen.getByTestId('award-show-1'));
    expect(screen.getByTestId('card-palette')).toHaveAttribute('data-needed', '2');
    clickCard('Ah');
    clickCard('Kh');
    expect(screen.getByTestId('award-shown-1')).toHaveTextContent('Ah');
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();

    // Awarding is still one click plus submit, and the panel unmounts with the hand.
    fireEvent.click(candidate);
    fireEvent.click(screen.getByTestId('award-submit'));
    expect(screen.queryByTestId('award-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('start-hand')).toBeEnabled();
    expect(screen.queryByTestId('engine-error')).not.toBeInTheDocument();
  });

  it('keeps MUCK out of the engine: nothing is dispatched and no cards appear', () => {
    const table = makeTestTable({ seats: [0, 1], heroSeat: 0, buttonSeat: 0 });
    renderTable(table);
    toShowdown();

    fireEvent.click(screen.getByTestId('award-muck-1'));

    expect(screen.getByTestId('award-notshown-1')).toHaveTextContent('오픈 안 함');
    expect(screen.queryByTestId('award-shown-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
    expect(screen.queryByTestId('engine-error')).not.toBeInTheDocument();
    // A hand nobody showed is still awardable.
    fireEvent.click(screen.getByTestId('award-seat-0-1'));
    fireEvent.click(screen.getByTestId('award-submit'));
    expect(screen.queryByTestId('award-panel')).not.toBeInTheDocument();
  });
});

/**
 * Per-seat auto top-up, on the REAL table.
 *
 * The chip holds NO enabled/target state of its own — it renders `seatAutoTopUp[seat]`
 * straight out of the store — so a chip that re-renders as ON is proof the store was
 * written. What the ENGINE then does with those policies is covered by `tableStore.test.ts`
 * against real stacks; these tests are about the wiring: click -> store -> server action.
 */
describe('TableRoot — per-seat auto top-up', () => {
  const threeHanded = () => makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });

  const at = (bb: number, enabled = true): AutoTopUpPolicy => {
    const target = Money.fromBB(bb);
    return { enabled, targetStack: target, threshold: target };
  };

  const chip = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-autotopup`);
  const toggle = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-autotopup-toggle`);
  const target = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-autotopup-target`);
  const editor = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-autotopup-input`);

  const savingOk = () =>
    vi
      .fn<UpdateSeatAutoTopUpAction>()
      .mockImplementation(async (input: SeatAutoTopUpValue): Promise<UpdateSeatAutoTopUpResult> => {
        const parsed = Money.parseBB(input.targetText);
        if (!parsed.ok) throw new Error(`the test action was sent unparseable text`);
        return {
          ok: true,
          seat: input.seat,
          policy: { enabled: input.enabled, targetStack: parsed.value, threshold: parsed.value },
        };
      });

  it('gives every occupied seat a chip and empty seats none', () => {
    renderTable(threeHanded());

    for (const seat of [0, 1, 2] as const) expect(chip(seat)).toBeInTheDocument();
    for (const seat of [3, 4, 5] as const) {
      expect(screen.queryByTestId(`seat-${seat}-autotopup`)).not.toBeInTheDocument();
    }
  });

  it('flips one seat ON in a single click, and back OFF in one more', async () => {
    const update = savingOk();
    renderTable(threeHanded(), { updateSeatAutoTopUp: update });
    expect(chip(0)).toHaveAttribute('data-enabled', 'false');

    fireEvent.click(toggle(0));

    // The chip renders the STORE's policy, so this is the store's new value.
    expect(chip(0)).toHaveAttribute('data-enabled', 'true');
    // The table's own reference stack, not a hard-coded 100.
    expect(target(0)).toHaveTextContent(
      `${Money.formatBB(threeHanded().config.referenceStack, { maxDecimals: 3 })} BB`,
    );
    // The neighbour is untouched: this is a seat preference, not a table-wide switch.
    expect(chip(1)).toHaveAttribute('data-enabled', 'false');

    fireEvent.click(toggle(0));
    expect(chip(0)).toHaveAttribute('data-enabled', 'false');

    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[0]![0]).toEqual({
      sessionId: 'session-1',
      seat: 0,
      enabled: true,
      targetText: '100',
    });
    expect(update.mock.calls[1]![0]!.enabled).toBe(false);
  });

  it('commits an edited target with Enter and sends the text the user typed', async () => {
    const update = savingOk();
    renderTable(threeHanded(), { seatAutoTopUp: { 1: at(100) }, updateSeatAutoTopUp: update });

    fireEvent.click(target(1));
    fireEvent.change(editor(1), { target: { value: '62.5' } });
    fireEvent.keyDown(editor(1), { key: 'Enter' });

    expect(target(1)).toHaveTextContent('62.5 BB');
    expect(chip(1)).toHaveAttribute('data-enabled', 'true');
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]![0]).toEqual({
      sessionId: 'session-1',
      seat: 1,
      enabled: true,
      targetText: '62.5',
    });
  });

  it('Esc cancels the target edit, keeping the old value and dispatching nothing', () => {
    const update = savingOk();
    renderTable(threeHanded(), { seatAutoTopUp: { 1: at(100) }, updateSeatAutoTopUp: update });

    fireEvent.click(target(1));
    fireEvent.change(editor(1), { target: { value: '40' } });
    fireEvent.keyDown(editor(1), { key: 'Escape' });

    expect(target(1)).toHaveTextContent('100 BB');
    expect(update).not.toHaveBeenCalled();
    // The table's own Esc handler is gated on `isTypingTarget`, so this one keypress did
    // not also disturb the right-hand column.
    expect(panelKind()).toBe('HISTORY');
  });

  it('shows a bad target beside the field, dispatches nothing and stores nothing', () => {
    const update = savingOk();
    renderTable(threeHanded(), { seatAutoTopUp: { 2: at(100) }, updateSeatAutoTopUp: update });

    fireEvent.click(target(2));
    fireEvent.change(editor(2), { target: { value: 'one hundred' } });
    fireEvent.keyDown(editor(2), { key: 'Enter' });

    expect(screen.getByTestId('seat-2-autotopup-problem')).toBeInTheDocument();
    // Rule 3: what was typed is still there to fix.
    expect(editor(2)).toHaveValue('one hundred');
    expect(update).not.toHaveBeenCalled();
    // And the stored target is unchanged behind the open editor.
    fireEvent.keyDown(editor(2), { key: 'Escape' });
    expect(target(2)).toHaveTextContent('100 BB');
  });

  /**
   * The damage a non-positive target does, on the real table.
   *
   * `Money.parseBB('0')` is `ok(0)`, so nothing upstream of the chip refuses it. Stored as
   * an ENABLED policy it makes `applySeatAutoTopUps` return `STACK_NOT_POSITIVE` at the
   * start of the NEXT hand, and that aborts Start Hand for the whole table — not just for
   * the seat that holds it. This plays a second hand to prove the table still deals.
   */
  it('still starts the next hand after a refused non-positive target', () => {
    const headsUp = makeTestTable({ seats: [0, 1], heroSeat: 0, buttonSeat: 0 });
    const update = savingOk();
    renderTable(headsUp, { updateSeatAutoTopUp: update });

    // Seat 0's policy is ON, so its target is live at the next deal.
    fireEvent.click(toggle(0));
    expect(chip(0)).toHaveAttribute('data-enabled', 'true');

    fireEvent.click(target(0));
    fireEvent.change(editor(0), { target: { value: '0' } });
    fireEvent.keyDown(editor(0), { key: 'Enter' });

    // Nothing was written: not the store, not the server, and the switch did not move.
    expect(screen.getByTestId('seat-0-autotopup-problem')).toHaveTextContent('STACK_NOT_POSITIVE');
    expect(editor(0)).toHaveValue('0');
    expect(update).toHaveBeenCalledTimes(1); // the toggle only
    fireEvent.keyDown(editor(0), { key: 'Escape' });
    expect(chip(0)).toHaveAttribute('data-enabled', 'true');
    expect(target(0)).toHaveTextContent(
      `${Money.formatBB(headsUp.config.referenceStack, { maxDecimals: 3 })} BB`,
    );

    // Hand 1: heads-up, hero has the button and is first to act preflop. Fold ends it.
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.getByTestId('dock-F')).toHaveAttribute('data-legal', 'true');
    fireEvent.click(screen.getByTestId('dock-F'));

    // Hand 2 is where a poisoned target bites: the between-hands top-up runs first.
    fireEvent.click(screen.getByTestId('start-hand'));

    // No `STACK_NOT_POSITIVE` banner, and a live second hand: the engine numbers the first
    // hand it deals #0, so `핸드 #1` is the one that would not have been dealt at all.
    expect(screen.queryByTestId('engine-error')).not.toBeInTheDocument();
    expect(screen.getByText('핸드 #1')).toBeInTheDocument();
    expect(screen.getByTestId('dock-F')).toHaveAttribute('data-legal', 'true');
  });

  it('surfaces a save that failed WITHOUT reverting what the user set', async () => {
    const update = vi.fn<UpdateSeatAutoTopUpAction>().mockResolvedValue({
      ok: false,
      issues: [
        { seat: 0, field: 'autoTopUpTargetText', message: 'session no longer exists', code: null },
      ],
    });
    renderTable(threeHanded(), { updateSeatAutoTopUp: update });

    fireEvent.click(toggle(0));

    const banner = await screen.findByTestId('autotopup-save-error');
    expect(banner).toHaveTextContent('좌석 1');
    expect(banner).toHaveTextContent('session no longer exists');
    expect(banner).toHaveTextContent('이 브라우저');
    // The user's choice stands; it simply is not persisted.
    expect(chip(0)).toHaveAttribute('data-enabled', 'true');
  });

  it('surfaces a rejected save (a network failure), not a silent swallow', async () => {
    const update = vi
      .fn<UpdateSeatAutoTopUpAction>()
      .mockRejectedValue(new Error('Failed to fetch'));
    renderTable(threeHanded(), { updateSeatAutoTopUp: update });

    fireEvent.click(toggle(0));

    expect(await screen.findByTestId('autotopup-save-error')).toHaveTextContent('Failed to fetch');
    expect(chip(0)).toHaveAttribute('data-enabled', 'true');
  });

  it('renders the new state while the save is still in flight', () => {
    // Never settles: if anything on the click path awaited the server, the chip below
    // could not have flipped.
    const update = vi.fn<UpdateSeatAutoTopUpAction>().mockReturnValue(new Promise(() => {}));
    renderTable(threeHanded(), { updateSeatAutoTopUp: update });

    fireEvent.click(toggle(0));

    expect(chip(0)).toHaveAttribute('data-enabled', 'true');
    expect(update).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('autotopup-save-error')).not.toBeInTheDocument();

    // A pending save blocks nothing: the next click is applied just as immediately.
    fireEvent.click(toggle(1));
    expect(chip(1)).toHaveAttribute('data-enabled', 'true');
  });

  /**
   * Saves are not awaited on the click path (ADR-0043), so two fast toggles on one seat are
   * two requests in flight. The banner is cleared when a request is DISPATCHED, so without a
   * per-seat sequence an earlier failure landing after a later success would say "not saved"
   * about a seat that was saved.
   */
  it('ignores a stale failure that lands after a newer save for the same seat succeeded', async () => {
    let failFirst: (() => void) | null = null;
    const update = vi
      .fn<UpdateSeatAutoTopUpAction>()
      .mockImplementationOnce(
        () =>
          new Promise<UpdateSeatAutoTopUpResult>((resolve) => {
            failFirst = () =>
              resolve({
                ok: false,
                issues: [{ seat: 0, field: 'autoTopUp', message: 'stale rejection', code: null }],
              });
          }),
      )
      .mockImplementationOnce(async (): Promise<UpdateSeatAutoTopUpResult> => ({
        ok: true,
        seat: 0,
        policy: { enabled: false, targetStack: Money.fromBB(100), threshold: Money.fromBB(100) },
      }));
    renderTable(threeHanded(), { updateSeatAutoTopUp: update });

    // Two toggles on the SAME seat. The first save is still in flight when the second one
    // is issued, and the second one is the one that describes what is stored.
    fireEvent.click(toggle(0));
    fireEvent.click(toggle(0));
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    // Now the FIRST save answers, late, with a rejection.
    if (failFirst === null) throw new Error('the first save was never issued');
    await act(async () => {
      (failFirst as () => void)();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('autotopup-save-error')).not.toBeInTheDocument();
    expect(chip(0)).toHaveAttribute('data-enabled', 'false');
  });

  it('still reports the NEWEST save failing, after an earlier one succeeded', async () => {
    const update = vi
      .fn<UpdateSeatAutoTopUpAction>()
      .mockImplementationOnce(async (): Promise<UpdateSeatAutoTopUpResult> => ({
        ok: true,
        seat: 0,
        policy: { enabled: true, targetStack: Money.fromBB(100), threshold: Money.fromBB(100) },
      }))
      .mockResolvedValue({
        ok: false,
        issues: [{ seat: 0, field: 'autoTopUp', message: 'newest rejection', code: null }],
      });
    renderTable(threeHanded(), { updateSeatAutoTopUp: update });

    fireEvent.click(toggle(0));
    fireEvent.click(toggle(0));

    // The sequence suppresses STALE results only; the newest one is still shown.
    expect(await screen.findByTestId('autotopup-save-error')).toHaveTextContent('newest rejection');
  });

  it('works with no server action at all: the preference still applies locally', () => {
    renderTable(threeHanded());

    fireEvent.click(toggle(0));

    expect(chip(0)).toHaveAttribute('data-enabled', 'true');
    expect(screen.queryByTestId('autotopup-save-error')).not.toBeInTheDocument();
  });

  it('describes the header line as the session DEFAULT, not as every seat’s truth', () => {
    renderTable(threeHanded(), { autoTopUp: at(100), seatAutoTopUp: { 0: at(100, false) } });

    const header = screen.getByTestId('session-autotopup-default');
    expect(header).toHaveTextContent('세션 기본값');
    expect(header).toHaveTextContent('좌석마다 개별 설정');
    // And the seat that diverged from that default says so itself.
    expect(chip(0)).toHaveAttribute('data-enabled', 'false');
  });
});

/**
 * The seat occupancy toggle (`S` hotkey / table-side chip), on the REAL table.
 *
 * `SeatOccupancyToggle` itself holds no state of its own — it renders `table.seats[seat]`
 * straight out of the store — so a toggle that re-renders SITTING_OUT is proof the store
 * was written. What the ENGINE does with occupancy across hands (the 6 -> 5 -> 4 -> 5
 * sequence) is covered by `tableStore.test.ts`; these tests are the wiring: click / `S` ->
 * store -> server action, and the "current hand is untouched" promise as it actually
 * renders.
 */
describe('TableRoot — seat occupancy', () => {
  const threeHanded = () => makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });

  const occupancyChip = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-occupancy`);
  const occupancyToggle = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-occupancy-toggle`);
  const occupancyState = (seat: SeatIndex) => screen.getByTestId(`seat-${seat}-occupancy-state`);

  const savingOk = () =>
    vi
      .fn<UpdateSeatOccupancyAction>()
      .mockImplementation(
        async (input: SeatOccupancyValue): Promise<UpdateSeatOccupancyResult> => ({
          ok: true,
          seat: input.seat,
          occupancy: input.occupancy,
        }),
      );

  it('gives every occupied seat a toggle and empty seats none', () => {
    renderTable(threeHanded());

    for (const seat of [0, 1, 2] as const) expect(occupancyChip(seat)).toBeInTheDocument();
    for (const seat of [3, 4, 5] as const) {
      expect(screen.queryByTestId(`seat-${seat}-occupancy`)).not.toBeInTheDocument();
    }
  });

  it('flips a seat SITTING_OUT in one click, and back ACTIVE in one more', async () => {
    const update = savingOk();
    renderTable(threeHanded(), { updateSeatOccupancy: update });
    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'false');

    fireEvent.click(occupancyToggle(1));
    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'true');
    // The neighbour is untouched: this is a seat preference, not a table-wide switch.
    expect(occupancyChip(0)).toHaveAttribute('data-sitting-out', 'false');

    fireEvent.click(occupancyToggle(1));
    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'false');

    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[0]![0]).toEqual({
      sessionId: 'session-1',
      seat: 1,
      occupancy: 'SITTING_OUT',
    });
    expect(update.mock.calls[1]![0]).toEqual({
      sessionId: 'session-1',
      seat: 1,
      occupancy: 'ACTIVE',
    });
  });

  it('toggles the SELECTED seat with the S key, and does nothing when no seat is selected', () => {
    const update = savingOk();
    renderTable(threeHanded(), { updateSeatOccupancy: update });

    // No seat selected yet: `S` is a no-op.
    fireEvent.keyDown(window, { key: 's' });
    expect(update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('seat-1'));
    fireEvent.keyDown(window, { key: 's' });

    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'true');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('never sits a player out while the user is typing an `s`', () => {
    const update = savingOk();
    renderTable(threeHanded(), { updateSeatOccupancy: update });
    fireEvent.click(screen.getByTestId('seat-1'));

    fireEvent.keyDown(screen.getByTestId('raise-input'), { key: 's' });

    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'false');
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * ADR-0073 replaced the old "the live hand keeps the seat until the next deal" assertion.
   * The premise it rested on is gone: sitting a seat out mid-hand now REBASES — the hand is
   * discarded whole and re-dealt from the corrected lineup at the SAME hand number — so the
   * felt agrees with the toggle in the same commit and there is nothing left to defer.
   */
  it('rebases the LIVE hand at the same hand number when a seat is sat out mid-hand', () => {
    renderTable(threeHanded());
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.getByTestId('seat-1')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
    const streetBefore = screen.getByTestId('street').textContent;

    fireEvent.click(occupancyToggle(1));

    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'true');
    // No deferral: the label is the settled one and the felt has already dropped the seat.
    expect(occupancyState(1)).toHaveTextContent('켬');
    expect(occupancyState(1)).not.toHaveTextContent('다음 핸드부터');
    expect(screen.getByTestId('seat-1')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
    // A correction, not a skip: a hand is still in progress, on the same street, and the two
    // remaining seats were re-dealt rather than spliced.
    expect(screen.getByTestId('street').textContent).toBe(streetBefore);
    expect(screen.getByTestId('seat-0')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
    expect(screen.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
    expect(screen.queryByTestId('engine-error')).not.toBeInTheDocument();
  });

  it('announces the rebuilt hand once, dismissably, and never as a modal', () => {
    renderTable(threeHanded());
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.queryByTestId('hand-rebased-notice')).not.toBeInTheDocument();

    fireEvent.click(occupancyToggle(1));

    const notice = screen.getByTestId('hand-rebased-notice');
    expect(notice).toHaveTextContent(HAND_REBASED_NOTICE);
    fireEvent.click(screen.getByTestId('hand-rebased-dismiss'));
    expect(screen.queryByTestId('hand-rebased-notice')).not.toBeInTheDocument();
  });

  it('does not announce a rebuild for a correction made between hands', () => {
    renderTable(threeHanded());

    fireEvent.click(occupancyToggle(1));

    expect(screen.queryByTestId('hand-rebased-notice')).not.toBeInTheDocument();
    expect(occupancyChip(1)).toHaveAttribute('data-sitting-out', 'true');
  });

  it('deals one fewer seat on the NEXT hand after a sit-out, and folding it out settles fine', () => {
    renderTable(threeHanded());
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(occupancyToggle(2));
    // Finish the 3-handed hand in progress: two folds, exactly as `playOneHand` elsewhere.
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));
    expect(screen.getByTestId('start-hand')).toBeEnabled();

    fireEvent.click(screen.getByTestId('start-hand'));

    expect(screen.queryByTestId('engine-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('seat-2')).toHaveAttribute('data-status', 'NOT_DEALT_IN');
    expect(occupancyState(2)).toHaveTextContent('켬');
  });

  it('rebases a RE-ACTIVATION mid-hand too, dealing the seat back in at once', () => {
    // The other direction of R1 MINOR-12's concern, now answered by the rebase rather than by
    // a label: re-activating a seat mid-hand deals it back in immediately.
    renderTable(threeHanded());
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(occupancyToggle(2));
    expect(screen.getByTestId('seat-2')).toHaveAttribute('data-status', 'NOT_DEALT_IN');

    fireEvent.click(occupancyToggle(2));

    expect(occupancyChip(2)).toHaveAttribute('data-sitting-out', 'false');
    expect(screen.getByTestId('seat-2')).not.toHaveAttribute('data-status', 'NOT_DEALT_IN');
    expect(occupancyState(2)).toHaveTextContent('끔');
    expect(occupancyState(2)).not.toHaveTextContent('다음 핸드부터');
    expect(screen.queryByTestId('engine-error')).not.toBeInTheDocument();
  });

  it('never shows a deferred-effect label, mid-hand or between hands', () => {
    renderTable(threeHanded());
    fireEvent.click(screen.getByTestId('start-hand'));

    expect(occupancyState(1)).toHaveTextContent('끔');
    fireEvent.click(occupancyToggle(1));
    expect(occupancyState(1)).toHaveTextContent('켬');
    fireEvent.click(occupancyToggle(1));
    expect(occupancyState(1)).toHaveTextContent('끔');
    expect(document.body.textContent ?? '').not.toContain('다음 핸드부터');
  });

  it('surfaces a save that failed WITHOUT reverting what the user set', async () => {
    const update = vi.fn<UpdateSeatOccupancyAction>().mockResolvedValue({
      ok: false,
      issues: [{ seat: 0, field: 'sessionId', message: 'session no longer exists', code: null }],
    });
    renderTable(threeHanded(), { updateSeatOccupancy: update });

    fireEvent.click(occupancyToggle(0));

    const banner = await screen.findByTestId('occupancy-save-error');
    expect(banner).toHaveTextContent('좌석 1');
    expect(banner).toHaveTextContent('session no longer exists');
    expect(banner).toHaveTextContent('이 브라우저');
    expect(occupancyChip(0)).toHaveAttribute('data-sitting-out', 'true');
  });

  it('works with no server action at all: the preference still applies locally', () => {
    renderTable(threeHanded());

    fireEvent.click(occupancyToggle(0));

    expect(occupancyChip(0)).toHaveAttribute('data-sitting-out', 'true');
    expect(screen.queryByTestId('occupancy-save-error')).not.toBeInTheDocument();
  });
});

/**
 * The right column's priority, on the REAL table. The rule itself is unit-tested in
 * `lib/table/rightPanel.test.ts`; what these prove is that the table is wired to it, and
 * that `Esc` still means exactly what it meant before the Korean-first pass.
 */
describe('TableRoot — right-column priority', () => {
  const headsUp = () => makeTestTable({ seats: [0, 1], heroSeat: 0, buttonSeat: 0 });

  const profileOf = (nickname: string): LoadPlayerProfileAction =>
    vi.fn<LoadPlayerProfileAction>().mockResolvedValue({
      ok: true,
      profile: {
        playerId: 'player-1',
        nickname,
        displayAlias: null,
        archived: false,
        hud: null,
        externalHud: null,
        notes: [],
        warnings: [],
      },
    });

  it('leads with the strategy panel while hero is the seat on the clock', () => {
    renderTable(headsUp());
    fireEvent.click(screen.getByTestId('start-hand'));
    // The premise: heads-up, hero has the button and is therefore first to act preflop.
    expect(seatEl(0)).toHaveAttribute('data-actor', 'true');

    expect(panelKind()).toBe('STRATEGY');
    expect(screen.getByTestId('strategy-panel')).toBeInTheDocument();
    // The log never leaves the column; it simply stops leading it.
    expect(screen.getByTestId('action-history')).toBeInTheDocument();
  });

  it('leads with the action history when hero is not to act and nothing is selected', () => {
    renderTable(headsUp());
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-C'));

    expect(seatEl(0)).toHaveAttribute('data-actor', 'false');
    expect(panelKind()).toBe('HISTORY');
    expect(screen.queryByTestId('strategy-panel')).not.toBeInTheDocument();
  });

  /**
   * ADR-0077, and the single most important property of this column: clicking a seat is how
   * you look up who you are up against, and it used to DELETE the answer you were looking
   * them up for. The strategy now leads and the profile opens as a drawer UNDER it. The
   * assertion is strictly stronger than the one it replaces — both panels at once, rather
   * than the profile in place of the strategy.
   */
  it('keeps the strategy on screen and opens the profile beneath it while hero is to act', async () => {
    renderTable(headsUp(), { loadPlayerProfile: profileOf('Player 2') });
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(panelKind()).toBe('STRATEGY');

    fireEvent.click(seatEl(1));

    expect(panelKind()).toBe('STRATEGY');
    expect(screen.getByTestId('right-panel')).toHaveAttribute('data-drawer', 'PLAYER');
    expect(screen.getByTestId('strategy-panel')).toBeInTheDocument();
    expect(await screen.findByTestId('player-profile')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-drawer')).toContainElement(
      screen.getByTestId('player-profile'),
    );
    // The log is not squeezed out by the second panel.
    expect(screen.getByTestId('action-history')).toBeInTheDocument();
    // Hero is still the actor: the engine has not moved, and the panel has not either.
    expect(seatEl(0)).toHaveAttribute('data-actor', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('player-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-panel-drawer')).not.toBeInTheDocument();
    expect(panelKind()).toBe('STRATEGY');
    expect(screen.getByTestId('strategy-panel')).toBeInTheDocument();
  });

  it('leads with the profile only when hero is NOT the actor', async () => {
    renderTable(headsUp(), { loadPlayerProfile: profileOf('Player 2') });
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-C'));
    expect(seatEl(0)).toHaveAttribute('data-actor', 'false');

    fireEvent.click(seatEl(1));

    expect(panelKind()).toBe('PLAYER');
    expect(screen.getByTestId('right-panel')).toHaveAttribute('data-drawer', 'NONE');
    expect(await screen.findByTestId('player-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('right-panel-drawer')).not.toBeInTheDocument();
  });

  /**
   * `CLAUDE.md` rule 2 at the surface the user reads. The panel now DOES show frequencies,
   * so the honesty test is no longer "there is no number" — it is that the engine is named
   * as the reference policy it is, and that the three letters reserved for solved output
   * appear nowhere on screen.
   */
  it('names the reference engine and never the reserved solved-output label', async () => {
    renderTable(headsUp());
    fireEvent.click(screen.getByTestId('start-hand'));

    const panel = await screen.findByTestId('strategy-panel');
    expect(screen.getByTestId('strategy-engine-label')).toHaveTextContent(STRATEGY_ENGINE_LABEL);
    // The whole document, not merely this panel: the label must not leak in anywhere.
    expect(document.body.textContent ?? '').not.toContain('GTO');
    expect(panel.textContent ?? '').not.toContain('정답');
  });
});

/**
 * The entry tray. Its whole purpose is that the bottom of the screen holds still: it is
 * always mounted, its height has a FLOOR the palette and the keyboard legend both fit
 * inside (ADR-0054 — a floor, not a constant, because the award panel is taller than
 * either), and the hero-card rail inside it never unmounts even while the palette that
 * fills it is on screen.
 *
 * happy-dom performs NO layout, so nothing here can measure anything. The real geometric
 * guarantee is pinned by the two assertions in `apps/web/tests/e2e/action-dock.spec.ts`:
 * the dock stays inside the viewport with the palette open, and the award submit button
 * stays clear of the dock. What is checkable here is the class contract those rest on.
 */
describe('TableRoot — the entry tray', () => {
  const headsUp = () => makeTestTable({ seats: [0, 1], heroSeat: 0, buttonSeat: 0 });

  /**
   * Re-pinning the tray to a fixed height is the exact regression ADR-0054 exists to
   * prevent: it is what put the award panel's submit button underneath the action dock,
   * hiding the primary action of the one panel that moves money.
   */
  it('keeps the tray on a min-height FLOOR and never re-pins it to a fixed height', () => {
    renderTable(headsUp());
    const trayClass = screen.getByTestId('entry-tray').className;

    expect(trayClass).toMatch(/(?:^|\s)min-h-\[[^\]]+\]/u);
    // The cap, with `overflow-y-auto` inside it as the release valve past that cap.
    expect(trayClass).toMatch(/(?:^|\s)max-h-\[[^\]]+\]/u);
    // A bare `h-[...]` — the pinned height — must not come back. `max-h-`/`min-h-` are not
    // matched: the pattern requires the token to START with `h-`.
    expect(trayClass).not.toMatch(/(?:^|\s)h-\[[^\]]+\]/u);
    // And the tray is `shrink-0`, so the felt above it is what gives when it grows.
    expect(trayClass).toContain('shrink-0');
  });

  it('keeps the same tray and hero rail before, during and after card entry', () => {
    renderTable(headsUp());
    const tray = () => screen.getByTestId('entry-tray');
    // The very same element throughout: a tray that unmounted and remounted with the
    // palette would be the jumping bottom edge ADR-0054 removed.
    const node = tray();

    // Idle: no hand, so the tray carries the keyboard legend and no palette.
    expect(screen.getByTestId('keyboard-hints')).toBeInTheDocument();
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-cards')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('start-hand'));

    // Entry: the palette took the same box, and the hero rail is still there.
    expect(screen.getByTestId('card-palette')).toBeInTheDocument();
    expect(screen.queryByTestId('keyboard-hints')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-cards')).toBeInTheDocument();
    expect(tray()).toBe(node);

    fireEvent.click(screen.getByTestId('palette-As'));
    fireEvent.click(screen.getByTestId('palette-Kd'));

    // Done: the palette closed itself and the tray it lived in never went away.
    expect(screen.queryByTestId('card-palette')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-cards')).toHaveTextContent('As');
    expect(tray()).toBe(node);
  });

  it('keeps the action dock mounted below the tray in every phase', () => {
    renderTable(headsUp());
    expect(screen.getByTestId('action-dock')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.getByTestId('action-dock')).toBeInTheDocument();
  });
});

/**
 * `CLAUDE.md` rule 3. The notice is shorter and Korean now; what it must still say is that
 * the session is saved, the hand in progress is NOT, and a reload discards it.
 */
describe('TableRoot — the in-memory notice', () => {
  it('still says the session is saved and the live hand is not', () => {
    renderTable(makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }));
    const notice = screen.getByTestId('in-memory-notice');
    expect(notice).toHaveTextContent('세션은 저장됩니다');
    expect(notice).toHaveTextContent('진행 중인 핸드는 저장되지 않으며');
    expect(notice).toHaveTextContent('새로고침하면 사라집니다');
  });
});

/**
 * 상대 적응 · ADAPTIVE opponent inputs — the LOADING and LIVE-REFRESH half of WP-J §6.
 *
 * What is asserted here is the wiring, not the composition: who is asked about, when, and what
 * a failure does. The composition itself is `StrategyPanel.test.tsx`'s and
 * `adaptive-core`'s. All three tests below matter for the same reason — this is the only path
 * in the table that awaits anything on behalf of the strategy column, and it must never be
 * able to block, throw, or interrupt a hand.
 */
describe('TableRoot — ADAPTIVE opponent inputs', () => {
  const emptyInput = (playerId: string, seatIndex: number): AdaptiveOpponentInputWire => ({
    playerId,
    seatIndex,
    nickname: null,
    observations: [],
    manualHudSnapshotId: null,
    manualHudRecordedAt: null,
    learnedSnapshotId: null,
    learnedModelVersion: null,
    externalHudSnapshotId: null,
    externalHudRecordedAt: null,
  });

  const okLoader = () =>
    vi.fn<LoadAdaptiveInputsAction>(async (seats) => ({
      ok: true as const,
      inputs: seats.map((seat) => emptyInput(seat.playerId, seat.seatIndex)),
    }));

  it('asks about every occupied seat except hero’s, once, with the table’s own nicknames', async () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const loadAdaptiveInputs = okLoader();

    renderTable(table, { loadAdaptiveInputs });

    await waitFor(() => expect(loadAdaptiveInputs).toHaveBeenCalledTimes(1));
    // Hero is excluded: the layer reasons about OPPONENTS, and hero's own tendencies are not
    // an input to any rule.
    expect(loadAdaptiveInputs).toHaveBeenCalledWith([
      { playerId: 'player-1', seatIndex: 1, nickname: 'Player 2' },
      { playerId: 'player-2', seatIndex: 2, nickname: 'Player 3' },
    ]);

    // Dealing a hand changes the table object but not the LINEUP, so nothing is re-read.
    fireEvent.click(screen.getByTestId('start-hand'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(loadAdaptiveInputs).toHaveBeenCalledTimes(1);
  });

  it('re-reads exactly ONE player after their HUD reading is saved', async () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const loadAdaptiveInputs = okLoader();
    const profileView = {
      playerId: 'player-1',
      nickname: 'Player 2',
      displayAlias: null,
      archived: false,
      hud: null,
      externalHud: null,
      notes: [],
      warnings: [],
    };
    const loadPlayerProfile = vi
      .fn<LoadPlayerProfileAction>()
      .mockResolvedValue({ ok: true, profile: profileView });
    const saveHudSnapshot = vi
      .fn<SaveHudSnapshotAction>()
      .mockResolvedValue({ ok: true, profile: profileView });

    renderTable(table, { loadAdaptiveInputs, loadPlayerProfile, saveHudSnapshot });
    await waitFor(() => expect(loadAdaptiveInputs).toHaveBeenCalledTimes(1));

    fireEvent.click(seatEl(1));
    expect(await screen.findByTestId('hud-edit-form')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('hud-input-VPIP'), { target: { value: '31' } });
    fireEvent.change(screen.getByTestId('hud-input-handSample'), { target: { value: '400' } });
    fireEvent.click(screen.getByTestId('hud-save-button'));

    // The save itself is untouched — the panel still gets the server's own result.
    await waitFor(() => expect(saveHudSnapshot).toHaveBeenCalledTimes(1));
    // And exactly that one player is re-read, through the SAME loader, because the server
    // owns the observation mapping and the sample clamp (§2.3) and this side re-derives none
    // of it.
    await waitFor(() => expect(loadAdaptiveInputs).toHaveBeenCalledTimes(2));
    expect(loadAdaptiveInputs).toHaveBeenLastCalledWith([
      { playerId: 'player-1', seatIndex: 1, nickname: 'Player 2' },
    ]);
  });

  it('degrades quietly when the read fails: no error UI, no throw, the table plays on', async () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const failed = vi
      .fn<LoadAdaptiveInputsAction>()
      .mockResolvedValue({ ok: false, message: 'the database is locked' });

    renderTable(table, { loadAdaptiveInputs: failed });
    await waitFor(() => expect(failed).toHaveBeenCalledTimes(1));

    // The failure is not shown, not thrown, and not blocking: ADAPTIVE simply has no data.
    expect(screen.queryByText('the database is locked')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.getByTestId('street')).toHaveTextContent(STREET_LABEL.PREFLOP);
    expect(screen.getByTestId('strategy-panel')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-engine-label')).toHaveTextContent(STRATEGY_ENGINE_LABEL);
  });

  it('survives a rejected read the same way', async () => {
    const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
    const rejected = vi
      .fn<LoadAdaptiveInputsAction>()
      .mockRejectedValue(new Error('network is gone'));

    renderTable(table, { loadAdaptiveInputs: rejected });
    await waitFor(() => expect(rejected).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    expect(screen.queryByText('network is gone')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.getByTestId('street')).toHaveTextContent(STREET_LABEL.PREFLOP);
  });
});

/* ========================================================================== */
/* V2 — 빠른 다음 핸드 / 스택 리싱크 / 플레이어 변경                            */
/* ========================================================================== */

const adaptiveWire = (playerId: string, seatIndex: number): AdaptiveOpponentInputWire => ({
  playerId,
  seatIndex,
  nickname: null,
  observations: [],
  manualHudSnapshotId: null,
  manualHudRecordedAt: null,
  learnedSnapshotId: null,
  learnedModelVersion: null,
  externalHudSnapshotId: null,
  externalHudRecordedAt: null,
});

const threeHandedTable = () => makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });

/**
 * WP-4. The label and the sentence under it changed; the action and its `data-testid` did not.
 * What matters beyond the wording is the AUDIT: `skipped_hands.reason` is derived by the store
 * from the view at skip time (ADR-0074), and this component must send that value rather than
 * one of its own.
 */
describe('TableRoot — 빠른 다음 핸드', () => {
  it('labels the button and states what a skip costs before it is pressed', () => {
    renderTable(threeHandedTable());

    expect(screen.getByTestId('skip-hand')).toHaveTextContent(QUICK_NEXT_HAND_LABEL);
    expect(screen.getByTestId('quick-next-hand-description')).toHaveTextContent(
      '상대 스택은 다음 핸드 전에 확인하세요',
    );
  });

  it('sends the skipped hand number AND the store-derived reason', async () => {
    const logSkippedHand = vi.fn<LogSkippedHandAction>().mockResolvedValue({ ok: true });
    renderTable(threeHandedTable(), { logSkippedHand });
    fireEvent.click(screen.getByTestId('start-hand'));

    fireEvent.click(screen.getByTestId('skip-hand'));

    await vi.waitFor(() => expect(logSkippedHand).toHaveBeenCalledTimes(1));
    expect(logSkippedHand.mock.calls[0]![0]).toEqual({
      sessionId: 'session-1',
      // The SKIPPED hand's own number, not the table's post-skip count.
      handNumber: 0,
      reason: 'QUICK_SKIP',
    });
  });

  it('sends HERO_FOLDED_UNOBSERVED when hero had already folded', async () => {
    const logSkippedHand = vi.fn<LogSkippedHandAction>().mockResolvedValue({ ok: true });
    renderTable(threeHandedTable(), { logSkippedHand });
    fireEvent.click(screen.getByTestId('start-hand'));
    // Hero is on the button and first to act three-handed preflop.
    expect(seatEl(0)).toHaveAttribute('data-actor', 'true');
    fireEvent.click(screen.getByTestId('dock-F'));

    fireEvent.click(screen.getByTestId('skip-hand'));

    await vi.waitFor(() => expect(logSkippedHand).toHaveBeenCalledTimes(1));
    expect(logSkippedHand.mock.calls[0]![0]!.reason).toBe('HERO_FOLDED_UNOBSERVED');
  });

  it('audits nothing when there is no live hand to skip', () => {
    const logSkippedHand = vi.fn<LogSkippedHandAction>().mockResolvedValue({ ok: true });
    renderTable(threeHandedTable(), { logSkippedHand });

    fireEvent.click(screen.getByTestId('skip-hand'));

    expect(logSkippedHand).not.toHaveBeenCalled();
  });
});

/**
 * WP-5 / ADR-0075. The stack number IS the control, Enter walks the dirty seats in a
 * predictable order, and every correction is written back at its between-hands boundary —
 * unawaited, and a failure never reverts what is on screen.
 */
describe('TableRoot — inline stack resync', () => {
  const okSync = () => vi.fn<SyncSessionSeatsAction>().mockResolvedValue({ ok: true });

  /** Quick-skips one hand, which leaves every dealt-in unfolded seat 확인 필요 (ADR-0074). */
  const skipToDirty = () => {
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('skip-hand'));
  };

  it('turns the stack number into an input in place, and writes the corrected value', async () => {
    const syncSessionSeats = okSync();
    renderTable(threeHandedTable(), { syncSessionSeats });

    fireEvent.click(screen.getByTestId('seat-1-stack'));
    const input = screen.getByTestId('seat-1-stack-input');
    fireEvent.change(input, { target: { value: '77.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('seat-1')).toHaveTextContent('77.5 BB');
    await vi.waitFor(() => expect(syncSessionSeats).toHaveBeenCalledTimes(1));
    const sent = syncSessionSeats.mock.calls[0]![0]!;
    expect(sent.sessionId).toBe('session-1');
    expect(sent.buttonSeat).toBe(0);
    // All six seats travel, so the write is a complete statement about the table.
    expect(sent.seats).toHaveLength(6);
    // `stackUnverified` rides on EVERY seat of EVERY sync (ADR-0078b). The seat the user
    // just stated is `false` — stating it is exactly what clears the mark.
    expect(sent.seats.find((seat) => seat.seat === 1)).toEqual({
      seat: 1,
      occupancy: 'ACTIVE',
      playerId: 'player-1',
      stack: Money.fromBB(77.5),
      stackUnverified: false,
    });
    expect(sent.seats.find((seat) => seat.seat === 3)).toEqual({
      seat: 3,
      occupancy: 'EMPTY',
      playerId: null,
      stack: 0,
      stackUnverified: false,
    });
  });

  it('moves focus to the NEXT dirty seat on Enter, and lets go after the last one', () => {
    renderTable(threeHandedTable(), { syncSessionSeats: okSync() });
    skipToDirty();
    for (const seat of [0, 1, 2] as const) {
      expect(screen.getByTestId(`seat-${seat}-dirty`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('seat-0-dirty-action'));
    const first = screen.getByTestId('seat-0-stack-input');
    expect(document.activeElement).toBe(first);
    fireEvent.change(first, { target: { value: '90' } });
    fireEvent.keyDown(first, { key: 'Enter' });

    // Seat 0 is confirmed and the field has walked on by itself.
    expect(screen.queryByTestId('seat-0-dirty')).not.toBeInTheDocument();
    const second = screen.getByTestId('seat-1-stack-input');
    expect(document.activeElement).toBe(second);
    fireEvent.change(second, { target: { value: '80' } });
    fireEvent.keyDown(second, { key: 'Enter' });

    const third = screen.getByTestId('seat-2-stack-input');
    expect(document.activeElement).toBe(third);
    fireEvent.change(third, { target: { value: '70' } });
    fireEvent.keyDown(third, { key: 'Enter' });

    // The last dirty seat gives the focus back rather than looping forever.
    expect(screen.queryByTestId('seat-2-stack-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seat-0-dirty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seat-1-dirty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seat-2-dirty')).not.toBeInTheDocument();
  });

  it('refuses a non-positive stack on the client, keeps the text and writes nothing', async () => {
    const syncSessionSeats = okSync();
    renderTable(threeHandedTable(), { syncSessionSeats });

    fireEvent.click(screen.getByTestId('seat-1-stack'));
    const input = screen.getByTestId('seat-1-stack-input');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('seat-1-stack-error')).toHaveTextContent(
      STACK_EDIT_REJECTION_LABEL.NOT_POSITIVE,
    );
    // Rule 3: what the user typed is still there, and the field has not moved on.
    expect(screen.getByTestId('seat-1-stack-input')).toHaveValue('0');
    await Promise.resolve();
    expect(syncSessionSeats).not.toHaveBeenCalled();

    // The stored stack is untouched — the refusal happened before the store saw it.
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('seat-1')).toHaveTextContent('100 BB');
  });

  it('refuses text that is not a number, with the reason for THAT mistake', () => {
    renderTable(threeHandedTable());

    fireEvent.click(screen.getByTestId('seat-1-stack'));
    const input = screen.getByTestId('seat-1-stack-input');
    fireEvent.change(input, { target: { value: '12o' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('seat-1-stack-error')).toHaveTextContent(
      STACK_EDIT_REJECTION_LABEL.NOT_A_NUMBER,
    );
  });

  it('shows a save that failed WITHOUT reverting the corrected stack', async () => {
    const syncSessionSeats = vi.fn<SyncSessionSeatsAction>().mockResolvedValue({
      ok: false,
      code: 'NOT_FOUND',
      message: 'session no longer exists',
    });
    renderTable(threeHandedTable(), { syncSessionSeats });

    fireEvent.click(screen.getByTestId('seat-1-stack'));
    const input = screen.getByTestId('seat-1-stack-input');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const banner = await screen.findByTestId('seat-state-save-error');
    expect(banner).toHaveTextContent('session no longer exists');
    expect(banner).toHaveTextContent('되돌리지 않았습니다');
    expect(screen.getByTestId('seat-1')).toHaveTextContent('42 BB');
  });

  /**
   * ONE WRITER PER BOUNDARY. The ACTIVE/SITTING_OUT toggle has its own narrow updater, which
   * changes exactly the column it means to and has its own failure banner. Firing the whole
   * seat-state write for it as well stored the same value twice and could raise two banners
   * for one failure.
   */
  it('leaves the occupancy toggle to its own narrow write, not the whole-table one', async () => {
    const syncSessionSeats = okSync();
    const updateSeatOccupancy = vi
      .fn<UpdateSeatOccupancyAction>()
      .mockImplementation(
        async (input: SeatOccupancyValue): Promise<UpdateSeatOccupancyResult> => ({
          ok: true,
          seat: input.seat,
          occupancy: input.occupancy,
        }),
      );
    renderTable(threeHandedTable(), { syncSessionSeats, updateSeatOccupancy });

    fireEvent.click(screen.getByTestId('seat-1-occupancy-toggle'));

    await vi.waitFor(() => expect(updateSeatOccupancy).toHaveBeenCalledTimes(1));
    expect(syncSessionSeats).not.toHaveBeenCalled();
  });

  it('writes the settled seat state when the next hand starts', async () => {
    const syncSessionSeats = okSync();
    renderTable(threeHandedTable(), { syncSessionSeats });
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(syncSessionSeats).not.toHaveBeenCalled();
    // Play the hand out: two folds settle it three-handed.
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));

    fireEvent.click(screen.getByTestId('start-hand'));

    await vi.waitFor(() => expect(syncSessionSeats).toHaveBeenCalledTimes(1));
  });
});

/**
 * WP-2 / ADR-0076. One player holds at most one seat, an EMPTY seat needs a counted stack and
 * an occupied one must not be given a made-up number, and a blank HUD field is an ABSENT row.
 */
describe('TableRoot — 플레이어 변경', () => {
  const roster: SearchPlayersAction = async () => ({
    ok: true,
    matches: [
      { id: 'player-1', nickname: 'Player 2', kind: 'BROWSE', hasExternalHud: false },
      { id: 'player-new', nickname: 'Stranger', kind: 'BROWSE', hasExternalHud: true },
    ],
  });

  const okReplace = (overrides: Partial<{ seatedEmpty: boolean }> = {}) =>
    vi.fn<ReplaceSeatPlayerAction>(async (input) => ({
      ok: true as const,
      seat: input.seat,
      playerId: 'player-new',
      nickname: 'Stranger',
      createdPlayer: input.nickname !== null,
      seatedEmpty: overrides.seatedEmpty ?? false,
      externalHudAppended: Object.keys(input.externalHud).length > 0,
      adaptiveInput: adaptiveWire('player-new', input.seat),
    }));

  const openSwap = async (seat: SeatIndex) => {
    fireEvent.click(screen.getByTestId(`seat-${seat}-swap-toggle`));
    return screen.findByTestId(`seat-${seat}-swap`);
  };

  it('offers 플레이어 변경 on every seat, EMPTY ones included', () => {
    renderTable(threeHandedTable(), { replaceSeatPlayer: okReplace(), searchPlayers: roster });

    for (const seat of SEAT_INDEXES) {
      expect(screen.getByTestId(`seat-${seat}-swap-toggle`)).toBeInTheDocument();
    }
  });

  it('disables a player already seated elsewhere and says why', async () => {
    renderTable(threeHandedTable(), { replaceSeatPlayer: okReplace(), searchPlayers: roster });
    await openSwap(0);

    // `player-1` holds seat 1 in this session; `player-new` holds nothing.
    const taken = await screen.findByTestId('seat-0-swap-match-player-1');
    expect(taken).toBeDisabled();
    expect(screen.getByTestId('seat-0-swap-match-player-1-rejection')).toHaveTextContent(
      PLAYER_SWAP_REJECTION_LABEL.ALREADY_SEATED,
    );
    expect(screen.getByTestId('seat-0-swap-match-player-new')).toBeEnabled();
  });

  it('asks for a starting stack ONLY when the seat is empty', async () => {
    renderTable(threeHandedTable(), { replaceSeatPlayer: okReplace(), searchPlayers: roster });

    await openSwap(0);
    expect(screen.queryByTestId('seat-0-swap-stack')).not.toBeInTheDocument();
    expect(screen.getByTestId('seat-0-swap-replace-hint')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('seat-0-swap-close'));

    await openSwap(3);
    expect(screen.getByTestId('seat-3-swap-stack')).toBeInTheDocument();
    expect(screen.queryByTestId('seat-3-swap-replace-hint')).not.toBeInTheDocument();
  });

  it('refuses to submit an empty seat without a positive stack', async () => {
    const replaceSeatPlayer = okReplace({ seatedEmpty: true });
    const syncSessionSeats = vi.fn<SyncSessionSeatsAction>().mockResolvedValue({ ok: true });
    renderTable(threeHandedTable(), { replaceSeatPlayer, syncSessionSeats, searchPlayers: roster });
    await openSwap(3);
    fireEvent.click(screen.getByTestId('seat-3-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-3-swap-nickname'), {
      target: { value: 'Stranger' },
    });

    expect(screen.getByTestId('seat-3-swap-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('seat-3-swap-stack'), { target: { value: '0' } });
    expect(screen.getByTestId('seat-3-swap-stack-error')).toHaveTextContent(
      STACK_EDIT_REJECTION_LABEL.NOT_POSITIVE,
    );
    expect(screen.getByTestId('seat-3-swap-submit')).toBeDisabled();

    fireEvent.change(screen.getByTestId('seat-3-swap-stack'), { target: { value: '100' } });
    expect(screen.getByTestId('seat-3-swap-submit')).toBeEnabled();
    fireEvent.click(screen.getByTestId('seat-3-swap-submit'));

    await vi.waitFor(() => expect(replaceSeatPlayer).toHaveBeenCalledTimes(1));
    expect(replaceSeatPlayer.mock.calls[0]![0]!.stack).toBe(Money.fromBB(100));

    // The seat is FILLED on the felt, not merely on the server, and it is NOT 확인 필요 —
    // the user just counted that stack (ADR-0073/WP-2).
    await vi.waitFor(() => expect(seatEl(3)).toHaveTextContent('Stranger'));
    expect(seatEl(3)).toHaveTextContent('100 BB');
    expect(seatEl(3)).toHaveAttribute('data-status', 'ACTIVE');
    expect(screen.queryByTestId('seat-3-dirty')).not.toBeInTheDocument();

    // Seat-state persistence keeps working: the write now agrees with the server's row.
    await vi.waitFor(() => expect(syncSessionSeats).toHaveBeenCalledTimes(1));
    expect(syncSessionSeats.mock.calls[0]![0]!.seats.find((seat) => seat.seat === 3)).toEqual({
      seat: 3,
      occupancy: 'ACTIVE',
      playerId: 'player-new',
      stack: Money.fromBB(100),
      // Seating an EMPTY seat is not dirty — the stack in the request is the number the
      // user just counted — and the persisted flag says so too (ADR-0078b).
      stackUnverified: false,
    });
  });

  it('OMITS a blank HUD field rather than sending it as 0', async () => {
    const replaceSeatPlayer = okReplace();
    renderTable(threeHandedTable(), { replaceSeatPlayer, searchPlayers: roster });
    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), {
      target: { value: 'Stranger' },
    });
    fireEvent.change(screen.getByTestId('seat-0-swap-hud-VPIP'), { target: { value: '25' } });
    // PFR is deliberately left blank, and WSD is filled with whitespace only.
    fireEvent.change(screen.getByTestId('seat-0-swap-hud-WSD'), { target: { value: '   ' } });

    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    await vi.waitFor(() => expect(replaceSeatPlayer).toHaveBeenCalledTimes(1));
    const sent = replaceSeatPlayer.mock.calls[0]![0]!;
    expect(sent.externalHud).toEqual({ VPIP: '25' });
    expect(Object.keys(sent.externalHud)).not.toContain('PFR');
    expect(Object.keys(sent.externalHud)).not.toContain('WSD');
    // An occupied seat is replaced, never given a made-up stack.
    expect(sent.stack).toBeNull();
    expect(sent.playerId).toBeNull();
    expect(sent.nickname).toBe('Stranger');
  });

  it('marks a replaced seat 확인 필요 and relabels it with the nickname the SERVER resolved', async () => {
    renderTable(threeHandedTable(), {
      replaceSeatPlayer: okReplace(),
      searchPlayers: roster,
    });
    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), { target: { value: 'x' } });

    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    expect(await screen.findByTestId('seat-0-dirty')).toBeInTheDocument();
    expect(seatEl(0)).toHaveTextContent('Stranger');
    // The panel closes itself on success rather than leaving a stale form open.
    expect(screen.queryByTestId('seat-0-swap')).not.toBeInTheDocument();
  });

  it('shows a refusal verbatim and changes nothing', async () => {
    const replaceSeatPlayer = vi.fn<ReplaceSeatPlayerAction>().mockResolvedValue({
      ok: false,
      code: 'PLAYER_ALREADY_SEATED',
      message: 'Stranger already occupies seat 2 in this session',
    });
    renderTable(threeHandedTable(), { replaceSeatPlayer, searchPlayers: roster });
    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), { target: { value: 'x' } });

    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    const error = await screen.findByTestId('seat-0-swap-error');
    expect(error).toHaveTextContent('PLAYER_ALREADY_SEATED');
    expect(error).toHaveTextContent('already occupies seat 2');
    expect(screen.queryByTestId('seat-0-dirty')).not.toBeInTheDocument();
    expect(seatEl(0)).toHaveTextContent('Player 1');
  });
});

/**
 * Review round R1. Four defects and their fixes, each asserted against the behaviour a user
 * would see rather than against the mechanism:
 *
 * - ADR-0078(b): the 확인 필요 mark is persisted and restored, so a reload never presents money
 *   nobody has confirmed as though somebody had.
 * - ADR-0078(c): a rebase that moved the button SAYS where it went.
 * - ADR-0079: `새 플레이어 추가` means new, the refusal points at the picker, and what the
 *   server actually did — created somebody, or reused them — is reported.
 * - The `skipped_hands` audit is the only record that a hand was skipped; a failed write is
 *   shown rather than swallowed.
 */
describe('TableRoot — review round R1', () => {
  const threeHanded = () => makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
  const okSync = () => vi.fn<SyncSessionSeatsAction>().mockResolvedValue({ ok: true });

  const roster: SearchPlayersAction = async () => ({
    ok: true,
    matches: [{ id: 'player-new', nickname: 'Stranger', kind: 'BROWSE', hasExternalHud: true }],
  });

  const okReplace = (overrides: Partial<{ seatedEmpty: boolean }> = {}) =>
    vi.fn<ReplaceSeatPlayerAction>(async (input) => ({
      ok: true as const,
      seat: input.seat,
      playerId: 'player-new',
      nickname: 'Stranger',
      createdPlayer: input.nickname !== null,
      seatedEmpty: overrides.seatedEmpty ?? false,
      externalHudAppended: Object.keys(input.externalHud).length > 0,
      adaptiveInput: adaptiveWire('player-new', input.seat),
    }));

  const openSwap = async (seat: SeatIndex) => {
    fireEvent.click(screen.getByTestId(`seat-${seat}-swap-toggle`));
    return screen.findByTestId(`seat-${seat}-swap`);
  };

  /* --- ADR-0078(b): the dirty mark survives a reload ---------------------- */

  it('restores 확인 필요 from the stored flag, so a reload does not lose the warning', () => {
    renderTable(threeHanded(), { seatStackUnverified: { 1: true } });

    // Exactly the seats the flag named, and no others: an absent entry means CONFIRMED.
    expect(screen.getByTestId('seat-1-dirty')).toHaveTextContent(SEAT_DIRTY_BADGE);
    expect(seatEl(1)).toHaveAttribute('data-dirty', 'true');
    expect(seatEl(0)).toHaveAttribute('data-dirty', 'false');
    expect(seatEl(2)).toHaveAttribute('data-dirty', 'false');
  });

  it('sends stackUnverified on EVERY seat of a sync, taken from the store rather than invented', async () => {
    const syncSessionSeats = okSync();
    renderTable(threeHanded(), { syncSessionSeats });

    // A quick next hand leaves every dealt-in, unfolded seat unverified (ADR-0074) — and the
    // whole point of (b) is that the flag now travels with the number it is about.
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('skip-hand'));

    await vi.waitFor(() => expect(syncSessionSeats).toHaveBeenCalledTimes(1));
    const sent = syncSessionSeats.mock.calls[0]![0]!;
    expect(sent.seats).toHaveLength(6);
    // Present on all six, never omitted for a seat the sync was not about.
    for (const seat of sent.seats) expect(typeof seat.stackUnverified).toBe('boolean');
    const unverified = sent.seats.filter((seat) => seat.stackUnverified).map((seat) => seat.seat);
    expect(unverified.sort()).toEqual([0, 1, 2]);

    // Stating one seat's stack clears exactly that seat's flag on the NEXT write.
    fireEvent.click(screen.getByTestId('seat-1-stack'));
    const input = screen.getByTestId('seat-1-stack-input');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.waitFor(() => expect(syncSessionSeats).toHaveBeenCalledTimes(2));
    const second = syncSessionSeats.mock.calls[1]![0]!;
    expect(second.seats.find((seat) => seat.seat === 1)!.stackUnverified).toBe(false);
    expect(second.seats.find((seat) => seat.seat === 0)!.stackUnverified).toBe(true);
  });

  /* --- ADR-0078(c): a button that moved says so --------------------------- */

  it('names the seat the button moved to when a rebase advanced it', () => {
    // The button seat is sat out mid-hand, so the deal-time rule (ADR-0058c) advances the
    // button off it. That rule is unchanged; what changes is that it is no longer silent.
    renderTable(makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 2 }));
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('seat-2-occupancy-toggle'));

    const notice = screen.getByTestId('hand-rebased-notice');
    const movedTo = notice.getAttribute('data-button-moved-to');
    expect(movedTo).not.toBe('');
    expect(notice).toHaveTextContent(HAND_REBASED_NOTICE);
    expect(notice).toHaveTextContent(seatLabel(Number(movedTo)));
  });

  it('says only that the hand was rebuilt when the button did not move', () => {
    // Seat 1 is neither the button nor hero: the re-deal keeps the button where it was, and
    // the notice stays exactly the sentence it always was.
    renderTable(makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }));
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('seat-1-occupancy-toggle'));

    const notice = screen.getByTestId('hand-rebased-notice');
    expect(notice).toHaveAttribute('data-button-moved-to', '');
    expect(notice).toHaveTextContent(HAND_REBASED_NOTICE);
    expect(notice.textContent).not.toContain('버튼이');
  });

  /* --- ADR-0079: "new" means new ------------------------------------------ */

  it('sends requireNew from 새 플레이어 추가', async () => {
    const replaceSeatPlayer = okReplace();
    renderTable(threeHanded(), { replaceSeatPlayer, searchPlayers: roster });

    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), { target: { value: 'Nobody' } });
    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    await vi.waitFor(() => expect(replaceSeatPlayer).toHaveBeenCalledTimes(1));
    expect(replaceSeatPlayer.mock.calls[0]![0]!.requireNew).toBe(true);
    expect(replaceSeatPlayer.mock.calls[0]![0]!.nickname).toBe('Nobody');
  });

  it('never sends requireNew from the picker — reuse-by-id is unchanged', async () => {
    const replaceSeatPlayer = okReplace();
    renderTable(threeHanded(), { replaceSeatPlayer, searchPlayers: roster });

    await openSwap(1);
    await screen.findByTestId('seat-1-swap-match-player-new');
    fireEvent.click(screen.getByTestId('seat-1-swap-match-player-new'));
    fireEvent.click(screen.getByTestId('seat-1-swap-submit'));

    await vi.waitFor(() => expect(replaceSeatPlayer).toHaveBeenCalledTimes(1));
    expect(replaceSeatPlayer.mock.calls[0]![0]!.requireNew).toBe(false);
    expect(replaceSeatPlayer.mock.calls[0]![0]!.playerId).toBe('player-new');
  });

  it('turns PLAYER_EXISTS into the picker, pre-searched, instead of a dead end', async () => {
    const replaceSeatPlayer = vi.fn<ReplaceSeatPlayerAction>().mockResolvedValue({
      ok: false,
      code: 'PLAYER_EXISTS',
      message: '"Stranger" (player-new) already exists; pick them from the player list',
    });
    renderTable(threeHanded(), { replaceSeatPlayer, searchPlayers: roster });

    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), {
      target: { value: 'Stranger' },
    });
    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    // The guidance says what to do; the server's own verdict is kept beside it, verbatim.
    expect(await screen.findByTestId('seat-0-swap-exists')).toHaveTextContent(
      PLAYER_EXISTS_GUIDANCE,
    );
    expect(screen.getByTestId('seat-0-swap-error')).toHaveTextContent('PLAYER_EXISTS');
    expect(screen.getByTestId('seat-0-swap-error')).toHaveTextContent('already exists');

    // ...and the user is already standing in front of the player they named.
    expect(screen.getByTestId('seat-0-swap-mode-pick')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('seat-0-swap-search')).toHaveValue('Stranger');
    expect(await screen.findByTestId('seat-0-swap-match-player-new')).toBeEnabled();

    // Nothing was applied: the seat is untouched and the panel is still open.
    expect(seatEl(0)).not.toHaveTextContent('Stranger');
    expect(screen.getByTestId('seat-0-swap')).toBeInTheDocument();
  });

  it('reads createdPlayer and says a new player was made', async () => {
    renderTable(threeHanded(), { replaceSeatPlayer: okReplace(), searchPlayers: roster });

    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), { target: { value: 'Nobody' } });
    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    // The nickname is the SERVER's, not the one that was typed — that is the whole reason to
    // report the outcome rather than assume it.
    expect(await screen.findByTestId('player-swap-notice')).toHaveTextContent(
      playerSeatedCreatedNotice('Stranger'),
    );
    fireEvent.click(screen.getByTestId('player-swap-notice-dismiss'));
    expect(screen.queryByTestId('player-swap-notice')).not.toBeInTheDocument();
  });

  it('says an EXISTING player was seated when the server created nobody', async () => {
    renderTable(threeHanded(), { replaceSeatPlayer: okReplace(), searchPlayers: roster });

    await openSwap(1);
    await screen.findByTestId('seat-1-swap-match-player-new');
    fireEvent.click(screen.getByTestId('seat-1-swap-match-player-new'));
    fireEvent.click(screen.getByTestId('seat-1-swap-submit'));

    expect(await screen.findByTestId('player-swap-notice')).toHaveTextContent(
      playerSeatedExistingNotice('Stranger'),
    );
  });

  /* --- a store refusal is not dressed up as a success ---------------------- */

  it('refuses a swap the store would refuse BEFORE it reaches the server', async () => {
    const replaceSeatPlayer = okReplace();
    const syncSessionSeats = okSync();
    renderTable(threeHanded(), { replaceSeatPlayer, syncSessionSeats, searchPlayers: roster });

    // A COMPLETE hand is waiting to be settled, and it dealt seat 0 in. `applyHandResult`
    // writes that seat's stack back at the next deal, so the store refuses to change who is
    // sitting there until it is settled (ADR-0078).
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));

    await openSwap(0);
    fireEvent.click(screen.getByTestId('seat-0-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-0-swap-nickname'), { target: { value: 'Nobody' } });
    fireEvent.click(screen.getByTestId('seat-0-swap-submit'));

    const refusal = await screen.findByTestId('seat-0-swap-error');

    // R1 stopped the silent revert: the sync no longer wrote the store's OLD lineup over the
    // row the server had just written. R2 removes the divergence itself. The store's own
    // question is asked FIRST, so a refused swap makes NO server call — there is no row to
    // diverge from, and no reload needed to reconcile anything.
    expect(replaceSeatPlayer).not.toHaveBeenCalled();
    expect(syncSessionSeats).not.toHaveBeenCalled();

    // The refusal names the exits that actually work in this state, and does NOT send the user
    // to `startHand()` alone — which is the action that cannot succeed here.
    expect(refusal).toHaveTextContent('아직 정산되지 않아');
    expect(refusal).toHaveTextContent('자동 리바이');
    expect(refusal).toHaveTextContent('빈 좌석에 플레이어를');
    // The post-write fallback message is still exactly what it was, for a divergence nobody
    // has predicted; it is simply no longer on the reachable path.
    expect(seatPlayerStoreRefusedNotice('HAND_ALREADY_FINISHED', 'x')).toContain(
      'HAND_ALREADY_FINISHED: x',
    );

    // Nothing was applied and nothing was closed.
    expect(screen.getByTestId('seat-0-swap')).toBeInTheDocument();
    expect(screen.queryByTestId('player-swap-notice')).not.toBeInTheDocument();
    expect(seatEl(0)).not.toHaveTextContent('Stranger');
  });

  it('still calls the server for a seat the finished hand never dealt in', async () => {
    const replaceSeatPlayer = okReplace();
    renderTable(threeHanded(), { replaceSeatPlayer, searchPlayers: roster });

    // Negative control for the guard above: the rule is narrow on purpose. Only a seat the
    // unsettled hand DEALT IN is guarded, so a seat it never visited must still go through —
    // a pre-check that refused everything would be a second, stricter authority than the
    // store, which is exactly what this must not become. Seat 2 was sat out before the deal,
    // so the finished hand never dealt it in.
    fireEvent.click(screen.getByTestId('seat-2-occupancy-toggle'));
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-F'));

    await openSwap(2);
    fireEvent.click(screen.getByTestId('seat-2-swap-mode-new'));
    fireEvent.change(screen.getByTestId('seat-2-swap-nickname'), { target: { value: 'Nobody' } });
    fireEvent.click(screen.getByTestId('seat-2-swap-submit'));

    await vi.waitFor(() => expect(replaceSeatPlayer).toHaveBeenCalledTimes(1));
  });

  /* --- the settlement dead end names a door that is actually open --------- */

  it('answers NOT_ENOUGH_PLAYERS on an unsettled hand with an exit that works', () => {
    renderTable(makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }));

    // A hand that finished and is still waiting for `startHand` to settle it...
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));
    // ...and a lineup the next deal cannot use.
    fireEvent.click(screen.getByTestId('seat-1-occupancy-toggle'));
    fireEvent.click(screen.getByTestId('seat-2-occupancy-toggle'));
    fireEvent.click(screen.getByTestId('start-hand'));

    // The engine's own refusal, untouched and still on screen verbatim.
    expect(screen.getByTestId('engine-error')).toHaveTextContent('NOT_ENOUGH_PLAYERS');

    // And beside it, the thing neither engine message says: what the user can actually press.
    const guidance = screen.getByTestId('settlement-blocked-guidance');
    expect(guidance).toHaveTextContent('자동 리바이');
    expect(guidance).toHaveTextContent('플레이어 변경');
    expect(guidance).toHaveTextContent('핸드 시작');
  });

  it('answers a refused seat correction on an unsettled hand the same way', () => {
    renderTable(makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }));

    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));

    // The correction the store refuses with HAND_ALREADY_FINISHED, whose own message sends the
    // user to `startHand` — the action that, in the busted-seat version of this state, cannot
    // succeed. The engine text is unchanged; the guidance is what carries the way out.
    fireEvent.click(screen.getByTestId('seat-1-stack'));
    const input = screen.getByTestId('seat-1-stack-input');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('engine-error')).toHaveTextContent('HAND_ALREADY_FINISHED');
    const guidance = screen.getByTestId('settlement-blocked-guidance');
    expect(guidance).toHaveTextContent('핸드 시작');
    expect(guidance).toHaveTextContent('자동 리바이');
  });

  it('names the busted seats when the view has any, and stays silent when it has none', () => {
    renderTable(makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 }));
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('seat-1-occupancy-toggle'));
    fireEvent.click(screen.getByTestId('seat-2-occupancy-toggle'));
    fireEvent.click(screen.getByTestId('start-hand'));

    // Nobody busted in a hand everyone folded out of, so no seat is named — the sentence does
    // not invent one to look more helpful.
    expect(screen.getByTestId('settlement-blocked-guidance')).not.toHaveTextContent(
      '지금 칩이 0인 좌석:',
    );
    // ...and when the finished hand's own view does show a seat with nothing in front of it,
    // that seat IS named, because that is the seat to switch auto top-up on for.
    expect(settlementBlockedGuidance('NOT_ENOUGH_PLAYERS', [1])).toContain(
      `지금 칩이 0인 좌석: ${seatLabel(1)}`,
    );
    // No other code claims this state.
    expect(settlementBlockedGuidance('SEAT_OCCUPIED', [1])).toBeNull();
  });

  /* --- the skip audit is not swallowed ------------------------------------ */

  it('shows a failed skipped_hands write instead of swallowing it, and never blocks', async () => {
    const logSkippedHand = vi
      .fn<LogSkippedHandAction>()
      .mockResolvedValue({ ok: false, code: 'DB_ERROR', message: 'disk is full' });
    renderTable(threeHanded(), { logSkippedHand });

    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('skip-hand'));

    const banner = await screen.findByTestId('skip-audit-save-error');
    expect(banner).toHaveTextContent('disk is full');
    // The skip itself already happened and nothing about it is reverted.
    expect(screen.getByTestId('hand-number')).toHaveTextContent('1');
    expect(screen.getByTestId('start-hand')).toBeEnabled();
  });

  it('gives the header hand number a handle of its own', () => {
    renderTable(threeHanded());
    // The number the header has always shown, now reachable without parsing the sentence
    // around it. A quick next hand moves it by exactly one (ADR-0074).
    expect(screen.getByTestId('hand-number')).toHaveTextContent('0');
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('skip-hand'));
    expect(screen.getByTestId('hand-number')).toHaveTextContent('1');
  });

  /* --- SeatCard is a div[role=button]: it must still activate from the keyboard --- */

  it('selects a seat with Enter and with Space, as a real button would', () => {
    renderTable(threeHanded());

    seatEl(1).focus();
    fireEvent.keyDown(seatEl(1), { key: 'Enter' });
    expect(seatEl(1)).toHaveAttribute('data-selected', 'true');

    fireEvent.keyDown(seatEl(2), { key: ' ' });
    expect(seatEl(2)).toHaveAttribute('data-selected', 'true');
    expect(seatEl(1)).toHaveAttribute('data-selected', 'false');

    // A key that is not an activation does nothing, and an EMPTY seat is not activatable.
    fireEvent.keyDown(seatEl(0), { key: 'x' });
    expect(seatEl(0)).toHaveAttribute('data-selected', 'false');
    fireEvent.keyDown(seatEl(4), { key: 'Enter' });
    expect(seatEl(4)).toHaveAttribute('data-selected', 'false');
  });
});
