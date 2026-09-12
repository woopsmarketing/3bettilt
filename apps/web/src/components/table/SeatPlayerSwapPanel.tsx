'use client';

/**
 * WP-2 — put a different person in one seat, from the table, in seconds.
 *
 * Two modes over one server call (`replaceSeatPlayerAction`):
 *
 * - **기존 플레이어** — a searchable list. Opening it with an empty query BROWSES the whole
 *   roster (`PlayerMatch.kind === 'BROWSE'`), because "I know their name" and "show me who I
 *   have" are both real ways to find somebody.
 * - **새 플레이어 추가** — a nickname plus the ten external-HUD numbers, typed once, right
 *   here. It sends `requireNew`, so a nickname that already names somebody is REFUSED
 *   (`PLAYER_EXISTS`) instead of quietly reusing them (ADR-0079).
 *
 * ## Three rules this panel exists to keep
 *
 * 1. **One player, at most one seat** (ADR-0076). The server is the authority and refuses a
 *    collision with `PLAYER_ALREADY_SEATED`; this list refuses it FIRST, as a disabled option
 *    with `PLAYER_SWAP_REJECTION_LABEL` beside it. The name is shown-and-refused rather than
 *    filtered away: a name the user is looking for and cannot find reads as a bug. The seat
 *    being replaced is excluded from the check, exactly as the server excludes it, so
 *    re-picking the current occupant is a no-op rather than a self-collision.
 * 2. **No invented stack.** The starting-stack field appears if and ONLY IF the seat is EMPTY,
 *    where there is no number to carry over and the user has to count one. Replacing an
 *    occupant shows no stack field at all — the server refuses one there, and the seat becomes
 *    `확인 필요` instead so the real figure is typed rather than inherited from the last
 *    person to sit there.
 * 3. **"New" means new** (ADR-0079). WHICH CONTROL the user reached for is a fact only this
 *    component has, and the server cannot recover it from the payload — so the mode travels
 *    explicitly as `requireNew`. Under 새 플레이어 추가 a nickname that normalizes onto an
 *    existing player is refused, because reusing them there appends the two or three stats
 *    just typed as a whole new snapshot and ADAPTIVE reads the latest snapshot WHOLE
 *    (ADR-0069) — a ten-stat opponent model collapses to two. The refusal is not a dead end:
 *    this panel switches to 기존 플레이어 with the typed name already in the search box, so
 *    the existing player — and their whole profile — is one click away.
 *
 * The panel never touches the store or the adaptive layer: it collects input, hands it to
 * `onSubmit`, and renders whatever that returns. Everything that happens on success is the
 * caller's (`TableRoot`), which is the only thing that can see the whole table.
 */
import { useEffect, useMemo, useState } from 'react';
import { Money } from '@gto-self/shared';
import type { SeatIndex } from '@gto-self/poker-core';
import { EXTERNAL_HUD_STAT_KEYS, type ExternalHudStatKey } from '@gto-self/player-core';
import type { PlayerMatch, SearchPlayersAction } from '../../lib/session-setup/contract.js';
import type { ExternalHudEntryStats } from '../../lib/table/contract.js';
import { parseExternalHudLine } from '../../lib/table/externalHudLine.js';
import {
  EXTERNAL_HUD_STAT_LABEL,
  EXTERNAL_HUD_UNKNOWN_LABEL,
  PLAYER_EXISTS_GUIDANCE,
  PLAYER_SWAP_CLOSE_LABEL,
  PLAYER_SWAP_CURRENT_LABEL,
  PLAYER_SWAP_EXTERNAL_HUD_HEADING,
  PLAYER_SWAP_LABEL,
  PLAYER_SWAP_NEW_LABEL,
  PLAYER_SWAP_NEW_NICKNAME_LABEL,
  PLAYER_SWAP_NO_MATCHES_LABEL,
  PLAYER_SWAP_PICK_LABEL,
  PLAYER_SWAP_REJECTION_LABEL,
  PLAYER_SWAP_REPLACE_DIRTY_HINT,
  PLAYER_SWAP_SEARCH_LABEL,
  PLAYER_SWAP_STACK_LABEL,
  PLAYER_SWAP_STACK_REQUIRED_HINT,
  PLAYER_SWAP_SUBMIT_LABEL,
  QUICK_HUD_LINE_APPLY_LABEL,
  QUICK_HUD_LINE_LABEL,
  QUICK_HUD_LINE_ORDER_HINT,
  STACK_EDIT_REJECTION_LABEL,
  seatLabel,
} from '../../lib/table/copy.js';
import {
  ExternalHudEntryFields,
  externalHudEntryStats,
  type ExternalHudFormText,
} from './ExternalHudEntryFields.js';

