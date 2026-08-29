/**
 * `player_observations` — the counts WE recorded.
 *
 * Two structural rules:
 *
 * 1. **No rate is ever stored.** Only `opportunities` and `actions`. A rate is derived by
 *    `player-core`'s `observedRate` on demand.
 * 2. **The natural key is `(player_id, metric, position)` with `position` NULLABLE, and
 *    `NULL` is its OWN bucket** — "recorded without a position dimension", never the sum of
 *    the six positional buckets. A nullable column in a unique index does NOT enforce that
 *    on its own (NULLs compare distinct), so the schema carries two partial unique indexes
 *    and this module always queries the `NULL` bucket with `IS NULL`, never with `= NULL`.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ok, type ObservationId, type PlayerId } from '@gto-self/shared';
import {
  createObservation,
  recordObservation,
  type ObservationContext,
  type ObservationDelta,
  type PlayerObservation,
  type Timestamp,
} from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, fromPlayerError, type DbResult } from '../errors.js';
import { playerObservations } from '../schema.js';
import { collect, decodeObservationRow } from '../rows.js';

function observationRow(observation: PlayerObservation) {
  return {
    id: observation.id,
    playerId: observation.playerId,
    metric: observation.metric,
    position: observation.position,
    opportunities: observation.opportunities,
    actions: observation.actions,
    firstObservedAt: observation.firstObservedAt,
    lastObservedAt: observation.lastObservedAt,
  };
}

/** Insert a context that does not exist yet. Fails CONFLICT when it does. */
export function insertObservation(
  db: GtoDatabase,
  observation: PlayerObservation,
): DbResult<PlayerObservation> {
  const existing = findObservationByContext(db, observation.playerId, observation);
  if (!existing.ok) return existing;
  if (existing.value !== null) {
    return dbErr(
      'CONFLICT',
      `an observation for ${observation.metric}/${observation.position ?? 'ANY'} already exists for this player`,
      { table: 'player_observations', id: existing.value.id },
    );
  }
  const written = attempt({ table: 'player_observations', id: observation.id }, () =>
    db.insert(playerObservations).values(observationRow(observation)).run(),
  );
  if (!written.ok) return written;
  return ok(observation);
}

/**
 * The observation for one context, or `null`. `position: null` is looked up with `IS NULL`
 * — the whole point of the separate bucket.
 */
export function findObservationByContext(
  db: GtoDatabase,
  playerId: PlayerId,
  context: ObservationContext,
): DbResult<PlayerObservation | null> {
  const rows = attempt({ table: 'player_observations' }, () =>
    db
      .select()
      .from(playerObservations)
      .where(
        and(
          eq(playerObservations.playerId, playerId),
          eq(playerObservations.metric, context.metric),
          context.position === null
            ? isNull(playerObservations.position)
            : eq(playerObservations.position, context.position),
        ),
      )
      .all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodeObservationRow(row);
}

/** `null` when absent. */
export function getObservation(
  db: GtoDatabase,
  id: ObservationId,
): DbResult<PlayerObservation | null> {
  const rows = attempt({ table: 'player_observations', id }, () =>
    db.select().from(playerObservations).where(eq(playerObservations.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodeObservationRow(row);
}

/** Every context we have counted for one player, in a stable order. */
export function listObservationsForPlayer(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<readonly PlayerObservation[]> {
  const rows = attempt({ table: 'player_observations' }, () =>
    db
      .select()
      .from(playerObservations)
      .where(eq(playerObservations.playerId, playerId))
      .orderBy(
        asc(playerObservations.metric),
        asc(playerObservations.position),
        asc(playerObservations.id),
      )
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeObservationRow));
}

export interface RecordObservationInput {
  /** Used ONLY when the context does not exist yet. Injected by the caller (ADR-0007). */
  readonly id: ObservationId;
  readonly playerId: PlayerId;
  readonly metric: ObservationContext['metric'];
  readonly position: ObservationContext['position'];
  readonly delta: ObservationDelta;
  readonly observedAt: Timestamp;
}

/**
 * Add newly counted opportunities and actions to one context, creating the row on first
 * sight. The arithmetic and every validation rule (`actions <= opportunities`, timestamps
 * not moving backwards) are `player-core`'s `createObservation` / `recordObservation`;
 * this function only reads a row and writes one back.
 */
export function recordObservationCounts(
  db: GtoDatabase,
  input: RecordObservationInput,
): DbResult<PlayerObservation> {
  const existing = findObservationByContext(db, input.playerId, {
    metric: input.metric,
    position: input.position,
  });
  if (!existing.ok) return existing;

  if (existing.value === null) {
    const created = createObservation({
      id: input.id,
      playerId: input.playerId,
      metric: input.metric,
      position: input.position,
      opportunities: input.delta.opportunities,
      actions: input.delta.actions,
      observedAt: input.observedAt,
    });
    if (!created.ok) {
      return fromPlayerError(created.error, { table: 'player_observations', id: input.id });
    }
    return insertObservation(db, created.value);
  }

  const updated = recordObservation(existing.value, input.delta, input.observedAt);
  if (!updated.ok) {
    return fromPlayerError(updated.error, {
      table: 'player_observations',
      id: existing.value.id,
    });
  }
  const row = observationRow(updated.value);
  const written = attempt({ table: 'player_observations', id: updated.value.id }, () =>
    db
      .update(playerObservations)
      .set({
        opportunities: row.opportunities,
        actions: row.actions,
        lastObservedAt: row.lastObservedAt,
      })
      .where(eq(playerObservations.id, updated.value.id))
      .run(),
  );
  if (!written.ok) return written;
  return ok(updated.value);
}
