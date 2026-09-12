# WP-O3 — PERFORMANCE

FishTilt (`apps/fishtilt`), performance pass. Measured on the shipped production build, in a
real browser, before and after every change.

---

## 1. Scope and method

Everything below is a measurement, not an estimate. `next build` under Turbopack prints no
size column, so nothing here comes from the build log.

| What | How it was produced |
| --- | --- |
| Per-route client JS | Playwright + Chromium against `next start` on the production build. Every `.js` response the page actually loads, summed as **decoded** bytes (`response.body().length`); transfer bytes taken from CDP `Network.loadingFinished.encodedDataLength` on the same run. |
| Which chunk holds what | Byte offsets of known identifiers inside `.next/static/chunks/*.js`, plus the Turbopack module-factory boundaries (`,<ids>,e=>{"use strict"`) to attribute size to a module group. |
| Route → chunk map | The chunk URLs in each route's prerendered HTML, cross-checked against what the browser really requested. |
| Interaction latency | In-page `performance.now()` around a real `click()`, resolved by a `MutationObserver` on the live region — click to DOM-updated. |
| Main-thread blocking | `PerformanceObserver({entryTypes:['longtask']})` inside the page. |
| CPU throttling | CDP `Emulation.setCPUThrottlingRate` at 4× and 6×. |
| Search index size | `JSON.stringify(SEARCH_INDEX)` and `gzipSync` of it, plus 200 timed `buildSearchIndex` runs, executed against the real registry through `tsx`. |
| Prerender status | `.next/server/app/**/*.meta` `status` field, walked. |

Baseline build: `pnpm build:fishtilt`, 135 static pages, exit 0. Measurement server:
`next exec next start --port 3990` (3220/3221 left free; the server was stopped afterwards).

**One methodology caveat, stated up front:** CDP CPU throttling slows the renderer's **main
thread**. A dedicated worker runs on its own thread and is *not* throttled by it. So in §6 the
worker column's throttled latency understates what a genuinely slow device would take to
produce the answer; what it does measure exactly, and what ruling 2's gate is about, is how
long the main thread is held — and that is compared like-for-like against the same build's
fallback path.

---

## 2. Per-route initial JS

Decoded bytes of JavaScript a modern browser actually loads. (The 112.6 KB polyfill bundle is
served `noModule` and is never fetched by a browser that supports ES modules — it is correctly
absent from every number here.)

| Route | before KB | after KB | Δ | before gz KB | after gz KB | Δ gz |
| --- | --: | --: | --: | --: | --: | --: |
| `/` | 825.5 | **529.5** | −295.9 | 235.0 | **165.2** | −69.7 |
| `/about` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/learn` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/blog` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/glossary` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/hands` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/practice` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/tools` | 447.5 | 447.5 | 0.0 | 133.9 | 133.9 | 0.0 |
| `/search` | 521.2 | 521.2 | 0.0 | 150.1 | 150.1 | 0.0 |
| `/learn/holdem-basics` | 827.9 | **532.0** | −295.9 | 235.6 | **166.0** | −69.6 |
| `/learn/equity` | 827.9 | **532.0** | −295.9 | 235.6 | **166.0** | −69.6 |
| `/blog/aks-vs-ako` | 827.9 | **532.0** | −295.9 | 235.6 | **166.0** | −69.6 |
| `/glossary/position` | 827.9 | **532.0** | −295.9 | 235.6 | **166.0** | −69.6 |
| `/hands/aks` | 828.2 | **532.2** | −295.9 | 235.7 | **166.0** | −69.6 |
| `/tools/range` | 838.0 | **542.1** | −295.9 | 237.9 | **168.8** | −69.2 |
| `/tools/equity` | 826.7 | **552.3** | −274.5 | 235.7 | **166.6** | −69.1 |
| `/tools/pot-odds` | 825.9 | **466.3** | −359.6 | 235.3 | **141.3** | −94.0 |
| `/tools/outs` | 826.8 | **469.3** | −357.5 | 235.0 | **141.9** | −93.1 |
| `/tools/hand-checker` | 828.5 | **532.4** | −296.1 | 236.2 | **165.4** | −70.8 |
| `/tools/starting-hand` | 827.2 | **539.3** | −287.9 | 235.9 | **168.8** | −67.1 |
| `/practice/range-quiz` | 903.3 | **607.3** | −296.0 | 250.7 | **180.0** | −70.8 |
| `/practice/hand-ranking-quiz` | 897.0 | **601.0** | −296.0 | 249.2 | **178.4** | −70.8 |
| `/practice/starting-hand-quiz` | 897.0 | **601.0** | −296.0 | 249.2 | **178.4** | −70.8 |

