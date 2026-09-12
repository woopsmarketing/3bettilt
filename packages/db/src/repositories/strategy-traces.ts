/**
 * `strategy_decision_traces` — what the REFERENCE strategy engine recommended at each Hero
 * decision point of a completed hand.
 *
 * **INSERT-ONLY BY CONSTRUCTION.** There is no update function in this module and there
 * must never be one; the database additionally refuses any UPDATE/DELETE by trigger
 * (`0006_strategy_decision_traces.sql`, `CLAUDE.md` rule 3). Generating the traces
 * themselves — replaying `hand_events` through the REFERENCE engine — is NOT this module's
 * job; it only stores and reads back what a caller already computed.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import { ok, type HandId } from '@gto-self/shared';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, type DbResult } from '../errors.js';
import { strategyDecisionTraces, type StrategyDecisionTraceId } from '../schema.js';
import {
  collect,
  decodeStrategyDecisionTraceRow,
  type StrategyDecisionTrace,
} from '../rows.js';

/** The row shape `insertStrategyTraces` accepts — identical to the decoded domain shape. */
export type StrategyDecisionTraceInsert = StrategyDecisionTrace;

/**
 * What one trace's insert did.
 *
 * `PERSISTED` — the row was written by this call.
 * `ALREADY_PERSISTED` — a row already existed under this `id`; this call wrote NOTHING for
 * it. A duplicate `id` is the expected consequence of a recomputation re-running over a
 * hand it had already traced, and the caller needs to tell that apart from a genuine
 * failure (mirrors `insertCompletedHand`'s `CompletedHandOutcome`, `repositories/hands.ts`).
 */
export type StrategyTraceOutcome = 'PERSISTED' | 'ALREADY_PERSISTED';

export interface StrategyDecisionTraceInsertResult {
  readonly id: StrategyDecisionTraceId;
  readonly outcome: StrategyTraceOutcome;
}

/**
 * Insert every trace in ONE transaction. A trace whose `id` already exists is a no-op for
 * that row (`ALREADY_PERSISTED`) rather than a `CONSTRAINT_VIOLATION` — the existing rows
 * already IN this table's insert-only guard, this call additionally checks NOTHING about
 * whether the pre-existing row agrees with the one being (re-)submitted; a caller that
 * needs that comparison reads it back with `listTracesForHand` first.
 *
 * The input array's own ids must be unique — a duplicate id appearing twice in one call is
 * refused before anything is written, exactly as `insertAnalysisResults` refuses a
 * duplicated `playerId`.
 */
export function insertStrategyTraces(
  db: GtoDatabase,
  traces: readonly StrategyDecisionTraceInsert[],
): DbResult<readonly StrategyDecisionTraceInsertResult[]> {
  if (traces.length === 0) return ok([]);

  const seen = new Set<string>();
  for (const trace of traces) {
    if (seen.has(trace.id)) {
      return dbErr('INVALID_INPUT', `trace ${trace.id} appears twice in one call`, {
        table: 'strategy_decision_traces',
        id: trace.id,
        field: 'id',
      });
    }
    seen.add(trace.id);
  }

  return attempt({ table: 'strategy_decision_traces' }, () =>
    db.transaction((tx) => {
      const ids = traces.map((trace) => trace.id);
      const existing = new Set(
        tx
          .select({ id: strategyDecisionTraces.id })
          .from(strategyDecisionTraces)
          .where(inArray(strategyDecisionTraces.id, ids))
          .all()
          .map((row) => row.id),
      );

      const results: StrategyDecisionTraceInsertResult[] = [];
      for (const trace of traces) {
        if (existing.has(trace.id)) {
          results.push({ id: trace.id, outcome: 'ALREADY_PERSISTED' });
          continue;
        }
        tx.insert(strategyDecisionTraces)
          .values({
            id: trace.id,
            handId: trace.handId,
            commandSeq: trace.commandSeq,
            street: trace.street,
            heroSeat: trace.heroSeat,
            strategyMode: trace.strategyMode,
            strategyVersion: trace.strategyVersion,
            family: trace.family,
            actionsJson: JSON.stringify(trace.actions),
            primaryAction: trace.primaryAction,
            recommendedToAmountMbb: trace.recommendedToAmountMbb,
            heroEquityBps: trace.heroEquityBps,
            potOddsBps: trace.potOddsBps,
            spr: trace.spr,
            provenanceQuality: trace.provenanceQuality,
            environmentStatus: trace.environmentStatus,
            actualHeroAction: trace.actualHeroAction,
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

/** One hand's traces, in decision order (`command_seq` ascending). */
export function listTracesForHand(
  db: GtoDatabase,
  handId: HandId,
): DbResult<readonly StrategyDecisionTrace[]> {
  const rows = attempt({ table: 'strategy_decision_traces', id: handId }, () =>
    db
      .select()
      .from(strategyDecisionTraces)
      .where(eq(strategyDecisionTraces.handId, handId))
      .orderBy(asc(strategyDecisionTraces.commandSeq))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeStrategyDecisionTraceRow));
}

/** `null` when absent. Looked up by the caller-supplied `${handId}:${commandSeq}` id. */
export function getTrace(
  db: GtoDatabase,
  id: StrategyDecisionTraceId,
): DbResult<StrategyDecisionTrace | null> {
  const rows = attempt({ table: 'strategy_decision_traces', id }, () =>
    db.select().from(strategyDecisionTraces).where(eq(strategyDecisionTraces.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodeStrategyDecisionTraceRow(row);
}
