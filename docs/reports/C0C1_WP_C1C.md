# WP C1-C — `packages/db`: analysis runs + versioned player model snapshots

Scope: `packages/db/**` only (plus this report). No file outside the package was modified.
Implements ADR-0062 (a, c, d, f) at the database layer, plus the read surface C1-B and C1-D
consume.

Gates: `pnpm vitest run --project db` **9 files / 129 tests / 129 PASS**,
`pnpm exec tsc -p packages/db/tsconfig.json --noEmit` PASS,
`pnpm exec eslint packages/db --max-warnings=0` PASS,
`pnpm typecheck` (whole workspace, because the barrel widened) PASS.

---

## 1. What changed

| File | Change |
|---|---|
| `drizzle/0005_analysis_and_model_snapshots.sql` | NEW. `drizzle-kit`-generated `CREATE TABLE`/`CREATE INDEX` (a create-only diff — none of `0004`'s rewrite hazard) + a hand-authored header and **14 hand-authored insert-only triggers**. |
| `drizzle/meta/0005_snapshot.json`, `meta/_journal.json` | Generated, kept, so a future `generate` diffs from the right baseline. |
| `src/schema.ts` | Seven new tables; `ANALYSIS_RUN_STATUSES`, `ANALYSIS_PLAYER_OUTCOMES`, `SHOW_OUTCOMES`, `AnalysisRunId`, `ModelSnapshotId`; one new CHECK helper (`countRange`). |
| `src/rows.ts` | Row types + decoders for all seven tables; `AnalysisRunRecord`, `AnalysisRunPlayerRecord`, `AnalysisRunReport`, `ModelSnapshotHeader`, `decodeModelSnapshot`. |
| `src/repositories/analysis.ts` | NEW. The write path and five read functions. |
| `src/index.ts` | `export * from './repositories/analysis.js'`. |
| `tests/modelFixture.ts` | NEW. A hand-built rich `PlayerModelContent`. |
| `tests/analysis.test.ts` | NEW — 16 tests. |
| `tests/insert-only.test.ts` | Trigger tripwire extended exhaustively, 12 → **26**. |
| `tests/migrations.test.ts` | `TABLES` + `INTEGRAL_COLUMNS` extended; new populated-upgrade test for `0005`. |

No existing assertion was weakened or deleted.

### `player_observations` is untouched

Analysis never writes it (ADR-0062a). The `0005` upgrade test asserts its rows survive
byte-identically, and `tests/analysis.test.ts` asserts its row count does not move across a
run.

---

## 2. Schema (migration `0005`) — DDL summary

Seven tables, all **insert-only in the database** (UPDATE and DELETE both `RAISE(ABORT, …)`).
Every FK is `ON DELETE RESTRICT ON UPDATE RESTRICT`; every count/money/epoch-ms column carries
`typeof(col) = 'integer'` plus its range (ADR-0041).

### `analysis_runs`
`id` PK (caller-supplied), `session_id`→`sessions` , `started_at`, `finished_at` (≥ started),
`algorithm_version` ≥ 1, `status` CHECK ∈ `SUCCESS|PARTIAL|FAILED`, `hand_count`,
`player_count`, `observation_count`, `show_count`, `error_json` nullable (non-empty when set).
Index `(session_id, started_at, id)`.

**No `input_hash` on the run, deliberately.** Input identity is per player — one run covers
many players, each with its own eligible hand set — so it lives on the snapshot, where the
`NO_CHANGES` comparison actually happens. Prompt §15's "rawHistoryInputIdentity/hash" is
therefore satisfied per player, and a run is auditable by joining its snapshots.

### `analysis_run_players`
PK `(run_id, player_id)`; `outcome` ∈ `SNAPSHOT_CREATED|NO_CHANGES|FAILED`; `snapshot_id`
nullable FK → `player_model_snapshots`; `error_json` nullable. Two CHECKs:
`snapshot_id IS NOT NULL` **iff** `outcome = 'SNAPSHOT_CREATED'`, and `error_json` only on a
`FAILED` row. Index `(player_id, run_id)`.

### `player_model_snapshots`
`id` PK, `player_id`, `model_version` ≥ 1, `analysis_run_id`, `algorithm_version`,
`input_hash` (non-empty), `source_hand_count`, `source_observation_count`,
`source_show_count`, `created_at`, and the confidence CONFIG: `confidence_k`,
`confidence_learning_threshold`, `confidence_known_threshold` (learning < known enforced),
`confidence_overall_opportunities`.
**`UNIQUE(player_id, model_version)`** — the real guarantee behind monotonic versioning.
Indexes `(player_id, created_at, id)` and `(analysis_run_id)`.

### `player_model_stats` (`globalStats`)
`(snapshot_id, ordinal)` PK; `stat_key` CHECK ∈ `MODEL_STAT_KEYS`; `position` **nullable**
CHECK ∈ `OBSERVED_POSITIONS`; `opportunities`, `actions` (≤ opportunities),
`confidence_opportunities`. **Two partial unique indexes** — one `(snapshot_id, stat_key,
position) WHERE position IS NOT NULL`, one `(snapshot_id, stat_key) WHERE position IS NULL` —
exactly as `player_observations` does it, because NULLs compare distinct in both dialects. The
`null` bucket and the six positional rows are separate and are never merged (ADR-0035).

### `player_spot_stats` (`spotStats`)
`(snapshot_id, ordinal)` PK, `UNIQUE(snapshot_id, spot_key)`, index on `spot_key`.
Descriptor as columns: `phase`, `family`, `position`, `opponent_position` (preflop only),
`lineup`, `street`/`relation`/`pot_type`/`facing_size` (postflop only) — with two CHECKs that
enforce the phase discriminator, and a phase-dependent `family` CHECK. Counts:
`opportunities`, five `effect_*`, six `verb_*`, `confidence_opportunities`; two CHECKs assert
`sum(effects) = opportunities` and `sum(verbs) = opportunities`.

### `player_model_bet_sizes` (`betSizes`)
`(snapshot_id, ordinal)` PK, FKs to `hands` and `players`, `kind` ∈ `BET_SIZE_KINDS`,
`spot_key`, the five raw milliBB amounts (`to_amount`, `amount`, `pot_before`,
`current_bet_before`, `big_blind`), and `bucket` ∈ the union of both bucket vocabularies.

### `player_model_show_evidence` (`showEvidence`)
`(snapshot_id, ordinal)` PK, `UNIQUE(snapshot_id, hand_id)`, FKs to `hands` and `players`,
`position`, `cards_text`, `board_text`, `last_street` ∈ `PREFLOP|FLOP|TURN|RIVER`,
`spot_keys_json`, `outcome` ∈ `WON|LOST|UNKNOWN`, `won_gross` (money, ≥ 0).

---

## 3. Encoding decisions

1. **`ordinal` on every child table.** Array order is stored, not re-derived. The acceptance
   property is `JSON.stringify` equality, and re-sorting on read would make this layer hold a
   second opinion about `analysis-core`'s ordering (which is documented but not enforceable
   from here).
