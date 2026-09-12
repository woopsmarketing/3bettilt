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

---

## ADR-0049 — A hotkey is resolved from the physical key when an input method rewrites `event.key`

**Date:** 2026-08-31 · **Phase:** 7 (Alpha feedback) · **Status:** accepted

**Context.** The first hands-on Alpha session reported "hotkeys not working". Every component
test and every Playwright spec passed, and the dock's listener read correctly. That
combination was the evidence: the suite drives a US keyboard, and the user types Korean. With
a Hangul input method active a browser `keydown` does not carry `event.key === 'f'` — it
carries the jamo (`'ㄹ'`), or the literal `'Process'` while the IME composes. `key.toLowerCase()`
matched nothing, so every hotkey was dead for exactly the primary user and alive for every
test.

**Decision.** `lib/table/keys.ts` resolves one keystroke to the letter or digit actually
pressed: `event.key` wins when it is already a single ASCII letter or digit, otherwise
`event.code` (`KeyA`..`KeyZ`, `Digit0`..`Digit9`) does. Named keys — `Escape`, `Backspace`,
`Enter` — are not this function's business and keep being read off `event.key` by their own
handlers. Both the action dock and the card palette route through it.

**Consequences.** The order matters and is the whole design: preferring `key` keeps AZERTY
and Dvorak users on the letter they see printed, because for them the physical position is
deliberately not what they mean; falling back to `code` fixes every input method, because no
IME rewrites the physical position, and a Korean 2-set keyboard is physically QWERTY with the
Latin legend on the cap. The fallback covers `KeyX`/`DigitX` only — a numpad code is not a
digit source here, since no hotkey uses the numpad. Verified in a real browser, not only in
tests: raw CDP key events (`key: 'ㄹ', code: 'KeyF'`) fold the hand, and `ㅁ`+`ㅑ` on
`KeyA`/`KeyS` enter the ace of spades. A test that presses `'f'` cannot ever catch this class
of bug again, so the unit tests assert on jamo and `'Process'` directly.

---

## ADR-0050 — Auto top-up is a per-seat preference; the session-level policy is only a seeding default

**Date:** 2026-08-31 · **Phase:** 7 (Alpha feedback) · **Status:** accepted

**Context.** ADR-0045 established that auto top-up is session state rather than table
configuration, and Phase 4 shipped it as one switch for the whole session. Hands-on use
falsified the granularity, not the placement: a practice table has one short stack and five
that are fine, and the user asked for a per-seat control where the common action is one click.
This refines ADR-0045's granularity; its placement decision stands.

**Decision.** Each seat carries its own `AutoTopUpPolicy`, stored on `session_seats`
(migration `0003`, additive per ADR-0046) and applied at the between-hands boundary by
`applySeatAutoTopUps` in `poker-core`. The session-level columns stay, and mean exactly one
thing now: the default each occupied seat was SEEDED from when the session was created. They
are never applied to a seat on their own.

**Consequences.** A seat the user switches off stays off — which would be false if the
session-wide switch were still applied alongside, and that is the bug this ADR exists to
prevent. Top-up arithmetic stays in the engine: React supplies per-seat policies and never
loops over money. A session created before these columns existed carries no per-seat rows, so
the store seeds its occupied seats from the session default at load, by the same rule the
server applies at creation — a legacy session cannot silently lose its top-up behaviour.
`threshold` still has no column anywhere; a seat row stores `threshold === targetStack` and
the repository refuses anything else rather than dropping a value the caller supplied.
Verified in a browser against a copy of a real database: a seat at 85.68 BB with the switch on
came back to 100 BB, a winner holding 119.08 BB with the switch off was NOT trimmed, and only
the toggled seat's row was written.

---

## ADR-0051 — A pot's winner selection replaces; a split must be armed explicitly

**Date:** 2026-08-31 · **Phase:** 7 (Alpha feedback) · **Status:** accepted

**Context.** The Alpha's award panel toggled: clicking a candidate added it to the pot's
winner list. A user who clicked the wrong seat and then the right one had ticked both, and the
engine faithfully split the pot between them. The user reported it as an "accidental split
winner". The engine's split arithmetic was reviewed and is correct — `splitPot` floors with
`Money.splitEvenly` and hands the remainder along the configured odd-chip order, and the
settlement balances. The defect was entirely in the selection UI.

**Decision.** Clicking a candidate makes it the SOLE winner of that pot. A second winner is
reachable only after arming that pot's own split control, and disarming it collapses back to
one. Candidates are labelled with the player's nickname and the engine's own position, not a
bare seat number. Submit is disabled until every pending pot has a winner.

**Consequences.** The common case costs one click and a misclick costs a second one, instead
of costing money. The submit gate is the ONE pre-check in that panel and it is about the
user's own selection — every poker judgement (`WINNER_NOT_ELIGIBLE`, `DUPLICATE_WINNER`,
`AWARDS_INCOMPLETE`) still comes back from `applyCommand`, because dispatching a
known-illegal command to read the rejection back is not a way to ask a question. The ticked
winners, the split arming and the muck marks all live in a session keyed by the hand number,
for the same reason the palette keys its picks: pot indexes restart at 0 every hand, and an
unkeyed selection would still be ticked in the next one.

---

## ADR-0052 — A showdown SHOW is a hole-card event; a MUCK is unknown information and has none

**Date:** 2026-08-31 · **Phase:** 7 (Alpha feedback) · **Status:** accepted

**Context.** The Alpha could not record what an opponent showed. `cardEntryRequest` returned
`null` at `AWAITING_AWARD`, so a showdown was settled by picking a winner and the cards were
lost. The engine already supported the write: `SET_HOLE_CARDS { revealed: true }` is valid in
any phase for a dealt-in seat.

**Decision.** SHOW nominates a seat and the existing palette asks for its two cards, emitting
`SET_HOLE_CARDS` with `revealed: true` — the hero's own entry stays `revealed: false`, and the
distinction is the engine's existing one. MUCK is recorded as local UI state and nothing else:
no cards, no command, no new engine event.

**Consequences.** A muck is genuinely unknown information, and the honest representation of
unknown information is the absence of a record — inventing an event for it would be a claim
the engine could later be asked to replay. It is per-hand and not persisted, like everything
else at this table in the Alpha. Whether a mucked seat may still be awarded a pot is
deliberately NOT decided here: that is a poker rule this project has no fixture for, so the
muck mark only stops the panel asking that seat for cards (`CLAUDE.md` rule 7). Reveal is
never required — a pot can always be awarded with nobody having shown.

---

## ADR-0053 — The UI is Korean-first; standard poker notation stays Latin

**Date:** 2026-08-31 · **Phase:** 7 (Alpha feedback) · **Status:** accepted

**Context.** The primary user is Korean and asked for a Korean interface with compact
Korean-tool density rather than English explanatory paragraphs.

**Decision.** User-visible copy is Korean, including `<html lang="ko">`. These stay in their
international form and are never translated: `BB`, `BTN` / `SB` / `BB`, `UTG` / `HJ` / `CO`,
`VPIP` / `PFR` / `3BET`, `SPR`, card ranks and suits, and the hotkey letters. A label derived
from a domain union is mapped through an exhaustive `Record<...>` typed against that union.

**Consequences.** A new engine event kind or seat status is a COMPILE error rather than a
silently untranslated string. Domain error codes and the values the user typed are still
rendered verbatim inside the Korean frame — translating an `EngineError.code` would hide the
engine's own verdict, which rule 3 forbids. E2E specs drive by `data-testid` so a behaviour
test cannot break on a copy change again, and each surface asserts its Korean copy once,
deliberately and separately.

---

## ADR-0054 — The action dock is pinned; the entry tray grows from a floor and the felt absorbs it

**Date:** 2026-08-31 · **Phase:** 7 (Alpha feedback) · **Status:** accepted

**Context.** The Alpha stacked the card palette, the award panel and the action dock at the
bottom of a `h-screen` column. The palette mounted and unmounted as a hand progressed, so the
whole bottom region jumped, and on a short viewport the dock — the primary control — was
pushed off screen. Pinning the tray to one constant height fixed the jump but created a worse
failure: the award panel is taller than the palette, and its submit button landed underneath
the dock. The one panel that moves money had its primary action half hidden.

**Decision.** `main` cannot overflow; the felt/aside row is the only elastic child; the tray
and the dock are both `shrink-0`. The tray's height is a FLOOR, not a constant: the palette
and the keyboard legend both fit inside it, so the states the user moves between constantly
change nothing below them, while the award panel grows the tray up to a cap and the extra
space comes out of the felt above — never out of the dock below.

**Consequences.** The dock is at the bottom of the viewport in every phase and at every
viewport height. Two E2E assertions pin both halves, because a layout invariant that is only
true today is not an invariant: the dock stays inside the viewport with the palette open, and
the award submit button's bottom edge stays above the dock's top edge. Both were confirmed to
FAIL against the pinned-height version before the fix landed, so neither can pass vacuously.

---

## ADR-0055 — `strategy-core` is a separate package from `gto-core`, with one adapter seam onto `poker-core`

**Date:** 2026-09-01 · **Phase:** Strategy A+B (REFERENCE engine) · **Status:** accepted

