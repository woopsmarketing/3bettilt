# WP C1-B — `apps/web/src/server`: post-session analysis orchestration

Scope: `apps/web/src/server/**` only (plus this report). `packages/*`, root configs,
`CLAUDE.md`, `prompt`, `docs/STATE.md` and every client/UI file are untouched. No component,
route or hook was written — that is WP C1-D.

Implements ADR-0062 (b, c, d, g) at the application layer: the button's server side.

Gates: `pnpm vitest run --project web` **20 files / 319 tests PASS + 3 skipped (the opt-in
bench)**, `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` PASS,
`pnpm exec eslint apps/web --max-warnings=0` PASS. Baseline before this WP: 18 files / 306
tests. No existing assertion was weakened or deleted.

---

## 1. Files

| File | Change |
|---|---|
| `src/server/analysis-contract.ts` | NEW. Types + two zod shapes. No runtime import of `@gto-self/db` — the two domain imports are `import type` and are erased, so WP C1-D can import these types from a client component. |
| `src/server/analysis-service.ts` | NEW. `runSessionAnalysis` + `getPlayerModel`. |
| `src/server/actions/analysis.ts` | NEW. `'use server'` wrappers: real handle, real clock, `cryptoIdFactory`, nothing else. |
| `src/server/analysis-fixture.ts` | NEW, TEST-ONLY. Real hands through `poker-core`, stored through `persistCompletedHand`. |
| `src/server/analysis-service.test.ts` | NEW — 12 integration tests. |
| `src/server/analysis-strategy-unaffected.test.ts` | NEW — 1 test, the prompt §39 acceptance blocker. |
| `src/server/analysis-performance.test.ts` | NEW — 3 measurements, skipped unless `GTO_SELF_BENCH=1`. |

---

## 2. Service design

### 2.1 Signatures

```ts
// src/server/analysis-service.ts
export interface RunSessionAnalysisDeps {
  readonly ids: IdFactory;
  readonly now: () => Timestamp;      // a FUNCTION, see §2.2
}

export function runSessionAnalysis(
  db: GtoDatabase, input: unknown, deps: RunSessionAnalysisDeps,
): RunSessionAnalysisResult;

export function getPlayerModel(db: GtoDatabase, input: unknown): GetPlayerModelResult;

// src/server/actions/analysis.ts
export async function runSessionAnalysisAction(
  input: RunSessionAnalysisValue,          // { sessionId: string }
): Promise<RunSessionAnalysisResult>;
export async function getPlayerModelAction(
  input: { playerId: string },
): Promise<GetPlayerModelResult>;
```

Both services take `unknown` and re-parse it with zod: a server action is a public endpoint,
so its input is untrusted even when it is one field. This mirrors `persistCompletedHand` and
`startSession` exactly.

### 2.2 Why `deps.now` is a function

Every other service in this directory takes `now: Timestamp`, a single reading. A run has a
DURATION that prompt §35 asks to be reported, so `startedAt` and `finishedAt` must be two
readings taken around the work. The tests inject a 5 ms-stepping counter and get a
deterministic, assertable pair; the action passes `nowTimestamp` itself. ADR-0040 is intact —
the clock is still injected, never reached for inside the service, and `@gto-self/db` still
reads no clock and generates no id.

### 2.3 The run, step by step

1. Parse `{ sessionId }`. `getSession` — an unknown session is `NOT_FOUND`. A **CLOSED**
   session is ACCEPTED: this is *post*-session analysis, and refusing the very state the
   feature exists for would be absurd. Nothing about the session row is written either way.
2. `startedAt = deps.now()`.
3. `listCompletedHandsForSession` → `sessionHandCount` (the scope the button named).
4. `listPlayerIdsWithCompletedHandsInSession` → the affected players. **Zero → see §3.**
5. Per player (`planPlayer`, pure of writes):
   - `listCompletedHandIdsForPlayer` — the player's **complete** eligible set, every session
     (ADR-0062b). See §4 for why narrowing this is not a conservative choice but a bug.
   - `inputIdentityHash(ids)` and `getLatestSnapshotIdentity` → the `NO_CHANGES` gate (§4).
   - Otherwise `loadCompletedHands` → `computePlayerModel` → a snapshot candidate, plus
     `listSnapshotVersions` (headers only) for the previous `sourceHandCount`.
