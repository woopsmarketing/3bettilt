# WP C0-A — Audit for C0+C1 (completed-hand persistence + post-session player model)

Read-only audit. No source files were modified.

Scope reminder: C0 = durable persistence of COMPLETED hands (raw immutable event log). C1 =
post-session deterministic analysis building versioned per-player model snapshots
(opportunity-based VPIP/PFR/3Bet/CBet/spot stats, SHOW evidence, confidence). Strategy
recommendations must not change.

---

## 1. `packages/poker-core` — event log, hand lifecycle, replay/load, SHOW/MUCK

File: `packages/poker-core/src/events.ts`

- `HandEventKind` union (19 members): `HAND_STARTED`, `PLAYER_DEALT_IN`, `POST_ANTE`,
  `POST_DEAD_BLIND`, `POST_SB`, `POST_BB`, `HOLE_CARDS_SET`, `FOLD`, `CHECK`, `CALL`, `BET`,
  `RAISE`, `ALL_IN`, `RETURN_UNCALLED`, `FLOP_DEALT`, `TURN_DEALT`, `RIVER_DEALT`,
  `POT_AWARDED`, `HAND_FINISHED`.
- `HandEvent = EventMeta & HandEventPayload`. `EventMeta = { id: EventId; seq: number;
  commandSeq: number; origin: 'USER' | 'ENGINE' }`. `seq` is dense/ascending from 0 (the
  SQLite ordering key); `commandSeq` groups one logical user command (undo drops the whole
  group).
