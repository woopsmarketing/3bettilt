/**
 * Persisting a COMPLETED hand: the whole write, as one function over a database handle.
 *
 * Kept separate from `actions/hand-history.ts` for the same reason `session-service.ts` is
 * kept separate from `actions/session.ts` — so it can be exercised against a real in-memory
 * database in a test, and so the clock is INJECTED (ADR-0040) rather than reached for. The
 * `'use server'` wrapper adds nothing but the real handle and the real clock.
 *
 * ## What is trusted here, and what is not
 *
 * Nothing the browser computed. The input carries the hand's ENCODED EVENT LOG and nothing
 * else: no pot, no stack, no winner, no rake, no phase. This module decodes that log with
 * `poker-core`'s own codec and re-folds it with `loadHand`, so the `Hand` that reaches the
 * repository is one the ENGINE built on this side (ADR-0039). A log that does not decode, or
 * that does not fold, is refused with the engine's own code — never repaired.
 *
 * `loadHand` and not `replayHand`, deliberately, matching `packages/db`'s own read path: the
 * structural fold asserts chip conservation and arithmetic identity but not rule-dependent
 * legality, so a later corrected rule cannot make a hand the user already played unstorable.
 *
 * ## Completion
 *
 * `insertCompletedHand` refuses anything whose state is not `COMPLETE` and whose log does not
 * end in `HAND_FINISHED`. This module checks the phase first anyway, so the refusal names the
 * real reason ("still in FLOP") rather than arriving as a repository input error.
 *
 * ## Not a hot path
 *
 * The store's transition to `COMPLETE` has already happened, synchronously, in the browser
 * before this is ever called, and nothing awaits it (ADR-0043).
 */
import { asId } from '@gto-self/shared';
import { decodeHandEvents, loadHand } from '@gto-self/poker-core';
import { timestamp, type Timestamp } from '@gto-self/player-core';
import { getSession, insertCompletedHand, type GtoDatabase } from '@gto-self/db';
import {
  persistCompletedHandSchema,
  type PersistCompletedHandResult,
} from '../lib/table/history-contract.js';

export interface PersistCompletedHandDeps {
  /** The server's own clock reading, taken once at the action boundary. */
  readonly now: Timestamp;
}

/**
 * The earliest client timestamp this app will believe: 2020-01-01T00:00:00Z.
 *
 * A browser whose clock is set to 1970 (or to 2099) is a real thing, and the value only ever
 * describes WHEN a hand was entered — it is never money, never identity, and never part of
 * what the hand was. So an implausible reading is CLAMPED to the server clock rather than
 * used to refuse the write: losing a played hand to a wrong wall clock would be exactly the
 * silent data loss `CLAUDE.md` rule 3 forbids.
 */
const EARLIEST_PLAUSIBLE_MS = 1_577_836_800_000;

/** Clamp one client reading into `[EARLIEST_PLAUSIBLE_MS, now]`. Total. */
function clampToServerClock(value: number, now: Timestamp): Timestamp {
  if (!Number.isSafeInteger(value)) return now;
  if (value < EARLIEST_PLAUSIBLE_MS) return now;
  // A future reading is a skewed client, not evidence about the future: the hand is being
  // stored now, so `now` is the latest instant it can honestly claim.
  if (value > now) return now;
  return timestamp(value);
}

const fail = (code: string, message: string): PersistCompletedHandResult => ({
  ok: false,
  code,
  message,
});

/**
 * Validate, decode, re-fold and write one completed hand. Returns `PERSISTED` for a first
 * write and `ALREADY_PERSISTED` for a duplicate — both are success (ADR-0059d).
 *
 * `input` is untrusted: it arrives over the network at a server action.
 */
export function persistCompletedHand(
  db: GtoDatabase,
  input: unknown,
  deps: PersistCompletedHandDeps,
): PersistCompletedHandResult {
  const shape = persistCompletedHandSchema.safeParse(input);
  if (!shape.success) {
    const detail = shape.error.issues
      .map((issueDetail) => `${issueDetail.path.join('.') || 'input'}: ${issueDetail.message}`)
      .join('; ');
    return fail('INVALID_INPUT', `submitted hand is malformed: ${detail}`);
  }
  const { sessionId, events, startedAt, finishedAt } = shape.data;

  // The AUTHORITATIVE decode. The browser's encoding is checked event by event and then as a
  // LOG (dense `seq`, non-decreasing `commandSeq`) by the engine's own codec.
  const decoded = decodeHandEvents(events);
  if (!decoded.ok) return fail(decoded.error.code, decoded.error.message);

  // The AUTHORITATIVE fold. `hand.state` is computed here, never accepted from the client.
  const loaded = loadHand(decoded.value);
  if (!loaded.ok) return fail(loaded.error.code, loaded.error.message);
  const hand = loaded.value;

  if (hand.state.phase !== 'COMPLETE') {
    return fail(
      'HAND_NOT_COMPLETE',
      `hand ${hand.state.handId} is still in phase ${hand.state.phase} and is not durable history yet`,
    );
  }

  const id = asId<'Session'>(sessionId);
  const stored = getSession(db, id);
  if (!stored.ok) return fail(stored.error.code, stored.error.message);
  if (stored.value === null) {
    return fail('NOT_FOUND', `session ${sessionId} does not exist`);
  }
  // A CLOSED session still accepts a completed hand, unlike every other write in
  // `session-service.ts`. Those write session PREFERENCES, which a finished sitting must not
  // change; this writes HISTORY that already happened. Refusing it would destroy a hand the
  // user really played merely because the sitting was ended in another tab first
  // (`CLAUDE.md` rule 3). The hand tables are append-only (ADR-0060), so nothing about the
  // closed session is rewritten by accepting it.

  const started = clampToServerClock(startedAt, deps.now);
  const finished = clampToServerClock(finishedAt, deps.now);
  // The column CHECK requires `finished_at >= started_at`. After clamping they can only
  // disagree if the client's own pair did, so the START is moved rather than the finish: the
  // hand certainly finished by now, and a nonsensical start must not cost the whole write.
  const orderedStart = finished < started ? finished : started;

  const written = insertCompletedHand(db, {
    sessionId: id,
    hand,
    startedAt: orderedStart,
    finishedAt: finished,
    source: 'MANUAL_PRACTICE',
  });
  if (!written.ok) return fail(written.error.code, written.error.message);
  return { ok: true, handId: written.value.handId, outcome: written.value.outcome };
}
