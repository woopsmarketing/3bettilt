/**
 * `BettingTimeline` — a preflop bet sequence as a horizontal figure (D-S3-15).
 *
 * "SB 0.5BB · BB 1BB → UTG 레이즈 2.5BB → BTN 3벳 8BB → UTG 콜": the lesson on betting
 * needs the reader to see the sequence as a sequence — left to right, each step a chip,
 * an arrow between them — rather than as a sentence. `HandTimeline` is the vertical list
 * for a story's replay; this is the compact figure for a lesson's example, and both take
 * the same `BetAction` shape so an example and a story cannot describe the same act two
 * different ways.
 *
 * Every amount is a STRING the lesson wrote as an example ("예시 사이즈") and nothing here
 * adds them up (CLAUDE.md rule 1). An `<ol>`, so the order is in the semantics; wraps on a
 * phone rather than scrolling, because five chips at 390px are two rows, not a table.
 */
import type { BetAction } from './HandTimeline.js';
import { Figure } from './Figure.js';

export interface BettingTimelineProps {
  readonly steps: readonly BetAction[];
  /** Accessible name. Default "베팅 순서". */
  readonly label?: string;
  /** A caption wraps the figure in `Figure`. */
  readonly caption?: string;
  readonly className?: string;
}

const DEFAULT_LABEL = '베팅 순서';

export function BettingTimeline({
  steps,
  label = DEFAULT_LABEL,
  caption,
  className = '',
}: BettingTimelineProps) {
  if (steps.length === 0) return null;

  const figure = (
    <ol
      aria-label={label}
      className={`flex flex-wrap items-center gap-y-3 rounded-lg bg-ground-800 px-4 py-4 sm:px-5 ${className}`}
    >
      {steps.map((step, index) => (
        <li
          key={`${index}-${step.position}`}
          data-hero={step.hero ? 'true' : undefined}
          className="flex items-center"
        >
          {index > 0 ? (
            <span aria-hidden="true" className="mx-2 text-text-300">
              →
            </span>
          ) : null}
          <span className="inline-flex items-baseline gap-x-2 rounded-md border border-line-500 bg-panel-600 px-3 py-1.5">
            <span
              className={`font-mono text-sm font-semibold ${step.hero ? 'text-brand-500' : 'text-text-100'}`}
            >
              {step.position}
            </span>
            <span className="text-sm text-text-100">{step.action}</span>
            {step.amount ? (
              <span className="tabular font-mono text-sm text-text-300">{step.amount}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );

  if (caption !== undefined) return <Figure caption={caption}>{figure}</Figure>;
  return figure;
}
