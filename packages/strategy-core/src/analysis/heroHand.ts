/**
 * Hero's two cards against a 3-, 4- or 5-card board, as machine-readable features.
 *
 * The made-hand CATEGORY always comes from the evaluator (`evaluate.ts`) — this module never
 * re-derives "what hand is this". What it adds is everything the evaluator cannot know
 * because the evaluator does not know which cards are hero's: whether a pair is an overpair
 * or bottom pair, whether trips are a set, whether a flush is the nut flush, which draws hero
 * holds, and which cards hero blocks.
 *
 * Neutral: no strategy, no frequencies. Every rule below is mechanical and documented.
 *
 * ## Documented edge choices
 *
 * 1. **UNDERPAIR** is a pocket pair below the HIGHEST board card, not below the lowest.
 *    `77` on `9 5 2` is an `UNDERPAIR`, and `boardRanksBeaten` (2 here) is reported so a
 *    consumer can still tell it apart from `77` on `A K Q` (0).
 * 2. **A pocket pair is never TOP/MIDDLE/BOTTOM pair.** Those three describe hero pairing a
 *    board card with one hole card, positioned by index into the board's DISTINCT ranks
 *    descending: index 0 is TOP_PAIR, the last index is BOTTOM_PAIR, anything between is
 *    MIDDLE_PAIR. On a board with only two distinct ranks there is no middle.
 * 3. **BOARD_PAIR** is the class when the hand's only pair sits entirely on the board and
 *    neither hole card contributes to it. `A Q` on `K K 5` is a `BOARD_PAIR`, not a pair.
 * 4. **SET vs TRIPS.** `SET` = hero's pocket pair matched a board rank (two hole cards in the
 *    three of a kind). `TRIPS` = the board was paired and hero holds the third card.
 *    `BOARD_TRIPS` = all three are on the board. `tripsKind` is also reported for a FULL
 *    HOUSE, describing the source of its three-of-a-kind, so `55` on `5 8 8` reports
 *    `FULL_HOUSE` + `tripsKind: 'SET'` (fives full of eights — verified against the
 *    evaluator, NOT eights full of fives).
 * 5. **Kicker significance is a count, not an opinion.** `betterKickerCount` is the number of
 *    ranks strictly above hero's kicker that are neither the paired rank nor already on the
 *    board — i.e. how many better kickers an opponent could hold. `0 -> TOP`, `1 -> SECOND`,
 *    `2 -> THIRD`, `>= 3 -> WEAK`. A kicker is reported even when it does not play
 *    (`plays: false`), because hero's actual card is never discarded (CLAUDE.md rule 3).
 * 6. **DOUBLE_GUTSHOT is its own member**, not folded into OESD, even though both have the
 *    same number of completing RANKS. `OESD` requires a run of four consecutive ranks whose
 *    two flanking ranks are both outs; two completing ranks without such a run is a
 *    `DOUBLE_GUTSHOT`. `A K Q J` and `A 2 3 4` therefore come out as `GUTSHOT` (one flank),
 *    which is correct.
 * 7. **A straight out only counts if it beats the board.** A rank that would put a straight
 *    on the board for everyone is not hero's out; the out must give hero a STRICTLY higher
 *    straight than the board alone would make.
 * 8. **Draws are reported only below the category they draw to.** A hero who already holds a
 *    flush has no flush draw; a hero who already holds a straight has no straight draw.
 *    Anything weaker still reports its draws — top pair with an open-ender reports both.
 * 9. **Backdoor draws are flop-only.** After the turn there is one card left, so a
 *    three-card suit or a three-rank window is no longer a draw.
 * 10. **A four-flush board with no hole card of that suit is not a hero flush draw.** Hero
 *    has nothing to draw with; the fact belongs to the board features.
 * 11. **`overcardCount` counts hole CARDS above the board's highest card**, so a pocket pair
 *    above the board counts 2.
 * 12. **The nuts ignore card removal.** `nutStrengthOnBoard` is the best hand ANY two cards
 *    could make on this board, hero's blockers included, so the value is a property of the
 *    board and can be computed once and reused across hero holdings. Note that `isNuts` and
 *    `flush.isNut` answer different questions: `Ah 5h` on `Kh 7h 2h` holds the NUT FLUSH (no
 *    higher flush card exists) but is not THE NUTS, because `Ah Qh` makes a better flush.
 * 13. **A straight flush is not reported through `flush`.** `flush` describes a made FLUSH,
 *    where "how many better flushes exist" is a real question. Once the hand is a straight
 *    flush no plain flush can beat it, so the hand is described by `straight` and
 *    `madeClass` instead and `flush` stays null.
 */
