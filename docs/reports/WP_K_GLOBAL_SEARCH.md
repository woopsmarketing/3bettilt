# WP-K — Global Search

## 1. Scope

Client-side search over everything FishTilt has published: learn lessons, blog articles,
glossary terms, hand pages, and the six `/tools/*` routes. No server, no API route, no
external service, no analytics. Built and tested; **not yet linked from nav** — see §10.

## 2. Files changed

All new files; nothing outside this WP's boundary was touched.

| Area | Files |
| --- | --- |
| Feature (pure logic) | `src/features/search/{types,normalize,match,copy,buildIndex,url,index}.ts` + one `.test.ts` per file |
| Components | `src/components/{SearchClient,SearchResultList,SearchEmptyState}.tsx` + one `.test.tsx` each |
| Route | `src/app/search/page.tsx` |
| E2E | `tests/e2e/search.spec.ts` (written, **not run** — see §9) |
| Report | `docs/reports/WP_K_GLOBAL_SEARCH.md` (this file) |

`src/lib/routes.ts` was read, never edited.

## 3. How the index is built, and why nothing unfinished can appear in it

`features/search/buildIndex.ts` is the only module allowed to look at a `ContentRecord`'s
`status` or a `RouteEntry`'s `available`. Everywhere else a `SearchRecord` already exists,
which by construction means it is safe to link to (`SearchRecord.href` is a plain `string`,
never `string | null`).

- A content record is included only if `hrefOfContent(record)` (`content/graph.ts`) is
  non-`null`. That function returns `null` for exactly one reason — `status !== 'PUBLISHED'`
  — so this is derived from the graph's own gate, not re-implemented as a local
  `status === 'PUBLISHED'` check, and therefore cannot drift from it.
- A tool is included only if its `RouteEntry.available` is `true` — the same gate
  `features/tools/hub.ts` applies before letting a tool render as a link on `/tools`.
- All content is gathered via `content/graph.ts`'s own `contentOfKind` (never
  `content/registry/index.ts` directly), per the brief's instruction that `graph.ts` is the
  only source of content truth.
- `buildSearchIndex(content, routes, toolDescriptions?)` is a pure function of its three
  arguments (the last defaults to the real `TOOL_DESCRIPTION`); `SEARCH_INDEX` is the one
  call site that wires in the real registry, routes and descriptions.

## 4. The `indexable: false` decision

**Decision: `indexable` is NOT consulted by this feature. Only `status` (via
`hrefOfContent`) gates inclusion.**

Reasoning:

1. Every current consumer of `indexable` in this codebase
   (`app/{learn,blog,glossary,hands}/[slug]/page.tsx`) wires it straight to Next's
   `robots: { index }` metadata. Its one settled meaning here is "should an external search
   engine crawl and rank this page" — not "should FishTilt's own search surface it."
2. A record `indexable: false` marks is still `PUBLISHED`: real MDX, a real URL, a real row
   on its own hub page (`/learn`, `/blog`, `/glossary`, `/hands` list every `PUBLISHED`
   record regardless of `indexable`). `ContentRecord.indexable`'s own module doc says plainly
   "a published page can be legitimately thin."
3. If this site's search additionally hid it, a visitor could reach the page by clicking
   through its hub list but not by typing its exact title into search — strictly worse than
   either "always findable" or "not published yet," and a new, unnecessary dishonesty this
   feature's other rules don't otherwise require.

This is written into `buildIndex.ts`'s module doc as the load-bearing comment, and
`buildIndex.test.ts` has a fixture (`PUBLISHED_BUT_NOT_INDEXABLE`) that is `PUBLISHED` +
`indexable: false` and asserts it is included.

## 5. Matching rules and ranking tiers

Fields searched: `title` always; `description` always; `concepts` always; glossary adds
`term`, `aliases`, `shortDefinition`; hands adds `handKey`.

A record's score is `primaryTier*100 + secondaryTier*10 + conceptTier`, each tier being the
**best** single-field match in that group (0/1/2/3). Because 3×10 < 100 and 3×1 < 10, a group
can never be outranked by a lower group no matter how many fields in it match — the ordering
below is true by construction, not tuning.

| Tier | Fields | Match strength → points | Max score |
| --- | --- | --- | --- |
| Primary | `title`, `term`, `aliases[]`, `handKey` | exact=3 / prefix=2 / contains=1, ×100 | 300 |
| Secondary | `description`, `shortDefinition` | exact=3 / prefix=2 / contains=1, ×10 | 30 |
| Concept | `concepts[]` | exact=3 / prefix=2 / contains=1, ×1 | 3 |

Ties break on `title.localeCompare(other, 'ko')`. A score of 0 (nothing matched at even
CONTAINS) is dropped, never shown as a weak result.

**Display is a flat, single ranked list, not sections per kind** — each row is *labelled*
with its kind (`searchKindLabel`), not grouped into a kind section. The brief allows either
"group or label"; grouping was rejected because it would let a lower-scoring result in an
earlier-ordered kind (e.g. `learn`) render above a higher-scoring exact match in a
later-ordered kind (e.g. `glossary`) — exactly the failure the tiers exist to prevent. Flat
+ labelled makes "the obvious answer is first" true of position 1 in the DOM, always.

## 6. Korean-input handling

