# Decisions

Append-only. Each entry: context, decision, consequences. Never edit a decision in
place — supersede it with a new one.

---

## ADR-0001 — milliBB integer fixed point for all money

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Context.** Pot/stack/rake arithmetic in floating point drifts (`0.07 + 0.09 !== 0.16`),
and drift in a training tool silently corrupts every downstream stack and every
strategy lookup.

**Decision.** One internal unit: milliBB, an integer, `1 BB = 1000 milliBB`. Defined
once in `packages/shared/src/money.ts` as a branded `MilliBB` type. Every lossy
operation (`mulRatio`, `mulFraction`, `fromBB`) takes an explicit `RoundingMode`.
Floats appear only at the parse/format boundary and for non-money ratios.

**Consequences.** Slightly more verbose arithmetic. In exchange, a 1000-iteration ante
accumulation is exact, and rounding policy is reviewable at every call site. Range is
capped at ±1,000,000 BB so all intermediate products stay exact in a double.

---

## ADR-0002 — Money and card primitives live in `shared`, not `poker-core`

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Context.** The original plan placed fixed-point money inside the poker engine, but
`gto-core` (sizing buckets), `player-core` and `db` all need money and cards without
depending on the poker engine.

**Decision.** `@gto-self/shared` owns `MilliBB`, `Card`, branded ids and `Result`.
`poker-core` builds the poker domain on top and may re-export for convenience.

**Consequences.** Keeps the dependency graph a DAG with a single money implementation.
`shared` must stay dependency-light and rule-free — no poker rules there, ever.

---

## ADR-0003 — Packages are consumed as TypeScript source

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Context.** Per-package `tsc` builds add a watch/ordering problem for a solo-developer
repo that never publishes to npm.

**Decision.** Each package's `exports` points at `./src/index.ts`. Next compiles them
via `transpilePackages`; Vitest resolves them via regex aliases in the root
`vitest.config.ts`. `pnpm typecheck` runs `tsc --noEmit` per package.

**Consequences.** No build ordering, honest stack traces, instant cross-package
refactors. If a package is ever published, it needs a real build step added then.

---

## ADR-0004 — Single root Vitest config with projects

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Decision.** One `vitest.config.ts` defines a project per package plus `web`
(happy-dom). `pnpm test` runs everything; `pnpm vitest run --project <name>` runs one.

**Consequences.** Alias configuration exists in exactly one place. Adding a package
means adding it to `WORKSPACE_PACKAGES` and the `projects` list.

---

## ADR-0005 — TypeScript 5.9 with `noUncheckedIndexedAccess`

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Context.** TypeScript 7 (native port) is available but the surrounding ecosystem
(ESLint, Next, Drizzle typings) is not uniformly verified against it yet.

**Decision.** Pin TypeScript 5.9.3. Enable `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals/Parameters`,
`verbatimModuleSyntax`. `exactOptionalPropertyTypes` stays **off** — it fights React
props and Drizzle inference for little gain here.

**Consequences.** Seat/board array access must be null-checked, which is exactly where
poker bugs hide. Revisit TS 7 once the toolchain has caught up.

---

## ADR-0006 — ESLint enforces the layering rules

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Decision.** `no-restricted-imports` forbids `react`, `next` and `@gto-self/db`
inside `poker-core` and `gto-core`. Purity is a lint failure, not a code-review
convention.

---

## ADR-0007 — Ids are injected, never generated inline

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Context.** Event-sourced replay must be reproducible byte-for-byte in tests.

**Decision.** Domain code that needs an id accepts an `IdFactory`
(`shared/src/ids.ts`). Production uses `cryptoIdFactory`; tests use
`sequentialIdFactory`. Calling `crypto.randomUUID()` inside domain code is a bug.

---

## ADR-0008 — Card is a branded integer 0..51

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Decision.** `index = rankIndex * 4 + suitIndex`, ranks ascending `2..A`, suits
`s,h,d,c`. Strings are a boundary format only (`parseCard`, `cardToString`).

**Consequences.** Dead-card sets, deck checks and serialized events stay compact and
comparable. UI renders the palette from `RANKS_DESC` x `SUITS`.

---

## ADR-0009 — Rake floors; sizing rounds

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted (rake behaviour is an
**assumption**, see below)

**Decision.** Rake is computed with `Money.mulRatio(pot, 5, 100, 'floor')` and then
capped. Bet-sizing targets derived from a solver fraction use `'round'`.

**Assumption to verify against real hand histories in Phase 11:** CoinPoker's exact
rake rounding and whether the cap applies pre- or post-splash-fee. Until a fixture
confirms it, rake configuration is exposed as data (`percent`, `capBB`, rounding mode)
and the settlement result records the rake actually applied, so a corrected rule
changes configuration, not code.

---

## ADR-0010 — Phase 0 implements `shared` fully, rather than stubbing it

**Date:** 2026-08-28 · **Phase:** 0 · **Status:** accepted

**Context.** Money semantics are the one contract every later phase agent depends on.
Leaving it to a phase agent risks each package re-deriving rounding rules.

