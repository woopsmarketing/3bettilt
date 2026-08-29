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
for _running_ live games. We are building a synchronous, manual-entry engine for a table we
do not control. Four of our hard requirements — sitting out, auto top-up, the dirty-stack /
observe resync flow, and a configurable CoinPoker rake — are absent, and they must live
_inside_ the state machine, so no wrapper buys them. Its `stackBefore` invariant is directly
hostile to Phase 8. Its money type is a bare `type Chips = number` with runtime-only integer
checking, which would degrade our compile-time `MilliBB` guarantee (ADR-0001) at the
dependency boundary. Its complete replay path is private and async, conflicting with the
"pure and synchronous" rule.

**This recommendation is falsifiable.** Revisit if: (a) a differential run shows our
side-pot or min-raise logic is wrong where theirs is right; (b) it grows sit-out, top-up,
dirty-stack and configurable rake _and_ exports a synchronous replay; (c) the `stackBefore`
invariant becomes opt-out; (d) Phase 2 overruns its estimate by a large multiple. Bus
factor, star count and release cadence are **not** on that list — under MIT they are
manageable by forking, and they are not the reason for this decision.

---

## ADR-0012 — Differential-oracle policy

**Date:** 2026-08-28 · **Phase:** OSS spike · **Status:** accepted

**Context.** Several evaluated engines are useful as independent checks on our arithmetic.
Whether their _output_ may be committed as fixtures is an unsettled legal question
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

- Kuhn poker has a _continuum_ of equilibria parameterised by α ∈ (0, 1/3]. Asserting a
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
   reached, and in the serialised asset that is _byte-indistinguishable from a genuine
   50/50 mixed strategy_. A UI would render "50% call" for `72o` facing a 4-bet as if it
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

---

## ADR-0018 — Rake and fee are configuration; CoinPoker behaviour is observed, not asserted

**Date:** 2026-08-28 · **Phase:** 1 · **Status:** accepted

**Context.** The user's CoinPoker hand-history evidence shows three things:

1. preflop-only hands can have `Rake = 0`;
2. postflop hands show a normal percentage rake;
3. **Splash Fee is recorded separately from Rake**.

This resembles the widely used "no flop, no drop" convention, but resemblance is not
evidence. We have observations from one export, not a documented site rule.

**Decision.** Treat all three as **observed fixture behaviour to be verified in Phase 11**,
never as a universal poker rule, and never as something poker-core knows about CoinPoker.
`poker-core` accepts a policy; it does not contain a site.

- `RakeConfig` carries an explicit **`triggerPolicy`** (a named policy such as `ALWAYS` or
  `FLOP_SEEN`), not a boolean flag whose meaning is only legible from its name. Adding a
  third trigger must not require touching rake arithmetic.
- `RakeConfig` keeps its explicit **rounding policy** (ADR-0009: floor).
- The rate stays an **exact rational** (`numerator`/`denominator`), not a float `rate`, and
  the cap stays **milliBB**, not BB. This deviates from the field names sketched in the
  decision (`rate`, `capBB`) and does so deliberately: ADR-0001 forbids float money, and
  `5%` as `5/100` is exact where `0.05` is not.
- **`FeeConfig` is separate from `RakeConfig`.** Splash fee is recorded, computed and
  reported as its own deduction, because the hand history records it separately and
  collapsing them would destroy that distinction. Default: disabled/zero.
- Settlement reports rake and fees as **separate recorded amounts**, so a corrected rule
  later changes configuration and data, not code.

**Consequences.** Every CoinPoker-specific assumption is confined to a preset value, and
`docs/STATE.md` carries the open question until a real fixture settles it. Splash-fee
_trigger_ semantics remain unknown; the config models the amount without inventing when it
applies.

---

## ADR-0019 — Baseline identifiers carry their coverage scope

**Date:** 2026-08-28 · **Phase:** 9/13 input · **Status:** accepted

**Context.** `CP_NL50_ANTE_100BB_BASELINE_V1` implies a dataset covering the whole game.
Per ADR-0014 no such dataset is reachable, so the name would be a claim we cannot meet, and
a UI reading it would have no way to know what is missing.

**Decision.** Identifiers state coverage explicitly:

```
CP_NL50_ANTE_100BB_PREFLOP_V1
CP_NL50_ANTE_100BB_HU_POSTFLOP_SRP_V1
```

Format: `<site>_<stake>_<ante>_<stack>_<coverage>_V<n>`, where coverage names the lineup,
street scope and pot type actually solved. `..._BASELINE_V1` is retired as a name.

**Consequences.** A spot outside a dataset's coverage is a _miss_ the matcher can detect
from the identifier, which is what lets the UI say "no exact solution for this lineup"
instead of silently presenting a six-handed answer for a four-handed spot. Immutability
(one version, never regenerated) is unchanged.

---

## ADR-0020 — Pre-Phase-13 planning checkpoint

**Date:** 2026-08-28 · **Phase:** gate before 13 · **Status:** accepted

**Decision.** Phase 13 does not start until a planning checkpoint has settled and recorded,
in writing, all six of:

1. **Exact baseline coverage and version naming** — the concrete identifier set to be
   produced, per ADR-0019.
2. **Exact CoinPoker rake trigger semantics** — verified against real hand histories, not
   inferred from convention (ADR-0018).
3. **Rake rounding semantics** — confirm or correct ADR-0009's floor rule against fixtures.
4. **Splash Fee treatment** — when it applies, how it interacts with the cap, and whether it
   belongs in the solved game at all or only in settlement.
5. **Solver validation thresholds** — the exploitability targets that count as converged, per
   game size, decided _before_ any solve so the bar cannot be moved to fit a result.
6. **Solver reproducibility requirements** — seed, iteration count, abstraction, code version
   and hardware recorded such that a dataset can be regenerated bit-identically.

