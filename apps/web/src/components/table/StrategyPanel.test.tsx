import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Money, asId, parseCards, sequentialIdFactory } from '@gto-self/shared';
import type { Card, HandId } from '@gto-self/shared';
import { applyCommand, startHand as engineStartHand } from '@gto-self/poker-core';
import type { Hand, HandCommand, HandState, SeatIndex, TableState } from '@gto-self/poker-core';
import { computeStrategy, type StrategyCompute } from '../../lib/table/strategy.js';
import { makeTestTable } from '../../lib/table/testTable.js';
import { StrategyPanel } from './StrategyPanel.js';
import { TableStoreProvider, useTableStoreApi } from './TableStoreProvider.js';
import type { TableStore } from '../../lib/table/tableStore.js';

/**
 * `StrategyPanel` against real store state — never a hand-written model literal.
 *
 * Every fixture below is built by driving the REAL engine through the REAL store, so what
 * is asserted is that the panel renders `@gto-self/strategy-core`'s answer for a spot the
 * poker engine actually produced. The expected numbers are also computed independently,
 * from `computeStrategy` on the same state, and cross-checked against hard structural
 * invariants (integer percents, multiples of 5, summing to 100) so nothing here can pass
 * by simply mirroring whatever the panel happened to render.
 *
 * The scheduling contract is tested too, because it is the reason this component is shaped
 * the way it is: the analysis runs in a timer AFTER the commit, so a re-render with no state
 * transition must not recompute, and transitions that supersede a SCHEDULED analysis must
 * stop it from ever starting. The tests below also pin the limit of that mechanism — a
 * computation that has started always completes, because there is no yield point to
 * interrupt — so the component's doc-comment cannot drift back into claiming more.
 */

const cards = (text: string): readonly Card[] => {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};

/** Six seats, button on seat 0 — so SB=1, BB=2, UTG=3, HJ=4, CO=5 and BTN=0. */
const sixMax = (heroSeat: SeatIndex): TableState =>
  makeTestTable({ seats: [0, 1, 2, 3, 4, 5], heroSeat, buttonSeat: 0 });

/**
 * The engine's own answer for the same drive, computed with an identical id factory. The
 * DOM is asserted against THIS.
 */
function expectedModel(table: TableState, commands: readonly HandCommand[], heroSeat: SeatIndex) {
  const ids = sequentialIdFactory('test');
  const started = engineStartHand(table, { handId: asId<'Hand'>(ids.next()) as HandId }, ids);
  if (!started.ok) throw new Error(started.error.message);
  let hand: Hand = started.value;
  for (const command of commands) {
    const next = applyCommand(hand, command, ids);
    if (!next.ok) throw new Error(`${next.error.code}: ${next.error.message}`);
    hand = next.value;
  }
  const model = computeStrategy(hand.state, heroSeat);
  if (model.kind !== 'READY') throw new Error(`fixture is not READY: ${JSON.stringify(model)}`);
  return model;
}

let captured: TableStore | null = null;
function GrabStore() {
  captured = useTableStoreApi();
  return null;
}

/** A parent with state of its own, so an UNRELATED re-render can be forced on demand. */
function Harness({ compute }: { readonly compute?: StrategyCompute }) {
  const [bumps, setBumps] = useState(0);
  return (
    <>
      <button type="button" data-testid="bump" onClick={() => setBumps((n) => n + 1)}>
        {bumps}
      </button>
      <StrategyPanel compute={compute} />
    </>
  );
}

function mountPanel(table: TableState, compute?: StrategyCompute): TableStore {
  captured = null;
  render(
    <TableStoreProvider init={{ sessionId: 'session-1', table, ids: sequentialIdFactory('test') }}>
      <GrabStore />
      <Harness compute={compute} />
    </TableStoreProvider>,
  );
  if (captured === null) throw new Error('the store was not captured');
  return captured;
}

/** Runs the store drive, then lets the scheduled analysis land. */
async function drive(store: TableStore, commands: readonly HandCommand[]): Promise<void> {
  act(() => {
    store.getState().startHand();
    for (const command of commands) store.getState().apply(command);
  });
  const error = store.getState().lastError;
  if (error !== null) throw new Error(`${error.code}: ${error.message}`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
  });
}

