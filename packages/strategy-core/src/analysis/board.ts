/**
 * Board texture, as machine-readable features. Neutral: no strategy, no frequencies, no
 * sizings — this module classifies a board and stops. Consumers branch on typed fields and
 * numbers; nothing here is meant to be parsed out of a string.
 *
 * Every criterion below is mechanical and documented. The one judgement call —
 * STATIC / SEMI_DYNAMIC / DYNAMIC — is carried as `Provenanced<BoardTendency>` with
 * provenance `HEURISTIC` and a mandatory note, because it is a rule of thumb this project
 * authored and must never be presented as solved output (CLAUDE.md rule 2).
 *
 * ## Rank bands
 *
 *     LOW  = '2'..'6'   (rank index 0..4)
 *     MID  = '7'..'9'   (rank index 5..7)
 *     HIGH = 'T'..'A'   (rank index 8..12)
 *
 * `composition` counts CARDS, not distinct ranks, so a paired board contributes twice.
 * `broadwayCount` likewise counts cards with rank >= 'T'.
 *
 * ## Straight windows
 *
 * There are exactly ten five-rank windows that can be a straight: the wheel `A2345`
 * (index 0, top rank '5') through `TJQKA` (index 9, top rank 'A'). `windowCoverage[i]` is
 * how many of window `i`'s five ranks the board shows. Coverage 3 means a two-card holding
 * completes that straight, coverage 4 means a single card does, coverage 5 is a straight on
 * the board. Everything about "connectivity" here is derived from those ten numbers, so the
 * measure never depends on an eyeballed notion of "connected".
 *
 * ## Suits
 *
 * `flopPattern` is always computed from the FIRST THREE cards, on every street, because the
 * flop's monotone / two-tone / rainbow shape stays a fact about the hand after the turn
 * arrives. Later-street suit facts are the counts: `flushPossible` (>= 3 of a suit — a
 * two-card holding has a flush), `fourFlush` (exactly 4), `flushOnBoard` (>= 5).
 *
 * Boards are ordered: index 0-2 are the flop, 3 the turn, 4 the river.
 */
import { SUITS, invariant, type Card, type Suit } from '@gto-self/shared';
import { heuristic, type Provenanced } from '../provenance.js';
import { rankMaskOf, straightTopOfRankMask } from './evaluate.js';

export type BoardStreet = 'FLOP' | 'TURN' | 'RIVER';

export type RankBand = 'LOW' | 'MID' | 'HIGH';

/** Rank index of the lowest broadway card, `'T'`. */
export const BROADWAY_RANK = 8;

/** Total. `LOW` for 2-6, `MID` for 7-9, `HIGH` for T-A. */
export function rankBandOf(rank: number): RankBand {
  if (rank >= BROADWAY_RANK) return 'HIGH';
  if (rank >= 5) return 'MID';
  return 'LOW';
}

export const BOARD_HIGH_CARD_CLASSES = [
  'DEUCE_HIGH',
  'THREE_HIGH',
  'FOUR_HIGH',
  'FIVE_HIGH',
  'SIX_HIGH',
  'SEVEN_HIGH',
  'EIGHT_HIGH',
  'NINE_HIGH',
  'TEN_HIGH',
  'JACK_HIGH',
  'QUEEN_HIGH',
  'KING_HIGH',
  'ACE_HIGH',
] as const;

/** Indexed by rank index, so `BOARD_HIGH_CARD_CLASSES[12] === 'ACE_HIGH'`. */
export type BoardHighCardClass = (typeof BOARD_HIGH_CARD_CLASSES)[number];

/**
 * Rank multiplicity of the board itself.
 *
 * - `UNPAIRED`    every board card is a distinct rank
 * - `PAIRED`      exactly one rank appears twice
 * - `TWO_PAIR`    two ranks appear twice (five-card boards only)
 * - `TRIPS`       one rank appears three times
 * - `FULL_HOUSE`  trips plus a pair (five-card boards only)
 * - `QUADS`       one rank appears four times
 */
export type BoardPairing = 'UNPAIRED' | 'PAIRED' | 'TWO_PAIR' | 'TRIPS' | 'FULL_HOUSE' | 'QUADS';

