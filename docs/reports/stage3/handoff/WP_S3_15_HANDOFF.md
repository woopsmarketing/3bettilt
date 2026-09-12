# WP-S3-15 — Quiz + Search + Header + Footer + About + 404 + Mobile nav

## Objective
Contracts BF (quiz), BG (search), AE (header/mobile nav), BI (footer), BH (about), 404/error
consistency, a11y in these pages. This handoff covers a RESUMED run: a first agent rewrote the
surfaces and was cut off before running gates; this run kept its work, closed the open items,
fixed the failures the gates surfaced, took the screenshots, and verified.

## Facts verified before work
- Baseline copies: `.data/stage3-baseline/apps/fishtilt/…` (note: `apps/` segment, not
  `.data/stage3-baseline/fishtilt/…` as some briefs say).
- On resume, every boundary file already differed from baseline (header 187→298 lines, footer
  47→140, search components/features rewritten, quiz presentation rewritten, about/practice/
  search/404/error pages rewritten; new `QuizOnward`, `QuizPageHeader`, `QuizProgress`,
  `features/search/{aliases,group,highlight}.ts`, `features/quiz/hubPresentation.ts`).
- Quiz answer logic (`features/quiz/engine.ts`, `*Questions.ts`, `rng.ts`) is byte-identical
  to baseline (diff 0). Only presentation changed.
- `src/app/global-error.tsx` does not exist (baseline had none either) — not created; see limitations.
- Search layer has no hard-coded glossary alias strings for 셋/트립스/three-of-a-kind (coordinator
  heads-up): `SEARCH_ALIAS_GROUPS` only carries spelling variants (3bet/three bet, 팟 오즈, 아웃,
  레인지, 포지션, 승률); glossary aliases are read from records at build time (`buildIndex.ts`).
  Nothing to update for the alias move or the new terms.
- Neither `src/features/search/**` nor `tests/e2e/search.spec.ts` ever used
  `data-glossary-aliases`; the glossary attribute change does not touch this WP.
- Open item 1 («배팅» in `aliases.ts:37`) was already resolved on disk before this run; the
  copy-guard passes.
- Open item 2 (`about/page.test.tsx` "carries no affiliate or deposit link"): passes; about page
  has only `route.path`/anchor hrefs, footer has no `http`/`mailto`. The one-off failure was an
  in-flight edit state, not reproducible on the final source.

## Decisions made
- `SearchEmptyState` example list `aria-label` renamed «예시 검색어» → «검색 예시»: Playwright
  `getByLabel('검색어')` is a substring match and resolved to both the input and the list
  (7 e2e failures). Spec updated to the new name.
- Search clear button («입력 지우기») is `tabIndex={-1}`; the input clears on Escape. Keeps the
  baseline e2e property "one Tab from the box lands on the first result" (a real keyboard UX
  claim) while keeping the pointer/touch clear affordance. New unit test pins both.
- `about.spec.ts` heading lookups use `exact: true` — «하지 않는 것» is a substring of the new
  h2 «레인지 표가 말하는 것과 말하지 않는 것». Precision fix, not a weakening.
- `theme-and-header.spec.ts` brand-fill contrast probe now selects `a.bg-brand-600,
  button.bg-brand-600` instead of `.bg-brand-600`: the header wordmark's decorative square (no
  text) comes first in the DOM and read 2.3:1 against page ink. The probe's stated intent is a
  primary button label; on `/practice/range-quiz` that is «퀴즈 시작».
- 404 search input: `flex-1` inside `flex-col` collapsed `h-12` at phone width → `w-full
  sm:flex-1`.
- Search result term label (`3-Bet`) `whitespace-nowrap` so it never breaks mid-token at 320.

## Files changed (this run; the first run's rewrite is listed under "Facts")
- `apps/fishtilt/src/components/SearchClient.tsx` (+test), `SearchEmptyState.tsx`,
  `SearchResultList.tsx`, `src/app/not-found.tsx`