const panel = (): HTMLElement => screen.getByTestId('strategy-panel');
const rowPercent = (kind: string): number =>
  Number(screen.getByTestId(`strategy-action-${kind}`).getAttribute('data-percent'));

/** BTN opens the pot with no prior action: fold UTG, HJ and CO round to hero on the button. */
const BTN_RFI: readonly HandCommand[] = [
  { kind: 'SET_HOLE_CARDS', seat: 0, cards: cards('Ah Kh'), revealed: false },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
];

/** Hero in the big blind facing a 2.5 BB button open with A5s — a genuine three-way mix. */
const BB_VS_BTN_OPEN: readonly HandCommand[] = [
  { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('Ah 5h'), revealed: false },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
  { kind: 'FOLD' },
];

/** The same line with AKs, called to a flop, checked to the button, who bets 3 BB. */
const FLOP_FACING_BET: readonly HandCommand[] = [
  { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('Ah Kh'), revealed: false },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
  { kind: 'FOLD' },
  { kind: 'CALL' },
  { kind: 'DEAL_BOARD', cards: cards('Qh 7s 2d') },
  { kind: 'CHECK' },
  { kind: 'BET', toAmount: Money.fromBB(3) },
];

describe('StrategyPanel — preflop', () => {
  it('renders the reference engine’s own RFI answer for a 6-max button open', async () => {
    const table = sixMax(0);
    const expected = expectedModel(table, BTN_RFI, 0);
    expect(expected.family).toBe('RFI');

    const store = mountPanel(table);
    await drive(store, BTN_RFI);

    expect(panel()).toHaveAttribute('data-state', 'READY');
    expect(panel()).toHaveAttribute('data-street', 'PREFLOP');
    expect(panel()).toHaveAttribute('data-family', 'RFI');
    expect(screen.getByTestId('strategy-engine-label')).toHaveTextContent('기본전략 · REFERENCE');
    expect(screen.getByTestId('strategy-position')).toHaveTextContent('BTN');
    expect(screen.getByTestId('strategy-hand-class')).toHaveTextContent(expected.handClassKey);

    // Every action the engine emitted, and nothing else.
    for (const action of expected.actions) {
      expect(rowPercent(action.kind)).toBe(action.percent);
      expect(screen.getByTestId(`strategy-frequency-${action.kind}`)).toHaveTextContent(
        `${action.percent}%`,
      );
    }
    expect(screen.getByTestId('strategy-actions').children).toHaveLength(
      expected.actions.length,
    );

    // The sizing is a raise-TO in BB, and it is the engine's number.
    expect(expected.sizing).not.toBeNull();
    expect(screen.getByTestId('strategy-sizing')).toHaveTextContent(
      `추천 사이즈 OPEN TO ${Money.formatBB(expected.sizing!.toAmountMbb, {
        maxDecimals: 3,
        unit: true,
      })}`,
    );

    // Provenance is shown as itself; the reserved solved-output label appears nowhere.
    expect(panel()).toHaveAttribute('data-quality', expected.quality);
    expect(screen.getByTestId('strategy-quality')).toHaveTextContent(expected.quality);
    expect(panel().textContent ?? '').not.toContain('GTO');
  });

  it('shows a fold / call / 3BET mix in full, with the highest frequency badged 추천', async () => {
    const table = sixMax(2);
    const expected = expectedModel(table, BB_VS_BTN_OPEN, 2);
    expect(expected.family).toBe('VS_OPEN');
    // The premise of this test: a genuinely mixed answer, not a pure one.
    expect(expected.actions.length).toBeGreaterThan(2);

    const store = mountPanel(table);
    await drive(store, BB_VS_BTN_OPEN);

    expect(panel()).toHaveAttribute('data-family', 'VS_OPEN');
    expect(rowPercent('FOLD')).toBe(35);
    expect(rowPercent('CALL')).toBe(35);
    expect(rowPercent('RAISE')).toBe(30);
    // The aggressive row is named from the spot the engine classified.
    expect(screen.getByTestId('strategy-action-RAISE')).toHaveAttribute('data-name', '3BET');

    // Quantization (ADR-0056): whole 5-point steps summing to exactly 100.
    const percents = expected.actions.map((action) => action.percent);
    for (const percent of percents) expect(percent % 5).toBe(0);
    expect(percents.reduce((a, b) => a + b, 0)).toBe(100);

    // PRIMARY is the highest frequency and is labelled 추천 — never "correct".
    const primary = screen.getByTestId('strategy-primary-badge');
    expect(primary).toHaveTextContent('추천');
    expect(primary.closest('li')).toHaveAttribute('data-kind', expected.primary.kind);
    expect(Math.max(...percents)).toBe(expected.primary.percent);
    expect(panel().textContent ?? '').not.toContain('정답');

    // Facing a bet: pot odds are shown, and they are the engine's ratio.
    expect(expected.metrics.potOdds).not.toBeNull();
    expect(screen.getByTestId('strategy-pot-odds')).toHaveTextContent(
      `${Math.round(expected.metrics.potOdds! * 100)}%`,
    );

    // ACTUAL and MODEL side by side (`docs/UX.md`): the real effective stack, the real
    // open size, and the bucket the policy looked up.
    expect(screen.getByTestId('strategy-actual-stack')).toHaveTextContent(
      Money.formatBB(expected.actual.effectiveStackMbb, { maxDecimals: 3, unit: true }),
    );
    expect(screen.getByTestId('strategy-actual-aggression')).toHaveTextContent('BTN 2.5 BB');
    expect(screen.getByTestId('strategy-model-bucket')).toHaveTextContent('80-119 BB');
  });
});

