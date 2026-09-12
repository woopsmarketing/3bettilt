/**
 * `PokerCard` — one playing card. Pure presentation: no data fetching, no domain logic, no
 * knowledge of a hand, a deck, or a game. Rank and suit come straight from
 * `@gto-self/shared`'s `Rank`/`Suit` unions so this never grows a second card model
 * (build spec WP-A brief).
 *
 * ## The contrast trap this solves
 *
 * A literal white paper card face would work for suit-colour contrast almost by accident,
 * but it would also read as a stark, casino-bright rectangle dropped into an otherwise
 * dark, editorial page — the opposite of the "trustworthy education site, not a casino
 * skin" direction. So the card face stays on the app's own dark surface tokens
 * (`--color-panel-600`), which means the suit ink has to be chosen deliberately rather than
 * assumed: a naive saturated red (`#ff0000`-ish) on a near-black surface reads as vivid but
 * measures low on relative luminance and fails WCAG AA. `--color-suit-red-500` in
 * `globals.css` is tuned against exactly this surface (5.2-6.1:1, see that file's contrast
 * table). The "black" suit is not rendered in black at all — on a dark ground that is
 * exactly the pure-colour-on-near-black trap the brief names — it reuses the page's own
 * light ink token, `--color-text-100`, which trivially clears AA (15.6:1) and still reads
 * unambiguously as "the other colour" against the red because the glyph shape differs too
 * (♠/♣ vs ♥/♦): colour is reinforcement here, never the only signal (WCAG 1.4.1).
 *
 * ## Accessible name
 *
 * By default the card announces itself as one unit — `role="img"` with an `aria-label` built
 * by `cardAccessibleName`, with the rank/suit glyphs marked `aria-hidden` so a screen reader
 * does not also read them as separate text nodes.
 *
 * That name is `무늬 랭크` in Korean — "스페이드 A", the order a Korean speaker says a card
 * in — NOT the drawn notation. The name used to be the notation itself ("A♠"), and a screen
 * reader reads `♠` aloud from the Unicode name: "A black spade suit", in English, on a
 * Korean-language site, on the most fundamental object it has
 * (`docs/FISHTILT_STATE.md` ruling 85). ADR-0053 keeps poker NOTATION in its international
 * form and it still does — the glyph a sighted reader sees is untouched, and the rank stays
 * the letter the card draws. What changes is only what assistive tech is told the suit is,
 * which was never notation in the first place: it was a picture of one.
 *
 * Composed inside an interactive control (e.g. `CardPicker`'s `<button>`), the wrapping
 * control should own the accessible name instead — pass `decorative` so this component
 * renders `aria-hidden` and does not double-announce.
 */
import type { Rank, Suit } from '@gto-self/shared';

export type PokerCardSize = 'xs' | 'sm' | 'md' | 'lg';

interface PokerCardBaseProps {
  readonly size?: PokerCardSize;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  /**
   * True when a wrapping interactive element (e.g. `CardPicker`'s button) already provides
   * the accessible name. The card then renders `aria-hidden="true"` instead of
   * `role="img"` + its own label, so screen readers hear one name, not two.
   */
  readonly decorative?: boolean;
}

export type PokerCardProps =
  | (PokerCardBaseProps & { readonly faceDown: true; readonly rank?: never; readonly suit?: never })
  | (PokerCardBaseProps & { readonly faceDown?: false; readonly rank: Rank; readonly suit: Suit });

const SUIT_GLYPH: Readonly<Record<Suit, string>> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED_SUITS: ReadonlySet<Suit> = new Set(['h', 'd']);

/** The suit names in Korean. The one place they are spelled, so a card, a picker button and
 *  a hand-checker selection can never announce the same suit three different ways. */
export const SUIT_KOREAN: Readonly<Record<Suit, string>> = {
  s: '스페이드',
  h: '하트',
  d: '다이아몬드',
  c: '클럽',
};

/**
 * What assistive tech is told a card is: `무늬 랭크`, e.g. "스페이드 A".
 *
 * Suit first because that is the order the card is said in Korean (스페이드 에이스), and the
 * rank stays the drawn letter per ADR-0053. Exported because three components put a card's
 * name on something other than the card itself — `CardPicker`'s buttons and `HandChecker`'s
 * 사용됨/사용 안 됨 chips own their own accessible name and must use the same words.
 */
export function cardAccessibleName(rank: Rank, suit: Suit): string {
  return `${SUIT_KOREAN[suit]} ${rank}`;
}

const SIZE_CLASS: Readonly<Record<PokerCardSize, string>> = {
  xs: 'h-9 w-7 text-xs gap-0',
  sm: 'h-11 w-8 text-sm gap-0.5',
  md: 'h-16 w-12 text-lg gap-1',
  lg: 'h-24 w-[4.5rem] text-3xl gap-1.5',
};

const SUIT_SIZE_CLASS: Readonly<Record<PokerCardSize, string>> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-4xl',
};

/** "AKQJT98765432" stays in the same order as `@gto-self/shared`'s `RANKS`; "T" is drawn as
 *  "10" for readers who have never seen ten written as a single letter. */
const RANK_LABEL: Readonly<Record<Rank, string>> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

export function PokerCard(props: PokerCardProps) {
  const {
    size = 'md',
    selected = false,
    disabled = false,
    decorative = false,
    className = '',
  } = props;

  const sizeClass = SIZE_CLASS[size];
  const suitSizeClass = SUIT_SIZE_CLASS[size];

  const base =
    'inline-flex flex-col items-center justify-center rounded-md border-2 font-bold leading-none ' +
    'bg-panel-600 border-line-500';
  const state = [
    selected ? 'border-brand-500 ring-2 ring-brand-500 ring-offset-2 ring-offset-ground-900' : '',
    disabled ? 'opacity-40' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (props.faceDown) {
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-hidden={decorative ? true : undefined}
        aria-label={decorative ? undefined : '뒷면 카드'}
        className={`${base} ${sizeClass} ${state} ${className}`}
      >
        {/* Purely decorative back pattern — no information is carried here, so it needs no
            contrast guarantee beyond being visible against the card face itself. */}
        <span aria-hidden="true" className="h-1/2 w-1/2 rotate-45 rounded-sm bg-line-500" />
      </span>
    );
  }

  const { rank, suit } = props;
  const glyph = SUIT_GLYPH[suit];
  const isRed = RED_SUITS.has(suit);
  const suitColorClass = isRed ? 'text-suit-red-500' : 'text-text-100';
  const label = cardAccessibleName(rank, suit);

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      className={`${base} ${sizeClass} ${state} ${className}`}
    >
      <span aria-hidden="true" className="text-text-100">
        {RANK_LABEL[rank]}
      </span>
      <span aria-hidden="true" className={`${suitColorClass} ${suitSizeClass}`}>
        {glyph}
      </span>
    </span>
  );
}
