# WP J-D2 — ADAPTIVE strategy trace generation service

2026-09-02. Design contract: `docs/reports/HARDENING_WP_J_DESIGN.md` §7 (column list), §2.3, §6, §9.
Template mirrored: `apps/web/src/server/strategy-trace-service.ts` and its report
(`docs/reports/strategy-trace-service-2026-09-02.md`).

## Scope

Generate and persist `adaptive_strategy_traces` for the Hero decision points of an
already-persisted, COMPLETED hand, by replaying the hand's own event log through the SAME two
functions the live Strategy Panel uses (`computeStrategy`, then `computeAdaptive`), wire it to
fire after the REFERENCE trace generation, and add a backfill script for hands that predate the
feature.

`packages/**` was read-only. No `.tsx`, no `apps/web/src/lib/table/**`, no `copy.ts`, no
`tableStore.ts` was touched — WP J-E is active in those files.

## Files created

- **`apps/web/src/server/adaptive-trace-service.ts`** — the generation service.
  - `generateAdaptiveTracesForHand(db, handId, { now, source? })`
  - `hasAdaptiveTraces(db, handId)` — the one read the backfill script needs, exported here
    because ESLint permits `@gto-self/db` only under `apps/web/src/server/**`.
  - `listCompletedHandIds` is deliberately **not** duplicated: the backfill script imports the
    REFERENCE service's. "Every finished hand" is one question with one answer.
- **`apps/web/src/server/adaptive-trace-service.test.ts`** — 6 tests, real migrated in-memory DB.
- **`apps/web/scripts/backfill-adaptive-traces.ts`** — `pnpm adaptive:backfill`.

## Files changed

- `apps/web/src/server/actions/hand-history.ts` — `scheduleAdaptiveTraceGeneration`, an exact
  copy of the existing `setImmediate` + `console.error` pattern, called **after**
  `scheduleStrategyTraceGeneration` for the same hand id.
- `apps/web/package.json` — `"adaptive:backfill": "tsx scripts/backfill-adaptive-traces.ts"`.
- `package.json` (root) — `"adaptive:backfill": "pnpm --filter @gto-self/web adaptive:backfill"`,
  matching the `strategy:backfill` proxy exactly.

## The replay, step by step

1. `getHand` → `getSession` for the recorded Hero seat. **No session, or no Hero seat →
   `ok([])`, not an error** (same benign branch the REFERENCE service has).
2. `loadStoredHand`, then walk the log for Hero's own voluntary actions
   (`origin === 'USER'` ∧ `isActionEvent` ∧ `event.seat === heroSeat`) — the identical
   three-part predicate the REFERENCE service uses, so an ADAPTIVE trace covers exactly the
   decision points a REFERENCE trace covers.
3. `handAtCommand(hand, commandSeq - 1)` reconstructs the pre-decision `HandState`;
   `commandSeq <= 0`, a failed fold, or a state that is not `BETTING`/`actorSeat === heroSeat`
   is skipped defensively.
4. `computeStrategy(state, heroSeat)` — the REFERENCE baseline. `REFUSED` / `NO_HAND` → skipped,
   replay continues.
5. `computeAdaptive(model, inputs, seatPlayerIds)` (`lib/table/adaptive.ts`, the same call
   `StrategyPanel` makes). `null` → skipped; it is `null` only for an `UNSUPPORTED` preflop
   family, where the REFERENCE engine itself disclaims its answer, so composing an exploit on
   top of it would store a player-specific number derived from a non-answer.
6. All rows written in ONE `insertAdaptiveTraces` call.

**Opponent inputs are loaded ONCE per hand** through `loadAdaptiveOpponentInputs`
(`adaptive-service.ts`) and reused across the hand's decision points. That module is the only
place the `MANUAL_HUD_MAX_EFFECTIVE_N` cap and the two source-mapping tables are applied;
assembling an `AdaptiveOpponentInput` here would bypass the cap and make the stored trace
disagree with what the user was shown. A failed HUD/model read is propagated as a
`STORAGE_FAILURE` `DbResult` err, never as an empty profile.

**The seat → player map comes from `listHandSeats` (`hand_players`)**, never from the session's
current lineup: a seat can change hands between the hand being played and the trace being
generated, and a trace naming the current occupant would attribute one player's evidence to
another player's decision. Hero's own seat is excluded from the opponent list.

## Field mapping (design §7)

