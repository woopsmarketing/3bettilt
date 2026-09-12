# FISHTILT QA-01 — 오케스트레이터 직접 재검증 (WP-0 ~ WP-G)

**날짜:** 2026-09-05
**대상:** `apps/fishtilt` 전체, `packages/learn-core`
**방법:** 하위 에이전트 보고서를 믿지 않고, 코드·테스트·실제 렌더링 화면을 직접 확인.

## 한 줄 요약

테스트는 전부 초록이었지만 **테스트가 볼 수 없는 결함이 5개 있었다.** 전부 실제
브라우저 화면을 눈으로 보고 찾았다. 모두 수정했고, 재발을 잡는 테스트를 붙였다.
그리고 지금 작업 트리에는 **반드시 해결해야 할 데이터 무결성 문제 1건**이 남아 있다
(§4).

---

## 1. Gates

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **314 passed / 35 files** |
| `pnpm e2e:fishtilt` | **30 passed** |
| `pnpm --filter @gto-self/fishtilt typecheck` | clean |
| `npx eslint apps/fishtilt packages/learn-core --max-warnings=0` | clean |
| `pnpm build:fishtilt` | clean — `/`, `/learn`, `/learn/poker-range`, `/tools/range` all prerendered |

## 2. What the green tests did not catch

Each of these was found by rendering the page and looking at it.

1. **`/learn` was built but unreachable.** WP-G shipped the hub and the lesson
   template and correctly handed the route flip back rather than editing outside
   its boundary. Flipped.

2. **The route test pinned the wrong thing.** `routes.test.ts` hard-coded
   `expect(existsSync(pageFileFor('/learn'))).toBe(false)` — a pin that goes
   stale the moment the page it names ships, and that has to be edited to make it
   pass, which is not a test any more. Replaced with a bidirectional invariant:
   `available === existsSync(pageFileFor(path))` for **every** entry. It now also
   catches the opposite mistake — a page built and never linked — and needs no
   maintenance.

3. **`SiteHeader`'s nav test asserted "none of the five exist yet".** True when
   written, false now. Rewritten to follow the registry: linked when
   `available`, inert text when not, whatever the registry currently says.

4. **The Range Explorer's desktop layout wasted its width and pushed the
   selected-hand panel below the fold.** Two grid-template changes; see
   `FISHTILT_WPD_RANGE_EXPLORER.md` §3.

5. **The 13×13 grid was clipped without saying so on a phone**, and **the chart
   shorthand leaked into a beginner lesson.** Both fixed; see the same section.

Plus one typography defect affecting every page:

6. **`PageHero`'s eyebrow used `tracking-[0.35em]`.** That is a Latin
   small-caps treatment. A Hangul syllable block is already a self-contained
   square, so wide tracking does not stylize it — it takes it apart:
   `핸드레인지` rendered as `핸 드 레 인 지`, five characters the reader has to
   reassemble, at the top of the flagship page. Now `0.06em`.

## 3. Things I checked and found correct

- **`RangeMatrix` scroll instead of shrink.** 44px cells are kept at every
  width. Shrinking 13 columns into 342px would give ~26px targets, below the
  WCAG 2.2 minimum, and `AKo` would not fit. The trade is right; only the missing
  cue was wrong.
- **Keyboard access to the clipped columns.** The scroll wrapper has no
  `tabindex`, and should not: it contains 169 focusable buttons, and browsers
  scroll a focused element into view. Adding `tabindex` to a container with
  focusable children would have made it worse.
- **`/learn` card widths.** I thought the cards had ragged right edges at 1440px.
  Measured in the browser: every card is `360..1080, w=720`. The raggedness was
  an artifact of the downscaled screenshot. No defect.
- **An unknown lesson slug returns a real 404.** `next start` logs an internal
  `NoFallbackError` alongside it — that is Next's own control flow for
  `dynamicParams = false` surfacing in the log, not a broken response. Noted, not
  changed.

## 4. RESOLVED — the hand-strength dataset (was a blocker)

`packages/learn-core/src/strength/dataset.generated.ts` currently on disk
declares `method: 'EXACT'` and `trialCount: 669_240_000`, but its AA equity is
`0.8525409090909091`. The verified exact value, measured directly against
`strategy-core`'s exhaustive path, is:

```
{"key":"AA","equity":0.8520371330210104,"exhaustive":true,
 "runoutSamples":2118760,"runoutSpaceSize":2118760,
 "opponentHands":1225,"scoredTrials":2097572400}
```

2,097,572,400 scored trials **for AA alone** — so a 669M total across 169 classes
cannot be exhaustive. **The file on disk is sampled data wearing an `EXACT`
label**, which is exactly what CLAUDE.md rules 2 and 5 forbid.

The generator's own guard is correct and I read it:

```ts
const everyClassExhaustive = main.every((result) => result.exhaustive);
if (!everyClassExhaustive) {
  say('  NOT WRITTEN — this run sampled, and a sampled dataset must not be labelled EXACT.');
```

so the file predates that guard (mtime 00:12, the exhaustive run started 00:13).
The exhaustive regeneration is still running as of this writing.

**The tree is failing loudly, not lying silently.** I ran the package's own suite against
the file that is on disk right now rather than taking the agent's word for it:

```
pnpm vitest run --project learn-core
  Tests  3 failed | 79 passed (82)
  ✗ expect(aces.equity).toBe(0.8520371330210104)
  ✗ the enumeration is exhaustive
  ✗ suit symmetry — expected 0.0124433 to be <= 1e-9
```

Exactly three failures, all of them the provenance assertions, and 79 unrelated tests still
pass. So the dataset cannot reach a page without `pnpm test` going red first, and the
symmetry deviation (1.2e-2 against a 1e-9 tolerance) is itself a sampling signature. This is
the one piece of known breakage in the tree, and it is deliberate: it stays red until the
exhaustive file lands.

### Outcome — accepted, 2026-09-05 00:54

The exhaustive run finished and I verified the file myself rather than accepting the agent's
report:

| Field | Value | Why it is the right value |
| --- | --- | --- |
| `rows[0]` | `['AA', 0.8520371330210104]` | **Bit-identical** to my independent oracle measurement. The gate was `toBe`, and it holds. |
| `rows[168]` | `['32o', 0.32303228126952854]` | Matches the published ~32.3% figure for the worst starting hand. |
| `trialCount` | `354_489_735_600` | The ~3.5e11 figure my own arithmetic predicted — the number my audit had used to wrongly rule this out. |
| `scoredTrialsPerClass` | `2_097_572_400` | Exactly the `scoredTrials` my AA oracle reported. |
| `boardsPerClass` | `2_118_760` | `C(50, 5)`. Exhaustive, not a budget. |
| `symmetry.maxAbsoluteDifference` | `0` | Not "within 1e-9" — exactly zero across 17 classes. The 169-instead-of-1326 shortcut is exact here, not merely tolerable. |
| `exactTies` | `[]` | No two classes share a bit-identical equity, so a "top X%" cut can never split a tie. |
| `spotCheckMaxDeviation` | `0.0136789` | The cheap sampled path, kept and now measured against truth instead of standing in for it. |

Runtime ~41 minutes wall on 14 cores. `pnpm vitest run --project learn-core` is now
**82 passed / 7 files, 0 failures**.

Worth recording plainly: **my audit was wrong to rule this out.** I computed ~3.5e11
evaluations correctly and then concluded it was "out of reach"; it is ~41 minutes. That is
the falsifying evidence CLAUDE.md rule 9 requires, which is why the decision was reopened
rather than defended. The corrections are dated in `POKER_EDUCATIONAL_DATA_AUDIT.md` §3/§4
and `FISHTILT_00_AUDIT_AND_PLAN.md` §5.3, with the original text preserved.

Still open: `docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md` on disk is the sampled-era
report, and `dataset.generated.ts`'s header cites it for methodology — so the generated file
currently points at a description of a dataset that no longer exists. WP-R is rewriting it.


**Acceptance gate, not negotiable:** the regenerated file must carry
AA `=== 0.8520371330210104` exactly (`toBe`, not `toBeCloseTo`). If it does not,
the run is rejected and investigated — not rounded into agreement. Nothing may
consume this dataset until then.

## 5. Accepted boundary exceptions

- WP-G added `tests/e2e/learn.spec.ts` (11 tests) outside its stated file
  boundary. **Kept.** It tests exactly what WP-G built and it passes; deleting
  real coverage to enforce a boundary would be a net loss. Recorded here so the
  exception is visible rather than silent.