**Why a gate rather than a task.** Items 5 and 6 lose their value entirely if decided after
the fact: a threshold chosen once a number is known is not a threshold, and reproducibility
retrofitted onto a finished run is a guess about what was run.

---

## ADR-0021 — Decision stability, and poker-core's independence during MVP

**Date:** 2026-08-28 · **Phase:** operating rule · **Status:** accepted

**Decision.**

1. Accepted decisions — in particular the open-source spike outcomes ADR-0011..0017 — are
   **not reopened during normal MVP work**. They are revisited only on the falsifying
   evidence each ADR names, or on an explicit instruction. An agent that disagrees reports
   it; it does not relitigate.
2. `packages/poker-core` stays independent of **CFR, GTO solution data, SAFE_GTO, ADAPTIVE
   strategy, and player-tendency logic**. ESLint already blocks `react`/`next`/`@gto-self/db`
   there; this extends the rule to strategy and player packages. Solver work does not start
   early — Phase 13 is gated by ADR-0020.

---

## ADR-0022 — Verification cadence: fast gate, milestone gate, final gate

**Date:** 2026-08-28 · **Phase:** operating rule · **Status:** accepted

**Context.** Running the full suite after every small change spends most of its time
re-proving things no one touched. The cost is real: it slows every work package and makes
agents reluctant to iterate.

**Decision.** Three tiers, documented in `CLAUDE.md`:

- **Fast gate** after each small task — the smallest check that proves the new code is not
  obviously broken. No full E2E, no full regression, nothing unrelated to the change.
- **Milestone gate** when a real user-facing capability is complete — typecheck, lint,
  build, targeted integration and targeted E2E.
- **Final gate** on frozen source — `pnpm verify`, full regression, cross-surface E2E,
  fresh security and product review, run once.

**Three rules that keep this from degrading into "less testing":**

1. **Immediate-verification exceptions.** Migrations/schema, auth, authorization, security
   boundaries, money/cost, PII, retention, concurrency/TOCTOU, shared runtime, wire
   formats, destructive mutations, external side effects, shared API contracts and startup
   configuration are verified at the moment they change — with a targeted integration test
   for that specific risk, not a whole-product E2E run.
2. **Never accumulate known breakage.** A failing fast gate stops the work package. "The
   final E2E will catch it" is not a plan; it is a decision to debug several changes at
   once later.
3. **No redundant runs.** An expensive suite that passed on unchanged source is not re-run
   without a reason (code changed, dependency changed, finding fixed, source frozen).

**What is explicitly not changed.** Scope, architecture, safety rules and acceptance
criteria are untouched. The aim is removing duplicate verification, not verification.

---

## ADR-0023 — Strategy policy is a composition layer, not part of `gto-core`

**Date:** 2026-08-28 · **Phase:** 10 input · **Status:** accepted

**Context.** Two rules that are individually obvious collide. ADR-0021: `gto-core` must
never depend on `player-core`, so player statistics can never influence baseline solution
data. The product spec: `ADAPTIVE` is by definition a function of the baseline _and_ a
player's tendencies. If strategy policy lived inside `gto-core` — as
`docs/ARCHITECTURE.md` originally said — then implementing `ADAPTIVE` would require
`gto-core` to import `player-core`, breaking the first rule at exactly the moment the
feature ships.

**Decision.** Strategy policy becomes its own composition layer that may depend on both:

```
gto-core   player-core
     \\        /
   strategy-policy   ->   apps/web
```

`gto-core` and `player-core` remain mutually unaware. During MVP, `GTO` and `SAFE_GTO`
need no player data at all and may be implemented inside `gto-core`. **The split happens
before any adaptive logic is written, not after** — retrofitting a boundary around code
that has already reached across it is how the rule would quietly die.

**Consequences.** A `packages/strategy-policy` workspace package is created when Phase 10
begins, with its own ESLint entry. The baseline stays structurally incapable of being
mutated by player statistics, rather than merely conventionally protected.

---

## ADR-0024 — `round.currentBet` is a price, not an obligation

**Date:** 2026-08-28 · **Phase:** 1 · **Status:** accepted

**Context.** Under `rules.shortBlindSetsFullLevel`, a big blind who cannot cover the blind
still sets `round.currentBet` to the nominal 1 BB. The engine originally decided "does this
seat still owe an action?" by comparing the seat's street contribution against
`round.currentBet`. A review lens found that this puts a seat on the clock that owes
nothing: it has already matched every live opponent, and no opponent can raise it.

The consequences were not cosmetic. Folding there forfeits chips no poker rule can take,
and calling writes a `CALL` into `state.actions` for an action that never happened —
corrupting the action tree that GTO matching criterion 4 requires to be exact. Heads-up,
the hand dead-ended.

**Decision.** Round closure keys off the **highest live opposing contribution** — money an
unfolded opponent actually wagered — not off `round.currentBet`. `callAmount`,
`fullCallAmount` and `minWagerToAmount` continue to key off `currentBet`, so the nominal
1 BB price of entry is unchanged for seats that genuinely face action.

**Consequences.** Money-neutral, action-tree-correcting. Two previously passing tests had
encoded the phantom call and were rewritten: the final stacks are byte-identical either
way, and the only difference is that a `CALL` that never happened is no longer recorded.
That is exactly what CLAUDE.md rule 3 forbids, so the tests were wrong and the engine was
right to change. Assumption 6 in `docs/POKER_CORE_API.md` was corrected accordingly.

---

## ADR-0025 — `MAIN_POT_FIRST` rake allocation can pay a winner zero

**Date:** 2026-08-28 · **Phase:** 1 · **Status:** accepted, documented rather than "fixed"

**Context.** With `rake.allocation = 'MAIN_POT_FIRST'`, a capped rake drains from the main
pot upward and can consume a small main pot entirely, leaving its winner a net of zero.