| column                           | source                                                                          | note                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                             | `` `${handId}:${commandSeq}:ADAPTIVE` ``                                        | caller-supplied, stable, ADR-0007                                                                                                                                                      |
| `hand_id`, `command_seq`         | the replayed event                                                              |                                                                                                                                                                                        |
| `reference_trace_id`             | `listTracesForHand(handId)` indexed by `commandSeq`, else `null`                | **looked up, never assumed** — read once per hand, not per decision                                                                                                                    |
| `street`                         | `recommendation.baseline.street`                                                |                                                                                                                                                                                        |
| `hero_seat`                      | `session.table.heroSeat`                                                        |                                                                                                                                                                                        |
| `status`                         | `recommendation.status`                                                         |                                                                                                                                                                                        |
| `adaptive_policy_version`        | `recommendation.policyVersion`                                                  | `adaptive-core` owns the constant; nothing is minted here                                                                                                                              |
| `primary_villain_player_id`      | `recommendation.opponents.find(role === 'PRIMARY')?.playerId ?? null`           | FK to `players`; satisfied because the id came out of `hand_players`                                                                                                                   |
| `opponent_count`                 | `recommendation.baseline.activeOpponentCount`                                   | see note below                                                                                                                                                                         |
| `baseline_actions_json`          | `recommendation.baseline.actions` → `{action: kind, frequencyBps, toAmountMbb}` |                                                                                                                                                                                        |
| `adaptive_actions_json`          | `recommendation.actions` → same shape                                           |                                                                                                                                                                                        |
| `frequency_delta_json`           | `recommendation.actions` → `{action: kind, deltaBps}`                           | the row's own signed delta, not recomputed                                                                                                                                             |
| `baseline_primary_action`        | `recommendation.baseline.primaryKind`                                           |                                                                                                                                                                                        |
| `adaptive_primary_action`        | `recommendation.primaryAction.kind`                                             | `primaryAction === null` (only possible on an empty baseline set, which REFERENCE never produces) → the decision point is skipped: the column is NOT NULL and there is no honest value |
| `baseline_to_amount_mbb`         | `recommendation.sizing?.fromToAmountMbb ?? null`                                |                                                                                                                                                                                        |
| `adaptive_to_amount_mbb`         | `recommendation.sizing?.toToAmountMbb ?? null`                                  |                                                                                                                                                                                        |
| `baseline_sizing_bucket`         | `recommendation.sizing?.fromBucketIndex ?? null`                                | `-1` = ALL_IN / not-a-rung, the engine's own sentinel, never moved                                                                                                                     |
| `adaptive_sizing_bucket`         | `recommendation.sizing?.toBucketIndex ?? null`                                  |                                                                                                                                                                                        |
| `total_shift_bps`                | `recommendation.totalShiftBps`                                                  |                                                                                                                                                                                        |
| `cap_applied`                    | `recommendation.capApplied`                                                     | repository maps the boolean to 0/1                                                                                                                                                     |
| `adjustments_json`               | `recommendation.adjustments`, **without `note`**                                | see below                                                                                                                                                                              |
| `manual_hud_snapshot_ids_json`   | `recommendation.opponents` → `{playerId, manualHudSnapshotId}`                  | explicit `null` = "this opponent had no snapshot", ≠ absent                                                                                                                            |
| `player_model_snapshot_ids_json` | `recommendation.opponents` → `{playerId, learnedSnapshotId}`                    |                                                                                                                                                                                        |
| `player_model_version`           | PRIMARY villain's `learnedModelVersion`, else `null`                            | the one profile that actually drove the rule table (§9)                                                                                                                                |
| `computed_at`                    | `deps.now`                                                                      | injected, ADR-0040; no clock read anywhere in this module                                                                                                                              |
| `source`                         | `deps.source ?? 'LIVE'`                                                         |                                                                                                                                                                                        |

### Four mapping decisions worth stating

**All four sizing columns come from `AdaptiveSizing` and from nothing else.** They therefore
always describe the same size: bucket X paired with amount Y, before and after. Reading the
amount off the action rows instead would have LOST the adapted amount entirely —
`AdaptiveAction.toAmountMbb` echoes the baseline by design, and the moved size exists only on
`recommendation.sizing`. All four are `null` together when REFERENCE recommended no sized action.

**`adjustments_json` omits the authored rule `note`.** `ruleId` reconstructs it exactly.
Duplicating authored prose into every row would make re-wording a note a schema-versioning
problem — stored rows would silently disagree with the live rule table — for no gain. Everything
structured is kept: `ruleId`, `stat`, `opponentPlayerId`, `priorBps`, `observedBps`,
`estimateBps`, `sampleN`, `confidenceBps`, `sources`, `target`, signed `contributionBps`,
`reasonKey`. `sources` is narrowed to the source NAMES (`MANUAL_HUD` / `LEARNED_MODEL`) because
`AdaptiveTraceAdjustment.sources` is `readonly string[]` — `@gto-self/db` may not import the
composition layer, so it cannot hold `AdaptiveStatSourceRef`.

