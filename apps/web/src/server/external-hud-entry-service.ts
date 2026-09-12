/**
 * Hand-typed `EXTERNAL_HUD` entry — the ten numbers the user reads off their own HUD and types
 * at the table, as opposed to `external-hud-import-service.ts`'s bulk file import.
 *
 * ONE append rule, in ONE function. Both callers reach it: the quick HUD edit in the profile
 * panel (WP-3) and the HUD block on the seat-player replacement form (WP-2). Splitting them
 * would be how the two paths quietly drift into storing different things.
 *
 * What ADR-0076 fixes and this module enforces:
 *
 * - **Append, never update.** A correction is a NEW snapshot. The insert-only trigger on
 *   `player_external_hud_snapshots` is not worked around, and every value the user has ever
 *   typed stays readable (`CLAUDE.md` rule 3).
 * - **A blank field is an ABSENT row.** Never `0`, never `""`. A field the user cleared is a
 *   field they are not claiming to know.
 * - **`sampleN` is `null`.** `createExternalHudSnapshot` sets it unconditionally; this module
 *   never invents a hand count (`CLAUDE.md` rule 2).
 * - **A byte-identical re-save writes nothing**, by the same `sameAsLatest` rule the bulk
 *   import uses — a snapshot per keystroke-less save would be history noise, not history.
 * - **REFERENCE is not touched.** Nothing here imports or reaches `strategy-core`; the only
 *   thing that changes is what ADAPTIVE reads next.
 *
 * The clock and the id factory are INJECTED (ADR-0007). Not a hot path: this is a save button.
 */
import { asId, type IdFactory, type PlayerId, type SnapshotId } from '@gto-self/shared';
import {
  createExternalHudSnapshot,
  isExternalHudStatKey,
  type ExternalHudStatInput,
  type Timestamp,
} from '@gto-self/player-core';
import { findPlayerById, insertExternalHudSnapshot, type GtoDatabase } from '@gto-self/db';
import type {
  ExternalHudEntryStats,
  SaveExternalHudSnapshotResult,
} from '../lib/table/contract.js';
import { saveExternalHudSnapshotSchema } from '../lib/table/contract.js';
import { sameAsLatest } from './external-hud-import-service.js';
import { loadAdaptiveOpponentInput } from './adaptive-service.js';

/**
 * The `import_batch_id` prefix every hand-typed snapshot carries.
 *
 * `createExternalHudSnapshot` refuses an empty batch id, and a batch id that could be mistaken
 * for a file import would erase the one thing that distinguishes the two: an imported reading
 * came from a file, this one came off the user's screen and through their keyboard.
 */
export const MANUAL_EXTERNAL_HUD_BATCH_PREFIX = 'manual-entry';

export interface ExternalHudEntryDeps {
  readonly ids: IdFactory;
  readonly now: Timestamp;
}

