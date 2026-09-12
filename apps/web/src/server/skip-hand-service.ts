/**
 * Recording the skip-hand audit row: the whole write, as one function over a database
 * handle. Kept separate from `actions/skip-hand.ts` for the same reason
 * `hand-history-service.ts` is kept separate from `actions/hand-history.ts` — testable
 * against a real in-memory database, with the clock and the id factory INJECTED (ADR-0007,
 * ADR-0040) rather than reached for.
 *
 * `skipped_hands` is insert-only by construction (`packages/db/src/repositories/
 * skipped-hands.ts`) — this module never updates or deletes a row, and never will.
 *
 * A CLOSED session is refused, exactly as every other table-side write refuses one
 * (`seat-state-service.ts`' `openSession`). The foreign key alone is not that check: it proves
 * the session exists, not that it is still open.
 *
 * This is NOT a hot path and never blocks the skip itself: the browser's `skipHand()`
 * transition has already happened, synchronously, before this is ever called
 * (`table/skip-hand-contract.ts`).
 */
import { asId, type IdFactory } from '@gto-self/shared';
import { timestamp, type Timestamp } from '@gto-self/player-core';
import { getSession, insertSkippedHand, type GtoDatabase } from '@gto-self/db';
import { skipHandAuditSchema, type SkipHandAuditResult } from '../lib/table/skip-hand-contract.js';

export interface LogSkippedHandDeps {
  readonly ids: IdFactory;
  /** The server's own clock reading, taken once at the action boundary. */
  readonly now: Timestamp;
}

export const nowTimestamp = (): Timestamp => timestamp(Date.now());

/**
 * Validate and write one skip-audit row. `input` is untrusted: it arrives over the network
 * at a server action.
 */
export function logSkippedHand(
  db: GtoDatabase,
  input: unknown,
  deps: LogSkippedHandDeps,
): SkipHandAuditResult {
  const shape = skipHandAuditSchema.safeParse(input);
  if (!shape.success) {
    const detail = shape.error.issues
      .map((issueDetail) => `${issueDetail.path.join('.') || 'input'}: ${issueDetail.message}`)
      .join('; ');
    return { ok: false, code: 'INVALID_INPUT', message: `submitted skip is malformed: ${detail}` };
  }
  const { sessionId, handNumber, reason } = shape.data;

  // A CLOSED sitting accepts no new writes — the same refusal `seat-state-service.ts`'
  // `openSession` makes, in the same words, so the two paths cannot drift into disagreeing
  // about what a closed session accepts. `skipped_hands`' foreign key proves only that the
  // session EXISTS; it says nothing about whether it has ended, and an audit row appended to a
  // session that was closed hours ago describes a hand that cannot have been played.
  //
  // A session that does not exist is deliberately NOT pre-empted here: the FK is already the
  // authority on that and reports it as `CONSTRAINT_VIOLATION`, and a second existence check
  // would be a second opinion about the same fact.
  const stored = getSession(db, asId<'Session'>(sessionId));
  if (!stored.ok) {
    return { ok: false, code: stored.error.code, message: stored.error.message };
  }
  if (stored.value !== null && stored.value.closedAt !== null) {
    return {
      ok: false,
      code: 'SESSION_CLOSED',
      message: `session ${sessionId} has ended and cannot be changed`,
    };
  }

  const written = insertSkippedHand(db, {
    id: asId<'SkippedHand'>(deps.ids.next()),
    sessionId: asId<'Session'>(sessionId),
    handNumber,
    skippedAt: deps.now,
    // Stored verbatim. The two vocabularies are the same two members by construction — the
    // schema's own `SKIPPED_HAND_REASONS` CHECK is the backstop if they ever drift.
    reason,
  });
  if (!written.ok) return { ok: false, code: written.error.code, message: written.error.message };
  return { ok: true };
}
