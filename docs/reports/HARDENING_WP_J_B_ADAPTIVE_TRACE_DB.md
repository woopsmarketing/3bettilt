# WP J-B — `adaptive_strategy_traces`: migration 0007, schema, decoder, repository

2026-09-02. Scope: `packages/db` only. Implements §7 of
`docs/reports/HARDENING_WP_J_DESIGN.md`.

Classification: **DATABASE MIGRATION** — verified immediately (CLAUDE.md §9), not deferred
to a later gate.

---

## 1. Files created

| file | what |
| --- | --- |
| `packages/db/drizzle/0007_adaptive_strategy_traces.sql` | `drizzle-kit`-generated `CREATE TABLE` + `CREATE UNIQUE INDEX`, plus two hand-authored insert-only triggers |
| `packages/db/drizzle/meta/0007_snapshot.json` | generated snapshot |
| `packages/db/src/repositories/adaptive-traces.ts` | the repository |
| `packages/db/tests/adaptive-traces.test.ts` | 13 new tests against a real migrated in-memory DB |

## 2. Files changed

| file | change |
| --- | --- |
| `packages/db/src/schema.ts` | `adaptiveStrategyTraces` table, `AdaptiveStrategyTraceId`, `ADAPTIVE_TRACE_STATUSES`, `ADAPTIVE_TRACE_SOURCES` + their types. Appended after `skippedHands`; **no existing table touched.** |
| `packages/db/src/rows.ts` | `AdaptiveStrategyTraceRow`, the five decoded structures, `decodeAdaptiveStrategyTraceRow` and its private helpers |
| `packages/db/src/index.ts` | `export * from './repositories/adaptive-traces.js';` |
| `packages/db/drizzle/meta/_journal.json` | entry `idx: 7`, `tag: "0007_adaptive_strategy_traces"` |
| `packages/db/tests/insert-only.test.ts` | trigger tripwire (below) |
| `packages/db/tests/migrations.test.ts` | `TABLES`, `INTEGRAL_COLUMNS`, and a new 0007 upgrade-path test |

`pnpm-lock.yaml` gained a `packages/adaptive-core` importer entry. That is **not this WP's
change** — it is the parallel J-A package being registered by the `pnpm install` that
`pnpm --filter @gto-self/db db:generate` runs first. Left in place; reverting it would
break J-A.

## 3. The table as actually written

`adaptive_strategy_traces`, 27 columns, TEXT primary key `${handId}:${commandSeq}:ADAPTIVE`,
caller-supplied, no AUTOINCREMENT anywhere.

| # | column | type | null | constraint |
| --- | --- | --- | --- | --- |
| 1 | `id` | TEXT PK | no | `length > 0` |
| 2 | `hand_id` | TEXT | no | FK `hands.id` restrict/restrict |
| 3 | `command_seq` | INTEGER | no | `isIntegral` + `>= 0` |
| 4 | `reference_trace_id` | TEXT | **yes** | FK `strategy_decision_traces.id` restrict/restrict; `null or length > 0` |
| 5 | `street` | TEXT | no | `in ('PREFLOP','FLOP','TURN','RIVER')` (`STRATEGY_TRACE_STREETS`) |
| 6 | `hero_seat` | INTEGER | no | `isIntegral` + `seatRange` |
| 7 | `status` | TEXT | no | `in ('ADAPTED','INSUFFICIENT_DATA')` |
| 8 | `adaptive_policy_version` | TEXT | no | `length > 0` |
| 9 | `primary_villain_player_id` | TEXT | **yes** | FK `players.id` restrict/restrict; `null or length > 0` |
| 10 | `opponent_count` | INTEGER | no | `countRange` |
| 11 | `baseline_actions_json` | TEXT | no | `length > 0` |
| 12 | `adaptive_actions_json` | TEXT | no | `length > 0` |
| 13 | `frequency_delta_json` | TEXT | no | `length > 0` |
| 14 | `baseline_primary_action` | TEXT | no | `in ('FOLD','CHECK','CALL','BET','RAISE','ALL_IN')` (`STRATEGY_TRACE_ACTIONS`) |
| 15 | `adaptive_primary_action` | TEXT | no | same list |
| 16 | `baseline_to_amount_mbb` | INTEGER | yes | `null or (moneyRange and >= 0)` |
| 17 | `adaptive_to_amount_mbb` | INTEGER | yes | `null or (moneyRange and >= 0)` |
| 18 | `baseline_sizing_bucket` | INTEGER | yes | `null or (isIntegral and -1..7)` |
| 19 | `adaptive_sizing_bucket` | INTEGER | yes | `null or (isIntegral and -1..7)` |
| 20 | `total_shift_bps` | INTEGER | no | `bpsRange` (0..10000) |
| 21 | `cap_applied` | INTEGER | no | `isIntegral` + `in (0, 1)` |
| 22 | `adjustments_json` | TEXT | no | `length > 0` |
| 23 | `manual_hud_snapshot_ids_json` | TEXT | no | `length > 0` |
| 24 | `player_model_snapshot_ids_json` | TEXT | no | `length > 0` |
| 25 | `player_model_version` | INTEGER | yes | `null or (isIntegral and >= 1)` |
| 26 | `computed_at` | INTEGER | no | `timeWindow` |
| 27 | `source` | TEXT | no | `in ('LIVE','BACKFILL')` |

