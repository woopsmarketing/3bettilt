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
import { ok, type MilliBB, type PlayerId, type SessionId } from '@gto-self/shared';
import {
  validateTableConfig,
  type AutoTopUpPolicy,
  type SeatIndex,
  type SeatOccupancy,
  type TableState,
} from '@gto-self/poker-core';
import type { Timestamp } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import {
  attempt,
  dbErr,
  dbError,
  fromEngineError,
  type DbError,
  type DbResult,
} from '../errors.js';
import { sessionSeats, sessions } from '../schema.js';
import { collect, decodeSessionRow, type SessionRecord, type SessionSeatRow } from '../rows.js';

const SEATS = [0, 1, 2, 3, 4, 5] as const;

/**
 * `threshold` has no column: a stored policy is `threshold = targetStack` by construction,
 * exactly as `defaultAutoTopUpPolicy` shapes it. A policy that disagrees is REFUSED rather
 * than written with the threshold quietly dropped — a write that loses a value the caller
 * supplied is the silent lossy behaviour `CLAUDE.md` rule 5 forbids.
 *
 * Returns the error, or `null` when the policy is storable. One function for the session
 * default and for a seat's own policy, so the two rules cannot drift apart.
 */
function unstorableThreshold(
  policy: AutoTopUpPolicy | null,
  table: string,
  id: SessionId,
  subject: string,
): DbError | null {
  if (policy === null || policy.threshold === policy.targetStack) return null;
  return dbError(
    'INVALID_INPUT',
    `${subject} cannot store an auto top-up threshold that differs from targetStack`,
    {
      table,
      id,
      field: 'auto_top_up_target_stack',
      expected: String(policy.targetStack),
      actual: String(policy.threshold),
    },
  );
}

/** The two policy columns for one seat. `null` writes NULL to both. */
function autoTopUpColumns(policy: AutoTopUpPolicy | null): {
  readonly autoTopUpEnabled: number | null;
  readonly autoTopUpTargetStack: number | null;
} {
  return {
    autoTopUpEnabled: policy === null ? null : policy.enabled ? 1 : 0,
    autoTopUpTargetStack: policy === null ? null : policy.targetStack,
  };
}

/**
 * The three columns the TABLE owns, for one seat. `stack_unverified` is deliberately NOT
 * here: `TableState` does not carry it (it is session state, like the auto top-up pair —
 * ADR-0078b), so `updateSessionTable` would have to invent it. `insertSession` adds it from
 * `SessionRecord.seatStackUnverified`, and `updateSessionSeats` is its only later writer.
 */
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

/**
 * Insert a session, its six seats, and each seat's own auto top-up policy in ONE
 * transaction.
 *
 * `record.autoTopUp` (the session DEFAULT) and every entry in `record.seatAutoTopUp` (a
 * seat's own preference) are stored as `enabled` + `targetStack` only, and any policy whose
 * `threshold` differs from its `targetStack` is REFUSED — see `unstorableThreshold`. The
 * refusal happens BEFORE the transaction opens, so a rejected policy writes nothing at all.
 */
