# FishTilt — project state

Where the FishTilt build actually is. The equivalent of `docs/STATE.md` for this work
stream, kept separate because `docs/STATE.md` tracks the GTO-SELF training tool and is
currently being edited by another session (build spec §80 permits an equivalent document).

**Last updated: 2026-09-08, at the opening of Stage 2 (design · SEO · blog · visual upgrade).**

## What FishTilt is

A public, Korean-language, beginner-first Texas Hold'em learning site: read → see → touch
→ try → quiz → understand. Free tools (13×13 range explorer, equity, pot odds, outs, hand
checker), a learn curriculum, a glossary and quizzes, all cross-linked.

It shares this repository with GTO-SELF and reuses its poker mathematics. It shares nothing
else: no database, no login, no player data, no hand histories, and no affiliate or casino
surface of any kind.

## Where it lives

| Path | What |
| --- | --- |
| `apps/fishtilt` | The site. Next 16 App Router, dev 3220, e2e 3221. |
| `packages/learn-core` | Beginner-education domain: pot odds, outs, exact equity, hand facts. |
| `packages/strategy-core` | **Read-only.** Evaluator, equity engine, 169 classes, RFI ranges. |
| `docs/reports/FISHTILT_*` | Audit, per-WP reports, final report. |


## Stage 2 execution graph (opened 2026-09-08)

Driven by the Stage-2 orchestration prompt at `./prompt` — a design, SEO, blog and visual
upgrade on top of the shipped MVP. The MVP itself is unchanged and stays the floor: nothing
in Stage 2 may lower a correctness, honesty or accessibility guarantee the MVP established.

**Baseline at Stage-2 open, measured on the frozen source (2026-09-08):**
`pnpm vitest run --project fishtilt --project learn-core` → **129 files, 1461 tests, 0 failures**
(12.2 s). 131 pages (18 static routes + 113 content records, all `PUBLISHED`). 130 sitemap
URLs. E2E surface: 21 spec files, ~170 `test()` declarations.

| WP | Scope | Status |
| --- | --- | --- |
| WP-1 | Audit, information architecture, per-page keyword map | **done** — `docs/reports/FISHTILT_WP1_AUDIT_AND_KEYWORD_MAP.md`, 634 lines; 20 cannibalisation conflicts resolved with 0 new pages; every `file:line` claim re-verified by MASTER |
| WP-2 | Design system, dark/light theme, shared layout, header | **done** — `docs/reports/FISHTILT_WP2_DESIGN_SYSTEM.md`; 7 new + 24 modified files, unit 1461 → 1572, e2e 211 → 226, 131 pages still static. WP-2b **done**: bridge CSS rule deleted, `--color-brand-hover` closes the 3.60:1 hover gap (dark 4.68:1 / light 6.02:1), `apple-icon.png` 180x180 rendered through Playwright. Unit 1580, e2e 229. WP-2b found an 18th ink call site that className grep could not reach (`OutsCalculator.tsx:284` is a *descendant* of the fill, not the fill) |
| WP-3 | Homepage redesign | **done** — `docs/reports/FISHTILT_WP3_HOME_REDESIGN.md`; 9 sections -> 8, hero gained a real visual drawn from live range data (**WP-3 added no image file** — the hero is DOM), site-level FAQ added, `HomeLinkCard` deleted. WP-3b fixed a 293px -> 80px hero void (`lg:items-center` -> `lg:items-start`). Unit 1600, e2e 238, 131 pages static |
| WP-4 | Tool UX refinement, six calculators | **done** — `docs/reports/FISHTILT_WP4_TOOL_UX.md`; 8 new + 29 modified, all six tools now 히어로 → 도구 → FAQ → 레슨 → 다음 도구. Found and fixed an unreported M8-class regression: on mobile the range/starting-hand detail panel landed at 1154px/1491px — entirely offscreen — after tapping a cell. Unit 1643, e2e 240 |
| WP-5 | Blog, thumbnails, hero-image system | **done, MASTER-verified** — `docs/reports/FISHTILT_WP5_BLOG_AND_IMAGE_SYSTEM.md`; 12 new + 13 modified, **WP-5 added no image file**. Thumbnails are generated per `topic`x`kind` at **7-12 DOM nodes each**; `/blog` `<main>` 110 -> 385 nodes, page 4,685px. Unit 1697, e2e 253. MASTER re-verified against the `after-wp4` snapshot: the changed set is exactly the report's scope, `src/content/types.ts` is byte-identical (rulings 105 and 114 held — no record gained a date or an image field), and nothing outside `apps/fishtilt` was touched. Its one claim MASTER could not find at first — a new bidirectional allow-list check — is real, at `src/components/Figure.test.tsx:72`, and **mutation-tested**: inserting a bogus name into `MDX_COMPONENT_ALLOW_LIST` fails it (`expected [...] to deeply equal [ 'Bogus', ... ]`), so it is a check and not a tautology. Restored |
| WP-6 | Content visual / image asset plan (document) | **done** — `docs/reports/FISHTILT_WP6_VISUAL_ASSET_PLAN.md`, **1,007 lines** (I first logged it at 412 — that was an interim draft; the agent kept working and its conclusions changed, which is why ruling 118 carries an amendment). MASTER re-verified: `diff -rq` against the `after-wp5` snapshot shows only `src/lib/seo/breadcrumbs.ts`, which is WP-7a in flight — so WP-6's document-only boundary held exactly. All nine mandated `##` headings present and in order. Delivered a per-page-type visual guide, a 5-item prioritised figure backlog, an OG pipeline spec, and a reasoned **refusal** to introduce AI-generated imagery. Its one open unknown (`next/image` resolvability) MASTER closed himself — ruling 117 |
| WP-7a | SEO mechanism: metadata, JSON-LD, breadcrumbs, FAQ emission | **done** (by `gto-self-60`, ruling 122) — `docs/reports/FISHTILT_WP7A_SEO_AND_SCHEMA.md`, 451 lines, written by the implementing agent. 3 new files (all tests) + 38 modified, **0 outside the boundary**: `content/`, `routes.ts`, `features/**`, `public/`, `globals.css` all untouched, diffed against the `after-wp5` snapshot. Unit 1697 -> **1800** (146 files), e2e 253 -> **260**, typecheck 13/13, lint clean, **131 pages still all static**. `after-wp7a` snapshot taken at `scratchpad/after-wp7a/fishtilt`. Every figure re-measured by `gto-self-60` on the built output rather than taken from the report — see the verification block below |
| WP-7b | SEO content: link graph, lesson figures, FAQ integrity | **done, MASTER-verified** — `docs/reports/FISHTILT_WP7B_SEO_CONTENT.md`; 10 modified, 0 new, boundary exact (it did not touch `src/app/page.tsx` even to fix a defect it found there). Orphan glossary terms 6 -> 3; `poker-actions` `relatedArticles` filled so 0 of 15 lessons are empty; WP-1's unimplemented C16 landed on `hand-77/88/99`; `<Figure>` reaches the teaching surface for the first time (`learn/pot-odds`, `learn/outs`, 0 new code); the non-question FAQ entry and two dead tool names fixed. Unit 1800 -> **1803** (+3 guards), e2e 260, 133 HTML all static. I re-measured the FAQ from the built output: **115 questions, 0 non-questions, 0 markdown leaks, 0 unseen on page, 0 parse failures** |
| WP-8 | Final QA — UX, SEO, visual, responsive | **done, by MASTER directly** — `docs/reports/FISHTILT_WP8_FINAL_QA.md`. Two subagents stopped with no completion record (0 files changed each), and CLAUDE.md §1 makes 최종 검증·최종 판정 the main agent's role, so I ran it myself. Closed both outstanding defects: the homepage's dead composed tool name, and ruling 120's split reading column. Added two mutation-tested guards. **Source frozen.** Full suite **4428 passed / 3 skipped**; fishtilt+learn-core **1805**; e2e **260**; 133 HTML all static; typecheck + lint clean. Verified from the built output: dead name 0, `--container-reading:42rem` shipped, all five long-form templates measure 672px, FAQ 115/115 on-page, forbidden fields 0, broken internal links 0, no horizontal scroll in 30 viewport×route combinations |
| REVIEW | Independent review by `gto-self-60` (ruling 125) | requested at source freeze; briefed only as "find release blockers and honesty problems", with no fix list |
| FINAL | `docs/reports/FISHTILT_STAGE2_MASTER_SUMMARY.md` | last |

### Facts every later Stage-2 WP inherits from WP-2

- **Colour tokens keep their names and gain light values.** Roles, not lightnesses:
  `ground-900` page, `ground-800` recessed, `panel-700` card, `panel-600` nested/floating,
  `line-500` the only border, `text-100/300/500` inks, `brand-500` brand *ink*, `brand-600`
  brand *fill*. Three new: `ink-on-action`, `ink-on-brand`, `scrim-900`. Never write a raw
  colour; `theme-tokens.test.ts` guards the palette's contrast in both themes.
- **`text-500` is UI-only and must not carry body prose** in either theme.
- **The real cause of the "flat" look was measured, not guessed:** `panel-700` sat at
  1.06:1 against `ground-900`, so a card was a border rather than a surface. Now 1.15:1
  dark / 1.10:1 light, with a 1.08:1 floor asserted in both themes.
- **Line height is a token now** (`1.8` for Korean body), so no WP writes `leading-[1.8]`
  by hand again. Type *sizes* stay on Tailwind's default scale — the problem was leading.
- **Four container widths** (WP-2 shipped three; ruling 113 added the fourth):
  `--container-reading` 48rem (prose, ~48 Korean chars/line), `--container-grid` 56rem (card
  grids, tables), `--container-shell` 72rem (header/footer), `--container-matrix` 85rem (the
  one measured exception: Compare mode on `/tools/range` needs 1240px). A page picks one of
  the four; it does not invent a fifth as a `max-w-[…]` literal.
- **One shadow only** (`--shadow-raised`), reserved for things genuinely floating above the
  page. Depth is carried by surface and border, because shadows barely read on dark.
- **`LinkCard` is the single card.** `HomeLinkCard` is now an alias for it and is WP-3's to
  delete. No WP writes hub-card markup by hand again.
- **Theme is client-only and flash-free:** an inline `<head>` script stamps `data-theme`
  only for an *explicit* stored choice, so an untouched visitor still follows
  `prefers-color-scheme`. Every page stays statically prerendered; no WP may add
  `export const dynamic`.
- **The header is six**: 배우기 · 핸드레인지 · 무료 도구 · 퀴즈 · 블로그 · 포커 용어, plus
  search and the theme toggle. `hands` and `about` stay footer-only.


### The site's complete image inventory — three files, and the final summary must say so

Several WP rows are written as "0 image files", which is true of **those work packages** and false
of the site. Both orchestrators nearly let it travel into the final summary as "FishTilt has no
images", which would be a plain untruth. The whole inventory, verified by a filesystem sweep for
every raster and vector extension under `src/` and `public/`:

| File | Size | Origin |
| --- | --- | --- |
| `public/og.png` | 7,003 B | **Pre-Stage-2** (Sep 5). Real `PNG 1200x630`, wired through `OG_IMAGE_PATH` and already asserted by `tests/e2e/seo.spec.ts` |
| `src/app/icon.svg` | 606 B | Stage 2 |
| `src/app/apple-icon.png` | 1,542 B | Stage 2, WP-2b — rasterised through Playwright chromium, `180x180` |

So: **Stage 2 added two icons and no content imagery**, and every figure, thumbnail and hero on
the site is DOM or SVG drawn from domain data. That is the accurate claim, it is a stronger one
than "no images", and it is the sentence the final summary should carry.

### WP-7a as shipped — pass 1, measured by its own orchestrator (`gto-self-60`, ~23:15)

Not copied from the WP-7a report: `gto-self-60` re-ran every gate and re-counted every figure
against `.next/server/app` after its agent finished, per the Stage-2 prompt's line 506. **This is
the implementer's side of the check**; the section below it is mine, taken independently and
without reading this one first. The two agree on every figure they both measured, and each caught
things the other did not — which is the argument for doing it twice rather than once.

| check | result |
| --- | --- |
| file boundary | 3 new (all `src/lib/seo/*.test.tsx`) + 38 modified; `content/` **0**, `routes.ts` **0**, `features/**` **0**, `public/` **0**, `globals.css` **0** |
| unit | **1800 passed / 146 files**, 0 failures (floor was 1697) |
| e2e | **260 passed**, 0 failures (floor was 253) |
| typecheck / lint | 13/13 packages; `eslint .` clean |
| build | 133 HTML = **131 site pages + `_not-found` + `_global-error`**; every route `○ Static` or `● SSG` |
| `export const dynamic` | 6 hits, and all six are static-*enforcing*: `force-static` x2 (`robots.ts`, `sitemap.ts`) and `dynamicParams = false` x4. No dynamic rendering anywhere |
| top-level blocks | `BreadcrumbList` 130, `Article` 35, `FAQPage` 27 (116 Q&A), `CollectionPage` 6, `WebApplication` 6, `WebSite` 1, `Organization` 1, `DefinedTermSet` 1 (58 `DefinedTerm`) |
| forbidden fields | `datePublished` **0**, `dateModified` **0**, `aggregateRating` **0**, `"review"` **0**, `SearchAction` **0**, `potentialAction` **0** |
| sitemap | **130 `<loc>`**; `/search`, `icon.svg`, `apple-icon`, `og.png` all **absent from the emitted body**, not merely absent from `public/` |
| `/search` | `<meta name="robots" content="noindex, follow">` present, canonical present. `robots.txt` deliberately does **not** `Disallow` it — a disallowed page cannot be crawled, so its `noindex` would never be read |
| home | 0 `BreadcrumbList` — the root's trail would be itself |
| env var | `NEXT_PUBLIC_SITE_URL=https://example.test` build: `fishtilt.example` **0 occurrences**, `example.test` **2,613**, sitemap **130/130** on the new origin, `robots.txt` `Sitemap:` line too. Default-origin build restored afterwards and re-verified |

Two counting traps worth carrying forward, both of which look like defects and are not:

- **`WebSite` greps as 7, not 1.** One is the top-level identity block on `/`; the other six are
  `isPartOf` inside each hub's `CollectionPage`, which is what that property is for. Same for
  `Organization` at 78 — 1 top-level plus `publisher` inside every `Article` and `WebApplication`.
  Count top-level blocks, not raw `"@type"` occurrences.
- **`grep "export const dynamic"` returns 6 on a fully static site**, because `dynamicParams` and
  `dynamic = 'force-static'` both match the substring and both *enforce* static rendering.

### The pre-collision SEO baseline (measured read-only, 2026-09-08 ~22:39)

The only clean "before" of the SEO surface, taken by the WP-7a agent that then stopped without
editing (ruling 122). Two of these correct **stale claims in WP-1's audit**, so prefer these
numbers over that document's.

- **22** `page.tsx` files under `src/app`; the route truth is `src/lib/routes.ts` — 18 static
  entries, and `/practice`, never `/quiz` (ruling 101).
- **10** pages emitted JSON-LD: the four dynamic content templates and the six tools.
- **4** pages used `Breadcrumbs` — the four dynamic templates only.
- **`FaqSection` rendered on 7 pages (home + 6 tools) and not one emitted `FAQPage`.** This was
  the single largest real gap in the SEO surface.
- **`public/og.png` exists** and is a real `PNG 1200x630, 8-bit RGB`, 7,003 bytes, correctly
  referenced through `OG_IMAGE_PATH`/`metadata.ts` and already asserted by `tests/e2e/seo.spec.ts`.
  **WP-1's "0 images" is stale and must not be repeated** — there was no dangling reference to
  clean up, and my WP-7a brief asked for one on a false premise.
- **title↔h1 differs on 5 routes, not WP-1's 6, and only one is a defect.** `/tools/range`,
  `/tools/starting-hand` and `/about` are deliberate search-name vs on-page-context splits and
  stay. `/search` is `noindex`. The real problem is `/practice`, whose title `퀴즈 · FishTilt`
  contains neither 홀덤 nor 포커 and so targets no query at all — a metadata-title fix, not an h1
  one. Separately `/hands` (`핸드 목록`) matches its h1 but is a weak target; that is not a
  mismatch and belongs to WP-8, not here.
- **Domain safety was already correct before WP-7a touched anything.** `SITE_ORIGIN =
  normaliseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? 'https://fishtilt.example'`, and
  `canonical.ts`, `metadata.ts`, `sitemapEntries.ts`, `robots.ts` and `layout.tsx`'s
  `metadataBase` all derive from it; the e2e reads the origin out of the sitemap rather than
  hard-coding it. Ruling 110 is satisfied — what remains is to *prove* it with a second build
  under a different `NEXT_PUBLIC_SITE_URL`, which nobody has done yet.

### Two e2e landmines WP-7a's work arms, for whoever runs the gate

1. `tests/e2e/seo.spec.ts:25` pins `ALLOWED_TYPES = {BreadcrumbList, Article, FAQPage,
   WebApplication}`. Emitting `WebSite`/`Organization`/`CollectionPage` on `/`, `/learn` and
   `/blog` **fails it**. The list must grow deliberately — it is a real guard against a page
   claiming a type nobody reviewed, so widen it, do not delete it.
2. Adding `Breadcrumbs` to `tools/*` and `practice/*` puts new `홈` / `무료 도구` / `퀴즈` links on
   those pages. `theme-and-header.spec.ts:293-317` is safe (scoped to `getByLabel('주요 메뉴')`),
   but the unscoped `page.getByRole('link', …)` calls in `outs.spec.ts:72`, `pot-odds.spec.ts:67`,
   `equity.spec.ts:143` and `hand-checker.spec.ts:128` must be re-run.
3. **`tests/e2e/range-explorer.spec.ts` was edited during WP-7a and that edit needs eyes.**
   `/tools/range`'s `<h1>` was converged onto a single source (`title={SEO.title}`, so
   `13x13 핸드레인지` became `13x13 핸드레인지 표`) and the spec's title expectation had to follow.
   Following a deliberate copy change is legitimate; **weakening an assertion to make a suite go
   green is the thing CLAUDE.md §13 forbids**, and from the outside the two edits look identical.
   Both orchestrators check this one independently — the peer as its own gate, me as WP-8 — and
   that duplication is on purpose, because it is exactly the class of change a self-review passes.

### WP-7a as shipped — pass 2, measured independently by MASTER (`gto-self-b4`, ~23:20)

Report: `docs/reports/FISHTILT_WP7A_SEO_AND_SCHEMA.md`. Everything below I measured myself against
`scratchpad/after-wp5/fishtilt` and a fresh `pnpm build:fishtilt`. **Every checkable claim in the
peer's hand-off held**, which is worth recording as plainly as a failure would be.

- **File boundary exact**: 3 new (all `src/lib/seo/*.test.tsx`) + 38 modified. `content/` 0,
  `public/` 0, `routes.ts` 0, `features/**` 0, `globals.css` 0. Ruling 120's four
  `max-w-[42rem]` page containers are untouched, as instructed.
- **Unit 1800 / 146 files, 0 failures** (floor 1697). `pnpm typecheck` 13/13, `pnpm lint` clean.
- **Build: 133 HTML = 131 site + `_not-found` + `_global-error`**, every route `○ Static` or
  `● SSG`, zero server-rendered.
- **206 JSON-LD blocks parse, 0 failures.** Top-level types counted from the emitted HTML:
  `BreadcrumbList` 130, `Article` 35, `FAQPage` 27, `CollectionPage` 6, `WebApplication` 6,
  `WebSite` 1, `Organization` 1 — identical to the hand-off. Nested: `ListItem` 446, `Question`
  116, `Answer` 116, `Organization` 77, `WebPage` 41, `DefinedTerm` 58, `Offer` 6, `WebSite` 6,
  `ItemList` 5, `DefinedTermSet` 1.
- **Forbidden fields all 0** across every built page: `datePublished`, `dateModified`,
  `aggregateRating`, `"review"`, `SearchAction`, `potentialAction`.
- **The counting traps are real** — count top-level blocks, never raw `"@type"` occurrences.
  `WebSite` is 1 identity block + 6 `isPartOf` references; `Organization` is 1 + 77 `publisher`
  references. `export const dynamic` greps to 6 and every one *forces* static.
- **The two test edits are strengthenings, not weakenings** — the thing I said I would check
  independently. `range-explorer.spec.ts` keeps `toHaveText` (exact) and `level: 1` and only
  updates the expected string to the deliberate new `<h1>`. `tools/range/page.test.tsx` went the
  other way and got *stricter*: `toHaveTextContent` (a substring matcher that had been passing
  while pinning nothing) became `.textContent).toBe(...)`, and a `metadata.title).toContain(…)`
  became `toBe(formatTitle(h1))` computed from the actual render — it now pins title and `<h1>`
  as a pair. Verdict: no assertion was weakened anywhere in the change.