import { ALL_CARDS, SUITS, invariant, type Card, type Suit } from '@gto-self/shared';
import { analyzeBoard, STRAIGHT_WINDOWS, type BoardFeatures, type BoardStreet } from './board.js';
import {
  bestFiveOf,
  evaluateStrength,
  HAND_CATEGORY_INDEX,
  rankMaskOf,
  straightTopOfRankMask,
  type HandValue,
} from './evaluate.js';

export type MadeHandClass =
  | 'STRAIGHT_FLUSH'
  | 'QUADS'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'SET'
  | 'TRIPS'
  | 'TWO_PAIR'
  | 'OVERPAIR'
  | 'TOP_PAIR'
  | 'MIDDLE_PAIR'
  | 'BOTTOM_PAIR'
  | 'UNDERPAIR'
  | 'BOARD_PAIR'
  | 'ACE_HIGH'
  | 'NO_MADE_HAND';

export type KickerClass = 'TOP' | 'SECOND' | 'THIRD' | 'WEAK';

export type TwoPairKind =
  /** Both hole cards paired two different board ranks. */
  | 'BOTH_HOLE_CARDS'
  /** One hole card paired a board rank; the second pair is on the board. */
  | 'ONE_HOLE_PLUS_BOARD_PAIR'
  /** Hero's pocket pair plus a pair on the board. */
  | 'POCKET_PAIR_PLUS_BOARD_PAIR'
  /** Both pairs are on the board; hero contributes at most a kicker. */
  | 'BOARD_TWO_PAIR';

export type TripsKind = 'SET' | 'TRIPS' | 'BOARD_TRIPS';

export type FlushNutClass = 'NUT' | 'SECOND_NUT' | 'THIRD_NUT' | 'WEAK';

export type StraightDrawKind = 'OESD' | 'DOUBLE_GUTSHOT' | 'GUTSHOT';

/**
 * The blocker vocabulary. Every member is a mechanical statement about cards hero holds that
 * an opponent therefore cannot; none of them is a strategy claim.
 *
 * - `NUT_FLUSH_BLOCKER`       a suit has >= 3 board cards and hero holds the highest card of
 *                             that suit that is not on the board.
 * - `SECOND_NUT_FLUSH_BLOCKER` as above, for the second-highest.
 * - `NUT_FLUSH_DRAW_BLOCKER`  a suit has exactly 2 board cards (and cards are still to come)
 *                             and hero holds the highest card of that suit not on the board.
 * - `FLUSH_DRAW_BLOCKER`      a suit has exactly 2 board cards (cards still to come) and hero
 *                             holds at least one card of it.
 * - `NUT_STRAIGHT_BLOCKER`    hero holds a rank the best currently-possible straight needs.
 * - `STRAIGHT_BLOCKER`        hero holds a rank some currently-possible straight needs.
 * - `TOP_PAIR_BLOCKER`        hero holds a card of the board's highest rank.
 * - `BOARD_PAIR_BLOCKER`      the board shows a rank exactly twice and hero holds the third.
 */
export const HERO_BLOCKERS = [
  'NUT_FLUSH_BLOCKER',
  'SECOND_NUT_FLUSH_BLOCKER',
  'NUT_FLUSH_DRAW_BLOCKER',
  'FLUSH_DRAW_BLOCKER',
  'NUT_STRAIGHT_BLOCKER',
  'STRAIGHT_BLOCKER',
  'TOP_PAIR_BLOCKER',
  'BOARD_PAIR_BLOCKER',
] as const;

export type HeroBlocker = (typeof HERO_BLOCKERS)[number];

export interface HeroKicker {
  /** The rank of hero's OTHER hole card — the actual card, whether or not it plays. */
  readonly rank: number;
  readonly kickerClass: KickerClass;
  /** How many better kickers an opponent could still hold. */
  readonly betterKickerCount: number;
  /** Whether the kicker is one of the five cards that make hero's hand. */
  readonly plays: boolean;
}

