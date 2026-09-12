# WP-S3-16 SEO INTEGRATION — brief

FIRST read `docs/reports/stage3/AGENT_COMMON_RULES.md` (mandatory; build-lock in the FOREGROUND, timeout 600000;
never end your turn waiting on a background task; never prettier `.mdx`). Then ORCHESTRATOR DECISIONS in
`docs/3BETTILT_STAGE3_STATE.md`, `3BETTILT_KEYWORD_MAP.md`, `3BETTILT_CANNIBALIZATION_MAP.md`, handoffs
`WP_S3_01A/01B` (origin/locale), `WP_S3_06` (graph, relation fields), and the **"Open issues" / "for WP-16" sections of
every handoff in `docs/reports/stage3/handoff/`** (grep `WP-16`, `WP-S3-16`, `SEO`, `orphan`, `관련 가이드`) — those are
yours unless they are code-behaviour bugs outside SEO.

The site is otherwise content-complete when you start (blog 19 + 6 stories, learn 15, glossary ~63+, hands 169 index
+ 20 rich pages, tools 6, quiz, search, about). Your job is an **exhaustive** SEO/IA integration pass, verified in
the built HTML, not in source alone.

## Scope (master §CS)
1. **Metadata**: every indexable route has a unique `<title>` (brand suffix policy consistent), unique meta
   description of useful length, `og:title/description/url/image/type/locale(ko_KR)/site_name=3BetTilt`, twitter card.
   `seoTitle` ≠ H1 where the registry gives one. No `fishtilt`/`FishTilt`/placeholder domain anywhere public.
2. **Canonical**: absolute `https://3bettilt.com/ko/...`, self-referencing, trailing-slash policy consistent with
   sitemap and internal links; none on 404; `/search` noindex (+ follow) and absent from sitemap; noindex pages absent
   from sitemap; the `/` → `/ko` redirect page not in sitemap.
3. **Locale / hreflang**: `<html lang="ko">`; hreflang `ko-KR` (or `ko`) + `x-default` only where truthful (single
   locale today — alternates must point to real URLs); make sure adding a future locale doesn't emit fake alternates.
4. **JSON-LD** (parse every block in the build): WebSite(+SearchAction only if `/ko/search?q=` really works),
   Organization (no invented company data), BreadcrumbList on all non-home pages matching visible breadcrumbs,
   Article/BlogPosting for blog + stories (stories: no fake author persona; disclosure), LearningResource/Course or
   Article for learn as already decided, DefinedTermSet/DefinedTerm for glossary, FAQPage only where FAQ is visible
   (the `### 질문?` convention), CollectionPage/ItemList on hubs, SoftwareApplication/WebApplication for tools only if
   truthful. No schema for content that isn't on the page.
5. **Sitemap / robots**: every indexable route exactly once, absolute URLs, `lastModified` truthful (don't invent dates
   — if no reliable date, omit), robots allows all + points to the absolute sitemap. Check preview-environment
   indexing risk (see docs handoff `WP_S3_DOCS_HANDOFF.md` if present).
6. **Internal graph**: run a crawl of the built HTML (write a script under `.data/tools/`, gitignored): broken internal
   links = 0, every indexable page has ≥ 2 inbound contextual links (critical orphans = 0; report the inbound-count
   distribution), hub → child coverage, breadcrumbs. Known items: tool pages should link relevant hand stories
   (`이런 이야기도 있어요`) where genuinely related; the "관련 가이드" label used on tool pages is outside the
   D-S3-16 `RELATED_LABELS` union — resolve (add to the union with a test, or map to an existing label; document);
   ad-hoc "브로드웨이" definitions in `content/hands/kjs.mdx`/`jts.mdx` → `<Term>` link if the glossary term exists.
   Fix orphans by adding **genuine** relations (registry relation fields) or contextual MDX links — never link spam.
7. **Cannibalization**: verify each primary intent in the keyword map has one owner page; titles/H1s of rival pages
   (Learn vs Blog search-guide vs Glossary vs Hands vs Tools) don't target the same query; fix with retitle/seoTitle or
   cross-link; update `3BETTILT_KEYWORD_MAP.md` + `3BETTILT_CANNIBALIZATION_MAP.md` to final state (DoD #33/#34).
8. **Image metadata**: og:image exists and resolves for every indexable page (default brand OG image if none),
   dimensions declared, `alt` on all content images, decorative SVG `aria-hidden`.

## File boundary
- `src/lib/seo/**`, `src/app/sitemap.ts`, `src/app/robots.ts`, `generateMetadata`/JSON-LD wiring in route files
  under `src/app/[locale]/**` (metadata/JSON-LD parts only — not page layouts), `src/content/graph.ts` + tests,
  the `RELATED_LABELS` type/source + `RelatedContent` label rendering, registry **relation fields** (and `seoTitle`/
  `description`) in any `src/content/registry/**` batch file, contextual link edits in `content/**/*.mdx` (by hand),
  `public/` OG image if a default is missing (deterministic, generated from code/SVG — no AI art pretending to be poker
  facts), `tests/e2e/seo.spec.ts` (exists — extend) + `tests/e2e/locale.spec.ts`, the two maps above, `docs/reports/stage3/handoff/WP_S3_16_HANDOFF.md`.
- NOT yours: page layouts/visual components, `globals.css`, tool logic, quiz logic, content prose rewrites beyond a
  link or a sentence to carry a link. Report anything else.

## Done when
- typecheck 0; `pnpm vitest run --project fishtilt --project learn-core` 0 failures; eslint clean; build ok, no `ƒ`;
  `pnpm e2e:fishtilt` SEO-relevant specs green (+ extend `seo.spec.ts` asserting canonical/og:url/lang/JSON-LD parse/
  single title on a sample of every route family).
- Built-HTML audit report `docs/reports/stage3/WP_S3_16_SEO_AUDIT.md`: per route family counts (titles unique,
  descriptions unique, canonical ok, og ok, JSON-LD types + parse ok, hreflang, in sitemap, noindex), crawl result
  (broken 0, orphan list before/after, inbound distribution), cannibalization decisions, brand scan (`FishTilt`,
  `FISHTILT`, `fishtilt.example`, `example.com`, `localhost` in public HTML = 0).
- Handoff. Final reply ≤ 25 lines. Stop.
