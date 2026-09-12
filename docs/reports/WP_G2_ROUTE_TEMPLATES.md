# WP-G2 — Content Route Templates + Parallel-Authoring Split

Infrastructure-only work package. No article prose was authored beyond the minimum
placeholder needed to prove each template renders against a real record.

## 1. Scope

- Split `src/content/registry/**` and the former `src/content/lessons.ts` MDX map by
  **authoring batch** (H1/H2/H3, I1–I4, J1/J2, E3), not just by content kind, so seven
  content agents can write in parallel without touching each other's files.
- Built list + detail routes for `/blog`, `/glossary`, `/hands`, and a static `/about` page,
  mirroring `/learn` / `/learn/[slug]`'s static-generation strategy, metadata shape, and
  PLANNED/PUBLISHED honesty gate exactly.
- Renamed the hand-rankings lesson's `slug` (ruling 11): `id: 'hand-rankings'` unchanged,
  `slug: 'poker-hand-rankings'`.
- Root-caused the `NoFallbackError` seen in e2e server logs (ruling: benign, see §6).

## 2. Files changed

**Registry split** (`src/content/registry/`) — deleted the four old single files
(`learn.ts`, `blog.ts`, `glossary.ts`, `hands.ts`); added, per kind, one file per batch plus
an `index.ts` barrel:
- `learn/{h1,h2,h3,published,index}.ts`
- `blog/{i1,i2,i3,i4,index}.ts`
- `glossary/{j1,j2,index}.ts`
- `hands/{e3,index}.ts`
- `registry/index.ts` edited: imports point at the new `*/index.js` barrels; every export
  (`LEARN_RECORDS`, `BLOG_RECORDS`, `GLOSSARY_RECORDS`, `HAND_RECORDS`, `ALL_CONTENT`)
  unchanged.

**MDX-map split** (`src/content/`) — deleted `lessons.ts`; added, mirroring the registry
split:
- `learn/{published,h1,h2,h3,index}.ts`
- `blog/{types,i1,i2,i3,i4,index}.ts`
- `glossary/{types,j1,j2,index}.ts`
- `hands/{index,e3}.ts` (type lives inline in `e3.ts` — only one batch owns hands)
- `graph.ts` edited: added `publishedOfKind(kind)`, the generalised form of the existing
  `PUBLISHED_LESSONS` helper, used by `/blog`, `/glossary`, `/hands`'s
  `generateStaticParams`.

**Placeholder MDX prose** (proof records only, not new content):
`content/blog/aks-vs-ako.mdx`, `content/glossary/range.mdx`, `content/hands/aks.mdx`.

**New routes**:
`src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`,
`src/app/glossary/page.tsx`, `src/app/glossary/[slug]/page.tsx`,
`src/app/hands/page.tsx`, `src/app/hands/[hand]/page.tsx` (folder literally `[hand]`,
matching `CONTENT_ROUTE_TEMPLATE.hands`), `src/app/about/page.tsx` — each with a
co-located `page.test.tsx`.

**New shared component** (ruling 17 — unavoidable, see doc comment in the file):
`src/components/HandRangeHighlight.tsx` + `.test.tsx` — a thin client wrapper holding
`selectedKey` state so a Server Component page can seed `RangeMatrix`'s own highlight
without passing a function prop across the server/client boundary.

**Targeted edit**: `src/lib/routes.ts` — flipped `glossary`, `blog`, `hands`, `about` from
`available: false` to `true` (page.tsx written first, flag flipped last). `search`,
`practice`, `toolStartingHand` untouched — not mine.

**Pre-existing tests fixed** (broken by flipping `term-range`/`hand-aks`/`blog-aks-vs-ako`
etc. to PUBLISHED as proof records — rewritten to find a still-PLANNED example dynamically
instead of hard-coding one, the same anti-staleness pattern the codebase's own `toolHref`
test already used):
`src/content/graph.test.ts`, `src/components/Term.test.tsx`.

**New e2e specs** (written, not run — port 3221 shared with a concurrent agent):
`tests/e2e/blog.spec.ts`, `tests/e2e/glossary.spec.ts`, `tests/e2e/hands.spec.ts`,
`tests/e2e/about.spec.ts`.

## 3. Batch → registry file → MDX-map file → content dir (verbatim for author briefs)

