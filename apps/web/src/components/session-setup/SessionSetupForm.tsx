'use client';

/**
 * The session-setup screen: six seats, a preset, a Hero, a button and a Start.
 *
 * INLINE, never modal (`docs/UX.md`). Everything is a plain form control in one tab order,
 * so the whole session can be configured without touching the mouse.
 *
 * Two things this component deliberately does NOT do:
 *
 * - **It decides no poker rule.** Whether the table is playable is `poker-core`'s verdict,
 *   obtained by running the same pure builder the server runs (`buildSessionTable`) and
 *   showing whatever the engine said, code and all.
 * - **It computes no authoritative money.** `Money.parseBB` runs here only to draw inline
 *   feedback; the entered TEXT is what is submitted, and the server re-parses it.
 *
 * The server actions arrive as PROPS rather than imports: a `'use server'` module reaches
 * `@gto-self/db` and a native SQLite binding, which must never be reachable from a client
 * bundle or from this component's test.
 */
import { useEffect, useMemo, useState } from 'react';
import { Money } from '@gto-self/shared';
import { HUD_STAT_KEYS } from '@gto-self/player-core';
import type { HudStatKey } from '@gto-self/player-core';
import { CP_NL50_6MAX_ANTE, PRESETS, SEAT_INDEXES, isSeatIndex } from '@gto-self/poker-core';
import type { SeatIndex } from '@gto-self/poker-core';
import type {
  FormIssue,
  PlayerMatch,
  SearchPlayersAction,
  SeatFormValue,
  SeatOccupancyChoice,
  SessionFormValue,
  StartSessionAction,
} from '../../lib/session-setup/contract.js';
import { SEAT_OCCUPANCY_CHOICES } from '../../lib/session-setup/contract.js';
import {
  buildSessionTable,
  findPreset,
  initialSessionForm,
  previewPlayerId,
} from '../../lib/session-setup/plan.js';

export interface SessionSetupFormProps {
  readonly startSession: StartSessionAction;
  readonly searchPlayers: SearchPlayersAction;
  /** Called with the new session id once the write succeeded. */
  readonly onStarted: (sessionId: string) => void;
  /** Overrides the opening form. Tests use it; the route does not. */
  readonly initialForm?: SessionFormValue;
}

const OCCUPANCY_LABEL: Readonly<Record<SeatOccupancyChoice, string>> = {
  ACTIVE: 'Active',
  SITTING_OUT: 'Sitting out',
  EMPTY: 'Empty',
};

const HUD_LABEL: Readonly<Record<HudStatKey, string>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: '3-bet',
  FOLD_TO_THREE_BET: 'Fold to 3-bet',
  CBET_FLOP: 'C-bet flop',
  FOLD_TO_CBET_FLOP: 'Fold to c-bet',
  WTSD: 'WTSD',
  WON_AT_SHOWDOWN: 'W$SD',
};

/** The MVP target: CoinPoker-style NL50 6-max with the ante on. */
const DEFAULT_PRESET = CP_NL50_6MAX_ANTE;

const field =
  'w-full rounded border border-surface-600 bg-surface-900 px-2 py-1 text-sm text-ink-100 ' +
  'outline-none focus:border-hero-500 disabled:opacity-40';

/** How long typing settles before the autocomplete asks the server. */
const SEARCH_DEBOUNCE_MS = 200;