**Decision.** Leave the arithmetic as it is and **state it**, in `allocateRake`'s TSDoc, in
spec §7.13 and as assumption 4. Do not invent a minimum-payout floor.

**Why not "fix" it.** Draining the main pot first is literally what the policy name means,
`PROPORTIONAL` is the shipped default, and CLAUDE.md rule 7 forbids inventing poker
behaviour where we have no evidence. A floor would be a fabricated rule dressed as a bug
fix. The genuine latent defect next to it _was_ fixed: `PROPORTIONAL` now spills its floor
remainder past a main pot too small to hold it, and `allocateRake` asserts that no pot is
ever charged more than it contains.

---

## ADR-0026 — `rootDir` removed from every package tsconfig (Phase 0 defect)

**Date:** 2026-08-28 · **Phase:** 1 · **Status:** accepted

**Context.** Phase 0 set `"rootDir": "."` in every package's tsconfig. Under `noEmit` it
achieves nothing, and it makes TypeScript reject **any** cross-package import with TS6059.
`poker-core` hit it the moment it imported `@gto-self/shared`. I reproduced it
independently on `gto-core` with a two-line probe import before accepting the report.

**Decision.** `rootDir` is removed from all seven package tsconfigs. Verified: the probe
import typechecks clean afterwards, and `pnpm typecheck` passes across all eight projects.

**Why it is recorded.** It was a latent repo-wide defect that would have surfaced as a
confusing failure in the first task each of `gto-core`, `player-core`, `db`,
`coinpoker-parser` and `solver-lab` attempted. It was found because a phase agent was
required to run a verification it could not otherwise pass, and reported the config change
as a deliberate divergence instead of making it silently — which is the behaviour the
delegation rules are meant to produce.

---

## ADR-0027 — CoinPoker settles in currency cents; ADR-0009's milliBB floor is superseded for CoinPoker

**Date:** 2026-08-29 · **Phase:** 2 input · **Status:** accepted (the exact rule is a bounded
Phase-2 evidence task; supersedes ADR-0009 for CoinPoker settlement)

**Context.** ADR-0009 chose `floor` at milliBB granularity and flagged it as an assumption to
verify against a real hand history. Real CoinPoker hand-history lines now contradict it. Two
NL50 examples, where BB = ₮0.50, so 1 milliBB = ₮0.0005 and **one cent = 20 milliBB**:

| pot                | 5% of pot         | ADR-0009 milliBB floor | hand history records |
| ------------------ | ----------------- | ---------------------- | -------------------- |
| ₮5.37 (10 740 mBB) | ₮0.2685 (537 mBB) | 537 mBB = ₮0.2685      | **₮0.27** (540 mBB)  |
| ₮6.87 (13 740 mBB) | ₮0.3435 (687 mBB) | 687 mBB = ₮0.3435      | **₮0.34** (680 mBB)  |

The site does not settle at milliBB granularity at all — it settles in whole currency cents.
The first row additionally rules out _flooring_ at cent granularity (that would record ₮0.26);
the second rules out _ceiling_ (that would record ₮0.35). Both are consistent with rounding to
the nearest cent. Neither is an exact half-cent tie, so **the tie-breaking rule is not
determined by this evidence and must not be invented.**

**Decision.**

1. ADR-0009's floor rule is **superseded for CoinPoker settlement**. `'floor'` remains a
   perfectly good `RoundingMode` for a configuration that asks for it; it stops being stated as
   a fact about CoinPoker. ADR-0017's normalising adapter for `pokerkit` comparisons is
   unaffected in mechanism, but the direction it normalises _towards_ is now itself under review.
2. **Settlement quantum becomes explicit configuration on `RakeConfig`** — a `MilliBB`
   granularity that settlement money is quantized to (NL50: 20 mBB = ₮0.01), together with the
   rounding mode applied at that granularity.
3. **The settlement quantum is NOT derived from `DisplayConfig`.** `DisplayConfig`
   (`bigBlindValue`, `symbol`) is presentation. Deriving settlement money from a presentation
   field would let a formatting change silently alter recorded money.
4. The rake **rate stays an exact rational** (`numerator`/`denominator`) and the **cap stays
   `MilliBB`** (ADR-0018). Neither becomes a float, and neither becomes a currency amount.

**Bounded Phase-2 evidence task**, blocked until a real fixture is present (see `docs/STATE.md`):
analyze the complete fixture; infer the observed settlement quantum; determine the observed
rounding rule as far as the data permits; leave anything the fixture cannot distinguish —
tie-breaking in particular — explicitly undetermined rather than choosing a plausible answer;
add regression cases derived from real hands. The **pot basis** (before or after the uncalled bet
is returned, and pre- or post-fee) is part of what the fixture must settle, not an input to
assume; it is assumption 3 in `docs/POKER_CORE_API.md`.

**Consequences.** `POT_AWARDED` stores the rake _actually applied_ (ADR-0009), so no stored hand
becomes unloadable when the rule is corrected. Assumption 5 in `docs/POKER_CORE_API.md` is now
**known wrong for CoinPoker** rather than merely unverified. Two data points are enough to
falsify the old rule; they are not enough to fix the new one.

**Open question, deliberately not decided here.** The 8 BB cap may be valid only for the
dealt-in count currently targeted. Rooms commonly run a short-handed cap schedule. Do not invent
one — recorded in `docs/STATE.md` under known issues.

---

## ADR-0028 — Baseline identifiers name the lineup (amends ADR-0019)

**Date:** 2026-08-29 · **Phase:** 9 input · **Status:** accepted

**Context.** ADR-0019 required an identifier to state its coverage, and offered
`CP_NL50_ANTE_100BB_PREFLOP_V1` as the example. That name still omits the thing that most often
makes a solution inapplicable to a spot: **how many players are in the lineup**. A six-handed
preflop dataset and a four-handed preflop dataset are different solutions, and under ADR-0019's
format as written they collide on one identifier — reintroducing precisely the failure ADR-0019
exists to prevent.