/** A made FLUSH. Null once the hand is a straight flush — see edge choice 13. */
export interface HeroFlush {
  readonly suit: Suit;
  /** Top rank of hero's flush, from the evaluator. */
  readonly highRank: number;
  /** Unseen cards of the suit ranked above `highRank`; `0` means the nut flush. */
  readonly betterFlushCards: number;
  readonly nutClass: FlushNutClass;
  readonly isNut: boolean;
  /** How many of hero's hole cards are in the flush suit. */
  readonly holeCardsInSuit: 0 | 1 | 2;
}

export interface HeroStraight {
  readonly topRank: number;
  /** Top rank of the best straight any two-card holding could make on this board. */
  readonly bestPossibleTop: number;
  readonly isNut: boolean;
}

export interface HeroFlushDraw {
  readonly suit: Suit;
  readonly holeCardsInSuit: 1 | 2;
  /** Hero's highest card of the suit. */
  readonly highRank: number;
  readonly betterFlushCards: number;
  readonly nutClass: FlushNutClass;
}

export interface HeroStraightDraw {
  readonly kind: StraightDrawKind;
  /** Distinct RANKS that complete a straight better than the board's own. Ascending. */
  readonly outRanks: readonly number[];
}

export interface HeroBackdoorFlushDraw {
  readonly suit: Suit;
  readonly holeCardsInSuit: 1 | 2;
}

export interface HeroDraws {
  readonly flushDraw: HeroFlushDraw | null;
  readonly straightDraw: HeroStraightDraw | null;
  /** Flop only. Exactly three cards of a suit between hero and the board, hero holding >= 1. */
  readonly backdoorFlushDraw: HeroBackdoorFlushDraw | null;
  /** Flop only. A five-rank window covered three times, hero contributing, with no live out. */
  readonly backdoorStraightDraw: boolean;
}

export interface HeroHandFeatures {
  readonly hole: readonly [Card, Card];
  readonly board: readonly Card[];
  readonly street: BoardStreet;
  readonly boardFeatures: BoardFeatures;
  /** The made hand, straight from the evaluator. */
  readonly value: HandValue;
  /** The five cards that make it, preferring board cards on a tie (see `bestFiveOf`). */
  readonly bestFive: readonly Card[];
  /** How many hole cards are genuinely necessary. */
  readonly holeCardsUsed: 0 | 1 | 2;
  readonly playsTheBoard: boolean;
  readonly madeClass: MadeHandClass;
  readonly pocketPair: boolean;
  /** The rank hero's pair is on for the pair classes, else `-1`. */
  readonly pairRank: number;
  /** Distinct board ranks strictly below `pairRank`, for the pair classes; else `0`. */
  readonly boardRanksBeaten: number;
  /** Index into the board's distinct ranks descending for TOP/MIDDLE/BOTTOM pair, else `-1`. */
  readonly pairedBoardRankIndex: number;
  readonly kicker: HeroKicker | null;
  readonly twoPairKind: TwoPairKind | null;
  readonly tripsKind: TripsKind | null;
  readonly flush: HeroFlush | null;
  readonly straight: HeroStraight | null;
  readonly draws: HeroDraws;
  /** Hole CARDS ranked above the board's highest card. */
  readonly overcardCount: 0 | 1 | 2;
  /** In `HERO_BLOCKERS` declaration order. */
  readonly blockers: readonly HeroBlocker[];
  /** Best hand any two cards could make on this board (card removal ignored). */
  readonly nutStrength: number;
  readonly isNuts: boolean;
}

export interface AnalyzeHeroHandOptions {
  /**
   * Precomputed `nutStrengthOnBoard(board)`. It depends only on the board, so batch callers
   * evaluating many holdings on one board should compute it once and pass it here.
   */
  readonly nutStrength?: number;
}

/**
 * The strength of the best hand ANY two cards could make on this board. Card removal is
 * deliberately ignored (see edge choice 12), so the answer is a property of the board alone.
 * Costs `C(52 - boardLength, 2)` evaluations — about 1100.
 */
