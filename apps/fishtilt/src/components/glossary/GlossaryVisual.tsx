/**
 * Renders one `GlossaryVisual` (`visuals.ts`) with the site's own card primitives. Nothing
 * here decides WHAT to draw — `PokerCards` and `BoardCards` parse and validate the cards,
 * and `visuals.test.ts` has already proven each example makes the hand its term names.
 */
import { BoardCards } from '../BoardCards.js';
import { PokerCards } from '../PokerCards.js';
import type { GlossaryVisual } from './visuals.js';

export interface GlossaryVisualProps {
  readonly visual: GlossaryVisual;
  readonly className?: string;
}

export function GlossaryVisual({ visual, className = '' }: GlossaryVisualProps) {
  switch (visual.kind) {
    case 'made-hand':
      return (
        <div data-glossary="visual" data-kind={visual.kind} className={className}>
          <PokerCards cards={visual.cards} size="sm" className="my-0" />
        </div>
      );
    case 'hand-class':
      return (
        <div data-glossary="visual" data-kind={visual.kind} className={className}>
          <PokerCards hand={visual.hand} size="sm" className="my-0" />
        </div>
      );
    case 'board':
      return (
        <div data-glossary="visual" data-kind={visual.kind} className={className}>
          <BoardCards
            flop={visual.flop}
            turn={visual.turn}
            river={visual.river}
            size="sm"
            className="my-0"
          />
        </div>
      );
  }
}
