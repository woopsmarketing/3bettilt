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
import {
  Money,
  asId,
  cryptoIdFactory,
  err,
  ok,
  type IdFactory,
  type MilliBB,
  type PlayerId,
} from '@gto-self/shared';
import {
  SEAT_INDEXES,
  advanceButton,
  applyCommand,
  applyHandResult,
  applySeatAutoTopUps,
  dealtInSeats,
  engineError,
  replaceSeatPlayer as engineReplaceSeatPlayer,
  seatPlayer as engineSeatPlayer,
  setButtonSeat as engineSetButtonSeat,
  setSeatOccupancy as engineSetSeatOccupancy,
  setSeatStack as engineSetSeatStack,
  startHand as engineStartHand,
  toView,
  undo as engineUndo,
} from '@gto-self/poker-core';
import type {
  AutoTopUpPolicy,
  EngineError,
  EngineResult,
  Hand,
  HandCommand,
  HandView,
  SeatIndex,
  TableState,
} from '@gto-self/poker-core';
import { type SkipHandReason } from './skip-hand-contract.js';

/**
 * WHY a live hand was thrown away and re-dealt (`CORRECTION`, ADR-0073). Structured, not a
 * sentence: every Korean string in this app is built in `lib/table/copy.ts`, and the store is
 * not allowed to author one (`docs/reports/HANDS_ON_TABLE_UX_V2_DESIGN.md` §0).
 */
export type RebaseTrigger =
  | 'SEAT_OCCUPANCY'
  /** Somebody different took an already-occupied seat (`replaceSeatPlayer`). */
  | 'SEAT_PLAYER'
  /** Somebody sat down at a seat that was EMPTY (`seatPlayer`). */
  | 'SEAT_SEATED'
  | 'BUTTON_SEAT'
  /** A seat's stack was resynced while a hand was live (`correctSeatStack`, ADR-0078(a)). */
  | 'SEAT_STACK';

export interface RebaseNotice {
  readonly trigger: RebaseTrigger;
  /** The seat the user corrected. */
  readonly seat: SeatIndex;
  /**
   * `true` when a replacement hand is in progress. `false` when the corrected lineup could
   * not be dealt at all (fewer than two dealt-in seats, no button) — the hand is gone either
   * way, and `lastError` carries the engine's own refusal, unswallowed (ADR-0073).
   */
  readonly redealt: boolean;
  /**
   * The seat the button ended up on when the RE-DEAL itself moved it, otherwise `null`
   * (ADR-0078(c)).
   *
   * `dealFrom` applies ADR-0058(c)'s one deal rule: a button sitting on a seat that is not
   * dealt in advances clockwise at the moment of dealing. Reached mid-hand through a rebase
   * that rule is permanent — sitting the button seat out moves the button and sitting it back
   * in does NOT move it back. The rule is not changed (one deal rule, not two); it is made
   * VISIBLE, so the move is never silent and the user knows `[버튼으로 지정]` is the way back.
   *
   * It reports the DEAL's own advance only, measured across `dealFrom`: a `correctSeatButton`
   * that put the button exactly where the user asked reports `null`, because nothing moved
   * that the user did not move themselves. `null` too whenever no re-deal happened
   * (`redealt: false`).
   *
   * The store never authors the sentence — `lib/table/copy.ts` owns every Korean string.
   */
  readonly buttonMovedTo: SeatIndex | null;
}

/**
 * The audit facts a QUICK NEXT HAND produced, for the caller to send to
 * `logSkippedHandAction` AFTER the synchronous transition (`skip-hand-contract.ts`). The
 * store never calls a server action itself.
 */