**Decision.** The lineup is part of the identifier:

```
CP_NL50_6MAX_ANTE_100BB_PREFLOP_V1
CP_NL50_HU_ANTE_100BB_POSTFLOP_SRP_V1
```

Format: `<site>_<stake>_<lineup>_<ante>_<stack>_<coverage>_V<n>`.

**Consequences.** ADR-0019 otherwise stands in full: coverage must still be stated and
`..._BASELINE_V1` stays retired. This fixes only _where the lineup lives_, moving it out of the
coverage segment (ADR-0019's `..._HU_POSTFLOP_SRP_V1`) into its own segment, so lineup is always
present rather than present only when someone remembered it. Identifiers written down before
today — in `docs/GTO_BASELINE.md` and `docs/OPEN_SOURCE_EVALUATION.md` — predate this. The
reasoning is note G in `docs/GTO_DESIGN_NOTES.md`.

---

## ADR-0029 — The product is independent practice and post-hoc review, never live assistance

**Date:** 2026-08-29 · **Phase:** operating rule · **Status:** accepted

**Context.** `CLAUDE.md` already forbids any connection to a poker client. But UX wording had
drifted into implying the app is used _alongside a live real-money hand_ — "the user is
mid-session at a poker table". That framing misdescribes the product and quietly invites exactly
the features the hard boundary forbids.

**Decision.** The application is an independent practice / simulation / replay tool. There are
two modes of use and no third:

1. **Independently simulated practice hands.** The user enters a hand into our own training
   table. Strategy **may** be shown during such a hand — no real-money hand is in progress.
2. **Imported or recorded real hands.** Reviewed **after the fact**.

Never: live-client integration, live screen reading, live automation, or concurrent decision
assistance during a real-money hand in progress elsewhere.

**Consequences.** UX copy must not imply the user is sitting at a live table while using the app.
The interaction design is unchanged — inline, non-blocking correction is still right — but its
justification is that modals are slow and destroy flow, not that the user is under a real-money
action clock.

---

## ADR-0030 — Run-it-twice is preserved losslessly, not replayed, in the MVP parser

**Date:** 2026-08-29 · **Phase:** 11 input · **Status:** accepted

**Context.** `poker-core` is single-board by construction. `docs/POKER_CORE_API.md` §9 noted that
supporting run-it-twice would make `board` a list of boards and give `POT_AWARDED` a run index.
Meanwhile `fixtures/coinpoker/README.md` lists run-it-twice among required fixture coverage and
ROADMAP Phase 11 lists it as parser scope. Those were never reconciled, and "the parser covers
RIT" was on track to be read as "the engine replays RIT".

**Decision.** For the MVP parser:

- RIT text is **parsed and preserved losslessly** in a neutral representation. Nothing in the
  source text is discarded (`CLAUDE.md` rule 3).
- The single-board engine is **not required to replay a RIT hand**. Single-run hands are replayed
  through `poker-core`; RIT hands are preserved and explicitly marked not-engine-replayable.
- A true multi-board engine is a **separate design decision, taken before any implementation** —
  not a retrofit discovered midway through Phase 11.

**Consequences.** Phase 11 can finish against a real fixture containing RIT hands without either
fabricating multi-board semantics or silently dropping those hands. The round-trip guarantee
(`replayHand` re-validating every action) covers single-run hands; a RIT hand carries a visible
"preserved, not replayed" status instead of an invisible gap.

---

## ADR-0031 — Missed blinds and the dead button stay unimplemented until a fixture verifies them

**Date:** 2026-08-29 · **Phase:** 2 input · **Status:** accepted

**Context.** ROADMAP Phase 2 and `docs/STATE.md` both listed "missed blinds, dead button" as
Phase-2 work. Real behaviour for both differs per room, and no CoinPoker fixture has confirmed
CoinPoker's. Implementing them in Phase 2 would mean inventing site behaviour — `CLAUDE.md`
rule 7.

**Decision.** Phase 2 may implement only what is neutral:

- `POST_DEAD_BLIND` as a **neutral accounting event** (accounting identical to an ante), if and
  only if it is actually needed.
- A **manual SB/BB assignment override** at hand start.
- The engine primitives the later UI will need.

Phase 2 must **not** implement automatic CoinPoker missed-blind or dead-button rules. **Phase 8**
owns the user-facing override UX. Site-specific automatic behaviour stays unimplemented until a
fixture verifies it.

**Consequences.** Assumption 15 in `docs/POKER_CORE_API.md` — the button moves simply; dead
button and missed blinds are not modelled — is still true after Phase 2. Phase 2 adds the manual
correction path, not an automatic rule.

---

## ADR-0032 — Splash Fee is confirmed a separate pot deduction (closes one ADR-0018 observation)

**Date:** 2026-08-29 · **Phase:** 2 input · **Status:** accepted; ADR-0018 unchanged and
authoritative

**Context.** ADR-0018 recorded three things as _observed fixture behaviour awaiting
verification_, and decided to model the splash fee separately from rake on that basis. Working
through the real hand-history arithmetic has since **confirmed observation 3**: the Splash Fee
is a separate deduction from the pot payout, not a component of the rake and not a display
artefact. Recorded because a fresh agent reading only ADR-0018 would still treat it as
unverified and might "tidy" the two into one number.

**Decision.** ADR-0018 stands exactly as written — this changes none of it, and confirms the
modelling choice it made. Concretely:

- Splash fee is `FeeConfig`, separate from `RakeConfig`. Never collapsed into rake.
- Settlement records **`totalFees` as its own amount**, alongside the rake actually applied.
- The chip-conservation invariant must account for fees, not just rake and payouts.
- Ownership: the **Phase-2 ADR-0018 follow-up** owns `FeeConfig`, the recorded total, the
  settlement accounting and the conservation invariant. **Phase 11** owns parsing the observed
  fee amount out of CoinPoker hand-history text.

**Still unknown, still not to be invented.** _When_ the splash fee applies and how it interacts
with the rake cap. ADR-0020's pre-13 checkpoint item 4 ("Splash Fee treatment") is therefore
only partly settled: the _accounting shape_ is confirmed, the _trigger_ is not.

**Consequences.** ADR-0018's observations 1 (preflop `Rake = 0`) and 2 (percentage rake
rounding) remain open — and observation 2 has since been falsified in its ADR-0009 form by
ADR-0027.

