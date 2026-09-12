# WP-S3-13b — Hands batch K2 (99, 88, 77, 22, a5s)

## Objective
Enrich MDX content for hand pages `99`, `88`, `77`, `22`, `a5s` on the finished 13a template:
trim template-duplicate Fact paragraphs, add FAQ sections, close NUMBER-RISK items, keep
readMinutes/indexable honest. No architecture/component changes.

## Facts verified before work
- Template (13a) already renders fact strip, comparison table (rank ±2 + s/o twin), RFI
  seats, onward guides/stories, RelatedContent — confirmed via WP_S3_13A_HANDOFF.md.
- `batchGate.ts` requires: `relatedTools` includes `toolStartingHand`+`toolEquity` (kept,
  unchanged), ≥1 `relatedConcepts`, ≥1 `relatedHands`, no `<Term>` reused, every `<Term>` id
  declared in `relatedConcepts`, FAQ answers must be pure prose (no `<Fact>`/`<Term>` — one
  dropped answer below MIN_FAQ_ITEMS(2) kills the whole FAQPage).
- `estimateReadMinutes` = `max(2, ceil(proseCharacters/400))`; hands threshold: prose ≥600,
  sections ≥3, components ≥1.

## Decisions made
- Per audit §5 "공통 처방" + §6.1 NUMBER-RISK rows naming K2 files:
  - `99.mdx` / `77.mdx` (#2/#3): the narrative claim "맨 위 일곱 자리는 전부 포켓 페어, 8위가
    첫 비페어(AKs)" is no longer just prose — pinned in `k2.test.ts` via
    `factValue('HAND_AT_RANK', ...)` + `handClassByKey(...).kind`.
  - `22.mdx` (#10): "정확히 그 중간쯤" → "대략 그 중간쯤" (overstatement removed).
  - `a5s.mdx` (#11): "50%는 넉넉히 넘습니다" → "50%를 넘습니다" (overstatement removed).
  - `22.mdx` / `a5s.mdx`: FAQ headings converted from `## 자주 묻는 것 — <question>` (no `###`,
    so no FAQPage) to `## 자주 묻는 것` + 2× `### ...?` with pure-sentence answers.
- Removed MDX paragraphs duplicating template-rendered Facts (specific TT/88/77/22 neighbour
  rank+equity call-outs now shown by `HandComparisonTable`); replaced with a pointer to "위
  비교 표". Kept one `조합과 확률` mini-section per file (combos/one-in-n) for prose-length/
  section-count floor — audit flags this as light duplication with §3, judged acceptable to
  keep length ≥600자 without padding.
- Added `## 자주 묻는 것` with 2 `###` questions to all 5 files (77/22/a5s previously
  under/mis-formatted; 99/88 had none). All answers are plain sentences — no `<Fact>`/`<Term>`
  (verified: a component in an answer silently drops that pair to below MIN_FAQ_ITEMS).
- `relatedTools`, `relatedConcepts`, `relatedArticles`, `relatedHands`: left as-is — batchGate
  already required `toolStartingHand`+`toolEquity`; audit's suggested pairs→toolStartingHand
  reselection would require dropping `toolEquity` from a required assertion outside K2's file
  boundary, so reported here instead of changed.
- `readMinutes`: `hand-77` raised 2→3 (measured prose grew past 800 chars after edits); others
  unchanged at 2 (measured, not guessed — see Tests run).

## Files changed
- `apps/fishtilt/content/hands/99.mdx` — trimmed neighbour-Fact duplication, added FAQ (2 Q).
- `apps/fishtilt/content/hands/88.mdx` — removed `조합과 확률` (pure duplicate of §3), added
  FAQ (2 Q).
- `apps/fishtilt/content/hands/77.mdx` — trimmed AKs-boundary duplicate sentence, added FAQ
  (2 Q; kept `조합과 확률`).
- `apps/fishtilt/content/hands/22.mdx` — softened "정확히"→"대략", FAQ heading reformatted to
  `##`+`###`×2.
- `apps/fishtilt/content/hands/a5s.mdx` — softened "넉넉히 넘습니다"→"넘습니다", FAQ heading
  reformatted to `##`+`###`×2.
- `apps/fishtilt/src/content/registry/hands/k2.ts` — `hand-77.readMinutes` 2→3.
- `apps/fishtilt/src/content/registry/hands/k2.test.ts` — added pinned test for NUMBER-RISK
  #2/#3 (top-7-are-pairs, rank-8-is-AKs), reading `HAND_AT_RANK`/`handClassByKey` live, never
  hand-typed.

## Tests run
- `pnpm vitest run --project fishtilt src/content/registry/hands/k2.test.ts src/content/content.test.ts src/copy-guards.test.ts`
  → K2: 23/23 PASS. `content.test.ts`: 2 pre-existing FAILs, both `hand-aqs`/`hand-ako` (K3,
  not mine). `copy-guards.test.ts`: PASS.
- `pnpm vitest run --project fishtilt src/content src/app/[locale]/hands src/copy-guards.test.ts`
  → 627 passed / 6 failed, all 6 failures in `k3.test.ts`(2)/`k4.test.ts`(1, readMinutes)/
  `content.test.ts`(same aqs/aqo/ako/kqs — K3/K4 files, out of boundary, unchanged by me).
  Zero failures naming `99`/`88`/`77`/`22`/`a5s`/`k2`.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint apps/fishtilt/src/content/registry/hands/k2.ts apps/fishtilt/src/content/registry/hands/k2.test.ts` → clean.

## Build/runtime evidence
- `apps/fishtilt/.data/tools/build-lock.sh 'pnpm build && ...'` → rc 0, 142 static routes,
  `next start` + `shoot.mjs` for `/ko/hands/99` and `/ko/hands/a5s`, 1440x900/390x844 ×
  dark/light: all 8 shots `overflowX:0`, `h1:1`. Screenshots at
  `artifacts/3bettilt-stage3-visual-qa/wp13b-K2/`.
- Visually inspected `ko_hands_99-1440x900-dark.png` and `ko_hands_a5s-390x844-light.png`:
  fact strip, 13×13, comparison table, RFI seat diagram, "얼마나 강한가요" section, FAQ (both
  questions render, correct heading), RelatedContent ×4 all present with no duplicated fact
  walls and no overflow at either width/theme.

## Known limitations
- Kept a compact `조합과 확률` mini-section (combos + one-in-n) in `99`/`77`/`88`(removed from
  88)/`22`/`a5s` where needed to clear the 600-char/3-section floor after removing the larger
  neighbour-duplicate paragraphs — this still overlaps slightly with the template's §3, judged
  the lesser duplication vs. the removed neighbour-rank/equity repeats.
- `term-combo` is declared in `relatedConcepts` for `99`/`88` but is no longer wrapped in a
  `<Term>` in those two files after trimming (no test requires the reverse; left as-is rather
  than editing the registry record beyond the readMinutes fix already needed).
- 11-file-wide `relatedArticles` gap (0 for jj/tt/etc.) does not apply to K2 — all 5 owned
  records already had `relatedArticles` populated (`blog-small-pocket-pairs` for the four
  pairs, `[]` for a5s — no genuinely-relevant blog/story exists for a5s besides the 6 named
  hand stories, none of which feature A5s hole cards).

## Open issues
- None outside K2's boundary requiring another agent's action.

## Exact facts next agent may rely on
- K2's 5 files, `k2.ts`, `k2.test.ts` are done: batch gate 23/23, typecheck 0, eslint 0, build
  0, screenshots clean.
- NUMBER-RISK rows #2, #3, #10, #11 (the ones naming K2 files) are closed.
- FAQPage now qualifies for all 5 K2 slugs (2 pure-sentence `###` questions each).

## Facts next agent MUST re-check
- `content.test.ts` and `k3.test.ts`/`k4.test.ts` currently fail on `hand-aqs`, `hand-aqo`,
  `hand-ako`, `hand-kqs` (prose <600 chars or readMinutes mismatch) — these are K3/K4 files,
  unrelated to this handoff, left for those agents.
- If K3/K4 finish and re-run the full suite, confirm 0 failures remain naming any K2 slug.
