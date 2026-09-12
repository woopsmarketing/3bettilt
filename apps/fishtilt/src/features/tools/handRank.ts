/**
 * The hand checker's view model — turning `strategy-core`'s `bestFiveOf` into something a
 * beginner can read: which of the 9 categories this is, a one-line specific reading ("에이스
 * 풀하우스, 킹 포함"), where it ranks among the 9, and a one-or-two-sentence explanation of
 * why those five cards make that hand. No poker rule is decided here — every category, every
 * rank and every "which five cards played" answer comes straight from `evaluateHand`/
 * `bestFiveOf`; this module only writes it down in Korean (CLAUDE.md rules 2 and 5).
 *
 * ## Which five cards "played" — board first, hole cards last
 *
 * `bestFiveOf`'s own doc comment states the trick: on a tie it keeps the FIRST optimal
 * subset in input order, so a caller who wants the minimum number of hole cards that are
 * genuinely necessary passes the board before the hole cards. This module does exactly
 * that (`evaluateHandRank` below) — it is the one line that makes "only one hole card
 * plays" and "the board plays alone" answerable at all.
 *
 * ## Why "the board plays" can only ever be reported for a 5-card board
 *
 * Dropping BOTH hole cards from the best five requires at least two cards to be excluded
 * from the combined set, and `bestFiveOf` only ever excludes `total - 5` cards. With at
 * most 2 hole cards and at most 5 board cards, `total - 5 >= 2` forces `boardCards.length
 * >= 5`, and 5 is also the maximum — so it can only be exactly 5. This is not a special
 * case handled by a flag; it falls out of the combinatorics, and `handRank.test.ts` checks
 * it holds rather than trusting the arithmetic in this comment.
 *
 * ## The wheel and the royal flush
 *
 * `evaluateHand` reports the wheel (`A2345`) as a straight topping out at '5' — correct,
 * because the ace plays low there, but exactly the beginner trap the build spec calls out:
 * a reader who sees "5 하이 스트레이트" after locking in an ace can reasonably think the ace
 * was ignored rather than that it was the LOW card. `handExplanation` says so explicitly.
 * The best possible hand (`TJQKA` suited) gets its own name, 로열 플러시 — a term Korean
 * players actually use, not a translation invented here.
 */
import {
  bestFiveOf,
  CATEGORY_RANK_SLOTS,
  HAND_CATEGORIES,
  HAND_CATEGORY_INDEX,
  type HandCategory,
  type HandValue,
} from '@gto-self/strategy-core';
import { RANKS, sortCardsDesc, type Card, type Rank } from '@gto-self/shared';

/** A player picks at most 2 hole cards. */
export const HAND_CHECKER_MAX_HOLE = 2;
/** The board goes no further than the river. */
export const HAND_CHECKER_MAX_BOARD = 5;
/** `evaluateHand`/`bestFiveOf` need at least 5 cards to say anything at all. */
export const HAND_CHECKER_MIN_CARDS = 5;

/**
 * The Korean name for each of the 9 categories — established loanwords already used
 * elsewhere in this app's own copy (`원페어`, `스트레이트 플러시` both appear in
 * `content/registry/learn.ts`'s `hand-rankings` lesson description), not invented here.
 */
export const HAND_CATEGORY_LABEL: Readonly<Record<HandCategory, string>> = {
  HIGH_CARD: '하이카드',
  PAIR: '원페어',
  TWO_PAIR: '투페어',
  TRIPS: '트리플',
  STRAIGHT: '스트레이트',
  FLUSH: '플러시',
  FULL_HOUSE: '풀하우스',
  QUADS: '포카드',
  STRAIGHT_FLUSH: '스트레이트 플러시',
};

/**
 * How many of a `HandValue.ranks` slots describe the COMBINATION itself. The remaining slots
 * (`CATEGORY_RANK_SLOTS[category] - this`) are KICKERS: cards that are part of the best five
 * but not part of what made the hand, and that therefore still separate two otherwise equal
 * hands.
 *
 * `CATEGORY_RANK_SLOTS` alone cannot answer this — `FLUSH` and `HIGH_CARD` both pack five
 * slots, but a flush's five ranks ARE the flush while a high card's lower four are kickers.
 * So the split is stated once here and then checked against the evaluator in
 * `handRank.test.ts`: for every category with kickers there are two real hands that share
 * every made rank and are still ordered by `compareHands`, and for every category without,
 * two real hands with equal made ranks compare exactly 0 (a split pot).
 */
const CATEGORY_MADE_RANK_SLOTS: Readonly<Record<HandCategory, number>> = {
  HIGH_CARD: 1,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 1,
  STRAIGHT: 1,
  FLUSH: 5,
  FULL_HOUSE: 2,
  QUADS: 1,
  STRAIGHT_FLUSH: 1,
};

