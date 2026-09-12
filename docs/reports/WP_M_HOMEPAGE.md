# WP-M — Homepage final integration

FishTilt `/` replaced: the WP-0 105-line wiring scaffold is gone, the nine-section front
door is in. Everything on the page is derived from the content graph and the route registry
at render time.

## 1. Scope

| In | Out |
| --- | --- |
| `src/app/page.tsx` + `page.test.tsx` | `src/lib/routes.ts` (not touched — `/search` handled through the registry) |
| Three new `Home*.tsx` components + their tests | `src/content/**`, `src/features/**`, `src/app/search/**`, `src/app/practice/**` |
| `tests/e2e/home.spec.ts` (rewritten for the new page) | every other spec file; every shared component |
| This report | `pnpm build:fishtilt` / `pnpm e2e:fishtilt` (orchestrator's gate) |

## 2. Files changed

| File | New? | What |
| --- | --- | --- |
| `apps/fishtilt/src/app/page.tsx` | rewritten | The nine sections. Server Component; one client island. |
| `apps/fishtilt/src/app/page.test.tsx` | rewritten | Rule-based tests (see §9). |
| `apps/fishtilt/src/components/HomeLinkCard.tsx` | new | The homepage's one card. Takes `href: string \| null`; `null` renders 준비 중. |
| `apps/fishtilt/src/components/HomeLinkCard.test.tsx` | new | Both states, from constructed fixtures. |
| `apps/fishtilt/src/components/HomeCallToAction.tsx` | new | The button-shaped member of the same family. |
| `apps/fishtilt/src/components/HomeCallToAction.test.tsx` | new | Both states, from constructed fixtures. |
| `apps/fishtilt/src/components/HomeRangePreview.tsx` | new | Client island: position buttons over the real matrix. |
| `apps/fishtilt/src/components/HomeRangePreview.test.tsx` | new | Dataset, switching, `aria-pressed`, live region, BB. |
| `apps/fishtilt/tests/e2e/home.spec.ts` | rewritten | Written, **not run** (per brief). |

Reused unchanged: `PageHero`, `SectionHeading`, `RangeMatrix`, `RangeSummary`,
`SelectedHandPanel`, `features/range`, `features/tools/hub`, `features/quiz/hub`,
`content/graph`, `lib/routes`.

## 3. The nine sections and where each one's data comes from

| # | Section (`aria-label` = `<h2>`) | Data source |
| --- | --- | --- |
| 1 | `FishTilt 한 줄 소개` (hero, the page's only `<h1>`) | Copy is the build spec's. CTA 1 → `routeById('range')`; CTA 2 → `hrefOfContent(PUBLISHED_LESSONS[0])`, falling back to the `learn` route. |
| 2 | `어디서 시작할까요?` | Four spec-given intent labels; each destination is a **route id** resolved through `routeById` + `available` (`learn`, `range`, `toolEquity`, `practice`). Card meta line is the route's own `label`. |
| 3 | `자리를 바꾸면 표가 달라집니다` | `HomeRangePreview` → `resolveRange()` over `STRATEGY_POSITIONS`; numbers via `RangeSummary` ← `strategy-core`. |
| 4 | `인기 무료 도구` | `toolHubEntries()` (route registry ∩ `TOOL_DESCRIPTION`) — all six, in registry order. |
| 5 | `처음이라면 이 순서로` | `LEARN_ROADMAP` (curriculum order), first 6; number/title/description/meta all off the record. |
| 6 | `풀어보면서 확인하기` | `practiceHubCards()`; a card whose id has no registry entry, or an unavailable one, renders 준비 중 with no edit here. |
| 7 | `이런 질문에 답합니다` | `publishedOfKind('blog' \| 'learn' \| 'hands')` filtered to records whose **own title ends with `?`** — a question the site literally answers. |
| 8 | `배우기와 읽을거리 더 보기` | `PUBLISHED_LESSONS.slice(-3)` + published blog records not already used in §7. |
| 9 | `용어와 검색` | `glossaryRecords()` for the counts and six published terms; the glossary and **search** hubs via `routeById` + `available`. |

The footer (in `layout.tsx`) was not touched.

### Section 8 is not called "latest"

No content record carries a publication date (`src/content/types.ts` has no such field), so
"newest" is not a fact this repository holds. The section therefore states the two published
totals and offers further pieces, and asserts no recency. See §10.

## 4. How dead or unfinished links are made impossible

1. **The page never writes a path.** There is no string literal beginning `/blog/`, `/learn/`
   or `/tools/` anywhere in `page.tsx`. Every destination comes from `hrefOfContent(record)`
   (`null` for `PLANNED`) or from the local `routeHref(id)` (`null` when
   `routeById(id).available` is false).
2. **Only two components can render a destination**, and both accept a *resolved*
   `string | null` and nothing else: `HomeLinkCard` and `HomeCallToAction`. Neither can build
   a path, so there is no code path on this page that emits an unverified `href`.
3. **`null` is rendered, not hidden**: the site's established non-interactive 준비 중
   treatment — readable text, a badge, no `<a>` and no `<button>` — identical to
   `RouteNavItem`, `ToolCTA`, `/learn`, `/tools`, `/practice`, `/glossary`.
4. **`/search` was handled purely through the registry.** Its entry read `available: false`
   when this page was written and `available: true` by the time it was verified; the page
   rendered correctly in both states with no edit and no special case. `routes.ts` was not
   touched. Registry entries for `practiceHandRanking` / `practiceStartingHand` appeared
   mid-build the same way and were picked up automatically.
5. **Enforced by test, not by vigilance**: `page.test.tsx` collects every `a[href]` the page
   renders and asserts each one is in the set {available route paths} ∪ {published records'
   paths}, and separately asserts no `PLANNED` record's path appears. The e2e spec proves the
   stronger property against the running server (every link returns HTTP 200).

## 5. The range preview

| | |
| --- | --- |
| Dataset | `RFI_RANGES` from `@gto-self/strategy-core`, reached only through `resolveRange()` — the app's single range facade. No second lookup, no fallback. |
| Conditions shown | `6인 · 100BB · 아무도 참여하지 않았을 때 (First In)` from `describeRangeConditions(query)`, always visible beside the numbers. |
| Label | `학습용 기본 레인지` (`RANGE_LABEL`), on every state. Never "GTO", never "optimal", never "correct". |
| Positions | All six of `STRATEGY_POSITIONS`, default `BTN` (matching the Range Explorer's own default). |
| A position with no data | The only unreachable query at this pinned spot/stack/table is **BB**. It renders `UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE` — "빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다…" — and **no grid at all**: no empty 13×13, no borrowed range, no combo count, no percentage. Asserted in both the component test and the e2e spec. |

**Why it is not `RangeMatrixMini`.** That component is the right reuse in an article, and this
one is deliberately the same composition of the same shipped leaves (`RangeMatrix`,
`RangeSummary`, `SelectedHandPanel`, `resolveRange`) — not a second matrix. It could not be
used directly for one reason: the brief requires the chart's change to be *announced*, and
the live region has to wrap the result block, which lives inside that component's own state.
Adding a homepage-only prop to a component fifteen articles embed was the worse trade. This is
recorded in `HomeRangePreview.tsx`'s module doc.

## 6. Responsive

**Not measured in a browser** — the brief withholds `pnpm build:fishtilt` / `pnpm e2e:fishtilt`
from this WP, so the five widths are asserted by the spec that was written, not by a run I can
report results for.

| Width | Assertion written | Structural reason it should hold |
| --- | --- | --- |
| 360 | `home.spec.ts` overflow check, **plus** a second check after pressing a position (the chart is the one wide element) | Single column; `RangeMatrix` scrolls inside its own `overflow-x-auto` wrapper, whose min-content width is 0 |
| 390 | overflow check; mobile nav opened | as above |
| 768 | overflow check | `sm:grid-cols-2` card grids only |
| 1024 | overflow check | `lg:grid-cols-[max-content_minmax(0,1fr)]` engages: 608px matrix + 24px gap inside 976px of content; the second column is `minmax(0,1fr)` so it cannot push |
| 1280 / 1440 | overflow check | `max-w-5xl` container centred |

The two-column preview layout is copied verbatim from `RangeExplorer`, whose own overflow
tests pass today at these widths.

## 7. Accessibility

| Concern | What was done |
| --- | --- |
| Heading order | Exactly one `<h1>` (the hero, via `PageHero`) and eight `<h2>` (via `SectionHeading`). No `<h3>`+ on the page; cards use `<span>`, as every existing hub does. A unit test walks the rendered headings and fails on any skipped level. |
| Landmarks | Each of the nine sections is a `<section aria-label="…">` (role `region`) whose name matches its visible heading — the idiom `/tools`, `/learn`, `/blog`, `/glossary`, `/practice` already use. The test asserts exactly nine, no more. |
| Real controls | Every destination is a real `<a>`; every position switch is a real `<button type="button">`. An unbuilt destination is inert text — never a disabled control, never a dead link. |
| Visible focus | Every interactive element carries `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`, the app-wide token. The e2e spec checks the computed outline on a hero CTA and a position button, focusing them **by keyboard** (focus → Shift+Tab → Tab) because `:focus-visible` depends on how focus arrived. |
| Selected state | `aria-pressed` on the position buttons — the exact pattern `RangeExplorer` and `RangeMatrixMini` already use. Reinforced by the grid's accessible name, which carries the position (`"BTN 자리의 학습용 기본 레인지 표"`). |
| Announcement | The result block (summary, or the no-data explanation) is wrapped in `role="status" aria-live="polite"` — the pattern `PotOddsCalculator`, `EquityCalculator`, `OutsCalculator` and `HandChecker` already use for a recomputed answer. The **169-cell grid is deliberately outside** the live region; announcing it would read 169 buttons aloud on every press. Asserted by test. |
| Touch targets | Position buttons `h-11` (44px); CTAs `min-h-11`. |

## 8. Every number on the page, and how it is derived

| Rendered | Value today | Derivation |
| --- | --- | --- |
| `전체 N개 중 M개를 지금 사용할 수 있습니다` (tools) | 6 / 6 | `toolHubEntries().length` / those with `route.available` |
| `전체 N편 중 M편을 읽을 수 있습니다` (roadmap) | 15 / 15 | `LEARN_ROADMAP.length` / `PUBLISHED_LESSONS.length` |
| `전체 N편 보기` (roadmap CTA) | 15 | `LEARN_ROADMAP.length` |
| `전체 N개 퀴즈 중 M개` | 3 / 3 | `practiceHubCards()` / those with `route.available === true` |
| `배우기 N편과 읽을거리 M편` | 15 / 20 | `PUBLISHED_LESSONS.length` / `publishedOfKind('blog').length` |
| `전체 N개 용어 중 M개` | 58 / 58 | `glossaryRecords().length` / those `PUBLISHED` |
| Lesson numbers `01`…`06` | — | `String(lesson.order).padStart(2, '0')` |
| `초급 · 약 3분` etc. | — | `contentMeta(record)` ← `record.level`, `record.readMinutes` |
| `전체 1,326가지 조합 중 N가지 (X%)` | — | `RangeSummary` ← `COMBO_COUNT`, `comboCountOf`, `percentageOf` from `strategy-core` |
| `6인 · 100BB · 아무도 참여하지 않았을 때 (First In)` | — | `describeRangeConditions(query)` |
| `13×13` (hero CTA, intent card) | — | **The chart's product name**, used site-wide (nav label `핸드레인지`, `/tools/range`'s own `<h1>`, `TOOL_DESCRIPTION`). Written as a name, not computed; it is the 13 ranks by 13 ranks the grid literally draws. |
| Slice sizes (6 lessons, 6 questions, 3+3 more, 6 terms) | — | Named display constants in `page.tsx`. Not claims: each list's hub CTA states the real total. |

There is no number on this page that is not one of the above. No poker statistic is stated
that the packages did not compute, and no strategy claim is made anywhere: the copy says what
a tool does and what a lesson teaches, never what a player should do.

## 9. Tests

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **1114 passed, 1 failed (1115), 100/101 files** |
| `pnpm typecheck` | **PASS** — all 13 projects |
| `npx eslint apps/fishtilt --max-warnings=0` | **PASS** — clean |
| `npx prettier --check` (my 7 files only) | **PASS**. No repo-wide format was run. |
| `pnpm vitest run --project fishtilt <my 4 files>` | **25 passed (25)** |

**The one failure is not mine.** `src/content/content.test.ts` →
*"a published piece states the reading time its own text implies"* → `hand-aa: expected 2 to be 3`.
That is the concurrent `/hands` authoring batch mid-write (`registry/hands/e3.ts` vs
`content/hands/aa.mdx`); it is outside my file boundary and I did not touch content.

Tests I added (25):

| File | Asserts |
| --- | --- |
| `page.test.tsx` (9) | one `<h1>` with the spec headline; nine regions and no more; no skipped heading level; both hero CTAs resolve to the registry route / the first lesson; **every rendered `href` is in {available routes} ∪ {published record paths}**; **no `PLANNED` record is linked**; every printed count equals the same graph call the page made; every link in §7 is a published record whose title really ends with `?`; the chart's numbers change on a position press; the string `GTO` never appears. |
| `HomeLinkCard.test.tsx` (5) | link when resolved; **no link and no button** when `null`; 준비 중 stated in words with the name still readable; optional lines omitted rather than emptied; eyebrow. |
| `HomeCallToAction.test.tsx` (3) | same two states; focus ring class present. |
| `HomeRangePreview.test.tsx` (8) | opens on a position with data and shows *that* position's computed numbers; label + conditions visible; pressing another position changes both the numbers and the rendered grid's accessible name; `aria-pressed` moves; the answer is inside `role="status" aria-live="polite"` and the grid is not; **BB shows the facade's explanation and no grid, no combo count, no percentage**; never renders `GTO`. |

Per ruling 26, no test names a specific article, pins a live count, or searches live data for
"whatever is unbuilt today". The 준비 중 behaviour is proved against fixtures the tests
construct, so it stays provable after every route and record has shipped — which already
matters: as of this run **nothing on the homepage renders a 준비 중 badge**, because every
route and every linked record is now built.

`tests/e2e/home.spec.ts` (17 tests) was written and **not run**, per the brief. It covers:
the nine regions in prerendered HTML; both hero CTA targets and a real navigation; **every
`main` link returns HTTP 200**; every 준비 중 badge is outside any `a`/`button`; the preview
changes (`aria-pressed` + live-region text + grid name) on a click; BB explained with no grid;
conditions visible; no `GTO`; no horizontal overflow at 360/390/768/1024/1280/1440 plus one
after interacting with the chart at 360; mobile nav; keyboard focus rings.

## 10. Reported, not changed

| # | Item | Why it is a report |
| --- | --- | --- |
| 1 | **No content record carries a date.** `ContentRecord` has `status`, `indexable`, `readMinutes` — nothing temporal. So the spec's "latest learn/blog" section cannot be *latest*: registry order is authoring-batch order, not publication order. Section 8 therefore states the two published totals and shows further published pieces, and claims no recency. Adding a `publishedAt` field is a `src/content/**` change and outside my boundary. | Owner: content architecture. |
| 2 | `src/content/content.test.ts` fails on `hand-aa`'s `readMinutes` (expected 3, record says 2) — the `/hands` batch mid-write. | Outside my boundary; will resolve when that agent finishes. |
| 3 | The homepage would read better with a `/hands` entry point (20 hand pages exist), but the spec fixes the nine sections and CLAUDE.md rule 8 forbids adding a tenth. `/hands` remains reachable from the footer. | Product decision, not mine to take. |
| 4 | `docs/FISHTILT_STATE.md` "Known limitations" still says the homepage is a WP-0 wiring proof. That file is the orchestrator's. | Owner: orchestrator. |
