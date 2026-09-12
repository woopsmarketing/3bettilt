# FISHTILT — Phase 0: Audit and Implementation Plan

Written before any FishTilt code exists. Read this together with `CLAUDE.md`,
`docs/STATE.md` and `docs/DECISIONS.md`. Every later FishTilt report cites the decisions
here instead of re-arguing them.

Audit date: **2026-09-04**. Audited tree: `main` at `7c3a4e2` **plus 150 uncommitted
working-tree changes** that belong to an in-flight session and were not touched.

---

## 요약 (한국어)

- FishTilt가 필요로 하는 **포커 수학의 대부분이 이미 이 repo에 있다.** 5/6/7장 핸드 평가기,
  결정론적 equity 엔진, 169 핸드클래스, 1326 콤보, 레인지 표기 파서, 출처가 검증된 RFI 레인지가
  전부 `packages/strategy-core`에 존재하고 테스트로 고정되어 있다. 새로 짤 필요가 없다.
- 따라서 이번 작업의 진짜 무게중심은 포커 엔진이 아니라 **① 한국어 콘텐츠 35편+용어 45개,
  ② 공개 사이트용 프런트엔드/SEO 인프라(현재 전무), ③ "상위 X%" 스타팅핸드 순위 데이터셋 생성**
  세 가지다.
- FishTilt는 `apps/fishtilt` **새 Next.js 앱**으로 만든다. 기존 `apps/web`(비공개 트레이닝 툴,
  SQLite 의존)에 섞지 않는다. 도메인 로직은 `packages/learn-core` 새 패키지에 둔다.
- `strategy-core`는 **읽기 전용으로만** 재사용한다. 사용자의 미커밋 작업이 그 패키지를 건드리고
  있으므로 한 줄도 수정하지 않는다.
- 데이터 정직성 상 **MVP 레인지는 6-max / 100BB / First-In(RFI) 5개 포지션만** 활성화한다.
  Facing Open·Facing 3-Bet·40/60/150BB는 검증된 데이터가 없으므로 "준비 중"으로 정직하게 막는다.
  (§10 및 마지막 열린 질문 참조)

---

## 1. Current repository state

### 1.1 Shape

`gto-self`, a private pnpm workspace (`pnpm@11.21.0`, Node `>=22`, TypeScript `5.9.3`,
packages consumed as TS source with no per-package build step — ADR-0003).

| Path | Role | Relevance to FishTilt |
| --- | --- | --- |
| `packages/shared` | milliBB money, `Card`, ids, `Result` | **reuse directly** |
| `packages/poker-core` | pure NLHE state engine | reuse `Position`/`Street` types only |
| `packages/strategy-core` | REFERENCE strategy, evaluator, equity, ranges | **the main asset — reuse read-only** |
| `packages/gto-core` | Phase-0 placeholder (`GTO_CORE_PLACEHOLDER`) | not used |
| `packages/player-core` | players, HUD testimony | not used |
| `packages/analysis-core` | post-hand analysis | not used |
| `packages/adaptive-core` | opponent adaptation | not used |
| `packages/db` | Drizzle + better-sqlite3 | **must never be reachable from FishTilt** |
| `packages/coinpoker-parser` | hand-history text → events | not used |
| `apps/web` | private training table UI, port 3210 | **untouched** |
| `solver-lab` | CFR sandbox, never shipped | not used |

### 1.2 Existing web stack

Next.js `^16.3.3` (App Router), React `^19.2.8`, Tailwind CSS `v4.3.3` (CSS-first
`@theme` in `apps/web/src/app/globals.css`, no `tailwind.config.js`), Vitest with
happy-dom, `@testing-library/react` v16, Playwright (`apps/web/playwright.config.ts`,
baseURL `http://127.0.0.1:3211`, `webServer` runs `pnpm build && pnpm start --port 3211`).

`apps/web` has exactly three routes — `/`, `/session/new`, `/table/[sessionId]` — and all
of them are DB-backed and dynamic. Server actions are used heavily. `next.config.ts` sets
`transpilePackages`, `serverExternalPackages: ['better-sqlite3']`, `agentRules: false`,
`allowedDevOrigins: ['127.0.0.1']` and a Turbopack `resolveAlias` workaround.

### 1.3 What does not exist anywhere in the repo

- No MDX, no `content/` directory, no content pipeline.
- No `sitemap.ts`, no `robots.ts`, no `generateMetadata` anywhere, no JSON-LD, no OG images.
- No public/marketing surface of any kind. No i18n library (Korean is hardcoded, ADR-0053).
- No shared presentational UI primitives (`components/ui/*` does not exist); `apps/web`
  styles inline with Tailwind classes per component.
