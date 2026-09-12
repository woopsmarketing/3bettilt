# WP-A (DB layer) — strategy_decision_traces + skipped_hands tables

2026-09-02. `packages/db`-only groundwork for item 1 (strategy trace) and item 2's audit row
(skip hand) of `prompt` (repo root). Generation logic itself is reported separately in
`docs/reports/strategy-trace-service-2026-09-02.md`.

## Schema (`packages/db/src/schema.ts`)

- `strategyDecisionTraces` — one row per Hero decision in a completed hand: `id`
  (`${handId}:${commandSeq}`), `handId` (FK `hands.id`), `commandSeq`, `street`, `heroSeat`,
  `strategyMode` (`'REFERENCE'` only), `strategyVersion`, `family`, `actionsJson`,
  `primaryAction`, `recommendedToAmountMbb`, `heroEquityBps`, `potOddsBps`, `spr`,
  `provenanceQuality` (`SOURCE|DERIVED|HEURISTIC`, ADR-0056), `environmentStatus`,
  `actualHeroAction`, `computedAt`, `source` (`ONLINE|BACKFILL`). Unique
  `(handId, commandSeq)`.
- `skippedHands` — best-effort audit row for a discarded/skipped hand: `id`, `sessionId`
  (FK), `handNumber`, `skippedAt`. No FK to `hands` (a skipped hand never gets one).
- Both insert-only via triggers (`_no_update`/`_no_delete`), same pattern as
  `0005_analysis_and_model_snapshots.sql`.

## Migration

`packages/db/drizzle/0006_strategy_decision_traces.sql` — `CREATE TABLE`/`CREATE INDEX`
generated via `drizzle-kit generate`, then the 4 triggers hand-appended. Fixed a
pre-existing migrator bug found along the way: a trailing empty `--> statement-breakpoint`
broke `better-sqlite3`'s migrator ("supplied SQL string contains no statements"), which was
silently failing every test using `openTestDatabase()` until corrected.

## Repositories

- `packages/db/src/repositories/strategy-traces.ts` —
  `insertStrategyTraces(db, traces): DbResult<readonly StrategyDecisionTraceInsertResult[]>`
  (one transaction, duplicate `id` → per-row `ALREADY_PERSISTED`), `listTracesForHand(db, handId)`,
  `getTrace(db, id)`.
- `packages/db/src/repositories/skipped-hands.ts` — `insertSkippedHand`, `getSkippedHand`,
  `listSkippedHandsForSession`.

## Tests

- Added the 4 new triggers to `packages/db/tests/insert-only.test.ts`'s tripwire list, and
  the 2 new tables to `packages/db/tests/migrations.test.ts`.
- `pnpm --filter @gto-self/db typecheck`: pass. `pnpm vitest run --project db`: 135/135
  pass. ESLint: clean.
