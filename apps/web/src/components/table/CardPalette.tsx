'use client';

/**
 * The 52-card palette — the primary card input (`docs/UX.md`, "Card input").
 *
 * Five rules hold in this file:
 *
 * 1. **The path is local and synchronous.** A click or keystroke builds a `Card` and calls
 *    `store.apply`, which is a plain `poker-core` call. No fetch, no server action, no
 *    `await` anywhere between the input and the render (`prompt` D1).
 * 2. **Dead cards are the engine's.** A card is disabled because it is in `view.deadCards`.
 *    There is no React-side used-card engine: nothing here scans seats or the board
 *    (`prompt` D2). The ONE piece of local card state is `session.picks` — the cards of the
 *    current *unsubmitted* selection, which by definition are not in engine state yet.
 * 3. **The palette opens and closes itself.** `cardEntryRequest(view, heroSeat)` is the
 *    whole lifecycle: it answers HERO while the hero's hole cards are unset, BOARD while
 *    the engine is waiting for a street, and `null` otherwise. Submitting the last card
 *    changes engine state, which changes that answer, which closes the palette. There is
 *    no "Go to flop" button and no close timer.
 * 4. **One keyboard owner, decided by EXPLICIT state.** `engagedKey` is set when the user
 *    actually engages the palette — a click on a card, or focus reaching the region — and
 *    cleared on `Esc`, on submit (the request key changes) and when focus genuinely leaves
 *    the palette. It is deliberately NOT read back off `document.activeElement`: focus can
 *    be lost to `<body>` with no event React observes (disabling the button that was just
 *    clicked does exactly that), which would leave `capturing` true while the palette was
 *    deaf — the zero-owner state ADR-0048 forbids. Because ownership is claimed rather than
 *    observed, the palette also puts focus back on its own region after every pick, so
 *    "the palette owns the keyboard" and "the palette can hear the keyboard" stay the same
 *    fact. `capturing` is passed to `ActionDock` as `hotkeysSuppressed`; both components
 *    read it out of the same React commit, so `A` is either an ace or All-in — never both,
 *    and never a function of which listener ran first. This component adds NO window
 *    listener; its keys arrive through React's own `onKeyDown` on the palette region.
 * 5. **User input is never destroyed.** A selection the engine refuses stays on screen with
 *    the engine's reason in the error banner (`CLAUDE.md` rule 3); only `Esc` and `Clear`
 *    discard picks, and neither dispatches.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cardToString, makeCard, type Card, type Rank } from '@gto-self/shared';
import type { HandView, SeatIndex } from '@gto-self/poker-core';
import {
  PALETTE_RANKS,
  PALETTE_SUITS,
  RED_SUITS,
  cardEntryRequest,
  commandForCards,
  rankForKey,
  suitForKey,
  type CardEntryRequest,
} from '../../lib/table/cardEntry.js';
import { useTableStore, useTableStoreApi } from './TableStoreProvider.js';

const SUIT_GLYPH: Readonly<Record<string, string>> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/**
 * The current unsubmitted selection. `key` ties it to one request, so a new street or a
 * new hand starts empty without an effect having to clear anything.
 */
interface PaletteSession {
  readonly key: string | null;
  readonly picks: readonly Card[];
  readonly pendingRank: Rank | null;
}

const EMPTY_SESSION: PaletteSession = { key: null, picks: [], pendingRank: null };

export interface CardEntry {
  readonly request: CardEntryRequest | null;
  /** The palette is on screen and asking for cards. */
  readonly open: boolean;
  /** The palette owns the keyboard right now. Suppresses the dock's hotkey layer. */
  readonly capturing: boolean;
  readonly picks: readonly Card[];
  readonly pendingRank: Rank | null;
  pick(card: Card): void;
  /** Handles one key. Returns true when the palette consumed it. */
  handleKey(key: string): boolean;
  /** `Esc`: discard the unsubmitted picks and close. Never dispatches. */
  cancel(): void;
  reopen(): void;
  /** The user engaged the palette: it takes the keyboard from the dock. */
  engage(): void;
  /** The user left the palette: the dock takes the keyboard back. */
  release(): void;
}

