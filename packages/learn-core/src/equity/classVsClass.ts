/**
 * Exact, combo-weighted heads-up equity between two of the 169 starting-hand CLASSES —
 * "QQ vs AK", not "this one physical QQ vs this one physical AK".
 *
 * ## Why this exists (`docs/FISHTILT_STATE.md` ruling 14)
 *
 * `exact.ts`'s `exactHeadsUpEquity` answers a narrower question: four known cards, one exact
 * equity. FishTilt's content plan originally proposed dodging class-vs-class questions ("QQ와
 * AK 중 뭐가 강할까?") by fixing four concrete cards and saying so in the sentence
 * (`docs/FISHTILT_CONTENT_PLAN.md` §2.2 row 5, §4). The orchestrator reopened that: the
 * computation is cheap enough to do for real. A CLASS is not one hand, it is a set of combos
 * (QQ is 6, AK is 4 suited + 12 offsuit), and every LEGAL pairing of one class's combo against
 * the other's is equally likely — nobody is more likely to be dealt `Q♠Q♥` than `Q♦Q♣`. So
 * class-vs-class equity is the equal-weighted mean of `exactHeadsUpEquity` over every legal
 * combo pairing, and this module computes exactly that. It does not write a second equity
 * engine: every pairing's win/tie/loss counts come from `exactHeadsUpEquity` unchanged, summed.
 *
 * ## Why summing counts is "equal weight per pairing", not an accident
 *
 * For a FIXED board length, `exactHeadsUpEquity`'s runout count depends only on
 * `52 - 4 - board.length` (hero and villain always remove exactly two cards each) — never on
 * which four concrete cards were dealt. So every legal pairing at a given board contributes
 * the SAME number of runouts, and summing raw `wins`/`ties`/`losses` across pairings gives each
 * pairing identical weight in the total, with no explicit averaging step needed. This is
 * checked, not assumed: the loop below asserts every pairing reports the same `runouts`.
 *
 * ## Blocker-awareness
 *
 * A pairing is skipped, not zero-filled, when the two classes' combos cannot both be dealt —
 * `AA` vs `AKs` sometimes shares an ace. `exactHeadsUpEquity` already refuses a hero/villain
 * pair (or a hero/villain/board triple) that shares a card, via `DUPLICATE_CARD`; this module
 * treats that refusal as "this pairing cannot happen" and moves on, rather than reimplementing
 * card-conflict detection. `pairingCount` is what actually got scored; `skippedPairings` is
 * `combosA.length * combosB.length - pairingCount`, so a caller can see the shape.
 *
 * ## `board` exists for testability, not because content needs it
 *
 * The one content need (blog #5, QQ vs AK) is preflop — `board: []`. A non-empty board is
 * exposed anyway because it lets a fast unit test exercise the real blocker-counting logic
 * cheaply: a 5-card (river) board collapses `exactHeadsUpEquity` to exactly one runout per
 * pairing, so a matchup that would cost tens of seconds preflop costs a handful of
 * `evaluateStrength` calls at the river, with IDENTICAL pairing/skip logic (see
 * `classVsClass.test.ts`). Nothing about the per-pairing weighting argument above depends on
 * board length.
 *
 * ## Same surface as `ExactEquity`
 *
 * Integer counts, `method: 'EXACT'`, and `classAWinBps`/`tieBps`/`classBWinBps` that always
 * sum to exactly 10000 via `strategy-core`'s `apportion` — the same rounding rule `exact.ts`
 * reuses rather than reimplements. See that file's "Basis points" section for the derivation.
 *
 * ## Cost — why this is NOT called live from a page
 *
 * Preflop, one pairing enumerates `C(48,5) = 1,712,304` runouts (two `evaluateStrength` calls
 * each). Measured on this machine: ~85-200ms per pairing (`docs/reports/WP_G3_DOMAIN_FACTS.md`
 * §7). QQ vs AK is 6x4 + 6x12 = 96 pairings across the suited and offsuit halves, so tens of
 * seconds — far too slow for a page render. `scripts/generate-class-vs-class-equity.ts`
 * freezes the specific matchups content cites into `classVsClassDataset.generated.ts`, exactly
 * as `scripts/generate-hand-strength.ts` freezes the strength dataset. This module is the
 * shared engine both the generator and the tests call; nothing calls it from request path.
 */
import { err, invariant, ok, sortCardsDesc, type Card, type Result } from '@gto-self/shared';
import {
  ALL_COMBOS,
  apportion,
  BPS_TOTAL,
  comboCards,
  HAND_CLASS_COUNT,
  handClassIndexOfCombo,
  type ComboIndex,
  type HandClass,
} from '@gto-self/strategy-core';
import { exactHeadsUpEquity } from './exact.js';

/** A board is legal at these lengths only — the same set `exactHeadsUpEquity` accepts. */
const LEGAL_BOARD_LENGTHS: readonly number[] = [0, 3, 4, 5];

export const CLASS_VS_CLASS_EQUITY_ERRORS = ['INVALID_BOARD_LENGTH', 'NO_LEGAL_PAIRINGS'] as const;

export type ClassVsClassEquityError = (typeof CLASS_VS_CLASS_EQUITY_ERRORS)[number];

