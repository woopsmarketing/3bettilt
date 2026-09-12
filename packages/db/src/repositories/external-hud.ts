/**
 * `player_external_hud_snapshots` — bulk-imported, lifetime, third-party HUD profiles.
 *
 * **INSERT-ONLY BY CONSTRUCTION.** There is no update function in this module and there
 * must never be one: a re-import is a NEW snapshot, and every earlier reading stays
 * readable forever (`CLAUDE.md` rule 3). `latestExternalHudSnapshot` SELECTS; it does not
 * replace. Permanently separate from `player_hud_snapshots` and `player_observations` —
 * nothing here joins, merges or averages this with either.
 */
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { ok, type PlayerId, type SnapshotId } from '@gto-self/shared';
import { latestExternalHudSnapshot, type PlayerExternalHudSnapshot } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, type DbResult } from '../errors.js';
import { playerExternalHudSnapshotStats, playerExternalHudSnapshots } from '../schema.js';
import { collect, decodeExternalHudSnapshotRow, type ExternalHudStatRow } from '../rows.js';

/**
 * Append one snapshot and its readings in a single transaction.
 *
 * Each reading writes BOTH the verbatim `entered_text` and the parsed
 * `value_centipercent`; neither is derived from the other at read time without being
 * checked against it. A stat the caller did not supply simply has no row here.
 */
export function insertExternalHudSnapshot(
  db: GtoDatabase,
  snapshot: PlayerExternalHudSnapshot,
): DbResult<PlayerExternalHudSnapshot> {
  return attempt({ table: 'player_external_hud_snapshots', id: snapshot.id }, () => {
    db.transaction((tx) => {
      tx.insert(playerExternalHudSnapshots)
        .values({
          id: snapshot.id,
          playerId: snapshot.playerId,
          source: snapshot.source,
          scope: snapshot.scope,
          reliability: snapshot.reliability,
          recordedAt: snapshot.recordedAt,
          sampleN: snapshot.sampleN,
          importBatchId: snapshot.importBatchId,
        })
        .run();
      tx.insert(playerExternalHudSnapshotStats)
        .values(
          snapshot.stats.map((stat, ordinal) => ({
            snapshotId: snapshot.id,
            statKey: stat.key,
            enteredText: stat.enteredText,
            valueCentipercent: stat.value,
            ordinal,
          })),
        )
        .run();
    });
    return snapshot;
  });
}

/** Internal. The readings for a set of snapshots, grouped by snapshot id. */
function statsFor(
  db: GtoDatabase,
  snapshotIds: readonly string[],
): DbResult<ReadonlyMap<string, readonly ExternalHudStatRow[]>> {
  if (snapshotIds.length === 0) return ok(new Map());
  const rows = attempt({ table: 'player_external_hud_snapshot_stats' }, () =>
    db
      .select()
      .from(playerExternalHudSnapshotStats)
      .where(inArray(playerExternalHudSnapshotStats.snapshotId, [...snapshotIds]))
      .orderBy(playerExternalHudSnapshotStats.snapshotId, playerExternalHudSnapshotStats.ordinal)
      .all(),
  );
  if (!rows.ok) return rows;
  const grouped = new Map<string, ExternalHudStatRow[]>();
  for (const row of rows.value) {
    const bucket = grouped.get(row.snapshotId);
    if (bucket === undefined) grouped.set(row.snapshotId, [row]);
    else bucket.push(row);
  }
  return ok(grouped);
}

/** `null` when absent. */
export function getExternalHudSnapshot(
  db: GtoDatabase,
  id: SnapshotId,
): DbResult<PlayerExternalHudSnapshot | null> {
  const rows = attempt({ table: 'player_external_hud_snapshots', id }, () =>
    db.select().from(playerExternalHudSnapshots).where(eq(playerExternalHudSnapshots.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  const stats = statsFor(db, [row.id]);
  if (!stats.ok) return stats;
  const statRows = stats.value.get(row.id);
  if (statRows === undefined) {
    return dbErr('CORRUPT_ROW', `external HUD snapshot ${id} has no stat readings`, {
      table: 'player_external_hud_snapshot_stats',
      id,
    });
  }
  return decodeExternalHudSnapshotRow(row, statRows);
}

export interface ExternalHudHistoryOptions {
  /** Newest first when true. Default true. */
  readonly newestFirst?: boolean;
  readonly limit?: number;
}

/** One player's snapshot history. Nothing is ever collapsed or overwritten. */
export function listExternalHudSnapshotsForPlayer(
  db: GtoDatabase,
  playerId: PlayerId,
  options: ExternalHudHistoryOptions = {},
): DbResult<readonly PlayerExternalHudSnapshot[]> {
  const newestFirst = options.newestFirst ?? true;
  const rows = attempt({ table: 'player_external_hud_snapshots' }, () => {
    const query = db
      .select()
      .from(playerExternalHudSnapshots)
      .where(eq(playerExternalHudSnapshots.playerId, playerId))
      .orderBy(
        newestFirst
          ? desc(playerExternalHudSnapshots.recordedAt)
          : asc(playerExternalHudSnapshots.recordedAt),
        newestFirst ? desc(playerExternalHudSnapshots.id) : asc(playerExternalHudSnapshots.id),
      );
    return options.limit === undefined ? query.all() : query.limit(options.limit).all();
  });
  if (!rows.ok) return rows;
  const stats = statsFor(
    db,
    rows.value.map((row) => row.id),
  );
  if (!stats.ok) return stats;
  return collect(
    rows.value.map((row) => decodeExternalHudSnapshotRow(row, stats.value.get(row.id) ?? [])),
  );
}

/**
 * The most recent external profile, SELECTED by `player-core`'s own
 * `latestExternalHudSnapshot` so the tie-break on an identical millisecond is defined in
 * exactly one place. This is what `adaptive-service.ts` reads to build an
 * `AdaptiveOpponentInput`'s `EXTERNAL_HUD` observations.
 */
export function latestExternalProfileForPlayer(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<PlayerExternalHudSnapshot | null> {
  const history = listExternalHudSnapshotsForPlayer(db, playerId);
  if (!history.ok) return history;
  return ok(latestExternalHudSnapshot(history.value) ?? null);
}

/**
 * The distinct set of players who have at least one `EXTERNAL_HUD` snapshot. Used by the
 * session-setup player picker to badge and rank those players; it never reads the stat
 * values themselves.
 */
export function playerIdsWithExternalHud(db: GtoDatabase): DbResult<ReadonlySet<PlayerId>> {
  const rows = attempt({ table: 'player_external_hud_snapshots' }, () =>
    db.selectDistinct({ playerId: playerExternalHudSnapshots.playerId }).from(playerExternalHudSnapshots).all(),
  );
  if (!rows.ok) return rows;
  return ok(new Set(rows.value.map((row) => row.playerId as PlayerId)));
}
