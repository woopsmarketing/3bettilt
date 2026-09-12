import type { MDXComponents } from 'mdx/types';
import { localiseHref } from './src/lib/locale.js';
import { BettingTimeline } from './src/components/BettingTimeline.js';
import { BoardCards } from './src/components/BoardCards.js';
import { Callout } from './src/components/Callout.js';
import { ComparisonTable } from './src/components/ComparisonTable.js';
import { DataTable } from './src/components/DataTable.js';
import { EditorialImage } from './src/components/EditorialImage.js';
import { FAQ } from './src/components/FAQ.js';
import { Fact } from './src/components/Fact.js';
import { Figure } from './src/components/Figure.js';
import { HandTimeline } from './src/components/HandTimeline.js';
import { KeyPoint } from './src/components/KeyPoint.js';
import { LessonGoals } from './src/components/LessonGoals.js';
import { LessonSummary } from './src/components/LessonSummary.js';
import { MiniQuiz } from './src/components/MiniQuiz.js';
import { OutsFigure } from './src/components/OutsFigure.js';
import { PokerCards } from './src/components/PokerCards.js';
import { PositionDiagram } from './src/components/PositionDiagram.js';
import { PotOddsFigure } from './src/components/PotOddsFigure.js';
import { QuickAnswer } from './src/components/QuickAnswer.js';
import { Quote } from './src/components/Quote.js';
import { RangeMatrixMini } from './src/components/RangeMatrixMini.js';
import { StatCard } from './src/components/StatCard.js';
import { StatsRow } from './src/components/StatStrip.js';
import { StreetSection } from './src/components/StreetSection.js';
import { Term } from './src/components/Term.js';
import { Timeline } from './src/components/Timeline.js';
import { ToolCTA } from './src/components/ToolCTA.js';

/**
 * The MDX authoring surface: what prose is allowed to call, and what prose LOOKS like.
 *
 * ## The allow-list
 *
 * `ALLOWED` below is the whole vocabulary an article has beyond Markdown, and it matches
 * `src/content/allowList.ts` exactly. The incoming `components` argument is deliberately
 * IGNORED rather than spread in: a caller-supplied override would make the set negotiable
 * per render, and the point of the list is that it is not.
 *
 * Two different tests hold the two halves, and WP-5 added the second because it was missing:
 * `content.test.ts` checks every MDX file against `MDX_COMPONENT_ALLOW_LIST` (and that no
 * file smuggles in an `import`), while `src/components/Figure.test.tsx` checks that this map
 * and that list are the SAME SET in both directions. This header used to credit
 * `content.test.ts` with both, which it never did — a name on the list but missing here
 * renders nothing at all, and a component here but not on the list is a capability the prose
 * check cannot see.
 *
 * ## The typography
 *
 * Korean long-form on a dark ground, and the two things that decide whether it is readable
 * are line height and measure. Korean has no inter-word spacing to give the eye a resting
 * point and its glyphs are full-width, so the same line length that reads comfortably in
 * English is too long here: the article column is `--container-reading` (46rem, D-S3-10),
 * which at the prose size is roughly 41 characters per line, and the leading is 1.8 rather
 * than the ~1.5 that suits Latin text.
 *
 * Stage 3 (D-S3-11) moved the sizes onto the named tokens in `globals.css` — `text-prose`
 * (17px / 1.8) for body copy and `text-h2` (24 → 26px) for the section level — and put
 * `prose-ko` (`word-break: keep-all; overflow-wrap: anywhere`) on every prose element, so a
 * word is never cut between two syllables at a line end. Paragraph spacing is `1.25em`,
 * measured in the paragraph's own size, so it scales with the type rather than with the
 * spacing scale.
 *
 * Body copy is `text-100` at 90% rather than flat `text-100`: on a near-black ground pure
 * white ink haloes over a long read, and 90% still measures far above AA (`text-100` on
 * `ground-900` is 18.29:1 per `globals.css`'s audit, so this stays well past the 4.5:1
 * threshold). `text-300` is reserved for captions and secondary lines, where it is 7.24:1.
 *
 * Headings reuse `SectionHeading`'s scale — `text-lg font-semibold text-text-100` for the
 * section level — so a heading inside prose and a heading rendered by a page component are
 * the same object to a reader. `h3` steps down one size for the nested level; `h1` is mapped
 * for completeness but never appears in a file, because the page template owns the page's
 * single `<h1>` (enforced by `content.test.ts`).
 */

