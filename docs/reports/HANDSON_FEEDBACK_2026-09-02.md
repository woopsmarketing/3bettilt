# Hands-on feedback bounded patch — 2026-09-02

Implements the 4 items from `prompt` (repo root): Strategy Decision Trace (WP-A), one-click
Skip Hand (WP-B), quick manual seat sync (WP-C), and player convenience UX (WP-D). Plan:
`/Users/woops/.claude/plans/parsed-toasting-journal.md`. Per-WP detail reports:
`HANDSON_WP_A_DB_LAYER.md`, `strategy-trace-service-2026-09-02.md`,
`HANDSON_WP_B_C_SKIP_AND_SEAT_SYNC.md`, `HANDSON_WP_D_PLAYER_HUD_EDIT.md`.

## 1. Changed files (by area)

- **`packages/db`**: `src/schema.ts`, new migration `drizzle/0006_strategy_decision_traces.sql`,
  `src/rows.ts`, new `src/repositories/{strategy-traces,skipped-hands}.ts`, `src/index.ts`,
  `tests/insert-only.test.ts`, `tests/migrations.test.ts`.
- **Strategy trace generation**: new `apps/web/src/server/strategy-trace-service.ts` +
  test, new `apps/web/scripts/backfill-strategy-traces.ts`, wired into
  `apps/web/src/server/actions/hand-history.ts` (fire-and-forget after a successful
  completed-hand save), `package.json` scripts.
- **Skip Hand / seat sync**: `apps/web/src/lib/table/tableStore.ts` (+`skipHand`,
  `discardHand`, `correctSeatStack`, `correctSeatButton`, `dirtySeats`),
  `apps/web/src/components/table/TableRoot.tsx`, new
  `apps/web/src/components/table/SeatCorrectionPanel.tsx`, new
  `apps/web/src/lib/table/skip-hand-contract.ts`,
  `apps/web/src/server/skip-hand-service.ts`, `apps/web/src/server/actions/skip-hand.ts`,
  `apps/web/src/app/table/[sessionId]/page.tsx`.
- **Player HUD/notes edit**: `apps/web/src/lib/table/contract.ts`,
  `apps/web/src/server/players.ts`, `apps/web/src/server/actions/player.ts`,
  `apps/web/src/components/table/PlayerProfilePanel.tsx`, plus the same `TableRoot.tsx` /
  `page.tsx` prop-threading.
- Nickname reuse (session setup) required **no changes** — already fully built.

## 2. DB migration

`packages/db/drizzle/0006_strategy_decision_traces.sql` — adds two new insert-only tables,
`strategy_decision_traces` and `skipped_hands`, plus their triggers. No existing table
altered. Run the standard `pnpm --filter @gto-self/db db:migrate` (or equivalent) path to
apply.

## 3. Usage

- **Strategy trace**: generated automatically, off the hot path, right after a hand is
  persisted as COMPLETE (fire-and-forget, errors logged, never blocks the save). For
  existing already-completed hands, run `pnpm strategy:backfill` — it skips any hand that
  already has trace rows and tags backfilled rows `source: 'BACKFILL'`.
- **Skip Hand**: click "핸드 건너뛰기" any time a hand is in progress — one click, no
  confirmation. Advances the button/hand count by one, discards the unfinished hand without
  persisting or observing it, and marks every dealt-in seat "확인 필요" until corrected.
- **Seat correction**: open a seat's correction control any time to fix its stack, make it
  the button, or toggle sitting-out/active (reuses the existing toggle). If the lineup
  itself was wrong, discard the in-progress hand first (no rotation) and re-enter before
  starting again.
- **Player HUD/notes**: click a seat to open its profile panel; the existing nickname
  autocomplete at session setup already reuses an existing player by nickname. The panel now
  has a small form to record VPIP/PFR/3BET/FOLD_TO_3BET (manual entry, verbatim text kept)
  and append a note — kept structurally separate from the learned Player Model panel.

## 4. Test results

- `pnpm typecheck` (workspace, 10 projects): pass.
- `pnpm lint` (ESLint incl. layering rules): pass.
- `pnpm test` (full workspace vitest): **2115 passed / 3 skipped** (125 files), no
  regressions.
- `pnpm build` (`apps/web`, Next.js/Turbopack): succeeds.
- Targeted E2E: `skip-hand.spec.ts` 2/2, `seat-occupancy.spec.ts` (regression check) 3/3 —
  full `pnpm e2e` was not re-run in full per the verification-cadence rule (already covered
  by the milestone-gate targeted run plus the full unit/integration suite).

## 5. Remaining limitations

- `skipHand()` advances `TableState.handNumber` via a direct object spread in
  `tableStore.ts` rather than a dedicated `poker-core` primitive, because none exists for
  "rotate without settling a completed hand." Documented inline; a future phase could add an
  engine-owned `advanceButtonOnly`-style export instead.
- The skip-hand audit row (`skipped_hands`) is best-effort only — a failed write never blocks
  the UI and is not retried, matching the existing fire-and-forget posture used for
  persistence elsewhere in this codebase.
- Corrected stacks/button are in-memory only for the current session (same pre-existing
  limitation documented in `docs/STATE.md`: `updateSessionTable` is not called anywhere, so
  stacks generally do not survive a reload). This patch does not change that — it only adds
  a way to correct the in-memory value the user is currently looking at.
- No new ADR was written: every decision here is a direct, non-architectural extension of
  ADR-0059/0060/0061/0062 (insert-only, exactly-once, layering) and the already-accepted
  seat-occupancy/auto-top-up conventions.
