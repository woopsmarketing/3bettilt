/**
 * `PositionLegend` — the one-time explanation of the position abbreviations, rendered
 * immediately under whichever group of position buttons it belongs to.
 *
 * ## Why this exists
 *
 * `docs/FISHTILT_STATE.md` ruling 65: every range surface renders `UTG` `HJ` `CO` `BTN` `SB`
 * as bare button labels with no gloss anywhere near the control — on the site's flagship
 * tool and on every lesson that embeds a matrix. ADR-0053 is accepted and is not reopened
 * here: the abbreviations are standard poker notation and stay in their international form.
 * §48 does not ask for the English to be removed either; the pattern it names as the good one
 * is the Korean gloss *beside* the abbreviation, which is exactly what
 * `content/learn/positions-6max.mdx` already does in prose. The gap was that a reader who
 * arrives at the chart without having read that lesson has no way to find out what the five
 * buttons mean.
 *
 * ## Why a legend rather than glossing every button label
 *
 * Putting `언더더건(UTG)` on each button would work once and then be repeated on every press
 * target on every surface, tripling the width of a six-button row that has to survive a
 * 360px screen — and it would put the same six words on screen five times over on a lesson
 * page that already explains them in the paragraph above. The legend states each pairing
 * exactly once, right under the control it explains, and the buttons stay the compact
 * notation the reader will meet everywhere else in poker.
 *
 * The screen-reader half of the fix is NOT here: each button carries
 * `positionAccessibleName()` (`"언더더건(UTG) 자리"`) as its own accessible name, because a
 * legend a screen-reader user has to go and find is not the same thing as a control that
 * says what it is. This component is `aria-hidden` for exactly that reason — it would
 * otherwise repeat, as a wall of text, what every button in the group already announces
 * individually.
 *
 * ## Shared, not per page
 *
 * Every range surface composes one of the shipped components — `RangeFilters` (the Explorer),
 * `RangeMatrixMini` (articles) and `HomeRangePreview` (the front page) — so rendering the
 * legend inside those three is what makes it appear everywhere a position button does,
 * without any page having to remember to add it.
 */
import type { StrategyPosition } from '@gto-self/strategy-core';
import { positionLegendEntry } from '../features/range/index.js';

export interface PositionLegendProps {
  /** The positions actually offered by the control above. Only those are glossed — a legend
   *  that explains a button the reader cannot see is noise. */
  readonly positions: readonly StrategyPosition[];
  readonly className?: string;
}

export function PositionLegend({ positions, className = '' }: PositionLegendProps) {
  if (positions.length === 0) return null;

  return (
    <p aria-hidden="true" className={`mt-2 text-xs leading-[1.7] text-text-300 ${className}`}>
      {positions.map((position, index) => (
        // `whitespace-nowrap`: Korean breaks between any two characters, so without this a
        // pairing splits across lines as `… SB` / `스몰 블라인드 …` and stops reading as one entry.
        <span key={position} className="inline-block whitespace-nowrap">
          {index > 0 ? <span className="mx-1.5">·</span> : null}
          {positionLegendEntry(position)}
        </span>
      ))}
    </p>
  );
}