export type FlopSuitPattern = 'MONOTONE' | 'TWO_TONE' | 'RAINBOW';

/**
 * Derived ONLY from `straightWindowCount` (windows a two-card holding can already complete):
 * `0 -> DISCONNECTED`, `1 -> LOW_CONNECTED`, `2 -> CONNECTED`, `>= 3 -> HIGHLY_CONNECTED`.
 */
export type BoardConnectivity = 'DISCONNECTED' | 'LOW_CONNECTED' | 'CONNECTED' | 'HIGHLY_CONNECTED';

export type BoardTendency = 'STATIC' | 'SEMI_DYNAMIC' | 'DYNAMIC';

export interface BoardSuitTexture {
  /** Card counts per suit, indexed by suit index (0 = 's', 1 = 'h', 2 = 'd', 3 = 'c'). */
  readonly counts: readonly [number, number, number, number];
  readonly maxSuitCount: number;
  readonly distinctSuits: number;
  /** Always computed from the first three board cards, on every street. */
  readonly flopPattern: FlopSuitPattern;
  /** `maxSuitCount >= 3`: a two-card holding already makes a flush. */
  readonly flushPossible: boolean;
  /** `maxSuitCount === 4`: a single suited hole card already makes a flush. */
  readonly fourFlush: boolean;
  /** `maxSuitCount >= 5`: the flush is on the board. */
  readonly flushOnBoard: boolean;
  /** The suit of `maxSuitCount` when at least two cards share it, else `null`. */
  readonly dominantSuit: Suit | null;
}

export interface BoardStraightness {
  /** Ten entries; index 0 is the wheel `A2345`, index 9 is `TJQKA`. */
  readonly windowCoverage: readonly number[];
  readonly maxWindowCoverage: number;
  /** Windows at coverage >= 3 — a two-card holding completes them. */
  readonly straightWindowCount: number;
  /** Windows at coverage exactly 4 — a single card completes them. */
  readonly oneCardStraightWindowCount: number;
  /** A window at coverage 5: the straight is on the board. */
  readonly straightOnBoard: boolean;
  /** Top rank of the straight on the board, or `-1`. */
  readonly straightOnBoardTop: number;
  /** Top rank of the best straight a two-card holding can make, or `-1`. */
  readonly bestPossibleStraightTop: number;
  readonly connectivity: BoardConnectivity;
  readonly distinctRankCount: number;
  /** Highest minus lowest distinct rank index. `0` on a trips/quads board. */
  readonly rankSpan: number;
}

export interface BoardFeatures {
  readonly street: BoardStreet;
  readonly cardCount: 3 | 4 | 5;
  readonly cards: readonly Card[];
  /** Distinct rank indices, descending. */
  readonly distinctRanksDesc: readonly number[];
  /** How many board cards carry each rank index. Length 13. */
  readonly rankCounts: readonly number[];
  readonly highCardRank: number;
  readonly highCardClass: BoardHighCardClass;
  readonly lowCardRank: number;
  /** Board CARDS with rank >= 'T'. */
  readonly broadwayCount: number;
  /** Board CARDS per rank band. */
  readonly composition: Readonly<Record<RankBand, number>>;
  readonly pairing: BoardPairing;
  readonly paired: boolean;
  readonly doublePaired: boolean;
  readonly suits: BoardSuitTexture;
  readonly straightness: BoardStraightness;
  /** See `BOARD_TENDENCY_CRITERIA`. Authored rule of thumb, never solved output. */
  readonly tendency: Provenanced<BoardTendency>;
  readonly tendencyScore: number;
}

/** The ten straight windows, index 0 = wheel (`A2345`) .. index 9 = broadway (`TJQKA`). */
export const STRAIGHT_WINDOWS: readonly {
  readonly topRank: number;
  readonly ranks: readonly number[];
  readonly mask: number;
}[] = Array.from({ length: 10 }, (_, index) => {
  const topRank = index + 3;
  const ranks =
    index === 0 ? [12, 3, 2, 1, 0] : [topRank, topRank - 1, topRank - 2, topRank - 3, topRank - 4];
  let mask = 0;
  for (const rank of ranks) mask |= 1 << rank;
  return { topRank, ranks, mask };
});