export function nutStrengthOnBoard(board: readonly Card[]): number {
  invariant(
    board.length >= 3 && board.length <= 5,
    `a board has 3, 4 or 5 cards, got ${board.length}`,
  );
  const onBoard = new Set<number>(board);
  const live = ALL_CARDS.filter((card) => !onBoard.has(card));
  const hand: Card[] = [...board, live[0] as Card, live[1] as Card];
  const holeA = board.length;
  const holeB = board.length + 1;
  let best = 0;
  for (let i = 0; i < live.length; i += 1) {
    const first = live[i];
    if (first === undefined) continue;
    hand[holeA] = first;
    for (let j = i + 1; j < live.length; j += 1) {
      const second = live[j];
      if (second === undefined) continue;
      hand[holeB] = second;
      const strength = evaluateStrength(hand);
      if (strength > best) best = strength;
    }
  }
  return best;
}

/** Cards of `suit` ranked above `rank` that are in neither `board` nor `hole`, highest first. */
function unseenSuitedAbove(
  rank: number,
  suitIndex: number,
  seen: ReadonlySet<number>,
): readonly number[] {
  const out: number[] = [];
  for (let r = 12; r > rank; r -= 1) {
    const card = r * 4 + suitIndex;
    if (!seen.has(card)) out.push(r);
  }
  return out;
}

function flushNutClassOf(betterFlushCards: number): FlushNutClass {
  if (betterFlushCards === 0) return 'NUT';
  if (betterFlushCards === 1) return 'SECOND_NUT';
  if (betterFlushCards === 2) return 'THIRD_NUT';
  return 'WEAK';
}

function kickerClassOf(betterKickerCount: number): KickerClass {
  if (betterKickerCount === 0) return 'TOP';
  if (betterKickerCount === 1) return 'SECOND';
  if (betterKickerCount === 2) return 'THIRD';
  return 'WEAK';
}

/**
 * A run of four consecutive ranks whose BOTH flanking ranks complete a straight. Uses the
 * ace-low aware 14-bit mask, so `2345` (flanks A and 6) is open-ended while `AKQJ` and
 * `A234` — which have only one usable flank — are not.
 */
function hasOpenEndedRun(rankMask: number, outRanks: readonly number[]): boolean {
  const extended = ((rankMask & 0x1fff) << 1) | ((rankMask >>> 12) & 1);
  const runs = extended & (extended >>> 1) & (extended >>> 2) & (extended >>> 3);
  for (let p = 1; p <= 9; p += 1) {
    if ((runs & (1 << p)) === 0) continue;
    const lowFlank = p === 1 ? 12 : p - 2;
    const highFlank = p + 3;
    if (outRanks.includes(lowFlank) && outRanks.includes(highFlank)) return true;
  }
  return false;
}

function straightOutRanksOf(knownMask: number, boardMask: number): readonly number[] {
  const outs: number[] = [];
  for (let rank = 0; rank <= 12; rank += 1) {
    const bit = 1 << rank;
    if ((knownMask & bit) !== 0) continue;
    const heroTop = straightTopOfRankMask(knownMask | bit);
    if (heroTop < 0) continue;
    if (heroTop <= straightTopOfRankMask(boardMask | bit)) continue;
    outs.push(rank);
  }
  return outs;
}

function classifyPair(
  pairRank: number,
  holeRanks: readonly [number, number],
  board: BoardFeatures,
): { madeClass: MadeHandClass; pairedBoardRankIndex: number } {
  const pocketPair = holeRanks[0] === holeRanks[1];
  const boardCount = board.rankCounts[pairRank] ?? 0;
  const heroHoldsPairRank = holeRanks[0] === pairRank || holeRanks[1] === pairRank;

  if (pocketPair && pairRank === holeRanks[0] && boardCount === 0) {
    return {
      madeClass: pairRank > board.highCardRank ? 'OVERPAIR' : 'UNDERPAIR',
      pairedBoardRankIndex: -1,
    };
  }
  if (heroHoldsPairRank && boardCount === 1) {
    const index = board.distinctRanksDesc.indexOf(pairRank);
    const last = board.distinctRanksDesc.length - 1;
    const madeClass: MadeHandClass =
      index === 0 ? 'TOP_PAIR' : index === last ? 'BOTTOM_PAIR' : 'MIDDLE_PAIR';
    return { madeClass, pairedBoardRankIndex: index };
  }
  return { madeClass: 'BOARD_PAIR', pairedBoardRankIndex: -1 };
}

