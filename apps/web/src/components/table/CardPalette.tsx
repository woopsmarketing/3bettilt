'use client';

/**
 * The 52-card palette — the primary card input (`docs/UX.md`, "Card input").
 *
 * Six rules hold in this file:
 *
 * 1. **The path is local and synchronous.** A click or keystroke builds a `Card` and calls
 *    `store.apply`, which is a plain `poker-core` call. No fetch, no server action, no
 *    `await` anywhere between the input and the render (`prompt` D1).
 * 2. **Dead cards are the engine's.** A card is disabled because it is in `view.deadCards`.
 *    There is no React-side used-card engine: nothing here scans seats or the board
 *    (`prompt` D2). The ONE piece of local card state is `session.picks` — the cards of the
 *    current *unsubmitted* selection, which by definition are not in engine state yet.
 * 3. **The palette opens and closes itself.** `cardEntryRequest(view, heroSeat, revealSeat)`
 *    is the whole lifecycle: it answers HERO while the hero's hole cards are unset, BOARD
 *    while the engine is waiting for a street, REVEAL while the user is recording a hand an
 *    opponent showed at showdown, and `null` otherwise. Submitting the last card
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
 * 6. **One wrong card costs one card** (WP-8: "잘못 고른 카드는 쉽게 해제/교체"). Three gestures
 *    undo exactly one pick and nothing else — `Backspace`, clicking the card again in the grid,
 *    and clicking its chip in the slot row — so fixing the second of three flop cards does not
 *    mean re-entering all three. `Esc` still clears the WHOLE selection and closes the palette,
 *    which is a different instruction and stays available; before this it was the only one a
 *    mouse could reach. A picked card is therefore ENABLED and reads as a strong highlight,
 *    while a card the ENGINE calls dead stays disabled — the two states were previously
 *    indistinguishable to a click and are now as different as they mean.
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
import { resolveTypedKey } from '../../lib/table/keys.js';
import {
  CARD_ENTRY_CLEAR_HINT,
  CARD_ENTRY_KEYBOARD_OWNER_LABEL,
  CARD_ENTRY_OPEN_LABEL,
  cardEntryHeading,
  cardEntryNeededLabel,
  cardEntryRegionLabel,
  cardEntryRemainingLabel,
  cardEntrySelectHeading,
  cardEntrySlotLabel,
  cardEntrySuitPromptLabel,
  cardEntryUnpickLabel,
} from '../../lib/table/copy.js';
import { useTableStore, useTableStoreApi } from './TableStoreProvider.js';

const SUIT_GLYPH: Readonly<Record<string, string>> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/**
 * WP-8's palette copy now lives in `lib/table/copy.ts` with every other Korean string in the
 * app (`cardEntrySelectHeading`, `cardEntrySlotLabel`, `cardEntryRemainingLabel`, ...). It sat
 * in this file only because `copy.ts` had a concurrent writer during WP-8; that writer is
 * finished. Nothing about the palette's behaviour, sizing or test ids changed with the move,
 * and every string still renders exactly the text it did before.
 */

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
  /**
   * Take back exactly ONE unsubmitted pick, leaving every other pick in place. A card that is
   * not in the current selection is a no-op. Never dispatches — an unsubmitted selection has
   * not reached the engine, so there is nothing to undo there.
   */
  unpick(card: Card): void;
  /** `Esc`: discard ALL the unsubmitted picks and close. Never dispatches. */
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
  /**
   * The seat the user said SHOWED at showdown, nominated in `AwardPanel` and owned by
   * `TableRoot`. Omitted/`null` — the usual case — leaves HERO and BOARD entry untouched.
   */
  readonly revealSeat?: SeatIndex | null;
}