/** True when this category leaves at least one card over to act as a kicker. */
export function hasKicker(category: HandCategory): boolean {
  return CATEGORY_RANK_SLOTS[category] > CATEGORY_MADE_RANK_SLOTS[category];
}

/**
 * The two halves of the nine categories, weakest to strongest, DERIVED from `hasKicker` — the
 * lists `/tools/hand-checker`'s "숫자가 같으면 누가 이기나요?" card names. That card used to
 * say a kicker breaks every tie, which is false for the four categories in
 * `CATEGORIES_WITHOUT_KICKER`: with the made ranks equal there is nothing left over and the
 * hands genuinely tie. Rendering the lists from here means the card cannot drift from what
 * the evaluator does, and cannot go stale if a category is ever renamed.
 */
export const CATEGORIES_WITH_KICKER: readonly HandCategory[] = HAND_CATEGORIES.filter(hasKicker);

export const CATEGORIES_WITHOUT_KICKER: readonly HandCategory[] = HAND_CATEGORIES.filter(
  (category) => !hasKicker(category),
);

/** `['PAIR', 'TWO_PAIR']` -> `"원페어·투페어"` — one readable list for a sentence. */
export function categoryLabelList(categories: readonly HandCategory[]): string {
  return categories.map((category) => HAND_CATEGORY_LABEL[category]).join('·');
}

/** How a Korean player SAYS a rank out loud (same voice as `features/range/copy.ts`'s
 *  private `RANK_SPOKEN` — duplicated rather than imported, since that module does not
 *  export it and this file's own boundary is `features/tools`, not `features/range`). */
const RANK_SPOKEN: Readonly<Record<Rank, string>> = {
  '2': '투',
  '3': '쓰리',
  '4': '포',
  '5': '파이브',
  '6': '식스',
  '7': '세븐',
  '8': '에이트',
  '9': '나인',
  T: '텐',
  J: '잭',
  Q: '퀸',
  K: '킹',
  A: '에이스',
};

/**
 * `ranks[n]` is typed `number | undefined` (`noUncheckedIndexedAccess`) even though
 * `CATEGORY_RANK_SLOTS` guarantees every slot this module reads is actually populated for
 * its category — so this is the one place that fact is asserted, with a message, rather
 * than scattering non-null assertions through every reading below.
 */
function spoken(rankIndex: number | undefined): string {
  const rank = rankIndex === undefined ? undefined : RANKS[rankIndex];
  if (rank === undefined) throw new Error(`not a rank index: ${String(rankIndex)}`);
  return RANK_SPOKEN[rank];
}

const ACE_INDEX = RANKS.indexOf('A');
/** The wheel's (`A2345`) reported top rank is '5', not the ace. */
const WHEEL_TOP_INDEX = RANKS.indexOf('5');

const HANGUL_SYLLABLE_BASE = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;
const FINAL_CONSONANT_COUNT = 28;

/**
 * True when the LAST character of `text` is a Hangul syllable block with a 받침 (a final
 * consonant) — e.g. `킹` (batchim ㅇ) is true, `에이스` (ends in 스, no batchim) is false.
 * Every Hangul syllable is encoded as `0xAC00 + (initial*21 + medial)*28 + final`, so
 * `code % 28 === 0` means "no final consonant" (per the Unicode Hangul Syllables block).
 */
function hasBatchim(text: string): boolean {
  const last = text.codePointAt(text.length - 1);
  if (last === undefined || last < HANGUL_SYLLABLE_BASE || last > HANGUL_SYLLABLE_LAST) {
    return false;
  }
  return (last - HANGUL_SYLLABLE_BASE) % FINAL_CONSONANT_COUNT !== 0;
}

/** The "and" particle: 과 after a batchim (킹과), 와 after none (에이스와). Never a fixed
 *  "와" — most rank names DO end in a batchim (킹, 퀸, 잭, 텐, 나인, 세븐 all do). */
function josaWaGwa(precedingWord: string): '와' | '과' {
  return hasBatchim(precedingWord) ? '과' : '와';
}

function isWheel(value: HandValue): boolean {
  return (
    (value.category === 'STRAIGHT' || value.category === 'STRAIGHT_FLUSH') &&
    value.ranks[0] === WHEEL_TOP_INDEX
  );
}

/**
 * The one-line specific reading, e.g. `"에이스 풀하우스, 킹 포함"`. Full house and two pair
 * name the MORE significant rank first and the other with "포함" — the same shape, because
 * both categories are two ranks where order changes which hand wins: aces full of kings
 * beats kings full of aces, and this reading can never render the two the same way, because
 * `value.ranks[0]` is always the category-defining rank `evaluateHand` itself picked.
 */
