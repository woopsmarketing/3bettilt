# Strategy decision trace generation service — 2026-09-02

## Scope

Build the generation service that replays a COMPLETED, persisted hand's `hand_events` through
the existing REFERENCE strategy engine (`computeStrategy`) and stores one
`strategy_decision_trace` row per Hero decision point, wire it to fire after
`persistCompletedHand` succeeds, and add a backfill script for hands that predate the feature.

`packages/db`, `packages/poker-core`, `packages/strategy-core` were read-only inputs per the
task boundary; nothing in them was touched.

## Files created

- `apps/web/src/server/strategy-trace-service.ts` — the generation service.
  - `generateStrategyTracesForHand(db, handId, { now, source? })` — the main entry point.
    Loads the hand header (`getHand`) and its session (`getSession`) to find the recorded
    Hero seat; returns `ok([])` (not an error) when the hand's session has no Hero seat
    recorded. Loads the hand via `loadStoredHand`, walks its events for Hero's own voluntary
    actions (`origin === 'USER'`, `isActionEvent`, `event.seat === heroSeat`), reconstructs
    the `HandState` immediately before each one with `handAtCommand(hand, commandSeq - 1)`,
    and calls `computeStrategy(state, heroSeat)` — the exact function/signature the live
    Strategy Panel uses. A `REFUSED`/`NO_HAND` result is skipped, not recorded, and the
    replay continues to the hand's other decision points. All built rows are written in one
    `insertStrategyTraces` call; a duplicate `id` comes back `ALREADY_PERSISTED` (a no-op),
    so re-running the generation for an already-traced hand is safe.
  - `hasStrategyTraces(db, handId)` and `listCompletedHandIds(db)` — small read-only helpers
    that exist here (not in the backfill script itself) because `apps/web`'s ESLint config
    permits `@gto-self/db` imports only under `apps/web/src/server/**`; the backfill script
    lives under `apps/web/scripts/` and needed a way to reach these two reads without
    importing `@gto-self/db` directly.
  - Field mapping notes: `recommendedToAmountMbb` is set only when the primary
    recommendation is BET/RAISE/ALL_IN (null for FOLD/CHECK/CALL, matching the schema
    doc-comment); `heroEquityBps`/`potOddsBps` convert the panel's `0..1` floats to
    integer bps (`Math.round(value * 10_000)`, clamped `0..10000`); `spr` is rounded to the
    nearest integer (the schema stores it as a plain nullable integer with no invented
    scaling, per its own doc comment). `strategyVersion` is a manually-bumped constant
    (`'reference-2026-09-strategy-a-b'`) — there was no existing version tag anywhere in
    `strategy-core` to read, so this file mints and owns one, to be bumped by hand whenever
    the reference tables materially change.

- `apps/web/src/server/strategy-trace-service.test.ts` — against a real migrated database
  (`openTestDatabase`), matching `hand-history-service.test.ts`'s fixture style (a hand
  played through `poker-core`'s own API on a session's real stored table). Three tests, all
  passing:
  1. A 3-handed hand with 4 Hero decisions (1 preflop RAISE + 3 postflop CHECKs) produces
     exactly 4 trace rows with plausible fields (frequencies sum to 10000, valid
     provenance/street/action enums, correct `handId`/`heroSeat`/`source`).
  2. Calling `generateStrategyTracesForHand` twice for the same hand: first call reports all
     `PERSISTED`, second reports all `ALREADY_PERSISTED`, and the table still holds exactly 4
     rows (exactly-once).
  3. A hand where Hero's preflop hole cards are entered as a single (partial) card is
     genuinely refused by `strategy-core`'s own `INVALID_HERO_CARDS` check at that one
     decision point, while the flop/turn/river decisions (entered with Hero's full holding
     by then) still succeed — 3 of the hand's 4 decision points are traced, none crash.

- `apps/web/scripts/backfill-strategy-traces.ts` — iterates every `hands` row with
  `finished_at IS NOT NULL`, skips any hand `hasStrategyTraces` already reports rows for,
  otherwise calls the SAME `generateStrategyTracesForHand` with `source: 'BACKFILL'`. Logs a
  one-line summary (hands seen / processed / skipped / failed / trace rows inserted) plus a
  per-hand failure list via `console.warn`, and sets a non-zero exit code if anything failed.

## Files changed

