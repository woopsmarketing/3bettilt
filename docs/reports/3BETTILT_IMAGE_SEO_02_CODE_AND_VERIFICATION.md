# 3BetTilt Image SEO — 02 Code changes and verification

Date: 2026-09-15

## Code changes

| File | Change |
| --- | --- |
| `public/visuals/*.jpg` | 28 files renamed. Bytes are identical and nothing was re-encoded. |
| `scripts/editorial-images.manifest.json` | 28 `file` fields now use the new names. Crop, output and quality are unchanged. |
| `src/content/visuals.ts` | Added `VisualRole` (`informational` / `decorative`). Each `VisualAssetSpec` now has an explicit `file`, `role`, `alt` and `description`, built by the `informational()` and `decorative()` helpers. The file name is no longer derived from `id`. Ids are unchanged, so the `ThemeArt` seeds are the same. |
| `src/components/visual/EditorialVisual.tsx` | New `describe` prop. By default the image still renders `alt=""`. With `describe`, it renders the registry `alt` of the asset actually served. For a decorative asset that is still `""`. Next/Image (`fill`, `sizes`, `priority`, AVIF/WebP) is untouched. |
| `learn/[slug]/page.tsx`, `GuideArticleLayout.tsx`, `StoryArticleLayout.tsx`, `glossary/[slug]/page.tsx` (band) | The page's own unlinked featured slot passes `describe`. |
| `src/lib/seo/jsonLd.ts` | `articleJsonLd(record, image?)`: `image` is an `ImageObject` (`url`, `width`, `height`) for the featured visual. If the file is missing, it falls back to the old `og.png` URL. Headline, url and author are unchanged. |
| `learn/[slug]/page.tsx`, `blog/[slug]/page.tsx` | Pass `resolveAsset(visualOf(record))` into the builder. |
| `src/lib/og/ogCard.ts` | New `ogCardAlt(record)` returns `"{category} 소개 이미지 — {H1 title}"`. The card really shows both strings. It is not a copy of the SEO `<title>`. |
| `src/lib/seo/metadata.ts` | Content pages use `ogCardAlt` for `og:image:alt`. |
| `src/lib/seo/site.ts` | `OG_IMAGE_ALT` now describes `og.png`. |
| Comments only | `HomeHeroVisual.tsx`, `app/[locale]/page.tsx`, `assetSource.ts` |

### Decisions

- **No per-use `alt` override.** Each theme picture's `alt` describes the frame plus its
  topic, which is true on every page of that theme. Each story picture has exactly one
  described context. A boolean `describe` is enough, and a free-text override would only be
  an unused abstraction.
- **No `title` attribute** was added. The tests assert its absence.
- **No redirects.** The `public/visuals` files were first committed 2026-09-14, one day
  before this change, so they have no image-index equity to preserve. The old URLs now return
  404 (checked: `/visuals/theme-position.jpg` → 404). A redirect surface for 28 files had no
  real benefit.
- **No image sitemap.** The page sitemap stays at 141 URLs. Pictures are already crawlable
  through `<img>` and `Article.image`, and most are shared theme photos with no per-page
  value. `sitemapImages: 0`.

## Tests added or changed

- **New `src/content/imageSeo.test.tsx`** (34 tests). Covers: filename regex (lowercase ASCII
  kebab `.jpg`, ≤ 60 characters), no generic prefix, no `3bettilt`, no bare sequence number,
  no duplicates, file exists, width and height, role enum, informational ⇒ non-empty one-line
  alt, decorative ⇒ `""`, 14/14 role counts, all 28 retired names absent from
  `src/ tests/ scripts/ next.config.ts` and from `public/visuals`, `EditorialVisual` defaults
  to decorative, `describe` renders the registry alt through the Next/Image URL with the new
  filename, a decorative asset stays silent under `describe`, and no `title` attribute.
