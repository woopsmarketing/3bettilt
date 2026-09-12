# WP-J (ADAPTIVE / Strategy C2) — independent review R1

**Date:** 2026-09-02 · **Reviewer:** fresh-context, did not write this code · **Verdict:** no BLOCKER;
4 MAJOR, 6 MINOR, 5 NIT.

Scope reviewed: `packages/adaptive-core/**`, `packages/strategy-core/src/postflop/{sizing,index}.ts`,
`packages/db` (schema, rows, repository, `drizzle/0007*`, tripwire tests),
`apps/web/src/server/{adaptive-service,adaptive-trace-service,actions/adaptive,actions/hand-history}.ts`,
`apps/web/src/lib/table/{strategy,adaptive,adaptiveStore,copy,contract}.ts`,
`apps/web/src/components/table/{StrategyPanel,PlayerProfilePanel,TableRoot}.tsx`,
`apps/web/scripts/backfill-adaptive-traces.ts`, `eslint.config.js`, `docs/DECISIONS.md`
ADR-0063..0066.

**Working tree:** every probe file and every mutation I applied has been reverted. The eight files I
mutated were restored from byte-for-byte backups and `diff` reports no difference; `pnpm vitest run
--project adaptive-core` is back at **88 passed**, the count it had when I started. The only file
this review added is this report.

> Concurrency note: another session was writing to the same worktree while I reviewed.
> `apps/web/tests/e2e/adaptive-strategy.spec.ts`, `apps/web/tests/e2e/helpers.ts` and
> `docs/reports/HARDENING_WP_J_F_E2E.md` appeared or changed mid-review. I did not touch, reset or
> stash any of them (CLAUDE.md agent rule 6). The E2E spec is included in this review as it stood
> when I read it.

**Baseline test runs on the tree as found (all green, exit 0):**

| suite | result |
|---|---|
| `--project adaptive-core --project strategy-core --project db` | 48 files / 1020 tests passed |
| `--project web` | 31 passed, 1 skipped / 462 passed, 3 skipped |

---

## What is genuinely good

These are load-bearing and I checked them rather than took them on trust.

- **The behaviour-preserving extraction is real.** `git diff
  packages/strategy-core/src/postflop/sizing.ts` is a pure move: the same `Money.isPositive(call)`
  branch, the same operand order inside `Money.add` / `Money.mulRatio`, the same `'round'` mode, and
  `sizingRequestFor` now passes `context.potBeforeDecisionMbb` / `context.callAmountMbb` /
  `heroStreetContributionMbb` into the extracted function. No other line of the file changed.
  `strategy-core`'s 1020-test suite passes unchanged.
- **The core invariant holds structurally, not by convention.** `computeStrategy`'s signature is
  untouched; `adaptive-core` cannot import `poker-core` (ESLint + `tests/layering.test.ts`);
  `composeAdaptive` never mutates the baseline it is handed (`baselineFrequencies`, `working`,
  `quantized` are all fresh arrays); `StrategyPanel`'s REFERENCE `useEffect` deps are
  `[hand, heroSeat, compute]` with no opponent data, and the ADAPTIVE `useMemo` deps are
  `[computed, opponentInputs, adaptiveVersion]` with no `hand`. `StrategyPanel.test.tsx:815` proves
  it behaviourally by counting calls on an injected `compute` across a mid-hand HUD save.
- **Migration 0007 is honestly additive and honestly tested.** `packages/db/tests/migrations.test.ts`
  seeds a database at 0006 with a session, hand, lineup, event and a REFERENCE trace, applies 0007,
  and then asserts on the *upgraded file* that nothing moved, that `integrity_check` /
  `foreign_key_check` are clean, that `strategy_decision_traces` still rejects
  `strategy_mode = 'ADAPTIVE'`, and that the new table's FK, UNIQUE index, CHECKs and both
  insert-only triggers are live. `packages/db/tests/adaptive-traces.test.ts:300` additionally
  rejects a raw UPDATE and DELETE and confirms the row survives both.
