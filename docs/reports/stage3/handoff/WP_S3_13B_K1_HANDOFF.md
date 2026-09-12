# WP-S3-13b-K1 — Hands content (aa, kk, qq, jj, tt)

## Objective

Enrich the five big-pair hand pages (`aa`, `kk`, `qq`, `jj`, `tt`) per WP-S3-13a's how-to: cut
MDX paragraphs that duplicate what the template now renders from data, add real FAQ sections,
close NUMBER-RISK items owned by this batch, fill empty `relatedArticles`.

## Facts verified before work

- Template already renders combos/share/§3 `HAND_ONE_IN_N`, rank/top-share/equity, ±2-rank
  comparison table, RFI seats — confirmed via `WP_S3_13A_HANDOFF.md`.
- Real FAQ shape (`## 자주 묻는 것` + ≥2 `### …?`, plain-sentence answers, no `<Fact>`/`<Term>`
  in the answer) confirmed by reading `src/lib/seo/faq.ts` (`extractFaqItems`) and an existing
  emitter (`content/blog/flush-vs-straight.mdx`). A `<Callout title="자주 묻는 것 — …">` (qq's
  existing aside) is explicitly NOT a FAQPage source — left in place, added a separate real
  FAQ section below it.
- NUMBER-RISK #9 (`docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md:359`): both "대부분" (ratio-claim)
  occurrences were in `aa.mdx:13` only; grep found none in `kk.mdx` (already clean at time of
  work — the audit's raw line offset pointed at that paragraph, but the actual retracted-ratio
  wording no longer contains "대부분").
- `blog-next-best-after-aa` (B02) genuinely covers JJ/TT (its top-10 table lists both) — used
  for both instead of `blog-small-pocket-pairs` (B06), which only concerns 22–66 and does not
  genuinely concern JJ/TT.

## Decisions made

- Removed standalone "얼마나 자주/드물게 오는 패인가요" / "조합과 확률" sections that only
  restated §3's `HAND_ONE_IN_N`/`HAND_COMBOS` Facts with no added insight (aa, jj); trimmed the
  duplicate half of tt's "조합과 확률" section while keeping its unique "왜 조합 수가 같은가"
  explanation.
- Softened aa.mdx's two "대부분" ratio claims to plain causal statements (no invented %
  breakdown) — matches audit's "삭제 또는 완화" prescription; ruling-28 test in `k1.test.ts`
  still passes (it checks for two specific retracted phrasings, neither present).
- Added `## 자주 묻는 것` with 2–3 `### …?` items (plain sentences only) to all five files.
- qq.mdx: removed its final paragraph (duplicate `HAND_ONE_IN_N`/`HAND_COMBOS`), added FAQ.
- jj.mdx / tt.mdx: added `relatedArticles: ['blog-next-best-after-aa']` (was `[]`).
- `readMinutes` recomputed after edits: kk 2→3, qq 2→3 (measured by `content.test.ts`/`k1.test.ts`
  via `estimateReadMinutes`); aa/jj/tt unchanged at their prior values.

## Files changed

- `apps/fishtilt/content/hands/aa.mdx`, `kk.mdx`, `qq.mdx`, `jj.mdx`, `tt.mdx`
- `apps/fishtilt/src/content/registry/hands/k1.ts` (relatedArticles for jj/tt; readMinutes for
  kk/qq)
- `docs/reports/stage3/handoff/WP_S3_13B_K1_HANDOFF.md` (this file)

Not touched: `batchGate.ts`, `k1.test.ts` (no assertion changes needed — the file's pins on
retracted phrasings, ranking, and equity mechanics all still hold against the edited prose),
other batches, components.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/hands/k1.test.ts src/copy-guards.test.ts`
  → 32 passed, 0 failed.
- `pnpm vitest run --project fishtilt src/content/content.test.ts` → 2 pre-existing failures
  NOT in this batch (`hand-99` thin-content, `hand-ako` readMinutes) — both owned by other K2/K3
  agents currently editing those files; verified absent from my batch's own gate.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint apps/fishtilt/src/content/registry/hands/k1.ts apps/fishtilt/src/content/registry/hands/k1.test.ts`
  → 0 errors/warnings.

## Build/runtime evidence

- `build-lock.sh 'pnpm build && next start ... && shoot.mjs --paths /ko/hands/aa,/ko/hands/jj
  --viewports 1440x900,390x844 --themes dark,light --fold'` → build rc 0, 142 static pages,
  16 screenshots in `artifacts/3bettilt-stage3-visual-qa/wp13b-K1/`, all `overflowX:0`, `h1:1`.
- Visually inspected `ko_hands_aa` (1440 dark, 390 light) and `ko_hands_jj` (1440 light): no
  duplicated Facts, FAQ section renders correctly under "관련 가이드"/"이런 이야기도 있어요",
  comparison table and RFI diagram intact, both themes readable, no overflow at 390px.

## Known limitations

- Did not add new glossary `<Term>`s (broadway/gap/connector) — out of scope for K1 (pairs only,
  no such terms used in these five files).
- `relatedTools` left as `toolStartingHand` + `toolEquity` per all five records — audit suggested
  re-selecting pairs to `toolStartingHand` only, but `batchGate.ts`'s shared assertion
  (`carries the outbound links a hand page needs`) requires both to be present, and changing that
  shared, non-owned file is out of my file boundary. Flagging per brief's instruction rather than
  making the change.

## Open issues

- (out of scope, not mine) `hand-99` (K2) thin-content failure and `hand-ako` (K3) readMinutes
  mismatch, both visible in the full `content.test.ts` run — pre-existing/concurrent, not caused
  by this batch.
- (proposal, unchanged) `RelatedContent.RELATED_LABELS` lacking `'관련 가이드'` — carried over
  from WP-S3-13a, not actioned here.

## Exact facts next agent may rely on

- All five K1 files now have a real FAQPage-emitting section; `extractFaqItems` will find 2–3
  items each.
- `hand-kk` readMinutes is 3 (not 2); `hand-qq` readMinutes is 3 (not 2). `hand-jj` and `hand-tt`
  now carry `relatedArticles: ['blog-next-best-after-aa']`.
- `aa.mdx` no longer contains the word "대부분" in the AA/KK equity-gap paragraph.

## Facts next agent MUST re-check

- If K2/K3/K4 agents change `batchGate.ts` or shared facts/glossary data, re-run
  `k1.test.ts` — its ruling-28 pins read live values via `factValue`/`evaluateHandRank`, not
  typed numbers, so they will only break on a real dataset change (expected behavior).
- Full-suite `content.test.ts` should be clean once K2 (`hand-99`) and K3 (`hand-ako`) land their
  own fixes — re-run then to confirm no cross-batch regression from this work.