export type ExternalHudAppendResult =
  | { readonly ok: true; readonly appended: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Total. The typed map, reduced to the stats the user actually claimed.
 *
 * A key that is not an `ExternalHudStatKey` is REPORTED, not dropped: a client sending
 * `VIPP` is a bug, and silently ignoring it would store a profile missing a stat the user
 * believes they entered. A blank or whitespace-only value is a different fact — the user
 * left it blank — and is omitted, which is exactly how "unknown" is spelled here.
 */
export function externalHudStatsFromEntry(
  entry: ExternalHudEntryStats,
):
  | { readonly ok: true; readonly stats: readonly ExternalHudStatInput[] }
  | { readonly ok: false; readonly message: string } {
  const stats: ExternalHudStatInput[] = [];
  for (const [key, value] of Object.entries(entry)) {
    if (!isExternalHudStatKey(key)) {
      return { ok: false, message: `unknown external HUD stat "${key}"` };
    }
    if (value === undefined) continue;
    // Trimmed for the emptiness TEST only. What is stored is the trimmed text the user meant,
    // never a re-formatted number: `parsePercent` keeps `enteredText` verbatim beside its parse.
    const text = value.trim();
    if (text === '') continue;
    stats.push({ key, enteredText: text });
  }
  return { ok: true, stats };
}

/** `true` when the typed map claims nothing at all — no stat, or every stat blank. */
export function externalHudEntryIsEmpty(entry: ExternalHudEntryStats): boolean {
  return Object.values(entry).every((value) => value === undefined || value.trim() === '');
}

/**
 * The ONE append. Validates through `player-core`'s constructor, skips a byte-identical
 * re-save, and inserts a new snapshot.
 *
 * The caller has already decided the player exists and that something was typed; this
 * function's job is the snapshot, not the surrounding transaction.
 */
export function appendTypedExternalHud(
  db: GtoDatabase,
  playerId: PlayerId,
  entry: ExternalHudEntryStats,
  deps: ExternalHudEntryDeps,
): ExternalHudAppendResult {
  const mapped = externalHudStatsFromEntry(entry);
  if (!mapped.ok) return { ok: false, code: 'INVALID_INPUT', message: mapped.message };
  if (mapped.stats.length === 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'an external HUD entry must record at least one stat',
    };
  }

  if (sameAsLatest(db, playerId, mapped.stats)) return { ok: true, appended: false };

  const snapshot = createExternalHudSnapshot({
    id: asId<'Snapshot'>(deps.ids.next()) as SnapshotId,
    playerId,
    recordedAt: deps.now,
    importBatchId: `${MANUAL_EXTERNAL_HUD_BATCH_PREFIX}-${deps.now}-${deps.ids.next()}`,
    stats: mapped.stats,
  });
  if (!snapshot.ok)
    return { ok: false, code: snapshot.error.code, message: snapshot.error.message };

  const written = insertExternalHudSnapshot(db, snapshot.value);
  if (!written.ok) return { ok: false, code: written.error.code, message: written.error.message };
  return { ok: true, appended: true };
}

/**
 * WP-3's server-side half: append one typed snapshot and hand back the player's REFRESHED
 * ADAPTIVE input, so the panel can `upsertInput` without a second round trip.
 *
 * The returned input is read by `loadAdaptiveOpponentInput` — the same function the lineup
 * read uses — so the snapshot precedence and the provenance fields cannot disagree with what
 * a full reload would produce. REFERENCE is not consulted, recomputed or affected.
 *
 * `input` is untrusted: it arrives over the network at a server action.
 */
export function saveExternalHudSnapshot(
  db: GtoDatabase,
  input: unknown,
  deps: ExternalHudEntryDeps,
): SaveExternalHudSnapshotResult {
  const shape = saveExternalHudSnapshotSchema.safeParse(input);
  if (!shape.success) {
    const detail = shape.error.issues
      .map((problem) => `${problem.path.join('.') || 'input'}: ${problem.message}`)
      .join('; ');
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: `submitted HUD entry is malformed: ${detail}`,
    };
  }
  const { seatIndex, stats } = shape.data;
  const playerId = asId<'Player'>(shape.data.playerId);

  const player = findPlayerById(db, playerId);
  if (!player.ok) return { ok: false, code: player.error.code, message: player.error.message };
  if (player.value === null) {
    return { ok: false, code: 'NOT_FOUND', message: 'that player no longer exists' };
  }

  const appended = appendTypedExternalHud(db, playerId, stats, deps);
  if (!appended.ok) return appended;

  // The nickname comes off the row just read, not off the wire: it is display text the server
  // already holds, so there is one fewer client-supplied field on this path.
  const refreshed = loadAdaptiveOpponentInput(db, playerId, seatIndex, player.value.nickname);
  if (!refreshed.ok) return { ok: false, code: 'READ_FAILED', message: refreshed.message };

  return {
    ok: true,
    playerId,
    appended: appended.appended,
    adaptiveInput: refreshed.input,
  };
}