const ALLOWED = {
  BettingTimeline,
  BoardCards,
  Callout,
  ComparisonTable,
  DataTable,
  EditorialImage,
  FAQ,
  Fact,
  Figure,
  HandTimeline,
  KeyPoint,
  LessonGoals,
  LessonSummary,
  MiniQuiz,
  OutsFigure,
  PokerCards,
  PositionDiagram,
  PotOddsFigure,
  QuickAnswer,
  Quote,
  RangeMatrixMini,
  StatCard,
  StatsRow,
  StreetSection,
  Term,
  Timeline,
  ToolCTA,
} as const;

/** Exported for `content.test.ts` — the allow-list check reads the real map, not a copy. */
export const MDX_ALLOWED_COMPONENTS = ALLOWED;

const TYPOGRAPHY: MDXComponents = {
  h1: (props) => <h1 className="text-3xl font-semibold text-text-100" {...props} />,
  h2: (props) => (
    <h2
      className="mt-14 mb-5 scroll-mt-24 prose-ko text-h2 font-semibold text-text-100"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-10 mb-3 scroll-mt-24 prose-ko text-lg font-semibold text-text-100"
      {...props}
    />
  ),
  h4: (props) => (
    <h4 className="mt-8 mb-2 prose-ko text-base font-medium text-text-100" {...props} />
  ),

  p: (props) => <p className="my-[1.25em] prose-ko text-prose text-text-100/90" {...props} />,

  ul: (props) => (
    <ul
      className="my-[1.25em] list-disc space-y-2 pl-6 prose-ko text-prose text-text-100/90 marker:text-brand-500"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="my-[1.25em] list-decimal space-y-2 pl-6 prose-ko text-prose text-text-100/90 marker:text-text-300"
      {...props}
    />
  ),
  li: (props) => <li className="pl-1" {...props} />,

  strong: (props) => <strong className="font-semibold text-text-100" {...props} />,
  em: (props) => (
    <em
      className="text-text-100 not-italic underline decoration-dotted underline-offset-4"
      {...props}
    />
  ),

  // Prose writes internal links locale-less (`[레슨](/learn/pot-odds)`); the locale prefix
  // is added here, once, so `content/**` never spells it (D-S3-02, `localiseHref`).
  a: ({ href, ...props }) => (
    <a
      className="text-brand-500 underline underline-offset-4 outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      href={href === undefined ? undefined : localiseHref(href)}
      {...props}
    />
  ),

  blockquote: (props) => (
    <blockquote
      className="my-6 border-l-2 border-line-500 pl-5 prose-ko text-prose text-text-300"
      {...props}
    />
  ),

  hr: (props) => <hr className="my-12 border-line-500" {...props} />,

  code: (props) => (
    <code
      className="rounded-sm bg-panel-600 px-1.5 py-0.5 font-mono text-[0.9em] text-text-100"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-6 overflow-x-auto rounded-lg border border-line-500 bg-panel-700 p-4 text-sm"
      {...props}
    />
  ),

  // Wide content scrolls inside its own container so the page itself never gains horizontal
  // scroll (build spec §47).
  table: (props) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-line-500 px-3 py-2 text-left font-medium text-text-300"
      {...props}
    />
  ),
  td: (props) => <td className="border-b border-line-500 px-3 py-2 text-text-100/90" {...props} />,
};

export function useMDXComponents(_components?: MDXComponents): MDXComponents {
  return { ...TYPOGRAPHY, ...ALLOWED };
}
