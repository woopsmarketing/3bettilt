# FishTilt WP-G — content system (MDX + typed registry + graph)

Implements `docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` §6 under ADR-0080. Date: 2026-09-05.

---

## 1. What shipped

| Area | Files |
| --- | --- |
| Typed registry | `apps/fishtilt/src/content/types.ts`, `src/content/registry/{index,learn,blog,glossary,hands}.ts` |
| Index-quality gate | `src/content/threshold.ts` (+ `threshold.test.ts`) |
| Graph | `src/content/graph.ts` (+ `graph.test.ts`) |
| Graph validation suite | `src/content/content.test.ts` — the WP's main deliverable |
| Facts (numbers in prose) | `src/content/facts.ts` |
| MDX surface | `apps/fishtilt/mdx-components.tsx`, `src/content/allowList.ts`, `src/content/mdx.d.ts`, `src/content/lessons.ts` |
| Components | `src/components/{ToolCTA,RelatedContent,Term,Callout,MiniQuiz,RangeMatrixMini,PokerCards,Fact}.tsx` + one test file each |
| Routes | `src/app/learn/page.tsx` (+ test), `src/app/learn/[slug]/page.tsx` |
| Authored lesson | `apps/fishtilt/content/learn/poker-range.mdx` |
| E2E | `apps/fishtilt/tests/e2e/learn.spec.ts` |

Registry contents: 15 learn records (1 `PUBLISHED`, 14 `PLANNED`), 3 blog, 8 glossary, 2 hands.

---

## 2. The record shape

`ContentRecord` carries the audit §6.1 / build spec §34 field list verbatim — `kind`, `id`,
`slug`, `title`, `description`, `level`, `topic`, `concepts[]`, `prerequisites[]`,
`relatedConcepts[]`, `relatedTools[]`, `relatedHands[]`, `nextLessons[]`,
`relatedArticles[]`, `indexable` — plus three fields the spec's sketch did not name:

- **`status: 'PUBLISHED' | 'PLANNED'`.** Without it the registry could hold only what is
  written, `/learn` would be a one-item list today, and every later WP would have to change
  the graph's SHAPE rather than only add prose. `PLANNED` renders as visible "준비 중" text
  and is never a link — the same honesty gate `src/lib/routes.ts` applies to nav. A
  `PUBLISHED` record without an MDX file on disk is a failing test, so the flag cannot lie.
- **`readMinutes: number | null`.** Asserted to equal `estimateReadMinutes()` of the file's
  own measured length, so the "약 4분" on screen is derived from the text that is there.
- **Per-kind extras:** `LearnRecord.order`, `GlossaryRecord.{term, aliases, shortDefinition}`,
  `HandRecord.handKey`.

`relatedTools` holds ROUTE IDS from `src/lib/routes.ts`, never paths. An article therefore
cannot hard-code `/tools/rnage`, and a tool shipping turns every CTA pointing at it into a
live deep link with no content edit.

---

## 3. Minimum meaningful content threshold (§40)

`threshold.ts`. Four measurements of the MDX file plus three of the record; each has a
per-kind floor, and `unmetIndexRequirements()` returns the specific shortfalls, not a
boolean.

Measured: `proseCharacters` (non-whitespace prose, markup/code/JSX tags removed but component
CHILDREN kept), `sectionCount` (`##` headings), distinct allow-listed components used, plus
`relatedTools` / next-step / `relatedConcepts` counts from the record.

| kind | prose 자 | 섹션 | 구성요소 | 도구 | 다음 단계 | 용어 |
| --- | --- | --- | --- | --- | --- | --- |
| learn | 1500 | 4 | 2 | 1 | 1 | 2 |
| blog | 900 | 3 | 1 | 1 | 1 | 1 |
| glossary | 400 | 2 | 0 | 1 | 0 | 1 |
| hands | 600 | 3 | 1 | 1 | 0 | 1 |

Every floor is an order of magnitude above §40's stated failure mode (a page padded to
100–200 generated characters). Enforced in `content.test.ts`: *every `indexable: true` record
clears the floor for its kind*, and *a `PLANNED` record is never indexable*. `indexable`
reaches the crawler through `robots.index` in the lesson route's `generateMetadata`.

`poker-range` measures 1563 prose characters, 6 sections, all 7 allow-listed components.

---

## 4. Graph validation (build spec §67)

`content.test.ts` — 37 assertions. Beyond the seven the brief listed:

- every referenced id exists; `relatedTools` names a real route id;
- unique ids across kinds, unique slugs within a kind, URL-safe kebab slugs;
- no dead internal link — a link is offered only for `PUBLISHED`, whose MDX file AND whose
  kind's route template (`src/app/learn/[slug]/page.tsx` …) must exist on disk;
- no orphan lesson (the roadmap is exactly the set of learn records), gapless 1..15 ordering,
  and a prerequisite always sits earlier in the curriculum;
