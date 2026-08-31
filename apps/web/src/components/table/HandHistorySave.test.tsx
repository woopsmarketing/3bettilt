import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { sequentialIdFactory } from '@gto-self/shared';
import { SEAT_INDEXES, decodeHandEvents } from '@gto-self/poker-core';
import type { TableState } from '@gto-self/poker-core';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import type {
  PersistCompletedHandAction,
  PersistCompletedHandResult,
  PersistCompletedHandValue,
} from '../../lib/table/history-contract.js';
import { makeTestTable, testNicknames } from '../../lib/table/testTable.js';
import { TableRoot } from './TableRoot.js';

/**
 * Completed-hand persistence, on the REAL table (ADR-0059c/e).
 *
 * What these prove that a pure test cannot: the trigger really hangs off the store's
 * transition into `COMPLETE`, it fires ONCE per hand under re-renders and Strict Mode, a
 * failure is visible and retryable without touching the hand, and a save in flight never
 * gates the next deal.
 *
 * The action is mocked — the SERVER half is exercised against a real database in
 * `src/server/hand-history-service.test.ts`.
 */

const noProfile: LoadPlayerProfileAction = async () => ({
  ok: false,
  message: 'not called in this test',
});

const persisted = (): PersistCompletedHandResult => ({
  ok: true,
  handId: 'stored',
  outcome: 'PERSISTED',
});

interface RenderOptions {
  readonly persist?: PersistCompletedHandAction;
  readonly storedHandCount?: number | null;
  readonly strict?: boolean;
}

function renderTable(table: TableState, options: RenderOptions = {}) {
  const element = (
    <TableRoot
      sessionId="session-1"
      label="Test session"
      table={table}
      autoTopUp={null}
      seatAutoTopUp={{}}
      nicknames={testNicknames(SEAT_INDEXES)}
      warnings={[]}
      loadPlayerProfile={noProfile}
      persistCompletedHand={options.persist}
      storedHandCount={options.storedHandCount}
      ids={sequentialIdFactory('test')}
    />
  );
  return render(options.strict === true ? <StrictMode>{element}</StrictMode> : element);
}

const clickCard = (text: string): void => {
  fireEvent.click(screen.getByTestId(`palette-${text}`));
};

const checkOrCall = (): void => {
  fireEvent.click(screen.getByTestId('dock-C'));
};

/** Heads up, hero on the button, checked down and awarded to seat 1. One COMPLETE hand. */
function playCompleteHand(cards: readonly string[]): void {
  fireEvent.click(screen.getByTestId('start-hand'));
  clickCard(cards[0]!);
  clickCard(cards[1]!);
  checkOrCall();
  checkOrCall();
  for (const card of cards.slice(2, 5)) clickCard(card);
  checkOrCall();
  checkOrCall();
  clickCard(cards[5]!);
  checkOrCall();
  checkOrCall();
  clickCard(cards[6]!);
  checkOrCall();
  checkOrCall();
  fireEvent.click(screen.getByTestId('award-seat-0-1'));
  fireEvent.click(screen.getByTestId('award-submit'));
}

const HAND_ONE = ['As', 'Kd', '2c', '7d', '9h', '3s', '4s'] as const;
const HAND_TWO = ['Ac', 'Kc', '2d', '7h', '9s', '3d', '4h'] as const;

/** The `handId` the engine put in the submitted log — the row's primary key (ADR-0059d). */
function submittedHandId(input: PersistCompletedHandValue): string {
  const decoded = decodeHandEvents(input.events);
  if (!decoded.ok) throw new Error(`the submitted log does not decode: ${decoded.error.message}`);
  const first = decoded.value[0];
  if (first === undefined || first.kind !== 'HAND_STARTED') {
    throw new Error('the submitted log does not begin with HAND_STARTED');
  }
  return first.handId;
}

const heads = (): TableState => makeTestTable({ seats: [0, 1], heroSeat: 0, buttonSeat: 0 });