- No preflop starting-hand strength ranking dataset.

### 1.4 Working-tree hazard

`git status` reports **150 changed/untracked paths**, including `packages/strategy-core/**`,
`packages/db/**`, `apps/web/**`, and the four shared root configs (`package.json`,
`eslint.config.js`, `vitest.config.ts`, `tsconfig.base.json`). These belong to an in-flight
session.

**Rules adopted for this build:**

1. No `git stash` / `reset` / `checkout` / `restore`. No commits. (Prompt rule; CLAUDE.md §14.)
2. FishTilt does not modify any existing package's `src/`. `strategy-core` is read-only.
3. The four shared root configs must be edited to register a new package and a new app.
   **Only the orchestrator edits them**, additively, one pass, never a subagent (CLAUDE.md §5).
4. Before WP-A starts, record a baseline of `pnpm typecheck` and `pnpm lint` on the current
   tree, so a pre-existing failure is never attributed to FishTilt.

Observation, recorded and **not acted on**: `apps/web/package.json` (modified, uncommitted)
now depends on `@gto-self/strategy-core` and `@gto-self/adaptive-core`, but
`apps/web/next.config.ts` `transpilePackages` does not list either. That is the in-flight
session's business, not FishTilt's. It is noted here only so the new app's own
`transpilePackages` is written correctly from the start.

---

## 2. Reusable existing code

This is the single most important finding of the audit. **FishTilt does not need a new
poker engine.**

### 2.1 `@gto-self/shared`

- `Card` — branded int `0..51` (ADR-0008), `index = rankIndex*4 + suitIndex`.
- `Rank`, `Suit`, `RANKS`, `RANKS_DESC`, `SUITS`, `CARD_COUNT = 52`, `ALL_CARDS`.
- `makeCard`, `rankOf`, `suitOf`, `rankValue`, `cardToString`, `cardsToString`,
  `sortCardsDesc`, `hasDuplicates`.
- `parseCard` / `parseCards` — `Result`-returning, reject duplicates.
- `Money` — full milliBB API (`fromBB`, `toBB`, `add`, `mulRatio`, `parseBB`, `formatBB`, …).
  **Mandatory** for the Pot Odds tool (CLAUDE.md rule 1, ADR-0001).
- `Result` / `ok` / `err` / `invariant` — the repo's error convention.

### 2.2 `@gto-self/strategy-core` — read-only

All of the following are exported from the package barrel (`@gto-self/strategy-core`) and
are already covered by the repo's test suite.

**Hand evaluator** — `src/analysis/evaluate.ts`
- `HAND_CATEGORIES` (HIGH_CARD … STRAIGHT_FLUSH), `HandValue`, `CATEGORY_RANK_SLOTS`.
- `evaluateStrength(cards)` — packed integer, 5/6/7 cards, single-pass bitmask, hot path.
- `evaluateHand(cards)` — decomposed value, validates distinctness.
- `bestFiveOf(...)` — the best five-card subset (presentation helper).
- `compareHands(a, b)`, `decodeStrength`, `straightTopOfRankMask`, `rankMaskOf`.
- Wheel `A2345` is the lowest straight; ties are exact integer equality — i.e. the split-pot
  definition. This directly answers the prompt's §20/§84 edge-case list.

**Equity** — `src/equity/**`
- `equityVsRange`, `equityVsRanges` (up to 5 villains), `rangeVsRangeEquity`,
  `equityDistribution`, `equityQuantile`.
- `EquityMethod` is reported per call: **`EXACT` on flop/turn/river, always `SUBSAMPLED`
  preflop**, whatever the budget. `DEFAULT_EQUITY_BUDGET.maxTrials = 2_000_000`.
- Card removal is applied before any arithmetic; an empty range is a typed `ZERO_MASS_RANGE`
  error, never a silent `0.5`.
- Sampling is a deterministic Weyl/quasi-random sequence (`weylIndices`, `indexSample`,
  `WEYL_RATIO`) — **reproducible without an RNG seed**. This matters for §5.3.
- `createEquityCache`, `binomial`, `combinationCount`, `unrankColex`.

**169 hand classes / 1326 combos** — `src/range/**`
- `HAND_CLASS_COUNT = 169`, `RANK_GRID_SIZE = 13`, `HAND_CLASSES`, `HandClass`,
  `handClassAt`, `handClassByKey`, `handClassOfCombo`, per-class `comboCount` (6/4/12).
