# WP-S3-13b K4 — hands content (kqs, kjs, qjs, jts, t9s)

## Objective
Enrich the 5 K4 hand pages' MDX to stop duplicating template-rendered data (combo/ratio/N-in-one
from §3; rank/top-share/equity from §5+well; rank±2 neighbours+twin from the comparison table),
keep the hand-specific "why/context" narrative, add a real FAQ (`## 자주 묻는 것` + ≥2 `### ...?`),
and close K4's NUMBER-RISK items.

## Facts verified before work
- Computed via `factValue` (never typed from memory): KQs rank16/eq63.40%/combos4/top7.84%; KJs
  rank20/eq62.57%/top9.80%; QJs rank28/eq60.26%/top14.18%; JTs rank45/eq57.53%/top23.53%; T9s
  rank64/eq54.03%/top34.84%; also TT rank5/eq75.01%, 22 rank87/eq50.33%, AKs rank8/eq67.04%.
- `rankNeighbours(class, span=2)` = rank±2 + s/o twin only. None of KJs/QJs/JTs/T9s fall inside
  each other's ±2 window (e.g. KQs=16, KJs=20 — 4 apart), so the KQs→KJs→QJs→JTs→T9s "suited
  chain" narrative in the MDX is genuinely NOT shown by the comparison table — kept, not removed.
- `## 조합과 확률` sections in all 5 files duplicated §3 exactly (HAND_COMBOS + HAND_ONE_IN_N for
  the hero hand) — removed from all 5.
- FAQ contract (`faq.ts`/`faq.test.ts`): needs `## 자주 묻는 것`, ≥2 `### ...?`, answers with zero
  JSX (`<Fact>`/`<Term>`/anything). Wrote every FAQ answer as plain prose with no embedded numbers
  that would require a `<Fact>`.
- No glossary term exists yet for "브로드웨이"/"커넥터"/"갭" (confirmed via `content/glossary/*`
  listing) — kept the ad hoc broadway definition in kjs/jts as prose (not `<Term>`), matching
  13a's stated limitation.

## Decisions made
- Removed the `## 조합과 확률` section from all 5 files (template §3 dup).
- Kept each file's suited-chain comparison section (KQs↔KJs, KJs↔KQs/QJs, QJs↔KJs/JTs,
  JTs↔KQs/QJs, T9s↔JTs/22/TT) since the template's own comparison table does not cover these
  pairs (rank distance > 2, no twin relationship).
- Softened jts.mdx `:13` NUMBER-RISK item: removed "50%를 넉넉히 넘습니다" → "아직 50%를 넘지만"
  (still true — 57.53% — without the unpinned overstatement).
- `relatedConcepts` trimmed from `['term-suited','term-combo']` to `['term-suited']` per file
  (combo-count prose removed, so `term-combo` was no longer used by any `<Term>`; every file still
  uses `<Term id="term-suited">` once).
- `relatedTools`: kept the batchGate-required `toolStartingHand`+`toolEquity` everywhere and added
  `toolOuts` to the true 0-gap suited connectors — kqs, qjs, jts, t9s. Left kjs (a 1-gap "gapper",
  its own prose is about the gap) without `toolOuts`.
- `relatedArticles`: added `blog-why-suited-matters` (B08, existing record `blog-why-suited-matters`
  in `registry/blog/i2.ts`) to all 5 — genuinely on-topic (suited vs offsuit) for every suited hand
  in this batch.
- `readMinutes`: kqs/kjs/jts → 3 (their post-edit prose crosses the 400-char/min line), qjs/t9s
  stayed 2. Values are whatever `estimateReadMinutes` computes post-edit, per batchGate.

## Files changed
- `apps/fishtilt/content/hands/{kqs,kjs,qjs,jts,t9s}.mdx` — rewritten per hand (hook + 2 context
  sections + Callout + FAQ; combo/probability section removed from all 5).
- `apps/fishtilt/src/content/registry/hands/k4.ts` — `relatedConcepts`, `relatedTools`,
  `relatedArticles`, `readMinutes` updated per hand (see above).
- `apps/fishtilt/src/content/registry/hands/k4.test.ts` — untouched (existing ruling-28 pins
  still pass unchanged).
- This handoff.

## Tests run
- `pnpm vitest run --project fishtilt src/content/registry/hands src/content/content.test.ts
  "src/app/[locale]/hands" src/copy-guards.test.ts` → **157 passed / 0 failed** (all files,
  no ids outside K4 touched).
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint apps/fishtilt/src/content/registry/hands/k4.ts
  apps/fishtilt/src/content/registry/hands/k4.test.ts` → 0 errors.
- `pnpm exec prettier --write apps/fishtilt/src/content/registry/hands/k4.ts` (TS only, never
  `.mdx`) → unchanged.

## Build/runtime evidence
- `build-lock.sh 'pnpm build && next start :3221 && shoot.mjs …'` → build rc 0, 142 static pages,
  no fishtilt errors. Screenshots (`artifacts/3bettilt-stage3-visual-qa/wp13b-K4/`, 16 PNGs):
  `/ko/hands/kqs` and `/ko/hands/jts` × 1440x900/390x844 × dark/light (+fold). All shots:
  `overflowX: 0`, `h1: 1`.
- LOOKED at kqs (1440 dark, 390 light) and jts (1440 light): fact strip + 13×13 + comparison table
  render correctly with no repeated combo/probability prose; FAQ section renders as a normal
  question list (3 questions each) with no visible markup leakage; jts's auto-derived "이런 이야기도
  있어요" story card (AK7 flop) renders correctly below onward guides.

## Known limitations
- kjs.mdx now carries zero `<Fact>` (only `<Term id="term-suited">` + `<Callout>`) — deliberate:
  every number that would go here (KJs/KQs/QJs rank & equity) is already in the template's own
  fact strip / comparison table, so there was nothing left to state as a number without repeating
  it. Distinct-component floor (`minComponents: 1`) is still cleared.
- FAQ answers about "KQo/KJo/QJo/JTo/T9o vs the suited page" and "another suited page's rank"
  intentionally state no number (a number there would need a `<Fact>`, which drops the FAQ pair) —
  answers instead point the reader to that hand's own page/table.

## Open issues
- None outside this batch's file boundary.

## Exact facts next agent may rely on
- K4's `relatedTools` now includes `toolOuts` for kqs/qjs/jts/t9s (true 0-gap suited connectors),
  not kjs (1-gap). `batchGate.ts`'s `arrayContaining(['toolStartingHand','toolEquity'])` still
  holds for all 5 — `toolOuts` is additive, no assertion changed.
- `blog-why-suited-matters` is a valid, already-registered blog id (`registry/blog/i2.ts`); safe
  for other batches to also link to it from suited hand pages.
- K4 readMinutes: kqs=3, kjs=3, qjs=2, jts=3, t9s=2 (pinned by `estimateReadMinutes` over current
  prose — will drift if that prose is edited again).

## Facts next agent MUST re-check
- If another agent edits `content/glossary/` to add a broadway/connector/gap term, kjs.mdx's and
  jts.mdx's ad hoc broadway `<Callout>` text should be revisited (currently correctly NOT using
  `<Term>` because no such glossary entry exists yet).
- If `blog-why-suited-matters` (i2.ts) content changes kind/id in a later batch, K4's
  `relatedArticles` reference would need re-validation (batchGate's graph-resolution test would
  catch a broken id, but not a kind change that still resolves).
