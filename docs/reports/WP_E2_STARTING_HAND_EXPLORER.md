# WP-E2 — Starting Hand Explorer (`/tools/starting-hand`)

## 1. Scope

A 13×13 view of all 169 starting-hand classes ordered by raw preflop strength
(`@gto-self/learn-core`'s frozen `HAND_STRENGTH` dataset, WP-R), with a "top X%" slider.
Same shell and interaction idiom as `/tools/range` (WP-D): server-rendered page shell, one
`'use client'` island, mount-then-sync URL state, `RangeMatrix` reused unmodified.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/src/features/strength/types.ts` | `StartingHandView` (`RANK` \| `TOP_SHARE`) |
| `apps/fishtilt/src/features/strength/viewModel.ts` (+ test) | slider clamp, `topSelectionForPercent`, `handClassSetOfSelection`, `tieInfoFor`, `strengthDetailOf` |
| `apps/fishtilt/src/features/strength/copy.ts` (+ test) | all Korean strings, dataset-driven (parameters, not literals) |
| `apps/fishtilt/src/features/strength/url.ts` (+ test) | `?view=&pct=` parse/build, mirrors `features/range/url.ts` |
| `apps/fishtilt/src/features/strength/index.ts` | barrel |
| `apps/fishtilt/src/components/StartingHandExplorer.tsx` (+ test) | the client island: mode toggle, slider, matrix, panel, URL sync |
| `apps/fishtilt/src/components/StartingHandPanel.tsx` (+ test) | wraps `SelectedHandPanel` (unmodified) + rank/percentile/equity block |
| `apps/fishtilt/src/app/tools/starting-hand/page.tsx` (+ test) | route shell, methodology sections, cross-links |
| `apps/fishtilt/tests/e2e/starting-hand.spec.ts` | written, not run (per instructions) |
| `apps/fishtilt/src/lib/routes.ts` | one line: `toolStartingHand.available` → `true` (last step) |
| `docs/reports/WP_E2_STARTING_HAND_EXPLORER.md` | this report |

No file outside this list was edited. `RangeMatrix.tsx` and `SelectedHandPanel.tsx` are
reused verbatim, unmodified.

## 3. Decisions

| Decision | Why |
| --- | --- |
| Default view = `TOP_SHARE` at 15% | Matches the illustrative example `FISHTILT_WP_R_STRENGTH_DATASET.md` §5 walks through (31 classes, 15.08% actual share); shows a live highlight on first paint instead of 169 neutral cells. |
| `RANK` mode passes `range={null}` to `RangeMatrix` | There is no "in/out" question when just browsing order; reuses `RangeMatrix`'s existing neutral rendering rather than a range that "contains everything". |
| Slider only rendered in `TOP_SHARE` | It has nothing to control in `RANK`. |
| `StartingHandPanel` composes `SelectedHandPanel`, never modifies it | Reuse mandate; `range` prop is never passed to it (no "포함되어 있어요" wording, which is Range-Explorer-specific) — top-share membership is stated in this page's own words instead. |
| `handClassSetOfSelection` builds a `HandClassSet` via `strategy-core`'s `handClassSet(notation)` from the selection's own keys | No second highlight mechanism; `topHandsByShare`'s cut is the only source of the selection. |
| URL: `?view=RANK\|TOP_SHARE&pct=1..100`, no selected-hand param | Mirrors `features/range/url.ts` exactly (same two axes it persists: filters, not the click-to-select state). |
| All numeric copy takes its numbers as parameters (`provenanceSentence(meta)`, `topShareCutSentence(classCount, comboCount)`, `rankLabel(entry, total)`) | If the dataset is ever regenerated at a different scale, the page's words change with it instead of silently going stale. |
| Cross-links reuse `ToolCTA` (`toolEquity`, `range`) and the content-graph `PLANNED`-safe pattern (`starting-hand-ranking` lesson, currently `PLANNED`) | `ToolCTA`/`hrefOfContent` already refuse to link an unavailable destination — never a second availability check. |

## 4. Behavior

- Two modes: **강한 패 순서** (neutral matrix, click any cell to read its rank) and **상위 X% 보기** (slider 1–100, live highlight).
- Slider changes the highlighted `HandClassSet` live via `topHandsByShare` (combo-weighted cut, never re-implemented).
- Clicking a cell renders: two cards, Korean reading, `describeHandClassKorean` one-liner, combo count (all via `SelectedHandPanel`), plus rank (`N / 169`), cumulative top-% band, and equity (new block).
- Mobile: `RangeMatrix`'s own `ResizeObserver` overflow cue is inherited unmodified; no second solution invented.

## 5. Exact Korean copy shipped (quoted verbatim)

**Methodology sentence** (`METHODOLOGY_SENTENCE`):
> 이 순위는 상대가 무작위로 아무 두 장을 들고 있다고 가정하고, 프리플랍에서 올인해 승부를 끝까지 봤을 때 내가 이기는 비율만으로 169개 시작 패의 순서를 매긴 것입니다.

**Strategy-distinction sentence** (`STRATEGY_DISTINCTION_SENTENCE`, WP brief wording, verbatim):
> 이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다.

**Range-distinction sentence** (`RANGE_DISTINCTION_SENTENCE`, names `RANGE_LABEL` by reference):
> 핸드레인지 탐색기의 학습용 기본 레인지와는 다른 기준입니다. 그 표는 포지션별로 실제로 여는 패를 보여주고, 이 표는 포지션과 관계없이 카드 두 장 자체의 승률만 비교합니다.

**Playability caveat** (`PLAYABILITY_CAVEAT_SENTENCE`, WP_R §7 in UI form):
> 그래서 순위표에서는 실제로 잘 플레이하기 어려운 오프수트 에이스가, 사람들이 좋아하는 수트드 커넥터나 낮은 페어보다 위에 있는 경우가 있습니다. 무작위 상대에게는 잘 이기지만, 실전에서 이기기 쉬운 패라는 뜻은 아닙니다.

**Provenance** (`provenanceSentence(HAND_STRENGTH)`, numbers read from dataset metadata at render time — shown here with the shipped values):
> 추정이 아닙니다. 가능한 보드 2,118,760가지 전부를 상대 패 1,225가지 전부와 맞붙여 계산했습니다 — 총 354,489,735,600번의 승부입니다.

**Combo-cut explanation** (`topShareCutSentence(HAND_CLASS_COUNT, COMBO_COUNT)`):
> "상위 X%"는 169개 핸드 이름 중 X%가 아니라, 실제로 받게 되는 1,326가지 조합 중 상위 X%를 뜻합니다. 페어처럼 조합 수가 적은 패부터 먼저 포함되기 때문에, 실제로 포함된 비율은 슬라이더 값보다 살짝 높게 나올 수 있습니다.

**Ties overview** (`tiesOverviewSentence(HAND_STRENGTH.exactTies)`, currently empty):
> 지금 이 데이터에는 승률이 완전히 같은 시작 패 쌍이 하나도 없습니다. 169개 모두 순서가 명확합니다.

The word "GTO" does not appear anywhere in `features/strength/**` or the new components/page (asserted by tests).

## 6. Tie handling

- `viewModel.tieInfoFor(entry)` compares an entry against its immediate stronger/weaker
  neighbour in `HAND_STRENGTH_BY_RANK` via `handStrengthTied` (bit-identical equity), never a
  tolerance, and never assumes ties are impossible.
- `copy.tieNote(tie)` returns `null` when neither neighbour ties (true for all 169 classes
  today — `HAND_STRENGTH.exactTies` is `[]`) and otherwise a sentence stating the two classes
  are tied and that neither is "stronger" — never a silent strict-order claim.
- `rankLabel` always shows the row's literal position (`N / 169`); it is the tie note beside
  it, not the rank number, that carries the "cannot be strictly ordered" fact when a tie
  exists.
- Tested directly (`viewModel.test.ts`, `copy.test.ts`) with both the real dataset (0 ties)
  and synthetic tied/untied `TieInfo` objects, so the code path is exercised even though the
  shipped data never triggers it.

## 7. Tests run (real counts)

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **662 passed, 5 failed, 667 total** (65 files, 61 passed). All 5 failures are in files I did not touch — see §9. Every file I own (`features/strength/*`, `components/StartingHand*`, `app/tools/starting-hand/*`) is 100% green. |
| `pnpm typecheck` | **PASS** — 0 errors, 13/13 workspace projects. |
| `npx eslint apps/fishtilt --max-warnings=0` | **PASS** — 0 errors, 0 warnings. |
| `npx prettier --check` on every file I created/edited | **PASS** (reformatted 5 of my own new files once with `--write`, scoped to those files only — no repo-wide format run). |
| `tests/e2e/starting-hand.spec.ts` | **written, not run**, per instructions. |

New test counts added by this WP: `viewModel.test.ts` 20, `copy.test.ts` ~24, `url.test.ts`
19, `StartingHandPanel.test.tsx` 6, `StartingHandExplorer.test.tsx` 10, `page.test.tsx` 7
(exact per-file numbers are in the vitest run above; roughly +85 fishtilt tests net of the
routes-registry check that flips with the flag).

## 8. Known limitations

1. **`RangeMatrix`'s per-cell `aria-label` is the Latin key only** (`"AKs"`, or `"AKs, 레인지
   포함"` in `TOP_SHARE` mode), not the Korean spoken reading (`에이스 킹 수티드`). The WP
   brief's accessibility bullet names the Korean reading as the example accessible name;
   `RangeMatrix.tsx` is out of this WP's file boundary and was reused unmodified per
   instructions ("do not build a second 13×13 grid"), so this could not be changed here. The
   grid is still a real button per cell with a real, unique accessible name (the class key),
   just not the pronunciation gloss. Flagged for whichever WP next touches `RangeMatrix.tsx`
   (or for an orchestrator decision to grant a one-line exception).
2. **`RangeMatrix`'s legend text says "레인지"** ("레인지에 포함되는 핸드" / "레인지 밖의
   핸드") even on this non-range page, because that copy is baked into the shared component.
   Mitigated with page-level explanation text (`topShareCutSentence`, `actualShareSentence`)
   that states what "포함/밖" means in this page's own terms, but the component's own legend
   wording could not be changed without editing `RangeMatrix.tsx`.
3. **The default 15% slider position is a UI choice, not a poker fact** — chosen because it
   matches the illustrative example already published in
   `FISHTILT_WP_R_STRENGTH_DATASET.md` §5, not invented.

## 9. Outside my boundary — needs orchestrator action

Flipping `toolStartingHand.available` to `true` (required, last step of this WP) made it the
**last** tool in `routes.ts`'s `'tools'` section to ship — every other tools-section route
was already `available: true`. That triggered 5 pre-existing test failures in 4 files I do
not own, all following the exact pattern ADR-precedent ruling 21 already documents and fixed
once for `tests/e2e/tools-hub.spec.ts` ("a test that names one unbuilt feature expires the
day that feature ships"). None of these files are in my stated boundary, so I did not edit
them — reporting per the working agreement instead:

| File | Failing test | Cause | Suggested fix (mirrors ruling 21) |
| --- | --- | --- | --- |
| `src/features/tools/hub.test.ts` | `lists planned tools too, so the hub shows the whole plan honestly` | `expect(planned.length).toBeGreaterThan(0)` — now `0`, since every tools-section route shipped. | Retire or generalize: the invariant that survives is "every entry either has `available: true` or renders with a 준비 중 badge", not "count > 0". |
| `src/app/tools/page.test.tsx` | `links a built tool at its registry path and marks an unbuilt one 준비 중` | `screen.getAllByText('준비 중')` throws when `planned === 0` (the "준비 중인 도구" section itself no longer renders). | `getAllByText` → `queryAllByText` (returns `[]` instead of throwing) — the same fix ruling 21 already applied to the e2e spec. |
| `src/components/ToolCTA.test.tsx` | `renders no link at all for a tool that is not built yet` and `falls back to the route's own label for the action word` | `UNBUILT_TOOL_ID = ROUTES.find(r => r.section === 'tools' && !r.available)?.id ?? ''` now finds nothing → `routeById('')` throws. | Broaden the search to `!route.available` (drop the `section === 'tools'` filter) — `practice`/`search` are still unbuilt, and these tests are not actually about the `tools` section specifically. |
| `src/content/graph.test.ts` | `toolHref > returns null for a tool the route registry says is not built` | Same `ROUTES.find(... section === 'tools' ...)` pattern, same failure. | Same fix as above. |

All 5 are pre-existing tests whose own comments already anticipated staleness from naming a
*specific* route ("Naming a specific one that later ships is how this assertion goes stale
... so the route is FOUND rather than hard-coded") but did not anticipate the *whole
tools-section* being exhausted. I did not touch any of these 4 files.

## 10. Follow-up: stale unbuilt-tool assertions

Section 9 above flagged 5 pre-existing test failures caused by `toolStartingHand` shipping
as the last unbuilt route in `routes.ts`'s `'tools'` section. This follow-up fixes all 5,
in the 4 files section 9 named, without touching any source file.

**What changed, one line per file:**

- `src/content/graph.test.ts` — `toolHref`'s "not built" test now gets its unbuilt route
  from a `vi.mock('../lib/routes.js', …)` that forces `toolOuts.available = false` (every
  other route, `range` included, passes through unmodified), instead of searching `ROUTES`
  for one that no longer exists; removed the now-unused `ROUTES` import.
- `src/components/ToolCTA.test.tsx` — same `vi.mock` pattern (relative path `../lib/routes.js`),
  `UNBUILT_TOOL_ID` is now the literal `'toolOuts'` forced unavailable by the mock instead of
  a live-registry search; removed the now-unused `ROUTES` import.
- `src/app/tools/page.test.tsx` — same `vi.mock` pattern (`../../lib/routes.js`), forcing
  `toolHandChecker.available = false` (chosen because this file separately hard-codes real
  paths for `toolPotOdds` and `toolOuts` in an unrelated test, so those two were left alone);
  `ROUTES` stays imported (still used directly by the "never links a route the registry says
  does not exist" test).
- `src/features/tools/hub.test.ts` — no mock needed here. Rewrote
  `lists planned tools too, so the hub shows the whole plan honestly` to assert the
  invariant that actually matters — the hub hides nothing — directly against the registry
  (`listed.length === TOOL_ROUTES.length`, and every tool route present by id) instead of
  `expect(planned.length).toBeGreaterThan(0)`, which passed only because at least one tool
  happened to still be unbuilt and now fails vacuously-in-reverse (0 is not `> 0`) the moment
  the plan is complete.

**Why a mock instead of section 9's original two suggestions:** broadening the search to
`!route.available` regardless of section (dropping the `section === 'tools'` filter) would
have made `graph.test.ts`'s and `ToolCTA.test.tsx`'s "tool not built" tests exercise
`practice`/`search` — routes outside the `tools` section entirely — silently changing what
the test is actually about, and would break again the day those two ship. Swapping
`getAllByText` for `queryAllByText` in `page.test.tsx` would have made the "marks an unbuilt
one 준비 중" assertion pass by tolerating zero matches — an assertion that passes because a
collection is empty is worse than no test. A mocked fixture keeps every test exercising
exactly the behaviour its name describes, permanently, regardless of how many tools have
shipped.

**Why `available` is flipped on an existing route id instead of a brand-new synthetic
route:** `toolHubEntries()` (`src/features/tools/hub.ts`) throws if a `tools`-section route
has no entry in its `TOOL_DESCRIPTION` map — by design, so a new tool can never ship as a
blank card. A synthetic route with a new id would have no description and would make
`page.test.tsx`'s `ENTRIES = toolHubEntries()` throw for every test in the file. Flipping an
existing route's `available` flag inside the mock keeps its id, path, label and description
intact — only the one boolean the test cares about is fake.

**No assertion was weakened, deleted, or made vacuous.** Every rewritten test still fails if
the behaviour it names stops being true:
- `toolHref` really does get called with a route whose `available` is `false` (forced by the
  mock, then asserted `.toBe(false)` before use) and really does assert the return is `null`.
- `ToolCTA`'s two tests render with a route the mock forces unavailable and assert no link
  role exists, `준비 중` is present, and the label falls back to `${route.label} 열기`.
- `page.test.tsx`'s "marks an unbuilt one 준비 중" test still runs its existing per-entry
  loop (link `null` when `!available`, real `href` when available) and still counts
  `준비 중` badges against the actual planned count — now `1` instead of `0`, so
  `getAllByText` finds a real match instead of throwing.
- `hub.test.ts`'s rewritten test would fail the moment `toolHubEntries()` ever filtered out
  or hid an unavailable route, because the length and per-id presence checks are made
  against the full `TOOL_ROUTES` list pulled from the live registry, not against whatever
  happens to be unbuilt.

**Gate results:**
- The 4 owned files together: `pnpm vitest run --project fishtilt src/content/graph.test.ts
  src/components/ToolCTA.test.tsx src/app/tools/page.test.tsx src/features/tools/hub.test.ts`
  → 4 files passed, 35/35 tests passed.
- `pnpm vitest run --project fishtilt` (full project) → 64 files passed, 1 file failed
  (`src/content/content.test.ts`); 665/667 tests passed. The 2 failures in
  `content.test.ts` name content records (`hand-aa`, `term-hand-ranking`, etc.), not routes —
  outside my file boundary and belonging to the concurrent agent mid-flight on
  `src/content/registry/**` per the task's own note (the failure count dropped from 3 to 2
  between two runs a few minutes apart, consistent with that agent's in-progress work, not
  mine to fix).
- `pnpm typecheck` → clean across all 13 workspace packages, including `apps/fishtilt`.
- `npx eslint apps/fishtilt --max-warnings=0` → clean (0 problems). One intermediate round
  surfaced 3 `@typescript-eslint/consistent-type-imports` errors from an inline
  `importOriginal<typeof import('../lib/routes.js')>()` type annotation in each of the 3
  mocked files; fixed by adding a `import type * as RoutesModule from '../lib/routes.js'`
  (or `'../../lib/routes.js'` for `page.test.tsx`) and referencing `typeof RoutesModule`
  instead.

No source file was changed. No test was skipped, weakened, or asserted vacuously.
