# WP-S3-13b HANDS CONTENT — batch K2 brief

You enrich 5 starting-hand pages' MDX content on the finished 3BetTilt hands template. Architecture is fixed — do not
redesign the template, components, or registry structure.

## Read first
1. `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000; never end
   your turn waiting on a background task; NEVER run prettier on `.mdx` — it splits sentences around `<Fact/>`/`<Term>`).
2. `docs/reports/stage3/handoff/WP_S3_13A_HANDOFF.md` — the template structure (what the page already renders from data:
   fact strip, comparison table of rank ±2 + s/o twin, RFI seats, onward guides/stories, related groups) and the 13b
   how-to (which duplicated Fact paragraphs to remove, FAQ format, relations).
3. §5 "Hands 감사" of `docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` (lines 314–343) — your 5 rows + "공통 처방", and
   NUMBER-RISK rows of §6.1 (lines 347–378) naming your files (e.g. #2–#12: unpinned narrative rank claims to pin with a
   test, "대부분" ratio claims to delete or soften, "정확히"/"넉넉히" overstatements).
4. Your registry file and its test, and 1–2 of your MDX files, before writing.

## Your hands (batch K2): 99, 88, 77, 22, a5s
## File boundary
- `apps/fishtilt/content/hands/{99.mdx,88.mdx,77.mdx,22.mdx,a5s.mdx}`
- `apps/fishtilt/src/content/registry/hands/k2.ts` + `k2.test.ts`
- `docs/reports/stage3/handoff/WP_S3_13B_K2_HANDOFF.md`
Nothing else (not `batchGate.ts`, not other batches, not components). Other agents are concurrently working on the
glossary, on quiz/search/header/footer, and on the other 3 hands batches.

## What to do per hand (keep each page a quick, accurate reference — no padding)
- Remove MDX paragraphs that now duplicate what the template renders from data (per the 13a how-to).
- Keep/improve the hand-specific hook: what is interesting about THIS hand (why its rank is where it is, how it plays
  differently from its neighbours, common misconceptions) — concise, beginner-friendly Korean, 존댓말 like the others.
- FAQ: `## 자주 묻는 것` (or the heading the template expects — check the handoff) + ≥2 `### 질문?` (ending with `?`) with
  real next-questions; answers without components (FAQPage rule). No table-action prescriptions ("~해야 한다" is caught by
  copy guards) — explain, don't prescribe.
- Relations in your registry records: `relatedArticles` (existing blog search guides/stories that genuinely concern the
  hand; 6 hand stories exist: qq-vs-72o-flop-227, full-house-loses, qq-three-bet-frustration, river-changes-everything,
  aa-loses, ak-flop-miss — the template also derives stories from real hole cards), `relatedTools` per audit (pairs →
  toolStartingHand, AK/QQ → toolEquity, suited connectors → toolOuts), `relatedConcepts` (existing glossary ids only).
- Every number via `<Fact>` or pinned by a test in your `k2.test.ts` computed from the engine; close the NUMBER-RISK
  items for your files. Ranges: 6-Max · 100BB · First In learning baseline only, never GTO.
- `readMinutes` is measured by the content test — set whatever it computes after your edits. Keep `indexable` honest
  (the threshold test decides).

## Done when
- `pnpm vitest run --project fishtilt src/content src/app/\[locale\]/hands src/copy-guards.test.ts` — no failures naming
  your ids/files (list others). typecheck 0 for your files; eslint clean on your TS files.
- Build + screenshots of 2 of your hands (1440x900 + 390x844, dark + light) via build-lock + shoot.mjs into
  `artifacts/3bettilt-stage3-visual-qa/wp13b-K2/`; LOOK at them (no duplicated facts, FAQ renders, no overflow).
- Handoff: per hand — what was removed/added, FAQ questions, relations, NUMBER-RISK closed, numbers and sources.
Final reply ≤ 25 lines. Stop when your batch is done.
