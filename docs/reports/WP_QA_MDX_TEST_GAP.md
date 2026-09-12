# WP_QA_MDX_TEST_GAP

Fix pass for the ruling-26 "search live data for a not-yet-built fixture" trap (now 5
occurrences), plus an independent audit of whether `.mdx` files can be render-tested under
vitest today.

## 1. Test fixes (ruling 26)

| File | Bug | Fix |
| --- | --- | --- |
| `apps/fishtilt/src/components/Term.test.tsx` | Searched `glossaryRecords()` for a `PLANNED` term; all 58 have shipped, search found nothing | Local `PLANNED_TERM` `GlossaryRecord` fixture via `vi.hoisted`, injected by mocking `glossaryById` in `../content/graph.js` |
| `apps/fishtilt/src/app/glossary/page.test.tsx` | Same search over `glossaryRecords()`; also `getAllByText('준비 중')` throws instead of failing when the count is legitimately 0 | Same local fixture pattern, mocking `glossaryRecords()`; also switched to `queryAllByText` |
| `apps/fishtilt/src/components/RelatedContent.test.tsx` | Assumed `poker-range`'s `nextLessons[0]` would stay `PLANNED` forever | Local `PLANNED_NEXT_LESSON` `LearnRecord`, injected one level deeper — mocking `ALL_CONTENT` in `../content/registry/index.js`, because `relationsOf`'s `contentById` call is internal to `graph.ts` and not interceptable by mocking `graph.js` itself; a cloned lesson (`{...LESSON, nextLessons: [fixture.id]}`) is rendered instead of the real lesson |
| `apps/fishtilt/src/app/learn/page.test.tsx` | Same class of bug: relied on the live roadmap always having a `PLANNED` lesson; `getAllByText` had the same throw-on-empty fragility; **also found and fixed a real, unrelated bug**: `new RegExp(lesson.title, 'u')` was unescaped, and lesson `position`'s title `자리(포지션)가 왜 그렇게 중요할까요?` (published mid-session) broke the match because unescaped `(...)` is a capture group, not literal parens | Local `PLANNED_LESSON` fixture mocked into `LEARN_ROADMAP`; switched to `queryAllByText`; added the same local `escapeRegExp` helper `/blog`, `/glossary`, `/hands` page tests already carry |
| `apps/fishtilt/src/content/graph.test.ts` | Hardcoded `contentById('position')` assuming it was still unwritten (`readMinutes === null`); `position` published mid-session | Replaced with a local clone: `{ ...contentById('poker-range'), level: 'BASIC' as const, readMinutes: null }`, matching this same file's existing clone idiom (used a few lines above for `relatedHands: []`) rather than introducing a second mock style |

No assertion was weakened, deleted, or left vacuous. Every fixture is constructed by the test,
commented in the surrounding voice, and the "PLANNED renders 준비 중, never a link" behaviour
stays exercised for real in every file regardless of how much content ships.

**One failure found outside my file boundary, not fixed (per instructions):**
`apps/fishtilt/src/app/tools/hand-checker/page.test.tsx` — reproducible (not transient), same
ruling-26 shape: it expects a hand-rankings lesson ("어떤 족보가 더 강할까요?") to still be
unwritten and render `준비 중`; that lesson has since published. This is a sixth occurrence,
in a file a content agent owns — flagged for the orchestrator, not touched.

**Scratch file check**: `measure-h1-tmp.mjs` — searched the full repo tree, not present. Already
cleaned up by whoever left it.

## 2. MDX audit

### Q1 — Can a `.mdx` file be imported/rendered in a vitest test today? **No.**

Empirically verified first-hand (not just trusting existing comments): wrote a throwaway test
at `apps/fishtilt/src/__scratch_mdx_render.test.tsx` importing and rendering the real, shipped
`apps/fishtilt/content/learn/poker-range.mdx`, ran it under
`pnpm vitest run --project fishtilt`, then deleted the file immediately after capturing the
result (it never touched git — `git status --porcelain` on the path is empty).

Result — both `import()` and `render()` failed identically, at the plain-text stage, before any
JSX evaluates:

```
Failed to parse source for import analysis because the content contains invalid JS syntax.
  File: .../content/learn/poker-range.mdx:22:123
  ...음이 바로 <Term id="term-range">핸드레인지</Term>입니다. 짧게 레인지라고도 부릅니다.
```

