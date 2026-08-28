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

### D. Strategy Policy — inside `@gto-self/gto-core`

Three presentation modes: `GTO`, `SAFE_GTO` (default), `ADAPTIVE` (scaffolding only).

The GTO baseline is always kept intact and separately visible. `SAFE_GTO` is a policy
layer _on top of_ GTO, never relabelled as equilibrium. See
`docs/GTO_BASELINE.md` for the exact rules.

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
HAND_STARTED  PLAYER_DEALT_IN  POST_ANTE  POST_SB  POST_BB
FOLD  CHECK  CALL  BET  RAISE  ALL_IN  RETURN_UNCALLED
FLOP_DEALT  TURN_DEALT  RIVER_DEALT  SHOW_CARD
POT_AWARDED  HAND_FINISHED
```

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
