/**
 * Hand evaluation for 5, 6 and 7 cards. Neutral machinery: no strategy, no site knowledge,
 * no `poker-core`. Standard NLHE showdown rules only (settled poker rules, not inventions):
 * straight flush > quads > full house > flush > straight > trips > two pair > pair > high
 * card; the wheel `A2345` is the LOWEST straight (five-high) and `TJQKA` the highest.
 *
 * ## Technique
 *
 * Cards are folded into five 13-bit rank masks in ONE pass, with no per-rank counter array:
 *
 * - `seen1/seen2/seen3/seen4` — rank appears at least 1/2/3/4 times. Quads, trips, pairs
 *   and singles fall out as mask differences (`trips = seen3 & ~seen4`, ...).
 * - `s0..s3` — the rank mask of each suit, so a flush is `popcount(suitMask) >= 5`.
 *
 * Three independent candidates are then formed and the MAXIMUM is the answer:
 *
 * 1. the flush candidate (straight flush, else flush) from the suit that has >= 5 cards —
 *    with at most 7 cards only one suit can qualify;
 * 2. the best rank-only candidate (quads / full house / trips / two pair / pair / high card)
 *    from the count masks;
 * 3. the straight candidate from `seen1`.
 *
 * Taking the max is correct because the packed strength value orders categories, and every
 * possible 5-card hand belongs to exactly one of the three families. This never expands the
 * 21 five-card subsets of a 7-card hand: the 7-card path costs the same single pass as the
 * 5-card path. `bestFiveOf` DOES enumerate subsets, but it is a presentation helper, not the
 * hot path, and the test suite uses it as the independent cross-check of the fast path.
 *
 * Straights and "top five ranks" are precomputed at module load over all 8192 rank masks
 * (`STRAIGHT_TOP`, `TOP_FIVE`, `BIT_COUNT`). The tables are DERIVED from the definitions in
 * this file; they are an index, not the definition.
 *
 * ## The strength value
 *
 * A single non-negative integer, totally ordered, comparable with `<`/`>`:
 *
 *     bits 20-23  category index (0 = HIGH_CARD .. 8 = STRAIGHT_FLUSH)
 *     bits 16-19  first significant rank      (0 = '2' .. 12 = 'A')
 *     bits 12-15  second significant rank
 *     bits  8-11  third
 *     bits  4-7   fourth
 *     bits  0-3   fifth
 *
 * Every category uses a FIXED number of significant slots (`CATEGORY_RANK_SLOTS`), and the
 * unused low slots are zero, so padding can never make two hands of the same category
 * compare wrongly. Two hands are equal iff their strength values are equal — that is the
 * definition of a split pot here.
 */
import { invariant, type Card } from '@gto-self/shared';

export const HAND_CATEGORIES = [
  'HIGH_CARD',
  'PAIR',
  'TWO_PAIR',
  'TRIPS',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'QUADS',
  'STRAIGHT_FLUSH',
] as const;

export type HandCategory = (typeof HAND_CATEGORIES)[number];

const CAT_HIGH_CARD = 0;
const CAT_PAIR = 1;
const CAT_TWO_PAIR = 2;
const CAT_TRIPS = 3;
const CAT_STRAIGHT = 4;
const CAT_FLUSH = 5;
const CAT_FULL_HOUSE = 6;
const CAT_QUADS = 7;
const CAT_STRAIGHT_FLUSH = 8;

/** How many of the five rank slots a category actually uses. */
export const CATEGORY_RANK_SLOTS: Readonly<Record<HandCategory, number>> = {
  HIGH_CARD: 5,
  PAIR: 4,
  TWO_PAIR: 3,
  TRIPS: 3,
  STRAIGHT: 1,
  FLUSH: 5,
  FULL_HOUSE: 2,
  QUADS: 2,
  STRAIGHT_FLUSH: 1,
};

/** `HAND_CATEGORIES.indexOf(category)`, as a total lookup. Higher wins. */
export const HAND_CATEGORY_INDEX: Readonly<Record<HandCategory, number>> = {
  HIGH_CARD: CAT_HIGH_CARD,
  PAIR: CAT_PAIR,
  TWO_PAIR: CAT_TWO_PAIR,
  TRIPS: CAT_TRIPS,
  STRAIGHT: CAT_STRAIGHT,
  FLUSH: CAT_FLUSH,
  FULL_HOUSE: CAT_FULL_HOUSE,
  QUADS: CAT_QUADS,
  STRAIGHT_FLUSH: CAT_STRAIGHT_FLUSH,
};

/** The decomposed hand. `ranks` are rank indices (0 = '2' .. 12 = 'A'), most significant first. */
export interface HandValue {
  /** The totally-ordered packed value. Compare two hands by comparing this number. */
  readonly strength: number;
  readonly category: HandCategory;
  /** Made ranks then kickers, in significance order. Length is `CATEGORY_RANK_SLOTS[category]`. */
  readonly ranks: readonly number[];
}

const RANK_MASK_SIZE = 1 << 13;