export interface UseCardEntryOptions {
  readonly view: HandView | null;
  readonly heroSeat: SeatIndex | null;
}

export function useCardEntry({ view, heroSeat }: UseCardEntryOptions): CardEntry {
  const api = useTableStoreApi();
  const apply = useTableStore((state) => state.apply);

  const [session, setSession] = useState<PaletteSession>(EMPTY_SESSION);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  /** Which request the user has engaged. Claimed by the user, never read off the DOM. */
  const [engagedKey, setEngagedKey] = useState<string | null>(null);

  const request = cardEntryRequest(view, heroSeat);
  const key = request?.key ?? null;
  // Everything below is scoped to the CURRENT request key, so state belonging to a
  // finished session can never leak into the next one.
  const live = session.key === key ? session : EMPTY_SESSION;
  const open = request !== null && dismissedKey !== key;
  // Submitting a selection changes the request key, which drops ownership without an
  // effect having to clear it: the dock owns the keyboard again the instant the palette
  // has what it asked for.
  const capturing = open && key !== null && engagedKey === key;

  const cancel = (): void => {
    setSession(EMPTY_SESSION);
    setDismissedKey(key);
    setEngagedKey(null);
  };

  const pick = (card: Card): void => {
    if (request === null) return;
    // The one local dead-card check: a card already picked in THIS unsubmitted session is
    // not in engine state yet, so `view.deadCards` cannot know about it.
    if (live.picks.includes(card)) return;

    const next = [...live.picks, card];
    if (next.length < request.count) {
      setSession({ key, picks: next, pendingRank: null });
      return;
    }

    const before = api.getState().hand;
    apply(commandForCards(request, next));
    // The store leaves `hand` untouched on a rejection and sets `lastError`, which the
    // table renders. A refused selection is KEPT so the user can see what was refused.
    const refused = api.getState().hand === before;
    setSession({ key, picks: refused ? next : [], pendingRank: null });
  };

  const handleKey = (pressed: string): boolean => {
    if (request === null) return false;

    if (pressed === 'Escape') {
      cancel();
      return true;
    }
    if (pressed === 'Backspace') {
      setSession(
        live.pendingRank !== null
          ? { key, picks: live.picks, pendingRank: null }
          : { key, picks: live.picks.slice(0, -1), pendingRank: null },
      );
      return true;
    }

    const rank = rankForKey(pressed);
    if (rank !== null) {
      setSession({ key, picks: live.picks, pendingRank: rank });
      return true;
    }
    const suit = suitForKey(pressed);
    if (suit !== null) {
      // A suit alone means nothing: card entry is rank-then-suit, always two keys.
      if (live.pendingRank === null) return true;
      pick(makeCard(live.pendingRank, suit));
      return true;
    }
    return false;
  };

  return {
    request,
    open,
    capturing,
    picks: live.picks,
    pendingRank: live.pendingRank,
    pick,
    handleKey,
    cancel,
    reopen: () => setDismissedKey(null),
    engage: () => setEngagedKey(key),
    release: () => setEngagedKey(null),
  };
}

export interface CardPaletteProps {
  readonly entry: CardEntry;
  readonly view: HandView | null;
}

