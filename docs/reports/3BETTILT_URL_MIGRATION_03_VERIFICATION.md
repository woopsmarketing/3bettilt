# 3BetTilt URL Migration 03: Verification

The baseline was the pre-migration production build (`.next`, `/ko` layout), with its HTML copied
aside before rebuilding. That build predates the last `image seo` commit, but that commit changed no
routes, titles or descriptions. The JSON-LD comparison below confirms the markup matches.

## Gates

| Gate | Result |
| --- | --- |
| `tsc --noEmit` (apps/fishtilt) | PASS |
| `eslint apps/fishtilt/src apps/fishtilt/tests apps/fishtilt/next.config.ts` | PASS (0 problems; 2 pre-existing warnings exist only in the ignored `.data/tools/seo-audit.mjs`) |
| `vitest --project fishtilt` | **PASS: 235 files, 2629 tests** |
| `next build` (production; run twice, since a root-URL fix landed between builds) | PASS, **`ƒ` dynamic routes = 0**, all `○`/`●` |
| Built-HTML audit (all 142 documents, scripted) | PASS (below) |
| Redirect sweep, 142 legacy URLs against `next start` | 142/142 |
| E2E (Playwright, production server) | Initial full run: 342 passed, 2 failed (stale `seo.spec.ts` expectations). Both fixed in the follow-up; targeted `seo.spec.ts` 31/31 PASS. Known SEO E2E failures now: **0** |

## Built-HTML SEO audit (after vs before)

| Check | Result |
| --- | --- |
| Documents under the default locale | 142 (same path set as before, minus `/ko`) |
| Indexable pages (`robots: index`) | **141** |
| Sitemap `<loc>` | **141**, unique 141, `/ko` 0, non-indexable 0, same set as before after removing `/ko` |
| Sitemap hreflang alternates | 282, `/ko` 0 |
| Canonical | 142 unique (141 indexable + `/search`), every one = own prefixless URL, `/ko` 0 |
| `og:url` | = canonical on all 142 |
| `<head>` hreflang | **282** = 141 × (`ko-KR` + `x-default`), both = own canonical; no `en`; `/search` has none |
| Title / description / H1 | **0 differences** from the pre-migration build on all 142 pages |
| JSON-LD | 927 site URLs, **0 `/ko`**; on all 142 pages the JSON-LD equals the pre-migration JSON-LD with only the `/ko` prefix removed (types, names and content unchanged) |
| Internal links (`<a href>`) | 4257 total, 3823 internal, **`/ko` hrefs 0, broken 0** |
| `/ko` anywhere in built `.html`/`.rsc`/`.body` files | **0 files** |
| robots.txt | unchanged: `Allow: /`, `Sitemap: https://3bettilt.com/sitemap.xml` |
| `_not-found` | noindex, no canonical |
| `/search` | `noindex, follow`, canonical `https://3bettilt.com/search`, not in sitemap |

## Tests added or updated

