/**
 * The fixed set of components MDX prose may use.
 *
 * MDX is a superset of Markdown that can import and call arbitrary JavaScript. 3BetTilt's
 * content is trusted repository content and never remote or user-supplied (build spec §79),
 * so this is not a sandbox against an attacker — it is a boundary against an ARCHITECTURE
 * problem: if any article can import any module, then a hundred articles become a hundred
 * unreviewed entry points into the app, prose starts carrying logic, and the "structure is
 * typed, prose is prose" split ADR-0080 settles stops being true within a month.
 *
 * So the rule is: an MDX file has no `import` and no `export`, and may name only the
 * components below, which `mdx-components.tsx` injects. `content.test.ts` reads every MDX
 * file and enforces both halves.
 *
 * Each entry earns its place by being something prose CANNOT do:
 *
 * - `RangeMatrixMini` — the interactive chart inside the article (§28).
 * - `PokerCards`      — real cards, resolved from the hand-class model, not a picture.
 * - `ToolCTA`         — a deep link into a tool, built from the route registry (§75).
 * - `MiniQuiz`        — the three-question check (§27).
 * - `Term`            — the inline glossary explanation (§32).
 * - `Callout`         — the "쉽게 설명하면" aside.
 * - `Fact`            — a number computed from the packages instead of typed into the text.
 * - `Figure`          — a picture with a caption, in `<figure>`/`<figcaption>` (WP-5).
 * - `OutsFigure`      — "47장 중 9장", drawn; counts from `learn-core`'s `outsOdds` (WP-5).
 * - `PotOddsFigure`   — the final pot as one bar; amounts from `potOdds`/`Money` (WP-5).
 *
 * `Fact` is the one addition to the set the plan's §6.1 sketched, and it is the one that
 * makes the others' discipline hold: without it, the moment a sentence needs "1,326" an
 * author types it, and CLAUDE.md rule 2 is enforced by memory rather than by the compiler.
 *
 * WP-S3-03 (D-S3-13/14/15) adds the Stage 3 content primitives prose may compose:
 *
 * - `QuickAnswer`, `KeyPoint`, `Quote` — prose containers with a role (the direct answer,
 *   the summary, the pull quote). Markup only; any number inside is still a `<Fact>`.
 * - `DataTable`, `ComparisonTable`, `StatsRow`, `StatCard` — numbers in a shape. Cells and
 *   values are `ReactNode`s so they can BE `<Fact>`s; the components compute nothing.
 * - `EditorialImage` — a picture at a fixed aspect, with the drawn fallback when no asset
 *   exists (prompt §AB). No text in the picture (§AA).
 * - `BoardCards`, `HandTimeline`, `StreetSection` — a hand story's board and actions,
 *   rendered from strings the story schema (WP-S3-06/08) hands over. Amounts are text; no
 *   arithmetic (CLAUDE.md rule 1).
 * - `PositionDiagram`, `BettingTimeline`, `Timeline` — the lesson diagrams prompt §AS lists.
 * - `FAQ` — `FaqSection` for prose, one array for the visible block and the `FAQPage` data.
 *
 * WP-S3-09 (contract AS) adds the two lesson slots:
 *
 * - `LessonGoals`, `LessonSummary` — learning objectives and the quick summary, as string
 *   attributes (`items={[…]}`) so they never move a lesson's measured `readMinutes` and can
 *   never carry a typed number (a number is a `<Fact>` in the prose).
 *
 * Page-level primitives (`Section`, `ArticleHero`, `ArticleMeta`, `TableOfContents`,
 * `NextRead`, `CtaBand`, `SplitLayout`, `StatStrip`, `Divider`, `FaqAccordion`) are NOT on
 * the list: they take data a page derives (headings, records, routes) and prose has no
 * business deriving it.
 *
 * The three WP-5 entries follow that rule rather than relaxing it. `Figure` is markup only
 * and states nothing; the other two are pictures of quantities, and every quantity in them
 * is read from the same `learn-core` function the surrounding `<Fact>` reads — so an article
 * still cannot type a number, and now it cannot draw one either. Each is used by real
 * articles today (`outs-nine`, `pot-odds-quick`, `why-use-range`); none is a mechanism
 * waiting for a consumer (CLAUDE.md rule 5).
 */
export const MDX_COMPONENT_ALLOW_LIST = [
  'BettingTimeline',
  'BoardCards',
  'Callout',
  'ComparisonTable',
  'DataTable',
  'EditorialImage',
  'FAQ',
  'Fact',
  'Figure',
  'HandTimeline',
  'KeyPoint',
  'LessonGoals',
  'LessonSummary',
  'MiniQuiz',
  'OutsFigure',
  'PokerCards',
  'PositionDiagram',
  'PotOddsFigure',
  'QuickAnswer',
  'Quote',
  'RangeMatrixMini',
  'StatCard',
  'StatsRow',
  'StreetSection',
  'Term',
  'Timeline',
  'ToolCTA',
] as const;

export type MdxComponentName = (typeof MDX_COMPONENT_ALLOW_LIST)[number];