export function insertSession(db: GtoDatabase, record: SessionRecord): DbResult<SessionRecord> {
  const validated = validateTableConfig(record.table.config);
  if (!validated.ok) return fromEngineError(validated.error, { table: 'sessions', id: record.id });
  const sessionPolicy = unstorableThreshold(record.autoTopUp, 'sessions', record.id, 'sessions');
  if (sessionPolicy !== null) return { ok: false, error: sessionPolicy };
  for (const seat of SEATS) {
    const seatPolicy = unstorableThreshold(
      record.seatAutoTopUp[seat] ?? null,
      'session_seats',
      record.id,
      `session_seats seat ${seat}`,
    );
    if (seatPolicy !== null) return { ok: false, error: seatPolicy };
  }
  const policy = record.autoTopUp;
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
          ...autoTopUpColumns(policy),
        })
        .run();
      tx.insert(sessionSeats)
        .values(
          seatRows(record.id, record.table).map((row) => ({
            ...row,
            ...autoTopUpColumns(record.seatAutoTopUp[row.seat] ?? null),
            stackUnverified: record.seatStackUnverified[row.seat] === true ? 1 : 0,
          })),
        )
        .run();
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
 *
 * The auto top-up columns are NOT touched — neither the session's default nor any seat's
 * own policy. `TableState` does not carry them (they are session state, not table config —
 * ADR-0045), so rewriting them from one would invent data. `updateSessionSeatAutoTopUp` is
 * the only way a seat's policy changes after the session is created.
 *
 * `session_seats.stack_unverified` is NOT touched either, for exactly the same reason:
 * `TableState` carries no notion of whether a human has confirmed a number (ADR-0078b), so
 * this function has nothing honest to write there. `updateSessionSeats` is its only writer
 * after `insertSession`.
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
 * Set (or clear) ONE seat's own auto top-up policy. The table-side toggle.
 *
 * Auto top-up is a per-seat preference, so this writes exactly two columns of exactly one
 * row: occupancy, player, stack and `stack_unverified` are the table's business and are never
 * touched here, and neither is the session's default policy or its `updated_at`. Toggling a
 * top-up policy must not silently confirm — or unconfirm — a stack (ADR-0078b).
 *
 * `policy === null` clears the seat back to "records no policy". A policy whose `threshold`
 * differs from its `targetStack` is REFUSED, exactly as `insertSession` refuses one.
 *
 * A session or seat that does not exist is `NOT_FOUND`, not a silent no-op: all six seat
 * rows always exist for a session that does, so zero affected rows can only mean the caller
 * named something that is not there.
 */
export function updateSessionSeatAutoTopUp(
  db: GtoDatabase,
  sessionId: SessionId,
  seat: SeatIndex,
  policy: AutoTopUpPolicy | null,
): DbResult<null> {
  const unstorable = unstorableThreshold(
    policy,
    'session_seats',
    sessionId,
    `session_seats seat ${seat}`,
  );
  if (unstorable !== null) return { ok: false, error: unstorable };

  const written = attempt({ table: 'session_seats', id: sessionId }, () =>
    db
      .update(sessionSeats)
      .set(autoTopUpColumns(policy))
      .where(and(eq(sessionSeats.sessionId, sessionId), eq(sessionSeats.seat, seat)))
      .run(),
  );
  if (!written.ok) return written;
  if (written.value.changes === 0) {
    return dbErr('NOT_FOUND', `session ${sessionId} has no seat ${seat}`, {
      table: 'session_seats',
      id: sessionId,
      field: 'seat',
      actual: String(seat),
    });
  }
  return ok(null);
}

/**
 * Set ONE seat's occupancy: `ACTIVE` <-> `SITTING_OUT`. The table-side `S` toggle.
 *
 * Writes exactly one column of exactly one row: the player, the stack and its
 * `stack_unverified` mark are the table's business and are never touched here, matching
 * `updateSessionSeatAutoTopUp` immediately above. Moving a seat to `EMPTY` is `updateSessionTable`'s business (vacating a seat is a
 * bigger operation than this toggle), not this function — only `ACTIVE` and `SITTING_OUT`
 * are accepted.
 *
 * A session or seat that does not exist is `NOT_FOUND`, not a silent no-op: all six seat
 * rows always exist for a session that does, so zero affected rows can only mean the caller
 * named something that is not there.
 */
export function updateSessionSeatOccupancy(
  db: GtoDatabase,
  sessionId: SessionId,
  seat: SeatIndex,
  occupancy: 'ACTIVE' | 'SITTING_OUT',
): DbResult<null> {
  const written = attempt({ table: 'session_seats', id: sessionId }, () =>
    db
      .update(sessionSeats)
      .set({ occupancy })
      .where(and(eq(sessionSeats.sessionId, sessionId), eq(sessionSeats.seat, seat)))
      .run(),
  );
  if (!written.ok) return written;
  if (written.value.changes === 0) {
    return dbErr('NOT_FOUND', `session ${sessionId} has no seat ${seat}`, {
      table: 'session_seats',
      id: sessionId,
      field: 'seat',
      actual: String(seat),
    });
  }
  return ok(null);
}

/**
 * One seat's stored state, as `updateSessionSeats` accepts it.
 *
 * Exactly the three columns the table owns: `occupancy`, `player_id`, `stack`. The auto
 * top-up pair is deliberately absent — it is a per-seat PREFERENCE, not table state, and
 * `updateSessionSeatAutoTopUp` remains the only way it changes (ADR-0045).
 *
 * `stack` is an ACTUAL entered value in integer milliBB, never a bucket (`CLAUDE.md` rule 1).
 */
