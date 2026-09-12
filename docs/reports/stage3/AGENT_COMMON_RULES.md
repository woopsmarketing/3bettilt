# Stage 3 — common rules for every sub-agent

Read this whole file (it is short). Then read ONLY the files your task names. Do not read
`docs/STATE.md`, `docs/DECISIONS.md`, old `FISHTILT_*` reports or the full master prompt unless your
task says so — use grep/targeted reads.

## What you are working on

- `apps/fishtilt` = the public **3BetTilt** site (internal names `fishtilt`, `@gto-self/fishtilt`
  stay — never rename them). Next 16 (Turbopack), React 19, Tailwind 4, `@next/mdx`, fully static
  (no DB, no auth, no server runtime, no API routes). Korean-only; every page lives under
  `src/app/[locale]/…` with `SUPPORTED_LOCALES = ['ko']`.
- Read-only dependencies: `packages/learn-core` (exact equity, pot odds, outs, facts),
  `packages/strategy-core` (evaluator, ranges, 169 hand classes), `packages/shared` (cards).
  Do not edit any `packages/*` unless your task explicitly grants it.
- Content: `apps/fishtilt/content/{learn,blog,glossary,hands}/*.mdx` + typed registry
  `src/content/registry/**` + `src/content/types.ts` + graph `src/content/graph.ts`.
- Current decisions you must follow: the table "ORCHESTRATOR DECISIONS" in
  `docs/3BETTILT_STAGE3_STATE.md` (D-S3-xx). Do not reopen them; if one is wrong, say so in your report.

## Hard rules

1. **Git**: never commit, reset, stash, restore, checkout, or clean. Never delete files you did not
   create unless your task says so. `apps/fishtilt` is untracked — there is no undo.
2. **File boundary**: edit only files your task lists as yours. Another agent may be editing other
   files in the same worktree right now. If you need a change outside your boundary, do not make it —
   put the exact change in your handoff under "Open issues". Never touch `apps/web/**`.
3. **Poker data honesty**: never type an equity %, win/tie %, rank, combo count, pot odds, outs %,
   range membership, showdown winner or rule from your own knowledge. Get it from learn-core /
   strategy-core / typed datasets, via the existing `Fact`/facts machinery or a test that computes it.
   Unsupported situations are written as unsupported ("지원하지 않음"). No invented search volumes,
   dates, authors, ratings, reviews, team members or company credentials.
4. **Range policy**: ranges are never called GTO. Only the supported condition (6-Max · 100BB · First
   In) is shown. Never name external range sources; never write "cross-checked with other sources".
5. **Hand stories** are reconstructed scenarios and always show the visible disclosure
   "학습과 재미를 위해 재구성한 핸드 시나리오입니다." — never hidden.
6. **Brand**: public surface says 3BetTilt / wordmark 3BETTILT. Never write FishTilt in public copy.
7. **Locale**: build every href with the helpers in `src/lib/locale.ts` / `src/lib/routes.ts`. No
   `"/ko/…"` string literals in source (tests may assert them).
8. **No live-play assistance, no affiliate/casino/deposit CTA, no login/DB/community.**
9. **Design system (WP-S3-03)**: width utilities `max-w-reading|breakout|grid|shell|matrix|lead|figure`
   only (a test fails on other `max-w-*` literals); type roles `text-prose`, `text-h2`,
   `text-article-h1`, `text-hero-h1`, `prose-ko`; spacing `py-section lg:py-section-lg`; primitives in
   `src/components/` (Section, SplitLayout, StatStrip/StatsRow, Divider, CtaBand, Timeline, PageHero/
   ArticleHero/EditorialHero, ArticleMeta, QuickAnswer, TableOfContents, EditorialImage, DataTable,
   ComparisonTable, Quote, KeyPoint, NextRead, FaqSection/FaqAccordion/FAQ, BoardCards, HandTimeline,
   StreetSection, PositionDiagram, BettingTimeline, RelatedContent). Extend these; do not create a
   parallel system. Colors only via theme tokens (both dark and light must work; light is not
   second-class). No new web fonts, no new npm dependencies without reporting why. Avoid card walls:
   vary layout (split, list, table, timeline, featured+secondary, plain typography).
10. **Images**: this session cannot generate images. Never add fake raster placeholders. Visual slots
    use `EditorialImage` with its CSS/SVG fallback; the asset spec lives in
    `docs/reports/stage3/3BETTILT_VISUAL_ASSET_MANIFEST.md`. Decorative → `alt=""`.
11. **Never weaken a correct assertion to get green.** A test that pins old copy/structure you were
    asked to change may be updated — say which and why in the handoff.
12. **Prettier**: format only files you edited (`pnpm exec prettier --write <files>`), never repo-wide.
    **Never run prettier on `.mdx`** (now in `.prettierignore`): it moves inline `<Fact/>`/`<Term>` onto their
    own lines and splits one sentence into separate paragraphs. Format MDX by hand.

## Commands (run from repo root `/Users/woops/projects/GTO-SELF`)

- Unit (fast gate): `pnpm vitest run --project fishtilt <path-or-filter>`; full app unit:
  `pnpm vitest run --project fishtilt --project learn-core` (~16 s).
- Types: `pnpm --filter @gto-self/fishtilt typecheck`. Lint: `pnpm exec eslint apps/fishtilt/src <paths>`.
- **Anything that builds or serves** (`next build`, `pnpm e2e:fishtilt`, `next start`, screenshots)
  MUST go through the mutex, because all agents share one `.next/` and port 3221:
  `apps/fishtilt/.data/tools/build-lock.sh '<command run with cwd=apps/fishtilt>'`
  - build: `apps/fishtilt/.data/tools/build-lock.sh 'rm -rf .next && pnpm build'`
  - targeted e2e: `apps/fishtilt/.data/tools/build-lock.sh 'pnpm build && pnpm exec playwright test tests/e2e/blog.spec.ts'`
  - screenshots (`shoot.mjs` prints h1 count/size, `<main>` width and horizontal overflow per shot):
    `apps/fishtilt/.data/tools/build-lock.sh 'pnpm build && (pnpm exec next start --port 3221 >/dev/null 2>&1 &) && node .data/tools/shoot.mjs --out ../../artifacts/3bettilt-stage3-visual-qa/<wp> --paths /ko/blog,/ko/blog/aks-vs-ako --viewports 1440x900,390x844 --themes dark,light --fold'`
  - Hold the lock as briefly as possible (one command). It may wait minutes for another agent.
    Run it in the **FOREGROUND** with Bash `timeout: 600000`. Never end your turn "waiting for a
    background notification" — sub-agents are not reliably re-woken by background tasks. If a build fails because of a file outside your boundary, report
    it — do not fix it — and retry later.
  - LOOK at your screenshots (Read the PNG). Visual work is not done until you have seen it at 1440 and
    390 in both themes.

## Handoff (required)

Write `docs/reports/stage3/handoff/<WP>_HANDOFF.md`, ~100–150 lines, facts not prose:

```
# WP
## Objective
## Facts verified before work
## Decisions made
## Files changed
## Tests run
## Build/runtime evidence
## Known limitations
## Open issues
## Exact facts next agent may rely on
## Facts next agent MUST re-check
```

Your final reply to the orchestrator: ≤ 25 lines — what was done, files changed (count + key paths),
tests run with PASS/FAIL counts, screenshots path, remaining risks, handoff path. No long prose.
