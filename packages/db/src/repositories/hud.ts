/**
 * `player_hud_snapshots` — manual HUD readings.
 *
 * **INSERT-ONLY BY CONSTRUCTION.** There is no update function in this module and there
 * must never be one: a new reading is a NEW snapshot, and the previous reading stays
 * readable forever (`CLAUDE.md` rule 3, `docs/ARCHITECTURE.md` §C). `latestHudSnapshot`
 * SELECTS; it does not replace.
 *
 * A snapshot is third-party TESTIMONY and is permanently separate from
 * `player_observations`. Nothing here joins, merges or averages the two.
 */
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { ok, type PlayerId, type SnapshotId } from '@gto-self/shared';
import { latestHudSnapshot, type PlayerHudSnapshot } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, type DbResult } from '../errors.js';
import { playerHudSnapshotStats, playerHudSnapshots } from '../schema.js';
import { collect, decodeHudSnapshotRow, type HudStatRow } from '../rows.js';

/**
 * Append one snapshot and its readings in a single transaction.
 *
 * Each reading writes BOTH the verbatim `entered_text` and the parsed
 * `value_centipercent`; neither is derived from the other at read time without being
 * checked against it.
 */
export function insertHudSnapshot(
  db: GtoDatabase,
  snapshot: PlayerHudSnapshot,
): DbResult<PlayerHudSnapshot> {
  return attempt({ table: 'player_hud_snapshots', id: snapshot.id }, () => {
    db.transaction((tx) => {
      tx.insert(playerHudSnapshots)
        .values({
          id: snapshot.id,
          playerId: snapshot.playerId,
          source: snapshot.source,
          recordedAt: snapshot.recordedAt,
          handSample: snapshot.handSample,
        })
        .run();
      tx.insert(playerHudSnapshotStats)
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
): DbResult<ReadonlyMap<string, readonly HudStatRow[]>> {
  if (snapshotIds.length === 0) return ok(new Map());
  const rows = attempt({ table: 'player_hud_snapshot_stats' }, () =>
    db
      .select()
      .from(playerHudSnapshotStats)
      .where(inArray(playerHudSnapshotStats.snapshotId, [...snapshotIds]))
      .orderBy(playerHudSnapshotStats.snapshotId, playerHudSnapshotStats.ordinal)
      .all(),
  );
  if (!rows.ok) return rows;
  const grouped = new Map<string, HudStatRow[]>();
  for (const row of rows.value) {
    const bucket = grouped.get(row.snapshotId);
    if (bucket === undefined) grouped.set(row.snapshotId, [row]);
    else bucket.push(row);
  }
  return ok(grouped);
}

/** `null` when absent. */
export function getHudSnapshot(
  db: GtoDatabase,
  id: SnapshotId,
): DbResult<PlayerHudSnapshot | null> {
  const rows = attempt({ table: 'player_hud_snapshots', id }, () =>
    db.select().from(playerHudSnapshots).where(eq(playerHudSnapshots.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  const stats = statsFor(db, [row.id]);
  if (!stats.ok) return stats;
  const statRows = stats.value.get(row.id);
  if (statRows === undefined) {
    return dbErr('CORRUPT_ROW', `HUD snapshot ${id} has no stat readings`, {
      table: 'player_hud_snapshot_stats',
      id,
    });
  }
  return decodeHudSnapshotRow(row, statRows);
}

export interface HudHistoryOptions {
  /** Newest first when true (the profile panel's order). Default true. */
  readonly newestFirst?: boolean;
  readonly limit?: number;
}

/** One player's snapshot history. Nothing is ever collapsed or overwritten. */
export function listHudSnapshotsForPlayer(
  db: GtoDatabase,
  playerId: PlayerId,
  options: HudHistoryOptions = {},
): DbResult<readonly PlayerHudSnapshot[]> {
  const newestFirst = options.newestFirst ?? true;
  const rows = attempt({ table: 'player_hud_snapshots' }, () => {
    const query = db
      .select()
      .from(playerHudSnapshots)
      .where(eq(playerHudSnapshots.playerId, playerId))
      .orderBy(
        newestFirst ? desc(playerHudSnapshots.recordedAt) : asc(playerHudSnapshots.recordedAt),
        newestFirst ? desc(playerHudSnapshots.id) : asc(playerHudSnapshots.id),
      );
    return options.limit === undefined ? query.all() : query.limit(options.limit).all();
  });
  if (!rows.ok) return rows;
  const stats = statsFor(
    db,
    rows.value.map((row) => row.id),
  );
  if (!stats.ok) return stats;
  return collect(rows.value.map((row) => decodeHudSnapshotRow(row, stats.value.get(row.id) ?? [])));
}

/**
 * The most recent reading, SELECTED by `player-core`'s own `latestHudSnapshot` so the
 * tie-break on an identical millisecond is defined in exactly one place.
 */
export function latestHudSnapshotForPlayer(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<PlayerHudSnapshot | null> {
  const history = listHudSnapshotsForPlayer(db, playerId);
  if (!history.ok) return history;
  return ok(latestHudSnapshot(history.value) ?? null);
}