- `visuals.test.ts`: "every asset described" now checks `description`, plus the role↔alt rule.
- `jsonLd.test.ts`: `ImageObject` shape, and fallback to `og.png` when the image is `undefined` or `null`.
- `metadata.test.ts`: content `og:image:alt` equals `ogCardAlt`, is not the `<title>`, and has no brand. The static alt equals `OG_IMAGE_ALT`, which is not the bare site name.
- `blog/[slug]/page.test.tsx`: the featured image announces the registry alt, and every other image (inside links) stays `""`.
- `renderOg.test.tsx`: new file names.
- `tests/e2e/blog.spec.ts`: a described image must be outside any link and its alt must equal the registry alt; everything else is `""`. The guide featured image expects the theme alt.

## Verification run

| Check | Result |
| --- | --- |
| `tsc --noEmit` (fishtilt) | PASS |
| `pnpm lint` | 0 errors. 2 warnings already existed in the untouched file `apps/fishtilt/.data/tools/seo-audit.mjs` |
| Vitest, fishtilt project (one run) | 2608 passed, 1 failed (`visuals.test.ts` still required a non-empty alt on decorative assets). Fixed, then that file re-run: 4/4 PASS |
| Targeted image/SEO/OG/visual/page tests | PASS (imageSeo 34, jsonLd 34, metadata + og + imageSeo 57) |
| `pnpm build:fishtilt` | PASS. Built again by Playwright after the final `ogCardAlt` wording change |
| E2E `blog.spec.ts` + `home.spec.ts` | 61 passed, 1 failed. The failure was the guide-article test, which still expected `alt=""` on the now-described featured image. The assertion was updated and `blog.spec.ts` re-run: 29/29 PASS |
| Next/Image probe | `/_next/image?url=%2Fvisuals%2Fplayer-stunned-by-qq-vs-72o-flop.jpg&w=640` → 200 `image/avif`. `/visuals/six-seat-poker-table-top-view.jpg` → 200 |
| Not run (per task) | full monorepo tests, full E2E, screenshot suites |

## Built HTML audit (production `.next`, final build)

| Page | `<img>` | missing alt | broken | old names | described alts | Article image | og:image:alt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /ko | 7 | 0 | 0 | 0 | — (all decorative) | — | og.png description |
| /ko/blog | 18 | 0 | 0 | 0 | — (cards) | — | og.png description |
| /ko/blog/qq-vs-72o-flop-227 | 9 | 0 | 0 | 0 | 2-2-7 플랍을 보고 입을 가린 채 테이블을 내려다보는 플레이어 | ImageObject `/visuals/player-stunned-by-qq-vs-72o-flop.jpg` 1920×1080 | 핸드 스토리 소개 이미지 — 72o로 3벳을 콜한다고? 그런데 플랍이 2-2-7이었다 |
| /ko/learn | 8 | 0 | 0 | 0 | — | — | og.png description |
| /ko/learn/position | 6 | 0 | 0 | 0 | 위에서 내려다본 6인용 포커 테이블의 좌석과 딜러 버튼 | ImageObject `/visuals/six-seat-poker-table-top-view.jpg` | 배우기 · 포지션 소개 이미지 — 자리(포지션)가 왜 그렇게 중요할까요? |
| /ko/tools/range | 0 | 0 | 0 | 0 | — | — | og.png description |
| /ko/hands/aa | 3 | 0 | 0 | 0 | — (backdrop) | — (no Article, unchanged) | 시작 핸드 소개 이미지 — 같은 숫자 두 장 (A 페어) · AA |
| /ko/about | 2 | 0 | 0 | 0 | — | — | og.png description |

Across all 144 built HTML files: 0 old filenames, 0 broken `/visuals/` references, and 40/40
`Article` blocks carry an `ImageObject` pointing at a shipped file. Sitemap: 141 `<loc>` (unchanged).

Title, canonical and hreflang: the code that builds them was not modified. `metadata.ts` only
changed the image `alt` value. The built values follow the existing pattern, e.g.
`/ko/hands/aa` → `AA 승률·순위 | 텍사스 홀덤 프리플랍 핸드 가이드 - 3BetTilt`, canonical
`https://3bettilt.com/ko/hands/aa`, `ko-KR` + `x-default`.