**`opponent_count` is `baseline.activeOpponentCount`, not `opponents.length`.** It is the count
that DETERMINES the global shift cap (2000 bps heads-up, 1000 multiway, design §4.3), so
`total_shift_bps` and `cap_applied` beside it stay auditable from the row alone. The number of
opponents whose evidence was consulted is a different figure and is already recorded, per
opponent, in the two snapshot-id maps.

**`source` defaults to `'LIVE'`.** `ADAPTIVE_TRACE_SOURCES` has exactly two members and the
online path is neither a batch recompute over old history nor an in-session composition — it is
the deferred generation that fires the moment a hand completes, inside the sitting. `'LIVE'` is
the honest half of a two-member vocabulary; `'BACKFILL'` is reserved for the script. Recorded as
a small vocabulary deviation from the schema doc-comment's "composed at the table while the hand
was being played".

## The no-data decision: rows ARE written

A decision point where the composition ran but **no rule cleared its confidence gate** is
recorded, as `status: 'INSUFFICIENT_DATA'` with the baseline mix echoed verbatim, zero deltas,
zero shift, an empty `adjustments`, and both snapshot maps holding explicit `null`s. It is NOT
skipped. Four reasons:

1. **It is the honest record of what was known.** Design §J7's property is that a trace is a
   snapshot of the evidence available at the time — and "there was none" is evidence about the
   review, not the absence of a review.
2. **Skipping would erase a real distinction.** "We had no data on this opponent" and
   "generation never ran for this hand" would become the same observable state, and the backfill
   script's own skip check reads exactly that difference — a hand of entirely unknown villains
   would be recomputed on every backfill run, forever.
3. **It keeps the ADAPTIVE trace set 1:1 with the REFERENCE trace set** for a hand, so a review
   can diff them decision by decision without a join that silently drops rows.
4. **The schema was built for these rows.** `ADAPTIVE_TRACE_STATUSES` documents
   `INSUFFICIENT_DATA` as "the stored `adaptive_actions_json` IS the baseline, verbatim". Nothing
   is invented in that state.

A decision point the composition could not run over at all (`computeAdaptive` returned `null` —
an `UNSUPPORTED` family the REFERENCE engine disclaims) is still skipped. That is a different
case: there is no baseline worth echoing.

## The REFERENCE ordering dependency

`reference_trace_id` links an ADAPTIVE row to the `strategy_decision_traces` row for the same
`(handId, commandSeq)`. **Both tables are insert-only and trigger-enforced**, so a link that is
`null` at write time can never be filled in afterwards.

- **Online path:** `persistCompletedHandAction` schedules REFERENCE generation and then ADAPTIVE
  generation, in that order, as two `setImmediate` callbacks. They run in registration order on
  the same macrotask queue and `generateStrategyTracesForHand` is fully synchronous, so the
  REFERENCE rows are committed before the ADAPTIVE pass reads them.
- **Backfill:** run `pnpm strategy:backfill` **before** `pnpm adaptive:backfill` on a database
  that has never been backfilled. Documented in the script header.
- **It is a lookup, not an assumption.** Running out of order costs the cross-reference, not
  correctness: the row is complete and every number in it is unchanged. Nothing else depends on
  the link being present, which is why the column is nullable in the first place (a LIVE
  composition legitimately predates its REFERENCE row).

## Tests

`apps/web/src/server/adaptive-trace-service.test.ts` — **6 tests, all passing**, against a real
migrated in-memory database, in `strategy-trace-service.test.ts`'s fixture style: a hand played
through `poker-core`'s own API on a session's real stored table, opponent evidence written
through the real `insertHudSnapshot` / `insertAnalysisResults` repositories.

The fixture hand differs from the REFERENCE one deliberately: Hero (BTN) opens, the SB folds,
the BB calls and then **leads on every street with Hero calling**. Hero facing a bet is what
gives the composition a PRIMARY villain postflop (the last aggressor). In the REFERENCE fixture
Hero closes the action, so `classifyOpponents` names no PRIMARY and every rule is starved by
construction — that hand would have tested the empty case three times over.

1. **One row per Hero decision, plausible fields, JSON round-trip.** 4 rows (preflop RAISE + 3
   CALLs). Both mixes are a 500-bps grid summing to exactly 10000; `frequencyDeltas` equal the
   two mixes' own difference; the two provenance maps name the same opponent list; at least one
   decision point is `ADAPTED` with a full evidence chain (`confidenceBps >= 2500`, real
   `sampleN`, source names from the two-member vocabulary, and **no `note` key**); the postflop
   PRIMARY villain is the BB with `player_model_version 1`. The round-trip is asserted twice
   over: `listAdaptiveTracesForHand` decoding at all proves the decoder accepted every column,
   and `JSON.parse(rawRow.<column>Json)` is asserted deep-equal to the decoded structure, so a
   silently dropped or reshaped field fails at this boundary rather than months later.
