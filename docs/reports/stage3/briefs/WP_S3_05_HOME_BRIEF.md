# WP-S3-05 HOMEPAGE REDESIGN — brief

FIRST read `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory rules, build mutex — run build-lock commands in
the FOREGROUND with timeout 600000, never end your turn waiting on a background task). Then: the ORCHESTRATOR
DECISIONS table in `docs/3BETTILT_STAGE3_STATE.md`; handoffs `docs/reports/stage3/handoff/WP_S3_03_HANDOFF.md`
(primitives), `WP_S3_06_HANDOFF.md` (blog content types, `publishedStories()`, `blogOfType()`, hub model),
`WP_S3_09_HANDOFF.md` (learn categories/stages module), `WP_S3_14_HANDOFF.md` (tools hub + per-tool questions);
visual docs `docs/reports/stage3/3BETTILT_VISUAL_STYLE_GUIDE.md` and section A (VA-01, VA-02) of
`3BETTILT_VISUAL_ASSET_MANIFEST.md`; the home rows of `3BETTILT_KEYWORD_MAP.md`. Look at the current home:
`artifacts/3bettilt-stage3-visual-qa/s3-resume/ko-1440x900-dark-fold.png` (hero left side empty, everything below
is a wall of bordered cards).

## Goal (contract AD)
Rebuild `/ko` as an editorial homepage — premium, modern, editorial, intelligent, friendly, slightly dramatic;
dark charcoal/black + brand red; light mode equally polished. NOT cheap casino, neon, crypto, generic SaaS, or
everything-in-bordered-cards. Keep the information, fix hierarchy and rhythm: every section must look different
from its neighbours.

Sections (in this order unless you have a strong reason, then document it):
1. **HERO** — left: H1 "홀덤, 외우지 말고 이해하면서 배우세요." + supporting copy + primary "처음부터 배우기"
   (→ learn hub / first lesson) + secondary "무료 도구 보기" (→ tools hub) + truthful micro-facts only (e.g. 초보자용
   / 무료 / 로그인 불필요 — the site really has no login; nothing unverifiable). Right: a **premium editorial visual**.
   No AI image exists (this session cannot generate images), so build the contract-Z hybrid as a deterministic
   composition: the exact cards A♠ K♠ Q♠ J♠ 10♠ rendered with the existing `PokerCard(s)` components (exact faces)
   over a CSS/SVG "table atmosphere" (felt/charcoal gradient, subtle red rim light, depth) — intentional and premium
   at 1440 and 390, not a placeholder. Keep an `EditorialImage`-style slot/prop so the future VA-01 AI photo can drop
   in behind the exact card overlay without layout change (document how). Respect reduced motion if you animate.
2. **어디서 시작할까요?** — intent-based entry points (e.g. 완전 처음 / 규칙은 아는데 다음이 막막함 / 숫자로
   확인하고 싶음 / 이야기로 읽고 싶음) linking to the right place — as rows/list, not a card grid.
3. **LEARNING ROADMAP** — a visual progression built from the learn categories/stages module (not 15 cards).
4. **INTERACTIVE RANGE PREVIEW** — the real range (existing `HomeRangePreview`/`RangeMatrixMini`), with the
   supported-condition label (6-Max · 100BB · First In, learning baseline, never GTO).
5. **FEATURED TOOLS** — hierarchy: one featured tool + secondary list, each with the question it answers.
6. **3BETTILT STORIES** — featured story + secondary stories from `publishedStories()`. Stories are being written
   RIGHT NOW by other agents (0 published at start). Build it data-driven: with ≥1 story it features them
   automatically; with 0 it degrades honestly (hide, or show the editorial promise without fake titles). Test both
   states with the fixture story from `src/content/stories/testing/`.
7. **SEARCH GUIDES** — evergreen answers from `blogOfType('search-guide')` (compact, typographic).
8. **QUIZ** — the practice/quiz entry, inviting.
9. **GLOSSARY DISCOVERY** — popular terms / aliases as an inline term cloud or index strip.
10. **FAQ** — only real questions (reuse the existing home FAQ if present; FAQPage JSON-LD only for visible FAQ).
11. **FINAL CTA** — CtaBand.
Keep JSON-LD WebSite + Organization truthful (no invented company info). One H1. Width: shell 1248px, reading
measure for prose.

Also improve the shared **fallback art** in `src/components/ContentThumbnail.tsx` (the `EditorialImage` fallback on
the blog hub/articles — currently two blank cards with a red square, reads as a placeholder; see
`artifacts/3bettilt-stage3-visual-qa/wp06/ko_blog-1440x900-dark.png`). Make it intentional editorial art per
kind/topic (deterministic SVG/CSS: felt texture, suit motifs, gradients, exact card faces only when the topic
implies specific cards) while keeping its props/API and the existing tests' intent. Re-shoot `/ko/blog` to confirm.

## File boundary
- `apps/fishtilt/src/app/[locale]/page.tsx` + `page.test.tsx`
- `Home*` components (`HomeHeroVisual`, `HomeRangePreview`, `HomeCallToAction` + tests) and NEW components you
  create (prefix `Home*` or `src/components/home/`)
- `apps/fishtilt/src/components/ContentThumbnail.tsx` + test (fallback art only; API stable)
- `apps/fishtilt/tests/e2e/home.spec.ts`
- `docs/reports/stage3/handoff/WP_S3_05_HANDOFF.md`
NOT yours: content/registry/types/graph (read-only; write missing selectors locally in your home module),
blog/learn/tools pages, `globals.css` (compose existing tokens; report a truly needed token), header/footer,
`PageHero` (already has the site-wide H1 keep-all fix), `src/lib/seo/**` (report needed changes).

## Done when
- typecheck 0 for your files; `pnpm vitest run --project fishtilt src/app/\[locale\]/page src/components/Home
  src/components/home src/components/ContentThumbnail` green; eslint clean; home e2e green via build-lock; build ok,
  no `ƒ`; `tests/e2e/client-bundle.spec.ts` still green (home mostly server-rendered).
- Screenshots via build-lock + shoot.mjs into `artifacts/3bettilt-stage3-visual-qa/wp05/`: `/ko` at 1440x900 and
  390x844 (full + `--fold`), dark + light, 320x700 overflow check; plus `/ko/blog` 1440 dark after the fallback-art
  change. LOOK at them critically as a designer (empty space, tiny type, card walls, repetition, crop, CTA priority,
  theme mismatch). Iterate until it reads as a premium editorial product.
- Handoff: sections, data source per section, how stories auto-appear, how the VA-01 photo slots in, anything left
  for WP-15 header/footer. Final reply ≤ 25 lines. Stop when done.