export function useCardEntry({
  view,
  heroSeat,
  revealSeat = null,
}: UseCardEntryOptions): CardEntry {
  const api = useTableStoreApi();
  const apply = useTableStore((state) => state.apply);

  const [session, setSession] = useState<PaletteSession>(EMPTY_SESSION);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  /** Which request the user has engaged. Claimed by the user, never read off the DOM. */
  const [engagedKey, setEngagedKey] = useState<string | null>(null);

  const request = cardEntryRequest(view, heroSeat, revealSeat);
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

  const unpick = (card: Card): void => {
    if (request === null) return;
    if (!live.picks.includes(card)) return;
    // The pending rank is dropped with it: it belongs to a half-typed card, and leaving it
    // armed after a mouse correction would make the next suit key complete a rank the user
    // has stopped thinking about.
    setSession({ key, picks: live.picks.filter((pick) => pick !== card), pendingRank: null });
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
    unpick,
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
        className="flex min-w-0 items-center gap-3 pt-1 text-[0.7rem] text-ink-500"
      >
        <span className="uppercase tracking-widest">{cardEntryHeading(request)}</span>
        <span>{cardEntryNeededLabel(request.count)}</span>
        <button
          type="button"
          data-testid="card-palette-open"
          onClick={entry.reopen}
          className="rounded border border-ink-500 px-2 py-0.5 text-ink-300 hover:border-actor-500"
        >
          {CARD_ENTRY_OPEN_LABEL}
        </button>
      </section>
    );
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    // Resolves the physical rank/suit letter regardless of active input method — a Korean
    // IME rewrites `event.key` to a jamo (or to `'Process'` while composing), but never
    // `event.code` (`lib/table/keys.ts`). `Escape` and `Backspace` are named keys with no
    // `KeyX`/`DigitX` code, so the resolver returns `null` for them and `event.key` flows
    // through to `handleKey` unchanged, exactly as before.
    const pressed = resolveTypedKey(event) ?? event.key;
    if (entry.handleKey(pressed)) {
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
      aria-label={cardEntryRegionLabel(request)}
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
      className="flex min-w-0 flex-1 flex-col gap-2 rounded-md outline-none ring-actor-500 focus:ring-1 sm:flex-row sm:items-start sm:gap-3"
    >
      {/*
        The prompt column: WHAT is being asked for, WHICH slot is next, and who owns the
        keyboard.

        It sits BESIDE the grid from `sm:` up rather than above it, and that is a height
        decision, not a cosmetic one. Stacked, the heading and this row cost ~74px of a tray
        that ADR-0054 takes out of the felt — enough, at 1280x720, to push the bottom row of
        seat cards under the tray and make their chips unclickable. The grid is 13 cards wide
        and leaves ~580px of the tray unused horizontally, so the prompt moves into space that
        was already there and the palette becomes as tall as the cards themselves. Below `sm:`
        it stacks again, where the width does not exist.
      */}
      <div className="flex min-w-0 flex-col gap-1 sm:w-56 sm:shrink-0">
        {/* WP-8 requirement 7: what the palette is asking for, in large type, derived only
            from `cardEntryHeading(request)` (`copy.ts`, itself a pure read of `request.kind`
            / `request.street` / `request.seat`). */}
        <p data-testid="card-palette-title" className="text-base font-bold text-ink-100 sm:text-lg">
          {cardEntrySelectHeading(request)}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span data-testid="card-palette-remaining" className="text-ink-300">
            {cardEntryRemainingLabel(remaining)}
          </span>
          {/* WP-8 requirement 8: one slot row — filled slots keep their original `pick-*`
              testid and text; unfilled slots show `[label]` and the very next one to fill
              is marked `data-next` (requirement 9: visible auto-advance). */}
          <span className="flex items-center gap-1.5" data-testid="card-palette-picks">
            {/* Rule 6: a filled slot is a BUTTON, and pressing it takes that one card back.
                The testid and the text are the ones it always had; what changed is that the
                chip showing a wrong card is now the control for removing it. */}
            {entry.picks.map((card) => (
              <button
                key={card}
                type="button"
                data-testid={`pick-${cardToString(card)}`}
                data-filled="true"
                aria-label={cardEntryUnpickLabel(cardToString(card))}
                title={cardEntryUnpickLabel(cardToString(card))}
                onClick={() => {
                  containerRef.current?.focus();
                  entry.engage();
                  entry.unpick(card);
                }}
                className="tabular rounded border-2 border-actor-500 bg-actor-500/20 px-2 py-1 text-sm font-semibold text-ink-100 hover:border-danger-500"
              >
                {cardToString(card)}
              </button>
            ))}
            {Array.from({ length: remaining }, (_, i) => (
              <span
                key={`slot-${entry.picks.length + i}`}
                data-testid={`card-palette-slot-${entry.picks.length + i}`}
                data-filled="false"
                data-next={i === 0 ? 'true' : 'false'}
                className={`tabular rounded border-2 border-dashed px-2 py-1 text-sm text-ink-500 ${
                  i === 0 ? 'border-actor-500 text-actor-500' : 'border-surface-600'
                }`}
              >
                [{cardEntrySlotLabel(request, entry.picks.length + i)}]
              </span>
            ))}
          </span>
          {entry.pendingRank !== null && (
            <span data-testid="card-palette-pending" className="tabular text-actor-500">
              {cardEntrySuitPromptLabel(entry.pendingRank)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 text-ink-700">
            <span data-testid="card-palette-owner">
              {CARD_ENTRY_KEYBOARD_OWNER_LABEL[entry.capturing ? 'PALETTE' : 'DOCK']}
            </span>
            <button
              type="button"
              data-testid="card-palette-cancel"
              onClick={entry.cancel}
              className="rounded border border-surface-600 px-2 py-0.5 text-ink-300 hover:border-danger-500"
            >
              {CARD_ENTRY_CLEAR_HINT}
            </button>
          </span>
        </div>
      </div>

      {/*
        WP-8 requirement 5: the 13-column grid never pushes the DOCUMENT into horizontal
        scroll — anything it cannot fit scrolls inside this box.

        The scrollbar is forced to a classic, space-reserving one rather than the platform's
        overlay scrollbar, which is invisible until something is already scrolling. A row that
        silently overflows a box whose scrollbar cannot be seen is exactly how all four deuces
        ended up unreachable by mouse: the keyboard path still worked, and Playwright's
        `.click()` calls `scrollIntoViewIfNeeded`, so nothing on either side of the test suite
        noticed.

        `scrollbar-gutter: stable` is what actually forces a laid-out scrollbar (measured:
        `scrollbar-color` on its own left Chromium overlaying), and here it costs HEIGHT — the
        gutter sits on the block-end edge, in the same budget the four suit rows come out of.
        So it is reserved only below 1024px, where the row genuinely cannot fit and the space
        is being spent on something real. At 1024 and up the sizing rule below means the grid
        does not overflow at all (measured at every width in the matrix: `scrollWidth` equals
        `clientWidth`), so there is nothing to reserve for.
      */}
      <div className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 pb-1 [scrollbar-color:var(--color-surface-500)_transparent] [scrollbar-width:thin] [@media(max-width:1023px)]:[scrollbar-gutter:stable]">
        <div className="flex w-max flex-col gap-1 [@media(min-width:1152px)_and_(min-height:680px)]:gap-1.5">
          {PALETTE_SUITS.map((suit) => (
            <div
              key={suit}
              className="flex items-center gap-1 [@media(min-width:1152px)_and_(min-height:680px)]:gap-1.5"
            >
              {PALETTE_RANKS.map((rank) => {
                const card = makeCard(rank, suit);
                const picked = entry.picks.includes(card);
                const engineDead = dead.has(card);
                // ONLY the engine's dead cards are unclickable. A card picked in this
                // unsubmitted selection is live and TOGGLES: pressing it again takes it
                // back (rule 6). A duplicate is still impossible — `pick` refuses a card
                // already in the selection and this button never reaches it — but the
                // gesture now means "undo this one" instead of meaning nothing.
                const disabled = engineDead;
                const red = RED_SUITS.includes(suit);
                // Requirement 6: a card already picked THIS selection reads as a strong
                // highlight, not as unavailable — that reading is reserved for a genuinely
                // dead engine card (requirement 5).
                const stateClass = picked
                  ? 'border-actor-500 bg-actor-500/20 text-ink-100 ring-2 ring-actor-500'
                  : engineDead
                    ? 'cursor-not-allowed border-surface-700 bg-surface-800 text-ink-700 opacity-40'
                    : red
                      ? 'border-surface-500 bg-ink-100 text-danger-500 hover:border-actor-500'
                      : 'border-surface-500 bg-ink-100 text-surface-900 hover:border-actor-500';
                return (
                  <button
                    key={card}
                    type="button"
                    data-testid={`palette-${cardToString(card)}`}
                    data-dead={engineDead ? 'true' : 'false'}
                    data-picked={picked ? 'true' : 'false'}
                    disabled={disabled}
                    aria-label={
                      picked ? cardEntryUnpickLabel(cardToString(card)) : `${rank}${suit}`
                    }
                    onClick={() => {
                      // Focus FIRST. Submitting the last card unmounts this very button, and
                      // a browser drops focus to `<body>` when that happens without firing
                      // anything React sees — which is precisely how the palette used
                      // to go deaf while still claiming the keyboard.
                      containerRef.current?.focus();
                      entry.engage();
                      if (picked) entry.unpick(card);
                      else entry.pick(card);
                    }}
                    /*
                      Requirement 1: 44x52 minimum hit area (`h-13 w-11` = 52x44px on
                      Tailwind's default 4px scale), growing to the 48-56px desktop band
                      (`h-16 w-14` = 64x56px) ONLY where both dimensions actually exist.

                      Both halves of that condition are measured. WIDTH: the 56px row is
                      13*56 + 12*6 of gap + 8 of padding = 808px of grid, and the tray leaves
                      the grid `viewport - 309` (the hero-card column, the 224px prompt column
                      and the gaps), so 808px needs a 1117px viewport. The old breakpoint was
                      `sm:` — 640px — so from 640 to 1116 the row was 808px wide inside a box
                      that was not, and it overflowed: at 1024x640 `palette-2s` sat at x
                      1049-1105, past both the scroller and the window, with all four deuces
                      and part of the treys unreachable by mouse. HEIGHT: 4*64 + 3*6 = 274px of
                      grid, and `TableRoot`'s tray can only offer `100vh - 24rem`, so the big
                      row needs a ~676px viewport before the palette would have to scroll
                      inside the tray to hold it.

                      1152 and 680 are those two numbers rounded up to the nearest real screen
                      size, and every viewport in the matrix is clean on both axes at them.
                      Below either one the cards are 44x52, which is WP-8's floor and not a
                      violation of it: 13*44 + 12*4 + 8 = 628px of grid, inside the 715px the
                      tray offers at a 1024px viewport.
                    */
                    className={`tabular flex h-13 w-11 flex-col items-center justify-center gap-0.5 rounded-md border-2 font-bold leading-none transition-colors [@media(min-width:1152px)_and_(min-height:680px)]:h-16 [@media(min-width:1152px)_and_(min-height:680px)]:w-14 ${stateClass}`}
                  >
                    <span className="text-base [@media(min-width:1152px)_and_(min-height:680px)]:text-xl">
                      {rank}
                    </span>
                    <span
                      aria-hidden
                      className="text-sm [@media(min-width:1152px)_and_(min-height:680px)]:text-lg"
                    >
                      {SUIT_GLYPH[suit]}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