**Worst three after the change:** `/practice/range-quiz` 607.3 KB (180.0 gz),
`/practice/hand-ranking-quiz` and `/practice/starting-hand-quiz` 601.0 KB (178.4 gz),
`/tools/equity` 552.3 KB (166.6 gz).

### Why they ship what they ship

| Chunk | Bytes | Loaded by | Contents |
| --- | --: | --- | --- |
| `0r_m8y0_ocruf.js` | 229,151 | every route | React + React DOM |
| `2qkfb1pa4stf6.js` | 183,118 | every route | Next App Router client runtime |
| `1ag_ss9uv7it-.js` | 19,330 | every route | `SiteHeader` island + route registry |
| `2_dsq1w5mecc6.js` | 16,937 | every route | app bootstrap |
| `turbopack-*.js` | 9,688 | every route | Turbopack runtime |
| `1rp605o6ssdhp.js` | 62,285 | every article page, every tool page, `/`, every quiz | `strategy-core` range model + RFI tables + **the 7-card evaluator** + `learn-core` pot odds/outs |
| `2ey-eg_-m9uun.js` | 70,047 | `/search` only | the search index and the content registry it is built from |
| `2a7z1w9w_srzw.js` | 31,714 | `/tools/starting-hand` only | the frozen starting-hand strength dataset |
| `0cz1d0mv5g_q7.js` | 112,594 | *nobody* (`noModule`) | legacy polyfills |

**The baseline 447.5 KB (133.9 gz) shared by every hub page is React + the App Router runtime
+ the header island.** That is the floor this app has, and no WP-O3 change touches it.

RSC/HTML payload, for context (unchanged by this WP): `/hands/aks` 137.0 KB, `/` 158.5 KB,
`/tools/equity` 129.1 KB, `/tools/starting-hand` 105.6 KB, `/about` 20.5 KB. One 26,884-byte
stylesheet (5,818 gz) on every route.

---

## 3. Client/server boundary audit

Sixteen files carry a real `'use client'` directive. Ten route files and two components
*mention* the string inside a module doc explaining why they are **not** client components —
they are server components and were counted as such.

| Island | Why it is one | Verdict |
| --- | --- | --- |
| `SiteHeader` | mobile nav disclosure (`useState`, `aria-expanded`) | correct — 19.3 KB, on every route |
| `RangeMatrix` | 169 real `<button>`s, controlled selection, roving focus (`useRef`/`useEffect`) | correct |
| `RangeMatrixMini` | position toggle + cell selection inside an article | correct (but see §4) |
| `RangeExplorer` | position/filter/compare state + URL sync | correct |
| `RangeFilters` | *not* a client component — a controlled child of `RangeExplorer` | correct |
| `RangeQuiz`, `Quiz`, `QuizQuestionCard`, `QuizResult` | quiz state; `QuizQuestionCard`/`QuizResult` move focus on question change | correct |
| `MiniQuiz` | answer selection in prose | correct (but see §4) |
| `EquityCalculator` | three card pickers, swap/reset, async result | correct |
| `HandChecker` | two card pickers | correct |
| `OutsCalculator`, `PotOddsCalculator` | numeric inputs | correct |
| `StartingHandExplorer` | slider + view switch + selection | correct |
| `HomeRangePreview` | position toggle on `/` | correct |
| `HandRangeHighlight` | owns `selectedKey` so a hand page opens pointing at its own hand | correct |
| `SearchClient` | query state + `?q=` URL sync | correct |
| `SearchResultList`, `SearchEmptyState` | *not* client components — controlled children | correct |

**No island is a server-renderable component wrongly pushed to the client.** Every page-level
route file is a Server Component; the interactive surface is islands only, and each one has a
handler or a focus behaviour that requires it.

---

## 4. Article-page JS specifically

| Page shape | after KB | after gz KB | over the `/about` floor |
| --- | --: | --: | --- |
| `/about` — no island at all | 447.5 | 133.9 | — |
| any lesson / blog / glossary / hand page | 532.0–532.2 | 166.0 | **+84.5 KB raw / +32.1 KB gz** |

The 84.5 KB is three chunks: `1rp605o6ssdhp.js` (62,285 — the domain chunk),
`1evv669govsn8.js` (19,013 — `MiniQuiz` + `RangeMatrixMini` + their view components) and
`1-6w6g51_ttgy.js` (5,223 — the MDX page shell).

