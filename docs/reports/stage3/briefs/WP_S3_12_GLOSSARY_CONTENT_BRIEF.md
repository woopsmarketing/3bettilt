# WP-S3-12 GLOSSARY CONTENT — brief (batches g1–g9)

You own ONE group of glossary batch files (named in your task message). The hub and the term template are DONE
(WP-S3-11). You write/repair the **term content and record relations** only.

## Read first
1. `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory).
2. `docs/reports/stage3/handoff/WP_S3_11_HANDOFF.md` — especially "Exact facts next agent may rely on — WP-S3-12
   how-to": what the template already renders from data (NEVER repeat it in MDX), the expected MDX sections, the
   new-term procedure, the batch table, and the per-term audit leftovers.
3. `docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` §4 (lines ~237–313) — the rows for YOUR slugs only.
4. Two existing MDX files of your batch + your `registry/glossary/gN.ts` + `src/content/glossary/gN.ts` before writing.

## Goal
For every term you own:
- **MDX body**: no lead paragraph that repeats `shortDefinition` (the template prints it). Structure:
  `## 쉽게 설명하면` → `## 예로 보면` (cards via `<PokerCards>`/`<BoardCards>` — skip if the header visual already
  shows the same cards) → optional `## 헷갈리기 쉬운 부분` / `## 승부는 어떻게 가릴까요`. No `#`, no import/export,
  `<Term id>` once per id per file and only for ids in `relatedConcepts`, every number via `<Fact>`.
  The audit's WEAK definitions (`action`, `hand`) and "예 추가" items (`hand-ranking`, `hand-matrix`) must be fixed.
  Terms in the J1 family (no `## 쉽게 설명하면` yet) get those sections written.
- **Record**: `readMinutes` must equal `estimateReadMinutes` (the test prints the right value); fix the audit's
  `relatedTools` replacements for your slugs (range→toolHandChecker for the 9 rankings/kicker/split-pot/nuts,
  range→toolPotOdds for all-in/stack/bet, range→practice for action/check/fold, toolOuts→toolEquity for
  heads-up/equity, range→toolStartingHand for hand, range→none for ante/blind/c-bet/bluff); fill genuine
  `relatedConcepts`/`nextLessons`/`relatedArticles`/`relatedHands` (verify every id exists — a wrong id fails
  `content.test.ts`). Never link something that isn't genuinely related.
- **New terms** listed in your task message: follow the handoff's 5-step procedure exactly (record + `categories.ts`
  `TERM_CATEGORY`/`TERM_HEADWORD` + MDX map + MDX + optional `visuals.ts` entry). Aliases must be unique
  dictionary-wide, on ONE line.

## Hard rules
- Korean, 존댓말, friendly, dictionary-tight (a glossary entry is short — no padding, no essay).
- Never invent poker numbers; no GTO wording; ranges only as the 6-Max · 100BB · First In learning baseline;
  no prescriptive live-play advice (`copy-guards.test.ts` bans 무조건/반드시 …해야/유리합니/수익성 …); 베팅 not 배팅.
- NEVER run prettier on `.mdx`.
- Stay in your files. Other agents own the other batches and the header/footer/search/quiz/about pages right now.
  A needed change elsewhere (e.g. an inbound link from a learn lesson or a blog article to `c-bet`/`bluff`/`nuts`)
  goes in your handoff as a request, not an edit.

## Verification (KEEP IT NARROW — the orchestrator runs the build and full suite once at the end)
- `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts src/copy-guards.test.ts`
  → every failure naming YOUR slugs fixed; list any others in the handoff.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 (report failures outside your files).
- eslint on the TS files you changed.
- **Do NOT run `pnpm build`, e2e, or screenshots.** MDX compile errors are caught by the orchestrator's single final
  build; keep your MDX conservative (only components already used by existing glossary MDX).

## Deliverable
`docs/reports/stage3/handoff/WP_S3_12_<GN>_HANDOFF.md`: per term — sections written, relations/tools changed,
audit item closed, numbers' sources; new terms added; requests for other owners. Final reply ≤ 20 lines. Stop.
