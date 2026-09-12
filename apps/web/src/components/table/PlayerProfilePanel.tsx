'use client';

/**
 * The right panel's player profile.
 *
 * This is the ONE place in the table that awaits anything. Opening a profile is a click,
 * not a hand transition, so a server action is the right tool — and it is reached as a
 * PROP, never an import, because a `'use server'` module pulls a native SQLite binding
 * that must never enter a client bundle (`prompt` D3).
 *
 * A player with no HUD reading and no notes is a normal, fully-rendered profile. Nothing
 * is invented to fill the space.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { HUD_STAT_KEYS } from '@gto-self/player-core';
import type { ExternalHudStatKey, HudStatKey } from '@gto-self/player-core';
import type {
  AddPlayerNoteAction,
  ExternalHudEntryStats,
  LoadPlayerProfileAction,
  PlayerProfileView,
  ProfileExternalHudSnapshot,
  ProfileHudSnapshot,
  SaveHudSnapshotAction,
} from '../../lib/table/contract.js';
import {
  EXTERNAL_HUD_APPENDED_NOTICE,
  EXTERNAL_HUD_APPEND_ONLY_NOTICE,
  EXTERNAL_HUD_EDIT_HEADING,
  EXTERNAL_HUD_GLOSSARY,
  EXTERNAL_HUD_GLOSSARY_ORDER,
  EXTERNAL_HUD_SAVE_LABEL,
  EXTERNAL_HUD_SAVING_LABEL,
  EXTERNAL_HUD_UNCHANGED_NOTICE,
  EXTERNAL_HUD_UNKNOWN_LABEL,
} from '../../lib/table/copy.js';
import {
  ExternalHudEntryFields,
  externalHudEntryStats,
  type ExternalHudFormText,
} from './ExternalHudEntryFields.js';

type LoadState =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'ERROR'; readonly message: string }
  | { readonly kind: 'LOADED'; readonly profile: PlayerProfileView };

export interface PlayerProfilePanelProps {
  readonly playerId: string;
  /** Shown immediately, so the header does not flicker while the profile loads. */
  readonly nickname: string | null;
  readonly loadProfile: LoadPlayerProfileAction;
  /** Omit to keep this render site read-only; the edit form only appears when supplied. */
  readonly saveHudSnapshot?: SaveHudSnapshotAction;
  /** Omit to keep this render site read-only; the notes form only appears when supplied. */
  readonly addNote?: AddPlayerNoteAction;
  /**
   * WP-3 — append a NEW hand-typed `EXTERNAL_HUD` snapshot for this player.
   *
   * The caller supplies it already bound to the seat (`saveExternalHudSnapshotAction` needs a
   * seat index, which this panel has no business knowing) and hangs the ADAPTIVE refresh off
   * its success. `appended: false` is a real answer, not a failure: the entry was byte-
   * identical to the latest snapshot, so nothing was written.
   *
   * Omit to keep the external-HUD section read-only.
   */
  readonly saveExternalHud?: (
    stats: ExternalHudEntryStats,
  ) => Promise<{ readonly ok: true; readonly appended: boolean } | { readonly ok: false; readonly message: string }>;
  readonly onClose: () => void;
}

/**
 * The Latin display name of every `HudStatKey`. Standard HUD notation is never translated
 * (ADR-0053), and the record is exhaustive over the union, so a ninth stat cannot appear in
 * `player-core` without this form being updated.
 */
const HUD_STAT_LABEL: Readonly<Record<HudStatKey, string>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: '3BET',
  FOLD_TO_THREE_BET: 'FOLD TO 3BET',
  CBET_FLOP: 'CBET FLOP',
  FOLD_TO_CBET_FLOP: 'FOLD TO CBET FLOP',
  WTSD: 'WTSD',
  WON_AT_SHOWDOWN: 'W$SD',
};

/**
 * ALL 8 `HudStatKey` members, in `player-core`'s own declaration order.
 *
 * The form used to expose four of them, which quietly made the other four unreachable from
 * the app even though `player-core` validates them and `player_hud_snapshot_stats`' CHECK
 * accepts them. Four of the eight — `CBET_FLOP`, `FOLD_TO_CBET_FLOP`, `WTSD` and
 * `WON_AT_SHOWDOWN` — are exactly the postflop reads 상대 적응 · ADAPTIVE's rule table is
 * keyed on (WP-J design contract §2.3), so a user could not hand-enter the readings the
 * layer most wants. Driving the list off `HUD_STAT_KEYS` rather than a literal is what stops
 * the two lists drifting apart again. NO SCHEMA CHANGE IS INVOLVED.
 */
