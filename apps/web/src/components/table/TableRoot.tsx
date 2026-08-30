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
 * 3. **No strategy number.** The right panel says strategy is unavailable rather than
 *    showing a frequency nobody solved for (`CLAUDE.md` rule 2).
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
 * (`min-h-[9.5rem]`), not a constant. The card palette and the keyboard legend both fit
 * inside that floor, so the two states the user moves between constantly — palette open,
 * palette gone — change nothing below them. The award panel is taller than either; pinning
 * the tray to the floor put its submit button underneath the dock, hiding the primary
 * action of the one panel that moves money. So the tray grows for it, up to `max-h`, and
 * the extra comes out of the felt above rather than out of the dock below (the felt is the
 * only elastic child, so the dock cannot move). `overflow-y-auto` inside is the release
 * valve past that cap. `action-dock.spec.ts` pins both halves of this: the dock stays in
 * the viewport, and the award button stays clear of it.
 *
 * The hero's hole cards are a permanent rail on the tray's left, so the area a palette
 * fills is always on screen even while the palette is not.
 *
 * ## The right column
 *
 * What it leads with is `rightPanelFor` in `lib/table/rightPanel.ts` — one pure function
 * with its own tests, so Phase 9/10 can replace the strategy placeholder without touching
 * any layout here. The overlap between "hero is to act" and "the user selected a seat" is
 * resolved and documented in that file.
 *
 * Props are Phase 4's contract plus `loadPlayerProfile`, the server action the profile
 * panel calls. It arrives as a prop, not an import, so this component and its tests never
 * reach `@gto-self/db`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Money } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, SeatIndex, TableState } from '@gto-self/poker-core';
import type { IdFactory } from '@gto-self/shared';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import type { UpdateSeatAutoTopUpAction } from '../../lib/session-setup/contract.js';
import { canStartHand } from '../../lib/table/tableStore.js';
import { slotClassForSeat } from '../../lib/table/layout.js';
import { rightPanelFor } from '../../lib/table/rightPanel.js';
import { TableStoreProvider, useTableStore } from './TableStoreProvider.js';
import { SeatCard } from './SeatCard.js';
import { SeatAutoTopUp, type SeatAutoTopUpChange } from './SeatAutoTopUp.js';
import { TableCenter } from './TableCenter.js';
import { HeroCards } from './HeroCards.js';
import { CardPalette, useCardEntry } from './CardPalette.js';
import { AwardPanel } from './AwardPanel.js';
import { ActionDock, isTypingTarget } from './ActionDock.js';
import { ActionHistory } from './ActionHistory.js';
import { KeyboardHints } from './KeyboardHints.js';
import { PlayerProfilePanel } from './PlayerProfilePanel.js';
import { StrategyPanelPlaceholder } from './StrategyPanelPlaceholder.js';

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
  readonly nicknames: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
  /** Server action for the profile panel. Not a hot path. */
  readonly loadPlayerProfile: LoadPlayerProfileAction;
  /**
   * Server action behind the per-seat chips. Optional: without it the preference still
   * applies to this session in this browser, it is simply not persisted.
   */
  readonly updateSeatAutoTopUp?: UpdateSeatAutoTopUpAction;
  /** Deterministic ids for tests. The app leaves it out and gets `cryptoIdFactory`. */
  readonly ids?: IdFactory;
}

