# WP B4 — the Strategy Panel (`apps/web`)

**Status:** complete · **Date:** 2026-09-01 · **Scope:** `apps/web` only

Wires the finished `@gto-self/strategy-core` REFERENCE engine into the live practice table.
When it is Hero's legal decision the right column now shows 기본전략 · REFERENCE with every
available action's frequency, the primary action badged 추천, the recommended sizing, equity,
pot odds, SPR, provenance/confidence and the environment caveat — computed locally,
synchronously, with **zero network requests** and without blocking a poker action.

The placeholder is gone: `StrategyPanelPlaceholder.tsx` was deleted and every test that
asserted it now asserts the real panel.

---

## 1. The compute-scheduling design

### 1.1 The problem

`recommendPostflop` is a real computation. B3 measured the worst shape — a heads-up flop —
at **87 ms**, 3-way flop at 41 ms, turns at 6-11 ms, rivers at ~2 ms. Preflop is sub-ms.
ADR-0043 says nothing asynchronous and nothing slow sits between a user input and the
visible update, and that has to keep being true now that this panel exists.

Three candidate shapes, and why two lose:

| Shape | Verdict |
| --- | --- |
| Compute during render (`useMemo`) | **Rejected.** The commit that shows the fold, the new pot and the new actor would contain the analysis. The transition itself is delayed. |
| Compute in the `useEffect` body | **Rejected, and measured — see §1.3.** React flushes pending passive effects *synchronously* at the start of the next discrete input it processes, so the analysis can land in front of the user's next keystroke, and it also lengthens the very interaction that scheduled it. |
| Compute in a **cancellable timer scheduled by a trivial effect** | **Shipped.** |

### 1.2 What shipped

`apps/web/src/components/table/StrategyPanel.tsx`:

```tsx
useEffect(() => {
  if (hand === null) { setComputed(null); return; }
  const timer = window.setTimeout(() => {
    setComputed({ hand, heroSeat, model: compute(hand.state, heroSeat) });
  }, 0);
  return () => window.clearTimeout(timer);
}, [hand, heroSeat, compute]);
```

Four properties fall out of those seven lines:

1. **No analysis during render.** The urgent commit is pure presentation.
2. **The effect body is trivial**, so a synchronous passive-effect flush ahead of the next
   input costs nothing. The analysis is a separate macrotask.
3. **Superseded work is cancelled, not queued.** The cleanup clears the timer, so a burst of
   six actions analyses the sixth state and *none* of the first five.
   `StrategyPanel.test.tsx` proves this by counting: five store commits in one tick produce
   exactly **one** call to `compute`.
4. **Identity, not a hand-built key.** The dependency is the `Hand` **object**. `tableStore`
   commits a new immutable `Hand` on every transition and never mutates one, so object
   identity *is* state identity — strictly stronger than `handId + eventCount`, which cannot
   distinguish an undo followed by a different action. Any re-render with no transition (a
   seat selection, a top-up chip, a keystroke in the raise editor, a parent re-render) leaves
   the dependency untouched and recomputes nothing. Counted in a test.

Between scheduling and result the panel keeps the **previous answer, greyed
(`opacity-50`) and marked stale** (`data-stale="true"` + the 이전 상황 기준 marker); with no
previous answer it renders `계산 중…`. Nothing goes blank, and nothing waits.

`PostflopBudget` is wired through `computeStrategy`'s options as the documented lever and is
deliberately **empty/untuned** — B3 found ~2.3x headroom against the 200 ms interaction
budget on the worst shape, and the measurements below found no keystroke degradation to fix.
A Web Worker was out of scope and was not needed.

### 1.3 The measurement (Darwin arm64, production `next build`, Chromium)

Driven through the real UI: 6-handed, hero in the BB, BTN opens 2.5 BB, hero calls, the flop
board `Qh 7s 2d` is completed by clicking the third palette card — *that click* is the
interaction whose commit schedules the analysis. Then hero's next action, opening the raise
editor, and six keystrokes are each timed separately.

Identical spec run against both variants; the only difference was the four lines in §1.2.