**Context.** The Strategy A+B milestone needs a deterministic, local REFERENCE strategy
engine now — calibrated from public education material, quantized, provenance-labelled,
never presented as GTO. The docs already commit `gto-core` to a different future: the
Phase 9/10 solved-solution provider surface (ADR-0016, GTO_DESIGN_NOTES notes A–G,
mock-only until Phase 14). Overloading `gto-core` with a hand-authored reference policy
would blur "solver output storage" with "our documented default rules" — exactly the
confusion CLAUDE.md rule 2 exists to prevent.

**Decision.** The REFERENCE engine lives in a new package, `packages/strategy-core`.
(a) `strategy-core` and `gto-core` are separate, mutually unaware packages; `gto-core`
remains the untouched Phase-9 placeholder. (b) `@gto-self/poker-core` is importable only
from `packages/strategy-core/src/adapter/` — the single documented seam (the analogue of
GTO_DESIGN_NOTES note F) where `buildStrategyQuery` converts engine state into a neutral
`StrategyQuery` DTO; everything outside the adapter imports `@gto-self/shared` only.
(c) The neutral DTO's string unions are declared independently, never re-exported from
poker-core, so the seam cannot silently reverse. (d) `@gto-self/player-core` is banned
from `strategy-core` entirely: player observations must never influence baseline
recommendations. (e) The import direction is one-way — `poker-core`, `gto-core`,
`player-core`, `coinpoker-parser` and `solver-lab` all ban `@gto-self/strategy-core`.
All of it is enforced in `eslint.config.js` with full pattern lists per the file's
last-match-wins discipline, and the adapter carve-out was proven by a probe that produced
the expected lint errors before being removed.

**Consequences.** `apps/web` may import `strategy-core` directly (presentation consumes
the domain, as with `poker-core`). A future Phase 9/10 `gto-core` provider can replace or
sit beside the REFERENCE engine behind the same panel without either package knowing about
the other. The ESLint block for `strategy-core` and the bans added to sibling blocks are
part of this decision; removing them is reopening it.

---

## ADR-0056 — REFERENCE strategy provenance (`SOURCE | DERIVED | HEURISTIC`), integer BPS frequencies, and 5% quantization

**Date:** 2026-09-01 · **Phase:** Strategy A+B (REFERENCE engine) · **Status:** accepted

**Context.** The REFERENCE engine produces action frequencies and sizings that are not
solver output and must never claim to be (CLAUDE.md rule 2, GTO_BASELINE.md). The
existing `MOCK` tag answers "is this real data?"; nothing yet answers "how was this
value produced?".

