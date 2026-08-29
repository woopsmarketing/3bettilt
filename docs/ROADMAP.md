# Roadmap

Phases run sequentially. Each is delegated to a fresh agent with only the context it
needs.

**This file holds scope and acceptance criteria only. It carries no status.**
`docs/STATE.md` is the single authoritative source for what is done, in flight, or next.
A status column here would be a second copy of mutable state, and the two would drift.

| #   | Phase                         | Package(s)                     |
| --- | ----------------------------- | ------------------------------ |
| 0   | Repository bootstrap          | root, shared                   |
| 1   | Poker core domain             | poker-core                     |
| 2   | Poker core edge cases         | poker-core                     |
| 3   | Database and player domain    | db, player-core                |
| 4   | Session setup UX              | web                            |
| 5   | Main table UI                 | web                            |
| 6   | Fast action UX                | web                            |
| 7   | Card palette                  | web                            |
| 8   | Observe / dirty stack flow    | web, poker-core                |
| 9   | GTO provider interface        | gto-core                       |
| 10  | Strategy UI + safe policy     | gto-core, strategy-policy, web |
| 11  | CoinPoker hand-history parser | coinpoker-parser               |
| 12  | QA / MVP hardening            | all                            |
| 13  | Solver research spike         | solver-lab                     |
| 14  | Real baseline generation      | solver-lab, gto-core           |

Phases 13 and 14 are **gated**, not merely later — see their acceptance criteria and the
pre-13 checkpoint below.

**Delivery order is 2 → 10, then 12** (ADR-0033). Phase 10 is the first point at which a
person can open the app and run practice hands end to end, which is the milestone that
matters. **Phase 11 is deferred past it** and unblocks nothing before it.

## Phase acceptance criteria

**0 — Bootstrap.** `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm lint` all succeed. Docs exist. Money primitives implemented and tested.

**1 — Poker core domain.** Fixed-point money wiring, cards, seats, players-in-hand,
positions, hand state, action/event types, blinds + ante posting, betting-round state,
legal actor ordering, fold/check/call/bet/raise/all-in, effective stack, SPR, street
transitions, immutable reducer/replay. Works with no React and no database.

**2 — Poker core edge cases.** Multi-way side-pot _award_ breadth and both
`rake.allocation` branches under a real multi-pot hand; odd chips under simultaneous
multi-pot splits; auto top-up boundaries; sitting out, empty seats, fewer than six dealt
in; undo/replay correctness; min-raise validation (including the short all-in that does
not reopen betting). Hand evaluation stays out of scope — the winner is an `AWARD_POTS`
input, which is where an evaluator plugs in later.

_Blinds (ADR-0031)._ Phase 2 implements only what is neutral: `POST_DEAD_BLIND` as a
neutral accounting event if it is actually needed, a manual SB/BB assignment override at
hand start, and the engine primitives the later UI needs. It does **not** implement
automatic CoinPoker missed-blind or dead-button behaviour — that differs per room and no
fixture has confirmed CoinPoker's. **Phase 8** owns the user-facing override UX.
Site-specific automatic rules stay unimplemented until verified.

_ADR-0018 follow-up (bounded)._ Generalize `RakeConfig.noFlopNoDrop` into a named
`triggerPolicy`, and add `FeeConfig`. The real hand-history arithmetic shows the CoinPoker
Splash Fee is a **separate deduction from the pot payout**, so Phase 2 owns `FeeConfig`, a
separately recorded total fee amount, the settlement accounting, and a chip-conservation
invariant **that includes fees**. Splash-fee _trigger_ semantics are not to be invented.
Phase 11 owns parsing the observed fee out of CoinPoker text.

_Settlement policy surface (ADR-0027 + ADR-0033)._ The real fixture is **not** being
provided and Phase 2 does **no** further forensic reconstruction without it. Phase 2 instead
builds the configuration surface so a later correction is config-only: a named rake
`triggerPolicy` replacing the `noFlopNoDrop` boolean; an explicit settlement `quantum` and
`rounding` on `RakeConfig`, **not** derived from `DisplayConfig`; the rate stays an exact
rational and the cap stays `MilliBB`. Everything still unknown — half-way tie-breaking, the
splash-fee trigger — stays an explicitly named, validated policy field with a documented
default, never a guess buried in code.

**3 — Database and player domain.** Drizzle + SQLite, migrations, players, HUD
snapshots, sessions, seats, hands, events, notes. Manual HUD snapshots never
auto-overwritten. DB integration tests.

**4 — Session setup UX.** Six seats, nickname search/autocomplete, existing-player
reuse, new-player HUD entry, stack input, Hero selection, active/sitting-out/empty,
auto top-up toggle, ante on/off, NL50 preset. Efficient tab order.