Root cause, confirmed by reading `vitest.config.ts`: the `fishtilt` project only sets
`oxc: { jsx: { runtime: 'automatic', importSource: 'react' } }` for `.tsx` — nothing registers
an MDX transform (no `@mdx-js/rollup`, no `plugins` array at all). `@mdx-js/mdx@3.1.1` exists
in the pnpm store only as a transitive dependency of `@mdx-js/loader` (a **webpack** loader,
wired only into `@next/mdx` for Next's own bundler) — it is not a direct dependency and nothing
resolves `.mdx` as a module for Vite/Vitest. This matches, verbatim, what `j1.test.ts`/`j2.test.ts`
already documented from their own authoring-time probes.

### Q2 — What do the batch tests actually assert?

None of the four existing batch tests (`registry/glossary/j1.test.ts`, `j2.test.ts`,
`registry/learn/h1.test.ts`, `h2.test.ts`) renders MDX. All four explicitly document why (the
same Q1 finding, discovered independently by each batch) and substitute static text analysis via
`measureContent()` (`threshold.ts`): a hand-rolled character-by-character JSX-tag scanner that
strips tags/markdown and reports `proseCharacters`, `sectionCount`, `componentUses`,
`hasEsmStatement`, `hasTopLevelHeading`.

| File | Renders MDX? | What it actually proves | Vacuous / overclaiming assertions |
| --- | :-: | --- | --- |
| `content.test.ts` | No | Global graph integrity (no dangling ids, no self-ref, no dup relation targets, no cycle, unique slugs/aliases), MDX-file-on-disk existence, `hrefOfContent` PUBLISHED-only gate, allow-list/ESM/top-level-heading checks via `measureContent()` text scan, `<Term>` used-once + resolves to a declared `relatedConcepts` id, `<ToolCTA>` present in every lesson, index-threshold clearance, reading-time-matches-measurement | None found — every assertion measures something real off disk or off the typed graph |
| `graph.test.ts` | No (unit-tests `graph.ts` itself, no file I/O) | `contentById`/`glossaryById` lookup semantics, `hrefOfContent`/`toolHref` PUBLISHED/available gating, `relationsOf` ordering and heading resolution | None after this fix (the `contentById('position')` fixture was fixed above) |
| `registry/glossary/j1.test.ts` | **No** — explicitly documented as impossible today | Batch-scoped duplicate of `content.test.ts`'s checks (28 owned slugs, MDX-map wiring via **text match**, not import, threshold, ESM/heading, `<Term>`/`<PokerCards>` validity via regex) | The file's own docstring is precise about the limit — it does not claim a render. Nothing here overclaims. |
| `registry/glossary/j2.test.ts` | **No** — same, documented independently | Same shape as J1, scoped to 30 records, plus a global alias-collision re-check for its 2 added terms | Same — accurately scoped, no overclaim |
| `registry/learn/h1.test.ts` | **No** | Same shape, plus `factValue(name, arg)` **actually invoked** (real runtime call, not reasoned about) for every `<Fact>` tag — genuine verification that that one component's specific args compute without throwing | None — but see below: this is real verification of `<Fact>`'s arguments only, not of the file as a whole compiling/rendering |
| `registry/learn/h2.test.ts` | **No** | Same as H1, plus a hardcoded fix-verification for lesson `poker-actions` naming five actions | None |

**The one assertion class that claims slightly more than it proves, across all four batch
files and `content.test.ts`**: "every `<Fact name=... arg=...>` actually computes" and "every
`<PokerCards hand=...>` names one of the 169 real hand classes" are real, non-mocked checks of
those two components' *argument values* — but they are not a render. `measureContent`'s
hand-rolled `stripJsxTags` scanner is a character-level tag stripper, not a JSX/MDX parser: it
correctly balances quotes and `{}` depth *inside* a tag, but it does not detect malformed JSX
(an unclosed tag, a stray top-level `{expression}` in prose body text, invalid nesting) the way
an actual MDX compile would. So "no ESM statement / only allow-listed components / Term and
Fact arguments are individually valid" is real and checkable text-analysis — but "this file is
syntactically valid MDX that compiles and renders" is not proven by any test, batch or global,
today. That is the actual gap, stated precisely rather than as "MDX is untested" (it is
heavily tested, just not through a renderer).

### Q3 — Does `pnpm build:fishtilt` genuinely validate every MDX file? **Yes, by design — confirmed from code, build not run (per instructions).**

All four content route templates use the same static-generation contract:

```
apps/fishtilt/src/app/learn/[slug]/page.tsx:     dynamicParams = false; generateStaticParams() -> publishedOfKind('learn')
apps/fishtilt/src/app/glossary/[slug]/page.tsx:  dynamicParams = false; generateStaticParams() -> publishedOfKind('glossary')
apps/fishtilt/src/app/blog/[slug]/page.tsx:      dynamicParams = false; generateStaticParams()
apps/fishtilt/src/app/hands/[hand]/page.tsx:     dynamicParams = false; generateStaticParams()
```

Each template also renders `<Content />` (the compiled MDX component resolved via a per-batch
map, e.g. `glossaryComponent(slug)`) directly in the page body. No route sets
`export const dynamic = 'force-dynamic'` anywhere in `apps/fishtilt/src/app` (checked, zero
matches). With `generateStaticParams` + `dynamicParams: false` and no dynamic override, Next's
App Router pre-renders (SSG) every returned param at `next build` time — meaning
`pnpm build:fishtilt` genuinely compiles (`@next/mdx` → `@mdx-js/loader`, webpack/Turbopack) and
**renders** every `PUBLISHED` MDX file server-side during the build, and a throwing `<Fact>`
argument, a component reference the MDX loader can't resolve, or malformed JSX would fail the
build, not just skip a page. This confirms ruling 32's "mitigating fact" structurally. I did not
run the build itself, per instructions.

### Q4 — Cost/risk of making MDX renderable under vitest

**What would change:**
1. Add `@mdx-js/rollup` (the Vite-compatible MDX plugin; `@mdx-js/loader` is webpack-only and
   already a dependency but useless to Vite) as a dependency — likely to `apps/fishtilt/package.json`.
2. Register it in the `fishtilt` project block of the root `vitest.config.ts` (`plugins: [mdx(...)]`,
   scoped to that one project so it doesn't affect `web` or the package projects).
3. Match `@next/mdx`'s processing options — currently `createMDX({})`, i.e. defaults, so parity
   is simple today, but this is a second place that must be kept in sync with `next.config.ts` by
   hand, forever.
4. **Non-trivial part**: Next's App Router wires `mdx-components.tsx`'s `useMDXComponents` hook
   implicitly through its own MDX integration. A bare `@mdx-js/rollup` compile does not know
   that convention — each test would need to either pass `components={ALLOWED}` explicitly to
   the compiled `<Content components={...} />`, or the plugin would need
   `providerImportSource` wired to an `MDXProvider` wrapping every test render. Either way, this
   is state a test author must remember to add, and it's a second, parallel path for supplying
   components that must be kept identical to `mdx-components.tsx` or a passing test could still
   render with the wrong component set.

**Risk**: `vitest.config.ts` is an explicit shared/root file (CLAUDE.md's "avoid concurrent
writer" list), and ten content agents are running tests against it live right now. This is
exactly the kind of change that should land as one deliberate, single-actor edit — reviewed for
every project it could affect (a Vite plugin failing to load breaks the whole file, not just
`fishtilt`) — not mid-flight. It is also not free of ongoing cost: a second MDX pipeline
(Vite/rollup) alongside the real one (webpack/Turbopack via `@next/mdx`) is two configurations
that can drift, and a passing vitest render would not by itself guarantee `next build` still
succeeds (different loader, different remark/rehype plugin registration point) — so it would
supplement `pnpm build:fishtilt`, not replace it as the ground truth.

**Recommendation**: Given Q3's finding — every content route is genuinely statically prerendered
and `pnpm build:fishtilt` already renders all 100+ MDX files for real — the missing vitest
capability is a nice-to-have (faster feedback loop per content agent, no need to run a full
Next build to catch a render throw) rather than a coverage hole with no backstop. I'd defer this
change until content authoring winds down and only one agent needs to touch the shared config,
then land it as its own reviewed PR with both `fishtilt` and `web` projects' tests run after, to
prove no other project's MDX-adjacent (there are none currently) or JSX transform broke.

## 3. Gate results

| Gate | Result |
| --- | --- |
| 5 owned files, isolated run | `Test Files 5 passed (5)`, `Tests 36 passed (36)` |
| `pnpm vitest run --project fishtilt` (full project) | `Test Files 1 failed \| 77 passed (78)`, `Tests 1 failed \| 807 passed (808)` — the 1 failure is `apps/fishtilt/src/app/tools/hand-checker/page.test.tsx`, **not owned by this WP** (a sixth ruling-26 occurrence in a content agent's file; reproducible, re-ran once, same result both times) |
| `pnpm typecheck` | Clean — all 13 workspace projects `Done`, zero errors |
| `npx eslint apps/fishtilt --max-warnings=0` | Clean, zero output, zero warnings/errors |