6. `finishedAt = deps.now()`; snapshot ids from `deps.ids`; run id from `deps.ids`.
7. **ONE** `insertAnalysisResults` call carrying the run header, every per-player outcome and
   every new snapshot. All-or-nothing (WP C1-C §7.2).
8. Build the summary. `modelVersion` is read back from the repository's result, never chosen
   here (WP C1-C §7.3).

Raw history is never written, rewritten or deleted; `insertAnalysisResults` is this module's
only write path and it touches derived tables alone (prompt §33). Asserted by a test.

---

## 3. Decision — zero eligible players records NOTHING

Recommended in the brief and taken: a session with no completed hand linked to any player
returns

```
{ ok: true, summary: { status: 'NO_ELIGIBLE_HANDS', runId: null, playerCount: 0, players: [] } }
```

and **no `analysis_runs` row is written**. A run row exists to make an analysis auditable —
scope, input identity, counts, per-player outcomes — and a run over an empty input set has no
input identity to be audited against. Writing one would be a row asserting that an analysis
happened, with nothing that could ever be checked against it. The user is told plainly
instead.

`NO_ELIGIBLE_HANDS` is therefore a **summary** status only. The database vocabulary
(`SUCCESS | PARTIAL | FAILED`) is unchanged and no migration is implied.

---

## 4. The `NO_CHANGES` gate

```ts
const hash = inputIdentityHash(listCompletedHandIdsForPlayer(db, playerId));
const latest = getLatestSnapshotIdentity(db, playerId);
if (latest !== null
    && latest.algorithmVersion === ANALYSIS_ALGORITHM_VERSION
    && latest.inputHash === hash) → NO_CHANGES, no compute, no snapshot
```

**Both halves, per ADR-0062c.** An equal hash under a NEW algorithm version is a different
answer to the same question; an equal version over a new hand set is the same answer to a
different one. Either difference must produce a snapshot. Comparing one alone silently
freezes the model in one of the two directions.

**The hash is over the FULL set, every run.** `inputIdentityHash` hashes exactly the ids the
caller passed. If a run ever passed a narrower set — this session's hands only — the hash
would differ from the previous run's for reasons that have nothing to do with new history,
and the gate would fail in the worst direction: a new snapshot on **every** click, each one
computed from less history than the last. This is WP C1-A's "downstream must know" item and
it is stated at the top of `analysis-service.ts` so a future edit cannot make the change
innocently.

Note that the gate also skips the **compute**, not only the write: a repeated click over 1000
hands costs 4 ms rather than 608 ms (§8).

---

## 5. Failure semantics (prompt §33)

| Situation | Outcome |
|---|---|
| One player's hand list, hand load, or `computePlayerModel` fails | that player is `FAILED` with `{code, message}` as `errorJson`; **every other player is still analysed and still gets a snapshot** |
| `analysis-core` THROWS (the two `invariant` paths WP C1-A §10.6 names) | caught at the player boundary → `FAILED`, not a 500 |
| Some players failed | run `status = 'PARTIAL'` |
| Every player failed | run `status = 'FAILED'`, run-level `errorJson = {"code":"ALL_PLAYERS_FAILED",…}`, no snapshot written |
| Nobody failed (including all-`NO_CHANGES`) | run `status = 'SUCCESS'` — a run in which nothing changed is a successful run, not an empty one |
| `insertAnalysisResults` itself fails | `{ ok: false, code, message }` and **nothing is persisted** |

**Decision on the last row.** A failed write is NOT followed by an attempt to record a
`FAILED` run. Recording that failure would mean succeeding at the write that just failed, and
a second attempt over the same broken storage only adds a second way for the function to lie.
The user gets the storage layer's own code and message verbatim; the previous snapshots are
untouched, because the write was all-or-nothing.