- **Ruling 107 holds, and I checked it the hard way**: for all 27 `FAQPage` blocks I compared
  each declared question and answer against the page's *visible* text with `<script>` and
  `<style>` stripped out first (my first pass was contaminated — stripping tags alone leaves the
  JSON-LD's own text in the haystack, so every block trivially "matched itself"). Result:
  **116 of 116 questions appear verbatim in rendered body text.** Nothing is claimed that a
  reader cannot see.

**One defect the hand-off did not report** (found by that same sweep, bounded to a single entry):

- `/learn/poker-actions` emits an FAQ entry that is **not a question and carries raw markdown**.
  `extractFaqItems` (`src/lib/seo/faq.ts`) takes every `###` under an `##` heading matching
  `자주 헷갈리|자주 묻는|자주 하는 질문`, and `content/learn/poker-actions.mdx:62`
  (`### 다섯 가지 행동을 한눈에`) is a **summary list** sitting as the first `###` under
  `## 사람들이 자주 헷갈리는 부분` (line 60). Its `name` is a statement, and its
  `acceptedAnswer.text` ships literal `- 체크: …\n\n- 베팅: …` bullets, because
  `stripInlineMarkdown` handles links, code, bold and italic but not list markers. The other four
  `###` in that section (72, 76, 80, 84) are genuine questions. Site-wide this is **1 of 116** —
  exactly one non-question name and exactly one markdown-leaking answer, the same entry.
  **WP-7b takes it**: move the summary out of the FAQ section (it is misplaced editorially, not
  only structurally) and add a guard so a future author cannot reintroduce it.

**A second, larger one the rename opened** — `/tools/range` is now called four things:

| where | name | status |
| --- | --- | --- |
| `SEO.title` / `<h1>` | `13×13 핸드레인지 표` | canonical, converged by WP-7a |
| `routes.ts:45` nav label | `핸드레인지` | single source, used by `ToolCTA`'s default |
| 5 MDX CTAs | `13×13 핸드레인지 열기` | variant |
| 4 MDX CTAs | `핸드레인지 열기` | matches nav label |
| `features/strength/copy.ts:68`, `content/blog/btn-why-wide.mdx:38` | **`핸드레인지 탐색기`** | **dead — renders nowhere else on the site** |

The peer flagged `copy.ts:68` and rated it higher than it first appeared; it missed
`btn-why-wide.mdx:38` (`action="핸드레인지 탐색기 열기"`), which is a CTA **button label a reader
clicks**. Checked against all six tools: the other five have CTA name == canonical title
(`시작 핸드 탐색기`, `승률 계산기`, `아웃 계산기`, `팟 오즈 계산기`, `핸드 체커`). `/tools/range`
is the only one that drifted, and it drifted because WP-7a renamed the page without owning the 35
files that link to it. Note `ToolCTA.tsx:42` already falls back to `` `${route.label} 열기` `` —
so deleting the override in `btn-why-wide.mdx` both fixes the name and removes a hardcoded one.

The peer confirmed both and asked that this be recorded as its miss. The structural cause is the
truer one — **a bounded WP cannot see the residue it leaves outside its own boundary**, and
renaming a page is exactly the change whose consequences all live outside it. But its own
diagnosis is worth keeping for the next rename: it swept for *"places that render this name"*
when it should have swept for **"places where this string occurs"**, which is why it caught the
`copy.ts` sentence and missed a JSX prop.

### Two structural facts about WP-7a, for WP-8's audit

- **Audit `src/lib/seo/` by export list, not by file list.** The new builders
  (`homeSiteIdentity`, `hubCollectionPage`, `toolPageJsonLd`) landed *inside* the existing
  `jsonLd.ts`; only their **tests** arrived as new files. A reviewer who diffs filenames will
  conclude three test files appeared with nothing under test.
- **The `after-wp5` snapshot is the clean pre-WP-7a baseline** and it still exists at
  `scratchpad/after-wp5/fishtilt`. Peer-measured against it, WP-7a is 3 new files + 35 modified,
  all inside its declared boundary, with `content/` 0, `public/` 0, and outside `apps/fishtilt` 0.
  I verify that independently once it reports done rather than inheriting the number.

### The 20-topic blog survey, and the five link defects it turned up

Drafted read-only for the final summary's "다음 단계" section; the file is
`scratchpad/blog_topics_20.md` (342 lines) and MASTER re-verified every structural claim in it —
**5 of 5 correct, and the eight vocabulary gaps all measure 0 in the prose.** The topics
themselves are sound (each grounded in a `file:line`, each carrying an explicit cannibalisation
argument against WP-1's conflict IDs, each with a "경계" saying what it must *not* cover), but the
survey's real value is what it found by accident. These are **WP-7b's**, and none of them needs a
new article:

1. **`learn/poker-actions` is the only one of the 15 lessons with `relatedArticles: []`**
   (`registry/learn/h2.ts:66`, field at `:87`). It is also the lesson that would carry the three
   orphan terms, so the two items are one fix.
2. **WP-1's own C16 decision was never implemented.** It assigned `hands/77`, `88`, `99` →
   `blog/small-pocket-pairs`; only `hand-22` actually has it (`registry/hands/e3.ts:236`, field at
   `:249`). `hand-77` (`:216`), `hand-88` (`:196`) and `hand-99` (`:176`) are all
   `relatedArticles: []`. A Stage-2 decision that never landed is worse than one never made,
   because the audit records it as done.
3. **`term-vpip` ↔ `term-pfr` is a closed two-cycle.** Each has inbound 1, and it is the other —
   in `relatedConcepts` (`registry/glossary/j1.ts:616,639`) and in prose (`glossary/pfr.mdx:5`,
   `glossary/vpip.mdx:17`). Nothing in learn, blog or hands points at either, so no amount of
   relation-tidying opens this pair; it needs a third document.
4. **The three quiz routes have inbound 0 across all 113 records.** Not one lesson, article,
   term or hand links to `/practice/*`. 14 of the 20 `hands` records are `relatedArticles: []`.
5. **`term-c-bet`'s orphan status is not an article problem** — the correct fix is a
   `relatedConcepts` entry on `learn/flop-turn-river`, which is where the concept already lives.

One more worth keeping for its own sake: **the site is called FishTilt and neither `틸트` nor
`피시` appears anywhere in its 113 documents.** Also `오픈엔디드`, `것샷`, `체크레이즈`, `블로커`,
`멀티웨이` and `인포지션` — all 0. `blog/outs-nine.mdx:27` even asks for the follow-up in prose
("아웃이 9장이 아니라 다른 개수라면 ... 그 개수에 맞는 새 계산이 필요합니다"), and `브로드웨이` is
defined twice independently (`hands/kjs.mdx:8` and `hands/jts.mdx:8`) with no glossary entry.

### Open items handed forward, by owner

WP-7 was split when it opened: **WP-7a owns the mechanism** (`src/lib/seo/**`, `Breadcrumbs.tsx`,
and `metadata`/JSON-LD/breadcrumb insertion inside `src/app/**/page.tsx`), **WP-7b owns the
content** (`src/content/**` prose, `<Term>` inbound links, anchor text). They are run in series,
not in parallel, because both would otherwise want `src/app/learn/[slug]/page.tsx` — and because
ruling 107 makes the order one-way: prose must exist before schema may describe it. So the first
item below is WP-7b's and the second is WP-7a's, despite both being labelled "WP-7" when written.

- **WP-7b — three glossary terms lose their only inbound link.** `term-action`, `term-all-in`
  and `term-ante` had zero relations and zero in-prose `<Term>` references; their only
  inbound link was the homepage's accidental `slice(0, 6)` of registry order, which WP-3
  replaced with real curation. WP-7 must give each one an inbound `<Term>` from a page where
  the word genuinely occurs (`learn/poker-actions` covers all three). `term-c-bet`,
  `term-bluff` and `term-nuts` were already in this state before Stage 2.
- **WP-7a — the homepage FAQ needs its `FAQPage` block.** `FaqSection` renders visible Q&A
  from a typed array and deliberately emits no JSON-LD, so WP-7 emits it from the *same*
  array, the way `Breadcrumbs` does. Six questions, all about the site rather than about
  poker, so nothing here competes with a learn or glossary keyword.
- **WP-4 — stale comments that describe finished work as unfinished.**
  `tools/equity/page.tsx:40` and `tools/starting-hand/page.tsx:58` claim WP-H has not run and
  that `hrefOfContent` returns `null`; all 15 lessons shipped and both links are live. A
  recon agent read those comments and reported a bug that does not exist, which is the cost
  of leaving them. `src/app/layout.tsx` has one of the same class (WP-7's).

### Orchestrator rulings for Stage 2

Numbered from 100 to keep them distinct from the MVP phase's rulings above.

100. **Stage 2 touches `apps/fishtilt` only.** `apps/web` has 45+ modified files from another
     session in the same worktree. No Stage-2 agent reads it, edits it, or runs its tests.
     `packages/strategy-core` stays read-only for FishTilt (MVP ruling 1 and 7 carry forward).

101. **The prompt's route list is not the site's route list.** The prompt says `/quiz`; the
     site has `/practice`. The prompt does not mention `/hands` (20 pages), `/search` or
     `/about`, all of which exist. Every keyword map, IA design and QA checklist follows
     `src/lib/routes.ts`, not the prompt's enumeration.

102. **`/blog` joins the header primary nav.** This reverses the WP-Q decision that kept
     `PRIMARY_NAV_IDS` at five with `blog`/`hands`/`about` in the footer. The reversal is a
     direct owner directive (Stage-2 prompt §6, "반드시 반영"), which outranks an agent-level
     ruling; it is not a reopened ADR. Implementation is one line —
     `PRIMARY_NAV_IDS` in `src/lib/routes.ts`. The header goes to six; `hands` and `about`
     stay footer-only, because the directive names `/blog` specifically and a beginner
     header is still a starting point rather than an index.

103. **Light mode is a token redefinition, not a component sweep.** Measured before opening
     WP-2: across 69 non-test `.tsx` files every colour resolves through the 15 semantic
     `@theme` tokens. The only deviation is `Term.tsx`'s `backdrop:bg-black/60`. So the light
     theme redefines the same token *names* under a theme selector — nobody renames a token
     and nobody adds `dark:`/`light:` variants to 500+ class usages. Token names describe
     role, not lightness, and stay as they are.

104. **Three usages are not safe under token inversion** and WP-2 must handle them
     explicitly: `RangeMatrix.tsx:104` and `RangeCompareMatrix.tsx:68,79` use
     `text-ground-900` as dark ink on a saturated action-colour fill. Inverting `ground-900`
     turns that into light-on-light. The fix is a dedicated on-action ink token, verified by
     a contrast assertion in **both** themes — `RangeCompareMatrix.test.tsx` already contains
     a relative-luminance test to extend.

105. **No content record gains a date.** `ContentRecord` has no temporal field, the homepage
     deliberately declines recency claims, and an independent reviewer examined that decision
     and agreed with it. Stage 2 does not add `publishedAt`, "latest" ordering, or a published
     date on a blog card. Confirmed against `src/content/types.ts`: no date field exists.

106. **A thumbnail may not become a per-record image file by default.** `ContentRecord` also
     has no image field, and 113 authored image assets is a maintenance liability with a
     404 surface. WP-5 designs the structure and WP-6 writes the asset spec; the option to
     beat first is a thumbnail derived deterministically from fields that already exist
     (`kind`, `topic`, `level`, `title`), with an authored image as an opt-in override.
     WP-5 decides on evidence, but must state why if it chooses per-record files.

107. **Structured data may only describe what the page actually renders.** The FAQ pipeline
     extracts `FAQPage` from the MDX's own `##`/`###` headings, so schema cannot drift from
     prose. Stage 2 keeps that property: no WP emits a `FAQPage` for questions that are not
     visibly on the page, and no WP adds `datePublished`, `aggregateRating` or `review` to
     any block. New schema types are allowed only where the page genuinely is that thing.

108. **Serialisation of the expensive gates carries forward.** Only one agent at a time runs
     `build:fishtilt` or `e2e:fishtilt` — they share `.next` and port 3221 (MVP ruling 6).
     `src/lib/routes.ts` is amended by single-line targeted edit only (MVP ruling 5).

109. **`apps/fishtilt` is entirely untracked in git**, so a per-WP `git diff` is not
     available as a review instrument. MASTER keeps a filesystem snapshot of the tree taken
     at Stage-2 open and diffs each WP against it, rather than trusting the WP's own list of
     changed files.

110. **The deployment domain is undecided (owner, 2026-09-08).** `SITE_ORIGIN` keeps the
     RFC-2606 placeholder. WP-7 must leave the site **one environment variable away from
     correct** — every canonical, `og:url`, `robots.txt` sitemap line and all 130 sitemap
     URLs derived from `NEXT_PUBLIC_SITE_URL`, with no literal host anywhere and no test
     asserting a literal host. The Stage-2 master summary carries the domain-connection and
     Search-Console checklists.

111. **Typography stays a system font stack (owner, 2026-09-08).** No webfont file, no
     `@font-face`, and no further attempt at `next/font` — measured this phase, both
     `next/font/local` and `next/font/google` fail to resolve under this app's `nodenext`
     config with `TS2307`, the same failure `next/link` and `next/og` already have. The
     owner's reasons are readability and a **multilingual future**, so the stack is amended
     to name real Hangul faces explicitly (`Apple SD Gothic Neo`, `Malgun Gothic`) rather
     than relying on browser fallback, and stays otherwise generic so another locale
     inherits its own system face for free. Design quality comes from scale, spacing,
     hierarchy and colour, not from a typeface purchase.

112. **No user-visible text may be baked into a raster asset.** FishTilt is Korean today and
     is intended to become multilingual (owner, 2026-09-08). A thumbnail with its title
     burned into a PNG has to be regenerated 113 times per new locale; the same thumbnail
     rendered as live text over a generated background translates for free and stays
     searchable, selectable and screen-reader-accessible. This settles ruling 106 in favour
     of **generated thumbnails whose text comes from the content record**, with an authored
     image allowed only as an opt-in override that carries no burned-in copy. It applies to
     hero visuals and diagrams too: labels are DOM or SVG `<text>`, never pixels.
113. **There are four container widths, not three, and the fourth is a token.** WP-4 measured
     that Compare mode on `/tools/range` needs 1240px of content (two 608px matrices plus the
     gap), which `--container-shell` at 1152px cannot supply, and shipped a `max-w-[85rem]`
     literal with the measurement in a comment. MASTER promoted it to `--container-matrix:
     85rem` so the number sits beside the other three and stays auditable. Verified in the
     built CSS (`.max-w-matrix{max-width:var(--container-matrix)}`) and in the rendered HTML.
     A fifth width still needs a measurement and a token, not a literal.

114. **No content record gains an image field until a real image exists.** Ruling 106 allows an
     authored image as an opt-in override, but adding the field before anything fills it is the
     unused stub CLAUDE.md rule 5 forbids. Thumbnails are therefore generated from fields that
     already exist (`kind`, `topic`, `level`, `title`); the field arrives with its first real
     consumer, not before.


115. **A decorative thumbnail may not assert a poker fact.** WP-5's generated thumbnails
     deliberately draw no ranks, no suits, no percentages and no filled range — a card
     outline, a grid with its diagonal, a quartered square. The moment an illustration shows
     a specific hand or a specific share it is making a claim, and this site's whole
     discipline is that claims come from `learn-core` and carry their conditions. The two
     in-prose figures (`OutsFigure`, `PotOddsFigure`) may show quantities precisely because
     they read them from the same function the surrounding `<Fact>` reads. Extended into the
     MDX allow-list: an article could already not *type* a number, and now cannot *draw* one.

116. **`/learn` should get thumbnails too, and WP-7a will do it.** WP-5 recommended it from
     outside its boundary and correctly did not act: `/blog` and `/learn` are both "things to
     read" hubs, and giving only one of them pictures splits the card language in two. Cost
     is 15 cards at <=12 nodes. `/glossary` (58) and `/hands` (20) stay text — they are
     indexes to scan, not lists to read.

117. **`next/image` does not resolve either — the unresolvable list is four, not three.**
     WP-6 correctly refused to guess and flagged it as unverified; MASTER settled it rather than
     letting it travel as an unknown, by type-checking a one-line probe module against the app's
     own `tsconfig.json`: `error TS2307: Cannot find module 'next/image'`. So `next/link`,
     `next/font/*`, `next/og` and `next/image` all fail identically under this app's `nodenext`
     resolution. Any raster this site ever shows is a plain `<img>` with explicit `width`/
     `height`; nobody should spend another hour discovering this a fifth time.

118. **A generated OG image is legitimate, but it may not make chromium a build dependency.**
     WP-6's resolution of the ruling-112 tension is accepted: 112 forbids *authored* text baked
     into a raster because that creates per-locale redraw debt, and an image re-derived every
     time from `ContentRecord.title` carries no such debt — a new locale means a translated
     record, and the same script runs again. What WP-6 did not weigh is where the generator runs.
     Wiring Playwright into `pnpm build:fishtilt` would make a browser download a prerequisite of
     a production build, which is exactly the kind of production-startup fragility this project
     verifies immediately rather than accepts. So: a **separate** `og:fishtilt` script writes
     committed files, and a unit test asserts a two-way match so drift fails the fast gate
     instead of surfacing as a wrong KakaoTalk preview. **Not Stage-2 work** — the prompt scoped
     WP-6 to a document, and one shared `og.png` with no baked text violates nothing today.

     **Amended after WP-6's final draft.** I wrote the paragraph above against WP-6's 412-line
     interim, which proposed one image per record with the title rendered into it. The finished
     1,007-line document argues the opposite and is right: every major social surface
     (Twitter/Facebook/Slack/Discord/KakaoTalk) renders `og:title` as live text *beside* the
     image, so a per-record card buys subject identification rather than title legibility — and
     `topic` already supplies that at 8 values. So the set is **`kind` x `topic` = 32 images with
     zero characters in them**, whose cost per added locale is exactly 0 KB, against ~740 KB per
     locale for the 53-image titled variant and ~1.8 MB for 131. That is ruling 112 satisfied by
     construction rather than by promise. The two-way match therefore pins **32 `kind`x`topic`
     combinations** against the files on disk, not records against images. Estimated ~224 KB total,
     extrapolated from the real `og.png` (1200x630, 7,003 B); generation time is marked 미측정 in
     the report and stays unmeasured until someone runs it.

119. **Of WP-6's five figure candidates, only the first enters Stage 2.** `learn/pot-odds.mdx`
     lacking `PotOddsFigure` while the blog article summarising it has one is a genuine
     inversion, and fixing it adds zero code — the component is built, allow-listed and tested.
     Candidates 2-5 each need a new component plus an allow-list entry plus tests, landing new
     drawing primitives during the run-up to final QA; they go to the post-Stage-2 backlog with
     WP-6's reasoning intact. Candidate 1 goes to WP-7b rather than a separate agent because
     WP-7b is already the only writer in the MDX this stage — two agents editing the same file is
     the conflict the working agreement exists to prevent.

     **Extended after MASTER measured it: the inversion is both pairs, not one.** The peer
     reported the `pot-odds` half; a sweep of all 113 MDX files found the same shape next door.
     Measured component counts:

     | file | figures | its summary | figures |
     | --- | --- | --- | --- |
     | `learn/pot-odds.mdx` | **none** (5 `Fact`) | `blog/pot-odds-quick.mdx` | `Figure` + `PotOddsFigure` |
     | `learn/outs.mdx` | **none** (10 `Fact`, 2 `PokerCards`) | `blog/outs-nine.mdx` | `Figure` + `OutsFigure` |

     And the general form: `<Figure>` — the captioned in-body figure WP-5 built — appears in
     **3 files, all of them blog posts, and in none of the 15 lessons**. The teaching surface has
     no captioned figures while the summaries of that teaching do. WP-7b takes both lessons, since
     both components are already built, allow-listed and tested (still zero new code). Note the
     content root is **`apps/fishtilt/content/`**; `src/content/` holds the TypeScript registry,
     types and allow-list, not the prose.

120. **There is one Korean long-form measure, it is 42rem, and it is `--container-reading`.**
     WP-6 reported four surviving `max-w-[42rem]` literals; MASTER verified them at
     `learn/[slug]:88`, `glossary/[slug]:73`, `hands/[hand]:140` and `about:26`, and found the
     real defect underneath. Two files state incompatible rationales for the same column:
     `globals.css` justifies `reading: 48rem` as "~48 Hangul characters, the top of the
     comfortable 45-60 band", while `mdx-components.tsx` argues — correctly, and at length — that
     the Latin band does **not** transfer, because Korean has no inter-word space to rest on and
     its glyphs are full-width, so it caps the article column "near 41rem, roughly 35-38
     characters". `globals.css` imported the very guideline the typography note rejects. Measured
     at the real base size (17px, full-width glyphs): 42rem = 672px is ~39 characters, 48rem =
     768px is ~45. WP-5 then migrated `blog/[slug]` alone from the literal to `max-w-reading`,
     which widened one article template to 48rem and left the other four at 42rem — the same
     MDX, the same renderer, two widths.

     The fix is the smallest one available: change the token's value to `42rem` and put the four
     literals on it. Four pages then change by **zero pixels**, `blog/[slug]` returns to the width
     it had before Stage 2, and the literal count goes to nought. It also narrows the seven
     `max-w-reading` prose blocks that are not articles (six tool FAQs, the `/learn` hub) from 48
     to 42rem, which is the same argument applied to the same language and needs a WP-8 eye, not a
     debate. `PageHero.tsx:38` and `SectionHeading.tsx:32` keep their `max-w-[42rem]`: those cap a
     description's line length inside a wider container and are not page containers, so they are
     not ruling-113 literals and must not be swept in with them.

     **Owner: WP-8.** Not WP-7a, which is editing three of those four files right now.

121. **No AI-generated imagery, and the test is one question: "can this picture be wrong?"**
     WP-6 was asked whether to use generated images and argued against, on grounds MASTER
     accepts as the stronger form of an existing commitment. Every figure this site draws comes
     from real domain data (`resolveRange`, `handClassFacts`, `outsOdds`, `Money.ratio`, an
     exhaustive `C(52,5)`), and the decorative thumbnails deliberately draw no rank, suit or
     percentage precisely so nothing decorative can be mistaken for something computed. Put an
     illustration beside those and the reader loses the ability to tell which pictures are claims;
     worse, generative models get hand rankings, suits and board counts wrong routinely, **and
     this is a site that teaches beginners hand rankings** — one wrong ranking image silently
     voids the lesson it decorates. A background gradient cannot be wrong; a drawn card can. So
     the permitted surface is abstract background layers only, and cards, chips, rankings, tables,
     people and **any characters at all** are refused (the last of those is ruling 112 again).
     The blog hero monotony this was meant to solve is real; the answer is 2-3 data-derived
     variants within a `topic`, which are deterministic and cost nothing per locale.

124. **How to check structured data against a page — two traps, both hit for real.** Ruling 107
     ("schema may only describe what the page renders") is only as good as the check behind it,
     and the obvious way to run that check is wrong twice over. Recording the method because both
     orchestrators walked into one of these on the first attempt.

     - **Strip `<script>` and `<style>` wholesale before you read a page's visible text.** Removing
       tags alone (`replace(/<[^>]*>/g,' ')`) leaves the JSON-LD block's own text sitting in the
       haystack, so every declared question and answer "matches" — against itself. My first pass
       reported a clean result that meant nothing. Done properly (scripts removed first), the
       answer was still clean: **116 of 116 questions appear in rendered body text.**
     - **Parse the JSON; never regex it.** The peer scanned the built HTML with
       `"@type":"Question","name":"[^"]*"` and got **4** non-question names. Three were artefacts:
       a question containing an escaped quote (`\"`) truncates `[^"]*` mid-string, so
       `왜 하필 이런 이름을 쓰나요, 그냥 \` looks like a statement. `JSON.parse` gives **1**, which
       is the true number. A regex over serialised JSON does not measure the data, it measures the
       serialisation.

     Both apply to any future audit of the emitted schema, and to WP-8's gate specifically.

125. **WP-8 gets an independent reviewer, and it is not me.** I run WP-8, so me passing WP-8 is
     the exact shape CLAUDE.md §12 exists to prevent. `gto-self-60` offered a re-verification pass
     and I accepted, on §12's terms: it is briefed **only** as "find release blockers and honesty
     problems independently" — never "confirm this passes" — and it is **not** given my list of
     fixes, because a reviewer handed a change list audits the list instead of the product. It
     starts only when I signal the source is frozen. Its own user has to agree to spend the time;
     if they decline, WP-8 still ships, just without the second pair of eyes, and the summary says
     so rather than implying a review happened.

     **Amended at source freeze: the peer is gone.** `gto-self-60` ended before I could hand it the
     frozen tree — `ListAgents` shows no GTO-SELF peer at all, and my own session is now
     `gto-self-3a`. That is not a refusal, it is unreachability, and the effect is the same. Rather
     than ship with no second look I fell back to the mechanism CLAUDE.md §12 actually names, a
     **fresh-context reviewer subagent**, briefed on §12's terms: find release blockers and honesty
     problems, no desired conclusion, and **no list of what I changed**.

     This is a weaker independence than a separate session and the final summary must say so
     plainly. I wrote the reviewer's brief, so I chose what it looks at; a peer session would have
     brought its own priors. What the brief does preserve is the part that matters most — the
     reviewer is told to check the ledger's own claims against the code rather than believe them,
     and to read the code before the reports so it does not inherit my framing.

126. **The scratchpad is volatile and it emptied mid-run — snapshots are not a durable baseline.**
     At 01:18 the session scratchpad under `/private/tmp/claude-501/...` was reaped and recreated
     empty. Lost: every filesystem snapshot (`baseline`, `after-wp2/3/4/5`), the WP-1 recon files,
     the WP-3b/WP-5 screenshots, and the 342-line 20-topic blog survey. **No source was lost** —
     `apps/fishtilt` is intact and WP-7a's work verified present.

     The dangerous part was not the loss but how it reported itself. `diff -rq <gone> apps/fishtilt`
     against a **nonexistent** directory exits quietly with no output, so my change check printed
     "신규 0 · 수정 0" — a confident all-clear that actually meant "I compared nothing". Two
     minutes earlier the same command had correctly printed 3 new + 38 modified. **A diff whose
     baseline has vanished does not fail; it agrees with you.**

     Rules from here: (a) any snapshot diff must first assert the baseline directory exists and is
     non-empty; (b) **`mtime` is the primary change-detection mechanism**, since it needs no
     baseline and cannot silently vanish — `find … -newermt "<ISO timestamp>"`, never
     `-newermt "-4 minutes"`, which BSD `find` does not parse and which also fails silently; (c)
     anything a later WP still needs goes in `docs/`, not the scratchpad. The 20-topic survey is
     therefore being regenerated to `docs/reports/FISHTILT_BLOG_TOPIC_BACKLOG.md`.

127. **WP-7b's first run produced nothing and that had to be verified, not assumed.** The agent
     stopped ~2h after launch with no completion record. Its five load-bearing findings were
     already in this ledger, so the loss was recoverable, but the tree had to be checked for
     half-applied edits before resuming — a partially-edited MDX set would have been far worse
     than an empty one. Confirmed by mtime that **zero files under `apps/fishtilt` changed** and
     both target defects (`btn-why-wide.mdx:38`, `poker-actions.mdx:62`) are still present, so the
     resume starts from a clean WP-7a tree. Fresh baseline snapshot taken at `after-wp7a`
     (457 files) plus an mtime index, per ruling 126.

128. **A name assembled at runtime is invisible to a source grep — hunt it in the built output.**
     I told the peer the dead `핸드레인지 탐색기` lived in exactly two places, having grepped the
     source for that literal. WP-7b found a third that my method structurally could not see:
     `src/app/page.tsx:294` and `:486` build the label as
     `` `${routeById('range').label} 탐색기 열기` ``, so the string exists only after
     concatenation and appears nowhere in `src/`. Confirmed in the emitted HTML — `index.html` is
     the one page still rendering it.

     This is ruling 124's lesson in a third form: **measure the artefact, not the thing you think
     produces it.** A rename sweep must grep `.next/server/app/**/*.html` after a build, not only
     `src/`. Note it also defeats the peer's own corrected heuristic ("sweep for the string, not
     for places that render it") — there was no string to sweep for.

129. **The MDX corpus is not Prettier-formatted and stays that way.** 31 of the 113 files fail
     `prettier --check`; the five WP-7b edited now pass, because the standing rule is to format
     only files you touched (`pnpm format` repo-wide mangles `CLAUDE.md` and reformats unrelated
     drift). So the corpus is deliberately mixed. This is the accepted cost of that rule, not a
     defect: MDX whitespace does not change rendered output, measured `readMinutes`, or any test,
     and reformatting 31 prose files during the run-up to final QA would be a large diff carrying
     real review risk for zero user-visible gain. **WP-8 must not "fix" this.**

122. **A second session is implementing WP-7a in this same worktree, and it keeps the work.**
     At 22:39 my WP-7a subagent found files inside its declared boundary being rewritten under
     it — its first `Edit` failed with "String to replace not found" because `breadcrumbs.ts` had
     changed between its read and its write. It stopped with **zero edits**, which is the correct
     response and exactly what CLAUDE.md §5/§6 asks for; it did not build (numbers would be
     meaningless against a live writer) and did not create the report path.

     I verified the writer is not mine before doing anything: WP-6 had already finished, the
     stopped agent wrote nothing, and my only live subagent is a read-only blog-topic survey that
     writes solely to scratchpad. The writes march through the full route set at ~15s intervals
     (`lib/seo/*` → `FaqSection` → `/` → hubs → six tools → three quizzes → `/search`), and
     `src/app/layout.tsx:18` now reads `CORRECTED BY WP-7a.`, so the writer believes it is WP-7a
     too. The peer session `gto-self-60` has been busy since ~22:03.

     **Ruling: they keep WP-7a; I do not re-run it.** Two writers in one file is the specific
     thing the working agreement forbids, they are substantially ahead, and re-doing it would
     produce a merge conflict rather than a second opinion. I asked the peer directly what its
     intended scope is rather than reverting anything — **nothing of theirs gets reset, stashed
     or checked out** (§6). My stopped agent's read-only reconnaissance survives as the
     pre-collision baseline and is recorded below, because it was measured before any of this
     landed and is the only clean "before" anyone has.

     What this costs: WP-7a's mandated report does not exist and its work was not verified by
     me as it landed. **WP-8 therefore inherits a verification debt** — it must audit the SEO
     mechanism as shipped rather than as reported.

123. **Two sessions were orchestrating the same Stage-2 in one worktree; the owner settled it
     (2026-09-08 22:5x).** The WP-7a collision turned out to be the small half of the problem.
     `gto-self-60` reported having run WP-1 through WP-6 itself, naming the same six report
     files, with the same figures (unit 1697, e2e 253, 131 static pages) — and only one copy of
     each artefact exists on disk. So at least one of the two sessions has been reading the
     other's output and carrying it forward as its own history, and **I cannot rule out that it
     is mine**: neither session can read the other's transcript, and this ledger is the shared
     surface both of us have been appending to. Ruling 118 proves the interleaving concretely —
     the peer wrote the original paragraph and I wrote the amendment under it. Provenance in this
     document before 22:39 should therefore be read as "one of the two orchestrators", not as
     mine.

     **Owner's decision: this session (`gto-self-b4`) continues.** `gto-self-60` finishes WP-7a,
     writes `FISHTILT_WP7_SEO_AND_SCHEMA.md`, and stops. It does not open WP-7b or WP-8. Until it
     signals done, `apps/fishtilt/**` has exactly one writer and it is not me — my only running
     agent is a read-only survey writing to scratchpad. I then verify WP-7a from the shipped code
     rather than from its report (the standing instruction in `./prompt`), and take WP-7b, WP-8
     and the final summary.

     Asking WP-7a's implementer to write its own report is deliberate and not a lowered bar: the
     implementer records what it did, and this orchestrator re-derives the same facts from the
     code independently. Reconstructing the report myself would have collapsed those two into one
     account and lost the disagreement that makes checking worthwhile.

130. **B1 is two defects, not one, and only one of them is mine to fix.** The independent
     review filed "404·500 are English" as a single blocker. Measuring it splits it cleanly.
     The 404 half was entirely ours and is fixed: `src/app/not-found.tsx` now exists, and
     `.next/server/app/_not-found.html` went from **two** `<title>` tags (the first being the
     root layout's `무료 홀덤 학습 · FishTilt`, so every 404 introduced itself as the homepage)
     and no `<main>`, to one Korean title, `lang="ko"`, one `<main>`, a Korean `<h1>` and
     `noindex`. The 500 half is a framework limit. `_global-error.html` is the render of a
     **synthetic route Next generates for itself**, hard-wired at
     `next/dist/esm/build/route-discovery.js` to
     `require.resolve('next/dist/client/components/builtin/app-error')` — no file under `app/`
     is consulted, and adding `global-error.tsx` provably does not change that document. What
     it DOES change is the boundary a visitor actually reaches: `app/page.js`,
     `app/learn/page.js` and `app/about/page.js` each reference our module's chunk, and
     `about.html` ships the client chunk carrying its Korean strings. **Recorded as a Next
     limitation, not an open project defect. Do not re-open it by writing another
     `global-error.tsx`.**

131. **Metadata MERGES with the root layout's, so a page that omits a canonical inherits one.**
     The first build of `not-found.tsx` fixed the duplicate `<title>` and shipped
     `<link rel="canonical" href="https://fishtilt.example">` — the "404 claims to be the front
     door" defect moved out of the tag I was watching and into one I was not. The fix is
     explicit `alternates: null` / `openGraph: null` / `twitter: null`, and
     `tests/e2e/not-found.spec.ts` now asserts the ABSENCE. General rule: on any page whose
     metadata is deliberately partial, absence has to be written down, because the layout will
     fill the silence.

132. **A guard scoped to one file cannot pin a class — and `proseOf` was deleting the copy that
     mattered.** Ruling 101 banned `가장 널리 쓰이는`, and the guard it produced lived inside
     `registry/blog/i4.test.ts`, scoped to `why-called-3bet.mdx`. The identical sentence shipped
     from `learn/outs.mdx` and `blog/outs-nine.mdx` for the whole of Stage 2. Both are now fixed
     and the class is pinned site-wide in `src/copy-guards.test.ts` (GUARD 3 prevalence, GUARD 4
     observed play). Widening the guards exposed a second, larger hole: `proseOf` stripped every
     `<...>` from an MDX file wholesale, which is right for `<Term>` and silently wrong for
     `<Quiz>`, whose entire visible content — questions, options, answer explanations — lives in
     props. **Every one of those sentences was invisible to every copy guard this repo has.**
     The reviewer's worst N3 instance was a quiz ANSWER, and the guard written for it did not
     fire because the sentence was deleted before the guard ran. `propStringsIn` now splices prop
     strings back in, and doing so immediately surfaced a fifth instance
     (`learn/starting-hand-ranking.mdx:97`) that the reviewer's grep had also missed.

133. **A skip link is the first Tab stop, so three existing tests were RIGHT to break.** Adding
     it broke six e2e assertions and every one was informative: `home.spec.ts` asserted the
     wordmark is the first stop (true before, wrong now — updated to two Tabs); the touch-target
     audit counted a clipped 20px element as a finger target (given a third structural exclusion,
     "the browser is painting none of this", with the 44px rule re-asserted on the FOCUSED link so
     the exemption launders nothing); and the primary-button contrast tests selected
     `a.bg-brand-600` and found the skip link first. That last one is the interesting one — the
     fix was not to special-case the test but to put **every** paint utility behind `focus:`,
     because an unfocused skip link is clipped and its fill is unobservable. A resting fill bought
     nothing and shadowed the page's main call to action in the suite.

134. **`SITE_ORIGIN_IS_PLACEHOLDER` was a safety valve wired to nothing, and where you connect it
     is a decision.** Exported, re-exported from the SEO barrel, read by nobody. It now warns from
     `src/app/sitemap.ts` — not from `site.ts`, which every page imports and where the warning
     would fire on every render and in every unit test until nobody reads it. The sitemap is
     prerendered once per build and is the artifact that hands the origin to a search engine. It
     **warns and does not throw**: the domain is genuinely undecided (owner's standing decision),
     and every local build and the whole e2e suite run without the variable on purpose.

135. **Verified: zero wrong particles in 133 built HTML files.** B2's fix is not "the unit test
     passes". Scanning the built output for `(10|8|7|6|3)와` across every prerendered document
     returns **0**, and the computed hand description appears on **34** pages — the reviewer
     counted 8 for `10과 9` alone. The unit test proves the function; the build scan proves the
     site.



## Remainder execution graph (opened 2026-09-05)

The remaining MVP is driven by the master orchestration prompt at `./prompt`, which renames
the work packages. This table is the authoritative mapping from that prompt's WP ids to
this repository; the older per-WP table below is retained as build history.

Baseline re-verified before opening this phase — `docs/reports/FISHTILT_REMAINDER_00_BASELINE.md`:
typecheck 0 errors across 13 projects, learn-core 82/82, fishtilt 425/425, e2e 49/49,
`build:fishtilt` 7 routes all static, eslint clean.

| WP | Scope | Status |
| --- | --- | --- |
| PHASE 0-R | Remainder baseline audit | **done** |
| WP-F2A | Equity/evaluator core: bps projection, edge-case verification | **done** — `docs/reports/WP_F2A_EQUITY_CORE.md`, learn-core 82 -> 94 |
| WP-F2B | `/tools/equity` Equity Calculator | **done** — `docs/reports/WP_F2B_EQUITY_CALCULATOR.md`, 38 new tests |
| WP-F2C | `/tools/hand-checker` Hand Checker | **done** — `docs/reports/WP_F2C_HAND_CHECKER.md`, fishtilt 425 -> 465, e2e 49 -> 59 |
| WP-G2 | Route templates for `/blog`, `/glossary`, `/hands`, `/about`; registry **and MDX-map** split for parallel authoring; learn slug rename | **done** — `docs/reports/WP_G2_ROUTE_TEMPLATES.md`, fishtilt 596/596 |
| WP-G4 | Registry skeleton: 111 records registered, all relations resolve | **done** — `docs/reports/WP_G4_REGISTRY_SKELETON.md`, fishtilt 667/667 |
| WP-L1 | Quiz engine + `/practice` hub | **done** — `docs/reports/WP_L1_QUIZ_ENGINE.md`, 75 new tests |
| WP-H1 | Learn lessons 01-05 | **done** — `docs/reports/WP_H1_LEARN_FOUNDATIONS.md`, 5/5 PUBLISHED |
| WP-I1 | Blog 1-5 (시작 패 강도) | **done** — `docs/reports/WP_I1_BLOG_STARTING_HANDS.md`, 5/5, expanded 612-759 -> 940-1027 chars |
| WP-I2 | Blog 6-10 (패의 종류와 무늬) | **done** — `docs/reports/WP_I2_BLOG_HAND_TYPES.md`, 5/5 PUBLISHED, 908-931 prose chars |
| WP-H2 | Learn lessons 07-10 (four; 06 already published) | **done** — `docs/reports/WP_H2_LEARN_RANGE_POSITION.md`, 4/4 PUBLISHED, ruling 12 fixed |
| WP-H3 | Learn lessons 11-15 (the mathematical ones) | **done** — `docs/reports/WP_H3_LEARN_MATH_ACTIONS.md`, 5/5; **all 15 lessons published** |
| WP-I3 | Blog 11-15 (쇼다운) | **done** — `docs/reports/WP_I3_BLOG_SHOWDOWN.md`, 5/5, 8 showdowns evaluator-verified |
| WP-I4 | Blog 16-20 (규칙 · 용어 · 계산) | **done** — `docs/reports/WP_I4_BLOG_RULES_AND_MATH.md`, 5/5; **all 20 articles published** |
| WP-QA | Gate run: build 86 pages green, unit 808/808, e2e 7 failures fixed | **done** — `docs/reports/WP_QA_MDX_TEST_GAP.md`, `WP_QA_E2E_FIXES.md` |
| WP-J1 | Glossary batch 1 (테이블 · 돈 · 행동), 28 terms | **done** — `docs/reports/WP_J1_GLOSSARY_A.md`, 28/28 PUBLISHED |
| WP-J2 | Glossary batch 2 (카드 · 족보 · 확률), 30 terms | **done** — `docs/reports/WP_J2_GLOSSARY_B.md`, 30/30 PUBLISHED, evaluator-verified |
| WP-G3a | learn-core: `categoryFrequency`, `classVsClassEquity` | **done** — `docs/reports/WP_G3_DOMAIN_FACTS.md`, learn-core 94 -> 114 |
| WP-G3b | `apps/fishtilt` content `Fact` names on G3a | **done** — `docs/reports/WP_G3B_CONTENT_FACTS.md`, 11 facts, 77 new tests |
| WP-E1 | Starting-hand strength methodology + published dataset shape | **done by WP-R** — collapsed into E2, see ruling 9 |
| WP-E2 | `/tools/starting-hand` Starting Hand Explorer | **done** — `docs/reports/WP_E2_STARTING_HAND_EXPLORER.md`; all six tools now shipped |

| WP-SWEEP | Repo-wide ruling-26 remediation + RSC-payload audit | **done** — `docs/reports/WP_QA_RULING26_SWEEP.md`, 6 fixed, `visibleBodyText` helper over 14 call sites |
| WP-K | `/search` global search | **done** — `docs/reports/WP_K_GLOBAL_SEARCH.md`, 67 tests; route flipped by MASTER |
| WP-L2 | `/practice/range-quiz` | **done** — `docs/reports/WP_L2_RANGE_QUIZ.md`, 29 tests; hub copy de-prescribed |
| WP-L3 | `/practice/hand-ranking-quiz`, `/practice/starting-hand-quiz` | **done** — `docs/reports/WP_L3_RANKING_AND_STARTING_HAND_QUIZ.md`, 57 tests; routes registered by MASTER |
| WP-O0 | §48 beginner-language first-use links | **done** — `docs/reports/WP_O0_BEGINNER_LANGUAGE_LINKS.md`; MASTER finished the 11 `relatedConcepts` edits and rewrote the BB clause (rulings 63-64) |
| WP-M | Homepage final integration, 9 sections | **done** — `docs/reports/WP_M_HOMEPAGE.md`, 25 tests |
| WP-N | SEO: metadata, sitemap, robots, OG, JSON-LD, breadcrumbs | **done** — `docs/reports/WP_N_SEO.md`, 130 URLs, 87 tests |
| WP-E3 | 20 `/hands/*` pages | **done** — `docs/reports/WP_E3_HAND_PAGES.md`, 20/20, 31 tests; 5 correctness rounds (rulings 66, 71, 72, 80) |
| WP-GATE | First full-product verification | **done** — build 135 pages, e2e 174, monorepo 3972, typecheck + lint clean (ruling 77) |
| WP-O1+O2 | Responsive QA + accessibility, merged | **done** — `docs/reports/WP_O1_O2_RESPONSIVE_A11Y.md`; CardPicker duplicate-id bug, 13 touch targets, ruling 65 closed; e2e 174 -> 193 |
| WP-O3 | Performance | in progress |
| WP-P1 | Independent poker/math correctness review | **done** — 3 blocker · 5 should-fix · 5 note, all 13 accepted; `docs/reports/WP_P1_POKER_CORRECTNESS_REVIEW.md` |
| WP-P2 | Independent beginner/UX/SEO review | **done** — 1 blocker · 14 major · 10 minor, 25 of 26 accepted; `docs/reports/REVIEW_BEGINNER_UX_SEO.md` |
| WP-AUDIT | MASTER content audit, §47/§48 + three extraction filters | **done** — 6 errors found, 4 fixed, 2 with E3 (rulings 55-74) |


| WP-Q | Fix round | **done** — Q1/Q2/Q3 + resumed Q2b/Q3b; `WP_Q_DISPOSITION.md`, `WP_Q1_CONTENT_FIXES.md`, `WP_Q2_TOOLS_COPY_FIXES.md`, `WP_Q3_NAV_LAYOUT_A11Y.md` |
| FINAL | Full verification + `docs/reports/FISHTILT_MVP_FINAL.md` | last |

### Orchestrator rulings for this phase

1. **No second evaluator, no second equity engine.** The baseline audit confirmed
   `strategy-core`'s `bestFiveOf`/`evaluateHand` handle 5/6/7 cards and return the actual
   winning five, and that `learn-core`'s `exactHeadsUpEquity` is `EXACT` on every street.
   WP-F2A is a verification-and-gap-fill package, not an implementation package. Its one
   real gap is the integer basis-point projection the build spec requires
   (`heroWinBps + tieBps + villainWinBps === 10000`), which is derived from the engine's
   exact integer counts, never from its float probabilities.
2. **No Web Worker for equity in WP-F2B.** Measured worst case (preflop, `C(48,5)` =
   1,712,304 runouts) is 80-93 ms single-threaded. Even several times slower on weaker
   hardware this stays inside a click-to-result budget with an explicit pending state, and a
   worker would add a build, transfer and test surface for no demonstrated need. WP-O3
   re-measures on the real page under CPU throttling and may escalate to a worker **only** on
   a measurement above 250 ms. Evidence gated, not preference gated.
3. **Route templates land before content authoring, not after.** The audit's §6.4 is
   accepted: `/blog`, `/glossary` and `/hands` have no route on disk, so the first record
   flipped from `PLANNED` to `PUBLISHED` in WP-H/WP-I/WP-J would strand content behind a 404
   and break `routes.test.ts`. WP-G2 is inserted before those batches.
4. **The content registry is split per authoring batch.** `src/content/registry/` already
   separates content *kinds*; WP-G2 additionally splits each kind into per-batch files behind
   the existing barrel, so three lesson agents (or four blog agents) never share a writable
   file and can run in parallel. This follows the barrel's own stated design intent.
5. **`apps/fishtilt/src/lib/routes.ts` is edited by single-line targeted change only.** It is
   the one file every route-adding WP must touch. Concurrent agents amend only their own
   entry and never rewrite, reorder or reformat the file.
6. **Only one agent at a time may run `build:fishtilt` or `e2e:fishtilt`.** They share
   `.next` and port 3221; concurrent runs produce false failures. Parallelism is scheduled
   around this, not against it.
7. **`packages/strategy-core/src/equity/equity.ts`'s stale file header stays.** Its claim
   that preflop equity is "SUBSAMPLED (always)" is now contradicted by two independent code
   reads, but `strategy-core` is read-only for FishTilt. It is recorded for that package's
   owner and repeated in the final report; no FishTilt WP edits it.
8. **The `NoFallbackError` line in the e2e server log is assigned to WP-G2** to root-cause,
   since that WP is the next one to touch route-level `notFound()` handling. The 404
   assertion passes today; this is a "confirm it is benign before authoring at volume" item,
   not a blocker.


### Further rulings, after the content architecture pass (`docs/FISHTILT_CONTENT_PLAN.md`)

9. **WP-E1 is satisfied by the already-shipped WP-R.** `handStrengthTied`, an empty
   `exactTies`, rank ordering, top-X% nesting and a "the shipped numbers came out of this
   code" generator-consistency test all exist and pass. Re-deriving the methodology would
   produce a second report and no new fact. E1's only unshipped deliverable is the
   user-facing Korean methodology copy, which is WP-E2's UI work.
10. **Lesson 02 (포커 족보) belongs to WP-H1, not WP-E3.** Both had a claim on it; two agents
    must never author the same MDX file. WP-E3 narrows to the 20 `/hands/*` pages, and the
    `/hands` route template itself moves to WP-G2.
11. **The build spec wins on the hand-rankings slug: `/learn/poker-hand-rankings`.** The
    registry currently says `hand-rankings`. Nothing is shipped at either URL, so the rename
    is free today and costs a redirect later; the spec names this route twice and the final
    acceptance criteria are checked against the spec's route inventory. Relations are by
    `id`, not slug, so nothing else moves. Assigned to WP-G2.
12. **Lesson 09's registered description is factually wrong** — it asserts
    `행동은 네 가지뿐입니다` where there are five (체크·콜·베팅·레이즈·폴드). CLAUDE.md rule 7:
    the fix is substantive, not cosmetic. WP-H2 owns it.
13. **The glossary splits 28/28 by table-vs-cards, not alphabetically.** J1 takes seats,
    money and actions; J2 takes hands, board and arithmetic; a term goes to the batch holding
    every other term its own definition leans on. The build spec offered A–P as one option,
    not a requirement, and an alphabetical cut would separate `Suited` from `Offsuit` and
    `Outs` from `Pot Odds` — the exact pairs one author has to write together. 56 terms, not
    45: `content.test.ts` forbids an alias colliding with another entry's term, so
    `BB`/`Big Blind`, `BTN`/`Button` and `Out`/`Outs` merge, and the site's own content
    depends on twelve more (the nine category names, 스플릿, 13×13, HJ/CO).
14. **Class-vs-class equity is computed, not dodged.** The content plan proposed that blog
    #5 (QQ와 AK 중 뭐가 강할까?) fix four concrete cards, because only hand-vs-hand equity
    exists. That is honest but weaker than the question deserves, and the computation is
    cheap: QQ has 6 combos and AK 16, none conflicting, so 96 pairings x `C(48,5)` runouts at
    the measured ~85 ms is about 8 seconds offline. WP-G3 adds an exact, combo-weighted
    `classVsClassEquity` to `learn-core` with an offline generator, a frozen dataset limited
    to the matchups content actually cites, and a generator-consistency test — the same
    pattern the strength dataset already uses. A class-vs-class *average* remains forbidden
    unless it is computed this way; it may never be estimated.
15. **`CATEGORY_FREQUENCY` gets real domain code.** The exact 5-card category table lives in
    this repo only as a test expectation inside read-only `strategy-core`. WP-G3 adds
    `learn-core/src/handClass/categoryFrequency.ts` that enumerates all `C(52,5) = 2,598,960`
    hands and is pinned against that table. Copying the numbers across would be a fake
    implementation (CLAUDE.md rule 5); computing them is not.
16. **Splitting `src/content/lessons.ts`'s `LESSON_MDX` map is parallelism-critical.** The
    content plan is right that splitting only the registry is not enough — seven content
    agents would still share one map file and would have to run serially. WP-G2 splits the
    per-kind MDX maps per batch too, and publishes the exact per-batch file names for the
    author briefs.
17. **Hand pages highlight a cell with `RangeMatrix selectedKey`, not with a new
    `RangeMatrixMini` capability.** The workaround is already available and adding a
    highlight prop to the mini component is scope the pages do not need.
18. **The 3-Bet naming convention is recorded here, not invented in an article.** CLAUDE.md
    rule 7 forbids inventing poker behaviour, and this repository documents the convention
    nowhere. The assumption FishTilt writes against: **the big blind's forced post is counted
    as the first bet, an opening raise is the second, and the first re-raise is therefore the
    third — a "3-bet".** This is the ordinary hold'em counting convention and is not a
    strategy claim. It is recorded in this document rather than `docs/DECISIONS.md` because
    another session holds uncommitted edits to that file; promote it to an ADR once that file
    is free. Blog #17 and the glossary may state it as the standard convention, and must not
    present any competing count as equally used without evidence.

    **Promoted 2026-09-05: this is now `ADR-0081`.** The other session's edits to `DECISIONS.md`
    had been untouched for about twenty hours, so appending a new ADR at the end could not
    collide with them. The ADR states the rule as counting *increases in the amount owed* rather
    than voluntary actions, which is what makes the forced big blind the first bet, and names its
    own falsifying evidence — a cited source for the competing count — per rule 9.
19. **Blog #11 and #13's winner/split outcomes are script-verified, never reasoned.** The
    authoring agent runs the real evaluator over the exact cards it prints and pastes the
    output in its report. Same rule for any article asserting who wins a specific showdown.


20. **The preflop equity cost is ~200 ms, not 80-93 ms, and ruling 2 stands unchanged.**
    WP-F2A re-measured `C(48,5)` preflop enumeration at 193-206 ms — roughly twice the
    baseline audit's figure — and correctly reported the discrepancy as open rather than
    reconciling it silently. The added `apportion` call is not the cause (0.263 us). The
    likely cause is machine load: several agents were running in this repository during the
    measurement. Flop, turn and river stay sub-millisecond.

    This does not trip ruling 2's 250 ms escalation gate, but it sits close enough to it that
    WP-F2B must **call the engine behind an async seam** — a function returning a promise,
    with a real pending state in the UI — so that WP-O3 can move the work to a Web Worker
    without redesigning the component. Cheap insurance, and it is the shape the page wants
    anyway. WP-O3 re-measures on an idle machine under CPU throttling and makes the final
    call.


21. **A test that names one unbuilt feature expires the day that feature ships.**
    `tests/e2e/tools-hub.spec.ts` asserted the hub's "planned tool" contract by hard-coding
    핸드 체커 as the example, so WP-F2C's flip of that flag turned a passing suite red through
    no fault of its own. WP-F2C was right to report it rather than reach outside its file
    boundary, and the orchestrator fixed it immediately rather than carrying it — CLAUDE.md's
    "never accumulate known breakage".

    The fix does not weaken the assertion, it generalises it: the contract is read off the
    rendered `준비 중인 도구` region, which must contain a badge and zero links while any tool
    is unbuilt, and must not exist at all once every tool ships. That holds at every point on
    the road to shipping the whole toolbox, including the last step. `e2e:fishtilt` 59/59.

    The same shape will recur — `/learn`, `/tools` and the new `/blog`, `/glossary` and
    `/hands` lists all render `PLANNED` records with the same badge. Any test asserting that
    contract names the region, never a specific unshipped item.


22. **`QQ vs AK` is frozen as two matchups, not one.** WP-G3a froze `QQ vs AKs` (24 combo
    pairings) and `QQ vs AKo` (72) separately rather than blending them into a single "QQ vs
    AK" figure. That is the more honest shape and the orchestrator confirms it: suited and
    offsuit are genuinely different matchups, and averaging them would produce a number that
    describes no situation a reader can ever be in. Blog #5 states both.

    Pairing arithmetic independently checked: `6 x 4 x C(48,5) = 41,095,296` and
    `6 x 12 x C(48,5) = 123,285,888` runouts, matching the generated dataset exactly.

    Category frequencies are live-computed at 97-143 ms over all `C(52,5) = 2,598,960` hands
    and pinned against `strategy-core`'s independent table — two derivations agreeing, rather
    than one table copied. Live compute was the right call there and freezing was the right
    call for class-vs-class; the deciding factor in both was measured cost, not preference.


23. **Concurrent route work produces a predictable transient failure, and agents must
    diagnose it rather than repair it.** WP-F2B's final run showed 502/506 with 4 failures,
    all in `/blog` and `/glossary` records and routes it had never opened — WP-G2 mid-flight,
    in exactly the "page written, flag not yet flipped" window every route WP passes through.

    F2B did the right thing: it checked `git status` to confirm it had not touched the
    implicated files, re-ran twice to confirm the failures were stable rather than flaky,
    reported them as not its own, and left them alone. An agent that had instead "fixed" the
    registry would have silently fought another agent's in-flight work.

    This is why every concurrent brief carries the instruction to write `page.tsx` first and
    flip the `routes.ts` flag last, and to re-run rather than repair a failure naming a route
    it does not own. The orchestrator re-runs the full gate after the last concurrent WP
    lands and owns the verdict; no WP declares the suite green on someone else's in-flight
    file.


24. **`docs/FISHTILT_CONTENT_PLAN.md` §2.4/§4 is stale on blog #5 and the batch briefs must
    say so.** The plan was written before `classVsClassMatchupFor` existed and therefore tells
    blog #5's author to avoid a class-vs-class figure and fix four concrete cards instead.
    Ruling 14 reversed that and WP-G3a/G3b shipped the capability, so blog #5 states
    `<Fact name="CLASS_VS_CLASS_EQUITY" arg="QQ|AKs" />` and the `AKo` case beside it. The
    plan file is left as the historical record; the correction travels in the WP-I1 brief.

    Orchestrator spot-check of the shipped fact values against independent arithmetic, since
    every article on the site will cite these: `HAND_ONE_IN_N(AA)` 221 = 1326/6;
    `HAND_TOP_SHARE(AA)` 0.45% = 6/1326; `CATEGORY_FREQUENCY` 5,108 flushes and 10,200
    straights, both correctly exclusive of straight flushes; `POT_ODDS_REQUIRED_EQUITY(3|2)`
    28.57% = 2/7; `OUTS_PROB(9|FLOP|RIVER)` 34.97% = 1 - (38/47)(37/46); its
    `SHORTCUT_RIVER` 36.00% = 9x4; `EXACT_EQUITY(AsKs|AhKh)` 50.00% for mirror hands. All
    agree.

    `OUTS_PROB` gaining `SHORTCUT_NEXT`/`SHORTCUT_RIVER` targets is accepted and is better
    than the plan's shape: blog #20 has to show the "rule of 2 and 4" *beside* the exact
    figure, and an article that had to write the shortcut by hand is an article asserting
    36% is the real answer.


25. **A per-batch file split is necessary for parallel authoring but not sufficient; the
    graph validator is global.** WP-G2 gave every batch its own registry file and its own MDX
    map, so ten content agents never share a writable file. But `content.test.ts` and
    `graph.test.ts` validate the *whole* content graph at once, so the first lesson that links
    to a glossary term another batch has not written yet fails a test its own author cannot
    fix — and the obvious "fix" is to drop the link, which quietly degrades the internal-link
    graph the whole product depends on.

    WP-G4 is inserted to remove that coupling: every remaining record is registered now as
    `PLANNED`, with its final id, slug, title, description and relations. Afterwards every
    relation resolves, and a content agent's job narrows to writing prose, flipping its own
    records to `PUBLISHED`, and registering its MDX. The site already renders `PLANNED`
    records as non-interactive `준비 중` cards, so this is visible, honest, and exactly the
    state the templates were built for.

    This also front-loads the alias-collision problem. `content.test.ts` forbids a glossary
    alias colliding with another entry's term or slug, and that is a *global* constraint
    across 56 terms — discovering it batch by batch would mean two agents each finding half a
    conflict and neither able to resolve it.


26. **Ruling 21 recurred, and the second occurrence shows the real root cause.** WP-E2's flip
    of `toolStartingHand` shipped the last unbuilt tool, and five further tests failed — in
    `graph.test.ts`, `ToolCTA.test.tsx`, `app/tools/page.test.tsx` and `hub.test.ts`.

    Their authors had already guarded against the shallow version of the trap: none hard-codes
    a tool name, each *searches* the registry for an unbuilt route and comments that hard-coding
    one would go stale. The dependency is one level deeper. These tests need **at least one tool
    to still be unbuilt**, which is a fact about how much of the product exists today, not a fact
    about the behaviour they test. Every such test is therefore guaranteed to fail exactly once —
    on the day the product is finished. Searching instead of naming delays that day; it does not
    prevent it.

    The fix is to give those tests a fixture they control rather than production data. The
    behaviour — an unavailable route yields no link and says `준비 중` — must stay provable after
    every route has shipped. The separate property they were leaning on, that `available: false`
    is honest about the filesystem, is already covered in both directions by `routes.test.ts`, so
    nothing is lost by no longer sourcing the fixture from live data.

    General rule for the rest of this build: **a test asserting how the product behaves in a state
    must construct that state, not wait for the product to happen to be in it.** This applies
    directly to the `PLANNED` content records now being registered — every list page renders them,
    and every test asserting the `준비 중` card must build its own planned record rather than
    borrowing a real one that a content batch will later publish.


27. **The glossary was two hand categories short, and J2 adds them.** WP-G4 registered exactly
    the 56 terms `docs/FISHTILT_CONTENT_PLAN.md` §3.4 named, and was right not to invent extras
    on its own authority — but the plan's list covers only seven of the nine categories.
    **원페어 (One Pair)** and **포카드 (Four of a Kind)** are missing, while 플러시, 풀하우스,
    스트레이트, 투페어, 트리플, 하이카드, 스트레이트 플러시 are all present.

    A glossary that defines a full house but not one pair has a hole a beginner falls straight
    through, and both the hand-rankings lesson and the hand-ranking quiz link to all nine
    categories. WP-J2 adds `term-one-pair` and `term-four-of-a-kind`, taking the glossary to
    **58 terms**. Ruling 13's "nine category names" was the intent; the plan's table under-listed
    it.

28. **Content agents verify poker rules by running the evaluator, not by reasoning.** WP-J2's
    terms are exactly the ones beginners get wrong — whether A2345 is a straight, whether the
    board alone can play, who wins with the same pair and a different kicker. CLAUDE.md rule 7
    forbids inventing a rule, and a content agent reasoning carefully is still inventing one.
    J2 runs `bestFiveOf`/`evaluateHand` over the exact cards it prints and pastes the output in
    its report. The same requirement already binds blog batch I3.


29. **The quiz engine models a tie rather than resolving it.** WP-L1 was required not to flatten
    mixed or tied outcomes into a single "correct" answer, and it put that in the type system
    rather than in a comment: `correctness: { kind: 'MIXED', correctAnswerIds: [...] }` scores
    either answer as correct when `compareHands` genuinely returns 0 or two classes are
    bit-identically tied. `excludeMixedQuestions` lets a quiz skip them instead.

    `resolveRange`'s `UNSUPPORTED` maps to a generator returning `null`, dropped by
    `compactQuestions` before a session exists — so a spot the site has no data for produces no
    question at all, rather than a plausible one. That is the single most likely route by which
    fabricated strategy could have entered the product, and it is closed at the type level.

    `MiniQuiz` was deliberately left separate rather than absorbed: an in-prose comprehension
    check with no scoring, retry or seeding is a different component from a standalone scored
    surface, and merging them would have made one component serve two masters. Accepted.

30. **WP-H2 carries the highest fabrication risk in the curriculum.** "Why position matters" and
    "preflop" are precisely where a writer starts asserting what a player should *do*, and this
    repository has no verified strategy dataset to support it. The brief permits explaining what
    a position is, what acting last mechanically means, and what the site's `학습용 기본 레인지`
    shows — and forbids saying a hand is profitable, a range is correct, or how often to raise.
    Its report must list every strategic claim it wanted to make and did not; that section, not
    the prose, is the deliverable that proves the batch is safe.


31. **Ruling 26 has now bitten three times, and the pattern is a repo-wide smell, not three
    accidents.** `tools-hub.spec.ts`, then four tool tests, now `Term.test.tsx` and
    `glossary/page.test.tsx` — each obtained its "not yet built" fixture by searching live
    product data, and each failed the moment that part of the product was finished. The
    glossary case is the clearest: the tests need a `PLANNED` term to prove the `준비 중`
    render path, and publishing all 58 terms left none.

    The fix pattern is now established in four files and must be followed rather than
    re-invented: construct a local fixture, keep the assertion strict, comment why. The
    orchestrator is consolidating this so the codebase has one answer to it.

32. **Open question, being audited: MDX may not be render-testable under vitest at all.** WP-J2
    reports that `@mdx-js/mdx` is only a transitive dependency with no plugin registered in the
    vitest config. If so, then ten content agents have each been asked for a test asserting
    "every record I own renders without throwing", and those tests assert something weaker than
    they claim — the exact vacuous-assertion failure mode ruling 26 warns about, arrived at from
    a different direction.

    The mitigating fact, being verified rather than assumed: every content route is statically
    prerendered, so `pnpm build:fishtilt` compiles and renders all 100+ MDX files and would fail
    on a throwing `<Fact>` or a disallowed component. If that holds, the build gate — which the
    orchestrator owns and runs between waves — is the real guarantor of content correctness, and
    the unit tests legitimately cover only registration, threshold and relations. What must not
    stand is a test *claiming* to prove rendering that does not.


33. **Glossary complete: 58 terms across J1 (28) and J2 (30).** Both batches verified their
    poker claims by running the evaluator rather than reasoning about it, per ruling 28.

    J1 did something worth recording as the standard for the rest of the build: for
    `cutoff` and `hijack` it found that the *etymology* of the position names is genuinely
    contested, and wrote that it is contested — `여러 설이 있고... 확인되지 않은 유래를 사실처럼
    단정하지 않습니다` — instead of picking the most-repeated story and stating it as fact.
    CLAUDE.md rule 7 says not to invent behaviour when unsure; saying plainly that something is
    unsettled is the honest form of that, and it is better teaching than false confidence.

34. **The ruling-26 blast radius was five files, not two.** J1's completion surfaced
    `RelatedContent.test.tsx`, `app/learn/page.test.tsx` and — the interesting one —
    `graph.test.ts`, which hardcodes `contentById('position')` and depends on that record being
    unpublished. Publishing `term-position` was J1's *mandated work*, so this was a foreseeable
    consequence of the assignment rather than a mistake, and J1 correctly reported it instead of
    reaching outside its boundary to patch a shared file.

    The running fix agent's scope has been widened to all five. `graph.test.ts` already carries
    one ruling-26 fix from the tools round, so the second one matches that file's existing idiom
    rather than introducing a competing style inside a single file.


35. **WP-H2's real deliverable was the list of things it refused to write.** Report §5 records
    six strategic claims it drafted or wanted and cut: late-position causation ("that is why BTN
    opens wider"), an invented seat-name etymology, bet-sizing conventions, "limping is weak",
    "if a hand is in the range you must raise", and any facing-open or facing-3bet range. Each
    was replaced with an honest hedge or an explicit `아직 준비되어 있지 않습니다`.

    Every one of those is a sentence a competent poker writer would produce without hesitating,
    and none is supported by anything in this repository. Requiring the batch to enumerate what
    it did not say is what makes that checkable — the prose alone would look fine either way.

    Note that H2 independently reached the same conclusion as J1 about seat-name etymology: it
    drafted one and deleted it as unverifiable. Two agents converging on that from opposite ends
    of the content set is a good sign the rule is legible rather than merely obeyed.

36. **A genuine pre-existing bug found by H2: `src/app/learn/page.test.tsx` builds a regex from a
    lesson title without escaping it**, and breaks on titles containing literal parentheses. This
    is the same defect WP-G2 fixed in the blog, glossary and hands page tests and did not know to
    look for in the learn test. It is inside the running fix agent's widened scope.


37. **MDX is not render-testable under vitest, and the build gate is the real guarantor.**
    Verified first-hand by the audit (`docs/reports/WP_QA_MDX_TEST_GAP.md`): a test importing the
    shipped `poker-range.mdx` fails at Vite's import-analysis step, because `@mdx-js/mdx` is only
    a transitive dependency via the webpack-only `@mdx-js/loader` and no MDX plugin is registered
    in `vitest.config.ts`.

    The compensating control is real, not hopeful: all four content templates set
    `dynamicParams = false` with `generateStaticParams()` and render `<Content />` directly, and
    nothing in the app forces dynamic rendering — so `pnpm build:fishtilt` prerenders every
    published MDX file and fails the build on a throwing `<Fact>` or a disallowed component.
    Confirmed by running it: **86 static pages, green**, covering all 58 glossary terms and 10
    lessons.

    Adding `@mdx-js/rollup` to the shared vitest config is deferred until content authoring winds
    down — it edits root config, needs component-provider wiring that differs from Next's implicit
    `mdx-components.tsx`, and would introduce a second pipeline that can drift from `@next/mdx`.
    Doing that mid-authoring buys little and risks much. **Consequence to hold onto: the
    orchestrator must run `build:fishtilt` after every content wave, because nothing else does.**

    No existing assertion was found to be outright vacuous. The `<Fact>`/`<PokerCards>` checks in
    the batch tests verify those components' arguments compute; they do not prove the whole file
    is valid MDX. That is an honest limit, now written down rather than assumed away.

38. **A whole-body substring assertion cannot tell a claim from its denial.**
    `tests/e2e/hands.spec.ts` polices a rule that genuinely matters — a hand page must never say a
    high strength ranking makes a hand profitable or always worth raising — with
    `expect(body).not.toContainText('항상 레이즈')`. It fired on the page's own disclaimer:
    `이 순위가 높다고 해서 이 패로 항상 레이즈해야 한다거나, 이 패가 수익성이 있다는 뜻은 아닙니다.`

    The copy is exactly right and stays. The test is wrong, and the tempting fixes are all worse
    than the bug: deleting the assertion, or narrowing it to a literal that happens not to match
    today, would leave the real rule untested while looking green. The fix scopes the prohibition
    to the page *outside* the `이 순위가 뜻하지 않는 것` disclaimer, and additionally asserts the
    disclaimer is present — because a hand page that quietly dropped it is the actual regression
    worth catching.

    General lesson for the remaining reviews: **a test that forbids a phrase must know where the
    phrase is allowed to appear.** Honest content discusses the thing it refuses to claim, and a
    naive matcher reads that as the violation.


39. **Gate run after the first content wave — the first real validation of authored MDX.**
    `pnpm build:fishtilt` **green, 86 static pages**, prerendering all 58 glossary terms and 10
    lessons; `pnpm vitest run --project fishtilt` **808/808 across 78 files**; typecheck and
    eslint clean. No systematic authoring error, so the batches still in flight are not
    repeating one — which is why this gate was run mid-wave rather than at the end.

    `e2e:fishtilt` came in at 112/119. All seven failures are test defects in specs that had
    **never been executed**, because the orchestrator holds the e2e gate and the authoring agents
    were forbidden to run it. That trade is working as intended — it bought conflict-free
    parallelism at the cost of deferred locator bugs, which surface in one batch and are cheap to
    fix. It is worth naming though: **a spec that has never run is not evidence of anything**, and
    six WPs reported "e2e written" as if it were.

40. **The sixth ruling-26 occurrence was resolved by flipping the assertion, not by faking a
    fixture** — a distinction worth recording, because the other six went the other way.
    `hand-checker/page.test.tsx` asserted the hand-rankings CTA was *inert because the lesson was
    unwritten*. WP-H1 wrote it, so the honest expectation is now the opposite: the CTA links.

    The page needed no change at all — it reads `hrefOfContent` off the content graph, so it
    followed the data on its own. That is the design working, and the test now asserts the live
    link while the inert path stays covered by the local fixtures in `ToolCTA.test.tsx`,
    `Term.test.tsx` and `RelatedContent.test.tsx`. The source's doc comment, which stated the
    lesson was `PLANNED`, was corrected too — a comment that is now false is as misleading as a
    stale test.


41. **Next inlines the RSC hydration payload as script text, so whole-body e2e text assertions
    read every phrase twice.** Found while fixing `hands.spec.ts`: `page.locator('body')` and
    `textContent` pick up the inline `<script>` carrying the full React Server Components
    payload, which duplicates all page copy — including the very disclaimer the test was trying
    to exclude.

    This is not a quirk of one spec. **Every "this phrase does not appear on the page" assertion
    in the e2e suite is unreliable until it strips inline scripts**, and every "this phrase
    appears" assertion is weaker than it looks, because it can pass on the payload alone while
    the visible page renders nothing. A sweep is auditing all of them.

    The fix pattern: clone the body, remove `<script>` elements and any deliberately-excluded
    section, then assert against the remainder.

42. **The ruling-26 pattern is being ended in one sweep rather than nine more times.** It has now
    fired nine times, each fixed as it broke, with at least two more latent and guaranteed to
    fire when WP-E3 publishes the hand pages. Fixing a recurring class of defect one instance at
    a time as each one breaks is not a strategy, and the remaining instances are known to exist
    right now.

    The sweep covers currently-passing instances too, and applies whichever of the two legitimate
    resolutions fits: give the test a fixture it controls when the *behaviour* is the subject, or
    flip the assertion when the thing genuinely shipped and the old expectation is simply no
    longer true (ruling 40). What is forbidden either way is the third option that keeps
    suggesting itself — deleting the assertion or narrowing it to a literal that happens not to
    match today, which leaves the real rule untested while looking green.


43. **A session rate limit killed five agents mid-write; the recovery rule is assess, then
    resume — never relaunch blind.** I1, I2, I3, I4 and the ruling-26 sweep all terminated on an
    HTTP 429 at once. Relaunching them without first reading the tree would have had two agents
    writing the same files, and would have missed that the tree was left broken.

    What the assessment found: `tsc` was **failing**, because a killed agent left its scratch
    script `apps/fishtilt/scratch-measure.ts` inside the repo. It was untracked and disposable,
    and was moved to the scratchpad rather than deleted, since it also documents I1's intended
    registry values. Every batch brief already said to keep scratch files out of the repo; agents
    that die mid-work cannot clean up after themselves, so the instruction is not sufficient on
    its own and the orchestrator checks for strays after any abnormal termination.

    Per-batch state differed sharply and only inspection could tell them apart: I2 was
    functionally complete (5 MDX, registered, published), I1 had written all five articles but
    registered none of them, and I3/I4 had produced nothing at all. Each was resumed with a
    message describing its *actual* state rather than restarted from its original brief.

44. **WP-H3 verified that the "rule of 2 and 4" errs in both directions, and taught it that way.**
    It runs high at 9 outs (36.00% shortcut vs 34.97% exact) and low at 4 outs (16.00% vs
    16.47%). The lesson says so explicitly — `아웃 개수마다 규칙이 높게 나올 수도, 낮게 나올 수도
    있다는 뜻입니다` — rather than describing the shortcut as uniformly conservative, which is the
    plausible-sounding thing an agent filling in a number would have written. This is exactly what
    requiring every worked example to be *executed*, not reasoned, is for.

45. **The blog indexability threshold caught real thin content, which is the guard working.**
    `MINIMUM_CONTENT.blog` requires 900 prose characters; batch I1's five articles measured
    612-759 and were sent back to be expanded rather than published with `indexable: false`.

    Marking them unindexable would have been the quiet option: the suite would have gone green and
    twenty articles would exist. But the build spec asks for twenty *quality* posts, and shipping
    content that fails the project's own thin-page bar while labelling it as passing is precisely
    the thin-page problem the threshold exists to prevent. Note `measureContent` counts prose only,
    so adding more `<Fact>` components cannot move the number — the bar can only be cleared by
    writing.


46. **WP-I2 found a vacuous assertion in its own test and removed it.** Resuming after the
    rate-limit kill, it discovered a `|| true` and a dead-code lookup left in
    `registry/blog/i2.test.ts` from the interrupted edit — an assertion that could not fail.
    That is the exact failure mode every content brief warns about, and the batch caught its own
    rather than banking a green run.

    It also verified the *direction* of its central claim before asserting it: that suited
    strictly beats offsuit equity across all 78 non-pair rank pairs, rather than trusting the
    folklore to hold uniformly. Orchestrator spot-check of its evaluator output: `Kh Th` on
    `3h 6h 9h 4c 5c` is a flush and `2d 7d` on the same board is 3-4-5-6-7, flush wins;
    `Ah As` on `9h 9d 9c 2h 5h` is nines full of aces against `Kh Qh`'s heart flush, full house
    wins. Both correct.

    Its strategy-claims-avoided table is the batch's real deliverable, as with H2: cut "worth
    calling", "good for implied odds", "always fold 72o" and "always prioritise the flush",
    keeping only rank, equity, combo count and measured category frequency.


47. **Agents must work so that being killed leaves a consistent tree, not a fast one.** The
    rate-limit kill cost more than the lost tokens: batch I1 had written five articles that
    nothing referenced, so the repo held orphan MDX plus a scratch file that broke `tsc`. Nothing
    was corrupt, but the tree was in a state no single agent believed it was in.

    WP-E3 writes twenty pages, so its brief inverts the default: **finish one page completely —
    MDX written, registered in the map, record flipped with measured `readMinutes` — before
    starting the next.** An interruption then leaves every `PUBLISHED` record backed by a real
    page and every unwritten one still `PLANNED`, which is a state the site already renders
    correctly. This costs nothing and removes the recovery problem entirely.

    Generalised: for any long batch, prefer incremental commits of consistent state over a fast
    write-everything-then-register pass. The failure mode is not losing work, it is leaving work
    that lies about itself.

48. **Hand pages must state plainly where the range dataset is silent.** Several of E3's twenty
    hands — `22`, `A5s` among them — appear in the `학습용 기본 레인지` for no position at all.
    The brief forbids softening that, skipping the section, or implying the hand is unplayable:
    the honest statement is that this particular learning range does not include it. Inventing a
    position, or quietly omitting the section for the hands where the answer is empty, are the two
    plausible ways this page type could start fabricating, and both are ruled out up front.


49. **WP-I3 turned its verification evidence into permanent tests, which is better than the
    brief asked for.** Ruling 28 requires a content agent to *run* the evaluator over the cards it
    prints and paste the output into its report. I3 did that and then made all eight cases
    assertions in `registry/blog/i3.test.ts` — so the claims are now defended by the suite rather
    than by a report nobody re-runs. A report proves the author checked once; a test proves the
    claim is still true.

    The cases it pinned are the ones beginners get wrong: same-pair decided on the second kicker
    (`As Qc` beats `Ah Jc` on a King-high board), a full-board straight splitting regardless of
    hole cards (`compareHands = 0` on two different boards), a board that does *not* play for
    both, the wheel evaluating as a straight, `QKA23` evaluating as high card with no wrap-around,
    and the wheel losing to `23456`.

    Adopt this as the standard for the remaining content and review WPs: **where a claim can be
    pinned by a test, pin it — do not leave the evidence in prose.**

50. **The quiz routes take the build spec's paths, not WP-L1's proposed ones.** WP-L1 reserved
    three quiz *ids* in `src/features/quiz/hub.ts` — `practiceRange`, `practiceHandRanking`,
    `practiceStartingHand` — with `route: RouteEntry | null` resolving to `null`, and no entries
    in `src/lib/routes.ts` at all. Its report then proposed `/practice/range`,
    `/practice/hand-ranking` and `/practice/starting-hand`. The build spec names
    `/practice/range-quiz`, `/practice/hand-ranking-quiz` and `/practice/starting-hand-quiz`
    in its route inventory.

    The spec wins, on the same reasoning as ruling 11 for the hand-rankings slug: final
    acceptance is checked against the spec's route inventory, so a route that disagrees with it
    fails the acceptance criteria no matter how reasonable the shorter path reads. Nothing was
    actually built against L1's proposal — it reserved ids, not paths — so this costs a brief
    sentence rather than a migration. Resolved before dispatch precisely because it was still
    free to resolve.

51. **`routes.ts` gets exactly one writer per wave, and WP-L3 is not it.** WP-L2 and WP-L3 run
    concurrently and would both naturally register their own routes, which puts two agents into
    a read-modify-write on one shared registry — the case CLAUDE.md §5 says to serialise. L2
    keeps the edit for `practiceRange`; L3 builds its two pages, reports the exact entries it
    needs, and MASTER registers them and wires the hub cards at integration.

    This is safe because the registry's invariant is one-directional: `routes.test.ts` fails an
    `available: true` entry with no page on disk, and says nothing about a page with no entry.
    An unregistered page is therefore a consistent intermediate state — unreachable from nav,
    but not a lie. The reverse order, registering first, would not be.

52. **The `practiceRange` hub description was prescriptive and is being fixed as part of L2.**
    It read `포지션별로 어떤 시작 패를 열어야 하는지 직접 골라보고 바로 확인합니다.` — "which
    starting hands you *should open*". This site has no verified strategy dataset; it has a
    `학습용 기본 레인지` and a stated methodology. `열어야 하는지` turns a membership question
    into advice, which is the exact claim every other surface on the site has been careful to
    refuse.

    Caught by reading L1's shipped source rather than its report, which is the argument for
    MASTER opening the file before writing the next brief: the report described the reserved
    ids accurately and did not quote the copy.

53. **§47 content quality gate, MASTER's own read — Learn sample passes.** Read in full:
    `holdem-basics`, `poker-hand-rankings`, `three-bet`. Korean reads naturally and is not
    translated-sounding; no AI filler, no repeated scaffolding phrases; jargon is introduced with
    `<Term>` on first use; every number is a `<Fact>`; internal links and `<ToolCTA>` sit where a
    reader would actually want them.

    Poker facts spot-checked and correct: blinds posted before cards; the button moves one seat
    clockwise each hand; a posted blind counts toward that round's wager; five community cards in
    three stages; nine categories in fixed order; the wheel is the lowest straight and `Q-K-A-2-3`
    does not wrap; suits carry no rank; four to a suit is not a flush; best five of seven; kicker
    comparison proceeds card by card; a fully-playing board splits.

    The split-pot passage is the one that could easily have been wrong and is not — it says two
    players split on a `5h6s7c8d9h` board **"이 스트레이트보다 강한 조합을 따로 만들 수 없는 한"**,
    which correctly excludes the player holding a `T`. The careless version of that sentence is a
    poker error, and the author avoided it.

    `three-bet` is the strongest evidence the data-honesty rule is holding under pressure: it
    explains the naming convention completely and then states in a callout that **how to respond
    to a 3-Bet is not on this site because there is no verified data for it** — the exact place a
    lesser draft would have invented frequencies.

54. **§48 beginner-language audit: the definitions all exist, the first-use links do not.** Scanned
    every `.mdx` for the spec's abbreviation list. `EV`, `SPR` and `CBet` appear nowhere.
    `RFI` appears six times and **never in prose** — only inside `params={{ spot: 'RFI' }}` on
    `<ToolCTA>`, i.e. as a URL parameter the reader never sees. `C-Bet` appears once, in
    `glossary/c-bet.mdx`, glossed in its first clause.

    The real gap is narrower and more fixable than it first looked: published glossary pages exist
    for all six positions and for the big blind, and the good pattern
    (`<Term id="term-utg">언더더건(UTG)</Term>`) is already used in `positions-6max` and
    `position` — but **13 pages use an abbreviation without ever linking its definition**, worst
    at `position.mdx` (UTG x12, links `term-button` but not `term-utg`) and `btn-why-wide.mdx`
    (UTG x8, BTN x8). A reader arriving from search rather than from the roadmap gets the
    acronym with nothing to click.

    The first audit pass over-counted this as a content gap. It is a linking gap; `BB`-as-a-unit
    in particular is explained well in `glossary/big-blind.mdx`, `glossary/stack.mdx` and
    `blog/why-blinds-exist.mdx`. Recording the correction because the fix that follows from
    "undefined term" (write new explanations) is the wrong fix and would have added redundant
    prose to thirteen pages.

    Dispatched as WP-O0 with one binding constraint: **link the first occurrence only.** Linking
    all twelve `UTG`s would be worse than the current state.

55. **First real poker error found in shipped content: the flush-draw illustration was not a
    flush draw.** `glossary/draw.mdx` and `glossary/outs.mdx` share one example and both build on
    it — the prose says four cards of a suit are showing, and `outs.mdx` turns that into
    "남은 하트 아홉 장이 아웃츠" and then into `<Fact name="OUTS_PROB" arg="9|FLOP|RIVER" />`.
    The illustration was `Ah Kh 5h Jc 2c`: **three hearts, not four.** With three hearts, ten
    remain and two more are needed, so the picture was not a flush draw at all and the nine-out
    figure did not follow from it.

    The prose and the Fact were correct; the cards were wrong. Fixed to `Ah Kh 5h 2h Jc`.

    **What this says about the verification design.** Every automated gate passed on this page and
    always would have. `<Fact>` guarantees the *arithmetic* — 13 − 4 = 9, and `OUTS_PROB` for nine
    outs really is 34.97% — but nothing tied the Fact's argument to the cards printed two lines
    above it. The computed-number discipline protects against invented numbers, not against a
    correct number attached to the wrong picture. Only reading the page catches that, which is
    precisely what §47's manual sample read is for, and it earned its place on the first sample.

    Pinned per ruling 49 rather than left to prose review: `registry/glossary/j2.test.ts` now
    asserts that whatever cards the example shows, one suit appears exactly four times, and that
    the outs the prose claims and the Fact's argument both equal thirteen minus that count. The
    relationship is pinned, not the card list, so the example stays free to be rewritten.
    Verified the test fails on the original three-heart list before accepting it — a regression
    test that cannot fail on the bug it was written for is the vacuous-assertion failure mode in
    a different costume.

    **Consequence for WP-P1:** the poker-correctness review must check every `<PokerCards>` and
    `<RangeMatrixMini>` illustration against the sentence that reads it, across all content. This
    class of error is invisible to the whole test suite and one instance is already confirmed.

56. **A stale e2e assertion was rewritten to a rule rather than re-pinned to new prose.**
    `tests/e2e/blog.spec.ts`'s prerender test asserted one sentence of `aks-vs-ako.mdx`, and broke
    when WP-I1 legitimately expanded that article from 612–759 to 940–1027 characters to clear the
    blog threshold. Per §45 this is a test error, not a regression and not a contract change: the
    content did the right thing.

    Swapping in a different sentence would have rebuilt the same trap. What the test is actually
    for is that the article body ships in the served HTML rather than arriving after hydration, so
    it now asserts that rule — a full article's worth of prose present with JavaScript disabled,
    containing a `<Fact>`-rendered percentage. The percentage is the stronger half: `<Fact>`
    computes at build time and throws rather than falling back, so a formatted number in
    JS-disabled HTML proves the entire compute path ran on the server. Strictly broader than the
    assertion it replaced, and it no longer expires when someone edits a paragraph.

57. **Second poker error, on the `nuts` page, and it is a different class from the first.** I ran
    every `<PokerCards>` in all 111 content files through the real evaluator. Every five-card
    illustration evaluates to exactly the category its prose claims — that class is clean. The
    error found instead was in a claim *about* an illustration, which no such sweep can catch.

    `glossary/nuts.mdx` walks the board `Ah Kh Qh 7c 2d` and said: "7이나 2를 한 장 더 들고
    있어서 트리플이나 투페어를 만들 수도 있습니다." Checked with `evaluateHandRank`, the product's
    own function:

    | Hole | Actual |
    | --- | --- |
    | `7d 3c` | **PAIR** — one more 7 is a pair, not trips |
    | `7d 7s` | TRIPS — trips needs the pocket pair |
    | `7d 2s` | TWO_PAIR |
    | `9h 4h` | FLUSH |
    | `Jh Th` | **STRAIGHT_FLUSH** |

    So the page was wrong twice over. It said one card makes trips when it makes a pair, and — on
    a page whose entire subject is *the strongest hand available on a board* — it stopped at the
    flush and never noticed that `Jh Th` completes `Th Jh Qh Kh Ah` in hearts. It never identified
    the nuts of its own worked example.

    Rewritten to state the pair/trips distinction correctly and to name the straight flush as this
    board's nuts, which also gives the page the point it was missing: a flush is not automatically
    the best hand. Pinned in `j2.test.ts` through `evaluateHandRank` rather than through a second
    opinion written into the test, so these are the product's own answers; the test also asserts
    the page still uses the board the claims were checked against, and that the retracted trips
    sentence has not come back.

    **The pattern across both errors: `<Fact>` protects the arithmetic, and the evaluator sweep
    protects the illustrations, but nothing protects a sentence that reasons about cards.** Both
    errors sat in that gap. Neither was catchable by any gate the project had.

58. **WP-P1's mandate is widened before dispatch, on evidence rather than suspicion.** The
    poker-correctness reviewer must, in addition to its brief: (a) check every `<PokerCards>` and
    `<RangeMatrixMini>` against the sentence that reads it — mechanically clean as of this pass,
    so it is re-verifying, not searching; (b) **check every claim about what a player *could* make
    on a shown board by running `evaluateHandRank`, not by reasoning** — this is where both
    confirmed errors lived; (c) treat "does this page actually answer the question its own title
    asks" as a correctness question, since the `nuts` page defined the term correctly and still
    failed to identify the nuts.

    Two confirmed errors in a first sample of eight pages is a rate worth taking seriously. It is
    not evidence the content is bad — the prose quality is high and the data-honesty discipline is
    holding everywhere I have read — it is evidence that this specific class of claim was never
    verified by anything, by anyone, at any point.

59. **§47 gate, MASTER's read — the rest of the sample passes, and the math content verifies
    exactly.** Beyond the two errors in rulings 55 and 57, everything checked is correct.

    Numbers re-derived through `factValue`, not trusted from the page:

    | Claim | Computed | Prose |
    | --- | --- | --- |
    | `88` vs `AdKd` preflop | 52.29% | "동전 던지기에 아주 가깝지만 완전히 같지는 않습니다" — right |
    | same, on flop `As 2h 7c` | 8.79% | "완전히 달라졌습니다" — right |
    | same, on turn `3d` | 4.55% | "한 번 더 낮아졌습니다" — right, and 2 outs / 44 |
    | `AsKs` vs `AhKh` | 50.00% | "정확히 반반" — exactly, by suit symmetry |
    | 9 outs, flop→river | 34.97% vs rule 36.00% | "규칙 쪽이 실제보다 살짝 높게" — right |
    | 4 outs, flop→river | 16.47% vs rule 16.00% | "규칙 쪽이 실제보다 살짝 낮게" — right |

    That last pair is the one I most expected to find wrong, because it is a real subtlety stated
    in both directions: the ×4 shortcut overshoots at nine outs and undershoots at four. `learn/
    outs.mdx` gets both directions right and uses them to make the point that the shortcut is an
    approximation. It also counts its own flush draw correctly — `As Ks` with board `2s 7s 9c` is
    four spades seen, nine left.

    Board-and-hole claims re-run through `evaluateHandRank`: `what-is-kicker` (both players make
    에이스 원페어, K kicker beats Q; the second board is a King-high straight both players play),
    `same-pair-who-wins` (both 킹 원페어), `playing-the-board` (Hero `Ac 9c` TRIPS, Villain
    `Kd Qd` PAIR). All correct.

    All ten glossary hand-category pages were verified mechanically by the evaluator sweep and
    each shows exactly its own category. With seven read in full, §47's glossary-10 is met.
    Learn 5 and Blog 3 read in full; hand pages wait on WP-E3.

60. **One precision item handed to WP-P2 rather than edited.** `blog/playing-the-board.mdx` says
    of its counter-example that Villain "결국 보드 그대로의 페어만 쓰지만". Villain's *category*
    is exactly the board's pair, so this is true as written — but Villain's five cards are
    `9h 9d Kd Qd 7c`, using the K and Q from hand as kickers, so Villain is not literally playing
    the board. On the one article whose entire subject is that distinction, the phrasing blurs it.

    Not changed: it is defensible as written and the fix is a pedagogical judgement, not a
    correctness one. Two content edits have already been made this pass on clear errors; this one
    goes to the reviewer whose job it is, with the finding stated rather than the conclusion.

61. **Ruling-26 occurrence eleven, and it was sitting directly under a comment warning about
    ruling 26.** WP-L2's `routes.ts` edit broke `src/features/quiz/hub.test.ts`'s case
    "resolves route to null for an id ROUTES has no entry for at all". The mock spread the live
    `actual.ROUTES` and appended synthetic entries for two of the three quiz ids — leaving the
    third, `practiceRange`, resting on the live registry not containing it. WP-L1 had written a
    careful eleven-line comment above that mock explaining that asserting today's registry
    contents is exactly the ruling-26 trap, and then reintroduced the trap one line below it.

    That is worth recording precisely because the author understood the rule. Knowing the
    principle did not prevent the instance; only constructing every fixture did. Fixed by
    filtering the three quiz ids out of the live registry inside the factory, so all three states
    — absent, registered-unavailable, registered-available — are constructed and none depends on
    what `routes.ts` holds today. (The id list has to live inside the factory: `vi.mock` is
    hoisted above module-scope consts.)

    WP-L2 was right not to fix it: the file was outside its boundary, and it reported the exact
    failure with the fix rather than reaching for it.

62. **`routes.test.ts` is bidirectional, and ruling 51 survives it — checked, not assumed.** The
    registry asserts availability against disk in BOTH directions, so a built page whose entry was
    never flipped fails just as loudly as an entry with no page. That sounded like it would
    invalidate ruling 51's plan of letting WP-L3 ship pages with no registry entry.

    It does not: the check iterates `ROUTES`, so a page with **no entry at all** is never examined.
    An entry that disagrees with disk fails; a page nothing points at is simply unreachable. So
    L3's two pages are safe unregistered, and the one thing this does force is that **WP-K's
    `/search` entry must be flipped in the same pass that lands its page** — `search` already has
    an `available: false` entry, so as soon as the page exists the registry is lying and the test
    says so. Noted as a required integration step rather than discovered later as a red suite.

63. **WP-O0's brief was wrong, and the fix was mine to finish.** I forbade the agent from editing
    `src/**`, not realising that adding a `<Term>` to a page *requires* a matching entry in that
    record's `relatedConcepts` — an invariant `content.test.ts` enforces. So O0 did exactly what it
    was told, linked 11 pages, and left 6 test files red with no way to fix them inside its
    boundary. It reported the precise file→id table instead of reaching outside, which is the
    right behaviour and the reason this cost eleven one-line edits rather than a debugging session.

    Applied the 11 `relatedConcepts` additions across `published.ts`, `h2`, `h3`, `i1`, `i3`, `i4`.
    Content suite back to 345/345.

    Lesson for the remaining briefs: when a brief forbids a directory, check that the task can
    actually be completed without it. "Stay in your boundary" and "leave the suite green" have to
    be satisfiable at the same time, and only the orchestrator can see when they are not.

64. **O0's BB clause was correct and badly placed, and I rewrote it rather than accept it.** It
    inserted one identical sentence — `이 사이트는 금액을 빅 블라인드(BB)의 배수로 나타냅니다.` —
    into five pages, mid-paragraph in every one. On `learn/pot-odds.mdx` it split a worked example
    between its setup and its conclusion. Five verbatim copies is also the "AI repetitive phrases"
    §47 asks the content gate to catch.

    Resolved by asking, per page, whether the clause is earning its place:

    | Page | BB used as | Action |
    | --- | --- | --- |
    | `learn/pot-odds.mdx` | live amounts (10BB, 5BB) | moved to lead the example, not split it |
    | `blog/pot-odds-quick.mdx` | live amounts | moved to lead, reworded |
    | `blog/outs-nine.mdx` | live amounts | moved to lead, reworded |
    | `blog/aks-vs-ako.mdx` | only inside `(6인 · 100BB · …)` | **removed** |
    | `blog/is-ak-good.mdx` | only inside `(6인 · 100BB · …)` | **removed** |

    The last two are the point: `100BB` there is part of a standing labelled condition, not a
    quantity the reader has to interpret, so explaining the unit mid-paragraph was noise. Their
    now-unused `term-big-blind` declarations were removed with the clause. The three survivors are
    worded differently from each other.

65. **The position abbreviations on the range matrix are a real §48 gap, and ADR-0053 is not being
    reopened.** `POSITION_LABEL` maps every position to its bare abbreviation, so `RangeMatrixMini`
    and the Range Explorer render `UTG` `HJ` `CO` `BTN` `SB` as button labels with no gloss —
    on the site's flagship surface and on every lesson that embeds a matrix. This is why WP-O0
    could not fix `learn/hand-matrix.mdx` and `learn/starting-hand-ranking.mdx`: those pages use
    the abbreviations only as component props, so there is no prose to link.

    ADR-0053 is accepted and says these abbreviations "stay in their international form and are
    never translated". Rule 9 applies: it stands, and the labels stay as they are.

    There is no conflict to resolve. §48 states outright that it is not asking for English to be
    removed — its stated good pattern is the Korean gloss *beside* the abbreviation, which is
    exactly what `positions-6max.mdx` already does with `<Term id="term-utg">언더더건(UTG)</Term>`.
    So the gap is not the label; it is that the control offers no one-time explanation anywhere
    near itself. Fixing it is a component design change (a legend, or glossary-linked labels)
    affecting every page that embeds a matrix.

    **Assigned to WP-O2, not done here** — it is a shared-component change with site-wide reach,
    which is the opposite of a drive-by edit, and two agents are inside `src/components` right now.

66. **Third instance of the reasoning-about-cards error class, found in WP-E3's `aa.mdx` while it
    was still running.** The page explained the AA/KK equity gap as coming from the one matchup
    where KK meets AA:

    > K 두 장이 A 두 장을 만나면 ... 지는 카드 조합이 하나 생기는데, 그 한 가지 경우가 승률
    > 차이로 그대로 나타납니다.

    The site's own facts refute it. AA is 85.20% and KK is 82.40% against a random hand, a gap of
    2.80 points. A villain holds AA in 6/C(50,2) = 0.49% of cases, and that confrontation swings
    KK from about 82% to about 18% — so it contributes roughly 0.31 points, **about 11% of the
    gap.** The other ~90% is the thing the sentence never mentions: an ace outranks a king, so
    *every* ace-containing hand beats KK when an ace hits the board, which is common.

    There is a clean disproof using nothing but site data, which is what makes this a good
    teaching case rather than a judgement call. QQ is 79.93%, so KK→QQ is 2.47 points. QQ loses to
    **two** higher pairs instead of one, so on the "one losing matchup" theory its gap should be
    about double KK's. It is slightly smaller. The theory fails on the site's own numbers.

    Sent back to E3 while it still owns the file, with the numbers and with instructions to audit
    the same pattern across its other nineteen pages — "why is this hand's equity lower than that
    one's" is a sentence shape that invites reaching for the rare head-to-head when the real cause
    is how often the board favours the higher card.

    **Three for three now, all in the same class**: a claim that reasons about cards, stated by an
    author who had the right numbers in front of them. `<Fact>` was doing its job in every case —
    every number on `aa.mdx` is computed and correct. It is the sentence *joining* the numbers
    that no gate reads. This is now the single highest-yield thing for WP-P1 to attack, and it is
    worth stating plainly that reading the content found three real errors while the entire
    automated suite, at 1094 passing tests, found none of them.

67. **No curated `/ranges/6max/btn-open` landing pages. Ruled before WP-N was dispatched, so it
    could not be discovered as "work remaining" halfway through.** The build spec (§34) permits
    them, but conditionally: *"only if actual dataset + unique explanation exist."* The dataset
    exists for five positions. The unique per-range explanatory content does not, and nobody has
    been briefed to write it.

    Building them anyway would mean generating one page per position from the same dataset with
    templated prose differing only by a position name — which is exactly the **"thin SEO page
    mass generation"** the spec's own absolute prohibitions forbid. The two instructions are not
    in tension; the conditional in §34 is what keeps them consistent, and the condition is not met.

    So the honest reading is that this is out of scope, not deferred. Recorded as a decision with
    its reasoning rather than a silent omission, because a reviewer comparing the route inventory
    to the spec will notice the absence and should find the answer here.

68. **WP-N is explicitly forbidden from writing content to earn indexing.** Stated in its brief as
    a standing rule, not left to judgement: if a page is too thin to deserve indexing, the answer
    is `noindex`, never filler. An SEO agent with the ability to edit prose and a mandate to
    improve search performance is the most natural place in this whole build for AI filler to
    enter, and the spec bans it outright (§1099). The agent wires metadata over content that
    already exists; content stays owned by content agents.

69. **WP-M refused to fake "latest", and that is the behaviour this project has been trying to
    produce.** The spec's homepage section 8 asks for "Latest Learn/Blog". No `ContentRecord`
    carries a date, so there is no ordering to draw on. The agent had two easy outs — sort by
    registry order and call it 최신, or add a `publishedAt` field to the content architecture
    mid-WP — and took neither. It shipped published totals with **no recency claim** and reported
    the gap.

    Both easy outs were wrong in the specific way this codebase cares about. The first is a small
    lie rendered on the front door. The second is a content-architecture change made by a
    frontend agent to satisfy its own section, which is how a shared schema quietly acquires a
    field nobody owns. Recording it because "the spec asked for X, the data cannot support X, so
    I shipped the honest subset and said so" is the judgement I have been asking every agent for,
    and this is the first time one produced it unprompted on a spec requirement rather than on a
    poker claim.

70. **The homepage now renders no `준비 중` badge anywhere, and that is a *risk*, not just a
    milestone.** Every route and every linked record is built, so the honest-unavailable path has
    no live instance on the front page. That is precisely the condition under which a
    ruling-26-shaped test decays into a vacuous one: an assertion that "unavailable routes render
    inert text" passes trivially when nothing is unavailable.

    WP-M handled it correctly by proving the behaviour with **constructed fixtures** in the card
    component tests rather than against the live registry, so the guarantee stays provable now
    that the product has caught up with it. Worth noting explicitly as the pattern for the
    remaining WPs: when the product outgrows a fixture, the fix is to construct the fixture, not
    to delete the assertion.

71. **Fourth instance of the class, found by grepping for the sentence *shape* rather than by
    reading.** After three errors of the form "a sentence reasoning about cards", I stopped
    reading pages one by one and extracted every sentence in all 111 content files that contains
    both a causal connective (때문 / 이유 / 그래서 / 덕분 / 탓) and a comparative one
    (더 강 / 더 높 / 보다 / 차이 / 앞서) alongside a hand or category reference. That yielded
    **ten candidates out of ~2,000 sentences** — a reviewable list.

    Nine were correct and re-verified: flushes rarer than straights (5,108 vs 10,200), full houses
    rarer than flushes (3,744), `C(4,2) = 6` combos for every pocket pair, the AKs/AKo suitedness
    gap. `learn/starting-hand-ranking.mdx` even self-corrects within the same section, noting that
    offsuit aces outrank low pocket pairs.

    The tenth, `hands/ako.mdx`, was wrong:

    > 순위표에서 AKo가 페어들보다 아래에 있는 이유이기도 합니다 — ... 페어를 아직 넘어서지
    > 못합니다.

    AKo is **rank 12**, below seven pairs and **above five**: 66 (17), 55 (27), 44 (48), 33 (66),
    22 (87). The second clause states it as a general rule, which makes it worse than a slip. And
    the fact it was avoiding is more interesting than the one it asserted: **AKs at rank 8
    outranks 77 at rank 9**, so a suited broadway already beats a pair on this metric.

    Sent to E3 with the rank table and instructions to audit every comparative sentence in its
    twenty pages against actual `HAND_RANK` values.

    **The method is the finding.** Reading found three errors in thirteen pages, which does not
    scale to 111. Grepping the sentence shape found the fourth in one pass over everything, with
    a ten-item worklist a human can check in minutes. **WP-P1 should run this extraction first and
    read second** — the class is now well enough characterised to hunt mechanically, and the
    filter is: causal connective + comparative connective + hand reference, in one sentence.

72. **Second extraction pass — absolute claims — found two more, both on WP-E3's pages.** The
    ruling-71 filter (causal + comparative) was one shape. The other is the **absolute claim**:
    유일 / 항상 / 무조건 / 전부 / 모든 / 반드시 next to a hand or category reference. That
    extraction returned 49 sentences, of which most are correct and several are impressively
    precise. Checked against the real ordering:

    | Claim | Verdict |
    | --- | --- |
    | `77.mdx` — AKs is the only non-pair in the top eight | **true** (1-8: AA KK QQ JJ TT 99 88 AKs) |
    | `aqs.mdx` — only 77 sits between AKs and AQs | **true** (8, 9, 10) |
    | `kqs.mdx` — the fifteen above KQs are all pairs or ace-hands | **true**; KQs at 16 is the first with neither |
    | `99.mdx`, `tt.mdx` — top seven all pairs, 99 sixth, TT fifth | **true** |
    | `ako.mdx` — AKo is the *only* offsuit hand surrounded by suited ones | **FALSE** |
    | `ajs.mdx` — the *only* place a suited hand sits directly above an offsuit one | **false as scoped** |

    `ako.mdx` says "순위표에서", the whole 169-hand table, with no narrowing — and **ATo at 19 is
    also sandwiched**, between A9s (18) and KJs (20). `ajs.mdx` carries the qualifier
    "이 사이트가 다루는 시작 패 중", under which it may hold, but it describes positions *in the
    ranking table*, where ATs→AQo and A9s→ATo are both counterexamples. A claim that is only true
    under a scope the sentence does not make clear is not worth keeping.

    Both sent back with the rank table. The fact each sentence was reaching for survives the fix
    and is better than the claim it was dressed in: **AJs (11) outranks AKo (12)**, and **AKs (8)
    outranks 77 (9)** — a suited broadway beating a pair is the surprising thing, and it is true.

    Running total: **six errors, all in content, all of the same family** — a sentence built on
    top of correct computed numbers. The automated suite is now at 1115 passing and has caught
    none of them, which is not a criticism of the suite: it tests the code, and the code is right.

73. **Two extraction filters are now the standing method, and they belong in WP-P1's brief as
    procedure rather than advice.** Sentence-shape hunting has found three of the six errors, in a
    fraction of the time reading takes, over 100% of the corpus rather than 12% of it.

    - **Filter A** (ruling 71): causal connective + comparative connective + hand reference. 10
      hits from ~2,000 sentences; 1 error.
    - **Filter B** (this ruling): absolute quantifier + hand reference. 49 hits; 2 errors.

    Both are cheap to re-run and neither replaces reading — the flush-draw illustration and the
    `nuts` board (rulings 55, 57) had no linguistic tell and were found only by looking at the
    page. P1 runs both extractions first to clear the mechanical ground, then reads. Reading is
    the expensive instrument and should be pointed at what the filters cannot see.

74. **Filter C — hard numbers in prose — comes back clean, and that is the headline result of the
    whole audit.** Extracted every sentence in all 111 content files containing a percentage, a
    decimal, or a thousands-separated number that was **not** produced by a `<Fact>` component.
    Across the entire corpus there are **four**, and all four are legitimate:

    | Page | Number | Why it is fine |
    | --- | --- | --- |
    | `hands/aa.mdx` | `100%` | "AA의 승률이 100%는 아닙니다" — a rhetorical bound, not a statistic |
    | `learn/equity.mdx` | `50%` | "정확히 50%가 아닙니다", with the real value as a `<Fact>` in the same sentence |
    | `learn/equity.mdx` | `90%` / `10%` | a hypothetical illustrating what an equity share means |
    | `learn/outs.mdx` | `0%` | 0 outs gives 0%, true by definition |

    Not one invented statistic in roughly 100 authored pieces. Every real number on this site is
    computed at build time by a component that throws rather than falls back.

    This is worth stating plainly alongside the six errors, because the two findings are easy to
    confuse. **The data-honesty rule — CLAUDE.md rule 2, the one this project cared most about —
    held completely.** No agent invented a percentage, hard-coded a frequency, or presented an
    unsourced figure as fact. What failed was a different thing entirely: sentences *reasoning
    about* correct numbers. The discipline that was designed and enforced worked; the gap was in
    a place nobody had thought to put a guard.

    That is also why the errors were survivable. Every one of them was a claim on top of correct
    data, correctable by editing a sentence — not a fabricated number that would have had to be
    traced, distrusted and re-derived across every page that repeated it.

75. **41 e2e tests across five spec files have never been executed, and that debt is coming due.**
    `range-quiz` (5), `hand-ranking-quiz` (7), `starting-hand-quiz` (8), `search` (7) and `home`
    (14) were all written by agents forbidden from running Playwright, because MASTER holds the
    build/e2e gate (ruling 6) so that six concurrent agents do not fight over `.next` and port
    3221.

    That trade bought conflict-free parallelism. Its cost is exactly this: the last time a batch of
    never-run specs was first executed, **7 of them failed** — five Playwright strict-mode
    violations, one ruling-26 fixture, and one false positive where a `not.toContainText`
    assertion fired on the page's own disclaimer denying the very claim it was checking for.

    So the plan is stated in advance rather than discovered as a surprise: once WP-E3 and WP-N
    land, run `build:fishtilt` first (it is the **only** MDX validator — vitest cannot render
    `.mdx` in this workspace), then `e2e:fishtilt`, and **budget for a fix round on the first
    execution.** A first-run failure in a never-executed spec is expected engineering, not a
    regression, and must not be treated as one — but neither is it acceptable to ship without
    running them. Nothing is green until it has actually run once.

76. **The 46 failures visible mid-audit are in-flight churn from two live agents, diagnosed rather
    than assumed.** Recorded because "46 failing tests" in a transcript looks alarming without the
    diagnosis, and because I checked whether they were mine before concluding they were not:

    - **2 in `content.test.ts`** — `hand-ajs` at 586 prose chars against a 600 minimum, and
      `hand-ako`'s `readMinutes` — are WP-E3 mid-edit on the two pages I sent back for correctness
      fixes. Shortening prose while rewriting a claim is exactly how a threshold gets clipped.
    - **44 across `src/app/**`** — all `Element type is invalid ... got: undefined` — are WP-N
      partway through wiring a breadcrumb component into page shells before its export exists.

    The check that mattered: my own edits removed the BB clause from two blog articles that sat at
    940–1027 prose characters against a 900 minimum, so it was entirely possible I had clipped one
    below the line. Only `hand-ajs` failed the threshold, which proves both survived. Verifying
    that took one command and was worth it — "it's probably the other agent" is how an
    orchestrator ships its own regression.

77. **Full gate run, everything green — the first time the whole product has been verified at
    once.** After WP-E3, WP-N and WP-M landed:

    | Gate | Result |
    | --- | --- |
    | `pnpm build:fishtilt` | **135 static pages**, all prerendered, 0 errors |
    | `pnpm e2e:fishtilt` | **174 passed**, 0 failed |
    | `pnpm test` (whole monorepo) | **3972 passed**, 271 files, 0 failed |
    | `pnpm typecheck` | clean, 13 projects |
    | `pnpm lint` | clean |

    The three skipped tests are a pre-existing `GTO_SELF_BENCH`-gated benchmark in `apps/web`,
    unrelated to FishTilt — checked rather than waved past, because §59 counts a skip *increase*
    as not-green and the only way to know is to look at what they are.

    The build matters most: **vitest cannot render `.mdx` in this workspace**, so `build:fishtilt`
    is the sole validator of all 111 content files. Every content edit made during the audit, plus
    E3's twenty new hand pages, was unvalidated until this run.

78. **The never-run e2e debt came due and cost one test, not seven.** Ruling 75 predicted a fix
    round: 41 tests across five specs had never executed, and the previous such batch failed 7 of
    ~10. This time **1 of 41 failed** — `search.spec.ts`'s empty state, an unscoped
    `getByRole('link', { name: '포커 용어' })` matching three elements (header nav, the empty
    state's own browse list, footer) and tripping strict mode.

    Two things made the difference, and both are worth keeping: the sweep's `visibleBodyText`
    helper had already removed the whole-body-assertion class that caused most of the earlier
    failures, and every agent in this wave was briefed with ruling 26 up front rather than
    corrected afterwards.

    **The fix was in the component, not the test.** The empty state's browse links were an
    unlabelled `<ul>` — which is both why the test could not scope to them and a real
    accessibility gap, since a screen reader announced a bare list of links with no indication of
    what it was. Adding `aria-label="둘러보기"` fixed the a11y hole and gave the test a handle.
    A test that cannot address the thing it is testing is often pointing at a missing
    accessible name; reaching for `.first()` would have hidden that.

79. **WP-O1 and WP-O2 merged into one agent; WP-O3 serialized after them.** Responsive and
    accessibility fixes land in the same components — the matrix, the card picker, quiz controls —
    so running them as two concurrent agents would have put two writers on the same files, the
    exact case CLAUDE.md §5 says to serialise.

    WP-O3 (performance) runs *after* rather than alongside, for two reasons: it needs the browser
    and build gate that the UI agent now holds (Playwright would collide on port 3221 and `.next`),
    and measuring bundle size and interaction cost *before* the responsive and a11y fixes land
    would measure a product that is about to change. Measure the thing you intend to ship.

80. **WP-E3's first correction was replaced by a different error, caught on review of the fix.**
    Told that `aa.mdx` misattributed the AA/KK gap to the rare AA-vs-KK confrontation (ruling 66),
    E3 rewrote it to say that holding AA means "남은 A 두 장은 이미 내 손 안에" — so no ace can
    reach the board or an opponent's hand. **Holding AA leaves two aces in the deck.** The same
    claim had propagated to `kk.mdx`.

    The correct mechanism is neither: an ace is an **overcard** to KK and beats it, while AA has
    no overcard at all — an ace arriving makes AA *stronger*, not weaker. Rewritten on both pages
    and pinned in `e3.test.ts` through `evaluateHandRank`: on `Ad 8c 3h`, `As Ah` makes TRIPS,
    `Ks Kh` makes PAIR, and `Ac Qd` — an opponent holding one of the two aces the retracted
    sentence said could not exist — also makes PAIR and beats the kings. The test additionally
    asserts neither page has regained either retracted phrasing.

    **The lesson is about review, not about E3.** A correction is new writing and carries the same
    error rate as the original; sending a finding back does not discharge the orchestrator's duty
    to check what came back. This one would have shipped, because the automated suite passed on it
    and it *sounded* like the confident explanation a corrected page ought to have.

81. **The accessibility pass found a real bug that no amount of visual QA would have surfaced.**
    `CardPicker` hard-coded its element ids as `card-picker-suit-<suit>`. `/tools/equity` mounts
    **three** pickers and `/tools/hand-checker` mounts **two**, so those ids were duplicated on the
    page and every `aria-labelledby` on the second and third picker resolved back to the *first*
    picker's headings. A screen-reader user selecting a villain's cards was told they were
    selecting the hero's. Fixed with `useId()`.

    The page looked correct, behaved correctly with a mouse, and passed 174 e2e tests. It was
    wrong only in the accessibility tree. This is the same shape as the content findings: a layer
    nothing was checking. The agent added a **duplicate-id census** test, which is the right
    response — the bug class, not the instance.

82. **Responsive QA found nothing, and the way it established that is the point.** Zero
    page-level horizontal overflow across **147 initial-load states** (7 viewports x 21 surfaces)
    and **132 post-interaction states** — compare mode, quizzes played through to the result
    screen, open card pickers, search results and empty states, open disclosures, the open mobile
    menu. All by DOM measurement (`scrollWidth` vs `clientWidth`), per §41's ban on judging layout
    from downscaled screenshots.

    It also checked the negative that makes the result meaningful: `globals.css` has **no**
    `overflow-x: hidden`, so the clean result is a real absence of overflow rather than a hidden
    one. A "no findings" report is only worth having when it says how it would have found them —
    and this one additionally verified the 13x13 trade positively at 360px: the matrix's own
    wrapper scrolls, the page does not.

    13 touch targets were genuinely too small and were fixed, the worst being the top-share
    slider at **16px**. Three were deliberately left: inline `<Term>` triggers and prose links
    (33px, the WCAG inline exception — enlarging them would overlap adjacent lines), breadcrumb
    width, and the pot-odds checkbox whose `label` already carries `min-h-11` and *is* the target.
    Naming what was left alone, with the reason, is what separates an audit from a checklist.

83. **Ruling 65 is closed, with both halves and without reopening ADR-0053.** The abbreviations
    still display exactly as before. What was added is a visible `PositionLegend`
    (`UTG 언더더건 · HJ 하이잭 · CO 컷오프 · BTN 버튼 · SB 스몰 블라인드 · BB 빅 블라인드`) under
    the button row, glossing only the positions that row actually offers, mounted once in the
    shared components — plus `positionAccessibleName()` on every position control and grid.

    The screen-reader half was the more important one and the easier to miss: a cell used to
    announce as "A K s" and a position button as "U T G". They now announce
    **"AKs 에이스 킹 수티드, 레인지 포함"** and **"언더더건(UTG) 자리, 선택 안 됨, 버튼"**. The
    glosses were taken from the site's own glossary titles, so no new Korean was invented for a
    surface — the same discipline the content rules impose, applied to a component.

84. **One colour-only signal existed and it was quantified before being called a finding.**
    In the compare matrix, SHARED vs DIFFERS was carried by `act-raise-500` against
    `act-call-500` — **1.21:1 in greyscale**, with identical dark ink on both. That is
    indistinguishable without colour vision. Fixed with an underline on DIFFERS cells and a
    matching bar on the legend swatch. Every other colour use on the site already had a word,
    glyph, `aria-pressed` or ink-flip beside it.

85. **Open for WP-Q: card suits announce in English on a Korean site.** Card names render the
    glyph (`A♠`), which a screen reader reads as "A black spade suit". `SUIT_KOREAN` already
    exists in the codebase. It was not changed because doing so churns roughly 20 e2e locators,
    which is a copy-and-test decision rather than an accessibility fix to make unilaterally at the
    end of an a11y pass.

    Worth weighing seriously in the fix round rather than dismissing on cost: cards are the most
    fundamental object on the site, and this is the one remaining place where a Korean-language
    product speaks English to an assistive-tech user. Also deferred: per-chart `region` landmarks
    in `RangeMatrixMini`, the `lg` compare-panel layout, and `text-500` on the decorative
    breadcrumb separator.

86. **P1 and P2 dispatched in parallel with O3, and briefed on method without being briefed on the
    verdict.** CLAUDE.md §12 forbids telling a reviewer the conclusion you want. It does not forbid
    telling them how to look, and withholding a method that has already found six errors would be
    wasting the reviewer, not protecting their independence.

    So both reviews were given the three extraction filters and the fact that six errors of one
    class have been found and fixed — **and told explicitly not to assume the previously-audited
    pages are now clean**, because one of those fixes was itself wrong and needed correcting a
    second time (ruling 80). Neither was told the site is expected to pass. Both were told that
    finding nothing in an area is a real result *if they say how they established it*, and that
    they are not being asked to approve anything.

    The two reviews are scoped to be genuinely disjoint rather than nominally so: P1 owns poker and
    mathematical truth and is told **not** to review wording, tone or SEO; P2 owns the beginner's
    experience and is told to note a factual error briefly and move on. Overlapping reviewers
    produce duplicate findings and a false sense of coverage in the gap they share.

    Running all three concurrently is safe because P1 and P2 are read-only and only O3 needs the
    build and browser gate. P1 and P2 were both told O3 holds it.

87. **P2 was given the settled decisions it might otherwise re-open, stated as context rather than
    as defence.** `/search` is deliberately `noindex`; curated `/ranges/*` pages were deliberately
    not built; no content record carries a date so nothing claims recency; ADR-0053 keeps poker
    abbreviations in their international form. Each was named with the instruction that if the
    reviewer thinks the call is wrong they should say so **as a note**.

    The alternative — staying silent and letting a fresh reviewer rediscover them as defects — costs
    a review cycle re-arguing decisions that are already recorded with reasoning, and rule 9 says
    those are settled unless the falsifying evidence actually appears. Telling a reviewer what is
    already decided is not the same as telling them what to conclude.

88. **WP-P2 found a blocker on a page I had personally read and passed.**
    `glossary/pot-odds.mdx`:

    > 이 최소 승률보다 내 에퀴티가 높다고 판단되면 **콜을**, 낮다고 판단되면 **폴드를 고려해 볼
    > 수 있는** 기준이 됩니다.

    That is strategy advice, and the site has no verified strategy dataset. Worse, it contradicts
    the site's own tool: `/tools/pot-odds` carries a whole section headed
    **"이 숫자만 보고 콜하면 되나요?"** answering 아닙니다. Two pages about one concept give
    opposite guidance.

    I read this page in full during the §47 sample (ruling 59) and did not flag it. **The reason is
    instructive and is the argument for independent review existing at all.** By then I had found
    three errors of one class and had built filters for it, so I was reading for *factual* claims
    about cards — and this is a **policy** violation, not a factual one. Every number on the page
    is right. The sentence is well-written. It fails a rule I was not, at that moment, reading for.

    A reviewer who has just characterised an error class is the worst-placed person to notice a
    different one. That is not a lapse to resolve by trying harder next time; it is why §12 requires
    a reviewer who was not the builder and did not run the previous audit.

89. **WP-P2's substantive verdict: the glossary is the weak surface, and it fails in one direction.**
    1 blocker, 14 major, 10 minor. The pattern across them is sharper than the count: the content
    ownership ledger held between lessons and blog — the three high-overlap pairs the plan singled
    out all came back clean, 18 of 20 blog articles answer a real question, and there are no shared
    intros or generated-filler constructions. **It broke where the glossary re-teaches what the
    lessons own, and drops their epistemic care in the process.**

    `glossary/position` and `glossary/button` assert positional advantage as causal fact — the exact
    claim `learn/position` and `blog/btn-why-wide` spend paragraphs deliberately declining to make.
    3-bet counting is explained from scratch in four places with three different certainty framings
    ("이 세는 방식" / "가장 널리 쓰이는" / "표준적인") despite ADR-0081 settling it.

    That is a coherent, fixable finding rather than a list of gripes: the glossary was written by a
    different pair of agents than the lessons, against the same plan, and inherited the topics
    without inheriting the restraint. The fix round should treat "bring the glossary to the standard
    the rest of the site meets" as one job with one owner.

    Structural findings worth acting on: the homepage's **primary** CTA sends a beginner to
    `/tools/range`, which has zero links to any lesson or glossary term — the front door opens onto
    a dead end; `/about` is a true orphan with zero inbound links; the header search button is
    hard-`disabled` although `/search` has been live since WP-K; and `/glossary` sorts 58
    Korean-labelled entries by their hidden **English** keys.

    SEO mechanics came back clean — 130 URLs crawled to closure, all 200, no canonical mismatches,
    no duplicate titles or descriptions, no index explosion, `/search` correctly `noindex`.

90. **zod — the whole library plus its entire i18n locale set, ~288 KB — was shipping to every
    page, and nothing imports it.** WP-O3 traced it: `strategy-core`'s barrel re-exports
    `poker-core`'s barrel, which reaches `serialization.js`, which imports zod. No package declared
    itself side-effect free, so the bundler could not drop any of it.

    | Route class | before | after |
    | --- | --: | --: |
    | article pages (113 of them) | 827.9 KB | **532.0 KB** |
    | quiz routes | 903.3 KB | **607.3 KB** |
    | `/tools/equity` | 826.7 KB | **552.3 KB** |

    Three one-line `sideEffects: false` declarations. `experimental.optimizePackageImports` was
    tried first as an in-app-only fix and had **zero** effect — worth recording, because it is the
    change someone would reach for first and it does nothing here.

    **I verified the declarations myself rather than accepting them**, because these are
    `package.json` files shared with `apps/web` — another product, with another session's
    uncommitted work in it — and a wrong `sideEffects` claim lets a bundler delete code that was
    actually needed. Scanning all four packages for module-scope executable statements:
    `shared`, `poker-core` and `learn-core` have **none**, so the claim is factually true for the
    three that were changed. `pnpm build` for `apps/web` exits 0 and the monorepo suite is at 4004.

91. **`strategy-core` does NOT get `sideEffects: false`, and the reason it differs is real.** WP-O3
    measured the gain — article pages 531.8 → 472.3 KB, −21.2 KB gzipped across 16 routes — then
    reverted it and reported instead of applying. That was the right call and I am confirming it as
    a decision rather than leaving it open.

    Unlike the other three, `strategy-core` has genuine module-scope execution: lookup-table
    building loops in `analysis/evaluate.ts`, `equity/tables.ts`, `range/combo.ts` and
    `range/handClass.ts`, plus two validating assertions — `assertModel()` at
    `postflop/scoreModel.ts:1132` and an `invariant` at `postflop/rules.ts:480`. The loops are
    harmless (a dropped module drops its own initialisation with it), but the assertions have
    skip-when-unused semantics: declaring the package side-effect free means those self-checks
    stop running whenever their exports are tree-shaken away.

    Against that: the package is shared with `apps/web`, FishTilt only consumes it, and 21 KB
    gzipped is a real but non-blocking gain. Rule 8 — a FishTilt work package does not unilaterally
    change a shared package's bundler contract for a non-blocking win. **Left for the package
    owner**, with the measurement recorded so the decision can be made on numbers.

92. **Ruling 2's escalation condition was met on evidence, and the Web Worker it names was built.**
    Ruling 20 recorded preflop equity at ~200 ms and noted it sat uncomfortably close to the
    250 ms gate. Re-measured on the shipped build, click to DOM update:

    | CPU | before | after (worker) |
    | --- | --: | --: |
    | 1x | 73.3 ms | 74.3 ms |
    | **4x** | **299.8 ms** | 74.5 ms |
    | **6x** | **461.0 ms** | 80.4 ms |

    4x is the mid-range-phone case and it breaches the gate, so this is escalation on measurement
    rather than on preference. **292–470 ms of main-thread blocking per interaction became zero
    long tasks.**

    Two things make this trustworthy rather than a favourable benchmark. The agent stated the
    caveat against itself: CDP throttling only slows the renderer main thread, so the worker's
    throttled latency is flattered — on a real 4x device the answer still takes ~300 ms, but it
    arrives while the page stays interactive and `다시 계산 중…` finally paints, which it never did
    before. And the fallback path was measured **by deleting `window.Worker`**, so the shipped
    no-worker path was exercised for real rather than assumed, and is pinned by a test asserting
    `toStrictEqual` against the engine — not a stub returning a plausible number (rule 5).

93. **A stale Turbopack cache silently prerendered two published lessons as 404s, and every test
    passed.** WP-O3's first `build:fishtilt` of its session, incremental over a `.next` inherited
    from an earlier session, emitted `status: 404` and an 8,639-byte error document for
    `/learn/holdem-basics` and `/learn/poker-hand-rankings`. Both are `PUBLISHED`, on disk,
    registered, in `generateStaticParams` and in the sitemap. `rm -rf .next` over identical source
    produced zero unexpected non-200s, and every build since has been clean.

    No source defect — and that is exactly what makes it worth recording. The build is this
    project's **only** MDX validator and the last gate before deployment, and it produced a wrong
    artefact from correct source with no failing signal anywhere. **Deployments must build from a
    clean `.next`.** This belongs in the final report as a release instruction, not buried in a
    performance appendix.

94. **Both reviews independently found the same structural hole: `src/**` Korean prose had
    never been audited.** WP-P1 widened its own brief to run the three extraction filters over
    Korean string literals in `src/**` and got **six of its thirteen findings there** — the
    strategy claim (F2), the kicker rule (F6), the ×2/×4 error direction (F5), the range's
    provenance (F7), the top-X% overshoot cause (F10), the starting-hand CTA (F12). WP-P2 found
    the notation wall, the dangling connector and the disabled search button in the same half.

    Every sweep this project has run — the §47 audit, the ruling-26 sweep, both filter passes —
    pointed at `content/**`. Roughly half the user-visible sentences on this site live in
    `app/**/page.tsx` explanation cards, `features/*/copy.ts` and `components/*.tsx`, and that
    half is where the site's **most confident** claims turned out to sit: a profitability
    rationale, a universal tiebreaker rule, a shortcut's error direction, and a description of
    where the data came from that says the opposite of the truth. The site-wide advice guard I
    added to `src/content/content.test.ts` inherits the same blind spot — it reads MDX only.

    Extending that guard to `src/**` string literals is a FINAL-gate item, not optional.
    Secondary method note from P1: the specified Filter C matched percentages and decimals only,
    so F1's "10위" — a bare integer — was invisible to it. Future sweeps use the widened form
    (integer + Korean counter).

95. **The equity metric is corrected in its description, not renamed.** `HAND_STRENGTH.entries[].equity`
    is hero's expected pot share **with ties split**; 15 user-visible places called it 이기는 비율 /
    이길 확률. P1 measured the gap at up to **2.87 pp** (72o: equity 34.58%, P(win) 31.71%,
    P(tie) 5.83%) on numbers the site prints to two decimals — so the wording is wrong past the
    precision the site itself claims, which is rule 2 and rule 5 territory.

    The tempting fix is a site-wide rename of 승률. Rejected: it is the site's most-used word, a
    wholesale rename at the end of the cycle is high-churn across three concurrent writers, and
    `learn/equity.mdx` already demonstrates the cheap correct pattern — keep the friendly label,
    attach the ties-split meaning wherever the metric is *defined*, and never assert P(win).
    That is D1 in `docs/reports/WP_Q_DISPOSITION.md`, binding on all three fix agents so the
    same sentence does not come back three different ways.

96. **`about/page.tsx` said the opposite of the truth about where the range data came from.**
    It read "이 레인지는 특정 솔버나 **특정 사이트의 데이터를 베낀 것이 아니라** … 계산한 값입니다",
    while `strategy-core/preflop/tables.ts:39` — this project's own comment — says UTG/HJ/CO/BTN
    are "transcribed VERBATIM" from one public chart, single-sourced. Two more surfaces said
    "**여러** 무료 포커 교육 자료를 참고해 정리한".

    Worth recording as more than a copy fix: `/about` is the site's trust page, the one that says
    제휴하지 않습니다 and 숫자는 어디서 나오나요. A false provenance claim there costs more than the
    same sentence anywhere else, and ADR-0056 had the classification right in the code the whole
    time — only the user-facing sentence drifted. **Naming the source site publicly is not an
    agent's decision**; the fix describes the sourcing accurately without naming it, and naming
    goes to the user as an open question in the final report.

97. **One finding rejected, and the reason is the same reason the round exists.** WP-P2's m2 —
    refusal boilerplate is copy-pasted across 13 files — is accurate. It is still rejected for
    this round. Rewording thirteen files' refusal language is the highest-risk, lowest-value edit
    available, and the risk is specific rather than theoretical: this is the round in which two
    independent reviewers found advice *leaking into* content in four separate places (P2-B1,
    P1-F2, P2-M7, P2-m3). Those refusals are the mechanism that keeps that from happening.
    Loosening them for prose variety trades the product for a style improvement. Post-MVP
    follow-up.

98. **The fix round is split by file ownership, not by topic — and the obvious topic split would
    have been wrong.** §44 forbids handing one agent every unrelated fix, which suggests
    math / UX / SEO. The findings do not partition that way: F4 alone lands in content MDX, the
    content registry, `features/*/copy.ts` and a route template; F2, F7, M1 and M2 all land on the
    range surfaces. A topic split would have put three concurrent writers inside
    `RangeExplorer.tsx`, which CLAUDE.md §5 forbids outright.

    So: **Q1 owns `content/**` + `src/content/registry/**`, Q2 owns `features/**` + `app/tools/**`
    + `about` + `practice` + `Range*.tsx` + `PotOddsCalculator.tsx`, Q3 owns the homepage, glossary
    index, `hands/[hand]`, `Site*.tsx`, the two calculators, `routes.ts` and every e2e spec.** No
    file appears in two columns; where a file carried findings from both reviews
    (`hands/[hand]/page.tsx` has F4's wording and M13's reorder) the whole file went to one agent.

    Second consequence: **no fix agent runs `build:fishtilt`, `e2e:fishtilt`, `typecheck` or
    `lint`.** Three concurrent writers sharing one `.next` would produce failures that belong to
    nobody, and ruling 93 already showed what a bad `.next` does to this project's trust in its
    own gates. Agents run targeted vitest; MASTER runs the real gates serially after integration.

99. **Ruling 85 resolved: the Korean suit names are done, and the e2e churn is not a reason.**
    Cards announce as "A black spade suit" to a screen reader on a Korean-language site, on the
    most fundamental object the site has, and `SUIT_KOREAN` already exists. It was deferred once
    because it churns ~20 e2e locators. Updating a locator is mechanical; a Korean product
    speaking English to assistive tech is not. Assigned to Q3 with the explicit instruction to
    fix the locators and keep the assertions — the failure mode to avoid here is a weakened
    assertion dressed as a locator update (§59).


100. **A test can pass and still endorse the defect. Q1's narrowed assertion is approved; the
     test next to it was the real problem.** WP-Q1 reported, correctly and unprompted, that it had
     narrowed an existing assertion in `registry/blog/i4.test.ts`: `outs-nine` was absolutely
     banned from citing `OUTS_PROB 9|FLOP|NEXT`, and F8's fix cannot state which side of the price
     the call lands on without exactly that number.

     **Approved.** The ban was an *anti-duplication* rule (the lesson opens on the same 9-out
     scenario); F8 is a *correctness* requirement, and CLAUDE.md's priority order puts correctness
     first. The narrowing is also tighter than the original in one respect — it pins **placement**,
     not just count: at most one occurrence, inside the pot-odds synthesis section, with `TURN|NEXT`
     still banned outright. An assertion changed because MASTER changed the requirement is not §45
     weakening; an assertion changed to get green is. Q1 named which one it was doing, which is why
     this took a minute to rule on instead of an audit.

     What Q1 did **not** catch, and I did: the test immediately below it,
     `'outs-nine + pot-odds-quick synthesis: 9-out draw clears the 9|3 break-even bar'`, asserted
     `byRiverProb > requiredEquity` and passed — while pinning, in its own title, the exact claim
     F8 forced the article to withdraw. Arithmetically true, and endorsing the defect. It now pins
     **both** directions: by-river clears the bar, and `nextCardProb` (19.15%) does **not** clear
     the 20.00% price. That is the distinction the whole finding turns on, and it is now the thing
     the suite protects.

     Generalisable: when a review invalidates a *comparison*, grep the tests that pin the old
     comparison's conclusion. A green suite is evidence about the code, not about whether the
     claim the code makes is still one we want to make.

101. **`가장 널리 쓰이는 세는 방식` is dropped — a narrowing of ADR-0081's phrasing, not a
     reopening of it.** Q1 flagged the tension and, per rule 9, restored the pinned phrase rather
     than deciding for itself. Correct escalation.

     The ruling: ADR-0081 settles **which** convention FishTilt counts by (the big blind is the
     first bet). Untouched. But the ADR's text says "the ordinary hold'em convention" — it nowhere
     says *most widely used*, and its own consequence clause forbids presenting a competing count
     as equally standard **without a cited source**. Read symmetrically, that same rule forbids
     ranking our own convention as the most widely used with no source either. The article was
     doing both at once: line 7 claimed the superlative, and the FAQ fourteen lines later said the
     site has no evidence about how widely the alternative is used.

     `가장 널리 쓰이는` → `홀덤에서 일반적으로 쓰이는`, which is what the ADR licenses, and the
     test now pins that phrase **and** asserts the superlative's absence. The superlative was
     WP-I4's implementation of the ADR, never the ADR's own words — which is exactly the line
     between narrowing a claim and reopening a decision.

     This is the same defect family as F7 and B1: an unsourced confident sentence sitting on top
     of a correct, documented decision. Three for three this round, on three different surfaces.


102. **A session rate limit killed Q2 and Q3 mid-edit. The recovery rule: audit the tree, not the
     agent's last words.** Both agents died with a partial sentence as their only report — Q2's was
     "Now the full suite", Q3's was "Now the layout swap for both calculators". Neither is a status.

     Two traps, and they point in opposite directions. **The suite was green** — 1344 passing, up
     from Q1's 1336 — which is reassuring and means nothing about completeness: a killed agent
     leaves *finished* edits behind, so green proves the partial work is self-consistent, not that
     the worklist is done. And **the dying messages misreported progress in both directions**: Q2's
     "now the full suite" undersold an almost-complete list (its blocker, six should-fixes and four
     more were all landed), while Q3's "now the layout swap for both calculators" read like the
     start of that task when `HandChecker` was in fact already done and `EquityCalculator` already
     carried the doc comment for a fix its code had not received yet. Relaunching on either
     reading would have wasted a full agent or left a half-written file.

     So MASTER audited each finding against the tree directly — greps for the specific defective
     strings, the advice scanner re-run over `src/**` — and relaunched with an explicit
     **"already done: verify, do not redo / still open: this is your work"** split. That audit cost
     perhaps fifteen tool calls and saved two agents' worth of duplicated work.

     Worth keeping for any interrupted delegation: a resumed agent needs the *state of the tree*,
     not the transcript of the agent it replaces. And the check that settled F2 fastest was not
     reading the file — it was re-running the independent scanner MASTER had already calibrated
     against the known defect, which answered "is the blocker gone" in one command with no
     judgement call in it.


103. **My "still open" list for the resumed agents was wrong on four of four, and the recovery
     agent caught it by verifying instead of obeying.** MASTER's audit (ruling 102) flagged M2, M10,
     the M1 tool half and m9 as unfinished. All four were already complete — WP-Q2 had got through
     its **entire** worklist and died with only its report unwritten. WP-Q2b re-checked each of the
     sixteen findings in source rather than trusting the brief that told it four were open, changed
     nothing, and wrote the missing report.

     That is the behaviour the brief asked for ("VERIFY, do not redo") and it is worth naming
     because the failure mode was live: an agent told "these four are open" will cheerfully rewrite
     four finished fixes, and the second implementation is not guaranteed to be the better one. A
     grep-based audit under time pressure reads absence-of-evidence as evidence-of-absence —
     `grep 'showNotation'` found the prop and not the `NotationKey` component sitting beside it.
     **Audit conclusions handed to a resumed agent are a hypothesis, not a worklist.**

104. **Two items came back from Q2b for MASTER, and both were right to escalate.**

     **(a) A cross-boundary edit, approved.** WP-Q2 edited `components/HandChecker.test.tsx` —
     Q3's file — while fixing F11. The change stopped the component test from transcribing
     `handRank.ts`'s note as a string literal and derived it from `evaluateHandRank` instead, the
     same call the component makes. That is strictly stronger: the literal was a second copy of the
     sentence that went stale the moment F11 corrected the original, which is precisely how it was
     discovered. Approved on merit — but it is still a boundary breach that went unreported by the
     agent that made it, in a file another agent was about to work in. Q3b's landing is checked for
     a lost update on that file.

     **(b) The D4 borderline, fixed rather than waived.** `RANGE_PROVENANCE_SENTENCE` was typing
     `6인 테이블·100BB` as prose while `TABLE_SIZE_LABEL` and `stackDepthLabel` — the formatters
     that own exactly that vocabulary — sat forty lines below it in the same file. Q2b flagged it
     and declined to refactor because MASTER had already accepted F7 as complete. Correct
     escalation, and the right call is to fix it: a prose copy of vocabulary owned elsewhere is a
     second spelling that goes stale on the first change, which is the identical defect that
     produced F7, where one dataset was described three different ways on three surfaces. The
     sentence now renders through the formatters; the digits survive only as named constants
     saying *which* chart, the way a fact argument names which hand. All 84 tests over the range,
     about and range-tool surfaces still pass, which also confirms the rendered string is
     unchanged.


105. **The e2e suite was pinning a sentence WP-P1 had proved false, and it took a gate run to
     find out.** The first full `e2e:fishtilt` of the round produced two failures, and both were
     the same defect: a spec holding another module's copy as a string literal.

     - `equity.spec.ts` transcribed `보드는 0장(프리플롭)…` and broke when the 플랍 spelling canon
       reached that message. Harmless, but a whole gate run spent on a copy edit the assertion was
       never about.
     - `hand-checker.spec.ts` transcribed `보드에 놓인 다섯 장이 이미 당신의 핸드보다 강합니다.` —
       **the exact sentence F11 removed for being false.** When the board plays, the board *is*
       the player's hand; it cannot be stronger than it. So the browser suite was actively
       asserting the defect, and would have gone red on the correct behaviour.

     That is the sharper version of ruling 100. A transcribed assertion does not merely go stale —
     **it pins the defect**, and the greener the suite the more confidently it does so. WP-Q2 had
     already made exactly this correction in `HandChecker.test.tsx` (ruling 104a) and the e2e copy
     of the same literal survived, because nothing pointed at `tests/e2e/` when the note changed.

     Both now derive from the owning module — `evaluateHandRank` and `equityPendingMessages`,
     imported into the spec, which is a first for this app's e2e layer and typechecks clean. The
     rule going forward: **an e2e spec asserts that the page renders the module's output, never
     what that output says.** Wording is the owning module's test's job.

     One self-inflicted detour worth recording: my first derivation destructured
     `equityPendingMessages(...)[0]` and got the *hero-cards* message, because the function returns
     one message per unmet condition. Two failed runs before I stopped guessing and read the actual
     rendered DOM against the actual module output, which showed the mismatch instantly. Read the
     evidence before the second guess, not after it.

106. **One pre-existing flaky test, recorded rather than papered over.**
     `packages/strategy-core/src/postflop/benchmark.test.ts:249` compares two wall-clock
     measurements (`6-way flop` must cost more than `HU flop`). It failed once during the final
     full-suite run and then passed on the next two full runs and **5/5 in isolation**, so it loses
     a scheduler race under parallel load. It takes the minimum of five runs specifically to damp
     this, and that is still not enough on a busy machine.

     It is **not** a FishTilt regression: `strategy-core/postflop` is outside every fix agent's
     boundary and this round's only contact with that package was *reading* `preflop/tables.ts`
     for provenance. Making it deterministic means comparing operation counts rather than
     durations — a real fix, in another package, and out of scope here (rule 8). Carried to the
     final report as a known issue with its reproduction, not silently re-run until green.


## Status

| WP | Scope | Status |
| --- | --- | --- |
| Phase 0 | Audit and plan | **done** — `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` |
| WP-0 | Scaffold, workspace registration, layering guards | **done** — `docs/reports/FISHTILT_WP0_SCAFFOLD.md` |
| WP-A | Design system, app shell, card primitives | **done** — `docs/reports/FISHTILT_WPA_DESIGN_SYSTEM.md` |
| WP-B | `learn-core`: outs, exact heads-up equity, hand-class facts | **done** — `docs/reports/FISHTILT_WPB_DOMAIN_MATH.md` |
| WP-R | Data research report + starting-hand strength dataset | **done** — exhaustive dataset, 82/82 tests, `docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md` |
| WP-C | `RangeMatrix` + range facade | **done** — `docs/reports/FISHTILT_WPC_RANGE_MATRIX.md` |
| WP-D | Range Explorer, filters, compare | **done** — `docs/reports/FISHTILT_WPD_RANGE_EXPLORER.md` |
| WP-E | Hand rankings, Starting Hand Explorer, `/hands/*` | not started |
| WP-F | Pot odds, outs, hand checker, equity tools | **part 1 done** — `/tools`, `/tools/pot-odds`, `/tools/outs` (`docs/reports/FISHTILT_WPF1_TOOLS_POTODDS_OUTS.md`); equity + hand checker not started |
| WP-G | MDX pipeline, content registry, graph | **done** — `docs/reports/FISHTILT_WPG_CONTENT_SYSTEM.md`; pipeline settled by ADR-0080 |
| WP-H | 15 Korean lessons | not started |
| WP-I | 20 blog articles + ~45 glossary terms | not started |
| WP-I2 | Quiz system | not started |
| WP-J | Homepage | not started |
| WP-K | SEO: metadata, sitemap, robots, OG, JSON-LD | not started |
| WP-L | Global search | not started |
| WP-L2 | Responsive, a11y, performance | not started |
| WP-M | Two adversarial reviews + fixes | not started |
| WP-N | Final verification + `FISHTILT_FINAL.md` | not started |

## Open blockers

None. The hand-strength dataset blocker was resolved 2026-09-05 00:54.

`packages/learn-core/src/strength/dataset.generated.ts` is now exhaustive: 354,489,735,600
scored trials, `C(50,5)` boards against all 1,225 opponent hands per class. AA is
`0.8520371330210104`, bit-identical to an independent oracle measurement, and suit-symmetry
deviation is exactly `0` across 17 classes — so the 169-instead-of-1326 shortcut is exact,
not merely within tolerance. `exactTies` is empty, so a "top X%" cut can never split a tie.
`pnpm vitest run --project learn-core` -> **82 passed, 0 failures**.

The one caveat that survives: this ranks hands by **all-in equity against a random hand**,
which is a property of the cards. It is NOT a claim about how profitably a hand plays, and no
copy on the site may let a reader take it as one.

Detail: `docs/reports/FISHTILT_QA_01_ORCHESTRATOR_REVIEW.md` §4.

**Why the symmetry deviation is exactly 0, and not merely small.** `strategy-core` stores
range weights as `Uint16Array` basis points, and a uniform villain range has one distinct
value, `BPS_FULL` (10000). Heads-up, every accumulator increment is then an integer (a win
adds 10000, a tie 5000), and the largest total any class reaches is 2,097,572,400 x 10000 =
2.0975724e13 — **429x below 2^53**. Every partial sum is exactly representable, so the
addition is exact and order-independent and bit-identity is forced rather than lucky. This
matters because it is the whole licence for computing 169 classes instead of 1326.

`HAND_STRENGTH_SYMMETRY_TOLERANCE`'s doc comment previously derived 1e-9 from a
`sqrt(n) * eps` rounding budget. That reasoning describes accumulations that round, and
these do not; the conclusion was safe but the argument was wrong, so it has been replaced
with the above. 1e-9 is a tripwire that must never fire, not a rounding allowance — it sits
6,064x below the smallest real gap between adjacent classes (6.0639e-6, `72s` vs `54o`).

## Orchestrator rulings on handed-back items

These were raised by WP agents that correctly declined to decide them alone.

1. **`draws.ts` stays in `apps/fishtilt`, not `learn-core`.** WP-F1 flagged that its card
   combinatorics belongs beside `outs.ts` in the domain package. Half right: the *numbers*
   (a flush draw has 9 outs, derived from `RANKS`/`SUITS`) are domain, but each preset also
   carries a Korean label and a Korean derivation sentence, and Korean UI copy in a domain
   package is worse layering than app-local combinatorics. Splitting the file across the
   package boundary buys nothing while there is exactly one consumer. The constants move the
   day a second one appears — WP-E or WP-H — and not before.
2. **The calculators read no URL params.** Deep-linking a pre-filled pot size
   (`<ToolCTA tool="toolPotOdds" params={{ pot: '6' }} />`) is not built. It is not needed
   until a lesson actually wants it; WP-H adds it then, against a real article rather than a
   guess about one.
3. **`tests/e2e/learn.spec.ts` stays**, though WP-G added it outside its stated boundary. It
   tests what WP-G built and it passes; deleting real coverage to enforce a file boundary
   would be a net loss.
4. **`RangeSummary`'s chart notation is opt-in (`showNotation`, default off).** WP-C flagged
   the risk and WP-G's lesson made it real. The Explorer opts in because the
   `이 기준은 무엇인가요?` disclosure sits beside it; an article does not.

## Settled decisions

Not reopened without falsifying evidence, per CLAUDE.md rule 9.

1. **FishTilt is `apps/fishtilt`**, a new app in this monorepo, with `packages/learn-core`
   for its domain logic. `apps/web` is not touched; `strategy-core` is reused read-only.
   (User decision, 2026-09-04.)
2. **MVP range coverage is 6-max / 100BB / First-In only**, for UTG, HJ, CO, BTN, SB. BB is
   explained rather than errored. Facing Open, Facing 3-Bet and all other stack depths show
   an honest "준비 중" state, because the repo's continue tiers are self-declared
   `HEURISTIC` and are not a verified dataset. (User decision, 2026-09-04.)
3. **The word "GTO" never appears in FishTilt's UI.** Nothing in this repository is solver
   output (CLAUDE.md rule 2, ADR-0056). Ranges are labelled 학습용 기본 레인지.
4. **No fabricated numbers.** An unsupported filter returns a typed `UNSUPPORTED` and the
   UI says so. There is no fallback range and no interpolated stack depth.
5. **The starting-hand strength ranking is generated, not opined.** Methodology A —
   heads-up preflop all-in equity vs a uniformly random hand — computed by a reproducible
   offline script, frozen, with explicit tie bands and a rank-stability acceptance test.
6. **No affiliate, casino, deposit or bonus surface**, and no live-play assistance of any
   kind (ADR-0029).
7. **Prose is MDX; structure is typed TypeScript** (ADR-0080). Proven by spike to compile
   under this app's `nodenext`/Turbopack config, to render imported React components inside
   prose, and to keep routes statically prerendered.
8. **A hand class is shown with its spoken Korean reading** beside the unchanged Latin key
   (`AKs · 에이스 킹 수티드`), per build spec §10/§21. This adds a pronunciation gloss; it does
   not translate the notation, so ADR-0053 stands.

## Observations for other owners

- **`packages/strategy-core/src/equity/equity.ts`'s file-header comment is stale.** It states
  preflop equity is "SUBSAMPLED (always) ... whatever the budget"; line 385 returns `EXACT`
  when `table.exhaustive && runoutsExhaustive`, preflop included, and that path was measured
  working (74.7 s for one hand class against all 1225 opponents over all 2,118,760 boards).
  The code is correct and the prose is not. `strategy-core` is read-only for FishTilt, so
  nothing was changed — recorded here for that package's owner.
- `apps/web/package.json` depends on `@gto-self/strategy-core` and `@gto-self/adaptive-core`,
  but `apps/web/next.config.ts` `transpilePackages` lists neither. Noted during the WP-0
  audit; belongs to the in-flight session, not to FishTilt.

## Known limitations

- ~~The homepage is a WP-0 wiring proof~~ — **done 2026-09-05 by WP-M**: the nine spec sections,
  every destination resolved through the registry or the content graph. Nothing on it currently
  renders a `준비 중` badge, because every route and every linked record is now built.
- **No content record carries a date.** `ContentRecord` has no temporal field, so the homepage's
  "latest learn/blog" section cannot actually be *latest*. WP-M reported this instead of inventing
  an order, and states published totals with no recency claim — the right call: a "최신" heading
  over an arbitrary slice is a small lie of exactly the kind this project spends its effort not
  telling. Adding `publishedAt` is a content-architecture change and is **not** being done as a
  drive-by; if a reviewer wants true recency it is a scoped follow-up.
- `pnpm verify` does not yet build FishTilt. Fold into the FINAL gate.
- No preflop range data exists for any spot other than first-in, or any stack other than
  100BB. This is a data limitation, not a bug, and the UI states it — including the homepage
  range preview, which for BB renders the facade's own explanation and **no grid at all** rather
  than an empty 13x13.
- The position abbreviations `UTG` / `HJ` / `CO` / `BTN` / `SB` render as bare labels on every
  range surface, with no gloss near the control (ruling 65). ADR-0053 keeps the abbreviations;
  the missing piece is a one-time explanation. Assigned to WP-O2.

## Commands

| Command | What |
| --- | --- |
| `pnpm dev:fishtilt` | FishTilt dev server on :3220 |
| `pnpm build:fishtilt` | Production build |
| `pnpm e2e:fishtilt` | Playwright, production build on :3221 |
| `pnpm vitest run --project fishtilt` | App unit/component tests |
| `pnpm vitest run --project learn-core` | Domain tests |
