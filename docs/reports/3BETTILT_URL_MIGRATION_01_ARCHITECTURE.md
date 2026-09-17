# 3BetTilt URL Migration 01: Routing architecture

Date: 2026-09-17 · Decision: **D-S3-23** (`docs/3BETTILT_STAGE3_STATE.md`) · Not deployed, not committed

## Before → After

| | Before (D-S3-01/03/04) | After (D-S3-23) |
| --- | --- | --- |
| Page directory | `src/app/[locale]/…` (`generateStaticParams → ['ko']`, `dynamicParams=false`) | route group `src/app/(default-locale)/…` (adds no URL segment) |
| Korean home | `/` → 308 → `/ko` | `/` = homepage HTML, **200** |
| Korean pages | `/ko/learn/pot-odds` | `/learn/pot-odds` |
| Old `/ko/*` | (were the pages) | 142 frozen 1:1 308 redirects |
| Future English | `/en/…` | `/en/…` (unchanged contract) |
| `localePath('ko', '/learn')` | `/ko/learn` | `/learn` |
| `localePath('en', '/learn')` (future) | `/en/learn` | `/en/learn` |

## Why a route group (and not rewrites)

Every page already ignored the `locale` param; only `[locale]/layout.tsx` read it, as a guard. Moving
the directory into a route group (`git mv`) makes the **filesystem path equal the public URL**. No
import depth changed, because a route group is still one directory level.

I rejected the alternative (keep `[locale]`, add a `/:path*` → `/ko/:path*` rewrite):
- The prerendered file would stay at `ko/learn.html` while the public URL is `/learn`. That's the
  "hidden `/ko`" structure the brief warns against.
- It needs a redirect `/ko/x → /x` plus a rewrite `/x → /ko/x` on the same path pair, which risks loops on Vercel.
- `/og/[kind]/[file]` (a dynamic route) and future `/en/*` would need negative-lookahead exclusions.

What it costs: future `/en` needs thin route files under `src/app/[locale]/…`, so adding a locale
takes more than one new entry in `SUPPORTED_LOCALES`. The design is written down in
`docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md` §2.

## Helper contract (`src/lib/locale.ts`, the single source of truth)

| Function | Behaviour |
| --- | --- |
| `localePath(locale, sitePath)` | default → `sitePath` unchanged; other → `/<code>…`; throws on a path already carrying any locale prefix (incl. `/ko…`) |
| `localePrefixOf(path)` | locale literally spelt as first segment, or `null` (new; the old `localeOfPath` semantics) |
| `localeOfPath(path)` | non-default prefix locale, else `DEFAULT_LOCALE`; **throws** on `/ko…` (legacy address, never a page) |
| `sitePathOf(path)` | strips a non-default prefix; default-locale path returned as is; throws on `/ko…` |
| `localiseHref(href)` | MDX links: localises root-relative links; `/ko/…` in prose throws (a build failure, not a silent redirecting link) |
| `APP_DEFAULT_LOCALE_GROUP` | `'(default-locale)'` (replaces `APP_LOCALE_SEGMENT`) |

`canonicalPath` reduces `/` correctly (it used to collapse to `''`) and refuses `/ko…`. So no metadata
builder can emit a legacy canonical.

## Root URL string

Next's metadata resolver always renders a root canonical/`og:url`/hreflang as the bare origin
`https://3bettilt.com` (`resolveAbsoluteUrlWithPathname`: pathname `/` → `result.origin`). That is the
same URL as `https://3bettilt.com/`. `absoluteUrl('/')` therefore keeps returning the bare origin, so
sitemap `<loc>`, sitemap hreflang, JSON-LD (`WebSite`, `Organization`, breadcrumbs) and `<head>` spell
the homepage **identically**.

## Files changed (code)

- Moved: `src/app/[locale]/**` → `src/app/(default-locale)/**` (all pages and tests); deleted `[locale]/layout.tsx`
- New: `src/lib/legacyLocaleRedirects.ts` (frozen list + builder, imports nothing so `next.config.ts` can load it)
- `next.config.ts`: `/` → `/ko` redirect replaced by `legacyLocaleRedirects(`/${DEFAULT_LOCALE}`)`
- `src/lib/locale.ts` (contract above), `src/lib/seo/canonical.ts`, `metadata.ts` (null-locale branches removed), `site.ts`, `jsonLd.ts`, `sitemapEntries.ts`, `src/lib/routes.ts`, `src/content/graph.ts` (template path constant), comments in `layout.tsx`, `global-error.tsx`, `SiteHeader.tsx`, `features/search/url.ts`, `mdx-components.tsx`, home `page.tsx`

Not touched: titles, descriptions, H1, body copy, design, images, OG image routes (`/og/<kind>/<slug>.png`), robots policy, `NEXT_PUBLIC_SITE_URL` handling (still rejects any path, including `/ko`).