**Why every article pays it.** `mdx-components.tsx` exposes one fixed allow-list to every MDX
file (`Callout, Fact, MiniQuiz, PokerCards, RangeMatrixMini, Term, ToolCTA`). Two of those are
client islands, so the client graph of *every* article contains both, regardless of use:

| Widget | MDX files using it |
| --- | --- |
| `Term` | 112 / 113 |
| `Fact` (server) | 62 / 113 |
| `PokerCards` (server) | 53 / 113 |
| `Callout` (server) | 50 / 113 |
| `ToolCTA` (server) | 35 / 113 |
| `MiniQuiz` (client) | **15 / 113** |
| `RangeMatrixMini` (client) | **9 / 113** |

So 104 of 113 article pages ship `RangeMatrixMini` and 98 ship `MiniQuiz` without rendering
them. **Most of that cost is not the widget** — it is the 62,285-byte domain chunk
`RangeMatrixMini` drags in through `@gto-self/strategy-core`'s barrel, which contains
`bestFiveOf` and `evaluateStrength` (the 7-card evaluator) that no article page uses. See §12:
one line in a package this WP may not edit removes 59.5 KB raw / 21.2 KB gz of it, measured.

Splitting the MDX allow-list behind `next/dynamic` was considered and rejected: it would
change hydration timing on 113 pages to recover ~19 KB raw once the barrel is fixed, which is
a behavioural change for no proportionate gain (CLAUDE.md rule 8).

---

## 5. Search index

| Measure | Value |
| --- | --- |
| Records | **119** (learn 15, blog 20, glossary 58, hands 20, tools 6) |
| Serialized (`JSON.stringify`) | **42,880 bytes** |
| Serialized, gzip | **10,375 bytes** |
| Shipped chunk `2ey-eg_-m9uun.js` | 70,047 bytes raw |
| Cost on `/search` over the hub floor | **+73.7 KB raw / +16.2 KB gz** |
| Routes that load it | **`/search` only** |
| `buildSearchIndex` (200 runs) | min 0.005 ms, **median 0.010 ms**, max 0.172 ms |

**Verdict: fine, left alone.** The chunk is larger than the projection (70 KB vs 42.9 KB)
because `buildIndex.ts` reaches the registry through `content/graph.ts` and therefore ships the
full `ContentRecord`s — relations, `indexable`, reading minutes — and projects them in the
browser. Precomputing the 119 `SearchRecord`s at build time would save roughly 6 KB gzip on one
route a visitor reaches deliberately, at the cost of restructuring the content registry, which
this WP is forbidden to touch and which would not pay for itself anyway. Build cost is 10 µs;
it is not a build-time problem either. This is not the site's biggest regression risk — §9 was.

---

## 6. Equity: the 250 ms gate and the Web Worker decision

### 6.1 Before — the gate is breached

`/tools/equity`, preflop worst case (`C(48,5)` = 1,712,304 runouts), nine consecutive
"핸드 바꾸기" swaps, click → percentages updated:

| CPU | min ms | **median ms** | max ms | long tasks | longest task |
| --- | --: | --: | --: | --: | --: |
| 1× (unthrottled) | 71.0 | **73.3** | 81.9 | 9 / 9 | 80 ms |
| **4×** | 293.2 | **299.8** | 308.0 | 9 / 9 | 299 ms |
| **6×** | 442.0 | **461.0** | 481.1 | 9 / 9 | 470 ms |

- Ruling 20's ~200 ms figure is **confirmed as machine load**, not a real cost: on an idle
  machine the unthrottled number is 73 ms, matching the baseline audit's original 80–93 ms.
- **Ruling 2's 250 ms gate is breached at 4× (299.8 ms) and 6× (461.0 ms).** A mid-range phone
  is the 4× case. Ruling 2's own premise — "even several times slower on weaker hardware this
  stays inside a click-to-result budget" — is false as measured.
- Every one of those interactions was a **long task**: the main thread was held for the full
  292–470 ms, so nothing else could run. In particular the component's `다시 계산 중…` pending
  state, which the code sets before the call, **never painted** — the computation blocked the
  same task.

**Decision: escalate. The gate is breached on evidence, which is exactly the condition ruling 2
set, so the worker is built.**

### 6.2 After — the same build, worker path vs. the real fallback