export interface ClassVsClassEquity {
  /** `'QQ'`, `'AKs'`, `'AKo'` — `strategy-core`'s Latin class key (ADR-0053). */
  readonly classAKey: string;
  readonly classBKey: string;
  readonly board: readonly Card[];
  /** Combo pairings actually scored — the two classes' cards were distinct in every one. */
  readonly pairingCount: number;
  /** `combosOf(classA).length * combosOf(classB).length` — before blocker skips. */
  readonly totalPairingsConsidered: number;
  /** `totalPairingsConsidered - pairingCount`. */
  readonly skippedPairings: number;
  /** Runouts per legal pairing. Identical for every pairing at this board length; see header. */
  readonly runoutsPerPairing: number;
  /** `pairingCount * runoutsPerPairing` — every runout of every legal pairing, summed. */
  readonly runouts: number;
  /** Runouts on which class A's combo holds the strictly better hand, summed over pairings. */
  readonly wins: number;
  /** Runouts on which the two hands are exactly equal (a split pot), summed over pairings. */
  readonly ties: number;
  /** Runouts on which class B's combo holds the strictly better hand, summed over pairings. */
  readonly losses: number;
  readonly winProb: number;
  readonly tieProb: number;
  readonly loseProb: number;
  /** Class A's expected share of the pot, ties split evenly: `winProb + tieProb / 2`. */
  readonly equity: number;
  /** `wins` as integer basis points of `runouts`. See `exact.ts`'s "Basis points" section. */
  readonly classAWinBps: number;
  readonly tieBps: number;
  readonly classBWinBps: number;
  /** Always `'EXACT'` — every pairing that was scored was scored exhaustively. */
  readonly method: 'EXACT';
}

/**
 * Every combo, bucketed by its class's matrix index. Built once in a single ascending pass
 * over the 1326 combos, the same style `handClass/facts.ts`'s `EXAMPLE_COMBO` uses, except
 * every combo of the class is kept here rather than just the lowest.
 */
const COMBOS_BY_CLASS: readonly (readonly ComboIndex[])[] = (() => {
  const buckets: ComboIndex[][] = Array.from({ length: HAND_CLASS_COUNT }, () => []);
  for (const combo of ALL_COMBOS) {
    buckets[handClassIndexOfCombo(combo)]?.push(combo);
  }
  return buckets;
})();

/** Total. Every combo belonging to `handClass`, in ascending `ComboIndex` order. */
export function combosOf(handClass: HandClass): readonly ComboIndex[] {
  const combos = COMBOS_BY_CLASS[handClass.index];
  invariant(combos !== undefined, `hand class index out of range: ${handClass.index}`);
  return combos;
}

/**
 * Result. Class A's exact, combo-weighted equity against class B on `board` (default empty —
 * preflop). See the file header for the method, the weighting argument, and why this is not
 * called from a page render for a real matchup.
 */
export function classVsClassEquity(
  classA: HandClass,
  classB: HandClass,
  board: readonly Card[] = [],
): Result<ClassVsClassEquity, ClassVsClassEquityError> {
  if (!LEGAL_BOARD_LENGTHS.includes(board.length)) return err('INVALID_BOARD_LENGTH');

  const combosA = combosOf(classA);
  const combosB = combosOf(classB);
  const totalPairingsConsidered = combosA.length * combosB.length;

  let wins = 0;
  let ties = 0;
  let losses = 0;
  let runouts = 0;
  let pairingCount = 0;
  let runoutsPerPairing: number | undefined;

  for (const comboA of combosA) {
    const heroCards = sortCardsDesc(comboCards(comboA)) as [Card, Card];
    for (const comboB of combosB) {
      const villainCards = sortCardsDesc(comboCards(comboB)) as [Card, Card];
      const result = exactHeadsUpEquity(heroCards, villainCards, board);
      // A refusal here is always a card conflict (hero/villain/board share a physical card):
      // this pairing cannot be dealt, so it is skipped rather than scored as a loss or a tie.
      if (!result.ok) continue;

      pairingCount += 1;
      wins += result.value.wins;
      ties += result.value.ties;
      losses += result.value.losses;
      runouts += result.value.runouts;

      if (runoutsPerPairing === undefined) {
        runoutsPerPairing = result.value.runouts;
      } else {
        invariant(
          result.value.runouts === runoutsPerPairing,
          'every legal pairing at a fixed board length must enumerate the same runout count',
        );
      }
    }
  }

  if (pairingCount === 0) return err('NO_LEGAL_PAIRINGS');

  const winProb = wins / runouts;
  const tieProb = ties / runouts;
  const loseProb = losses / runouts;

  // `apportion` can only refuse a positive total across an all-zero input or a bad total; the
  // total here is the fixed literal `BPS_TOTAL` and `pairingCount >= 1` guarantees
  // `wins + ties + losses === runouts >= 1`, so at least one input is positive.
  const apportioned = apportion([wins, ties, losses], BPS_TOTAL);
  invariant(apportioned.ok, 'apportioning class-vs-class counts into basis points cannot fail');
  const [classAWinBps, tieBps, classBWinBps] = apportioned.value;
  invariant(
    classAWinBps !== undefined && tieBps !== undefined && classBWinBps !== undefined,
    'apportion of three inputs must return three outputs',
  );

  return ok({
    classAKey: classA.key,
    classBKey: classB.key,
    board: [...board],
    pairingCount,
    totalPairingsConsidered,
    skippedPairings: totalPairingsConsidered - pairingCount,
    runoutsPerPairing: runoutsPerPairing ?? 0,
    runouts,
    wins,
    ties,
    losses,
    winProb,
    tieProb,
    loseProb,
    equity: winProb + tieProb / 2,
    classAWinBps,
    tieBps,
    classBWinBps,
    method: 'EXACT',
  });
}
