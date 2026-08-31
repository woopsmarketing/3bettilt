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
  SEAT_INDEXES,
  advanceButton,
  applyCommand,
  applyHandResult,
  applySeatAutoTopUps,
  dealtInSeats,
  engineError,
  setSeatOccupancy as engineSetSeatOccupancy,
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
  /**
   * The session's between-hands DEFAULT, or `null` when it records none. It is what each
   * occupied seat was seeded from; it is NOT applied to any seat by itself — see
   * `seedSeatAutoTopUp` and `startHand`.
   */
  readonly autoTopUp?: AutoTopUpPolicy | null;
  /**
   * Each seat's OWN stored policy, keyed by physical seat. A seat with no entry records no
   * preference, which is a different fact from an entry whose `enabled` is false.
   *
   * Omitted means "the caller has none to give" (component-test harnesses), NOT "no seat
   * tops up": the seeding below still gives every occupied seat the session default, so a
   * caller that forgets this prop cannot silently turn auto top-up off.
   */
  readonly seatAutoTopUp?: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
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
  /**
   * The session DEFAULT only. Displayed, and used to seed a legacy session's seats at
   * creation — never applied to a seat on its own (a seat the user switched OFF must stay
   * off, which is the whole point of the per-seat preference).
   */
  readonly autoTopUp: AutoTopUpPolicy | null;
  /** Each seat's OWN policy. The authoritative top-up input for `startHand`. */
  readonly seatAutoTopUp: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
  readonly hand: Hand | null;
  /** Always `toView(hand)`, or `null` when there is no hand. Never hand-maintained. */
  readonly view: HandView | null;
  /** The last rejected transition. Shown, never swallowed. */
  readonly lastError: EngineError | null;
  /** Drives the right-hand panel. `null` means "no explicit selection" (`rightPanel.ts`). */
  readonly selectedSeat: SeatIndex | null;

  /** Deal a hand. Settles and advances the table first when one just completed. */
  startHand(): void;
  /** The Phase 6 seam: one command in, one whole logical action applied or rejected. */
  apply(command: HandCommand): void;
  /** The `Z` key's engine call. Removes one whole logical action. */
  undo(): void;
  dismissError(): void;
  selectSeat(seat: SeatIndex | null): void;
  /**
   * Set (or, with `null`, clear) ONE seat's own auto top-up preference.
   *
   * A synchronous in-memory write, like every other transition here: it does not await,
   * fetch or persist. Persistence is the CALLER's, after this returns, so the path from a
   * click to a rendered change never contains a network request (ADR-0043).
   */
  setSeatAutoTopUp(seat: SeatIndex, policy: AutoTopUpPolicy | null): void;
  /**
   * ACTIVE <-> SITTING_OUT for one OCCUPIED seat — the `S` hotkey / table-side toggle
   * (`docs/UX.md`). Applied directly to `table`, synchronously, exactly like every other
   * transition here (ADR-0043): there is no pending map to reconcile later.
   *
   * This is provably safe to call while a hand is LIVE. `startHand` folds the table's
   * lineup into the hand's own event log at `HAND_STARTED`
   * (`packages/poker-core/src/hand.ts`), and nothing afterward — not `applyCommand`, not
   * `applyHandResult` — re-reads `table` for who is dealt in; `applyHandResult` only
   * compares `playerId`, never `occupancy` (`packages/poker-core/src/table.ts`). So
   * flipping a seat mid-hand can never retroactively remove it from the hand in progress,
   * and the current hand's `view` is untouched by this call. The change takes effect at
   * the NEXT `startHand()`, where `dealtInSeats` excludes SITTING_OUT structurally.
   *
   * Sitting the BUTTON seat out is not special here: `poker-core` leaves `buttonSeat`
   * exactly where it is (occupancy is not rotation state), and `startHand` moves it
   * clockwise to the next dealt-in seat when it comes to deal. So `S` then `S` on the
   * button seat is net-zero — it is the same table it was — and the seat wearing the BTN
   * badge while sitting out is simply the seat the next rotation counts from.
   *
   * Errors SEAT_EMPTY (the engine's own code, surfaced via `lastError` like any other
   * rejected transition) — the UI only ever offers this toggle for an occupied seat, so
   * this fires only if a caller misuses it directly.
   */
  setSeatOccupancy(seat: SeatIndex, occupancy: 'ACTIVE' | 'SITTING_OUT'): void;
}

export type TableStore = StoreApi<TableStoreState>;

