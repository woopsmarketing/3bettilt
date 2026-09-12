# FISHTILT WP-0 — scaffold and workspace registration

Follows `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md`. Nothing in this WP authors product
copy or strategy data; its whole job is to make the next WPs possible and to prove the
wiring works end to end before anyone builds on it.

## What shipped

**New package `@gto-self/learn-core`** (`packages/learn-core/`)

Created with a real first module rather than a placeholder, because an empty package that
"will be filled in later" is the stub CLAUDE.md rule 5 forbids, and `gto-core` is already
carrying that debt in `docs/STATE.md`.

- `src/potOdds.ts` — pot odds for one call. Returns every intermediate value a learner
  would work out by hand (called bet, uncalled remainder, final pot, required equity, the
  "1 in N" form, and the classic odds-against form) rather than one opaque percentage.
  - Money is integer milliBB through `Money.*` throughout (ADR-0001). The three output
    ratios are plain numbers because they are proportions, not money.
  - **The uncalled remainder is modelled, not approximated.** The published formula
    `call / (pot + bet + call)` silently assumes hero can cover the bet. When a short stack
    calls all-in for less, the unmatched part of the bet returns to the bettor and never
    joins the contested pot, so the pot is built from `min(bet, call)`. This is a settled
    rule of the game, not an assumption this project invented (CLAUDE.md rule 7). When
    `call === bet` the two agree exactly, and a test pins that.
  - A zero call is a typed error, not "0% needed" — facing no bet there is no call to
    price, and answering `0` would state something false.
- `src/index.ts` — barrel documenting the package's charter and its layering contract.

**New app `@gto-self/fishtilt`** (`apps/fishtilt/`)

Next 16 App Router, React 19, Tailwind v4, dev port **3220**, e2e port **3221**.

- `src/app/globals.css` — the FishTilt token set: charcoal grounds, brand red, and a
  **separate** strategy-action scale so a cell that is red because "raise" can never be
  confused with a cell that is red because "selected" (build spec §4). WCAG AA measurement
  of these values is WP-A's, and the file says so.
- `src/app/layout.tsx` — `lang="ko"` (ADR-0053), Korean metadata.
- `src/app/page.tsx` — a scaffold homepage that WP-J replaces. Every number on it is
  computed at render time from `strategy-core` and `learn-core`; nothing is hard-coded.
- `next.config.ts` — `transpilePackages` lists `poker-core` even though FishTilt may not
  import it, because `strategy-core`'s source does and an untranspiled transitive package
  fails the build rather than the lint.

**Registration** (additive edits, orchestrator only, per the audit's §1.4 rule)

- `tsconfig.base.json` — `@gto-self/learn-core` path mappings.
- `vitest.config.ts` — `learn-core` in `WORKSPACE_PACKAGES` + `nodeProject`, and a
  `fishtilt` happy-dom project (ADR-0004).
- `eslint.config.js` — two new blocks, each spelling out its full pattern list (ADR-0042).
- `package.json` — `dev:fishtilt`, `build:fishtilt`, `e2e:fishtilt`. `verify` left alone.
- `pnpm-workspace.yaml` — **no edit needed**; it already globs `apps/*` and `packages/*`.

## Layering, and proof that it holds

FishTilt may import `shared`, `strategy-core` (read-only) and `learn-core`. It may not
import `@gto-self/db`, `poker-core`, `gto-core`, `player-core`, `analysis-core`,
`adaptive-core`, `coinpoker-parser` or `solver-lab`. `learn-core` additionally may not
import React or Next.

Unlike `apps/web`, the DB ban here has **no server-side exception**: FishTilt has no
database at all, so there is no directory from which importing one would be correct.

Two independent guards, deliberately:

1. **ESLint** — confirmed to fire. A throwaway probe importing `@gto-self/db` and
   `@gto-self/poker-core` from the app, and `@gto-self/poker-core` and `react` from
   `learn-core`, produced 4 errors with the intended messages. Probe deleted.
2. **Static tripwires in `pnpm test`** — `packages/learn-core/tests/layering.test.ts` and
   `apps/fishtilt/tests/layering.test.ts` read the sources as TEXT and assert both a
   forbidden-specifier list and an allow-list. Text, not imports, because a type-only
   import is exactly how a forbidden dependency arrives first — the same reasoning as
   `packages/strategy-core/tests/layering.test.ts`.

## Verification

Baseline recorded **before** any FishTilt file existed: `pnpm typecheck` and `pnpm lint`
both exit 0 on the in-flight working tree, so nothing below is inherited breakage.

| Gate | Result |
| --- | --- |
| `pnpm typecheck` (all 11 packages + both apps) | pass |
| `pnpm lint` | pass |
| `pnpm lint:licences` | pass — 392 tracked files scanned |
| `pnpm test` (full suite) | **2640 passed, 3 skipped, 151 files** |
| `pnpm build:fishtilt` | pass — `/` prerendered **static** |
| `pnpm e2e:fishtilt` | 4 passed |

The full suite was run rather than a targeted subset because this WP edits three shared
root configs (`vitest.config.ts`, `eslint.config.js`, `tsconfig.base.json`) whose aliases
every other project depends on. That is the shared-contract trigger in ADR-0022.

`/` prerendering as static content is the load-bearing result: it proves the public site
carries no database dependency, which is the property the whole placement decision rests on.

## Defects found and fixed inside this WP

1. `apps/fishtilt/tests/layering.test.ts` failed under the project's happy-dom default —
   `import.meta.url` is an `http:` URL there and `fileURLToPath` rejects it. Fixed with a
   per-file `@vitest-environment node` docblock; the file touches no DOM.
2. The Playwright `webServer` command passed `--port` twice (`pnpm start --port 3221`
   layered on a `start` script that already pins 3220). It worked only because the last
   flag wins. Changed to `pnpm exec next start --port 3221`, so one port is stated once.

## Observations recorded, deliberately not acted on

`apps/web/package.json` (modified, uncommitted) depends on `@gto-self/strategy-core` and
`@gto-self/adaptive-core`, but `apps/web/next.config.ts` `transpilePackages` lists neither.
That belongs to the in-flight session, not to FishTilt. It is written down here only
because it is why `apps/fishtilt/next.config.ts` states its transitive packages explicitly.

## What WP-0 did NOT do

- No product copy, no lessons, no glossary, no range UI. The scaffold page is a wiring
  proof and WP-J replaces it.
- `docs/STATE.md` was not edited. It is currently modified by another session, and the
  build spec §80 explicitly permits an equivalent state document instead:
  `docs/FISHTILT_STATE.md`.
- `pnpm verify` was not changed to include the FishTilt build. That script is on the
  in-flight session's critical path; folding FishTilt into it is proposed at WP-N.

## Next

WP-A (design system, app shell, `PokerCard`, `CardPicker`) and WP-B (`learn-core`: outs,
exact heads-up equity, hand-class facts) can proceed in parallel. WP-G (content pipeline)
is independent of both and can start alongside them.