**Decision.** Every strategy value carries a provenance from a three-member union:
`SOURCE` (directly represented by an accepted public reference rule/table, verified
against the cited page in `docs/reports/STRATEGY_ANCHORS.md`), `DERIVED`
(deterministically mapped from a nearby reference environment/spot, with the mapping rule
documented), `HEURISTIC` (our explicit deterministic fallback; requires a mandatory
explanatory note, enforced at the type level by `Provenanced<T>`). This axis is
orthogonal to `MOCK`. Neither `DERIVED` nor `HEURISTIC` may ever be labelled GTO, and no
REFERENCE output of any provenance may be labelled GTO; the user-facing name is
기본전략 · REFERENCE. Frequencies and range weights are integer basis points 0..10000
(ADR-0016's convention applied in memory); policy-authored frequencies are quantized to
5-percentage-point steps (multiples of 500 bps) and every reached recommendation's
frequencies sum to exactly 10000. Integer apportionment uses largest-remainder with a
fixed tie-break (larger remainder, then lower index); range conditioning
(`weight × P(action|combo)`) floors at the total and redistributes the residue, never
rounds up — a conditioned range may be understated by under one basis point in total,
never overstated. Stack buckets are `[40,60) [60,80) [80,120) [120,160) [160,∞)` BB,
compared in integer milliBB; `[80,120)` is the primary reference bucket; below 40 BB is a
typed `OUT_OF_RANGE` member, not a borrowed policy. Environment mismatch (CoinPoker's
ante/rake vs the public anchors' assumed environment) is represented explicitly on every
recommendation; no numerical ante or rake range adjustment is invented in this milestone.

**Consequences.** No fake solver precision can appear in the UI (63.72% is
unrepresentable by construction for policy-authored values). A strategy number that
cannot cite an anchor is `HEURISTIC` by definition and says so. Any future storage layer
or provider must keep these integer conventions or supersede this ADR explicitly.

---

## ADR-0057 — A between-hands table preference writes `TableState` directly; a live `Hand` cannot observe it

**Date:** 2026-09-01 · **Phase:** Strategy A+B (short-handed transition) · **Status:** accepted

**Context.** The sit-out toggle (ACTIVE ↔ SITTING_OUT, the UX `S` key) must never mutate
an in-progress hand, and the next hand must deal the changed lineup. The implementing
work package had two designs: a deferred `pendingOccupancy` map applied at the next
`startHand()`, or a direct `setSeatOccupancy` write to the store's `table`.

**Decision.** Direct write, justified by engine structure rather than care: from
`HAND_STARTED` onward, `Hand.state` is a pure fold of the hand's own event log and never
re-reads `TableState`; `applyHandResult`'s `HAND_TABLE_MISMATCH` guard compares
`playerId` only, never occupancy; and while a hand is live every rendered seat fact comes
from `SeatView`, with `TableSeat.occupancy` consulted only when no hand exists. So a
mid-hand occupancy write is structurally invisible to the live hand, and "takes effect
next hand" is a display fact (the toggle shows 다음 핸드부터 while the seat is still dealt
in), not a state-machine deferral. The same argument already implicitly justified
`setSeatAutoTopUp`; this ADR makes it available without re-derivation: a between-hands
table preference may write `TableState` directly iff the live hand neither reads that
field nor is guarded on it by `applyHandResult`. Persistence follows the established
per-seat pattern — a narrow repository write of the one changed column
(`updateSessionSeatOccupancy`), synchronous store write first, unawaited save after,
sequence-guarded, with a non-reverting failure banner. `updateSessionTable` (which would
rewrite stacks — Phase 8's write boundary) is deliberately not used.

**Consequences.** 6→5→4→5 dealt-in transitions work with no reconciliation machinery.
Any future between-hands preference must re-check the two conditions (hand does not read
the field; `applyHandResult` does not guard on it) before reusing the direct-write
pattern — a field that fails either condition needs the pending-map design instead.

---

## ADR-0058 — Occupancy is not rotation state: sitting out never clears the button, and an ineligible button is advanced at deal time

**Date:** 2026-09-01 · **Phase:** Strategy A+B (R1 fixes) · **Status:** accepted, supersedes the clearing behaviour shipped with ADR-0057's work package

**Context.** `setSeatOccupancy` originally nulled `buttonSeat` when the button seat sat
out. Independent review (R1 BLOCKER-2 / MAJOR-2, corroborated by the second review's
MAJOR-1) showed two real failures: sitting the button seat out before the first deal left
a table with no button and no UI able to restore one — every Start Hand failed
`NO_BUTTON_SEAT`; and a nulled button sent `advanceButton` down its "no button yet" path,
restarting rotation at the lowest-numbered seat, so a net-zero sit-out/sit-in on the
button seat silently moved the button backwards and changed everyone's position.

**Decision.** The button is rotation state, not occupancy state. (a) `setSeatOccupancy`
mutates exactly one field — the seat's occupancy — and never touches `buttonSeat`.
(b) Eligibility belongs to `advanceButton` alone, which advances clockwise from the
current button to the next eligible seat and does so correctly even when the current
button seat is itself SITTING_OUT. (c) Preserving the button is necessary but not
sufficient: `buildStartEvents` refuses to deal off a button that is not dealt in
(`BUTTON_SEAT_NOT_DEALT_IN`), so the web store's `startHand` advances a non-null but
ineligible button via `advanceButton` at deal time — visible on screen as the BTN badge
moving, and also covering a reloaded session whose persisted button sits on a persisted
sitting-out seat. (d) A null button is NOT silently repaired: `NO_BUTTON_SEAT` surfaces
as `lastError`, pinned by test. The invariant moves from "the button is always on an
ACTIVE seat" to "the button is always on a seat that still holds a player, and must be on
a dealt-in seat only at the moment a hand is dealt."

**Consequences.** Sit-out/sit-in round trips are rotation-neutral. The occupancy-only
persistence of ADR-0057 is complete again (one field changed, one column written); the
remaining client/DB button divergence is exactly the pre-existing, documented Phase-8
"in-memory table state is not persisted" item, not a new defect. Poker-core stays free of
web policy: the deal-time advance lives in the store because poker-core's `startHand`
refusing an undealt button is correct engine behaviour — choosing to advance instead of
failing is a UI-flow decision.

---

## ADR-0059 — Completed-hand persistence reuses the Phase-3 hand tables and writes once, at `phase === 'COMPLETE'`, off the action path

**Date:** 2026-09-01 · **Phase:** C0 (history capture) · **Status:** accepted

**Context.** Phase 3 already built `hands` / `hand_players` / `hand_events` and a full
repository (`insertHand`, `loadStoredHand`, …) in `packages/db`, but nothing in `apps/web`
calls it (ADR-0043 named this Phase-8 work). The C0+C1 milestone needs durable raw history
for COMPLETED hands only; full in-progress reload/recovery stays deferred.

**Decision.** (a) Reuse the existing tables and repository — building a second hand store
would be a competing system. (b) A hand is persisted exactly once, in a single
transaction, when it reaches `HandState.phase === 'COMPLETE'` (awards, rake, fees, and
`HAND_FINISHED` are final). No mid-hand incremental `appendHandEvents` in this milestone.
(c) The trigger is a client-side observer of the COMPLETE transition firing an unawaited
server action; the synchronous action path (ADR-0043) never waits on it. (d) Exactly-once
is enforced by the DB, not the client: the `hands.id` primary key (the engine's stable
`handId` from `HAND_STARTED`) plus `UNIQUE(session_id, hand_number)`; a duplicate write
returns a typed `ALREADY_PERSISTED` no-op, never a second row. (e) A failed write
surfaces a visible banner with retry and preserves the in-memory hand; it is never
silently dropped. (f) `hands` gains an additive `source` column
(`'MANUAL_PRACTICE' | 'MANUAL_REVIEW'`, today always `MANUAL_PRACTICE`) and a
`schema_version` for forward evolution of the stored representation. (g) Final stacks are
not duplicated onto the header: the event log is authoritative (ADR-0039) and folding it
reproduces them; `finished_at` is set in the same insert transaction.

**Consequences.** An unfinished hand still disappears on reload (documented, unchanged).
Raw history for every completed hand — config, lineup, hero cards, SHOW reveals, ordered
events, awards, rake, fee — survives reload and feeds C1. Phase 8's live-hand recovery
can later add incremental appends without changing this boundary.

---

## ADR-0060 — Completed raw hands are immutable at the database level via conditional triggers

**Date:** 2026-09-01 · **Phase:** C0 (history capture) · **Status:** accepted

**Context.** ADR-0037 made manually entered player records insert-only with hand-authored
SQLite triggers. The hand tables predate C0 and have no such protection: `hands` rows are
updatable and `hand_events` rows are unguarded, while the milestone requires raw history
that cannot be silently rewritten.

**Decision.** A new hand-authored migration (same pattern as `0001_insert_only_guards.sql`)
adds: `hand_events` and `hand_players` refuse every UPDATE and DELETE; `hands` refuses
every DELETE, and refuses UPDATE on any row whose `finished_at` is already non-null
(`BEFORE UPDATE … WHEN OLD.finished_at IS NOT NULL → RAISE(ABORT)`). A future
live-persistence phase can therefore still insert a hand header early and mark it
finished once, but a finished hand is frozen. Corrections are supersession, not rewrites
(new record + explicit metadata; no correction UI in this milestone). The trigger-list
tripwire test in `packages/db` is extended to pin the new triggers.

**Consequences.** `markHandFinished` keeps working for unfinished rows and aborts on
finished ones — that abort is a bug telling us something tried to rewrite history.
Analysis and model rebuilds can trust raw history as append-only ground truth.

---

## ADR-0061 — `packages/analysis-core`: the event-log → player-observation interpreter is its own package

**Date:** 2026-09-01 · **Phase:** C1 (player learning) · **Status:** accepted

**Context.** Post-session analysis must fold poker-core event logs into player-domain
observations. The layering rules forbid `player-core` from importing `poker-core` (and
vice versa), so the interpreter can live in neither; burying a deterministic engine in
`apps/web/src/server/` would leave it untestable as a pure domain and invite drift.

**Decision.** New package `packages/analysis-core`, mirroring the `strategy-core`
precedent (ADR-0055). It may import `@gto-self/shared`, `@gto-self/poker-core` and
`@gto-self/player-core` — nothing else: never `strategy-core` or `gto-core` (a player
model must not read or influence baseline strategy — the C2 boundary), never
`@gto-self/db`, never React/Next. Only `apps/web` may import it, and no existing package
may. ESLint layering blocks enforce all of this. The package is deterministic by
construction: no clock, no RNG, no id generation — identical inputs and algorithm version
produce bit-identical outputs. `docs/ARCHITECTURE.md` carries the layering-diagram
addendum.

**Consequences.** Opportunity extraction, spot classification and snapshot computation
get the same unit-test treatment as poker math. Strategy A+B cannot observe player data
even by accident: `strategy-core` has no import path to `analysis-core` or `player-core`,
and the regression pin of ADR-0062 asserts behavioural identity.

---

## ADR-0062 — Player model snapshots are versioned all-history recomputations gated by an input-identity hash; snapshot confidence is `n/(n+K)` alongside — not replacing — ADR-0036's levels

**Date:** 2026-09-01 · **Phase:** C1 (player learning) · **Status:** accepted

**Context.** "세션 분석 및 반영" must be idempotent (a second click must not double any
count), must accumulate the same player across sessions, and must leave Strategy A+B
bit-identical. The brief's `n/(n+30)` continuous confidence weight coexists with
ADR-0036's discrete `ConfidenceLevel`, which is accepted and stays.

**Decision.** (a) Derived data lives in new insert-only tables — `analysis_runs`,
`player_model_snapshots`, `player_spot_stats` — never in `player_observations`, which
remains the manually-driven live-observation surface and is not written by analysis.
(b) A snapshot is a full recomputation from ALL eligible completed raw hands linked to
that player (`hand_players.player_id` on hands with `finished_at` set); the button's
session scope only discovers which players are affected. No incremental
`previous + delta` arithmetic. (c) Each snapshot records `analysisAlgorithmVersion` and a
deterministic `inputHash` over the sorted eligible hand ids; if both equal the player's
latest snapshot the run reports `NO_CHANGES` and writes no snapshot. Versions per player
increment monotonically and old snapshots are never overwritten. (d) An `analysis_runs`
row records scope, input identity, counts, duration and a per-player
`SUCCESS | PARTIAL | FAILED` outcome; a partial failure is reported as such, and raw
history is never touched by analysis. (e) Snapshot confidence:
`confidenceWeightBps = round(10000 · n / (n + K))` with `K = 30`, a PRODUCT HEURISTIC
(not poker truth), computed per situation from that situation's opportunity count `n`,
with display states UNKNOWN (n < 5) / LEARNING (5 ≤ n < 30) / KNOWN (n ≥ 30) — display
thresholds, configurable in one explicit config module. ADR-0036's `ConfidenceLevel`
buckets are unchanged for their existing surfaces; the two concepts are separate types
and are never converted into each other implicitly. (f) SHOW evidence comes only from
`HOLE_CARDS_SET { revealed: true }` events (ADR-0052); a MUCK contributes actions but
never cards. (g) Acceptance pin: a fixed `StrategyQuery` evaluated before and after
insert-history → analyze → snapshot must serialize bit-identically.

**Consequences.** Repeated clicks converge (`NO_CHANGES`), multi-session accumulation is
the natural consequence of all-history recomputation, and a future algorithm can delete
every derived row and rebuild from raw history. Strategy C2 — combining REFERENCE with
the empirical model — remains explicitly out of scope and has no import path today.

---

## ADR-0063 — ADAPTIVE is a composition layer above both `strategy-core` and `player-core`; `packages/adaptive-core`

**Date:** 2026-09-02 · **Phase:** C2 (adaptive player strategy) · **Status:** accepted

**Context.** C2 must produce a player-specific recommendation without letting player data
touch the REFERENCE baseline. ADR-0055 put `strategy-core` behind a hard ban on
`player-core`; ADR-0061 gave `analysis-core` the event-log→observation job and forbade
every package but `apps/web` from importing it. Neither package can therefore host the
combination, and `apps/web/src/server/` would leave the policy untestable as a pure domain
and unable to state its own layering.

**Decision.** New package `packages/adaptive-core`. It may import `@gto-self/shared`,
`@gto-self/strategy-core` and `@gto-self/player-core` — nothing else: never
`@gto-self/analysis-core` (ADR-0061 stands unamended), never `@gto-self/db`, never
`@gto-self/poker-core`, never `@gto-self/gto-core`, never React/Next. Learned-model numbers
reach it as a neutral `AdaptiveStatObservation[]` DTO that `apps/web` builds from the
persisted snapshot, so the C1 interpreter keeps its single consumer.

`computeStrategy(HandState, heroSeat, options)` does not change: ADAPTIVE is produced by a
SECOND call that takes the REFERENCE result **as a value**, never by widening the
REFERENCE entry point. The pin is behavioural — for one `HandState`, REFERENCE is
byte-identical whatever the player data is — and structural: `adaptive-core` gets its own
`tests/layering.test.ts` on the strategy-core pattern, and ESLint gains an
`adaptive-core` block plus an upward-import ban in every package below it.

**Consequences.** The ADAPTIVE policy is unit-testable as pure integer math with no
database, no clock and no RNG. A future solved-GTO baseline can be swapped under the same
composition seam. The cost is one more package and one more DTO mapping in `apps/web`;
that mapping is where every provenance decision becomes visible, which is where we want
it.

---

## ADR-0064 — The adaptive prior is a zero-adjustment anchor, not a claim about a population

**Date:** 2026-09-02 · **Phase:** C2 · **Status:** accepted

**Context.** Shrinkage needs a target: `estimate = prior·(1−c) + observed·c`. Writing a
table of "typical 6-max frequencies" risks exactly what CLAUDE.md rule 2 forbids —
hard-coded strategy percentages presented as truth.

**Decision.** Every rule in the adaptive policy fires on `estimate − prior`, never on
`estimate`. The prior is therefore defined as **the value at which a stat produces no
adjustment at all**, and that is what `ADAPTIVE_PRIORS` documents itself to be. When
confidence is zero the estimate equals the prior, every contribution is exactly zero, and
ADAPTIVE equals REFERENCE by construction rather than by a special case. Each entry is
`Provenanced<number>` at `HEURISTIC` with a mandatory note, is never labelled GTO, and is
never displayed as an opponent's expected frequency.

Confidence is `confidenceWeightBps(n, K)` — ADR-0062's own `n/(n+K)` function, imported
from `player-core`, not re-implemented — with `K` per stat rather than a single 30,
because a river check-raise and a VPIP do not accumulate opportunities at the same rate.
Manual-HUD and learned-model readings are pooled by sample weight at composition time and
BOTH survive in the output's `sources`; they are never merged in the database.

**Consequences.** The prior table can be retuned without any claim being falsified, since
its only contract is neutrality. A reader who disagrees with a prior is disagreeing about
where "no adjustment" sits, which is the honest question. The trade-off: a stat whose true
population value is far from our anchor produces an adjustment at high sample even when
the player is unremarkable — bounded by the caps in ADR-0065 and listed as a limitation.

---

## ADR-0065 — ADAPTIVE re-weights only actions REFERENCE already offered, within bounded caps, on the REFERENCE quantizer

**Date:** 2026-09-02 · **Phase:** C2 · **Status:** accepted

**Context.** An exploit layer that can move a frequency without limit is a second strategy
engine wearing the first one's numbers, and one that can invent an action can produce an
illegal or unsupported line.

**Decision.** (a) ADAPTIVE never introduces an action kind absent from the REFERENCE
action set; it redistributes mass among the kinds REFERENCE emitted. An action REFERENCE
excluded stays excluded — an accepted MVP limitation, recorded as such. (b) Total absolute
movement is capped at 2000 bps heads-up and 1000 bps multiway; each rule is capped
individually; every contribution is scaled by that stat's confidence before capping. (c)
The result is renormalized with `apportion` and quantized by **`quantizeFrequencies`
imported from `strategy-core`** — the 500-bps grid and the sum-to-10000 guarantee are the
REFERENCE engine's own function, never a copy — and the primary is re-picked with
`pickPrimaryAction`. (d) Sizing adaptation is a SEPARATE pass with a strictly higher
confidence gate (5000 bps heads-up, 7500 multiway vs 2500 for frequency), moves at most
one rung on `POT_FRACTION_BUCKETS`, and resolves to milliBB through
`potFractionToAmount` + `clampPostflopSizing` — again strategy-core's own arithmetic and
its own legality clamp, with `requestedToAmountMbb` retained per CLAUDE.md rule 3. Preflop
sizing is not adapted in the MVP. (e) Multiway: only the primary opponent's profile drives
the rules, and any positive AGGRESSION contribution is zeroed when a live opponent still to
act has an above-prior check-raise or 3-bet at confidence — increasing a bluff because the
current actor folds a lot while a known check-raiser is behind is the specific error the
brief names.

To make (d) possible without a second copy of the sizing arithmetic, the bucket→milliBB
formula is extracted from `sizingRequestFor` into an exported pure
`potFractionToAmount(input, bucket)` in `strategy-core/src/postflop/sizing.ts`. That is the
only change to `strategy-core` in this phase, it is behaviour-preserving, and the existing
postflop sizing tests passing unchanged is the proof.

**Consequences.** Every ADAPTIVE output satisfies the same structural invariants as a
REFERENCE one — legal kinds, 500-bps grid, sum 10000, legal clamped size — and is bounded
in how far it can travel from the baseline. The limitation is real and stated: a spot where
REFERENCE assigns a legal action 0% cannot be exploited at all this milestone.

---

## ADR-0066 — ADAPTIVE traces are a separate derived table; a manual HUD edit recomputes ADAPTIVE only

**Date:** 2026-09-02 · **Phase:** C2 · **Status:** accepted

**Context.** `strategy_decision_traces` records what REFERENCE said at a Hero decision
point and its `strategy_mode` CHECK admits only `'REFERENCE'`. An ADAPTIVE recommendation
is a derived object with different fields, different provenance and a different lifetime —
it depends on player data that legitimately changes after the hand is over.

**Decision.** (a) ADAPTIVE traces live in their own insert-only table
`adaptive_strategy_traces` (migration `0007`, two triggers, added to both tripwires),
carrying the baseline, the adapted recommendation, the per-action frequency delta, the
sizing delta, the policy version, the primary villain, the manual-HUD snapshot ids and the
learned-model snapshot ids/version, and the full per-rule adjustment audit including sample
n, confidence, source and reason. `strategy_decision_traces` is not widened and its
`REFERENCE`-only CHECK stands. (b) A trace is a SNAPSHOT of what was known when it was
written. Editing a HUD afterwards does not rewrite any existing trace, any hand event, or
any completed hand — the insert-only triggers make that structural rather than a
convention. (c) Live editing: a HUD save refreshes the neutral profile inputs and
recomputes the ADAPTIVE composition for the current Hero decision **without recomputing
REFERENCE**. That is affordable because the composition is pure integer math over a handful
of arrays — no equity, no ranges — so it runs in render, while REFERENCE keeps the
`setTimeout(0)` scheduling and the `hand`-identity dependency it already had.

**Consequences.** Two traces for one decision point tell the truth about two different
questions and can never be confused. The same composition function serves the live panel
and the post-hand trace generator, so a trace cannot drift from what the user saw. A
manual HUD write and an analysis run remain fully independent record types, each writing
its own new row and mutating nothing of the other's.

## ADR-0067 — `EXTERNAL_HUD` is a new opponent-evidence source with fixed confidence and per-stat precedence; generic street-blind stats also feed the per-street policy keys

**Date:** 2026-09-03 · **Phase:** WP-K · **Status:** accepted

**Context.** The user has 13 real players' **lifetime** stats from a third-party HUD they
run outside this app (screenshots, bulk-imported once — see
`EXTERNAL_ADAPTIVE_PROFILE_IMPORT.md`). This is not a casual, in-session manual HUD entry
(ADR-0046's `MANUAL_HUD`, capped at 33% confidence by `manualHudSampleCap` regardless of
the hand count typed) — it is an established read the user trusts, but with a genuinely
unknown hand count (`sampleN` is `null`, never invented, per CLAUDE.md rule 2). The source
also reports three stats (Cont-Bet, Fold-to-C-Bet, Check/Raise) with no street breakdown,
where every existing WP-J frequency/sizing rule selects on a PER-STREET key
(`CBET_FLOP/TURN/RIVER` etc.).

**Decision.** (a) A third `AdaptiveStatSource`, `EXTERNAL_HUD`, sibling to `MANUAL_HUD`
and `LEARNED_MODEL`, backed by its own insert-only table pair
(`player_external_hud_snapshots` / `_stats`) rather than widening `player_hud_snapshots`
— ADR-0046 stands. (b) A fixed confidence constant,
`EXTERNAL_HUD_CONFIDENCE_BPS = 9000` (`priors.ts`) — a POLICY choice ("an established
lifetime read is trusted close to fully, not treated as certain, because the true n is
unknown and drift cannot be ruled out"), not a statistical estimate derived from a sample
size that does not exist. (c) Per-stat PRECEDENCE: when an `EXTERNAL_HUD` observation
exists for a stat, `profile.ts`'s `estimateFor` uses it ALONE at the fixed confidence and
skips pooling `MANUAL_HUD`/`LEARNED_MODEL` for that stat only; every other stat pools
exactly as WP-J already did. (d) Three new `AdaptiveStatKey` members,
`CBET_ANY_STREET` / `FOLD_TO_CBET_ANY_STREET` / `CHECK_RAISE_ANY_STREET`, hold the
generic reading verbatim — never aliased onto a per-street key at storage time, so the
generic nature is never silently claimed to be street-specific (CLAUDE.md rule 3's
"never destroy user input" extended to "never destroy what the input actually says").
(e) Because no rule selects on those three keys, `adaptive-service.ts`'s
`externalHudObservations` ALSO fans a generic reading out to all three of its per-street
`AdaptiveStatKey`s (e.g. `FOLD_TO_CBET_ANY_STREET` → `FOLD_TO_CBET_FLOP` /`_TURN`/`_RIVER`,
all three `EXTERNAL_HUD`-sourced, same value) — otherwise three of the ten imported stat
categories would be stored and displayed but reach no rule at all, defeating this WP's own
purpose. This is an honest reading of "no street breakdown available" (apply the one
number everywhere), not a guess at a street-specific number, and it inherits (d)'s
per-stat precedence rule rather than introducing a new one.

**Consequences.** An external profile can move BOTH frequency and sizing on every street a
rule already covers, immediately, at high (but not absolute) confidence, without a manual
HUD's sample-based confidence cap ever applying to it. A player never bulk-imported is
unaffected — WP-J's exact behavior holds. `STEAL` (this player's own steal-open rate) and
`FOLD_BB_TO_STEAL` (the response a DIFFERENT seat gives to a steal) remain two distinct
stats; the external HUD supplies only the former, so no steal-defense rule can ever fire
from external data alone — recorded as a known, tested limitation in
`externalProfile.golden.test.ts`, not silently absorbed.

## ADR-0068 — ADAPTIVE's display grid moves from REFERENCE's 5% to 1%, without touching the frequency pipeline's arithmetic; `log-odds`/softmax renormalization is explicitly not adopted

**Date:** 2026-09-03 · **Phase:** WP-K · **Status:** accepted

**Context.** `prompt` §5 asks ADAPTIVE round to whole percent (1%) instead of REFERENCE's
5% grid, computed "as real math." §6 separately asks that a hand-strength band interact
with an opponent stat rather than one flat slope, and asks the team to "consider"
(검토한다, not mandate) a more continuous, log-odds/softmax-style model.

**Decision.** (a) Only the quantization step moves. `quantizeFrequencies` in
`strategy-core` becomes a thin 500-bps-pinned wrapper over a new
`quantizeFrequenciesToGrid(values, stepBps)`; every REFERENCE call site is unchanged and
byte-identical (confirmed: the full 783-test `strategy-core` suite passed unmodified).
`adaptive-core`'s `policy/frequency.ts` sets its own `GRID_STEP_BPS = 100` and calls the
new function; `trimToCap`'s post-quantization safety net (unchanged logic, parameterized
step) moves in 100-bps units instead of 500. (b) The gain → confidence-scaling →
per-rule-cap → limiter → pro-rata-transfer → normalize pipeline is UNCHANGED. It already
computes a continuous, signed `estimate - prior` deviation in integer bps and only rounds
once, at the very last step; §6's underlying goal (a band interacting with a stat, not one
global slope) is already structural via every rule's `bands` + `direction` fields.
Rewriting this into a logit/softmax renormalization was considered and rejected: it would
mean touching independently-reviewed (review R1), MAJOR-bug-hardened arithmetic for a
"consider" ask, for a system that in practice sees 1-3 simultaneous rule contributions —
where closed-form linear pro-rata under a hard cap is not obviously worse than a
renormalized alternative, and is far cheaper to keep correct. §5's actual hard requirement
(1% output) is met without it.

