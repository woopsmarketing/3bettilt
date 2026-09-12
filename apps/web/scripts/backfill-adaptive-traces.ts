/**
 * `pnpm adaptive:backfill` — generate `adaptive_strategy_traces` for every already-COMPLETED
 * hand that predates this feature, or whose `LIVE` generation never ran (a server restart
 * mid-flight, a failed deferred call — see `actions/hand-history.ts`).
 *
 * Runs the SAME replay logic `generateAdaptiveTracesForHand` uses for the online path
 * (`adaptive-trace-service.ts`) — nothing here re-implements it — with `source: 'BACKFILL'`
 * instead of `'LIVE'`. A hand that already has adaptive trace rows is skipped without
 * recomputing: `listAdaptiveTracesForHand` is checked first, so a re-run over an
 * already-backfilled database does no work.
 *
 * RUN `pnpm strategy:backfill` FIRST on a database that has never been backfilled.
 * `adaptive_strategy_traces.reference_trace_id` links a composed row to the REFERENCE baseline
 * it derives from, both tables are insert-only, and the link is written once — so an adaptive
 * row generated before its REFERENCE row exists keeps `reference_trace_id: null` permanently.
 * That is a missing cross-reference, not a wrong number; nothing else about the row changes.
 *
 * A BACKFILLED ROW IS NOT A TIME MACHINE. The replay reconstructs the HAND exactly — every
 * state comes from that hand's own stored events — but the opponent evidence it composes
 * against is whatever the HUD and learned model hold RIGHT NOW, which for an old hand is more
 * than was known when it was played. So a `BACKFILL` row answers "what would we advise here,
 * knowing what we know today", while a `LIVE` row answers "what did we advise at the table".
 * Both are honest and neither is a substitute for the other, which is exactly why `source`
 * distinguishes them on every row and why a hand that already has rows is never recomputed.
 * `player_model_version` and the two snapshot-id maps record which evidence was actually used,
 * so a backfilled row can always be dated.
 *
 * The candidate list is `listCompletedHandIds` from the REFERENCE service, imported rather than
 * re-implemented: "every finished hand" is one question and deserves one answer.
 *
 * Read-only over `hands`/`hand_events`/`hand_players`/`sessions`/`player_hud_snapshots`/
 * `player_model_snapshots`/`strategy_decision_traces`; the only write is into the insert-only
 * `adaptive_strategy_traces` table.
 *
 * Run: `pnpm --filter @gto-self/web adaptive:backfill` (or `pnpm adaptive:backfill` from the
 * repo root, which proxies to the same script). `GTO_SELF_DB_URL` / `GTO_SELF_MIGRATIONS_DIR`
 * override the database/migrations location exactly as they do for the app server
 * (`apps/web/src/server/db.ts`).
 */
import { database } from '../src/server/db.js';
import {
  generateAdaptiveTracesForHand,
  hasAdaptiveTraces,
} from '../src/server/adaptive-trace-service.js';
import { listCompletedHandIds } from '../src/server/strategy-trace-service.js';
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
    const existing = hasAdaptiveTraces(db, handId);
    if (!existing.ok) {
      failed += 1;
      failures.push({ handId, reason: `${existing.error.code}: ${existing.error.message}` });
      continue;
    }
    if (existing.value) {
      skipped += 1;
      continue;
    }

    const result = generateAdaptiveTracesForHand(db, handId, {
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
    `adaptive:backfill — hands seen ${handIds.length}, processed ${processed}, ` +
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
