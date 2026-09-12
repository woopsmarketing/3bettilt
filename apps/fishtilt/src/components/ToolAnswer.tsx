/**
 * `ToolAnswer` — the block a calculator's actual answer sits in.
 *
 * ## Why the answer needed a surface of its own
 *
 * All four calculators put their result in a `Panel`, the same `panel-700` card their inputs
 * sit in, at the same weight. So the page said "here are two equally important boxes" when
 * one of them is the reason the reader opened the page. WP-2 had already built the vocabulary
 * for saying otherwise and nothing was using it: `ground-800` is the RECESSED rung — a well
 * pressed into the card — and it is exactly right here, because the inputs are raised controls
 * (`panel-600` fields and buttons) while the answer is a readout. Controls come toward you,
 * displays sink in. That reads in both themes without a new token: in dark the well is darker
 * than its card, in light it is the grey inset in a white card.
 *
 * `WorkedFormula`, `WorkedBreakdown` and `ShortcutCard` were already on `ground-800`, so the
 * headline number was the one part of a result NOT wearing the result surface. Now the whole
 * answer does, and the working underneath it reads as part of the same object.
 *
 * ## `note` is a meaning, never a recommendation
 *
 * The line under the number says what the number IS ("이 정도는 이겨야 손해도 이득도
 * 아닙니다"), never what to do with it. This site computes and refuses to advise; a component
 * that hands every calculator a slot under its headline is exactly where that line would erode
 * first, so it is written down here. Callers pass finished Korean; nothing is assembled from
 * a number in this file.
 */
export interface ToolAnswerProps {
  /** The small line above the answer — what the reader asked, in their own terms. */
  readonly lead?: string;
  /** The answer itself. Already formatted by the domain layer; never built here. */
  readonly value?: string;
  /**
   * `number` is a percentage or amount and gets the tabular figures every other number on
   * this site uses; `name` is Korean prose (a hand's reading) and is set one step smaller,
   * because a 36px Hangul line wraps on a phone where a six-character percentage does not.
   */
  readonly size?: 'number' | 'name';
  /** One line of "what this means". A meaning, not a judgement — see the module doc. */
  readonly note?: string;
  /** Anything the answer is made of that is not a single value — e.g. equity's three rows. */
  readonly children?: React.ReactNode;
  readonly className?: string;
}

export function ToolAnswer({
  lead,
  value,
  size = 'number',
  note,
  children,
  className = '',
}: ToolAnswerProps) {
  const valueClass =
    size === 'number'
      ? 'tabular text-4xl font-semibold text-text-100'
      : 'text-3xl font-semibold text-text-100';

  return (
    <div className={`rounded-lg border border-line-500 bg-ground-800 p-4 sm:p-5 ${className}`}>
      {lead !== undefined ? <p className="text-sm text-text-300">{lead}</p> : null}
      {value !== undefined ? (
        <p className={`${lead !== undefined ? 'mt-1' : ''} ${valueClass}`}>{value}</p>
      ) : null}
      {note !== undefined ? <p className="mt-2 text-sm text-text-300">{note}</p> : null}
      {children !== undefined ? (
        <div className={value !== undefined || note !== undefined ? 'mt-4' : ''}>{children}</div>
      ) : null}
    </div>
  );
}