Plus `uniqueIndex('adaptive_strategy_traces_hand_command_unique')` on `(hand_id, command_seq)`.

Every range check reuses an existing helper (`isIntegral`, `moneyRange`, `countRange`,
`timeWindow`, `seatRange`, `bpsRange`); none was hand-rolled. `bpsRange` was already
module-private above `strategyDecisionTraces` and is reused as-is.

`strategy_decision_traces` was **not modified**. Its `strategy_mode` CHECK still reads
`in ('REFERENCE')`, and the 0007 upgrade test asserts that an `'ADAPTIVE'` mode row is still
rejected there — that assertion is the mechanical statement of why this is a separate table.

## 4. Triggers

Hand-appended to the bottom of `0007_adaptive_strategy_traces.sql`, separated by
`--> statement-breakpoint`, in `0001_insert_only_guards.sql`'s style:

- `adaptive_strategy_traces_no_update` — BEFORE UPDATE →
  `'adaptive_strategy_traces is insert-only: a recomposition is a new row under a new adaptive_policy_version, never an UPDATE'`
- `adaptive_strategy_traces_no_delete` — BEFORE DELETE →
  `'adaptive_strategy_traces is insert-only: what the app recommended when the user acted is never deleted'`

## 5. Decoder

`packages/db/src/rows.ts`, following `decodeStrategyDecisionTraceRow` element by element.

Exported structures: `AdaptiveTraceAction`, `AdaptiveTraceFrequencyDelta`,
`AdaptiveTraceAdjustment`, `AdaptiveTraceSnapshotRef`, `AdaptiveStrategyTrace`,
`AdaptiveStrategyTraceRow`.

- Every JSON column goes `parseJson` → "is it an array?" → per-element decode. A failure is a
  `CORRUPT_ROW` whose `context.field` names the offending path, e.g.
  `adjustments_json[0].ruleId`, `adaptive_actions_json[0].action`. There is no bare cast and
  no `JSON.parse` into a typed variable anywhere.
- Action strings inside `baseline_actions_json`, `adaptive_actions_json` and
  `frequency_delta_json` are validated against `STRATEGY_TRACE_ACTIONS` — the SAME array the
  two `*_primary_action` CHECKs are built from — via the existing `memberOf`/`badMember`.
- 0..10000 fields reuse the existing private `decodeBps`. `sampleN` reuses the existing
  private `decodeCount`. Money reuses `decodeMoney`. Timestamps reuse `decodeTimestamp`.
  Seats reuse `decodeSeat`.
- One new private helper, `decodeSignedBps` (−10000..10000), for the two SIGNED fields
  (`deltaBps`, `contributionBps`); `decodeBps`'s 0..10000 window does not fit them.

## 6. Repository

`packages/db/src/repositories/adaptive-traces.ts`, structurally identical to
`strategy-traces.ts`:

- `AdaptiveStrategyTraceInsert = AdaptiveStrategyTrace`
- `AdaptiveTraceOutcome = 'PERSISTED' | 'ALREADY_PERSISTED'`
- `insertAdaptiveTraces(db, traces)` — one transaction; a duplicate id **inside the input
  array** is refused as `INVALID_INPUT` before anything is written; existing ids come back
  `ALREADY_PERSISTED` via a single `inArray` select. (The template does **not** chunk that
  select, so neither does this one — same idiom, no invented divergence.)