- the prerequisite graph is acyclic; no self-reference; no duplicate target in one relation;
- relation kinds are type-correct (`nextLessons` → learn, `relatedConcepts` → glossary,
  `relatedHands` → hands with a `handKey` that is one of `strategy-core`'s 169);
- glossary aliases unique across the glossary and never colliding with another entry's term
  or slug;
- every lesson has ≥1 tool CTA and ≥1 next step (§35), and every published lesson embeds a
  `<ToolCTA>` in its prose (§35 mid-content);
- MDX carries no `import`/`export`, names no component outside the allow-list, writes no
  `<h1>`, introduces each `<Term>` at most once (§32 "first appearance"), and every `<Term>`
  id is also declared in `relatedConcepts`;
- no registry copy contains the string "GTO";
- each relation heading is distinct and none is "관련 글" (§76).

---

## 5. MDX allow-list

`Callout`, `Fact`, `MiniQuiz`, `PokerCards`, `RangeMatrixMini`, `Term`, `ToolCTA`.

`Fact` is the one addition to the plan's sketched set, and it is what makes the others'
discipline hold: **prose never writes a number.** `<Fact name="COMBO_COUNT" />` resolves
through `src/content/facts.ts` to `strategy-core` / `learn-core` / the WP-C range facade, and
an unknown name or argument throws rather than rendering a plausible value. Names shipped:
`COMBO_COUNT`, `HAND_CLASS_COUNT`, `CLASSES_OF_KIND`, `COMBOS_OF_KIND`, `HAND_COMBOS`,
`HAND_SHARE`, `RFI_COMBOS`, `RFI_PERCENT`, `RFI_POSITIONS_WITH`. All are audit category A
(mathematical fact) or a direct read of category B (`RFI_RANGES`), shown under the fixed
`학습용 기본 레인지` label with its conditions visible. No category-C figure is reachable.

`useMDXComponents` ignores its incoming `components` argument, so the set is not negotiable
per render; the "no imports in MDX" test closes the other half of the hole.

---

## 6. Glossary tooltip on touch (§32)

`Term` renders a `<button popovertarget>` plus a `<span popover="auto">` — the native HTML
Popover API. `<details>` was rejected for a mechanical reason: it is FLOW content, and a
glossary term sits inside a `<p>`, so the browser would close the paragraph before it and
desynchronise the server and client trees. `<button>` and `<span>` are both phrasing content,
so the sentence stays one paragraph.

The browser supplies press-to-open (finger, mouse and keyboard alike — never hover-only), the
invoker's expanded state for assistive tech, light dismiss, Escape, and top-layer painting no
`overflow: hidden` ancestor can clip. No JavaScript of ours, so `Term` stays a server
component. Verified in a real touch context (`hasTouch: true`, no mouse) by
`tests/e2e/learn.spec.ts`: hidden → tap opens → 닫기 closes.

One trap found and fixed during visual QA: an unconditional Tailwind `block` on the popover
beat the UA's `[popover]:not(:popover-open){display:none}` (author origin wins over UA), so
every definition rendered as a floating card over the article. It now uses `open:block`.

---

## 7. Route entries needing `available: true` (orchestrator's edit)

`src/lib/routes.ts` was not touched, per the file-ownership brief.

- **`learn` → `available: true`.** `apps/fishtilt/src/app/learn/page.tsx` now exists.

Consequence, expected and not to be "fixed" by editing the file: the regression pin in
`src/lib/routes.test.ts:58` — `expect(existsSync(pageFileFor('/learn'))).toBe(false)` — now
fails, because the page exists. The line needs to go (or become the positive assertion) in the
same pass that flips the flag. That is the only failing test in the app.

No other flip is needed from WP-G. `range` was already flipped to `available: true` by the
concurrent WP-D work, so this lesson's `ToolCTA` is already a live deep link.

---

## 8. Verification

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | 313 passed, 1 failed — the `routes.test.ts` pin above, orchestrator-owned |
| `pnpm --filter @gto-self/fishtilt typecheck` | clean |
| `npx eslint apps/fishtilt --max-warnings=0` | clean |
| `pnpm build:fishtilt` | clean; `/learn` static, `/learn/poker-range` prerendered SSG |
| `pnpm e2e:fishtilt` | 29 passed (11 new) |

Visual QA at 1440 and 390, read as a beginner. Findings, all fixed: the popover display bug
above; the article column was narrower than the blocks around it (page now shares one
`max-w-[42rem]` column); `MiniQuiz` rendered a second copy of the section heading (`title` is
now opt-in); the `Term` trigger was `inline-block` so a long Korean term jumped to its own
line (now `inline`). No horizontal overflow at 360/390/768/1280/1440.

---

## 9. Open items for later WPs

- **`RangeSummary` prints chart notation (`33+,A2s+,…`) to a beginner** who has not been
  taught to read it. It is WP-C's component and out of WP-G's boundary; a `showNotation`
  prop, defaulted off for in-article use, would fix it. Flagged for WP-C / WP-M.
- **SEO is minimal on purpose.** `generateMetadata` sets title, description and `robots` only;
  canonical, OG, JSON-LD and the §64 title pattern are WP-K's.
- **The 14 `PLANNED` lesson titles and slugs are structural, not final.** WP-H owns the
  finished wording of the lesson it writes; the roadmap fixes count, order, and edges.
- **`/blog`, `/glossary`, `/hands` route templates do not exist yet.** The graph knows their
  URL shapes and the test will demand a template the moment a record of that kind is
  published, so WP-E/WP-I cannot publish one without building the route.
- `PageHero`'s eyebrow uses `tracking-[0.35em]`, which renders "배우기" as "배 우 기". Legible
  and consistent with the design system, but worth a look in WP-L2 for Korean labels.