const EDITABLE_HUD_KEYS: readonly { readonly key: HudStatKey; readonly label: string }[] =
  HUD_STAT_KEYS.map((key) => ({ key, label: HUD_STAT_LABEL[key] }));

/**
 * The edit form's initial text, taken VERBATIM from the latest stored snapshot.
 *
 * WHY THIS EXISTS. A HUD snapshot is a WHOLE READING, not a patch: `saveHudSnapshot` appends
 * a new snapshot containing exactly the fields submitted, and `latestHudSnapshotForPlayer`
 * then returns that one snapshot and never a merge across snapshots. With a form that opened
 * blank, a user correcting a single number saved a snapshot holding only that number, and the
 * other seven readings disappeared from the panel AND from the ADAPTIVE model — silently, and
 * with no way back to them in the UI. (The rows survive in the insert-only table, so nothing
 * was destroyed at rest; the EFFECTIVE profile lost them, which is what the user sees.)
 * Pre-filling makes a one-field edit round-trip the other seven instead.
 *
 * `enteredText` is copied EXACTLY as the user typed it (`CLAUDE.md` rule 3). We never parse
 * it and render the number back: `"23.50"` must not become `"23.5"` just because the form was
 * reopened, and a value the server would reject must come back looking the way it was typed.
 *
 * A key the snapshot does not carry is simply absent from the record, so its input renders
 * empty and `handleSaveHud` — which submits only non-blank fields — leaves it out of the next
 * snapshot. Nothing is fabricated to fill a gap.
 */
function hudFormText(hud: ProfileHudSnapshot | null): Record<string, string> {
  const seeded: Record<string, string> = {};
  if (hud === null) return seeded;
  for (const stat of hud.stats) seeded[stat.key] = stat.enteredText;
  return seeded;
}

/** The sample field's initial text. `null` is genuinely unknown and stays BLANK, never `0`. */
function handSampleFormText(hud: ProfileHudSnapshot | null): string {
  return hud === null || hud.handSample === null ? '' : String(hud.handSample);
}

/**
 * The entered text for one glossary category out of an external profile, or `null` when the
 * source never reported it (WP-K — `Ssallabd`/`Dre4mTe4m`'s WTSD/WSD, for example). Rendered
 * as `EXTERNAL_HUD_UNKNOWN_LABEL`, never `0%` — CLAUDE.md's "absence is not distrust" rule.
 */
/**
 * The external-HUD edit form's initial text, taken VERBATIM from the latest stored snapshot.
 *
 * Pre-filled for the same reason the manual HUD form is: a snapshot is a WHOLE READING, and a
 * form that opened blank would let a one-field correction silently drop the other nine. It is
 * still an APPEND — `EXTERNAL_HUD_APPEND_ONLY_NOTICE` says so on the form, because a pre-filled
 * form otherwise looks like an in-place edit and this table is insert-only (ADR-0076).
 */
function externalHudFormText(externalHud: ProfileExternalHudSnapshot | null): ExternalHudFormText {
  if (externalHud === null) return {};
  const seeded: Partial<Record<ExternalHudStatKey, string>> = {};
  for (const stat of externalHud.stats) seeded[stat.key as ExternalHudStatKey] = stat.enteredText;
  return seeded;
}

function externalHudStatText(
  externalHud: ProfileExternalHudSnapshot,
  key: (typeof EXTERNAL_HUD_GLOSSARY_ORDER)[number],
): string | null {
  return externalHud.stats.find((stat) => stat.key === key)?.enteredText ?? null;
}

