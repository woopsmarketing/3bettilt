/**
 * `hands`, `hand_players`, `hand_events`.
 *
 * A hand IS its ordered event log. `hand_events` is therefore the only authoritative table
 * here: `loadStoredHand` reads events and nothing else, and rebuilds `HandState` with
 * `poker-core`'s **`loadHand`**.
 *
 * `loadHand` and not `replayHand`, deliberately. `loadHand` is the STRUCTURAL path: it
 * asserts arithmetic identities and chip/pot conservation but not rule-dependent legality,
 * so a later corrected rule (a min-raise basis, a blind option) never makes already-stored
 * history unloadable. `replayHand` re-validates every action against today's rules, which
 * is exactly what the Phase-11 parser wants and exactly what persistence must not do.
 *
 * `hands.hand_number` and every `hand_players` row are PROJECTIONS of the log, written in
 * the same transaction as the events they come from; they exist so a session's hand list
 * and a player's hand history do not require decoding every log. `hand_number` is checked
 * against `HAND_STARTED` before it is written. The `hand_players` rows are taken from the
 * caller-supplied `hand.state` and are NOT re-derived from the log — they are an index, and
 * `loadStoredHand` never consults them, so a disagreement can misfile a hand in a player's
 * history but can never change what the hand was.
 */
import { and, asc, count, eq, inArray, isNotNull, lt, max } from 'drizzle-orm';
import { asId, ok, type HandId, type PlayerId, type SessionId } from '@gto-self/shared';
import {
  decodeHandEvents,
  encodeHandEvent,
  loadHand,
  type Hand,
  type HandEvent,
} from '@gto-self/poker-core';
import type { Timestamp } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, fromEngineError, type DbResult } from '../errors.js';
import {
  CURRENT_HAND_SCHEMA_VERSION,
  handEvents,
  handPlayers,
  hands,
  sessions,
  type HandSource,
} from '../schema.js';
import {
  collect,
  decodeHandEventRow,
  decodeHandPlayerRow,
  decodeHandRow,
  type HandRecord,
  type HandSeatRecord,
} from '../rows.js';

/** The row shape one `HandEvent` writes. The payload is the whole event; the rest is index. */
function eventRow(handId: HandId, event: HandEvent) {
  return {
    handId,
    seq: event.seq,
    eventId: event.id,
    commandSeq: event.commandSeq,
    origin: event.origin,
    kind: event.kind,
    payloadJson: JSON.stringify(encodeHandEvent(event)),
  };
}

/**
 * The `hand_players` projection rows. Taken from the caller-supplied `hand.state`, NOT
 * re-derived from the log — see this module's header.
 */
function seatRows(handId: HandId, hand: Hand) {
  return hand.state.dealtInSeats.map((seat) => ({
    handId,
    seat,
    playerId: hand.state.seats[seat].playerId,
    startingStack: hand.state.seats[seat].startingStack,
  }));
}

/**
 * The header projection check both insert paths share: the log must begin with
 * `HAND_STARTED`, and that event's own `handId`/`handNumber` must agree with the
 * caller-supplied folded state. Returns the id the header will be written under.
 *
 * Without this comparison "the projection came from the log" would be a claim about the
 * caller rather than a fact.
 */
function checkedHandId(hand: Hand): DbResult<HandId> {
  const first = hand.events[0];
  if (first === undefined || first.kind !== 'HAND_STARTED') {
    return dbErr('INVALID_INPUT', 'a hand must begin with HAND_STARTED', { table: 'hands' });
  }
  if (first.handId !== hand.state.handId) {
    return dbErr('INVALID_INPUT', 'HAND_STARTED.handId disagrees with the folded state', {
      table: 'hands',
      id: hand.state.handId,
    });
  }
  if (first.handNumber !== hand.state.handNumber) {
    return dbErr('INVALID_INPUT', 'HAND_STARTED.handNumber disagrees with the folded state', {
      table: 'hands',
      id: hand.state.handId,
      field: 'hand_number',
      expected: String(first.handNumber),
      actual: String(hand.state.handNumber),
    });
  }
  return ok(hand.state.handId);
}

