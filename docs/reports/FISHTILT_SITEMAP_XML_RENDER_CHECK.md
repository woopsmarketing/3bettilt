# FishTilt sitemap.xml browser-render check

**Request:** make `https://3bettilt.com/sitemap.xml` render as a normal XML tree in
the browser ("This XML file does not appear to have any style information...")
instead of appearing as a flat run of plain text, without changing the URL list,
canonical/hreflang policy, or adding fabricated `lastmod`/`priority`/`changefreq`.

**Finding: no code change made — the reported symptom does not reproduce.**

## Verification against production

```
curl -sI https://3bettilt.com/sitemap.xml
```

- `content-type: application/xml` — already correct; no charset issue, no
  `text/plain`/`text/html` fallback.
- `content-disposition: inline; filename="sitemap.xml"` — served inline, not as a
  download.
- Body starts with `<?xml version="1.0" encoding="UTF-8"?>` and closes with
  `</urlset>`; well-formed, 141 `<loc>` entries, no truncation.

This is exactly the response shape that makes desktop Chrome/Firefox show the
native XML-tree viewer the request describes. `application/xml` is served by
Next's built-in `sitemap.ts` file-convention route (`apps/fishtilt/src/app/sitemap.ts`,
`export const dynamic = 'force-static'`) — nothing here needed a header override or
an XSL stylesheet, so none was added.

## Source inspected (unchanged)

- `apps/fishtilt/src/app/sitemap.ts` — three-line route, delegates entries to
  `sitemapEntries()`.
- `apps/fishtilt/src/lib/seo/sitemapEntries.ts` — pure function over `ROUTES` +
  `ALL_CONTENT`, same predicates the per-page `robots` meta uses. Deliberately
  emits no `lastmod`/`changeFrequency`/`priority` (documented in the file's own
  header comment) — matches the "no fake data" constraint already.

## Targeted tests run

```
pnpm vitest run --project fishtilt sitemap
```

`sitemap.test.ts` + `sitemapEntries.test.ts` (also exercises `SITE_ORIGIN_IS_DEFAULT`
wiring) — **18/18 passed.**

No `full test` / `full build` / `full e2e` was run, per the request.

## Caveat

If the original report came from a **mobile** browser: most mobile browsers
(mobile Safari, mobile Chrome) show raw XML as plain text regardless of a
correct `application/xml` Content-Type — that's a client rendering limitation,
not a server response defect, and isn't fixable via headers or a stylesheet
without adding an XSL stylesheet (which the request said to avoid unless
necessary). Worth confirming which browser/device showed the flat-text view, in
case that's the real source of the report.

## Files changed

None.
