# Open-source evaluation

**Date of evaluation:** 2026-08-28. Every metadata figure, licence text, test count and
measurement below was captured on that date and will drift.

## 1. Purpose, scope, and how to read this

### Purpose

Decide, with evidence rather than reputation, whether any existing open-source project
should be adopted, adapted, referenced or rejected for two distinct GTO-SELF problems:

1. **The poker state engine** (`packages/poker-core`, Phases 1-2, 8, 11) — is
   `@gto-self/poker-core` duplicating solved work?
2. **CFR / baseline generation** (`solver-lab`, Phases 13-14) — is there an existing
   solver that can produce `CP_NL50_ANTE_100BB_BASELINE_V1`, or validate an
   implementation that could?

Licence compatibility with a possible future **commercial and/or closed-source**
distribution is a first-class criterion throughout, per `docs/GTO_BASELINE.md`.

### Scope

Five repositories were opened. Three received a full survey plus a deep dive; two were
verified at the metadata and targeted-probe level only and are marked as such.

| Repository | Depth of evaluation |
| --- | --- |
| `Ge-limin/poker-engine-ts` | Full: survey + deep dive + independent fact-check |
| `elliottneilclark/rs-poker` | Full: survey + deep dive + independent fact-check |
| `amaster97/poker_solver` | Full: survey + deep dive + independent fact-check |
| `google-deepmind/open_spiel` | Partial: metadata, licence file, and first-hand probes run for this document |
| `uoftcprg/pokerkit` | Partial: metadata, licence file, and one targeted rake probe run for this document |

### How to read this

- **Every factual claim here came from a command run against a real clone or a real API
  response.** Nothing is stated from memory. Repositories were cloned to a scratch area
  outside this project; no external source code was copied into this repository.
- Claims were then re-run by an **independent fact-checking pass**. Where that pass
  refuted or corrected a claim, **the correction is what appears here**, and the
  original error is called out so the disagreement is visible rather than laundered.
- Anything that could not be confirmed is written as **"(unverified)"** and repeated in
  §8, together with the command that would settle it. An unverified claim in this
  document is a claim you must not act on.
- Licences were read from the actual `LICENSE`/`COPYING` file in each clone, not from a
  README badge, and cross-checked against package metadata and the GitHub API.

### One correction to an earlier reading of our own repository

The `poker-engine-ts` deep dive recorded that `docs/POKER_CORE_API.md` did not exist and
that `packages/poker-core` was a nine-line placeholder. **That is no longer true.** As of
today, verified in this working tree:

- `docs/POKER_CORE_API.md` exists — 2,215 lines.
- `packages/poker-core/src` contains **4,953 lines of non-test TypeScript** plus 2,078
  lines of colocated tests, including `rake.ts`, `settlement.ts`, `pots.ts`,
  `commands.ts`, `events.ts`, with `POST_ANTE` and `RETURN_UNCALLED` already in the
  event vocabulary.

The build-vs-buy question in §5 is therefore **not** a greenfield decision. It is a
question about whether to discard or wrap work that already exists. That materially
strengthens the recommendation, and the reasoning is given in full rather than asserted.

---

## 2. Executive summary

| Project | Verdict | The single most important consequence |
| --- | --- | --- |
| **`Ge-limin/poker-engine-ts`** | **REFERENCE** | It is a good engine solving a *different* problem — a server-authoritative, async, card-dealing backend. Four of our six named hard requirements (sit-out, auto top-up, dirty-stack/observe, CoinPoker rake) are absent, and one of them conflicts with a load-bearing invariant rather than merely being missing. Its residual value is as an **independent differential oracle** for Phase 2 side-pot and min-raise edge cases. |
| **`elliottneilclark/rs-poker`** | **REFERENCE** | Its CFR is **not an imperfect-information solver** — all players share one perfect-information tree, proven both from the maintainer's own source comments and by a reproduced experiment where hero's strategy flips when only the villain's hidden cards change. It cannot produce a GTO baseline. Phase 13 must not treat it as one. Its hand evaluator and event/Historian design are worth reading. |
| **`amaster97/poker_solver`** | **REFERENCE** | The best *design* reference we found — DCFR discounting, a versioned checksummed blueprint asset format, and a four-route solver router that is a structural analogue of our `NearestSolutionMatcher`. But it is heads-up only, hard-rejects rake, and every shipped blueprint has a `null` exploitability. Take ideas and schema lessons; take no data and no code. |
| **`google-deepmind/open_spiel`** | **ADOPT — candidate, `solver-lab` only** | It is the only project evaluated that satisfies `docs/GTO_BASELINE.md`'s Phase 13 gate out of the box: I ran its tabular CFR and its **exact** exploitability computation on Kuhn and Leduc on this machine, in one command, with no build step. It is Apache-2.0. It is **not** a route to a 6-max NLHE baseline — its own 6-player no-limit game has 100,001 distinct actions — but it is a route to *proving a CFR implementation correct before trusting it*. |
| **`uoftcprg/pokerkit`** | **REFERENCE (partial evaluation)** | MIT, actively maintained, and it is the only engine evaluated that models rake with a percentage and a cap at all. But its rake uses Python `round()`, not floor — `rake(3333, percentage=0.05, cap=8000)` returns `167` where our "rake floors" rule requires `166`. Useful as a cross-check oracle; the rounding divergence must be understood before any comparison run is trusted. |

**The two roadmap consequences that matter:**

1. **Phase 1-2 is not duplicated work.** No evaluated engine models sitting out, auto
   top-up, a dirty-stack resync flow, or a CoinPoker rake schedule — and those must live
   *inside* the state machine, so a wrapper cannot buy them. Continuing our own
   `poker-core` is the truthful recommendation, and it is now also the cheap one.
2. **Phase 13's realistic deliverable is a validated method, not a baseline.** Every
   solver evaluated either does not solve imperfect information at all (rs-poker), or
   solves only heads-up (poker_solver), or is a research framework whose 6-max NLHE game
   is far outside tractable exact solving (open_spiel). Nothing here shortens the path to
   `CP_NL50_ANTE_100BB_BASELINE_V1`. Section 6 states plainly what is and is not feasible.

---

## 3. Criteria matrix

Terse by design; detail is in the per-project sections. `(unverified)` marks a cell that
was not confirmed by a command.

