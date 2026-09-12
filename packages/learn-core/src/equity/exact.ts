/**
 * Exact heads-up equity: two known hands, one board, every runout walked.
 *
 * ## Why this exists next to `strategy-core`'s engine
 *
 * `@gto-self/strategy-core`'s `equityVsRange` is the general engine — hero against a
 * WEIGHTED RANGE, on any street, multiway. It is correct, and it labels every PREFLOP
 * answer `SUBSAMPLED`, also correctly: preflop the runout space is `C(50, 5) = 2,118,760`
 * and the villain range can carry up to 1326 combos, so the honest cross-product is
 * billions of trials and the engine's `maxRunoutSamples` ceiling stops it at 100,000.
 *
 * But FishTilt's calculator asks a much smaller question: HAND versus HAND, four known
 * cards. That removes the villain range entirely, and the runout space collapses to
 *
 *     preflop   C(48, 5) = 1,712,304
 *     flop      C(45, 2) =       990
 *     turn      C(44, 1) =        44
 *     river     C(43, 0) =         1
 *
 * All four are exhaustively enumerable in a fraction of a second, so this module enumerates
 * them and says `EXACT` — because it genuinely is, on every street including preflop. A
 * beginner's first equity number should not be labelled an estimate when nothing was
 * estimated (CLAUDE.md rule 5: no fake implementations, and no fake uncertainty either).
 *
 * This does NOT duplicate the engine. The evaluator is `strategy-core`'s `evaluateStrength`
 * — the one authoritative implementation of showdown rules in this repository — and the
 * runout counting reuses its `combinationCount`. What is written here is the enumeration
 * order and the tally, nothing else. The test suite pins the two implementations together:
 * on a flop and a turn `strategy-core` also reports `EXACT` for a single-combo villain
 * range, and the two must agree to floating-point tolerance.
 *
 * ## No money, so no `Money`
 *
 * Probabilities and equity shares are ratios in `0..1`, not money; CLAUDE.md rule 1 applies
 * to pots, wagers and settlements, and nothing here touches one. `poker-core` owns the only
 * code in this repository that divides a real pot, and it is untouched.
 *
 * ## Ties
 *
 * A tie is a split pot: heads-up, each player takes half. So
 *
 *     equity = winProb + tieProb / 2
 *
 * The counts are kept separate from the share on purpose — "you win 42% and chop 5%" is a
 * different sentence from "you have 44.5%", and the page shows both.
 *
 * ## The enumeration
 *
 * Villain's two cards are removed from the deck up front, so — unlike a range engine, which
 * must carry the whole deck and discard runouts that collide with the combo it is currently
 * scoring — every runout this loop generates is live. `runouts` is therefore both the number
 * walked and the size of the space, and `wins + ties + losses === runouts` always.
 *
 * The loop is an odometer over ascending deck indices (the same subset order as
 * colexicographic unranking, generated incrementally rather than unranked, since the walk is
 * exhaustive and never needs to jump). It allocates nothing: two 7-card scratch arrays hold
 * the board, the runout and the hole cards, and only the runout slots are rewritten per
 * iteration. `evaluateStrength` handles all 7 cards in one pass, so no 5-card subset is ever
 * enumerated.
 *
 * ## Basis points
 *
 * `winProb`/`tieProb`/`loseProb` are floats — fine for a chart, but a UI that prints three
 * numbers side by side ("42% / 5% / 53%") needs them to sum to a round 100%, and floats
 * generally do not: `wins / runouts` rounded to a display precision independently of
 * `ties / runouts` and `losses / runouts` can land on 42.31 / 4.98 / 52.72, which prints as
 * 100.01. `heroWinBps` / `tieBps` / `villainWinBps` exist so that never happens: they are
 * integers in `0..10000` that always sum to EXACTLY `10000`, derived from the exact integer
 * counts (`wins`/`ties`/`losses`), never from the floats above.
 *
 * The rounding rule is `strategy-core`'s own `apportion` (`bps.ts`) — reused rather than
 * reimplemented, since it is already the one largest-remainder (Hamilton) apportioner this
 * repository trusts for exactly this shape of problem ("N non-negative integers, share a
 * fixed integer total proportionally, the shares must sum to the total"). It floors each
 * count's exact share (`floor(count * 10000 / runouts)`), then hands the leftover units —
 * at most 2 of them, one per category beyond the first — to the categories with the largest
 * remainder, ties broken by lower index (`wins`, then `ties`, then `losses`). Two properties
 * fall out of that construction rather than needing a separate proof: the three integers
 * always sum to exactly 10000, and each is within 1 of its exact rational value (it is that
 * value's floor or ceiling, never anything else). No float is compared anywhere in the
 * tie-break — `apportion`'s remainders share the common denominator `runouts`, so comparing
 * them as integers is exact, and nothing here is randomized.
 */