- `apps/fishtilt/tests/e2e/search.spec.ts` (label rename; stale `j2.ts` → `g9.ts` comment),
  `about.spec.ts`, `theme-and-header.spec.ts`
- This handoff. No files outside the boundary. No `src/content/**` edits.

## Tests run
- `pnpm vitest run --project fishtilt --project learn-core`: 235 files / 2606 tests PASS.
- `pnpm --filter @gto-self/fishtilt typecheck`: 0 errors.
- `pnpm exec eslint` on all boundary files: clean.
- e2e via build-lock: search, practice, hand-ranking-quiz, starting-hand-quiz, range-quiz, about,
  not-found, theme-and-header, client-bundle — run 1: 100 passed / 1 failed (Tab order);
  run 2 after fixes (search, not-found, theme-and-header, about, client-bundle): 71 passed / 0 failed.
  Net: all 9 specs green on final source (quiz/practice specs unchanged since run 1).
- Build: `✓ Generating static pages (148/148)`, no `ƒ` routes.
- One transient build failure (`content/glossary/set-vs-trips.mdx` missing) was another agent's
  in-flight state; the file existed on retry. Not touched.

## Build/runtime evidence
`artifacts/3bettilt-stage3-visual-qa/wp15/`: `/ko/practice`, `/ko/practice/range-quiz`,
`/ko/search?q=3벳`, `/ko/about`, `/ko/no-such-page-404` × 1440x900, 390x844 × dark, light
(+ `-fold`); search also 320x700; scripted states `header-menu-open-390x844-{dark,light}`,
`range-quiz-question-*`, `range-quiz-answered-*` (1440 + 390, both themes; focus after answer
lands on «다음 문제», after open lands on first panel link). All shots: h1=1, overflowX=0.
State shooter lives only in the session scratchpad (not committed to the repo).

## Known limitations
- `global-error.tsx` not created: it must render its own `<html>/<body>` without the shell, so
  it cannot share the new chrome; `error.tsx` + `not-found.tsx` are styled. Add only if the
  orchestrator wants a bare root-error page.
- Answer highlight in search is per-variant substring; multi-word Korean phrases highlight the
  matched variant only.
- Quiz answered-state screenshot always shows the wrong-answer feedback (first choice «포함» on a
  random question); correct-state visual verified via unit test, not a screenshot.

## Open issues
- None outside the boundary. `globals.css`/`seo` untouched; no new tokens needed.

## Exact facts next agent may rely on
- Header: `nav[aria-label="주요 메뉴"]` (desktop), mobile panel `nav#fishtilt-mobile-nav[data-mobile-nav="open"]`
  is conditionally rendered; toggle button label «메뉴 열기»/«메뉴 닫기»; panel lists 6 primary +
  «더 보기» (검색 · 핸드 목록 · 소개); Escape closes and refocuses the toggle; Tab is trapped.
- Footer: `nav[aria-label="바닥글 메뉴"]`, groups 배우기 / 도구 / 콘텐츠 / 용어와 핸드 / 3BetTilt;
  `FOOTER_DISCLAIMER` unchanged.
- Search: input `getByLabel('검색어')` is unique; example list is `getByRole('list', {name:'검색 예시'})`;
  groups are `section[data-search-group=<kind>]` with `aria-labelledby` headings; result count in
  `role="status"`; `/search` is `index: false`.
- About: h2 ids include `#not` (last TOC entry); TOC is `nav[aria-label="목차"]`.

## Facts next agent MUST re-check
- Glossary content is still being edited: search result counts for any query, and which record
  owns 셋/트립스, must be read from `src/content/registry/glossary/g1..g9.ts` at that time.
- If another agent adds a `.bg-brand-600` `<a>`/`<button>` to the header before `<main>`, the
  contrast probe measures that one first.
- Full e2e regression (`pnpm e2e:fishtilt`) was NOT run here — orchestrator's final gate.