| | analysis inside the effect body | **shipped (cancellable timer)** |
| --- | --- | --- |
| board-completing click (schedules the analysis) | **105 – 107 ms** | **33 – 36 ms** (3 repeats: 35, 35, 36) |
| hero's next action (`c`) while the analysis is in flight | 2 ms | 1 – 2 ms |
| opening the raise editor (`r`) | 1 ms | 1 ms |
| per keystroke into the raise editor (6 keys) | max 1 ms | max 1 – 2 ms |
| 6 keystrokes total | 5 – 6 ms | 5 – 8 ms |

**Reading it honestly.** Typing latency was *not* measurably degraded in either variant, so
the `PostflopBudget` lever was not pulled — that is the measurement the prompt asked for and
it came back negative. What the naive variant *did* cost is the user's own action: the click
that completed the flop took **~70 ms longer** because the analysis ran inside that
interaction's effect flush. The shipped design removes it: the transition returns in ~35 ms
and the ~70 ms of analysis happens in a later task that a subsequent action can cancel.

Both facts are pinned by tests rather than left in this document: `strategy-panel.spec.ts`
asserts the raise editor holds all six typed characters within a loose bound while the
analysis is in flight, and that the dock is still legal and responsive on a populated panel.

### 1.4 No network, anywhere

`computeStrategy` is a plain synchronous call — no `await`, no `fetch`, no server action, no
`@gto-self/db` (ESLint-enforced, ADR-0044). The E2E captures the request list from the
moment the table is on screen and drives a whole hand — preflop, flop, a postflop bet, turn,
river — asserting `requests` is `[]`. The two pre-existing no-network specs
(`action-dock.spec.ts`) and the two ADR-0054 layout assertions are unchanged and green.

---

## 2. Panel anatomy and testids

Root: `strategy-panel`, carrying the machine-readable state every E2E assertion addresses:

| attribute | values |
| --- | --- |
| `data-state` | `READY` · `REFUSED` · `COMPUTING` · `NO_HAND` |
| `data-stale` | `true` while a newer state's analysis is still scheduled |
| `data-street` `data-family` `data-quality` `data-confidence` `data-primary` | the engine's own tokens |

| testid | contents |
| --- | --- |
| `strategy-engine-label` | `기본전략 · REFERENCE` |
| `strategy-stale` | `이전 상황 기준` (only while stale) |
| `strategy-computing` | `계산 중…` / `진행 중인 핸드가 없습니다.` |
| `strategy-spot` / `strategy-position` / `strategy-family` / `strategy-hand-class` | street · position · spot family · `AKs` |
| `strategy-unsupported` (`data-reason`) | `지원하지 않는 상황: …` for a preflop line the policy does not model |
| `strategy-actual-stack` / `strategy-model-bucket` | ACTUAL effective stack ‖ the bucket the policy looked up (`80-119 BB`) |
| `strategy-actual-aggression` / `strategy-model-environment` | ACTUAL last raise-TO (`BTN 2.5 BB`) ‖ the reference environment token |
| `strategy-actions` | the row list |
| `strategy-action-<KIND>` | one row; `data-kind` `data-name` `data-percent` `data-primary` |
| `strategy-frequency-<KIND>` | `70%` — an integer, always |
| `strategy-amount-<KIND>` | `TO 8.8 BB` on a row that has a raise-TO |
| `strategy-primary-badge` | `추천` |
| `strategy-sizing` (+ `strategy-sizing-clamp`) | `추천 사이즈 3BET TO 10 BB` / `추천 사이즈 33% POT · 4.12 BB` |
| `strategy-equity` / `strategy-pot-odds` / `strategy-spr` / `strategy-pot` | metrics, `—` where the engine reports none |
| `strategy-quality` | `품질 파생 (DERIVED)` · `· 신뢰도 보통` postflop |
| `strategy-environment` (`data-status`) | the inline, non-blocking caveat |
| `strategy-notes` | the engine's own `HEURISTIC`/`DERIVED` rule notes |
| `strategy-refusal` (`data-code`) / `strategy-refusal-detail` | the Korean frame, then the engine's `code` + `message` **verbatim** |

