# WP-S3-07 EXISTING BLOG MIGRATION — brief (batches i1, i2, i3, i4)

You migrate the 5 existing blog articles of ONE registry batch file (your batch is in your task message) to the
new 3BetTilt blog: search-intent-complete guides with editorial quality.

## Read first
1. `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000).
2. `docs/reports/stage3/handoff/WP_S3_06_HANDOFF.md` — section "WP-07 (기존 20편 리라이트)": registry fields
   (`title` H1, `seoTitle?`, `description` deck/meta, `contentType`, `readMinutes` measured), MDX conventions
   (`<QuickAnswer>` first with numbers as `<Fact>`, ≥3 `##` → auto TOC, unique `##` per article, FAQ only via
   `## 사람들이 자주 헷갈리는 부분` + `### 질문` convention — never together with `<FAQ>`, exactly one `<ToolCTA>`,
   tables/Figure/DataTable auto-breakout), and how related groups derive from record relations.
3. `docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` §2 — the entries for YOUR 5 articles (decision: RENAME /
   LIGHT EXPAND / DEEP EXPAND / MERGE / MOVE ROLE, new H1, new intent, outline, visual, tool, learn, glossary, FAQ,
   schema) and the §6.1 NUMBER-RISK rows naming your files. Also grep your slugs in
   `docs/reports/stage3/3BETTILT_KEYWORD_MAP.md` and `3BETTILT_CANNIBALIZATION_MAP.md` (primary query, rivals: your
   article must not try to own the Learn/Tool/Glossary page's query — it answers its specific question).
4. Look at 2 existing MDX files and your registry batch file + its test before writing.

## Quality bar (master contract AI/AJ/BO/BP/BR)
- A search guide must completely resolve its query — naturally covering Definition, Reason, Example, Data,
  Comparison, Visual, FAQ, Tool, Related as fits. No "SEO length" padding; no stubs.
  Example of the intent: "AKs와 AKo는 무슨 차이일까?" → "AKs vs AKo 차이: 수티드가 실제로 얼마나 중요한가?"
  covering suited/offsuit, 4 vs 12 combos, actual equity, why the difference exists, flush possibility, 13×13
  position, supported RFI comparison, PokerCards, FAQ, Starting Hand Tool, Equity Tool, Learn, Glossary.
- H1 may be human/curious; `seoTitle` states the query. Both must match the content.
- Every number via `<Fact>` / engine / dataset (and pinned by your batch test where the audit says so). Deterministic
  visuals: PokerCards, BoardCards, DataTable, ComparisonTable, StatsRow, range embeds — never AI-looking art.
- Contextual in-body links (first mention of a glossary term → glossary; "승률" → equity tool; range → range tool;
  related lesson; related hand story where one genuinely fits — 4 stories now exist: `qq-vs-72o-flop-227`,
  `full-house-loses`, `qq-three-bet-frustration`, `river-changes-everything`). Fill record relations
  (`relatedConcepts` existing glossary ids, `relatedTools` route ids, `relatedHands`, `nextLessons`,
  `relatedArticles`) — verify every id exists.
- FAQ only with real next-questions (2+ items to count); no FAQ where it doesn't fit.
- Korean, friendly, 존댓말 consistent with existing blog; no GTO wording; ranges only as the 6-Max·100BB·First-In
  learning baseline; facing-raise ranges unsupported; no table-action prescriptions ("~해야 한다" advice is caught by
  `copy-guards.test.ts` — teach concepts, don't prescribe live actions).
- MOVE ROLE articles: change `contentType` (e.g. to 포커 개념·문화) and adapt shape; RENAME: title/seoTitle/intent.

## File boundary
- `apps/fishtilt/src/content/registry/blog/<iN>.ts` + `<iN>.test.ts`
- `apps/fishtilt/src/content/blog/<iN>.ts` (MDX import map for your batch — only if you add/remove an article)
- `apps/fishtilt/content/blog/<your 5 slugs>.mdx`
- `docs/reports/stage3/handoff/WP_S3_07_<IN>_HANDOFF.md`
- batch-specific extras listed in your task message (only those).
Nothing else: other batches, stories, learn, glossary, hands, components, types/graph are not yours. Other agents are
concurrently migrating the other 3 batches, finishing the homepage and learn lessons, and writing stories.

## Done when
- `pnpm vitest run --project fishtilt src/content` — every failure naming your ids fixed; list any others.
- typecheck 0 (report failures outside your boundary); eslint clean on your TS files; prettier on your files only.
- Build + screenshots of 2 of your articles (1440x900 + 390x844, dark + light, `--fold`) via build-lock + shoot.mjs
  into `artifacts/3bettilt-stage3-visual-qa/wp07-<iN>/`; LOOK at them (QuickAnswer, TOC, tables at 390, links).
- Handoff: per article — decision applied, old → new H1/seoTitle, intent, sections, every number's source, FAQ
  count, relations/in-body links added, NUMBER-RISK closed.
Final reply ≤ 25 lines. Stop when your batch is done.
