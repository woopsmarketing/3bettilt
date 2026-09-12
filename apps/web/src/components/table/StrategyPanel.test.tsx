import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useStore } from 'zustand';
import { Money, asId, parseCards, sequentialIdFactory } from '@gto-self/shared';
import type { Card, HandId, MilliBB } from '@gto-self/shared';
import { applyCommand, startHand as engineStartHand } from '@gto-self/poker-core';
import type { Hand, HandCommand, HandState, SeatIndex, TableState } from '@gto-self/poker-core';
import { computeStrategy, type StrategyCompute } from '../../lib/table/strategy.js';
import { computeAdaptive } from '../../lib/table/adaptive.js';
import { createAdaptiveStore, type AdaptiveStore } from '../../lib/table/adaptiveStore.js';
import { makeTestTable, testPlayerId } from '../../lib/table/testTable.js';
import { StrategyPanel } from './StrategyPanel.js';
import { TableStoreProvider, useTableStoreApi } from './TableStoreProvider.js';
import type { TableStore } from '../../lib/table/tableStore.js';
import type {
  AdaptiveOpponentInputWire,
  AdaptiveStatObservationWire,
} from '../../lib/table/contract.js';
import type { AdaptiveRecommendation, AdaptiveStatKey } from '@gto-self/adaptive-core';
import { ADAPTIVE_RULE_LABEL } from '../../lib/table/copy.js';

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

/* -------------------------------------------------------------------------- */
/* 상대 적응 · ADAPTIVE (WP J-E2)                                                */
/* -------------------------------------------------------------------------- */

/**
 * The ADAPTIVE half of the panel, against the REAL composition layer.
 *
 * The opponent INPUTS are fixtures — they stand in for rows the server action read out of
 * `player_hud_snapshots` — but nothing downstream of them is: every recommendation asserted
 * below comes out of `composeAdaptive` through `lib/table/adaptive.ts`, driven by a hand the
 * poker engine actually produced, and each expected number is recomputed independently from
 * the same inputs. No `AdaptiveRecommendation` is hand-written anywhere in this file, so a
 * test cannot pass by agreeing with a literal that the panel and the test both got wrong.
 *
 * The load-bearing test is `does NOT recompute REFERENCE`: it is the whole reason the panel
 * has one scheduled effect and one render-time memo instead of two effects.
 */

const observation = (
  key: AdaptiveStatKey,
  valueBps: number,
  sampleN: number,
): AdaptiveStatObservationWire => ({
  key,
  source: 'MANUAL_HUD',
  valueBps,
  sampleN,
  note: null,
});

const opponentWire = (
  seatIndex: SeatIndex,
  observations: readonly AdaptiveStatObservationWire[],
): AdaptiveOpponentInputWire => ({
  playerId: testPlayerId(seatIndex),
  seatIndex,
  nickname: `Player ${seatIndex + 1}`,
  observations,
  manualHudSnapshotId: `hud-${seatIndex}`,
  manualHudRecordedAt: 1_700_000_000_000,
  learnedSnapshotId: null,
  learnedModelVersion: null,
  externalHudSnapshotId: null,
  externalHudRecordedAt: null,
});

/** An opponent who folds to flop c-bets far more than the anchor, over a real sample. */
const FOLDS_TOO_MUCH = [observation('FOLD_TO_CBET_FLOP', 8500, 200)] as const;
/** An opponent who check-raises the flop far more than the anchor. */
const CHECK_RAISES = [observation('CHECK_RAISE_FLOP', 3000, 200)] as const;

/** Hero (BB) called a BTN open and is FIRST TO ACT on the flop — hero may bet. */
const FLOP_HERO_TO_ACT: readonly HandCommand[] = [
  { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('Ah Kh'), revealed: false },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
  { kind: 'FOLD' },
  { kind: 'CALL' },
  { kind: 'DEAL_BOARD', cards: cards('Qh 7s 2d') },
];

/**
 * CO opens, BTN calls, hero (BB) calls: a THREE-way flop with hero first to act.
 *
 * The roles are what this fixture exists for. CO is the first live opponent still to act after
 * hero, so CO is PRIMARY and drives the rule table; BTN acts after both, so BTN is BEHIND and
 * is the seat the §9 guard rail reads.
 */