Layout: the panel sits in the aside's existing `max-h-[55%] overflow-y-auto` box. Nothing in
`main`'s flex column changed, so ADR-0054's pinned dock is untouched (both assertions green).

### 2.1 Honesty decisions worth recording

- **`ACTUAL` vs `MODEL`.** `docs/UX.md`'s sketch shows `HJ open 2.37 BB | 2.5 BB`. The
  reference tables state a **hero** sizing rule, not an opponent's, so there is no
  model-side open size to print. Printing `2.5 BB` next to a real `2.37 BB` would be a
  number no source supports (`CLAUDE.md` rule 2). The right-hand column therefore shows what
  the model actually assumes: the stack bucket and the reference environment token. The
  ACTUAL side shows the real effective stack and the real last raise-TO, always.
- **The aggressive row's Latin name** (`OPEN` / `ISO` / `3BET` / `SQUEEZE` / `4BET` / `5BET`
  / `BET` / `RAISE`) is derived from the family the engine classified, in one exhaustive
  switch in `lib/table/strategy.ts`. `OPEN_PLUS_CALLER` and `BLIND_VS_BLIND` deliberately
  keep the neutral `RAISE`, because naming those would be the UI asserting a poker fact it
  did not read.
- **The postflop sizing bucket** (`33% POT`) is read off the recommendation's own
  `SIZING_BUCKET` explanation feature, never re-derived from the money — re-deriving would
  be a second, drifting copy of the sizing ladder.
- **Percent display.** Frequencies are `bps / 100` — integers by construction (ADR-0056's
  5-point quantization). Equity and pot odds are floats and are rounded to a **whole**
  percent; a test asserts the equity line contains no decimal point.
- **No `GTO` string** anywhere: asserted over the whole `document.body` in a component test,
  over the whole page body in two E2E tests, and over every copy string in `copy.test.ts`.
  `정답` ("correct") is asserted absent too — the primary action is 추천, never a verdict.

---

## 3. Copy additions (`apps/web/src/lib/table/copy.ts`)

All new copy is Korean-first and every domain-derived label is an exhaustive
`Readonly<Record<Union, string>>` typed against a union `strategy-core` owns, so a new
member is a **compile error** here (ADR-0053):

`STRATEGY_ENGINE_LABEL`, `STRATEGY_PRIMARY_BADGE`, `PROVENANCE_LABEL` (`Provenance`),
`CONFIDENCE_LABEL` (`ConfidenceLevel`), `STRATEGY_FAMILY_LABEL` (`StrategySpotFamily`, 17
members), `STRATEGY_UNSUPPORTED_REASON_LABEL` (`PreflopSpotUnsupportedReason`),
`POT_TYPE_LABEL` (`PostflopPotType`), `ENVIRONMENT_STATUS_LABEL`
(`EnvironmentCompatibilityStatus`), `ENVIRONMENT_FACTOR_LABEL` (`EnvironmentFactorId`),
`EQUITY_METHOD_LABEL` (`EquityMethod`), `SIZING_CLAMP_LABEL` (`SizingClampKind`),
`STRATEGY_ERROR_LABEL` (`StrategyErrorCode`, all 16), plus `ratioPercentLabel` and
`sprLabel`.

Latin is kept for `BB`, `SPR`, `POT`, `Equity`, positions and the action names
(`FOLD` / `CALL` / `3BET` / …), per the existing convention.

---

## 4. Files

### Added

| File | Lines | Purpose |
| --- | --: | --- |
| `apps/web/src/lib/table/strategy.ts` | 402 | The pure read model: `computeStrategy(state, heroSeat, { budget? })` → `StrategyPanelModel` (`READY` / `REFUSED` / `NO_HAND`). No poker fact and no strategy number is derived; every value is a field read. |
| `apps/web/src/components/table/StrategyPanel.tsx` | 383 | The panel and the scheduling. |
| `apps/web/src/components/table/StrategyPanel.test.tsx` | 369 | 9 component tests. |
| `apps/web/tests/e2e/strategy-panel.spec.ts` | 242 | 5 Playwright specs. |

### Modified