export function handReading(value: HandValue): string {
  const [r0, r1] = value.ranks;
  switch (value.category) {
    case 'HIGH_CARD':
      return `${spoken(r0)} 하이`;
    case 'PAIR':
      return `${spoken(r0)} 원페어`;
    case 'TWO_PAIR': {
      const high = spoken(r0);
      return `${high}${josaWaGwa(high)} ${spoken(r1)} 투페어`;
    }
    case 'TRIPS':
      return `${spoken(r0)} 트리플`;
    case 'STRAIGHT':
      return isWheel(value) ? '5 하이 스트레이트 (A-2-3-4-5)' : `${spoken(r0)} 하이 스트레이트`;
    case 'FLUSH':
      return `${spoken(r0)} 하이 플러시`;
    case 'FULL_HOUSE':
      return `${spoken(r0)} 풀하우스, ${spoken(r1)} 포함`;
    case 'QUADS':
      return `${spoken(r0)} 포카드`;
    case 'STRAIGHT_FLUSH':
      if (r0 === ACE_INDEX) return '로열 플러시 (Royal Flush)';
      return isWheel(value)
        ? '5 하이 스트레이트 플러시 (A-2-3-4-5)'
        : `${spoken(r0)} 하이 스트레이트 플러시`;
    default:
      throw new Error(`unknown hand category: ${String(value.category)}`);
  }
}

/**
 * The one-or-two-sentence beginner explanation of why these five cards make that hand.
 * "키커 (Kicker)" is glossed the way the rest of the site glosses an English term on first
 * use (`같은 무늬 (Suited)`, `거트샷 스트레이트 드로우 (Gutshot)`) — spelled out once, inline,
 * in the sentence that actually needs it, not as a separate boilerplate definition.
 */
export function handExplanation(value: HandValue): string {
  const [r0, r1, r2] = value.ranks;
  switch (value.category) {
    case 'HIGH_CARD':
      return `짝을 이루는 카드도, 이어지는 숫자도, 같은 무늬 다섯 장도 없어서 가장 높은 카드인 ${spoken(r0)}로 순위를 가립니다.`;
    case 'PAIR':
      return `${spoken(r0)} 두 장이 짝을 이뤘고, 나머지 카드 중 가장 높은 ${spoken(r1)}가 키커 (Kicker) 역할을 합니다.`;
    case 'TWO_PAIR':
      return `${spoken(r0)} 두 장과 ${spoken(r1)} 두 장, 서로 다른 두 쌍이 짝을 이뤘습니다. 남은 카드 중 가장 높은 ${spoken(r2)}가 키커 (Kicker)입니다.`;
    case 'TRIPS':
      return `${spoken(r0)} 석 장이 모였고, 나머지 카드 중 가장 높은 ${spoken(r1)}가 키커 (Kicker)입니다.`;
    case 'STRAIGHT':
      return isWheel(value)
        ? 'A-2-3-4-5로 이어지는 가장 낮은 스트레이트입니다. 이번에는 에이스가 가장 낮은 숫자로 쓰였습니다.'
        : `${spoken(r0)}부터 다섯 숫자가 끊기지 않고 이어져서 스트레이트가 됐습니다.`;
    case 'FLUSH':
      return `같은 무늬 카드가 다섯 장 모였고, 그중 가장 높은 카드는 ${spoken(r0)}입니다.`;
    case 'FULL_HOUSE':
      return `${spoken(r0)} 석 장과 ${spoken(r1)} 두 장이 합쳐졌습니다. 풀하우스는 트리플의 숫자가 우선이라 ${spoken(r0)} 풀하우스가 ${spoken(r1)} 풀하우스보다 강합니다.`;
    case 'QUADS':
      return `${spoken(r0)} 넉 장이 모두 모였고, 남은 카드 중 가장 높은 ${spoken(r1)}가 키커 (Kicker)입니다.`;
    case 'STRAIGHT_FLUSH':
      if (r0 === ACE_INDEX) return '같은 무늬로 10-J-Q-K-A가 이어진, 가장 강력한 족보입니다.';
      return isWheel(value)
        ? '같은 무늬로 이어진 A-2-3-4-5, 가장 낮은 스트레이트 플러시입니다.'
        : `같은 무늬로 ${spoken(r0)}까지 다섯 숫자가 이어져서 스트레이트 플러시가 됐습니다.`;
    default:
      throw new Error(`unknown hand category: ${String(value.category)}`);
  }
}