describe('TableRoot — completed-hand persistence', () => {
  it('fires exactly one persist when a hand reaches COMPLETE, carrying the real log', async () => {
    const persist = vi.fn<PersistCompletedHandAction>(async () => persisted());
    renderTable(heads(), { persist, storedHandCount: 0 });

    // Nothing is sent while the hand is still being played.
    fireEvent.click(screen.getByTestId('start-hand'));
    await act(async () => {});
    expect(persist).not.toHaveBeenCalled();

    // Play that same hand out to the award.
    clickCard('As');
    clickCard('Kd');
    checkOrCall();
    checkOrCall();
    for (const card of ['2c', '7d', '9h']) clickCard(card);
    checkOrCall();
    checkOrCall();
    clickCard('3s');
    checkOrCall();
    checkOrCall();
    clickCard('4s');
    checkOrCall();
    checkOrCall();
    fireEvent.click(screen.getByTestId('award-seat-0-1'));
    fireEvent.click(screen.getByTestId('award-submit'));
    await act(async () => {});

    expect(persist).toHaveBeenCalledTimes(1);
    const input = persist.mock.calls[0]![0];
    expect(input.sessionId).toBe('session-1');
    // The log, decodable by the engine's own codec, ending in HAND_FINISHED.
    const decoded = decodeHandEvents(input.events);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error('unreachable');
    expect(decoded.value.at(-1)?.kind).toBe('HAND_FINISHED');
    // Timestamps: the hand started before it finished, and both are real clock readings.
    expect(input.startedAt).toBeLessThanOrEqual(input.finishedAt);
    expect(input.startedAt).toBeGreaterThan(1_577_836_800_000);
    // The success surface moved, and no failure was raised.
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 1');
    expect(screen.queryByTestId('hand-save-error')).not.toBeInTheDocument();
  });

  it('still fires exactly once under React Strict Mode double effects', async () => {
    const persist = vi.fn<PersistCompletedHandAction>(async () => persisted());
    renderTable(heads(), { persist, storedHandCount: 0, strict: true });

    playCompleteHand(HAND_ONE);
    await act(async () => {});

    expect(persist).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 1');
  });

  it('gives the SECOND hand its own persist, under its own hand id', async () => {
    const persist = vi.fn<PersistCompletedHandAction>(async () => persisted());
    renderTable(heads(), { persist, storedHandCount: 0 });

    playCompleteHand(HAND_ONE);
    await act(async () => {});
    playCompleteHand(HAND_TWO);
    await act(async () => {});

    expect(persist).toHaveBeenCalledTimes(2);
    const first = submittedHandId(persist.mock.calls[0]![0]);
    const second = submittedHandId(persist.mock.calls[1]![0]);
    expect(second).not.toBe(first);
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 2');
  });

  it('shows a non-reverting banner when the save fails, and retry re-fires the same log', async () => {
    const persist = vi.fn<PersistCompletedHandAction>();
    persist.mockResolvedValueOnce({ ok: false, code: 'STORAGE_FAILURE', message: 'disk is gone' });
    persist.mockResolvedValueOnce(persisted());
    renderTable(heads(), { persist, storedHandCount: 3 });

    playCompleteHand(HAND_ONE);
    await act(async () => {});

    const banner = screen.getByTestId('hand-save-error');
    expect(banner).toHaveTextContent('기록 저장 실패');
    expect(banner).toHaveTextContent('STORAGE_FAILURE');
    expect(banner).toHaveTextContent('disk is gone');
    // The hand is NOT reverted and the table is NOT blocked.
    expect(screen.getByTestId('start-hand')).toBeEnabled();
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 3');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '재시도' }));
    });

    expect(persist).toHaveBeenCalledTimes(2);
    // The retry sent EXACTLY the log completion produced, not a rebuilt one.
    expect(persist.mock.calls[1]![0]).toEqual(persist.mock.calls[0]![0]);
    expect(screen.queryByTestId('hand-save-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 4');
  });

  it('treats ALREADY_PERSISTED as success', async () => {
    const persist = vi.fn<PersistCompletedHandAction>(async () => ({
      ok: true as const,
      handId: 'stored',
      outcome: 'ALREADY_PERSISTED' as const,
    }));
    renderTable(heads(), { persist, storedHandCount: 0 });

    playCompleteHand(HAND_ONE);
    await act(async () => {});

    expect(screen.queryByTestId('hand-save-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 1');
  });

  it('does not re-fire a hand that is already stored, however often the table re-renders', async () => {
    const persist = vi.fn<PersistCompletedHandAction>(async () => persisted());
    renderTable(heads(), { persist, storedHandCount: 0 });

    playCompleteHand(HAND_ONE);
    await act(async () => {});
    // Re-renders that do not change the hand: a seat selection, and its removal.
    fireEvent.click(screen.getByTestId('seat-1'));
    fireEvent.click(screen.getByTestId('seat-1'));
    await act(async () => {});

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('never blocks the next hand on a save that is still in flight', async () => {
    // A persist that NEVER settles: if the table waited on it, nothing below would work.
    const persist = vi.fn<PersistCompletedHandAction>(() => new Promise(() => {}));
    renderTable(heads(), { persist, storedHandCount: 0 });

    playCompleteHand(HAND_ONE);
    await act(async () => {});
    expect(persist).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('start-hand')).toBeEnabled();
    fireEvent.click(screen.getByTestId('start-hand'));
    // The next hand is live: the engine dealt it and the dock is asking for an action.
    expect(screen.getByTestId('pot')).not.toHaveTextContent('—');
    expect(screen.queryByTestId('hand-save-error')).not.toBeInTheDocument();
    // ...and the first hand's save is still the only one, still unresolved.
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reports an unreadable stored count as unknown, never as zero', () => {
    renderTable(heads(), { storedHandCount: null });
    expect(screen.getByTestId('stored-hand-count')).toHaveTextContent('저장된 핸드 ?');
  });
});