- **Fully serializable by construction**: file header states every leaf field is
  `number | string | boolean`, an array of those, or `TableConfig`/`BlindSeatOverride`
  (themselves all primitives) — no `Date`, `Map`, `Set`, `bigint`, `undefined`, class
  instance. `JSON.parse(JSON.stringify(e))` is lossless. `db/repositories/hands.ts` calls
  `encodeHandEvent`/`decodeHandEventRow` (poker-core's own zod codec) rather than raw
  `JSON.stringify`, so the wire format is validated both ways.
- **Hand completion**: `HAND_FINISHED { reason: 'ALL_FOLDED' | 'SHOWDOWN', totalRake: MilliBB,
  totalFees: MilliBB }` closes the hand, emitted in the same command group as the award that
  consumed the last unawarded pot. `POT_AWARDED { potIndex, winners, grossAmount, rake, fee,
  netAmount, shares }` — `fee` is REQUIRED (zero when none), `netAmount === grossAmount - rake
  - fee`. Final stacks are NOT carried on either event — they must be derived by folding the
  full log (`HandState.seats[].stack` after settlement) or read from `hand_players` +
  wager/award deltas. `RETURN_UNCALLED { seat, amount }` records uncalled-bet returns
  separately, at round close.
- **Two rehydration entry points** (`packages/poker-core/src/hand.ts`):
  - `loadHand(events): EngineResult<Hand>` — STRUCTURAL. Checks log shape only (dense `seq`
    from 0, first event is `HAND_STARTED`, non-decreasing `commandSeq`). Does NOT
    re-validate rule legality. This is what `db/repositories/hands.ts`'s `loadStoredHand`
    uses — a later corrected poker rule can never make already-stored history unloadable.
  - `replayHand(events): EngineResult<Hand>` — STRICT. Re-validates every action against
    today's rules by reconstructing each command and comparing rebuilt payloads
    byte-for-byte (`samePayloads`, ignoring `id`). Intended for the Phase-11 hand-history
    parser and test fixtures, NOT for ordinary persistence rehydration.
  - Both return `Hand = { events: readonly HandEvent[]; state: HandState }`, where `state`
    is always exactly `foldEvents(events)`.
- **SHOW/MUCK**: `HOLE_CARDS_SET { seat, cards: readonly Card[], revealed: boolean }`.
  `revealed: false` = hero's own private entry; `revealed: true` = a showdown SHOW reveal.
  Re-emitting for a seat REPLACES the previous holding (not additive). Per ADR-0052 (see §6)
  a MUCK carries no event at all — it is "unknown information", UI-only, never persisted.
  This means: hole-card evidence for spot stats/SHOW-based inference is only ever available
  for seats that explicitly SHOWed; a mucked hand is definitionally absent data, and C1 must
  not infer or backfill it.
- **Sit-out / dealt-in / lineup**: `PLAYER_DEALT_IN { seat, playerId: PlayerId | null,
  startingStack }` — one per seat ENGINE-emits, ascending seat order, for 2–6 seats
  (`dealtInSeats` in `table.ts` excludes `SITTING_OUT`/`EMPTY` seats structurally — see
  `apps/web/src/lib/table/tableStore.ts` comment on `setSeatOccupancy`). `HAND_STARTED`
  carries `handId, handNumber, config: TableConfig, buttonSeat: SeatIndex, heroSeat:
  SeatIndex | null, blindOverride: BlindSeatOverride | null` — the whole config is embedded
  so the log replays with no external context. `blindOverride` (manual SB/BB assignment, or
  `null` for ordinary rotation) is REQUIRED and persisted because positions and action order
  both derive from it on replay.
- `eventSeat(event)`, `isActionEvent`, `isWagerEvent`, `eventsOfCommand`, `lastCommandSeq` are
  small total helpers already available for building C1's per-seat aggregation over a hand's
  log.

---

## 2. `packages/db` — existing schema, and hand/event persistence ALREADY EXISTS unused

**Surprise / critical finding**: `packages/db` already has a complete, tested hand-persistence
layer — `hands`, `hand_players`, `hand_events` tables plus a full repository
(`insertHand`, `appendHandEvents`, `getHand`, `listHandsForSession`, `listHandSeats`,
`loadHandEvents`, `loadStoredHand`, `markHandFinished`) — but **nothing in `apps/web` calls
any of it**. `grep` for `insertHand|appendHandEvents|loadStoredHand|markHandFinished|
listHandsForSession` under `apps/web/src` returns zero hits. This matches
`docs/STATE.md` line 285 ("Nothing entered at the table is persisted. Phases 4-7 write the
SESSION only.") and ADR-0043's explicit note that "Hand persistence is not yet implemented" —
the table/repository code was built ahead of the wiring, in Phase 3, and Phase 8 (this
milestone) is where it gets connected.

### Schema (`packages/db/src/schema.ts`)

| table | key columns | notes |
|---|---|---|
| `game_presets` | `preset_id` PK, `config_json`, timestamps | whole `TableConfig` as validated JSON |
| `players` | `id` PK, `nickname`, `normalized_nickname` (UNIQUE), `display_alias`, `archived` | no hard delete |
| `player_hud_snapshots` (+ `_stats`) | insert-only, triggers | manual third-party HUD testimony, permanently separate from observations |
| `player_notes` | insert-only, append-only via `root_id`/`supersedes_id` chain | |
| `player_observations` | `(player_id, metric, position)` natural key, two partial unique indexes (position not-null vs null-bucket) | `opportunities`/`actions` counts only, no stored rate |
| `sessions` | `id` PK, `config_json`, `button_seat`, `hero_seat`, `hand_number`, `closed_at`, auto-top-up pair columns | session = `TableState` between hands |
| `session_seats` | `(session_id, seat)` PK, `occupancy`, `player_id`, `stack` | all 6 rows always exist |
| **`hands`** | `id` PK, `session_id` FK→sessions RESTRICT, `hand_number`, `started_at`, `finished_at` (nullable — NULL while still being entered) | `UNIQUE(session_id, hand_number)`; `hand_number` is a CHECKED projection of the log's `HAND_STARTED.handNumber`, refused on disagreement |
| **`hand_players`** | `(hand_id, seat)` PK, `player_id` FK nullable, `starting_stack` | projection of `PLAYER_DEALT_IN` events, written same transaction, NEVER re-derived/consulted by `loadStoredHand` |
| **`hand_events`** | `(hand_id, seq)` PK, `event_id` (UNIQUE within hand), `command_seq`, `origin`, `kind`, `payload_json` | `kind` has deliberately NO CHECK (poker-core's zod codec is authoritative, avoids migration-per-new-event-kind); `payload_json` is the whole `encodeHandEvent(event)` output |

All money/count/timestamp columns carry explicit `typeof(col) = 'integer'` CHECKs
(ADR-0041) via `isIntegral`/`moneyRange`/`timeWindow` helpers — reuse these helpers for any
new C1 columns (e.g. confidence/observation aggregates).

Insert-only trigger pattern (`drizzle/0001_insert_only_guards.sql`): six `BEFORE
UPDATE`/`BEFORE DELETE` triggers, one update+delete pair per insert-only table
(`player_notes`, `player_hud_snapshots`, `player_hud_snapshot_stats`), each `RAISE(ABORT,
...)`. Drizzle cannot emit triggers, so this lives in a **hand-authored** migration file,
explicitly noted as needing to be kept in step with `schema.ts` by hand. **`hands` /
`hand_players` / `hand_events` currently have NO such triggers** — they are updatable
(`markHandFinished` does an `UPDATE hands SET finished_at = ...`, and `appendHandEvents`
INSERTs incrementally while a hand is live). If C1's per-player model snapshots need an
insert-only guarantee analogous to HUD snapshots, a new migration following this exact
pattern is the right vehicle. (No test was found asserting "the trigger list on
`sqlite_master`" as an exhaustive fixture in this repo snapshot — worth confirming there
isn't one elsewhere before assuming its absence; a targeted grep for `sqlite_master` combined
with `trigger` found no test file, but a full-repo search was not exhaustively re-run past
`packages/db/src`.)

Migrations: `0000_fair_stark_industries.sql` (initial generated schema incl. hands/
hand_players/hand_events), `0001_insert_only_guards.sql` (hand-authored triggers),
`0002_misty_black_bird.sql`, `0003_per_seat_auto_top_up.sql` (additive `ALTER TABLE ADD
COLUMN`, per ADR-0046 — never a generated table rebuild). Applied via `drizzle-orm/
better-sqlite3/migrator`'s `migrate()`, called from `openDatabase()` in
`packages/db/src/client.ts`. Tests open an isolated in-memory DB via `openTestDatabase()`
(`url: ':memory:'`, migrations still applied) — each connection gets its own empty database.

### `client.ts` / DB location

- `openDatabase({ url, applyMigrations, migrationsFolder, readonly })` in
  `packages/db/src/client.ts`. Sets `PRAGMA foreign_keys = ON` (SQLite does not enforce FKs
  by default), WAL + busy_timeout + synchronous=NORMAL for file DBs.
- Live DB file: `apps/web/src/server/db.ts` → `databaseUrl()` resolves to
  `<repo-root>/.data/gto-self.db` (git-ignored), override via `GTO_SELF_DB_URL`. Migrations
  folder resolved from repo root (`packages/db/drizzle`), override via
  `GTO_SELF_MIGRATIONS_DIR` — NOT `defaultMigrationsFolder()`, because Next/Turbopack bundling
  breaks `import.meta.url`-relative resolution. The handle is cached on
  `globalThis[Symbol.for('gto-self.web.databaseHandle')]` to survive Next dev hot-reload.
- ESLint (ADR-0044) restricts `@gto-self/db` imports to `apps/web/src/server/**` only — any
  C0/C1 persistence hook must live under `apps/web/src/server/`.

### Error idiom (`packages/db/src/errors.ts`)

`DbResult<T> = Result<T, DbError>`; `DbErrorCode` = `NOT_FOUND | CONFLICT | CORRUPT_ROW |
INVALID_INPUT | CONSTRAINT_VIOLATION | STORAGE_FAILURE`. `attempt(context, run)` wraps a
throwing driver call, mapping SQLite constraint-failure messages to `CONSTRAINT_VIOLATION`
and anything else to `STORAGE_FAILURE`. `fromEngineError`/`fromPlayerError` preserve
poker-core/player-core rejections verbatim as `CORRUPT_ROW` with `domainCode`. Reuse this
exact idiom for any new C1 repository.

### `hands.ts` repository (`packages/db/src/repositories/hands.ts`) — full existing surface

- `insertHand(db, { sessionId, hand: Hand, startedAt }): DbResult<HandId>` — one transaction:
  header row (checks `HAND_STARTED.handId`/`handNumber` agree with `hand.state`), all
  `hand_players` projection rows, all events so far.
- `appendHandEvents(db, handId, events): DbResult<number>` — enforces dense, gapless,
  in-order `seq` continuation (`CONFLICT` otherwise) — this is the natural append point for
  a live-hand-in-progress persistence model, though C0's stated scope is *completed* hands
  only, so C0 may prefer a single `insertHand` call at completion over incremental appends.
- `getHand`, `listHandsForSession` (ordered by `hand_number`), `listHandSeats`.
- `loadHandEvents(db, handId): DbResult<readonly HandEvent[]>` — decodes each row through
  poker-core's zod codec, then re-runs `decodeHandEvents` (log-level dense/ordering checks).
- `loadStoredHand(db, handId): DbResult<Hand>` — `loadHandEvents` → `loadHand`. THE
  authoritative read path; `hand_players` is never consulted here (ADR-0039).
- `markHandFinished(db, handId, finishedAt): DbResult<null>` — sets `hands.finished_at`;
  "the reason and the money stay in the log" (in `HAND_FINISHED`/`POT_AWARDED`), this column
  only marks *when*.

**This is very close to what C0 needs already-built.** C0's job is primarily: (a) call
`insertHand` (or equivalent) at the point a hand reaches `HAND_FINISHED` in the UI, with a
real clock/id, and (b) decide whether "completed hands only" means writing once at
completion (simplest, matches literal C0 scope) vs. incrementally via `appendHandEvents`
during the hand (more complex, arguably conflicts with ADR-0043's synchronous/no-DB-on-hot-
path rule — see §4 for the completion boundary).

---

## 3. `packages/player-core` — full export surface, what exists, what's missing for C1

Export surface (`packages/player-core/src/index.ts`): `errors.js`, `time.js`, `percent.js`,
`player.js`, `hud.js`, `observation.js`, `notes.js`, `confidence.js`. Pure domain: no React,
no Next, no persistence, no `poker-core`, no `gto-core` (ADR-0021 boundary — this constrains
C1: any per-hand poker fact used to build an observation must be translated to
`player-core`'s own vocabulary — e.g. `ObservedPosition` is a structurally-identical-but-
separately-declared duplicate of `poker-core`'s `Position`, mapped at the app boundary,
never imported across).

- **Player identity** (`player.ts`, ADR-0034): manually entered `nickname` + `normalizedNickname`
  (NFKC + collapse + lowercase), never derived from a client/hand-history id.
- **Observation model** (`observation.ts`): `ObservedMetric = 'VPIP' | 'PFR' | 'THREE_BET' |
  'FOLD_TO_THREE_BET'` — **only these four already exist**. `PlayerObservation { id,
  playerId, metric, position: ObservedPosition | null, opportunities, actions,
  firstObservedAt, lastObservedAt }`. `createObservation`, `recordObservation` (additive
  delta, `at` must not move backwards, validates actions ≤ opportunities), `observedRate`
  (derived on demand, never stored), `observedRatePercent` (explicit rounding mode).
  `ObservationContext { metric, position }`, `contextKey`, `sameContext`, `findObservation`.
- **Confidence** (`confidence.ts`, ADR-0035/0036): `ConfidenceLevel = 'INSUFFICIENT' | 'LOW' |
  'MEDIUM' | 'HIGH'`, threshold-bucketed (`DEFAULT_CONFIDENCE_THRESHOLDS = { low: 30, medium:
  100, high: 500 }`, anchored to 95% binomial margin-of-error arithmetic, not an invented
  poker number). `assessConfidence(sample, thresholds, context)`,
  `assessObservationConfidence(observation, config)`.
  **IMPORTANT DISCREPANCY**: the milestone brief says confidence should be
  `n/(n+30)` (a continuous score). The EXISTING mechanism is a discrete four-level bucket
  system, deliberately NOT a continuous score ("Ordering only. Not a score, and never
  rendered as one." — `confidenceRank` docstring). C1 must either (a) reuse the existing
  `ConfidenceLevel` bucket system as-is and drop the `n/(n+30)` formula, or (b) add a new,
  clearly-separate continuous-confidence primitive alongside it and get an explicit decision
  recorded in DECISIONS.md — silently introducing a second confidence concept that
  contradicts ADR-0036 without a new ADR would violate CLAUDE.md rule 9 (don't reopen
  accepted decisions) and rule 7 (don't invent behaviour).
- **HUD snapshots** (`hud.ts`) and **notes** (`notes.ts`): manually-entered, permanently
  separate from observations — not relevant to C1's opportunity-based stats directly, but
  the "two kinds of stat are permanently separate types, never merged" pattern is the model
  C1's new SHOW-evidence/spot-stat types should follow.

### What's missing for C1's opportunity-based spot stats

- No `CBet` metric, no flop/turn/river spot metrics, no SHOW-card-evidence record type at
  all in `player-core`. The file header of `observation.ts` explicitly says: "postflop
  metrics are absent until the flow that would populate them exists (Phase 8), because a
  stat we cannot populate is a column of zeroes pretending to be data." **C1 is exactly that
  Phase 8 flow** — new `ObservedMetric` members (e.g. `CBET_FLOP`, `CBET_TURN`, ...) and
  possibly a new `position` vocabulary extension will need new `OBSERVED_METRICS`/
  `OBSERVED_POSITIONS` entries, which per schema.ts comments means a DB migration (the CHECK
  constraints enumerate these lists literally via `inList()`).
  - No SHOW-evidence record type exists at all (holds cards + street + result); needs to be
    designed from scratch, and must respect ADR-0052 (a MUCK is unknown information and has
    no event — see §6) so C1's evidence model can only ever be built from `HOLE_CARDS_SET
    { revealed: true }` events, never inferred.
- No versioned "player model snapshot" concept exists anywhere in player-core or db (HUD
  snapshots are a different, manually-entered concept). This is new C1 surface, to be added
  analogous to `player_hud_snapshots`/`playerHudSnapshotStats` (insert-only, versioned rows)
  but sourced from our own computed observations rather than typed-in HUD readings — likely
  wants its own table(s), not a reuse of `player_hud_snapshots`.

---

## 4. `apps/web` — session lifecycle, in-memory table store, hand-completion point, server actions, strategy/player UI

- **In-memory table store**: `apps/web/src/lib/table/tableStore.ts` — Zustand vanilla store,
  the SINGLE owner of live hand state (`TableStoreState.hand: Hand | null`,
  `.view: HandView | null` always `toView(hand)`). Every transition (`startHand`, `apply`,
  `undo`, `setSeatOccupancy`, `setSeatAutoTopUp`) is synchronous, no `await`, no fetch, no DB
  (ADR-0043 D1/D2 rules, enforced by an E2E test asserting the captured network request list
  stays empty through a full betting sequence). **This is where a completion hook attaches**:
  `canStartHand(state)` returns true when `state.hand === null || state.hand.state.phase ===
  'COMPLETE'` — i.e. `HandState.phase === 'COMPLETE'` is the in-memory completion boundary.
  `startHand()` itself is the natural point that "closes out" the previous hand (calls
  `applyHandResult(table, previous)` to settle/advance) before dealing the next — a
  persistence side-effect (write completed hand → server action) would need to be triggered
  either right there in `startHand()`, or by a caller (React component) observing the
  `COMPLETE` phase transition and firing a fire-and-forget server action, consistent with
  ADR-0043's "genuinely non-hot-path data...may use a server action" carve-out. Given
  ADR-0043 explicitly reserves the synchronous-only guarantee for the ACTION path (during
  the hand), persisting AFTER `phase === 'COMPLETE'` (i.e., once nothing more can happen to
  this hand) is the correct, ADR-compliant boundary — not mid-hand incremental appends.
- **Session lifecycle**: `apps/web/src/server/session-service.ts` — `startSessionIn` (one
  transaction: validate, resolve/create players, `buildTableState`, `insertSession`),
  `updateSeatAutoTopUp`, `updateSeatOccupancy` — both check `stored.value.closedAt !== null`
  and refuse further writes on a closed session. `apps/web/src/server/sessions.ts` and
  `apps/web/src/server/players.ts` are thin wrappers; `apps/web/src/server/actions/
  session.ts` and `.../player.ts` are the `'use server'` boundary functions
  (`startSessionAction`, `searchPlayersAction`, `updateSeatAutoTopUpAction`,
  `updateSeatOccupancyAction`). **No explicit "close session" action currently exists** in
  the files inspected (only the `closedAt` column and a check that refuses writes once set)
  — worth confirming with a broader grep before C0 work if a close-session UI flow is
  expected to interact with hand persistence (e.g. flushing anything in-flight).
- **Hand-completion → persistence hook does not exist yet.** No component or store method
  calls any `@gto-self/db` hand repository function. This confirms STATE.md and ADR-0043.
- **Strategy panel data flow**: `apps/web/src/lib/table/strategy.ts` — pure, synchronous
  read-model over `@gto-self/strategy-core`'s `buildStrategyQuery` +
  `recommendPreflop`/`recommendPostflop`. Computed directly from `HandState`/`SeatIndex`
  inputs, no persistence, no player-core involvement today. **For the "no-change regression
  test"**: this file (and the `strategy-core` package it wraps) is the thing that must NOT
  change behavior once C1 adds player-model snapshots — confirm no new import path
  connects `player-core`/player model data into `buildStrategyQuery`'s inputs.
- **No Player Profile / HUD panel UI exists in `apps/web` yet.** Grep for
  `PlayerProfile`/`player-core` under `apps/web/src` (excluding tests) found no
  application-facing component — `player-core` is currently only reached from
  `session-service.ts` (`createPlayer`, `createHudSnapshot`) for session-setup identity
  resolution, not for display. Building a UI to surface C1's new model snapshots is new
  work, not a rewire of an existing panel.
- **No explicit session-close / safe-boundary UI component found** in the directories
  inspected; only the `closedAt` server-side guard.

---

## 5. Conventions

- **Result idiom**: `Result<T, E>` from `@gto-self/shared`, with `ok`/`err` helpers, mirrored
  per-package as `EngineResult` (poker-core), `PlayerResult` (player-core), `DbResult` (db).
  Every fallible function returns one of these; nothing throws except a documented invariant
  violation (a rules bug, deliberately loud — `applyCommand`'s docstring).
- **Branded ids + `IdFactory`** (ADR-0007, extended by ADR-0040 for time): ids are `asId<'X'>
  (value)`-branded strings, injected via `IdFactory { next(): string }`, never generated
  inline (`crypto.randomUUID` only reached from `cryptoIdFactory`, used at the app's
  user-triggered-action boundary, never during render/SSR/persistence). DB and poker-core
  never generate ids or read a clock themselves — the CALLER (`apps/web/src/server/*`)
  supplies both, exactly as `session-service.ts`'s `StartSessionDeps { ids, now }` pattern
  shows. **C1's snapshot ids and timestamps must be supplied the same way.**
- **Money/MilliBB**: `Money` from `@gto-self/shared`; every schema money column enforces
  `moneyRange` + `isIntegral` CHECKs (ADR-0041); poker-core events store `MilliBB` fields
  directly (never floats). C1's aggregate stats are NOT money (they're counts/percentages) —
  use `player-core`'s existing `CentiPercent`/`percent.ts` convention rather than inventing a
  new fractional representation.
  
- **Versioned JSON docs**: `TableConfig` persists as one validated JSON document
  (`config_json` columns on both `game_presets` and `sessions`), re-validated through
  poker-core's own `tableConfigSchema`/`validateTableConfig` on read (ADR-0038) — never
  flattened into columns. If C1's player-model snapshot benefits from a similar
  "whole-document" JSON approach (e.g. a computed-stats bundle per version), this is the
  precedent to follow, though the existing `player_observations` table takes the opposite,
  flattened-columns approach for its counts — likely the right model for C1's per-metric
  aggregates, with a JSON doc reserved only for something like a full "model version"
  manifest if one is needed.
- **ESLint layering** (ADR-0042/0044, CLAUDE.md rule 4): `poker-core` and `gto-core` forbid
  React/Next/`@gto-self/db`; `poker-core` additionally forbids `gto-core`/`player-core`;
  `gto-core` forbids `player-core`; `@gto-self/db` importable only from
  `apps/web/src/server/**`. **This directly bounds C1's shape**: the analysis step that
  reads `hand_events` and writes player-model snapshots must live in
  `apps/web/src/server/` (or a new pure package under it that itself avoids importing
  `poker-core`/`gto-core` cross-boundary incorrectly) — it CANNOT live inside
  `player-core` itself if it needs to decode `HandEvent`s, since `player-core` must not
  import `poker-core`. The natural shape: an orchestration module in
  `apps/web/src/server/` that reads hands via `@gto-self/db`, folds/interprets them using
  `@gto-self/poker-core` types, and constructs `player-core` observation values — never the
  reverse import direction.
- **Test conventions**: Vitest projects per package (`pnpm vitest run --project poker-core`
  etc.), in-memory SQLite via `openTestDatabase()` for db-touching tests, deterministic
  `IdFactory`/fixed `Timestamp` injection throughout for reproducibility.

---

## 6. Relevant ADRs (docs/DECISIONS.md) — 1493 lines, 58 ADRs total

Directly relevant:
- **ADR-0034** — player identity is a manually entered nickname; normalization stored
  alongside.
- **ADR-0035** — HUD testimony and our own observations are separate record types.
- **ADR-0036** — confidence is a named level with explicit `INSUFFICIENT` (see §3
  discrepancy re: `n/(n+30)`).
- **ADR-0037** — manually entered records are insert-only, DB-trigger-enforced.
- **ADR-0038** — `TableConfig` persists as one validated JSON document.
- **ADR-0039** — event log is authoritative; header columns are checked projections;
  load path is `loadHand` (not `replayHand`).
- **ADR-0040** — persistence layer reads no clock, generates no ids.
- **ADR-0041** — integer columns carry explicit integrality CHECK.
- **ADR-0042** — ESLint layering via `patterns`, every block spells out its full list.
- **ADR-0043** — action path is local/synchronous; persistence happens at boundaries;
  **explicitly states hand persistence is NOT YET IMPLEMENTED and is Phase 8 work** — this
  is the ADR that names the exact milestone C0/C1 is now doing.
- **ADR-0044** — all DB access funnels through `apps/web/src/server/`, ESLint-enforced.
- **ADR-0052** — a showdown SHOW is a hole-card event; a MUCK is unknown information and
  has none (confirms §1 finding: no MUCK event exists or should exist).

**Next free ADR number: 0059.** (Latest accepted is ADR-0058 — "Occupancy is not rotation
state...".) Any new decision C0/C1 needs recorded (e.g. resolving the confidence-formula
discrepancy in §3, or the completion-boundary persistence trigger point in §4) should be
ADR-0059 onward.

---

## Reuse vs. build

**Must reuse, do not rebuild:**
- `packages/db` schema + repository for hands: `hands`, `hand_players`, `hand_events`
  tables and `insertHand`/`appendHandEvents`/`getHand`/`listHandsForSession`/
  `listHandSeats`/`loadHandEvents`/`loadStoredHand`/`markHandFinished` in
  `packages/db/src/repositories/hands.ts` — this is essentially C0 already built, minus the
  UI wiring. Building a second hand-persistence table/repository would directly violate
  CLAUDE.md rule 8 (no scope expansion) and create a competing system.
- `poker-core`'s `loadHand`/`loadStoredHand` structural rehydration path (not `replayHand`)
  for reading back completed hands for analysis.
- `player-core`'s `ObservedMetric`/`ObservationContext`/`createObservation`/
  `recordObservation`/`observedRate` for the four metrics that already exist (VPIP, PFR,
  3BET, FOLD_TO_3BET) — extend the union, don't replace the mechanism.
- `player-core`'s `ConfidenceLevel` bucket system (pending the §3 decision on n/(n+30) vs.
  buckets).
- `db/src/errors.ts`'s `DbResult`/`attempt`/`dbErr` idiom, `db/src/client.ts`'s
  `openDatabase`/migration pattern, the `isIntegral`/`moneyRange`/`timeWindow` CHECK helpers
  in `schema.ts`, and the insert-only trigger pattern in `0001_insert_only_guards.sql` if C1
  snapshots need the same guarantee.
- ADR-0038's "whole validated JSON document" pattern only if a snapshot-manifest shape is
  actually needed; prefer `player_observations`'s flattened-columns approach for simple
  counts.

**Genuinely missing, must build:**
- The hand-completion → persistence wiring in `apps/web` (nothing currently calls
  `insertHand`/`markHandFinished`); needs a decision on exactly where the trigger fires
  (recommend: on `HandState.phase === 'COMPLETE'`, via a server action fired after the
  synchronous UI update completes, never inside the synchronous hot path itself).
- New `ObservedMetric` members for CBet and other spot stats, and any new
  `ObservedPosition`/position-context vocabulary needed — each is a DB migration
  (`OBSERVED_METRICS`/`OBSERVED_POSITIONS` CHECK lists are literal SQL enums).
- A SHOW-card-evidence record type (does not exist in player-core or db at all) — must be
  built strictly from `HOLE_CARDS_SET { revealed: true }` events per ADR-0052, no MUCK
  inference.
- A versioned player-model-snapshot concept (does not exist; HUD snapshots are a different,
  manually-entered thing) — a new table (or tables), new repository, insert-only if that
  guarantee is wanted.
- The deterministic post-session analysis function itself (fold hand log → compute
  opportunity/action deltas per metric/position → confidence) — entirely new, must live in
  `apps/web/src/server/` or a new package respecting the `player-core` ⇏ `poker-core` import
  ban.
- A Player Profile / HUD display UI (no such component exists in `apps/web` today).
- Resolution of the confidence-formula discrepancy (§3) and the exact completion-boundary
  design (§4) as new ADRs (0059+) before implementation, per CLAUDE.md rule 7.

**Biggest risks / surprises for the orchestrator:**
1. `packages/db`'s hand persistence layer already exists and is well-tested but completely
   unwired — the temptation to "design from scratch" must be resisted; the task is
   wiring + extension, not a new system.
2. The milestone brief's `n/(n+30)` confidence formula conflicts with the existing, ADR-0036-
   accepted discrete-bucket `ConfidenceLevel` system — needs an explicit decision, not a
   silent second implementation.
3. `hands`/`hand_players`/`hand_events` currently have NO insert-only DB triggers (unlike
   HUD snapshots/notes/observations) — if C0 wants completed-hand immutability enforced at
   the DB level (matching "raw immutable hand history" language in the brief), a new
   migration adding triggers analogous to `0001_insert_only_guards.sql` is needed; today
   `markHandFinished` and `appendHandEvents` both perform ordinary UPDATE/INSERT with no DB-
   level immutability guarantee once a hand is marked finished.
4. `player-core` cannot import `poker-core` — the analysis engine that turns a `Hand`'s event
   log into `player-core` observation deltas must live at the `apps/web/src/server/` layer
   (or a new correctly-scoped package), not inside either engine package.
