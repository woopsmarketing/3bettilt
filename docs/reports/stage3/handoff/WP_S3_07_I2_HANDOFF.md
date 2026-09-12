# WP-S3-07 batch i2 — 무늬와 족보

## Objective

Migrate the 5 existing blog articles of batch i2 (`small-pocket-pairs`, `why-72o-is-weak`,
`why-suited-matters`, `flush-vs-straight`, `full-house-vs-flush`) to the Stage 3 search-guide
shape: `<QuickAnswer>` first, ≥3 unique `##` (auto TOC), a real FAQ block, one `<ToolCTA>`,
every number via `<Fact>`, contextual in-body links, and closed NUMBER-RISK claims.

## Facts verified before work

- Audit decisions (§2 B06-B10): small-pocket-pairs/flush-vs-straight/full-house-vs-flush =
  LIGHT EXPAND (stay `search-guide`); why-72o-is-weak/why-suited-matters = RENAME (stay
  `concept-culture` / `data-probability`).
- NUMBER-RISK #14/#15 (§6.1): `why-suited-matters` claimed "difference within double-digit %"
  (loosely) and "no exceptions across suited/offsuit pairs" with no test. Computed for real via
  `@gto-self/learn-core`'s `handStrengthForKey` over every `@gto-self/strategy-core`
  `HAND_CLASSES` SUITED class paired with its OFFSUIT sibling (78 pairs): **zero exceptions**
  (suited equity > offsuit equity every time) and **max gap 3.68 percentage points** (min 1.72),
  i.e. genuinely single-digit, not merely double-digit. Verified with a throwaway vitest run
  before writing prose, then pinned permanently in `i2.test.ts`.
- Hand stories `blog-qq-vs-72o-flop-227` and `blog-full-house-loses` (WP-S3-08 batch s1) are
  already `PUBLISHED` and already list `blog-why-72o-is-weak` / `blog-full-house-vs-flush` in
  their own `relatedArticles` — the reciprocal link was missing on my side only.