- **Data separation between manual HUD and learned model is real.**
  `apps/web/src/server/adaptive-service.test.ts:584` writes a model, then a HUD, then a model again
  against a real database and asserts each source's observation is byte-identical across the other's
  write. In `adaptive-core`, the two are pooled only inside `estimateFor` and both survive in
  `AdaptiveStatEstimate.sources`.
- **Money arithmetic is clean.** No float money is introduced anywhere new. `potFractionToAmount` is
  the single rounding point for the adapted size and it is `strategy-core`'s own. `profile.ts`'s
  `roundDivNonNegative` is exact integer round-half-up with a documented and correct overflow
  head-room (`2 * BPS_TOTAL * ADAPTIVE_MAX_SAMPLE_N` ≈ 2e12, three orders inside
  `MAX_SAFE_INTEGER`). `apportion` guarantees the sum and `quantizeFrequencies` the 500-grid; both
  are imported, not copied. I looked specifically for double rounding, sign errors and division by
  zero in the shrinkage, contribution, cap-scaling, requantization and bucket→amount paths and found
  none.
- **No invented GTO.** `provenance` is `'HEURISTIC'` at the type level on `AdaptiveRecommendation`;
  every prior, K, gain and cap is `heuristic(...)`-wrapped or carries a mandatory `note`;
  `invariants.test.ts` asserts every rule note is >120 chars and contains neither "GTO" nor "solver";
  the component test and the E2E both assert the rendered panel never contains the string "GTO".
- **The rule tables and the `INSUFFICIENT_DATA` path are honest.** `status` is separated from
  `changedFromBaseline`, the panel badges the latter, and `compose.test.ts` pins four distinct cases
  where a rule fires and the output does not move.
- **The structural sweep in `policy/invariants.test.ts` is a real property test** — ~4,600 enumerated
  compositions checking grid, sum, kind-subset, amount-echo, sizing legality, ±1 rung, cap, and
  reported-vs-measured shift, with explicit anti-vacuity assertions at the end.
- **Mutation testing confirms most tests bite.** I broke four things and every one was caught:
  removing the shrinkage (`estimateBps = observedBps`) → 14 failures; changing the
  `FOLD_TO_CBET_FLOP` prior 4500→4000 → 11 failures; making the §9 guard also zero *negative*
  aggression → 1 failure; removing the per-rule ceiling (`capped = scaled`) → 3 failures.

---

# Findings

## MAJOR 1 — The §9 guard rail never fires heads-up, which is the case it was written for

**Where:** `packages/adaptive-core/src/multiway.ts:92-98` (`classifyOpponents` makes PRIMARY and
BEHIND mutually exclusive) and `packages/adaptive-core/src/multiway.ts:200`
(`findAggressivePlayerBehind` skips every role that is not `BEHIND`).

**What is wrong.** When hero is not facing a bet, `primaryOpponentIdOf` selects *the first live
opponent still to act after hero* — so the PRIMARY villain **is** a player behind. Because
`classifyOpponents` assigns PRIMARY exclusively, that opponent is never `BEHIND`, and
`findAggressivePlayerBehind` therefore never looks at their check-raise stat. Heads-up there is no
other opponent, so **the guard rail is structurally unreachable in every heads-up spot.**

**Why it matters.** This is exactly the error ADR-0065(e) (`docs/DECISIONS.md:1703`) says the guard
exists to prevent, and the ADR's own wording is broader than the implementation:

> "…any positive AGGRESSION contribution is zeroed when **a live opponent still to act** has an
> above-prior check-raise or 3-bet at confidence"

The design contract §9 says `BEHIND` instead, so the implementation matches §9 and contradicts the
accepted ADR. Either way the substantive risk stands: the single most common spot at this table
(heads-up, hero first to act, one known check-raiser) is the one the guard cannot protect.

**Verified — throwaway probe, since reverted.** One opponent profile
(`FOLD_TO_CBET_FLOP 75% n=100`, `CHECK_RAISE_FLOP 30% n=100`, `WTSD 5% n=400`), `aggressionBand:
'WEAK'`, hero not facing a bet, baseline `CHECK 40 / BET 60`:

