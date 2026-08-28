# Architecture

## Philosophy

```
INPUT  ->  AUTOMATIC STATE CALCULATION  ->  STRATEGY LOOKUP  ->  REVIEW
```

The user types what happened. The engine derives everything else. The user should
never be asked to compute a pot, a call amount, a min-raise, an effective stack, or a
bet-as-percentage-of-pot.

## Workspace layout

```
GTO-SELF/
  apps/web/                 Next.js 16 App Router UI (presentation only)
  packages/
    shared/                 milliBB money, cards, ids, Result   (no deps)
    poker-core/             pure NLHE state engine              (-> shared)
    gto-core/               solutions, provider, matcher, policy(-> shared)
    player-core/            players, HUD snapshots, observations(-> shared)
    db/                     Drizzle + SQLite persistence        (-> domain pkgs)
    coinpoker-parser/       hand-history text -> domain events  (-> poker-core)
  solver-lab/               CFR research sandbox, never shipped (-> shared)
  docs/                     the persistent project brain
  fixtures/coinpoker/       real hand-history fixtures (git-ignored if private)
```

Workspace packages are consumed as **TypeScript source** (`exports` -> `./src/index.ts`).
There is no per-package build step; Next `transpilePackages` and Vitest aliases
compile them. This keeps refactors cheap and stack traces honest.

## Domain boundaries

### A. Poker Engine — `@gto-self/poker-core`

Pure, deterministic, synchronous. Knows nothing about GTO, players, storage or React.

Owns: seats and seat state, button/SB/BB, ante and blind posting, positions, stacks,
street contributions, total contributions, pot, call amount, minimum legal raise,
all-in, effective stack, SPR, action order, fold/check/call/bet/raise/all-in,
uncalled-bet returns, street transitions, hand completion, rake, settlement, and
event-sourced undo/replay.

### B. GTO Engine — `@gto-self/gto-core`

Owns: solver config models, versioned solution sets, spots, nodes, action
frequencies, optional action EV, the `GTOProvider` interface, the
`NearestSolutionMatcher`, and the strategy policy layer.

Knows nothing about individual players. Never mutated by player statistics.

### C. Player Engine — `@gto-self/player-core`

Owns: player identity (manual nickname is primary), manual CoinPoker HUD snapshots,
notes, our own observations, and context-scoped confidence.

Manual HUD snapshots and our own observations are permanently separate record types.
Manual snapshots are never auto-overwritten.

### D. Strategy Policy — a composition layer above `gto-core` and `player-core`

Three presentation modes: `GTO`, `SAFE_GTO` (default), `ADAPTIVE` (scaffolding only).

The GTO baseline is always kept intact and separately visible. `SAFE_GTO` is a policy
layer _on top of_ GTO, never relabelled as equilibrium. See `docs/GTO_BASELINE.md` for
the exact rules.

**Where it lives.** `gto-core` must never depend on `player-core` (ADR-0021) — player
statistics can never be allowed to influence baseline solution data. But `ADAPTIVE` is by
definition a function of both the baseline and a player's tendencies. Those two facts
force strategy policy into its own layer that depends on both, rather than into either of
them (ADR-0023):

```
   gto-core          player-core
       \                /
        strategy-policy        <- composes; may depend on both
              |
           apps/web
```

During MVP, `GTO` and `SAFE_GTO` need no player data and may be implemented inside
`gto-core`. `ADAPTIVE` is what forces the split, and the split happens before any adaptive
logic is written — not after.

## Money

One unit: **milliBB**, an integer. `1 BB = 1000 milliBB`.

```
100 BB   = 100000
0.5 BB   =    500
0.16 BB  =    160
2.37 BB  =   2370
```

`packages/shared/src/money.ts` is the only place money arithmetic is defined. Every
operation that can lose precision takes an explicit `RoundingMode` — there is no
implicit rounding anywhere in the codebase. Rake floors. Sizing targets round.

## Event model

A hand is an ordered list of events; state is a fold over those events. Undo removes
the last logical user event and rebuilds from scratch — no inverse operations, no
drift.

```
HAND_STARTED  PLAYER_DEALT_IN  POST_ANTE  POST_SB  POST_BB  HOLE_CARDS_SET
FOLD  CHECK  CALL  BET  RAISE  ALL_IN  RETURN_UNCALLED
FLOP_DEALT  TURN_DEALT  RIVER_DEALT
POT_AWARDED  HAND_FINISHED
```

Two corrections against the original sketch, made in Phase 1 and normative from here
(the authoritative definition is `HandEventKind` in `packages/poker-core/src/events.ts`,
specified in `docs/POKER_CORE_API.md`):

- **`HOLE_CARDS_SET` replaces `SHOW_CARD`.** Cards are set for a seat as a unit, and the
  same event serves both the Hero's own cards and a showdown reveal, so one event covers
  both rather than a per-card event that would need reassembling on replay.
- **There is no street-transition event.** The street is derived from the board deals and
  the betting-round state. An explicit `STREET_ADVANCED` would be a second source of truth
  for something already implied, and the two could disagree after an undo.

Persist the _actual_ input values. Derived values must be reproducible from the event
log plus the hand's starting configuration.

## Actual vs normalized state

Original user input is never destroyed. Every strategy lookup carries both:

```
ACTUAL                     MODEL (normalized)
effective stack 93.7 BB    stack bucket 100 BB
HJ open 2.37 BB            HJ open 2.5 BB
```

Matching priority, in order — earlier criteria must match before later ones are
approximated:

1. game format exact
2. dealt-in player count / supported lineup
3. positions exact
4. **action-tree structure exact** (`BTN open -> BB call` is never approximately
   `BTN open -> BB 3bet -> BTN call`)
5. board exact or canonically equivalent
6. nearest stack bucket
7. nearest bet sizing

Sizing comparison: preflop by raise-to size in BB; postflop by bet size as a fraction
of the pot **before** the action. Ties break deterministically and are tested.

## Persistence

SQLite via Drizzle for MVP, schema kept portable to PostgreSQL. Tables:
`game_presets`, `players`, `player_hud_snapshots`, `player_notes`, `sessions`,
`session_seats`, `hands`, `hand_players`, `hand_events`, `gto_solver_configs`,
`gto_solution_sets`, `gto_spots`, `gto_nodes`, `gto_strategies`,
`player_observations`, `player_aggregates`.

GTO solution payloads are not prematurely normalized — large future blobs may move to
object storage, so access goes through an interface.

## Performance

Reducer work is trivial arithmetic over a few dozen events; strategy lookup is a local
indexed read. Neither may become a network round trip, and neither may ever involve an
LLM.