## 6. Deferred, deliberately

- `/tools/range`'s content column is wider than the site header and footer
  (`max-w-[85rem]` vs `max-w-6xl`), leaving the page title ~80px left of the
  wordmark. The width is genuinely needed by compare mode (1240px of matrices).
  Every fix I considered — a `100vw`-based breakout, a fixed negative margin, or
  scrolling the compare pair as one unit — trades one defect for another. This
  belongs to WP-L2's responsive pass, with the whole page in view.
- Whether `pnpm verify` should build FishTilt: WP-N.

---

## 7. WP-F1 review (`/tools`, `/tools/pot-odds`, `/tools/outs`)

Verified by re-running every gate myself and by reading the rendered pages, not from the
agent's report.

### Gates, re-run

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **425 passed / 47 files** (was 314 / 35) |
| `pnpm vitest run --project learn-core` | **82 passed / 7 files** |
| `pnpm e2e:fishtilt` | **49 passed** (was 30) |
| typecheck / eslint / build | clean; all 7 routes prerendered static |

### The numbers on screen, checked by hand

Pot odds, pot 10 / bet 5: final pot `10 + 5 + 5 = 20` ✓, required equity `5/20 = 25.0%` ✓,
`4.0번 중 1번` ✓, `3.0 : 1` ✓. The outs bridge claims 12 outs minimum on the turn (12/47 =
25.5%, and 11/47 = 23.4% falls short) ✓ and 7 by the river (7 outs → 27.84%, 6 outs →
24.14%) ✓, with the implied-odds caveat stated rather than buried.

Outs, 9 outs on the flop: next card `9/47 = 19.1%` ✓, miss-then-hit
`(38/47)(9/46) = 15.8%` ✓, by river `1 − (38·37)/(47·46) = 35.0%` ✓, ×2 shortcut 18.0%
(−1.1%p) and ×4 shortcut 36.0% (+1.0%p) ✓. Every preset's out count is standard and its
derivation is shown.

Money goes through `Money.parseBB` at the input boundary and `Money.formatBB` on the way
out, with `MilliBB` in between — CLAUDE.md rule 1 respected, and probabilities correctly
kept out of it.

### Two shared test files it edited outside its boundary — reviewed, not just accepted

`src/content/graph.test.ts` and `src/components/ToolCTA.test.tsx` both hard-coded
`toolOuts` as their "not built yet" fixture, which this WP shipped. It replaced the literal
with `ROUTES.find(r => r.section === 'tools' && !r.available)`. **This does not weaken the
assertions** — they still require an unavailable tool to render `준비 중` and no link — and
it is the same self-maintaining pattern applied to `routes.test.ts` in §2. Accepted.

One latent trap worth naming: when every tool is eventually built, that `find` returns
`undefined` and `routeById('')` throws. It fails loudly rather than passing silently, and
three tools remain unbuilt, so it is a note for WP-F2/WP-E rather than a fix now.

### What I changed after review

- `SHORTCUT_DIRECTION_LABEL`: `규칙이 실제보다 높게 봅니다` → `높게 잡습니다`. `규칙이 …
  봅니다` does not agree in Korean; on a Korean-first site aimed at beginners that is a
  quality defect, not a nit.
- `prettier --write` across `apps/fishtilt/src` and `tests` — 16 files were unformatted,
  drift accumulated across WP-0/A/C/D/F1 rather than anything WP-F1 introduced. Safe here
  because the whole app is untracked and owned by this effort; it is **not** safe repo-wide.

### Two false alarms I raised and then disproved

Both came from reading a heavily downscaled full-page screenshot:

- I thought the footer tagline was duplicated at the top of `/tools/pot-odds`. A DOM walk
  found one rendered occurrence (top 1791) plus Next's RSC payload inside a `<script>`,
  which is not painted. A 200px crop confirmed a clean header.
- Earlier, I thought `/learn`'s lesson cards had ragged right edges. Measured: every card is
  `360..1080, w=720`.

The rule this earns: **measure or crop before concluding a layout defect from a full-page
screenshot.** Downscaling a 4000px page to 2000px invents artifacts that look like bugs.
