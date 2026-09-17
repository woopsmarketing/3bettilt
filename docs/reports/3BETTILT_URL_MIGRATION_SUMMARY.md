# 3BetTilt URL Migration: summary (`/ko/*` → prefixless Korean)

Date 2026-09-17 · Decision **D-S3-23** · Status: **implemented and verified locally; not committed, not pushed, not deployed**

Detail: [01 Architecture](3BETTILT_URL_MIGRATION_01_ARCHITECTURE.md) · [02 Redirects](3BETTILT_URL_MIGRATION_02_REDIRECTS.md) · [03 Verification](3BETTILT_URL_MIGRATION_03_VERIFICATION.md)

## 1. Before → After

| | Before | After |
| --- | --- | --- |
| Korean home | `/` →308→ `/ko` | `/` **200** |
| Korean pages | `/ko/…` via `src/app/[locale]/…` | `/…` via route group `src/app/(default-locale)/…` (directory = URL, no rewrite, no middleware) |
| Old URLs | — | 142 frozen 1:1 308 redirects (`src/lib/legacyLocaleRedirects.ts`) |
| Future English | `/en/…` | `/en/…` |

## 2–11. Results

| # | Item | Expected | Result |
| --- | --- | --- | --- |
| 2 | Sitemap URLs | 141 | **141** (unique, `/ko` 0, redirecting 0, duplicates 0) |
| 3 | Indexable pages | 141 | **141** |
| 4 | Old `/ko` redirect coverage | all | **142/142** (141 indexable + `/search`), each 308 → exact page → 200; unknown `/ko/...` stays 404 |
| 5 | Representative chains | 1 hop | `/ko/learn/pot-odds` → `/learn/pot-odds` (200) in 1 hop; `/` 0 hops, 200; trailing-slash variants take 2 hops (Next's built-in slash rule first) |
| 6 | Canonicals | 141 unique | **141 unique** indexable (+ `/search`), all equal to their own prefixless URL |
| 7 | hreflang | ko-KR + x-default | **282** in `<head>` (141×2), 282 in sitemap, no `en` |
| 8 | Internal `/ko` references | 0 | **0** in built HTML/RSC; 0 `/ko` literals in shipped source (guard test). Remaining: migration list, tests, historical docs |
| 9 | JSON-LD URLs | no `/ko` | 927 site URLs, **0** `/ko`; JSON-LD otherwise byte-identical to before on all 142 pages |
| 10 | Broken internal links | 0 | **0** (3823 internal hrefs) |
| 11 | Dynamic `ƒ` routes | 0 | **0** |

Titles, descriptions and H1s: **0 differences** from the pre-migration build on all 142 pages. A test
now locks this with a fixture extracted from that build.

## 12. typecheck / test / build

- `tsc`: PASS · `eslint`: PASS · `vitest --project fishtilt`: **2629/2629 PASS** · `next build`: PASS
- E2E (production server): initial full run 342 passed + 2 failed on stale `seo.spec.ts` expectations (a nested `ImageObject` from the image-SEO commit, and `WebApplication` on the quiz pages). Both expectations were fixed (test-only; no JSON-LD/page/migration source changed), and targeted `seo.spec.ts` passes 31/31. Known SEO E2E failures: 0. See report 03.

## 13. Future `/en`

- `localePath('en', '/learn')` → `/en/learn` is already locked by a test. `hreflangAlternates(…, editions)` is unchanged.
- English goes in `src/app/[locale]/…` (non-default locales only, `dynamicParams=false`) as thin route files that call locale-aware shared pages. Each locale gets its own root layout for `<html lang>`.
- Korean never gets a `/ko` prefix again. `localePath` and `localeOfPath` throw on it.
- Written down in `docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md` §2–3.

## 14. Search Console after deploy

1. **Sitemaps:** resubmit `https://3bettilt.com/sitemap.xml` (same URL; it now lists 141 prefixless URLs).
2. **URL inspection:** request indexing for `/`, `/learn`, `/tools/range`, `/learn/pot-odds`, `/blog/aks-vs-ako`, `/glossary/three-bet`, `/hands/aa`. Also inspect one old URL, e.g. `/ko/learn/pot-odds`, which should show "Page with redirect".
3. **Don't** use the Change of Address tool (it's for domain moves), and don't request removal of `/ko` URLs. The 308s carry the signals.
4. **Over the next 2–8 weeks, in Pages:** `/ko/*` should move to "Page with redirect" while the prefixless URLs rise under "Indexed". Watch for "Duplicate, Google chose different canonical" (expected: none).
5. **Keep the 142 redirects permanently,** or at least for a year or more. External links and bookmarks keep using them.
6. Compare Performance on the page level across the migration date. A temporary dip is normal.

## Pre-deploy checks / remaining risk

- **Browser-cached old root redirect** (independent review finding): a browser that cached `/` → `/ko` could loop against the new `/ko` → `/`. The live 308 is sent with `cache-control: public, max-age=0, must-revalidate`, so the risk is low. Still, after deploy, check `/` once in a browser that had visited the old site.
- **www/http:** infrastructure hops are unchanged (Cloudflare http→https, Vercel www→apex). `http://www.3bettilt.com/` will be 2 hops → 200. Optional: one Cloudflare redirect rule would make that 1 hop.
- **Git index:** the `[locale]` → `(default-locale)` move was done with `git mv`, so those renames are **staged**. The other edits are unstaged and nothing is committed.
- After deploy, run the updated smoke checklist in `docs/DEPLOY_3BETTILT.md` §9.

## Docs updated

`docs/3BETTILT_STAGE3_STATE.md` (D-S3-23 added; D-S3-01/03/04 superseded), `docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md`, `docs/DEPLOY_3BETTILT.md` (§3, §7.1, §8, §9 smoke table), `docs/3BETTILT_OPERATING_PLAYBOOK.md`.
