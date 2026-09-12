# WP-S3-19 — UX remediation of review B (B-M1 … B-M5)

## Objective

Fix exactly the five accepted findings of `WP_S3_18_REVIEW_B.md`, presentation only. No SEO, no
metadata/JSON-LD, no MDX, no `src/content/registry/**`, no range/tool calculation logic.

## Facts verified before work

- B-M1 root cause confirmed: `ContentThumbnail` keyed the scene on `(kind, topic)`; four of six
  published hand stories carry `topic: 'hand-strength'` (`registry/blog/stories/s1,s3.ts`).
- B-M2: `PRIMARY_NAV_IDS` is pinned to six by `routes.test.ts` (`not.toContain('hands'|'about')`);
  the desktop bar rendered only that nav; `MOBILE_MORE_IDS = ['search','hands','about']`.
- B-M3: the five `준비 중` controls came from `RangeFilters` (상황 ×2, 스택 ×3), used by
  `RangeExplorer` (`groups='ALL'`) and `RangeQuiz` (`'POSITION'` + `'CONDITIONS'`).
- B-M4: lesson tail = `RelatedContent` (5 groups, `h2` at `text-h2`) then `LessonNav`; article tail
  = related aside → tool `CtaBand` → `NextRead`. `RelatedContent` always used `sm:grid-cols-2`.
- B-M5: the reviewer's screenshots (21:35–21:39) predate the current `DataTable.tsx` (21:40). In
  the current code the visible caption already sat outside `[data-scroller]` but INSIDE
  `.table-scroll`, whose `::after` fade (opacity 1 while the table can scroll) paints over the
  right 2.5rem of the whole box — caption lines included.

## Decisions made

1. **B-M1** — new optional `variant?: string` on `ContentThumbnail` and `EditorialFallback`; the five
   callers pass `record.id`. `sceneVariant(topic, variant)` (exported) is FNV-1a over `topic:id`,
   rotated by one byte, read as suit (4) × placement (3: corner/left/high) × scale (2) × light side
   (2) = 48 scenes. The DRAWING never changes with the variant; no variant ⇒ the exact previous
   composition. The rotation was chosen so the four `hand-strength` stories take four different
   suits (pinned by test against the registry). `data-variant` on the root.
2. **B-M2** — a second landmark `nav[aria-label="보조 메뉴"]` (핸드 목록 · 소개) after the six,
   `hidden lg:flex`, smaller/muted ink, current-marking via the existing `currentMoreId`.
   `PRIMARY_NAV_IDS` untouched. Between `md` and `lg` (768–1023) the two stay footer-only as
   before — the bar has no room for eight labels there (measured: no overflow at 1024 or 768).