export interface SkipHandOutcome {
  /** The SKIPPED hand's own number, i.e. the number before `skipHand` advanced the table. */
  readonly handNumber: number;
  /** Derived from the hand at skip time, never chosen by the user (ADR-0074). */
  readonly reason: SkipHandReason;
}

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
   * Seats the STORED session already marks unverified — `session_seats.stack_unverified`,
   * read back with the seat (ADR-0078(b)). Seeds `dirtySeats` verbatim so a reload brings the
   * 확인 필요 badge back instead of presenting an unconfirmed number as confirmed.
   *
   * Omitted means the caller has none to give (component-test harnesses, legacy rows), which
   * seeds the empty set exactly as before. Nothing else about dirty semantics changes: the
   * mark is still only ADDED by `skipHand` / `replaceSeatPlayer` and only CLEARED by
   * `correctSeatStack`.
   */
  readonly dirtySeats?: readonly SeatIndex[];
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
  /**
   * Seats whose displayed stack needs the user's eyes before it is trusted again —
   * `skipHand`'s "확인 필요" mark, seeded at creation from the stored `stack_unverified` flags
   * (ADR-0078(b)). NOT cleared by a rebase (a correction of WHO is at the table says nothing
   * about a stack) and NOT cleared by dealing a new hand; only `correctSeatStack` clears one
   * entry, because that is the one act that actually re-confirms the number.
   */
  readonly dirtySeats: ReadonlySet<SeatIndex>;
  /**
   * Set when a lineup CORRECTION discarded the live hand and rebuilt it (ADR-0073), cleared
   * by `dismissRebaseNotice` and by any transition that ends the hand it describes — a
   * successful `startHand` or `skipHand`. `null` the rest of the time, including after a
   * correction made between hands, which rebuilds nothing and so has nothing to announce.
   */
  readonly rebaseNotice: RebaseNotice | null;
  /**
   * The last successful `skipHand`'s audit facts, or `null` if none has run. Read
   * synchronously by the caller right after `skipHand()` returns; the store itself never
   * sends it anywhere (`skip-hand-contract.ts` — the audit row is fire-and-forget and
   * nothing about the skip depends on it).
   */
  readonly lastSkip: SkipHandOutcome | null;

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
   * **This REBASES a live hand (ADR-0073), superseding ADR-0057 for this transition.** The
   * older doc here said the change "takes effect at the NEXT startHand" and that `hand`/`view`
   * are untouched. That was structurally true but wrong about what the user meant: marking a
   * seat away is not a preference about future hands, it is a report that the lineup already
   * on screen is wrong — so its blinds, positions and action order are wrong too, and playing
   * one more hand against a lineup the user has just said does not exist corrects nothing.
   *
   * So when a hand is LIVE this goes through `rebase`: the change is applied to `table`, the
   * in-progress hand is discarded WHOLE (never spliced — see `rebase`), and the corrected
   * lineup is re-dealt at the SAME `handNumber` with NO button rotation and NO `handNumber`
   * increment. That is what separates a correction from `skipHand`. Nothing is persisted,
   * audited in `skipped_hands`, observed for player learning, or marked dirty.
   *
   * Sitting the BUTTON seat out is still not special for `poker-core`: `buttonSeat` stays
   * exactly where it is (ADR-0058 — occupancy is not rotation state). The re-deal then runs
   * the SAME deal-time eligibility rule `startHand` runs (`dealFrom`), so the BTN badge moves
   * clockwise to the next dealt-in seat at the moment of dealing, and a sit-out/sit-in round
   * trip between hands is still net-zero.
   *
   * A hand that already reached COMPLETE is NOT rebased: it is a finished hand awaiting
   * `startHand`'s settle path (and possibly `useCompletedHandSaves`), not a hand in progress,
   * and discarding it would destroy a real result.
   *
   * Errors SEAT_EMPTY (the engine's own code, surfaced via `lastError` like any other
   * rejected transition) — the UI only ever offers this toggle for an occupied seat, so
   * this fires only if a caller misuses it directly. A rejected change leaves the live hand
   * completely untouched.
   */
  setSeatOccupancy(seat: SeatIndex, occupancy: 'ACTIVE' | 'SITTING_OUT'): void;

  /**
   * Swap WHO sits in an already-occupied seat (WP-2). Rebases a live hand exactly like
   * `setSeatOccupancy` above, and additionally marks the seat DIRTY: the new occupant's stack
   * is genuinely unknown, and claiming the previous player's number for them would be an
   * invented value (`CLAUDE.md` rule 5). The seat shows "확인 필요" until `correctSeatStack`.
   *
   * Naming the player who is ALREADY in the seat changes nothing, so it does nothing at all:
   * no rebase, no dirty mark, no notice, no error. Discarding a live hand to re-deal an
   * identical lineup would destroy the user's entered actions for no correction.
   *
   * Duplicate players across two seats are NOT rejected here — the server action is
   * authoritative for that (design contract WP-2), exactly as `seatPlayer` leaves it to the
   * deal. Errors SEAT_EMPTY for a seat with nobody in it.
   *
   * **Refused for a seat the still-unsettled COMPLETE hand DEALT IN** (HAND_ALREADY_FINISHED,
   * the same code and meaning `correctSeatStack` and `skipHand` use). `applyHandResult` guards
   * on `playerId`, so allowing the swap would leave the finished hand permanently unsettleable:
   * every `startHand` would fail HAND_TABLE_MISMATCH and `skipHand` refuses a COMPLETE hand, so
   * the only way out would be to name the previous occupant back exactly. A loud error with no
   * exit is still a trap; the entrance is closed instead. Settle with `startHand`, then swap.
   *
   * A seat that hand did NOT deal in stays allowed: `applyHandResult` never visits it, so there
   * is no mismatch to trigger and no trap to fall into.
   */
  replaceSeatPlayer(seat: SeatIndex, playerId: PlayerId): void;

  /**
   * Sit somebody down at a seat that is EMPTY (WP-2), with the starting stack the user just
   * counted in front of them.
   *
   * The counterpart to `replaceSeatPlayer`, and separate from it for the reason `poker-core`
   * keeps `seatPlayer` and `replaceSeatPlayer` separate: an empty seat has no stack to carry
   * over, so one is REQUIRED here and FORBIDDEN there. Every check belongs to the engine and
   * none is repeated here — `seatPlayer` refuses an occupied seat (SEAT_OCCUPIED), a
   * non-integer or out-of-range stack (AMOUNT_OUT_OF_RANGE), a non-positive one
   * (STACK_NOT_POSITIVE) and a stack that would push the table's total chips past the money
   * type's range. A refusal surfaces through `lastError` and leaves the live hand untouched.
   *
   * Rebases a live hand through the SAME helper the other three corrections use (ADR-0073):
   * same `handNumber`, same button, the in-progress hand discarded whole rather than spliced.
   * Seating somebody changes who is dealt in, so a hand already on screen was dealt against a
   * lineup the user has just said was wrong.
   *
   * **The seat is NOT marked dirty.** `replaceSeatPlayer` marks one because the new occupant's
   * chips are unknown; here the user supplied the actual figure in this very call, so marking
   * it 확인 필요 would ask them to re-enter what they just entered.
   *
   * `buttonSeat` and `heroSeat` are untouched — `seatPlayer` only ever writes the seat.
   */
  seatPlayer(seat: SeatIndex, playerId: PlayerId, stack: MilliBB): void;

  /** Clears `rebaseNotice`. The banner is informational and dismissable; nothing depends on it. */
  dismissRebaseNotice(): void;

  /**
   * QUICK NEXT HAND (WP-4, ADR-0074). "This hand really happened; I stopped entering it."
   *
   * The opposite event from a `rebase` correction, and never mixed with one: exactly ONE
   * button rotation and exactly ONE `handNumber` increment, plus a `skipped_hands` audit fact
   * in `lastSkip` for the caller to send. Never fakes a completion (no `applyHandResult`, no
   * `applyCommand`, no `HAND_FINISHED`) and never touches the player layer, so nothing here
   * can be mistaken for a settled hand by `useCompletedHandSaves` (which only ever fires on a
   * transition INTO `COMPLETE`, which this is not).
   *
   * ACCOUNTING (ADR-0074) — the reviewed rule, not a preference, applied per dealt-in seat:
   *
   * - **FOLDED at skip time**: its ending stack is EXACTLY known. Everything it put in this
   *   hand (blinds and antes included) is in the pot and can never come back — the uncalled-bet
   *   return goes only to the last aggressor, who by definition has not folded. So the seat is
   *   set to `startingStack - totalContribution`, both numbers read off the ENGINE's own
   *   `SeatHandState`, through `Money.sub`, and it is NOT marked dirty.
   * - **Anything else dealt in** (still live, or all-in): the outcome is unknown, so the stack
   *   is left alone and the seat IS marked dirty. No hero exception either way.
   * - **Not dealt in**: untouched, never marked.
   *
   * A negative result would mean the engine's own numbers disagree, so it is NOT clamped to
   * zero: `setSeatStack` refuses it (STACK_NEGATIVE), the whole transition aborts with nothing
   * applied, and the bug is visible. Existing dirty marks are never cleared here — only
   * `correctSeatStack` re-confirms a stack.
   *
   * Chips do leave the table (the folded seats' contributions are removed while the pot they
   * went into is discarded rather than awarded). That is the honest representation of "the
   * rest of this hand was not observed"; it is confined to the in-memory table and resolves
   * when the user resyncs the dirty seats (ADR-0074).
   *
   * Errors NOT_BETTING_PHASE when there is no live hand (mirrors `apply`'s own refusal
   * message) and HAND_ALREADY_FINISHED when the current hand already reached `COMPLETE` —
   * that hand is done, not in progress, and belongs to `startHand`'s settle path instead.
   */
  skipHand(): void;

  /**
   * The stack resync (WP-5). On success updates `table` AND clears the seat's `dirtySeats`
   * entry (if any) in the SAME `set` — this is the one act that re-confirms a stack, so it is
   * the one place a dirty mark is allowed to clear.
   *
   * Refuses a non-positive or non-integer milliBB value with STACK_NOT_POSITIVE /
   * AMOUNT_OUT_OF_RANGE BEFORE anything else happens — the engine, the live hand and the
   * dirty set all stay untouched. A REJECTED input must never cost the user their hand.
   *
   * The engine itself allows zero (a busted seat is a real state), but a resync is the user
   * typing what they can see, and `0` there is a mistyped or empty field rather than an
   * observation. The client refuses exactly what the server refuses on purpose: a client that
   * accepted a value the server rejects is how the earlier auto-top-up MAJOR happened, and
   * this keeps the two boundaries from drifting apart.
   *
   * **A stack is part of the lineup (ADR-0078(a)).** With a hand LIVE this goes through the
   * SAME `rebase` helper as `setSeatOccupancy` / `replaceSeatPlayer` / `seatPlayer` /
   * `correctSeatButton` — one correction path, never a second one: the in-progress hand is
   * discarded whole and re-dealt from the corrected stacks at the same `handNumber` with no
   * rotation. That is what makes the correction survive: the replacement hand's own
   * `startingStack` IS the number the user typed, so the next `applyHandResult` (or
   * `skipHand`'s folded-seat arithmetic) settles back to a value derived from it instead of
   * overwriting it with one derived from the stale pre-correction stack (`CLAUDE.md` rule 3).
   *
   * Between hands nothing changes — no re-deal, no notice — and that is the path the dirty
   * seat sweep walks.
   *
   * **Refused outright while a COMPLETE hand is still awaiting settlement**
   * (HAND_ALREADY_FINISHED, the same code and the same meaning `skipHand` uses: this hand is
   * done, `startHand` is what handles it). That window is the one place a stack correction
   * could still be silently destroyed — `applyHandResult` writes every dealt-in seat's
   * `stack` back from the finished hand's own numbers, so a value typed here would be
   * overwritten by a derived one at the next `startHand`, which is exactly the MAJOR
   * ADR-0078(a) closes (`CLAUDE.md` rule 3). A rebase is not the answer either: a COMPLETE
   * hand really happened and is never rebuilt (ADR-0073). So the correction is refused
   * honestly and nothing at all changes — `table`, `hand`, `view` and `dirtySeats` are all
   * left exactly as they were. Settle the hand with `startHand`, then correct.
   */
  correctSeatStack(seat: SeatIndex, stack: MilliBB): void;

  /**
   * The button resync (WP-6). SB/BB are derived positions
   * (`packages/poker-core/src/view.ts`), so correcting the button seat is sufficient to fix
   * both.
   *
   * Rebases a live hand (ADR-0073) — this is the one correction that legitimately moves the
   * button, because moving it IS the correction. `handNumber` still does not change and no
   * rotation runs: the button lands exactly on the seat the user named. No seat is marked
   * dirty; nobody's chips moved.
   *
   * Errors SEAT_EMPTY unless the seat is ACTIVE and occupied.
   */
  correctSeatButton(seat: SeatIndex): void;
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
 * Total, pure. The next seat still waiting for its stack to be confirmed, or `null` when none
 * is — what the resync UI focuses after the user presses Enter (WP-5).
 *
 * DETERMINISTIC: ascending physical seat order, starting strictly AFTER `after` and wrapping
 * once past seat 5, so repeatedly feeding the seat just corrected walks every dirty seat
 * exactly once in a stable order. `after === null` starts at seat 0. Iteration order of the
 * `Set` itself is never relied on — a `Set` preserves insertion order, which is the order
 * seats happened to be marked, not an order the user can predict on screen.
 */
