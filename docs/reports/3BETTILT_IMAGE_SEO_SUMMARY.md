# 3BetTilt Image SEO — Summary

Date: 2026-09-15 · Detail: `3BETTILT_IMAGE_SEO_01_MAPPING.md` (full old → new table),
`3BETTILT_IMAGE_SEO_02_CODE_AND_VERIFICATION.md` (code, tests, built HTML audit)

## Result

| Metric | Value |
| --- | --- |
| Production editorial images | 28 |
| Renamed | 28 (plain rename, bytes identical, no re-encode) |
| Informational | 14 (8 category themes + 6 hand stories) |
| Decorative (`alt=""` by decision) | 14 (home, hub, About, CTA slots) |
| Missing alt (registry / built HTML) | 0 / 0 |
| Duplicate filenames | 0 |
| Stale old filename references (src, tests, scripts, config, built HTML) | 0. Historical `docs/reports/*` left as a record |
| Broken image references (built HTML) | 0 |
| Article JSON-LD with featured `ImageObject` | 40 / 40 Article pages |
| `og:image:alt` | Every page. Content pages: `{category} 소개 이미지 — {H1}`. Other pages: a description of `og.png` |
| Page sitemap | 141 URLs (unchanged) |
| Image sitemap | not added (no clear benefit) |
| Redirects for old image URLs | not added (assets were one day old; old URLs 404) |
| `<img title>` | none added |
| Next/Image | unchanged (`/_next/image?url=%2Fvisuals%2F<new-name>.jpg`, AVIF/WebP, sizes and srcset) |

## How alt works now

- The registry (`src/content/visuals.ts`) gives every asset `file`, `width`, `height`,
  `role`, `alt` and `description`.
- `EditorialVisual` stays decorative by default, so cards, thumbnails and backdrops never
  repeat their link text. Only the page's own unlinked featured slot (learn lesson, blog
  guide, hand story, glossary band) passes `describe`, which renders the registry alt.

## Tests

- tsc: PASS
- lint: 0 errors
- fishtilt Vitest: 2608 passed; 1 outdated assertion was updated and re-run to PASS
- New `imageSeo.test.tsx`: 34 tests, PASS
- Production build: PASS
- E2E `blog` and `home` specs: one outdated `alt=""` assertion was updated, then `blog` re-ran 29/29 PASS
- Built HTML audit of the 8 representative pages: PASS

## Open items

- None blocking.
- If a new picture is added, it needs a registry entry with a role. `imageSeo.test.tsx` fails
  otherwise.
