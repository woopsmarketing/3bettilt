# WP-F2B — Equity Calculator (`/tools/equity`)

**Date:** 2026-09-05 · **Scope:** WP-F2B only. Consumed WP-F2A's `ExactEquity` (bps fields,
`method`, `runouts`) read-only; matched WP-F2C's structure (`CardPicker` reuse, cross-picker
duplicate prevention, server shell + client island, pure view-model module) per the brief.

## 1. Scope

Built `/tools/equity`: hero picks 2 cards, an opponent picks 2 cards, the board is optional
(0, 3, 4 or 5 cards), and the tool reports the exact heads-up equity split three ways — hero
win / tie / opponent win — using `@gto-self/learn-core`'s `exactHeadsUpEquity` behind a
required async seam. No new evaluator or equity engine code; every percentage comes from
`ExactEquity`'s integer bps fields, re-apportioned at display resolution.

## 2. Files changed

| File | Status |
| --- | --- |
| `apps/fishtilt/src/features/tools/equity.ts` | new — selection state machine, async seam, bps→percent view model, method-driven copy |
| `apps/fishtilt/src/features/tools/equity.test.ts` | new — 18 tests |
| `apps/fishtilt/src/components/EquityCalculator.tsx` | new — client island |
| `apps/fishtilt/src/components/EquityCalculator.test.tsx` | new — 10 tests (incl. the stale-result race) |
| `apps/fishtilt/src/app/tools/equity/page.tsx` | new — server shell |
| `apps/fishtilt/src/app/tools/equity/page.test.tsx` | new — 10 tests |
| `apps/fishtilt/tests/e2e/equity.spec.ts` | new — 9 tests, written, **not run** (per instructions) |
| `apps/fishtilt/src/lib/routes.ts` | edited — `toolEquity.available: false → true`, one line, done last |
| `docs/reports/WP_F2B_EQUITY_CALCULATOR.md` | this report |

No other file was written to. `packages/learn-core` and `packages/strategy-core` were
read-only. `src/content/**` was read (`contentById('equity')`) but not written.

## 3. Decisions

**The async seam is a plain `async function`, not a `Result`-returning one.** The brief asks
for "a single module-level function returning a `Promise<ExactEquity>`" — literally that
type, not `Promise<Result<ExactEquity, ExactEquityError>>`. `computeExactEquityAsync` calls
`exactHeadsUpEquity` and throws if it ever returns `Err`. This is safe because
`equitySelectionStatus` (also in `equity.ts`) already guarantees exactly 2 hero cards, 2
opponent cards and a legal board length before `READY` is ever reported, and the three
cross-referenced `CardPicker`s make a duplicate card impossible to select in the first place
— every `ExactEquityError` variant is unreachable from a real selection. Checked with a
plain `if (!outcome.ok) throw`, not silently trusted; a unit test calls the seam directly
with a deliberately duplicate card (bypassing the UI) to prove the guard actually fires.

**The stale-result race is handled with React's own cleanup-flag pattern, not a manual
request-id counter.** Each `useEffect` run closes over its own `cancelled` boolean; React
guarantees the *previous* effect's cleanup (`cancelled = true`) runs before the *next*
effect body executes, so a slower, older `computeExactEquityAsync` call that resolves after
a newer one has already started is dropped (`if (cancelled) return;`) regardless of the
actual resolution order. `EquityCalculator.test.tsx`'s race test proves this with two
manually-controlled (`deferred()`) promises: it builds hero/villain = AA/QQ (fires the
"slow" call), changes villain to JJ before that call resolves (fires the "fast" call), then
resolves the **fast** one first and the **slow** one **second** — the slow QQ answer
(fabricated as 50.0%) must never appear once the fast JJ answer (fabricated as 100.0%) has
rendered, and the test asserts exactly that. A same-shape default-selection call also fires
on mount (the AA-vs-KK worked example), so the mock dispatches by the *content* of the
villain hand requested, not by call order, to avoid confusing that mount call with the two
the test is about.

**Percentages are re-apportioned at display resolution, not truncated from bps
independently.** `ExactEquity.heroWinBps`/`tieBps`/`villainWinBps` are integers that sum to
exactly 10000 (WP-F2A). Rounding each to one display decimal *independently* can still fail
to sum to 100.0% — three bps counts of 3334/3333/3333 each round-to-nearest-tenth to
"33.3%", summing to 99.9%. `equityPercentages` instead calls `@gto-self/strategy-core`'s
`apportion` **again**, at the display's own resolution (a total of 1000 tenths-of-a-percent,
not 10000 bps), using the same largest-remainder method WP-F2A already used to build the bps
fields — reused, not reimplemented. The result is formatted with pure integer arithmetic
(`Math.trunc`/`%`, never a float division), so there is nothing left to round at output time.
A unit test constructs exactly the 3334/3333/3333 adversarial case and asserts the three
printed percentages still sum to 100.0%.