Per-player failures are visible three ways: in the returned summary (`errorCode` /
`errorMessage`), in `analysis_run_players.error_json`, and in the run's `PARTIAL`/`FAILED`
status. Prompt §33's "do not silently report full success" is structural: `status` is
computed from the failure count, not chosen.

---

## 6. Read surface for WP C1-D — exact signatures

Everything below is exported from `src/server/analysis-contract.ts` unless marked.

```ts
type AnalysisSummaryStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NO_ELIGIBLE_HANDS';
type AnalysisPlayerOutcomeView = 'SNAPSHOT_CREATED' | 'NO_CHANGES' | 'FAILED';

interface AnalysisPlayerSummary {
  playerId: string;
  nickname: string | null;            // null only when the players row could not be read
  outcome: AnalysisPlayerOutcomeView;
  modelVersion: number | null;        // assigned (CREATED) | existing (NO_CHANGES) | null
  totalHands: number | null;          // the player's COMPLETE history, all sessions
  addedSinceLastSnapshot: number | null;   // 0 on NO_CHANGES; null when there is no previous
  spotGroupCount: number | null;      // prompt §27's "주요 상황 N groups"
  showCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface AnalysisSummary {
  runId: string | null;               // null exactly on NO_ELIGIBLE_HANDS
  sessionId: string;
  status: AnalysisSummaryStatus;
  algorithmVersion: number;
  startedAt: number; finishedAt: number; durationMs: number;
  sessionHandCount: number;           // completed hands stored for THIS session
  playerCount: number;                // === players.length
  observationCount: number;           // over the snapshots this run CREATED
  showCount: number;                  // same rule
  players: readonly AnalysisPlayerSummary[];
}

type RunSessionAnalysisResult =
  | { ok: true; summary: AnalysisSummary }
  | { ok: false; code: string; message: string };

interface PlayerModelView {
  playerId: string;
  nickname: string | null;
  snapshot: PlayerModelSnapshot | null;      // @gto-self/player-core — FULL content
  versions: readonly ModelSnapshotHeader[];  // @gto-self/db — headers only, oldest first
}
type GetPlayerModelResult =
  | { ok: true; value: PlayerModelView }
  | { ok: false; code: string; message: string };
```

### What C1-D must know

1. **Both actions are passed down as PROPS**, never imported by a client component
   (ADR-0044). `analysis-contract.ts` may be imported for its TYPES from a client component —
   its only two domain imports are `import type` and are erased — but importing
   `analysis-service.js` or `actions/analysis.js` into a client module is not permitted.
2. **`spotGroupCount` and `showCount` are `null` on a `NO_CHANGES` line.** Those numbers were
   not recomputed by this run, and the summary reports what THIS run did. To show them for an
   unchanged player, call `getPlayerModelAction` — the snapshot carries
   `spotStats.length` and `sourceShowCount`.
3. **`addedSinceLastSnapshot` is `null` for a first snapshot**, and must render as "—", not
   as `totalHands`. A first snapshot has nothing to be "added" to; showing the whole history
   as an increment would read as growth that did not happen.
4. **`totalHands` is the player's whole history, not this session's.** Prompt §27's "총 관찰"
   is `totalHands`; "이번 추가" is `addedSinceLastSnapshot`; the session's own number is the
   run-level `sessionHandCount`.
5. **`NO_ELIGIBLE_HANDS` has `runId: null`.** Do not render it as a failure — nothing went
   wrong, there was simply nothing to analyse.
6. **`PARTIAL` must be visible.** A player row with `outcome: 'FAILED'` carries the refusing
   layer's own `errorCode`/`errorMessage`; show them verbatim (`CLAUDE.md` rule 3).
7. **The panel must say, in words, that strategy is unchanged** (prompt §27):
   "플레이어 모델이 업데이트되었습니다. 현재 기본전략 추천에는 아직 반영되지 않습니다."
   That claim is pinned by a permanent test (§7.3) — it is true, and it must be said.