Measured on one build. The fallback column is produced by deleting `window.Worker` before the
page loads, so it exercises the shipped fallback code path, not an old build.

| CPU | path | first result from navigation | swap median | long tasks | longest task |
| --- | --- | --: | --: | --: | --: |
| 1× | **worker** | 245 ms | 74.3 ms | **0** | — |
| 1× | fallback | 192 ms | 77.6 ms | 9 / 9 | 86 ms |
| 4× | **worker** | 394 ms | 74.5 ms | **0** | — |
| 4× | fallback | 651 ms | 298.0 ms | 9 / 9 | 300 ms |
| 6× | **worker** | 655 ms | 80.4 ms | **0** | — |
| 6× | fallback | 914 ms | 452.5 ms | 9 / 9 | 465 ms |

Read this honestly:

- **The main-thread result is the real one: 292–470 ms of blocking per interaction becomes
  zero, at every throttle level.** That is what ruling 2's gate measures and it is now
  comfortably inside it.
- The worker's *throttled* swap medians (74–80 ms) are flattered by the tool: CDP throttles the
  renderer main thread only, so the worker thread ran at full speed. On a genuinely 4×-slower
  device the answer would still take ~300 ms to arrive — but it would arrive while the page
  stayed scrollable, focusable and repainting, and `다시 계산 중…` now actually shows.
- First-result-from-navigation is **53 ms slower unthrottled** (245 vs 192 ms) because the
  worker has to start, and **257 ms / 259 ms faster** at 4× / 6× because the main thread is no
  longer competing with the enumeration. The page already renders "계산 중입니다" in its static
  HTML during that window, so nothing new appears on screen.
- The fallback is verified to produce **the same numbers**, not a stub: it calls the same
  `exactHeadsUpEquity`, and a unit test asserts three fixtures are `toStrictEqual` to the
  engine's own return value with `globalThis.Worker` absent (CLAUDE.md rule 5).

### 6.3 Cost of the worker

`/tools/equity` is 20.1 KB raw / 0.6 KB gz larger than the other tool pages: the Turbopack
worker bootstrap (18.3 KB across three small chunks) plus a slightly larger page chunk. The
62,285-byte engine chunk is fetched once and shared — the worker's request for it is a cache
hit — but it is **also on the page's main thread**, because the fallback genuinely needs it
there. That is the price of a real fallback and it is paid deliberately. Net for the route:
826.7 → 552.3 KB.

---

## 7. Generated datasets reaching the client

| Dataset | Source | Reaches the browser? |
| --- | --- | --- |
| `strength/dataset.generated.ts` (starting-hand strength) | 10,792 B | **Yes — `/tools/starting-hand` only**, chunk `2a7z1w9w_srzw.js` (31,714 B). That route is the Starting Hand Explorer; its slider needs the whole table client-side. Correct. |
| `equity/classVsClassDataset.generated.ts` | 2,183 B | **No.** Consumed by `Fact`, a server component; the numbers reach the page as rendered HTML. |
| `CATEGORY_FREQUENCY` (2,598,960-hand enumeration) | computed | **No.** Server-side only. |
| RFI range tables (`strategy-core`) | — | Yes, and necessarily: the 13×13 matrix is interactive. |
| The 7-card evaluator (`bestFiveOf`/`evaluateStrength`) | — | **Yes, and it should not be** on article pages — see §4 and §12. |

Verified by grepping every built chunk for each dataset's identifiers and then checking which
routes request the chunks that matched.

---

## 8. Fonts and images

**Fonts: none.** There is no `next/font`, no `@font-face`, no Google Fonts link and no `.woff`
anywhere in the app or the built CSS. `--font-sans` is a pure system stack
(`ui-sans-serif, system-ui, -apple-system, …`) and `<html lang="ko">` lets the browser pick the
platform Korean UI face. **Korean text therefore never blocks on a font download** — no FOIT,
no FOUT, no `font-display` question, no preconnect to add. This is the best available outcome
and nothing was changed.

**Images: effectively none.** The app contains no `<img>` and no `next/image`. `public/og.png`
is 7,003 bytes, 1200×630, 8-bit RGB, referenced only from Open Graph metadata — a visitor's
browser never fetches it; a social crawler does, once. Nothing to optimise.

---

## 9. Changes made, and the measured effect of each

### 9.1 `"sideEffects": false` on three pure domain packages — **−281 to −360 KB raw / −65 to −94 KB gz on 16 of 23 routes**

`packages/poker-core/package.json`, `packages/shared/package.json`,
`packages/learn-core/package.json` — one line each.