2. **Spot: BOTH the descriptor columns and the canonical `spotKey`.** The columns are the
   lossless record; the key is the label the UI groups by. They cannot drift: the decoder
   re-derives the key with `player-core`'s own `spotKey()` and returns `CORRUPT_ROW` on a
   disagreement, and the repository performs the same check on the way IN (`INVALID_INPUT`).
3. **Effects/verbs as 11 explicit integer columns, not JSON.** They are the numbers a later
   query filters on, and their sums are CHECKable against `opportunities` — a blob is not.
   `ALL_IN` has a verb column and no effect column, mirroring the domain exactly.
4. **Confidence is NOT stored as a weight.** Each row stores the OPPORTUNITY COUNT its
   `SnapshotConfidence` was computed from; the snapshot stores `k` and both thresholds. On
   read, `snapshotConfidence(n, config)` reproduces the record. That formula is pure integer
   arithmetic, so this is bit-identical, not approximately equal — and it keeps the "counts,
   never derived values" rule intact while leaving an old snapshot interpretable.
   *Assumption stated:* every row's `confidence.k` equals the snapshot-level `k`. That is true
   by construction in `analysis-core` (one config per run). If a future engine ever varies `k`
   per row, this needs a per-row `k` column.
5. **Cards as canonical TEXT** (`"As Kd"`), decoded through `shared`'s `parseCards`. `cards`
   may hold ONE card, so the CHECK pins `length(cards_text) IN (2, 5)` — never "must be a
   pair" — and the decoder re-checks 1–2 cards. `board_text` is `""` for no board, CHECK
   `length IN (0, 8, 11, 14)` = 0/3/4/5 cards.
