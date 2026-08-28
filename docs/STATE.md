# State

Single source of truth for where the project is. The orchestrator updates this after
every phase; phase agents report, they do not edit it.

**Last updated:** 2026-08-28, after Phase 0.

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

## Current

- Nothing in flight.

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

## Test status

| Suite            | Result                                                          |
| ---------------- | --------------------------------------------------------------- |
| `pnpm typecheck` | pass (8 projects)                                               |
| `pnpm test`      | pass — 8 files, 35 tests                                        |
| `pnpm build`     | pass (Next 16, 3 static routes)                                 |
| `pnpm lint`      | pass                                                            |
| `pnpm e2e`       | not run — needs `pnpm --filter @gto-self/web e2e:install` first |
