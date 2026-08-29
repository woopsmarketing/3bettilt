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
import { asc, eq, max } from 'drizzle-orm';
import { ok, type HandId, type SessionId } from '@gto-self/shared';
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
import { handEvents, handPlayers, hands } from '../schema.js';
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
  const handId = hand.state.handId;
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
      const seats = hand.state.dealtInSeats.map((seat) => ({
        handId,
        seat,
        playerId: hand.state.seats[seat].playerId,
        startingStack: hand.state.seats[seat].startingStack,
      }));
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

/** Record when a hand finished. The reason and the money stay in the log, where they belong. */
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
