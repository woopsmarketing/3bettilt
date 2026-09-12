# FISHTILT WP-D — Range Explorer (`/tools/range`)

**작성:** 오케스트레이터 (하위 에이전트 보고 + 직접 재검증)
**날짜:** 2026-09-05
**상태:** 완료. 유닛 314개 / E2E 30개 통과, typecheck·lint·build 클린.

## 한 줄 요약

WP-C가 만든 13×13 표를 **실제로 쓸 수 있는 페이지**로 만들었다. 위치·상황·스택을
고르면 표가 바뀌고, 칸을 누르면 그 핸드를 설명하고, 두 위치를 나란히 비교할 수 있고,
그 상태 전체가 URL에 담겨 공유된다. **MVP에서 실제로 켜져 있는 것은 RFI(First In)
하나뿐이며**, 나머지 상황과 스택은 "준비 중"으로 정직하게 비활성이다 — 데이터가
없는 자리를 UI로 메우지 않았다.

---

## 1. What shipped

| File | What it is |
| --- | --- |
| `src/features/range/types.ts` | `RangeQuery` (heroPosition / spot / stackDepth / tableSize) and the closed vocabularies for each axis |
| `src/features/range/resolve.ts` | `resolveRange(query)` → `RANGE` or `UNSUPPORTED` |
| `src/features/range/url.ts` | `parseRangeUrlQuery` / `buildRangeUrl`, params `hero` `spot` `stack` |
| `src/features/range/copy.ts` | Korean labels, `describeRangeConditions`, `handClassReading` |
| `src/features/range/notation.ts` | `formatHandClassSet` — chart shorthand from a `HandClassSet` |
| `src/components/RangeExplorer.tsx` | the page's client shell: state, URL sync, layout |
| `src/components/RangeFilters.tsx` | the three filter rows, unavailable options included and labelled |
| `src/components/RangeCompareMatrix.tsx` | the difference grid |
| `src/components/RangeShareLink.tsx` | `링크 복사` |
| `src/app/tools/range/page.tsx` | the route, its two explainer panels, metadata |

Tests: `resolve` 10, `url` 14, `copy` 18, `notation` 15, `RangeExplorer` 12,
`RangeFilters` 8, `RangeCompareMatrix` 9, `RangeShareLink` 5, page 5. E2E 8.

## 2. The decisions that matter

### 2.1 One spot is real, and the other two say so

The user's scope answer was **RFI only**. `RangeFilters` still renders
`Facing Open` and `Facing 3-Bet`, and 40BB / 60BB / 150BB+, each with a `준비 중`
badge and disabled — rather than hiding them. Hiding an axis teaches the reader
that the axis does not exist; showing it inert teaches that it exists and is not
answered yet. Selecting an unsupported combination through the URL produces the
`UNSUPPORTED` state with the reason spelled out, never a substituted range
(CLAUDE.md rule 2).

`resolveRange` reports **every** failing axis at once plus a
`nearestSupportedQuery`, so `?hero=BB&spot=FACING_3BET&stack=40` explains all
three problems and offers one link out, instead of making the reader fix them
one at a time.

### 2.2 BB has no first-in range, and that is a lesson

`RFI_RANGES.BB` is null because the hand is over when everyone folds to the big
blind. The Explorer renders that explanation. This is the clearest case in the
product of an absence being more instructive than a number.

### 2.3 The compare view is 3-state because the ranges are not nested

I verified this directly rather than accepting it: **BTN contains A6o, A5o and
A4o that SB does not**, even though SB is the wider range overall (622 combos
vs 568). "Wider ⊇ narrower" is false for this dataset. So `RangeCompareMatrix`
uses `SHARED | ONLY_A | ONLY_B | NEITHER` and lets `aria-label` — not colour —
carry which side a differing cell belongs to.

*(My first verification script was wrong: it read `.key` off
`handClassesOf()`, which returns numeric indices, so both difference sets came
back empty while the class counts disagreed. That is impossible, which is how I
caught it. Redone with indices and `handClassAt()`.)*

### 2.4 The URL is the state

Every filter writes to the query string and the page reads it back on load, so a
link is a complete description of what the sender was looking at. Unknown or
malformed params fall back to the default query rather than throwing.

## 3. Fixes I made during review (not in the agent's report)

These were found by looking at rendered pages, not by running tests.

1. **Compare mode clipped the second matrix.** Fixed during WP-D.
2. **Default view wasted its width.** The two-column grid was
   `[minmax(0,1fr)_22rem]`, so the 608px matrix sat in a 936px column with a
   328px hole beside it. Now `[max-content_minmax(0,1fr)]` — the slack goes to
   the summary panel.
3. **The selected-hand panel was pushed far down the page.** The matrix spans
   both grid rows, and a grid distributes a spanning item's surplus height across
   every row it covers — inflating row 1 and pushing the panel below the fold.
   `lg:grid-rows-[auto_1fr]` sends the surplus to the second row instead, so the
   panel sits directly under the summary, where a reader who just clicked a cell
   is already looking.
4. **The 13×13 grid was silently clipped on a phone.** It scrolls (44px touch
   targets are kept rather than shrunk), but nothing said so, and a table cut off
   mid-cell reads as broken to a beginner. `RangeMatrix` now measures its own
   wrapper with a `ResizeObserver` and shows a cue only when it really overflows
   — a breakpoint rule would be right on one page and a lie on another. E2E pins
   both directions: visible at 390px, absent at 1440px.
5. **The chart shorthand leaked into articles.** `RangeSummary` printed
   `33+,A2s+,K2s+,…` wherever it was used, including inside the lesson that is
   introducing the *concept* of a range. It is now behind `showNotation`,
   defaulting to **off**; the Explorer opts in and backs it with the
   `이 기준은 무엇인가요?` disclosure beside it. This was WP-C's flagged concern,
   and it was live, not hypothetical.

## 4. Known limits

- Only `RFI` × `100BB` × 6-max resolves. Everything else is honestly inert.
- `/tools/range`'s `<main>` is `max-w-[85rem]`, wider than the site's
  `max-w-6xl` header and footer, so the page title sits ~80px left of the
  wordmark above it. This is deliberate — compare mode needs 1240px of content
  width and `max-w-6xl` supplies 1104px — but it is a visible misalignment on the
  flagship page and should be settled by a design pass (WP-L2), not by ad-hoc
  breakout CSS here.
- Every nav link is a full page load: `next/link` does not resolve under this
  app's `nodenext` module resolution (TS2307). Documented in `RouteNavItem`.