| Criterion | poker-engine-ts | rs-poker | poker_solver | open_spiel | pokerkit |
| --- | --- | --- | --- | --- | --- |
| **Licence (SPDX)** | MIT | Apache-2.0 | MIT | Apache-2.0 | MIT |
| **Maintenance** | 1 squashed commit, 1 contributor, last push 2026-07-05 | 436 commits, 96% one author, last push 2026-08-13, CI green | 376 commits one author, last push 2026-06-18 | last commit 2026-08-25, 5,440 stars | last commit 2026-08-22, 489 stars |
| **Tests** | 30 files / 192 tests, all pass (I ran them); own 75% coverage gate fails at 64.66% | 1034 lib + 198 bin + 91 doc tests, 0 failures (I ran them) | 1,096 Python `def test_`; 26 of 29 CFR tests pass, 3 fail on unbuilt Rust ext | CFR + exploitability probes pass (I ran them) | not run (unverified) |
| **6-max** | Yes; template is exactly `BTN/SB/BB/UTG/HJ/CO` | Yes; `MAX_PLAYERS = 16` | **No — heads-up only** (`num_players: int = 2`) | Yes; `universal_poker` `max_num_players = 10`, 6-player game loads | Yes (unverified beyond a 6-seat probe script present in the work area) |
| **NLHE** | Yes (+ pot-limit, fixed-limit) | Yes (+ Omaha); `max_raises_per_round` defaults to `Some(3)` — must be set `None` | Yes (HUNL) | Yes (`betting=nolimit`, `bettingAbstraction=fullgame`) | Yes |
| **Ante** | Yes for our "everyone" case — but `appliesTo` is a **confirmed defect** (silently ignored) | Yes; dedicated `Round::Ante`, per-player `ForcedBet` | Ante grid 0 / 0.5 / 1.0 BB (heads-up conventions) | **No ante parameter** — only `blind`; 0.16 BB/player would have to be encoded as blinds (semantics change, unverified) | (unverified) |
| **Arbitrary stacks** | Yes, per-seat, no rounding assumptions | Yes, `PlayerVec<f32>` per player | **No** — one symmetric `starting_stack: int` | Yes, per-player `stack=` list | (unverified) |
| **All-in** | Yes, incl. short-all-in-does-not-reopen (8 dedicated tests) | Yes, `player_all_in` bitset, all-in action slot | Yes (by construction, HU) | Yes | (unverified) |
| **Side pots** | Yes — layered peel + odd-chip round-robin from the button; strongest part of the code | Yes in the arena; **but CFR collapses side pots into one pot** | **No** — one comment notes they cannot arise by construction | (unverified) | (unverified) |
| **Replay** | **Partial** — exported `replayEvents` misses street advancement and settlement; the complete path is a private async method | Partial — scripted replay agent + hand-history replay; no undo/rebuild | n/a | n/a | (unverified) |
| **Event sourcing** | Yes, but **fat events** carry derived state and the reducer rejects mismatches | Yes — `Action` enum + pluggable `Historian`s; closest analogue to our vocabulary | n/a | n/a | (unverified) |
| **CFR / GTO** | **None** (author says so explicitly) | 13,238 LOC, runs — but **perfect-information tree, no info sets, no exploitability, no Kuhn/Leduc** | Real DCFR (α 1.5 / β 0 / γ 2.0) with **exact best-response exploitability**, validated on Kuhn + Leduc | Tabular CFR, CFR-BR, MCCFR, discounted CFR + **exact exploitability**; measured Kuhn 9.4e-4 @1k iters, Leduc 3.6e-2 @300 iters | None |
| **Multiway** | Genuinely multiway (verified 6-handed, 4 side pots) | Engine yes; CFR tested almost entirely heads-up, 3+ needs a 47 MB stack | **No** | Yes (game side) | (unverified) |
| **Rake** | **None** — inert pass-through field | **None** — zero `rake` matches under `src/arena/` | **Hard-rejected** — `ValueError("rake_rate must be 0.0…")` | (unverified) | **Yes** — `percentage` + `cap` + `no_flop_no_drop`, but **rounds, does not floor** |
| **Integration complexity** | Low to install (1 dep, ESM, no native); **high** to actually integrate | High — Rust, **no WASM/napi/FFI of any kind**; offline subprocess only | High — Python + Rust/PyO3; HU-only anyway | Moderate — Python wheel installs and works; C++ core | Low — pure Python |
| **Performance** | Ample: 192 tests in ~1s; 1,000-hand sim in 537 ms | Native Rust, perfect-hash evaluator; CFR ~17 GB per *hand* per its own source | 27 blueprint shards in 2,304 wall-seconds | Kuhn 1k CFR iters in 0.34 s; Leduc 300 iters in 15.5 s | (unverified) |
| **Distribution suitability** | Fine — MIT, notice only | Fine — Apache-2.0, notice + modification marking; no NOTICE file to propagate | Fine — MIT, notice only | Fine — Apache-2.0 | Fine — MIT |

---

## 4. Project evaluations

### 4.1 `Ge-limin/poker-engine-ts`

**Exists:** yes, at `https://github.com/Ge-limin/poker-engine-ts`, under the exact
assigned name. Also published to npm as `poker-engine-ts@0.1.3` (271 downloads in the
month to 2026-08-27).

**What it is.** An event-sourced TypeScript NLHE engine, ~12,709 non-test lines,
positioned as a production backend: it deals cards from an RNG deck, manages async
sessions, ships React hook adapters, a Supabase persistence layer, bot personas,
telemetry and action clocks.