/** 9 — every category, weakest to strongest, is exactly `HAND_CATEGORIES.length`. */
export const TOTAL_HAND_CATEGORIES = HAND_CATEGORIES.length;

/** `STRAIGHT_FLUSH` -> 1 (strongest), `HIGH_CARD` -> 9 (weakest) — never typed as a table. */
export function rankFromTop(category: HandCategory): number {
  return TOTAL_HAND_CATEGORIES - HAND_CATEGORY_INDEX[category];
}

/** `"9개 족보 중 4번째로 강한 족보"`. */
export function categoryRankingLabel(category: HandCategory): string {
  return `${TOTAL_HAND_CATEGORIES}개 족보 중 ${rankFromTop(category)}번째로 강한 족보`;
}

export interface HandRankIncomplete {
  readonly status: 'INCOMPLETE';
  /** Hole cards plus board cards selected so far. */
  readonly totalSelected: number;
  /** How many more cards would reach the 5-card minimum. */
  readonly moreNeeded: number;
}

export interface HandRankEvaluated {
  readonly status: 'EVALUATED';
  readonly category: HandCategory;
  readonly categoryLabel: string;
  /** The one-line specific reading, e.g. `"에이스 풀하우스, 킹 포함"`. */
  readonly reading: string;
  /** The one-or-two-sentence beginner explanation. */
  readonly explanation: string;
  /** 1 (strongest) .. 9 (weakest). */
  readonly rankFromTop: number;
  readonly totalCategories: number;
  /** The five cards that make the hand, sorted high to low for display. */
  readonly bestFive: readonly Card[];
  /** Every selected card (hole or board) that appears in `bestFive`. */
  readonly usedCards: ReadonlySet<Card>;
  /** The board-plays-alone / one-hole-card-plays teaching note, or `null` in the ordinary
   *  case where both hole cards contributed. */
  readonly note: string | null;
}

export type HandRankResult = HandRankIncomplete | HandRankEvaluated;

function noteFor(holeCount: number, holeUsed: number): string | null {
  if (holeCount === 0) {
    return '핸드 카드를 아직 고르지 않아서 보드 카드만으로 계산했습니다.';
  }
  if (holeUsed === 0) {
    // Reachable only when the board holds all 5 cards — see the module doc for why that is
    // a consequence of the combinatorics, not a case this function decides on its own.
    //
    // This note used to say the board was STRONGER than the player's hand. It cannot be:
    // when the board plays, the board IS the player's hand. `bestFiveOf` prefers the board on
    // a TIE (this module's own header explains why the board is passed first), so reaching
    // here means the two hole cards did not IMPROVE on the board, not that they lost to it —
    // and anyone else at the table who is also playing the board holds the identical five
    // cards, which is a split pot, not a defeat. `content/blog/playing-the-board.mdx` and the
    // hand-ranking quiz's `board-plays-tie` fixture both already say it this way.
    return '당신이 고른 두 장으로는 보드 다섯 장보다 더 좋은 패를 만들지 못했습니다. 이럴 때는 보드가 그대로 당신의 패가 되고, 상대도 같은 상황이면 팟을 나눠 가집니다.';
  }
  if (holeCount === 2 && holeUsed === 1) {
    return '핸드 두 장 중 한 장만 이번 족보에 쓰였습니다.';
  }
  return null;
}

/**
 * The whole view model, from raw selections to a beginner-readable result. `< 5` total
 * cards is `INCOMPLETE`; 5, 6 or 7 cards evaluates through `bestFiveOf`, with the board
 * ordered first so a tie prefers attributing cards to it (see the module doc).
 */
export function evaluateHandRank(
  holeCards: readonly Card[],
  boardCards: readonly Card[],
): HandRankResult {
  const totalSelected = holeCards.length + boardCards.length;
  if (totalSelected < HAND_CHECKER_MIN_CARDS) {
    return {
      status: 'INCOMPLETE',
      totalSelected,
      moreNeeded: HAND_CHECKER_MIN_CARDS - totalSelected,
    };
  }

  const { value, cards } = bestFiveOf([...boardCards, ...holeCards]);
  const usedCards = new Set<Card>(cards);
  const holeUsed = holeCards.filter((card) => usedCards.has(card)).length;

  return {
    status: 'EVALUATED',
    category: value.category,
    categoryLabel: HAND_CATEGORY_LABEL[value.category],
    reading: handReading(value),
    explanation: handExplanation(value),
    rankFromTop: rankFromTop(value.category),
    totalCategories: TOTAL_HAND_CATEGORIES,
    bestFive: sortCardsDesc(cards),
    usedCards,
    note: noteFor(holeCards.length, holeUsed),
  };
}