---

## ADR-0033 — The fixture is not coming; settlement correctness becomes a configuration surface

**Date:** 2026-08-29 · **Phase:** 2 input · **Status:** accepted; supersedes the _scheduling_
of ADR-0027's evidence task, not its findings

**Context.** ADR-0027 recorded a bounded Phase-2 task: analyse the complete real CoinPoker
hand-history export, infer the settlement quantum, and determine the rounding rule. That task
was blocked on the export being placed in the repository. The export will not be provided now,
and waiting for it would stall the whole product behind a detail that affects only the last
decimal of a raked pot.

The product goal is an **independent practice / simulation MVP** a person can actually open and
run hands in (ADR-0029). Nothing in that loop needs a parsed hand history: not the engine, not
player identity, not session setup, not the table, not the action UX, not card entry, not
observe mode, not the GTO provider scaffolding, not the strategy UI.

**Decision.**

1. **Phase 11 (hand-history parser) is deferred** until after the first usable MVP, and is not
   a dependency of Phases 2–10. Player identity stays manual nicknames plus our own
   observations; persistent opponent identity is **never** derived from CoinPoker hand-history
   IDs.
2. **No further forensic reconstruction without the fixture.** What ADR-0018, ADR-0027 and
   ADR-0032 already record is preserved verbatim and is enough to design against:
   a nominal 5% rate; observed preflop-only hands raked zero; observed postflop hands raked a
   percentage; observed amounts consistent with currency-quantized nearest-cent rounding;
   **tie-breaking unknown**; splash fee a separate payout deduction; **splash-fee trigger
   unknown**. Guessing past that is forbidden, as before.
3. **Phase 2 builds the configuration surface instead of the answer.** Every unknown becomes an
   explicit, validated, named policy field with a documented default, so that when the fixture
   eventually arrives the correction is a **configuration change and a fixture test — never a
   code change**. Concretely: a named rake `triggerPolicy` replacing the `noFlopNoDrop` boolean;
   an explicit settlement `quantum` and `rounding` on `RakeConfig`; `FeeConfig` separate from
   `RakeConfig`; rake and fees accounted and recorded separately; chip conservation including
   fees.
4. **The exact CoinPoker settlement model stays a pre-Phase-13 validation item.** It is a
   precondition for claiming a real GTO baseline (ADR-0020), not for shipping a practice tool.

**Consequences.** The engine's defaults are honest configuration, not claims about CoinPoker:
the shipped NL50 preset quantizes settlement to `₮0.01` (20 milliBB) and rounds to nearest, with
half-way behaviour flagged as an assumption no observation has yet distinguished. `docs/STATE.md`
must keep listing the unknowns; a preset value is not evidence. ADR-0027's findings are
untouched — only its "blocked, waiting" status is retired.

---

## ADR-0034 — Player identity is a manually entered nickname; normalization is stored alongside it

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted

**Context.** The product is not connected to any poker client (ADR-0029) and the CoinPoker
hand-history export is not coming (ADR-0033), so there is no external identifier to key a
player on. Identity has to come from what the user types. But a typed nickname is not a
usable key on its own: `"Dan"`, `"dan "` and `"ＤＡＮ"` are the same opponent to a person and
three different strings to a database.

**Decision.** A `Player` carries both the nickname **as entered** and a separately stored
`normalizedNickname`. Normalization is NFKC → trim → collapse internal whitespace →
locale-independent lowercase. The **normalized** column carries the unique index; the entered
column is never rewritten to match it (CLAUDE.md rule 3). Players are archived, never deleted,
so an archived nickname stays reserved and the snapshots, notes and observations that
reference the player keep their subject.

**Consequences.** Two columns, permanently, and every rename must recompute both. Locale-
independent lowercasing is deliberate: `toLocaleLowerCase` under a Turkish locale maps `I` to
`ı` and would make identity depend on the machine's locale. Identity is **never** derived from
a poker client, a hand-history ID, or anything scraped — that boundary is ADR-0029 and is not
reopened by any later phase.

---

## ADR-0035 — HUD testimony and our own observations are separate record types with separate representations

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted

**Context.** `docs/ARCHITECTURE.md` already required manual HUD snapshots and our own
observations to be permanently separate record types. Phase 3 had to decide what each one
actually stores, and the two answers are not the same shape.

**Decision.**

- A **manual HUD snapshot** is testimony about what a third-party HUD displayed. It stores
  what the user typed: a `CentiPercent` integer (hundredths of a percentage point) **and** the
  verbatim `enteredText`, in two separate columns. `parsePercent` **rejects** a third decimal
  rather than rounding it away, exactly as `Money.parseBB` rejects a fourth milliBB decimal.
  Re-parsing `enteredText` must reproduce the stored integer; a row where it does not is
  `CORRUPT_ROW`, never a silently coerced object.
- An **observation** is our own count. It stores `opportunities` and `actions` and **never a
  rate column**. The rate is derived on demand.
- The two are never averaged, never merged into one table, and never joined into a view that
  presents a single number.