**Licence — MIT (SPDX `MIT`).** Verified from the file: `LICENSE` is the verbatim
21-line MIT template, `Copyright (c) 2026 Limin Ge`, including the "use, copy, modify,
merge, publish, distribute, sublicense, and/or sell" grant. `package.json` declares
`"license": "MIT"`; the GitHub API reports `MIT`. All three agree; no `COPYING`, no CLA,
no per-file headers, no copyleft strings. Its sole runtime dependency `@noble/hashes
^2.0.1` is also MIT, verified from `node_modules/@noble/hashes/LICENSE` ("The MIT License
(MIT), Copyright (c) 2022 Paul Miller").

**What MIT means for us:** no obstacle to commercial or closed-source distribution,
whether as a linked dependency or vendored source. The only obligation is reproducing the
copyright and permission notice in a third-party notices file, plus recording the
decision in `docs/DECISIONS.md` as `GTO_BASELINE.md` requires.

**Maintenance — thin.** Exactly **one commit** (`6aa64b8`, 2026-07-03, "Event-sourced
poker engine for production backends") on a non-shallow clone; exactly one contributor;
**zero** GitHub releases; npm versions 0.1.0-0.1.3 all published inside two days
(2026-07-03 to 2026-07-05) and nothing since. Last push 2026-07-05 — roughly 7.5 weeks
of silence. 2 stars, 1 fork, 0 open issues. The squash means there is no history to
audit: you cannot see how any of the tricky rules were arrived at or how the author
responds to bugs.

**Strengths — real, and worth stating plainly.**

- **Correct side pots.** `rebuildPotLedger` peels the minimum positive contribution
  across live contributors into successive buckets; `settle-pots.ts` uses
  `Math.trunc(bucketAmount / winners.length)` for the base share and distributes the
  remainder **one chip at a time** to winners ordered clockwise from the button, so odd
  chips are never dropped. A probe produced a 5-way, 4-side-pot ledger with exact chip
  conservation.
- **The short all-in does not reopen betting.** Modelled explicitly as
  `reopenAllowed = lastActedHighestContribution === undefined || highestContribution -
  lastActedHighestContribution >= minimumRaiseSize`, with 8 dedicated passing tests,
  including "multiple short all-ins reopen the betting once they add up to a full raise".
- **Integer money at runtime.** `requireIntegerChips` throws on anything that is not a
  safe integer. A grep of `src/core`, `src/reducer`, `src/session` for `* 0.`, `/ 2`,
  `/ 100`, `toFixed`, `parseFloat` returns **zero hits**: there is no floating-point
  money arithmetic in the engine.
- **Real test discipline.** 30 files / 192 tests, all passing (I ran them; ~1s),
  including fast-check property tests for chip conservation through settlement and a
  1,000-hand simulation asserting a constant chip total.
- **6-max is first-class**, and its position template is *exactly* ours:
  `6: ['BTN','SB','BB','UTG','HJ','CO']`.

**Gaps against GTO-SELF — the decisive ones.**

1. **No rake.** `rakeCap`, `rakePercent`, `rakePolicy`, `takeRake` do not exist. The 14
   non-test `rake` occurrences are type declarations, copy-forwards, zero-initialisations
   and reads. (The survey said 12; the fact-check counted 14. The conclusion is
   unaffected: we write 100% of the CoinPoker 5%-capped-at-8-BB model ourselves either
   way.)
2. **No sitting out, no auto top-up, no dirty stack, no observe mode.** All four greps
   return zero non-test hits. Worse than absent: `deriveSeatPositionLabels` counts *every*
   occupied seat, so a sat-out player would silently consume a position and corrupt our
   position labels.
3. **The reducer is hostile to our Phase 8 flow.** `reduce.ts:40-46` throws
   `ReducerInvariantError('Event stackBefore mismatch')` whenever a persisted
   `stackBefore` disagrees with the snapshot. Our observe/dirty-resync flow *lives* in
   exactly that state.
4. **Fat events.** `TurnEvent` carries `stackBefore`, `stackAfter`, `contribution`, the
   full `legalOptions` array and `metadata.engineVersion`; street transitions and payouts
   ride as `metadata.nextHandStage` / `metadata.payoutSummary` rather than being events.
   `ARCHITECTURE.md` requires the opposite: persist the actual input, derive the rest.
5. **The exported pure replay is incomplete.** This is a **correction to the survey**,
   which graded replay as "yes, pure replay" on the strength of a preflop-only probe.
   `replayEvents` is only `for (const event of events) snapshot = reduce(snapshot, event)`.
   The library's own comment at `session-manager.ts:1408-1412` says every rebuild path
   "must use this, or replayed timelines miss street advancement and settlement" — and
   the complete path is the **private static** `SessionManager.replayEvent`, with
   `autoAdvanceHandStage` unexported and `rewindTo` `async`. So the survey's probe passed
   only because it never crossed a street boundary.
6. **No undo at all** — zero non-test `undo` hits.
7. **Money is unbranded.** `export type Chips = number;` catches nothing at compile time.
   Our `MilliBB` brand is a stronger guarantee that we would be trading for a runtime
   exception.

**Confirmed defect.** `AntePolicy.appliesTo` (`'everyone' | 'button' | 'big-blind'`) is
accepted, recorded in the ledger's `type` field, and **never consulted**. `resolveAnte`
builds contributors as all occupied seats regardless. Running all three variants on an
identical 6-seat table with ante 160 produced an identical `pot = 2460` and identical
per-player contributions in every case. Our case (`'everyone'`) happens to be the one
that works — but a config field that silently lies is a maintenance signal.

**Provenance hazard.** `src/persona/baseline.ts` contains hard-coded, uncited archetype
numbers (`'tight-aggressive': { aggression: 72, tightness: 85, bluffIndex: 32,
riskTolerance: 44 }`, and five more). They are bot traits, not strategy frequencies, but
under CLAUDE.md rule 2 they must never surface as anything strategy-like. GTO-SELF has no
bots, so the clean answer is never to import that module.

**Layering check passes.** `react` and `@supabase/supabase-js` are optional peers confined
to `src/session/adapters/client.ts` and `src/persistence/supabase/*`; `grep -c` for either
in `dist/index.js` returns 0. Importing the main entry would not violate CLAUDE.md rule 4.

**Classification: REFERENCE.** Not because of licence (MIT is ideal), not because of
quality (the code is genuinely good), but because it solves a different problem and
because the parts we cannot get from it must live inside the state machine.

**Specific reusable ideas** (read, do not copy):

- The layered pot-ledger peel with **one-chip-at-a-time** remainder distribution ordered
  clockwise from the button — a correct, testable odd-chip policy.
- The `reopenAllowed` formulation of the short-all-in rule, and its 8-case test list as a
  checklist for our own Phase 2 tests.
- Property-based **chip conservation** and a long-running N-hand invariant simulation as
  standing tests.
- Its highest concrete value: an **independent differential oracle**. Feed the same
  betting sequence to both engines and compare pot/side-pot ledgers. A second correct
  implementation is worth most exactly where our Phase 2 edge cases are hardest.

---

### 4.2 `elliottneilclark/rs-poker`

**Exists:** yes, at `https://github.com/elliottneilclark/rs-poker`. Crate is `rs_poker`;
the hyphen/underscore difference is normal Rust convention, not a discrepancy.

**What it is.** A mature Rust poker toolkit: a perfect-hash hand evaluator, an "arena"
simulation engine for 2-16 players, agents, Open Hand History import/export, a TUI, and a
13,238-line CFR module.

**Licence — Apache-2.0 (SPDX `Apache-2.0`).** Verified from the file: `LICENSE` is the
verbatim 201-line Apache 2.0 text. `Cargo.toml:11` says `license = "Apache-2.0"`; the API
agrees. There is **no `NOTICE` file**, and the LICENSE appendix still carries the unfilled
`Copyright {yyyy} {name of copyright owner}` placeholder, so upstream provides no
attribution string of its own.

A full transitive audit was run and independently reproduced: 241 locked packages,
resolved against the local cargo registry, giving 135 `MIT OR Apache-2.0`, 50 `MIT`, 14
`Apache-2.0 OR MIT`, 10 `MIT/Apache-2.0`, 7 `Apache-2.0`, 6 `Unlicense OR MIT`, plus
Zlib/BSL-1.0/0BSD options. **Zero mandatory copyleft.** The only GPL-family string is
`r-efi 6.0.0` → `MIT OR Apache-2.0 OR LGPL-2.1-or-later`, where MIT is selectable. Five
packages were not resolvable locally and remain **(unverified)**: `valuable 0.1.1`,
`linux-raw-sys 0.4.15`, `wasi 0.11.1`, `crossterm_winapi 0.9.1`, `rs_poker 5.1.0` itself.
The regret-matching crate `little-sorry 3.0.0` is Apache-2.0, verified from its own
LICENSE file.

**What Apache-2.0 means for us:** commercial and closed-source distribution is permitted.
§4 imposes conditions only on redistribution — ship the licence text, mark modified files
as changed, retain notices. There is no NOTICE file to propagate. For pure
reference use (reading it, running it offline, copying nothing) none of these obligations
is triggered. Note separately that `build.rs` states it reimplements zekyll's OMPEval
(MIT) with attribution in **source comments only**; if we ever vendor `build.rs` or its
generated tables we should reproduce the MIT notice ourselves.

**Maintenance — the healthiest of the five, still bus-factor 1.** 436 commits, 86 in the
trailing 12 months, HEAD `ce791cdb` 2026-08-13 "chore: Release rs_poker version 5.1.0".
`git shortlog -sn --all`: Elliott 272 + Elliott Clark 146 = **418 of 436 (96%)**; the next
contributors have 3 each. (The survey said 144; the fact-check counted 146.) The five most
recent CI runs on `master` all succeeded. Tags through v5.1.0. Not archived. 177 stars.

**Strengths.**

- **Test depth, independently reproduced.** `cargo test --all-features` → 1034 lib
  passed, 198 binary passed, 91 doc tests passed (4 ignored), **0 failures**, exit 0. The
  CFR module alone has 231 tests.
- **Hand evaluation** built on perfect-hash tables generated by a 35 KB `build.rs`.
- **The event/Historian design** is the most directly transferable idea in the repository
  (see below).
- **Engine-side game modelling is complete**: 2-16 players, per-player stacks, a dedicated
  `Round::Ante` posting a `ForcedBet` from every active seat, side-pot distribution with
  its own validator.

**THE BLOCKING FINDING — the CFR is not an imperfect-information solver.**

This is the most consequential fact in this document, and it was verified two independent
ways.

*From the source, verbatim.* `src/arena/cfr/mod.rs:68-70`:

> **Single Shared Tree**: All players share one game tree (NodeArena) since there is no
> information hiding in the traversal.

`src/arena/cfr/historian.rs:102`:

> There is no information hiding - the full deal sequence is recorded in the tree.

Every hole card dealt to every seat becomes a chance node in the one shared tree, indexed
by the concrete card. `NodeData::Player(PlayerData)` attaches a regret matcher to a
card-specific node, not to an information set. Corroborating greps:
`info.?set|information set|bucket|abstraction` across `src/arena/cfr/` → **0 matches**;
`exploitabilit|nash|equilibri` across `src`, `benches`, `examples` → **0 matches**;
`kuhn|leduc` across `src`, `benches`, `examples`, `docs`, `README.md` → **0 matches**.

*Empirically, and reproduced by the fact-checker.* A probe placed hero on `QdJd`, board
`Kc7h2d5s9c`, facing a 900-chip river shove, with 20,000 root iterations. Hero's cards and
the board are byte-identical between runs; **only the villain's hidden cards change**:

```
villain 3c4h (hero wins)     -> fold=0.000  call=1.000
villain KsKh (hero loses)    -> fold=1.000  call=0.000
```

A genuine imperfect-information CFR must return the same strategy in both runs — for hero
they are the same information set. It flips from a pure call to a pure fold. It is solving
a game in which every player sees every hole card. Whatever it converges to, it is not a
Nash equilibrium of NLHE.

*The one hedge, and why it does not rescue this.* `src/arena/hand_estimator/` allows
opponents' cards to be resampled per exploration wave, but the **default** is
`KnownHandsEstimator`, whose own doc states: "returns each opponent's true hand as a point
mass. This is the default; with it, `sample_world` reproduces the real hands exactly, so
CFR behavior is identical to the pre-estimator engine." The only alternative shipped is
uniform-over-all-combos; the doc says "The ML model implements this" and **no such model
exists in the repo**. Sampling changes the reward, never node identity.

Meanwhile the README markets it as "a CFR solver for game-theory optimal strategy
approximation". Under `docs/GTO_BASELINE.md` ("Validate any CFR implementation on Kuhn and
Leduc poker first, with published equilibrium values as the check" and "Never claim NLHE
solving works unless it has actually been validated"), rs-poker fails the gate outright.

**Further hard blockers for adoption.**

- **Money is `f32` throughout** `GameState` (`stacks`, `total_pot`, `player_bet`,
  `big_blind`, `ante`, `starting_stacks`) — irreconcilable with integer milliBB without an
  explicit rounding boundary.
- **No rake.** `grep -rniE "rake" src/arena/` → **0**. The ~20 repo-wide hits are Open
  Hand History parse fields and TUI fixtures.
- **Sizing resolution is destroyed by a 16-slot action index.**
  `NUM_ACTION_INDICES = 16`: fold, call, 12 raise slots on a *global logarithmic* scale
  from big blind to effective stack, all-in, reserved. A probe on our exact preset
  reported 2.0 / 2.25 / 2.5 BB all collapsing into slot 4, and pot-sized and 125%-pot bets
  landing in the same slot on a large pot. Our `GTO_BASELINE.md` open candidates are
  2.0 / 2.25 / 2.5 / 3.0 BB, so the collapse bites on our actual candidate set. The
  16-slot constant is confirmed in source; the specific probe output is a runtime
  measurement that was not re-executed **(unverified in detail, structurally sound)**.
- **CFR collapses side pots** into the main pot in its reward path, a systematic bias for
  6-max with varied stacks.
- **`max_raises_per_round` defaults to `Some(3)`**, converting further raises to calls —
  limit-poker behaviour in a nominally no-limit game. Must be set to `None`.
- **No strategy export.** `export.rs` is Graphviz DOT/PNG/SVG **visualisation only**;
  serde in the CFR module covers only *config* types. There is no `solve` subcommand
  (`ArenaCommand` = Charts | Compare | Diag | Generate | Verify). We would write the solve
  harness and exporter ourselves — against a node identity that includes opponents'
  private cards, so there is no key a `NearestSolutionMatcher` could ever look up.
- **No FFI surface at all.** `wasm|napi|neon|pyo3|extern "C"` across `src`, `Cargo.toml`,
  `README.md` → 0 matches. The only realistic integration is an offline subprocess.
- **Cost.** Its own source says: "CFR solvers allocate ~17GB per game… spiking peak RSS to
  ~34GB", and it sets a **47 MB worker stack** because "with 3+ players this recursion is
  deep enough to overflow tokio's default 2 MB worker stack". Note *per game* means
  **per hand**. A probe reported 35.7 M nodes / 13.5 GB peak RSS for a single 6-handed deal
  at a modest iteration schedule; those specific figures are **(unverified)** — the
  fact-checker did not re-run them, and the decision does not depend on them.

**Provenance hazard.** `examples/configs/preflop_6max_rfi.json` (33,081 bytes, 1,759
lines) is named `"6Max-RFI-GTO"` and contains hand-authored frequencies (`"AA": {"raise":
0.5, "call": 0.5}`, `"QQ": {"raise": 0.3, "call": 0.7}`) with **no cited provenance
anywhere in the repository**. These are solver *inputs* that prune exploration, not solver
outputs. Importing them would directly violate CLAUDE.md rule 2.

**Classification: REFERENCE.** Excellent engineering; the CFR does not do the thing we
would need it for, and says so in its own comments.

**Specific reusable ideas:**

- The **`Action` enum + pluggable `Historian`** observer design. `Action::{GameStart,
  PlayerSit, DealStartingHand, RoundAdvance, PlayedAction, FailedAction, ForcedBet,
  DealCommunity, Award}` is a close analogue of our own vocabulary, and the explicit
  **`FailedAction`** event for illegal attempts is an idea we do not currently have.
- Generating a hand-evaluator lookup table at build time rather than shipping one.
- `validate_side_pot_distribution` as a standing property check invoked from tests.

---

### 4.3 `amaster97/poker_solver`

**Exists:** yes, at `https://github.com/amaster97/poker_solver`. ⚠️ Do not confuse it with
the unrelated `noambrown/poker_solver` (also MIT, 164 stars), which *this* project cites as
a correctness oracle in its README.

**What it is.** A heads-up NLHE solver in two tiers: a readable Python reference
(`poker_solver/`, ~23,800 LOC) and a Rust/PyO3 production core (`crates/cfr_core`, ~24,400
LOC), plus a NiceGUI desktop app and 27 shipped blueprint assets.

**Licence — MIT (SPDX `MIT`).** Verified from the file: verbatim 21-line MIT,
`Copyright (c) 2026 ashen`. Agrees with `pyproject.toml` (`license = { text = "MIT" }` plus
the OSI classifier) and `crates/cfr_core/Cargo.toml`. No GPL/AGPL strings in the licence
file. Direct Rust deps (`pyo3, ndarray, ndarray-npy, serde, serde_json, arrayvec, rayon`)
are permissive by name; a full transitive `cargo tree` licence audit was **not** run
**(unverified)**.

**Its licence hygiene is exemplary and worth copying as a process.** `CONTRIBUTING.md` and
`DEVELOPER.md` carry an explicit AGPL contamination policy naming a blocklist —
`b-inary/postflop-solver` (AGPL-3.0), `bupticybee/TexasSolver` (AGPL-3.0),
`24parida/shark-2.0` (unlicensed) — marked "Read-only inspiration. Do not copy." Their
`references/` directory is gitignored and is genuinely **absent** from the clone, and
`grep -rniE "affero|GNU General Public"` over `.py`/`.rs`/`.toml` returns **0 hits**.
Individual modules carry provenance headers stating what pattern they follow and that no
AGPL code was transcribed. We should adopt this posture verbatim in `docs/DECISIONS.md`.

**Maintenance — dormant.** 376 commits by one human author (plus one bot-attributed
commit), concentrated 2026-05-20 to 2026-06-01, then three commits on 2026-06-18 and
nothing since — roughly 10 weeks. Two open issues, one of which its own author labels
`docs(critical): preflop RvR degenerate Nash investigation`. Not archived. 4 stars. The
repository has 19 releases/tags through v1.10.0 (neither source report mentioned this; an
omission, not an error).

**Strengths — this is the best *design* reference of the five.**

- **DCFR done properly.** Per iteration, discount *before* accumulating:
  `pos_scale = t^α/(t^α+1)` where R>0, `neg_scale = t^β/(t^β+1)` where R<0,
  `strat_scale = (t/(t+1))^γ`, with `(α,β,γ) = (1.5, 0.0, 2.0)` per Brown & Sandholm 2019.
  The differences from CFR+ are instructive: CFR+ floors negative regret at zero, DCFR
  *halves* it every iteration (β=0), preserving the sign information; and strategy
  averaging is polynomial rather than linear, discounting burn-in quadratically.
- **Exact exploitability, not a proxy.** `exploitability()` is a true best-response
  computation — mean over players of (BR value − on-policy value).
- **Kuhn and Leduc validation that passes.** 26 of 29 tests pass on a clean venv; the 3
  failures are `ModuleNotFoundError: poker_solver._rust` from not building the extension.
  Kuhn: game value within 5e-3 of the published value at 50k iterations, exploitability
  < 5e-3. Leduc: exploitability < 0.05 at 600 iterations, infoset count exactly 288, game
  value ≈ −0.085 (Southey et al.) within 0.02.
- **The single best testing idea here:** Kuhn has a *continuum* of equilibria
  parameterised by α ∈ (0, 1/3], so asserting a point value would be wrong. They instead
  assert the **algebraic invariant between two infosets** — `P(call Q at "12|pb") = α +
  1/3` where α is the J-bluff frequency. That validates the solver without over-constraining
  which equilibrium it found. Phase 13 should use this technique.
- **A hyperparameter guard that hard-fails.** `_validate_alpha` raises on α ≤ 0 and warns
  below 0.5, with the empirical justification inline. Exactly the "no silently-plausible
  values" posture CLAUDE.md rule 5 demands.
- **A four-route solver router** that is a structural analogue of our
  `NearestSolutionMatcher`, and one decision in it independently confirms our matching
  priority order: **a non-canonical action menu is never approximated** — it routes to a
  live solve. Stack depth is the *only* dimension they ever interpolate.

**Gaps — fatal for adoption, not for reference.**

- **Heads-up only.** `hunl.py:449` → `num_players: int = 2`. `starting_stack: int` is a
  single symmetric scalar, so unequal stacks are inexpressible. `grep -rniE "side.?pot"`
  across both tiers returns exactly one hit, a comment explaining that side pots cannot
  arise by construction.
- **Rake is hard-rejected.** `HUNLConfig` raises
  `ValueError("rake_rate must be 0.0 in PR 3 (rake lands in PR 9)")`, and PR 9 never
  landed. Our 5%/8 BB model is inexpressible.
- **The shipped blueprints are unusable as a baseline** — see the two data-integrity
  findings below.

**Two data-integrity findings we must learn from.**

1. **Every shipped blueprint has a `null` convergence metric.** All 27 shards record
   `final_exploitability_bb100: null`. The schema has the field; nothing populated it. A
   consumer cannot distinguish a well-solved shard from a broken one. This is precisely
   what our `GTO_BASELINE.md` versioning rule exists to prevent.
2. **4.9% of strategy rows are an unmarked uniform fallback.** 1,540 of 31,434
   (infoset, hand-class) rows are exactly `1/n` per action, produced by
   `average_strategy` when `strategy_sum.sum() == 0` — i.e. the infoset was never reached.
   In the serialised asset this is **byte-indistinguishable from a genuine 50/50 mixed
   strategy**. A UI reading `72o` facing a 4-bet would render "50% call" as if it were
   solved output. That is exactly the failure mode CLAUDE.md rule 2 forbids.

**A defect worth knowing before transcribing anything.** The DCFR docstrings in *both*
tiers write the strategy-sum update using the **opponent's** reach `π_{-i}`. The code in
both tiers uses the **acting player's own** reach (`own_reach = reach[player]`). The code
is correct — standard CFR weights the average strategy by π_i and the regret term by
π_{-i}, which their code does correctly — and the **docstring is wrong, identically, in
both tiers**. Phase 13 must read the code, not the comment; transcribing the published
formula from that comment yields a silently wrong average strategy that still looks
plausible.

**Classification: REFERENCE.** Ideas and schema lessons only. No code, no data.

**Specific reusable ideas — most directly, for our persistence schema.** Their SQLite
`spots` table maps onto our four planned GTO tables with these deliberate divergences:

| Their design | Our table | Recommendation |
| --- | --- | --- |
| `bet_menu_hash TEXT` | `gto_solution_sets` | **Adopt.** A hash over the ordered sizing menu makes "action-tree structure exact" (matching criterion 4) a single indexed comparison instead of a tree walk. |
| `board_signature TEXT` + index | `gto_spots` | **Adopt** as the canonical-board form for matching criterion 5 — storing canonical *and* actual, per CLAUDE.md rule 3. |
| `exploitability REAL NOT NULL` | `gto_solution_sets` | **Adopt, and keep it NOT NULL.** This is the column their own JSON assets forgot. Store as integer milliBB/100. |
| `abstraction_tier`, `solver_version`, `schema_version`, `iterations` | `gto_solver_configs` | **Adopt** — aligns with `CP_NL50_ANTE_100BB_BASELINE_V1` immutability. |
| `strategy_gz BLOB` (whole solve in one blob) | `gto_strategies` | **Diverge.** A blob cannot answer "show every spot where BTN opens ≥60%" without decompressing everything. Row-per-(node, hand-class, action) is the better default; keep the blob option behind the interface `ARCHITECTURE.md` already mandates. |
| `stack_bb INTEGER` | `gto_spots` | **Change units** — INTEGER BB cannot express 93.7 BB. Ours must be `effective_stack_mbb` (actual) alongside `stack_bucket_mbb` (normalized). |
| float64 JSON probabilities | `gto_strategies` | **Change.** They store ~17 significant digits per probability, which is why gzip only achieves 2.4× — the mantissa noise is incompressible. Integer ten-thousandths (0-10000) is beyond display need, compresses, and makes rows byte-comparable in tests. |
| *(absent)* | `gto_strategies` | **Add an explicit `unreached` flag / reach weight.** This is the fix for their 4.9% problem: a row that was never reached must be *typed* as unreached so the UI cannot render it as strategy. |

Also worth adopting: a **manifest with per-shard sha256, verified on load** — the right
integrity boundary if payloads ever move to object storage, which `ARCHITECTURE.md`
anticipates.

---

### 4.4 `google-deepmind/open_spiel` — partial evaluation

**Exists:** yes. `gh api repos/google-deepmind/open_spiel`: C++, Apache-2.0, not archived,
5,440 stars, 42 open issues, created 2019-07-22, **last push 2026-08-25**. Local clone HEAD
`2a870dad` 2026-08-25 "Merge pull request #1592 …".

⚠️ **Depth caveat.** This project did not receive a survey or a deep dive. Everything below
is either repository metadata or a probe I ran myself while writing this document. It has
**not** been through the independent fact-check pass that the first three projects had.

**Licence — Apache-2.0 (SPDX `Apache-2.0`).** Verified from the file: `LICENSE` is the
202-line Apache 2.0 text, and unlike rs-poker the source files carry per-file Apache
headers (`// Copyright 2021 DeepMind Technologies Limited / Licensed under the Apache
License, Version 2.0`). Same distribution implications as rs-poker: commercial and
closed-source use permitted, with notice and modification-marking obligations on
redistribution.

**What I verified by running it** (installed wheel `open_spiel 2.0.2` in a scratch venv):

- Tabular CFR plus **exact** exploitability, working in one command with no build step:

  ```
  kuhn_poker   1000 CFR iterations -> exploitability 9.376e-4   (0.34 s)
  leduc_poker   300 CFR iterations -> exploitability 3.552e-2   (15.53 s)
  ```

  Both converge in the expected direction against published equilibrium values. This is
  precisely the Phase 13 gate `docs/GTO_BASELINE.md` demands, satisfied out of the box.
- The algorithm shelf is broad: `cfr`, `cfr_br`, `external_sampling_mccfr`,
  `outcome_sampling_mccfr`, `fsicfr`, `discounted_cfr`, `tabular_exploitability`,
  `exploitability`, plus `kuhn_poker` and `leduc_poker` as first-class games.
- `universal_poker` declares `max_num_players = 10` and offers four betting abstractions
  (`kFCPA`, `kFC`, `kFULLGAME`, `kFCHPA`). **A 6-player no-limit game loads:**

  ```
  num_players 6   num_distinct_actions 100001   max_game_length 542
  ```

  That 100,001 is the honest scale of the problem: in the full-game no-limit encoding,
  every distinct raise-to amount is its own action.

**Gaps against our preset.**

- **No ante parameter.** The `universal_poker` parameter list is exactly
  `betting, bettingAbstraction, blind, boardCards, calcOddsNumSims, firstPlayer,
  handReaches, maxRaises, numBoardCards, numHoleCards, numPlayers, numRanks, numRounds,
  numSuits, potSize, raiseSize, stack`. Our 0.16 BB/player ante would have to be encoded
  through per-player `blind` values, which changes forced-bet and first-to-act semantics.
  Whether that encoding is faithful is **(unverified)**.
- **Rake:** not checked **(unverified)**.
- Money representation, integration shape (C++ core, Python wheel), and whether a
  6-max abstraction is buildable in reasonable time were **not** evaluated.

**Classification: ADOPT — candidate, `solver-lab` only.** It is the only project evaluated
that does the Phase 13 job as specified. It is not a route to a 6-max NLHE baseline and
must not be presented as one. Because it received only a partial evaluation, adopting it
should be gated on a short confirmation pass (§9, decision 4).

---

### 4.5 `uoftcprg/pokerkit` — partial evaluation

**Exists:** yes. `gh api repos/uoftcprg/pokerkit`: Python, MIT, not archived, 489 stars,
last push 2026-08-22. Local clone HEAD `54571ddd` 2026-08-22.

⚠️ **Same depth caveat as open_spiel:** metadata plus one targeted probe I ran myself. No
survey, no deep dive, no independent fact-check.

**Licence — MIT (SPDX `MIT`).** Verified from the file: `LICENSE` opens "MIT License /
Copyright (c) 2023-2026 Universal, Open, Free, and Transparent Computer Poker Research
Group"; `grep -ciE 'gnu|general public'` over it returns 0. The API agrees. No obstacle to
commercial or closed-source distribution.

**Why it matters to us at all:** it is the **only** engine of the five that models rake
with a percentage and a cap. `pokerkit.rake(amount, state, *, percentage, cap,
no_flop_no_drop)` returns `(raked, unraked)`, and `no_flop_no_drop` is a real concept our
CoinPoker preset may eventually need.

**The finding that matters more.** Run against our exact preset in integer milliBB:

```
rake(30000,  percentage=0.05, cap=8000)  -> (1500, 28500)     # 30 BB pot, 5%
rake(300000, percentage=0.05, cap=8000)  -> (8000, 292000)    # cap bites correctly
rake(3333,   percentage=0.05, cap=8000)  -> (167, 3166)       # 166.65 -> 167
```

Integer in, integer out, and the cap behaves. **But the implementation is
`raked_amount = round(raked_amount)` when the amount is integral — it rounds, and Python's
`round` is half-to-even.** Our `ARCHITECTURE.md` says *"Rake floors."* On a 3.333 BB pot
the two models differ by one milliBB, and on a half-milliBB boundary they differ again in
a third way. This is not a reason to avoid pokerkit; it is a reason that any comparison
run against it must normalise the rounding policy first, or every odd pot will read as a
false mismatch.

**Classification: REFERENCE (partial evaluation).** Potentially the most convenient
cross-check oracle for rake and settlement specifically, precisely because it is the only
one that models rake at all. Its 6-max, ante, side-pot and replay behaviour were **not**
evaluated **(unverified)**.

---

## 5. `poker-engine-ts` vs our `poker-core` — the decision-grade comparison

### The state of our side, verified today

| | `packages/poker-core` (today) | `poker-engine-ts@0.1.3` |
| --- | --- | --- |
| Non-test source | 4,953 lines | 12,709 lines |
| Colocated tests | 2,078 lines | 30 files / 192 tests, all passing |
| Money | branded `MilliBB`, compile-time enforced, explicit `RoundingMode` at every lossy op | `type Chips = number`, runtime `requireIntegerChips`, `Math.trunc` chosen by the library |
| Rake | `rake.ts` exists | none |
| Event vocabulary | `POST_ANTE`, `RETURN_UNCALLED`, … present in `events.ts` | one fat `TurnEvent`; streets/payouts smuggled in `metadata` |
| Sync/async | pure and synchronous per `ARCHITECTURE.md` | complete replay path is `async` and private |
| Undo | `Z` removes one whole logical action (`commands.ts`) | absent |

The deep dive read our `poker-core` as a nine-line placeholder. That was true when it read;
it is not true now. **Phase 1 is substantially implemented, with an API spec of 2,215
lines.** So the question is no longer "should we build this" but "should we throw away
~5,000 lines of exactly-fitting code to take on ~12,700 lines of nearly-fitting code".

### The four options, honestly costed

| | Upfront cost | Ongoing risk | Fit with CLAUDE.md |
| --- | --- | --- | --- |
| **(A) Continue ours** | Already largely paid | Low — we own every invariant, no upstream | Exact: branded money, sync + pure, our event vocabulary, our undo |
| **(B) Adopt as a dependency** | Deceptively low, then blocks | **Unacceptable.** Phase 8 is unbuildable without patching a private async pipeline; sit-out silently corrupts position labels | Violates "pure, deterministic, synchronous"; degrades money typing to a runtime throw |
| **(C) Adapt behind a wrapper** | High — a milliBB↔Chips adapter, a sit-out shim, a top-up shim, a whole rake layer, a materialiser that computes `stackBefore` correctly *before* calling `reduce` (i.e. reimplementing the transition we were trying to avoid), plus reimplementing the unexported auto-advance replay | High — every 0.1.x bump risks the shim; undo/replay ends up implemented twice | Poor — the wrapper leaks async and unbranded money outward |
| **(D) Reference only** | Near zero | Near zero — MIT permits reading freely; we copy nothing | Perfect |

### Recommendation

**Continue our own `poker-core` (A), and use `poker-engine-ts` reference-only (D) as a
differential test oracle.**

The truthful reading is not "we are duplicating solved work" — that possibility was checked
carefully, and it is not what the evidence shows. `poker-engine-ts` solves a
server-authoritative, card-dealing, async, session-managed backend for *running* live
games. We are building a synchronous, manual-entry, observation-and-review engine for a
table we do not control, where stacks legitimately go stale and get resynced, where
players sit out, and where a CoinPoker rake schedule must be modelled. The overlap that
genuinely helps — betting-round state machine, min-raise, short-all-in reopen, side pots —
is the part we can specify precisely and test hard ourselves, and much of it is already
written. The 60% that does not overlap is exactly the part that must live *inside* the
state machine, so no wrapper can buy it.

### The evidence that would reverse this

State it so it is falsifiable. This recommendation should be revisited if **any** of the
following becomes true:

1. **Our side-pot or min-raise logic disagrees with `poker-engine-ts` on a case where they
   are right.** A differential run against their engine that surfaces real defects in ours
   would be evidence that we are underestimating the difficulty and overestimating our
   coverage.
2. **`poker-engine-ts` grows the four missing concepts** — sitting out, auto top-up, a
   dirty-stack/resync path, and configurable rake — *and* exports a complete synchronous
   replay. That would be a different library, and the calculus would change.
3. **The `stackBefore` invariant is relaxed** (or made opt-out). Today it is the single
   design decision most hostile to Phase 8; without it, option (C) becomes merely
   expensive rather than blocking.
4. **Phase 2 exceeds a large multiple of its estimate** on the edge cases where their
   tests already pass — multi-way layered all-ins, odd-chip settlement, cumulative short
   all-ins reopening betting. Cost is the argument for buying; if the cost estimate was
   wrong, revisit.

Note what is *not* on that list: bus factor, star count, and release cadence. Those are
real weaknesses (one contributor, one squashed commit, zero releases, quiet since
2026-07-05) but under MIT they are manageable by forking. They are not the reason for this
recommendation, and improvements in them should not by themselves reverse it.

---

## 6. CFR / baseline-generation path (Phases 13-14)

### What each project actually contributes

| Project | Contribution to Phase 13 | Contribution to Phase 14 |
| --- | --- | --- |
| **open_spiel** | **The validation gate.** Tabular CFR + **exact** exploitability on Kuhn and Leduc, running today: Kuhn 9.4e-4 at 1k iterations in 0.34 s; Leduc 3.6e-2 at 300 iterations in 15.5 s. Also a reference implementation set (CFR, CFR-BR, external/outcome-sampling MCCFR, discounted CFR) to check our own against. | None directly. Its own 6-player no-limit `universal_poker` has **100,001 distinct actions** and `max_game_length 542` — that is the unabstracted game, not a solvable one. |
| **poker_solver** | **Method and test design.** The DCFR discounting scheme with its published defaults; exact best-response exploitability; and the Kuhn **algebraic-invariant** test technique that validates a solver without over-constraining which equilibrium in the continuum it found. | **Schema and asset-format lessons only** — see the mapping table in §4.3. Its data cannot be our baseline: heads-up, no rake, and `final_exploitability_bb100: null` on all 27 shards. |
| **rs-poker** | **A cautionary reference.** Its CFR is a perfect-information search agent, proven by its own comments and by a reproduced hero-strategy flip under changed villain cards. Reading it is useful mainly for what an unvalidated "CFR solver" looks like from the outside. Its `Action`/`Historian` event design is separately worth reading. | **None.** No information sets, no exploitability, no strategy serialization, side pots collapsed in the reward path, no rake, `f32` money. |
| **poker-engine-ts / pokerkit** | None (neither has CFR). | None. |

### What is and is not computationally feasible — honestly

**Feasible, and effectively free:**

- Validating a CFR implementation on **Kuhn** (12 information sets) and **Leduc** (288
  information sets) against published equilibrium values, with *exact* exploitability.
  Measured above at sub-second and ~15-second scales respectively on a laptop.

**Feasible with real but bounded effort:**

- A **heavily abstracted** preflop-only or preflop-plus-one-street 6-max tree with a small
  fixed sizing menu and hand-class bucketing. `poker_solver` is the existence proof of the
  shape — 27 heads-up blueprint shards in 2,304 wall-seconds — but everything about the
  cost scales badly from 2 players to 6, and none of their numbers transfer.

**Not feasible, and nobody in this evaluation claims otherwise:**

- **An exact or near-exact equilibrium for full 6-max 100 BB NLHE.** Two independent
  measurements make the scale concrete. open_spiel's own unabstracted 6-player no-limit
  game exposes **100,001 distinct actions**. rs-poker's own source says CFR "allocate[s]
  ~17GB per game" — meaning per *hand*, at **3 players** — and probes reported 35.7 M nodes
  and 13.5 GB peak RSS for a single 6-handed deal at a modest iteration schedule
  **(unverified)**. Chance branching alone is decisive: branching on each hole card
  individually across six players is a combinatorial dead end before any betting is
  considered.

**Consequently, the realistic Phase 13 deliverable is a *validated method plus a measured
cost curve*, not a baseline.** `GTO_BASELINE.md` already says "Do not attempt a production
six-player NLHE solver in one phase"; this evaluation supplies the numbers behind that
sentence. Phase 14 remains correctly blocked, and any external "GTO" chart encountered
along the way — including rs-poker's `6Max-RFI-GTO` config — is a solver *input* with no
cited provenance, not a baseline.

---

## 7. Licence compliance rules for this project

### Verified licences

| Repository | SPDX | Verified from | Commercial / closed-source distribution |
| --- | --- | --- | --- |
| `Ge-limin/poker-engine-ts` | `MIT` | `LICENSE` file + `package.json` + API | Permitted; reproduce notice |
| `elliottneilclark/rs-poker` | `Apache-2.0` | `LICENSE` (201 lines) + `Cargo.toml` + API | Permitted; ship licence, mark modified files, retain notices; no NOTICE file exists to propagate |
| `amaster97/poker_solver` | `MIT` | `LICENSE` file + `pyproject.toml` + `Cargo.toml` + API | Permitted; reproduce notice |
| `google-deepmind/open_spiel` | `Apache-2.0` | `LICENSE` (202 lines) + per-file headers + API | Permitted; same conditions as rs-poker |
| `uoftcprg/pokerkit` | `MIT` | `LICENSE` file + API | Permitted; reproduce notice |

No licence-file-vs-metadata disagreement was found in any of the five.

### May be read for ideas — all five

All five are permissively licensed. Reading them, running them locally, and learning from
their design creates no obligation. `docs/DECISIONS.md` should nevertheless record *that
they were read*, per `GTO_BASELINE.md`'s rule to document licences before touching any
external solver.

### May be depended on, subject to a decision

Licence poses no obstacle to depending on any of the five. The reasons not to depend on
`poker-engine-ts` and `rs-poker` are technical (§4.1, §4.2), not legal. `open_spiel` is the
only dependency actively proposed, and only inside `solver-lab`, which per CLAUDE.md is
never imported by the app.

If we ever **vendor** rather than link:

- MIT projects: reproduce the licence text and copyright line in a third-party notices
  file.
- Apache-2.0 projects: additionally mark modified files as changed, and retain the
  per-file headers (open_spiel has them; rs-poker does not).
- rs-poker's `build.rs` reimplements zekyll's **OMPEval (MIT)** with attribution in source
  comments only, and the repository has no NOTICE file. If we vendor `build.rs` or its
  generated tables, we should reproduce the OMPEval MIT notice ourselves rather than rely
  on upstream's comment **(the adequacy of upstream's attribution is unverified)**.

### Must not be copied from, under any circumstances

**AGPL/GPL exposure.** The AGPL-3.0 is the sharp edge here, because a training app that is
ever network-accessible triggers §13's source-disclosure obligation even without
distributing binaries. That is flatly incompatible with a possible closed-source product.

- **`b-inary/postflop-solver` — AGPL-3.0. Do not copy. Do not vendor. Do not paste.**
- **`bupticybee/TexasSolver` — AGPL-3.0. Same.**
- **`24parida/shark-2.0` — unlicensed** (no licence file = all rights reserved; worse than
  AGPL for our purposes, because there is no grant at all). **Do not copy.**

These three are named in `amaster97/poker_solver`'s own contamination blocklist, and that
project's handling of them is the model to follow: read-only inspiration, kept out of the
repository (their `references/` directory is gitignored and absent from the clone), with a
per-module provenance header stating what pattern was followed and that no AGPL code was
transcribed. `grep -rniE "affero|GNU General Public"` over their `.py`/`.rs`/`.toml` files
returns zero hits — a check we should be able to run on ourselves.

**Also forbidden regardless of licence** (CLAUDE.md rule 2, `GTO_BASELINE.md`):

- Any hand-authored or unprovenanced strategy chart presented as GTO. Concretely:
  rs-poker's `examples/configs/preflop_6max_rfi.json` ("6Max-RFI-GTO", 33,081 bytes) is a
  solver *input* with no cited source. **Do not import it.**
- `poker_solver`'s 27 blueprint shards — MIT-licensed, so legally copyable, but they are
  heads-up, rake-free, and carry `final_exploitability_bb100: null`, with 4.9% of rows
  being an unmarked uniform fallback. Importing them would put unlabelled non-strategy
  into a strategy table.
- `poker-engine-ts`'s `src/persona/baseline.ts` invented trait numbers.
- Scraping GTO Wizard or any solver product, and copying proprietary solution datasets.

**A note on differential-oracle outputs.** Committing pot sizes and side-pot splits
produced by running a permissively-licensed engine as fixtures is *probably* fine — those
are determined facts about the rules of poker, not creative expression, and they are not
strategy data. But that is a reading, not a verified legal position **(unverified)**, and
it should be settled explicitly in `docs/DECISIONS.md` before any such fixture lands.

---

## 8. Open questions and unverified claims

Everything below is either something the fact-check could not confirm, something no agent
attempted, or a disagreement between sources. **None of it should be acted on as fact.**

**Refuted or corrected — the correction stands:**

1. The survey's claim that `poker-engine-ts`'s exported `replayEvents` is a complete pure
   replay is **wrong**. It misses street advancement and settlement; the complete path is a
   private async method. The survey's probe passed only because it never crossed a street
   boundary. This makes the case against adoption stronger, not weaker.
2. `poker-engine-ts` non-test `rake` grep: **14** hits, not 12.
3. rs-poker `git shortlog`: **272 + 146 = 418** of 436, not 144/416.
4. Our own `packages/poker-core` is **not** an empty placeholder and
   `docs/POKER_CORE_API.md` **does** exist — the deep dive's reading was accurate when
   taken and is now stale.

**Could not be verified:**

5. **rs-poker CFR tree-scale figures** (129,215 nodes at `[100,1]` up to 35,774,485 nodes /
   13.52 GB peak RSS at `[20,5,3,1]`; ~378 bytes/node; a `[100,10,5,1]` run reaching
   30.4 GB). The probe source exists and a sibling probe was independently reproduced, but
   re-running these would take tens of minutes and up to ~30 GB RSS. *To settle:* re-run
   `examples/gto_self_tree.rs` under `/usr/bin/time -l`. Not decision-relevant — the
   information-set finding alone is dispositive.
6. **rs-poker hand-evaluation timing** (475-525 ps/op for `SevenCardAccum::rank`) and the
   README's "50M+ hands/sec per core". *To settle:* `cargo bench --bench hand_eval` and
   `--bench rank`.
7. **rs-poker's bet-index collapse probe output** (2.0/2.25/2.5 BB → slot 4). The 16-slot
   constant is confirmed in source and the collapse follows structurally, but the specific
   mapping was not re-executed. *To settle:* re-run `examples/gto_self_probe.rs`.
8. **Five rs-poker transitive dependencies** could not be resolved locally: `valuable
   0.1.1`, `linux-raw-sys 0.4.15`, `wasi 0.11.1`, `crossterm_winapi 0.9.1`, `rs_poker
   5.1.0`. All are well-known permissive crates, but that is not evidence. *To settle:*
   `cargo license` or `cargo deny check licenses` on a fully vendored tree.
9. **Whether rs-poker's core builds for `wasm32-unknown-unknown` with
   `--no-default-features`.** The claim that the arena/CFR feature is impractical for WASM
   is inferred from its dependency set (tokio `rt-multi-thread`, `parking_lot`, jemalloc,
   `panic = "abort"`), not from a failed compile.
10. **The provenance of rs-poker's `preflop_6max_rfi.json`.** It is established that no
    source appears anywhere in the repository; it is *not* established where the numbers
    came from. If they were derived from a commercial solver's output, that would raise a
    question beyond Apache-2.0. Treat the file as untouchable either way.
11. **Whether zekyll's OMPEval MIT notice is adequately reproduced** by rs-poker's
    source-comment-only attribution.
12. **`poker_solver`'s transitive Rust dependency licences.** Only the seven direct deps
    were checked by name.
13. **`poker_solver`'s Rust tier was never executed** — 225 `#[test]` functions counted, none
    run, because no Rust toolchain was available in that pass. 3 of its Python tests fail
    for the same reason.
14. **`poker-engine-ts` postflop behaviour** — street transitions, board dealing, the
    578-line 7-card evaluator (wheel straights, counterfeited two-pair, kicker comparison)
    and showdown settlement were never driven end-to-end independently. Their own tests
    cover it and pass. Before using it as an oracle *for showdown results* — as opposed to
    pot math, which was verified — that gap must be closed.
15. **`poker-engine-ts`'s unexercised config branches** — the `progressive` ante policy and
    the fixed-limit / pot-limit betting structures were read but not run. Given that
    `appliesTo` turned out to be silently ignored, no unexercised branch should be assumed
    to work as its types advertise.
16. **`poker-engine-ts` per-hand blind override.** `blindSchedule` is level-based; no
    per-hand override path was found. *To settle:* read `bootstrapSession` / `resetHand` in
    `session/lifecycle.ts`.
17. **Integration-effort estimates are judgement, not measurement** — "the adapter would be
    comparable in size to the engine it wraps" (poker-engine-ts); "a day or two for an
    offline `rsp` subprocess, roughly a week for a napi/wasm wrapper" (rs-poker). The
    structural mismatches underneath them are each verified; the sizing conclusions are not.
18. **`open_spiel` was only partially evaluated** and has had no independent fact-check.
    Specifically unverified: whether our 0.16 BB/player ante can be faithfully encoded
    through per-player `blind` values (there is **no** ante parameter); whether rake can be
    modelled at all; the money representation; and whether a tractable 6-max abstraction is
    buildable in reasonable time.
19. **`pokerkit` was only partially evaluated** and has had no independent fact-check. Its
    6-max, ante, side-pot, replay and event behaviour are all unverified. The one thing
    verified beyond its licence is its rake function, which **rounds (half-to-even) rather
    than floors** — a real divergence from our money contract.
20. **Whether differential-oracle outputs are safe to commit as fixtures** is a reading, not
    a verified legal position (see §7).

---

## 9. Recommended next actions for the orchestrator

These are **decisions to be made**, not work to be started. This document is input to a
decision; it does not make one, and nothing here should be read as authorising an
implementation.

1. **Decide the disposition of `poker-engine-ts` relative to `packages/poker-core`.**
   Options: (a) continue our own implementation and use it reference-only — the
   recommendation in §5; (b) adopt it as a dependency; (c) adapt it behind a wrapper; (d)
   ignore it entirely. If (a), a follow-on sub-decision: whether to authorise a
   differential-oracle harness in `solver-lab` or a scratch area, and — per §7 — whether
   its numeric outputs may be committed as fixtures.

2. **Decide whether `open_spiel` is accepted as the Phase 13 validation dependency.**
   Options: (a) accept it for `solver-lab` only, on the strength of the Kuhn/Leduc
   exploitability run in §4.4; (b) accept it conditionally, gated on the confirmation pass
   in decision 4; (c) build our own Kuhn/Leduc harness from scratch and use open_spiel only
   as a cross-check; (d) reject it. Note that only `solver-lab` may depend on it, and
   `solver-lab` may import `shared` only.

3. **Decide what Phase 13's deliverable actually is.** Options: (a) a validated CFR
   implementation plus a measured cost curve, with no 6-max baseline attempted — the
   reading of the evidence in §6; (b) additionally attempt a heavily abstracted
   preflop-only 6-max solve; (c) defer Phase 13 entirely. This determines whether Phase 14
   is merely blocked or is not yet scopeable.

4. **Decide whether `open_spiel` and `pokerkit` get a full evaluation pass.** Both were
   only partially evaluated here and neither has been through the independent fact-check
   the other three had. Options: (a) commission full survey + deep dive + fact-check for
   both; (b) for `open_spiel` only, since it is the only adoption candidate; (c) accept the
   partial evaluation as sufficient and record the residual risk in `docs/DECISIONS.md`.
   The specific open items are §8 numbers 18 and 19.

5. **Decide which schema recommendations from §4.3 are adopted into the Phase 9 GTO
   tables.** Each is independent: `action_tree_hash` on `gto_solution_sets`;
   `board_signature` on `gto_spots`; **NOT NULL** `exploitability`; integer
   ten-thousandths for frequencies instead of float; an explicit `unreached` flag on
   `gto_strategies`; `effective_stack_mbb` alongside `stack_bucket_mbb`; and a
   checksummed manifest for any externally-produced payload. Options per item: adopt,
   defer to Phase 9's own design, or reject.

6. **Decide the licence-hygiene posture to record in `docs/DECISIONS.md`.** Options: (a)
   adopt `poker_solver`'s model in full — a named AGPL/unlicensed blocklist, a gitignored
   `references/` area, per-module provenance headers, and a repository-wide
   `affero|GNU General Public` grep as a standing check; (b) record the blocklist only; (c)
   record only the five verified licences from §7. Whichever is chosen, §7's three named
   AGPL/unlicensed repositories should be written down explicitly, since they are the
   projects a future agent is most likely to find when searching for a poker solver.

7. **Decide the rake-rounding cross-check policy** before any comparison run against
   `pokerkit`. Our contract floors; `pokerkit` rounds half-to-even. Options: (a) normalise
   its rounding at the comparison boundary; (b) restrict oracle comparisons to pots where
   the two agree; (c) do not use it as a rake oracle at all.