export function SessionSetupForm({
  startSession,
  searchPlayers,
  onStarted,
  initialForm,
}: SessionSetupFormProps) {
  const [form, setForm] = useState<SessionFormValue>(
    () => initialForm ?? initialSessionForm(DEFAULT_PRESET),
  );
  const [serverIssues, setServerIssues] = useState<readonly FormIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [suggestSeat, setSuggestSeat] = useState<SeatIndex | null>(null);
  const [matches, setMatches] = useState<readonly PlayerMatch[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  /**
   * The whole form run through the ENGINE, on every keystroke and with no network call.
   * `previewPlayerId` stands in for ids the client is not allowed to invent — the server
   * resolves the real ones.
   */
  const preview = useMemo(() => buildSessionTable(form, previewPlayerId), [form]);
  const issues: readonly FormIssue[] = preview.ok ? serverIssues : preview.issues;
  const blockingIssue = issues[0];

  function update(next: SessionFormValue): void {
    setServerIssues([]);
    setForm(next);
  }

  function updateSeat(seat: SeatIndex, patch: Partial<SeatFormValue>): void {
    update({
      ...form,
      seats: form.seats.map((value, index) => (index === seat ? { ...value, ...patch } : value)),
    });
  }

  const suggestQuery = suggestSeat === null ? '' : (form.seats[suggestSeat]?.nickname.trim() ?? '');

  useEffect(() => {
    if (suggestSeat === null || suggestQuery === '') {
      setMatches([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlayers(suggestQuery)
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
        .catch((error: unknown) => {
          if (!cancelled) setSearchError(error instanceof Error ? error.message : String(error));
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [suggestSeat, suggestQuery, searchPlayers]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!preview.ok || submitting) return;
    setSubmitting(true);
    setServerIssues([]);
    try {
      const result = await startSession(form);
      if (result.ok) onStarted(result.sessionId);
      else setServerIssues(result.issues);
    } catch (error: unknown) {
      setServerIssues([
        {
          seat: null,
          field: 'form',
          message: `the session could not be started: ${error instanceof Error ? error.message : String(error)}`,
          code: null,
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  const seatIssues = (seat: SeatIndex) => issues.filter((entry) => entry.seat === seat);
  const formIssues = issues.filter((entry) => entry.seat === null);
  const preset = findPreset(form.presetId);

  return (
    <form onSubmit={(event) => void submit(event)} className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New session</h1>
        <p className="mt-1 text-sm text-ink-500">
          Configure the table you are going to practise on. Nothing here is connected to a poker
          client.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-surface-700 bg-surface-800 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-500">Game</h2>
        <div className="grid grid-cols-[minmax(0,20rem)_auto_minmax(0,1fr)] items-end gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Preset</span>
            <select
              className={field}
              value={form.presetId}
              onChange={(event) => {
                const next = findPreset(event.target.value);
                update({
                  ...form,
                  presetId: event.target.value,
                  anteEnabled: next === undefined ? form.anteEnabled : next.ante.enabled,
                });
              }}
            >
              {PRESETS.map((entry) => (
                <option key={entry.presetId} value={entry.presetId}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 pb-1 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={form.anteEnabled}
              onChange={(event) => update({ ...form, anteEnabled: event.target.checked })}
            />
            <span>
              Ante
              {preset !== undefined && (
                <span className="tabular ml-2 text-ink-500">
                  {Money.formatBB(preset.ante.amount, { maxDecimals: 3, unit: true })} / player
                </span>
              )}
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Label (optional)</span>
            <input
              className={field}
              value={form.label}
              placeholder="Tuesday grind"
              onChange={(event) => update({ ...form, label: event.target.value })}
            />
          </label>
        </div>

        {preset !== undefined && (
          <p className="tabular mt-3 text-xs text-ink-500">
            Blinds {Money.formatBB(preset.blinds.smallBlind)} /{' '}
            {Money.formatBB(preset.blinds.bigBlind)} BB · reference stack{' '}
            {Money.formatBB(preset.referenceStack, { unit: true })}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-surface-700 bg-surface-800 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-500">Seats</h2>
        <div className="grid grid-cols-[3rem_9rem_minmax(0,1fr)_7rem_3.5rem_3.5rem] items-center gap-3 pb-2 text-xs uppercase tracking-wider text-ink-700">
          <span>Seat</span>
          <span>Occupancy</span>
          <span>Player</span>
          <span>Stack (BB)</span>
          <span className="text-center">Hero</span>
          <span className="text-center">BTN</span>
        </div>

        <ul className="divide-y divide-surface-700">
          {SEAT_INDEXES.map((seat) => {
            const value = form.seats[seat];
            if (value === undefined) return null;
            const disabled = value.occupancy === 'EMPTY';
            const parsed = Money.parseBB(value.stackText);
            const rowIssues = seatIssues(seat);
            return (
              <li key={seat} className="py-2">
                <div className="grid grid-cols-[3rem_9rem_minmax(0,1fr)_7rem_3.5rem_3.5rem] items-center gap-3">
                  <span className="tabular text-sm text-ink-500">{seat + 1}</span>

                  <select
                    aria-label={`Seat ${seat + 1} occupancy`}
                    className={field}
                    value={value.occupancy}
                    onChange={(event) =>
                      updateSeat(seat, {
                        occupancy: event.target.value as SeatOccupancyChoice,
                        ...(event.target.value === 'EMPTY' ? { isHero: false } : {}),
                      })
                    }
                  >
                    {SEAT_OCCUPANCY_CHOICES.map((choice) => (
                      <option key={choice} value={choice}>
                        {OCCUPANCY_LABEL[choice]}
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <input
                      aria-label={`Seat ${seat + 1} nickname`}
                      className={field}
                      autoComplete="off"
                      disabled={disabled}
                      value={value.nickname}
                      placeholder="nickname"
                      onFocus={() => setSuggestSeat(seat)}
                      onBlur={() => window.setTimeout(() => setSuggestSeat(null), 150)}
                      onChange={(event) =>
                        // Typing means the pick no longer stands: the id is dropped and the
                        // nickname is resolved by name again on submit.
                        updateSeat(seat, { nickname: event.target.value, existingPlayerId: null })
                      }
                    />
                    {value.existingPlayerId !== null && (
                      <span className="absolute right-2 top-1.5 text-xs text-good-500">known</span>
                    )}
                    {suggestSeat === seat && suggestQuery !== '' && (
                      <div className="absolute z-10 mt-1 w-full rounded border border-surface-600 bg-surface-900 shadow-lg">
                        {searchError !== null && (
                          <p className="px-2 py-1 text-xs text-danger-500">{searchError}</p>
                        )}
                        {searchError === null && matches.length === 0 && (
                          <p className="px-2 py-1 text-xs text-ink-700">
                            no existing player matches — a new one will be created
                          </p>
                        )}
                        {matches.map((match) => (
                          <button
                            key={match.id}
                            type="button"
                            className="block w-full px-2 py-1 text-left text-sm hover:bg-surface-700"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              updateSeat(seat, {
                                nickname: match.nickname,
                                existingPlayerId: match.id,
                              });
                              setSuggestSeat(null);
                            }}
                          >
                            {match.nickname}
                            <span className="ml-2 text-xs text-ink-700">
                              {match.kind.toLowerCase()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <input
                      aria-label={`Seat ${seat + 1} stack in BB`}
                      className={`${field} tabular`}
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={disabled}
                      value={value.stackText}
                      onChange={(event) => updateSeat(seat, { stackText: event.target.value })}
                    />
                    {!disabled && parsed.ok && (
                      <span className="tabular mt-0.5 block text-[11px] text-ink-700">
                        {parsed.value} milliBB
                      </span>
                    )}
                  </div>

                  <span className="text-center">
                    <input
                      type="radio"
                      name="heroSeat"
                      aria-label={`Seat ${seat + 1} is Hero`}
                      disabled={disabled}
                      checked={value.isHero}
                      onChange={() =>
                        update({
                          ...form,
                          seats: form.seats.map((entry, index) => ({
                            ...entry,
                            isHero: index === seat,
                          })),
                        })
                      }
                    />
                  </span>

                  <span className="text-center">
                    <input
                      type="radio"
                      name="buttonSeat"
                      aria-label={`Seat ${seat + 1} has the button`}
                      disabled={disabled}
                      checked={form.buttonSeat === seat}
                      onChange={() => update({ ...form, buttonSeat: seat })}
                    />
                  </span>
                </div>

                {!disabled && (
                  <details className="mt-1 ml-[12rem] text-xs text-ink-500">
                    <summary className="cursor-pointer select-none">
                      HUD snapshot (optional)
                    </summary>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {HUD_STAT_KEYS.map((key) => (
                        <label key={key} className="block">
                          <span className="mb-0.5 block text-[11px] text-ink-700">
                            {HUD_LABEL[key]} %
                          </span>
                          <input
                            aria-label={`Seat ${seat + 1} ${HUD_LABEL[key]}`}
                            className={`${field} tabular`}
                            autoComplete="off"
                            value={value.hud[key] ?? ''}
                            onChange={(event) =>
                              updateSeat(seat, { hud: { ...value.hud, [key]: event.target.value } })
                            }
                          />
                        </label>
                      ))}
                      <label className="block">
                        <span className="mb-0.5 block text-[11px] text-ink-700">HUD hands</span>
                        <input
                          aria-label={`Seat ${seat + 1} HUD hands`}
                          className={`${field} tabular`}
                          autoComplete="off"
                          value={value.hudHandsText}
                          onChange={(event) =>
                            updateSeat(seat, { hudHandsText: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-700">
                      What a third-party HUD displayed, as you typed it. Never required, never
                      averaged with anything we counted ourselves.
                    </p>
                  </details>
                )}

                {rowIssues.map((entry) => (
                  <p
                    key={`${entry.field}-${entry.message}`}
                    className="mt-1 ml-[12rem] text-xs text-danger-500"
                  >
                    {entry.message}
                    {entry.code !== null && <span className="ml-2 text-ink-700">{entry.code}</span>}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-6 rounded-lg border border-surface-700 bg-surface-800 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-500">
          Auto top-up
        </h2>
        <div className="flex items-end gap-6">
          <label className="flex items-center gap-2 pb-1 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={form.autoTopUpEnabled}
              onChange={(event) => update({ ...form, autoTopUpEnabled: event.target.checked })}
            />
            Top short stacks back up between hands
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Target stack (BB)</span>
            <input
              aria-label="Auto top-up target stack in BB"
              className={`${field} tabular w-40`}
              inputMode="decimal"
              disabled={!form.autoTopUpEnabled}
              value={form.autoTopUpTargetText}
              onChange={(event) => update({ ...form, autoTopUpTargetText: event.target.value })}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-700">
          Phase 4 stores the target only; the separate top-up threshold arrives with the observe /
          dirty-stack flow.
        </p>
      </section>

      <footer className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!preview.ok || submitting}
          className="rounded bg-hero-500 px-4 py-2 text-sm font-medium text-surface-900 disabled:cursor-not-allowed disabled:bg-surface-600 disabled:text-ink-700"
          aria-describedby="start-session-reason"
        >
          {submitting ? 'Starting…' : 'Start Session'}
        </button>
        <div id="start-session-reason" className="text-sm">
          {blockingIssue === undefined ? (
            <span className="text-ink-500">
              {preview.ok
                ? `${preview.table.config.label} · ${
                    SEAT_INDEXES.filter((seat) => form.seats[seat]?.occupancy === 'ACTIVE').length
                  } active seats`
                : ''}
            </span>
          ) : (
            <span className="text-danger-500">
              {blockingIssue.seat !== null && isSeatIndex(blockingIssue.seat)
                ? `Seat ${blockingIssue.seat + 1}: `
                : ''}
              {blockingIssue.message}
            </span>
          )}
        </div>
      </footer>

      {formIssues.length > 1 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-danger-500">
          {formIssues.slice(1).map((entry) => (
            <li key={`${entry.field}-${entry.message}`}>{entry.message}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