| lineup | roles | contributions | BET |
|---|---|---|---|
| heads-up (that opponent alone) | `[PRIMARY]` | `FOLD_TO_CBET_HIGH +612`, `CHECK_RAISE_HIGH −672`, `WTSD_LOW_BLUFF_UP +520` | **60% → 65%** |
| three-handed, identical stat on a third party | `[PRIMARY, BEHIND]` | `FOLD_TO_CBET_HIGH 0 (AGGRESSIVE_PLAYER_BEHIND)`, `CHECK_RAISE_HIGH −672`, `WTSD_LOW_BLUFF_UP 0 (AGGRESSIVE_PLAYER_BEHIND)` | **60% → 55%** |

The check-raise read is identical in both rows and clears the gate (confidence 7143 bps ≫ 2500). The
same read produces a **bluff increase** when it belongs to the primary and a **bluff decrease** when
it belongs to anyone else. `CHECK_RAISE_HIGH` partially offsets it (−672 against +1132 gross) but
does not reverse it. The sizing pass did size down one rung heads-up, so the mitigation is partial,
not absent.

**Note on test coverage:** `compose.test.ts:378` ("a known aggressor behind refuses escalation…")
only ever exercises the two-opponent shape, and `invariants.test.ts`'s matrix always supplies both a
`primary` and a `lurker`, so the heads-up hole is invisible to the suite.

---

## MAJOR 2 — The global-cap enforcement step `trimToCap` has zero test coverage, and it is live code

**Where:** `packages/adaptive-core/src/policy/frequency.ts:394-421` (`trimToCap`), called at
`frequency.ts:524`.

**What is wrong.** `trimToCap` is the *only* thing that keeps `totalShiftBps` inside
`MAX_TOTAL_SHIFT_BPS_*` after `quantizeFrequencies` has rounded the projected mix onto the 500-bps
grid. Nothing in the repository exercises it.

**Verified, three ways (all reverted).**

1. **Mutation.** Making `trimToCap` an immediate `return false` leaves **all 88 adaptive-core tests
   green**, including the ~4,600-case `invariants.test.ts` sweep whose invariant 5 is the cap.
2. **Instrumentation.** Adding a counter that increments whenever `trimToCap` is entered with
   `shift > cap` and running the entire adaptive-core suite gives `TRIM_FIRED_TOTAL = 0`. The trim
   has never had anything to trim in any committed test.
3. **Reachability.** A brute-force sweep of 99,792 compositions (every 500-bps 3- and 4-row baseline
   × 3 lineup sizes × facing/not × 3 bands × 8 profile shapes) enters the trim with `shift > cap`
   **408 times**. With the trim disabled, 408 of those cases report a `totalShiftBps` above the cap —
   the first one being `base [0, 8000, 1500, 500] → out [0, 9500, 500, 0]`, **measured shift 1500
   against a multiway cap of 1000** (50% over).

**Why it matters.** `MAX_TOTAL_SHIFT_BPS_HEADS_UP`'s own doc calls itself "the most important number
in the package… the promise that ADAPTIVE is a correction to REFERENCE and not a replacement for
it", and `AdaptiveRecommendation.totalShiftBps` is documented as "Never above the cap". The code that
delivers that promise can be deleted without a single test noticing. This is not a bug today — the
trim works — it is an untested guarantee, which is what CLAUDE.md's verification section is about.

---

## MAJOR 3 — A manual HUD's *hand* count is used as the *opportunity* denominator, and the stated mitigation does not mitigate

**Where:** `apps/web/src/server/adaptive-service.ts:210-235`, in particular
`adaptive-service.ts:212` (`sampleN = min(handSample, MANUAL_HUD_MAX_EFFECTIVE_N)`) and
`adaptive-service.ts:213-218` (the note).