describe('StrategyPanel — postflop', () => {
  it('shows equity, pot odds and a pot-fraction sizing when hero faces a flop bet', async () => {
    const table = sixMax(2);
    const expected = expectedModel(table, FLOP_FACING_BET, 2);
    expect(expected.street).toBe('FLOP');
    expect(expected.family).toBe('FACING_BET');

    const store = mountPanel(table);
    await drive(store, FLOP_FACING_BET);

    expect(panel()).toHaveAttribute('data-state', 'READY');
    expect(panel()).toHaveAttribute('data-street', 'FLOP');
    expect(panel()).toHaveAttribute('data-family', 'FACING_BET');
    expect(panel()).toHaveAttribute('data-confidence', expected.confidence ?? '');

    for (const action of expected.actions) {
      expect(rowPercent(action.kind)).toBe(action.percent);
    }

    // Equity is a float from the engine, rendered as a WHOLE percent — no fabricated
    // precision — and its method is named, because an estimate is not an enumeration.
    expect(expected.metrics.equity).not.toBeNull();
    const equity = screen.getByTestId('strategy-equity');
    expect(equity).toHaveTextContent(`${Math.round(expected.metrics.equity! * 100)}%`);
    expect(equity.textContent ?? '').not.toMatch(/\d+\.\d/u);

    expect(screen.getByTestId('strategy-pot-odds')).toHaveTextContent(
      `${Math.round(expected.metrics.potOdds! * 100)}%`,
    );
    expect(screen.getByTestId('strategy-spr')).toHaveTextContent(
      `SPR ${expected.metrics.spr!.toFixed(1)}`,
    );

    // Postflop sizing is a bucket AND an amount, per `docs/UX.md`'s panel spec.
    expect(expected.sizing?.potFractionPercent).not.toBeNull();
    expect(screen.getByTestId('strategy-sizing')).toHaveTextContent(
      `추천 사이즈 ${expected.sizing!.potFractionPercent}% POT · ${Money.formatBB(
        expected.sizing!.toAmountMbb,
        { maxDecimals: 3, unit: true },
      )}`,
    );

    // The environment caveat rides INLINE and never as a modal (`docs/UX.md`).
    expect(screen.getByTestId('strategy-environment')).toHaveAttribute(
      'data-status',
      expected.environment.status,
    );
  });
});