2. **Exactly-once.** Two runs → all `PERSISTED`, then all `ALREADY_PERSISTED`; the raw rows are
   deep-equal before and after and the count stays 4.
3. **No data → rows still written.** All 4 rows `INSUFFICIENT_DATA`, empty `adjustments`,
   adapted mix identical to the baseline, all deltas 0, `totalShiftBps` 0, `capApplied` false,
   every snapshot ref `null`, `playerModelVersion` null.
4. **`reference_trace_id` both ways.** One hand with REFERENCE traces generated first links every
   row to `` `${handId}:${commandSeq}` ``; a second hand in the same session, never given
   REFERENCE traces, gets `null` on every row.
5. **Immutability (ADR-0060/0066, §J7).** After the traces are written, a NEW HUD snapshot with
   contradictory readings is inserted for the PRIMARY villain. The stored rows are asserted
   **byte-identical** (`JSON.stringify` of the raw rows) afterwards, and a re-run over the new
   evidence still writes nothing.
6. **Seat → player from the hand's own rows.** Seat 2 is vacated and given to a different player
   who then plays a second hand there. The older hand is traced AFTER the seat changed hands and
   still names the ORIGINAL occupant in both provenance maps and in
   `primary_villain_player_id`; the newer hand names the newcomer. Neither hand's trace mentions
   the other's player.

## Verification

| gate                                                                            | result                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `npx vitest run --project web src/server/adaptive-trace-service.test.ts`        | 6 passed                                                              |
| `npx vitest run --project web`                                                  | 30 files passed, 1 skipped; **441 passed**, 3 skipped, 0 failed       |
| `npx tsc --noEmit -p apps/web`                                                  | clean **except** `src/components/table/StrategyPanel.tsx` (see below) |
| `npx eslint .`                                                                  | clean **except** `src/components/table/StrategyPanel.tsx` (see below) |
| `npx prettier --check` on every changed/created file                            | clean                                                                 |
| `GTO_SELF_DB_URL=<tmp>.db npx tsx apps/web/scripts/backfill-adaptive-traces.ts` | ran clean, `hands seen 0`, exit 0                                     |

**Pre-existing red outside this WP's scope:** `apps/web/src/components/table/StrategyPanel.tsx`
has 14 `no-unused-vars` errors (imports staged for the ADAPTIVE panel mode that is not wired up
yet). That file belongs to **WP J-E**, which is mid-flight in `src/components/` and
`src/lib/table/`. It was not touched here and the errors are unrelated to this work — no server
module, no test and no script in this WP references it. Reported rather than fixed.

## Deviations from the brief

1. **`opponent_count` is `activeOpponentCount`**, not the length of the opponent list. Reasoned
   above; both are "straight off the recommendation".
2. **`AdaptiveSeatInput.nickname` is passed as `null`.** It is display text that reaches no
   stored trace column (a row identifies an opponent by `playerId`), and it can affect no number,
   so the replay does not spend a read resolving a label it will throw away.
3. **`source` defaults to `'LIVE'`** — noted above as a two-member-vocabulary compromise.
4. **`buildAdaptiveBaseline` is not imported directly.** `computeAdaptive` calls it internally;
   importing it unused would be a lint error. The composition path is identical to the panel's.

## Remaining risk

- **The ordering dependency is a convention on the backfill path, not a constraint.** Nothing
  refuses to write an ADAPTIVE trace for a hand with no REFERENCE traces, and the link cannot be
  repaired afterwards on an insert-only table. Mitigation: both script headers say so, and test 4
  pins both outcomes. If a database is ever backfilled in the wrong order, the recovery is a new
  row under a new `adaptive_policy_version`, not an UPDATE.
- **`ADAPTIVE_TRACE_SOURCES` cannot distinguish the post-hand online replay from a true
  in-session composition.** Both would be `'LIVE'`. Today only the replay writes traces, so no
  information is lost; if WP J-E ever persists a composition made at the table, the two paths
  become indistinguishable in storage. Widening the CHECK on an insert-only table is an ADR-0046
  table rebuild, so this is recorded rather than pre-emptively changed.
- **A corrupt REFERENCE trace row fails the whole ADAPTIVE generation for that hand**
  (`listTracesForHand` returns `err`). Deliberate: a provenance pointer is not worth guessing at,
  and storage corruption belongs in `DbResult`'s `err` branch. It is logged and swallowed on the
  online path, so it can never surface as a user error.
- **`computeAdaptive` rebuilds the opponent profiles at every decision point** of a hand (the DB
  reads are hoisted, the pure `buildAdjustmentProfile` call is not). That is integer math over a
  handful of arrays, on a path that already ran a full `computeStrategy`, off any hot path — but
  it is a known, deliberate redundancy rather than an oversight.