**What is wrong.** One snapshot-wide hand count is assigned as `sampleN` to *every* HUD reading in
the snapshot. Of the eight `HudStatKey` members, only `VPIP` and `PFR` genuinely have a
hands-played denominator. `CBET_FLOP`, `FOLD_TO_CBET_FLOP`, `THREE_BET`, `FOLD_TO_THREE_BET`, `WTSD`
and `WON_AT_SHOWDOWN` all have denominators that are a fraction of hands played — often a small one.
The design contract §2.3 and `inputs.ts`'s `MANUAL_HUD_MAX_EFFECTIVE_N` doc both name this problem
and present the cap of 1000 as the answer. It is not, because 1000 is 25× the largest `K` in the
table.

**Verified — measured `confidenceWeightBps(min(n, 1000), K = 40)`, the `CBET_FLOP` / `FOLD_TO_CBET_FLOP` K:**

| HUD hands typed | effective n | confidence |
|---|---|---|
| 50 | 50 | 5,556 bps |
| 100 | 100 | 7,143 bps |
| 200 | 200 | 8,333 bps |
| 500 | 500 | 9,259 bps |
| 1,000 | 1,000 | 9,615 bps |
| 40,000 | 1,000 | 9,615 bps |

Concretely: a user who types a "fold to flop c-bet" percentage with a **40-hand** sample clears the
heads-up *sizing* gate exactly (`confidenceWeightBps(40, 40) = 5000 ≥ SIZING_MIN_CONFIDENCE_BPS_HEADS_UP`)
and moves the recommended bet size a full rung. At 500 hands the reading carries 93% weight on a
denominator that in reality is perhaps 80–120 flop c-bets faced. `inputs.ts`'s own doc concedes the
point ("the cap is not trying to make a large HUD sample look small") — but the design's justification
for the cap is the street-scope overstatement, and the chosen value does not address it.

**Second, separable defect in the same code.** Design contract §2.3 requires the cap to be "tagged
HEURISTIC with a **mandatory note**". The implementation attaches a note only when the cap actually
bites (`handSample > 1000`) or when the sample is missing. For every HUD entry of 1,000 hands or
fewer — the common case — `note` is `null`, so the panel renders `n=500, 신뢰도 93%` for a
street-scoped stat with **no caveat at all** that 500 is a hand count and not an opportunity count.
Every other scope caveat in this file (`STEAL_SCOPE_NOTE`, `FOLD_BB_TO_STEAL_SCOPE_NOTE`) is carried
verbatim; this one is not.

---

## MAJOR 4 — Editing one HUD field silently drops the other seven from the effective profile

**Where:** `apps/web/src/components/table/PlayerProfilePanel.tsx:85` (`hudText` starts `{}`),
`:244` (`value={hudText[key] ?? ''}` — the form never pre-fills from `profile.hud.stats`), `:126-128`
(only non-blank fields are submitted), `:135` (reset to `{}` after save).

**What is wrong.** `EDITABLE_HUD_KEYS` was grown from 4 to all 8 keys for WP-J (design contract §8),
but the form is always blank on open. A user who wants to correct just `VPIP` types one number and
saves; `saveHudSnapshot` builds a snapshot containing **only** `VPIP` and appends it.
`latestHudSnapshotForPlayer` then returns that snapshot, `manualHudObservations` iterates
`HUD_STAT_KEYS` and `continue`s on the seven now-absent readings, and the panel's "최근 HUD" list
shows one row. Every other manual reading the user entered has vanished from both the display and
the ADAPTIVE model.

**Why it matters.** The rows are still in the database (`player_hud_snapshots` is insert-only, so
CLAUDE.md rule 3 is not violated *at rest*), but there is no path in the UI back to them and no
warning. Growing the form from 4 fields to 8 doubles the amount a single careless edit destroys from
the user's point of view, and the four newly-editable keys (`CBET_FLOP`, `FOLD_TO_CBET_FLOP`,
`WTSD`, `WON_AT_SHOWDOWN`) are precisely the ones the ADAPTIVE rule table is keyed on.

**Verified by reading:** `createHudSnapshot` (`packages/player-core/src/hud.ts:130`) rejects an empty
`stats` array, so the all-blank save errors safely — but a one-field save succeeds and is exactly the
destructive case. `latestHudSnapshotForPlayer` returns a single snapshot, never a merge across
snapshots. I did not find any pre-fill or merge logic anywhere.

