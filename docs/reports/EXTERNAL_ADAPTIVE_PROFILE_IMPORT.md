# WP-K / K1 — external HUD schema, repository, bulk import

Decisions this implements are recorded in `EXTERNAL_ADAPTIVE_00_AUDIT.md` §2; this report
is the "what was built and how it was verified" record.

## Schema

Two new, purely additive SQLite tables (`packages/db/src/schema.ts`, migration
`packages/db/drizzle/0008_player_external_hud_snapshots.sql`):

```
player_external_hud_snapshots (
  id, player_id -> players.id,
  source     CHECK = 'EXTERNAL_HUD',
  scope      CHECK = 'LIFETIME',
  reliability CHECK = 'ESTABLISHED',
  recorded_at, sample_n (nullable, always NULL today), import_batch_id
)
player_external_hud_snapshot_stats (
  snapshot_id -> player_external_hud_snapshots.id, stat_key (CHECK in the 10-key list),
  entered_text, value_centipercent, ordinal
  PK (snapshot_id, stat_key)
)
```

Both tables carry hand-authored `BEFORE UPDATE`/`BEFORE DELETE` triggers that `RAISE(ABORT,
...)` — `drizzle-kit` cannot emit a trigger, so they were added to the generated migration
by hand, exactly as `0001`/`0006`/`0007` were. `packages/db/tests/insert-only.test.ts`'s
exhaustive trigger list was extended (not replaced) to include all four new triggers, and
`packages/db/tests/migrations.test.ts`'s `TABLES`/`INTEGRAL_COLUMNS` lists likewise.

`player_hud_snapshots` / `HudStatKey` (ADR-0046, 8 CHECK-constrained keys) are **not
touched** — this is a sibling table, not a widened one.

## Domain layer

`packages/player-core/src/externalHud.ts` — `ExternalHudStatKey` (10 members: `VPIP`, `PFR`,
`THREE_BET`, `FOLD_TO_THREE_BET`, `STEAL`, `CBET_ANY_STREET`, `FOLD_TO_CBET_ANY_STREET`,
`CHECK_RAISE_ANY_STREET`, `WTSD`, `WSD`), `createExternalHudSnapshot` (rejects an empty stat
list, an unknown key, a duplicate key, an unparseable percentage, an empty
`importBatchId`, an invalid timestamp — mirrors `hud.ts`'s `createHudSnapshot`),
`latestExternalHudSnapshot`/`externalHudSnapshotHistory` (select, never merge or overwrite).
`sampleN` is always `null` on a snapshot this constructor builds. 21 tests in
`externalHud.test.ts`.

## Repository

`packages/db/src/repositories/external-hud.ts` — `insertExternalHudSnapshot`,
`getExternalHudSnapshot`, `listExternalHudSnapshotsForPlayer`,
`latestExternalProfileForPlayer` (the read K2's `adaptive-service.ts` will call). Row
decoding (`decodeExternalHudSnapshotRow`, `packages/db/src/rows.ts`) re-parses
`entered_text` and compares it to the stored `value_centipercent`, reporting `CORRUPT_ROW`
on a mismatch — the same discipline `decodeHudSnapshotRow` uses. 7 tests in
`packages/db/tests/external-hud.test.ts`.

## Bulk import

`apps/web/scripts/import-external-hud.ts`, run as:

```
pnpm players:import-external apps/web/scripts/fixtures/external-hud-2026-09.json
```

(`GTO_SELF_DB_URL` selects the target database, exactly as `pnpm adaptive:backfill` does.)

Behavior, verified by a real run against a scratch database (not the user's live one):

- **Exact nickname reuse, no duplicates.** `findPlayerByNormalizedNickname` first; a new
  `players` row is created only when genuinely absent.
- **Null stays null.** Ssallabd and Dre4mTe4m (missing WTSD/WSD in the source data) wrote
  `stats=8`, not `stats=10` with two zeros.
- **Idempotent by content, not by re-run.** A second run over unchanged data reported
  `ALREADY_PERSISTED` for all 13 players and inserted nothing; a changed value would report
  `NEW_SNAPSHOT` and append (insert-only — the prior snapshot is never touched).
- **Audit output**, first run:

  ```
  players:import-external — batch import-<ts>-<uuid>, 13 player(s) in <path>
  Shadow7          <uuid>   NEW_PLAYER   stats=10
  ...
  Ssallabd         <uuid>   NEW_PLAYER   stats=8
  Dre4mTe4m        <uuid>   NEW_PLAYER   stats=8
  ...
  done — new players 13, new snapshots 0, already persisted 0, failed 0
  ```

  second run, same file:

  ```
  ... ALREADY_PERSISTED  stats=10  (x11), stats=8 (x2)
  done — new players 0, new snapshots 0, already persisted 13, failed 0
  ```

- **Never runs automatically.** The user invokes it by hand; nothing in the app server or
  test suite calls it.

The 13-player JSON from `prompt` §2 is checked in as
`apps/web/scripts/fixtures/external-hud-2026-09.json`, using the source's own field names
(`CBET`, `FOLD_TO_CBET`, `CHECK_RAISE`) — the script, not the fixture, maps those to the
generic `*_ANY_STREET` `ExternalHudStatKey`s, so the fixture stays a faithful transcription
of what was reported.

## Tests and verification run

- `pnpm vitest run --project player-core` — 191 passed (was 170 before this WP).
- `pnpm vitest run --project db` — 157 passed (was 151 before this WP).
- `pnpm --filter @gto-self/player-core typecheck`, `pnpm --filter @gto-self/db typecheck`,
  `pnpm --filter @gto-self/web typecheck` — all clean.
- Manual: import script run twice against a scratch SQLite file, output above, file
  deleted afterward.

## Known limitation carried forward

`sampleN` has no real value to store yet even where a future source might report one — the
column exists (nullable) so a later external source that DOES show a hand count would not
need a migration, but nothing in WP-K ever writes a non-null value. This is the same
"documented, not silent" TODO shape `CLAUDE.md` rule 5 requires.