**Decision.** The orchestrator implemented and tested `@gto-self/shared` during
bootstrap. Phase agents extend it only with explicit justification.

---

## ADR-0011 — Continue our own `poker-core`; `poker-engine-ts` is REFERENCE only

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted

**Context.** `docs/OPEN_SOURCE_EVALUATION.md` evaluated five projects. `Ge-limin/poker-engine-ts`
(MIT, verified from its LICENSE file) is the only serious build-vs-buy candidate for the
state engine: 12,709 non-test lines, 192 passing tests, genuine multiway side pots, and a
correct short-all-in-does-not-reopen rule.

**Decision.** Continue `@gto-self/poker-core`. Use `poker-engine-ts` as a read-only
reference and differential test oracle. Do not adopt it as a dependency and do not wrap it.

**Why.** It solves a different problem: a server-authoritative, async, card-dealing backend
for *running* live games. We are building a synchronous, manual-entry engine for a table we
do not control. Four of our hard requirements — sitting out, auto top-up, the dirty-stack /
observe resync flow, and a configurable CoinPoker rake — are absent, and they must live
*inside* the state machine, so no wrapper buys them. Its `stackBefore` invariant is directly
hostile to Phase 8. Its money type is a bare `type Chips = number` with runtime-only integer
checking, which would degrade our compile-time `MilliBB` guarantee (ADR-0001) at the
dependency boundary. Its complete replay path is private and async, conflicting with the
"pure and synchronous" rule.

**This recommendation is falsifiable.** Revisit if: (a) a differential run shows our
side-pot or min-raise logic is wrong where theirs is right; (b) it grows sit-out, top-up,
dirty-stack and configurable rake *and* exports a synchronous replay; (c) the `stackBefore`
invariant becomes opt-out; (d) Phase 2 overruns its estimate by a large multiple. Bus
factor, star count and release cadence are **not** on that list — under MIT they are
manageable by forking, and they are not the reason for this decision.

---

## ADR-0012 — Differential-oracle policy

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted

**Context.** Several evaluated engines are useful as independent checks on our arithmetic.
Whether their *output* may be committed as fixtures is an unsettled legal question
(`OPEN_SOURCE_EVALUATION.md` §7 marks it unverified).

**Decision.** We may run permissively licensed engines locally as oracles, in a scratch area
outside the repository. We do **not** commit their output as fixtures. What may be committed
is a test whose expected values **we derived ourselves**, annotated with the note that an
external oracle agreed. If the oracle disagrees with a hand-derived value, that is a finding
to investigate, not a value to copy.

**Consequences.** Sidesteps the licensing question entirely rather than relying on a reading
of it, and keeps the property that every expected value in our test suite is one a human
reasoned about. Slightly more work per fixture; that work is the point.

---

## ADR-0013 — `open_spiel` accepted as the Phase 13 validation tool, `solver-lab` only

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted, gated

**Context.** `GTO_BASELINE.md` requires any CFR implementation to be validated on Kuhn and
Leduc against known equilibria before it is trusted. The spike ran open_spiel's tabular CFR
and its **exact** exploitability computation on both, on this machine, with no build step:
Kuhn 9.4e-4 at 1k iterations in 0.34 s; Leduc 3.6e-2 at 300 iterations in 15.5 s.
Apache-2.0, verified from its LICENSE file.

**Decision.** Accepted in principle as the Phase 13 validation reference, confined to
`solver-lab`. It is a Python research tool used offline — it never enters the app's
dependency graph, and `apps/web` and `packages/*` must never reference it.

**Gated.** The dependency is only actually taken when Phase 13 starts, and the full
survey + fact-check pass that the other three projects received is a precondition then
(it received only a partial evaluation). Recorded now so the decision is not re-litigated.

---

## ADR-0014 — Phase 13's deliverable is a validated method, not a baseline

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted

**Context.** The spike measured the scale of the problem rather than estimating it.
open_spiel's own unabstracted 6-player no-limit game exposes **100,001 distinct actions**
with `max_game_length 542`. rs-poker's own source states CFR allocates ~17 GB per hand at
**three** players. Nothing evaluated solves 6-max NLHE, and nothing shortens the path there.

**Decision.** Phase 13 delivers: (1) our own CFR validated on Kuhn and Leduc against
published equilibria, and (2) a measured cost curve for progressively larger abstractions.
It does **not** attempt a 6-max NLHE baseline. Phase 14 remains blocked, and is now
understood to be not yet scopeable rather than merely pending.

**Two landmines recorded now, from the spike:**
- Kuhn poker has a *continuum* of equilibria parameterised by α ∈ (0, 1/3]. Asserting a
  point strategy value is therefore wrong; assert the algebraic invariant between infosets
  (`P(call Q at "12|pb") = α + 1/3`) instead.
- In `amaster97/poker_solver` the DCFR **docstrings** write the strategy-sum update with the
  opponent's reach π\_{-i} while the **code** correctly uses the acting player's own reach.
  Transcribing that published formula yields a silently wrong average strategy that still
  looks plausible. Read code, not comments.