---

## MINOR 5 — `THREE_BET`, a preflop-scoped stat, is read as a postflop guard signal

**Where:** `packages/adaptive-core/src/multiway.ts:143-152` (`guardStatsFor` returns
`[CHECK_RAISE_{street}, 'THREE_BET']` on every postflop street).

The `THREE_BET` observation is produced from `ModelStatKey.THREE_BET`, which `analysis-core` scopes
to a preflop re-raise, and from the manual HUD's preflop `3BET` box. Using it as a proxy for "this
player will raise my postflop bet" applies a stat outside the spot it was measured in — the exact
thing `adaptive-service.ts`'s own header (property 2) and the `FOLD_TO_STEAL` handling forbid, and
which `LEARNED_MODEL_STAT_MAP` explicitly declines to do for `TURN_BARREL` / `RIVER_BARREL`. The
file's comment argues willingness to re-raise is not preflop-only, which is a reasonable poker
opinion, but it is an authored cross-street inference stated nowhere in the design contract or an
ADR. Mitigating: the guard can only ever *refuse* an adjustment, so the direction is safe.

---

## MINOR 6 — The stored trace cannot answer "why did this adjustment not move anything"

**Where:** `packages/db/src/rows.ts:1670` (`AdaptiveTraceAdjustment`),
`apps/web/src/server/adaptive-trace-service.ts:153-170` (`adjustmentsOf`), in particular
`adaptive-trace-service.ts:165`.

`AdaptiveAdjustment` carries `cappedBy`, `deviationBps`, `rawContributionBps`, `sizingSteps`,
`ruleKind`, `confidenceState`, and `sources: AdaptiveStatSourceRef[]` (`{source, valueBps, sampleN,
note}`). The stored row keeps none of the first six and narrows `sources` to bare source **names**.
Consequences:

- A stored row with `contributionBps: 0` is indistinguishable between "the §9 guard refused it",
  "the ladder ran out", and "the global cap scaled it away". `capApplied` is stored, but it is a
  whole-composition flag, not per-rule.
- The per-source scope caveats — `'BB 포지션 행에서 읽음'`, `'RFI from CO/BTN/SB'`, the HUD cap note —
  are dropped from the trace even though `AdaptiveStatObservation.note` is documented as the thing
  "the UI must be able to show verbatim".
- `schema.ts`'s own comment describes `adjustments_json` as "every rule that fired, with its stat,
  sample size, confidence, **sources** and reason — CLAUDE.md rule 3: the evidence is stored, not
  just the conclusion". The evidence is partly not stored.

The stated reason (`adaptive-trace-service.ts:150`) — that `@gto-self/db` may not import the
composition layer — does not hold: `AdaptiveTraceAdjustment` is already a structural type of plain
strings and numbers, and `{source, valueBps, sampleN, note}` needs no import either. Since the table
is insert-only, this is not recoverable after the fact.

---

## MINOR 7 — A documented sign-safety property in the cap scaler is untested

**Where:** `packages/adaptive-core/src/policy/frequency.ts:130` (`scaleDownSigned`).

The comment states the reason for `Math.trunc` over `Math.floor`: "`Math.floor` on a negative number
moves AWAY from zero, which would make the global cap **increase** a de-escalating contribution."
**Verified:** changing `Math.trunc` to `Math.floor` leaves all 88 adaptive-core tests green. The
global-cap tests in `compose.test.ts:329` only ever scale two *positive* contributions, so the signed
branch is never exercised. The behavioural difference is at most 1 bps per rule and the trim still
enforces the cap, so the risk is small — but the property the comment names has no test.

---

## MINOR 8 — The "second, independent guard" is not independent for the new package

**Where:** `packages/strategy-core/tests/layering.test.ts:36`.

