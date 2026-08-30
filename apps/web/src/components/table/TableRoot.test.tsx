import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Money, asId, sequentialIdFactory } from '@gto-self/shared';
import type { HandId, IdFactory } from '@gto-self/shared';
import { SEAT_INDEXES, startHand, toView } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, HandView, SeatIndex, TableState } from '@gto-self/poker-core';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import type {
  SeatAutoTopUpValue,
  UpdateSeatAutoTopUpAction,
  UpdateSeatAutoTopUpResult,
} from '../../lib/session-setup/contract.js';
import { STREET_LABEL } from '../../lib/table/copy.js';
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
  readonly autoTopUp?: AutoTopUpPolicy | null;
  readonly seatAutoTopUp?: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
  readonly updateSeatAutoTopUp?: UpdateSeatAutoTopUpAction;
}

function renderTable(table: TableState, overrides: RenderOverrides = {}) {
  return render(
    <TableRoot
      sessionId="session-1"
      label="Test session"
      table={table}
      autoTopUp={overrides.autoTopUp ?? null}
      seatAutoTopUp={overrides.seatAutoTopUp ?? {}}
      nicknames={testNicknames(SEAT_INDEXES)}
      warnings={[]}
      loadPlayerProfile={overrides.loadPlayerProfile ?? noProfile}
      updateSeatAutoTopUp={overrides.updateSeatAutoTopUp}
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
        notes: [],
        warnings: [],
      },
    });

    renderTable(table, { loadPlayerProfile });
    // No hand is live and nothing is selected, so the column leads with the log
    // (`lib/table/rightPanel.ts`). The strategy panel belongs to hero's own decision.
    expect(panelKind()).toBe('HISTORY');
    expect(screen.queryByTestId('strategy-placeholder')).not.toBeInTheDocument();

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
    expect(screen.getByTestId('strategy-placeholder')).toBeInTheDocument();
    // The log never leaves the column; it simply stops leading it.
    expect(screen.getByTestId('action-history')).toBeInTheDocument();
  });

  it('leads with the action history when hero is not to act and nothing is selected', () => {
    renderTable(headsUp());
    fireEvent.click(screen.getByTestId('start-hand'));
    fireEvent.click(screen.getByTestId('dock-C'));

    expect(seatEl(0)).toHaveAttribute('data-actor', 'false');
    expect(panelKind()).toBe('HISTORY');
    expect(screen.queryByTestId('strategy-placeholder')).not.toBeInTheDocument();
  });

  /**
   * The documented overlap (`lib/table/rightPanel.ts`): an explicit selection outranks
   * "hero is to act", and only `Esc` gives the column back.
   */
  it('keeps an explicitly selected seat visible while hero is to act, until Esc', async () => {
    renderTable(headsUp(), { loadPlayerProfile: profileOf('Player 2') });
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(panelKind()).toBe('STRATEGY');

    fireEvent.click(seatEl(1));

    expect(panelKind()).toBe('PLAYER');
    expect(await screen.findByTestId('player-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('strategy-placeholder')).not.toBeInTheDocument();
    // Hero is still the actor: the engine has not moved, and the panel has not either.
    expect(seatEl(0)).toHaveAttribute('data-actor', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('player-profile')).not.toBeInTheDocument();
    expect(panelKind()).toBe('STRATEGY');
  });

  it('names no strategy number, frequency or percentage at all', () => {
    renderTable(headsUp());
    fireEvent.click(screen.getByTestId('start-hand'));

    const text = screen.getByTestId('strategy-placeholder').textContent ?? '';
    expect(text).toContain('전략 데이터는 아직 준비되지 않았습니다.');
    expect(text).toContain('Phase 9');
    expect(text).toContain('Phase 10');
    expect(text).not.toContain('%');
    // `CLAUDE.md` rule 2: the ONLY numerals here are the two roadmap references.
    expect(text.replace('Phase 9', '').replace('Phase 10', '')).not.toMatch(/\d/u);
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
