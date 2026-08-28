# State

Single source of truth for where the project is. The orchestrator updates this after
every phase; phase agents report, they do not edit it.

**Last updated:** 2026-08-28, after Phase 0 and the open-source integration spike.

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

## Current

- **Phase 1 — Poker core domain** (`packages/poker-core/**`, `docs/POKER_CORE_API.md`).
  Delegated pipeline: 3 independent design proposals -> judged/synthesized API spec
  (2,215 lines) -> single implementer -> independent adversarial test author (writes
  `tests/`, derives expected values from poker rules rather than from the
  implementation) -> 3 review lenses (poker rules, money integrity, purity/contract) ->
  fix pass. Implementation stage in progress.

## Next

- **Phase 1 — Poker core domain** (`packages/poker-core`), fresh agent.

## Known issues / explicit TODOs

- `packages/{poker-core,gto-core,player-core,db,coinpoker-parser}/src/index.ts` are
  Phase 0 placeholders with a wiring test each. Each implementing phase must delete
  its `placeholder.test.ts`.
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
