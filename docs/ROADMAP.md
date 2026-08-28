# Roadmap

Phases run sequentially. Each is delegated to a fresh agent with only the context it
needs. Status is authoritative in `docs/STATE.md`; this file holds scope and
acceptance criteria.

| #   | Phase                         | Package(s)           | Status              |
| --- | ----------------------------- | -------------------- | ------------------- |
| 0   | Repository bootstrap          | root, shared         | **done**            |
| 1   | Poker core domain             | poker-core           | pending             |
| 2   | Poker core edge cases         | poker-core           | pending             |
| 3   | Database and player domain    | db, player-core      | pending             |
| 4   | Session setup UX              | web                  | pending             |
| 5   | Main table UI                 | web                  | pending             |
| 6   | Fast action UX                | web                  | pending             |
| 7   | Card palette                  | web                  | pending             |
| 8   | Observe / dirty stack flow    | web, poker-core      | pending             |
| 9   | GTO provider interface        | gto-core             | pending             |
| 10  | Strategy UI + safe policy     | gto-core, web        | pending             |
| 11  | CoinPoker hand-history parser | coinpoker-parser     | pending             |
| 12  | QA / MVP hardening            | all                  | pending             |
| 13  | Solver research spike         | solver-lab           | not started (gated) |
| 14  | Real baseline generation      | solver-lab, gto-core | blocked on 13       |

## Phase acceptance criteria

**0 — Bootstrap.** `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm lint` all succeed. Docs exist. Money primitives implemented and tested.

**1 — Poker core domain.** Fixed-point money wiring, cards, seats, players-in-hand,
positions, hand state, action/event types, blinds + ante posting, betting-round state,
legal actor ordering, fold/check/call/bet/raise/all-in, effective stack, SPR, street
transitions, immutable reducer/replay. Works with no React and no database.

**2 — Poker core edge cases.** All-in, uncalled amount, side-pot-ready architecture,
sitting out, empty seats, fewer than six dealt in, auto top-up boundaries,
undo/replay correctness, min-raise validation (including the short all-in that does
not reopen betting).

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

**10 — Strategy UI + safe policy.** All frequencies shown, highest-frequency labelled
as such (never "correct"), actual and model context shown, `GTO` / `SAFE_GTO` /
`ADAPTIVE` policy interfaces with EV-aware tie-breaking only where EV data exists.

**11 — Parser.** Fixture-driven parse to neutral events, replayed through the engine.
Covers ante, blinds, all action verbs, all-in, uncalled returns, streets, showdown,
rake, splash fee, run-it-twice.

**12 — QA hardening.** Full critical path exercised repeatedly, Playwright coverage,
UX friction removed.

**Pre-13 planning checkpoint (ADR-0020).** Phase 13 does not start until six items are
settled and written down: exact baseline coverage and version naming; exact CoinPoker rake
trigger semantics verified against real hand histories; rake rounding semantics; Splash Fee
treatment; solver validation thresholds; and solver reproducibility requirements. Items 5
and 6 must be fixed *before* any solve — a threshold chosen once the number is known is not
a threshold, and reproducibility retrofitted onto a finished run is a guess about what ran.

**13 — Solver research spike.** Gated. Requires an explicit go-ahead. Scope fixed by
ADR-0014 after the open-source evaluation measured the problem: the deliverable is
(1) our own CFR validated on Kuhn and Leduc against published equilibria, and (2) a
measured cost curve for progressively larger abstractions. A 6-max NLHE baseline is
**not** attempted. Preconditions: the full evaluation pass on `open_spiel` (ADR-0013),
and licences documented before any external solver is touched (ADR-0015).

**14 — Real baseline generation.** Blocked on 13, and now understood to be *not yet
scopeable* rather than merely pending: nothing evaluated solves 6-max NLHE, and the
measured scale (open_spiel's unabstracted 6-player no-limit game exposes 100,001 distinct
actions; rs-poker's own source allocates ~17 GB per hand at three players) says no
single-machine exact solve exists to schedule.