**Consequences.** Percentages are integers for the same reason money is, but they are _not_
`MilliBB` — milliBB carries a currency meaning a frequency does not have, and mixing them
would let a percentage reach an arithmetic path expecting chips. HUD stats are frequency-only
for MVP; aggression factor and other unbounded ratios are excluded rather than forced into a
0..100 type. Observation context is `metric + position` with `position: null` a **distinct
bucket**, explicitly not the sum of the six positional buckets — adding them double-counts.
`ObservedPosition` duplicates `poker-core`'s `Position` because `player-core` may not import
`poker-core` (ADR-0021); the app maps at its boundary, and the drift risk is accepted.

---

## ADR-0036 — Confidence is a named level with an explicit `INSUFFICIENT` member

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted

**Context.** A statistic from six observed hands and one from six hundred must not present
the same way. The tempting shape — a confidence number in 0..1 — makes a tiny sample look
like a small amount of knowledge rather than none.

**Decision.** `ConfidenceLevel` is `INSUFFICIENT | LOW | MEDIUM | HIGH`. Below the low
threshold the answer is the distinct member `INSUFFICIENT`, not a low number; an unknown
sample size (`null`) is also `INSUFFICIENT`. Thresholds are **configuration** with documented
defaults (30 / 100 / 500), anchored to the binomial 95% margin of error at p=0.5
(`1.96·√(0.25/n)` → roughly ±18pp / ±10pp / ±4.4pp), and validated rather than assumed
ordered.

**Consequences.** The defaults are **display thresholds, not poker claims** — they say how
wide the error bar is, not that 100 hands is enough to read someone. This is the same posture
as CLAUDE.md rule 2: we do not dress an unknown up as a number. A caller that wants a
different cut passes its own thresholds.

---

## ADR-0037 — Manually entered records are insert-only, enforced by database triggers

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted · supersedes the repository-
convention approach it replaces

**Context.** CLAUDE.md rule 3 says user input is never destroyed. Phase 3 first implemented
that as a **convention**: the HUD and note repositories simply exported no update function.
The independent review broke it in one line. The package barrel re-exports the raw Drizzle
table objects, so `db.update(playerNotes).set({ body: '…' })` — using barrel imports only —
overwrote a note body with no error and no surviving version. Overwriting a HUD reading's
`enteredText` and value _together_ even passed the read-time re-parse check, because that
check compares the two clobbered columns against each other. The test that claimed to prove
the guarantee was a **regex over exported method names**; a method called `saveNote` would
have passed it.

**Decision.** The guarantee moves into the database. `player_notes`, `player_hud_snapshots`
and `player_hud_snapshot_stats` carry `BEFORE UPDATE` and `BEFORE DELETE` triggers that
`RAISE(ABORT, …)`. A note revision is a new row linked by `rootId`/`supersedesId`; a new HUD
reading is a new snapshot. The table objects stay exported — later phases legitimately need
them for reads — because the trigger, not the export list, is now the guarantee. The test that
proves this performs a real raw `update` and `delete` through barrel imports and asserts both
are rejected with the original row intact.

**Consequences.** `drizzle-kit` does not generate triggers, so `0001_insert_only_guards.sql`
is a hand-maintained custom migration: adding another insert-only table will not update it
automatically, and the trigger-list assertion is the only tripwire. A trigger abort surfaces
as a generic storage failure rather than a typed constraint violation, which is acceptable
only because no repository path can reach it. **A rule enforced by convention is not
enforced.** Where a CLAUDE.md non-negotiable can be given a structural guarantee, it gets one.

---

## ADR-0038 — `TableConfig` persists as one validated JSON document, and a session keeps its own copy

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted

**Context.** A session's table configuration contains the rake rate as an exact rational, the
settlement `quantum` and `rounding` (ADR-0027), the `triggerPolicy` and a separate `FeeConfig`
(ADR-0018, ADR-0033). Flattening that into columns would re-encode money policy inside the
persistence layer, where it could drift from `packages/poker-core/src/config.ts`.

**Decision.** `TableConfig` is stored as a single JSON document and validated on read through
**both** the zod codec and `validateTableConfig` — the same validation the engine uses. A
session stores its **own copy** of the config it was played under, with `preset_id` recording
provenance only.

**Consequences.** Editing a preset never retroactively changes an already-played session; a
hand's money is interpretable years later against the policy it was actually played under.
The cost is that the config is not queryable by column in SQLite; under PostgreSQL it becomes
`jsonb` and is. The DB holds no second opinion about rake, fees or rounding — `config.ts`
remains the only definition.

---

## ADR-0039 — The event log is authoritative; header columns are checked projections; the load path is `loadHand`

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted

**Context.** A hand can be reconstructed from its event log alone, but listing a session's
hands would then mean decoding every log. Some duplication is needed, and duplicated state
drifts unless something checks it.

**Decision.** `hand_events` is the authoritative record. `hands.hand_number` and the
`hand_players` rows are **projections** written in the same transaction, existing only so list
queries need not decode logs. `insertHand` re-derives `hand_number` from the log's own
`HAND_STARTED` event and refuses a disagreeing header. The rehydration path uses `loadHand`
(structural), **never** `replayHand` (re-validating). `hand_events.kind` carries no `CHECK`
constraint: the engine's zod codec is the vocabulary, so a new event kind is not a migration.

**Consequences.** A later corrected poker rule cannot make already-stored history unloadable —
the DB reads what was recorded, and re-validation is a separate, explicit act. `hand_players`
is an index only and is **not** re-derived from the log; `loadStoredHand` never reads it. The
per-hand uniqueness of `event_id` is scoped to the hand, not global.

---

## ADR-0040 — The persistence layer reads no clock and generates no ids

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted; extends ADR-0007

**Context.** ADR-0007 made ids injected rather than generated inline, so that a replay is
reproducible. Time is the same problem: a `CURRENT_TIMESTAMP` default makes a row's meaning
depend on when it was written rather than on what happened.

