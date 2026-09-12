# FishTilt — Remainder Phase 0: Baseline Audit

Read-only audit of the tree as it stands after WP-0 through WP-G (per `docs/FISHTILT_STATE.md`).
No source was modified. Audited 2026-09-05.

---

## 1. Scope

`apps/fishtilt` (Next 16 App Router, public Korean beginner poker site) and
`packages/learn-core` (its domain layer, reusing `packages/strategy-core` read-only). A
separate in-flight session has uncommitted work in `apps/web` and `packages/db` — confirmed
present (`git status --short` lists ~164 changed paths there) and **not touched or inspected
beyond what CLAUDE.md/the state docs already say**. `apps/fishtilt/` and `packages/learn-core/`
are themselves entirely **untracked** (`git status`: `??`), i.e. wholly new/additive — no
existing file was edited to build them.

---

## 2. Baseline verification — real numbers

| Gate | Command | Result |
| --- | --- | --- |
| Working tree | `git status --short` | 164 total changed/untracked paths repo-wide; `apps/fishtilt/**` and `packages/learn-core/**` are untracked (new), no modification to any pre-existing file attributed to FishTilt |
| Typecheck | `pnpm typecheck` (`pnpm -r --parallel typecheck`, 13 projects incl. `apps/web`) | **All 13 "Done", 0 errors** — `apps/fishtilt` and `packages/learn-core` clean; `apps/web` (the other session's in-flight work) also currently clean. 3.24s wall (parallel). |
| learn-core tests | `pnpm vitest run --project learn-core` | **7 files / 82 tests passed, 0 failed** (3.95s) |
| fishtilt tests | `pnpm vitest run --project fishtilt` | **47 files / 425 tests passed, 0 failed** (2.95s) |
| Lint | `npx eslint apps/fishtilt packages/learn-core --max-warnings=0` | **clean, exit 0**, 0 warnings |
| Build | `pnpm build:fishtilt` | **Compiled successfully.** Route table below. |
| E2E | `pnpm e2e:fishtilt` (production build on :3221) | **49/49 passed** (4.8s test run; one benign `[WebServer] Error: Internal: NoFallbackError` printed to the dev server log during the "unknown slug → 404" test — expected 404 path, test still passed; see §6 for whether this is worth a closer look) |

**Build route table** (`pnpm build:fishtilt`):

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /learn
├   /learn/[slug]
│ └ ● /learn/poker-range
├ ○ /tools
├ ○ /tools/outs
├ ○ /tools/pot-odds
└ ○ /tools/range

○  (Static)  prerendered as static content
●  (SSG)     prerendered as static HTML (uses generateStaticParams)
```

Every route is static or SSG. Nothing is dynamic-per-request — consistent with "no DB, no
login, no session" (there is no `ƒ` row at all).

**`pnpm verify` does NOT build FishTilt** — confirmed by reading root `package.json`:
`"verify": "pnpm typecheck && pnpm test && pnpm lint && pnpm lint:licences && pnpm build"`,
and `"build": "pnpm --filter @gto-self/web build"`. `pnpm test` (bare, no `--project`) DOES
run `learn-core` and `fishtilt` (they're registered projects in `vitest.config.ts`), but
`pnpm build`, `pnpm e2e` and `pnpm lint:licences` do not touch FishTilt. Matches
`docs/FISHTILT_STATE.md`'s "Known limitations" claim exactly.

**Equity engine worst-case timing — measured, not guessed.** Preflop 2v2, 0 board cards,
`C(48,5) = 1,712,304` runouts, via `exactHeadsUpEquity` (single-threaded, Node/tsx,
Apple-class CPU, this machine): **80–93ms per call**, 5 consecutive in-process runs after
JIT warm-up settled at 80.0–85.2ms. Script and raw output kept below (§3, Q2).

---

## 3. The seven answers

**Q1 — hand evaluator.** `packages/strategy-core/src/analysis/evaluate.ts`. `evaluateStrength(cards): number` — packed int, hot path, accepts 5/6/7 distinct cards, returns only a comparable score. `evaluateHand(cards): HandValue` — decomposed `{strength, category, ranks}`. `bestFiveOf(cards): BestFive` (`{value: HandValue, cards: readonly Card[]}`) — **this is the one that returns the actual winning 5 cards**, by explicit `C(n,5)` enumeration, lexicographically-first optimal subset on ties. `compareHands(a,b)`, `decodeStrength`. All exported from the package barrel. Fully reusable for the Hand Checker (WP-F2) with zero new evaluator code — `bestFiveOf` is exactly the display primitive that UI needs.

**Q2 — exact equity engine.** Two engines exist, cleanly divided by scope:
- `packages/learn-core/src/equity/exact.ts` — `exactHeadsUpEquity(hero, villain, board)`: HAND-vs-HAND (not range), all 4 board lengths (0/3/4/5), full enumeration (`C(48,5)`/`C(45,2)`/`C(44,1)`/`C(43,0)`), reuses `strategy-core`'s `evaluateStrength`, always reports `method: 'EXACT'`. **Measured worst case (preflop, 0 board): 80–93ms**, well inside a Web-Worker-friendly budget (still worth a Worker per the audit's own risk #5, since 80ms blocks the main thread).
- `strategy-core`'s `equityVsRange`/`equityVsRanges` (`src/equity/equity.ts`) — HAND-vs-RANGE(s), up to 5 villains, `DEFAULT_EQUITY_BUDGET = {maxTrials: 2_000_000, maxAssignments: 20_000, minRunoutSamples: 192, maxRunoutSamples: 100_000}`. Reports `EXACT` on flop/turn/river and — contrary to its own file-header comment, which is **confirmed stale** by direct code read (line ~301: `table.exhaustive && runoutsExhaustive ? 'EXACT' : 'SUBSAMPLED'`) — also `EXACT` preflop whenever the villain range is small enough to exhaust the assignment budget. This staleness is already flagged in `docs/FISHTILT_STATE.md` "Observations for other owners"; re-confirmed here by reading the code directly, not re-litigated (`strategy-core` is read-only for FishTilt).

**Q3 — 13×13 Range Matrix / range facade.** `apps/fishtilt/src/components/RangeMatrix.tsx` (controlled, `range: HandClassSet | null` + `selectedKey` + `onSelectKey`, renders `HAND_CLASSES` directly so DOM order is matrix order by construction, contrast-audited, `ResizeObserver`-driven overflow cue). Facade: `apps/fishtilt/src/features/range/{types,resolve,notation,copy}.ts` — `resolveRange(query): RANGE | UNSUPPORTED` over the full 216-point query space (heroPosition × spot × stackDepth × tableSize), zero fallback branch. **Directly reusable for the Starting Hand Explorer (WP-E2)** with no new component: `RangeMatrix` already accepts `range: null` for a bare 169-cell picker with no membership coloring, which is exactly what a "pick your starting hand" UI needs, and `SelectedHandPanel`/`handClassReading` already exist for the "what does this mean" panel.

**Q4 — every route that exists today**, from `find apps/fishtilt/src/app`:

| Route | Type | Status |
| --- | --- | --- |
| `/` | Static | WP-0 wiring proof, not the WP-J homepage (per `FISHTILT_STATE.md`) — a finished-looking but structurally temporary surface |
| `/learn` | Static | Finished hub — reads the registry, honest PLANNED/PUBLISHED split |
| `/learn/[slug]` | SSG (1 param: `poker-range`) | Finished template; only 1 of 15 lessons published |
| `/tools` | Static | Finished hub |
| `/tools/pot-odds` | Static | Finished product surface |
| `/tools/outs` | Static | Finished product surface |
| `/tools/range` | Static | Finished flagship surface (RFI/100BB/6-max only, honestly) |

Nothing else exists under `src/app` — no `/tools/equity`, `/tools/hand-checker`,
`/tools/starting-hand`, `/practice/*`, `/glossary*`, `/blog*`, `/hands*`, `/search`, `/about`,
`/ranges/6max/*`, `/sitemap.xml`, `/robots.txt`, `/og/*`. `src/lib/routes.ts` lists these as
`available: false` and a filesystem-backed test (`routes.test.ts`) keeps that claim honest.

**Q5 — Learn infrastructure.** MDX pipeline (`@next/mdx`, `mdx-components.tsx`, typed
allow-list of 7 components), typed content registry (`src/content/registry/*`,
`src/content/types.ts`), graph (`src/content/graph.ts`, 37-assertion `content.test.ts`),
lesson route template (`src/app/learn/[slug]/page.tsx`, static + `dynamicParams=false`).
**1 of 15 registered lessons is `PUBLISHED`** (`poker-range`). Adding lesson #6 concretely
requires touching exactly 3 files, confirmed by reading the actual mechanism:
1. Write `apps/fishtilt/content/learn/<slug>.mdx` (prose, using only the 7 allow-listed
   components, no `import`/`export`, no bare `<h1>`, first `<Term>` introducing each concept).
2. Add one import + map entry to `apps/fishtilt/src/content/lessons.ts`'s `LESSON_MDX`
   (the module's own doc comment says exactly this is WP-H's job, per file).
3. Flip that lesson's record in `apps/fishtilt/src/content/registry/learn.ts` from
   `status: 'PLANNED'` to `'PUBLISHED'`, and set `readMinutes` to the value
   `content.test.ts` will independently recompute via `estimateReadMinutes()`.
`content.test.ts` then re-validates automatically (no new test file needed) and the MDX must
independently clear `threshold.ts`'s learn-kind floor (1500 prose chars, 4 `##` sections, 2
distinct allow-listed components, 1 tool CTA, 1 next-step link, 2 `relatedConcepts`) to be
marked `indexable`.

**Q6 — content graph / registry (WP-G).** `ContentRecord` (`src/content/types.ts`) implements
the audit's field list verbatim plus `status: 'PUBLISHED'|'PLANNED'` and
`readMinutes: number|null` (not in the original sketch, added and justified in-file).
Validators: `content.test.ts` (37 assertions — id/slug uniqueness, no dead link, acyclic
prerequisites, gapless lesson ordering, glossary alias uniqueness, relation-kind type
correctness, no bare "GTO", no duplicate relation heading, indexable⇒threshold-cleared),
`threshold.test.ts`, `graph.test.ts`. Counts as registered (not the target ~35/~45):
**15 learn** (1 PUBLISHED / 14 PLANNED), **3 blog** (target ~20), **8 glossary** (target
~45), **2 hands** (target 169 routes / 20 authored). Components: `RelatedContent` (exists,
generic — covers "LessonNavigation" via a `nextLessons` relation heading, no separate named
component), `ToolCTA` (exists), `Term` (exists — covers "GlossaryLink" via a native
`popovertarget`/`popover` pair, no separate named component), `MiniQuiz` (exists, minimal —
see §5), `RangeMatrixMini` (exists), `PokerCards` (exists), `Fact` (exists — the one addition
beyond the plan's sketch; resolves named facts like `COMBO_COUNT`/`RFI_PERCENT` so prose
never hand-types a number), `Callout` (exists). **"InlineTool" as a distinct name does not
exist** — `ToolCTA` is the one deep-link primitive and covers that role.

**Q7 — where remaining plan conflicts with reality.**
- **CardPicker: already built**, contrary to the Phase-0 audit's "new" listing.
  `apps/fishtilt/src/components/CardPicker.tsx` exists today — controlled component
  (`value`/`onChange`), grouped by suit, `usedCards`/`max` support, 44px touch targets,
  full a11y (`role="group"`, `aria-pressed`, `aria-label` per cell, real `<button>`s). It is
  exactly the "공통 CardPicker 재사용" the spec assumed for the equity calculator and hand
  checker — no new component is needed for WP-F2's card-entry UI.
- **No search index, no quiz engine, no glossary route, no blog route, no `/hands` route
  infrastructure exists at all.** `MiniQuiz.tsx` exists as a component (used inside MDX,
  per-lesson) but there is no `/practice/*` quiz-taking route or scoring engine — that is a
  distinct, unbuilt system from the inline component. `/glossary`, `/blog`, `/hands` have
  registry data and a URL-shape contract (`CONTENT_ROUTE_TEMPLATE` in `graph.ts`) but **zero
  route templates on disk** — confirmed by `find apps/fishtilt/src/app`. WP-G's own report
  flags this explicitly: "the graph knows their URL shapes and the test will demand a
  template the moment a record of that kind is published, so WP-E/WP-I cannot publish one
  without building the route." This is accurate and current.
- **Starting-hand strength dataset shape**: matches the spec's assumed shape closely but not
  exactly. `HandStrengthEntry` carries `key`, `classIndex`, `equity`, `rank`, `comboCount`,
  `cumulativeCombos`, `cumulativeShare` — there is no field literally named `percentile` or
  `equityBps`; `rank`+`cumulativeShare` together are the percentile-equivalent, and `equity`
  is a plain `0..1` float, not basis points (deliberately — CLAUDE.md rule 1 only mandates
  integer milliBB for *money*, and this is a probability, so a `Bps` encoding would be a
  false precision claim, not a correctness requirement). Any WP consuming this dataset should
  read `ranking.ts` directly rather than assume a `equityBps`/`percentile` field exists.

---

## 4. Reusable inventory

| Symbol | File | What it gives you |
| --- | --- | --- |
| `evaluateStrength`, `evaluateHand`, `bestFiveOf`, `compareHands` | `packages/strategy-core/src/analysis/evaluate.ts` | 5/6/7-card evaluation; `bestFiveOf` returns the actual winning subset for the Hand Checker |
| `exactHeadsUpEquity` | `packages/learn-core/src/equity/exact.ts` | Exact hand-vs-hand equity, all streets, `EXACT` always, measured 80–93ms worst case |
| `equityVsRange`/`equityVsRanges` | `packages/strategy-core/src/equity/equity.ts` | Hand/range-vs-range(s), multiway, `EXACT` on flop+/preflop-when-small, `SUBSAMPLED` otherwise |
| `RangeMatrix` | `apps/fishtilt/src/components/RangeMatrix.tsx` | 13×13 grid, controlled, `range:null` mode = bare 169-cell picker (reusable for Starting Hand Explorer) |
| `resolveRange`, `RangeQuery`, `RANGE`/`UNSUPPORTED` | `apps/fishtilt/src/features/range/{resolve,types}.ts` | Honest range facade, full 216-point space covered, zero fallback |
| `SelectedHandPanel`, `handClassReading` | `apps/fishtilt/src/components/SelectedHandPanel.tsx`, `features/range/copy.ts` | Per-hand explanation panel + Korean pronunciation gloss, reusable for hand pages |
| `handStrengthOf`/`handStrengthAt`/`handStrengthForKey`/`topHandsByShare` | `packages/learn-core/src/strength/ranking.ts` | The "top X%" slider API, exact dataset, no sampling error |
| `handClassFactsOfCards`/`handClassFactsForKey` | `packages/learn-core/src/handClass/facts.ts` | Structured per-hand facts (kind, comboCount, universeShare, exampleCards) for hand pages |
| `potOdds`, `outsOdds` | `packages/learn-core/src/{potOdds,outs}.ts` | Already shipped calculators' domain math |
| `CardPicker` | `apps/fishtilt/src/components/CardPicker.tsx` | Controlled 52-card picker, a11y-complete — reusable as-is for equity calc + hand checker |
| `MDX_COMPONENT_ALLOW_LIST`, `mdx-components.tsx` | `apps/fishtilt/src/content/allowList.ts` | The 7-component prose surface; extending it is a one-line, test-enforced change |
| `resolveRange`+`RangeMatrix`+`ToolCTA`+`Fact` | (composed) | Everything WP-E2 (Starting Hand Explorer) needs already exists as building blocks; only the page/composition is new |

---

## 5. Gaps vs master plan

| Area | Plan target | Actual | Gap |
| --- | --- | --- | --- |
| Learn lessons | 15 authored | 1/15 `PUBLISHED` | 14 lessons to write (WP-H) |
| Blog articles | ~20 | 3 registered, 0 `PUBLISHED`, no `/blog` route | Full WP-I + a route template |
| Glossary terms | ~40–50 | 8 registered, 0 `PUBLISHED`, no `/glossary` route | ~37+ terms + a route template |
| Hand pages | 169 routes, 20 authored | 2 registered, 0 `PUBLISHED`, no `/hands` route | Route template + 18+ authored pages (WP-E) |
| Quiz system | range/hand-ranking/starting-hand quizzes | `MiniQuiz` inline component only; no `/practice/*` route, no scoring engine | Whole system (WP-I2) |
| Homepage | 9 sections, real components | WP-0 wiring proof only | WP-J in full |
| SEO | metadata, sitemap, robots, OG, JSON-LD | Minimal `generateMetadata` (title/description/robots.index) only, by design (WP-G report §9) | WP-K in full |
| Search | global search | Nothing built | WP-L in full |
| Equity calculator / Hand checker | WP-F2 | Not started; `toolEquity`/`toolHandChecker` are `available: false` | WP-F2, now with CardPicker and both evaluator/equity engines confirmed reusable, zero new domain code needed |
| Starting Hand Explorer | WP-E2 | Not started | Composition-only work per §3/§4 above — no new domain primitive required |

---

## 6. Risks / conflicts needing an orchestrator decision

1. **`equity.ts`'s stale file-header comment** (still says preflop is "SUBSAMPLED (always)")
   is now confirmed twice — once by the prior session's note, once by this audit reading the
   code directly. `strategy-core` is read-only for FishTilt, so no FishTilt WP can fix it.
   This is a `strategy-core`-owner item, not a FishTilt blocker, but any FishTilt developer
   reading that file's header alone will be misled about what the equity calculator (WP-F2)
   can safely claim for a small preflop villain range. Recommend: flag to the `strategy-core`
   owner (out of FishTilt's file boundary) rather than editing it here.
2. **`[WebServer] Error: Internal: NoFallbackError`** appeared once in the e2e run's server
   log during the "unknown lesson slug 404s" test. The test passed (49/49), and this looks
   like Next 16's internal control-flow signal for a deliberate `notFound()` on a
   `dynamicParams: false` route rather than a real defect — but it was not root-caused here
   (out of this audit's scope to debug, since it is read-only and the behavior is already
   covered by a passing assertion). Recommend a WP that touches `/learn/[slug]` confirm this
   is benign before shipping WP-H's 14 remaining lessons at volume.
3. **Content volume math**: the "reusable inventory" in §4 makes WP-E2 and WP-F2 look nearly
   free architecturally, but §5's real gap is almost entirely **content authoring volume**
   (14 lessons, ~17 blog articles, ~35+ glossary terms, ~18+ hand pages), exactly as the
   original Phase-0 audit's risk #1 predicted. Nothing found in this pass changes that
   assessment — it is restated here as confirmed, not new.
4. **No route templates for `/blog`, `/glossary`, `/hands`, `/practice`, `/search`, `/about`,
   `/ranges/6max/*`, `/sitemap.xml`, `/robots.txt`, `/og/*` exist at all.** Any WP ordering
   that assumes content authoring (WP-H/WP-I) can proceed fully independently of route work
   (WP-E, a `/blog` template, a `/glossary` template) will stall the moment a record is
   flipped to `PUBLISHED` without its route exiting — WP-G's own report already names this
   dependency; restated here as a live, unresolved gate.

---

## 7. Recommended execution-graph adjustments (no scope change)

- **WP-F2 (equity calculator + hand checker) has no remaining domain/engine unknowns.**
  `bestFiveOf`, `exactHeadsUpEquity`, and `CardPicker` are all measured/read and confirmed
  reusable as-is; the only real design question left is UI composition and whether the
  84ms-per-worst-case computation needs a Web Worker (recommended, per the original audit's
  risk #5, since 80ms+ still blocks a main-thread click-to-result on lower-end hardware than
  this measurement machine).
- **WP-E2 (Starting Hand Explorer) has no remaining domain/engine unknowns either** — it is
  purely a composition of `RangeMatrix(range: null)` + `handStrengthAt`/`topHandsByShare` +
  `handClassFactsAt` + `SelectedHandPanel`, all of which exist today.
- **A minimal `/blog`, `/glossary`, `/hands` route template should land before or alongside
  the start of WP-H/WP-I authoring**, not after, given finding in §6.4 — otherwise the first
  `status: 'PLANNED' → 'PUBLISHED'` flip in either content stream is blocked on a route that
  does not exist, exactly as WP-G's own report predicted.
- **The quiz system (WP-I2) is a genuinely separate build**, not a byproduct of `MiniQuiz` —
  no scoring engine, results page, or `/practice/*` route exists, so it should keep its
  current position after WP-C/WP-R in the dependency graph rather than being assumed "mostly
  there" because the inline component exists.