/** popcount of every 13-bit rank mask. */
const BIT_COUNT = new Uint8Array(RANK_MASK_SIZE);
/** Highest straight's top rank for every 13-bit rank mask, `-1` when there is none. */
const STRAIGHT_TOP = new Int8Array(RANK_MASK_SIZE).fill(-1);
/** The five highest set ranks, packed into slots 1-5. Meaningful only when popcount >= 5. */
const TOP_FIVE = new Int32Array(RANK_MASK_SIZE);

for (let mask = 0; mask < RANK_MASK_SIZE; mask += 1) {
  let count = 0;
  let packed = 0;
  let slot = 0;
  for (let rank = 12; rank >= 0; rank -= 1) {
    if ((mask & (1 << rank)) === 0) continue;
    count += 1;
    if (slot < 5) {
      packed |= rank << (16 - 4 * slot);
      slot += 1;
    }
  }
  BIT_COUNT[mask] = count;
  TOP_FIVE[mask] = packed;

  // Ace-low aware straight detection. Shift ranks up by one bit and put the ace back in at
  // bit 0, so bit 0..13 reads "A 2 3 4 5 6 7 8 9 T J Q K A". Five consecutive set bits
  // starting at `p` mean a straight whose top rank index is `p + 3`.
  const extended = (mask << 1) | ((mask >>> 12) & 1);
  const runs = extended & (extended >>> 1) & (extended >>> 2) & (extended >>> 3) & (extended >>> 4);
  STRAIGHT_TOP[mask] = runs === 0 ? -1 : 31 - Math.clz32(runs) + 3;
}

const popcount = (mask: number): number => BIT_COUNT[mask] ?? 0;
const topFive = (mask: number): number => TOP_FIVE[mask] ?? 0;
/** Highest set bit index. Callers guarantee `mask !== 0`. */
const topBit = (mask: number): number => 31 - Math.clz32(mask);

/**
 * Total. The highest straight in a 13-bit rank mask, as its TOP rank index, or `-1`.
 * The wheel `A2345` answers `3` (five-high); `TJQKA` answers `12`.
 */
export function straightTopOfRankMask(mask: number): number {
  return STRAIGHT_TOP[mask & 0x1fff] ?? -1;
}

/** Total. The 13-bit distinct-rank mask of a set of cards. */
export function rankMaskOf(cards: readonly Card[]): number {
  let mask = 0;
  for (const card of cards) mask |= 1 << (card >> 2);
  return mask;
}

/** Total. Number of distinct ranks in a rank mask. */
export function rankCountOfMask(mask: number): number {
  return popcount(mask & 0x1fff);
}

/**
 * The hot path: the packed strength of the best five-card hand inside 5, 6 or 7 cards.
 *
 * PRECONDITION, checked only for length: the cards must be DISTINCT. Duplicate cards would
 * corrupt the count masks. `evaluateHand` validates distinctness; this entry point is the
 * one equity enumeration calls millions of times, so it trusts a deck it dealt itself.
 */
export function evaluateStrength(cards: readonly Card[]): number {
  invariant(
    cards.length >= 5 && cards.length <= 7,
    `a hand evaluation needs 5 to 7 cards, got ${cards.length}`,
  );

  let seen1 = 0;
  let seen2 = 0;
  let seen3 = 0;
  let seen4 = 0;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;

  for (const card of cards) {
    const bit = 1 << (card >> 2);
    if ((seen1 & bit) === 0) seen1 |= bit;
    else if ((seen2 & bit) === 0) seen2 |= bit;
    else if ((seen3 & bit) === 0) seen3 |= bit;
    else seen4 |= bit;

    switch (card & 3) {
      case 0:
        s0 |= bit;
        break;
      case 1:
        s1 |= bit;
        break;
      case 2:
        s2 |= bit;
        break;
      default:
        s3 |= bit;
        break;
    }
  }

  // --- candidate 1: flush / straight flush -------------------------------------------
  let best = 0;
  let flushMask = 0;
  if (popcount(s0) >= 5) flushMask = s0;
  else if (popcount(s1) >= 5) flushMask = s1;
  else if (popcount(s2) >= 5) flushMask = s2;
  else if (popcount(s3) >= 5) flushMask = s3;

  if (flushMask !== 0) {
    const straightFlushTop = STRAIGHT_TOP[flushMask] ?? -1;
    // Nothing outranks a straight flush, so this is already the answer.
    if (straightFlushTop >= 0) return (CAT_STRAIGHT_FLUSH << 20) | (straightFlushTop << 16);
    best = (CAT_FLUSH << 20) | topFive(flushMask);
  }

  // --- candidate 2: the best rank-only hand ------------------------------------------
  const quads = seen4;
  const trips = seen3 & ~seen4;
  const pairs = seen2 & ~seen3;
  const ranks = seen1;

  let rankCandidate: number;
  if (quads !== 0) {
    const quadRank = topBit(quads);
    const kicker = topBit(ranks & ~(1 << quadRank));
    rankCandidate = (CAT_QUADS << 20) | (quadRank << 16) | (kicker << 12);
  } else if (trips !== 0 && (popcount(trips) >= 2 || pairs !== 0)) {
    const tripRank = topBit(trips);
    const pairRank = topBit((trips & ~(1 << tripRank)) | pairs);
    rankCandidate = (CAT_FULL_HOUSE << 20) | (tripRank << 16) | (pairRank << 12);
  } else if (trips !== 0) {
    const tripRank = topBit(trips);
    const rest = ranks & ~(1 << tripRank);
    const k1 = topBit(rest);
    const k2 = topBit(rest & ~(1 << k1));
    rankCandidate = (CAT_TRIPS << 20) | (tripRank << 16) | (k1 << 12) | (k2 << 8);
  } else if (popcount(pairs) >= 2) {
    const high = topBit(pairs);
    const low = topBit(pairs & ~(1 << high));
    const kicker = topBit(ranks & ~(1 << high) & ~(1 << low));
    rankCandidate = (CAT_TWO_PAIR << 20) | (high << 16) | (low << 12) | (kicker << 8);
  } else if (pairs !== 0) {
    const pairRank = topBit(pairs);
    const rest = ranks & ~(1 << pairRank);
    const k1 = topBit(rest);
    const k2 = topBit(rest & ~(1 << k1));
    const k3 = topBit(rest & ~(1 << k1) & ~(1 << k2));
    rankCandidate = (CAT_PAIR << 20) | (pairRank << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4);
  } else {
    rankCandidate = (CAT_HIGH_CARD << 20) | topFive(ranks);
  }
  if (rankCandidate > best) best = rankCandidate;

  // --- candidate 3: straight ----------------------------------------------------------
  const straightTop = STRAIGHT_TOP[ranks] ?? -1;
  if (straightTop >= 0) {
    const candidate = (CAT_STRAIGHT << 20) | (straightTop << 16);
    if (candidate > best) best = candidate;
  }

  return best;
}