export interface InsertHandInput {
  readonly sessionId: SessionId;
  /** A started hand. Its `events` are written in full and its state supplies the projections. */
  readonly hand: Hand;
  /** Caller-supplied (ADR-0007's sibling rule: the DB never reads the clock). */
  readonly startedAt: Timestamp;
}

/**
 * Insert a hand header, its dealt-in seats, and its events so far — one transaction.
 *
 * The header's `hand_number` is a CHECKED projection: `hand.state` is caller-supplied and
 * is not re-folded here, so the number written is compared against `HAND_STARTED`'s own
 * `handNumber` and a disagreement is refused rather than stored. Without that comparison
 * "the projection came from the log" would be a claim about the caller, not a fact.
 */
export function insertHand(db: GtoDatabase, input: InsertHandInput): DbResult<HandId> {
  const { hand } = input;
  const checked = checkedHandId(hand);
  if (!checked.ok) return checked;
  const handId = checked.value;
  const written = attempt({ table: 'hands', id: handId }, () => {
    db.transaction((tx) => {
      tx.insert(hands)
        .values({
          id: handId,
          sessionId: input.sessionId,
          handNumber: hand.state.handNumber,
          startedAt: input.startedAt,
          finishedAt: null,
        })
        .run();
      const seats = seatRows(handId, hand);
      if (seats.length > 0) tx.insert(handPlayers).values(seats).run();
      if (hand.events.length > 0) {
        tx.insert(handEvents)
          .values(hand.events.map((event) => eventRow(handId, event)))
          .run();
      }
    });
    return handId;
  });
  if (!written.ok) return written;
  return ok(handId);
}

// ---------------------------------------------------------------------------
// Completed-hand persistence (C0, ADR-0059)
// ---------------------------------------------------------------------------

export interface InsertCompletedHandInput {
  readonly sessionId: SessionId;
  /** A hand that has REACHED COMPLETE. Its whole log is written in one transaction. */
  readonly hand: Hand;
  /** Caller-supplied (ADR-0040: the DB never reads the clock). */
  readonly startedAt: Timestamp;
  /** When the hand reached COMPLETE. Written in the SAME transaction as the events. */
  readonly finishedAt: Timestamp;
  /** How the hand reached us. Defaults to `MANUAL_PRACTICE`. */
  readonly source?: HandSource;
}

/**
 * What a completed-hand write did.
 *
 * `PERSISTED` — the rows were written by this call.
 * `ALREADY_PERSISTED` — a matching hand was already stored; this call wrote NOTHING.
 *
 * `ALREADY_PERSISTED` is an OUTCOME, not an error: a duplicate save is the expected
 * consequence of a re-render, a double-fired callback, a retry or a repeated click, and the
 * caller needs to tell it apart from a failure it must surface (prompt §9).
 */
export type CompletedHandOutcome = 'PERSISTED' | 'ALREADY_PERSISTED';

export interface InsertCompletedHandResult {
  readonly handId: HandId;
  readonly outcome: CompletedHandOutcome;
}

