/**
 * `pnpm strategy:backfill` — generate `strategy_decision_traces` for every already-COMPLETED
 * hand that predates this feature, or whose `ONLINE` generation never ran (a server restart
 * mid-flight, a failed deferred call — see `actions/hand-history.ts`).
 *
 * Runs the SAME replay logic `generateStrategyTracesForHand` uses for the online path
 * (`strategy-trace-service.ts`) — nothing here re-implements it — with `source: 'BACKFILL'`
 * instead of `'ONLINE'`. A hand that already has trace rows is skipped without recomputing:
 * `listTracesForHand` is checked first, so a re-run over an already-backfilled database does
 * no work.
 *
 * Read-only over `hands`/`hand_events`/`hand_players`/`sessions`; the only write is into the
 * insert-only `strategy_decision_traces` table.
 *
 * Run: `pnpm --filter @gto-self/web strategy:backfill` (or `pnpm strategy:backfill` from the
 * repo root, which proxies to the same script). `GTO_SELF_DB_URL` / `GTO_SELF_MIGRATIONS_DIR`
 * override the database/migrations location exactly as they do for the app server
 * (`apps/web/src/server/db.ts`).
 */
import { database } from '../src/server/db.js';
import {
  generateStrategyTracesForHand,
  hasStrategyTraces,
  listCompletedHandIds,
} from '../src/server/strategy-trace-service.js';
import { nowTimestamp } from '../src/server/session-service.js';

interface Failure {
  readonly handId: string;
  readonly reason: string;
}

function main(): void {
  const db = database();
  const handIds = listCompletedHandIds(db);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let inserted = 0;
  const failures: Failure[] = [];

  for (const handId of handIds) {
    const existing = hasStrategyTraces(db, handId);
    if (!existing.ok) {
      failed += 1;
      failures.push({ handId, reason: `${existing.error.code}: ${existing.error.message}` });
      continue;
    }
    if (existing.value) {
      skipped += 1;
      continue;
    }

    const result = generateStrategyTracesForHand(db, handId, {
      now: nowTimestamp(),
      source: 'BACKFILL',
    });
    if (!result.ok) {
      failed += 1;
      failures.push({ handId, reason: `${result.error.code}: ${result.error.message}` });
      continue;
    }
    processed += 1;
    inserted += result.value.filter((row) => row.outcome === 'PERSISTED').length;
  }

  console.warn(
    `strategy:backfill — hands seen ${handIds.length}, processed ${processed}, ` +
      `skipped ${skipped} (already traced), failed ${failed}, trace rows inserted ${inserted}`,
  );
  if (failures.length > 0) {
    console.warn('failures:');
    for (const failure of failures) {
      console.warn(`  ${failure.handId}: ${failure.reason}`);
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main();