const SEARCH_DEBOUNCE_MS = 120;

/** Exactly one of `playerId` / `nickname`, matching `ReplaceSeatPlayerValue`. */
export interface SeatPlayerSwapSubmit {
  readonly playerId: string | null;
  readonly nickname: string | null;
  /**
   * `true` iff the request came from 새 플레이어 추가 (ADR-0079).
   *
   * Derived from the panel's own mode and from nothing else. It is the ONE bit the server
   * cannot infer: "create a new player" and "use the existing one with this name" produce an
   * identical payload otherwise.
   */
  readonly requireNew: boolean;
  /** Integer milliBB for an EMPTY seat, `null` for a replacement. Never a guess. */
  readonly stack: number | null;
  readonly externalHud: ExternalHudEntryStats;
}

export type SeatPlayerSwapResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message: string;
      /**
       * The server's own code where there was one, so this panel can act on `PLAYER_EXISTS`
       * (ADR-0079) rather than pattern-matching a sentence. Absent for a refusal that never
       * reached the server.
       */
      readonly code?: string;
    };

export interface SeatPlayerSwapPanelProps {
  readonly seat: SeatIndex;
  /** True when the seat holds nobody — the one case that needs a starting stack. */
  readonly seatEmpty: boolean;
  /** The player currently in THIS seat, excluded from the already-seated refusal. */
  readonly currentPlayerId: string | null;
  /** Every player id seated anywhere in this session, mapped to the seat holding them. */
  readonly seatedPlayerSeats: Readonly<Record<string, SeatIndex>>;
  readonly searchPlayers: SearchPlayersAction;
  readonly onSubmit: (input: SeatPlayerSwapSubmit) => Promise<SeatPlayerSwapResult>;
  readonly onClose: () => void;
}