**Decision.** Timestamps are a caller-supplied branded `Timestamp` — an integer count of epoch
milliseconds, in an INTEGER column. No `CURRENT_TIMESTAMP` default and no `AUTOINCREMENT`
column exists anywhere in the schema, asserted by a test over `sqlite_master`. A timestamp
that moves backwards on a record is a typed error, not an accepted write. `db` adopts
`player-core`'s `Timestamp` as the canonical type because `poker-core` has none — the engine
must not know about time at all.

**Consequences.** Every caller must pass a clock reading, which is what makes a test able to
pin one. ISO strings are never stored. Under PostgreSQL these columns need `bigint`, not
`integer`.

---

## ADR-0041 — Integer columns carry an explicit integrality `CHECK`

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted

**Context.** CLAUDE.md rule 1 makes money an integer count of milliBB. The schema declares
those columns `INTEGER` — but SQLite's INTEGER _affinity_ does not enforce integrality: a
value that cannot be converted losslessly is simply stored as REAL. `update session_seats set
stack = 93701.5` succeeded. The read path caught it, so nothing lossy was ever returned, but
the write produced a permanently unreadable row instead of being rejected.

**Decision.** Every money, count, centipercent and epoch-ms column folds `typeof(col) =
'integer'` into its `CHECK` constraint. The rejection happens at the constraint, not at the
decoder.

**Consequences.** A fractional write now fails where it is made rather than where it is read.
The enumerated categories are covered; `seat`, `seq`, `command_seq`, `ordinal`, `hand_number`
and `archived` still rely on their range and enum checks plus the decoders. Under PostgreSQL
the check is redundant — a real `integer`/`bigint` column cannot hold a fraction — and can be
dropped when that port happens. **A declared type is not a constraint** unless the engine
enforces it.

---

## ADR-0042 — ESLint layering rules use `patterns`, and every block spells out its full list

**Date:** 2026-08-29 · **Phase:** 3 · **Status:** accepted; fixes a hole in ADR-0006

**Context.** ADR-0006 made ESLint the enforcement for the layering rules, and CLAUDE.md rule 4
states plainly that "ESLint enforces all of this". The independent review found it did not.
`no-restricted-imports` with `paths` matches the **exact** module specifier only, and every
workspace package declares a `"./*"` export, so `@gto-self/db` was blocked while
`@gto-self/db/client.js` linted clean. Four boundaries had no rule at all: `shared`,
`coinpoker-parser`, `db`, and "nothing imports `solver-lab`".

**Decision.** Every layering block uses `patterns` covering both the bare specifier and its
subpath form, and each boundary named in CLAUDE.md has a block: `poker-core`, `gto-core`,
`player-core`, `shared` (the root, importing no workspace package), `db` (may import the
domain, never React or Next), `coinpoker-parser`, `solver-lab` (depends on `shared` alone),
and a ban on importing `solver-lab` from anywhere in the product. Each block spells out its
**full** pattern list, composed from shared constants in JavaScript, because flat config
resolves a rule by last-match-wins rather than by merging — a later broad block matching the
same files would silently **replace** a narrower block's patterns. That failure was observed
while writing this: adding a broad `packages/**/*.ts` block disabled every per-package rule,
and a probe caught it.

**Consequences.** Each rule is proved non-vacuous by a probe that asserts a forbidden import
errors and a permitted one does not. A layering rule with a hole is worse than no rule,
because the documentation then claims an enforcement that does not exist.

---

## ADR-0043 — The action path is local and synchronous; persistence happens at boundaries

**Date:** 2026-08-29 · **Phase:** 4–7 · **Status:** accepted

**Context.** The app is used by a person entering hands quickly. `docs/UX.md` makes speed a
product property, not a tuning goal. The engine is pure and runs anywhere; the database is
`better-sqlite3` and runs only on the server. Where the boundary between them falls decides
whether the table feels immediate.

**Decision.** `poker-core` runs **in the browser**. Every poker state transition — action,
undo, card entry, award — is a local synchronous call inside a client component. Nothing
asynchronous sits between a user input and the visible update: no network request, no server
action, no database round trip, no `await`. Persistence happens **at boundaries only**: the
session is written on Start Session. Genuinely non-hot-path data — nickname autocomplete, the
player profile panel — may use a server action, because it is not on the interaction path.

**Hand persistence is not yet implemented.** Phases 4-7 write the session and nothing else:
live table state, the hand event log, cards and awards exist only in memory, and a page reload
discards them. This is a deliberate deferral, not an oversight — the write boundary and its
reconciliation rules belong with the hand-lifecycle work of Phase 8 — but it is recorded here
because an earlier draft of this ADR described a completion boundary that does not exist in the
code, and an independent review caught the divergence.

**Consequences.** The in-memory `Hand` event log, _after_ any undo, is the value that will
later be persisted, so **persisted undo remains legitimately deferred**: there is nothing
written yet to reconcile. Until the write boundary exists, losing entered work to a reload is a
CLAUDE.md rule 3 hazard, so the table states plainly in the UI that its state is in memory —
input may be discarded by an action the user takes knowingly, never silently. Introducing a database write into the action path to "solve"
persisted undo is forbidden — it would trade the product's defining property for a problem
that does not yet exist. The claim is enforced, not asserted: an end-to-end test drives a
full betting sequence and asserts the captured request list is empty.

---

## ADR-0044 — All database access funnels through `apps/web/src/server/`, ESLint-enforced

**Date:** 2026-08-29 · **Phase:** 4 · **Status:** accepted; extends ADR-0006 and ADR-0042

**Context.** `@gto-self/db` loads `better-sqlite3`, a native Node module. A client component
that imports it does not fail a lint rule or a type check — it fails at runtime in the
browser, and only on the code path that reaches it. The layering rules of ADR-0042 stopped at
the package boundary and said nothing about where _inside_ the app persistence may be used.