export function nextDirtySeat(
  dirtySeats: ReadonlySet<SeatIndex>,
  after: SeatIndex | null = null,
): SeatIndex | null {
  if (dirtySeats.size === 0) return null;
  const start = after === null ? 0 : after + 1;
  for (let step = 0; step < SEAT_INDEXES.length; step += 1) {
    const seat = SEAT_INDEXES[(start + step) % SEAT_INDEXES.length];
    if (seat !== undefined && dirtySeats.has(seat)) return seat;
  }
  return null;
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

    /**
     * The ONE deal path. Shared by `startHand` and by every `rebase`, so a re-dealt hand can
     * never be built by a slightly different rule than a normal one.
     *
     * Applies ADR-0058(c)'s deal-time button rule and nothing else: `buildStartEvents` refuses
     * BUTTON_SEAT_NOT_DEALT_IN, so a NON-NULL button sitting on a seat that is not dealt in
     * (it sat out, busted, or was corrected away) is advanced clockwise to the next dealt-in
     * seat at the moment of dealing — visible on screen as the BTN badge moving. A NULL button
     * is deliberately NOT repaired: a table with no button at all is a different, degenerate
     * fact and `engineStartHand` reports NO_BUTTON_SEAT for it rather than having one invented.
     *
     * `handNumber` is read from `table` by `engineStartHand` and never incremented here — only
     * `applyHandResult` (a completed hand) and `skipHand` (a hand that really happened) move
     * it. That is what lets a rebase re-deal at the SAME hand number.
     */
    const dealFrom = (input: TableState): EngineResult<{ table: TableState; hand: Hand }> => {
      let table = input;
      if (table.buttonSeat !== null && !dealtInSeats(table).includes(table.buttonSeat)) {
        const moved = advanceButton(table);
        if (!moved.ok) return err(moved.error);
        table = moved.value;
      }
      const started = engineStartHand(table, { handId: asId<'Hand'>(ids.next()) }, ids);
      if (!started.ok) return err(started.error);
      return ok({ table, hand: started.value });
    };

    /**
     * CORRECTION (ADR-0073). One atomic transition shared by `setSeatOccupancy`,
     * `replaceSeatPlayer` and `correctSeatButton` — "the lineup I typed in is wrong".
     *
     * 1. Apply `change` to the between-hands `table`. If the ENGINE refuses it, report through
     *    `lastError` and leave the hand completely alone: nothing was corrected, so nothing is
     *    rebuilt.
     * 2. With no hand in progress (none, or one already COMPLETE and awaiting `startHand`'s
     *    settle path), that is the whole transition. No notice: nothing was rebuilt.
     * 3. With a LIVE hand: discard `hand`/`view` WHOLE and re-deal from the corrected table.
     *    Never spliced — cutting a seat out of an event log that already holds posts, actions
     *    and possibly board cards would leave a hand whose arithmetic still balances but whose
     *    history never happened.
     * 4. If the re-deal is refused (fewer than two dealt-in seats, no button), the corrected
     *    table is KEPT, no hand is in progress, and the engine's own error is surfaced
     *    verbatim. It is never swallowed and no lineup is invented to make the deal succeed.
     *
     * NEVER: `handNumber` increment, between-hands button rotation (moving the button is only
     * ever the correction itself, or the DEAL's own ADR-0058(c) advance, which is reported
     * through `buttonMovedTo` rather than suppressed), completed-hand persistence, a
     * `skipped_hands` audit row, or a player observation.
     *
     * `dirty` is the ONE thing each caller decides for itself, because it is the one thing the
     * corrections genuinely disagree about: `replaceSeatPlayer` MARKs (a new occupant's stack
     * is unknown), `correctSeatStack` CLEARs (the user just stated the number), and everything
     * else leaves the set exactly as it found it.
     */
    const rebase = (
      trigger: RebaseTrigger,
      seat: SeatIndex,
      change: (table: TableState) => EngineResult<TableState>,
      dirty: 'KEEP' | 'MARK' | 'CLEAR' = 'KEEP',
    ): void => {
      const state = get();
      const changed = change(state.table);
      if (!changed.ok) return fail(changed.error);

      let dirtySeats = state.dirtySeats;
      if (dirty === 'MARK' && !dirtySeats.has(seat)) {
        const next = new Set(dirtySeats);
        next.add(seat);
        dirtySeats = next;
      } else if (dirty === 'CLEAR' && dirtySeats.has(seat)) {
        const next = new Set(dirtySeats);
        next.delete(seat);
        dirtySeats = next;
      }

      const live = state.hand !== null && state.hand.state.phase !== 'COMPLETE';
      if (!live) {
        set({ table: changed.value, lastError: null, dirtySeats });
        return;
      }

      const dealt = dealFrom(changed.value);
      if (!dealt.ok) {
        set({
          table: changed.value,
          hand: null,
          view: null,
          lastError: dealt.error,
          dirtySeats,
          rebaseNotice: { trigger, seat, redealt: false, buttonMovedTo: null },
        });
        return;
      }
      // Measured across `dealFrom` ONLY, so it reports the deal-time advance and never the
      // user's own `correctSeatButton` move (ADR-0078(c)).
      const buttonMovedTo =
        dealt.value.table.buttonSeat !== changed.value.buttonSeat
          ? dealt.value.table.buttonSeat
          : null;
      set({
        table: dealt.value.table,
        hand: dealt.value.hand,
        view: toView(dealt.value.hand),
        lastError: null,
        dirtySeats,
        rebaseNotice: { trigger, seat, redealt: true, buttonMovedTo },
      });
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
      dirtySeats: new Set<SeatIndex>(init.dirtySeats ?? []),
      rebaseNotice: null,
      lastSkip: null,

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

        // `dealFrom` owns the deal-time button rule (ADR-0058(c)) and the engine call, so a
        // normal deal and a rebase's re-deal are provably the same code path.
        const dealt = dealFrom(table);
        if (!dealt.ok) {
          // The table advance is discarded with the failed deal: a rejected Start Hand
          // must leave the store exactly as it was.
          return fail(dealt.error);
        }
        set({
          table: dealt.value.table,
          hand: dealt.value.hand,
          view: toView(dealt.value.hand),
          lastError: null,
          // The notice describes a hand that no longer exists. Leaving it up would keep
          // announcing the rebuild of a hand two hands ago.
          rebaseNotice: null,
        });
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
        rebase('SEAT_OCCUPANCY', seat, (table) => engineSetSeatOccupancy(table, seat, occupancy));
      },

      replaceSeatPlayer(seat: SeatIndex, playerId: PlayerId) {
        // Naming the occupant who is already there corrects nothing, so nothing happens —
        // in particular the live hand is not discarded and re-dealt for a no-op, and the
        // seat is not marked dirty for a stack that did not change hands. `poker-core`
        // returns the same table by reference for this case; the check is repeated here so
        // the store's own decision is explicit rather than an identity coincidence.
        const state = get();
        if (state.table.seats[seat].playerId === playerId) return;
        // The settlement window, narrowly: only the seats the finished hand actually dealt in
        // are guarded by `applyHandResult`'s `playerId` check, and only those would strand the
        // hand with no way to settle it. A seat it never dealt in is not visited at all, so
        // swapping there is harmless and stays allowed — the rule is not flattened.
        const pending = state.hand;
        if (
          pending !== null &&
          pending.state.phase === 'COMPLETE' &&
          pending.state.dealtInSeats.includes(seat)
        ) {
          return fail(
            engineError(
              'HAND_ALREADY_FINISHED',
              `The current hand already finished; start the next hand to settle it before replacing seat ${seat}'s player`,
              { seat },
            ),
          );
        }
        rebase(
          'SEAT_PLAYER',
          seat,
          (table) => engineReplaceSeatPlayer(table, seat, playerId),
          'MARK',
        );
      },

      seatPlayer(seat: SeatIndex, playerId: PlayerId, stack: MilliBB) {
        // No client-side pre-check: `poker-core`'s `seatPlayer` already refuses an occupied
        // seat, a non-integer/out-of-range stack, a non-positive one and a table total past
        // the money range. Repeating any of them here would be a second authority on the
        // same rule. The dirty set is left alone ('KEEP') — the stack came from the user.
        rebase('SEAT_SEATED', seat, (table) => engineSeatPlayer(table, seat, playerId, stack));
      },

      dismissRebaseNotice() {
        set({ rebaseNotice: null });
      },

      skipHand() {
        const state = get();
        const hand = state.hand;
        if (hand === null) {
          fail(engineError('NOT_BETTING_PHASE', 'No hand is in progress'));
          return;
        }
        if (hand.state.phase === 'COMPLETE') {
          fail(
            engineError(
              'HAND_ALREADY_FINISHED',
              'The current hand already finished; start a new hand instead of skipping it',
            ),
          );
          return;
        }

        // ADR-0074 accounting, over the HAND's own dealt-in lineup (not the table's current
        // one — the table may have been corrected since, and the hand's log is authoritative
        // for who was actually dealt in).
        //
        // Nothing is committed until every seat has been settled: a mid-loop refusal returns
        // with the store exactly as it was, never half-applied.
        let table = state.table;
        const dirty = new Set<SeatIndex>(state.dirtySeats);
        for (const seat of hand.state.dealtInSeats) {
          const handSeat = hand.state.seats[seat];
          const tableSeat = table.seats[seat];
          if (tableSeat.playerId !== handSeat.playerId) {
            // The same guard `applyHandResult` applies before writing stacks back: a seat
            // that changed hands since the deal must not be settled from this hand's numbers.
            fail(
              engineError(
                'HAND_TABLE_MISMATCH',
                `Seat ${seat} holds a different player than when the hand was dealt`,
                { seat },
              ),
            );
            return;
          }
          if (handSeat.status !== 'FOLDED') {
            // Still live or all-in: the rest of the hand was not observed, so the ending
            // stack is genuinely unknown and the seat needs the user's eyes.
            dirty.add(seat);
            continue;
          }
          // Exactly known. Both operands come from the ENGINE's own SeatHandState, and
          // `totalContribution` is the WHOLE hand (dead money + every street, net of any
          // uncalled return) — never `streetContribution`, which is this street only.
          const ending = Money.sub(handSeat.startingStack, handSeat.totalContribution);
          // A negative here would mean the engine's numbers contradict each other. It is NOT
          // clamped: `setSeatStack` refuses it and the whole skip aborts, visibly.
          const applied = engineSetSeatStack(table, seat, ending);
          if (!applied.ok) return fail(applied.error);
          table = applied.value;
          // Deliberately NOT `dirty.delete(seat)`: this hand's arithmetic is exact, but a
          // mark left over from an EARLIER unobserved hand is about a stack that was never
          // re-confirmed, and only `correctSeatStack` may clear that.
        }

        // Derived from the hand, never chosen: hero dealt in and already folded means the
        // rest of the hand genuinely played out without us (ADR-0074, `SKIP_HAND_REASONS`).
        const heroSeat = hand.state.heroSeat;
        const reason: SkipHandReason =
          heroSeat !== null && hand.state.seats[heroSeat].status === 'FOLDED'
            ? 'HERO_FOLDED_UNOBSERVED'
            : 'QUICK_SKIP';
        const skippedHandNumber = hand.state.handNumber;

        const advanced = advanceButton(table);
        if (!advanced.ok) return fail(advanced.error);
        // Exactly one rotation and exactly one hand-number increment — the pair that
        // separates a real skipped hand from ADR-0073's rebase. `applyHandResult` is the ONLY
        // place `poker-core` increments `handNumber` and it requires a COMPLETE hand this one
        // never reached, so the increment is applied directly here rather than routed through
        // a fake completion.
        const nextTable: TableState = {
          ...advanced.value,
          handNumber: advanced.value.handNumber + 1,
        };

        set({
          table: nextTable,
          hand: null,
          view: null,
          lastError: null,
          dirtySeats: dirty,
          lastSkip: { handNumber: skippedHandNumber, reason },
          // Same reason as `startHand`: the rebuilt hand the notice describes is gone.
          rebaseNotice: null,
        });
      },

      correctSeatStack(seat: SeatIndex, stack: MilliBB) {
        // Refused BEFORE anything else — before the engine, before any rebase. A rejected
        // value must not cost the user their live hand: the input was never a correction at
        // all. `setSeatStack` allows zero (a busted seat is a real engine state), but a RESYNC
        // is the user typing what they can see, where `0` is a mistyped or empty field rather
        // than an observation. The server refuses the same value; a client that accepted what
        // the server rejects is how the earlier auto-top-up MAJOR happened.
        if (!Number.isSafeInteger(stack)) {
          return fail(
            engineError('AMOUNT_OUT_OF_RANGE', 'A stack must be a whole number of milliBB', {
              seat,
            }),
          );
        }
        if (stack <= 0) {
          return fail(
            engineError('STACK_NOT_POSITIVE', `Seat ${seat} needs a positive stack`, { seat }),
          );
        }
        // A COMPLETE hand awaiting settlement is the ONE window a correction could still be
        // destroyed silently: `applyHandResult` writes every dealt-in seat's stack back from
        // the finished hand, so the number typed here would be replaced by a derived one at
        // the next `startHand`. Rebasing is not available (a hand that really happened is
        // never rebuilt, ADR-0073), so the honest move is to refuse — same code, same meaning
        // as `skipHand`'s own refusal: this hand is finished, `startHand` is what handles it.
        // Nothing is touched: table, hand, view and dirtySeats are all left as they were.
        const pending = get().hand;
        if (pending !== null && pending.state.phase === 'COMPLETE') {
          return fail(
            engineError(
              'HAND_ALREADY_FINISHED',
              `The current hand already finished; start the next hand to settle it before correcting seat ${seat}'s stack`,
              { seat },
            ),
          );
        }
        // ADR-0078(a): a stack is part of the lineup, so it takes the SAME correction path as
        // the other four. Between hands `rebase` is exactly the old direct write (change the
        // table, clear the mark, no notice); with a hand live it re-deals from the corrected
        // stack, which is what stops the next settlement from overwriting the user's number.
        rebase('SEAT_STACK', seat, (table) => engineSetSeatStack(table, seat, stack), 'CLEAR');
      },

      correctSeatButton(seat: SeatIndex) {
        rebase('BUTTON_SEAT', seat, (table) => engineSetButtonSeat(table, seat));
      },
    };
  });
}
