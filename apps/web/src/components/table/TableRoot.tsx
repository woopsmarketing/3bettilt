'use client';

/**
 * The practice table.
 *
 * Composition only. Three rules hold everywhere below:
 *
 * 1. **No poker fact is computed here.** Pot, street, positions, BTN/SB/BB markers, the
 *    actor, legal actions, side pots and every amount are field reads off the `HandView`
 *    that `tableStore` derived with `toView(hand)` (`prompt` D2).
 * 2. **No transition awaits.** Start Hand is a synchronous `poker-core` call inside this
 *    client component; the only `await` in the whole table is the profile panel's server
 *    action, which is not on a hand path (`prompt` D1/D3).
 * 3. **No strategy number.** The right panel says strategy is unavailable rather than
 *    showing a frequency nobody solved for (`CLAUDE.md` rule 2).
 *
 * Props are Phase 4's contract plus `loadPlayerProfile`, the server action the profile
 * panel calls. It arrives as a prop, not an import, so this component and its tests never
 * reach `@gto-self/db`.
 */
import { useCallback, useEffect } from 'react';
import { Money } from '@gto-self/shared';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import type { AutoTopUpPolicy, SeatIndex, TableState } from '@gto-self/poker-core';
import type { IdFactory } from '@gto-self/shared';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import { canStartHand } from '../../lib/table/tableStore.js';
import { slotClassForSeat } from '../../lib/table/layout.js';
import { TableStoreProvider, useTableStore } from './TableStoreProvider.js';
import { SeatCard } from './SeatCard.js';
import { TableCenter } from './TableCenter.js';
import { HeroCards } from './HeroCards.js';
import { CardPalette, useCardEntry } from './CardPalette.js';
import { AwardPanel } from './AwardPanel.js';
import { ActionDock, isTypingTarget } from './ActionDock.js';
import { ActionHistory } from './ActionHistory.js';
import { PlayerProfilePanel } from './PlayerProfilePanel.js';
import { StrategyPanelPlaceholder } from './StrategyPanelPlaceholder.js';

export interface TableRootProps {
  readonly sessionId: string;
  readonly label: string | null;
  readonly table: TableState;
  readonly autoTopUp: AutoTopUpPolicy | null;
  readonly nicknames: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
  /** Server action for the profile panel. Not a hot path. */
  readonly loadPlayerProfile: LoadPlayerProfileAction;
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

  // Phase 7's card entry. It is owned HERE, not inside the palette, because two siblings
  // depend on it: the palette renders it, and the dock is told whether it still owns the
  // keyboard. One piece of state, read by both in the same commit — see `CardPalette.tsx`.
  const cardEntry = useCardEntry({ view, heroSeat: table.heroSeat });

  // `Esc` returns the right panel to its default. This is the ONLY key this phase binds;
  // F / C / R / A / Z belong to Phase 6 and are deliberately absent.
  //
  // It obeys the same two gates the dock's own listener does, because one `Esc` must mean
  // one thing: it is ignored while the user is typing (the raise editor's `Esc` closes the
  // editor and is not also a "clear the panel"), and while the card palette owns the
  // keyboard (ADR-0048 — that `Esc` is the palette's).
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

  return (
    <main className="flex h-screen flex-col bg-surface-900 text-ink-100">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-surface-700 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-tight">{label ?? 'Practice session'}</h1>
        <p className="text-[0.65rem] text-ink-700">
          {table.config.label} · ante {table.config.ante.enabled ? 'on' : 'off'} · hand{' '}
          {table.handNumber}
        </p>
        <button
          type="button"
          data-testid="start-hand"
          disabled={!startable}
          onClick={startHand}
          className="rounded-md border border-good-500 px-3 py-1 text-xs font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
        >
          Start hand
        </button>
        <p className="ml-auto text-[0.6rem] text-ink-700">
          {autoTopUp === null
            ? 'auto top-up: not set'
            : `auto top-up: ${autoTopUp.enabled ? 'on' : 'off'}, to ${Money.formatBB(
                autoTopUp.targetStack,
                { maxDecimals: 3, unit: true },
              )}`}
        </p>
        <p className="tabular text-[0.6rem] text-ink-700">{sessionId}</p>
      </header>

      {/*
        Rule 3: never destroy user input. Phases 4-7 persist the SESSION only — the live
        table, the hand event log, cards and awards are in memory, and a reload discards
        them (ADR-0043; the write boundary is Phase 8 work). Losing entered work is
        survivable when the user knows it is possible; losing it silently is not, so this
        says so plainly rather than letting a reload eat a hand without warning.
      */}
      <p
        data-testid="in-memory-notice"
        className="border-b border-surface-700 px-4 py-1 text-[0.65rem] text-ink-500"
      >
        Practice state is held in this browser tab only. The session is saved; the hand in progress
        is not — reloading this page discards it.
      </p>

      {warnings.length > 0 && (
        <ul
          data-testid="session-warnings"
          className="border-b border-dirty-500 px-4 py-1 text-[0.65rem] text-dirty-500"
        >
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {lastError !== null && (
        <div
          data-testid="engine-error"
          role="alert"
          className="flex items-center gap-3 border-b border-danger-500 px-4 py-1 text-xs text-danger-500"
        >
          <span className="font-semibold">{lastError.code}</span>
          <span>{lastError.message}</span>
          <button
            type="button"
            onClick={dismissError}
            className="ml-auto text-[0.65rem] uppercase tracking-widest"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-[7] flex-col gap-3 p-4">
          <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-3">
            {SEAT_INDEXES.map((seat) => (
              <div
                key={seat}
                className={`${slotClassForSeat(seat, table.heroSeat)} flex items-start`}
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
              </div>
            ))}
            <TableCenter view={view} config={table.config} />
          </div>
          <HeroCards view={view} heroSeat={table.heroSeat} />
        </div>

        <aside className="flex min-h-0 flex-[3] flex-col gap-3 border-l border-surface-700 p-4">
          <div className="rounded-lg border border-surface-700 bg-surface-800 p-3">
            {selectedSeat !== null && selectedPlayerId !== null ? (
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
          <ActionHistory
            view={view}
            events={hand?.events ?? []}
            nicknameForSeat={nicknameForSeat}
          />
        </aside>
      </div>

      <CardPalette entry={cardEntry} view={view} />
      {/* Mounted only while the engine is actually asking for an award. A panel that never
          unmounts keeps its selection state across hands; this one cannot. */}
      {view !== null && view.phase.kind === 'AWAITING_AWARD' && <AwardPanel view={view} />}
      <ActionDock view={view} hotkeysSuppressed={cardEntry.capturing} />
    </main>
  );
}
