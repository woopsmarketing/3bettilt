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