- `RangeMatrixMini` (not `RangeEmbed`, which the audit's older wording used) is the allow-listed
  component for an embedded range chart; not used here (the DataTable/Fact numbers already cover
  the outline's range points).
- **Prettier corrupts this MDX shape**: running `prettier --write` on these files inserted blank
  lines around inline `<Fact>`/`<Term>` elements that were mid-sentence, turning one sentence into
  two separate markdown paragraphs (a real rendering bug, not cosmetic). Reverted every instance
  by hand after the fact; did not re-run prettier on `.mdx` files afterward. `.ts` files format
  cleanly.

## Decisions made

- `why-72o-is-weak`: H1 "72o가 최악의 패라는 말은 맞을까?", `seoTitle` "...순위표 진짜 바닥은 따로
  있다"; added `relatedArticles: ['blog-qq-vs-72o-flop-227']` and an in-body link to the story.
- `why-suited-matters`: H1 "수티드(같은 무늬)는 얼마나 중요한가?", `seoTitle` "...같은 숫자 조합 전부
  비교"; prose states "한 자리 % 포인트 안쪽" (single-digit) and "78가지 전부에서 예외 없이", both
  backed by the engine test, not by the article's own J9s/T8s spot numbers.
  Did not add "수티드 커넥터" as a FAQ item (audit's candidate) — that glossary term does not exist
  yet and creating it is outside this batch's file boundary; used two different FAQ questions
  instead ("무조건 참여해도 되나요", "신경 쓸 필요가 없나요").
- `small-pocket-pairs`: added a 5-row `DataTable` (22/33/44/55/66 × rank/equity/RFI) instead of
  the old 22-only prose; added `term-three-of-a-kind` to `relatedConcepts` for the new "셋" aside.
- `flush-vs-straight` / `full-house-vs-flush`: kept the existing verified showdown boards/holes
  unchanged (already evaluator-checked, ruling 28); added the same-category comparison section,
  the straight-flush exception (flush-vs-straight), and the full-house-internal comparison
  (full-house-vs-flush); added reciprocal link `full-house-vs-flush → full-house-loses` and
  `relatedArticles: ['blog-flush-vs-straight', 'blog-full-house-loses']`.
- FAQ heading convention: used "## 사람들이 자주 헷갈리는 부분" for genuine FAQ blocks (with `###`
  questions) on 3 of 5 files, and "## 자주 묻는 것" (still matches `FAQ_HEADING` regex) on the other
  2 where a separate non-FAQ discussion heading already used the first phrase — both extract
  correctly per `src/lib/seo/faq.ts`.
- All five keep `seoTitle` distinct from `title` (H1 stays the curious/short form; `seoTitle`
  states the query), per the sibling `aks-vs-ako.mdx` convention I saw update concurrently.

## Files changed

- `apps/fishtilt/src/content/registry/blog/i2.ts` — titles/seoTitles/descriptions rewritten;
  `relatedConcepts`/`relatedArticles` extended (see above); `readMinutes` re-measured (4 for all
  five, up from 3).
- `apps/fishtilt/src/content/registry/blog/i2.test.ts` — added a new `describe` block
  ("why-suited-matters NUMBER-RISK #14/#15 (engine-verified)") with 3 tests: exactly 78 pairs
  exist, zero exceptions + max gap < 10 points across all 78, and the two named spot checks
  (J9s/J9o, T8s/T8o) each < 10 points. Existing tests untouched.
- `apps/fishtilt/content/blog/{small-pocket-pairs,why-72o-is-weak,why-suited-matters,
  flush-vs-straight,full-house-vs-flush}.mdx` — full rewrites per the outline above.
- `apps/fishtilt/src/content/blog/i2.ts` (MDX import map) — untouched; no slug added/removed.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/i2.test.ts` → **23/23 PASS**
  (includes the 3 new NUMBER-RISK tests).
- `pnpm vitest run --project fishtilt src/content src/components/blog "src/app/[locale]/blog"
  src/lib/seo` → 709 passed, 12 failed — **all 12 failures are in i3/i4 batches**
  (`blog-what-is-kicker`, `blog-outs-nine`, `blog-why-use-range`, `blog-pot-odds-quick`, and a
  page test depending on `blog-outs-nine`'s readMinutes), other agents' concurrent work, not
  mine. Zero i2 failures.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0.
- `pnpm exec eslint apps/fishtilt/src/content/registry/blog/i2.ts
  apps/fishtilt/src/content/registry/blog/i2.test.ts` → 0.
- `pnpm exec prettier --write` on my `.ts` files only (not `.mdx` — see note above).

## Build/runtime evidence

- `build-lock.sh 'pnpm build'` → exit 0, "Compiled successfully", all 5 `/ko/blog/<slug>` in the
  SSG route list.
- `build-lock.sh '... playwright test tests/e2e/blog.spec.ts'` → **28/28 PASS**. Did not edit the
  spec file.
- Screenshots: `artifacts/3bettilt-stage3-visual-qa/wp07-i2/` — `small-pocket-pairs` and
  `why-suited-matters`, 1440x900 + 390x844, dark + light, plain and `--fold` (16 files). All
  shots: `h1:1`, `overflowX:0`. Heights 6248/7815 (small-pocket-pairs) and 6503/8161
  (why-suited-matters) at 1440/390. Looked at 4 of the 16 (1440 light, 390 dark, 390 light,
  1440/390 fold): QuickAnswer box renders, TOC lists 7-8 headings and links, the 5-row DataTable
  in `small-pocket-pairs` fits at 390 with no page-level horizontal scroll, FAQ renders as an
  accordion-free Q&A list, single ToolCTA band, NextRead/RelatedContent auto-populate from the
  registry relations (glossary terms, tool, prev/next same-`contentType` articles). No card
  walls, no syllable-broken H1 at 390 (the `break-keep wrap-anywhere` fix from WP-06 held).

## Known limitations

- Did not add the "수티드 커넥터" glossary term the audit flagged as a FAQ candidate — creating a
  glossary entry is outside this batch's boundary.
- `RangeMatrixMini` was not embedded in any of the 5 (the DataTable/Fact numbers already answer
  the outline's range questions); if a reviewer wants the interactive matrix specifically, that's
  an easy follow-up inside this same file boundary.

## Open issues

- Prettier on `.mdx` inserts blank lines around inline JSX (`<Fact>`, `<Term>`), splitting one
  sentence into two markdown paragraphs — a real content bug, not just reformatting. Worth a
  repo-wide note (or a prettier ignore/override for `content/**/*.mdx`) so future batches don't
  ship this silently; I caught it only by re-reading the files after formatting.
- 12 test failures exist in i3/i4 batches and a page test depending on them (see Tests run) —
  not mine to fix, flagging per the common-rules boundary note.

## Exact facts next agent may rely on

- All 5 i2 records: `status: 'PUBLISHED'`, `indexable: true`, `readMinutes: 4`.
- `blog-qq-vs-72o-flop-227` and `blog-full-house-loses` (WP-S3-08 s1) already link to
  `blog-why-72o-is-weak` / `blog-full-house-vs-flush`; the reciprocal links now exist both ways.
- The suited/offsuit equity gap across all 78 same-rank pairs is engine-verified: zero exceptions,
  gap always in `(0, 10)` percentage points (actual max observed 3.68, min 1.72) — safe to cite
  elsewhere without re-deriving, but re-run `i2.test.ts`'s NUMBER-RISK describe block if the
  strength dataset (`packages/learn-core/src/strength/dataset.generated.ts`) is ever regenerated.

## Facts next agent MUST re-check

- If any other batch or a shared file (`mdx-components.tsx`, `allowList.ts`, `threshold.ts`)
  changes, re-run `i2.test.ts` — its 23 tests are self-contained but assume today's Fact/allow-
  list/threshold behavior.
- The i3/i4 test failures noted above were current at the time of this run; do not assume they
  are still open (or still the same 12) without re-running.
