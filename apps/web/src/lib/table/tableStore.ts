/**
 * The live table store — the single owner of in-browser hand state.
 *
 * Two rules govern everything in this file:
 *
 * 1. **Every transition is synchronous.** `startHand`, `apply` and `undo` are plain
 *    `poker-core` calls. Nothing here awaits, fetches, or touches the database: the path
 *    from a keypress to a rendered change never leaves the browser (`prompt` D1).
 * 2. **React computes no poker fact.** `view` is `toView(hand)` and is recomputed
 *    wherever `hand` changes, so a component can never hold a view that disagrees with
 *    the hand it came from. No component derives a pot, an actor, a call amount or a
 *    marker for itself (`prompt` D2).
 *
 * Every engine call returns `EngineResult`. A failure sets `lastError` and leaves the
 * hand exactly as it was — never a throw, never a partial application, never a silent
 * no-op (`CLAUDE.md` rule 5).
 *
 * This module is deliberately React-free so it can be tested as pure logic. The React
 * binding lives in `components/table/TableStoreProvider.tsx`.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { asId, cryptoIdFactory, type IdFactory } from '@gto-self/shared';
import {
  advanceButton,
  applyAutoTopUp,
  applyCommand,
  applyHandResult,
  engineError,
  startHand as engineStartHand,
  toView,
  undo as engineUndo,
} from '@gto-self/poker-core';
import type {
  AutoTopUpPolicy,
  EngineError,
  Hand,
  HandCommand,
  HandView,
  SeatIndex,
  TableState,
} from '@gto-self/poker-core';

export interface TableStoreInit {
  readonly sessionId: string;
  /** The stored table, exactly as the server read it back. */
  readonly table: TableState;
  /** The session's between-hands policy, or `null` when it records none. */
  readonly autoTopUp?: AutoTopUpPolicy | null;
  /**
   * Injected so tests and replay are deterministic (ADR-0007). Defaults to
   * `cryptoIdFactory`; referencing it costs nothing, and `crypto.randomUUID` is only
   * ever reached from a user-triggered action, never during render or SSR.
   */
  readonly ids?: IdFactory;
}

export interface TableStoreState {
  readonly sessionId: string;
  /**
   * The between-hands table. Advanced ONCE per completed hand, by `startHand`, through
   * the engine's own documented sequence — never edited field by field here.
   */
  readonly table: TableState;
  readonly autoTopUp: AutoTopUpPolicy | null;
  readonly hand: Hand | null;
  /** Always `toView(hand)`, or `null` when there is no hand. Never hand-maintained. */
  readonly view: HandView | null;
  /** The last rejected transition. Shown, never swallowed. */
  readonly lastError: EngineError | null;
  /** Drives the right-hand panel. `null` means "show the strategy placeholder". */
  readonly selectedSeat: SeatIndex | null;

  /** Deal a hand. Settles and advances the table first when one just completed. */
  startHand(): void;
  /** The Phase 6 seam: one command in, one whole logical action applied or rejected. */
  apply(command: HandCommand): void;
  /** The `Z` key's engine call. Removes one whole logical action. */
  undo(): void;
  dismissError(): void;
  selectSeat(seat: SeatIndex | null): void;
}

export type TableStore = StoreApi<TableStoreState>;

/**
 * Total. True when Start Hand should be offered: no hand yet, or the last one finished.
 * A live hand is never silently replaced.
 */
export function canStartHand(state: TableStoreState): boolean {
  return state.hand === null || state.hand.state.phase === 'COMPLETE';
}

export function createTableStore(init: TableStoreInit): TableStore {
  const ids = init.ids ?? cryptoIdFactory;

  return createStore<TableStoreState>()((set, get) => {
    /** The ONLY place `hand` and `view` are written, so they cannot drift apart. */
    const commit = (hand: Hand): void => {
      set({ hand, view: toView(hand), lastError: null });
    };
    const fail = (error: EngineError): void => {
      set({ lastError: error });
    };

    return {
      sessionId: init.sessionId,
      table: init.table,
      autoTopUp: init.autoTopUp ?? null,
      hand: null,
      view: null,
      lastError: null,
      selectedSeat: null,

      startHand() {
        const state = get();
        let table = state.table;
        const previous = state.hand;

        if (previous !== null) {
          if (previous.state.phase !== 'COMPLETE') {
            fail(
              engineError(
                'HAND_NOT_COMPLETE',
                `The current hand is still in phase ${previous.state.phase}`,
              ),
            );
            return;
          }
          // The engine's own documented between-hands sequence: write the ending stacks
          // back, top up, THEN move the button (`table.ts` — top-up before the button
          // search, because a revived seat must be eligible again by the time it runs).
          const settled = applyHandResult(table, previous);
          if (!settled.ok) return fail(settled.error);
          const policy = state.autoTopUp;
          let toppedUp = settled.value;
          if (policy !== null) {
            const applied = applyAutoTopUp(toppedUp, policy);
            if (!applied.ok) return fail(applied.error);
            toppedUp = applied.value;
          }
          const advanced = advanceButton(toppedUp);
          if (!advanced.ok) return fail(advanced.error);
          table = advanced.value;
        }

        const started = engineStartHand(table, { handId: asId<'Hand'>(ids.next()) }, ids);
        if (!started.ok) {
          // The table advance is discarded with the failed deal: a rejected Start Hand
          // must leave the store exactly as it was.
          return fail(started.error);
        }
        set({ table, hand: started.value, view: toView(started.value), lastError: null });
      },

      apply(command: HandCommand) {
        const hand = get().hand;
        if (hand === null) {
          fail(engineError('NOT_BETTING_PHASE', 'No hand is in progress'));
          return;
        }
        const next = applyCommand(hand, command, ids);
        if (!next.ok) return fail(next.error);
        commit(next.value);
      },

      undo() {
        const hand = get().hand;
        if (hand === null) {
          fail(engineError('NOTHING_TO_UNDO', 'No hand is in progress'));
          return;
        }
        const next = engineUndo(hand);
        if (!next.ok) return fail(next.error);
        commit(next.value);
      },

      dismissError() {
        set({ lastError: null });
      },

      selectSeat(seat: SeatIndex | null) {
        set({ selectedSeat: seat });
      },
    };
  });
}