- **New** `src/lib/legacyLocaleRedirects.test.ts`: 142 entries; equals sitemap + `/search`; exact 1:1 mapping incl. the 10 representative URLs; every destination is a live page; no destination is a source (no loop/chain); no pattern rules, `/ko/does-not-exist` not covered; `next.config.ts` serves exactly this list and no `/` redirect.
- **New** `src/lib/seo/urlMigration.test.ts`: sitemap 141 unique with no `/ko`; route and content paths have no `/ko`; canonical, `og:url` and hreflang are prefixless, self-referencing and 141 unique; no second-language alternate; **all 141 titles and descriptions equal `seoMetadataContract.fixture.json`**, which was extracted from the pre-migration build's HTML; `/search` noindex.
- `locale.test.ts`: prefixless default, the future `/en` contract (`localePath('en', …)` → `/en/…`), legacy prefix refused. The `/ko` literal guard is kept.
- `canonical.test.ts`, `metadata.test.ts`, `routes.test.ts`, `site.test.ts`, `sitemapEntries.test.ts`, `jsonLd.test.ts`, `homeSiteIdentity.test.tsx`, `Breadcrumbs.test.tsx`, `seoTitleCoverage.test.tsx`, `blogHubModel.test.ts`: expectations moved to the prefixless contract. No assertion was dropped.
- `tools/equity/page.test.tsx`: its "never link an unavailable tool" loop never ran before, because `/ko/tools/…` never matched `startsWith('/tools/')`. Now it looks up every route, so the check actually runs.
- Component tests (`CtaBand`, `NextRead`, …) use prefixless sample hrefs.
- E2E `locale.spec.ts` rewritten: `/` returns 200 with a root canonical; 14 new URLs return 200 with their own canonical; 11 old URLs return 308 in one hop to the exact new URL, then 200; `/does-not-exist`, `/ko/does-not-exist`, `/ko/learn/does-not-exist`, `/en`, `/en/learn` and `/xx/learn` return 404 with the site's 404 page; hreflang has only `ko-KR` + `x-default`.
- E2E `seo.spec.ts`: `hubOf`/`familyOf` helpers and the OG-card path regex now use `sitePathOf`. They silently depended on the 3-character `/ko` prefix. The 404 case list is updated (`/learn` is a page now).

## E2E notes from the initial full run (items 1–2 since fixed, see Follow-up)

1. `seo.spec.ts` "every JSON-LD block parses and declares a type…" fails on a nested `ImageObject`, which the `image seo` commit added to `Article`.
2. `seo.spec.ts` "WebApplication markup appears on tool pages and nowhere else" fails on `/practice/*-quiz`, which got `WebApplication` in the quiz JSON-LD commit.

   Both predate this work. The built JSON-LD is identical to the pre-migration build apart from the
   prefix, and neither test's logic depends on the `/ko` prefix; neither spec was run in those tasks.
   Both were stale test expectations, not markup defects. They were fixed in the follow-up below
   (test-only change); `seo.spec.ts` now passes 31/31.
3. `learn.spec.ts`: 2 JavaScript-disabled tests timed out in the full parallel run. The local image optimizer stalled on AVIF encodes (`/_next/image` requests pending more than 60 s; WebP and JPEG were instant). After a server restart, `learn.spec.ts` passed 19/19. This is not caused by routing: `/_next/*` is excluded from every redirect rule.

`NoFallbackError` lines in the `next start` log appear once per unknown slug under `dynamicParams = false`. That's Next internal logging for a correct 404.

## Not run (per brief)

Visual regression and screenshot suites, image reprocessing, the monorepo-wide test run. (Commit, push and deploy were not part of the verification task.)

## Follow-up (2026-09-17): the two stale `seo.spec.ts` expectations fixed

Only `tests/e2e/seo.spec.ts` changed. No JSON-LD, page or migration production source was changed in the follow-up.

1. **Nested `ImageObject`.** The test was written before the image-SEO commit put an `ImageObject` in `Article.image`.
   - `ImageObject` is now allowed as a nested type only.
   - A new check, `nestedImageObjectsInPlace`, requires every `ImageObject` in a block to be that block's own `Article.image` (exactly one, and only on an `Article`).
   - The top-level `@type` allowlist and `@context` checks are unchanged, and a top-level `ImageObject` still fails.
2. **`WebApplication` on quizzes.** The test was written before the quiz JSON-LD decision and inferred "application" from the `/tools/` prefix.
   - It now uses an explicit list of 9 pages: 6 tools and 3 practice quizzes. Each must be in the sitemap and carry exactly one `WebApplication` block.
   - Every other sitemap page, including the `/tools` and `/practice` hubs, must carry none.

Targeted E2E: `seo.spec.ts` **31/31 passed** against the existing production build (`next start`).

**Final E2E status:** initial full run 342 PASS + 2 stale-expectation FAIL → both expectations fixed → targeted `seo.spec.ts` 31/31 PASS. Known SEO E2E failures: **0**.