8. **Never sum the `position: null` row with the six positional rows** (WP C1-A §10.9,
   ADR-0035), and never render `UNKNOWN` confidence as a percentage.
9. **The safe boundary is C1-D's** (prompt §26). The service will happily analyse mid-session;
   the UI is what must only offer the button between hands.

---

## 7. Tests

`pnpm vitest run --project web` — **20 files, 319 PASS, 3 skipped, 0 FAIL.**

### 7.1 `src/server/analysis-service.test.ts` (12)

| # | Test | Property |
|---|---|---|
| 1 | creates v1 for every player, then reports NO_CHANGES on a second click | prompt §38: 6 real hands, 3 players → 3 × v1; second run → all `NO_CHANGES`, versions still `[1]`, snapshot JSON byte-identical, counts NOT doubled; both runs recorded as `SUCCESS` |
| 2 | creates v2 with the FULL history count after more hands arrive | 5 hands → v1 (5); +4 hands → v2 with `sourceHandCount = 9`, **not 14 and not 10**; `addedSinceLastSnapshot = 4`; v1 retained with 5 |
| 3 | re-analysing after new hands leaves an UNAFFECTED player on NO_CHANGES | 모카 plays A(4)+B(3) → v2 over 7; 참외 first snapshot over 3; 감자, never in B's scope, keeps exactly v1/4 |
| 4 | builds one snapshot from BOTH sessions for the same nickname | A(5) + B(8), button pressed on B → every player's snapshot is over **13**; then pressing it on A says `NO_CHANGES` |
| 5 | analyses a CLOSED session | post-session analysis is the point |
| 6 | records NOTHING for a session with no completed hands | `NO_ELIGIBLE_HANDS`, `runId: null`, `listAnalysisRunsForSession` empty |
| 7 | REFUSES an unknown session and 5 malformed requests | `NOT_FOUND` / `INVALID_INPUT` |
| 8 | produces IDENTICAL snapshot content from identical input, on two databases | `JSON.stringify` equality of the content with `modelVersion`/`createdAt` removed |
| 9 | PARTIAL: healthy players keep their snapshots, raw history untouched | one stored event corrupted → 2 of 3 players `FAILED`, 참외 gets a real snapshot, failing players have **no** snapshot row, run is `PARTIAL` with an outcome for all 3 and stored `error_json`, and session A's hand rows + event log are byte-identical afterwards |
| 10 | FAILED when EVERY player fails | run-level `error_json` set, no snapshot anywhere |
| 11 | `getPlayerModel` returns the latest FULL snapshot plus every version header | versions `[1,2]`, latest v2 over 6 hands, `globalStats` really loaded |
| 12 | un-analysed player is a STATE, unknown player is an ERROR | `{snapshot:null, versions:[]}` vs `NOT_FOUND`; a non-string id is `INVALID_INPUT` |

Test 9's corruption uses the same technique as `packages/db`'s `withoutInsertOnlyGuards`
(drop the triggers read out of `sqlite_master`, mutate, put them back verbatim), re-implemented
locally because that helper lives in `packages/db/tests/` and is not on the package barrel.
It simulates a file damaged by other means — the only situation the read-time `CORRUPT_ROW`
paths exist for — and nothing in `src/` can do it.

### 7.2 The fixture

Every hand is REAL: `startSession` → `startHand` → `applyCommands` → `awardPots`, then stored
through the app's own `persistCompletedHand`. No `HandState` literal, no row inserted behind
the service's back. Four preflop shapes cycle (open/fold/call, open/3-bet/fold/call, limped
pot with the BB option, fold/open/call), one of them carries a real postflop c-bet and call,
and every hand reaches a showdown with one player SHOWING (so `ShowEvidence` is exercised).
Between hands the table advances exactly as the store does and every seat is reset to its
100 BB buy-in — without that, stacks drift and a fixed script stops being legal after a few
dozen hands, which would make the bench fail for a reason unrelated to analysis.

### 7.3 `analysis-strategy-unaffected.test.ts` (1) — the acceptance blocker

