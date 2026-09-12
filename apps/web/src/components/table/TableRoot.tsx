'use client';

/**
 * The practice table.
 *
 * Composition only. Four rules hold everywhere below:
 *
 * 1. **No poker fact is computed here.** Pot, street, positions, BTN/SB/BB markers, the
 *    actor, legal actions, side pots and every amount are field reads off the `HandView`
 *    that `tableStore` derived with `toView(hand)` (`prompt` D2).
 * 2. **No transition awaits.** Start Hand is a synchronous `poker-core` call inside this
 *    client component; the only `await` in the whole table is the profile panel's server
 *    action, which is not on a hand path (`prompt` D1/D3).
 * 3. **No strategy number is authored here.** Every frequency, sizing and metric in the
 *    right panel comes out of `@gto-self/strategy-core` and carries its own provenance
 *    (ADR-0056); this file composes the panel and computes nothing (`CLAUDE.md` rule 2).
 * 4. **The action dock never leaves the viewport.** See the layout note below.
 *
 * ## Layout: why the bottom of the screen is built the way it is
 *
 * `main` is a fixed-height column that CANNOT overflow (`h-screen overflow-hidden`). Under
 * it, in order: a one-row header strip, the elastic felt/aside row (`min-h-0 flex-1` — the
 * only part that gives), the entry tray, and the action dock. The tray and the dock are
 * both `shrink-0`, so the dock is pinned to the bottom of the viewport at every viewport
 * height and in every phase of a hand.
 *
 * The tray is what fixes the Alpha's jumping bottom, and its height is a FLOOR
 * (`min-h-[18.5rem]`), not a constant. The floor is sized so that the CARD PALETTE FITS INSIDE
 * IT WHOLE: at WP-8's hit areas the palette is 4 suit rows of 64px cards — 278px of grid — and
 * 18.5rem = 296px is that plus the tray's own padding. That is the whole reason the number is
 * what it is, and it is why the keyboard legend, which is much shorter, changes nothing below
 * it either. The two states the user moves between constantly — palette open, palette gone —
 * leave the felt/tray boundary exactly where it was.
 *
 * It was NOT always big enough, and the failure is worth stating: WP-8 grew the cards from
 * 24x32 to 56x64 while the floor stayed at 9.5rem under a 17rem cap, so the palette overflowed
 * the tray's inner `overflow-y-auto` (354px of content in a 259px box) and the CLUBS ROW sat
 * below the fold — the last suit of a 52-card picker, unreachable without scrolling a box
 * nothing suggested was scrollable. The tray also jumped 120px between palette-open and
 * palette-gone, because 9.5rem had stopped being a floor the palette fitted in.
 *
 * The palette's own prompt (heading, slots, keyboard owner) moved BESIDE its grid rather than
 * above it as part of this, which is why 18.5rem is enough where a stacked palette needed 23rem
 * — and 23rem was too much: at 1280x720 it pushed the bottom row of seat cards under the tray
 * and made their chips unclickable, trading a clipped palette for a clipped felt. See
 * `CardPalette.tsx`'s note on that column.
 *
 * ADR-0054's trade is unchanged and is what pays for the rest: the felt above absorbs the
 * tray's height, the dock below never does. The felt is the only elastic child of this screen,
 * so it gives (432px -> 384px at 1440x800, 328px -> 304px at 1280x720) and the dock stays
 * pinned to the bottom of the viewport. Measured in a real browser at 1440x800, 1280x720 and
 * 1024x640: all 52 cards on screen, the palette not scrolling, the felt not covered, and the
 * dock fully inside the viewport at every one.
 *
 * The award panel is the one thing that can still be taller than the floor; the tray grows for
 * it up to `max-h-[26rem]` and `overflow-y-auto` inside is the release valve past that cap,
 * because its submit button is the primary action of the one panel that moves money and must
 * never land under the dock. `action-dock.spec.ts` pins both halves of this: the dock stays in
 * the viewport with the palette open, and the award button stays clear of the dock.
 *
 * The hero's hole cards are a permanent rail on the tray's left, so the area a palette
 * fills is always on screen even while the palette is not.
 *
 * ## The right column
 *
 * What it leads with is `rightPanelLayoutFor` in `lib/table/rightPanel.ts` — one pure
 * function with its own tests, so the panel behind each slot can change without touching any
 * layout here. It returns `{ lead, drawer }`: while hero is on the clock the STRATEGY always
 * leads and a selected seat's profile opens as a DRAWER UNDER it (ADR-0077). There is no path
 * in which clicking a seat removes the strategy from the screen — that was the bug the ADR
 * exists to make unrepresentable.
 *
 * `StrategyPanel` computes its answer AFTER the commit, in a cancellable timer, so a
 * postflop analysis can never sit in front of the next keystroke — see that file's header
 * for why the effect body is deliberately trivial (ADR-0043).
 *
 * Props are Phase 4's contract plus `loadPlayerProfile`, the server action the profile
 * panel calls. It arrives as a prop, not an import, so this component and its tests never
 * reach `@gto-self/db`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Money, asId } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, SeatIndex, TableState } from '@gto-self/poker-core';
import type { IdFactory, MilliBB, PlayerId } from '@gto-self/shared';
import type {
  AddPlayerNoteAction,
  AdaptiveSeatInput,
  ExternalHudEntryStats,
  LoadAdaptiveInputsAction,
  LoadPlayerProfileAction,
  ReplaceSeatPlayerAction,
  SaveExternalHudSnapshotAction,
  SaveHudSnapshotAction,
  SessionSeatStateValue,
  SyncSessionSeatsAction,
} from '../../lib/table/contract.js';
import { createAdaptiveStore, type AdaptiveStore } from '../../lib/table/adaptiveStore.js';
import type { PersistCompletedHandAction } from '../../lib/table/history-contract.js';
import type { LogSkippedHandAction } from '../../lib/table/skip-hand-contract.js';
import type {
  SearchPlayersAction,
  UpdateSeatAutoTopUpAction,
  UpdateSeatOccupancyAction,
} from '../../lib/session-setup/contract.js';
// TYPES only. `analysis-contract.ts` has no runtime dependency on `@gto-self/db` and this
// import is erased, so no client bundle gains an edge to a native module (ADR-0044).
import type {
  GetPlayerModelAction,
  RunSessionAnalysisAction,
} from '../../server/analysis-contract.js';
import { resolveTypedKey } from '../../lib/table/keys.js';
import { canStartHand, nextDirtySeat } from '../../lib/table/tableStore.js';
import { slotClassForSeat } from '../../lib/table/layout.js';
import { rightPanelLayoutFor } from '../../lib/table/rightPanel.js';
import {
  HERO_FOLDED_FAST_SKIP_HINT,
  PLAYER_SWAP_LABEL,
  QUICK_NEXT_HAND_DESCRIPTION,
  QUICK_NEXT_HAND_LABEL,
  SEAT_CORRECTION_LABEL,
  SEAT_DIRTY_ACTION_LABEL,
  SEAT_STACK_REQUIRED_NOTICE,
  SEAT_SWAP_HAND_UNSETTLED_NOTICE,
  handRebasedNotice,
  playerSeatedCreatedNotice,
  playerSeatedExistingNotice,
  seatPlayerStoreRefusedNotice,
  seatStateSaveFailedNotice,
  settlementBlockedGuidance,
  skipAuditSaveFailedNotice,
} from '../../lib/table/copy.js';
import { TableStoreProvider, useTableStore, useTableStoreApi } from './TableStoreProvider.js';
import { SeatCard } from './SeatCard.js';
import { SeatAutoTopUp, type SeatAutoTopUpChange } from './SeatAutoTopUp.js';
import { SeatOccupancyToggle } from './SeatOccupancyToggle.js';
import { SeatCorrectionPanel } from './SeatCorrectionPanel.js';
import {
  SeatPlayerSwapPanel,
  type SeatPlayerSwapResult,
  type SeatPlayerSwapSubmit,
} from './SeatPlayerSwapPanel.js';
import { TableCenter } from './TableCenter.js';
import { HeroCards } from './HeroCards.js';
import { CardPalette, useCardEntry } from './CardPalette.js';
import { AwardPanel } from './AwardPanel.js';
import { ActionDock, isTypingTarget } from './ActionDock.js';
import { ActionHistory } from './ActionHistory.js';
import { KeyboardHints } from './KeyboardHints.js';
import { PlayerProfilePanel } from './PlayerProfilePanel.js';
import { SessionAnalysisControl } from './SessionAnalysisControl.js';
import { StrategyPanel } from './StrategyPanel.js';
import { useCompletedHandSaves } from './useCompletedHandSaves.js';

/**
 * The entry tray's height budget, in the two shapes it has. See the layout note on the
 * `entry-tray` section itself for where every number comes from; the short version is that
 * `100vh - 26.5rem` is what is left after the felt has the height its own content needs, and
 * that the floor and the cap are the SAME expression in the steady states so the felt/tray
 * boundary cannot move as a hand progresses.
 *
 * They are written out in full rather than composed, because Tailwind resolves two competing
 * `max-h-*` utilities by stylesheet order and not by the order they appear in `className` —
 * a conditional that appended one to the other would be a coin flip.
 */
const TRAY_HEIGHT_STEADY =
  'min-h-[min(18.5rem,calc(100vh_-_26.5rem))] max-h-[min(18.5rem,calc(100vh_-_26.5rem))]';
/** The award panel is the ONE thing allowed to grow the tray into the felt (ADR-0054). */
const TRAY_HEIGHT_AWARD = 'min-h-[min(18.5rem,calc(100vh_-_26.5rem))] max-h-[26rem]';