**The exact/estimated copy switch is an exhaustive `Record<ExactEquity['method'], ...>`, not
an `if` branch.** Three such Records (label, beginner sentence, count sentence) are keyed by
the literal `method` field. Today the union has one member (`'EXACT'`), so each Record has
exactly one entry — but the day a sampled path is added upstream and `method` widens, these
Records fail to typecheck until a `'추정'`-shaped entry is written for the new member. The
distinction the brief asks for ("write the copy layer so that distinction is data-driven off
`method`") is enforced by the type system, the same discipline `features/tools/copy.ts`
already uses for every closed-union error message in this codebase.

**An in-between board (1 or 2 cards) is blocked with a sentence, not made impossible via a
stepper UI.** `exactHeadsUpEquity` itself only accepts board lengths `{0, 3, 4, 5}`.
`equitySelectionStatus` treats 1- and 2-card boards as a `PENDING` case with `boardInvalid:
true`, and the copy layer explains exactly what a legal board looks like and how many cards
are currently selected. This mirrors `CardPicker`'s existing generic multi-select behaviour
(reused unmodified) rather than adding a bespoke "flop-only-in-one-click" control, at the
cost of a two-card transient invalid state that is always clearly explained, never silently
rounded.

**All three outstanding issues are reported at once, not prioritized.** A `PENDING` result
carries `heroNeeded`, `villainNeeded` and `boardInvalid` together; `equityPendingMessages`
emits one sentence per true condition, in hero → opponent → board order (the order a reader
fills the page in). This avoids an arbitrary "which incomplete thing do I mention first"
decision when, e.g., a beginner has picked a lone board card before finishing either hand.

## 4. Behavior

- **Card selection**: three `CardPicker`s (hero max 2, opponent max 2, board max 5), each
  passing the other two's current selections as `usedCards` — a card chosen anywhere is
  disabled everywhere else, so a duplicate is impossible at the UI level (same pattern as
  `HandChecker.tsx`, extended from two pickers to three).
- **< 2 hero or < 2 opponent cards** → `내 핸드 카드를 N장 더 선택해주세요.` /
  `상대 핸드 카드를 N장 더 선택해주세요.`
- **Board stuck at 1 or 2 cards** → `보드는 0장(프리플롭), 3장(플롭), 4장(턴), 5장(리버) 중
  하나여야 합니다. 지금 보드에 N장이 선택되어 있어서 계산할 수 없습니다. 카드를 더
  선택하거나 보드 카드를 지워주세요.`
- **Ready (2 + 2 + legal board)** → real pending state (`계산 중입니다`) is shown
  synchronously on first paint, then the async result replaces it (near-instant on every
  street measured; preflop ~200ms per WP-F2A).
- **Result**: `내 핸드 승률` (hero's cards + percent), `비김` (percent), `상대` (opponent's
  cards + percent) — all three from `equityPercentages`, always summing to exactly 100.0%.
  Below that: `정확 계산` label, `같은 상황을 가능한 카드 조합으로 모두 계산한 결과입니다.`,
  and the enumeration count (e.g. `1,712,304가지 카드 조합을 모두 계산했습니다.`).
- **Controls**: `카드 초기화` (clears all three pickers to empty — matches WP-F2C's "reset
  clears to empty, not back to the worked example"), `핸드 바꾸기` (swaps hero ↔ opponent,
  works in any selection state).
- **Cross-links**: `ToolCTA` to `toolPotOdds` (registry `available: true`, checked by
  `ToolCTA` itself at render time — never assumed); an inert, `준비 중`-badged link to the
  `equity` lesson content record (`status: 'PLANNED'`), same pattern as WP-F2C's
  hand-rankings link — becomes a live link automatically once that lesson ships, no edit
  needed here.
- **Accessibility**: every card is a real `<button>` (via `CardPicker`, unmodified); result
  region is `aria-live="polite"`; used/unused and selected/disabled states are always paired
  with text, never colour alone (inherited from `CardPicker`/`PokerCard`).

## 5. Fixtures and their sources

| # | Fixture | Source |
| --- | --- | --- |
| 1 | AA vs KK preflop | Called `exactHeadsUpEquity` live in `equity.test.ts`; asserted `runouts === 1712304` (`C(48,5)`, a combinatorial fact) and `heroWinBps > villainWinBps` — no magnitude read from memory |
| 2 | Decided river: `AsKd` vs `7h2c`, board `AdKh9s3c4d` | The exact spot from WP-F2A's own independent cross-check table (`docs/reports/WP_F2A_EQUITY_CORE.md` §6, row 6) — hero's two pair already beats 7-high; asserted `wins/ties/losses = 1/0/0` and percentages `100.0%/0.0%/0.0%` |
| 3 | Flop/turn/river/preflop sweep (4 spots) | All called live through `exactHeadsUpEquity`; asserted the display percentages always sum to exactly 1000 tenths, regardless of street |
| 4 | Adversarial bps triple 3334/3333/3333 | Constructed directly (not a poker fixture — three integers proving the re-apportionment claim); independent rounding-to-nearest-tenth would sum to 99.9%, `equityPercentages` still sums to 100.0% |

## 6. Tests run — real counts

| Gate | Command | Result |
| --- | --- | --- |
| Unit — `equity.ts` | `pnpm vitest run --project fishtilt src/features/tools/equity.test.ts` | **18 passed** |
| Component — `EquityCalculator.tsx` | `pnpm vitest run --project fishtilt src/components/EquityCalculator.test.tsx` | **10 passed** |
| Server shell — `page.tsx` | `pnpm vitest run --project fishtilt src/app/tools/equity/page.test.tsx` | **10 passed** |
| Full fishtilt suite | `pnpm vitest run --project fishtilt` | **54 files / 506 tests — 502 passed, 4 failed** (see below) |
| Typecheck | `pnpm --filter @gto-self/fishtilt typecheck` | clean, 0 errors |
| Lint | `npx eslint apps/fishtilt --max-warnings=0` | clean, exit 0 |

This WP's own three new test files total **38 tests, all passing** (18 + 10 + 10). The
suite-wide "before" figure quoted in the brief (465) predates several other agents' work
landing concurrently in this shared repo; 506 is not a clean "465 + mine" delta, but it is
the true current total and is above 465 as required.

**The 4 failures are not from this WP** — confirmed by `git status` showing zero changes by
me to any of the implicated files (`src/content/**`, `src/components/Term.test.tsx`):

- `src/lib/routes.test.ts` — `/glossary available=false` and `/blog available=false`
  mismatches: another agent's routes mid-flight (their `page.tsx`s exist on disk, their
  `routes.ts` flip has not landed yet — the exact situation this WP's own instructions
  warned about for `/tools/equity` before its own flip, now visible for their routes
  instead). Re-run later, do not fix.
