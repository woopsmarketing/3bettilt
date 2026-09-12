# WP-S3-15 QUIZ + SEARCH + HEADER + FOOTER + ABOUT + 404 + MOBILE NAV — brief

FIRST read `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000;
never end your turn waiting on a background task). Then ORCHESTRATOR DECISIONS in `docs/3BETTILT_STAGE3_STATE.md`,
`handoff/WP_S3_03_HANDOFF.md` (primitives), `handoff/WP_S3_05_HANDOFF.md` (home; anything it left for header/footer),
`handoff/WP_S3_06_HANDOFF.md` §공통 (graph selectors, blog content types), `handoff/WP_S3_09_HANDOFF.md` (learn
categories), and the rows for /search, /practice*, /about in `3BETTILT_KEYWORD_MAP.md`. Look at the current pages
(build + shoot first) before designing.

## Goals
1. **Quiz** (`/ko/practice` hub + `hand-ranking-quiz`, `starting-hand-quiz`, `range-quiz`) — contract BF: today the
   quiz screen has lots of empty space. Make it a focused learning experience: progress, position (when relevant),
   cards, question, large choices (big touch targets), answer feedback, reason, related visual, next question;
   result = score, wrong questions review, retry, learn link, tool link. **Quiz correctness logic and its tests are
   untouchable** (presentation only). Practice hub: not identical cards — each quiz with what it trains.
2. **Search** (`/ko/search`) — contract BG: results grouped Learn / Blog / Glossary / Hands / Tools with clear group
   headers and counts; aliases resolve to the same concept — 3벳 · 쓰리벳 · 3bet · three bet (use glossary `aliases`
   and existing search data; add aliases to the search layer, not by editing glossary records — report if a glossary
   record lacks an alias); better result design (type label, title, one-line description, match highlight if cheap);
   good empty state with suggestions. Keep `/search` noindex. Keep it static-exportable (client-side search over a
   build-time index is fine; no server route).
3. **Header** — contract AE: desktop nav 배우기 · 핸드레인지 · 무료 도구 · 퀴즈 · 블로그 · 포커 용어 + search + theme
   toggle (check it matches); mobile: all six discoverable (menu), blog visible, 44px targets, focus trap/escape in the
   menu, current-page indication. Wordmark 3BETTILT.
4. **Footer** — contract BI: an information-architecture footer with groups 배우기 / 도구 / 콘텐츠 / 용어와 핸드 /
   3BetTilt (about, disclosure of what the site is — education only, no affiliate), compact on mobile (collapsed
   groups or 2-col), no fake social links/company info.
5. **About** (`/ko/about`) — contract BH trust page: 3BetTilt란? · 누구를 위한가? · 무엇을 제공하는가? · 숫자는 어떻게
   계산하는가? (exact enumeration / evaluator — describe truthfully from the code, no numbers typed) · 정확성 원칙 ·
   Range scope (6-Max · 100BB · First In learning baseline; never GTO; no source names) · Educational purpose ·
   Hand Story reconstructed-scenario policy · 오류 수정 원칙 · 하지 않는 것 (no live play assistance/OCR/overlays, no
   affiliate/deposit, no login/data collection — verify each claim against the code). **No fake team, person,
   company, credentials, dates, or contact addresses.**
6. **404 / error** visual consistency with the new design (no canonical on 404 — keep), helpful links.
7. Accessibility while you're here: skip link, single H1, landmarks, focus-visible, reduced motion — in your pages.

## File boundary
- `src/components/{SiteHeader,SiteFooter,RouteNavItem,ThemeToggle}.tsx` + tests; NEW nav/footer components you create
- `src/app/[locale]/search/**`, `src/components/{SearchClient,SearchResultList,SearchEmptyState}.tsx` + tests,
  `src/features/search/**`
- `src/app/[locale]/practice/**`, quiz components `src/components/{Quiz,QuizQuestionCard,QuizResult,QuizVisual,
  QuizRelatedLinks,RangeQuiz}.tsx` + tests, `src/features/quiz/**` (presentation/copy only — never the answer logic)
- `src/app/[locale]/about/**`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` (+ tests)
- `src/app/[locale]/layout.tsx` and `src/app/layout.tsx` — only for header/footer/skip-link wiring; report anything else
- e2e: `tests/e2e/{search,practice,hand-ranking-quiz,starting-hand-quiz,range-quiz,about,not-found,theme-and-header}.spec.ts`
- `docs/reports/stage3/handoff/WP_S3_15_HANDOFF.md`
NOT yours: content/registry/types/graph, blog/learn/tools/hands/home/glossary pages (others may be editing hands and
glossary now), `globals.css` (report a truly needed token), `src/lib/seo/**` (report), `MiniQuiz` (used in lessons).

## Done when
- typecheck 0 (report failures outside boundary); unit tests for your files green; full
  `pnpm vitest run --project fishtilt --project learn-core` has no failures in your files; eslint clean; your e2e specs
  green via build-lock; `tests/e2e/client-bundle.spec.ts` still green; build ok, no `ƒ`.
- Screenshots into `artifacts/3bettilt-stage3-visual-qa/wp15/`: `/ko/practice/range-quiz` (question + answered state
  if you can script a click; otherwise initial), `/ko/practice`, `/ko/search?q=3벳` (URL-encode), `/ko/about`, a 404
  path, header menu open at 390 — 1440x900 + 390x844, dark + light, 320x700 for search. LOOK and iterate.
- Handoff. Final reply ≤ 25 lines. Stop when done.