- `apps/web/src/server/actions/hand-history.ts` — after `persistCompletedHandIn` returns
  `ok`, schedules `generateStrategyTracesForHand` via `setImmediate` (a later macrotask, so it
  can never delay or fail the action's own response) and logs (`console.error`) if it comes
  back `err`. This mirrors the persistence path's own "never block the user, never lose a
  played hand over a derived-data failure" posture; no existing fire-and-forget pattern
  existed server-side to copy verbatim (the client-side `useCompletedHandSaves.ts` hook has
  one, but that's `await`ed browser-side JS, not applicable to a fully synchronous
  server-action call chain), so this was the most direct honest choice available.
- `apps/web/package.json` — added `"strategy:backfill": "tsx scripts/backfill-strategy-traces.ts"`.
- `package.json` (root) — added `"strategy:backfill": "pnpm --filter @gto-self/web strategy:backfill"`,
  matching the existing `db:migrate` proxy pattern.

## TS runner

**Already present**: `tsx` is a root `devDependency` (`^4.23.12`) and is already the
established pattern for this repo's own DB script (`packages/db/package.json`'s
`"db:migrate": "tsx src/migrate.ts"`). No new dependency was added.

## Exact backfill command

```
pnpm strategy:backfill
```

(equivalently `pnpm --filter @gto-self/web strategy:backfill`). Respects
`GTO_SELF_DB_URL` / `GTO_SELF_MIGRATIONS_DIR` exactly as the app server does. Smoke-tested
against a fresh migrated SQLite file (`GTO_SELF_DB_URL=<tmp>.db pnpm --filter @gto-self/web
strategy:backfill`) — ran clean, reported `hands seen 0`.

## Refusals / edge cases explicitly handled

- `computeStrategy` returning `REFUSED` (e.g. `INVALID_HERO_CARDS`, and by construction also
  `HERO_NOT_ACTOR`/`HERO_UNKNOWN`/`UNSUPPORTED_LINEUP` etc.) at one decision point: skipped,
  no row written, replay continues — covered by test 3.
- Session with no recorded Hero seat: `generateStrategyTracesForHand` returns `ok([])`. Not
  covered by an automated test — `startSession` itself refuses a lineup with no Hero chosen
  ("choose which seat is Hero"), so this state is not reachable through the app's own session
  setup today; the guard is defensive for data this app cannot currently produce, and forcing
  it into being would have required bypassing `startSession`'s own repository/session-service
  validation with a hand-rolled `insertSession` call, which felt like manufacturing a test
  rather than testing a real path. Documented in a comment at the call site instead.
- Duplicate generation for an already-traced hand: `insertStrategyTraces`'s own
  `ALREADY_PERSISTED` no-op — covered by test 2, and relied on again by the backfill script's
  `hasStrategyTraces` pre-check (skip instead of recompute-and-discard).
- Command 0 (`HAND_STARTED`/blind posting) can never be a Hero decision point; guarded
  defensively (`commandSeq <= 0` is skipped) even though it should be structurally
  unreachable.
- `handAtCommand` failing to fold a prefix, or the reconstructed state not actually being
  `phase === 'BETTING'` with `actorSeat === heroSeat`: skipped rather than thrown — a
  defensive net for a malformed/legacy log, never expected to trigger against a log this
  app's own persistence path wrote.

## Test results

- `pnpm --filter @gto-self/web typecheck` — clean.
- `pnpm eslint apps/web/src/server/strategy-trace-service.ts apps/web/src/server/strategy-trace-service.test.ts apps/web/src/server/actions/hand-history.ts apps/web/scripts/backfill-strategy-traces.ts` — clean (0 errors, 0 warnings after switching the script's summary output from `console.log` to `console.warn` to satisfy the repo's `no-console` rule).
- `pnpm vitest run --project web src/server/strategy-trace-service.test.ts` — 3 passed.
- `pnpm vitest run --project web` (full web project, to check nothing else broke) — 397 passed, 3 skipped, 0 failed.

## Not done / explicitly out of scope

- No changes to `packages/strategy-core`, `packages/poker-core`, `packages/db`, or any of the
  other files the task listed as owned by concurrent agents
  (`tableStore.ts`, `TableRoot.tsx`, `SeatCard.tsx`, `contract.ts`, `PlayerProfilePanel.tsx`).
  `actions/hand-history.ts` was the one documented exception (the trigger-wiring point).
- No E2E run; not requested and not warranted for a server-side derived-data path with no UI
  surface yet.