- `listAdaptiveTracesForHand(db, handId)` — `command_seq` ascending.
- `getAdaptiveTrace(db, id)` — `null` when absent.

There is no update and no delete function, and there must never be one.

## 7. Tripwire updates

- `packages/db/tests/insert-only.test.ts` — `adaptive_strategy_traces_no_delete` and
  `adaptive_strategy_traces_no_update` added at the **head** of the exhaustive list, which is
  the correct alphabetical position for `order by name` (`adaptive_` sorts before `analysis_`).
- `packages/db/tests/migrations.test.ts` — `'adaptive_strategy_traces'` added to `TABLES`
  (this is what makes the "creates no table Phase 3 did not ask for" exact-set assertion
  pass), and **all eleven** INTEGER columns added to `INTEGRAL_COLUMNS`: `command_seq`,
  `hero_seat`, `opponent_count`, `baseline_to_amount_mbb`, `adaptive_to_amount_mbb`,
  `baseline_sizing_bucket`, `adaptive_sizing_bucket`, `total_shift_bps`, `cap_applied`,
  `player_model_version`, `computed_at`.

## 8. Tests

### New — `packages/db/tests/adaptive-traces.test.ts`, 13 tests

Real migrated in-memory DB (`openTestDatabase`), real session + real completed hand
(`buildShowdownFixtureHand`) + a real `strategy_decision_traces` row written through
`insertStrategyTraces`, so the two nullable FKs are exercised against rows that actually exist.

1. round-trip of a FULL trace — non-empty `baselineActions` / `adaptiveActions` /
   `frequencyDeltas` / `adjustments` (including a NEGATIVE `contributionBps`) / both snapshot
   maps (one present id, one `null`), both money columns, both sizing buckets, `capApplied:
   true` — deep-equal through `getAdaptiveTrace` and `listAdaptiveTracesForHand`.
2. round-trip of a nullable-everything `INSUFFICIENT_DATA` trace.
3. absent id → `null`; empty input → `[]`.
4. exactly-once: same id twice → `PERSISTED` then `ALREADY_PERSISTED`, one row, and the
   FIRST composition still stored (the re-submission carried different numbers).
5. duplicate id inside one input array → `INVALID_INPUT`, **nothing written**.
6. a two-row batch in one transaction, returned in `command_seq` order.
7. the triggers really abort — raw `UPDATE` and raw `DELETE` through `handle.sqlite`, AND
   through the barrel-exported table object; the row survives all four.
8. corrupt `adjustments_json` (written raw, guards temporarily dropped by the existing
   `withoutInsertOnlyGuards` fixture) → `CORRUPT_ROW` with `field === 'adjustments_json[0].ruleId'`.
9. out-of-vocabulary action inside `adaptive_actions_json` → `CORRUPT_ROW` at
   `adaptive_actions_json[0].action`.
10. unparseable JSON → `CORRUPT_ROW`, not a throw.
11. FK: a trace for a non-existent `hand_id` is rejected and nothing is written.
12. FK: a non-existent `reference_trace_id` and a non-existent `primary_villain_player_id`
    are both rejected.
13. the `(hand_id, command_seq)` UNIQUE index refuses a second trace under a different id.

### New — 0007 upgrade-path test in `migrations.test.ts`

`applies 0007 to a populated database that already has 0000..0006`, in the same
`freezeMigrations(dir, 6)` style as the 0002–0005 tests. Seeds player + session + seat +
hand + hand_player + hand_event + a REFERENCE `strategy_decision_traces` row at 0006, applies
0007, then asserts: every pre-existing row byte-identical (the whole trace row compared field
by field), `integrity_check` ok, `foreign_key_check` empty, no `__new%` rebuild artefacts,
`strategy_decision_traces` still refuses `strategy_mode = 'ADAPTIVE'`, the new table accepts a
real row on the UPGRADED file, and its FK / UNIQUE / `cap_applied` / integrality CHECKs and
both insert-only triggers are live.

### Results