/**
 * Total. True when Start Hand should be offered: no hand yet, or the last one finished.
 * A live hand is never silently replaced.
 */
export function canStartHand(state: TableStoreState): boolean {
  return state.hand === null || state.hand.state.phase === 'COMPLETE';
}

/**
 * Total, pure. Every OCCUPIED seat with no policy of its own gets the session default.
 *
 * This is the SAME seeding rule the server applies when a session is created
 * (`server/session-service.ts` — `seedSeatAutoTopUp`, over `plan.seats`: ACTIVE or
 * SITTING_OUT with a player, never EMPTY). It is repeated here for LEGACY sessions only —
 * rows written before the per-seat columns existed carry no per-seat entries at all, and
 * loading one must not silently switch its auto top-up off.
 *
 * A `null` session default seeds NOTHING: no seat records a policy, which is a different
 * fact from every seat recording a disabled one. A seat that already has its own entry is
 * never overwritten — the user's own choice always wins over the default it came from.
 */
export function seedSeatAutoTopUp(
  table: TableState,
  sessionPolicy: AutoTopUpPolicy | null,
  stored: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>,
): Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>> {
  if (sessionPolicy === null) return stored;

  const seeded: Partial<Record<SeatIndex, AutoTopUpPolicy>> = { ...stored };
  let added = false;
  for (const seat of SEAT_INDEXES) {
    if (seeded[seat] !== undefined) continue;
    const tableSeat = table.seats[seat];
    if (tableSeat.occupancy === 'EMPTY' || tableSeat.playerId === null) continue;
    seeded[seat] = sessionPolicy;
    added = true;
  }
  return added ? seeded : stored;
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
      seatAutoTopUp: seedSeatAutoTopUp(
        init.table,
        init.autoTopUp ?? null,
        init.seatAutoTopUp ?? {},
      ),
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
          //
          // Top-up reads the PER-SEAT policies and nothing else. The session default is
          // deliberately NOT also applied: it is only what the seats were seeded from, and
          // applying it as well would top up a seat the user had switched off.
          const settled = applyHandResult(table, previous);
          if (!settled.ok) return fail(settled.error);
          const toppedUp = applySeatAutoTopUps(settled.value, state.seatAutoTopUp);
          if (!toppedUp.ok) return fail(toppedUp.error);
          const advanced = advanceButton(toppedUp.value);
          if (!advanced.ok) return fail(advanced.error);
          table = advanced.value;
        }

        // The button must sit on a seat that is actually dealt in — `buildStartEvents`
        // refuses BUTTON_SEAT_NOT_DEALT_IN otherwise, and the blinds are counted off it.
        // The branch above guarantees that (`advanceButton` only ever returns an eligible
        // seat), but two paths reach here WITHOUT it: the first deal of a page session, and
        // a session reloaded with a stored button on a seat that has since sat out. In
        // both, the seat holding the button went SITTING_OUT and rotation never ran, so run
        // exactly the rotation rule the engine owns — clockwise to the next dealt-in seat —
        // rather than dealing into a refusal the UI offers no way out of.
        //
        // This is deliberately NOT a repair of a null button: a table with no button at all
        // is a different (degenerate) fact, and `engineStartHand` reports NO_BUTTON_SEAT for
        // it through `lastError` rather than having one silently invented here.
        if (table.buttonSeat !== null && !dealtInSeats(table).includes(table.buttonSeat)) {
          const moved = advanceButton(table);
          if (!moved.ok) return fail(moved.error);
          table = moved.value;
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

      setSeatAutoTopUp(seat: SeatIndex, policy: AutoTopUpPolicy | null) {
        const next: Partial<Record<SeatIndex, AutoTopUpPolicy>> = { ...get().seatAutoTopUp };
        // `null` REMOVES the entry rather than storing a disabled one: "records no
        // preference" and "records a preference that is off" are different facts, and the
        // engine treats them differently at seeding time.
        if (policy === null) delete next[seat];
        else next[seat] = policy;
        set({ seatAutoTopUp: next });
      },

      setSeatOccupancy(seat: SeatIndex, occupancy: 'ACTIVE' | 'SITTING_OUT') {
        const result = engineSetSeatOccupancy(get().table, seat, occupancy);
        if (!result.ok) return fail(result.error);
        // `hand` and `view` are deliberately NOT touched: this is a table preference, not
        // a poker transition, exactly like `setSeatAutoTopUp` above.
        set({ table: result.value, lastError: null });
      },
    };
  });
}
