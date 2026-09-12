# WP-O1 (RESPONSIVE QA) + WP-O2 (ACCESSIBILITY)

FishTilt — `apps/fishtilt`. QA-and-fix pass, run as one work package because both halves touch
the same components and two concurrent writers on them would collide.

**Result: everything green.** Monorepo `pnpm test` 3988 passed / 272 files, `pnpm e2e:fishtilt`
193 passed, `pnpm build:fishtilt` 135 static pages, `pnpm typecheck` 0 errors,
`npx eslint apps/fishtilt --max-warnings=0` 0 findings.

---

## 1. Scope

| In | Out |
| --- | --- |
| Page-level horizontal overflow, 7 viewports × 21 surfaces × 2 interaction states | Visual redesign, restyling, colour-system changes |
| Touch targets ≥ 44px at 430 / 390 / 360 | Content (`content/**`, `src/content/**`) — untouched |
| Keyboard, focus, roles, names, labels, ids, `details`/`summary`, popovers, quizzes, matrix, card picker | New runtime dependencies — none added |
| Colour-as-the-only-signal | Performance (WP-O3) |
| `docs/FISHTILT_STATE.md` ruling 65 — the position-abbreviation gloss gap | Reopening ADR-0053 |

### Method (build spec §41 — binding)

No finding in this report came from a downscaled full-page screenshot. Every one was taken
from the DOM in a real Chromium at a real viewport:

| Method | What it measured |
| --- | --- |
| `documentElement.scrollWidth` vs `clientWidth` | page-level horizontal overflow |
| `getBoundingClientRect()` on every control | touch-target size |
| `getComputedStyle()` | display, overflow-x, contrast inputs |
| DOM traversal (`aria-label`, `labels`, `[id]` census) | names, labels, duplicate ids |
| WCAG relative-luminance formula on the token hex values | every contrast number below |
| Cropped element screenshots at the actual viewport (`deviceScaleFactor: 2`) | **only** to confirm a fix renders as intended — never to diagnose |

279 page-states were measured in total (147 initial-load + 132 post-interaction), plus the
19 new Playwright tests that now assert the same rules on every run.

---

## 2. Files changed

### Source (16)

| File | Change |
| --- | --- |
| `apps/fishtilt/src/features/range/copy.ts` | `POSITION_GLOSS`, `positionAccessibleName()`, `positionLegendEntry()`, `handClassAccessibleName()` |
| `apps/fishtilt/src/components/PositionLegend.tsx` | **new** — the one-time abbreviation gloss (ruling 65) |
| `apps/fishtilt/src/components/RangeMatrix.tsx` | cell accessible name now carries the spoken reading |
| `apps/fishtilt/src/components/RangeCompareMatrix.tsx` | non-colour mark on DIFFERS cells + legend swatch; cell reading |
| `apps/fishtilt/src/components/RangeFilters.tsx` | position `aria-label`s, legend, `FilterGroup` footer slot |
| `apps/fishtilt/src/components/RangeMatrixMini.tsx` | position `aria-label`s, legend, glossed grid name |
| `apps/fishtilt/src/components/HomeRangePreview.tsx` | position `aria-label`s, legend, glossed grid name |
| `apps/fishtilt/src/components/RangeExplorer.tsx` | glossed names, legend, `role="tablist"` → `role="group"`, `h-9`→`h-11`, `summary` target |
| `apps/fishtilt/src/components/StartingHandExplorer.tsx` | view toggles `h-9`→`h-11`, slider hit box |
| `apps/fishtilt/src/components/RangeShareLink.tsx` | `h-9`→`h-11` |
| `apps/fishtilt/src/components/SearchEmptyState.tsx` | `h-9`→`h-11` |
| `apps/fishtilt/src/components/CardPicker.tsx` | `useId()` — duplicate-id bug |
| `apps/fishtilt/src/components/RouteNavItem.tsx` | 44px nav target (`min-h-11`, `px-3 -mx-3`) |
| `apps/fishtilt/src/components/SiteHeader.tsx` | wordmark 44px target |
| `apps/fishtilt/src/components/Breadcrumbs.tsx` | crumb links 44px tall |
| `apps/fishtilt/src/components/Term.tsx` | popover footer link + 닫기 button 44px tall |

### Tests (21)