export function CardPalette({ entry, view }: CardPaletteProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const request = entry.request;
  if (request === null || view === null) return null;

  // The engine's dead-card set, verbatim. Nothing is added to it except the current
  // unsubmitted picks, which engine state has not seen yet.
  const dead = new Set<Card>(view.deadCards);
  const remaining = request.count - entry.picks.length;

  if (!entry.open) {
    return (
      <section
        data-testid="card-palette-closed"
        className="flex items-center gap-3 border-t border-surface-700 bg-surface-900 px-4 py-2 text-[0.7rem] text-ink-500"
      >
        <span className="uppercase tracking-widest">{request.label}</span>
        <span>
          {request.count} card{request.count === 1 ? '' : 's'} still needed
        </span>
        <button
          type="button"
          data-testid="card-palette-open"
          onClick={entry.reopen}
          className="rounded border border-ink-500 px-2 py-0.5 text-ink-300 hover:border-actor-500"
        >
          Enter cards
        </button>
      </section>
    );
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (entry.handleKey(event.key)) {
      // Consumed by the palette. The dock's window listener also sees this event, and is
      // inert because `capturing` is true in the same commit — not because of this call.
      event.preventDefault();
      if (event.key === 'Escape') containerRef.current?.blur();
    }
  };

  return (
    <section
      ref={containerRef}
      data-testid="card-palette"
      data-capturing={entry.capturing ? 'true' : 'false'}
      data-needed={remaining}
      aria-label={`Card palette — ${request.label}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => entry.engage()}
      onBlur={(event) => {
        // Only a move to something OUTSIDE the palette hands the keyboard back. A move
        // between the palette's own controls — including the region itself, which a pick
        // focuses — keeps it. `relatedTarget` is null when focus goes nowhere, which is a
        // genuine departure.
        const next = event.relatedTarget as Node | null;
        if (next !== null && containerRef.current?.contains(next) === true) return;
        entry.release();
      }}
      className="flex flex-col gap-2 border-t border-surface-700 bg-surface-900 px-4 py-2 outline-none focus:border-actor-500"
    >
      <div className="flex items-center gap-3 text-[0.7rem]">
        <span className="uppercase tracking-widest text-ink-500">{request.label}</span>
        <span data-testid="card-palette-remaining" className="text-ink-300">
          needs {remaining} more card{remaining === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1" data-testid="card-palette-picks">
          {entry.picks.map((card) => (
            <span
              key={card}
              data-testid={`pick-${cardToString(card)}`}
              className="tabular rounded bg-surface-700 px-1.5 py-0.5 text-ink-100"
            >
              {cardToString(card)}
            </span>
          ))}
        </span>
        {entry.pendingRank !== null && (
          <span data-testid="card-palette-pending" className="tabular text-actor-500">
            {entry.pendingRank}? — press a suit (s h d c)
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-ink-700">
          <span data-testid="card-palette-owner">
            {entry.capturing ? 'keyboard: palette' : 'keyboard: action dock'}
          </span>
          <button
            type="button"
            data-testid="card-palette-cancel"
            onClick={entry.cancel}
            className="rounded border border-surface-600 px-2 py-0.5 text-ink-300 hover:border-danger-500"
          >
            Esc — clear
          </button>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {PALETTE_SUITS.map((suit) => (
          <div key={suit} className="flex items-center gap-1">
            {PALETTE_RANKS.map((rank) => {
              const card = makeCard(rank, suit);
              const picked = entry.picks.includes(card);
              const disabled = dead.has(card) || picked;
              const red = RED_SUITS.includes(suit);
              return (
                <button
                  key={card}
                  type="button"
                  data-testid={`palette-${cardToString(card)}`}
                  data-dead={dead.has(card) ? 'true' : 'false'}
                  disabled={disabled}
                  aria-label={`${rank}${suit}`}
                  onClick={() => {
                    // Focus FIRST. The pick disables this very button, and a browser drops
                    // focus to `<body>` when that happens without firing anything React
                    // sees — which is precisely how the palette used to go deaf while
                    // still claiming the keyboard.
                    containerRef.current?.focus();
                    entry.engage();
                    entry.pick(card);
                  }}
                  className={`tabular h-7 w-9 rounded border text-xs font-semibold ${
                    disabled
                      ? 'border-surface-700 bg-surface-800 text-ink-700'
                      : red
                        ? 'border-surface-500 bg-ink-100 text-danger-500 hover:border-actor-500'
                        : 'border-surface-500 bg-ink-100 text-surface-900 hover:border-actor-500'
                  }`}
                >
                  {rank}
                  <span aria-hidden>{SUIT_GLYPH[suit]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
