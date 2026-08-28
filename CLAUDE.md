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
   Next.js, or `@gto-self/db`. `poker-core` additionally must not import `gto-core` or
   `player-core` — the poker engine knows nothing about CFR, GTO data, SAFE_GTO,
   ADAPTIVE, or player tendencies. `gto-core` must not import `player-core` — player
   statistics must never influence baseline solution data. ESLint enforces all of this.
   The domain engine is authoritative; the DB is persistence; React is presentation.
5. **No fake implementations.** No stubs that silently return plausible values. A
   `TODO` must be explicit, documented, and listed in `docs/STATE.md` under known
   issues.
6. **No LLM in the decision path.** Strategy lookup is a local/database lookup.
   AI may only ever be an optional post-hoc explanation tool.
7. **When unsure about a poker rule, do not invent behaviour.** Add a documented
   assumption in `docs/DECISIONS.md` and expose a manual override in the UI.
8. **No scope expansion, no drive-by refactors.** Do the phase you were given.
9. **Do not reopen accepted decisions.** `docs/DECISIONS.md` is settled unless the
   falsifying evidence an ADR names actually appears. If you disagree, report it — do
   not relitigate it in code.
10. **Rake and fees are policy, not site knowledge.** `poker-core` accepts a
    `RakeConfig`/`FeeConfig`; it never contains CoinPoker-specific assumptions. Observed
    hand-history behaviour is an observation until a fixture confirms it (ADR-0018).

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

## Verification cadence

The goal is to remove *duplicate* verification, not verification. Correctness and security
gates are never lowered — only the frequency of the expensive ones changes.

**Fast gate — after every small task.** Run the smallest check that proves what you just
wrote is not obviously broken: the changed module's unit tests, the changed contract's
test, a targeted component test, `tsc` if types moved. Do not run the full E2E suite, a
full regression sweep, or tests unrelated to your change.

**Milestone gate — when a real user-facing capability is complete** (a phase, or DB + API
+ UI joined into something a person can actually use): `pnpm typecheck`, `pnpm lint`,
`pnpm build`, targeted integration and targeted E2E.

**Final gate — once implementation is complete and the source is frozen:** `pnpm verify`
plus full regression, cross-surface E2E, and fresh security and product review. Run the
full suite once, not repeatedly. If it finds a problem: fix it, run that problem's targeted
test, then the affected milestone tests, then only the final regression the change actually
invalidates.

**Verify immediately, whatever the cadence**, when a change touches: DB migrations or
schema, auth or authorization, a security boundary, money/cost/budget, PII, retention or
deletion, concurrency or races, shared runtime, a wire/protocol format, a destructive
mutation, an external side effect, a shared API contract, or production startup
configuration. Even then prefer the targeted integration test that exercises that specific
risk over a whole-product E2E run.

**Never accumulate known breakage.** If a fast gate fails: stop, fix it, get the targeted
check passing, then continue. "The final E2E will catch it" is not a plan.

**Do not re-run an expensive suite that already passed on unchanged source.** Re-run when
the code changed, a dependency changed, a reviewer finding was fixed, or the source is
frozen for final verification. Reuse a running dev server rather than restarting it.

Whatever the gate: you must have added real tests for every money/state transition you
touched, and long test logs belong in a report file, not in your handoff.

## Working agreement for phase agents

- Inspect existing code before editing. Do not guess an API contract — open the file.
- Stay inside your phase's file boundary. If you need a change outside it, say so in
  your report instead of making it.
- Prefer pure functions for poker math. Keep UI state and domain truth separate.
- Update `docs/STATE.md` is the **orchestrator's** job, not yours — report instead.