| Batch | Owns | Registry file | MDX-map file | MDX content dir |
| --- | --- | --- | --- | --- |
| H1 | Lessons 01–05: `holdem-basics`, `hand-rankings` (slug `poker-hand-rankings`), `starting-hands`, `starting-hand-ranking`, `hand-matrix` | `src/content/registry/learn/h1.ts` | `src/content/learn/h1.ts` | `content/learn/` |
| H2 | Lessons 07–10 (four, not five): `position`, `positions-6max`, `poker-actions`, `preflop` | `src/content/registry/learn/h2.ts` | `src/content/learn/h2.ts` | `content/learn/` |
| H3 | Lessons 11–15: `flop-turn-river`, `three-bet`, `equity`, `pot-odds`, `outs` | `src/content/registry/learn/h3.ts` | `src/content/learn/h3.ts` | `content/learn/` |
| I1 | Blog 1–5 (시작 패 강도). Owns proof record `blog-aks-vs-ako` | `src/content/registry/blog/i1.ts` | `src/content/blog/i1.ts` | `content/blog/` |
| I2 | Blog 6–10 (패의 종류와 무늬). No proof record exists yet — file is an empty map, ready to receive 5 new entries | `src/content/registry/blog/i2.ts` | `src/content/blog/i2.ts` | `content/blog/` |
| I3 | Blog 11–15 (쇼다운). Owns proof record `blog-btn-why-wide` | `src/content/registry/blog/i3.ts` | `src/content/blog/i3.ts` | `content/blog/` |
| I4 | Blog 16–20 (규칙·용어·계산). Owns proof record `blog-outs-nine` | `src/content/registry/blog/i4.ts` | `src/content/blog/i4.ts` | `content/blog/` |
| J1 | Glossary 테이블·돈·행동 (28 terms). Owns proof records `term-position`, `term-open-raise` | `src/content/registry/glossary/j1.ts` | `src/content/glossary/j1.ts` | `content/glossary/` |
| J2 | Glossary 카드·족보·확률 (28 terms). Owns proof records `term-range`, `term-suited`, `term-offsuit`, `term-pocket-pair`, `term-combo`, `term-preflop` | `src/content/registry/glossary/j2.ts` | `src/content/glossary/j2.ts` | `content/glossary/` |
| E3 | All 20 `/hands/*` pages (single batch, not split). Owns proof records `hand-aks`, `hand-ako` | `src/content/registry/hands/e3.ts` | `src/content/hands/e3.ts` | `content/hands/` |

Every batch's registry file and MDX-map file is independently writable; each imports only
its own `index.ts` barrel dependency, never a sibling batch's file. `ALL_CONTENT` and every
existing consumer (`graph.ts`, `content.test.ts`) work unchanged.

## 4. Route templates and section order

`/blog`, `/glossary`, `/hands` list pages: registry order (blog, hands-by-strength-rank for
`/hands`, alphabetical Korean `localeCompare` for `/glossary`); every record visible, only
PUBLISHED ones link, PLANNED ones render non-interactive with a `준비 중` badge (never a
link into a 404).

`/blog/[slug]`: identical shape to `/learn/[slug]` — `dynamicParams = false`,
`generateStaticParams` via `publishedOfKind('blog')`, `generateMetadata` with
`robots.index: article.indexable`, `notFound()` guard, `RelatedContent`.

`/glossary/[slug]`: same shape. Renders `aliases` as a list of `<span data-glossary-alias>`
elements inside a `<span data-glossary-aliases>` wrapper — plain visible text plus stable
data attributes a later search index can query without re-parsing prose.

`/hands/[hand]` (folder `[hand]`, matching `CONTENT_ROUTE_TEMPLATE.hands`) — 8 sections,
content-plan §4.2 order, sections 3/5/6 computed by the template directly from
`strategy-core`/`learn-core` (not authored), section 4 highlights via `HandRangeHighlight`
(ruling 17):
1. `<PokerCards>` — real cards + Korean reading
2. MDX lead paragraph (author's "한 줄 답" + any narrative)
3. "이 패는 어떤 패인가요" — kind, combo count, universe share (`Fact`)
4. "13×13 표에서는 여기입니다" — `HandRangeHighlight` (selected cell) + link to lesson `hand-matrix`
5. "얼마나 강한가요" — rank, top-%, equity-vs-random + `Callout` (0.10 caveat) + link to `starting-hand-ranking`
6. "어느 자리에서 처음 레이즈에 쓰이나요" — `RFI_POSITIONS_WITH`
7. `<ToolCTA tool="range">`
8. `<RelatedContent>` — relatedConcepts/relatedTools/relatedHands/nextLessons/relatedArticles

`/about`: static page, three sections (이 사이트가 하는 것 / 숫자는 어디서 나오나요 /
제휴하지 않습니다), states plainly "FishTilt는 어떤 포커 사이트나 카지노와도 제휴하지
않았습니다." No affiliate/deposit link anywhere on the page (test-enforced: zero `<a>`
elements).

## 5. Slug rename (ruling 11)

`registry/learn/h1.ts`: `id: 'hand-rankings'` unchanged, `slug: 'poker-hand-rankings'`.
Route becomes `/learn/poker-hand-rankings`. Confirmed: all relations (`prerequisites`,
`relatedConcepts`, `nextLessons`, etc., across every registry file) reference by `id`, never
`slug` — grepped for `'hand-rankings'` across `src/content/registry/**` and found only the
one `id`/`slug` pair itself; nothing else moved. No redirect needed, nothing shipped yet.

