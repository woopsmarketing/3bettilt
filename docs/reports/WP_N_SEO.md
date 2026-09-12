# WP-N — SEO FOUNDATION

FishTilt (`apps/fishtilt`). Metadata, canonical policy, sitemap, robots, breadcrumbs and
structured data, wired over content that already existed. No content was written, expanded
or rewritten (ruling 68); no curated range landing pages were built (ruling 67).

---

## 1. Scope

| Delivered | Where |
| --- | --- |
| `title` / `description` / `canonical` / OpenGraph / Twitter on **every** route | `src/lib/seo/metadata.ts`, applied in 22 `page.tsx` + `layout.tsx` |
| `sitemap.xml`, `robots.txt` from the two registries | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/seo/sitemapEntries.ts` |
| Canonical policy incl. tool filter state | `src/lib/seo/canonical.ts` |
| Breadcrumbs — visible UI **and** `BreadcrumbList` | `src/components/Breadcrumbs.tsx`, `src/lib/seo/breadcrumbs.ts` |
| `BreadcrumbList` / `Article` / `FAQPage` / `WebApplication` | `src/lib/seo/jsonLd.ts`, `faq.ts`, `faqSource.ts` |
| Index policy driven by `indexable` + route section | `src/lib/seo/policy.ts` |
| Open Graph card (1200×630 PNG) | `public/og.png` |
| Unit tests (87) + e2e spec (written, not run) | `src/lib/seo/*.test.ts`, `src/components/Breadcrumbs.test.tsx`, `tests/e2e/seo.spec.ts` |

**Not delivered, deliberately:** `/ranges/6max/*` landing pages (ruling 67 — the dataset
exists, the unique explanation does not); a dynamic per-page OG image (see §10).

---

## 2. Files changed

### New

| File | What |
| --- | --- |
| `apps/fishtilt/src/lib/seo/site.ts` | `SITE_ORIGIN`, `absoluteUrl`, OG image constants |
| `apps/fishtilt/src/lib/seo/canonical.ts` | `canonicalPath` / `canonicalUrl` |
| `apps/fishtilt/src/lib/seo/policy.ts` | `routeIndexDecision`, `contentIndexDecision`, `SECTION_INDEXABLE` |
| `apps/fishtilt/src/lib/seo/metadata.ts` | `pageMetadata`, `contentMetadata`, `formatTitle` |
| `apps/fishtilt/src/lib/seo/breadcrumbs.ts` | `contentBreadcrumbs` (one trail, two renderings) |
| `apps/fishtilt/src/lib/seo/faq.ts` | pure MDX FAQ extractor |
| `apps/fishtilt/src/lib/seo/faqSource.ts` | the fs read behind it (build-time only) |
| `apps/fishtilt/src/lib/seo/jsonLd.ts` | the four JSON-LD builders + `serializeJsonLd` |
| `apps/fishtilt/src/lib/seo/JsonLdScript.tsx` | the `<script type="application/ld+json">` element |
| `apps/fishtilt/src/lib/seo/sitemapEntries.ts` | `sitemapPaths` / `sitemapUrls` |
| `apps/fishtilt/src/lib/seo/index.ts` | barrel (deliberately excludes `faqSource`) |
| `apps/fishtilt/src/app/sitemap.ts`, `robots.ts` | the two Next file conventions |
| `apps/fishtilt/src/components/Breadcrumbs.tsx` | visible trail + `BreadcrumbList` |
| `apps/fishtilt/public/og.png` | 1200×630 brand card |
| 9 × `src/lib/seo/*.test.ts`, `src/components/Breadcrumbs.test.tsx` | 87 tests |
| `apps/fishtilt/tests/e2e/seo.spec.ts` | 13 e2e tests — **written, not run** |

### Modified (targeted)

| File | Change |
| --- | --- |
| `src/app/layout.tsx` | `metadataBase` + site-level defaults through `pageMetadata` |
| `src/app/{learn,blog,glossary,hands,about,search,practice,tools}/page.tsx` | metadata export → `pageMetadata({...})` |
| `src/app/practice/{range,hand-ranking,starting-hand}-quiz/page.tsx` | same |
| `src/app/tools/{range,starting-hand,equity,pot-odds,outs,hand-checker}/page.tsx` | metadata → `SEO` const + `pageMetadata`; added `<JsonLd>` (WebApplication) |
| `src/app/learn/[slug]/page.tsx`, `blog/[slug]`, `glossary/[slug]`, `hands/[hand]` | `generateMetadata` → `contentMetadata(record)`; added `<Breadcrumbs>` + `<JsonLd>`; stale doc comments corrected |

**Title separator normalised.** Pages used `|` (6 pages) and `·` (11) interchangeably;
`formatTitle` now produces `{page} · FishTilt` everywhere. Korean titles and descriptions
are otherwise the exact strings their authors wrote — the builder took the suffix, not the
copy. `/about` is the one exception: `FishTilt 소개` became `소개` so the composed title is
not `FishTilt 소개 · FishTilt`.

---

## 3. Index / noindex policy

Two total functions, no deny list. Both read registries that are already verified against
the filesystem (`routes.test.ts` bidirectionally; `content.test.ts` against MDX and against
`threshold.ts`).

| Route kind | Indexed? | What decides it |
| --- | --- | --- |
| `/` home | yes | `SECTION_INDEXABLE.home` + `available` |
| `/learn`, `/blog`, `/glossary`, `/hands` hubs | yes | section + `available` |
| `/tools`, `/tools/*` | yes | section + `available` |
| `/practice`, `/practice/*-quiz` | yes | section + `available` — the landing page is a real page |
| `/about` | yes | section + `available` |
| `/search` | **no** | `SECTION_INDEXABLE.search === false` (spec §33) |
| any route with `available: false` | **no** | `available` — it has no page |
| `/learn/*`, `/blog/*`, `/glossary/*`, `/hands/*` | per record | `status === 'PUBLISHED' && indexable` |
| a `PLANNED` record | **no** | `status` |
| a record the threshold rejects | **no** | `indexable` |
| a tool filter combination | n/a | never a document — canonicalised away (§4) |
| a quiz result state | n/a | never a URL — React state only |

Current live numbers: **130 indexed URLs** = 17 of 18 routes (`/search` excluded) + 113 of
113 content records. Zero records are currently `PLANNED` or `indexable: false`.

The `noindex` mechanism is the per-page `<meta name="robots">`, **not** `robots.txt`
`Disallow`. A disallowed URL is never fetched, so its `noindex` is never read, and a URL
someone links to can persist in the index undescribed. `robots.txt` therefore allows
everything and only advertises the sitemap.

---

## 4. Canonical rules

**A canonical is the page's path, absolute, with no query string, no fragment, no trailing
slash (root excepted).** `canonicalPath()` reduces any of those forms; `pageMetadata` never
takes a canonical as a literal, only a path.

| Requested | Canonical |
| --- | --- |
| `/tools/range?hero=BTN&stack=100&spot=RFI` | `{origin}/tools/range` |
| `/tools/range?hero=UTG` | `{origin}/tools/range` |
| `/tools/starting-hand?top=15` | `{origin}/tools/starting-hand` |
| `/search?q=…` | `{origin}/search` (and `noindex`) |
| `/tools/` | `{origin}/tools` |
| `/learn/outs#자주-헷갈리는-부분` | `{origin}/learn/outs` |
| an absolute URL on another origin | **throws** — never emits an off-site canonical |

Why this is the whole rule: no route takes a `searchParams` prop. `RangeExplorer`,
`StartingHandExplorer` and `SearchClient` parse `window.location.search` in an effect and
write it back with `history.replaceState`, so a filtered view is the same prerendered
document. The site cannot serve a filtered variant; the canonical stops a crawler from
believing it did. `hero × spot × stack` alone is several hundred addresses for one page —
§33's index explosion with nobody generating a page.

**Origin.** `NEXT_PUBLIC_SITE_URL` when set; otherwise `https://fishtilt.example`. Nothing
in the build spec or this repository names a deployment domain, so hard-coding a plausible
one would put a wrong host into every canonical, every `og:url` and all 130 sitemap URLs
with nothing failing (CLAUDE.md rule 5). `.example` is RFC 2606 reserved and cannot
resolve, so the placeholder is loud. **Deploy requirement: set `NEXT_PUBLIC_SITE_URL` (no
trailing slash) before the first production build.** Every test asserts origin *rules*, not
the literal host, so setting it changes one variable and no test.

---

## 5. Structured data emitted

| Type | Where | What makes it truthful |
| --- | --- | --- |
| `BreadcrumbList` | all 113 content pages | Built from the **same array** `Breadcrumbs.tsx` renders as a visible `<nav aria-label="현재 위치">`. Labels come from `src/lib/routes.ts`, so a crumb cannot name a hub something the nav does not. A unit test and an e2e test both assert the visible labels equal the schema `name`s. |
| `Article` | 15 learn + 20 blog pages | These are authored prose with a lead, sections and a measured reading time. `headline`/`description` are the record's own fields — the same strings the `<h1>` and the hub card show. `url`/`mainEntityOfPage` are the page's canonical. |
| `FAQPage` | 20 pages (15 learn, 5 blog), 82 questions | Extracted at build time from the page's **own MDX**, not from a list kept elsewhere: a `##` section named `자주 헷갈리는/묻는…` containing ≥2 `###` questions with prose under them. Those `###` render as the `<h3>`s a reader sees. Pages whose section under that heading is prose rather than questions (15 blog articles) get nothing; a `<Callout title="자주 묻는 것 …">` (hand pages) gets nothing. A Q&A pair whose answer embeds a component (`<Fact>`, `<Term>`, `<ToolCTA>`) is **dropped**, because the rendered text is a computed number the source does not contain — 7 such pairs are dropped today. |
| `WebApplication` | 6 tool pages (`/tools/*`, not the hub) | Each hosts a calculator that runs in the browser. `operatingSystem: 'Web'`, `isAccessibleForFree: true` and `offers: price 0` are literally true — no login, no account, no payment anywhere on this site (§50). `applicationCategory: 'EducationalApplication'`. |

**Fields deliberately absent, in every block:** `datePublished` / `dateModified` (no content
record carries a date; a build timestamp would claim all 113 pages changed at once, every
build), `aggregateRating`, `review`. Not emitted at all: `Organization`/`WebSite` site-level
blocks, `DefinedTerm` for glossary entries, `Quiz` for the practice pages — see §10.

Emission counts, verified offline against the shipped MDX: 20 pages with a FAQ, 82
questions, 0 containing residual JSX.

---

## 6. How sitemap and robots are generated, and why they cannot drift

`sitemapPaths()` is `indexableRoutes(ROUTES) ++ indexableContent(ALL_CONTENT)` — the same
two predicates in `policy.ts` that produce each page's own `<meta name="robots">`. There is
no URL list anywhere.

Three properties follow by construction, not by vigilance:

1. **Every sitemap URL resolves.** A route is listed only if `available` (checked against
   disk in both directions by `routes.test.ts`); a content page only if `PUBLISHED`
   (checked against the MDX by `content.test.ts`). `sitemapEntries.test.ts` re-checks both
   directly: a `page.tsx` on disk for every route path, an `.mdx` for every content path.
2. **Sitemap and meta robots can never disagree** — they are the same function. A page that
   says `noindex` cannot be advertised. Asserted record-by-record over live data.
3. **Nothing needs updating when content ships.** WP-E3's last three hand pages went
   `PLANNED → PUBLISHED` while this WP was running and entered the sitemap with no edit.

`robots.ts` builds its `Sitemap:` line from the same `SITE_ORIGIN` constant as every
canonical, so the two cannot name different hosts.

---

## 7. Homepage metadata — could not apply

`src/app/page.tsx` was owned by another agent. **Nothing is currently missing**: the
homepage has no `metadata` export, so it inherits `layout.tsx`, which WP-N wrote as the
homepage's own metadata (`무료 홀덤 학습 · FishTilt`, canonical `{origin}/`, full OG block,
`index: true`). Applying the block below only makes it explicit and aligns the title with
the rendered `<h1>`.

Paste at the top of `apps/fishtilt/src/app/page.tsx`, after the existing imports:

```tsx
import type { Metadata } from 'next';
import { pageMetadata } from '../lib/seo/index.js';

export const metadata: Metadata = pageMetadata({
  path: '/',
  title: '홀덤, 외우지 말고 눈으로 이해하세요',
  description:
    '핸드 순위부터 레인지와 확률까지, 텍사스 홀덤을 쉬운 한국어로. 13×13 핸드레인지 표와 승률·팟 오즈·아웃 계산기를 직접 눌러보며 배우는 무료 학습 사이트입니다.',
  index: true,
});
```

If the homepage hero copy changed after this was written, keep `path` and `index` and match
`title` to the new `<h1>`; the e2e suite asserts only that the title is unique and carries
the site name.

---

## 8. Internal-link integrity (§37) — audited read-only, not changed

113/113 records are `PUBLISHED`. Audited every one against §37's minimums.

| Requirement | Result |
| --- | --- |
| Learn: ≥1 tool | 15/15 pass |
| Learn: ≥1 prerequisite or related concept | 15/15 pass |
| Learn: ≥1 next lesson | **14/15** — `learn/outs` has none |
| Blog: ≥1 Learn link | 20/20 pass |
| Blog: ≥1 tool | 20/20 pass |
| Glossary: ≥1 related concept | 58/58 pass |
| Hand: Starting Hand Explorer + Equity tool + ≥1 related hand | 20/20 pass |
| Dead internal links | 0 (`graph.test.ts` proves this by construction) |
| Orphan routes | 0 — every route is in the header or footer nav; every content page is listed on its hub |

Two findings, both reported rather than fixed (content is not WP-N's to edit):

- **`learn/outs` has an empty `nextLessons`.** It is a dead end for a reader following the
  curriculum, and §37 asks for one. One registry line in `src/content/registry/learn/h3.ts`.
- **13 glossary terms have no inbound link from any content page** — `action`, `all-in`,
  `ante`, `c-bet`, `bluff`, `heads-up`, `vpip`, `pfr`, `hand`, `high-card`,
  `three-of-a-kind`, `straight-flush`, `nuts`. They are reachable from `/glossary` and from
  `/search`, so they are not orphans and they are correctly indexed — but no article's prose
  links them, which is the weakest kind of internal link a glossary can have. The fix is a
  `<Term>` on first use in the article that already discusses the concept, which is content
  work with a `relatedConcepts` consequence (ruling 63) and belongs to a content agent.

---

## 9. Tests run

| Gate | Command | Result |
| --- | --- | --- |
| Unit | `pnpm vitest run --project fishtilt` | **1202 passed / 1202, 111 files** — 0 failures |
| WP-N's own | `vitest run --project fishtilt src/lib/seo src/components/Breadcrumbs.test.tsx` | **87 passed / 87, 10 files** |
| Typecheck | `pnpm typecheck` | **13/13 projects clean** |
| Lint | `npx eslint apps/fishtilt --max-warnings=0` | clean |
| Format | `prettier --write` on touched files only | applied (no repo-wide run) |
| E2E | `tests/e2e/seo.spec.ts` — 13 tests | **written, NOT run** (orchestrator holds the gate) |
| Build | `pnpm build:fishtilt` | **not run** (orchestrator holds the gate) |

No failures anywhere; nothing to attribute to another agent.

New test files and what each pins:

| File | Tests | Pins |
| --- | --- | --- |
| `site.test.ts` | 6 | origin normalisation, absolute-URL joining, rejection of a non-root path |
| `canonical.test.ts` | 9 | query/fragment/trailing-slash stripping; all `/tools/range` variants collapse to one URL; foreign origin throws |
| `policy.test.ts` | 10 | each index decision, from **constructed** routes and records |
| `metadata.test.ts` | 10 | canonical, title parity across tab/OG/Twitter, OG image, robots from the record's own flags |
| `breadcrumbs.test.ts` | 4 | trail shape per kind, single `current`, no query in any crumb |
| `jsonLd.test.ts` | 13 | every block parses; `@type` correct; no date/rating/review; `FAQPage` is `null` when empty; `<` escaped |
| `faq.test.ts` | 10 | what is and is not a FAQ, against **fixture strings** |
| `faqSource.test.ts` | 4 | content-root resolution, slug validation (no traversal), silent miss |
| `sitemapEntries.test.ts` | 15 | every URL resolves to a file on disk; exclusions proved twice — as an invariant over live data *and* against fixtures |
| `Breadcrumbs.test.tsx` | 6 | landmark, links, `aria-current`, and that the JSON-LD equals the visible trail |

Ruling 26 was treated as the primary hazard. Every state the product is trying to *leave*
(`PLANNED`, `indexable: false`, `available: false`, a prose-only FAQ section) is constructed
by the test, never harvested from live data. The live registries are asserted only for
properties that hold in every state: the decision function is total, and the sitemap equals
the set of pages whose own meta robots says `index`. This mattered in practice — WP-E3
published its last three `PLANNED` records mid-WP, which would have broken any test that had
borrowed one.

---

## 10. Reported rather than changed

| # | Item |
| --- | --- |
| 1 | **`NEXT_PUBLIC_SITE_URL` must be set before the first production build.** Until then every canonical, `og:url` and sitemap URL is on `https://fishtilt.example` (RFC 2606, cannot resolve). Chosen over inventing a domain (rule 5) and over throwing at build (breaks the gate for everyone). |
| 2 | **No dynamic OG image.** `next/og` does not resolve under this app's `nodenext` module resolution — verified: `TS2307: Cannot find module 'next/og'`, the same constraint `RouteNavItem.tsx` documents for `next/link`. A per-page card would additionally need an embedded Korean font, which this repository does not carry, and without one Korean renders blank. Shipped instead: one static 1200×630 `public/og.png` — wordmark, 13×13 red motif, site palette, Latin-only text so nothing renders as boxes. The per-page title and description still travel as `og:title`/`og:description`. |
| 3 | **`learn/outs` has no `nextLessons`** (§8). Registry-only fix, content agent's call. |
| 4 | **13 glossary terms have no in-prose inbound link** (§8). Content work with a `relatedConcepts` consequence (ruling 63). |
| 5 | **No page is recommended for `noindex` on thinness grounds.** All 113 records currently clear `threshold.ts` and claim `indexable: true`, and `content.test.ts` already refuses a claim the measurement does not support. Reading the emitted metadata found no page whose visible content contradicts its flag. If the orchestrator wants a stricter bar, that is a `threshold.ts` change, not an SEO change. |
| 6 | **Structured data intentionally not emitted, each defensible either way:** `DefinedTerm`/`DefinedTermSet` for the 58 glossary entries (truthful, and arguably the best-fitting type on the site — but outside the four types §35 enumerates, so not added unilaterally); `Article` on hand pages (they are reference pages built mostly from computed figures, not articles); `Quiz` on `/practice/*`; a site-level `WebSite`/`Organization` block with `SearchAction` (`/search` is client-side and has no server query endpoint, so `SearchAction` would be a claim the site cannot honour). |
| 7 | **Ruling 67 not relitigated.** No `/ranges/6max/*` pages. Recording one datum for whoever revisits it: the SEO machinery would support them for free — a curated range landing page would need only a record kind and per-range prose. The blocker is exactly what ruling 67 says it is: nobody has written the explanation, and generating one per position from the same dataset is the thin-page mass generation the spec forbids. |
| 8 | **`src/app/page.tsx` untouched** (another agent owned it). §7 has the block; the layout already covers `/` in the meantime. |
| 9 | **`public/` is a new directory** in `apps/fishtilt`, created for `og.png`. It did not exist before. |
| 10 | **`faqSource.ts` reads the filesystem during render.** It is the only fs access in `src/`. It runs at build only (all four content routes are `dynamicParams = false` + `generateStaticParams`), degrades to `[]` on any failure, and validates the slug against `^[a-z0-9-]+$` before joining a path. Flagged because it is a new pattern in this app, and because a future route that renders dynamically would move it into the request path. |