New: `PositionLegend.test.tsx`, `tests/e2e/responsive-a11y.spec.ts`.
Extended: `features/range/copy.test.ts`, `RangeMatrix.test.tsx`, `RangeCompareMatrix.test.tsx`,
`RangeFilters.test.tsx`, `CardPicker.test.tsx`, `tests/e2e/helpers.ts`.
Updated for the new accessible names (no assertion weakened — see §9):
`HandRangeHighlight.test.tsx`, `HomeRangePreview.test.tsx`, `RangeExplorer.test.tsx`,
`RangeMatrixMini.test.tsx`, `RangeQuiz.test.tsx`, `StartingHandExplorer.test.tsx`,
`src/app/page.test.tsx`, `src/app/practice/range-quiz/page.test.tsx`,
`tests/e2e/home.spec.ts`, `tests/e2e/learn.spec.ts`, `tests/e2e/range-explorer.spec.ts`,
`tests/e2e/range-quiz.spec.ts`, `tests/e2e/starting-hand.spec.ts`.

---

## 3. Responsive matrix — surface × viewport

`scrollWidth ≤ clientWidth + 1` on `documentElement`. `OK` = measured, no page-level
horizontal overflow. Nothing in this table came from an image.

| Surface | 1440 | 1280 | 1024 | 768 | 430 | 390 | 360 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` 홈 | OK | OK | OK | OK | OK | OK | OK |
| `/tools/range` | OK | OK | OK | OK | OK | OK | OK |
| `/tools/starting-hand` | OK | OK | OK | OK | OK | OK | OK |
| `/tools/equity` | OK | OK | OK | OK | OK | OK | OK |
| `/tools/pot-odds` | OK | OK | OK | OK | OK | OK | OK |
| `/tools/outs` | OK | OK | OK | OK | OK | OK | OK |
| `/tools/hand-checker` | OK | OK | OK | OK | OK | OK | OK |
| `/tools` | OK | OK | OK | OK | OK | OK | OK |
| `/learn`, `/learn/positions-6max` | OK | OK | OK | OK | OK | OK | OK |
| `/blog`, `/blog/btn-why-wide` | OK | OK | OK | OK | OK | OK | OK |
| `/glossary`, `/glossary/hijack` | OK | OK | OK | OK | OK | OK | OK |
| `/hands` | OK | OK | OK | OK | OK | OK | OK |
| `/search` | OK | OK | OK | OK | OK | OK | OK |
| `/practice` | OK | OK | OK | OK | OK | OK | OK |
| `/practice/range-quiz` | OK | OK | OK | OK | OK | OK | OK |
| `/practice/hand-ranking-quiz` | OK | OK | OK | OK | OK | OK | OK |
| `/practice/starting-hand-quiz` | OK | OK | OK | OK | OK | OK | OK |
| `/about` | OK | OK | OK | OK | OK | OK | OK |

**147 initial-load states: 0 overflowing.**

Interaction states matter more than initial load here — a page that fits empty can still burst
once a grid, a result panel or a compare view appears. Measured at 1440 / 1024 / 768 / 430 /
390 / 360:

| Interaction state | Result |
| --- | --- |
| Home: position pressed + matrix cell selected | OK |
| Range Explorer: compare mode on, both grids + diff grid | OK |
| Range Explorer: methodology `details` open, 링크 복사 pressed | OK |
| Starting Hand: 상위 X% view, 강한 패 순서 view | OK |
| Equity: hero + board cards picked (three card pickers) | OK |
| Hand Checker: hole card picked | OK |
| Pot Odds: all-in checkbox toggled | OK |
| Outs: draws selected | OK |
| Search: result list, and the empty state | OK |
| All three quizzes: started, every question answered, result screen | OK |
| Lesson with an embedded mini matrix, position switched | OK |
| Glossary term popover open | OK |
| Header mobile menu open | OK |
| `/hands/aks`, `/hands`, `/practice`, blog article, about | OK |

**132 post-interaction states: 0 overflowing.**

### The 13×13 matrix, the one real trade

13 columns × 44px cells + gaps is 608px, which cannot fit a 360px screen. Confirmed by DOM
measurement at 360 on `/tools/range`, `/learn/poker-range` and `/`: the wrapper's
`overflow-x` is `auto`, `scroller.scrollWidth > scroller.clientWidth`, **and**
`documentElement.scrollWidth ≤ clientWidth`. The matrix scrolls; the page does not. That
behaviour was already correct and is now pinned by a test.

`globals.css` contains no `overflow-x: hidden` on `html`/`body`, so none of the above is a
clipped-overflow false negative.

---

## 4. Touch-target audit

Threshold 44px, measured with `getBoundingClientRect()` at 430 / 390 / 360.

### Fixed

| Control | Before | After | File |
| --- | --- | --- | --- |
| Header wordmark `FISHTILT` | 106×28 | 106×44 | `SiteHeader.tsx` |
| Header + footer nav links (5 routes, every page) | 24–61 × 20 | ≥48 × 44 | `RouteNavItem.tsx` |
| Header mobile-panel nav items | 20–36 tall | 44 | `RouteNavItem.tsx` |
| Breadcrumb crumb links | 12–52 × 20 | width unchanged × 44 | `Breadcrumbs.tsx` |
| `이 기준은 무엇인가요?` disclosure `summary` | 312×20 | 312×44 | `RangeExplorer.tsx` |
| `다른 위치와 비교` | 118×36 | 118×44 | `RangeExplorer.tsx` |
| Compare view switch (3 buttons, mobile only) | 50–55 × 36 | ×44 | `RangeExplorer.tsx` |
| `링크 복사` | 78×36 | 78×44 | `RangeShareLink.tsx` |
| `상위 X% 보기` / `강한 패 순서` | 94–105 × 36 | ×44 | `StartingHandExplorer.tsx` |
| Top-share slider (`input[type=range]`) | 278×16 | 278×44 | `StartingHandExplorer.tsx` |
| Search empty-state browse chips (5) | 62–78 × 36 | ×44 | `SearchEmptyState.tsx` |
| Term popover `자세히 보기 →` | 81×20 | 81×44 | `Term.tsx` |
| Term popover `닫기` | 50×34 | 50×44 | `Term.tsx` |

Two of these deserve a note because they were done without moving anything visually:

- **nav links** got `px-3 -mx-3`. Korean nav labels are short — `퀴즈` is a 24px-wide box — so
  height alone would not have reached 44. Both nav rows space their items with `gap-6` (24px),
  which the two 12px paddings consume exactly: adjacent targets meet and none overlaps its
  neighbour. The negative margin puts the text back where it was, so nothing moved.
- **the slider** got `h-11`. Height on a range input grows the hit box; the browser keeps
  drawing its track and thumb centred inside it. Confirmed by a cropped screenshot at 390 —
  the control looks identical, with more space around it.

### Not fixed, with reasoning

| Control | Size | Why it stands |
| --- | --- | --- |
| `<Term>` glossary triggers (33.3px tall, ~11 per article) | inline in a sentence | WCAG's explicit **inline** exception. Their height is the paragraph's line box (16px × 1.85). Forcing 44px would make one line's target overlap the next line's — strictly worse. `Term.tsx` already documents `display: inline` as deliberate (an `inline-block` trigger would break a multi-word Korean term onto its own line). |
| Prose links (`13×13 표 읽는 법`, `시작 패 순서 레슨`, ~18–20px) | inline in a sentence | Same exception, same reasoning. |
| Pot-odds all-in checkbox (20×20) | wrapped in `label.min-h-11` | The tap target **is** the label — full row width × 44px. The 20px box is the painted control, not the target. Already correct; no change needed. |
| Breadcrumb crumbs, **width** (`홈` = 12px, `배우기` = 36px) | 44px tall, narrower than 44 | The trail spaces crumbs with `gap-x-2` (8px). Reaching 44px wide needs 16–32px of padding per side, which would make each crumb's target overlap its neighbour's — the exact harm WCAG 2.5.8's spacing rule exists to prevent. Height (the dimension that was actually failing, at 20px, below even the 24px AA floor) is fixed. |

After the fixes, the automated sweep at 430/390/360 reports **zero** sub-44px controls that
are not in one of the four rows above.

---

## 5. Accessibility findings by category

| # | Category | Finding | Status | What changed |
| --- | --- | --- | --- | --- |
| A1 | **Duplicate ids / broken labelling** | `CardPicker` hard-coded `card-picker-suit-<suit>`. `/tools/equity` renders three pickers, `/tools/hand-checker` two — so 4 duplicate ids per extra picker, and every `aria-labelledby` on the 2nd and 3rd picker resolved back to the **first** picker's suit headings. A screen-reader user entering the board picker was told they were in the hero picker's 스페이드 row. | **fixed** | `useId()` namespaces the ids per instance. |
| A2 | **Broken ARIA pattern** | The Range Explorer's mobile compare switch was `role="tablist"` + `role="tab"` with **no `role="tabpanel"` and no `aria-controls`**. Worse, the panels it switches are `hidden lg:block`: at `lg` every panel is visible at once while the switch itself is `lg:hidden`, so nothing is "selected". A tablist promises arrow-key navigation and a selected panel and delivered neither. | **fixed** | `role="group"` + `aria-pressed` — the idiom every other view switch in this app already uses. |
| A3 | **Meaningless control names** | 169 matrix cells announced as `AKs` — three Latin letters read one at a time. Unusable by ear on the site's signature control. | **fixed** | `handClassAccessibleName()` → `"AKs 에이스 킹 수티드, 레인지 포함"`. The visible text is still the bare key (ADR-0053). |
| A4 | **Meaningless control names** | Position buttons announced as `UTG` / `HJ` / `CO` / `BTN` / `SB`. Ruling 65 — see §6. | **fixed** | `positionAccessibleName()` on every position control, on all four surfaces that have one. |
| A5 | **Colour as the only signal** | Compare-matrix SHARED vs DIFFERS. See §7. | **fixed** | Underline on DIFFERS cells + matching mark on the legend swatch. |
| A6 | Touch targets | §4. | **fixed** | 13 control types. |
| A7 | Names present at all | Census of every `a[href]`, `button`, `input`, `select`, `textarea`, `[role=button]` on 21 surfaces × 7 viewports, plus interaction states. | **pass, 0 findings** | Every control already had a name. Now asserted every run. |
| A8 | Form labels | Every `input`/`select`/`textarea` on every surface has a `<label>`, `aria-label` or `aria-labelledby`. | **pass** | — |
| A9 | Images / SVG | Every `<svg>` is `aria-hidden="true"` or role+name. No `<img>` without `alt`. | **pass** | — |
| A10 | Heading structure | Exactly one `<h1>` per page; no skipped levels on any of 23 pages. | **pass** | — |
| A11 | Landmarks / language | `<header>`, `<main>`, `<footer>`, `<nav aria-label>` everywhere; `<html lang="ko">` on all 23. | **pass** | — |
| A12 | Keyboard | No positive `tabindex` anywhere. Matrix cells, card cells, quiz answers, filters are real `<button>`s (Tab/Enter/Space native). Disabled states are DOM-`disabled`, so they leave the tab order. Quiz focus moves to the new question heading (`tabIndex={-1}` + `focus()`), and to the result heading. The mobile nav panel is conditionally **rendered**, so a closed menu has no tabbable nodes. | **pass** | — |
| A13 | Tooltips / disclosure | `<Term>` uses the native Popover API: light dismiss, Escape, top-layer, expanded state on the invoker, no JS. `<details>`/`<summary>` is native. Neither is hover-only. | **pass** (target size fixed in §4) | — |
| A14 | Live regions | Homepage preview, pot-odds, equity, outs, hand-checker and quiz feedback announce through `role="status" aria-live="polite"`, wrapping the **answer** and never the 169-cell grid. | **pass** | — |
| A15 | Card picker | 52 real buttons, `aria-pressed`, `disabled`, names like `A♠ 선택` / `Q♠ 사용됨`, suit rows grouped and labelled, all ≥44×44. | **pass** (id bug in A1) | — |
| A16 | Quizzes | Right/wrong carries a word (`정답이에요`/`아쉬워요`), a glyph (`○`/`×`) and a live region — never colour alone. Answering is one-shot via real `disabled`. | **pass** | — |

---

## 6. Ruling 65 — the position labels

**What was wrong.** `POSITION_LABEL` is an identity map, so `UTG` `HJ` `CO` `BTN` `SB` `BB`
rendered as bare button labels with no explanation anywhere near the control — on the Range
Explorer, the homepage preview, the range quiz and every lesson that embeds a matrix. A
beginner meeting the chart without having read `positions-6max.mdx` had no way to find out
what the five buttons meant, and a screen reader announced them letter by letter.

**What was NOT done.** ADR-0053 is accepted and is not reopened. The abbreviations are
unchanged, untranslated, and still what every control displays. §48 explicitly does not ask
for the English to be removed.

**What was done — both halves of the fix, once, in shared components.**

| Half | Mechanism | Where |
| --- | --- | --- |
| Visible | `PositionLegend` renders `UTG 언더더건 · HJ 하이잭 · CO 컷오프 · BTN 버튼 · SB 스몰 블라인드 · BB 빅 블라인드` directly under the button row, glossing **only** the positions that row actually offers | `PositionLegend.tsx`, mounted inside `RangeFilters`, `RangeMatrixMini`, `HomeRangePreview` and the Explorer's compare picker |
| Announced | `aria-label={positionAccessibleName(p)}` on every position button, and on every matrix's own group name | `copy.ts` + the four call sites |

**Why a legend rather than a glossed label on each button.** Putting `언더더건(UTG)` on the
button itself repeats the same six words on every press target on every surface, roughly
triples the width of a six-button row that has to survive a 360px screen, and prints the gloss
five times on a lesson page whose paragraph above already explains it. The legend states each
pairing exactly once, next to the control it explains.

**Why the legend is `aria-hidden`.** Every button already announces its own gloss. Without
`aria-hidden` a screen-reader user would hear the whole table of abbreviations as one run-on
paragraph *in addition to* hearing each button say what it is.

**Glosses.** Taken from the glossary entries the site already publishes
(`src/content/registry/glossary/j1.ts`: `하이잭 (HJ)`, `컷오프 (CO)`, `버튼 (BTN)`,
`스몰 블라인드 (SB)`, `빅 블라인드 (BB)`), so a reader who follows the term through to
`/glossary` meets the same word. `UTG` is glossed `언더더건` rather than the glossary title's
descriptive `첫 번째 자리`, because that is the reading the lessons and articles use in running
text and the one heard at a table. No new Korean was invented.

### What a screen reader now says

| Control | Before | After |
| --- | --- | --- |
| Range Explorer 내 위치 button | "U T G, toggle button" | **"언더더건(UTG) 자리, 선택 안 됨, 버튼"** |
| Homepage preview button | "B T N" | **"버튼(BTN) 자리, 선택됨, 버튼"** |
| Lesson mini-matrix toggle | "U T G" | **"언더더건(UTG) 자리"** |
| The 13×13 grid itself | "BTN 자리의 학습용 기본 레인지 표, 그룹" | **"버튼(BTN) 자리의 학습용 기본 레인지 표, 그룹"** |
| A matrix cell | "A K s" | **"AKs 에이스 킹 수티드, 레인지 포함, 선택 안 됨, 버튼"** |
| A compare-matrix cell | "53s, BTN에만 포함" | **"53s 파이브 쓰리 수티드, 버튼(BTN) 자리에만 포함"** |

---

## 7. Colour-only information

| Where | Carried by colour | Non-colour carrier | Verdict |
| --- | --- | --- | --- |
| Compare matrix: SHARED vs DIFFERS | `act-raise-500` vs `act-call-500` | **was: none** | **FIXED** |
| Range matrix: in-range vs out-of-range | `act-raise-500` vs `act-fold-500` | greyscale separation 2.79:1, ink flips dark↔light, font weight differs, accessible name says it in words, legend in words | pass |
| Range matrix: selected cell | `brand-600` | `aria-pressed`, ink flips to `text-100`, brand red appears nowhere else on the grid, legend entry | pass |
| Quiz right/wrong | `act-call-500` vs `brand-500` border | `○`/`×` glyph, `정답이에요`/`아쉬워요`, `role="status"` | pass |
| Filters: not-yet-shipped spot/stack | opacity | visible `준비 중` badge, real `disabled`, `aria-label` says `(준비 중)` | pass |
| Filters: selected value | brand fill | `aria-pressed` | pass |
| `SelectedHandPanel` membership | `text-act-raise-500` vs `text-text-300` | the sentence itself (`지금 보고 있는 레인지에 포함되어 있어요`) | pass |
| Playing-card suits | `suit-red-500` vs `text-100` | the suit glyph, and the accessible name (`A♠ 선택`) | pass |
| `RangeShareLink` copied confirmation | `text-act-raise-500` | the sentence `링크를 복사했습니다.` in `role="status"` | pass |

**The one real finding.** `act-raise-500` (#e4572e, relative luminance **0.235**) and
`act-call-500` (#2ba3a3, **0.294**) are far apart in hue and almost identical in lightness — a
**1.21:1** greyscale separation. Both cells also carried the same `ground-900` ink, so the ink
could not separate them the way it separates NEITHER (light ink) or the selected cell. With
colour removed — a monochrome display, greyscale mode, achromatopsia — "in both ranges" and
"in one range only" were the same grey square. Colour was the only carrier.

**Fix:** DIFFERS cells are now **underlined** (`underline decoration-2 underline-offset-2`),
and the legend's DIFFERS swatch carries the same bar so the key explains the shape and not
only the colour, reading `한쪽 레인지에만 포함되는 핸드 (밑줄)`. The underline is drawn in the
cell's existing text colour, so it inherits that pairing's already-audited contrast and
introduces no new colour. Confirmed visually on a cropped 1280 screenshot of the diff view.

---

## 8. Contrast measurements

Only two things changed that carry ink; no new colour token was introduced. WCAG
relative-luminance formula, on the token hex values in `globals.css`, same method that file's
own audit uses.

| Pairing | Where | Ratio | Verdict |
| --- | --- | --- | --- |
| `text-300` #969da8 on `ground-900` #090a0d | position legend on the Explorer / homepage | **7.24:1** | PASS AA body (4.5) |
| `text-300` on `ground-800` #0e1014 | position legend inside a lesson's `RangeMatrixMini` card | **6.97:1** | PASS AA body |
| `text-300` on `panel-700` #13161b | legend on a panel ground | **6.63:1** | PASS AA body |
| `ground-900` underline on `act-call-500` #2ba3a3 | the new DIFFERS mark | **6.48:1** | PASS (same value the file already documents for that text pairing) |
| `ground-900` on `act-raise-500` #e4572e | SHARED cells, unchanged | 5.37:1 | PASS |

The legend is 12px (`text-xs`), which is body text under WCAG, so 4.5:1 is the bar it has to
clear — 6.63:1 is the worst case measured. The `·` separator inherits `text-300` rather than
the quieter `text-500` (3.74:1 on ground-900, large/UI only) precisely so no part of the legend
sits below body contrast.

---

## 9. Tests added

**Nothing was weakened or deleted.** Twelve unit assertions and twelve e2e locators that
matched the *old* accessible names were updated to the new ones — the names improved, so the
expectation moved with them. Where an assertion previously named a literal, it now composes
the name from the same shared copy function the component uses, so it states the rule instead
of the string (ruling 26).

### New: `tests/e2e/responsive-a11y.spec.ts` — 19 tests

| Test | Rule asserted | Would have caught |
| --- | --- | --- |
| `no page-level horizontal overflow at {1440,1280,1024,768,430,390,360}px` (7) | `documentElement.scrollWidth ≤ clientWidth + 1` on 15 surfaces | any future page overflow at any of the seven widths |
| `the matrix scrolls inside its own wrapper on {/tools/range,/learn/poker-range,/}` (3) | wrapper `overflow-x: auto` **and** `scrollWidth > clientWidth` **and** the page does not scroll | someone "fixing" the matrix by letting the page scroll, or by shrinking cells below the touch target |
| `every standalone control is at least 44px tall at {430,390,360}px` (3) | every control on 15 surfaces, minus two **structural** exclusions | every touch-target regression in §4 |
| `every interactive control on every surface has an accessible name` | name census | an unlabelled icon button |
| `no element id appears twice on a page` | id census on 15 surfaces | **the `CardPicker` duplicate-id bug (A1) exactly** |
| `every one of the 169 cells announces its key and a Korean reading` | name starts with the visible key, then contains Hangul | a cell falling back to the bare key |
| `position buttons on {/tools/range,/,/learn/poker-range} announce the Korean name` (3) | visible text is `^[A-Z]{2,3}$` (ADR-0053 holds), accessible name contains the abbreviation **and** Hangul, **and** the same gloss is visible in the control's own block | ruling 65 recurring, in either half |

Two notes on how those exclusions are written, because an allowlist would have rotted:

- `display: inline` cannot be the inline test — a browser blockifies `display: inline` on a
  `<button>` to `inline-block`, so `Term`'s deliberately-inline trigger reports as
  `inline-block`. The spec instead asks whether the control's own block container holds text in
  the **same inline formatting context** that is not itself inside a control. A row of filter
  buttons has none and stays in scope; a sentence with a glossary word in it has plenty.
  Verified against every currently-passing control: the `summary`, the share button, the nav
  links and the position buttons all stay in scope.
- a control inside a `<label>` is measured on the label, because that is what a finger hits.

### New: `PositionLegend.test.tsx` — 5 tests

Glosses only the positions offered; covers all six when all six are offered (written over
`STRATEGY_POSITIONS`, so a seventh seat cannot ship unglossed); keeps the abbreviation visible;
is `aria-hidden`; renders nothing rather than an empty line for an empty list.

### Extended

| File | Added |
| --- | --- |
| `features/range/copy.test.ts` | 6 — every position glossed, gloss ≠ abbreviation, accessible name contains **both**, §48's `언더더건(UTG) 자리` shape, legend entry shape, `handClassAccessibleName` over all 169 classes |
| `RangeMatrix.test.tsx` | 1 — every one of the 169 cells starts with its key and then carries Hangul (over `HAND_CLASSES`, not one cell) |
| `RangeCompareMatrix.test.tsx` | 1 — SHARED and DIFFERS differ in a **non-colour** mark, and DIFFERS' mark is non-empty (asserted as "the two class sets differ in a typographic token", not "class X is present") |
| `RangeFilters.test.tsx` | 2 — every position shows the abbreviation and announces the gloss; every offered abbreviation appears once in a visible legend |
| `CardPicker.test.tsx` | 1 — two pickers on one page share no id, and every `aria-labelledby` resolves inside its **own** picker |

Net: **+16 unit tests, +19 e2e tests.**

---

## 10. Gate results

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | **0 errors**, 13 projects |
| Lint | `npx eslint apps/fishtilt --max-warnings=0` | **0 findings** |
| Unit (fishtilt) | `pnpm vitest run --project fishtilt` | **1251 passed**, 113 files (from 1235 / 112) |
| Unit (monorepo) | `pnpm test` | **3988 passed**, 3 skipped, 271 files passed / 1 skipped (from 3972) |
| Build | `pnpm build:fishtilt` | **135 static pages**, exit 0, no warnings |
| E2E | `pnpm e2e:fishtilt` | **193 passed**, 0 failed (from 174) |

The 1 skipped test file is `apps/web/src/server/analysis-performance.test.ts` — pre-existing,
untouched by this WP.

Nothing was failing when this WP started, and nothing is failing now.

---

## 11. Found but not fixed

| # | Finding | Why not, and what would be needed |
| --- | --- | --- |
| 1 | `<Term>` triggers and prose links are 18–36px tall. | WCAG's inline exception (§4). Enlarging them would overlap adjacent lines' targets and change every article's rhythm — a typography decision outside a QA-and-fix boundary. |
| 2 | Breadcrumb crumbs are 44px tall but 12–52px **wide**. | Reaching 44px wide needs padding that would overlap the neighbouring crumb's target through the 8px `gap-x-2` (§4). Fixing it properly means widening the trail's spacing — a layout decision, and the height (the part that failed even the 24px AA floor) is done. |
| 3 | Card-picker names use the suit glyph: `A♠ 선택`. Screen readers announce `♠` by its Unicode name ("black spade suit"), i.e. in English, mid-Korean-sentence. `CardPicker` already holds `SUIT_KOREAN` (`스페이드`), so `스페이드 A 선택` is one line away. | It is a **naming/copy** decision, not a defect — the control does have a name. Changing it rewrites ~20 e2e locators across `equity.spec.ts` and `hand-checker.spec.ts`, which is churn a reviewer should approve rather than a QA agent absorb. Recommended for WP-Q. |
| 4 | `RangeMatrixMini` renders `<section aria-label=…>` (a `region` landmark) per embedded chart. A lesson with several charts produces several same-named landmarks. | Not currently harmful (each is uniquely named by its `caption`), and changing landmark structure across 15 lessons is a content-shaped decision. Reported only. |
| 5 | The Explorer's compare panels are `hidden lg:block`, so at `lg` all three render simultaneously and the mobile switch disappears. The ARIA is now honest about this (§5 A2), but the underlying layout still means "the switch controls nothing at desktop". | Working as designed and visually correct; making the panels genuinely mutually exclusive at every width is a layout change, not an a11y fix. |
| 6 | `text-500` (#656c77) is used for the breadcrumb `›` separator — 3.74:1 on `ground-900`, below body contrast. | It is `aria-hidden` decorative punctuation and `globals.css` already documents the token as large/UI-only. Left as the existing, documented pattern; the new legend deliberately does **not** use it. |