- `COMBO_COUNT = 1326`, colexicographic combo index, `parseCombo`, `comboToString`.
- Matrix convention **already fixed and documented**: row/col are ranks descending
  (`0 = A … 12 = 2`); **diagonal = pair, above diagonal = suited, below = offsuit**.
  FishTilt adopts this convention unchanged everywhere (prompt §9).
- Tested: `13*6 + 78*4 + 78*12 === 1326`, and the real 1326 combos land in the declared
  per-class counts (`src/range/handClass.test.ts`, `src/range/combo.test.ts`).

**Range notation** — `src/preflop/notation.ts`
- `parseHandClasses("66+,A3s+,K8s+,QJo")`, `handClassSet`, `unionHandClassSets`,
  `differenceHandClassSets` (→ Range Compare difference mode, prompt §17),
  `hasHandClass`, `comboCountOf`, `percentageOf` (share of the 1326 universe).

**Frequencies** — `src/bps.ts`
- Integer basis points, `BPS_TOTAL = 10000`, `apportion` (largest remainder).
  Frequencies are quantized to multiples of 500 bps (5 points) on purpose, so authored
  numbers are never dressed up as solver precision (ADR-0056).

**Provenance** — `src/provenance.ts`
- `type Provenance = 'SOURCE' | 'DERIVED' | 'HEURISTIC'`, `Provenanced<T>`; `HEURISTIC`
  entries carry a mandatory rationale, enforced by a test.

**Range data** — `src/preflop/tables.ts`
- `RFI_NOTATION` / `RFI_RANGES` for **UTG, HJ, CO, BTN, SB** at **100bb 6-max**; BB is
  `null` by design (the BB never opens first in).
- Traceable to `docs/reports/STRATEGY_ANCHORS.md` (2026-09-01), 14 named free public
  education sources, with the explicit statement that no GTO Wizard content, no paywalled
  content and no bulk range-library scraping was used.

### 2.3 What FishTilt still has to build