const MULTIWAY_FLOP_HERO_TO_ACT: readonly HandCommand[] = [
  { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('Ah Kh'), revealed: false },
  { kind: 'FOLD' },
  { kind: 'FOLD' },
  { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
  { kind: 'CALL' },
  { kind: 'FOLD' },
  { kind: 'CALL' },
  { kind: 'DEAL_BOARD', cards: cards('Qh 7s 2d') },
];

/** The composition layer's own answer for the same drive and the same inputs. */
function expectedAdaptive(
  table: TableState,
  commands: readonly HandCommand[],
  heroSeat: SeatIndex,
  inputs: readonly AdaptiveOpponentInputWire[],
): AdaptiveRecommendation {
  const ids = sequentialIdFactory('test');
  const started = engineStartHand(table, { handId: asId<'Hand'>(ids.next()) as HandId }, ids);
  if (!started.ok) throw new Error(started.error.message);
  let hand: Hand = started.value;
  for (const command of commands) {
    const next = applyCommand(hand, command, ids);
    if (!next.ok) throw new Error(`${next.error.code}: ${next.error.message}`);
    hand = next.value;
  }
  const seatPlayerIds = new Map<number, string>();
  for (const seat of [0, 1, 2, 3, 4, 5] as readonly SeatIndex[]) {
    const playerId = hand.state.seats[seat].playerId;
    if (playerId !== null) seatPlayerIds.set(seat, playerId);
  }
  const adaptive = computeAdaptive(computeStrategy(hand.state, heroSeat), inputs, seatPlayerIds);
  if (adaptive === null) throw new Error('fixture produced no adaptive answer');
  return adaptive;
}

/** The panel wired to a REAL adaptive store, exactly as `TableRoot` wires it. */
function AdaptiveHarness({
  compute,
  adaptiveStore,
}: {
  readonly compute?: StrategyCompute;
  readonly adaptiveStore: AdaptiveStore;
}) {
  const inputs = useStore(adaptiveStore, (state) => state.inputs);
  const version = useStore(adaptiveStore, (state) => state.version);
  return (
    <StrategyPanel compute={compute} opponentInputs={inputs} adaptiveVersion={version} />
  );
}

function mountAdaptivePanel(
  table: TableState,
  adaptiveStore: AdaptiveStore,
  compute?: StrategyCompute,
): TableStore {
  captured = null;
  render(
    <TableStoreProvider init={{ sessionId: 'session-1', table, ids: sequentialIdFactory('test') }}>
      <GrabStore />
      <AdaptiveHarness compute={compute} adaptiveStore={adaptiveStore} />
    </TableStoreProvider>,
  );
  if (captured === null) throw new Error('the store was not captured');
  return captured;
}

const adaptivePanel = (): HTMLElement => screen.getByTestId('adaptive-panel');
const adaptivePercent = (kind: string): number =>
  Number(screen.getByTestId(`adaptive-action-${kind}`).getAttribute('data-percent'));

/**
 * One end of an adapted size, in the unit the ENGINE produced for it.
 *
 * Postflop the engine chooses a `POT_FRACTION_BUCKETS` rung, so a rung AND the amount it came
 * to are both real; a caller that passes a `null` percent is asserting about a spot that had
 * no rung, and would get a wrong string here rather than a fabricated percentage.
 */
const sizeAt = (percent: number | null, amount: MilliBB): string =>
  `${percent}% POT · ${Money.formatBB(amount, { maxDecimals: 3, unit: true })}`;

/** Every REFERENCE row, as `kind -> percent`. Compared across a change to prove it did not. */
const referenceRows = (): Record<string, number> => {
  const rows: Record<string, number> = {};
  for (const row of screen.getByTestId('strategy-actions').children) {
    const kind = row.getAttribute('data-kind');
    if (kind !== null) rows[kind] = Number(row.getAttribute('data-percent'));
  }
  return rows;
};

describe('StrategyPanel — 상대 적응 · ADAPTIVE', () => {
  it('renders REFERENCE and ADAPTIVE at the same time, and analyses REFERENCE once', async () => {
    const table = sixMax(2);
    const inputs = [opponentWire(0, FOLDS_TOO_MUCH)];
    const reference = expectedModel(table, FLOP_HERO_TO_ACT, 2);
    const expected = expectedAdaptive(table, FLOP_HERO_TO_ACT, 2, inputs);
    // The premise: this opponent read really does move the mix.
    expect(expected.status).toBe('ADAPTED');
    expect(expected.changedFromBaseline).toBe(true);
    expect(expected.primaryAction).not.toBeNull();

    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs(inputs);
    const compute = vi.fn<StrategyCompute>((state, heroSeat) => computeStrategy(state, heroSeat));
    const store = mountAdaptivePanel(table, adaptiveStore, compute);
    await drive(store, FLOP_HERO_TO_ACT);

    // WP-7: BOTH sections, with no mode to choose between them. Nothing has been clicked.
    expect(screen.getByTestId('strategy-reference-section')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-adaptive-section')).toBeInTheDocument();
    expect(screen.queryByTestId('strategy-mode-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('strategy-mode-REFERENCE')).not.toBeInTheDocument();
    expect(screen.queryByTestId('strategy-mode-ADAPTIVE')).not.toBeInTheDocument();
    expect(panel()).not.toHaveAttribute('data-mode');
    // The reference section keeps its own name; the adaptive one is not a relabel of it.
    expect(screen.getByTestId('strategy-engine-label')).toHaveTextContent('기본전략 · REFERENCE');
    expect(screen.getByTestId('adaptive-heading')).toHaveTextContent('상대 적응 · ADAPTIVE');
    // Each section contains its own rows and neither contains the other's.
    expect(screen.getByTestId('strategy-reference-section')).toContainElement(
      screen.getByTestId('strategy-actions'),
    );
    expect(screen.getByTestId('strategy-adaptive-section')).toContainElement(
      screen.getByTestId('adaptive-actions'),
    );
    expect(screen.getByTestId('strategy-reference-section')).not.toContainElement(
      screen.getByTestId('adaptive-panel'),
    );

    const baselineRows = referenceRows();
    expect(compute).toHaveBeenCalledTimes(1);

    expect(adaptivePanel()).toHaveAttribute('data-status', 'ADAPTED');
    expect(adaptivePanel()).toHaveAttribute('data-changed', 'true');
    expect(screen.getByTestId('adaptive-changed-badge')).toBeInTheDocument();
    // The villain the rule keyed on is NAMED.
    expect(screen.getByTestId('adaptive-opponent')).toHaveTextContent('상대: Player 1');

    // Every adapted row is the composition layer's own number, and so is every delta.
    for (const action of expected.actions) {
      expect(adaptivePercent(action.kind)).toBe(action.frequencyBps / 100);
      expect(screen.getByTestId(`adaptive-action-${action.kind}`)).toHaveAttribute(
        'data-delta',
        String(action.deltaBps),
      );
      // WP-7: `deltaBps` reaches the screen as SIGNED PERCENTAGE POINTS, and a row that did
      // not move says so rather than rendering `+0%p`.
      const points = action.deltaBps / 100;
      expect(screen.getByTestId(`adaptive-delta-${action.kind}`)).toHaveTextContent(
        points === 0 ? '변화 없음' : `${points > 0 ? '+' : ''}${points}%p`,
      );
    }
    // The premise of the assertion above: this fixture really does move rows in BOTH
    // directions, so the sign is being checked and not just the magnitude.
    expect(expected.actions.some((action) => action.deltaBps > 0)).toBe(true);
    expect(expected.actions.some((action) => action.deltaBps < 0)).toBe(true);
    const primary = expected.primaryAction!;
    expect(screen.getByTestId('adaptive-primary')).toHaveAttribute('data-kind', primary.kind);
    expect(screen.getByTestId('adaptive-primary')).toHaveTextContent(
      `${primary.frequencyBps / 100}%`,
    );
    const baselineOfPrimary = expected.baseline.actions.find((row) => row.kind === primary.kind);
    // The baseline row names the SAME action, at the frequency REFERENCE gave it, with the
    // engine's own Latin action name.
    const primaryName = reference.actions.find((row) => row.kind === primary.kind)!.name;
    expect(screen.getByTestId('adaptive-baseline')).toHaveTextContent(
      `기본전략 · REFERENCE ${primaryName} ${baselineOfPrimary!.frequencyBps / 100}%`,
    );
    // This adaptation also moved WHICH action is primary, so REFERENCE's own top action is
    // named rather than quietly replaced.
    expect(primary.kind).not.toBe(expected.baseline.primaryKind);
    expect(screen.getByTestId('adaptive-primary-changed')).toHaveTextContent(
      `기본전략 추천: ${reference.actions.find((row) => row.kind === expected.baseline.primaryKind)!.name}`,
    );
    expect(screen.getByTestId('adaptive-delta')).toHaveTextContent(
      `${primary.deltaBps > 0 ? '+' : ''}${primary.deltaBps / 100}%p`,
    );

    /*
     * The size row exists even though this read moved no rung, and it says so rather than
     * drawing an arrow between two identical values. `SIZING_CONFIDENCE_GATE_NOT_MET` is why:
     * a fold-to-c-bet read strong enough to move the MIX is not automatically strong enough to
     * move the SIZE, and the panel must not imply otherwise.
     */
    const sizing = expected.sizing!;
    expect(sizing).not.toBeNull();
    expect(sizing.bucketDelta).toBe(0);
    const sizingLine = screen.getByTestId('adaptive-sizing');
    expect(sizingLine).toHaveAttribute('data-bucket-delta', '0');
    expect(sizingLine).toHaveTextContent(sizeAt(sizing.toPotFractionPercent, sizing.toToAmountMbb));
    expect(sizingLine).toHaveTextContent('변화 없음');
    expect(sizingLine.textContent ?? '').not.toContain('→');

    // The reason line carries the read, the sample and the confidence — the whole derivation.
    const adjustment = expected.adjustments[0]!;
    const reason = screen.getByTestId(`adaptive-reason-${adjustment.ruleId}`);
    expect(reason).toHaveAttribute('data-stat', adjustment.stat);
    expect(reason).toHaveTextContent(`n=${adjustment.sampleN}`);
    expect(reason).toHaveTextContent(`신뢰도 ${Math.round(adjustment.confidenceBps / 100)}%`);
    expect(reason).toHaveTextContent(`${Math.round(adjustment.estimateBps / 100)}%`);
    // `prompt` §8: the narrative "왜 이렇게 추천하나요" sentence is visible, not tooltip-only.
    expect(screen.getByTestId(`adaptive-reason-narrative-${adjustment.ruleId}`)).toHaveTextContent(
      ADAPTIVE_RULE_LABEL[adjustment.ruleId],
    );
    // WP-7: and the list is introduced by the question the user is actually asking.
    expect(screen.getByTestId('adaptive-reasons-heading')).toHaveTextContent('왜 이렇게 바뀌었나요?');
    expect(screen.getByTestId('adaptive-shift')).toHaveTextContent(
      `전체 이동 ${expected.totalShiftBps.toLocaleString('en-US')}bps / 상한 2,000bps`,
    );

    // Provenance, honestly, and never the reserved label.
    expect(screen.getByTestId('adaptive-provenance')).toHaveTextContent('휴리스틱 (HEURISTIC)');
    expect(panel().textContent ?? '').not.toContain('GTO');

    // The REFERENCE rows are on screen above it, and they are the engine's own — the adapted
    // numbers sit BESIDE the baseline rather than replacing it, which is the whole of WP-7.
    expect(referenceRows()).toEqual(baselineRows);
    for (const action of reference.actions) expect(rowPercent(action.kind)).toBe(action.percent);
    expect(screen.getByTestId('strategy-sizing')).toHaveTextContent('추천 사이즈');

    // One analysis for the whole render. Composing ADAPTIVE over the analysed model is not a
    // reason to recompute what the engine SAID.
    expect(compute).toHaveBeenCalledTimes(1);
    expect(panel().textContent ?? '').not.toContain('GTO');
  });

  /**
   * WP-J design contract §10, row 6 — the J6 acceptance test.
   *
   * A HUD reading saved mid-hand must reach ADAPTIVE immediately and must not be able to
   * disturb REFERENCE. The call count on the injected `compute` is the proof: it is 1 before
   * the save and 1 after, while every ADAPTIVE number on screen changes.
   */
  it('recomputes ADAPTIVE on a HUD save and does NOT recompute REFERENCE', async () => {
    const table = sixMax(2);
    const saved = [opponentWire(0, FOLDS_TOO_MUCH)];
    const expected = expectedAdaptive(table, FLOP_HERO_TO_ACT, 2, saved);
    expect(expected.status).toBe('ADAPTED');
    expect(expected.changedFromBaseline).toBe(true);

    const adaptiveStore = createAdaptiveStore();
    // The seat lineup loaded, and this opponent had no HUD reading yet.
    adaptiveStore.getState().replaceInputs([opponentWire(0, [])]);
    const compute = vi.fn<StrategyCompute>((state, heroSeat) => computeStrategy(state, heroSeat));
    const store = mountAdaptivePanel(table, adaptiveStore, compute);
    await drive(store, FLOP_HERO_TO_ACT);

    expect(adaptivePanel()).toHaveAttribute('data-status', 'INSUFFICIENT_DATA');
    const referenceBefore = referenceRows();
    const analysesBefore = compute.mock.calls.length;
    expect(analysesBefore).toBe(1);

    // The HUD save: `TableRoot` re-reads that ONE player and upserts them (§6). Nothing about
    // the hand changed, and nothing here touches the table store.
    act(() => adaptiveStore.getState().upsertInput(saved[0]!));

    // ADAPTIVE moved.
    expect(adaptiveStore.getState().version).toBe(2);
    expect(adaptivePanel()).toHaveAttribute('data-status', 'ADAPTED');
    expect(adaptivePanel()).toHaveAttribute('data-changed', 'true');
    for (const action of expected.actions) {
      expect(adaptivePercent(action.kind)).toBe(action.frequencyBps / 100);
    }

    // REFERENCE did not. Not the numbers, and — the part that matters — not the computation.
    expect(referenceRows()).toEqual(referenceBefore);
    expect(compute).toHaveBeenCalledTimes(analysesBefore);
    expect(panel()).toHaveAttribute('data-stale', 'false');

    // And it stays that way after the scheduler has had a chance to run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    expect(compute).toHaveBeenCalledTimes(analysesBefore);
  });

  /**
   * WP-7's sizing half. `SIZE_CHECK_RAISE_DOWN` moves the rung one step down against a known
   * check-raiser, so the panel has a real from -> to to render — and every part of it is a
   * field on `AdaptiveSizing`, not a subtraction performed here or in the component.
   */
  it('shows the recommended size moving from one rung to the next, in the engine’s own unit', async () => {
    const table = sixMax(2);
    const inputs = [opponentWire(0, CHECK_RAISES)];
    const expected = expectedAdaptive(table, FLOP_HERO_TO_ACT, 2, inputs);
    const sizing = expected.sizing!;
    // The premise: a sizing rule really did fire and really did move a rung.
    expect(expected.adjustments.some((row) => row.ruleId === 'SIZE_CHECK_RAISE_DOWN')).toBe(true);
    expect(sizing.bucketDelta).toBe(-1);
    expect(sizing.toBucketIndex).toBe(sizing.fromBucketIndex - 1);
    // Postflop: a pot-fraction rung exists at both ends, so both are shown as one.
    expect(sizing.fromPotFractionPercent).not.toBeNull();
    expect(sizing.toPotFractionPercent).not.toBeNull();

    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs(inputs);
    const store = mountAdaptivePanel(table, adaptiveStore);
    await drive(store, FLOP_HERO_TO_ACT);

    const sizingLine = screen.getByTestId('adaptive-sizing');
    expect(sizingLine).toHaveAttribute('data-from-bucket', String(sizing.fromBucketIndex));
    expect(sizingLine).toHaveAttribute('data-to-bucket', String(sizing.toBucketIndex));
    expect(sizingLine).toHaveAttribute('data-bucket-delta', '-1');
    expect(sizingLine).toHaveTextContent(
      `${sizeAt(sizing.fromPotFractionPercent, sizing.fromToAmountMbb)} → ${sizeAt(
        sizing.toPotFractionPercent,
        sizing.toToAmountMbb,
      )}`,
    );
    expect(sizingLine).toHaveTextContent('사이즈 -1 단계');
    expect(sizingLine.textContent ?? '').not.toContain('변화 없음');

    // The REFERENCE size is untouched beside it — that is what the arrow's left end IS.
    const reference = expectedModel(table, FLOP_HERO_TO_ACT, 2);
    expect(reference.sizing!.potFractionPercent).toBe(sizing.fromPotFractionPercent);
    expect(screen.getByTestId('strategy-sizing')).toHaveTextContent(
      `${reference.sizing!.potFractionPercent}% POT`,
    );
  });

  it('says 데이터 부족 and fabricates no adaptive number when nothing cleared its gate', async () => {
    const table = sixMax(2);
    const inputs = [opponentWire(0, [])];
    const expected = expectedAdaptive(table, FLOP_HERO_TO_ACT, 2, inputs);
    expect(expected.status).toBe('INSUFFICIENT_DATA');
    expect(expected.adjustments).toHaveLength(0);

    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs(inputs);
    const store = mountAdaptivePanel(table, adaptiveStore);
    await drive(store, FLOP_HERO_TO_ACT);

    expect(adaptivePanel()).toHaveAttribute('data-status', 'INSUFFICIENT_DATA');
    expect(adaptivePanel()).toHaveAttribute('data-changed', 'false');
    // WP-7's exact two lines: the state, then what the user should read instead.
    expect(screen.getByTestId('adaptive-status')).toHaveTextContent('상대 데이터 없음');
    expect(screen.getByTestId('adaptive-same-as-reference')).toHaveTextContent(
      '→ 기본전략과 동일',
    );
    // The gate that was not met is named, with its own threshold.
    expect(screen.getByTestId('adaptive-status-reason')).toHaveTextContent(
      '표본이 신뢰도 기준 25%에 못 미침',
    );
    // NOTHING numeric is invented about the opponent: the only digits in the section belong
    // to the gate threshold above.
    expect(screen.getByTestId('adaptive-status').textContent ?? '').not.toMatch(/\d/u);

    // NOT an adaptation, and no adaptive number exists to show.
    expect(screen.queryByTestId('adaptive-changed-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-primary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-delta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-reasons')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-shift')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-sizing')).not.toBeInTheDocument();

    // The section is rendered all the same — it is not hidden, it answers.
    expect(screen.getByTestId('strategy-adaptive-section')).toContainElement(adaptivePanel());

    // The REFERENCE rows are the whole answer, and they are still there.
    const reference = expectedModel(table, FLOP_HERO_TO_ACT, 2);
    for (const action of reference.actions) expect(rowPercent(action.kind)).toBe(action.percent);
    expect(panel().textContent ?? '').not.toContain('GTO');
  });

  /**
   * §9's guard rail, as the user sees it: a rule fired, and we deliberately did not act on it
   * because a known check-raiser is still to act. `status` is `ADAPTED` — the reasoning is
   * real and is shown — but `changedFromBaseline` is false, so it must not be badged as a
   * change and must not render a `+0%` delta dressed up as an adaptation.
   */
  it('renders an ADAPTED answer that did not move as 조정 없음, not as a change', async () => {
    const table = sixMax(2);
    const inputs = [opponentWire(5, FOLDS_TOO_MUCH), opponentWire(0, CHECK_RAISES)];
    const expected = expectedAdaptive(table, MULTIWAY_FLOP_HERO_TO_ACT, 2, inputs);
    // The premise, stated: a rule cleared its gate, the guard zeroed it, nothing moved.
    expect(expected.status).toBe('ADAPTED');
    expect(expected.changedFromBaseline).toBe(false);
    expect(expected.adjustments.map((row) => row.cappedBy)).toContain('AGGRESSIVE_PLAYER_BEHIND');
    expect(expected.opponents.find((row) => row.role === 'PRIMARY')?.seatIndex).toBe(5);

    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs(inputs);
    const store = mountAdaptivePanel(table, adaptiveStore);
    await drive(store, MULTIWAY_FLOP_HERO_TO_ACT);

    expect(adaptivePanel()).toHaveAttribute('data-status', 'ADAPTED');
    expect(adaptivePanel()).toHaveAttribute('data-changed', 'false');
    expect(screen.queryByTestId('adaptive-changed-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('adaptive-status')).toHaveTextContent('조정 없음');
    expect(screen.getByTestId('adaptive-status')).toHaveTextContent('뒤에 공격적인 상대가 남아 있음');

    // No adapted row, no delta row, no `+0%` presented as an adaptation.
    expect(screen.queryByTestId('adaptive-primary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-delta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-actions')).not.toBeInTheDocument();

    // The reasoning IS shown, with the limiter that held it.
    const adjustment = expected.adjustments[0]!;
    const reason = screen.getByTestId(`adaptive-reason-${adjustment.ruleId}`);
    expect(reason).toHaveAttribute('data-capped-by', 'AGGRESSIVE_PLAYER_BEHIND');
    expect(reason).toHaveTextContent('Player 6');
    expect(reason).toHaveTextContent('뒤에 공격적인 상대가 남아 있음');
    // Multiway: the total-shift ceiling is the halved one, and nothing moved against it.
    expect(screen.getByTestId('adaptive-shift')).toHaveTextContent('전체 이동 0bps / 상한 1,000bps');
  });

  it('renders REFERENCE-only, and no error UI, where there is nothing to adapt', async () => {
    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs([opponentWire(0, FOLDS_TOO_MUCH)]);
    const store = mountAdaptivePanel(sixMax(0), adaptiveStore);
    // No `SET_HOLE_CARDS`: the REFERENCE engine refuses, so there is no baseline to compose on.
    await drive(store, [{ kind: 'FOLD' }, { kind: 'FOLD' }, { kind: 'FOLD' }]);

    expect(panel()).toHaveAttribute('data-state', 'REFUSED');
    expect(adaptivePanel()).toHaveAttribute('data-status', 'NONE');
    expect(adaptivePanel()).toHaveAttribute('data-changed', 'false');
    expect(screen.getByTestId('adaptive-none')).toHaveTextContent(
      '이 상황에는 상대 적응을 적용하지 않습니다 — 기본전략 · REFERENCE만 표시합니다.',
    );
    // A refusal is the ENGINE's, shown verbatim as always; ADAPTIVE adds no second one.
    expect(screen.getByTestId('strategy-refusal')).toHaveAttribute(
      'data-code',
      'INVALID_HERO_CARDS',
    );
    expect(screen.queryByTestId('adaptive-primary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('adaptive-reasons')).not.toBeInTheDocument();
    expect(panel().textContent ?? '').not.toContain('GTO');

    // And with no hand at all, the same: a section that answers, not an error. The store's
    // `discardHand()` is gone (ADR-0073 folded every discard into `rebase`), so the no-hand
    // state is now reached through a transition that really exists — 빠른 다음 핸드, which
    // leaves the table with no hand in progress (ADR-0074). The PROPERTY under test is
    // unchanged: with no hand, the panel renders NO_HAND and ADAPTIVE renders NONE.
    act(() => store.getState().skipHand());
    expect(store.getState().hand).toBeNull();
    expect(panel()).toHaveAttribute('data-state', 'NO_HAND');
    expect(adaptivePanel()).toHaveAttribute('data-status', 'NONE');
  });

  it('renders both sections before a hand exists, with no mode to choose', () => {
    mountAdaptivePanel(sixMax(0), createAdaptiveStore());
    expect(panel()).toHaveAttribute('data-state', 'NO_HAND');
    expect(panel()).not.toHaveAttribute('data-mode');
    expect(screen.getByTestId('strategy-reference-section')).toHaveTextContent(
      '기본전략 · REFERENCE',
    );
    expect(screen.getByTestId('strategy-adaptive-section')).toHaveTextContent(
      '상대 적응 · ADAPTIVE',
    );
    expect(screen.queryByTestId('strategy-mode-selector')).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* FAST TABLE UX V3 — headline banner, comparison block, collapsible detail   */
/* -------------------------------------------------------------------------- */

describe('StrategyPanel — FAST TABLE UX V3 headline', () => {
  it('renders the primary action and its size, largest, above both sections', async () => {
    const table = sixMax(0);
    const store = mountPanel(table);
    await drive(store, BTN_RFI);

    const reference = expectedModel(table, BTN_RFI, 0);
    const banner = screen.getByTestId('strategy-recommendation-banner');
    expect(banner).toHaveAttribute('data-source', 'REFERENCE');
    expect(screen.getByTestId('strategy-recommendation-action')).toHaveTextContent(
      reference.primary.name,
    );

    // The banner is the FIRST thing inside the panel — before either section.
    const children = [...panel().children];
    expect(children[0]).toBe(banner);
  });

  it('shows 기본전략 alone in the comparison block when there is nothing to adapt', async () => {
    const table = sixMax(0);
    const store = mountPanel(table);
    await drive(store, BTN_RFI);

    expect(screen.getByTestId('strategy-comparison-baseline')).toBeInTheDocument();
    expect(screen.queryByTestId('strategy-comparison-adaptive')).not.toBeInTheDocument();
    expect(screen.queryByTestId('strategy-comparison-delta')).not.toBeInTheDocument();
  });

  it('shows 상대 맞춤 전략, 기본전략 and the delta together once ADAPTIVE really changed something', async () => {
    const table = sixMax(2);
    const inputs = [opponentWire(0, CHECK_RAISES)];
    const expected = expectedAdaptive(table, FLOP_HERO_TO_ACT, 2, inputs);
    expect(expected.status).toBe('ADAPTED');
    expect(expected.changedFromBaseline).toBe(true);

    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs(inputs);
    const store = mountAdaptivePanel(table, adaptiveStore);
    await drive(store, FLOP_HERO_TO_ACT);

    expect(screen.getByTestId('strategy-comparison-adaptive')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-comparison-baseline')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-comparison-delta')).toBeInTheDocument();

    // The banner follows ADAPTIVE, not REFERENCE, once it really changed something.
    const banner = screen.getByTestId('strategy-recommendation-banner');
    expect(banner).toHaveAttribute('data-source', 'ADAPTIVE');
    expect(expected.primaryAction).not.toBeNull();
  });

  it('collapses the 추천 이유 and 상세 데이터 보기 tiers by default, and opens on click', async () => {
    const table = sixMax(2);
    const inputs = [opponentWire(0, CHECK_RAISES)];
    const adaptiveStore = createAdaptiveStore();
    adaptiveStore.getState().replaceInputs(inputs);
    const store = mountAdaptivePanel(table, adaptiveStore);
    await drive(store, FLOP_HERO_TO_ACT);

    const technical = screen.getByTestId('strategy-technical-detail');
    const adaptiveReason = screen.getByTestId('adaptive-reason-detail');
    expect(technical).not.toHaveAttribute('open');
    expect(adaptiveReason).not.toHaveAttribute('open');

    // Content lives in the DOM regardless — only the visual disclosure state is new — so
    // every pre-existing assertion elsewhere in this file still finds these nodes.
    expect(screen.getByTestId('strategy-equity')).toBeInTheDocument();
    expect(screen.getByTestId('adaptive-reasons')).toBeInTheDocument();

    // The raw `Provenance` enum values (always visible in `strategy-quality`, inside the
    // technical tier) never leak into the always-visible banner or comparison block.
    for (const testId of [
      'strategy-recommendation-banner',
      'strategy-comparison',
    ] as const) {
      const text = screen.getByTestId(testId).textContent ?? '';
      expect(text).not.toMatch(/SOURCE|DERIVED|HEURISTIC/u);
    }

    fireEvent.click(technical.querySelector('summary')!);
    expect(technical).toHaveAttribute('open');
  });
});