`FORBIDDEN` is `['@gto-self/player-core', '@gto-self/analysis-core', '@gto-self/db']`.
`@gto-self/adaptive-core` is absent, so a `strategy-core` source file could add
`import type { … } from '@gto-self/adaptive-core'` and this test would pass. Only ESLint's new
`NO_ADAPTIVE_CORE` rule catches it — and both layering tests exist explicitly because "this is
deliberately a SECOND, independent guard that … does not depend on the lint config staying correct."
`adaptive-core` re-exports `player-core` types through its barrel
(`SnapshotConfidenceState` on `AdaptiveAdjustment`), so this is a live path back into player data,
not a theoretical one. `gto-core` has the same gap.

Beyond that, both layering tests are well built: they scan source **as text** so a type-only import
is caught, they assert the file list is non-empty so the sweep cannot pass vacuously, they test the
specifier regex itself against six import forms, and `adaptive-core`'s adds a positive assertion that
it still imports the two packages it exists to compose. I could not defeat either one short of a
computed dynamic `import()`, which is outside any static scanner's reach and equally outside ESLint's.

---

## MINOR 9 — Backfilled traces are computed from today's evidence, including a model trained on the hand being traced

**Where:** `apps/web/src/server/adaptive-trace-service.ts:302` (`loadAdaptiveOpponentInputs` is
called once per hand, unconditionally reading the *latest* HUD and model snapshots) and
`apps/web/scripts/backfill-adaptive-traces.ts:65`.

`getLatestSnapshot` returns the current learned model, which C1's post-session learning built from
**all** recorded hands — including the hand now being replayed. A `source: 'BACKFILL'` row therefore
records an ADAPTIVE recommendation derived in part from the outcome of the very decision it is
about. That is lookahead bias in a review artefact. The file header's claim that a row is "the
honest record of what was known at the time" (`adaptive-trace-service.ts:37`) is accurate for the
LIVE path and not for the BACKFILL path. The `source` column distinguishes them, so a careful reader
can tell — but nothing says so, and no ADR records it.

---

## MINOR 10 — `trimToCap`'s termination argument depends on an input property the package declines to assert

**Where:** `packages/adaptive-core/src/policy/frequency.ts:394-421`.