/**
 * Persist a COMPLETED hand — header, dealt-in lineup and every event — in ONE transaction,
 * EXACTLY ONCE (ADR-0059).
 *
 * **Precondition: the hand is actually finished.** Its log must end in `HAND_FINISHED` and
 * its folded state must be `COMPLETE`. A hand that has not settled is refused with
 * `INVALID_INPUT` and nothing is written: storing a "complete" hand whose awards, rake and
 * fee are not final would put a fiction into the one table the whole product treats as
 * ground truth (prompt §5, `CLAUDE.md` rule 5).
 *
 * **Exactly-once is the DATABASE's job, not the caller's.** `hands.id` is the engine's own
 * stable `handId` and it is the primary key, so a second write cannot produce a second row.
 * This function probes for that row FIRST and reports:
 *
 * - `ALREADY_PERSISTED` when the stored hand IS this hand — the same session, the same
 *   `hand_number`, and the same number of stored events. That is a deliberately CHEAP
 *   integrity probe: re-decoding the whole log to compare it event by event would put an
 *   O(log) read on the path every duplicate callback takes, and the three values it does
 *   compare are exactly the ones that differ when a DIFFERENT hand has been given the same
 *   id (a colliding id factory, a re-used fixture id, a caller mixing up two hands). It is
 *   a tripwire for a genuine identity collision, not a checksum of the history.
 * - `CONFLICT` when a row exists under this id but disagrees on any of the three. That is
 *   never a benign duplicate, and it must not be silently swallowed as one.
 *
 * A duplicate call writes nothing at all — not even a `finished_at` update, which the
 * ADR-0060 trigger would refuse anyway.
 *
 * **A successful write also advances `sessions.hand_number`**, monotonically, in the same
 * transaction — see the comment at the update. That column is the counter the next hand is
 * numbered from, so it has to be durable or a reloaded session renumbers from 1 and every
 * further hand collides on `UNIQUE(session_id, hand_number)`. A collision that does happen
 * anyway (two tabs racing the same stale counter) is reported as a named `CONFLICT`, never
 * as `ALREADY_PERSISTED`: that outcome requires the SAME `hands.id`.
 */
export function insertCompletedHand(
  db: GtoDatabase,
  input: InsertCompletedHandInput,
): DbResult<InsertCompletedHandResult> {
  const { hand } = input;
  const checked = checkedHandId(hand);
  if (!checked.ok) return checked;
  const handId = checked.value;

  const last = hand.events.at(-1);
  if (hand.state.phase !== 'COMPLETE' || last === undefined || last.kind !== 'HAND_FINISHED') {
    return dbErr(
      'INVALID_INPUT',
      `hand ${handId} is not complete: its log must end in HAND_FINISHED and its state must be COMPLETE`,
      {
        table: 'hands',
        id: handId,
        field: 'finished_at',
        expected: 'COMPLETE / HAND_FINISHED',
        actual: `${hand.state.phase} / ${last?.kind ?? '(empty log)'}`,
      },
    );
  }
  if (input.finishedAt < input.startedAt) {
    return dbErr('INVALID_INPUT', `hand ${handId}: finishedAt precedes startedAt`, {
      table: 'hands',
      id: handId,
      field: 'finished_at',
      expected: `>= ${input.startedAt}`,
      actual: String(input.finishedAt),
    });
  }

  const existing = getHand(db, handId);
  if (!existing.ok) return existing;
  if (existing.value !== null) {
    const stored = existing.value;
    const storedEvents = countStoredEvents(db, handId);
    if (!storedEvents.ok) return storedEvents;
    const disagreement =
      stored.sessionId !== input.sessionId
        ? (['session_id', stored.sessionId, input.sessionId] as const)
        : stored.handNumber !== hand.state.handNumber
          ? (['hand_number', String(stored.handNumber), String(hand.state.handNumber)] as const)
          : storedEvents.value !== hand.events.length
            ? (['seq', String(storedEvents.value), String(hand.events.length)] as const)
            : null;
    if (disagreement !== null) {
      const [field, actual, expected] = disagreement;
      return dbErr(
        'CONFLICT',
        `hand ${handId} is already stored, but the stored hand is NOT this hand (${field} ${actual} vs ${expected})`,
        { table: 'hands', id: handId, field, expected, actual },
      );
    }
    return ok({ handId, outcome: 'ALREADY_PERSISTED' });
  }

  // A DIFFERENT hand already holding this session's `hand_number`. The probe above is keyed
  // on `hands.id`, so it cannot see this case at all: the id is new, only the NUMBER
  // collides. Left to the INSERT it would surface as a raw
  // `UNIQUE constraint failed: hands.session_id, hands.hand_number` driver message; named
  // here instead, so the banner says something a user can act on and so it can never be
  // mistaken for the benign `ALREADY_PERSISTED` outcome (which requires the same id AND the
  // same number). See ADR-0059 and the reload high-water-mark rule below.
  const numbered = numberHolder(db, input.sessionId, hand.state.handNumber);
  if (!numbered.ok) return numbered;
  if (numbered.value !== null && numbered.value !== handId) {
    return dbErr(
      'CONFLICT',
      `session ${input.sessionId} already stores a DIFFERENT hand (${numbered.value}) as hand number ${hand.state.handNumber}; this hand was numbered from a stale counter`,
      {
        table: 'hands',
        id: handId,
        field: 'hand_number',
        expected: String(hand.state.handNumber),
        actual: numbered.value,
      },
    );
  }

  const written = attempt({ table: 'hands', id: handId }, () => {
    db.transaction((tx) => {
      tx.insert(hands)
        .values({
          id: handId,
          sessionId: input.sessionId,
          handNumber: hand.state.handNumber,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          source: input.source ?? 'MANUAL_PRACTICE',
          schemaVersion: CURRENT_HAND_SCHEMA_VERSION,
        })
        .run();
      const seats = seatRows(handId, hand);
      if (seats.length > 0) tx.insert(handPlayers).values(seats).run();
      tx.insert(handEvents)
        .values(hand.events.map((event) => eventRow(handId, event)))
        .run();
      // Advance the session's DURABLE hand counter, in the SAME transaction as the hand.
      //
      // `sessions.hand_number` mirrors `TableState.handNumber`, which is the number the NEXT
      // hand will take — `startHand` numbers a hand `table.handNumber` and `advanceButton`
      // increments afterwards — hence `+ 1` here. (ADR-0039 calls `hands.hand_number` a
      // projection of the log; the session column is the between-hands table state.)
      //
      // Before this it was written once, at session creation, and never again — so a reload
      // handed the store a counter of 0, the next hand reused a number already stored, and
      // `UNIQUE(session_id, hand_number)` made every hand of that page life permanently
      // unstorable (review R1/B1).
      //
      // The update is MONOTONE (`WHERE hand_number < next`) and shares the hand's
      // transaction, so it can neither move the counter backwards nor be committed without
      // the hand it describes. `updated_at` is deliberately NOT touched: it orders sitting
      // activity and `closeSession` refuses to move it backwards, and a completed hand may
      // legitimately be persisted after the sitting was closed in another tab.
      const next = hand.state.handNumber + 1;
      tx.update(sessions)
        .set({ handNumber: next })
        .where(and(eq(sessions.id, input.sessionId), lt(sessions.handNumber, next)))
        .run();
    });
  });
  if (!written.ok) return written;
  return ok({ handId, outcome: 'PERSISTED' });
}