- `src/content/content.test.ts`, `src/content/graph.test.ts`, `src/components/Term.test.tsx`
  — all fail on `glossaryById('term-range').status` being `'PUBLISHED'` where a test
  expected `'PLANNED'`: the concurrent content-restructuring agent's in-progress glossary
  work, entirely outside `features/tools/equity*`, `components/EquityCalculator*`,
  `app/tools/equity/**`.

Re-running the full suite twice in a row produced the identical 502/506 split with the
identical four names, confirming these are steady pre-existing/concurrent failures, not
flakes introduced by this work.

`tests/e2e/equity.spec.ts` was written (9 tests: worked example + percentages sum to 100%,
duplicate prevention, in-between-board blocked then unblocked at 3 cards, reset, swap, hub
reachability, pot-odds hand-off, no "GTO", no horizontal overflow at 390/1440px) but **not
run**, per instructions — the orchestrator owns `pnpm e2e:fishtilt`.

## 7. Known limitations

1. **No barrel export.** `features/tools/index.ts` is outside this WP's file boundary (only
   `routes.ts` gets a targeted edit), so `EquityCalculator.tsx` and the page import
   `equity.js` directly by path, same as WP-F2C's `handRank.js`. A future WP touching
   `features/tools/index.ts` should add `export * from './equity.js';`.
2. **The pending-computation indicator during a *re*-calculation is a single inline line**
   (`정확 계산 · 다시 계산 중…`) next to the previous result, rather than a dedicated spinner
   component — kept minimal since every measured street resolves in well under 250ms and no
   such component exists elsewhere in this app to reuse.
3. **The lesson cross-link depends on `src/content/registry/learn.ts`'s `equity` record**,
   which is owned by the concurrent content-restructuring work. If that agent renames or
   removes the `equity` id, `contentById('equity')` throws (by design — CLAUDE.md rule 5,
   same behaviour WP-F2C accepted for `hand-rankings`). Not observed during this WP's own
   test runs.

## 8. Anything needed outside my boundary

- None required for this WP to be complete and working. Item 1 above (`features/tools/index.ts`
  barrel export) is a nice-to-have consistency fix for whichever future WP next touches that
  file — not a blocker, and outside my stated boundary, so reported rather than done.
