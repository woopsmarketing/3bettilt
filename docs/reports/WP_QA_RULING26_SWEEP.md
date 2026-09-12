# WP_QA_RULING26_SWEEP

One-pass sweep to end the ruling-26 pattern (`docs/FISHTILT_STATE.md` rulings 21, 23, 26, 38,
40, 41, 42): a test that sources its "not yet built" fixture from live product data instead of
constructing its own. Covers currently-passing (latent) instances, not just failing ones.

## 1. Ruling-26 instances found

6 instances found this pass: **4 live (failing before this fix), 2 latent (passing today,
guaranteed to fail as content ships)**. All resolved by giving the test a fixture it owns
(resolution 1 — the behaviour is still real); none required flipping an assertion (resolution
2 did not apply to anything found here).

| File | Depended on (live data) | Live / Latent | Resolution | How the rewritten test still bites |
| --- | --- | --- | --- | --- |
| `src/app/blog/page.test.tsx` | All 20 blog articles now `PUBLISHED` — `getAllByText('준비 중')` threw on an empty match | **Live** (the task's known failure) | Mocked `contentOfKind` in `../../content/graph.js` to append a local `PLANNED` `BlogRecord` fixture (`vi.hoisted`); switched `getAllByText`→`queryAllByText` | Fails if any `PUBLISHED` article stops rendering a link at `/blog/{slug}`, or if the injected `PLANNED` fixture ever rendered a link/lost its `준비 중` badge — both real render-path bugs, independent of real registry state |
| `src/app/hands/page.test.tsx` | Registry has 17/20 `PLANNED` hands today (WP-E3 publishing live); would go stale as that count reaches 0 | **Latent** (pre-empted before it fires) | Same pattern: mocked `contentOfKind('hands')` to append a local `PLANNED` `HandRecord` with an unresolvable `handKey` (`'ZZx'`, so `handStrengthForKey` sorts it last via `+Infinity` without throwing) | Same as above, scoped to `/hands`; also fails if the sort-by-rank logic starts throwing on an unranked key |
| `src/content/graph.test.ts` — `'offers a link only for a published piece'` | `ALL_CONTENT.find((r) => r.status === 'PLANNED')` — the shallow "search instead of name" variant ruling 21 explicitly warns delays but does not prevent the failure; 14 PLANNED records exist today (all in `hands/e3.ts`), shrinking as WP-E3 publishes | **Latent** — missed by the earlier MDX-gap fix pass, which fixed a different assertion in the same file (`contentMeta`'s `position` clone) but not this one | `hrefOfContent` is a pure function of its argument (no registry lookup), so no mock is even needed: replaced the live `.find()` with `{ ...contentById('poker-range'), status: 'PLANNED' as const }`. Removed the now-unused `ALL_CONTENT` import. | Fails if `hrefOfContent` ever returns non-null for a `PLANNED` record, regardless of how many (if any) real `PLANNED` records remain |
| `tests/e2e/blog.spec.ts` (index test) | Named one article, "아웃츠 9장은 무슨 뜻일까?", as the still-unwritten example — now `PUBLISHED` | **Live** | Rule-based rewrite (can't mock a registry in e2e): every `<li>` in the `전체 글` region is exactly one of "has a link" / "has a `준비 중` badge"; cross-checked against the page's own `전체 N편 중 M편` count | Fails if any row is both/neither, if a link's `href` doesn't start `/blog/`, or if the summary sentence's count disagrees with the counted rows — holds at 0, partial, or 100% published |
| `tests/e2e/learn.spec.ts` (hub test) | Named one lesson, "어떤 족보가 더 강할까요?", as still-unwritten — `hand-rankings` published mid-session (already reported broken in `WP_QA_E2E_FIXES.md` §4, not fixed there — out of that agent's boundary) | **Live** | Same rule-based rewrite, scoped to the `학습 순서` region, `/learn/` hrefs | Same shape as blog; independent of curriculum completion |
| `tests/e2e/hands.spec.ts` (index test) | Named `AKo` as not-yet-a-link — `hand-ako` is `PUBLISHED` in `src/content/registry/hands/e3.ts` as of this sweep (the prior report flagged this as *about to* publish; it already had) | **Live** (upgraded from the "latent, about to fire" status the prior report gave it) | Same rule-based rewrite, scoped to `전체 핸드`, `/hands/` hrefs | Same shape; holds through all 20 hands publishing, including the last one |

**Already correctly fixed before this sweep started (verified, not re-touched):**
`Term.test.tsx`, `ToolCTA.test.tsx`, `RelatedContent.test.tsx`, `glossary/page.test.tsx`,
`learn/page.test.tsx` (unit), `content/graph.test.ts`'s `contentMeta`/`position` case,
`tools/hub.test.ts`, `app/tools/page.test.tsx`, `tools/hand-checker/page.test.tsx` and
`tools/equity/page.test.tsx` (resolution 2 — flipped correctly per ruling 40), e2e
`tools-hub.spec.ts` and `glossary.spec.ts`, and `app/practice/page.test.tsx` /
`tests/e2e/practice.spec.ts` (both already fully fixture/rule-based, ruling 26 cited in their
own comments). Confirmed by reading each file; none needed changes.

## 2. RSC-payload audit (ruling 41)

Grepped every `*.spec.ts` for `locator('body')`, `.textContent()`, `page.content()`. Found 14
files with a whole-body `not.toContainText('GTO')` (one file, `blog.spec.ts`/`learn.spec.ts`,
also had `not.toContainText('관련 글')`) that read the body including inlined `<script>` RSC
payload text.

**Fix**: added `apps/fishtilt/tests/e2e/helpers.ts` exporting `visibleBodyText(page)` — clones
`document.body`, strips `<script>` elements, returns `textContent`. Replaced every
`await expect(page.locator('body')).not.toContainText(X)` with
`expect(await visibleBodyText(page)).not.toContain(X)` in: `about`, `blog`, `glossary`,
`hand-checker`, `equity`, `outs`, `learn`, `starting-hand`, `range-explorer`, `pot-odds`,
`home`, `tools-hub`, `practice`, `hands` (the `GTO` check only — `hands.spec.ts`'s own
disclaimer-scoped profitability test already had its own correct, more selective strip-and-
exclude implementation from a prior fix; left untouched, not worth re-deriving).

Verified this is not just theoretical: grepped all of `apps/fishtilt/src` for the literal
string `GTO` outside test files and doc comments — it appears nowhere in shipped copy, so
these checks had no live false-positive today, but per ruling 41 the sweep is unconditional
("every ... assertion ... is unreliable until it strips inline scripts") and the fix is
uniform, cheap, and removes the latent risk regardless.

No `toContainText`-present whole-body assertions were found (the "weaker than it looks"
half of ruling 41) — every "phrase present" check in the suite is already scoped to a
specific locator, not `body`.

## 3. Shared helper

Introduced one: `tests/e2e/helpers.ts` → `visibleBodyText(page)`. Justified because the exact
same 3-line bug (`locator('body')` not stripping payload scripts) was duplicated in 14 files
with identical call sites (`not.toContainText('GTO')` / `'관련 글'`) — a textbook case for one
helper per CLAUDE.md's "prefer one shared helper... if the files naturally support it."

Did **not** generalize further (e.g. into an "exclude selector" option covering
`hands.spec.ts`'s disclaimer-scoped check too): that check's exclusion logic (find an `<aside>`
by text content, not a CSS selector) doesn't collapse cleanly into the simple `body \ <script>`
shape, and forcing it in would have made the one call site that most needs to be read carefully
harder to read, for no duplication saved elsewhere. Left as its existing, already-correct,
self-contained implementation.

## 4. Judged NOT an instance, and why

| File | Looked like ruling 26 because... | Why it isn't |
| --- | --- | --- |
| `src/components/SiteHeader.test.tsx` | Loops over `PRIMARY_NAV_IDS`, checks `route.available` | Universally-quantified rule per route (available→link, else no link), not a search for "the one unbuilt route" — holds identically whether 0 or all nav routes are unavailable, matches the established "assert the rule" pattern directly |
| `src/lib/routes.test.ts` | `.filter()` calls over `ROUTES` | Structural invariants checked across *every* route (no missing label, no path/section mismatch) — not conditioned on any route being unavailable |
| `src/components/RangeFilters.test.tsx` | Asserts `Facing Open`/`Facing 3-Bet` spot buttons are disabled + `준비 중` | Fixed, permanent UI/data-completeness state of a standalone component (not derived from the content or route registry) — not "not yet built", but "this range spot has no solved data and may never get any in this app's scope" |
| `tests/e2e/range-explorer.spec.ts` — `'an unsupported situation renders an honest "준비 중" state'` | Same `Facing Open` case, in the browser | Same reasoning as above; not tracked by any WP as "to be shipped" |
| `src/features/quiz/hub.test.ts` | `.find()` by card id | Searches a **locally mocked** `practiceHubCards()` array the test itself constructs (3 fixed fixture cards), not the live registry |
| `src/content/threshold.test.ts` | `status: 'PLANNED'` literal | A local object spread override (`{ ...RECORD, status: 'PLANNED' }`) — already a self-built fixture, not a registry lookup |
| `src/content/registry/{blog,glossary,learn}/*.test.ts` (i1-i3, j1-j2, h1-h2) | `record.status` assertions | Each asserts **its own batch's own records** are `PUBLISHED` — a positive, stable fact about work already done, not a search for an unbuilt example elsewhere |
| `tests/e2e/blog.spec.ts` — `'is prerendered — the prose is in the HTML with JavaScript disabled'` | Currently failing | **Not ruling 26.** Root cause is unrelated: `content/blog/aks-vs-ako.mdx`'s prose was rewritten by a concurrent content agent, and the literal sentence the test checks for ("A와 K를 받았다는 점은 같고") no longer appears verbatim. Confirmed stable across 2 re-runs. This is a content-prose staleness issue, not a live-data "not yet built" search — flagged below, not fixed (the fix is a content-agent's ongoing edit, and updating the test's expected literal is outside this sweep's mandate). |

## 5. Excluded per instructions (not touched, not evaluated)

`src/content/registry/blog/i4.test.ts`, `src/content/registry/hands/e3.test.ts`,
`src/content/content.test.ts` — owned by in-flight content agents.

## 6. Not fixed — flagged for the orchestrator

- **`tests/e2e/blog.spec.ts:59`** ("is prerendered — the prose is in the HTML with JavaScript
  disabled") — fails because `content/blog/aks-vs-ako.mdx`'s prose was rewritten concurrently
  and no longer contains the literal checked sentence. Not a ruling-26 instance (see §4);
  requires either the content agent's edit to settle or a one-line update to the test's
  expected substring once it does — a content/test-sync issue, not this sweep's mandate.
- **`src/content/content.test.ts` → "every `<Term>` in prose names a glossary entry that is
  also a declared relation"** — `hand-aks`/`hand-ako` reference `<Term id="term-offsuit">` /
  `<Term id="term-suited">` not present in their `relatedConcepts`. Explicitly excluded
  (owned by in-flight hands content work), confirmed stable across 2 re-runs, not touched.

Both are content-authoring issues, not test-defect ruling-26 instances, and both are outside
this agent's file boundary to fix.

## 7. Gate results

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **930 passed / 1 failed (931 total)**, stable across 2 runs. The 1 failure is `src/content/content.test.ts` (excluded, in-flight content work — §6). |
| `pnpm e2e:fishtilt` | **119 passed / 1 failed (120 total)**, stable across 2 runs. The 1 failure is `tests/e2e/blog.spec.ts:59` (content-prose staleness, not ruling 26 — §6). |
| `pnpm typecheck` | Clean — all 13 workspace projects `Done`, zero errors. |
| `npx eslint apps/fishtilt --max-warnings=0` | Clean, zero output, zero warnings/errors. |

No assertion was deleted, skipped, weakened, or left vacuous. Every `queryAllByText`/rule-based
rewrite checks a strictly equal-or-broader property than what it replaced, and every fixture
introduced is owned by the test that uses it (constructed inline or injected one module below
via `vi.mock`), never read from live registry state.