/** Total. Unpack a strength value produced by `evaluateStrength`. */
export function decodeStrength(strength: number): HandValue {
  const category = HAND_CATEGORIES[strength >>> 20];
  invariant(category !== undefined, `not a hand strength value: ${strength}`);
  const slots = CATEGORY_RANK_SLOTS[category];
  const ranks: number[] = [];
  for (let slot = 0; slot < slots; slot += 1) ranks.push((strength >>> (16 - 4 * slot)) & 0xf);
  return { strength, category, ranks };
}

/**
 * The decomposed best five-card hand inside 5, 6 or 7 DISTINCT cards. Throws on a duplicate
 * card or a bad length — both are programmer errors, exactly like `comboIndexOf`.
 */
export function evaluateHand(cards: readonly Card[]): HandValue {
  invariant(
    cards.length >= 5 && cards.length <= 7,
    `a hand evaluation needs 5 to 7 cards, got ${cards.length}`,
  );
  invariant(new Set(cards).size === cards.length, 'a hand evaluation needs distinct cards');
  return decodeStrength(evaluateStrength(cards));
}

/** Total. `-1`, `0` or `1` — `0` means a split pot. */
export function compareHands(a: number, b: number): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface BestFive {
  readonly value: HandValue;
  /** The five cards, in the order they appeared in the input. */
  readonly cards: readonly Card[];
}

/**
 * The best five-card subset, by explicit enumeration of the `C(n, 5)` subsets.
 *
 * TIE-BREAK: subsets are visited in ascending index order and a subset replaces the
 * incumbent only on a STRICTLY greater strength, so the winner is the lexicographically
 * FIRST optimal subset. Callers that care which cards "played" exploit this by ordering the
 * input so the cards they would rather not attribute come first (`heroHand` passes the board
 * before the hole cards, which yields the minimum number of hole cards that are genuinely
 * necessary).
 *
 * This is NOT the hot path — `evaluateStrength` is. It exists for presentation and as the
 * independent reference the 7-card tests check the fast path against.
 */
export function bestFiveOf(cards: readonly Card[]): BestFive {
  invariant(
    cards.length >= 5 && cards.length <= 7,
    `a hand evaluation needs 5 to 7 cards, got ${cards.length}`,
  );
  invariant(new Set(cards).size === cards.length, 'a hand evaluation needs distinct cards');
  const n = cards.length;
  const pick: Card[] = [];
  let bestStrength = -1;
  let bestCards: Card[] = [];
  for (let a = 0; a < n - 4; a += 1) {
    for (let b = a + 1; b < n - 3; b += 1) {
      for (let c = b + 1; c < n - 2; c += 1) {
        for (let d = c + 1; d < n - 1; d += 1) {
          for (let e = d + 1; e < n; e += 1) {
            pick.length = 0;
            for (const index of [a, b, c, d, e]) {
              const card = cards[index];
              if (card !== undefined) pick.push(card);
            }
            const strength = evaluateStrength(pick);
            if (strength > bestStrength) {
              bestStrength = strength;
              bestCards = [...pick];
            }
          }
        }
      }
    }
  }
  return { value: decodeStrength(bestStrength), cards: bestCards };
}