function classifyTwoPair(
  ranks: readonly number[],
  holeRanks: readonly [number, number],
  board: BoardFeatures,
): TwoPairKind {
  let holePlusBoard = 0;
  let boardPairs = 0;
  let pocketPairs = 0;
  for (const rank of [ranks[0] ?? -1, ranks[1] ?? -1]) {
    const boardCount = board.rankCounts[rank] ?? 0;
    const heroCount = (holeRanks[0] === rank ? 1 : 0) + (holeRanks[1] === rank ? 1 : 0);
    if (boardCount >= 2) boardPairs += 1;
    else if (boardCount === 1 && heroCount >= 1) holePlusBoard += 1;
    else if (heroCount === 2) pocketPairs += 1;
  }
  if (holePlusBoard === 2) return 'BOTH_HOLE_CARDS';
  if (holePlusBoard === 1 && boardPairs === 1) return 'ONE_HOLE_PLUS_BOARD_PAIR';
  if (pocketPairs === 1 && boardPairs === 1) return 'POCKET_PAIR_PLUS_BOARD_PAIR';
  return 'BOARD_TWO_PAIR';
}

function classifyTrips(tripRank: number, board: BoardFeatures): TripsKind {
  const boardCount = board.rankCounts[tripRank] ?? 0;
  if (boardCount >= 3) return 'BOARD_TRIPS';
  if (boardCount === 2) return 'TRIPS';
  return 'SET';
}

function blockersOf(hole: readonly [Card, Card], board: BoardFeatures): readonly HeroBlocker[] {
  const found = new Set<HeroBlocker>();
  const holeRanks = [hole[0] >> 2, hole[1] >> 2];
  const holeCards = new Set<number>(hole);
  const boardOnly = new Set<number>(board.cards);

  for (let suitIndex = 0; suitIndex < 4; suitIndex += 1) {
    const boardSuitCount = board.suits.counts[suitIndex] ?? 0;
    if (boardSuitCount < 2) continue;
    // Highest cards of the suit that are not already on the board, best first.
    const candidates: number[] = [];
    for (let rank = 12; rank >= 0; rank -= 1) {
      const card = rank * 4 + suitIndex;
      if (!boardOnly.has(card)) candidates.push(card);
    }
    if (boardSuitCount >= 3) {
      if (candidates[0] !== undefined && holeCards.has(candidates[0])) {
        found.add('NUT_FLUSH_BLOCKER');
      }
      if (candidates[1] !== undefined && holeCards.has(candidates[1])) {
        found.add('SECOND_NUT_FLUSH_BLOCKER');
      }
    } else if (board.street !== 'RIVER') {
      if (hole.some((card) => (card & 3) === suitIndex)) found.add('FLUSH_DRAW_BLOCKER');
      if (candidates[0] !== undefined && holeCards.has(candidates[0])) {
        found.add('NUT_FLUSH_DRAW_BLOCKER');
      }
    }
  }

  const boardMask = rankMaskOf(board.cards);
  let nutWindowTop = -1;
  let nutWindowMissing: readonly number[] = [];
  for (const window of STRAIGHT_WINDOWS) {
    const missing = window.ranks.filter((rank) => (boardMask & (1 << rank)) === 0);
    if (window.ranks.length - missing.length < 3) continue;
    if (missing.some((rank) => holeRanks.includes(rank))) found.add('STRAIGHT_BLOCKER');
    if (window.topRank > nutWindowTop) {
      nutWindowTop = window.topRank;
      nutWindowMissing = missing;
    }
  }
  if (nutWindowTop >= 0 && nutWindowMissing.some((rank) => holeRanks.includes(rank))) {
    found.add('NUT_STRAIGHT_BLOCKER');
  }

  if (holeRanks.includes(board.highCardRank)) found.add('TOP_PAIR_BLOCKER');
  for (let rank = 0; rank <= 12; rank += 1) {
    if ((board.rankCounts[rank] ?? 0) === 2 && holeRanks.includes(rank)) {
      found.add('BOARD_PAIR_BLOCKER');
    }
  }

  return HERO_BLOCKERS.filter((blocker) => found.has(blocker));
}

/**
 * Total (throws only on malformed input). Hero's two cards must be distinct from each other
 * and from the board; the board must be 3, 4 or 5 cards in dealing order.
 */
