/**
 * `GuideCards` — a labelled row of cards inside a guide ("내 손", "보드", "A", "B").
 *
 * Not `PokerCards`: that primitive names its group `카드` (or the class key) and a guide shows
 * a dozen such rows on one page, which would leave assistive technology with twelve groups
 * called the same thing — and the hand checker's e2e spec addresses the tool's own group by
 * that name. Here every group is named for what it is AND what it holds
 * (`보드 카드: Qs Jc 9h 2c 5d`), the cards themselves are `PokerCard`s, and the string is parsed
 * so a typo throws at render rather than drawing the wrong card.
 */
import { cardsToString, parseCards, rankOf, suitOf } from '@gto-self/shared';
import { PokerCard, type PokerCardSize } from '../PokerCard.js';

export interface GuideCardsProps {
  /** e.g. `"QhJd"`. */
  readonly cards: string;
  /** What this row is: `내 손`, `보드`, `A`, `B`. Printed and used in the group name. */
  readonly label: string;
  readonly size?: PokerCardSize;
  readonly className?: string;
}

export function GuideCards({ cards, label, size = 'xs', className = '' }: GuideCardsProps) {
  const parsed = parseCards(cards);
  if (!parsed.ok) throw new Error(`<GuideCards cards="${cards}">: ${parsed.error}`);
  return (
    <span className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span aria-hidden="true" className="w-14 shrink-0 text-xs font-semibold text-text-300">
        {label}
      </span>
      <span
        role="group"
        aria-label={`${label} 카드: ${cardsToString(parsed.value)}`}
        className="flex gap-1.5"
      >
        {parsed.value.map((card) => (
          <PokerCard key={card} rank={rankOf(card)} suit={suitOf(card)} size={size} />
        ))}
      </span>
    </span>
  );
}
