# GTO-SELF

Fast, independent poker training, hand replay and strategy review for CoinPoker-style
6-max NLHE cash games.

You enter the action manually into your own training table; the engine derives every
pot, stack, call amount, min-raise, effective stack and sizing for you, then looks up
the matching strategy node.

**GTO-SELF is not connected to any poker client.** No screen reading, no OCR, no
automation, no scraping. It is a training and review tool.

## Quick start

```bash
pnpm install
pnpm verify     # typecheck + test + build
pnpm dev        # http://localhost:3210
```

## Repository map

| Path                        | What lives there                                        |
| --------------------------- | ------------------------------------------------------- |
| `apps/web`                  | Next.js UI (presentation only)                          |
| `packages/shared`           | milliBB money, cards, ids, `Result`                     |
| `packages/poker-core`       | Pure deterministic NLHE state engine                    |
| `packages/gto-core`         | Solutions, provider interface, matcher, strategy policy |
| `packages/player-core`      | Players, manual HUD snapshots, observations             |
| `packages/db`               | Drizzle + SQLite persistence                            |
| `packages/coinpoker-parser` | Hand-history text -> domain events                      |
| `solver-lab`                | CFR research sandbox, never shipped with the app        |
| `docs/`                     | Architecture, decisions, roadmap, state, UX, GTO rules  |
| `fixtures/coinpoker`        | Real hand-history fixtures (see its README)             |

## Start here

- `CLAUDE.md` — the rules
- `docs/STATE.md` — where the project actually is
- `docs/ARCHITECTURE.md` — how it fits together
- `docs/DECISIONS.md` — why it is like that

## Status

Phase 0 complete. See `docs/ROADMAP.md`.