export interface TableRootProps {
  readonly sessionId: string;
  readonly label: string | null;
  readonly table: TableState;
  /**
   * The session DEFAULT only — what each occupied seat was seeded from. It is NOT what any
   * seat currently does; `seatAutoTopUp` is.
   */
  readonly autoTopUp: AutoTopUpPolicy | null;
  /**
   * Each seat's OWN auto top-up policy. Optional so the component tests that render this
   * table can omit it; a session that passes none still keeps its behaviour, because the
   * store seeds every occupied seat from `autoTopUp` (`tableStore.seedSeatAutoTopUp`).
   */
  readonly seatAutoTopUp?: Readonly<Partial<Record<SeatIndex, AutoTopUpPolicy>>>;
  /**
   * The seats whose STORED stack nobody has confirmed since the hand that disturbed it
   * (`session_seats.stack_unverified`, ADR-0078b). A seat absent from the map is confirmed;
   * `{}` — the ordinary case — means every seat is.
   *
   * It seeds the store's `dirtySeats`, which is what makes 확인 필요 survive a reload: the
   * unverified NUMBER was always persisted, and until the flag joined it a refresh presented
   * money nobody had checked as though somebody had. Optional so a component test that renders
   * this table without a session row keeps compiling; omitted means "no seat is marked", never
   * "the marks are unknown".
   */
  readonly seatStackUnverified?: Readonly<Partial<Record<SeatIndex, true>>>;
  readonly nicknames: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
  /** Server action for the profile panel. Not a hot path. */
  readonly loadPlayerProfile: LoadPlayerProfileAction;
  /**
   * Write side of the manual profile panel. Both optional so a render site that only
   * wants read access (or a test) keeps compiling without them.
   */
  readonly saveHudSnapshot?: SaveHudSnapshotAction;
  readonly addPlayerNote?: AddPlayerNoteAction;
  /**
   * The 상대 적응 · ADAPTIVE layer's ONE read action (WP-J design contract §6). Optional: without
   * it the table is exactly Phases 4-7's table with an ADAPTIVE tab that honestly reports that
   * it has no opponent data. It is never awaited on a hand path — it runs when the seat lineup
   * changes and when a HUD reading is saved, both of which are clicks (ADR-0043).
   */
  readonly loadAdaptiveInputs?: LoadAdaptiveInputsAction;
  /**
   * Server action behind the per-seat chips. Optional: without it the preference still
   * applies to this session in this browser, it is simply not persisted.
   */
  readonly updateSeatAutoTopUp?: UpdateSeatAutoTopUpAction;
  /**
   * Server action behind the seat's ACTIVE/SITTING_OUT toggle. Optional: without it the
   * toggle still applies to this session in this browser, it is simply not persisted.
   */
  readonly updateSeatOccupancy?: UpdateSeatOccupancyAction;
  /**
   * The between-hands seat-state write (WP-5, ADR-0075): every seat's occupancy, player and
   * stack plus the button.
   *
   * ONE WRITER PER BOUNDARY. This carries the boundaries that move money or rotation — a stack
   * correction, a player replacement or seating, a button reassignment, the settlement when the
   * next hand starts, and a quick skip. The ACTIVE/SITTING_OUT toggle is NOT one of them: it
   * already has `updateSeatOccupancy` above, which changes exactly the column it means to and
   * has its own failure banner. Firing both for one toggle wrote the same value twice and could
   * raise two banners for one failure.
   *
   * Unawaited, exactly like the two preferences above: a failure is SHOWN and never reverts
   * what is on screen or blocks play. Optional — without it the table behaves as it always
   * did and a reload returns the session to its stored stacks.
   */
  readonly syncSessionSeats?: SyncSessionSeatsAction;
  /**
   * Put a different player in one seat (WP-2). Rendered together with `searchPlayers`: a
   * picker that cannot search, or a search that cannot apply, is worse than no control.
   */
  readonly replaceSeatPlayer?: ReplaceSeatPlayerAction;
  readonly searchPlayers?: SearchPlayersAction;
  /**
   * Append a hand-typed `EXTERNAL_HUD` snapshot from the profile panel (WP-3). Saving
   * recomputes ADAPTIVE only; REFERENCE is bit-identical across it (ADR-0076).
   */
  readonly saveExternalHudSnapshot?: SaveExternalHudSnapshotAction;
  /**
   * Server action behind completed-hand persistence (ADR-0059). Fired once per hand, AFTER
   * it reaches `COMPLETE`, unawaited. Optional: without it the table still plays, the hand is
   * simply not stored — which is exactly Phases 4-7's behaviour.
   */
  readonly persistCompletedHand?: PersistCompletedHandAction;
  /**
   * Best-effort audit for a hand the user discarded with Skip Hand (`skipped_hands`,
   * insert-only). Fired unawaited, AFTER `skipHand()` has already run synchronously.
   * Optional: without it the table still skips hands exactly the same way, the row is
   * simply not recorded (`lib/table/skip-hand-contract.ts`).
   */
  readonly logSkippedHand?: LogSkippedHandAction;
  /**
   * How many completed hands of this session were already stored when the page loaded.
   * `null` means the count could not be read, which is NOT "none stored".
   */
  readonly storedHandCount?: number | null;
  /**
   * Server actions behind 세션 분석 및 반영 (ADR-0062). BOTH are required for the control to
   * render: a button that could start a run but never show a model, or the reverse, is worse
   * than no button. Optional as a pair, so the component tests that render this table without
   * a server still get exactly Phases 4-7's table.
   */
  readonly runSessionAnalysis?: RunSessionAnalysisAction;
  readonly getPlayerModel?: GetPlayerModelAction;
  /** Deterministic ids for tests. The app leaves it out and gets `cryptoIdFactory`. */
  readonly ids?: IdFactory;
}

/*
 * `seatOccupancyPending` used to live here: a live hand snapshotted its lineup and never
 * re-read the table, so a seat toggled mid-hand disagreed with the felt until the next deal
 * and the toggle said "다음 핸드부터". ADR-0073 removed the disagreement rather than the
 * label — an occupancy change now REBASES the live hand in the same commit — so the predicate
 * was dead code that could only ever return `false`, and it is gone with the prop it fed.
 */

export function TableRoot(props: TableRootProps) {
  return (
    <TableStoreProvider
      init={{
        sessionId: props.sessionId,
        table: props.table,
        autoTopUp: props.autoTopUp,
        seatAutoTopUp: props.seatAutoTopUp,
        // ADR-0078(b). The flag is READ back here and never re-derived: a mark restored from
        // the row is the same fact the store would have held had the page never reloaded.
        dirtySeats: SEAT_INDEXES.filter((seat) => props.seatStackUnverified?.[seat] === true),
        ids: props.ids,
      }}
    >
      <TableScreen {...props} />
    </TableStoreProvider>
  );
}