/**
 * Internal. The id of the hand already stored under this session's `hand_number`, or `null`.
 *
 * `UNIQUE(session_id, hand_number)` guarantees at most one.
 */
function numberHolder(
  db: GtoDatabase,
  sessionId: SessionId,
  handNumber: number,
): DbResult<HandId | null> {
  const rows = attempt({ table: 'hands', id: sessionId }, () =>
    db
      .select({ id: hands.id })
      .from(hands)
      .where(and(eq(hands.sessionId, sessionId), eq(hands.handNumber, handNumber)))
      .all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return ok(asId<'Hand'>(row.id) as HandId);
}

/**
 * The highest `hand_number` this session has ever stored, or `null` when it has stored none.
 *
 * The DURABLE high-water mark. A reloaded table must number its next hand ABOVE this or it
 * collides on `UNIQUE(session_id, hand_number)` — note that `TableState.handNumber` is the
 * NEXT number, so a caller seeding a table from this value adds one.
 *
 * `insertCompletedHand` keeps `sessions.hand_number` in step, so for any session written
 * since that fix the two agree. This exists because a session written BEFORE it has a stale
 * `sessions.hand_number` of `0` with real hands behind it, and reading the hands themselves
 * is the only way to recover the true mark for those rows.
 *
 * Unfinished headers count: they hold their number in the unique index just as finished ones
 * do, so skipping them would hand back a mark that is not actually free.
 */
export function maxStoredHandNumber(
  db: GtoDatabase,
  sessionId: SessionId,
): DbResult<number | null> {
  const rows = attempt({ table: 'hands', id: sessionId }, () =>
    db
      .select({ value: max(hands.handNumber) })
      .from(hands)
      .where(eq(hands.sessionId, sessionId))
      .all(),
  );
  if (!rows.ok) return rows;
  return ok(rows.value[0]?.value ?? null);
}

/** Internal. How many event rows are stored for a hand. */
function countStoredEvents(db: GtoDatabase, handId: HandId): DbResult<number> {
  const rows = attempt({ table: 'hand_events', id: handId }, () =>
    db.select({ value: count() }).from(handEvents).where(eq(handEvents.handId, handId)).all(),
  );
  if (!rows.ok) return rows;
  return ok(rows.value[0]?.value ?? 0);
}

/** Internal. The highest stored `seq` for a hand, or `null` when nothing is stored. */
function lastStoredSeq(db: GtoDatabase, handId: HandId): DbResult<number | null> {
  const rows = attempt({ table: 'hand_events', id: handId }, () =>
    db
      .select({ value: max(handEvents.seq) })
      .from(handEvents)
      .where(eq(handEvents.handId, handId))
      .all(),
  );
  if (!rows.ok) return rows;
  return ok(rows.value[0]?.value ?? null);
}

/**
 * Append events to an existing hand, IN ORDER.
 *
 * The appended `seq` values must continue densely from what is stored: an append that would
 * leave a gap, repeat a seq, or arrive out of order is a CONFLICT, not a write. `seq` is
 * the ordering key of the whole system, and a log with a hole in it is not a hand.
 */
export function appendHandEvents(
  db: GtoDatabase,
  handId: HandId,
  events: readonly HandEvent[],
): DbResult<number> {
  if (events.length === 0) return ok(0);
  const header = getHand(db, handId);
  if (!header.ok) return header;
  if (header.value === null) {
    return dbErr('NOT_FOUND', `hand ${handId} does not exist`, { table: 'hands', id: handId });
  }
  const last = lastStoredSeq(db, handId);
  if (!last.ok) return last;
  let expected = (last.value ?? -1) + 1;
  for (const event of events) {
    if (event.seq !== expected) {
      return dbErr(
        'CONFLICT',
        `hand ${handId}: expected the next event at seq ${expected}, got ${event.seq}`,
        {
          table: 'hand_events',
          id: handId,
          field: 'seq',
          expected: String(expected),
          actual: String(event.seq),
        },
      );
    }
    expected += 1;
  }
  const written = attempt({ table: 'hand_events', id: handId }, () =>
    db
      .insert(handEvents)
      .values(events.map((event) => eventRow(handId, event)))
      .run(),
  );
  if (!written.ok) return written;
  return ok(events.length);
}

/** `null` when absent. */
export function getHand(db: GtoDatabase, handId: HandId): DbResult<HandRecord | null> {
  const rows = attempt({ table: 'hands', id: handId }, () =>
    db.select().from(hands).where(eq(hands.id, handId)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodeHandRow(row);
}

/** A session's hands in the order they were played. */
export function listHandsForSession(
  db: GtoDatabase,
  sessionId: SessionId,
): DbResult<readonly HandRecord[]> {
  const rows = attempt({ table: 'hands' }, () =>
    db
      .select()
      .from(hands)
      .where(eq(hands.sessionId, sessionId))
      .orderBy(asc(hands.handNumber))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeHandRow));
}

/** The dealt-in seats projection. The LOG remains authoritative for everything else. */
export function listHandSeats(
  db: GtoDatabase,
  handId: HandId,
): DbResult<readonly HandSeatRecord[]> {
  const rows = attempt({ table: 'hand_players', id: handId }, () =>
    db
      .select()
      .from(handPlayers)
      .where(eq(handPlayers.handId, handId))
      .orderBy(asc(handPlayers.seat))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeHandPlayerRow));
}

/**
 * A hand's events in `seq` order, each decoded through `poker-core`'s zod codec and then
 * re-checked as a log (dense `seq`, non-decreasing `commandSeq`) by `decodeHandEvents`.
 */
export function loadHandEvents(db: GtoDatabase, handId: HandId): DbResult<readonly HandEvent[]> {
  const rows = attempt({ table: 'hand_events', id: handId }, () =>
    db
      .select()
      .from(handEvents)
      .where(eq(handEvents.handId, handId))
      .orderBy(asc(handEvents.seq))
      .all(),
  );
  if (!rows.ok) return rows;
  if (rows.value.length === 0) {
    return dbErr('NOT_FOUND', `hand ${handId} has no stored events`, {
      table: 'hand_events',
      id: handId,
    });
  }
  const decoded = collect(rows.value.map(decodeHandEventRow));
  if (!decoded.ok) return decoded;
  // Re-run the engine's own log-level checks over the decoded events.
  const asLog = decodeHandEvents(decoded.value.map((event) => encodeHandEvent(event)));
  if (!asLog.ok) return fromEngineError(asLog.error, { table: 'hand_events', id: handId });
  return ok(asLog.value);
}

/**
 * Rebuild a stored hand: events -> `loadHand` -> `Hand` (log + folded `HandState`).
 *
 * The structural path, not `replayHand` — see this module's header.
 */
export function loadStoredHand(db: GtoDatabase, handId: HandId): DbResult<Hand> {
  const events = loadHandEvents(db, handId);
  if (!events.ok) return events;
  const hand = loadHand(events.value);
  if (!hand.ok) return fromEngineError(hand.error, { table: 'hand_events', id: handId });
  return hand;
}

// ---------------------------------------------------------------------------
// The completed-history read surface (what post-session analysis consumes)
// ---------------------------------------------------------------------------

/**
 * Every COMPLETED hand this player was dealt into, across ALL sessions, in a DETERMINISTIC
 * order: `started_at`, then `id` as the tie-break.
 *
 * Determinism is the point, not a nicety. A full recomputation is identified by a hash over
 * its inputs, and two runs over the same rows must produce the same list — SQLite's natural
 * row order is not a promise, and two hands can share a `started_at` millisecond.
 *
 * "Completed" means `finished_at IS NOT NULL`. A half-entered hand is not evidence.
 */
export function listCompletedHandIdsForPlayer(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<readonly HandId[]> {
  const rows = attempt({ table: 'hand_players', id: playerId }, () =>
    db
      .select({ id: hands.id })
      .from(hands)
      .innerJoin(handPlayers, eq(handPlayers.handId, hands.id))
      .where(and(eq(handPlayers.playerId, playerId), isNotNull(hands.finishedAt)))
      .orderBy(asc(hands.startedAt), asc(hands.id))
      .all(),
  );
  if (!rows.ok) return rows;
  return ok(rows.value.map((row) => asId<'Hand'>(row.id) as HandId));
}

/** A session's COMPLETED hand headers, in the order they were played (`hand_number`). */
export function listCompletedHandsForSession(
  db: GtoDatabase,
  sessionId: SessionId,
): DbResult<readonly HandRecord[]> {
  const rows = attempt({ table: 'hands', id: sessionId }, () =>
    db
      .select()
      .from(hands)
      .where(and(eq(hands.sessionId, sessionId), isNotNull(hands.finishedAt)))
      .orderBy(asc(hands.handNumber))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeHandRow));
}

/**
 * The players who were dealt into at least one COMPLETED hand of this session, ascending by
 * id. This is the DISCOVERY query: a session's scope says WHICH players a run must
 * recompute, never which hands the recomputation reads (ADR-0062b).
 *
 * A seat with no `Player` record contributes nothing — there is no identity to attach a
 * model to.
 */
export function listPlayerIdsWithCompletedHandsInSession(
  db: GtoDatabase,
  sessionId: SessionId,
): DbResult<readonly PlayerId[]> {
  const rows = attempt({ table: 'hand_players', id: sessionId }, () =>
    db
      .selectDistinct({ playerId: handPlayers.playerId })
      .from(handPlayers)
      .innerJoin(hands, eq(hands.id, handPlayers.handId))
      .where(
        and(
          eq(hands.sessionId, sessionId),
          isNotNull(hands.finishedAt),
          isNotNull(handPlayers.playerId),
        ),
      )
      .orderBy(asc(handPlayers.playerId))
      .all(),
  );
  if (!rows.ok) return rows;
  const ids: PlayerId[] = [];
  for (const row of rows.value) {
    if (row.playerId !== null) ids.push(asId<'Player'>(row.playerId) as PlayerId);
  }
  return ok(ids);
}

/**
 * How many hand ids one `inArray` may bind. Well under better-sqlite3's default
 * `SQLITE_MAX_VARIABLE_NUMBER` (32766), with room for any other bound parameter the
 * statement carries.
 */
const HAND_ID_CHUNK = 500;

/**
 * Batch-load stored hands, IN THE ORDER REQUESTED, through the ordinary `loadStoredHand`
 * path (events -> `loadHand`) so a batch read and a single read can never disagree about
 * what a hand was.
 *
 * Every id must name a hand that exists AND is finished: an unknown id, or one whose hand
 * never completed, is `NOT_FOUND` for the whole batch rather than a quietly shorter list.
 * A recomputation that silently read fewer hands than it asked for would produce a
 * plausible, wrong model.
 */
export function loadCompletedHands(
  db: GtoDatabase,
  handIds: readonly HandId[],
): DbResult<readonly Hand[]> {
  if (handIds.length === 0) return ok([]);
  const finished = new Map<string, number | null>();
  // Chunked: `inArray` binds one parameter per id, and SQLite's `SQLITE_MAX_VARIABLE_NUMBER`
  // ceiling would turn a large enough history into a driver throw rather than a read.
  // ADR-0062b recomputes over ALL of a player's history, which grows without bound, so the
  // ceiling is reachable in normal use and not only in an abuse case. Same reasoning, and
  // same shape, as `insertAnalysisResults`'s chunked writes.
  for (let index = 0; index < handIds.length; index += HAND_ID_CHUNK) {
    const chunk = handIds.slice(index, index + HAND_ID_CHUNK);
    const rows = attempt({ table: 'hands' }, () =>
      db
        .select({ id: hands.id, finishedAt: hands.finishedAt })
        .from(hands)
        .where(inArray(hands.id, [...chunk]))
        .all(),
    );
    if (!rows.ok) return rows;
    for (const row of rows.value) finished.set(row.id, row.finishedAt);
  }
  const loaded: Hand[] = [];
  for (const handId of handIds) {
    if (!finished.has(handId)) {
      return dbErr('NOT_FOUND', `hand ${handId} does not exist`, { table: 'hands', id: handId });
    }
    if (finished.get(handId) === null) {
      return dbErr('NOT_FOUND', `hand ${handId} is not finished and is not eligible history`, {
        table: 'hands',
        id: handId,
        field: 'finished_at',
      });
    }
    const hand = loadStoredHand(db, handId);
    if (!hand.ok) return hand;
    loaded.push(hand.value);
  }
  return ok(loaded);
}

/**
 * Record when a hand finished. The reason and the money stay in the log, where they belong.
 *
 * Only reaches an UNFINISHED row. Since ADR-0060 a hand whose `finished_at` is already set
 * is frozen by a `BEFORE UPDATE` trigger, so a second call aborts (as a `STORAGE_FAILURE`
 * carrying the trigger's message — the abort is not a CHECK/UNIQUE constraint). That abort
 * is not a case to handle: it means something tried to rewrite history.
 *
 * `insertCompletedHand` does not use this path at all — it writes `finished_at` in the same
 * transaction as the events (ADR-0059g).
 */
export function markHandFinished(
  db: GtoDatabase,
  handId: HandId,
  finishedAt: Timestamp,
): DbResult<null> {
  const written = attempt({ table: 'hands', id: handId }, () =>
    db.update(hands).set({ finishedAt }).where(eq(hands.id, handId)).run(),
  );
  if (!written.ok) return written;
  if (written.value.changes === 0) {
    return dbErr('NOT_FOUND', `hand ${handId} does not exist`, { table: 'hands', id: handId });
  }
  return ok(null);
}