export function SeatPlayerSwapPanel({
  seat,
  seatEmpty,
  currentPlayerId,
  seatedPlayerSeats,
  searchPlayers,
  onSubmit,
  onClose,
}: SeatPlayerSwapPanelProps) {
  const [mode, setMode] = useState<'PICK' | 'NEW'>('PICK');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<readonly PlayerMatch[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [stackText, setStackText] = useState('');
  const [hudText, setHudText] = useState<ExternalHudFormText>({});
  const [hudLineText, setHudLineText] = useState('');
  const [hudLineError, setHudLineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The last submission was refused because the typed nickname already names somebody
   * (ADR-0079). Cleared by the next submission, exactly like `error`.
   */
  const [existingPlayer, setExistingPlayer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlayers(query)
        .then((result) => {
          if (cancelled) return;
          if (result.ok) {
            setMatches(result.matches);
            setSearchError(null);
          } else {
            setMatches([]);
            setSearchError(result.message);
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) setSearchError(cause instanceof Error ? cause.message : String(cause));
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchPlayers]);

  /** `null` = selectable. A seat index = the OTHER seat this player already holds. */
  const seatedElsewhere = (playerId: string): SeatIndex | null => {
    const held = seatedPlayerSeats[playerId];
    if (held === undefined || held === seat) return null;
    return held;
  };

  // The stack is parsed only where it is required, and refused exactly as the store and the
  // server refuse it: unparseable, or not strictly positive.
  const stackRejection = useMemo(() => {
    if (!seatEmpty) return null;
    const parsed = Money.parseBB(stackText);
    if (!parsed.ok) return 'NOT_A_NUMBER' as const;
    if (!Money.isPositive(parsed.value)) return 'NOT_POSITIVE' as const;
    return null;
  }, [seatEmpty, stackText]);

  const stackValue = useMemo<number | null>(() => {
    if (!seatEmpty) return null;
    const parsed = Money.parseBB(stackText);
    return parsed.ok ? parsed.value : null;
  }, [seatEmpty, stackText]);

  // Live parse-and-preview only — never mutates `hudText` on its own, so a failed parse
  // mid-typing never errors out the detailed form below it. `hudText` changes only via
  // `applyHudLine`, on Apply or Enter.
  const hudLinePreview = useMemo(
    () => (hudLineText.trim() === '' ? null : parseExternalHudLine(hudLineText)),
    [hudLineText],
  );

  function applyHudLine(): void {
    const result = parseExternalHudLine(hudLineText);
    if (!result.ok) {
      setHudLineError(result.message);
      return;
    }
    setHudLineError(null);
    setHudText((current) => ({ ...current, ...result.values }));
  }

  const namedSomeone = mode === 'PICK' ? pickedId !== null : nickname.trim() !== '';
  const submittable =
    namedSomeone && !submitting && (!seatEmpty || (stackRejection === null && stackValue !== null));

  async function handleSubmit(): Promise<void> {
    if (!submittable) return;
    setSubmitting(true);
    setError(null);
    setExistingPlayer(false);
    try {
      const typedNickname = nickname.trim();
      const result = await onSubmit({
        playerId: mode === 'PICK' ? pickedId : null,
        nickname: mode === 'NEW' ? typedNickname : null,
        requireNew: mode === 'NEW',
        stack: seatEmpty ? stackValue : null,
        externalHud: mode === 'NEW' ? externalHudEntryStats(hudText) : {},
      });
      // A refusal is shown and NOTHING is undone — the call changed nothing, so there is
      // nothing to revert (design contract WP-2). The server's message is kept verbatim
      // (`CLAUDE.md` rule 3/5); what changes for `PLAYER_EXISTS` is only what the panel does
      // NEXT, which is to put the user in front of the player it just named.
      if (!result.ok) {
        setError(result.message);
        if (result.code === 'PLAYER_EXISTS') {
          setExistingPlayer(true);
          setMode('PICK');
          setQuery(typedNickname);
        }
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      data-testid={`seat-${seat}-swap`}
      aria-label={`${seatLabel(seat)} ${PLAYER_SWAP_LABEL}`}
      className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-md border border-surface-600 bg-surface-800 p-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">
          {seatLabel(seat)} {PLAYER_SWAP_LABEL}
        </h3>
        <button
          type="button"
          data-testid={`seat-${seat}-swap-close`}
          onClick={onClose}
          className="text-[0.65rem] uppercase tracking-widest text-ink-500 hover:text-ink-100"
        >
          {PLAYER_SWAP_CLOSE_LABEL}
        </button>
      </header>

      <div className="flex gap-1 text-[0.65rem]">
        <button
          type="button"
          data-testid={`seat-${seat}-swap-mode-pick`}
          aria-pressed={mode === 'PICK'}
          onClick={() => setMode('PICK')}
          className={`rounded px-1.5 py-0.5 font-semibold ${
            mode === 'PICK' ? 'bg-ink-100 text-surface-900' : 'bg-surface-600 text-ink-500'
          }`}
        >
          {PLAYER_SWAP_PICK_LABEL}
        </button>
        <button
          type="button"
          data-testid={`seat-${seat}-swap-mode-new`}
          aria-pressed={mode === 'NEW'}
          onClick={() => setMode('NEW')}
          className={`rounded px-1.5 py-0.5 font-semibold ${
            mode === 'NEW' ? 'bg-ink-100 text-surface-900' : 'bg-surface-600 text-ink-500'
          }`}
        >
          {PLAYER_SWAP_NEW_LABEL}
        </button>
      </div>

      {mode === 'PICK' && (
        <label className="flex flex-col gap-1 text-[0.65rem] text-ink-500">
          {PLAYER_SWAP_SEARCH_LABEL}
          <input
            type="text"
            data-testid={`seat-${seat}-swap-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-ink-100"
          />
          {searchError !== null && (
            <span data-testid={`seat-${seat}-swap-search-error`} className="text-danger-500">
              {searchError}
            </span>
          )}
          <ul data-testid={`seat-${seat}-swap-matches`} className="flex flex-col gap-0.5">
            {matches.length === 0 && (
              <li className="text-ink-700">{PLAYER_SWAP_NO_MATCHES_LABEL}</li>
            )}
            {matches.map((match) => {
              const held = seatedElsewhere(match.id);
              return (
                <li key={match.id} className="flex flex-col">
                  <button
                    type="button"
                    data-testid={`seat-${seat}-swap-match-${match.id}`}
                    disabled={held !== null}
                    aria-pressed={pickedId === match.id}
                    onClick={() => setPickedId(match.id)}
                    className={`flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-xs ${
                      pickedId === match.id ? 'bg-ink-100 text-surface-900' : 'text-ink-300'
                    } disabled:opacity-40`}
                  >
                    <span className="truncate">{match.nickname}</span>
                    {match.id === currentPlayerId && (
                      <span className="shrink-0 text-[0.6rem]">{PLAYER_SWAP_CURRENT_LABEL}</span>
                    )}
                  </button>
                  {held !== null && (
                    <span
                      data-testid={`seat-${seat}-swap-match-${match.id}-rejection`}
                      className="pl-1 text-[0.6rem] text-dirty-500"
                    >
                      {PLAYER_SWAP_REJECTION_LABEL.ALREADY_SEATED}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </label>
      )}

      {mode === 'NEW' && (
        <>
          <label className="flex flex-col gap-1 text-[0.65rem] text-ink-500">
            {PLAYER_SWAP_NEW_NICKNAME_LABEL}
            <input
              type="text"
              data-testid={`seat-${seat}-swap-nickname`}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="rounded border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-ink-100"
            />
          </label>
          <div className="rounded border border-surface-600 p-1.5">
            <h4 className="text-[0.6rem] uppercase tracking-widest text-ink-500">
              {PLAYER_SWAP_EXTERNAL_HUD_HEADING}
            </h4>

            <label className="flex flex-col gap-1 text-[0.65rem] text-ink-500">
              {QUICK_HUD_LINE_LABEL}
              <input
                type="text"
                data-testid={`seat-${seat}-swap-hud-quickline`}
                value={hudLineText}
                disabled={submitting}
                onChange={(event) => {
                  setHudLineText(event.target.value);
                  setHudLineError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyHudLine();
                  }
                }}
                className="rounded border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-ink-100"
              />
              <span className="text-[0.6rem] text-ink-700">{QUICK_HUD_LINE_ORDER_HINT}</span>
            </label>
            <button
              type="button"
              data-testid={`seat-${seat}-swap-hud-quickline-apply`}
              disabled={submitting}
              onClick={applyHudLine}
              className="mt-1 w-fit rounded border border-surface-600 px-1.5 py-0.5 text-[0.65rem] font-semibold text-ink-100 disabled:opacity-50"
            >
              {QUICK_HUD_LINE_APPLY_LABEL}
            </button>
            {hudLineError !== null && (
              <p
                data-testid={`seat-${seat}-swap-hud-quickline-error`}
                role="alert"
                className="mt-1 text-[0.65rem] text-danger-500"
              >
                {hudLineError}
              </p>
            )}
            {hudLinePreview !== null && hudLinePreview.ok && (
              <ul
                data-testid={`seat-${seat}-swap-hud-quickline-preview`}
                className="mt-1 flex flex-col gap-0.5 text-[0.6rem] text-ink-500"
              >
                {EXTERNAL_HUD_STAT_KEYS.map((key) => {
                  const value = hudLinePreview.values[key];
                  return (
                    <li key={key} className="flex items-baseline justify-between gap-2">
                      <span>{EXTERNAL_HUD_STAT_LABEL[key]}</span>
                      <span className="tabular">
                        {value !== undefined ? `${value}%` : EXTERNAL_HUD_UNKNOWN_LABEL}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <ExternalHudEntryFields
              idPrefix={`seat-${seat}-swap-hud`}
              values={hudText}
              disabled={submitting}
              onChange={(key: ExternalHudStatKey, text: string) =>
                setHudText((current) => ({ ...current, [key]: text }))
              }
            />
          </div>
        </>
      )}

      {seatEmpty ? (
        <label className="flex flex-col gap-1 text-[0.65rem] text-ink-500">
          {PLAYER_SWAP_STACK_LABEL}
          <input
            type="text"
            inputMode="decimal"
            data-testid={`seat-${seat}-swap-stack`}
            value={stackText}
            onChange={(event) => setStackText(event.target.value)}
            className="tabular w-24 rounded border border-surface-600 bg-surface-900 px-1.5 py-0.5 text-xs text-ink-100"
          />
          <span className="text-[0.6rem] text-ink-700">{PLAYER_SWAP_STACK_REQUIRED_HINT}</span>
          {stackText.trim() !== '' && stackRejection !== null && (
            <span data-testid={`seat-${seat}-swap-stack-error`} className="text-danger-500">
              {STACK_EDIT_REJECTION_LABEL[stackRejection]}
            </span>
          )}
        </label>
      ) : (
        <p data-testid={`seat-${seat}-swap-replace-hint`} className="text-[0.6rem] text-ink-700">
          {PLAYER_SWAP_REPLACE_DIRTY_HINT}
        </p>
      )}

      {/* ADR-0079's refusal, turned into the next thing to do. It sits ABOVE the server's own
          sentence rather than replacing it: the guidance is what the user acts on, the server's
          message is the verdict it came from and is never paraphrased away. */}
      {existingPlayer && (
        <p
          data-testid={`seat-${seat}-swap-exists`}
          role="alert"
          className="text-[0.65rem] text-dirty-500"
        >
          {PLAYER_EXISTS_GUIDANCE}
        </p>
      )}

      {error !== null && (
        <p data-testid={`seat-${seat}-swap-error`} role="alert" className="text-[0.65rem] text-danger-500">
          {error}
        </p>
      )}

      <button
        type="button"
        data-testid={`seat-${seat}-swap-submit`}
        disabled={!submittable}
        onClick={() => void handleSubmit()}
        className="w-fit rounded border border-good-500 px-2 py-0.5 text-[0.65rem] font-semibold text-good-500 disabled:border-surface-600 disabled:text-ink-700"
      >
        {PLAYER_SWAP_SUBMIT_LABEL}
      </button>
    </section>
  );
}
