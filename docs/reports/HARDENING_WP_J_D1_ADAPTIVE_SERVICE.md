# WP J-D1 — ADAPTIVE source mapping (server side)

2026-09-02. Implements §2.3 of `docs/reports/HARDENING_WP_J_DESIGN.md`: the server-side
mapping that turns persisted player data into the neutral `AdaptiveOpponentInput` DTO the
ADAPTIVE policy layer consumes. Nothing in §4/§5/§7/§8/§9 is touched — those are other WPs.

---

## 1. Files

### Created

| file | what it is |
| --- | --- |
| `apps/web/src/server/adaptive-service.ts` | Both mapping tables, both reads, the lineup read. |
| `apps/web/src/server/actions/adaptive.ts` | `'use server'` `loadAdaptiveInputsAction`. |
| `apps/web/src/server/adaptive-service.test.ts` | 18 tests against a real migrated in-memory DB. |

### Changed

| file | change |
| --- | --- |
| `apps/web/src/lib/table/contract.ts` | **Appended only.** 5 new wire types + one type-only import. No existing type edited. |
| `apps/web/package.json` | Added `"@gto-self/adaptive-core": "workspace:*"` (it was not a dependency of `apps/web` yet). `pnpm install` re-linked the workspace. |

### Deliberately NOT changed

`packages/adaptive-core`, `packages/strategy-core`, `packages/db`, `packages/player-core`;
`tableStore.ts`, `strategy.ts`, `copy.ts`, any React component; `next.config.ts`;
`eslint.config.js`; `tsconfig.base.json` (which already carried the `@gto-self/adaptive-core`
path alias, and `vitest.config.ts` already carried the alias too).

---

## 2. Layering, verified before starting