export const STRAIGHT_WINDOW_COUNT = STRAIGHT_WINDOWS.length;

/**
 * The exact, mechanical STATIC / SEMI_DYNAMIC / DYNAMIC rule. Points are summed; the total
 * is `tendencyScore`.
 *
 * | component                                            | points |
 * | ---------------------------------------------------- | -----: |
 * | three or more cards of one suit (a flush is possible) |     +2 |
 * | exactly two cards of one suit                         |     +1 |
 * | connectivity DISCONNECTED / LOW / CONNECTED / HIGHLY  | 0/1/2/3 |
 * | the board carries any pair or better                  |     -1 |
 *
 * `score <= 1` -> STATIC, `2..3` -> SEMI_DYNAMIC, `>= 4` -> DYNAMIC. SEMI_DYNAMIC exists so
 * a genuinely borderline board (a monotone broadway flop, say) is not forced into one of the
 * two extremes.
 */
export const BOARD_TENDENCY_CRITERIA =
  'suit: >=3 of a suit +2, exactly 2 +1; connectivity DISCONNECTED/LOW/CONNECTED/HIGHLY = 0/1/2/3; ' +
  'any board pair -1. score <=1 STATIC, 2-3 SEMI_DYNAMIC, >=4 DYNAMIC.';

const CONNECTIVITY_POINTS: Readonly<Record<BoardConnectivity, number>> = {
  DISCONNECTED: 0,
  LOW_CONNECTED: 1,
  CONNECTED: 2,
  HIGHLY_CONNECTED: 3,
};

/** Total. `3 -> FLOP`, `4 -> TURN`, `5 -> RIVER`. Throws on any other count. */
export function boardStreetOf(cardCount: number): BoardStreet {
  if (cardCount === 3) return 'FLOP';
  if (cardCount === 4) return 'TURN';
  invariant(cardCount === 5, `a board has 3, 4 or 5 cards, got ${cardCount}`);
  return 'RIVER';
}

function pairingOf(rankCounts: readonly number[]): BoardPairing {
  let pairs = 0;
  let trips = 0;
  let quads = 0;
  for (const count of rankCounts) {
    if (count === 2) pairs += 1;
    else if (count === 3) trips += 1;
    else if (count >= 4) quads += 1;
  }
  if (quads > 0) return 'QUADS';
  if (trips > 0) return pairs > 0 ? 'FULL_HOUSE' : 'TRIPS';
  if (pairs >= 2) return 'TWO_PAIR';
  if (pairs === 1) return 'PAIRED';
  return 'UNPAIRED';
}

function connectivityOf(straightWindowCount: number): BoardConnectivity {
  if (straightWindowCount === 0) return 'DISCONNECTED';
  if (straightWindowCount === 1) return 'LOW_CONNECTED';
  if (straightWindowCount === 2) return 'CONNECTED';
  return 'HIGHLY_CONNECTED';
}

/**
 * Total (throws only on a malformed board). Every texture feature of a 3-, 4- or 5-card
 * board. Cards must be distinct and given in dealing order.
 */