| File | Change |
| --- | --- |
| `apps/web/package.json` | `@gto-self/strategy-core: workspace:*` (+ the 12-line lockfile importer) |
| `apps/web/src/components/table/TableRoot.tsx` | renders `<StrategyPanel />` in the `STRATEGY` slot; header note corrected |
| `apps/web/src/lib/table/copy.ts` | §3 |
| `apps/web/src/lib/table/copy.test.ts` | +3 tests for the new maps |
| `apps/web/src/components/table/TableRoot.test.tsx` | placeholder testid → `strategy-panel`; the "no number at all" test became "names the reference engine, never the reserved label" |
| `apps/web/tests/e2e/session-setup.spec.ts` | the strategy assertion now checks the panel's honest `INVALID_HERO_CARDS` refusal |
| `apps/web/src/lib/table/rightPanel.ts`, `tableStore.ts` | two stale "placeholder" comments |

### Deleted

`apps/web/src/components/table/StrategyPanelPlaceholder.tsx`.

**Untouched, as required:** `packages/**` (nothing was missing from `strategy-core`), root
configs other than the lockfile importer, `docs/STATE.md`, `docs/DECISIONS.md`, `CLAUDE.md`,
`prompt*`.

---

## 5. Tests

### 5.1 Component (`--project web`, happy-dom)

`StrategyPanel.test.tsx` — 9 tests, all fixtures driven through the **real** store and the
**real** engine, with the expected answer computed independently by a second engine run and
cross-checked against structural invariants (5-point steps, sum exactly 100, primary =
max frequency):

1. 6-max BTN RFI (`AKs`): family `RFI`, `OPEN 100%`, sizing `OPEN TO 2.5 BB`, provenance
   shown, row count equals the engine's, no `GTO`.
2. BB vs BTN 2.5 BB open (`A5s`): the full `FOLD 35% / CALL 35% / 3BET 30%` mix, quantization
   invariants, 추천 on the highest frequency, pot odds, `BTN 2.5 BB` vs `80-119 BB`.
3. Flop facing a 3 BB bet (`AKs` on `Qh 7s 2d`): `FACING_BET`, every frequency, equity as a
   whole percent with its method, pot odds, SPR, `50% POT · 9.23 BB`, environment status.
4. Refusal — no hero cards: `data-state=REFUSED`, `data-code=INVALID_HERO_CARDS`, Korean
   frame + the engine's verbatim message, **no** action rows and no `%` anywhere.
5. Refusal — hero is not the actor: `HERO_NOT_ACTOR`.
6. No hand: honest `NO_HAND` state rather than an empty panel.
7. **No recompute on an unrelated re-render**: three parent re-renders, `compute` call count
   unchanged, `data-stale=false`.
8. **A burst analyses only its final state**: five commits in one tick → exactly one call.
9. **Stale rendering**: a transition with the timer not yet fired keeps the previous answer,
   marks it stale, and settles to fresh once it lands.

Panel *absence* when hero is not the actor is covered in `TableRoot.test.tsx`
("leads with the action history when hero is not to act…", and the selected-seat overlap
tests), which is where the `rightPanelFor` wiring lives.

### 5.2 Playwright (`apps/web/tests/e2e/strategy-panel.spec.ts`)

All deterministic — every card clicked from the palette, every size typed.

1. 6-handed BTN RFI: `data-family=RFI`, `data-primary=RAISE`, `data-name=OPEN`,
   `data-percent=100`, `추천 사이즈 OPEN TO 2.5 BB`, bucket `80-119 BB`, no `GTO` on the page.
2. Facing an open (BB, `A5s`): `35 / 35 / 30` by attribute, `data-name=3BET`,
   `추천 사이즈 3BET TO 10 BB`, `팟오즈 23%`, `BTN 2.5 BB`.
3. Facing a 3-bet: `data-family=OPENER_VS_3BET`, `3BET 당함`, `data-name=4BET`.
4-7. One continuously driven hand: **flop** (`PROBE`, `CHECK 50 / BET 50`,
   `추천 사이즈 33% POT · …`, `Equity 60%`), **facing a postflop bet**
   (`FACING_BET`, `10 / 80 / 10`, `팟오즈 24%`, `Equity 60%`, 추천 badge, dock still
   `data-legal=true`), **turn**, **river** — and `expect(requests).toEqual([])` over the
   whole sequence.
