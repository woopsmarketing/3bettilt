# GTO-SELF — project rules

Read this before touching anything. Then read `docs/STATE.md` for where the project
actually is, and `docs/DECISIONS.md` for why things are the way they are.

## What this is

A fast, independent poker training / hand-replay / strategy-review app for
CoinPoker-style 6-max NLHE cash games. The user manually enters actions into our own
training table.

**It is not connected to any poker client.** Never build, propose, or scaffold:
screen reading, OCR, screen capture, client automation, input injection, scraping a
poker client, or automated live play. This is a hard product boundary, not a
preference.

## Non-negotiable rules

1. **Money is integer milliBB.** 1 BB = 1000 milliBB. Every pot, stack, wager,
   contribution, rake and settlement value goes through `Money` from
   `@gto-self/shared`. Floating point is allowed only at the UI/parse boundary and
   for non-money ratios (e.g. bet-as-fraction-of-pot). Never `+`/`*` raw money
   numbers; use `Money.add`, `Money.mulRatio`, etc. Rounding is always explicit.
2. **Never invent GTO numbers.** Do not hard-code strategy percentages and present
   them as GTO. Do not scrape GTO Wizard or copy proprietary solution datasets. Mock
   strategy data must be typed, tagged `MOCK`, and visibly labelled in the UI.
3. **Never destroy user input.** Actual entered values are persisted alongside any
   normalized/bucketed values used for solution lookup. Both are shown.
4. **Layering is enforced.** `poker-core` and `gto-core` must not import React,
   Next.js, or `@gto-self/db` (ESLint enforces this). The domain engine is
   authoritative; the DB is persistence; React is presentation.
5. **No fake implementations.** No stubs that silently return plausible values. A
   `TODO` must be explicit, documented, and listed in `docs/STATE.md` under known
   issues.
6. **No LLM in the decision path.** Strategy lookup is a local/database lookup.
   AI may only ever be an optional post-hoc explanation tool.
7. **When unsure about a poker rule, do not invent behaviour.** Add a documented
   assumption in `docs/DECISIONS.md` and expose a manual override in the UI.
8. **No scope expansion, no drive-by refactors.** Do the phase you were given.

## Layering (import direction)

```
shared  <-  poker-core  <-  coinpoker-parser
   ^            ^
   |            |
   +--  gto-core, player-core
   |            ^
   +--  db  ----+          (db may import domain types; domain never imports db)
                ^
             apps/web      (may import everything)
solver-lab  ->  shared only. Never imported by the app.
```

## Commands

| Command                                | What it does                         |
| -------------------------------------- | ------------------------------------ |
| `pnpm install`                         | Install workspace                    |
| `pnpm typecheck`                       | `tsc --noEmit` in every package      |
| `pnpm test`                            | Vitest across all projects           |
| `pnpm vitest run --project poker-core` | One package's tests                  |
| `pnpm build`                           | Next production build                |
| `pnpm lint`                            | ESLint (includes the layering rules) |
| `pnpm verify`                          | typecheck + test + build             |
| `pnpm dev`                             | Next dev server on :3210             |
| `pnpm e2e`                             | Playwright critical-path tests       |

Before you report a phase complete: `pnpm verify` must pass, and you must have
added real tests for every money/state transition you touched.

## Working agreement for phase agents

- Inspect existing code before editing. Do not guess an API contract — open the file.
- Stay inside your phase's file boundary. If you need a change outside it, say so in
  your report instead of making it.
- Prefer pure functions for poker math. Keep UI state and domain truth separate.
- Update `docs/STATE.md` is the **orchestrator's** job, not yours — report instead.