---

## ADR-0015 — Licence hygiene posture

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted

**Verified licences** (each read from the actual LICENSE file in a clone, not from a badge):
`Ge-limin/poker-engine-ts` MIT · `elliottneilclark/rs-poker` Apache-2.0 ·
`amaster97/poker_solver` MIT · `google-deepmind/open_spiel` Apache-2.0 ·
`uoftcprg/pokerkit` MIT. All five may be read for ideas with no obligation.

**Named blocklist — never copy, vendor, or paste from these:**
- `b-inary/postflop-solver` — **AGPL-3.0**
- `bupticybee/TexasSolver` — **AGPL-3.0**
- `24parida/shark-2.0` — **unlicensed** (no grant at all; worse than AGPL for us)

AGPL §13 triggers source disclosure for network-accessible software even without
distributing binaries, which is incompatible with a possible closed-source product. These
three are named explicitly because they are what a future agent searching for "open source
poker solver" will find first.

**Decision.** Adopt the full hygiene model: this named blocklist; a gitignored
`references/` area for any read-only clone; a provenance header on any module whose design
followed an external source; and a standing repository-wide grep for copyleft strings
(`pnpm lint:licences`, wired into `pnpm verify`).

**Also forbidden regardless of licence** (CLAUDE.md rule 2): importing any unprovenanced
strategy chart as baseline data. Concretely named by the spike —
rs-poker's `examples/configs/preflop_6max_rfi.json` ("6Max-RFI-GTO", no cited source),
`poker_solver`'s 27 blueprint shards, and `poker-engine-ts`'s invented persona trait numbers.

---

## ADR-0016 — Phase 9 GTO schema inputs adopted from the evaluation

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted as Phase 9 input

**Context.** `amaster97/poker_solver` ships a real DCFR solver and a versioned blueprint
asset format. Two data-integrity defects in it map directly onto rules we already have.

**Adopted into the Phase 9 design:**
1. `action_tree_hash` on `gto_solution_sets` — makes "action-tree structure exact"
   (matching criterion 4) a single indexed comparison rather than a tree walk.
2. `board_signature` on `gto_spots`, stored **alongside** the actual board, never instead
   of it (CLAUDE.md rule 3).
3. `abstraction_tier`, `solver_version`, `schema_version`, `iterations` on
   `gto_solver_configs` — supports baseline immutability.
4. Frequencies stored as **integer ten-thousandths (0-10000)**, not float. Their float64
   probabilities carry ~17 significant digits of mantissa noise, which is why their assets
   only gzip 2.4×. Integers compress, exceed display need, and make rows byte-comparable
   in tests.
5. `effective_stack_mbb` (actual) alongside `stack_bucket_mbb` (normalized). Their
   `stack_bb INTEGER` cannot express 93.7 BB — exactly the actual-vs-normalized failure
   ADR/architecture forbids.
6. **An explicit `unreached` flag on every strategy row.** 4.9% of their shipped rows
   (1,540 of 31,434) are a uniform `1/n` fallback emitted when an infoset was never
   reached, and in the serialised asset that is *byte-indistinguishable from a genuine
   50/50 mixed strategy*. A UI would render "50% call" for `72o` facing a 4-bet as if it
   were solved output. Unreached must be **typed**, not inferred.
7. A manifest with per-shard sha256, verified on load, for any externally produced payload.

**Adopted with a refinement:** they recommend `exploitability REAL NOT NULL` — the column
their own assets left `null` on all 27 shards. A plain NOT NULL would force a fabricated
number for MOCK data, which violates CLAUDE.md rule 2. Instead: a non-nullable
`quality_kind` (`MEASURED` | `UNMEASURED`) plus a nullable `exploitability_mbb_per_100`,
with a CHECK constraint requiring the value when kind is `MEASURED` and a reason when it is
not. Same intent — a solution set can never silently omit how good it is — without ever
storing a lie.

**Rejected:** their `strategy_gz BLOB` whole-solve-in-one-blob layout. A blob cannot answer
"show every spot where BTN opens ≥60%" without decompressing everything. Row-per-(node,
hand-class, action) is our default; the blob stays available behind the storage interface
`ARCHITECTURE.md` already mandates.

---

## ADR-0017 — Rake cross-check policy against `pokerkit`

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted

**Context.** `pokerkit` (MIT) is the only evaluated engine that models rake with a
percentage and a cap. Its rake uses Python `round()` (banker's rounding), not floor:
`rake(3333, percentage=0.05, cap=8000)` returns `167` where ADR-0009 requires `166`.

**Decision.** `pokerkit` may be used as a rake oracle only through an explicit normalising
adapter that converts its rounding to ours at the comparison boundary, and the divergence
must be restated in the comparison harness so nobody reads a 1-milliBB difference as a bug
in our engine. This does not change ADR-0009; our floor rule stands until a real CoinPoker
fixture says otherwise.