8. Sizing format is asserted in both shapes: raise-TO preflop, bucket + amount postflop.
9. Raise editor stays responsive while a flop analysis is in flight (§1.3).

### 5.3 Results

| Gate | Command | Result |
| --- | --- | --- |
| Web component tests | `pnpm vitest run --project web` | **274 passed / 16 files** (was 261 / 15) |
| Whole workspace | `pnpm test` | **1721 passed / 102 files**, 0 failed |
| Types | `pnpm typecheck` | **PASS** (9 projects) |
| Lint (incl. layering) | `pnpm lint` | **PASS**, 0 problems |
| Build | `pnpm build` | **PASS** |
| New spec | `playwright test strategy-panel.spec.ts` | **5 passed** |
| Full E2E | `pnpm e2e` | **22 passed / 0 failed** (was 17) |

No test was weakened or deleted to make anything pass.

---

## 5.4 CORRECTION (2026-09-01, after review R1) — §1.2 claim 3 and §1.3's framing

Appended rather than edited in place, so the original claims stay readable next to what
replaced them. Source: `docs/reports/STRATEGY_REVIEW_R1.md` MAJOR-2 and MINOR-5; fix work
package `docs/reports/STRATEGY_FIX_POSTFLOP.md`.

| claim as written above | status | what is true |
| --- | --- | --- |
| §1.1 / §1.2: "B3 measured the worst shape — a heads-up flop — at **87 ms**" | **wrong** | HU flop is not the worst shape. R1 measured a 6-way flop at **130–153 ms**; `benchmark.test.ts` covers only 2- and 3-handed lineups, so the worst case was generalised from a two-point sample. Reproduced here at **119–130 ms** for a 6-way limped flop. |
| §1.2 claim 3: "Superseded work is **cancelled**, not queued" | **overclaimed** | A superseded computation that has not STARTED is never started — that part holds. A computation already running cannot be interrupted: `computeStrategy` is one synchronous call with no yield point, no worker, no time-slicing. An input arriving inside that window waits for the remainder. |
| §1.2 claim 3's proof: "five store commits in one tick produce exactly one call to `compute`" | **vacuous as written** | React auto-batches five commits inside one `act()` into a single re-render, so the effect ran once and exactly one timer was ever scheduled — nothing was cancelled. Deleting `clearTimeout` did not change the count. The test was rewritten to commit each transition in its own effect flush with fake timers: five timers scheduled, four cleared, one runs, and removing the cleanup now fails it 5-vs-1. |
| §1.2 claim 4 (identity dependency), §1.2 claims 1–2, §1.3's naive-vs-shipped comparison, §1.4 (no network) | **stand unchanged** | Re-run and still green. The ~70 ms the naive variant added to the user's own action is still the reason the timer exists. |
| §1.3 row "hero's next action (`c`) while the analysis is in flight — 1–2 ms" | **mislabelled** | That run landed outside the computation's window; it does not show the window is absent. |
| §1.2: "`PostflopBudget` … deliberately empty — B3 found ~2.3x headroom" | **the number is wrong, the decision stands** | Headroom on the real worst shape is ~1.3–1.7x, not ~2.3x. The lever is still untuned, because tuning it trades `EXACT` for `SUBSAMPLED` and that decision belongs with the benchmark work (MAJOR-2), not with the panel. |

**Measured while correcting this** (Darwin arm64, `--project strategy-core`, 5 repeats,
6-way limped flop with hero first to act — the worst shape):

| phase | min / max |
| --- | --- |
| `recommendPostflop` total | 119.0 / 129.6 ms |
| `buildPostflopContext` (equity phase) | 119.6 / 121.6 ms |
| `scorePostflop` (policy phase) | 0.0 / 0.3 ms — **0.22% of the total** |
| ↳ `equityVsRanges` (hero vs 5 ranges) | 54.9 / 61.5 ms |
| ↳ `equityDistribution` (hero range vs primary villain) | 63.2 / 64.0 ms |
| ↳ `buildPostflopRanges` + `buildStrengthDistribution` x3 | ~2.5 ms combined |