**What was wrong.** The largest chunk in the build, `1x3hat5o0n5lo.js` at **371,549 bytes**,
was ~288 KB of **`zod` — the whole library plus its entire i18n locale set** (Czech, French,
Hebrew, Georgian, Portuguese, Vietnamese, …). It shipped on the homepage, all 113 article
pages, all six tool pages and all three quiz pages. Nothing in FishTilt imports zod, and
FishTilt is forbidden to import `poker-core` at all. The path was:

```
client island → @gto-self/learn-core → @gto-self/strategy-core (barrel)
   → export * from './adapter/fromHandState.js'  → @gto-self/poker-core (barrel)
   → export * from './serialization.js'          → zod
```

Turbopack kept it because no package in that chain declared itself side-effect free.

**Why this fix and not another.** `experimental.optimizePackageImports` for all four workspace
packages was tried inside `apps/fishtilt/next.config.ts` and had **zero effect** (chunk still
371,549 bytes) — there is no in-app-only fix. The declaration is also *true*: a scan of every
non-test source file in `shared`, `poker-core` and `learn-core` found **zero** top-level
side-effecting statements.

| State | biggest domain chunk | `/learn/holdem-basics` | `/tools/pot-odds` |
| --- | --: | --: | --: |
| baseline | 371,549 B | 827.9 KB | 825.9 KB |
| `optimizePackageImports` (rejected) | 371,549 B | — | — |
| `poker-core` only | 83,485 B | 546.6 KB | 544.6 KB |
| **+ `shared` + `learn-core` (shipped)** | **70,132 B** | **531.8 KB** | **466.3 KB** |

`shared`'s own contribution is small but free: −3,027 B raw / −1,225 B gz on `/tools/pot-odds`,
−377 B on `/tools/outs`, ±20 B elsewhere.

### 9.2 The equity Web Worker — **292–470 ms of main-thread blocking per interaction → 0**

New: `src/features/tools/equityWorker.ts`, `src/features/tools/equityWorkerProtocol.ts`.
Changed: the body of `computeExactEquityAsync` in `src/features/tools/equity.ts` — the seam
WP-F2B built for exactly this — plus the two module docs that stated there was no worker.
`EquityCalculator.tsx` gained **no code change**: its effect, pending state and stale-result
race guard were already the right shape.

Numbers in §6. The fallback is the real engine on the main thread, taken whenever `Worker` is
absent (server render, Vitest/happy-dom, a browser or CSP that refuses one), when construction
throws, when the worker errors, or when a response fails validation. In every one of those
cases every outstanding request is settled by recomputing it here — no promise is left hanging
and no estimate is ever produced.

### 9.3 Tests added — 16 unit + 10 e2e

| File | Rule it pins |
| --- | --- |
| `src/features/tools/equityWorkerProtocol.test.ts` (11 cases) | a worker message is only trusted when it carries the engine's own invariant: `method === 'EXACT'` and three integer bps summing to 10000 |
| `src/features/tools/equity.test.ts` (+1 case) | with no `Worker`, the seam returns `toStrictEqual` what `exactHeadsUpEquity` returns, for three fixtures — the fallback can never drift into an approximation |
| `tests/e2e/client-bundle.spec.ts` (9 budgets + 1 rule) | **no client chunk may contain a schema-validation library** (`$ZodError` / `toJSONSchema` on an article page and a tool page), and each class of route stays under a ceiling ~20 % above today |

The budgets are ceilings with headroom, not snapshots: they tolerate ordinary drift and catch
another library-sized arrival. The zod rule has no number in it at all.

---

## 10. Measured and deliberately left alone

| Thing | Measurement | Why it stays |
| --- | --- | --- |
| 13×13 range rendering, 169 cells | position switch **1.1 / 4.5 / 6.9 ms** (1× / 4× / 6×); cell select 0.7 / 2.6 / 4.4 ms; compare-mode toggle (3 matrices, 507 cells) 4.6 / 18.1 / 30.9 ms; compare-position switch 1.6 / 5.5 / 9.8 ms | 30 ms worst case at 6× throttling against a 250 ms gate. `RangeExplorer` already memoizes the resolve and the diff. Nothing to fix. |
| Search index | 119 records, 42,880 B (10,375 gz), one route, 0.010 ms to build | §5 |
| Fonts | zero web fonts | §8 |
| Images | one 7,003 B OG image, never fetched by a page | §8 |
| Polyfill bundle `0cz1d0mv5g_q7.js` | 112,594 B, served `noModule` | No module-supporting browser requests it; it costs a real visitor nothing. |
| CSS | one 26,884 B sheet (5,818 gz) on every route | Tailwind v4 output for the whole site; not a bottleneck next to 448 KB of JS. |
| `strength/dataset.generated.ts` on `/tools/starting-hand` | 31,714 B on one route | The slider needs the table client-side. Correct as is. |
| MDX allow-list dragging `MiniQuiz`/`RangeMatrixMini` onto all 113 articles | +19,013 B raw for the widgets themselves | §4 — `next/dynamic` would change hydration behaviour on 113 pages for ~19 KB. Rule 8. |
| React + App Router floor, 447.5 KB / 133.9 gz | every route | Framework cost; out of scope. |