**Decision.** `@gto-self/db` is importable only from `apps/web/src/server/**`. Everywhere else
under `apps/web` — client components, hooks, shared libs, and the `app/` route files
themselves — it is an ESLint error on both the bare specifier and its subpath form. Route
server components reach persistence through helpers in `src/server/`, never directly. Server
actions are passed to client components **as props** rather than imported by them, so a client
module's import graph cannot reach the database at all.

**Consequences.** The performance contract of ADR-0043 becomes structurally checkable rather
than a thing reviewers must re-derive from diffs. Proved non-vacuous by probe: a client-side
import of `@gto-self/db` and of `@gto-self/db/client.js` both error, and the same file under
`src/server/` does not.

---

## ADR-0045 — Auto top-up policy is session state, not table configuration

**Date:** 2026-08-29 · **Phase:** 4 · **Status:** accepted

**Context.** Session setup must collect an auto top-up toggle and a target stack.
`AutoTopUpPolicy` is `{ enabled, targetStack, threshold }` and the `sessions` table had nowhere
to put any of it. Two wrong answers were available: collect the control and store nothing —
a stub presented as a feature, forbidden by CLAUDE.md rule 5 — or reuse
`TableConfig.referenceStack`, which is the **GTO model reference stack** that Phase 9 will read
as such, not a buy-in.

**Decision.** Two nullable columns on `sessions`, carrying enabled and target stack, with the
integrality `CHECK` of ADR-0041 and a paired-or-both-null check. `threshold` gets **no column**:
Phase 4 collects only enabled and target and stores `threshold = targetStack`, exactly as
`defaultAutoTopUpPolicy` shapes it. `insertSession` **refuses** a policy whose threshold differs
from its target rather than silently dropping the difference.

**Consequences.** Phase 8 owns the editable threshold and adds its column then. A column
nothing can write would itself be a stub, so the schema stays honest about what the product can
currently express, and a caller that assumes more is rejected loudly rather than truncated.

---

## ADR-0046 — Additive columns migrate with `ALTER TABLE ADD COLUMN`, never a generated table rebuild

**Date:** 2026-08-29 · **Phase:** 4 · **Status:** accepted

**Context.** `drizzle-kit generate` emitted SQLite's 12-step table-recreate for two additive
nullable columns on `sessions`. That output is both broken and destructive here. Its
`INSERT … SELECT` reads the two columns being **added**, so it fails with `no such column` on
any database, empty or not. Worse, once that is fixed, its `PRAGMA foreign_keys=OFF` is a
**no-op**: the migrator runs every migration inside one transaction, and SQLite ignores that
pragma while a transaction is open. `DROP TABLE sessions` would therefore execute with foreign
keys **enforced** and cascade away every `session_seats` row of every existing session.

**Decision.** A purely additive nullable column migrates with `ALTER TABLE … ADD COLUMN`,
carrying its named `CHECK` inline. Generated SQL is an input to review, not an artifact to be
trusted; where it is hand-corrected the reasoning is recorded in the migration header, and the
journal and snapshot are left untouched.

**Consequences.** A migration is verified against a **populated** database, not an empty one —
an empty-database test cannot observe data loss. The committed migration was applied inside a
single transaction to a database holding a session and its seats, and both seat rows survived
with their exact stack values. Falsifying evidence: if a future drizzle-kit emits a recreate
whose pragma is honoured and whose select is correct, this can be revisited.

---

## ADR-0047 — Module scope stays free of side effects that a bundler can break

**Date:** 2026-08-29 · **Phase:** 4 · **Status:** accepted

**Context.** `packages/db` resolved its migrations folder with
`export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url))`. This
is correct under Node and under Vitest. Under a bundler it is not: Next/Turbopack rewrites the
whole `new URL(...)` expression into an asset reference, and `fileURLToPath` then throws — at
**module evaluation**, which made the entire package unimportable from the app and failed
`next build` with an error naming a page rather than the cause.

**Decision.** Path resolution that depends on `import.meta.url` is exposed as a **function**
(`defaultMigrationsFolder()`), reached only by a caller that supplied no path of its own. A
bundled caller always passes an explicit folder — `apps/web/src/server/db.ts` resolves it by
walking up to the workspace root — because inside a build output `import.meta.url` points at a
chunk and the value would be wrong even where it does not throw.

**Consequences.** A failure at module scope takes down every importer and reports itself far
from its cause; the same failure inside a function is contained to the caller that needed it.
This class of bug is invisible to the unit test suite, which never runs through a bundler:
it is caught only by building and starting the real app, which is now part of the milestone
gate rather than an afterthought.

---

## ADR-0048 — One keyboard owner at a time, decided by explicit state

**Date:** 2026-08-29 · **Phase:** 7 · **Status:** accepted

**Context.** The action dock owns `F C R A Z N` on the window. The 52-card palette needs `A`
for ace and `C` for clubs. During `AWAITING_BOARD` the collision is accidentally harmless —
every action key is already disabled — but that is luck, not design, and it does not hold for
Hero hole-card entry during a live betting phase, where `A` means all-in.

**Decision.** A single `capturing` boolean is computed once by the parent and read by both the
palette and the dock **in the same React commit**; the dock returns from its handler before
doing anything when it is set. The palette adds no window listener of its own — its keys arrive
through a React `onKeyDown` and bubble to the dock's existing, inert listener. `stopPropagation`,
listener ordering and `capture: true` are not used. Open is deliberately **not** the same as
capturing: the palette may be open while the dock still owns the keyboard, until the user
actually engages it.

**Consequences.** The gate cannot race, because it is not a function of which listener fires
first — both read the identical value from one render. Proved by a test that asserts on
resulting engine state **with a negative control**: with the palette open but not capturing,
`a` really does put the seat all-in, so the passing case is not passing vacuously. Rejected
alternative: suppressing the dock with `stopPropagation`, which makes correctness depend on
DOM ordering and fails silently the moment a third listener appears.