export interface SessionSeatStateUpdate {
  readonly seat: SeatIndex;
  readonly occupancy: SeatOccupancy;
  readonly playerId: PlayerId | null;
  readonly stack: MilliBB;
  /**
   * `true` while `stack` above is a number nobody has confirmed since the hand that disturbed
   * it — the 확인 필요 mark, stored rather than kept in memory (ADR-0078b, migration `0010`).
   *
   * REQUIRED, not optional-with-a-default: this updater is the ONLY writer of the column
   * after the session is created, so an omitted field would silently clear a seat's warning
   * on the next unrelated sync and present an unverified number as a confirmed one — exactly
   * the defect the column exists to fix. Every caller states which of the two it means.
   */
  readonly stackUnverified: boolean;
}

/**
 * What the one transaction each of the two narrow updaters below runs decided, WITHOUT
 * throwing. Every member is reported before the first write of that transaction, so a
 * `NOT_FOUND` or a backwards `updated_at` leaves the database byte-identical rather than
 * half-applied. Anything the DATABASE refuses afterwards (a CHECK, an FK) throws instead and
 * rolls the whole transaction back — see the note on `updateSessionSeats`.
 */
type SessionWriteOutcome =
  | { readonly kind: 'OK' }
  | { readonly kind: 'NO_SESSION' }
  | { readonly kind: 'MISSING_SEAT'; readonly seat: SeatIndex }
  | { readonly kind: 'BACKWARDS'; readonly storedUpdatedAt: number };

/** `NO_SESSION` / `MISSING_SEAT` / `BACKWARDS` as this package's typed errors. */
function sessionWriteError(
  outcome: Exclude<SessionWriteOutcome, { readonly kind: 'OK' }>,
  id: SessionId,
  updatedAt: Timestamp,
): DbError {
  switch (outcome.kind) {
    case 'NO_SESSION':
      return dbError('NOT_FOUND', `session ${id} does not exist`, { table: 'sessions', id });
    case 'MISSING_SEAT':
      return dbError('NOT_FOUND', `session ${id} has no seat ${outcome.seat}`, {
        table: 'session_seats',
        id,
        field: 'seat',
        actual: String(outcome.seat),
      });
    case 'BACKWARDS':
      return dbError(
        'INVALID_INPUT',
        `session ${id}: updatedAt must not move updated_at backwards`,
        {
          table: 'sessions',
          id,
          field: 'updated_at',
          expected: `>= ${outcome.storedUpdatedAt}`,
          actual: String(updatedAt),
        },
      );
  }
}

/**
 * Write the CURRENT stored state of one or more seats: occupancy, player, stack and whether
 * that stack is still UNVERIFIED, plus the session's `updated_at`. The between-hands correction path (a manual stack re-sync, a seat
 * sitting out, a player swap — ADR-0074's §4 persistence boundary).
 *
 * Narrow ON PURPOSE, in the shape of `updateSessionSeatAutoTopUp` / `updateSessionSeatOccupancy`
 * rather than of `updateSessionTable`: sending a whole `TableState` over the wire to move one
 * stack would let a stale client rewrite `config_json`, `hero_seat` or `hand_number`. Those
 * three columns, and BOTH auto top-up columns of every seat, are never touched here.
 *
 * ALL OR NOTHING. One transaction, and every existence check runs BEFORE the first write, so a
 * missing session or seat writes nothing at all. A value the DATABASE refuses — a negative or
 * fractional `stack`, an `EMPTY` seat that still names a player, a `player_id` with no
 * `players` row — throws inside the transaction, which rolls back every earlier seat in the
 * same call. The stack CHECKs on `session_seats` are deliberately the authority on what a
 * storable stack is; this function does not keep a second opinion about them
 * (`CLAUDE.md` rule 1 lives in `poker-core` and in the constraint, not here).
 *
 * A duplicate `seat` is REFUSED rather than resolved last-write-wins: two disagreeing values
 * for one seat is a caller bug, and silently dropping one of them is the lossy behaviour
 * `CLAUDE.md` rule 5 forbids. An empty `seats` list writes nothing — not even `updated_at` —
 * but still reports `NOT_FOUND` for a session that does not exist.
 *
 * `updated_at` never moves backwards, exactly as `closeSession` refuses to rewind it.
 */