Prompt §39 / ADR-0062g. A fixed preflop query and a fixed flop query are evaluated through
`apps/web/src/lib/table/strategy.ts`'s `computeStrategy` — the exact call the Strategy Panel
makes — `JSON.stringify`d, then history is inserted, a real analysis run writes snapshots
(asserted non-empty: `sourceHandCount > 0`, `globalStats.length > 0`), and both queries are
re-evaluated. Both strings must be identical. **Permanent**: the day a C2 phase wires the
model into 기본전략, this test is what must be consciously changed, with an ADR.

There is a structural backstop as well — `strategy-core` may not import `analysis-core`,
`player-core` or `@gto-self/db` and ESLint enforces it both ways (ADR-0061) — so this test
covers the other route: the app layer feeding model data into the query it builds.

---

## 8. Performance (prompt §35)

`GTO_SELF_BENCH=1 pnpm vitest run --project web src/server/analysis-performance.test.ts`
— skipped by default, so no wall-clock assertion runs in CI. Apple M-series, in-memory SQLite,
3 players per session, every player dealt into every hand.

| Hands | build + persist | **`runSessionAnalysis`** | re-run (`NO_CHANGES`) |
|---|---|---|---|
| 100 | 196 ms | **88 ms** | 1.6 ms |
| 500 | 714 ms | **347 ms** | 2.6 ms |
| 1000 | 1331 ms | **608 ms** | 4.1 ms |

Read: **~0.6 ms per hand per run**, linear in hands, and this is the O(N·M) shape WP C1-A
§10.8 flagged — 3 players × 1000 hands = 3000 extractions in 608 ms. All-history
recomputation is comfortably fast, so per prompt §35 it stays: **no incremental complexity is
introduced**, because there is no evidence any is needed. The `NO_CHANGES` path is two indexed
queries per player and is effectively free, which is the second thing the idempotency gate
buys after correctness.

The only assertion in the bench is a deliberately absurd ceiling (200 ms per hand); it exists
to catch a complexity regression, not a busy laptop.

---

## 9. Risks and follow-ups

1. **`observationCount` / `showCount` on the run count only the snapshots the run CREATED.**
   A run that is entirely `NO_CHANGES` records zeros. These are audit fields describing what
   the run did; per-player truth lives on the snapshot (`sourceObservationCount`,
   `sourceShowCount`), as WP C1-C §7.6 intends. If a future UI wants "SHOW evidence in this
   session", that is a different query over `player_model_show_evidence`, not this field.
2. **`planPlayer` runs `listSnapshotVersions` for every player it recomputes**, purely to get
   the previous `sourceHandCount` for "이번 추가". It is a headers-only indexed read; if a
   player ever accumulates hundreds of versions it becomes the one avoidable cost in the run,
   and a `getPreviousSnapshotHandCount` repository function would remove it.
3. **Concurrency.** Two simultaneous runs on one process are serialised by SQLite's write
   lock; two PROCESSES racing land on `UNIQUE(player_id, model_version)` and the loser gets a
   typed `CONSTRAINT_VIOLATION` with nothing written (WP C1-C §4). The app has one connection,
   so this is a documented property rather than a live hazard. There is no UI-level guard
   against double-clicking the button — that is C1-D's (and the second click would be a
   `NO_CHANGES` run anyway).
4. **The button is not yet reachable.** Nothing renders `runSessionAnalysisAction`; the route
   wiring, the safe boundary (prompt §26) and the summary panel (§27) are WP C1-D.
5. **`analysis-fixture.ts` lives under `src/`,** not in a `tests/` folder, because the web
   project's vitest `include` is `src/**/*.test.ts` and the fixture must sit beside the tests
   that import it. It is typechecked and linted like production code but is imported by
   nothing in the app. If a future build ever traces it, the `@gto-self/db` import is
   server-side and legal there anyway.
6. **`hand_players.player_id IS NULL`** (an unidentified opponent) contributes no player id to
   discovery, so such a seat is never analysed and never fails a run. That is WP C0-B's
   documented behaviour, inherited unchanged.
