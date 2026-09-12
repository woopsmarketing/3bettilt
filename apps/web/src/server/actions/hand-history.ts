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
import { asId, type HandId } from '@gto-self/shared';
import type { PersistCompletedHandResult } from '../../lib/table/history-contract.js';
import { database } from '../db.js';
import { persistCompletedHand as persistCompletedHandIn } from '../hand-history-service.js';
import { generateStrategyTracesForHand } from '../strategy-trace-service.js';
import { generateAdaptiveTracesForHand } from '../adaptive-trace-service.js';
import { nowTimestamp } from '../session-service.js';

/**
 * Fires strategy-trace generation for a just-persisted hand, deferred to a later macrotask
 * so it can never delay or fail this action's own response — the same "does not touch the
 * caller's result" guarantee `useCompletedHandSaves.ts` already relies on for the save
 * itself. A failure here is logged and otherwise swallowed: a missing/incomplete trace is a
 * gap in derived data, never a reason to make the user re-save a hand they already played.
 */
function scheduleStrategyTraceGeneration(handId: HandId): void {
  setImmediate(() => {
    const traced = generateStrategyTracesForHand(database(), handId, { now: nowTimestamp() });
    if (!traced.ok) {
      console.error(
        `strategy trace generation failed for hand ${handId}: ${traced.error.code}: ${traced.error.message}`,
      );
    }
  });
}

/**
 * The ADAPTIVE sibling, scheduled the same way and for the same reason: a later macrotask, so
 * it can never delay or fail this action's own response, and a failure is logged rather than
 * surfaced as a user error.
 *
 * ORDERED AFTER the REFERENCE generation above, and that ordering is load-bearing.
 * `adaptive_strategy_traces.reference_trace_id` points at the `strategy_decision_traces` row
 * for the same decision point; both tables are insert-only, so a link that is `null` at write
 * time can never be filled in later. Two `setImmediate` calls run in registration order on the
 * same macrotask queue, and `generateStrategyTracesForHand` is fully synchronous, so the
 * REFERENCE rows are committed before this one reads them. It is a lookup, not an assumption:
 * running out of order costs the link, not correctness.
 */
function scheduleAdaptiveTraceGeneration(handId: HandId): void {
  setImmediate(() => {
    const traced = generateAdaptiveTracesForHand(database(), handId, { now: nowTimestamp() });
    if (!traced.ok) {
      console.error(
        `adaptive trace generation failed for hand ${handId}: ${traced.error.code}: ${traced.error.message}`,
      );
    }
  });
}

/** Store one completed hand. `ALREADY_PERSISTED` is success, not an error (ADR-0059d). */
export async function persistCompletedHandAction(
  input: unknown,
): Promise<PersistCompletedHandResult> {
  const result = persistCompletedHandIn(database(), input, { now: nowTimestamp() });
  if (result.ok) {
    const handId = asId<'Hand'>(result.handId);
    scheduleStrategyTraceGeneration(handId);
    scheduleAdaptiveTraceGeneration(handId);
  }
  return result;
}
