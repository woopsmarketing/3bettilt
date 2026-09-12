# WP-S3-11 GLOSSARY HUB + TEMPLATE — brief

FIRST read `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000; never
end your turn waiting on a background task; never prettier `.mdx`). Then ORCHESTRATOR DECISIONS in
`docs/3BETTILT_STAGE3_STATE.md`, `handoff/WP_S3_03_HANDOFF.md` (primitives), §4 "Glossary 감사" of
`docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` (lines 237–313: per-term fields, proposed categories, orphans, alias
gaps, proposed new terms) and the glossary rows of `3BETTILT_KEYWORD_MAP.md` / `3BETTILT_CANNIBALIZATION_MAP.md`.
Build + shoot the current `/ko/glossary` and one term first.

## Goal (contracts AU/AV/AW)
Glossary = a fast dictionary, not long-form. Today `/ko/glossary` is a long 2-column wall of 58 cards.
1. **Categories**: finalize from the real inventory (candidates: 게임 구조 · 베팅/액션 · 포지션 · 카드/족보 · 확률/수학 ·
   시작 핸드/레인지). Implement as typed data with an exhaustive test (every term in exactly one category, no empty
   category). You may add an optional `category` to `GlossaryRecord` in `src/content/types.ts` (additive, glossary-only)
   or keep a mapping module like learn's `registry/learn/categories.ts` — your call.
2. **Hub `/ko/glossary`**: search field (client-side filter over the static list with a no-JS fallback: the full list is
   in the HTML), popular terms, category navigation, Korean alphabetical (ㄱ ㄴ ㄷ … initial-consonant) navigation, English
   aliases visible (e.g. "쓰리벳 · 3-Bet · 3bet"). Dense and scannable — an index/dictionary layout, not cards. Keep
   `DefinedTermSet` JSON-LD truthful. Keep static prerender; minimal client JS.
3. **Detail `/ko/glossary/[slug]`**: term (Korean) + English name/aliases, one-line definition (`shortDefinition`),
   "쉽게 설명하면", example, optional deterministic mini visual (PokerCards/BoardCards) when the term is about cards,
   같이 알아둘 용어 (related terms), 더 배우기 → Learn, 직접 확인하기 → Tool, related guide/story (blog relations; 6
   hand stories exist). The template renders these slots from record relations + MDX; content agents will fill MDX
   sections per term later. DefinedTerm JSON-LD truthful.
4. **Registry split for parallel content work**: split `src/content/registry/glossary/j1.ts` (27) and `j2.ts` (31) +
   their tests into ~10-term batch files grouped by your final categories (e.g. `g1.ts`…`g6.ts`), keeping every record's
   id/slug/order semantics and every existing assertion (move, don't weaken), plus the barrel. Also split the glossary
   MDX import map if it is one file. Build output unchanged except your template/hub changes.
Do not rewrite the 58 MDX bodies or create new terms (WP-S3-12 content agents will: 8–10 terms each, plus new terms
like 브로드웨이, 커넥터/갭, 거트샷/오픈엔디드, 셋/트립스, IP/OOP).

## File boundary
- `src/app/[locale]/glossary/**`
- `src/content/registry/glossary/**` (split) + glossary MDX import map under `src/content/glossary/` if any
- `src/content/types.ts` — only an additive glossary field if you choose that route
- `src/components/Term.tsx` (popover) only if the template needs it — keep its API
- NEW components (prefix `Glossary*` / `src/components/glossary/`) + tests
- `tests/e2e/glossary.spec.ts`
- `docs/reports/stage3/handoff/WP_S3_11_HANDOFF.md`
NOT yours: everything else — other agents are concurrently finishing blog batch i1, the hands template, and
quiz/search/header/footer (the search agent reads glossary aliases; don't change the alias data shape without reporting).
`globals.css`, `src/lib/seo/**`, `graph.ts`: report needed changes.

## Done when
- typecheck 0 (report failures outside boundary); `pnpm vitest run --project fishtilt src/content src/app/\[locale\]/glossary src/components/glossary`
  green for your files; eslint clean; glossary e2e green via build-lock; build ok, no `ƒ`.
- Screenshots into `artifacts/3bettilt-stage3-visual-qa/wp11/`: `/ko/glossary` (1440 full + fold, 390 full + fold, 320),
  `/ko/glossary/three-bet` and `/ko/glossary/kicker` at 1440 + 390, dark + light. LOOK and iterate.
- Handoff with a precise how-to for WP-S3-12 batch agents: batch files, MDX sections expected per term, how to add a
  new term (record fields, alias uniqueness rule, category, MDX map), which audit items remain per term.
Final reply ≤ 25 lines. Stop when done.