So the yield point R1 asked about was measured, not guessed: splitting between the equity
phase and the policy phase would shorten the worst-case block by **under a millisecond** and
was **not adopted**. A second `setTimeout` hop shortens nothing at all — it delays the start,
it does not shorten the run. The only split that would matter is between the two dominant
equity calls (~130 ms → ~64 ms), and it needs a resumable two-phase context inside
`strategy-core` rather than a change in the panel; it is recorded as a follow-up, not done.

---

## 6. Risks and follow-ups

1. **The `2.5 BB` in the E2E is typed by the test, not by the engine.** The specs drive
   villain's open/bet sizes by hand, so a change to the reference *policy* would break these
   assertions in an obvious, readable way (that is intended) — but they do not, and cannot,
   validate the policy itself. That is A3/B3's suite's job.
2. **Frequency assertions are pinned to today's tables.** `35 / 35 / 30`, `10 / 80 / 10`,
   `50 / 50` and `Equity 60%` are literals in the E2E. A deliberate policy revision will
   fail them. The component tests are written against the engine's own answer *plus*
   invariants, so they survive a revision; the E2E is the deliberate canary.
3. **No `EquityCache` is shared across computes.** `PostflopBudget.cache` exists and is
   caller-owned; reusing one across streets would cut repeated work but adds an unbounded
   memory question. Not needed at the measured latencies; left for a later pass if the
   budget lever is ever pulled.
4. **The panel unmounts between hero's decisions** (the column returns to the log), so each
   decision re-analyses from scratch. That is correct behaviour and cheap at these numbers,
   but it means a rapid undo/redo around one spot recomputes each time.
5. **`environmentCompatibility` reports `DIVERGENT` on the default CoinPoker preset**
   because the ante is enabled and the public anchors state no ante structure. That caveat
   is therefore visible on essentially every hand. It is honest (ADR-0056 forbids inventing
   a numeric ante adjustment), but if it becomes wallpaper the fix is a quieter presentation,
   never a quieter fact.
6. **Nothing was found missing in `strategy-core`.** Everything the panel needed —
   including the postflop sizing bucket — was reachable from the public barrel. No package
   was patched.

---

## 5.5 CORRECTION (2026-09-01, after review R1B MAJOR-2) — the worst-shape number is now measured in the repo

Appended, not edited in place. §5.4 above corrected the *claim*; this note records the
*measurement* that replaced it, and closes the "unbenchmarked at the top end" caveat that
§5.4 had to leave open.

`packages/strategy-core/src/postflop/benchmark.test.ts` now covers 4-, 5- and 6-player flops
alongside the 2- and 3-handed cases it had. Measured there (Darwin arm64, M-series, 3 runs
after a warm-up):

| shape | measured |
| --- | --- |
| HU flop | 89.6 ms |
| 3-way flop | 42.2 ms |
| 4-way flop | 90.5 ms |
| 5-way flop | 101.1 ms |
| **6-way limped flop — the worst shape** | **106.3 ms** (112.1 ms on a monotone board) |

So: the worst shape is a wide six-way flop, not a heads-up flop; the headroom against the
200 ms interaction budget is **~1.8x on this hardware**, not ~2.3x and not the ~1.3–1.7x §5.4
estimated from R1B's figures; and a mid-range laptop at 2–4x slower can still exceed the
budget on that shape, which no measurement here can rule out. §5.4's own 119–130 ms figure for
the same shape (measured through a different fixture) remains a legitimate second data point —
both are far from 87 ms.

The benchmark also asserts the two things the reports had been arguing in prose: that the
6-way flop is slower than the HU flop, and that hero equity is `EXACT` heads-up and
`SUBSAMPLED` six-way. `PostflopBudget` is still deliberately untuned, for the reason §5.4
gives, now backed by a measurement rather than by an estimate. Full detail:
`docs/reports/STRATEGY_FIX_R1B.md` §4 and `docs/reports/STRATEGY_WP_B3.md`'s appendix.