function formatInstant(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

export function PlayerProfilePanel({
  playerId,
  nickname,
  loadProfile,
  saveHudSnapshot,
  addNote,
  saveExternalHud,
  onClose,
}: PlayerProfilePanelProps) {
  const [state, setState] = useState<LoadState>({ kind: 'LOADING' });

  const [hudText, setHudText] = useState<Record<string, string>>({});
  const [handSampleText, setHandSampleText] = useState('');
  const [hudError, setHudError] = useState<string | null>(null);
  const [hudSaving, setHudSaving] = useState(false);

  const [externalHudText, setExternalHudText] = useState<ExternalHudFormText>({});
  const [externalHudError, setExternalHudError] = useState<string | null>(null);
  const [externalHudNotice, setExternalHudNotice] = useState<string | null>(null);
  const [externalHudSaving, setExternalHudSaving] = useState(false);

  const [noteBody, setNoteBody] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  // Opening a profile — or switching to another player — reloads it and RESEEDS the edit form
  // from whatever snapshot comes back. The seed happens here and on a successful HUD save, and
  // deliberately NOT on a note save (which returns the same snapshot but must not discard HUD
  // text the user is part-way through typing) nor on a failed save (the entered text stays).
  useEffect(() => {
    let live = true;
    setState({ kind: 'LOADING' });
    setHudText({});
    setHandSampleText('');
    setHudError(null);
    setExternalHudText({});
    setExternalHudError(null);
    setExternalHudNotice(null);
    loadProfile(playerId).then(
      (result) => {
        if (!live) return;
        if (result.ok) {
          setHudText(hudFormText(result.profile.hud));
          setHandSampleText(handSampleFormText(result.profile.hud));
          setExternalHudText(externalHudFormText(result.profile.externalHud));
        }
        setState(
          result.ok
            ? { kind: 'LOADED', profile: result.profile }
            : { kind: 'ERROR', message: result.message },
        );
      },
      (error: unknown) => {
        if (!live) return;
        setState({
          kind: 'ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
    return () => {
      live = false;
    };
  }, [playerId, loadProfile]);

  const profile = state.kind === 'LOADED' ? state.profile : null;

  /**
   * Re-read the profile after an APPEND, so the panel shows the snapshot that is now in
   * effect. The save action returns no profile (it returns the adaptive input the caller
   * needs), so this is the one round trip that keeps the two views in step rather than the
   * panel re-deriving what it just sent.
   */
  const reload = useCallback((): void => {
    loadProfile(playerId).then(
      (result) => {
        if (!result.ok) return;
        setState({ kind: 'LOADED', profile: result.profile });
        setExternalHudText(externalHudFormText(result.profile.externalHud));
      },
      () => undefined,
    );
  }, [loadProfile, playerId]);

  async function handleSaveExternalHud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveExternalHud === undefined) return;
    setExternalHudError(null);
    setExternalHudNotice(null);
    setExternalHudSaving(true);
    try {
      // A blank field is OMITTED, never sent as `0` (`externalHudEntryStats`, ADR-0076).
      const result = await saveExternalHud(externalHudEntryStats(externalHudText));
      if (result.ok) {
        setExternalHudNotice(
          result.appended ? EXTERNAL_HUD_APPENDED_NOTICE : EXTERNAL_HUD_UNCHANGED_NOTICE,
        );
        if (result.appended) reload();
      } else {
        setExternalHudError(result.message);
      }
    } catch (error: unknown) {
      setExternalHudError(error instanceof Error ? error.message : String(error));
    } finally {
      setExternalHudSaving(false);
    }
  }

  async function handleSaveHud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveHudSnapshot === undefined) return;
    setHudError(null);
    setHudSaving(true);
    const stats = EDITABLE_HUD_KEYS.filter(({ key }) => (hudText[key] ?? '').trim() !== '').map(
      ({ key }) => ({ key, enteredText: (hudText[key] ?? '').trim() }),
    );
    const trimmedSample = handSampleText.trim();
    const handSample = trimmedSample === '' ? null : Number(trimmedSample);
    try {
      const result = await saveHudSnapshot({ playerId, stats, handSample });
      if (result.ok) {
        // Reseed from the snapshot the server just wrote, so the form shows the reading that
        // is now in effect — including the seven fields this save carried forward untouched.
        setState({ kind: 'LOADED', profile: result.profile });
        setHudText(hudFormText(result.profile.hud));
        setHandSampleText(handSampleFormText(result.profile.hud));
      } else {
        setHudError(result.message);
      }
    } catch (error: unknown) {
      setHudError(error instanceof Error ? error.message : String(error));
    } finally {
      setHudSaving(false);
    }
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addNote === undefined) return;
    setNoteError(null);
    setNoteSaving(true);
    try {
      const result = await addNote({ playerId, body: noteBody });
      if (result.ok) {
        setState({ kind: 'LOADED', profile: result.profile });
        setNoteBody('');
      } else {
        setNoteError(result.message);
      }
    } catch (error: unknown) {
      setNoteError(error instanceof Error ? error.message : String(error));
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <section
      data-testid="player-profile"
      aria-label="플레이어 정보"
      className="flex flex-col gap-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">
          {profile?.displayAlias ?? profile?.nickname ?? nickname ?? '플레이어'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-surface-600 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-ink-500 hover:text-ink-100"
        >
          Esc
        </button>
      </header>

      {state.kind === 'LOADING' && (
        <p className="text-xs text-ink-500" data-testid="profile-loading">
          불러오는 중…
        </p>
      )}

      {state.kind === 'ERROR' && (
        <p className="text-xs text-danger-500" data-testid="profile-error">
          {state.message}
        </p>
      )}

      {profile !== null && (
        <>
          {profile.archived && (
            <p className="text-[0.65rem] uppercase tracking-widest text-dirty-500">보관됨</p>
          )}

          <div>
            <h3 className="text-[0.65rem] uppercase tracking-widest text-ink-500">최근 HUD</h3>
            {profile.hud === null ? (
              <p className="mt-1 text-xs text-ink-700" data-testid="profile-no-hud">
                이 플레이어의 HUD 기록이 없습니다.
              </p>
            ) : (
              <div className="mt-1" data-testid="profile-hud">
                <p className="tabular text-[0.65rem] text-ink-700">
                  {formatInstant(profile.hud.recordedAt)} ·{' '}
                  {profile.hud.handSample === null ? '표본 불명' : `${profile.hud.handSample}핸드`}
                </p>
                <ul className="mt-1">
                  {profile.hud.stats.map((stat) => (
                    <li
                      key={stat.key}
                      className="flex items-baseline justify-between gap-2 text-xs text-ink-300"
                    >
                      <span className="text-ink-500">{stat.key}</span>
                      {/* Exactly what the user entered (`CLAUDE.md` rule 3). */}
                      <span className="tabular">{stat.enteredText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-3">
            <h3 className="text-[0.65rem] uppercase tracking-widest text-ink-500">
              외부 HUD (전체 기간)
            </h3>
            {profile.externalHud === null ? (
              <p className="mt-1 text-xs text-ink-700" data-testid="profile-no-external-hud">
                이 플레이어의 외부 HUD 기록이 없습니다.
              </p>
            ) : (
              <div className="mt-1" data-testid="profile-external-hud">
                <p className="tabular text-[0.65rem] text-ink-700">
                  {formatInstant(profile.externalHud.recordedAt)} · 표본 불명 (라이프타임 기록)
                </p>
                <ul className="mt-1">
                  {EXTERNAL_HUD_GLOSSARY_ORDER.map((key) => {
                    const externalHud = profile.externalHud;
                    if (externalHud === null) return null;
                    const enteredText = externalHudStatText(externalHud, key);
                    return (
                      <li
                        key={key}
                        data-testid={`external-hud-stat-${key}`}
                        className="flex items-baseline justify-between gap-2 text-xs text-ink-300"
                        title={EXTERNAL_HUD_GLOSSARY[key]}
                      >
                        <span className="text-ink-500">{key}</span>
                        <span className="tabular">
                          {enteredText === null ? EXTERNAL_HUD_UNKNOWN_LABEL : `${enteredText}%`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* WP-3. Deliberately SEPARATE from the manual-HUD form below (ADR-0069): the two
                sources have different scopes, different confidences and different precedence,
                and merging the forms would merge the two claims. */}
            {saveExternalHud !== undefined && (
              <form
                data-testid="external-hud-edit-form"
                onSubmit={(event) => void handleSaveExternalHud(event)}
                className="mt-2 flex flex-col gap-1 rounded border border-surface-600 p-2"
              >
                <h4 className="text-[0.6rem] uppercase tracking-widest text-ink-500">
                  {EXTERNAL_HUD_EDIT_HEADING}
                </h4>
                <p
                  data-testid="external-hud-append-notice"
                  className="text-[0.6rem] leading-snug text-ink-700"
                >
                  {EXTERNAL_HUD_APPEND_ONLY_NOTICE}
                </p>
                <ExternalHudEntryFields
                  idPrefix="external-hud-input"
                  values={externalHudText}
                  disabled={externalHudSaving}
                  onChange={(key: ExternalHudStatKey, text: string) =>
                    setExternalHudText((current) => ({ ...current, [key]: text }))
                  }
                />
                {externalHudError !== null && (
                  <p className="text-[0.65rem] text-danger-500" data-testid="external-hud-error">
                    {externalHudError}
                  </p>
                )}
                {externalHudNotice !== null && (
                  <p className="text-[0.65rem] text-good-500" data-testid="external-hud-result">
                    {externalHudNotice}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={externalHudSaving}
                  data-testid="external-hud-save-button"
                  className="mt-1 w-fit rounded border border-surface-600 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-ink-300 hover:text-ink-100 disabled:opacity-50"
                >
                  {externalHudSaving ? EXTERNAL_HUD_SAVING_LABEL : EXTERNAL_HUD_SAVE_LABEL}
                </button>
              </form>
            )}
          </div>

          <div>
            {saveHudSnapshot !== undefined && (
              <form
                data-testid="hud-edit-form"
                onSubmit={(event) => void handleSaveHud(event)}
                className="mt-2 flex flex-col gap-1 rounded border border-surface-600 p-2"
              >
                {EDITABLE_HUD_KEYS.map(({ key, label }) => (
                  <label key={key} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-ink-500">{label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid={`hud-input-${key}`}
                      value={hudText[key] ?? ''}
                      onChange={(event) =>
                        setHudText((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                      className="w-20 rounded border border-surface-600 bg-surface-800 px-1 text-right tabular text-ink-100"
                    />
                  </label>
                ))}
                <label className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-ink-500">표본(핸드)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="hud-input-handSample"
                    value={handSampleText}
                    onChange={(event) => setHandSampleText(event.target.value)}
                    className="w-20 rounded border border-surface-600 bg-surface-800 px-1 text-right tabular text-ink-100"
                  />
                </label>
                {/* The sample is not paperwork: it is the WEIGHT. `adaptive-core` shrinks every
                    reading toward its zero-adjustment anchor by `n / (n + K)`, so a reading
                    saved with no sample carries exactly zero weight and changes nothing. Said
                    here, next to the field, because a blank box otherwise looks optional. */}
                <p className="text-[0.6rem] leading-snug text-ink-700" data-testid="hud-sample-note">
                  표본 수가 HUD 값의 가중치입니다. 비워 두면 이 값은 상대 적응 계산에서 가중치 0으로
                  처리되어 아무것도 바꾸지 않습니다.
                </p>
                {hudError !== null && (
                  <p className="text-[0.65rem] text-danger-500" data-testid="hud-error">
                    {hudError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={hudSaving}
                  data-testid="hud-save-button"
                  className="mt-1 rounded border border-surface-600 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-ink-300 hover:text-ink-100 disabled:opacity-50"
                >
                  {hudSaving ? '저장 중…' : 'HUD 저장'}
                </button>
              </form>
            )}
          </div>

          <div>
            <h3 className="text-[0.65rem] uppercase tracking-widest text-ink-500">메모</h3>
            {profile.notes.length === 0 ? (
              <p className="mt-1 text-xs text-ink-700" data-testid="profile-no-notes">
                아직 메모가 없습니다.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-2">
                {profile.notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded bg-surface-700 px-2 py-1 text-xs text-ink-300"
                  >
                    <p className="tabular text-[0.6rem] text-ink-700">
                      {formatInstant(note.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{note.body}</p>
                  </li>
                ))}
              </ul>
            )}

            {addNote !== undefined && (
              <form
                data-testid="note-add-form"
                onSubmit={(event) => void handleAddNote(event)}
                className="mt-2 flex flex-col gap-1 rounded border border-surface-600 p-2"
              >
                <textarea
                  data-testid="note-input"
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  rows={2}
                  className="rounded border border-surface-600 bg-surface-800 px-1 py-0.5 text-xs text-ink-100"
                />
                {noteError !== null && (
                  <p className="text-[0.65rem] text-danger-500" data-testid="note-error">
                    {noteError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={noteSaving}
                  data-testid="note-add-button"
                  className="mt-1 rounded border border-surface-600 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-ink-300 hover:text-ink-100 disabled:opacity-50"
                >
                  {noteSaving ? '저장 중…' : '메모 추가'}
                </button>
              </form>
            )}
          </div>

          {profile.warnings.length > 0 && (
            <ul className="text-[0.65rem] text-dirty-500">
              {profile.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