**5 — Main table UI.** Hero fixed bottom-centre, six seats, pot/board, position
markers, current-actor highlight, inline stack editing, player profile panel,
dirty-stack indicator.

**6 — Fast action UX.** `F C R A Z N` keys, numeric raise-to entry, Enter/Esc, action
history, automatic next actor, automatic street transition.

**7 — Card palette.** 52-card picker, Hero 2 / flop 3 / turn 1 / river 1, dead-card
disabling, automatic open and close.

**8 — Observe / dirty stack flow.** Hero fold -> Observe mode, continue observing,
Skip Rest, dirty marking, inline resync with next-dirty focus, next-hand rotation,
auto top-up, manual button/blind override.

**9 — GTO provider interface.** `GTOProvider`, `SolutionSet`, `Spot`, `Strategy`,
action frequency and optional EV models, actual-vs-normalized context,
`NearestSolutionMatcher`. Mock provider only, every response typed and labelled MOCK.

Binding design inputs are recorded in **`docs/GTO_DESIGN_NOTES.md`** (notes A-G) and
**ADR-0016**: per-position stack profiles rather than a scalar effective stack; two separate
postflop sizing formulas; an `EXACT`/`APPROXIMATE`/`UNSUPPORTED` match result with explicit
tolerances; unreached strategies as a discriminated union carrying no renderable frequency;
an extensible quality-metric kind; a documented poker->GTO adapter seam; and lineup-bearing
baseline identifiers (ADR-0028).

**10 — Strategy UI + safe policy.** All frequencies shown, highest-frequency labelled
as such (never "correct"), actual and model context shown, `GTO` / `SAFE_GTO` /
`ADAPTIVE` policy interfaces with EV-aware tie-breaking only where EV data exists.

Creates **`packages/strategy-policy`** with its own ESLint entry (ADR-0023). `gto-core` may
hold the pure `GTO` and `SAFE_GTO` primitives, which need no player data; cross-domain
composition and `ADAPTIVE` live in `strategy-policy`, which is the only package permitted to
depend on both `gto-core` and `player-core`. The split happens before any adaptive logic is
written, not after.

**11 — Parser. DEFERRED (ADR-0033)** until after the first usable MVP, and it is not a
dependency of any phase before it. Fixture-driven parse to neutral events, replayed through
the engine. Covers ante, blinds, all action verbs, all-in, uncalled returns, streets,
showdown, rake and the observed splash-fee amount. Persistent opponent identity is **never**
derived from hand-history IDs — player identity stays manual nicknames plus our own
observations.

_Run it twice (ADR-0030)._ The MVP parser **parses and preserves RIT text losslessly** in a
neutral representation, and **does not require the single-board engine to replay it**.
Single-run hands are replayed through `poker-core`; RIT hands are preserved and explicitly
marked not-engine-replayable. A true multi-board engine — `board` as a list of boards,
`POT_AWARDED` with a run index — is a **separate design decision taken before any
implementation**, not a retrofit discovered midway through this phase.

**12 — QA hardening.** Full critical path exercised repeatedly, Playwright coverage,
UX friction removed.

**Pre-13 planning checkpoint (ADR-0020).** Phase 13 does not start until six items are
settled and written down: exact baseline coverage and version naming (ADR-0019 + ADR-0028 fix
the identifier format; the concrete identifier set still has to be chosen); exact CoinPoker
rake trigger semantics verified against real hand histories (ADR-0018); rake rounding
semantics (ADR-0027 fixes the model — an explicit settlement quantum on `RakeConfig`; ADR-0033
superseded the Phase-2 fixture analysis, so confirming the observed rule against real CoinPoker
data is itself a pre-13 validation task); Splash Fee treatment (ADR-0018: a separate deduction,
trigger semantics still unknown); solver validation thresholds; and
solver reproducibility requirements. Items 5 and 6 must be fixed _before_ any solve — a
threshold chosen once the number is known is not a threshold, and reproducibility retrofitted
onto a finished run is a guess about what ran.

**13 — Solver research spike.** Gated. Requires an explicit go-ahead. Scope fixed by
ADR-0014 after the open-source evaluation measured the problem: the deliverable is
(1) our own CFR validated on Kuhn and Leduc against published equilibria, and (2) a
measured cost curve for progressively larger abstractions. A 6-max NLHE baseline is
**not** attempted. Preconditions: the full evaluation pass on `open_spiel` (ADR-0013),
and licences documented before any external solver is touched (ADR-0015).

**14 — Real baseline generation.** Blocked on 13, and now understood to be _not yet
scopeable_ rather than merely pending: nothing evaluated solves 6-max NLHE, and the
measured scale (open_spiel's unabstracted 6-player no-limit game exposes 100,001 distinct
actions; rs-poker's own source allocates ~17 GB per hand at three players) says no
single-machine exact solve exists to schedule.
