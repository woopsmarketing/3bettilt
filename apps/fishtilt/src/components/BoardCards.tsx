/**
 * `BoardCards` — the community cards of a hand, grouped by street (D-S3-14).
 *
 * `PokerCards` can already show five cards, but it shows them as one row, and a hand story
 * needs the reader to see that THESE three came first, then THIS one, then THIS one. So each
 * street is its own labelled group — "플랍" over three cards, "턴" over one, "리버" over one —
 * and a street that has not been dealt yet is simply absent. `role="group"` per street with
 * the street name as its accessible name, and each card is a `PokerCard` announcing itself.
 *
 * ## Data in, cards out
 *
 * Every street is a notation string (`"As Kd 7c"`) parsed by `@gto-self/shared`'s
 * `parseCards`, exactly as `PokerCards cards=` is: a malformed or duplicated card is a build
 * failure, not a wrong picture. The card COUNT is checked too — a flop of two cards is a
 * typo. The typed hand-story schema that will hand these strings over belongs to WP-S3-06/08
 * (D-S3-14); this component takes the three strings and nothing else.
 */
import { parseCards, rankOf, suitOf, type Card } from '@gto-self/shared';
import { PokerCard, type PokerCardSize } from './PokerCard.js';

export type BoardStreet = 'flop' | 'turn' | 'river';

export interface BoardCardsProps {
  /** Three cards: `"As Kd 7c"`. */
  readonly flop?: string;
  /** One card. */
  readonly turn?: string;
  /** One card. */
  readonly river?: string;
  readonly size?: PokerCardSize;
  /** Hide the street labels (the surrounding `StreetSection` already names the street). */
  readonly showLabels?: boolean;
  readonly className?: string;
}

export const STREET_LABEL: Readonly<Record<BoardStreet, string>> = {
  flop: '플랍',
  turn: '턴',
  river: '리버',
};

const STREET_COUNT: Readonly<Record<BoardStreet, number>> = { flop: 3, turn: 1, river: 1 };

function parseStreet(street: BoardStreet, text: string): readonly Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`<BoardCards ${street}="${text}">: ${parsed.error}`);
  if (parsed.value.length !== STREET_COUNT[street]) {
    throw new Error(
      `<BoardCards ${street}="${text}">: expected ${STREET_COUNT[street]} card(s), got ${parsed.value.length}`,
    );
  }
  return parsed.value;
}

export function BoardCards({
  flop,
  turn,
  river,
  size = 'md',
  showLabels = true,
  className = '',
}: BoardCardsProps) {
  const streets: readonly (readonly [BoardStreet, readonly Card[]])[] = (
    [
      ['flop', flop],
      ['turn', turn],
      ['river', river],
    ] as const
  ).flatMap(([street, text]) => (text === undefined ? [] : [[street, parseStreet(street, text)]]));

  if (streets.length === 0) return null;

  return (
    <div className={`my-6 flex flex-wrap items-end gap-x-6 gap-y-4 ${className}`}>
      {streets.map(([street, cards]) => (
        <div key={street} role="group" aria-label={STREET_LABEL[street]} data-street={street}>
          {showLabels ? (
            <p className="mb-1.5 text-xs font-medium tracking-[0.06em] text-text-300">
              {STREET_LABEL[street]}
            </p>
          ) : null}
          <div className="flex gap-2">
            {cards.map((card) => (
              <PokerCard key={card} rank={rankOf(card)} suit={suitOf(card)} size={size} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