/**
 * R1 regression. `StrategyActionRow` dropped the engine's `isAllIn` and `StrategySizingView`
 * computed `allIn` and never rendered it, so a recommended shove came out as an ordinary
 * `RAISE TO 9.5 BB` — the panel said the size and hid the commitment.
 */
describe('StrategyPanel — a recommended all-in says so', () => {
  /** Twelve-BB stacks, so the flop SPR is inside the model's all-in gate. */
  const shortSixMax = (heroSeat: SeatIndex): TableState =>
    makeTestTable({
      seats: [0, 1, 2, 3, 4, 5],
      heroSeat,
      buttonSeat: 0,
      stack: Money.fromBB(12),
    });

  /** Hero (BB) flops a set of sevens on `Kd 7d 2c` and faces a 3 BB bet with 9.5 behind. */
  const SHORT_FLOP_SET: readonly HandCommand[] = [
    { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('7h 7s'), revealed: false },
    { kind: 'FOLD' },
    { kind: 'FOLD' },
    { kind: 'FOLD' },
    { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
    { kind: 'FOLD' },
    { kind: 'CALL' },
    { kind: 'DEAL_BOARD', cards: cards('Kd 7d 2c') },
    { kind: 'CHECK' },
    { kind: 'BET', toAmount: Money.fromBB(3) },
  ];

  it('renders ALL IN on the action row and on the sizing line, not a bare raise-TO', async () => {
    const table = shortSixMax(2);
    const expected = expectedModel(table, SHORT_FLOP_SET, 2);
    // The premise: the engine really did recommend committing the stack here.
    const shove = expected.actions.find((action) => action.isAllIn && action.kind !== 'FOLD');
    expect(shove).toBeDefined();
    expect(expected.sizing?.allIn).toBe(true);

    const store = mountPanel(table);
    await drive(store, SHORT_FLOP_SET);

    const amount = screen.getByTestId(`strategy-amount-${shove!.kind}`);
    expect(amount).toHaveAttribute('data-all-in', 'true');
    expect(amount).toHaveTextContent(
      `ALL IN · ${Money.formatBB(shove!.toAmountMbb!, { maxDecimals: 3, unit: true })}`,
    );
    // The misleading wording is gone from the row.
    expect(amount.textContent ?? '').not.toMatch(/^TO /u);

    const sizing = screen.getByTestId('strategy-sizing');
    expect(sizing).toHaveAttribute('data-all-in', 'true');
    expect(sizing).toHaveTextContent(
      `추천 사이즈 ALL IN · ${Money.formatBB(expected.sizing!.toAmountMbb, {
        maxDecimals: 3,
        unit: true,
      })}`,
    );
    // Korean frame, Latin poker term, and never the reserved label.
    expect(panel().textContent ?? '').toContain('추천 사이즈');
    expect(panel().textContent ?? '').not.toContain('GTO');
  });

  it('leaves an ordinary sizing alone: TO on the row, the pot rung on the sizing line', async () => {
    const table = sixMax(2);
    const expected = expectedModel(table, FLOP_FACING_BET, 2);
    expect(expected.sizing?.allIn).toBe(false);

    const store = mountPanel(table);
    await drive(store, FLOP_FACING_BET);

    const aggressive = expected.actions.find(
      (action) => action.toAmountMbb !== null && action.kind !== 'CALL',
    );
    expect(aggressive).toBeDefined();
    const amount = screen.getByTestId(`strategy-amount-${aggressive!.kind}`);
    expect(amount).toHaveAttribute('data-all-in', 'false');
    expect(amount).toHaveTextContent(
      `TO ${Money.formatBB(aggressive!.toAmountMbb!, { maxDecimals: 3, unit: true })}`,
    );
    expect(amount.textContent ?? '').not.toContain('ALL IN');
    expect(screen.getByTestId('strategy-sizing')).toHaveAttribute('data-all-in', 'false');
  });
});

describe('StrategyPanel — refusals', () => {
  it('refuses honestly, with the engine’s own code and message, before hero’s cards exist', async () => {
    const store = mountPanel(sixMax(0));
    // No `SET_HOLE_CARDS`: hero is on the clock but nobody has said what hero holds.
    await drive(store, [{ kind: 'FOLD' }, { kind: 'FOLD' }, { kind: 'FOLD' }]);

    expect(panel()).toHaveAttribute('data-state', 'REFUSED');
    expect(screen.getByTestId('strategy-refusal')).toHaveAttribute(
      'data-code',
      'INVALID_HERO_CARDS',
    );
    expect(screen.getByTestId('strategy-refusal')).toHaveTextContent(
      '내 카드를 입력하면 기본전략을 계산합니다.',
    );
    // The engine's own message survives verbatim (`CLAUDE.md` rule 3).
    expect(screen.getByTestId('strategy-refusal-detail')).toHaveTextContent('INVALID_HERO_CARDS');
    expect(screen.getByTestId('strategy-refusal-detail')).toHaveTextContent("hero's two cards");
    // No frequency, no action row, nothing invented to fill the gap.
    expect(screen.queryByTestId('strategy-actions')).not.toBeInTheDocument();
    expect(panel().textContent ?? '').not.toContain('%');
  });

  it('refuses rather than answering about a seat that is not on the clock', async () => {
    const store = mountPanel(sixMax(0));
    // Hero is the button; UTG is the seat the engine put on the clock.
    await drive(store, [{ kind: 'SET_HOLE_CARDS', seat: 0, cards: cards('Ah Kh'), revealed: false }]);

    expect(panel()).toHaveAttribute('data-state', 'REFUSED');
    expect(screen.getByTestId('strategy-refusal')).toHaveAttribute('data-code', 'HERO_NOT_ACTOR');
  });

  it('says there is no hand rather than rendering an empty panel', () => {
    mountPanel(sixMax(0));
    expect(panel()).toHaveAttribute('data-state', 'NO_HAND');
    expect(screen.getByTestId('strategy-computing')).toHaveTextContent('진행 중인 핸드가 없습니다.');
  });
});

describe('StrategyPanel — compute scheduling', () => {
  it('does not recompute on a re-render that carried no state transition', async () => {
    const compute = vi.fn<StrategyCompute>((state, heroSeat) => computeStrategy(state, heroSeat));
    const store = mountPanel(sixMax(0), compute);
    await drive(store, BTN_RFI);

    expect(panel()).toHaveAttribute('data-state', 'READY');
    const afterDrive = compute.mock.calls.length;
    expect(afterDrive).toBe(1);

    // Three unrelated parent re-renders. The `Hand` object is unchanged, and object
    // identity IS state identity for this store, so nothing is analysed again.
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByTestId('bump'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(screen.getByTestId('bump')).toHaveTextContent('3');
    expect(compute).toHaveBeenCalledTimes(afterDrive);
    expect(panel()).toHaveAttribute('data-stale', 'false');
  });

  /**
   * The cleanup's cancellation, tested so that it can actually FAIL.
   *
   * The previous version of this test committed five transitions inside one `act()`. React
   * auto-batches those into a SINGLE re-render, so the effect ran once, exactly one timer was
   * ever scheduled, and nothing was ever cancelled — deleting `clearTimeout` did not change
   * the call count. It measured batching and reported it as cancellation.
   *
   * Five separate commits, each with its own effect flush and none allowed to reach a
   * macrotask, is the shape that exercises the cleanup: five timers are scheduled, four are
   * cleared, one runs. It is also the real interaction it stands for — a person acting faster
   * than the analysis can start.
   */
  it('never STARTS an analysis for a state superseded before its timer fired', async () => {
    const seen: HandState[] = [];
    const compute = vi.fn<StrategyCompute>((state, heroSeat) => {
      seen.push(state);
      return computeStrategy(state, heroSeat);
    });
    vi.useFakeTimers();
    try {
      const store = mountPanel(sixMax(0), compute);
      act(() => store.getState().startHand());
      for (const command of BTN_RFI) act(() => store.getState().apply(command));

      // Five states have settled and five analyses have been scheduled; the timer has not run,
      // so NONE of them has started.
      expect(compute).not.toHaveBeenCalled();
      expect(panel()).toHaveAttribute('data-state', 'COMPUTING');

      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Exactly one analysis started, and it is the state actually on screen — the four it
      // passed through were never begun.
      expect(compute).toHaveBeenCalledTimes(1);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toBe(store.getState().hand?.state);
      expect(panel()).toHaveAttribute('data-state', 'READY');
      expect(panel()).toHaveAttribute('data-stale', 'false');
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * The realistic sequence, and the honest one. A person does not commit six actions inside
   * one JavaScript task; the timer fires between most of them. So this drives a mixed
   * sequence — some transitions settle and get analysed, some are superseded inside a single
   * tick — and asserts BOTH halves of the mechanism at once:
   *
   *  - a superseded-while-queued state is never started (the intermediate FOLD below);
   *  - every started computation completes and commits (`starts === completions`), because
   *    `computeStrategy` has no yield point and the timer cannot interrupt it. The panel does
   *    not "cancel work in flight" and this test exists so nobody can claim it does.
   */
  it('analyses each settled state exactly once, and finishes every analysis it starts', async () => {
    let starts = 0;
    let completions = 0;
    const analysed: HandState[] = [];
    const compute = vi.fn<StrategyCompute>((state, heroSeat) => {
      starts += 1;
      const model = computeStrategy(state, heroSeat);
      analysed.push(state);
      completions += 1;
      return model;
    });
    const store = mountPanel(sixMax(0), compute);
    const flush = async (): Promise<void> => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
      });
    };

    // Tick 1: the hand starts and hero's cards go in, then the analysis is allowed to land.
    act(() => {
      store.getState().startHand();
      store.getState().apply({ kind: 'SET_HOLE_CARDS', seat: 0, cards: cards('Ah Kh'), revealed: false });
    });
    await flush();
    expect(starts).toBe(1);
    const afterCards = analysed[0];

    // Tick 2: one fold, allowed to settle. A second, genuinely separate interaction.
    act(() => store.getState().apply({ kind: 'FOLD' }));
    await flush();
    expect(starts).toBe(2);
    expect(analysed[1]).not.toBe(afterCards);

    // Tick 3: two folds inside ONE task — the middle state is superseded while its analysis
    // is still queued, so it is never started.
    act(() => {
      store.getState().apply({ kind: 'FOLD' });
      store.getState().apply({ kind: 'FOLD' });
    });
    await flush();

    expect(starts).toBe(3);
    // Nothing was abandoned mid-flight: every start produced a result.
    expect(completions).toBe(starts);
    expect(analysed).toHaveLength(3);
    // Four states settled across the sequence; three were analysed, and the last analysed
    // state is the one on screen.
    expect(analysed[2]).toBe(store.getState().hand?.state);
    expect(panel()).toHaveAttribute('data-state', 'READY');
    expect(panel()).toHaveAttribute('data-stale', 'false');
    // No state is analysed twice.
    expect(new Set(analysed).size).toBe(analysed.length);
  });

  it('shows the previous answer marked stale while the next one is still scheduled', async () => {
    const store = mountPanel(sixMax(2));
    await drive(store, BB_VS_BTN_OPEN);
    expect(panel()).toHaveAttribute('data-state', 'READY');
    expect(panel()).toHaveAttribute('data-stale', 'false');

    // One more transition, WITHOUT letting the timer fire. The transition is already on
    // screen; the panel keeps the previous answer and says it is out of date rather than
    // going blank or blocking the commit.
    act(() => {
      store.getState().apply({ kind: 'CALL' });
      store.getState().apply({ kind: 'DEAL_BOARD', cards: cards('Qh 7s 2d') });
    });
    expect(panel()).toHaveAttribute('data-stale', 'true');
    expect(screen.getByTestId('strategy-stale')).toHaveTextContent('이전 상황 기준');
    expect(panel()).toHaveAttribute('data-street', 'PREFLOP');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(panel()).toHaveAttribute('data-stale', 'false');
  });
});