export function analyzeHeroHand(
  hole: readonly [Card, Card],
  board: readonly Card[],
  options: AnalyzeHeroHandOptions = {},
): HeroHandFeatures {
  invariant(hole.length === 2, `hero holds exactly two cards, got ${hole.length}`);
  const all = [...board, ...hole];
  invariant(new Set(all).size === all.length, 'hero cards and board cards must all be distinct');

  const boardFeatures = analyzeBoard(board);
  // Board first so `bestFiveOf`'s lexicographic tie-break attributes as few hole cards as
  // possible — `holeCardsUsed` is then the number that are genuinely necessary.
  const best = bestFiveOf(all);
  const value = best.value;
  const holeSet = new Set<number>(hole);
  const holeCardsUsed = best.cards.filter((card) => holeSet.has(card)).length as 0 | 1 | 2;

  const holeRanks: [number, number] = [hole[0] >> 2, hole[1] >> 2];
  const pocketPair = holeRanks[0] === holeRanks[1];
  const seen = new Set<number>(all);
  const categoryIndex = HAND_CATEGORY_INDEX[value.category];

  // --- made-hand classification --------------------------------------------------------
  let madeClass: MadeHandClass;
  let pairRank = -1;
  let pairedBoardRankIndex = -1;
  let twoPairKind: TwoPairKind | null = null;
  let tripsKind: TripsKind | null = null;

  switch (value.category) {
    case 'STRAIGHT_FLUSH':
      madeClass = 'STRAIGHT_FLUSH';
      break;
    case 'QUADS':
      madeClass = 'QUADS';
      break;
    case 'FULL_HOUSE':
      madeClass = 'FULL_HOUSE';
      tripsKind = classifyTrips(value.ranks[0] ?? 0, boardFeatures);
      break;
    case 'FLUSH':
      madeClass = 'FLUSH';
      break;
    case 'STRAIGHT':
      madeClass = 'STRAIGHT';
      break;
    case 'TRIPS': {
      tripsKind = classifyTrips(value.ranks[0] ?? 0, boardFeatures);
      madeClass = tripsKind === 'SET' ? 'SET' : 'TRIPS';
      break;
    }
    case 'TWO_PAIR':
      madeClass = 'TWO_PAIR';
      twoPairKind = classifyTwoPair(value.ranks, holeRanks, boardFeatures);
      break;
    case 'PAIR': {
      pairRank = value.ranks[0] ?? 0;
      const classified = classifyPair(pairRank, holeRanks, boardFeatures);
      madeClass = classified.madeClass;
      pairedBoardRankIndex = classified.pairedBoardRankIndex;
      break;
    }
    case 'HIGH_CARD':
      madeClass =
        (value.ranks[0] ?? 0) === 12 && holeRanks.includes(12) ? 'ACE_HIGH' : 'NO_MADE_HAND';
      break;
    default:
      madeClass = 'NO_MADE_HAND';
      break;
  }

  const boardRanksBeaten =
    pairRank < 0 ? 0 : boardFeatures.distinctRanksDesc.filter((rank) => rank < pairRank).length;

  // --- kicker --------------------------------------------------------------------------
  let kicker: HeroKicker | null = null;
  if (madeClass === 'TOP_PAIR' || madeClass === 'MIDDLE_PAIR' || madeClass === 'BOTTOM_PAIR') {
    const kickerRank = holeRanks[0] === pairRank ? holeRanks[1] : holeRanks[0];
    let betterKickerCount = 0;
    for (let rank = kickerRank + 1; rank <= 12; rank += 1) {
      if (rank === pairRank) continue;
      if ((boardFeatures.rankCounts[rank] ?? 0) > 0) continue;
      betterKickerCount += 1;
    }
    const kickerCard = holeRanks[0] === pairRank ? hole[1] : hole[0];
    kicker = {
      rank: kickerRank,
      kickerClass: kickerClassOf(betterKickerCount),
      betterKickerCount,
      plays: best.cards.includes(kickerCard),
    };
  }

  // --- flush ---------------------------------------------------------------------------
  let flush: HeroFlush | null = null;
  if (value.category === 'FLUSH') {
    const suitCounts = [0, 0, 0, 0];
    for (const card of all) suitCounts[card & 3] = (suitCounts[card & 3] ?? 0) + 1;
    const suitIndex = suitCounts.findIndex((count) => count >= 5);
    const suit = SUITS[suitIndex];
    invariant(suit !== undefined, 'a flush must have a suit');
    const highRank = value.ranks[0] ?? 0;
    const betterFlushCards = unseenSuitedAbove(highRank, suitIndex, seen).length;
    const holeCardsInSuit = hole.filter((card) => (card & 3) === suitIndex).length as 0 | 1 | 2;
    flush = {
      suit,
      highRank,
      betterFlushCards,
      nutClass: flushNutClassOf(betterFlushCards),
      isNut: betterFlushCards === 0,
      holeCardsInSuit,
    };
  }

  // --- straight ------------------------------------------------------------------------
  let straight: HeroStraight | null = null;
  if (value.category === 'STRAIGHT' || value.category === 'STRAIGHT_FLUSH') {
    const topRank = value.ranks[0] ?? 0;
    const bestPossibleTop = boardFeatures.straightness.bestPossibleStraightTop;
    straight = { topRank, bestPossibleTop, isNut: topRank === bestPossibleTop };
  }

  // --- draws ---------------------------------------------------------------------------
  const isRiver = boardFeatures.street === 'RIVER';
  const isFlop = boardFeatures.street === 'FLOP';
  let flushDraw: HeroFlushDraw | null = null;
  let backdoorFlushDraw: HeroBackdoorFlushDraw | null = null;
  if (!isRiver && categoryIndex < HAND_CATEGORY_INDEX.FLUSH) {
    for (let suitIndex = 0; suitIndex < 4; suitIndex += 1) {
      const total = all.filter((card) => (card & 3) === suitIndex).length;
      const holeInSuit = hole.filter((card) => (card & 3) === suitIndex).length;
      if (holeInSuit === 0) continue;
      const suit = SUITS[suitIndex];
      if (suit === undefined) continue;
      if (total === 4) {
        const highRank = Math.max(
          ...hole.filter((card) => (card & 3) === suitIndex).map((card) => card >> 2),
        );
        const betterFlushCards = unseenSuitedAbove(highRank, suitIndex, seen).length;
        flushDraw = {
          suit,
          holeCardsInSuit: holeInSuit as 1 | 2,
          highRank,
          betterFlushCards,
          nutClass: flushNutClassOf(betterFlushCards),
        };
      } else if (total === 3 && isFlop) {
        backdoorFlushDraw = { suit, holeCardsInSuit: holeInSuit as 1 | 2 };
      }
    }
  }
  if (flushDraw !== null) backdoorFlushDraw = null;

  let straightDraw: HeroStraightDraw | null = null;
  let backdoorStraightDraw = false;
  if (!isRiver && categoryIndex < HAND_CATEGORY_INDEX.STRAIGHT) {
    const knownMask = rankMaskOf(all);
    const boardMask = rankMaskOf(board);
    const outRanks = straightOutRanksOf(knownMask, boardMask);
    if (outRanks.length === 1) {
      straightDraw = { kind: 'GUTSHOT', outRanks };
    } else if (outRanks.length >= 2) {
      straightDraw = {
        kind: hasOpenEndedRun(knownMask, outRanks) ? 'OESD' : 'DOUBLE_GUTSHOT',
        outRanks,
      };
    } else if (isFlop) {
      backdoorStraightDraw = STRAIGHT_WINDOWS.some((window) => {
        let coverage = 0;
        let heroContributes = false;
        for (const rank of window.ranks) {
          if ((knownMask & (1 << rank)) === 0) continue;
          coverage += 1;
          if (holeRanks.includes(rank)) heroContributes = true;
        }
        return coverage === 3 && heroContributes;
      });
    }
  }

  const overcardCount = holeRanks.filter((rank) => rank > boardFeatures.highCardRank).length as
    0 | 1 | 2;

  const nutStrength = options.nutStrength ?? nutStrengthOnBoard(board);

  return {
    hole: [hole[0], hole[1]],
    board: [...board],
    street: boardFeatures.street,
    boardFeatures,
    value,
    bestFive: best.cards,
    holeCardsUsed,
    playsTheBoard: holeCardsUsed === 0,
    madeClass,
    pocketPair,
    pairRank,
    boardRanksBeaten,
    pairedBoardRankIndex,
    kicker,
    twoPairKind,
    tripsKind,
    flush,
    straight,
    draws: { flushDraw, straightDraw, backdoorFlushDraw, backdoorStraightDraw },
    overcardCount,
    blockers: blockersOf(hole, boardFeatures),
    nutStrength,
    isNuts: value.strength === nutStrength,
  };
}