import { ALL_CARDS, invariant, type Card, type Result, err, isCard, ok } from '@gto-self/shared';
import { apportion, BPS_TOTAL, combinationCount, evaluateStrength } from '@gto-self/strategy-core';

/** Every way the three inputs can fail to describe a real heads-up showdown. */
export const EXACT_EQUITY_ERRORS = [
  'HERO_NOT_TWO_CARDS',
  'VILLAIN_NOT_TWO_CARDS',
  'INVALID_BOARD_LENGTH',
  'NOT_A_CARD',
  'DUPLICATE_CARD',
] as const;

export type ExactEquityError = (typeof EXACT_EQUITY_ERRORS)[number];

/** A board is a legal poker board at these lengths only: preflop, flop, turn, river. */
const LEGAL_BOARD_LENGTHS: readonly number[] = [0, 3, 4, 5];

const FULL_BOARD = 5;

export interface ExactEquity {
  readonly heroCards: readonly [Card, Card];
  readonly villainCards: readonly [Card, Card];
  readonly board: readonly Card[];
  /** Runouts on which hero holds the strictly better five-card hand. */
  readonly wins: number;
  /** Runouts on which the two hands are exactly equal — a split pot. */
  readonly ties: number;
  /** Runouts on which villain holds the strictly better five-card hand. */
  readonly losses: number;
  /** Runouts enumerated. Always `C(unseenCards, 5 - board.length)`, and always exhaustive. */
  readonly runouts: number;
  /** Cards neither player nor the board holds: `52 - 4 - board.length`. */
  readonly unseenCards: number;
  /** `wins / runouts`. */
  readonly winProb: number;
  /** `ties / runouts`. */
  readonly tieProb: number;
  /** `losses / runouts`. */
  readonly loseProb: number;
  /** Hero's expected share of the pot, ties split evenly: `winProb + tieProb / 2`. */
  readonly equity: number;
  /**
   * `wins` as integer basis points of `runouts` (10000 = 100%). Derived from the counts, not
   * from `winProb`. See the file header's "Basis points" section for the rounding rule.
   */
  readonly heroWinBps: number;
  /** `ties` as integer basis points of `runouts`. See `heroWinBps`. */
  readonly tieBps: number;
  /** `losses` as integer basis points of `runouts`. See `heroWinBps`. */
  readonly villainWinBps: number;
  /**
   * Always `'EXACT'`. The field exists so a UI never has to infer exactness from the
   * function it happened to call, and so this result can be rendered by the same component
   * that renders `strategy-core`'s `EquityResult`, whose `EquityMethod` vocabulary this
   * literal deliberately matches.
   */
  readonly method: 'EXACT';
}

/** Two distinct real cards, or the reason they are not. */
function validatePair(
  cards: readonly Card[],
  wrongCount: ExactEquityError,
): Result<readonly [Card, Card], ExactEquityError> {
  if (cards.length !== 2) return err(wrongCount);
  const [a, b] = cards;
  if (a === undefined || b === undefined || !isCard(a) || !isCard(b)) return err('NOT_A_CARD');
  if (a === b) return err('DUPLICATE_CARD');
  return ok([a, b]);
}

/**
 * Hero's exact equity against ONE known villain hand on `board`, or a typed reason the
 * inputs do not describe a showdown.
 *
 * `board` may be empty (preflop), 3 (flop), 4 (turn) or 5 (river) cards. No card may repeat
 * anywhere across hero, villain and the board — a duplicate is not a near-miss to be
 * tolerated, it is a deck that does not exist.
 *
 * The river case enumerates the single empty runout, so it returns a deterministic
 * `1 / 0 / 0`, `0 / 1 / 0` or `0 / 0 / 1`: on a complete board there is nothing left to be
 * probabilistic about.
 */