| Need | Status |
| --- | --- |
| Hand evaluator | **exists** — reuse |
| Equity engine (ranges, boards) | **exists** — reuse |
| 169 classes / 1326 combos / notation | **exists** — reuse |
| RFI range data with provenance | **exists** — reuse (100bb only) |
| Exact heads-up preflop hand-vs-hand equity | **new** (see §5.2) |
| Starting-hand strength ranking ("top X%") | **new** (see §5.3) |
| Pot-odds math | **new** (trivial, but must use `Money`) |
| Outs → probability math | **new** (trivial, exact formulas) |
| 13×13 matrix React component | **new** |
| Playing-card / card-picker components | **new** (`apps/web`'s `CardPalette` is engine-coupled) |
| Content model, graph, search, MDX pipeline | **new** — nothing exists |
| SEO: metadata, canonical, sitemap, robots, OG, JSON-LD | **new** — nothing exists |
| ~35 Korean articles + ~45 glossary terms | **new** — the largest single item |

---

## 3. Code to remove or isolate

**Nothing is removed.** FishTilt is purely additive; no existing file is deleted or
rewritten. What is required is *isolation*, enforced mechanically rather than by convention.

FishTilt must never reach:

- `@gto-self/db` — a native module (`better-sqlite3`); the public site has no database and
  no login (prompt §50). ADR-0044 already establishes the enforcement pattern.
- `@gto-self/player-core`, `@gto-self/analysis-core`, `@gto-self/adaptive-core` — opponent
  modelling and hand-history learning have no place in a beginner education site, and
  ADR-0021/0063 keep those layers separate.
- `@gto-self/gto-core` — an empty placeholder; importing it would imply a GTO claim the repo
  cannot back (CLAUDE.md rule 2, ADR-0056).
- `solver-lab` — never shipped.

Isolation is enforced by two new ESLint blocks (§5.6) plus a layering probe test, following
the ADR-0042 rule that each `files` block spells out its **full** pattern list because flat
config is last-match-wins.

One product boundary restated, because FishTilt is public-facing: no screen reading, OCR,
capture, client automation or live-play assistance, ever (CLAUDE.md, ADR-0029). And no
affiliate/casino/deposit surface in this build (prompt §1, §78) — not even a hidden one.

---

## 4. Route map

New app `apps/fishtilt`, dev port **3220**, e2e port **3221** (3210/3211 belong to
`apps/web`).

```
/                                  Homepage (9 sections, prompt §8)
/learn                             Learn hub + roadmap
/learn/[slug]                      15 lessons (§52)
/tools                             Tool centre
/tools/range                       Range Explorer  ← flagship
/tools/starting-hand               Starting Hand Explorer
/tools/equity                      Equity calculator
/tools/pot-odds                    Pot odds calculator
/tools/hand-checker                Hand checker (best five of 7)
/tools/outs                        Outs calculator
/practice                          Practice hub
/practice/range-quiz
/practice/hand-ranking-quiz
/practice/starting-hand-quiz
/glossary                          Glossary index
/glossary/[slug]                   ~45 terms
/blog                              Blog index
/blog/[slug]                       ~20 question-style articles
/hands                             Hand index (169 classes listed, 20 indexed)
/hands/[hand]                      Starting-hand pages (aa, aks, ako, …)
/ranges/6max/[spot]                Curated range landings (utg-open … sb-open) — 5 only
/search                            Global search
/about
/sitemap.xml                       generated
/robots.txt                        generated
/og/[...]                          dynamic OG image route
```

**Indexing policy (prompt §38/§40):**

- `/tools/range?hero=BTN&spot=RFI&stack=100` — filter state is a query string, canonical
  always points at `/tools/range`. Filter combinations are never indexed.
- `/ranges/6max/*` — exactly **five** curated landings, one per position that actually has a
  dataset (UTG, HJ, CO, BTN, SB). No SB/BB-vs-X pages, no stack-depth pages.
- `/hands/[hand]` — all 169 routes resolve, but only hands meeting a *minimum meaningful
  content threshold* are indexed. The initial 20 (AA…22 per prompt §22) are authored by
  hand; the rest render with `robots: { index: false }` until authored. The threshold is a
  typed field on the content record and is asserted by a test, not left to judgement.

---

## 5. Data architecture

### 5.1 Placement decision

**FishTilt lives at `apps/fishtilt`; its domain logic lives at `packages/learn-core`
(`@gto-self/learn-core`).**

Rejected alternatives, with reasons:

- *A route group inside `apps/web`* — would couple a public static site's deploy to a
  private SQLite-backed tool, drag `better-sqlite3` toward a public deployment, force one
  Tailwind `@theme` to serve two unrelated visual languages, and put FishTilt files inside
  the tree the in-flight session is editing. Rejected.
- *A separate repository* — throws away the entire `strategy-core` reuse that makes this
  build tractable. Rejected.
- *Putting the new math into `strategy-core`* — that package is REFERENCE-strategy machinery
  with a deliberately narrow charter (ADR-0055) and is being edited right now by another
  session. Rejected; `strategy-core` stays read-only.

The `@gto-self/*` npm scope is kept for the new package because the Vitest alias regex and
every tooling convention key off it. **FishTilt is a product brand, not a package scope.**

### 5.2 `packages/learn-core`

Allowed imports: `@gto-self/shared`, `@gto-self/strategy-core`. Nothing else.
No React, no Next, no DB. Pure and deterministic; no clock, no RNG, no ids.

```
packages/learn-core/src/
  potOdds.ts        callAmount / (potBeforeCall + bet + call) → required equity
  outs.ts           exact turn / river / turn-or-river probabilities + the ×2/×4 shortcut
  equity/exact.ts   exact heads-up combo-vs-combo enumeration (see below)
  strength/         starting-hand ranking model + the frozen dataset (see 5.3)
  handClass/        169-class → beginner facts (Korean name, example cards, combo count)
  index.ts
```

**Pot odds** — inputs parse to `MilliBB` at the boundary via `Money.parseBB`; the required
win rate is a ratio (a non-money number, explicitly permitted by CLAUDE.md rule 1). The
formula is shown in the UI, not hidden (prompt §24).

**Outs** — exact hypergeometric values, e.g. flop→turn `outs/47`, flop→river
`1 − (47−o)/47 × (46−o)/46`. The "×2 / ×4 rule" is presented separately and labelled as a
mental shortcut, never as the answer (prompt §25).

**Exact heads-up equity** — `strategy-core` labels *every* preflop equity `SUBSAMPLED`,
correctly, because a villain *range* preflop is ~2.6G trials. But FishTilt's Equity
Calculator is hand-vs-hand: with four known cards the exact runout count is
`C(48,5) = 1,712,304`, and with a flop it is `C(45,2) = 990`. That is exactly enumerable.
`learn-core` therefore implements its own exact enumeration **reusing
`strategy-core`'s `evaluateStrength`** and reports `EXACT`. Range-vs-range queries delegate
to `strategy-core` and inherit its `EXACT`/`SUBSAMPLED` label verbatim. The UI never shows
a number without its method (prompt §23).

### 5.3 Starting-hand strength ranking — the "top X%" dataset

Required by the prompt's §14/§73 slider, and it does not exist. Methodology **A** is chosen:
*heads-up preflop all-in equity against a uniformly random legal hand*, because it is a
reproducible mathematical metric rather than an opinion.

> **Superseded 2026-09-05.** What follows described a sampled dataset, on the grounds that
> exact evaluation was out of reach at ≈3.5 × 10¹¹ evaluations. Measurement falsified that:
> one class enumerates exhaustively in 74.7 s, so all 169 is ~15 minutes of wall clock here.
> The dataset is now computed by **full enumeration** and reports `EXACT`; the tie bands and
> the stability gate below existed only to manage sampling error and were removed with it.
> See `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` §4 for the corrected decision. The
> original text is kept for the record:

Fully exact evaluation is out of reach (≈3.5 × 10¹¹ evaluations across all classes), so:

1. One representative combo per class suffices — the opponent distribution is suit-symmetric,
   so all 6 / 4 / 12 combos of a class are equivalent under suit relabelling. 169 evaluations
   of the metric, not 1326.
2. Equity is computed by an **offline generator script**, using `strategy-core`'s
   deterministic Weyl sampling. No RNG seed exists, so the run is reproducible by anyone.
3. The output is **frozen** into a checked-in dataset carrying `rankBasis`, `methodology`,
   `sampleCount`, `generatorVersion`, `generatedAt`, and `method: 'SUBSAMPLED'`.
4. **Rank-stability test (the acceptance gate):** regenerate at a second, independent budget
   and assert the *ordinal* ranking is identical. Any pair of classes whose equities fall
   within the sampling error is recorded as an explicit **tie band** in the dataset rather
   than given a false ordering.
5. The UI states the basis next to the slider and links to a methodology page. The word
   "GTO" is never used for it — it is a mathematical property of the hand, not a strategy.

The slider cuts by **cumulative combo share of the 1326 universe**, not by class count, so
"상위 15%" means 15% of actual hands dealt.

### 5.4 Range datasets

The **only** strategy range data FishTilt ships in MVP:

| Game | Stack | Spot | Positions | Source |
| --- | --- | --- | --- | --- |
| 6-max NLHE cash | 100BB | First In (RFI) | UTG, HJ, CO, BTN, SB | `strategy-core` `RFI_RANGES` |

Everything else is honestly disabled (§10). The user-facing label is **"학습용 기본 레인지"**
with a `[이 기준은 무엇인가요?]` affordance opening the methodology; the internal
`SOURCE|DERIVED|HEURISTIC` axis is preserved in the data but is not shouted at beginners
(prompt §15/§45/§74). **The word "GTO" appears nowhere in FishTilt's UI** (ADR-0056,
CLAUDE.md rule 2).

