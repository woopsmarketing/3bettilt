# WP-S3-18 INDEPENDENT REVIEW — briefs for Reviewers A/B/C/D

Rules for ALL reviewers:
- You are an INDEPENDENT reviewer with fresh context. You did not build this. Nobody wants a particular verdict from
  you. Judge the product as it is; do not rubber-stamp and do not invent problems to look thorough.
- **You do not change code.** No edits, no fixes, no formatting, no test edits. You read, run read-only checks, look
  at built pages/screenshots, and write ONE report.
- Every finding: `SEVERITY | area | what is wrong | evidence (path:line, screenshot path, or command + output) |
  why it matters | suggested direction`. Severity = BLOCKER (must not ship) / MAJOR / MINOR / NOTE.
  A finding without concrete evidence does not count. Say explicitly when you checked something and it was fine.
- Do not run `pnpm build` or the full e2e suite (the orchestrator holds the build mutex and runs those). A production
  build already exists under `apps/fishtilt/.next`; read the built HTML there, and use the screenshots in
  `artifacts/3bettilt-stage3-visual-qa/`. If you truly need a page rendered that no screenshot covers, say so in the
  report instead of building.
- Context to read: `docs/3BETTILT_STAGE3_STATE.md` (ORCHESTRATOR DECISIONS — these are settled owner decisions; a
  finding that merely relitigates one will be rejected), `docs/reports/stage3/handoff/*`, and the docs your section
  names. Report at `docs/reports/stage3/review/WP_S3_18_REVIEW_<X>.md`. Final reply ≤ 25 lines: counts by severity +
  the BLOCKERs only.

---

## Reviewer A — POKER / MATH / CONTENT CORRECTNESS (Opus, high effort)
The question: **is anything on this site false, misleading, or unsupported to a poker player who knows the game?**
- Sample deeply across Learn (15 lessons), Blog (19 articles), Hand Stories (6), Glossary (~63+), Hands (20 rich +
  the 169-cell index), Tools (6). Read the actual MDX and the registry records, and verify numbers against the
  engines (`packages/learn-core`, `@gto-self/strategy-core`) — recompute, don't trust the prose.
- Check: equity/odds/outs/combination claims; hand-ranking correctness; kicker and split-pot rules; board reading;
  every Hand Story's cards, board, pot arithmetic, showdown result and the visible reconstructed-scenario
  disclosure; range claims limited to the 6-Max · 100BB · First In learning baseline and never called GTO or
  attributed to a source; "always/never" overstatements; prescriptive live-play advice; Korean poker terminology
  correctness and consistency; beginner-comprehension (would a beginner be misled?).
- Explicitly hunt for: numbers that appear in prose but are not `<Fact>`/engine-derived, claims pinned by no test,
  and any place where equity vs rank vs frequency are conflated.

## Reviewer B — PRODUCT / UX / VISUAL (Opus, high effort)
The question: **is this a premium, coherent product a beginner would keep reading?**
- Walk the whole site through the screenshots in `artifacts/3bettilt-stage3-visual-qa/` (every wpNN folder; wp17 is
  the newest) plus the built HTML for structure. Desktop 1440, mobile 390, 320 overflow, dark AND light.
- Judge: first-impression quality of `/ko`; whether a beginner knows where to start; navigation and information
  scent; card-wall/visual-repetition; typographic hierarchy and reading rhythm; empty space; CTA priority; Korean
  line-breaking; mobile layout and touch targets; theme consistency; tool result readability; matrix usability;
  quiz experience; search results; header/footer; about-page trustworthiness; consistency of components and labels
  across sections; content that looks like a placeholder.
- Also: does the site's promise match what it delivers, and is anything (badge, claim, section) overselling?

## Reviewer C — SEO / IA / CANNIBALIZATION (Fable, high effort)
The question: **would this site earn and keep Korean search traffic without tripping over itself?**
- Read the built HTML in `apps/fishtilt/.next` (server/app output) plus `sitemap.xml`/`robots.txt`, and
  `docs/reports/stage3/3BETTILT_KEYWORD_MAP.md`, `3BETTILT_CANNIBALIZATION_MAP.md`,
  `WP_S3_16_SEO_AUDIT.md`, `docs/DEPLOY_3BETTILT.md`.
- Check: title/description uniqueness and quality per route family; canonical/origin/trailing-slash consistency;
  hreflang and `/ko` architecture (and whether a second locale could be added without lying); JSON-LD truthfulness
  and validity (parse every block; FAQPage only where FAQ is visible; no schema for absent content); breadcrumbs;
  sitemap completeness and correctness; robots; noindex placement; internal link graph, orphans and anchor-text
  quality; **cannibalization** — one owner page per intent across Learn/Blog/Glossary/Hands/Tools, with the actual
  titles as evidence; content depth vs the query it targets; image/og metadata.

## Reviewer D — ENGINEERING / PERF / TEST / DEPLOYMENT (Sonnet)
The question: **is this safe to ship and maintainable?**
- Read-only checks you MAY run: `pnpm --filter @gto-self/fishtilt typecheck`, `pnpm lint`,
  `pnpm vitest run --project fishtilt --project learn-core`, and reading `.next` build output.
- Check: test quality (are the assertions real, or weakened to pass? any skipped/`.only` tests? do the content
  guards actually guard?); typed-registry and content-graph integrity; client-bundle size and which pages ship
  client JS unnecessarily; static prerender (no `ƒ`); dead code and duplicated systems left by parallel agents
  (multiple agents touched this tree — look for two implementations of one thing); accessibility regressions
  visible in markup; error/404 handling; `docs/DEPLOY_3BETTILT.md` accuracy against the actual config
  (`next.config.ts`, `package.json`, `.nvmrc`, workspace deps) — flag anything that would fail on Vercel;
  CLAUDE.md rule compliance (milliBB money, layering, no live-play/OCR surfaces, no invented GTO numbers).