6. **`spot_keys_json` is a JSON array** (ADR-0038's case): an ordered list of keys already
   stored elsewhere, with no queryable dimension of its own.
7. **Bet-size bucket boundaries are NOT stored.** The bucket LABEL each observation received
   is stored verbatim, so no boundary is needed to read a snapshot back;
   `algorithm_version` records which engine assigned them. (`PlayerModelContent` does not
   carry the boundaries either — inventing columns for them would have been a stub.)
8. **`player_count` is a projection** of the per-player rows written, not a separately
   supplied number, so a header cannot claim a scope its rows contradict.

---

## 4. Repository surface (`src/repositories/analysis.ts`)

```ts
export type AnalysisPlayerInput =
  | { outcome: 'SNAPSHOT_CREATED'; playerId: PlayerId; snapshotId: ModelSnapshotId;
      content: PlayerModelContent; createdAt: Timestamp }
  | { outcome: 'NO_CHANGES'; playerId: PlayerId }
  | { outcome: 'FAILED'; playerId: PlayerId; errorJson: string };

export interface InsertAnalysisResultsInput {
  runId: AnalysisRunId; sessionId: SessionId; startedAt: Timestamp; finishedAt: Timestamp;
  algorithmVersion: number; status: AnalysisRunStatus;
  handCount: number; observationCount: number; showCount: number;
  errorJson?: string | null;
  players: readonly AnalysisPlayerInput[];
}

export function insertAnalysisResults(db, input): DbResult<{
  runId: AnalysisRunId;
  players: readonly { playerId; outcome; snapshotId?; modelVersion? }[];
}>;

export function getLatestSnapshotIdentity(db, playerId: PlayerId):
  DbResult<{ algorithmVersion: number; inputHash: string; modelVersion: number } | null>;
export function getSnapshot(db, snapshotId: ModelSnapshotId): DbResult<PlayerModelSnapshot | null>;
export function getLatestSnapshot(db, playerId: PlayerId): DbResult<PlayerModelSnapshot | null>;
export function listSnapshotVersions(db, playerId: PlayerId): DbResult<readonly ModelSnapshotHeader[]>;
export function getAnalysisRun(db, runId: AnalysisRunId): DbResult<AnalysisRunReport | null>;
export function listAnalysisRunsForSession(db, sessionId: SessionId): DbResult<readonly AnalysisRunReport[]>;
```

`ModelSnapshotHeader = { snapshotId, playerId, modelVersion, createdAt, sourceHandCount,
analysisRunId }` (ascending by `model_version`).
`AnalysisRunReport = { run: AnalysisRunRecord; players: readonly AnalysisRunPlayerRecord[] }`
(players ordered by player id, so two reads are identical).

Semantics:

- **One transaction** for the run row, every per-player row, and every snapshot with all four
  child tables. Child rows are inserted in chunks (100–200 rows per statement) to stay inside
  SQLite's bound-parameter limit; every chunk is inside the same transaction.
- **Pre-write validation** (`INVALID_INPUT`, nothing written): a player appearing twice in one
  run; `content.playerId` disagreeing with the outcome's `playerId`; a `spotKey` that is not
  the one `spotKey(descriptor)` derives; a reveal that is not 1–2 cards.
- **No clock, no id generation** (ADR-0040): `runId`, `snapshotId`, `startedAt`, `finishedAt`
  and `createdAt` are all caller-supplied.
- **Raw history is never written** by this module.

### Version assignment and concurrency

`model_version = max(model_version for that player) + 1`, read INSIDE the transaction.
`better-sqlite3` is synchronous and a write transaction holds SQLite's write lock, so the
read and the write cannot interleave on one connection. Two PROCESSES racing on the same file
would have the second blocked by the lock and, in the pathological case, refused by
`UNIQUE(player_id, model_version)` — a typed `CONSTRAINT_VIOLATION` with **nothing written**,
never a silently overwritten `v1`. The unique constraint, not the `max()` read, is the
guarantee.

---

## 5. Tests

`pnpm vitest run --project db` — **9 files, 129 tests, 129 PASS, 0 FAIL** (baseline before
this WP: 8 files / 112 tests).

### `tests/analysis.test.ts` (16 new)

| # | Test | Property |
|---|---|---|
| 1 | reloads a model document BIT-IDENTICALLY | `toEqual` **and** `JSON.stringify` equality of the whole content |
| 2 | keeps the shapes a lazier encoding would have destroyed | 7 VPIP rows (null + 6 positions, all distinct), 1-card reveal with no board, all 8 preflop families, all 3 streets, raw milliBB, `ALL_IN` verb under a `RAISE` effect |
| 3 | reproduces per-row confidence from the stored sample and config | every `SnapshotConfidence` equal to the original |
| 4 | assigns v1 then v2 and never overwrites v1 | both retained, versions `[1,2]`, latest = v2 |
| 5 | REFUSES a duplicate version | raw Drizzle insert → `UNIQUE constraint failed` |
| 6 | versions each player independently | hero v2 while villain stays v1 |
| 7 | NO_CHANGES gate identity | `null` before any snapshot, then `{algorithmVersion, inputHash, modelVersion}` of the latest |
| 8 | writes NOTHING when a child row is refused | FK-violating bet size → `CONSTRAINT_VIOLATION`, all seven derived tables empty |
| 9 | rolls the WHOLE run back when a LATER player fails | the earlier player's snapshot is gone too |
| 10 | REFUSES a self-contradicting document | tampered `spotKey`, wrong `playerId`, duplicate player — all `INVALID_INPUT`, nothing written |
| 11 | records a PARTIAL run with an outcome for EVERY player | `SNAPSHOT_CREATED` + `NO_CHANGES` + `FAILED`, `player_count = 3`; **raw history counts unchanged** (hands / events / lineup / `player_observations`) |
| 12 | records a FAILED run with no snapshot | run-level `error_json` preserved verbatim |
| 13 | REFUSES a per-player row claiming a snapshot it does not have | DB CHECK, independent of the typed union |
| 14 | lists a session's runs oldest first | plus `null` for unknown run / snapshot ids |
| 15 | REFUSES every UPDATE and DELETE on all 7 tables | raw Drizzle through the BARREL + raw SQL; row counts and `modelVersion` unchanged afterwards |
| 16 | REJECTS a fractional / out-of-vocabulary derived value | fractional `opportunities`, unknown `stat_key`, and an effect distribution that does not sum to `opportunities` |

The fixture (`tests/modelFixture.ts`) is a hand-built literal, not `analysis-core` output:
`packages/db` may not import `@gto-self/analysis-core` (ADR-0061, ESLint-enforced) and that ban
applies to tests. It covers every `ModelStatKey`, every preflop family, every postflop
street/relation/lineup/potType and `facingSize: NONE`, every `BetSizeKind`, buckets from both
vocabularies, a 2-card reveal with a full board and a 1-card reveal with none. The two
`handId`s point at REAL completed hands persisted through `insertCompletedHand`, so every FK is
exercised.

### `tests/insert-only.test.ts`

Trigger tripwire now pins **26** triggers exhaustively (12 + 14 new).

### `tests/migrations.test.ts` (+1, two lists extended)

New: *applies 0005 to a populated database that already has 0000..0004*. Populates at `0004`
(players, session, seats, a finished hand + lineup + event, a `player_observations` row),
migrates, and asserts: every pre-existing row byte-identical (including `player_observations`),
`integrity_check` ok, `foreign_key_check` empty, no `__new%` scratch table; then inserts a real
run + snapshot + stat + outcome ON THE UPGRADED FILE and proves the new guards are live —
duplicate version → `UNIQUE`, `SNAPSHOT_CREATED` with a NULL snapshot → `CHECK`, UPDATE and
DELETE → `is insert-only`.

`INTEGRAL_COLUMNS` gained 39 entries; `TABLES` gained the seven new tables (so
"creates no table we did not ask for" still holds exactly).

---

## 6. Real-database-copy verification (one-off)

`.data/gto-self.db`, `-wal` and `-shm` were **copied** into the session scratch directory; the
live files were never opened, and their sizes and mtimes are unchanged after the run
(verified before and after). The COPY was opened read-only first to snapshot every row of all
11 pre-existing tables, then opened read-write and migrated.

Result: **PASS.**

- Migrations applied: **4 → 6** (this copy was at `0003`, so it applied both `0004` and `0005`).
- Rows before = rows after, byte-identical (`JSON.stringify` per table):
  `game_presets` 1, `players` 15, `player_hud_snapshots` 1, `player_hud_snapshot_stats` 1,
  `player_notes` 0, `player_observations` 0, `sessions` 3, `session_seats` 18,
  `hands`/`hand_players`/`hand_events` 0/0/0. **`identical: true`.**
- All seven new tables present; **26 triggers**; `PRAGMA integrity_check` → `ok`;
  `PRAGMA foreign_key_check` → empty; no `__new%` scratch table.
- The real database still contains zero hands (nothing in `apps/web` calls the hand repository
  yet — the C0-A finding), so the constructed populated-upgrade test in `migrations.test.ts` is
  what exercises `0005` over populated hand and observation tables. Both were run; both pass.

---

## 7. What C1-B (server orchestration) must know

1. **Idempotency gate.** Call `getLatestSnapshotIdentity(db, playerId)` and compare BOTH
   `algorithmVersion` and `inputHash` against the freshly computed `PlayerModelContent`. Equal
   → pass `{ outcome: 'NO_CHANGES', playerId }`. The repository does not decide this: it
   writes exactly the outcomes it is given.
2. **One call per run.** `insertAnalysisResults` is the only write path, and it is
   all-or-nothing. Do not split a run into several calls — a `PARTIAL` run is one row with
   three kinds of per-player outcome, not three transactions.
3. **Ids and timestamps are yours.** `runId`, every `snapshotId`, `startedAt`, `finishedAt`,
   `createdAt`. `modelVersion` is NOT yours — the repository returns the one it assigned.
4. **Errors.** `INVALID_INPUT` = the caller's document is self-contradicting (checked before
   any write). `CONSTRAINT_VIOLATION` = the DB refused a row (most likely an unknown
   `handId`/`playerId`: every bet-size and show-evidence row FKs to `hands` and `players`, so
   an unidentified opponent with no `players` row cannot have a snapshot). Both leave the
   database untouched.