export function updateSessionSeats(
  db: GtoDatabase,
  id: SessionId,
  seats: readonly SessionSeatStateUpdate[],
  updatedAt: Timestamp,
): DbResult<null> {
  const seen = new Set<SeatIndex>();
  for (const seat of seats) {
    if (seen.has(seat.seat)) {
      return dbErr('INVALID_INPUT', `session ${id}: seat ${seat.seat} was supplied twice`, {
        table: 'session_seats',
        id,
        field: 'seat',
        actual: String(seat.seat),
      });
    }
    seen.add(seat.seat);
  }

  const written = attempt({ table: 'session_seats', id }, () =>
    db.transaction((tx): SessionWriteOutcome => {
      const stored = tx
        .select({ updatedAt: sessions.updatedAt })
        .from(sessions)
        .where(eq(sessions.id, id))
        .all()[0];
      if (stored === undefined) return { kind: 'NO_SESSION' };
      if (updatedAt < stored.updatedAt) {
        return { kind: 'BACKWARDS', storedUpdatedAt: stored.updatedAt };
      }
      if (seats.length === 0) return { kind: 'OK' };

      // Every requested row is proven to exist BEFORE anything is written, so the loop below
      // cannot leave some seats updated and others silently skipped.
      const present = new Set(
        tx
          .select({ seat: sessionSeats.seat })
          .from(sessionSeats)
          .where(
            and(
              eq(sessionSeats.sessionId, id),
              inArray(
                sessionSeats.seat,
                seats.map((seat) => seat.seat),
              ),
            ),
          )
          .all()
          .map((row) => row.seat),
      );
      for (const seat of seats) {
        if (!present.has(seat.seat)) return { kind: 'MISSING_SEAT', seat: seat.seat };
      }

      tx.update(sessions).set({ updatedAt }).where(eq(sessions.id, id)).run();
      for (const seat of seats) {
        tx.update(sessionSeats)
          .set({
            occupancy: seat.occupancy,
            playerId: seat.playerId,
            stack: seat.stack,
            stackUnverified: seat.stackUnverified ? 1 : 0,
          })
          .where(and(eq(sessionSeats.sessionId, id), eq(sessionSeats.seat, seat.seat)))
          .run();
      }
      return { kind: 'OK' };
    }),
  );
  if (!written.ok) return written;
  if (written.value.kind !== 'OK') {
    return { ok: false, error: sessionWriteError(written.value, id, updatedAt) };
  }
  return ok(null);
}

/**
 * Move (or clear) the button seat, and nothing else.
 *
 * Writes exactly `sessions.button_seat` and `sessions.updated_at`. `hero_seat`,
 * `hand_number` and `config_json` are NOT touched: designating the button is a correction to
 * where the button is, never a hand advance — the button rotation that belongs to a hand is
 * `poker-core`'s business and reaches storage through the hand itself.
 *
 * `null` clears the button back to "no button designated", which is what a session that has
 * not started a hand yet stores. A session that does not exist is `NOT_FOUND`, not a silent
 * no-op, and `updated_at` never moves backwards.
 */
export function updateSessionButtonSeat(
  db: GtoDatabase,
  id: SessionId,
  buttonSeat: SeatIndex | null,
  updatedAt: Timestamp,
): DbResult<null> {
  const written = attempt({ table: 'sessions', id }, () =>
    db.transaction((tx): SessionWriteOutcome => {
      const stored = tx
        .select({ updatedAt: sessions.updatedAt })
        .from(sessions)
        .where(eq(sessions.id, id))
        .all()[0];
      if (stored === undefined) return { kind: 'NO_SESSION' };
      if (updatedAt < stored.updatedAt) {
        return { kind: 'BACKWARDS', storedUpdatedAt: stored.updatedAt };
      }
      tx.update(sessions).set({ buttonSeat, updatedAt }).where(eq(sessions.id, id)).run();
      return { kind: 'OK' };
    }),
  );
  if (!written.ok) return written;
  if (written.value.kind !== 'OK') {
    return { ok: false, error: sessionWriteError(written.value, id, updatedAt) };
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
