/**
 * `adaptive_strategy_traces` — what the ADAPTIVE composition layer recommended at each Hero
 * decision point, and the evidence it used.
 *
 * **INSERT-ONLY BY CONSTRUCTION.** There is no update function in this module and there
 * must never be one; the database additionally refuses any UPDATE/DELETE by trigger
 * (`0007_adaptive_strategy_traces.sql`, `CLAUDE.md` rule 3). Composing the traces
 * themselves — folding opponent evidence into a REFERENCE baseline — is NOT this module's
 * job; it only stores and reads back what a caller already computed.
 *
 * A REFERENCE trace lives in `strategy_decision_traces` and is read through
 * `repositories/strategy-traces.ts`. The two are deliberately separate tables so a
 * player-independent baseline can never be mistaken for a derived, player-specific opinion.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import { ok, type HandId } from '@gto-self/shared';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, type DbResult } from '../errors.js';
import { adaptiveStrategyTraces, type AdaptiveStrategyTraceId } from '../schema.js';
import { collect, decodeAdaptiveStrategyTraceRow, type AdaptiveStrategyTrace } from '../rows.js';

/** The row shape `insertAdaptiveTraces` accepts — identical to the decoded domain shape. */
export type AdaptiveStrategyTraceInsert = AdaptiveStrategyTrace;

/**
 * What one trace's insert did.
 *
 * `PERSISTED` — the row was written by this call.
 * `ALREADY_PERSISTED` — a row already existed under this `id`; this call wrote NOTHING for
 * it. A duplicate `id` is the expected consequence of a re-render or a retry re-submitting
 * the same decision point, and the caller needs to tell that apart from a genuine failure
 * (mirrors `insertStrategyTraces`'s `StrategyTraceOutcome`).
 */
export type AdaptiveTraceOutcome = 'PERSISTED' | 'ALREADY_PERSISTED';

export interface AdaptiveStrategyTraceInsertResult {
  readonly id: AdaptiveStrategyTraceId;
  readonly outcome: AdaptiveTraceOutcome;
}

/**
 * Insert every trace in ONE transaction. A trace whose `id` already exists is a no-op for
 * that row (`ALREADY_PERSISTED`) rather than a `CONSTRAINT_VIOLATION` — the existing row is
 * already frozen by this table's insert-only guard, and this call deliberately checks
 * NOTHING about whether it agrees with the one being re-submitted; a caller that needs that
 * comparison reads it back with `listAdaptiveTracesForHand` first.
 *
 * The input array's own ids must be unique — a duplicate id appearing twice in one call is
 * refused before anything is written, exactly as `insertStrategyTraces` refuses one.
 */
export function insertAdaptiveTraces(
  db: GtoDatabase,
  traces: readonly AdaptiveStrategyTraceInsert[],
): DbResult<readonly AdaptiveStrategyTraceInsertResult[]> {
  if (traces.length === 0) return ok([]);

  const seen = new Set<string>();
  for (const trace of traces) {
    if (seen.has(trace.id)) {
      return dbErr('INVALID_INPUT', `adaptive trace ${trace.id} appears twice in one call`, {
        table: 'adaptive_strategy_traces',
        id: trace.id,
        field: 'id',
      });
    }
    seen.add(trace.id);
  }

  return attempt({ table: 'adaptive_strategy_traces' }, () =>
    db.transaction((tx) => {
      const ids = traces.map((trace) => trace.id);
      const existing = new Set(
        tx
          .select({ id: adaptiveStrategyTraces.id })
          .from(adaptiveStrategyTraces)
          .where(inArray(adaptiveStrategyTraces.id, ids))
          .all()
          .map((row) => row.id),
      );

      const results: AdaptiveStrategyTraceInsertResult[] = [];
      for (const trace of traces) {
        if (existing.has(trace.id)) {
          results.push({ id: trace.id, outcome: 'ALREADY_PERSISTED' });
          continue;
        }
        tx.insert(adaptiveStrategyTraces)
          .values({
            id: trace.id,
            handId: trace.handId,
            commandSeq: trace.commandSeq,
            referenceTraceId: trace.referenceTraceId,
            street: trace.street,
            heroSeat: trace.heroSeat,
            status: trace.status,
            adaptivePolicyVersion: trace.adaptivePolicyVersion,
            primaryVillainPlayerId: trace.primaryVillainPlayerId,
            opponentCount: trace.opponentCount,
            baselineActionsJson: JSON.stringify(trace.baselineActions),
            adaptiveActionsJson: JSON.stringify(trace.adaptiveActions),
            frequencyDeltaJson: JSON.stringify(trace.frequencyDeltas),
            baselinePrimaryAction: trace.baselinePrimaryAction,
            adaptivePrimaryAction: trace.adaptivePrimaryAction,
            baselineToAmountMbb: trace.baselineToAmountMbb,
            adaptiveToAmountMbb: trace.adaptiveToAmountMbb,
            baselineSizingBucket: trace.baselineSizingBucket,
            adaptiveSizingBucket: trace.adaptiveSizingBucket,
            totalShiftBps: trace.totalShiftBps,
            // The column is INTEGER 0/1 with its own CHECK; the mapping is explicit here
            // rather than left to a driver coercion.
            capApplied: trace.capApplied ? 1 : 0,
            adjustmentsJson: JSON.stringify(trace.adjustments),
            manualHudSnapshotIdsJson: JSON.stringify(trace.manualHudSnapshotIds),
            playerModelSnapshotIdsJson: JSON.stringify(trace.playerModelSnapshotIds),
            playerModelVersion: trace.playerModelVersion,
            computedAt: trace.computedAt,
            source: trace.source,
          })
          .run();
        results.push({ id: trace.id, outcome: 'PERSISTED' });
      }
      return results;
    }),
  );
}

/** One hand's adaptive traces, in decision order (`command_seq` ascending). */
export function listAdaptiveTracesForHand(
  db: GtoDatabase,
  handId: HandId,
): DbResult<readonly AdaptiveStrategyTrace[]> {
  const rows = attempt({ table: 'adaptive_strategy_traces', id: handId }, () =>
    db
      .select()
      .from(adaptiveStrategyTraces)
      .where(eq(adaptiveStrategyTraces.handId, handId))
      .orderBy(asc(adaptiveStrategyTraces.commandSeq))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeAdaptiveStrategyTraceRow));
}

/** `null` when absent. Looked up by the caller-supplied `${handId}:${commandSeq}:ADAPTIVE` id. */
export function getAdaptiveTrace(
  db: GtoDatabase,
  id: AdaptiveStrategyTraceId,
): DbResult<AdaptiveStrategyTrace | null> {
  const rows = attempt({ table: 'adaptive_strategy_traces', id }, () =>
    db.select().from(adaptiveStrategyTraces).where(eq(adaptiveStrategyTraces.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodeAdaptiveStrategyTraceRow(row);
}