5. **`player_count` is derived** from `players.length`; do not pass it.
6. **Run counts are audit fields**, not model inputs: `handCount`/`observationCount`/
   `showCount` are what the run observed overall. Per-player truth lives on the snapshot
   (`sourceHandCount`, `sourceObservationCount`, `sourceShowCount`).
7. **A run needs a `sessionId`** — the scope. There is no session-less run today.
8. **A trigger abort arrives as `STORAGE_FAILURE`, not `CONSTRAINT_VIOLATION`** (SQLite emits
   no constraint marker for `RAISE(ABORT, …)`). No repository path can reach one.
9. **Reads are cheap in the right shape:** `listSnapshotVersions` returns headers only;
   `getSnapshot`/`getLatestSnapshot` load all four child tables. Do not call the latter to
   render a version list.

## 8. Risks / follow-ups

- **Trigger maintenance stays manual.** `drizzle-kit` will never emit a trigger; the
  26-entry list in `tests/insert-only.test.ts` is the only tripwire. A new derived table needs
  its own hand-authored migration AND an update to that list.
- **Per-row confidence `k` is assumed snapshot-wide** (§3.4). Documented, not enforceable from
  this layer.
- **Reconstruction order depends on `analysis-core` emitting `effects`/`verbs` in
  `OBSERVED_ACTION_EFFECTS` / `OBSERVED_ACTIONS` order.** The decoder builds those records in
  that order; if the engine ever emitted a different key order, `toEqual` would still pass but
  `JSON.stringify` equality would not. Worth a pin in an analysis-core test.
- **Derived rows are insert-only, so a "rebuild from scratch" needs a deliberate migration**,
  not a `DELETE`. That is the intended trade (ADR-0062's "a future algorithm can delete every
  derived row and rebuild" is a migration-time act, not a runtime one).