---

## 11. Gate results

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **1267 passed**, 114 files (was 1251 / 113) |
| `pnpm test` (monorepo) | **4004 passed**, 3 skipped, 272 files (was 3988) |
| `pnpm build:fishtilt` | **135 static pages**, exit 0, no unexpected non-200 prerender |
| `pnpm e2e:fishtilt` | **203 passed** (was 193; +10 from `client-bundle.spec.ts`) |
| `pnpm typecheck` | clean, 13 projects |
| `npx eslint apps/fishtilt --max-warnings=0` | clean |
| `pnpm lint` (repo) | clean |
| `pnpm build` (`apps/web`, run because §9.1 touches packages it consumes) | exit 0, 4 routes |

---

## 12. Reported rather than changed

### 12.1 `packages/strategy-core` should declare `"sideEffects": false` — measured at −59.5 KB raw / −21.2 KB gz per page, on 16 routes

Measured, then reverted: adding the same one line to `strategy-core` takes every article page
from 531.8 → **472.3 KB** (166.0 → **144.2 gz**), `/` to 470.0 KB, `/tools/range` to 483.1 KB
and the quizzes to 541–548 KB. It works by letting the barrel's
`export * from './adapter/fromHandState.js'` be dropped, which is what currently drags the
7-card evaluator (`bestFiveOf`, `evaluateStrength`) onto pages that only draw a range chart.

**Not applied here for two reasons.** `docs/FISHTILT_STATE.md` lists `packages/strategy-core`
as **read-only** for FishTilt (ruling 7 already declined a smaller fix in it on that ground).
And unlike the other three packages it is *not* trivially side-effect free: two modules run
assertions at import time —

- `packages/strategy-core/src/postflop/rules.ts:480` — `invariant(BY_ID.size === RULES.length, …)`
- `packages/strategy-core/src/postflop/scoreModel.ts:1132` — `assertModel();`

FishTilt never imports the postflop policy, so in this app those modules would simply not be
shipped and the assertions would not run — arguably correct, since they validate data that is
no longer present. In `apps/web`, which does use postflop, the modules stay and the assertions
still run; strategy-core's own Vitest suite imports them directly either way. **That call
belongs to that package's owner, not to WP-O3.**

### 12.2 A stale Turbopack build cache can prerender published pages as 404

The very first `pnpm build:fishtilt` of this session — incremental over a `.next` inherited
from an earlier session — produced `.next/server/app/learn/holdem-basics.meta` and
`poker-hand-rankings.meta` with **`"status": 404`** and an 8,639-byte error document instead of
the lesson. Both records are `PUBLISHED`, both MDX files are on disk and registered, both are
in `generateStaticParams` and in the sitemap, and every test passed. `rm -rf .next` followed by
the same build over the same source produced **zero** unexpected non-200 prerenders, and every
subsequent build (including the one `pnpm e2e:fishtilt` runs, whose `seo.spec.ts` walks the
whole sitemap) has been clean.

This is a silent, test-invisible way to ship 404s for real content. **Deployments should build
from a clean `.next`.** No source change was made because there is no source defect.

### 12.3 `@gto-self/shared` declares a `zod` dependency that no source file imports

`grep -rn zod packages/shared/src` returns nothing, yet `packages/shared/package.json` lists
`"zod": "^4.4.3"`. Harmless now that the package is marked side-effect free, but it is a dead
dependency and a route by which zod could return. Removing it is a lockfile change outside this
WP's boundary.

### 12.4 Not attempted

No content or registry file was edited, no runtime dependency was added, no git operation was
run, and `prettier` was run on nothing — the files this WP touched were written in the
repository's existing style and checked with `eslint --max-warnings=0`.