export function analyzeBoard(cards: readonly Card[]): BoardFeatures {
  const street = boardStreetOf(cards.length);
  invariant(new Set(cards).size === cards.length, 'a board needs distinct cards');

  const rankCounts = new Array<number>(13).fill(0);
  const suitCounts: [number, number, number, number] = [0, 0, 0, 0];
  for (const card of cards) {
    const rank = card >> 2;
    rankCounts[rank] = (rankCounts[rank] ?? 0) + 1;
    const suit = card & 3;
    suitCounts[suit] = (suitCounts[suit] ?? 0) + 1;
  }

  const distinctRanksDesc: number[] = [];
  for (let rank = 12; rank >= 0; rank -= 1)
    if ((rankCounts[rank] ?? 0) > 0) distinctRanksDesc.push(rank);
  const highCardRank = distinctRanksDesc[0] ?? 0;
  const lowCardRank = distinctRanksDesc[distinctRanksDesc.length - 1] ?? 0;

  const composition: Record<RankBand, number> = { LOW: 0, MID: 0, HIGH: 0 };
  let broadwayCount = 0;
  for (const card of cards) {
    const rank = card >> 2;
    composition[rankBandOf(rank)] += 1;
    if (rank >= BROADWAY_RANK) broadwayCount += 1;
  }

  // --- suits ---------------------------------------------------------------------------
  let maxSuitCount = 0;
  let dominantSuitIndex = -1;
  let distinctSuits = 0;
  for (let suit = 0; suit < 4; suit += 1) {
    const count = suitCounts[suit] ?? 0;
    if (count > 0) distinctSuits += 1;
    if (count > maxSuitCount) {
      maxSuitCount = count;
      dominantSuitIndex = suit;
    }
  }
  const flopSuits = new Set(cards.slice(0, 3).map((card) => card & 3));
  const flopPattern: FlopSuitPattern =
    flopSuits.size === 1 ? 'MONOTONE' : flopSuits.size === 2 ? 'TWO_TONE' : 'RAINBOW';

  const suits: BoardSuitTexture = {
    counts: suitCounts,
    maxSuitCount,
    distinctSuits,
    flopPattern,
    flushPossible: maxSuitCount >= 3,
    fourFlush: maxSuitCount === 4,
    flushOnBoard: maxSuitCount >= 5,
    dominantSuit:
      maxSuitCount >= 2 && dominantSuitIndex >= 0 ? (SUITS[dominantSuitIndex] ?? null) : null,
  };

  // --- straightness --------------------------------------------------------------------
  const rankMask = rankMaskOf(cards);
  const windowCoverage: number[] = [];
  let maxWindowCoverage = 0;
  let straightWindowCount = 0;
  let oneCardStraightWindowCount = 0;
  let bestPossibleStraightTop = -1;
  for (const window of STRAIGHT_WINDOWS) {
    let coverage = 0;
    for (const rank of window.ranks) if ((rankMask & (1 << rank)) !== 0) coverage += 1;
    windowCoverage.push(coverage);
    if (coverage > maxWindowCoverage) maxWindowCoverage = coverage;
    if (coverage >= 3) {
      straightWindowCount += 1;
      if (window.topRank > bestPossibleStraightTop) bestPossibleStraightTop = window.topRank;
    }
    if (coverage === 4) oneCardStraightWindowCount += 1;
  }
  const straightOnBoardTop = straightTopOfRankMask(rankMask);
  const connectivity = connectivityOf(straightWindowCount);
  const straightness: BoardStraightness = {
    windowCoverage,
    maxWindowCoverage,
    straightWindowCount,
    oneCardStraightWindowCount,
    straightOnBoard: straightOnBoardTop >= 0,
    straightOnBoardTop,
    bestPossibleStraightTop,
    connectivity,
    distinctRankCount: distinctRanksDesc.length,
    rankSpan: highCardRank - lowCardRank,
  };

  const pairing = pairingOf(rankCounts);

  // --- tendency ------------------------------------------------------------------------
  const suitPoints = maxSuitCount >= 3 ? 2 : maxSuitCount === 2 ? 1 : 0;
  const pairingPoints = pairing === 'UNPAIRED' ? 0 : -1;
  const tendencyScore = suitPoints + CONNECTIVITY_POINTS[connectivity] + pairingPoints;
  const tendencyValue: BoardTendency =
    tendencyScore <= 1 ? 'STATIC' : tendencyScore <= 3 ? 'SEMI_DYNAMIC' : 'DYNAMIC';

  const highCardClass = BOARD_HIGH_CARD_CLASSES[highCardRank];
  invariant(highCardClass !== undefined, `rank index out of range: ${highCardRank}`);

  return {
    street,
    cardCount: cards.length as 3 | 4 | 5,
    cards: [...cards],
    distinctRanksDesc,
    rankCounts,
    highCardRank,
    highCardClass,
    lowCardRank,
    broadwayCount,
    composition,
    pairing,
    paired: pairing !== 'UNPAIRED',
    doublePaired: pairing === 'TWO_PAIR',
    suits,
    straightness,
    tendency: heuristic(
      tendencyValue,
      `score ${tendencyScore} from authored texture criteria (${BOARD_TENDENCY_CRITERIA})`,
    ),
    tendencyScore,
  };
}