- `normalizeText`: NFC-normalise, trim, lowercase (lowercasing is a no-op on Hangul; it is
  what makes `AKs`/`aks`/`AKS` equivalent).
- `compact`: `normalizeText` plus **every** whitespace run removed, on both the query and
  the field, so `"팟 오즈"` and `"팟오즈"` match each other regardless of which side supplies
  the spacing.
- Deliberately does **not** attempt: partial-syllable (mid-IME-composition) matching, typo/
  spelling tolerance, or Latin romanisation (`potoz` will not find `팟오즈`). See §11.

## 7. Accessibility

- Input has a real `<label htmlFor>` ("검색어"); `getByLabelText`/`getByLabel` resolve it in
  both the unit and e2e suites.
- Result count is announced via `<p role="status" aria-live="polite">` — same idiom as
  `QuizResult`/`Quiz`/`MiniQuiz` elsewhere in this app. Reads "검색어를 입력해보세요" before
  anything is typed (never a fabricated "0개 결과"), then "N개 결과".
- Empty state and results are plain `<a>` elements in normal tab order — no custom
  listbox/combobox pattern, so there is nothing bespoke to get wrong; keyboard flow is
  type → Tab → Enter, proven in both the unit test and the e2e spec.

## 8. Tests vs. ruling 26

`matchQuery` and `buildSearchIndex` both take their data as **arguments** — `match.test.ts`
and most of `buildIndex.test.ts` construct their own small fixture `SearchRecord` /
`AnyContentRecord` / `RouteEntry` objects and never import the real registry. Component
tests (`SearchResultList`, `SearchEmptyState`, `SearchClient`) do the same: `SearchClient`
takes an optional `records` prop (defaults to the real `SEARCH_INDEX`) specifically so its
test suite can override it with fixtures.

Invariants asserted against the **real** `SEARCH_INDEX` (in `buildIndex.test.ts`), each
chosen because it stays true regardless of what content agents ship next:

- non-empty;
- every entry has a non-empty `href`, and a non-empty `title`/`description`;
- every entry's `kind` is one of the known kinds;
- every non-`tool` entry's id resolves through `findContent` to a record whose `status` is
  `'PUBLISHED'` (i.e. no `PLANNED` record ever reaches the index).

The e2e spec drives the real site with `"레인지"` — read out of
`src/content/registry/glossary/j2.ts`'s `term-range` record (`term: 'Range'`,
`aliases: [..., '레인지', ...]`, `status: 'PUBLISHED'`, slug `range`) — the same fixture
`glossary.spec.ts` already relies on being published. Every e2e assertion checks that a
specific link **resolves**, never a result count.

## 9. Tests run

- `pnpm vitest run --project fishtilt src/features/search src/components/Search*`:
  **67 passed / 67 total** (own files only).
- `pnpm vitest run --project fishtilt` (whole app): **1095 passed / 1096 total, 1 failed.**
  The one failure is `src/lib/routes.test.ts` → "availability matches the disk in BOTH
  directions" — expected, see §10, not a bug in this WP's own code. All 6 `<Term>`/
  `relatedConcepts` failures present earlier in the session (in files owned by content
  agents) had already resolved themselves by the final run — not this WP's doing either way.
- `pnpm typecheck`: clean for every file this WP owns. One pre-existing error remains,
  outside this boundary: `src/features/quiz/handRankingQuestions.ts(157,10)` (unused
  `isWheelHand`) — owned by the quiz agent.
- `npx eslint apps/fishtilt --max-warnings=0`: clean for every file this WP owns. The same
  `handRankingQuestions.ts` unused-var error is the only repo-wide finding.
- `tests/e2e/search.spec.ts`: **written, not run** (orchestrator gate — `pnpm e2e:fishtilt`
  was not invoked, per instructions).

## 10. Pending integration: the `routes.ts` flip

`src/lib/routes.ts`'s `search` entry is still `available: false`, as instructed — this WP
does not own that file. Building `src/app/search/page.tsx` while that flag stays `false` now
makes `src/lib/routes.test.ts`'s bidirectional "availability matches the disk" check fail
(1 test): that test was strengthened since the WP brief was written to check the disk-to-
registry direction too, not only registry-to-disk, so a built-but-unflipped page is no
longer a state it accepts. **This is expected and requires no fix from this WP** — the
orchestrator flipping `available: true` for `search` resolves it; no code in `routes.ts` or
`routes.test.ts` was touched here, per the file boundary.

## 11. Known limitations

- **Partial-syllable input**: a query still mid-IME-composition (e.g. an incomplete Hangul
  jamo sequence) is matched literally, character-by-character — no composition-aware
  matching is attempted.
- **Typos / spelling tolerance**: none. `아웃 계산기` will not match a query typed
  `아욷 게산기`. No fuzzy-match dependency was added (none was judged necessary — see the
  brief's own instruction to report rather than add one; not added).
- **Romanisation**: a Latin transliteration of a Korean word (`potoz` for `팟오즈`) will not
  match. Only the record's own stored Korean/Latin fields are searched.
- **Score is per-field-group max, not combined**: two independent secondary-tier hits (e.g.
  both `description` and `shortDefinition` matching) score the same as one — this is
  intentional (see §5) but means a "matches in more places" signal is not rewarded beyond
  crossing into a higher tier.