Each iteration moves 500 bps from the most-increased row to the most-decreased row and is documented
as reducing the shift by exactly 500. That holds only when `baselineFrequencies` are multiples of
500 — if a row's delta is, say, +300, the move overshoots and the shift can *increase*.
`baseline.ts:140-153` deliberately declines to assert the grid on the input ("it does not assert them
on the input, because a caller that hands over a malformed set should get a normalized answer rather
than an exception"). The loop is bounded by `GRID_UNIT_COUNT`, so there is no hang; the failure mode
is a silent `capApplied: true` with `totalShiftBps` still above the cap, contradicting
`AdaptiveRecommendation.totalShiftBps`'s "Never above the cap". REFERENCE always emits a grid mix, so
I could not trigger this; flagging it as a documented-invariant mismatch, not an observed bug.

---

## NIT 11 — A de-escalation renders in the "good" colour

`apps/web/src/components/table/StrategyPanel.tsx:653`:
`action.deltaBps === 0 ? 'text-ink-700' : 'text-good-500'`. A `−10%` delta is painted the same green
as a `+10%`. Not wrong, but the colour asserts a valence the number does not have.

## NIT 12 — `adaptive-core`'s layering test scans only `src/`

`packages/adaptive-core/tests/layering.test.ts:83` walks `join(root, 'src')`. `tsconfig.json`
compiles `src/**/*.ts`, `tests/**/*.ts` and root-level `*.ts`, so a forbidden import in a test file or
a root-level file is invisible to the guard. ESLint's `packages/adaptive-core/**/*.ts` glob does
cover them.

## NIT 13 — The forbidden-package matcher misses sibling packages

`references(specifier, pkg)` matches `pkg` and `pkg/…` only, so `react-dom` is not caught by the
`react` ban in `packages/adaptive-core/tests/layering.test.ts:44`. The test even pins
`references('next-safe-action', 'next') === false` as intended behaviour, so the narrowness is
deliberate — but `react-dom` is a real package that would slip through. `@gto-self/coinpoker-parser`
and `solver-lab` are also absent from `FORBIDDEN` (ESLint bans the latter).

## NIT 14 — `opponent_count` uses `countRange`

`packages/db/src/schema.ts` gives `adaptive_strategy_traces.opponent_count` a CHECK of
`0 <= n <= 100000000` for a value that can never exceed 5. Harmless, but a `seatRange`-style bound
would make a corrupt row detectable at the storage layer rather than only in the decoder.

## NIT 15 — A money value defaults to zero on an unreachable branch

`apps/web/src/lib/table/strategy.ts`, `adaptiveFactsOf`:
`heroStreetContributionMbb: hero === null ? Money.mbb(0) : hero.streetContributionMbb`. If hero's
seat profile were ever missing, the adapted raise-TO would omit hero's street contribution and
understate the size. `buildStrategyQuery` refuses to produce a query without a dealt-in hero and the
comment says so; `clampPostflopSizing` would clamp the result into the legal window anyway. Noting it
because it is the one place in the new code where a money value is defaulted rather than refused.

---

## Things I checked and did **not** find

- No path by which player data reaches a REFERENCE number: no type-only import, no shared mutable
  object, no cache, no parameter widening. `AdaptiveRecommendation.baseline` is echoed by reference
  and never mutated; `compose.test.ts:71` asserts two compositions over the same baseline with
  different opponents produce deep-equal *and* `JSON.stringify`-equal baselines.
- No frequency set that leaves the 500 grid or fails to sum to 10000. Confirmed over the committed
  ~4,600-case sweep and over my own 99,792-case brute force.
- No action kind or amount invented for a row the baseline lacked (structural: the working vector is
  indexed by the baseline's rows and never appended to).
- No mutation path to a completed hand, an existing trace, or a HUD snapshot. The triggers are
  exhaustively listed in `insert-only.test.ts` and exercised on an upgraded database in
  `migrations.test.ts`.
- No integer overflow, division by zero, or double rounding in the shrinkage, contribution, cap,
  requantization or sizing paths.
- No use of the word "GTO" in any ADAPTIVE copy, and no fabricated adaptive number in the
  `INSUFFICIENT_DATA` or `null` panel states (asserted in both the component test and the E2E).
- Failure to load opponent data degrades quietly and correctly: `TableRoot`'s loader replaces the
  store with `[]` on both a rejected promise and an `ok: false` result, uses a monotonic request
  token against out-of-order responses, and the panel reports `INSUFFICIENT_DATA` while REFERENCE
  keeps working.
- No tautological or self-referential assertion in `adaptive-core`'s tests — every expected value in
  `compose.test.ts` and `profile.test.ts` is a hand-computed literal. `apps/web`'s panel tests do
  call `computeAdaptive` to build their expectation, but they assert *rendering* against it (the
  arithmetic is pinned one layer down) and each guards against vacuity by first asserting the
  premise (`expect(expected.status).toBe('ADAPTED')`).

---

## Suggested triage order

1. MAJOR 1 — decide whether §9 or ADR-0065(e) is authoritative, then make the code and the two
   documents agree. If ADR-0065(e) stands, `findAggressivePlayerBehind` needs to consider the PRIMARY
   when `heroFacingBet === false`, and `compose.test.ts` needs a heads-up case.
2. MAJOR 4 — pre-fill the HUD form from `profile.hud.stats`, or merge unspecified keys forward from
   the previous snapshot. This is the finding a user hits first.
3. MAJOR 2 — add a `trimToCap` test. The brute-force case above (`base [0, 8000, 1500, 500]`,
   multiway, MODERATE, WEAK-profile primary) reproduces it directly.
4. MAJOR 3 — at minimum, attach the scope note unconditionally to every street-scoped manual HUD
   observation; separately, reconsider whether `MANUAL_HUD_MAX_EFFECTIVE_N` should be per-stat.
5. MINOR 6 — `cappedBy` at least should reach `adjustments_json` before rows accumulate, because the
   table is insert-only.
6. MINOR 8 — one-line addition to two `FORBIDDEN` arrays.