**Consequences.** Every ADAPTIVE-side literal pinned to the old 500-bps grid needed
migrating to its exact 100-bps equivalent (`compose.test.ts`, `cap.test.ts`,
`invariants.test.ts`, and two `apps/web` tests) — each new literal was read from a live
`composeAdaptive` run against the same fixture, not re-derived by hand, and every
invariant (sum = 10000, no new illegal action, determinism, global cap survives
quantization) was re-verified at the finer grid rather than assumed. Full detail and every
recomputed literal: `EXTERNAL_ADAPTIVE_MATH_CALIBRATION.md`.

## ADR-0069 — The external HUD profile is a UI section and a DB table separate from the manual HUD, never merged

**Date:** 2026-09-03 · **Phase:** WP-K · **Status:** accepted

**Context.** `PlayerProfilePanel` already shows one manual HUD section ("최근 HUD"). A
naive addition would merge the external profile's 10 stats into the same list, since
several keys overlap in spirit (`VPIP`, `PFR`, `WTSD`...).

**Decision.** The external profile renders as its own, clearly-labelled section
("외부 HUD (전체 기간)"), never interleaved with the manual HUD list — mirroring
ADR-0067(a)'s DB-level separation and this WP's precedence rule at the composition layer.
A stat the source never reported renders `EXTERNAL_HUD_UNKNOWN_LABEL` ("알 수 없음"), not
`0%` or a blank row, matching K1's storage rule that an unreported stat is an ABSENT row,
never a zero. `apps/web/src/lib/table/copy.ts`'s `EXTERNAL_HUD_GLOSSARY` gives all 10
categories a plain-Korean definition (`prompt` §9's exact text), shown inline in the panel
— never tooltip-only, per that section's own instruction. The ADAPTIVE reason list's
per-rule label (`ADAPTIVE_RULE_LABEL`, already phrased as "관찰 → 반영") is rendered as a
second, visible line under each reason row instead of only a hover `title`, for the same
reason.

**Consequences.** A user comparing "what I typed" against "what the bulk import brought
in" can always tell which is which, and a future manual-HUD-vs-external disagreement is
visible rather than silently blended into one number.

## ADR-0070 — An opponent read that de-escalates a bluff must not also de-escalate a value bet: aggression-down rules are band-scoped

**Date:** 2026-09-03 · **Phase:** WP-K follow-up · **Status:** accepted

**Context.** WP-K's golden fixtures showed a STRONG hand being bet LESS often than
REFERENCE against both external profiles — Shadow7 `CHECK 46 / BET 54` and acn1977
`CHECK 51 / BET 49` against a REFERENCE of `CHECK 40 / BET 60` — while the same opponents
folded to a c-bet only 26% and 24% of the time. "This opponent never folds, so bet your
strong hand less often" is not a poker claim we hold.

Two causes compounded. First, `FOLD_TO_CBET_LOW` carried `bands: null` and
`CHECK_RAISE_HIGH` carried all three bands, so both aggression-DECREASING rules read a
VALUE hand. Second, the §9 guard rail (ADR-0065(e)) zeroes every POSITIVE aggression
contribution while a live opponent with an above-anchor `THREE_BET` or `CHECK_RAISE` is
still to act — which is exactly the shape of every external profile at this table. The
value-INCREASING rule (`WTSD_HIGH_VALUE_UP`) was therefore zeroed in the same spot in which
the value-DECREASING ones were applied in full. The net could only ever point down.

**Decision.** The de-escalating rules are scoped to the hand classes they are actually
about, and the value half of the fold-to-c-bet read becomes its own rule:

- `FOLD_TO_CBET_LOW`: `bands: null` → `['MARGINAL', 'WEAK']`. Unchanged gain (4000) and
  ceiling (1000).
- `FOLD_TO_CBET_LOW_VALUE_UP`: NEW. `['VALUE']`, `BELOW_PRIOR`, `INCREASE` on `AGGRESSION`,
  gain 3000, ceiling 800 — one notch under its bluff twin for the reason
  `WTSD_HIGH_VALUE_UP` already gives: against a station the interesting change is the SIZE,
  and `SIZE_STATION_VALUE_UP_FOLD` already carries that read with a full rung.
- `CHECK_RAISE_HIGH`: all three bands → `['MARGINAL', 'WEAK']`. The sizing pass had already
  stated the correct reasoning for the SAME stat since WP-J — `SIZE_CHECK_RAISE_DOWN`'s own
  note reads "a VALUE hand facing a check-raiser wants the opposite treatment — being
  raised is the good outcome" — so this removes a contradiction between the two passes
  rather than introducing a new claim.

The §9 guard rail is NOT touched. It remains the engine's hard refusal to escalate into a
known aggressor with cards behind, and it is why a value hand against a still-to-act
external profile now lands exactly ON REFERENCE rather than above it: the engine will hold
a value bet, but it will no longer cut one.

**Falsifying evidence.** A worked spot in which betting a VALUE hand less often against an
opponent who folds to c-bets below the anchor is the higher-EV line, or a review that shows
the guard rail should exempt the VALUE band. The second is a live question this ADR
deliberately leaves open — see `EXTERNAL_ADAPTIVE_SANITY_FOLLOWUP.md` §6.

**Consequences.** Thirteen frequency rules instead of twelve. Golden spots 4 and 7 now
return ADAPTIVE ≡ REFERENCE for both fixtures (all contributions held by the guard), and a
new golden spot 9 — the same STRONG hand with the villain having already acted — shows the
value rules moving the mix as intended (Shadow7 `RAISE 50% → 52%`).

## ADR-0071 — `WSD` is a secondary signal that can withhold a sizing rung, never a primary one that adds one

**Date:** 2026-09-03 · **Phase:** WP-K follow-up · **Status:** accepted

**Context.** WP-K §7 added `SIZE_WINNER_VALUE_UP`: `WSD` above its anchor sized a VALUE bet
up one rung. The reading behind it does not hold. A high `WSD` says the opponent WINS the
showdowns they reach — a statement about the strength of their showdown range, not about
how often they call. If anything it points the other way: a player who only shows down
strong hands is harder to extract from, not easier. The rule also contradicted `WSD`'s own
anchor note in `priors.ts`, which has said since WP-J that "unlike every other stat here we
have no directional opinion at all about this one".

**Decision.** `SIZE_WINNER_VALUE_UP` is REMOVED. `WSD` keeps a role, but a strictly weaker
one: a new optional `suppressedWhen` field on `AdaptiveSizingRule` names a SECONDARY stat
whose reading can WITHDRAW support from a rule, never create it. `SIZE_STATION_VALUE_UP`
(the `WTSD` station size-up) carries the only instance: `{ stat: 'WSD', direction:
'ABOVE_PRIOR' }`.

The poker argument is disambiguation, not a new directional claim. A high `WTSD` has two
readings — the station who calls too wide and loses, and the strong player who gets there
with hands that win — and `WSD` is the stat that separates them. An opponent above BOTH
anchors is not evidently the player `SIZE_STATION_VALUE_UP` was written about, so the extra
rung is withheld. `SIZE_STATION_VALUE_UP_FOLD` is deliberately NOT suppressed: fold-to-c-bet
is measured directly against hero's bet and needs no disambiguating, so a genuine station
still gets sized up through the more direct signal.

Three safety properties are stated in the type and pinned by tests: a suppressor can only
remove a rung, it is held to the same confidence gate as the primary signal (a rule may not
be held back by evidence we would have refused to act on), and an absent secondary reading
suppresses nothing — `deviationBps === 0` never matches a direction.

**Falsifying evidence.** A fixture in which a high `WSD`, on its own, identifies an opponent
who calls larger value bets more often.

**Consequences.** Four sizing rules again, not five. `AdaptiveReasonKey` keeps
`OPPONENT_WINS_SHOWDOWNS`, now carried by the secondary signal rather than by a rule. A new
`SIZING_SECONDARY_SIGNAL_WITHDRAWN` note names the suppressed rule in its `detail`, so
"why did the size not move" stays answerable on screen. Shadow7 (WSD 53%) loses the WTSD
size-up in the golden fixtures; acn1977 (WSD 43%) keeps it.

## ADR-0072 — A street-blind external reading is a stand-in, and yields to any per-street reading with a real denominator

**Date:** 2026-09-03 · **Phase:** WP-K follow-up · **Status:** accepted

**Context.** ADR-0067(e) fans one street-blind external `CBET` / `FOLD_TO_CBET` /
`CHECK_RAISE` reading out to all three per-street keys, because no WP-J rule selects on the
`*_ANY_STREET` keys themselves. ADR-0067(c) gives `EXTERNAL_HUD` per-stat precedence over
`MANUAL_HUD` and `LEARNED_MODEL`. Composed, those two produced a result neither intended: a
single lifetime "Check/Raise 17%" silently overriding a `CHECK_RAISE_RIVER` this app
measured itself over real river opportunities — a proxy beating direct evidence, which
inverts the reason the precedence rule exists.

**Decision.** The fan-out is a STAND-IN and is treated as one. In
`apps/web/src/server/adaptive-service.ts`, the two directly-measured sources are collected
first; a fanned-out per-street observation is then written only for keys NOT already covered
by a `MANUAL_HUD`/`LEARNED_MODEL` reading with `sampleN > 0`. The two are never both applied
to one key, and the losing reading is never written at all rather than written and outranked
— a reading that did not contribute must not appear in the trace as if it had.

`sampleN > 0` is the test, not mere presence of the key: a HUD snapshot with no hand count
or a learned stat with no opportunities yet is present but weightless, and letting it take a
key away from the stand-in would replace a usable proxy with nothing.

Two things are deliberately unchanged. The `*_ANY_STREET` key is ALWAYS written, whether or
not it also reached a rule — that is the reading as reported, and the profile panel shows
it. And precedence for the stats the source genuinely reports per-stat (`VPIP`, `WTSD`,
`FOLD_TO_THREE_BET`…) is exactly ADR-0067(c), untouched.

**Consequences.** Every fanned-out observation carries
`EXTERNAL_HUD_GENERIC_APPLIED_PER_STREET_NOTE` — "외부 HUD 전체 통계 · 스트리트 구분 없음
(모든 스트리트에 동일 적용)" — which `StrategyPanel`'s reason row already renders verbatim,
so a river check-raise number can never read on screen as a river-specific measurement.
Pinned by four tests in `adaptive-service.test.ts` against a real migrated database.

---

## ADR-0073 — A lineup correction rebases the current hand at the same hand number; it is not a skip

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (WP-1/2/6) · **Status:** accepted

**Context.** ADR-0057 made a between-hands table preference write `TableState` directly and
left a live `Hand` unable to observe it — sitting a seat out took effect "from the next hand".
Hands-on use falsified the premise. When the user marks a seat away they are not expressing a
preference about future hands; they are reporting that **the lineup they already typed in is
wrong**: that seat is not at the table right now, so the blinds, the positions and the action
order currently on screen are wrong too. Waiting a hand does not correct anything — it plays
out one more hand against a lineup the user has already said does not exist. The same is true
of replacing the player in a seat and of moving the button.

`prompt` also draws a line the codebase did not have: correcting an input the user got wrong
is a different event from a hand that really happened and was not fully observed. Conflating
them corrupts the audit trail in both directions — a correction that rotates the button
desynchronises the table, and a real skip that does not rotate it desynchronises it the other
way.

**Decision.** Occupancy change, player replacement and button reassignment, while a hand is
live, all go through ONE atomic store transition: **rebase**.

Rebase discards the in-progress hand entirely and re-deals from the corrected lineup at the
**same `handNumber`, with no button rotation** (except where moving the button was itself the
correction). The unfinished hand is never persisted, never audited in `skipped_hands`, never
observed for player learning, and produces no strategy trace. Blinds, antes, positions, action
order and both strategy readings are re-derived by the ordinary deal path — nothing is
recomputed by hand.

The in-progress hand is **never partially mutated**. Splicing a seat out of an event log that
already contains posts, actions, and possibly board cards would produce a hand whose arithmetic
still balances but whose history never happened. Everything is discarded and rebuilt.

A rebase that cannot re-deal (fewer than two dealt-in seats, no eligible button) keeps the
corrected table, leaves no hand in progress, and reports the engine's own refusal. The error is
not swallowed and no lineup is invented to make the deal succeed.

**Consequences.** Supersedes ADR-0057 for these three transitions only; auto top-up and other
genuine preferences keep ADR-0057's semantics. ADR-0058 is untouched — rebase still never
rotates or clears the button, which is exactly what that ADR requires. No confirmation dialog:
the correction is cheap, the discarded hand was wrong by the user's own statement, and a prompt
on every seat fix would defeat the purpose. The user sees one dismissible line saying the hand
was rebuilt, so a discarded hand is never silent.

---

## ADR-0074 — Quick Next Hand: a folded seat's stack is exactly known; every other dealt-in seat is dirty

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (WP-4) · **Status:** accepted

**Context.** Hero folds early and the rest of the hand is of no training value. The user wants
to move on without inventing the actions they did not watch. The existing Skip Hand advanced the
button and the hand number, wrote a `skipped_hands` audit row, and marked **every** dealt-in seat
"확인 필요" — because it settled nothing at all, so every dealt-in stack still held its pre-hand
value. Correct, but it makes the user retype five stacks after every fold, which is the cost that
stops the feature being used. `prompt` asked for the accounting to be reviewed rather than assumed.

**Decision.** The review's result, which is a fact about the engine and not a preference:

- A seat that has **FOLDED** at skip time has an exactly-known ending stack: its whole
  contribution this hand (blinds and antes included) is in the pot and can never come back. The
  uncalled-bet return goes only to the last aggressor, who by definition has not folded. So its
  stack is `startingStack − totalContribution`, taken from the engine's own numbers via `Money`.
  It is **not** dirty.
- Every other dealt-in seat — still live, or all-in — has an unknown outcome and **is** dirty.
- A seat that was not dealt in is untouched.

There is no hero exception. Hero folded means hero is computed exactly; hero still live means
hero is dirty like anyone else.

The audit row records **why**, through a new nullable `skipped_hands.reason`
(`QUICK_SKIP` | `HERO_FOLDED_UNOBSERVED`, additive migration `0009`). The reason is derived from
the view — hero dealt in and folded gives `HERO_FOLDED_UNOBSERVED` — not picked from a menu, so
it cannot disagree with what actually happened. Rows written before `0009` keep `NULL`, meaning
"no reason was recorded", never a back-filled guess.

**Consequences.** Chips leave the table: the folded seats' contributions are removed from their
stacks while the pot they went into is discarded rather than awarded. That is the honest
representation of "the rest of this hand was not observed", it is confined to the in-memory
table, and it resolves the moment the user resyncs the dirty seats. Nothing durable is polluted —
a quick-skipped hand is never a `hands` row, never a player observation, never a strategy trace.

Exactly one button rotation and exactly one `handNumber` increment per quick skip, which is what
separates this from ADR-0073's rebase.

---

## ADR-0075 — The session's seat state is persisted at every between-hands boundary

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (WP-5) · **Status:** accepted

**Context.** `updateSessionTable` has existed in `packages/db` since Phase 3 and was called from
nowhere in `apps/web`. Stacks, occupancy and the button advanced in memory only, and a reload
returned the session to its configured stacks — listed in `docs/STATE.md` as a known issue since
the Alpha. WP-5 requires a corrected stack to survive a reload, which cannot be true while that
seam is unwired.

**Decision.** Seat state is written back at every **between-hands** boundary: a manual stack
correction, an occupancy change, a player replacement, a button reassignment, and the settlement
that happens when the next hand starts or a quick skip completes.

The write is narrow rather than a whole `TableState` over the wire. `packages/db` gains
`updateSessionSeats` (occupancy, player, stack — never the auto top-up columns, never the session
config or hero seat) and `updateSessionButtonSeat`, matching the shape of the existing
`updateSessionSeatAutoTopUp` / `updateSessionSeatOccupancy` updaters. A session or seat that does
not exist is `NOT_FOUND`, not a silent no-op.

`hands`, `hand_events` and every analysis snapshot are **never** rewritten. A completed hand's
stored stacks are history and stay exactly as they were recorded.

`sessions.hand_number` keeps its existing owner: `insertCompletedHand` advances it inside the
hand's own transaction and `loadSessionView` reconciles against the highest stored hand number.
This decision does not add a second writer for it.

The posture matches the persistence already in the app: the write is unawaited, a failure never
reverts what is on screen and never blocks play, and a failure is shown rather than hidden.

**Consequences.** Closes the long-standing "stacks are not persisted across hands" gap as a
side effect of WP-5, because the same boundary carries both. A quick-skipped hand number is not
persisted, so a reload immediately after a quick skip may reuse that number; the number was never
claimed by a stored hand, so nothing collides. In-progress hands remain memory-only (ADR-0059) —
this is seat state between hands, not live-hand recovery.

---

## ADR-0076 — Typed HUD numbers enter through `EXTERNAL_HUD` semantics, and a player may hold only one seat per session

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (WP-2/3) · **Status:** accepted

**Context.** WP-K built `EXTERNAL_HUD` as a bulk import path (ADR-0067/0069): lifetime scope,
fixed confidence, `sampleN` always `null`, an absent stat is an absent row, insert-only. The user
now needs to type those same ten numbers for one player, at the table, in seconds — while
replacing a seat's player or fixing a stale read. `prompt` states the requirement directly: reuse
the existing `EXTERNAL_HUD` / `LIFETIME` semantics.

**Decision.** A hand-typed profile is an `EXTERNAL_HUD` snapshot, identical in kind to an imported
one and distinguishable only by its import batch. It therefore carries ADR-0067's fixed
confidence and per-stat precedence, deliberately and on the user's instruction: these are numbers
the user is reading off their own HUD, not a guess this app made.

Editing is **append, never update**. A correction writes a NEW snapshot; ADAPTIVE reads the
latest one. The insert-only triggers are not worked around, the previously entered text is never
overwritten (`CLAUDE.md` rule 3), and every value the user typed stays readable.

A blank field is an **absent row**. It is never stored as zero and never displayed as one.

Player identity reuses `resolvePlayer`'s existing normalize-then-reuse path — a nickname that
already exists is the same player, never a duplicate. **One player may occupy at most one seat in
a session**, enforced by the server action as the authority and mirrored in the dropdown as a
disabled option with a stated reason. Two seats holding one player would make the adaptive
lineup ambiguous and is already refused by `loadAdaptiveOpponentInputs`.

Saving recomputes **ADAPTIVE only**. REFERENCE is bit-identical across a HUD edit — the same
guarantee ADR-0066 makes for a manual HUD edit, extended to this path.

**Consequences.** A typed number outranks this app's own learned model for that stat, at 9000 bps
confidence. That is ADR-0067's existing trade-off, now reachable from the table in one edit
rather than only from a bulk import, so it is easier to reach by accident; the profile panel
shows the source of every reading, and appended history means a wrong entry is corrected by
appending, never by rewriting.

---

## ADR-0077 — Hero's decision leads the right column; selecting a seat opens a drawer and never replaces the strategy

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (WP-9) · **Status:** accepted

**Context.** `rightPanelFor` gave an explicit seat selection priority over hero being on the
clock, on the reasoning that "a panel the user opened must not be closed by the engine". In use
that produced the opposite complaint: clicking a seat to check who you are up against removes the
strategy you clicked it in order to interpret, exactly when you need both. `prompt` states it as
a rule — the strategy must not disappear because a seat was clicked.

**Decision.** While hero is the actor, the two strategy readings lead the right column. A
selected seat renders its profile as a **secondary drawer under the strategy**, not in place of
it. When hero is not the actor, a selected seat leads as before; with neither, the column falls
back to action history. `rightPanelLayoutFor` returns `{ lead, drawer }` and there is no path in
which a seat selection removes the strategy from the screen.

The same pass removes the REFERENCE/ADAPTIVE mode tabs. Both readings are always on screen during
a hero decision, with the deltas the domain already carries (`AdaptiveAction.deltaBps`,
`AdaptiveSizing.bucketDelta` and its from/to amounts) rendered as differences rather than left for
the reader to compute by flipping between two tabs. With no opponent evidence the ADAPTIVE
section says so and states that it equals REFERENCE; it never shows an invented statistic.

**Consequences.** Supersedes the priority argument written into `rightPanel.ts`'s header, whose
first premise — that the engine would be closing a panel the user opened — no longer applies now
that nothing is closed. `Esc` keeps clearing the selection. The right column is denser during a
hero decision, which is the moment density is worth paying for. The `strategy-mode-*` test ids
are gone and their E2E coverage is rewritten to assert the stronger property: both sections
visible at once.

---

## ADR-0078 — A stack correction is a lineup correction: mid-hand it rebases, and an unverified stack stays unverified across a reload

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (review round R1) · **Status:** accepted

**Context.** Two independent reviews reproduced the same defect from opposite directions.
ADR-0073 routed occupancy, player and button corrections through rebase but left the stack out,
so `correctSeatStack` stayed a direct `TableState` write that "never touches hand/view". Nothing
gated it on a live hand, and `TableRoot` persists a corrected stack immediately. The result:

- Mid-hand, the seat renders `view.stack` (what is left inside the hand) while the editor is
  seeded with `table.stack` (the pre-hand number), so the value shown and the value edited are
  different numbers.
- The correction changes nothing on screen, and at the next settlement `applyHandResult` — or
  `skipHand`'s folded-seat arithmetic — overwrites it from the hand's own `startingStack`. The
  number the user typed is destroyed by a derived one, which is exactly what `CLAUDE.md` rule 3
  forbids, and the derived number is what survives the reload.

A second, quieter version of the same problem: after a quick skip the still-live seats carry
unverified pre-hand stacks and are marked 확인 필요, and those numbers **are** persisted while the
dirty mark is memory-only. A reload therefore renders unverified money with no warning on it.

**Decision.**

**(a) A stack is part of the lineup.** Correcting it while a hand is live goes through the same
rebase as ADR-0073's other three corrections: the hand is discarded and re-dealt at the same
`handNumber` from the corrected stacks. Blinds, effective stacks, SPR and both strategy readings
follow from the corrected number instead of contradicting it. Between hands nothing changes —
that path was already correct, and it is the one the dirty-seat sweep uses.

**(b) An unverified stack is persisted as unverified.** `session_seats` gains an additive
`stack_unverified` flag (migration `0010`), written and restored with the seat. A reload brings
back the 확인 필요 badge instead of presenting an unconfirmed number as confirmed. The flag is
cleared exactly where the in-memory mark is cleared: when the user states the stack.

**(c) A deal-time button advance is announced.** ADR-0058(c) advances a button that is not dealt
in, and rebase reaches that rule mid-hand, so sitting the button seat out moves the button and
sitting it back in does not move it back. The rule is not changed — one deal rule, not two — but
the rebase notice now names the new button seat when it moved, and `[버튼으로 지정]` (WP-6) is the
documented way back. Silent is the only unacceptable option here.

**Consequences.** A mid-hand stack fix costs the in-progress hand, which is the same trade ADR-0073
already makes for the other corrections and is correct: a hand dealt from a wrong stack was wrong
from the deal. `stack_unverified` is the second per-seat column added by an additive migration
(after ADR-0045's auto top-up), and it follows that precedent rather than inventing a new store.

---

## ADR-0079 — "New player" means new: a nickname that already exists is refused, not silently reused with a partial profile

**Date:** 2026-09-03 · **Phase:** Hands-on Table UX V2 (review round R1) · **Status:** accepted

**Context.** ADR-0076 made nickname reuse the identity rule — a nickname that already exists is the
same player, never a duplicate — and that is right for the session-setup form it was written for.
Composed with WP-2's `새 플레이어 추가` control it produced a data-degrading path that a review
reproduced against a real database: typing an existing nickname under `새 플레이어 추가` reuses that
player, and the two or three stats typed are appended as a NEW external HUD snapshot. Because
ADAPTIVE reads the latest snapshot whole and never merges per key (ADR-0069), a ten-stat profile
silently collapses to the handful just typed. The caller never read `createdPlayer`, so the user
was not told the "new" player was an existing one.

**Decision.** The two intents are separated at the API, not left to coincide. A request made under
`새 플레이어 추가` carries `requireNew`, and a nickname that normalizes onto an existing player is
**refused** with a code that names the match. The UI says so and points at the picker, where
choosing that player keeps their full profile and WP-3's pre-filled editor is the correct place to
change a number.

Reuse-by-nickname is unchanged everywhere it was already right: session setup, the bulk import, and
picking an existing player from the roster. What is refused is only the combination of "create a new
player" with a name that is not new.

**Consequences.** One extra step in the rare case where the user types a name that already exists —
paid to remove a silent loss of nine stats from an opponent model that drives real recommendations.
The refusal is recoverable and states the fix. Snapshot history was never lost (insert-only), but a
degraded _effective_ profile is what ADAPTIVE actually reads, so preserving history was not enough.

---

## ADR-0080 — FishTilt's prose is MDX; its structure is typed TypeScript

**Date:** 2026-09-04 · **Phase:** FishTilt WP-G (content system) · **Status:** accepted

**Context.** FishTilt ships roughly 100 authored pieces — 15 lessons, 20 blog answers, ~45 glossary
terms, 20 starting-hand pages — and its stated differentiator is that a tool is embedded *inside*
the article rather than linked from the end of it (build spec §28). Two things therefore have to be
true at once: prose has to be pleasant to write at that volume, and the internal-link graph has to
be machine-checkable, because the build spec requires tests that no content id, tool route or lesson
prerequisite dangles (§67).

Neither format gives both. Frontmatter strings in Markdown are not type-checked, so a graph built
from them can only be validated at runtime. TSX articles are fully typed but wrap every Korean
paragraph in a tag, which is a real cost across 100 pieces.

There was also a live technical doubt rather than a preference. This app runs `moduleResolution:
nodenext` under Turbopack — the constraint `apps/web/tsconfig.json` documents at length — and it is
already known that `next/link` does not resolve here. Whether an MDX pipeline would work at all was
an open question, not something to assume.

**Decision.** Prose lives in **MDX** (`@next/mdx`); structure lives in **typed TypeScript
registries**, joined by slug. The registry holds ids, relations, levels and the `indexable` flag and
is what the graph tests read; the MDX file holds only the writing and a fixed allow-list of
interactive components.

The doubt was settled by building it rather than reasoning about it. A spike confirmed that MDX
compiles under this app's `nodenext`/Turbopack configuration, that a React component imported with
the app's `.js` extension convention renders inside the prose, and that the resulting route still
**prerenders as static content** — which is the property the whole public-site placement depends on.
The spike was removed once it had answered the question.

**Dependencies added,** with licences read from the packages' own LICENSE files rather than from a
badge, per ADR-0015: `@next/mdx` (MIT), `@mdx-js/loader` (MIT), `@mdx-js/react` (MIT), `@types/mdx`
(MIT). All four are permissively licensed, compatible with a closed-source product, and none is on
the blocklist. Nothing is vendored, so no notice reproduction is required.

**Consequences.** `apps/fishtilt/next.config.ts` gains `pageExtensions` and the MDX wrapper, and the
app gains a root `mdx-components.tsx`. Content authors write Markdown; the link graph stays a
compile-time and test-time artefact rather than a runtime hope. MDX is trusted repository content
only — never remote, never user-supplied — so the usual MDX injection surface does not exist here
(build spec §79). The cost is one more build dependency in a repository that has deliberately kept
few, accepted because the alternative taxes the single largest work stream in the build.

## ADR-0081 — The bet count that makes a "3-bet": the big blind is the first bet

**Date:** 2026-09-05 · **Phase:** FishTilt WP-H/WP-I (content) · **Status:** accepted

**Context.** FishTilt teaches the term `3-Bet` in a lesson (`/learn/3-bet`), a glossary entry
(`term-three-bet`) and a blog answer whose entire subject is why the name has a 3 in it. All three
have to state *how the bets are counted*, and CLAUDE.md rule 7 forbids inventing poker behaviour:
when a rule is unclear, the assumption is documented here and surfaced, not quietly encoded in
prose. This repository documented the convention nowhere, and `poker-core` does not model it — the
engine tracks wagers and raises, not the colloquial name a raise is given.

Without a recorded convention, three Korean pages would each have asserted a counting rule on their
author's own authority, and nothing would have made them agree.

**Decision.** FishTilt counts **increases in the amount owed**, not voluntary actions:

1. the big blind's forced post is the **first** bet,
2. an opening raise is the **second**,
3. the first re-raise of that open is therefore the **third** — a **3-bet**,

and the count continues upward (4-bet, 5-bet) for each subsequent raise. A call does not advance
the count, because it does not increase the amount owed. This is scoped to preflop, which is where
the pages use it.

This is the ordinary hold'em convention, not a house rule and not a strategy claim. It says what a
raise is *called*; it says nothing about which hands to use, how often, or whether any of it is
correct play — FishTilt has no verified strategy data and `/learn/3-bet` says so explicitly in a
callout rather than filling the gap.

**Why the big blind counts even though it is forced.** Because the thing being counted is the size
of the live wager, not the willingness of the player who posted it. The big blind is the first
amount anyone owes in the hand, so it is the first step of the ladder. This is the part beginners
find arbitrary, so the lesson states the reasoning rather than the rule alone.

**Consequences.** The three pages state one convention and agree with each other. A competing count
— treating the open as the first bet, which some casual sources use — may not be presented as
equally standard without a cited source, per CLAUDE.md rule 2's prohibition on presenting unsourced
numbers as settled. If such a source appears, that is the falsifying evidence this ADR names, and
the convention is revisited here rather than patched in an article.

`poker-core` is unaffected: this is presentation vocabulary for a teaching site, and the engine
continues to know only about wagers and raises. Nothing in the domain layer learns the word
"3-bet".

---

## ADR-0082 — The starting-hand metric is an expected pot share with ties split, and may never be described as the proportion of the time you win

**Date:** 2026-09-06 · **Phase:** FishTilt WP-Q (fix round) · **Status:** accepted

**Context.** `HandStrengthEntry.equity` and `ExactEquity.equity` are documented in
`packages/learn-core/src/strength/model.ts` as hero's **expected share of the pot, ties split in
half**. Fifteen user-visible places described that number as 이기는 비율 / 이길 확률 — the
proportion of the time hero wins outright. WP-P1 measured the gap by running `equityVsRange` with
the opponent side exhaustive: it reaches **2.87 pp** (72o: equity 34.58%, P(win) 31.71%,
P(tie) 5.83%), and the site prints these numbers to two decimals. The description was therefore
wrong past the precision the site itself claims.

The most vivid case is `glossary/equity.mdx`, which defined equity as 이길 확률 and then
illustrated it with `As Ks` vs `Ah Kh`, rendering 50.00%. Under the page's own definition the true
value is **7.16%** — the two hands tie 85.69% of the time, and the only outright wins on either
side are flushes. The page also gave the wrong reason ("두 손의 강도가 정확히 같아서"): the hands
are not permanently tied, the 50.00% comes from suit symmetry. `learn/equity.mdx` had it right the
whole time, so the site contradicted itself on its own central number.

**Decision.** The metric is **not renamed**. 승률 stays as the beginner-facing label — it is the
site's most-used word, a wholesale rename late in the cycle is high-churn across concurrent
writers, and `learn/equity.mdx` already demonstrated the cheap correct pattern. What is fixed is
the *description*:

1. Every **definitional** sentence states the expected-share meaning and the tie convention. The
   canonical form now lives in `apps/fishtilt/src/features/strength/copy.ts`
   (`METHODOLOGY_SENTENCE`): "…내가 팟에서 가져갈 것으로 기대되는 몫만으로 … 정확히 비기는 경우는
   절반만 이긴 것으로 계산에 들어갑니다."
2. `이기는 비율`, `이길 확률` and `X%를 이깁니다` may not appear as descriptions of this number.
   `X%의 몫을 기대할 수 있습니다` is the replacement shape.
3. Where 승률 appears as a bare label beside a number, the tie convention must be reachable **on
   that surface**.
4. `이길 확률` survives as a **search alias** for `term-equity`. An alias is what a reader types,
   not what the site asserts; the two are different objects and only prose is bound by this ADR.

**Consequences.** Enforced by tests rather than vigilance: `features/strength/copy.test.ts`,
`features/quiz/startingHandQuestions.test.ts` and `app/tools/starting-hand/page.test.tsx` assert
the banned phrases are absent from their surfaces. A future dataset that stored `winBps`/`tieBps`
alongside `equity` would let the site state a genuine P(win) as a separate number — that is an
addition, not a reversal, and does not reopen this ADR. **The falsifying evidence this ADR names**
is a dataset regeneration in which `equity` stops meaning a ties-split share; nothing else.

---

## ADR-0083 — The `학습용 기본 레인지`'s provenance is described as a single-source transcription, and the source is not named on-site

**Date:** 2026-09-06 · **Phase:** FishTilt WP-Q (fix round) · **Status:** accepted

**Context.** `packages/strategy-core/src/preflop/tables.ts` states in its own comment that the
UTG/HJ/CO/BTN RFI lists are "transcribed VERBATIM" from one public teaching chart — the only public
source found publishing 13×13 hand-class detail for this spot, hence **single-sourced** — and that
only SB is computed here (`trimSbCompositeToRaiseOnly`, because that source's SB list is a
raise-or-limp composite). ADR-0056 already classifies this correctly in the domain layer.

The user-facing sentences had drifted away from it in both directions. `/about` said the range was
"특정 사이트의 데이터를 베낀 것이 아니라 … 계산한 값" — the opposite of the truth — and
`/tools/range` and every embedded matrix said "**여러** 무료 포커 교육 자료를 참고해 정리한",
overstating the sourcing. WP-P1 found all three. This matters more than an ordinary copy error
because `/about` is the site's trust page: it is where FishTilt says 제휴하지 않습니다 and answers
숫자는 어디서 나오나요.

**Decision.** One shared constant (`apps/fishtilt/src/features/range/copy.ts`,
`RANGE_PROVENANCE_SENTENCE`) is the only provenance sentence, rendered by every surface that shows
the range, so the three cannot drift apart again. It says: the table is one public free teaching
resource's 6-max/100BB chart transcribed as-is; SB alone was recomputed here because that source's
SB list combines raising and limping; and the **percentages** those lists produce agree with the
bands two other sources give. The three-way corroboration is real but is about the percentages,
not the lists, and is stated that way.

**The source site is not named on the page.** Naming a specific commercial site in public product
copy is an outward-facing decision with attribution and relationship consequences that belongs to
the product owner, not to an implementing agent or to this ADR. The name stays where it already
is — in `tables.ts` and in `docs/reports/STRATEGY_ANCHORS.md` — and the question of naming it
on-site is carried to the release report as an open item for the owner.

**Consequences.** A surface that renders range data and does not render
`RANGE_PROVENANCE_SENTENCE` is a defect. If the RFI lists ever become multi-sourced or genuinely
computed, this sentence changes with the data — that is **the falsifying evidence this ADR names**,
and it is a change in `tables.ts`, not a rewording in the UI. Independently transcribing the cited
chart into a fixture (the discipline ADR-0018 applies to rake) would let the repo test fidelity to
the source rather than trusting the original transcription; that gap is recorded in WP-P1 §10 and
remains open.
