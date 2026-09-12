/**
 * The bulk EXTERNAL_HUD import — the ONE place `apps/web/scripts/import-external-hud.ts`
 * touches `@gto-self/db` (ESLint permits `@gto-self/db` only under `apps/web/src/server/`).
 *
 * Pure with respect to I/O: takes an already-parsed list of source entries and a `now` /
 * `ids` injected by the caller (ADR-0007 — this module never reads the clock or mints an id
 * itself), and returns one outcome row per player. The script owns reading the file and
 * printing the report; this module owns every database read and write.
 */
import { asId, type IdFactory, type PlayerId, type SnapshotId } from '@gto-self/shared';
import {
  createExternalHudSnapshot,
  createPlayer,
  externalHudStat,
  type ExternalHudStatInput,
  type ExternalHudStatKey,
  type Timestamp,
} from '@gto-self/player-core';
import {
  findPlayerByNormalizedNickname,
  insertExternalHudSnapshot,
  insertPlayer,
  latestExternalProfileForPlayer,
  type GtoDatabase,
} from '@gto-self/db';

/**
 * Source JSON field -> `ExternalHudStatKey`. `CBET`/`FOLD_TO_CBET`/`CHECK_RAISE` are the
 * source's generic (street-blind) names and map to `adaptive-core`'s dedicated
 * `*_ANY_STREET` keys — deliberately distinct from its per-street keys (WP-K §3).
 */
export const EXTERNAL_HUD_FIELD_MAP: Readonly<Record<string, ExternalHudStatKey>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: 'THREE_BET',
  FOLD_TO_THREE_BET: 'FOLD_TO_THREE_BET',
  STEAL: 'STEAL',
  CBET: 'CBET_ANY_STREET',
  FOLD_TO_CBET: 'FOLD_TO_CBET_ANY_STREET',
  CHECK_RAISE: 'CHECK_RAISE_ANY_STREET',
  WTSD: 'WTSD',
  WSD: 'WSD',
};

export interface SourcePlayer {
  readonly nickname: string;
  readonly [field: string]: unknown;
}

/** Total. A `null`/missing field is omitted; anything else becomes its verbatim string. */
export function statsFromSourcePlayer(entry: SourcePlayer): readonly ExternalHudStatInput[] {
  const stats: ExternalHudStatInput[] = [];
  for (const [field, key] of Object.entries(EXTERNAL_HUD_FIELD_MAP)) {
    const value = entry[field];
    if (value === null || value === undefined) continue;
    stats.push({ key, enteredText: String(value) });
  }
  return stats;
}

export type ImportOutcome = 'NEW_PLAYER' | 'NEW_SNAPSHOT' | 'ALREADY_PERSISTED' | 'FAILED';

export interface ImportRow {
  readonly nickname: string;
  readonly playerId: string;
  readonly outcome: ImportOutcome;
  readonly statsWritten: number;
  readonly reason?: string;
}

/**
 * `true` when `candidate` is exactly the player's current latest snapshot (same keys, same
 * verbatim entered text) — the only case a re-run should NOT write a new row.
 *
 * EXPORTED so the table's hand-typed entry path (`external-hud-entry-service.ts`) applies the
 * identical rule rather than reinventing it: the two paths write the same kind of row and must
 * agree on when a re-save is a genuinely new reading (ADR-0076).
 */
export function sameAsLatest(
  db: GtoDatabase,
  playerId: PlayerId,
  candidate: readonly ExternalHudStatInput[],
): boolean {
  const latest = latestExternalProfileForPlayer(db, playerId);
  if (!latest.ok || latest.value === null) return false;
  if (latest.value.stats.length !== candidate.length) return false;
  const snapshot = latest.value;
  return candidate.every(
    (stat) => externalHudStat(snapshot, stat.key)?.enteredText === stat.enteredText,
  );
}

const failed = (nickname: string, playerId: string, reason: string): ImportRow => ({
  nickname,
  playerId,
  outcome: 'FAILED',
  statsWritten: 0,
  reason,
});

/**
 * Imports one player entry: reuse-or-create the `players` row (exact normalized nickname
 * match, never a duplicate), then insert a new `EXTERNAL_HUD` snapshot unless the entry is
 * byte-identical to the player's current latest one.
 */
function importOnePlayer(
  db: GtoDatabase,
  entry: SourcePlayer,
  now: Timestamp,
  ids: IdFactory,
  importBatchId: string,
): ImportRow {
  if (typeof entry.nickname !== 'string' || entry.nickname.trim() === '') {
    return failed(String(entry.nickname), '(none)', 'missing or empty nickname');
  }

  let playerId: PlayerId;
  let isNewPlayer = false;
  const existing = findPlayerByNormalizedNickname(db, entry.nickname);
  if (!existing.ok) {
    return failed(entry.nickname, '(none)', `${existing.error.code}: ${existing.error.message}`);
  }
  if (existing.value !== null) {
    playerId = existing.value.id;
  } else {
    const created = createPlayer({
      id: asId<'Player'>(ids.next()),
      nickname: entry.nickname,
      createdAt: now,
    });
    if (!created.ok) {
      return failed(entry.nickname, '(none)', `${created.error.code}: ${created.error.message}`);
    }
    const inserted = insertPlayer(db, created.value);
    if (!inserted.ok) {
      return failed(entry.nickname, '(none)', `${inserted.error.code}: ${inserted.error.message}`);
    }
    playerId = created.value.id;
    isNewPlayer = true;
  }

  const stats = statsFromSourcePlayer(entry);
  if (stats.length === 0) {
    return failed(entry.nickname, playerId, 'no recognized, non-null stat fields');
  }

  if (sameAsLatest(db, playerId, stats)) {
    return {
      nickname: entry.nickname,
      playerId,
      outcome: 'ALREADY_PERSISTED',
      statsWritten: stats.length,
    };
  }

  const snapshot = createExternalHudSnapshot({
    id: asId<'Snapshot'>(ids.next()) as SnapshotId,
    playerId,
    recordedAt: now,
    importBatchId,
    stats,
  });
  if (!snapshot.ok) {
    return failed(entry.nickname, playerId, `${snapshot.error.code}: ${snapshot.error.message}`);
  }
  const written = insertExternalHudSnapshot(db, snapshot.value);
  if (!written.ok) {
    return failed(entry.nickname, playerId, `${written.error.code}: ${written.error.message}`);
  }
  return {
    nickname: entry.nickname,
    playerId,
    outcome: isNewPlayer ? 'NEW_PLAYER' : 'NEW_SNAPSHOT',
    statsWritten: stats.length,
  };
}

/** Imports every entry in order. Never throws — one player's failure does not stop the rest. */
export function importExternalHudProfiles(
  db: GtoDatabase,
  entries: readonly SourcePlayer[],
  now: Timestamp,
  ids: IdFactory,
  importBatchId: string,
): readonly ImportRow[] {
  return entries.map((entry) => importOnePlayer(db, entry, now, ids, importBatchId));
}