BB is not an error state — it renders an explanation ("빅블라인드는 첫 번째로 오픈하는 자리가
아닙니다"), which is itself a teaching moment.

### 5.5 No-fake-data enforcement

The prompt's §46 is the project's own CLAUDE.md rule 2 restated. Mechanically:

- A range query for an unsupported `(spot, stack, position)` returns a typed
  `UNSUPPORTED` result, never a fallback range. The UI renders the honest empty state with a
  one-click path to a supported filter (prompt §60).
- A test asserts that every filter combination the UI can produce either resolves to a real
  dataset or to `UNSUPPORTED` — there is no third branch.
- A copy-audit test greps user-visible strings for leaked internals (`RFI`, `HEURISTIC`,
  `DERIVED`, `SOURCE`, `EV`, `SPR`, `MOCK`) appearing without a Korean gloss (prompt §70).

### 5.6 Workspace registration (orchestrator-only edits)

`pnpm-workspace.yaml` already globs `apps/*` and `packages/*` — **no edit needed**.

Additive edits required, all by the orchestrator in a single pass:

1. `vitest.config.ts` — add `'learn-core'` to `WORKSPACE_PACKAGES`, add
   `nodeProject('learn-core')`, and add a `fishtilt` browser-env project mirroring the
   existing `web` one (ADR-0004).
2. `eslint.config.js` — two new blocks, each spelling out its **full** restricted-pattern
   list (ADR-0042):
   - `packages/learn-core/**` — bans UI, DB, solver-lab, `poker-core`, `gto-core`,
     `player-core`, `analysis-core`, `adaptive-core`, `coinpoker-parser`.
   - `apps/fishtilt/**` — bans DB (everywhere, with no server-side exception, since the app
     has no database), solver-lab, `gto-core`, `player-core`, `analysis-core`,
     `adaptive-core`, `coinpoker-parser`.
3. `package.json` — add `dev:fishtilt`, `build:fishtilt`, `e2e:fishtilt` scripts.

A layering probe test proves each ban actually errors and that a permitted import does not —
required practice here, not style.

---

## 6. Content architecture

### 6.1 Format decision

Prose lives in **MDX** (`@next/mdx`, MIT — to be recorded in `docs/DECISIONS.md` per
ADR-0015 before the dependency is added). Structure lives in **typed TS registries**.

The two are joined by slug. This split exists because the prompt's core differentiator
(§28) is *interactive tools embedded inside articles* — which needs components in prose —
while the internal-link graph (§34) must be **typed and testable**, which frontmatter
strings are not.

```
apps/fishtilt/
  content/
    learn/*.mdx        15 lessons
    blog/*.mdx         20 question articles
    glossary/*.mdx     ~45 terms
    hands/*.mdx        20 authored hand pages
  src/content/
    registry/          typed records: id, slug, title, description, level, topic,
                       concepts[], prerequisites[], relatedConcepts[], relatedTools[],
                       relatedHands[], nextLessons[], relatedArticles[], indexable
    graph.ts           resolution + traversal
    search.ts          build-time index
    mdx-components.tsx allowed interactive components only
```

Only a fixed allowlist of components is usable inside MDX (`<RangeMatrixMini>`,
`<PokerCards>`, `<ToolCTA>`, `<MiniQuiz>`, `<Term>`, `<Callout>`). Content is trusted repo
content; no arbitrary HTML, no remote MDX (prompt §79).

### 6.2 Graph validation (tests, not vibes)

- every referenced content id exists;
- every `relatedTools` entry names a real route;
- no duplicate slug; no dead internal link;
- no orphan core article (every lesson reachable from `/learn`);
- glossary alias uniqueness;
- every indexable page clears the minimum-content threshold;
- every lesson has ≥1 tool CTA and ≥1 next-step link (prompt §35).

### 6.3 Korean copy rules

ADR-0053 already says Korean-first with Latin poker notation, and the prompt's §3 sharpens
it: a technical term is never shown bare. The house pattern is **easy Korean first, term
second** — "앞 사람이 레이즈했을 때 (Facing Open)", "같은 무늬의 A와 K · AKs". Enforced by the
copy-audit test in §5.5.

---

## 7. Implementation dependency graph

```
                    WP-0 scaffold + workspace registration
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
         WP-A design         WP-B learn-core      WP-G content
         system, shell       (odds, exact          system: MDX,
         brand tokens        equity, facts)        registry, graph
              │                   │                   │
              │            WP-R strength             │
              │            dataset generator          │
              │            + frozen data + doc        │
              │                   │                   │
              └────────┬──────────┘          ┌────────┴────────┐
                       │                     │                 │
                 WP-C RangeMatrix       WP-H learn 15     WP-I blog 20
                 + range facade                            + glossary 45
                       │                     │                 │
         ┌─────────────┼─────────────┐       └────────┬────────┘
         │             │             │                │
    WP-D Range    WP-E hand     WP-F tools:       WP-L search
    Explorer      rankings +    pot odds, outs,        │
    + compare     starting-     checker, equity        │
         │        hand explorer      │                 │
         └─────────────┴─────────────┴────────┬────────┘
                                              │
                                     WP-I2 quiz system
                                              │
                                     WP-J homepage integration
                                              │
                                     WP-K SEO / sitemap / OG / JSON-LD
                                              │
                                     WP-L2 responsive / a11y / perf
                                              │
                                     WP-M adversarial review ×2 + fixes
                                              │
                                     WP-N final verification + report
```

Critical path: `WP-0 → WP-B → WP-R → WP-C → WP-D → WP-J → WP-K → WP-M → WP-N`.
Longest-duration path: `WP-0 → WP-G → WP-H/WP-I` (content authoring).

---

## 8. Work package order

Mapped onto the prompt's §81 letters, re-scoped for what already exists.

| WP | Scope | Parallel with | Writes to |
| --- | --- | --- | --- |
| **WP-0** | Scaffold `apps/fishtilt`, register `learn-core`, root config edits, baseline verify | — (serial, orchestrator only) | root configs, new dirs |
| **WP-A** | Brand tokens, app shell, nav/footer, `PokerCard`, `CardPicker`, `PageHero`, `SectionHeading` | WP-B, WP-G | `apps/fishtilt/src/components/**`, `globals.css` |
| **WP-B** | `learn-core`: pot odds, outs, exact HU equity, hand-class facts + tests | WP-A, WP-G | `packages/learn-core/**` |
| **WP-R** | Data research report + strength-ranking generator + frozen dataset + rank-stability test | after WP-B | `packages/learn-core/src/strength/**`, `docs/reports/POKER_EDUCATIONAL_DATA_AUDIT.md` |
| **WP-C** | `RangeMatrix` component + range facade over `strategy-core` + range summary/notation output | after WP-A, WP-B | `apps/fishtilt/src/features/range/**` |
| **WP-D** | Range Explorer: filters, compare, difference mode, shareable URL state | after WP-C | `apps/fishtilt/src/app/tools/range/**` |
| **WP-E** | Hand rankings page, Starting Hand Explorer, `/hands/*` | after WP-C, WP-R | `apps/fishtilt/src/app/(hands|learn)/**` |
| **WP-F** | Pot odds, outs, hand checker, equity calculator (Worker-backed) | after WP-A, WP-B | `apps/fishtilt/src/app/tools/**` |
| **WP-G** | MDX pipeline, content registry, graph, `GlossaryTooltip`, `RelatedContent`, `ToolCTA` | WP-A, WP-B | `apps/fishtilt/src/content/**` |
| **WP-H** | 15 Korean lessons | after WP-G; parallel with WP-I | `apps/fishtilt/content/learn/**` |
| **WP-I** | 20 blog articles + ~45 glossary terms | after WP-G; parallel with WP-H | `apps/fishtilt/content/{blog,glossary}/**` |
| **WP-I2** | Quiz system (range / hand-ranking / starting-hand) | after WP-C, WP-R | `apps/fishtilt/src/app/practice/**` |
| **WP-J** | Homepage — all 9 sections wired to real components | after WP-D, WP-F, WP-H | `apps/fishtilt/src/app/page.tsx` |
| **WP-K** | metadata, canonical, OG route, sitemap, robots, breadcrumb + article + FAQ JSON-LD | after WP-J | `apps/fishtilt/src/app/**` |
| **WP-L** | Global search | after WP-G, WP-H, WP-I | `apps/fishtilt/src/app/search/**` |
| **WP-L2** | Responsive, a11y, performance, reduced-motion | after WP-J | cross-cutting |
| **WP-M** | Two fresh-context adversarial reviews (poker/math; UX/SEO/a11y) + dispositions | after WP-L2 | `docs/reports/**` |
| **WP-N** | Final verification + `FISHTILT_FINAL.md` | last | `docs/**` |

Single-writer discipline: no two concurrent agents write the same file. `globals.css`,
root configs and the content registry each have exactly one owner at a time. Where two WPs
would overlap, they run serially.

---

## 9. Highest-risk technical elements

Ranked by expected damage.

1. **Content volume and quality.** ~35 articles plus ~45 glossary entries in Korean, each
   needing real examples, visuals and interactive embeds. This is the long pole, and the
   failure mode — thin, repetitive, auto-generated filler — is explicitly forbidden by the
   prompt (§29/§40) *and* is an SEO liability rather than an asset. Mitigation: authored in
   two WPs against a fixed template, with a duplicate-sentence audit and a minimum-content
   threshold gate before anything is marked indexable.

2. **The strength-ranking dataset (§5.3).** It is new data, and new data is exactly where
   this repo's rules bite hardest. An unstable or undocumented ranking would put an invented
   number in front of beginners. Mitigation: reproducible generator, frozen output, explicit
   tie bands, and a rank-stability test as the acceptance gate.

3. **Honest range coverage.** One dataset (100BB RFI) has to carry a flagship tool whose UI
   suggests many more filters. Getting this wrong in either direction is bad: fabricating
   data breaks rule 2; hiding the filters makes the product look empty. Mitigation: full
   filter architecture, honest disabled states, and a test that proves every reachable
   filter resolves to real data or to `UNSUPPORTED`.

4. **Not destabilising the in-flight session.** 150 uncommitted files, including the four
   shared root configs and `strategy-core` itself. Mitigation: read-only reuse, additive
   config edits by the orchestrator only, and a recorded pre-work baseline of
   `typecheck`/`lint` so pre-existing breakage is never misattributed.

5. **Equity calculator performance in the browser.** Exact hand-vs-hand preflop is 1.7M
   runouts; a naive main-thread implementation janks the page. Mitigation: Web Worker,
   dynamic import, progress state, and a measured budget — with the result labelled `EXACT`
   only when it genuinely is.

6. **Two Tailwind v4 `@theme` scopes in one repo.** `apps/web`'s felt/surface palette and
   FishTilt's charcoal/red brand must not bleed into each other. Mitigation: separate
   `globals.css` per app; FishTilt tokens defined once and contrast-tested against WCAG AA
   before WP-A closes (the prompt's palette is a starting point, explicitly adjustable).

7. **SEO index quality.** 169 hand routes plus filter query strings are an index-explosion
   trap. Mitigation: canonical to the bare tool route, five curated range landings only,
   and a typed `indexable` flag asserted by test.

8. **Next 16 + new app config.** `transpilePackages` must list every workspace package the
   new app imports; the existing app already shows what happens when that list drifts.
   Mitigation: listed explicitly at scaffold time and covered by the first production build.

---

## 10. Poker strategy datasets that do not exist

Recorded so that no WP invents one. Each is either generated with a documented methodology
or shown as an honest "준비 중" state — never filled in.

| Missing dataset | Status in MVP |
| --- | --- |
| **Facing Open (defend/continue) ranges** | Not shipped. `strategy-core` has authored continue tiers (`DEFEND_*`) tagged `HEURISTIC` with the rationale that *no public source publishes a defend-percentage table*, and they are keyed to villain position/sizing inside the private engine, not to a citable beginner chart. |
| **Facing 3-Bet / 4-Bet / squeeze ranges** | Not shipped, same reason. |
| **Stack depths other than 100BB** (40 / 60 / 150BB) | Not shipped. The repo has 100bb only; nearby buckets reuse it with *degraded provenance*, which is acceptable inside a private engine and not acceptable as a published beginner chart. No interpolation, ever (prompt §11). |
| **BB ranges** | Correctly absent — the BB never opens first in. Rendered as an explanation, not an error. |
| **Formats other than 6-max cash** (9-max, MTT, HU) | Not shipped. Heads-up exists in `strategy-core` only as a `HEURISTIC` union of BTN+SB. |
| **Preflop starting-hand strength ranking** | **Generated in WP-R** with methodology A, frozen, documented, rank-stability tested. |
| **Postflop strategy** | Out of scope for FishTilt entirely. |
| **Solver-derived data of any kind** | Does not exist anywhere in this repo and will not be created here. `gto-core` is an empty placeholder; the word "GTO" is not used in FishTilt's UI. |
| **Third-party range libraries** | Not used. `rs-poker`'s `preflop_6max_rfi.json` ("6Max-RFI-GTO", uncited) and `poker_solver`'s blueprint shards are named provenance hazards in `docs/OPEN_SOURCE_EVALUATION.md` and are forbidden as baseline data. |

Mathematical facts that FishTilt *can* state, because they are computed rather than
sourced: hand-vs-hand equities (exact), outs probabilities (exact), pot odds (exact), combo
counts and range percentages (exact), dealt-hand probabilities such as "AA는 얼마나 자주
받을까" (exact — `6/1326`).

---

## 11. Questions put to the user, and their answers

Everything answerable from the repository was answered above. Two questions affected data
truthfulness and product placement and were therefore the user's to settle. Both were put
to the user on 2026-09-04 and both are now **settled** — they are not reopened.

1. **Where FishTilt lives.** → **`apps/fishtilt`, a new app in this monorepo**, with domain
   logic in `packages/learn-core` and `strategy-core` reused read-only. §5.1 stands as
   written.
2. **Facing Open / Facing 3-Bet in the Range Explorer.** → **RFI only for MVP.** The
   authored `DEFEND_*` / `THREE_BET_*` continue tiers are not surfaced, because they are
   `HEURISTIC` by their own declaration and are not a verified dataset in the sense of the
   build spec §72. Those spots render the honest "준비 중" state. §5.4 and §10 stand as
   written.

A third candidate question — first-release content volume — was **not** asked, because the
build spec already fixes the minimums (15 lessons, 20 blog articles, 40–50 glossary terms).
Asking would have relitigated a settled requirement. The full seed is the target.

### Verification baseline

Recorded on the working tree **before** any FishTilt file was created, so that pre-existing
breakage is never misattributed:

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | **pass** (exit 0) |
| `pnpm lint` | **pass** (exit 0) |

---

*Next step: WP-0 — scaffold `apps/fishtilt`, create `packages/learn-core`, register both.*
