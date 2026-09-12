/**
 * `skipped_hands` — a best-effort audit row for a hand the user chose to SKIP rather than
 * play or persist. A skipped hand never becomes a `hands` row and never feeds analysis.
 *
 * **INSERT-ONLY BY CONSTRUCTION.** There is no update function in this module and there
 * must never be one; the database additionally refuses any UPDATE/DELETE by trigger
 * (`0006_strategy_decision_traces.sql`, `CLAUDE.md` rule 3).
 */
import { asc, eq } from 'drizzle-orm';
import { ok, type SessionId } from '@gto-self/shared';
import type { GtoDatabase } from '../client.js';
import { attempt, type DbResult } from '../errors.js';
import { skippedHands } from '../schema.js';
import { decodeSkippedHandRow, type SkippedHand } from '../rows.js';

/** The row shape `insertSkippedHand` accepts — identical to the decoded domain shape. */
export type SkippedHandInsert = SkippedHand;

/** Plain insert. `id` is caller-supplied (ADR-0007), exactly like `hands.id`. */
export function insertSkippedHand(db: GtoDatabase, row: SkippedHandInsert): DbResult<SkippedHand> {
  const written = attempt({ table: 'skipped_hands', id: row.id }, () =>
    db
      .insert(skippedHands)
      .values({
        id: row.id,
        sessionId: row.sessionId,
        handNumber: row.handNumber,
        skippedAt: row.skippedAt,
        // Written verbatim. `null` is only ever supplied by a caller that genuinely has no
        // recorded reason; the table's CHECK refuses anything outside the two members.
        reason: row.reason,
      })
      .run(),
  );
  if (!written.ok) return written;
  return ok(row);
}

/** `null` when absent. */
export function getSkippedHand(
  db: GtoDatabase,
  id: SkippedHand['id'],
): DbResult<SkippedHand | null> {
  const rows = attempt({ table: 'skipped_hands', id }, () =>
    db.select().from(skippedHands).where(eq(skippedHands.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const first = rows.value[0];
  if (first === undefined) return ok(null);
  return decodeSkippedHandRow(first);
}

/** A session's skipped hands, in the order they were skipped. */
export function listSkippedHandsForSession(
  db: GtoDatabase,
  sessionId: SessionId,
): DbResult<readonly SkippedHand[]> {
  const rows = attempt({ table: 'skipped_hands', id: sessionId }, () =>
    db
      .select()
      .from(skippedHands)
      .where(eq(skippedHands.sessionId, sessionId))
      .orderBy(asc(skippedHands.skippedAt), asc(skippedHands.id))
      .all(),
  );
  if (!rows.ok) return rows;
  const decoded: SkippedHand[] = [];
  for (const stored of rows.value) {
    const one = decodeSkippedHandRow(stored);
    if (!one.ok) return one;
    decoded.push(one.value);
  }
  return ok(decoded);
}