## 6. NoFallbackError verdict

- **Verdict**: benign — Next.js 16.3.3's internal control-flow signal for a deliberate
  `notFound()` on a `dynamicParams: false` route, not a defect.
- **Evidence**: traced through `node_modules/next`'s `create-error-handler.js` /
  `app-render.js` — `NoFallbackError` is in `getDigestForWellKnownError()`'s allow-list of
  expected errors; it is thrown internally when a static param outside
  `generateStaticParams()`'s list is requested on a `dynamicParams = false` route, is caught
  by the framework's own error handler, and is what produces the correct 404 response the
  passing test asserts on. It surfaces in server logs because it is still an `Error` object
  travelling through the generic instrumentation hook, not because the request failed.
- **What would distinguish a real defect**: a NoFallbackError logged for a slug that IS in
  `generateStaticParams()`'s list (a real routing/build bug), or the request failing to
  resolve to a 404 response/status code at all. Neither is observed here — the test
  requesting an unknown slug passes and receives 404. The four new dynamic routes
  (`/blog/[slug]`, `/glossary/[slug]`, `/hands/[hand]`) use the identical
  `dynamicParams = false` + `notFound()` pattern, so the same benign log line is expected
  from their own "unknown slug 404s" tests and should not be treated as a failure signal.

## 7. Tests run (real counts)

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **596/596 passed**, 59 test files (baseline before this WP: 465) |
| `pnpm --filter @gto-self/fishtilt typecheck` | clean |
| `pnpm typecheck` (all 13 workspace projects) | clean |
| `npx eslint apps/fishtilt --max-warnings=0` | clean, zero warnings |
| `pnpm e2e:fishtilt` / `pnpm build:fishtilt` | **not run** — explicitly out of scope (shared `.next`/port 3221 with a concurrent agent); e2e specs are written only |

One real bug fixed along the way: the new `/blog`, `/glossary`, `/hands` index-page tests
used `queryByRole('link', { name: <string>, exact: false })`, which in this
Testing-Library version requires the accessible name to *equal* the string after
normalisation even with `exact: false` — it does not substring-match. Fixed by matching with
an escaped regex (`new RegExp(escapeRegExp(text), 'u')`) instead, the same pattern
`/learn`'s pre-existing hub test already used (unescaped, safe there only because no lesson
title contains a regex-special character); glossary titles always carry a literal
parenthesised gloss (e.g. "패의 묶음 (Range)"), so escaping was added.

## 8. Known limitations

- **Hands-page FAQ ordering simplification**: content plan §4.2 lists an optional FAQ
  section *last*, after the tool CTA and related-hands block. Because MDX renders as one
  block (same `<article><Content /></article>` shape `/learn/[slug]` uses), an author's FAQ
  content lands directly after the lead paragraph instead — before the template's computed
  sections, not after. Not solved here; would need an authoring convention (e.g. splitting
  one MDX file into "before"/"after" chunks) this WP has no proven need for yet. Flagged for
  E3.
- **Hand-page indexability tension**: `threshold.ts`'s `sectionCount`/`proseCharacters`
  measurement only reads the MDX file. A hand page's template-computed sections (3/5/6)
  don't count toward that measurement, so E3 will need substantial narrative `##` content
  in the MDX itself to clear the indexability floor — not fixed in this WP, flagged as a
  known tension for E3.
- **Lesson 09's copy bug** ("행동은 네 가지뿐입니다" — asserts four actions, there are five)
  is left untouched, per content-plan ownership: H2's fix, not this WP's.
- **I2 has no proof record**: none of batch I2's five planned blog rows exist in the
  registry yet (only 3 blog records existed total, pre-assigned by the content plan itself
  to I1/I3/I4); `registry/blog/i2.ts` and `content/blog/i2.ts` are correctly-shaped empty
  maps ready for I2 to populate, not an omission.

## 9. What each content batch agent must know

- Write only your own two files (registry + MDX-map) from §3's table, plus your own MDX
  files under the listed content dir. Do not touch a sibling batch's file or the shared
  `index.ts` barrels (already wired to include yours).
- Registry `id`s are permanent keys — every relation field (`prerequisites`,
  `relatedConcepts`, `nextLessons`, `relatedTools`, `relatedHands`, `relatedArticles`) is
  by `id`, never `slug`. Renaming a `slug` later is free; renaming an `id` is not.
- A record's `status: 'PLANNED' → 'PUBLISHED'` flip must happen in the same commit as
  writing its MDX file — `content.test.ts` verifies status against the filesystem in both
  directions.
- The hand-rankings lesson is now `slug: 'poker-hand-rankings'`; if you cross-reference it
  by URL in prose, use `/learn/poker-hand-rankings`, not `/learn/hand-rankings`.
- `/blog/[slug]`, `/glossary/[slug]`, `/hands/[hand]` and their list pages, plus `/about`,
  already exist and are live (`routes.ts` flipped). Your job is content, not routing.