export function exactHeadsUpEquity(
  heroCards: readonly Card[],
  villainCards: readonly Card[],
  board: readonly Card[],
): Result<ExactEquity, ExactEquityError> {
  const heroCheck = validatePair(heroCards, 'HERO_NOT_TWO_CARDS');
  if (!heroCheck.ok) return heroCheck;
  const villainCheck = validatePair(villainCards, 'VILLAIN_NOT_TWO_CARDS');
  if (!villainCheck.ok) return villainCheck;

  if (!LEGAL_BOARD_LENGTHS.includes(board.length)) return err('INVALID_BOARD_LENGTH');
  for (const card of board) {
    if (!isCard(card)) return err('NOT_A_CARD');
  }

  const hero = heroCheck.value;
  const villain = villainCheck.value;
  const dead: readonly Card[] = [...board, hero[0], hero[1], villain[0], villain[1]];
  const deadSet = new Set<Card>(dead);
  if (deadSet.size !== dead.length) return err('DUPLICATE_CARD');

  const deck = ALL_CARDS.filter((card) => !deadSet.has(card));
  const deckSize = deck.length;
  const needed = FULL_BOARD - board.length;
  const runoutSpaceSize = combinationCount(deckSize, needed);

  // --- scratch state, allocated once ---------------------------------------------------
  // Slots 0..4 are the five community cards (the known board, then the runout); slots 5 and
  // 6 are the hole cards, which never change. Only `base..base+needed-1` is rewritten.
  const base = board.length;
  const heroHand: Card[] = new Array<Card>(7).fill(0 as Card);
  const villainHand: Card[] = new Array<Card>(7).fill(0 as Card);
  for (let i = 0; i < base; i += 1) {
    const card = board[i] ?? (0 as Card);
    heroHand[i] = card;
    villainHand[i] = card;
  }
  heroHand[5] = hero[0];
  heroHand[6] = hero[1];
  villainHand[5] = villain[0];
  villainHand[6] = villain[1];

  // The odometer: `slot[0] < slot[1] < ... < slot[needed-1]`, all in `0..deckSize-1`.
  // Length is clamped to 1 so the river case (`needed === 0`) still has a backing array;
  // no loop ever reads it there.
  const slot = new Int32Array(Math.max(needed, 1));
  for (let i = 0; i < needed; i += 1) slot[i] = i;

  let wins = 0;
  let ties = 0;
  let losses = 0;
  let runouts = 0;

  for (;;) {
    for (let i = 0; i < needed; i += 1) {
      const card = deck[slot[i] ?? 0] ?? (0 as Card);
      heroHand[base + i] = card;
      villainHand[base + i] = card;
    }

    const heroStrength = evaluateStrength(heroHand);
    const villainStrength = evaluateStrength(villainHand);
    if (heroStrength > villainStrength) wins += 1;
    else if (heroStrength < villainStrength) losses += 1;
    else ties += 1;
    runouts += 1;

    // Advance the odometer: find the rightmost slot not already at its ceiling, bump it,
    // and reset everything to its right to the smallest legal ascending values. When no
    // slot can move (including `needed === 0`, where there is no slot at all) the walk is
    // complete and the single runout just scored was the last one.
    let i = needed - 1;
    while (i >= 0 && (slot[i] ?? 0) === deckSize - needed + i) i -= 1;
    if (i < 0) break;
    slot[i] = (slot[i] ?? 0) + 1;
    for (let j = i + 1; j < needed; j += 1) slot[j] = (slot[j - 1] ?? 0) + 1;
  }

  // The enumeration is exhaustive by construction; if it ever were not, every probability
  // below would be quietly wrong while still summing to 1, so it is checked rather than
  // assumed. This is not a `Result` case — it can only fire on a broken odometer.
  if (runouts !== runoutSpaceSize) {
    throw new Error(
      `exact equity walked ${runouts} runouts but C(${deckSize}, ${needed}) is ${runoutSpaceSize}`,
    );
  }

  const winProb = wins / runouts;
  const tieProb = ties / runouts;
  const loseProb = losses / runouts;

  // `apportion` can only refuse a positive total across an all-zero input or a bad total; the
  // total here is the fixed literal `BPS_TOTAL` and `wins + ties + losses === runouts >= 1`
  // was just checked above, so at least one input is positive. This cannot fail.
  const apportioned = apportion([wins, ties, losses], BPS_TOTAL);
  invariant(apportioned.ok, 'apportioning exact equity counts into basis points cannot fail');
  const [heroWinBps, tieBps, villainWinBps] = apportioned.value;
  invariant(
    heroWinBps !== undefined && tieBps !== undefined && villainWinBps !== undefined,
    'apportion of three inputs must return three outputs',
  );

  return ok({
    heroCards: hero,
    villainCards: villain,
    board: [...board],
    wins,
    ties,
    losses,
    runouts,
    unseenCards: deckSize,
    winProb,
    tieProb,
    loseProb,
    equity: winProb + tieProb / 2,
    heroWinBps,
    tieBps,
    villainWinBps,
    method: 'EXACT',
  });
}
