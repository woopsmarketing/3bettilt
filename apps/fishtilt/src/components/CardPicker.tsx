/**
 * `CardPicker` — pick cards out of the 52. Pure presentation over controlled state: the
 * caller owns `value` (the current selection) and gets every change through `onChange`.
 * This component holds no card state of its own, on purpose — the equity calculator, the
 * hand checker and the quizzes (later WPs) each have different rules for how many cards
 * may be picked and what a completed selection means, and none of that is this
 * component's business (build spec WP-A brief: "keep its state controlled by the caller").
 *
 * Rows are grouped by suit (♠ ♥ ♦ ♣), each a `role="group"` labelled by a visible Korean
 * heading — sighted low-vision readers get a legible row label (`text-300`, not the
 * sub-AA `text-500`, because this text is not decorative: it is the only visual cue for
 * which row is which), and screen-reader users get the same grouping read aloud when they
 * navigate into it.
 *
 * The suit heading ids are namespaced with React's `useId()`. They were a fixed string, and
 * `/tools/equity` renders THREE pickers on one page (hero, villain, board) while
 * `/tools/hand-checker` renders two — so the page emitted four duplicate ids per extra
 * picker, and every `aria-labelledby` on the second and third picker resolved back to the
 * FIRST picker's headings. A screen-reader user moving into the board picker was told they
 * were in the hero picker's 스페이드 row.
 *
 * Each button owns its own accessible name (`cardAccessibleName` + the state word), so the
 * `PokerCard` inside it is `decorative` and announces nothing. The name is Korean —
 * "스페이드 A 선택", not "A♠ 선택" — because a screen reader reads `♠` as "black spade suit"
 * (`docs/FISHTILT_STATE.md` ruling 85); the drawn glyph is unchanged.
 *
 * Every cell is a real `<button>` — native keyboard operability (Tab/Shift+Tab, Enter,
 * Space) for free, a visible `focus-visible` ring, and a disabled state that is `disabled`
 * at the DOM level (out of tab order, exposed to assistive tech), not a fake click-blocked
 * div. Each button is at least 44x44px regardless of the card's own visual size, so the
 * hit target holds even at the compact `sm` card size this component defaults to.
 */
import { useId } from 'react';
import { RANKS_DESC, SUITS, makeCard, type Card, type Suit } from '@gto-self/shared';
import { cardAccessibleName, SUIT_KOREAN, PokerCard, type PokerCardSize } from './PokerCard.js';

export interface CardPickerProps {
  /** The current selection. Controlled — this component never mutates it itself. */
  readonly value: readonly Card[];
  readonly onChange: (next: readonly Card[]) => void;
  /** Cards spoken for elsewhere (already on the board, already another player's hand).
   *  Always disabled, regardless of `value`. */
  readonly usedCards?: readonly Card[];
  /** Once `value.length` reaches `max`, unselected cards disable rather than silently
   *  replacing the oldest pick — a UI limit, not poker knowledge, so it belongs here. */
  readonly max?: number;
  readonly size?: PokerCardSize;
  /** Accessible name for the whole picker, e.g. "핸드 카드 선택". */
  readonly label: string;
  readonly className?: string;
}

const SUIT_GLYPH: Readonly<Record<Suit, string>> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export function CardPicker({
  value,
  onChange,
  usedCards = [],
  max,
  size = 'sm',
  label,
  className = '',
}: CardPickerProps) {
  const pickerId = useId();
  const selected = new Set<Card>(value);
  const used = new Set<Card>(usedCards);
  const atCap = max !== undefined && value.length >= max;

  const toggle = (card: Card): void => {
    if (used.has(card)) return;
    if (selected.has(card)) {
      onChange(value.filter((c) => c !== card));
      return;
    }
    if (atCap) return;
    onChange([...value, card]);
  };

  return (
    <div role="group" aria-label={label} className={`flex flex-col gap-3 ${className}`}>
      {SUITS.map((suit) => {
        const headingId = `card-picker${pickerId}suit-${suit}`;
        return (
          <div key={suit} role="group" aria-labelledby={headingId}>
            <p id={headingId} className="mb-1 text-xs font-medium text-text-300">
              {SUIT_KOREAN[suit]} ({SUIT_GLYPH[suit]})
            </p>
            <div className="flex flex-wrap gap-1">
              {RANKS_DESC.map((rank) => {
                const card = makeCard(rank, suit);
                const isSelected = selected.has(card);
                const isUsed = used.has(card);
                const isDisabled = isUsed || (!isSelected && atCap);
                const stateLabel = isUsed
                  ? '사용됨'
                  : isSelected
                    ? '선택됨'
                    : isDisabled
                      ? '더 선택할 수 없음'
                      : '선택';
                return (
                  <button
                    key={card}
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    aria-label={`${cardAccessibleName(rank, suit)} ${stateLabel}`}
                    onClick={() => toggle(card)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-0.5 outline-none enabled:cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    <PokerCard
                      rank={rank}
                      suit={suit}
                      size={size}
                      selected={isSelected}
                      disabled={isUsed}
                      decorative
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