export function TableRoot(props: TableRootProps) {
  return (
    <TableStoreProvider
      init={{
        sessionId: props.sessionId,
        table: props.table,
        autoTopUp: props.autoTopUp,
        seatAutoTopUp: props.seatAutoTopUp,
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
  updateSeatAutoTopUp,
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

  // Phase 7's card entry. It is owned HERE, not inside the palette, because two siblings
  // depend on it: the palette renders it, and the dock is told whether it still owns the
  // keyboard. One piece of state, read by both in the same commit — see `CardPalette.tsx`.
  const cardEntry = useCardEntry({ view, heroSeat: table.heroSeat, revealSeat });

  // `Esc` returns the right panel to its default. This is the ONLY key this phase binds;
  // F / C / R / A / Z belong to Phase 6 and are deliberately absent.
  //
  // It obeys the same two gates the dock's own listener does, because one `Esc` must mean
  // one thing: it is ignored while the user is typing (the raise editor's `Esc` closes the
  // editor and is not also a "clear the panel"), and while the card palette owns the
  // keyboard (ADR-0048 — that `Esc` is the palette's). Unchanged by the Korean-first pass.
  const paletteOwnsKeyboard = cardEntry.capturing;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (paletteOwnsKeyboard) return;
      selectSeat(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectSeat, paletteOwnsKeyboard]);

  const nicknameForSeat = useCallback(
    (seat: SeatIndex): string | null => {
      const playerId = table.seats[seat].playerId;
      return playerId === null ? null : (nicknames[playerId] ?? null);
    },
    [table, nicknames],
  );

  const selectedPlayerId = selectedSeat === null ? null : table.seats[selectedSeat].playerId;

  // The right column's priority. Both inputs are field reads: whether HERO is the seat the
  // engine put on the clock, and which seat the user explicitly selected.
  const heroIsActor =
    table.heroSeat !== null && view !== null && view.seats[table.heroSeat].isActor;
  const panel = rightPanelFor({
    selectedPlayerSeat: selectedPlayerId === null ? null : selectedSeat,
    heroIsActor,
  });

  const awarding = view !== null && view.phase.kind === 'AWAITING_AWARD';
  // The tray holds exactly one thing at a time: the palette, the award panel, or — when the
  // engine is asking for neither — the keyboard legend. The first and the last fit inside the
  // tray's floor; the award panel is what grows it (see the layout note at the top).
  const trayHasEntry = awarding || cardEntry.request !== null;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-surface-900 text-ink-100">
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-surface-700 px-3 py-1.5">
        <h1 className="text-sm font-semibold tracking-tight">{label ?? '연습 세션'}</h1>
        <p className="text-[0.6rem] text-ink-700">
          {table.config.label} · 앤티 {table.config.ante.enabled ? '켬' : '끔'} · 핸드{' '}
          {table.handNumber}
        </p>
        <button
          type="button"
          data-testid="start-hand"
          disabled={!startable}
          onClick={startHand}
          className="self-center rounded border border-good-500 px-2.5 py-0.5 text-xs font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
        >
          핸드 시작
        </button>

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

      {/* The engine's own code and message, verbatim (`CLAUDE.md` rule 3). */}
      {lastError !== null && (
        <div
          data-testid="engine-error"
          role="alert"
          className="flex shrink-0 items-center gap-3 border-b border-danger-500 px-3 py-0.5 text-xs text-danger-500"
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
        </div>
      )}

      {/* The ONLY elastic row. Everything below it is `shrink-0`, so this is what gives
          when the viewport is short — the action dock never is. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-[7] flex-col p-2">
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
                />
                {/* Under the card, not inside it: `SeatCard`'s root is a `<button>`, and a
                    button cannot contain the chip's own buttons. An empty seat has no
                    preference to hold. */}
                {table.seats[seat].occupancy !== 'EMPTY' && (
                  <SeatAutoTopUp
                    seat={seat}
                    policy={seatAutoTopUp[seat] ?? null}
                    defaultTarget={table.config.referenceStack}
                    onChange={handleSeatAutoTopUp}
                  />
                )}
              </div>
            ))}
            <TableCenter view={view} config={table.config} />
          </div>
        </div>

        <aside
          data-testid="right-panel"
          data-panel={panel}
          className="flex min-h-0 flex-[3] flex-col gap-2 border-l border-surface-700 p-2"
        >
          {/* Exactly one of these leads the column; the log always fills what is left. */}
          {panel !== 'HISTORY' && (
            // A long profile scrolls INSIDE its own box rather than squeezing the log to
            // nothing or spilling out of the clipped column.
            <div className="max-h-[55%] shrink-0 overflow-y-auto rounded-md border border-surface-700 bg-surface-800 p-2">
              {panel === 'PLAYER' && selectedSeat !== null && selectedPlayerId !== null ? (
                <PlayerProfilePanel
                  playerId={selectedPlayerId}
                  nickname={nicknameForSeat(selectedSeat)}
                  loadProfile={loadPlayerProfile}
                  onClose={() => selectSeat(null)}
                />
              ) : (
                <StrategyPanelPlaceholder />
              )}
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
        The entry tray. `min-h` is what stops the action dock moving and the felt resizing
        as the palette opens and closes — the palette and the keyboard legend both fit
        inside that floor, so neither changes the layout.

        It is a FLOOR, not a fixed height, because the award panel is taller than the
        palette: pinned at exactly `9.5rem` its submit button lands under the dock, which
        hides the primary action of the one panel that moves money. Growing instead takes
        the difference from the felt above (which is mostly empty space) and never from the
        dock, which stays pinned to the bottom because the felt row is the only elastic
        child of this screen. `max-h` plus the inner `overflow-y-auto` is the release valve
        for a hand with several side pots.
      */}
      <section
        data-testid="entry-tray"
        className="flex max-h-[17rem] min-h-[9.5rem] shrink-0 items-stretch gap-3 border-t border-surface-700 bg-surface-900 px-3 py-1.5"
      >
        <HeroCards view={view} heroSeat={table.heroSeat} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto">
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

      <ActionDock view={view} hotkeysSuppressed={cardEntry.capturing} />
    </main>
  );
}