| gate | result |
| --- | --- |
| `pnpm vitest run --project db` | **10 files / 149 tests, all pass** (13 of them new) |
| `npx tsc --noEmit -p packages/db` | **clean, exit 0** |
| `pnpm lint` | **clean** (includes the layering rules) |
| `npx drizzle-kit generate` (re-run) | `No schema changes, nothing to migrate` — `schema.ts` and `0007_snapshot.json` are in sync |
| `npx prettier --check` on every edited file | clean after a format limited to the files this WP edited |

`db:generate` emitted exactly one new table and touched no existing one, so nothing needed to
be forced or stopped for.

## 9. Deviations from §7, and why

1. **`cap_applied` decodes to `boolean`, not a raw 0/1 number.** The column is INTEGER with
   `isIntegral` + `in (0, 1)`, exactly as §7 specifies; the domain type exposes
   `capApplied: boolean`. A plain integer column (rather than drizzle's `{ mode: 'boolean' }`)
   was chosen deliberately so the decoder can reject a stored `2` as `CORRUPT_ROW` instead of
   letting the driver coerce it to `true`. The repository writes `trace.capApplied ? 1 : 0`
   explicitly.
2. **`AdaptiveTraceAction.action` / `AdaptiveTraceFrequencyDelta.action` are typed
   `StrategyTraceAction`, not `string`.** The brief's interface said `string`; the brief also
   said the value must be validated against the CHECK's vocabulary. Typing it as the union
   makes the two statements one thing instead of two, and matches the existing
   `StrategyTraceActionRow`. `StrategyTraceAction` is `'FOLD'|'CHECK'|'CALL'|'BET'|'RAISE'|'ALL_IN'`,
   which is character-for-character `strategy-core`'s `StrategyActionKind`, so J-C/J-D output
   assigns without a cast.
3. **`toAmountMbb` is `MilliBB | null`, not `number | null`** — CLAUDE.md rule 1, and the
   template's own choice. `strategy-core` already produces `MilliBB`, so callers assign directly.
4. **`AdaptiveTraceAdjustment.contributionBps` is decoded as SIGNED (−10000..10000).**
   §4.2's contribution arithmetic uses `abs(dev)`, which suggests non-negative, but §4.2's rule
   table also carries `−AGGRESSION` targets and §9 speaks of "negative (de-escalating)
   contributions". A decoder that only admitted 0..10000 would make an insert readable only by
   luck. Signed is the safe reading; if J-C settles on unsigned, the window is simply never used.
5. **`ruleId`, `stat`, `target`, `reasonKey`, `sources[]`, `opponentPlayerId` stay `string`.**
   Those vocabularies live in `adaptive-core`, which `@gto-self/db` must not import (layering).
   They are validated as non-empty strings; the exhaustive maps belong to the UI/compose layer.
6. **§7's `hero_seat`, `command_seq`, `opponent_count`, `player_model_version` and the sizing
   buckets got an `isIntegral` term that the equivalent `strategy_decision_traces` columns do
   not have.** This is what lets *every* integer column of the new table go into
   `INTEGRAL_COLUMNS` as the brief demanded. `seatRange` itself was NOT changed — changing a
   shared helper would have rewritten existing tables' DDL, which migrations forbid; the term
   is composed at this table's call site only.

## 10. Remaining risk

- **The trigger list is hand-maintained.** `drizzle-kit` cannot emit a trigger, so no schema
  diff will ever notice a guard that is dropped or never added for a future table. The
  exhaustive assertion in `insert-only.test.ts` is the only tripwire, and it is now updated.
- **`reference_trace_id` is nullable by design**, so a LIVE trace can be written before the
  post-hand replay produces its REFERENCE row. Nothing in the database forces that link to be
  filled in later (it cannot be — the table is insert-only). If J-D wants a guaranteed link it
  must write the REFERENCE trace first; that is a caller-ordering decision, not a schema one.
- **The five JSON documents are not schema-validated at write time**, only at read time. A
  caller that writes a well-formed-JSON-but-wrong-shape document will succeed and fail on the
  next read with `CORRUPT_ROW`. Same posture as `strategy_decision_traces.actions_json` and
  `player_model_show_evidence.spot_keys_json`; going further would put composition-layer types
  inside the persistence layer.
- **Nothing writes to this table yet.** J-D owns generation. The repository, the decoder and
  the constraints are proven by the tests above, but the end-to-end path is not this WP's.
