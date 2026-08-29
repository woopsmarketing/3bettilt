/**
 * `sessions` + `session_seats` — one sitting at our training table.
 *
 * A session stores its OWN copy of the effective `TableConfig` (blinds, ante, `RakeConfig`,
 * `FeeConfig`, rule options, reference stack). Editing the preset it came from must never
 * change what an already-played session was configured with.
 *
 * All six seat rows always exist, so "seat 3 is empty" is a stored fact rather than a
 * missing row. Stacks are ACTUAL entered values in integer milliBB.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { ok, type SessionId } from '@gto-self/shared';
import { validateTableConfig, type TableState } from '@gto-self/poker-core';
import type { Timestamp } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, fromEngineError, type DbResult } from '../errors.js';
import { sessionSeats, sessions } from '../schema.js';
import { collect, decodeSessionRow, type SessionRecord, type SessionSeatRow } from '../rows.js';

const SEATS = [0, 1, 2, 3, 4, 5] as const;

function seatRows(sessionId: SessionId, table: TableState) {
  return SEATS.map((seat) => {
    const value = table.seats[seat];
    return {
      sessionId,
      seat,
      occupancy: value.occupancy,
      playerId: value.playerId,
      stack: value.stack,
    };
  });
}

/** Insert a session and its six seats in one transaction. */
export function insertSession(db: GtoDatabase, record: SessionRecord): DbResult<SessionRecord> {
  const validated = validateTableConfig(record.table.config);
  if (!validated.ok) return fromEngineError(validated.error, { table: 'sessions', id: record.id });
  const written = attempt({ table: 'sessions', id: record.id }, () => {
    db.transaction((tx) => {
      tx.insert(sessions)
        .values({
          id: record.id,
          label: record.label,
          presetId: record.presetId,
          configJson: JSON.stringify(record.table.config),
          buttonSeat: record.table.buttonSeat,
          heroSeat: record.table.heroSeat,
          handNumber: record.table.handNumber,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          closedAt: record.closedAt,
        })
        .run();
      tx.insert(sessionSeats).values(seatRows(record.id, record.table)).run();
    });
    return record;
  });
  if (!written.ok) return written;
  return ok(record);
}

/** `null` when absent. */
export function getSession(db: GtoDatabase, id: SessionId): DbResult<SessionRecord | null> {
  const rows = attempt({ table: 'sessions', id }, () =>
    db.select().from(sessions).where(eq(sessions.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  const seats = attempt({ table: 'session_seats', id }, () =>
    db
      .select()
      .from(sessionSeats)
      .where(eq(sessionSeats.sessionId, id))
      .orderBy(asc(sessionSeats.seat))
      .all(),
  );
  if (!seats.ok) return seats;
  return decodeSessionRow(row, seats.value);
}

export interface SessionListOptions {
  /** Include sessions that have been closed. Default true. */
  readonly includeClosed?: boolean;
  readonly limit?: number;
}

/** Sessions oldest first by `created_at`, with their seats. */
export function listSessions(
  db: GtoDatabase,
  options: SessionListOptions = {},
): DbResult<readonly SessionRecord[]> {
  const rows = attempt({ table: 'sessions' }, () => {
    const query = db.select().from(sessions);
    const filtered =
      options.includeClosed === false ? query.where(isNull(sessions.closedAt)) : query;
    const ordered = filtered.orderBy(asc(sessions.createdAt), asc(sessions.id));
    return options.limit === undefined ? ordered.all() : ordered.limit(options.limit).all();
  });
  if (!rows.ok) return rows;
  if (rows.value.length === 0) return ok([]);

  const seats = attempt({ table: 'session_seats' }, () =>
    db
      .select()
      .from(sessionSeats)
      .where(
        inArray(
          sessionSeats.sessionId,
          rows.value.map((row) => row.id),
        ),
      )
      .orderBy(asc(sessionSeats.sessionId), asc(sessionSeats.seat))
      .all(),
  );
  if (!seats.ok) return seats;
  const grouped = new Map<string, SessionSeatRow[]>();
  for (const seat of seats.value) {
    const bucket = grouped.get(seat.sessionId);
    if (bucket === undefined) grouped.set(seat.sessionId, [seat]);
    else bucket.push(seat);
  }
  return collect(rows.value.map((row) => decodeSessionRow(row, grouped.get(row.id) ?? [])));
}

/**
 * Write the session's current `TableState` back: config, button, hero, hand number, and all
 * six seats. The caller supplies `updatedAt`; the DB never reads the clock.
 */
export function updateSessionTable(
  db: GtoDatabase,
  id: SessionId,
  table: TableState,
  updatedAt: Timestamp,
): DbResult<null> {
  const validated = validateTableConfig(table.config);
  if (!validated.ok) return fromEngineError(validated.error, { table: 'sessions', id });
  const written = attempt({ table: 'sessions', id }, () =>
    db.transaction((tx) => {
      const result = tx
        .update(sessions)
        .set({
          configJson: JSON.stringify(table.config),
          buttonSeat: table.buttonSeat,
          heroSeat: table.heroSeat,
          handNumber: table.handNumber,
          updatedAt,
        })
        .where(eq(sessions.id, id))
        .run();
      if (result.changes === 0) return 0;
      for (const row of seatRows(id, table)) {
        tx.update(sessionSeats)
          .set({ occupancy: row.occupancy, playerId: row.playerId, stack: row.stack })
          .where(and(eq(sessionSeats.sessionId, id), eq(sessionSeats.seat, row.seat)))
          .run();
      }
      return result.changes;
    }),
  );
  if (!written.ok) return written;
  if (written.value === 0) {
    return dbErr('NOT_FOUND', `session ${id} does not exist`, { table: 'sessions', id });
  }
  return ok(null);
}

/**
 * Mark a sitting as ended. Idempotent writes are the caller's business, not a silent no-op.
 *
 * `closedAt` also becomes `updated_at`, so it must not precede the stored `updated_at`: a
 * backwards timestamp is a typed error everywhere else in this phase (`player-core`'s
 * `touch` and `recordObservation`), and silently rewinding `updated_at` would reorder the
 * session list against writes that really did happen later.
 */
export function closeSession(db: GtoDatabase, id: SessionId, closedAt: Timestamp): DbResult<null> {
  const current = attempt({ table: 'sessions', id }, () =>
    db.select({ updatedAt: sessions.updatedAt }).from(sessions).where(eq(sessions.id, id)).all(),
  );
  if (!current.ok) return current;
  const stored = current.value[0];
  if (stored === undefined) {
    return dbErr('NOT_FOUND', `session ${id} does not exist`, { table: 'sessions', id });
  }
  if (closedAt < stored.updatedAt) {
    return dbErr('INVALID_INPUT', `session ${id}: closedAt must not move updated_at backwards`, {
      table: 'sessions',
      id,
      field: 'updated_at',
      expected: `>= ${stored.updatedAt}`,
      actual: String(closedAt),
    });
  }
  const written = attempt({ table: 'sessions', id }, () =>
    db.update(sessions).set({ closedAt, updatedAt: closedAt }).where(eq(sessions.id, id)).run(),
  );
  if (!written.ok) return written;
  if (written.value.changes === 0) {
    return dbErr('NOT_FOUND', `session ${id} does not exist`, { table: 'sessions', id });
  }
  return ok(null);
}