function TableScreen({
  sessionId,
  label,
  autoTopUp,
  nicknames,
  warnings,
  loadPlayerProfile,
  saveHudSnapshot,
  addPlayerNote,
  loadAdaptiveInputs,
  updateSeatAutoTopUp,
  updateSeatOccupancy,
  syncSessionSeats,
  replaceSeatPlayer,
  searchPlayers,
  saveExternalHudSnapshot,
  persistCompletedHand,
  logSkippedHand,
  storedHandCount,
  runSessionAnalysis,
  getPlayerModel,
}: TableRootProps) {
  // The store's table, not the prop: it advances (settle -> top up -> button) once per
  // completed hand, and the prop is only ever the value the page loaded with.
  const table = useTableStore((state) => state.table);
  const view = useTableStore((state) => state.view);
  const hand = useTableStore((state) => state.hand);
  const lastError = useTableStore((state) => state.lastError);
  const selectedSeat = useTableStore((state) => state.selectedSeat);
  const startHand = useTableStore((state) => state.startHand);
  const selectSeat = useTableStore((state) => state.selectSeat);
  const dismissError = useTableStore((state) => state.dismissError);
  const startable = useTableStore(canStartHand);
  const seatAutoTopUp = useTableStore((state) => state.seatAutoTopUp);
  const setSeatAutoTopUp = useTableStore((state) => state.setSeatAutoTopUp);
  const setSeatOccupancy = useTableStore((state) => state.setSeatOccupancy);
  const dirtySeats = useTableStore((state) => state.dirtySeats);
  const skipHandStore = useTableStore((state) => state.skipHand);
  const correctSeatStack = useTableStore((state) => state.correctSeatStack);
  const correctSeatButton = useTableStore((state) => state.correctSeatButton);
  const replaceSeatPlayerInStore = useTableStore((state) => state.replaceSeatPlayer);
  const seatPlayerInStore = useTableStore((state) => state.seatPlayer);
  const rebaseNotice = useTableStore((state) => state.rebaseNotice);
  const dismissRebaseNotice = useTableStore((state) => state.dismissRebaseNotice);
  const tableStoreApi = useTableStoreApi();

  /* ---------------------------------------------------------------------- */
  /* Between-hands seat-state persistence (WP-5, ADR-0075)                    */
  /* ---------------------------------------------------------------------- */

  // A seat-state write that did not land. SHOWN, never swallowed, and it never reverts what
  // is on screen: the correction is already in effect for this session in this browser.
  const [seatStateFailure, setSeatStateFailure] = useState<string | null>(null);
  /**
   * Newest-request-wins for the FAILURE BANNER, and nothing more.
   *
   * It does not order the writes and never claimed to inside `syncSessionSeats`: two syncs
   * dispatched in the same tick are two server actions in flight, and this ref cannot cancel
   * or reorder either. What it does is drop a result belonging to a request a later one has
   * already superseded, so a stale rejection cannot raise "not saved" over a table that was in
   * fact saved.
   *
   * The actual write ordering comes from outside this component: Next serialises server
   * actions for one client into a queue and runs them one at a time, and `@gto-self/db` is
   * synchronous `better-sqlite3` inside a transaction — so the LAST payload dispatched is the
   * last one applied. Seat state is a WHOLE-TABLE write, which is why one sequence covers it
   * rather than one per seat.
   */
  const seatStateSequence = useRef(0);
  /**
   * Write the CURRENT seat state — all six seats and the button — at a between-hands boundary.
   *
   * Reads the store rather than a closed-over render, so it is correct when it is called in the
   * same tick as the transition it follows. Unawaited by design (ADR-0043/ADR-0075).
   */
  const persistSeatState = useCallback((): void => {
    if (syncSessionSeats === undefined) return;
    const state = tableStoreApi.getState();
    const current = state.table;
    // ADR-0078(b): the 확인 필요 mark travels with the number it is about, on EVERY seat of
    // EVERY sync, derived from the store's own `dirtySeats` and never invented here. Sending
    // it unconditionally is what stops a sync that is about something else from silently
    // clearing a warning.
    const seats: readonly SessionSeatStateValue[] = SEAT_INDEXES.map((seat) => {
      const tableSeat = current.seats[seat];
      return {
        seat,
        occupancy: tableSeat.occupancy,
        playerId: tableSeat.playerId,
        stack: tableSeat.stack,
        stackUnverified: state.dirtySeats.has(seat),
      };
    });
    const sequence = seatStateSequence.current + 1;
    seatStateSequence.current = sequence;
    setSeatStateFailure(null);
    const noteFailure = (detail: string): void => {
      // A result from a request already superseded says nothing about what is stored now.
      if (seatStateSequence.current !== sequence) return;
      setSeatStateFailure(detail);
    };
    void syncSessionSeats({ sessionId, seats, buttonSeat: current.buttonSeat })
      .then((result) => {
        if (result.ok) return;
        noteFailure(result.message === '' ? result.code : result.message);
      })
      .catch((error: unknown) => {
        noteFailure(error instanceof Error ? error.message : String(error));
      });
  }, [sessionId, syncSessionSeats, tableStoreApi]);

  /**
   * A `skipped_hands` audit row that did not reach the database.
   *
   * SHOWN, at the same volume as a failed seat-state write, and never allowed to block: the
   * skip already happened, synchronously, before this write was attempted. It used to be
   * swallowed by a bare `.catch(() => {})`, which left the ONE record that a hand was skipped
   * rather than played able to go missing without anybody being told.
   */
  const [skipAuditFailure, setSkipAuditFailure] = useState<string | null>(null);

  // Skip Hand is offered exactly while a hand is live and not yet settled — the same gate
  // `skipHand()` itself enforces, read here only to disable the button (`CLAUDE.md` rule 5:
  // the store's own refusal is still the authority, this is only the affordance).
  const skippable = hand !== null && hand.state.phase !== 'COMPLETE';

  // Hero folded and the rest of this hand is playing out unobserved — the same fact
  // `skipHand()` itself derives for `SkipHandReason.HERO_FOLDED_UNOBSERVED` (ADR-0074), read
  // here only to surface the fast-skip affordance, never to alter what `skipHand()` does.
  const heroJustFolded =
    hand !== null &&
    hand.state.phase !== 'COMPLETE' &&
    hand.state.heroSeat !== null &&
    hand.state.dealtInSeats.includes(hand.state.heroSeat) &&
    hand.state.seats[hand.state.heroSeat].status === 'FOLDED';

  const handleSkipHand = useCallback((): void => {
    // `lastSkip` is never cleared by the store, so "did this click actually skip anything?"
    // is answered by comparing the outcome object across the transition rather than by
    // trusting that one is present.
    const before = tableStoreApi.getState().lastSkip;

    // 1. The transition, SYNCHRONOUSLY, first (`prompt` D1, ADR-0043) — one click, no
    //    confirmation. A refusal (no live hand, or one already COMPLETE) surfaces through
    //    `lastError` exactly like every other rejected transition, and leaves `lastSkip`
    //    untouched, so nothing below runs for it.
    skipHandStore();
    const outcome = tableStoreApi.getState().lastSkip;
    if (outcome === null || outcome === before) return;

    // 2. The settled stacks this skip produced (ADR-0074 computes the folded seats exactly),
    //    persisted at the same between-hands boundary as every other seat change.
    persistSeatState();

    // 3. The audit row, afterwards and unawaited (`lib/table/skip-hand-contract.ts`). It is
    //    best-effort in the sense that it never reverts the skip and never blocks the next
    //    hand — NOT in the sense that its failure is hidden. `skipped_hands` is the only
    //    record that this hand was skipped rather than played, so a failed insert is reported
    //    exactly like a failed seat-state write. The REASON is the store's, derived from the
    //    view at skip time (ADR-0074); this component never picks one.
    if (logSkippedHand === undefined) return;
    setSkipAuditFailure(null);
    const noteAuditFailure = (detail: string): void => {
      setSkipAuditFailure(skipAuditSaveFailedNotice(outcome.handNumber, detail));
    };
    void logSkippedHand({
      sessionId,
      handNumber: outcome.handNumber,
      reason: outcome.reason,
    })
      .then((result) => {
        if (result.ok) return;
        noteAuditFailure(result.message === '' ? result.code : result.message);
      })
      .catch((error: unknown) => {
        noteAuditFailure(error instanceof Error ? error.message : String(error));
      });
  }, [tableStoreApi, skipHandStore, logSkippedHand, persistSeatState, sessionId]);

  /**
   * Start Hand, plus the settle boundary's seat-state write.
   *
   * `startHand` settles the hand that just finished — stacks move, auto top-up applies, the
   * button rotates — so the moment AFTER it is exactly when the stored seat state is stale
   * (design contract §4.5). A deal that was refused changes nothing and writes nothing.
   */
  const handleStartHand = useCallback((): void => {
    const previous = tableStoreApi.getState().hand;
    const settling = previous !== null && previous.state.phase === 'COMPLETE';
    startHand();
    if (!settling) return;
    if (tableStoreApi.getState().lastError !== null) return;
    persistSeatState();
  }, [tableStoreApi, startHand, persistSeatState]);

  // The seat currently open in the correction panel (feature B). `null` means closed.
  const [correctionSeat, setCorrectionSeat] = useState<SeatIndex | null>(null);
  const closeCorrection = useCallback(() => setCorrectionSeat(null), []);

  /**
   * The correction panel's "이 좌석을 버튼으로" action (WP-6).
   *
   * `correctSeatButton` REBASES a live hand by itself (ADR-0073): the hand is discarded whole
   * and re-dealt from the corrected lineup at the same hand number, with the button on the seat
   * the user named and no rotation. The `discardHand()` this handler used to run first is gone
   * — after ADR-0073 it was a DOUBLE discard, and it left the store with no live hand to
   * rebase, so the re-deal never happened and the user was dropped back to 핸드 시작.
   *
   * The button is a persisted column, so this is one of §4's write boundaries.
   */
  const handleMakeButtonSeat = useCallback(
    (seat: SeatIndex): void => {
      correctSeatButton(seat);
      persistSeatState();
    },
    [correctSeatButton, persistSeatState],
  );

  // Completed-hand persistence (ADR-0059). The hook watches the store's hand and fires ONCE,
  // unawaited, when it reaches `COMPLETE` — after the transition and after the render, never
  // in front of them. Start Hand is never gated on it.
  const handSaves = useCompletedHandSaves({
    sessionId,
    hand,
    persist: persistCompletedHand,
    loadedHandCount: storedHandCount ?? null,
  });

  // A save that failed, per seat. It is SHOWN, never swallowed, and it never reverts what
  // the user set: the preference is already in effect for this session in this browser.
  const [saveFailures, setSaveFailures] = useState<Readonly<Partial<Record<SeatIndex, string>>>>(
    {},
  );

  // The newest save request issued for each seat. Saves are deliberately NOT awaited on the
  // click path (ADR-0043), so two fast toggles on one seat are two requests in flight with
  // no ordering guarantee — and the failure banner is cleared when a request is DISPATCHED,
  // so an earlier failure landing after a later success would raise "not saved" on a seat
  // that was in fact saved. Only the newest request for a seat may write a result. A ref,
  // not state: nothing renders from it, and it must be readable by a callback that closed
  // over an older render.
  const saveSequence = useRef<Partial<Record<SeatIndex, number>>>({});

  const handleSeatAutoTopUp = useCallback(
    (change: SeatAutoTopUpChange): void => {
      // 1. The state change, SYNCHRONOUSLY, first. Nothing is awaited before this line —
      //    the path from a click to a rendered change never contains a network request
      //    (`prompt` D1, ADR-0043).
      setSeatAutoTopUp(change.seat, change.policy);
      setSaveFailures((current) => {
        if (current[change.seat] === undefined) return current;
        const next = { ...current };
        delete next[change.seat];
        return next;
      });

      // 2. Persistence, afterwards and unawaited. The TEXT the user typed is what travels;
      //    the server re-parses it with `Money.parseBB` and that parse is authoritative.
      if (updateSeatAutoTopUp === undefined) return;
      const sequence = (saveSequence.current[change.seat] ?? 0) + 1;
      saveSequence.current[change.seat] = sequence;
      const noteFailure = (detail: string): void => {
        // A result from a request this seat has already superseded says nothing about what
        // is stored now, so it is dropped rather than shown.
        if (saveSequence.current[change.seat] !== sequence) return;
        setSaveFailures((current) => ({ ...current, [change.seat]: detail }));
      };
      void updateSeatAutoTopUp({
        sessionId,
        seat: change.seat,
        enabled: change.policy.enabled,
        targetText: change.targetText,
      })
        .then((result) => {
          if (result.ok) return;
          const detail = result.issues.map((issue) => issue.message).join('; ');
          noteFailure(detail === '' ? '서버가 거부했습니다' : detail);
        })
        .catch((error: unknown) => {
          noteFailure(error instanceof Error ? error.message : String(error));
        });
    },
    [sessionId, setSeatAutoTopUp, updateSeatAutoTopUp],
  );

  const failedSaves = Object.entries(saveFailures);

  // A save that failed, per seat, for the occupancy toggle — the same shape as
  // `saveFailures`/`saveSequence` above, kept SEPARATE because the two preferences persist
  // independently and a failure in one must never be attributed to the other.
  const [occupancySaveFailures, setOccupancySaveFailures] = useState<
    Readonly<Partial<Record<SeatIndex, string>>>
  >({});
  const occupancySaveSequence = useRef<Partial<Record<SeatIndex, number>>>({});

  const handleToggleSeatOccupancy = useCallback(
    (seat: SeatIndex): void => {
      // 1. The state change, SYNCHRONOUSLY, first (`prompt` D1, ADR-0043). Reads the
      //    CURRENT table straight off the store rather than closing over a stale render.
      const current = tableStoreApi.getState().table.seats[seat].occupancy;
      if (current === 'EMPTY') return; // The toggle is only ever rendered for an occupied seat.
      const next = current === 'ACTIVE' ? 'SITTING_OUT' : 'ACTIVE';
      setSeatOccupancy(seat, next);
      setOccupancySaveFailures((current) => {
        if (current[seat] === undefined) return current;
        const rest = { ...current };
        delete rest[seat];
        return rest;
      });

      // 2. Persistence, afterwards and unawaited.
      if (updateSeatOccupancy === undefined) return;
      const sequence = (occupancySaveSequence.current[seat] ?? 0) + 1;
      occupancySaveSequence.current[seat] = sequence;
      const noteFailure = (detail: string): void => {
        // A result from a request this seat has already superseded says nothing about what
        // is stored now, so it is dropped rather than shown.
        if (occupancySaveSequence.current[seat] !== sequence) return;
        setOccupancySaveFailures((current) => ({ ...current, [seat]: detail }));
      };
      void updateSeatOccupancy({ sessionId, seat, occupancy: next })
        .then((result) => {
          if (result.ok) return;
          const detail = result.issues.map((issue) => issue.message).join('; ');
          noteFailure(detail === '' ? '서버가 거부했습니다' : detail);
        })
        .catch((error: unknown) => {
          noteFailure(error instanceof Error ? error.message : String(error));
        });
    },
    [sessionId, setSeatOccupancy, tableStoreApi, updateSeatOccupancy],
  );

  const failedOccupancySaves = Object.entries(occupancySaveFailures);

  // Which seat the user said SHOWED at showdown. It is owned HERE for the same reason the
  // card entry is: `AwardPanel` nominates the seat and the palette asks for its cards, so
  // the choice has to sit above both. It is STAMPED WITH THE HAND it was made in — pot
  // indexes and seat indexes both repeat every hand, so an unstamped target would have
  // hand N's reveal still armed in hand N+1.
  const [revealTarget, setRevealTarget] = useState<{
    readonly handNumber: number;
    readonly seat: SeatIndex;
  } | null>(null);
  const handNumber = view === null ? null : view.handNumber;
  const revealSeat =
    revealTarget !== null && revealTarget.handNumber === handNumber ? revealTarget.seat : null;
  const requestReveal = useCallback(
    (seat: SeatIndex | null): void => {
      setRevealTarget(seat === null || handNumber === null ? null : { handNumber, seat });
    },
    [handNumber],
  );

  // Whether the post-session analysis overlay is up. It is a MODAL surface, so the table
  // stands its own hotkey listener down while it is (see the `keydown` effect below) and the
  // action dock's listener is suppressed the same way the card palette suppresses it.
  const [analysisOpen, setAnalysisOpen] = useState(false);

  // Phase 7's card entry. It is owned HERE, not inside the palette, because two siblings
  // depend on it: the palette renders it, and the dock is told whether it still owns the
  // keyboard. One piece of state, read by both in the same commit — see `CardPalette.tsx`.
  const cardEntry = useCardEntry({ view, heroSeat: table.heroSeat, revealSeat });

  // `Esc` returns the right panel to its default, and `S` toggles the SELECTED seat's
  // sit-out (`docs/UX.md`). This is the ONLY listener this phase owns; F / C / R / A / Z /
  // N belong to `ActionDock`'s own listener and are deliberately absent here.
  //
  // Both keys obey the same two gates `ActionDock`'s listener does, because one keystroke
  // must mean one thing: ignored while the user is typing (the raise editor's `Esc` closes
  // the editor and is not also a "clear the panel"; a seat-search or nickname field must
  // never sit a player out because they typed an `s`), and while the card palette owns the
  // keyboard (ADR-0048 — that keystroke is the palette's, and `S` is a valid rank there
  // too). `S` goes through `resolveTypedKey` for the same reason the dock's hotkeys do: a
  // Korean IME rewrites `event.key`, never `event.code` (`lib/table/keys.ts`).
  const paletteOwnsKeyboard = cardEntry.capturing;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (paletteOwnsKeyboard) return;
      // The analysis overlay is modal: while it is up it owns the keyboard, exactly as the
      // card palette does (ADR-0048). `Esc` is handled by the overlay's own listener, and `S`
      // must never reach through a dialog the user is reading to sit a seat out behind it.
      if (analysisOpen) return;
      if (event.key === 'Escape') {
        selectSeat(null);
        return;
      }
      const resolved = resolveTypedKey(event);
      if (resolved !== null && resolved.toUpperCase() === 'S') {
        if (selectedSeat === null) return;
        event.preventDefault();
        handleToggleSeatOccupancy(selectedSeat);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectSeat, paletteOwnsKeyboard, analysisOpen, selectedSeat, handleToggleSeatOccupancy]);

  /**
   * Nicknames the SERVER did not know about when this page rendered: a player created or
   * picked through 플레이어 변경 after the load.
   *
   * An OVERLAY, never a replacement. `nicknames` is the server's read and stays exactly as it
   * arrived (`CLAUDE.md` rule 3); this only adds names for ids that route did not carry, and a
   * reload replaces it with the server's own answer.
   */
  const [nicknameOverlay, setNicknameOverlay] = useState<Readonly<Record<string, string>>>({});
  const allNicknames = useMemo<Readonly<Record<string, string>>>(
    () => ({ ...nicknames, ...nicknameOverlay }),
    [nicknames, nicknameOverlay],
  );

  const nicknameForSeat = useCallback(
    (seat: SeatIndex): string | null => {
      const playerId = table.seats[seat].playerId;
      return playerId === null ? null : (allNicknames[playerId] ?? null);
    },
    [table, allNicknames],
  );

  const selectedPlayerId = selectedSeat === null ? null : table.seats[selectedSeat].playerId;

  /* ---------------------------------------------------------------------- */
  /* WP-5 — the inline stack resync and its dirty-seat walk                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Which seat's stack is being typed, `null` for none.
   *
   * Owned HERE rather than inside `SeatCard` because Enter has to hand focus to the NEXT dirty
   * seat, and only something that can see every seat can decide which that is
   * (`tableStore.nextDirtySeat` — ascending physical order, wrapping once, so four or five
   * seats are walked in an order the user can predict on screen).
   */
  const [stackEditSeat, setStackEditSeat] = useState<SeatIndex | null>(null);
  const beginStackEdit = useCallback((seat: SeatIndex): void => setStackEditSeat(seat), []);
  const cancelStackEdit = useCallback((): void => setStackEditSeat(null), []);

  /**
   * The correction panel's stack save. Same store transition and same §4.1 write boundary as
   * the inline field, WITHOUT the dirty-seat walk: the panel is a deliberate single-seat
   * surface, and jumping the user to a different seat's field from inside it would be a
   * surprise rather than a shortcut.
   */
  const correctSeatStackAndPersist = useCallback(
    (seat: SeatIndex, stack: MilliBB): void => {
      correctSeatStack(seat, stack);
      if (tableStoreApi.getState().lastError !== null) return;
      persistSeatState();
    },
    [correctSeatStack, tableStoreApi, persistSeatState],
  );

  const commitSeatStack = useCallback(
    (seat: SeatIndex, stack: MilliBB): void => {
      // 1. The correction, SYNCHRONOUSLY (`prompt` D1). The value is already validated by the
      //    field; the store refuses exactly the same two things again and is the authority.
      correctSeatStack(seat, stack);
      const state = tableStoreApi.getState();
      // A refusal keeps the field open on the seat that was refused, with the engine's own
      // message in the error banner. Nothing is persisted for a change that did not happen.
      if (state.lastError !== null) return;

      // 2. Straight on to the next seat still waiting to be confirmed, or out of the field
      //    entirely when that was the last one.
      setStackEditSeat(nextDirtySeat(state.dirtySeats, seat));

      // 3. §4.1's write boundary.
      persistSeatState();
    },
    [correctSeatStack, tableStoreApi, persistSeatState],
  );

  /* ---------------------------------------------------------------------- */
  /* WP-2 — 플레이어 변경                                                      */
  /* ---------------------------------------------------------------------- */

  /** The seat whose player-swap panel is open. `null` means closed. */
  const [swapSeat, setSwapSeat] = useState<SeatIndex | null>(null);
  const closeSwap = useCallback((): void => setSwapSeat(null), []);

  /**
   * What the last successful 플레이어 변경 actually did (ADR-0079).
   *
   * The panel closes on success, so this cannot live inside it. Informational and dismissable,
   * never a modal: creating a player and reusing one are both legitimate outcomes, and the only
   * unacceptable option is not saying which happened.
   */
  const [playerSwapNotice, setPlayerSwapNotice] = useState<string | null>(null);

  /** Every player id seated in this session, mapped to the seat holding them (ADR-0076). */
  const seatedPlayerSeats = useMemo<Readonly<Record<string, SeatIndex>>>(() => {
    const held: Record<string, SeatIndex> = {};
    for (const seat of SEAT_INDEXES) {
      const playerId = table.seats[seat].playerId;
      if (playerId !== null) held[playerId] = seat;
    }
    return held;
  }, [table]);

  /* ------------------------------------------------------------------------ */
  /* 상대 적응 · ADAPTIVE opponent inputs (WP-J design contract §6)              */
  /* ------------------------------------------------------------------------ */

  // Created PER MOUNT, for exactly the reason `TableStoreProvider` gives for the table store:
  // a module-level singleton would be shared by every table this process ever rendered, so one
  // session's opponent reads could leak into another's — and on the server, across users.
  const adaptiveStoreRef = useRef<AdaptiveStore | null>(null);
  adaptiveStoreRef.current ??= createAdaptiveStore();
  const adaptiveStore = adaptiveStoreRef.current;
  const adaptiveInputs = useStore(adaptiveStore, (state) => state.inputs);
  const adaptiveVersion = useStore(adaptiveStore, (state) => state.version);

  /**
   * The lineup ADAPTIVE asks about: every occupied seat that is not hero's.
   *
   * Hero is excluded because the layer reasons about OPPONENTS — hero's own tendencies are not
   * an input to any rule, and asking for them would put hero's profile one lookup away from a
   * recommendation about hero. The nickname travels from here because the table already knows
   * it (`contract.ts`), and a second server-side read of a label would be a second source of
   * truth for it.
   */
  const adaptiveLineup = useMemo<readonly AdaptiveSeatInput[]>(
    () =>
      SEAT_INDEXES.flatMap((seat) => {
        if (seat === table.heroSeat) return [];
        const playerId = table.seats[seat].playerId;
        if (playerId === null) return [];
        return [{ playerId, seatIndex: seat, nickname: allNicknames[playerId] ?? null }];
      }),
    [table, allNicknames],
  );

  /** The lineup actually loaded, so a new `table` that seated the same people re-reads nothing. */
  const adaptiveLineupLoaded = useRef<string | null>(null);
  /**
   * Monotonic request id. The ONLY thing standing between two in-flight loads and a stale
   * answer overwriting a newer one — server actions resolve in whatever order they resolve,
   * and this component cannot cancel one.
   */
  const adaptiveRequest = useRef(0);

  /**
   * Load the lineup's opponent facts when — and only when — the lineup changes.
   *
   * A FAILURE IS QUIET AND DEGRADED, NEVER BLOCKING. There is no thrown exception, no error
   * banner and no retry loop: the store is emptied, `composeAdaptive` reports
   * `INSUFFICIENT_DATA` for want of a nameable opponent, and the panel says it has no data
   * while REFERENCE goes on working exactly as before. An opponent read that failed is
   * genuinely "we know nothing about this table", and the one thing that must not happen is
   * adapting against a partial one (`contract.ts` — the result is all-or-nothing).
   */
  useEffect(() => {
    if (loadAdaptiveInputs === undefined) return;
    const key = adaptiveLineup.map((seat) => `${seat.seatIndex}:${seat.playerId}`).join('|');
    if (adaptiveLineupLoaded.current === key) return;
    adaptiveLineupLoaded.current = key;

    if (adaptiveLineup.length === 0) {
      adaptiveStore.getState().replaceInputs([]);
      return;
    }

    adaptiveRequest.current += 1;
    const token = adaptiveRequest.current;
    void loadAdaptiveInputs(adaptiveLineup).then(
      (result) => {
        if (token !== adaptiveRequest.current) return;
        adaptiveStore.getState().replaceInputs(result.ok ? result.inputs : []);
      },
      () => {
        if (token !== adaptiveRequest.current) return;
        adaptiveStore.getState().replaceInputs([]);
      },
    );
  }, [adaptiveLineup, loadAdaptiveInputs, adaptiveStore]);

  /**
   * Re-read ONE player's opponent facts, after their HUD reading was saved.
   *
   * It calls the loader again rather than mapping the returned `PlayerProfileView` here. The
   * server owns both mapping tables AND the `MANUAL_HUD_MAX_EFFECTIVE_N` clamp (WP-J design
   * contract §2.3); a client-side re-derivation would be a second implementation of that
   * mapping, drifting from the first the moment either changes.
   */
  const refreshAdaptiveInput = useCallback(
    (playerId: string): void => {
      if (loadAdaptiveInputs === undefined) return;
      const seats = tableStoreApi.getState().table.seats;
      const seat = SEAT_INDEXES.find((index) => seats[index].playerId === playerId);
      if (seat === undefined) return;
      void loadAdaptiveInputs([
        { playerId, seatIndex: seat, nickname: allNicknames[playerId] ?? null },
      ]).then(
        (result) => {
          if (!result.ok) return;
          const input = result.inputs.find((entry) => entry.playerId === playerId);
          if (input !== undefined) adaptiveStore.getState().upsertInput(input);
        },
        // Quiet, like the lineup load: the previous reading stays, and nothing about the
        // table or the saved HUD row is affected by a failed re-read.
        () => undefined,
      );
    },
    [loadAdaptiveInputs, allNicknames, tableStoreApi, adaptiveStore],
  );

  /**
   * The profile panel's save action, with the ADAPTIVE refresh hung off its success.
   *
   * Wrapped HERE rather than inside `PlayerProfilePanel` so that component keeps knowing
   * nothing about the composition layer: it saves a HUD reading and re-renders the profile the
   * server returned, exactly as before. The wrapper's return value is the action's own result,
   * untouched, so every failure path the panel already handles still reaches it.
   */
  const saveHudSnapshotAndRefresh = useMemo<SaveHudSnapshotAction | undefined>(() => {
    if (saveHudSnapshot === undefined) return undefined;
    return async (input) => {
      const result = await saveHudSnapshot(input);
      if (result.ok) refreshAdaptiveInput(input.playerId);
      return result;
    };
  }, [saveHudSnapshot, refreshAdaptiveInput]);

  /**
   * WP-2's submit. Everything that happens on a SUCCESS happens here, because this is the only
   * thing that can see the whole table:
   *
   * 1. The seat is put in the store. An occupied seat is REPLACED, which rebases a live hand
   *    and marks the seat 확인 필요 — the new occupant's chips are unknown. An EMPTY seat is
   *    SEATED through `seatPlayer` with the stack the user just counted, which rebases the
   *    same way and is deliberately NOT dirty: that number is an observation, not a guess.
   * 2. ADAPTIVE — and only ADAPTIVE — is recomputed from the input the server just returned.
   *    REFERENCE never sees this path.
   * 3. The nickname the SERVER resolved joins the overlay, so the seat is labelled correctly
   *    even for a player this page never loaded.
   *
   * A refusal is returned to the panel verbatim and NOTHING is undone: the call changed
   * nothing, so there is nothing to revert.
   */
  const handleSwapSubmit = useCallback(
    async (seat: SeatIndex, input: SeatPlayerSwapSubmit): Promise<SeatPlayerSwapResult> => {
      if (replaceSeatPlayer === undefined) {
        return { ok: false, message: 'replaceSeatPlayer is not wired up' };
      }

      // A stack this app does not have is REFUSED here, in front of the write, rather than
      // defaulted to zero further down. An empty seat's starting stack is the one number
      // nobody but the user can supply (`CLAUDE.md` rules 1 and 5), and `?? 0` in its place
      // was an invented money value wearing a fallback's clothes.
      const before = tableStoreApi.getState();
      const seatWasEmpty = before.table.seats[seat].occupancy === 'EMPTY';
      if (seatWasEmpty && input.stack === null) {
        return { ok: false, message: SEAT_STACK_REQUIRED_NOTICE };
      }

      // ...and so is the one state the STORE refuses, for the same reason and in the same
      // place: in FRONT of the server call.
      //
      // Reporting the store's refusal after the write (which is what happened before) is
      // honest but leaves the two halves disagreeing — the database holds the new player, the
      // page holds the old one, and only a reload reconciles them. Asking the question first
      // means the divergence never exists: a refused swap makes no server call at all.
      //
      // This mirrors `tableStore.replaceSeatPlayer`'s own guard exactly — a READ of the same
      // two facts, not a second authority on the rule. The store is still asked, still decides,
      // and would still refuse; this only stops the wire traffic that its refusal would strand.
      // The narrow shape matters as much as the rule: only a seat the unsettled COMPLETE hand
      // actually DEALT IN is guarded by `applyHandResult`'s player check, and only a real
      // change is a transition at all — naming the occupant who is already there is a no-op the
      // store waves through, so it must not be refused here either.
      const pending = before.hand;
      const seatChanges =
        input.playerId === null || before.table.seats[seat].playerId !== input.playerId;
      if (
        !seatWasEmpty &&
        seatChanges &&
        pending !== null &&
        pending.state.phase === 'COMPLETE' &&
        pending.state.dealtInSeats.includes(seat)
      ) {
        return { ok: false, message: SEAT_SWAP_HAND_UNSETTLED_NOTICE };
      }

      const result = await replaceSeatPlayer({
        sessionId,
        seat,
        playerId: input.playerId,
        nickname: input.nickname,
        // ADR-0079: only the UI can tell the two intents apart, because only the UI knows
        // WHICH CONTROL was used. `새 플레이어 추가` means a player who does not exist yet;
        // the picker means one who does. The panel carries that distinction here verbatim.
        requireNew: input.requireNew,
        stack: input.stack,
        externalHud: input.externalHud,
      });
      if (!result.ok) {
        return { ok: false, code: result.code, message: `${result.code}: ${result.message}` };
      }

      const playerId = asId<'Player'>(result.playerId) as PlayerId;
      // The STORE is the authority on whether this table can take the change, and it is asked
      // BEFORE anything downstream assumes it did. A refusal (ADR-0078: a COMPLETE hand still
      // waiting to be settled dealt this seat in) used to close the panel with `ok: true` and
      // then have `persistSeatState()` write the OLD lineup back over the row the server had
      // just written — a successful server write silently undone. Now the refusal is reported
      // and NOTHING is overwritten.
      // Compared ACROSS the transition, never read as an absolute: an error already on screen
      // from something else says nothing about this call, and `replaceSeatPlayer` returns
      // without touching `lastError` when the seat already holds that player (a no-op, not a
      // refusal). Only a NEW error means this transition was declined.
      const errorBefore = tableStoreApi.getState().lastError;
      if (result.seatedEmpty) {
        if (input.stack === null) return { ok: false, message: SEAT_STACK_REQUIRED_NOTICE };
        // The value the panel parsed with `Money.parseBB` and the server just accepted; the
        // engine re-checks every property of it again inside `seatPlayer`.
        seatPlayerInStore(seat, playerId, input.stack as MilliBB);
      } else {
        replaceSeatPlayerInStore(seat, playerId);
      }
      const refusal = tableStoreApi.getState().lastError;
      if (refusal !== null && refusal !== errorBefore) {
        return { ok: false, message: seatPlayerStoreRefusedNotice(refusal.code, refusal.message) };
      }

      setNicknameOverlay((current) => ({ ...current, [result.playerId]: result.nickname }));
      // The store's table now agrees with the row the server wrote, so the ordinary
      // between-hands write applies to both cases (ADR-0075 §4.3).
      persistSeatState();

      adaptiveStore.getState().upsertInput(result.adaptiveInput);
      // ADR-0079: `createdPlayer` is READ, not ignored. "새 플레이어 추가" that reused somebody
      // and one that really created them are different events, and the user is told which.
      setPlayerSwapNotice(
        result.createdPlayer
          ? playerSeatedCreatedNotice(result.nickname)
          : playerSeatedExistingNotice(result.nickname),
      );
      setSwapSeat(null);
      return { ok: true };
    },
    [
      sessionId,
      replaceSeatPlayer,
      replaceSeatPlayerInStore,
      seatPlayerInStore,
      persistSeatState,
      tableStoreApi,
      adaptiveStore,
    ],
  );

  /**
   * WP-3's save, bound to the seat the profile is open on and with the ADAPTIVE refresh hung
   * off its success — the same shape as `saveHudSnapshotAndRefresh` above, and for the same
   * reason: `PlayerProfilePanel` stays ignorant of both the seat lineup and the adaptive layer.
   *
   * `upsertInput` is the WHOLE recompute. REFERENCE is not on this path at all, so it is
   * bit-identical across a HUD edit (ADR-0076), which is the property `StrategyPanel`'s
   * existing structure already guarantees and this must not break.
   */
  const saveExternalHudForSelected = useMemo(() => {
    if (saveExternalHudSnapshot === undefined) return undefined;
    if (selectedSeat === null || selectedPlayerId === null) return undefined;
    const playerId: string = selectedPlayerId;
    const seatIndex: number = selectedSeat;
    return async (
      stats: ExternalHudEntryStats,
    ): Promise<{ ok: true; appended: boolean } | { ok: false; message: string }> => {
      const result = await saveExternalHudSnapshot({ playerId, seatIndex, stats });
      if (!result.ok) return { ok: false, message: `${result.code}: ${result.message}` };
      adaptiveStore.getState().upsertInput(result.adaptiveInput);
      return { ok: true, appended: result.appended };
    };
  }, [saveExternalHudSnapshot, selectedSeat, selectedPlayerId, adaptiveStore]);

  // The right column's shape (ADR-0077). Both inputs are field reads: whether HERO is the seat
  // the engine put on the clock, and which seat the user explicitly selected. `lead` is what
  // the column is about; `drawer` opens UNDER it and never instead of it.
  const heroIsActor =
    table.heroSeat !== null && view !== null && view.seats[table.heroSeat].isActor;
  const layout = rightPanelLayoutFor({
    selectedPlayerSeat: selectedPlayerId === null ? null : selectedSeat,
    heroIsActor,
  });

  const awarding = view !== null && view.phase.kind === 'AWAITING_AWARD';
  // The tray holds exactly one thing at a time: the palette, the award panel, or — when the
  // engine is asking for neither — the keyboard legend. The first and the last fit inside the
  // tray's floor; the award panel is what grows it (see the layout note at the top).
  const trayHasEntry = awarding || cardEntry.request !== null;

  /**
   * The settlement dead end, RECOGNISED — never created, and never routed around.
   *
   * A hand that reached COMPLETE with a seat busted to zero cannot be settled by `startHand()`
   * (NOT_ENOUGH_PLAYERS: after settlement fewer than two seats can be dealt in) and refuses
   * every seat correction until it is (HAND_ALREADY_FINISHED). Each engine message names the
   * other action as the fix. Both are accurate about their own refusal and neither names the
   * way out, so the user is sent in a circle.
   *
   * The engine and the store are untouched. This is three field reads — the error's code, the
   * hand's phase, and the seats the finished hand's own view shows with nothing in front of
   * them — feeding a `copy.ts` sentence. The zero-stack list is READ off the view, not derived
   * from what settlement would do: it is what the engine already displays.
   */
  const settlementGuidance =
    lastError === null || hand === null || hand.state.phase !== 'COMPLETE' || view === null
      ? null
      : settlementBlockedGuidance(
          lastError.code,
          SEAT_INDEXES.filter(
            (seat) =>
              hand.state.dealtInSeats.includes(seat) && !Money.isPositive(view.seats[seat].stack),
          ),
        );

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-surface-900 text-ink-100">
      {/* Feature B's seat-correction panel. A floating overlay, deliberately outside
          `rightPanelLayoutFor`'s composition (`lib/table/rightPanel.ts`) so it can open over
          whatever the right column is already showing, from any seat, at any time. */}
      {correctionSeat !== null && table.seats[correctionSeat].occupancy !== 'EMPTY' && (
        <div className="absolute right-3 top-12 z-20 w-64">
          <SeatCorrectionPanel
            seat={correctionSeat}
            tableSeat={table.seats[correctionSeat]}
            dirty={dirtySeats.has(correctionSeat)}
            onCorrectStack={correctSeatStackAndPersist}
            onMakeButton={handleMakeButtonSeat}
            onToggleOccupancy={handleToggleSeatOccupancy}
            isButton={table.buttonSeat === correctionSeat}
            onClose={closeCorrection}
          />
        </div>
      )}

      {/* WP-2's player swap. A floating overlay for the same reason the correction panel is
          one: it opens from ANY seat, including an EMPTY one, over whatever the right column
          is already showing. */}
      {swapSeat !== null && replaceSeatPlayer !== undefined && searchPlayers !== undefined && (
        <div className="absolute right-3 top-12 z-30 w-72">
          <SeatPlayerSwapPanel
            seat={swapSeat}
            seatEmpty={table.seats[swapSeat].occupancy === 'EMPTY'}
            currentPlayerId={table.seats[swapSeat].playerId}
            seatedPlayerSeats={seatedPlayerSeats}
            searchPlayers={searchPlayers}
            onSubmit={(input) => handleSwapSubmit(swapSeat, input)}
            onClose={closeSwap}
          />
        </div>
      )}

      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-surface-700 px-3 py-1.5">
        <h1 className="text-sm font-semibold tracking-tight">{label ?? '연습 세션'}</h1>
        {/* `handNumber` is the load-bearing invariant of the V2 contract — a correction never
            moves it (ADR-0073), a quick next hand moves it by exactly one (ADR-0074) — and it
            had no test id, so the E2E suite had to read it out of the rendered sentence. The
            sentence is unchanged; the number simply carries its own handle now. */}
        <p className="text-[0.6rem] text-ink-700">
          {table.config.label} · 앤티 {table.config.ante.enabled ? '켬' : '끔'} · 핸드{' '}
          <span data-testid="hand-number">{table.handNumber}</span>
        </p>
        <button
          type="button"
          data-testid="start-hand"
          disabled={!startable}
          onClick={handleStartHand}
          className="self-center rounded border border-good-500 px-2.5 py-0.5 text-xs font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
        >
          핸드 시작
        </button>

        {/* 빠른 다음 핸드 (WP-4). One click, no confirmation dialog: `skipHand()` never fakes
            a completion, creates no player observation, and the store's own refusal (no live
            hand, or one already COMPLETE) is what disables it here. The `data-testid` is
            deliberately unchanged — the label moved, the action did not. */}
        <button
          type="button"
          data-testid="skip-hand"
          disabled={!skippable}
          onClick={handleSkipHand}
          className={`self-center rounded border px-2.5 py-0.5 text-xs font-semibold disabled:border-surface-600 disabled:text-ink-700 ${
            heroJustFolded
              ? 'animate-pulse border-dirty-500 bg-dirty-500/10 text-dirty-500'
              : 'border-dirty-500 text-dirty-500'
          }`}
        >
          {QUICK_NEXT_HAND_LABEL}
        </button>
        {/* What it costs, said BEFORE it is pressed. */}
        <p data-testid="quick-next-hand-description" className="text-[0.6rem] text-ink-700">
          {QUICK_NEXT_HAND_DESCRIPTION}
        </p>
        {/* Hero folded: the hand plays out unobserved, so the fast-skip path is surfaced
            rather than left to be found (`X`, or the button above). */}
        {heroJustFolded && (
          <p data-testid="hero-folded-fast-skip-hint" className="text-[0.6rem] text-dirty-500">
            {HERO_FOLDED_FAST_SKIP_HINT}
          </p>
        )}

        {/*
          Rule 3: never destroy user input. Phases 4-7 persist the SESSION only — the live
          table, the hand event log, cards and awards are in memory, and a reload discards
          them (ADR-0043; the write boundary is Phase 8 work). Losing entered work is
          survivable when the user knows it is possible; losing it silently is not, so this
          says so plainly rather than letting a reload eat a hand without warning. It now
          rides in the header row instead of owning a strip of its own — same meaning, one
          less line of the viewport the action dock has to fit into.
        */}
        <p data-testid="in-memory-notice" className="text-[0.6rem] text-ink-500">
          세션은 저장됩니다. 진행 중인 핸드는 저장되지 않으며, 새로고침하면 사라집니다.
        </p>

        {/* The other half of that promise, and the only place the user can SEE that the
            completion write boundary did its job: hands that finished ARE durable. It is
            the count the page loaded with plus every hand this table has since stored
            (ADR-0059) — never a guess, and `?` when the count itself could not be read. */}
        <p data-testid="stored-hand-count" className="text-[0.6rem] text-ink-500">
          {`저장된 핸드 ${handSaves.storedHandCount === null ? '?' : handSaves.storedHandCount}`}
        </p>

        {/* The session-level control, beside the session-level count it acts on (prompt §26).
            Rendered only when BOTH actions exist — see the prop docs. */}
        {runSessionAnalysis !== undefined && getPlayerModel !== undefined && (
          <SessionAnalysisControl
            sessionId={sessionId}
            handPhase={view === null ? null : view.phase.kind}
            savesInFlight={handSaves.savesInFlight}
            unsavedHandCount={handSaves.failures.length}
            runSessionAnalysis={runSessionAnalysis}
            getPlayerModel={getPlayerModel}
            onOpenChange={setAnalysisOpen}
          />
        )}

        {/* The SESSION DEFAULT, and it says so: it is only what each occupied seat was
            seeded from. Each seat's own chip is authoritative, and a seat that diverged
            from this default is not described by it. */}
        <p data-testid="session-autotopup-default" className="ml-auto text-[0.6rem] text-ink-700">
          {autoTopUp === null
            ? '세션 기본값: 자동 리바이 없음'
            : `세션 기본값: 자동 리바이 ${autoTopUp.enabled ? '켬' : '끔'}, 목표 ${Money.formatBB(
                autoTopUp.targetStack,
                { maxDecimals: 3, unit: true },
              )}`}
          {' · 좌석마다 개별 설정'}
        </p>
        <p className="tabular text-[0.6rem] text-ink-700">{sessionId}</p>
      </header>

      {warnings.length > 0 && (
        <ul
          data-testid="session-warnings"
          className="shrink-0 border-b border-dirty-500 px-3 py-0.5 text-[0.65rem] text-dirty-500"
        >
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {/* A preference that did not reach the database. The user's choice is NOT reverted —
          it is in effect for this session in this browser — but they are told plainly that
          it was not saved, rather than being left to find out on the next load. */}
      {failedSaves.length > 0 && (
        <ul
          data-testid="autotopup-save-error"
          role="alert"
          className="shrink-0 border-b border-danger-500 px-3 py-0.5 text-[0.65rem] text-danger-500"
        >
          {failedSaves.map(([seat, detail]) => (
            <li key={seat}>
              {`좌석 ${Number(seat) + 1}: 자동 리바이가 저장되지 않았습니다 (${detail}). 이 브라우저의 이번 세션에만 적용됩니다.`}
            </li>
          ))}
        </ul>
      )}

      {/* Same shape and the same promise as the auto top-up banner above: the toggle is NOT
          reverted, only reported as unsaved. */}
      {failedOccupancySaves.length > 0 && (
        <ul
          data-testid="occupancy-save-error"
          role="alert"
          className="shrink-0 border-b border-danger-500 px-3 py-0.5 text-[0.65rem] text-danger-500"
        >
          {failedOccupancySaves.map(([seat, detail]) => (
            <li key={seat}>
              {`좌석 ${Number(seat) + 1}: 자리비움 설정이 저장되지 않았습니다 (${detail}). 이 브라우저의 이번 세션에만 적용됩니다.`}
            </li>
          ))}
        </ul>
      )}

      {/* A COMPLETED hand that did not reach the database (ADR-0059e). The in-memory hand is
          untouched and the next hand may be dealt immediately; the encoded log stays queued
          here, so 재시도 sends exactly what completion produced. It is never dismissed by
          anything but a successful save — a hand silently dropped is the one outcome
          `prompt` §10 forbids. */}
      {handSaves.failures.length > 0 && (
        <ul
          data-testid="hand-save-error"
          role="alert"
          className="shrink-0 border-b border-danger-500 px-3 py-0.5 text-[0.65rem] text-danger-500"
        >
          {handSaves.failures.map((failure) => (
            <li key={failure.handId} className="flex items-center gap-2">
              <span>{`핸드 ${failure.handNumber} 기록 저장 실패 (${failure.detail}). 이 핸드는 아직 저장되지 않았습니다.`}</span>
              <button
                type="button"
                data-testid={`hand-save-retry-${failure.handNumber}`}
                onClick={() => handSaves.retry(failure.handId)}
                className="rounded border border-danger-500 px-1.5 py-0.5 text-[0.6rem] font-semibold"
              >
                재시도
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* A CORRECTION rebuilt the hand that was on screen (ADR-0073). Shown only when a
          replacement hand actually exists — a rebase that could not re-deal leaves the engine's
          own refusal in the error banner below, which is the honest message for that case.
          Informational and dismissable; never a modal, never a confirmation.

          It NAMES THE NEW BUTTON SEAT when the re-deal moved it (ADR-0078c). The deal-time
          advance of ADR-0058(c) is a real rule and is not changed here, but a button that moved
          without being mentioned is a hand played from a position the user never chose. The
          sentence is `copy.ts`'s; `buttonMovedTo` is the store's, measured across `dealFrom`
          alone so it never reports the user's own [이 좌석을 버튼으로]. */}
      {rebaseNotice !== null && rebaseNotice.redealt && (
        <div
          data-testid="hand-rebased-notice"
          role="status"
          data-button-moved-to={rebaseNotice.buttonMovedTo ?? ''}
          className="flex shrink-0 items-center gap-3 border-b border-dirty-500 px-3 py-0.5 text-xs text-dirty-500"
        >
          <span>{handRebasedNotice(rebaseNotice.buttonMovedTo)}</span>
          <button
            type="button"
            data-testid="hand-rebased-dismiss"
            onClick={dismissRebaseNotice}
            className="ml-auto text-[0.65rem] uppercase tracking-widest"
          >
            닫기
          </button>
        </div>
      )}

      {/* The `skipped_hands` audit row that did not reach the database. It is the ONLY record
          that a hand was skipped rather than played, so its failure is shown at the same volume
          as a failed seat-state write instead of being swallowed. The skip itself already
          happened, synchronously, so nothing here blocks or reverts anything. */}
      {skipAuditFailure !== null && (
        <p
          data-testid="skip-audit-save-error"
          role="alert"
          className="shrink-0 border-b border-danger-500 px-3 py-0.5 text-[0.65rem] text-danger-500"
        >
          {skipAuditFailure}
        </p>
      )}

      {/* What 플레이어 변경 actually did (ADR-0079) — created somebody, or seated somebody who
          already existed. Both are legitimate; being unable to tell them apart is not. */}
      {playerSwapNotice !== null && (
        <div
          data-testid="player-swap-notice"
          role="status"
          className="flex shrink-0 items-center gap-3 border-b border-surface-700 px-3 py-0.5 text-[0.65rem] text-ink-300"
        >
          <span>{playerSwapNotice}</span>
          <button
            type="button"
            data-testid="player-swap-notice-dismiss"
            onClick={() => setPlayerSwapNotice(null)}
            className="ml-auto text-[0.6rem] uppercase tracking-widest"
          >
            닫기
          </button>
        </div>
      )}

      {/* Seat state that did not reach the database (ADR-0075). Same promise as the two
          banners above: nothing on screen is reverted, and the failure is not hidden. */}
      {seatStateFailure !== null && (
        <p
          data-testid="seat-state-save-error"
          role="alert"
          className="shrink-0 border-b border-danger-500 px-3 py-0.5 text-[0.65rem] text-danger-500"
        >
          {seatStateSaveFailedNotice(seatStateFailure)}
        </p>
      )}

      {/* The engine's own code and message, verbatim (`CLAUDE.md` rule 3). */}
      {lastError !== null && (
        <div
          data-testid="engine-error"
          role="alert"
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-danger-500 px-3 py-0.5 text-xs text-danger-500"
        >
          <span className="font-semibold">{lastError.code}</span>
          <span>{lastError.message}</span>
          <button
            type="button"
            onClick={dismissError}
            className="ml-auto text-[0.65rem] uppercase tracking-widest"
          >
            닫기
          </button>
          {/* The engine's two refusals for an unsettled busted hand each name the other action
              as the fix — `startHand()` says the hand is finished, correcting a seat says to
              start the hand — and in that state neither can succeed. Both messages are true
              and both stay exactly as the engine wrote them; what is added here is the door
              that IS open. The UI recognises the state, it does not change it: no engine code,
              no store action and no error text is touched by this. */}
          {settlementGuidance !== null && (
            <p
              data-testid="settlement-blocked-guidance"
              className="basis-full text-[0.7rem] text-dirty-500"
            >
              {settlementGuidance}
            </p>
          )}
        </div>
      )}

      {/* The ONLY elastic row. Everything below it is `shrink-0`, so this is what gives
          when the viewport is short — the action dock never is. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-[6] flex-col p-2">
          <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
            {SEAT_INDEXES.map((seat) => (
              <div
                key={seat}
                className={`${slotClassForSeat(seat, table.heroSeat)} flex min-w-0 flex-col items-stretch`}
              >
                <SeatCard
                  seat={seat}
                  tableSeat={table.seats[seat]}
                  view={view === null ? null : view.seats[seat]}
                  nickname={nicknameForSeat(seat)}
                  heroSeat={table.heroSeat}
                  tableButtonSeat={table.buttonSeat}
                  selected={selectedSeat === seat}
                  onSelect={selectSeat}
                  dirty={dirtySeats.has(seat)}
                  stackEditing={stackEditSeat === seat}
                  onBeginStackEdit={beginStackEdit}
                  onCancelStackEdit={cancelStackEdit}
                  onCommitStack={commitSeatStack}
                />
                {/* Under the card, not inside it: the chips carry their own buttons and the
                    card is one big control. An empty seat has no preference to hold — but it
                    CAN be sat at, so 플레이어 변경 is offered for every seat. */}
                {table.seats[seat].occupancy !== 'EMPTY' && (
                  <>
                    <SeatAutoTopUp
                      seat={seat}
                      policy={seatAutoTopUp[seat] ?? null}
                      defaultTarget={table.config.referenceStack}
                      onChange={handleSeatAutoTopUp}
                    />
                    <SeatOccupancyToggle
                      seat={seat}
                      occupancy={table.seats[seat].occupancy}
                      onToggle={handleToggleSeatOccupancy}
                    />
                  </>
                )}
                <div className="mt-1 flex w-full min-w-0 flex-wrap items-center gap-1 text-[0.6rem] uppercase tracking-wide">
                  {/* WP-5: the instruction beside the badge on the card — one click opens the
                      inline field, and Enter walks on to the next unconfirmed seat. */}
                  {dirtySeats.has(seat) && (
                    <button
                      type="button"
                      data-testid={`seat-${seat}-dirty-action`}
                      onClick={() => beginStackEdit(seat)}
                      className="rounded bg-dirty-500 px-1 font-semibold text-surface-900"
                    >
                      {SEAT_DIRTY_ACTION_LABEL}
                    </button>
                  )}
                  {replaceSeatPlayer !== undefined && searchPlayers !== undefined && (
                    <button
                      type="button"
                      data-testid={`seat-${seat}-swap-toggle`}
                      onClick={() => setSwapSeat((current) => (current === seat ? null : seat))}
                      className="rounded bg-surface-600 px-1 font-semibold text-ink-500"
                    >
                      {PLAYER_SWAP_LABEL}
                    </button>
                  )}
                  {table.seats[seat].occupancy !== 'EMPTY' && (
                    <button
                      type="button"
                      data-testid={`seat-${seat}-correction-toggle`}
                      onClick={() =>
                        setCorrectionSeat((current) => (current === seat ? null : seat))
                      }
                      className="ml-auto rounded bg-surface-600 px-1 font-semibold text-ink-500"
                    >
                      {SEAT_CORRECTION_LABEL}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <TableCenter view={view} config={table.config} />
          </div>
        </div>

        <aside
          data-testid="right-panel"
          data-panel={layout.lead}
          data-drawer={layout.drawer ?? 'NONE'}
          className="flex min-h-0 flex-[4] flex-col gap-2 border-l border-surface-700 p-2"
        >
          {/*
            The LEAD. Each box scrolls INSIDE itself rather than squeezing the log to nothing
            or spilling out of the clipped column, and the two caps add up to less than the
            column so `ActionHistory` — the only `flex-1` child — always keeps a row of its
            own. With a drawer open the lead gives up ten points of height to it; with none it
            keeps the 55% it always had.
          */}
          {layout.lead !== 'HISTORY' && (
            <div
              data-testid="right-panel-lead"
              className={`${
                layout.drawer === null ? 'max-h-[55%]' : 'max-h-[45%]'
              } shrink-0 overflow-y-auto rounded-md border border-surface-700 bg-surface-800 p-2`}
            >
              {layout.lead === 'PLAYER' && selectedSeat !== null && selectedPlayerId !== null ? (
                <PlayerProfilePanel
                  playerId={selectedPlayerId}
                  nickname={nicknameForSeat(selectedSeat)}
                  loadProfile={loadPlayerProfile}
                  saveHudSnapshot={saveHudSnapshotAndRefresh}
                  addNote={addPlayerNote}
                  saveExternalHud={saveExternalHudForSelected}
                  onClose={() => selectSeat(null)}
                />
              ) : (
                <StrategyPanel opponentInputs={adaptiveInputs} adaptiveVersion={adaptiveVersion} />
              )}
            </div>
          )}

          {/* The DRAWER (ADR-0077): the selected seat's profile UNDER the strategy, never in
              place of it. `Esc` clears the selection and closes this; it no longer has to
              restore a panel the selection took away, because nothing was taken away. */}
          {layout.drawer === 'PLAYER' && selectedSeat !== null && selectedPlayerId !== null && (
            <div
              data-testid="right-panel-drawer"
              className="max-h-[35%] shrink-0 overflow-y-auto rounded-md border border-surface-700 bg-surface-800 p-2"
            >
              <PlayerProfilePanel
                playerId={selectedPlayerId}
                nickname={nicknameForSeat(selectedSeat)}
                loadProfile={loadPlayerProfile}
                saveHudSnapshot={saveHudSnapshotAndRefresh}
                addNote={addPlayerNote}
                saveExternalHud={saveExternalHudForSelected}
                onClose={() => selectSeat(null)}
              />
            </div>
          )}

          <ActionHistory
            view={view}
            events={hand?.events ?? []}
            nicknameForSeat={nicknameForSeat}
          />
        </aside>
      </div>

      {/*
        The entry tray (ADR-0054). `TRAY_STEADY_HEIGHT` is both the floor AND the cap in every
        state except the award, so in the two states the user moves between constantly —
        palette open, palette gone — the tray is one exact height and the felt/tray boundary
        does not move. That is the half of ADR-0054 `action-dock.spec.ts` pins.

        What changed this round is the SECOND term of that height. It used to be an
        unconditional `18.5rem`, so 296px came out of the felt at every viewport height, and
        below ~637px of viewport the felt was left with less than the seat grid's own natural
        height. The grid does not shrink — its rows are seat cards — so it overflowed downwards
        and the bottom seat row was painted under the tray: at 1024x600 `elementFromPoint` on
        seat 0's stack figure answered `entry-tray`, and at 1280x560 even the keyboard legend
        covered seats 0/1/5. A control the user can see and cannot click is worse than a
        palette that has to be scrolled.

        `100vh - 26.5rem` is what is left for the tray once the felt has what it needs, and
        every term of it is measured on this screen rather than chosen: 59px of header above
        the felt, 61px of action dock below it, and 304px of felt (the seat grid at its natural
        height plus the felt's own `p-2` — 288px with a hand live, 304px between hands, and
        flat across 1024..1440 of width because the grid's height is seat-card content, not
        layout). 59 + 61 + 304 = 424 = 26.5rem exactly. Below that budget the felt is never
        clipped, so the seats and the table centre are always whole and always hit-testable.

        18.5rem stays the number the tray WANTS, for the reason it always was: the palette at
        WP-8's 56x64 hit areas is 274px of grid plus 4px of its own padding, and 296px is that
        plus this section's `py-1.5`. From a 720px viewport up that is exactly what the tray
        gets and the palette is whole with no inner scrolling. Below it the cards drop to
        WP-8's 44x52 floor (`CardPalette`, the same measured breakpoint), which needs 236px,
        and below ~660px even that has to scroll inside the tray. That last state is the honest
        one and not a layout that can be argued away: 220px of grid at the 44x52 minimum, 304px
        of felt and 120px of header and dock is 644px of demand, and a 600px screen does not
        have it. The palette gives way there — never the seats, never the dock.

        The AWARD panel is the documented exception, and the only place the tray is allowed to
        take space the felt wanted. Its submit button is the primary action of the one panel
        that moves money, so it may not land under the dock; `max-h-[26rem]` is its headroom
        and the felt absorbs it, which is exactly what ADR-0054 decided. The inner
        `overflow-y-auto` is the release valve past even that, for a hand with several side
        pots.
      */}
      <section
        data-testid="entry-tray"
        className={`flex ${
          awarding ? TRAY_HEIGHT_AWARD : TRAY_HEIGHT_STEADY
        } shrink-0 items-stretch gap-3 border-t border-surface-700 bg-surface-900 px-3 py-1.5`}
      >
        <HeroCards view={view} heroSeat={table.heroSeat} />
        {/*
          The release valve. Below ~660px of viewport there is not enough screen for the felt,
          the dock AND a 4x13 palette at WP-8's 44x52 floor, so the palette gives way here and
          the last suit rows arrive by scrolling. That is only acceptable if the scroll can be
          SEEN, so the scrollbar is forced to a classic, space-reserving one instead of macOS's
          overlay scrollbar, which stays invisible until something is already moving. A hidden
          scrollbar and an unreachable control are the same thing to a user.

          `scrollbar-gutter: stable` is the half that does the work. `scrollbar-color` alone
          left Chromium on an overlay scrollbar — measured, with the element's `offsetWidth`
          and `clientWidth` still equal while it was genuinely scrolling — and the gutter is
          what makes the browser lay out a real one. It costs a few px of WIDTH, which this row
          has in abundance, and no height at all.
        */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-color:var(--color-surface-500)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]">
          {/* Mounted only while the engine is actually asking for an award. A panel that
              never unmounts keeps its selection state across hands; this one cannot. */}
          {awarding && (
            <AwardPanel
              view={view}
              nicknameForSeat={nicknameForSeat}
              revealSeat={revealSeat}
              onRevealSeat={requestReveal}
            />
          )}
          <CardPalette entry={cardEntry} view={view} />
          {!trayHasEntry && <KeyboardHints />}
        </div>
      </section>

      {/* The dock's hotkeys stand down for the modal overlay for the same reason they stand
          down for the card palette: one keystroke must mean one thing (ADR-0048). */}
      <ActionDock
        view={view}
        hotkeysSuppressed={cardEntry.capturing || analysisOpen}
        skippable={skippable}
        onSkipHand={handleSkipHand}
      />
    </main>
  );
}