/**
 * What one new board card changed. Computed by diffing the features of the two boards, so a
 * transition can never disagree with the features it is derived from.
 */
export interface BoardTransition {
  readonly newCard: Card;
  readonly newCardRank: number;
  readonly newCardSuit: Suit;
  readonly newCardBand: RankBand;
  readonly before: BoardFeatures;
  readonly after: BoardFeatures;
  /** The new card outranks every card that was already out. */
  readonly overcard: boolean;
  readonly topRankChanged: boolean;
  /** The new card matched a rank already on the board. */
  readonly boardPaired: boolean;
  readonly pairingChanged: boolean;
  /**
   * The third card of a suit arrived: a two-card flush draw got there and a flush is now
   * possible for the first time.
   */
  readonly flushDrawCompleted: boolean;
  /** A fourth card of a suit arrived. */
  readonly fourFlushArrived: boolean;
  /** A fifth card of a suit arrived: the flush is on the board. */
  readonly flushOnBoardArrived: boolean;
  /** How many straight windows a two-card holding can newly complete. */
  readonly straightsNowPossible: number;
  /** `straightsNowPossible > 0` — some two-card straight draw got there. */
  readonly straightDrawCompleted: boolean;
  readonly straightOnBoardArrived: boolean;
  readonly connectivityIncreased: boolean;
  readonly tendencyChanged: boolean;
}

/**
 * Total (throws only on malformed input). `after` must be `before` plus exactly one card, in
 * that order — the caller is describing a turn or a river, not an arbitrary pair of boards.
 */
export function analyzeBoardTransition(
  before: readonly Card[],
  after: readonly Card[],
): BoardTransition {
  invariant(
    after.length === before.length + 1,
    `a board transition adds exactly one card, got ${before.length} -> ${after.length}`,
  );
  for (let index = 0; index < before.length; index += 1) {
    invariant(after[index] === before[index], 'a board transition must extend the earlier board');
  }
  const newCard = after[after.length - 1];
  invariant(newCard !== undefined, 'a board transition needs a new card');

  const beforeFeatures = analyzeBoard(before);
  const afterFeatures = analyzeBoard(after);
  const newCardRank = newCard >> 2;
  const newCardSuit = SUITS[newCard & 3];
  invariant(newCardSuit !== undefined, `card index out of range: ${newCard}`);

  const beforeMax = beforeFeatures.suits.maxSuitCount;
  const afterMax = afterFeatures.suits.maxSuitCount;

  return {
    newCard,
    newCardRank,
    newCardSuit,
    newCardBand: rankBandOf(newCardRank),
    before: beforeFeatures,
    after: afterFeatures,
    overcard: newCardRank > beforeFeatures.highCardRank,
    topRankChanged: afterFeatures.highCardRank !== beforeFeatures.highCardRank,
    boardPaired: (beforeFeatures.rankCounts[newCardRank] ?? 0) > 0,
    pairingChanged: afterFeatures.pairing !== beforeFeatures.pairing,
    flushDrawCompleted: beforeMax < 3 && afterMax >= 3,
    fourFlushArrived: beforeMax < 4 && afterMax >= 4,
    flushOnBoardArrived: beforeMax < 5 && afterMax >= 5,
    straightsNowPossible:
      afterFeatures.straightness.straightWindowCount -
      beforeFeatures.straightness.straightWindowCount,
    straightDrawCompleted:
      afterFeatures.straightness.straightWindowCount >
      beforeFeatures.straightness.straightWindowCount,
    straightOnBoardArrived:
      afterFeatures.straightness.straightOnBoard && !beforeFeatures.straightness.straightOnBoard,
    connectivityIncreased:
      CONNECTIVITY_POINTS[afterFeatures.straightness.connectivity] >
      CONNECTIVITY_POINTS[beforeFeatures.straightness.connectivity],
    tendencyChanged: afterFeatures.tendency.value !== beforeFeatures.tendency.value,
  };
}