3. **B-M3** — `RangeFilters` conditions block is now one `section[aria-label="조건"]`: "지금은
   **6인 · 100BB · 아무도 참여하지 않았을 때 (First In)** 한 가지 상황만 다룹니다." (via
   `describeRangeConditions`), a 3-cell `<dl>` (상황/스택/테이블), and
   `unsupportedConditionsSentence()` built from `RANGE_SPOTS`/`RANGE_STACK_DEPTHS` ("… 상황과
   40BB · 60BB · 150BB+ 스택은 아직 지원하지 않습니다."). Zero disabled buttons. Props API unchanged
   (`onSpotChange`/`onStackDepthChange` kept in the type, no longer destructured). Same block on
   `/practice/range-quiz` through the existing `groups="CONDITIONS"`.
4. **B-M4** — `NextRead` gains `emphasis="next"`: the next piece as one full-width raised panel
   (`bg-ground-800`, `text-xl sm:text-2xl`, arrow), the previous piece as a one-line "이전 · …"
   under it; landmark name, `data-direction` hooks and the 준비 중 rule unchanged. `LessonNav`
   uses it and the lesson page now renders it BEFORE `RelatedContent`; `BlogArticleFooter`
   renders it first, then the related aside, then the tool band. `RelatedContent`: `sm:grid-cols-2`
   only when a group has ≥ 2 links (`data-columns`), new `dense` prop (headings at the `h3` size
   without changing level — `SectionHeading` gained a `size` override) used on the lesson tail.
   `RELATED_LABELS` and relation data untouched.
5. **B-M5** — `DataTable`: the visible caption (`[data-table-caption]`, `min-w-0 max-w-full`) now
   sits outside a new inner `.table-scroll` box; the fade can only cover the scroller.

## Files changed (28)

Components (16): `apps/fishtilt/src/components/ContentThumbnail.tsx`, `EditorialImage.tsx`,
`SiteHeader.tsx`, `RangeFilters.tsx` (rewritten whole — see Known limitations), `RangeQuiz.tsx`
(copy + doc), `NextRead.tsx`, `RelatedContent.tsx`, `SectionHeading.tsx`, `DataTable.tsx`,
`learn/LessonNav.tsx`, `blog/BlogArticleFooter.tsx`, `blog/BlogHubSections.tsx`,
`blog/StoryArticleLayout.tsx`, `blog/GuideArticleLayout.tsx`, `home/HomeStories.tsx`,
`apps/fishtilt/src/app/[locale]/learn/[slug]/page.tsx`.

Tests (12): `ContentThumbnail.test.tsx` (+5), `EditorialImage.test.tsx` (+1), `SiteHeader.test.tsx`
(+1, 1 rewritten), `RangeFilters.test.tsx` (4 replaced by 3), `RangeQuiz.test.tsx` (1 rewritten),
`RangeExplorer.test.tsx` (3 assertions), `app/[locale]/practice/range-quiz/page.test.tsx` (1),
`NextRead.test.tsx` (+2), `RelatedContent.test.tsx` (+2), `DataTable.test.tsx` (1 rewritten, +1),
`tests/e2e/range-explorer.spec.ts` (1 rewritten), `tests/e2e/responsive-a11y.spec.ts` (+caption
assertion inside the existing 320/360 table test).

Updated-on-purpose assertions (rule 11): every test that pinned the five disabled `준비 중` buttons
(`RangeFilters`, `RangeQuiz`, range-quiz page, range-explorer e2e) now pins the scope statement
and asserts NO disabled button; `SiteHeader` "/about marks nothing" → "/about marks only the
secondary 소개"; `DataTable` wrapper assertion → `.table-scroll > [data-scroller]` exists and the
caption is outside `.table-scroll`; `RangeExplorer` "100BB button pressed" → conditions region.

## Tests run

- `pnpm vitest run --project fishtilt` on all touched component tests + every `page.test`:
  21 files, 253 tests PASS (after one self-inflicted NextRead assertion fix).
- `pnpm --filter @gto-self/fishtilt typecheck`: PASS. `pnpm exec eslint` on all 28 files: clean.
- e2e (targeted, under build-lock): `range-explorer.spec.ts -g 'unsupported situation'` PASS;
  `responsive-a11y.spec.ts -g '넓은 표'` (320 + 360, with the new caption assertion) PASS.

## Build/runtime evidence

- One `pnpm build` under `build-lock.sh`: BUILD_RC=0 (`artifacts/3bettilt-stage3-visual-qa/wp19/build.log`).
- Screenshots (36, all `overflowX: 0`): `artifacts/3bettilt-stage3-visual-qa/wp19/` for `/ko/blog`,
  `/ko/blog/aa-loses`, `/ko/tools/range`, `/ko/learn/positions-6max`, `/ko/blog/aks-vs-ako`, `/ko`
  at 1440/390/320 × dark/light; crops of the changed regions in `wp19/crops/`. Looked at: hub story
  rows (six different scenes; featured hero = its own card), home featured story, story hero, range
  tool 1440 dark + 390 light, header 1440, lesson tail 1440 light/dark + 390, article tail 1440,
  table at 320 dark + light.
- DOM probe (`wp19/caption-probe.json`): positions-6max caption at 320 → outside fade, no
  overflow, right edge 296/320, 3 lines; at 390 → 366/390, 2 lines. Header at 1440: 주요 메뉴 six
  unmarked on /about, 보조 메뉴 = [핸드 목록, 소개*]; 1024: secondary visible, no overflow; 768:
  hidden, no overflow.

## Known limitations

- `RangeFilters.tsx` was rewritten in full after a scripted edit corrupted it (an empty-needle
  `str.replace`). It was reconstructed from the full read taken minutes earlier; every prior test
  of the position group still passes, but it deserves one glance in the final review.
- `준비 중` still appears on other pages (planned content cards, LinkCard/RouteNavItem) — out of
  scope; B-M3 named only the range tool form.
- The FAQ answer on `/ko` says the same scope in slightly different words; not unified (SEO/FAQ
  copy is outside this WP).

## Open issues

- None requiring another agent's file. If the orchestrator wants 핸드 목록/소개 visible at
  768–1023 too, the honest route is a header breakpoint change (`md:hidden` hamburger → `lg`),
  which touches the mobile contract AE and its e2e — not done here.

## Exact facts next agent may rely on

- `ContentThumbnail`/`EditorialFallback` accept `variant?: string`; `sceneVariant()` is pure;
  without `variant` output is byte-identical to before.
- `nav[aria-label="보조 메뉴"]` exists from `lg`; `DESKTOP_SECONDARY_IDS = ['hands','about']`.
- `/tools/range` and `/practice/range-quiz` render `section[aria-label="조건"]` and NO disabled
  button; `unsupportedConditionsSentence()` is exported from `RangeFilters.tsx`.
- `NextRead` with `emphasis="next"` sets `data-emphasis="next"` on the `<nav>`.
- `DataTable` root is `[data-table]`; visible caption `[data-table-caption]` is never inside
  `.table-scroll`; the e2e selector `.table-scroll > [data-scroller]` still matches.

## Facts next agent MUST re-check

- Full e2e suite was NOT run (orchestrator's final gate). Specs that count `header nav` landmarks
  or links on desktop may need the extra `보조 메뉴` nav (it is named, so the a11y "every nav is
  named" rule holds).
- `.next/` on disk is this WP's build; another agent may rebuild at any time.
