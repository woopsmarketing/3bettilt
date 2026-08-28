# State

Single source of truth for where the project is. The orchestrator updates this after
every phase; phase agents report, they do not edit it.

**Last updated:** 2026-08-28, after Phase 1.

## Completed

- **Phase 0 — Repository bootstrap.**
  - pnpm workspace: `apps/web`, six `packages/*`, `solver-lab`.
  - TypeScript 5.9.3 strict (+ `noUncheckedIndexedAccess`), shared `tsconfig.base.json`
    with `@gto-self/*` path aliases.
  - Vitest 4 single-root config with one project per package plus a happy-dom `web`
    project. ESLint 10 flat config including the layering restrictions. Prettier.
  - Next.js 16 + React 19 + Tailwind 4 app shell, Playwright config and a smoke spec.
  - `@gto-self/shared` implemented and tested: `MilliBB` fixed-point money with
    explicit rounding, `Card` primitives, branded ids with injectable `IdFactory`,
    `Result`.
  - Docs: `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md` (ADR-0001..0010), `ROADMAP.md`,
    `UX.md`, `GTO_BASELINE.md`, this file.

- **Open-source integration spike** — `docs/OPEN_SOURCE_EVALUATION.md` (937 lines).
  Five projects cloned and evaluated at source level against 17 criteria, then put
  through an independent adversarial fact-check pass (licences read from the actual
  LICENSE file in each clone, never from a badge or from recollection).
  - Verdicts: `poker-engine-ts` REFERENCE, `rs-poker` REFERENCE, `poker_solver`
    REFERENCE, `open_spiel` ADOPT-candidate (`solver-lab` only), `pokerkit` REFERENCE
    (partial evaluation).
  - Orchestrator decisions recorded as **ADR-0011..0017**: continue our own
    `poker-core`; differential-oracle outputs are never committed as fixtures; open_spiel
    accepted as the gated Phase 13 validation tool; Phase 13 delivers a validated method
    and a cost curve, not a baseline; licence-hygiene posture with a named AGPL blocklist
    and a standing `pnpm lint:licences` check; seven Phase 9 schema inputs adopted; a
    rake-rounding normalisation policy for `pokerkit` comparisons.

- **Phase 1 — Poker core domain.** `packages/poker-core`, 21 modules, **420 tests
  passing workspace-wide** (386 in poker-core). Spec: `docs/POKER_CORE_API.md` (2,215
  lines), written by a judge agent that synthesized three independent design proposals.
  - Implemented: fixed-point money wiring, seats (ACTIVE/SITTING_OUT/EMPTY), button/SB/BB,
    positions for 2-6 dealt in, ante and blind posting, pot (side-pot-ready layered
    model), call amount, min legal raise under raise-TO semantics, all-in, effective stack,
    SPR, legal actor ordering, fold/check/call/bet/raise/all-in, uncalled-bet return,
    automatic street transitions, rake, single-pot settlement, and an immutable
    reducer with replay and undo.
  - Two replay modes: `replayHand` (strict, re-validates every action — the Phase 11
    round-trip guarantee) and `loadHand` (structural, asserts arithmetic and conservation
    — the DB path). `POT_AWARDED` stores the rake *actually applied* (ADR-0009), so a
    corrected rake rule can never make stored hands unloadable.
  - Review found 8 actionable defects across 3 lenses; an independent test author added
    110 spec-derived tests and surfaced 1 crash the implementer's own 250 tests missed.
    All fixed or explicitly rejected with reasons. New ADRs: 0024, 0025, 0026.

## Current

- Nothing in flight.

## Next

- **Phase 2 — Poker core edge cases** (`packages/poker-core`), fresh agent. Handoff from
  Phase 1, nothing stubbed and no representation change needed:
  - multi-way side-pot *award* breadth, and both `rake.allocation` branches under a real
    multi-pot hand (`allocateRake` is unit-tested both ways; only `PROPORTIONAL` is
    exercised end to end)
  - odd chips under simultaneous multi-pot splits (`splitPot`/`oddChipOrder` are tested on
    a single pot only)
  - missed blinds, dead button, `POST_DEAD_BLIND`, manual SB/BB override
  - auto top-up boundary behaviour
  - Hand evaluation stays out of scope: the winner is an `AWARD_POTS` input, which is
    where an evaluator plugs in later.
- **ADR-0018 follow-up** (bounded, queued): generalize `RakeConfig.noFlopNoDrop` into a
  named `triggerPolicy`, and add `FeeConfig` so splash fee is modelled and reported
  separately from rake.

## Known issues / explicit TODOs

- `packages/{gto-core,player-core,db,coinpoker-parser}/src/index.ts` are Phase 0
  placeholders with a wiring test each. Each implementing phase must delete its
  `placeholder.test.ts`. (`poker-core`'s was deleted in Phase 1.)
- `MAIN_POT_FIRST` rake allocation can pay a winner a net of zero. Documented policy, not
  a bug (ADR-0025); `PROPORTIONAL` is the shipped default.
- `docs/POKER_CORE_API.md` carries **18 explicit assumptions**, each naming the
  `TableConfig` field that corrects it. They are engine behaviour chosen where a real-world
  rule was not known — not claims about how CoinPoker behaves.
- `fixtures/coinpoker/` has no real hand history yet. Phase 11 cannot start until the
  user drops a file in (see `fixtures/coinpoker/README.md`). Nothing may be
  fabricated in its place.
- CoinPoker rake rounding and splash-fee interaction are **assumptions** (ADR-0009),
  to be verified against a real fixture in Phase 11.
- No GTO data of any kind exists. The only permitted provider until Phase 14 is a
  mock that labels itself.
- `open_spiel` and `pokerkit` received only a *partial* evaluation in the spike — no
  independent fact-check pass. ADR-0013 makes the full pass a precondition of actually
  taking the open_spiel dependency at Phase 13.
- Whether an external engine's numeric output could legally be committed as a fixture
  was left unresolved by the spike. ADR-0012 sidesteps it rather than settling it: we
  commit only hand-derived expected values, noting where an oracle agreed.

## Test status

| Suite            | Result                                                          |
| ---------------- | --------------------------------------------------------------- |
| `pnpm typecheck` | pass (8 projects)                                               |
| `pnpm test`      | pass — 8 files, 35 tests                                        |
| `pnpm build`     | pass (Next 16, 3 static routes)                                 |
| `pnpm lint`      | pass                                                            |
| `pnpm e2e`       | not run — needs `pnpm --filter @gto-self/web e2e:install` first |
