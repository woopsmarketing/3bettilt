'use server';

/**
 * The completed-hand persistence server action (ADR-0059c).
 *
 * A server action is a public endpoint, so its input is untrusted and is re-validated from
 * scratch: `persistCompletedHand` decodes the submitted event log with `poker-core`'s own
 * codec, re-folds it with `loadHand`, and stores only the state the ENGINE computed here.
 *
 * It is deliberately NOT on a hand path. The store's transition to `COMPLETE` has already
 * happened, synchronously, in the browser; the table fires this afterwards and unawaited, and
 * neither the render nor the next Start Hand waits on it (ADR-0043).
 *
 * Nothing random is supplied on this side: the hand's id is the engine's own `handId`, taken
 * from the log's `HAND_STARTED` (ADR-0040 — this layer generates no ids). The only server
 * value added is the clock reading the client timestamps are clamped against.
 */
import type { PersistCompletedHandResult } from '../../lib/table/history-contract.js';
import { database } from '../db.js';
import { persistCompletedHand as persistCompletedHandIn } from '../hand-history-service.js';
import { nowTimestamp } from '../session-service.js';

/** Store one completed hand. `ALREADY_PERSISTED` is success, not an error (ADR-0059d). */
export async function persistCompletedHandAction(
  input: unknown,
): Promise<PersistCompletedHandResult> {
  return persistCompletedHandIn(database(), input, { now: nowTimestamp() });
}
