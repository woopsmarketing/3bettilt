/**
 * `QuizVisualView` — turns a `QuizVisual` (`features/quiz/types.ts`) into real cards via
 * `PokerCards`, the component every card-bearing surface in this app already uses. Both
 * `QuizVisual` variants map 1:1 onto `PokerCards`'s own two ways of asking for cards
 * (`hand`/`cards`), so this is a thin discriminated dispatch, not a new card renderer — the
 * engine describes WHICH cards, this says how to draw them, `PokerCards`/`PokerCard` do the
 * actual drawing (CLAUDE.md rule: no second card primitive).
 */
import type { QuizVisual } from '../features/quiz/index.js';
import type { PokerCardSize } from './PokerCard.js';
import { PokerCards } from './PokerCards.js';

export interface QuizVisualViewProps {
  readonly visual: QuizVisual;
  readonly size?: PokerCardSize;
  readonly showReading?: boolean;
  readonly className?: string;
}

export function QuizVisualView({
  visual,
  size = 'md',
  showReading = true,
  className = '',
}: QuizVisualViewProps) {
  if (visual.kind === 'HAND_CLASS') {
    return <PokerCards hand={visual.key} size={size} showReading={showReading} className={className} />;
  }
  return <PokerCards cards={visual.notation} size={size} showReading={showReading} className={className} />;
}