`eslint.config.js` bans `@gto-self/db` across `apps/web/**` and then re-permits it for
`apps/web/src/server/**/*.{ts,tsx}` and `apps/web/tests/**` only (the "THE ONE PLACE IN THE
APP PERMITTED TO OPEN THE DATABASE" block). `adaptive-service.ts` and `actions/adaptive.ts`
both sit inside that carve-out. `contract.ts` does NOT import `@gto-self/db`; its only new
import is `import type` of two string-literal unions from `@gto-self/adaptive-core`, which is
erased at compile time and reaches no native module. `pnpm lint` is clean.

---

## 3. Mapping table 1 — MANUAL_HUD, as implemented

`MANUAL_HUD_STAT_MAP: Readonly<Record<HudStatKey, AdaptiveStatKey>>` — exhaustive by type, so
a new `HudStatKey` is a compile error here.

| `HudStatKey` | `AdaptiveStatKey` |
| --- | --- |
| `VPIP` | `VPIP` |
| `PFR` | `PFR` |
| `THREE_BET` | `THREE_BET` |
| `FOLD_TO_THREE_BET` | `FOLD_TO_THREE_BET` |
| `CBET_FLOP` | `CBET_FLOP` |
| `FOLD_TO_CBET_FLOP` | `FOLD_TO_CBET_FLOP` |
| `WTSD` | `WTSD` |
| `WON_AT_SHOWDOWN` | **`WSD`** |

- `valueBps = reading.value` — an **assignment, not a conversion**. `CentiPercent`
  (player-core's HUD unit, hundredths of a percentage point, 0..10000) and basis points are
  the same unit with two names; there is no arithmetic between what the user typed and what a
  rule sees. Stated in a comment on `manualHudObservations`.
- `sampleN = min(snapshot.handSample ?? 0, MANUAL_HUD_MAX_EFFECTIVE_N)` — the constant is
  imported from `@gto-self/adaptive-core`, never re-declared.
- Notes (one per snapshot, shared by every reading in it):
  - `handSample === null` → `sampleN 0`, note `'HUD 표본 수 미입력'` (`HUD_SAMPLE_MISSING_NOTE`).
  - `handSample > 1000` → `sampleN 1000`, note
    `` `HUD 표본 ${handSample}핸드 → 유효 표본 1000 제한 (상한 적용)` `` (`hudSampleCappedNote`),
    so the user can see that their 40,000-hand HUD was read as 1,000.
  - otherwise → note `null`.
- Iterated in `HUD_STAT_KEYS` order, not in the order the user typed, so two identical
  snapshots entered in different orders produce identical bytes.
- Only the readings actually present in the snapshot become observations. No key is
  back-filled.

---

## 4. Mapping table 2 — LEARNED_MODEL, as implemented

`LEARNED_MODEL_STAT_MAP: Readonly<Record<ModelStatKey, LearnedStatMapping | null>>` —
exhaustive by type over all 21 `ModelStatKey` members, so a new one is a compile error rather
than a silent drop. `LearnedStatMapping = { key, position, note }`.

| `ModelStatKey` | position row | `AdaptiveStatKey` | note |
| --- | --- | --- | --- |
| `VPIP` | `null` | `VPIP` | — |
| `PFR` | `null` | `PFR` | — |
| `RFI` | — | **not mapped** | no all-position RFI stat exists in `AdaptiveStatKey` |
| `STEAL_ATTEMPT` | `null` | `STEAL` | `'RFI from CO/BTN/SB'` |
| `FOLD_TO_STEAL` | **`'BB'`** | `FOLD_BB_TO_STEAL` | `'BB 포지션 행에서 읽음'` |
| `THREE_BET` | `null` | `THREE_BET` | — |
| `FOLD_TO_THREE_BET` | `null` | `FOLD_TO_THREE_BET` | — |
| `FOUR_BET` | — | **not mapped** | no counterpart; MVP rule table has no 4-bet rule |
| `CBET_FLOP/TURN/RIVER` | `null` | same | — |
| `FOLD_TO_CBET_FLOP/TURN/RIVER` | `null` | same | — |
| `CHECK_RAISE_FLOP/TURN/RIVER` | `null` | same | — |
| `TURN_BARREL` | — | **not mapped** | differently scoped from `CBET_TURN`; aliasing forbidden |
| `RIVER_BARREL` | — | **not mapped** | same, for `CBET_RIVER` |
| `WTSD` | `null` | `WTSD` | — |
| `WSD` | `null` | `WSD` | — |

- `valueBps = Math.round(10000 * actions / opportunities)`; `sampleN = opportunities`.
- **`opportunities === 0` drops the row entirely.** Never 0% for "never had the chance".
- Rows are looked up through a `(key, position)` index over `snapshot.globalStats`; the
  `player_model_stats` unique indexes guarantee at most one match per mapping.
- Emitted in `MODEL_STAT_KEYS` order.

---

## 5. Provenance

`manualHudSnapshotId` / `manualHudRecordedAt` come straight off the `PlayerHudSnapshot` the
repository returned.

`learnedModelVersion` comes off the snapshot. **`learnedSnapshotId` needed one extra read:**
`PlayerModelSnapshot` is a *content* document and `player-core` deliberately keeps the row id
out of it (ADR-0040), so `getLatestSnapshot` cannot supply it. The service therefore also
calls `listSnapshotVersions` — headers only, no child table — and matches the header **by
`modelVersion`**, not by list position, so the pointer can never name a different row from the
numbers beside it. It runs only when a snapshot exists. This is a deviation from a literal
reading of the brief ("populate … from the rows you read") and is recorded here as such; the
alternative was a new `getLatestSnapshotId` in `packages/db`, which is out of my file boundary.

A player with neither source yields `observations: []`, four `null` pointers, and `ok: true`.

---

## 6. Wire types (`contract.ts`, appended)

`AdaptiveSeatInput`, `AdaptiveStatObservationWire`, `AdaptiveOpponentInputWire`,
`LoadAdaptiveInputsResult`, `LoadAdaptiveInputsAction` — all `readonly`, all plain JSON, no
class instance, no branded id, no `Timestamp`.

One judgement call: `key` and `source` are typed as `AdaptiveStatKey` / `AdaptiveStatSource`
via a **type-only** import from `@gto-self/adaptive-core` rather than widened to `string`.
Precedent is `analysis-contract.ts`, which type-only-imports `PlayerModelSnapshot` for the
same reason and documents why it is safe. The payoff is that WP J-E can hand a
`AdaptiveOpponentInputWire` straight to `buildAdjustmentProfile` with no cast — and a cast is
exactly where an eighteenth stat key would slip through. A string-literal union is plain JSON.

`LoadAdaptiveInputsResult` is all-or-nothing on purpose: a lineup returned with one seat
quietly missing is indistinguishable from a lineup in which that opponent is genuinely
unknown, and ADAPTIVE would then adapt against a partial table without saying so.

---

## 7. The action

`loadAdaptiveInputsAction(seats)` in `apps/web/src/server/actions/adaptive.ts`. It follows
`actions/player.ts` exactly: `'use server'`, opens the DB via `database()`, adds nothing else.
It mints no id and reads no clock, because it is a pure read — every timestamp it returns is
already stored on the row it read, so there was no injected-deps parameter to add.

Input is untrusted, so `loadAdaptiveOpponentInputs` validates the lineup before touching the
database: at most `SEAT_COUNT` (6) seats, every `playerId` a non-empty string, every
`seatIndex` an integer `0..5`, and no player seated twice. A failure is `{ ok: false, message }`;
nothing throws to the client.

An **unknown** player id is not a failure — it comes back with no observations, which is the
honest answer ("we know nothing about them") and is what makes ADAPTIVE degenerate to
REFERENCE for that seat.

---

## 8. Tests — `apps/web/src/server/adaptive-service.test.ts`, 18 tests, all passing

Real migrated in-memory DB (`openTestDatabase()`), real repository writes only
(`insertPlayer`, `insertHudSnapshot`, `insertAnalysisResults`, plus `startFixtureSession` from
`apps/web/tests/support/analysis-fixture.ts` for the `sessions` row that
`analysis_runs.session_id` requires). No hand-written SQL, no mocked repository.

| # | test | proves |
| --- | --- | --- |
| 1 | all eight HUD keys map, `WON_AT_SHOWDOWN` → `WSD` | mapping table 1, in order |
| 2 | `valueBps` compared against the value the DATABASE stored, per reading, plus three spelled-out numbers (2850 / 925 / 5400) | assignment, not conversion — a rounding step on either side of the boundary fails here |
| 3 | **`handSample = 40000` → `sampleN === 1000`** and every note contains `40000`, `1000` and `제한` | **the clamp**, which `adaptive-core` deliberately never applies |
| 4 | `handSample === 1000` exactly → used whole, note `null` | the cap does not claim to have bitten when it did not |
| 5 | `handSample === null` → `sampleN 0`, note `'HUD 표본 수 미입력'`, and downstream `confidenceBps 0` / `deviationBps 0` with the reading still `available` | no invented sample; zero weight is the consequence |
| 6 | only entered readings become observations | no back-fill |
| 7 | latest HUD snapshot wins, provenance follows | `latestHudSnapshotForPlayer` semantics |
| 8 | 22-row learned fixture: exactly 17 observations in `MODEL_STAT_KEYS` order; `RFI`, `FOUR_BET`, `TURN_BARREL`, `RIVER_BARREL` produce nothing | mapping table 2 + the four documented non-mappings |
| 9 | **`FOLD_TO_STEAL` has `null` row 30/100 and `'BB'` row 34/40; `FOLD_BB_TO_STEAL` carries 8500 bps over n=40, and explicitly `not.toBe(3000)` / `not.toBe(100)`** | **the BB-row read** — a silent alias back to the aggregate fails two assertions |
| 10 | `STEAL` carries `'RFI from CO/BTN/SB'`; rounding pinned at 6444 (58/90) and 3333 (1/3) | scope note verbatim; bps rounding |
| 11 | `opportunities === 0` → no observation, and downstream `available: false`, `sampleN 0` | never 0% for "never had the chance" |
| 12 | `FOLD_TO_STEAL` with ONLY a `null` row → no `FOLD_BB_TO_STEAL` at all | the aggregate is never promoted |
| 13 | latest snapshot version wins | `getLatestSnapshot` semantics |
| 14 | both sources for `VPIP` → TWO observations, same key, different `source`, both provenance pointers set | not merged here |
| 15 | end-to-end `buildAdjustmentProfile`: `sources` is exactly `[MANUAL_HUD 2850/400, LEARNED_MODEL 2900/300]`, pooled `sampleN 700`, `observedBps` equals the sample-weighted mean | both source refs retained through composition |
| 16 | no HUD + no snapshot → `observations: []`, `ok: true`, and a profile of 17 unavailable stats with zero deviation | the identity element |
| 17 | unknown player id → `ok: true`, no observations | absence is not an error |
| 18 | lineup read: order preserved, empty lineup ok, malformed lineups (empty id, seat 9, duplicate player, 7 seats) rejected | untrusted-input handling |

Plus a §6/J10.7+J10.8 isolation test: writing a HUD leaves the learned observation
byte-identical and the learned provenance unchanged, and writing a new model snapshot leaves
the manual observation byte-identical.

---

## 9. Verification

| command | result |
| --- | --- |
| `pnpm vitest run --project web` | **28 files passed, 1 skipped; 415 tests passed, 3 skipped** (18 of them new). No pre-existing red. |
| `npx tsc --noEmit -p apps/web` | exit 0 |
| `pnpm lint` | clean |
| `npx prettier --write` on the two new `.ts` files | applied |

`contract.ts` reports one pre-existing prettier warning (`SaveHudSnapshotAction`, from
another agent's uncommitted WP-D work); it is NOT mine and was left untouched, per the
"format only the files you edited" rule.

`pnpm build` was not run (not in the required gate, and `next.config.ts` is shared with WP J-E).

---

## 10. Deviations

1. **`learnedSnapshotId` needs a second read** (`listSnapshotVersions`), because
   `PlayerModelSnapshot` carries no row id. See §5. A `getLatestSnapshotId` in `packages/db`
   would remove it, but `packages/db` is outside my boundary.
2. **`apps/web/package.json` gained `@gto-self/adaptive-core`.** It was not a dependency yet;
   without it the package does not resolve at runtime or in `next build`. Vitest and
   `tsconfig.base.json` already aliased it, so only the runtime link was missing.
3. **`contract.ts` type-only-imports two unions** instead of widening them to `string`. See §6.
4. **Both single- and plural loaders return a Result**, not a bare `AdaptiveOpponentInput`.
   The brief allowed either; a DB read failure must be distinguishable from "this player has
   no data", or a failure silently reads as "adapt against nothing".

---

## 11. Remaining risk / notes for the orchestrator

- **The manual HUD covers 8 of the 17 stats.** The other 9 have no manual source and never
  will until `player_hud_snapshot_stats.stat_key`'s CHECK is widened, which ADR-0046 rules
  out (SQLite cannot ALTER a CHECK; it needs a 12-step rebuild of an insert-only table).
  Recorded here as a limitation with its path forward, per §2.3 of the design contract.
- **`MANUAL_HUD_MAX_EFFECTIVE_N` is applied only here.** If any other call site ever builds an
  `AdaptiveOpponentInput` (a backfill script, an adaptive-trace generator), it must apply the
  cap too — `adaptive-core` deliberately will not do it for them. Worth a note wherever WP J's
  trace generation lands.
- **`next.config.ts` `transpilePackages` does not list `@gto-self/adaptive-core`** (nor
  `strategy-core` / `analysis-core`, which are already used and build fine), so I left it
  alone. If `pnpm build` ever fails resolving adaptive-core, that list is the first place to
  look — but the existing precedent says it will not.
- WP J-E owns `adaptiveStore.ts` and the `StrategyPanel`; the action it should take as a prop
  is `loadAdaptiveInputsAction`, typed by `LoadAdaptiveInputsAction` in `contract.ts`.
