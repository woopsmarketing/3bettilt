/**
 * How the nine 5-card hand categories are distributed across the deck — computed by real
 * enumeration of every `C(52,5) = 2,598,960` five-card hand, never copied from anywhere.
 *
 * ## Why this exists
 *
 * The exact category frequency table (`HIGH_CARD` 1,302,540 ... `STRAIGHT_FLUSH` 40) lives in
 * this repository today only as a hard-coded expectation inside `strategy-core`'s own test,
 * `packages/strategy-core/src/analysis/evaluateExhaustive.test.ts:17-27`. `strategy-core` is
 * read-only for FishTilt (CLAUDE.md rule 4/8), so an author who wants to print "flush beats a
 * hand 1 in 508 times" has no domain fact to call — and re-typing the numbers out of that test
 * file into an MDX article would be exactly the "plausible-looking invented number" CLAUDE.md
 * rule 5 forbids (`docs/FISHTILT_STATE.md` ruling 15). This module computes the same table a
 * second, independent way, from this package.
 *
 * ## Live compute, not a frozen generator — measured, not guessed
 *
 * The `strength/` dataset in this same package freezes its numbers because one class's
 * measurement is ~75 seconds and all 169 is hours of CPU. This enumeration is a different
 * shape of problem: there is exactly ONE space (`C(52,5)`, not 169 of them), it is walked
 * once, and it was measured on this machine at ~100-150ms end to end (`node --experimental` /
 * `tsx` run of the identical odometer, three consecutive runs: 97ms, 143ms, 135ms — see
 * `docs/reports/WP_G3_DOMAIN_FACTS.md` §7). That is two to three orders of magnitude under
 * "hurts a page render", so this module exports a live function and computes the frozen
 * `CATEGORY_FREQUENCIES` array once at module load — the same "compute once, read many"
 * pattern `handClass/facts.ts` uses for `EXAMPLE_COMBO`, just with a real enumeration behind
 * it instead of a single pass over 1326 combos. A generator-plus-consistency-test pair would
 * add a second file and a "did the frozen numbers survive a refactor" test for a
 * sub-150-millisecond computation; that is process for its own sake, not honesty.
 *
 * ## What "rank" means here
 *
 * `HAND_CATEGORY_INDEX` (`strategy-core`) already totally orders the nine categories by
 * strength, 0 = `HIGH_CARD` .. 8 = `STRAIGHT_FLUSH`. `rank` here is that same order restated
 * so 1 means strongest — `9 - HAND_CATEGORY_INDEX[category]` — because content asks "구
 * 족보 중 몇 번째로 강한가" and "1등"이 가장 흔한 하이카드가 아니라 가장 강한 스트레이트
 * 플러시를 가리켜야 자연스럽다. Nothing is re-derived beyond that subtraction: the ORDER
 * itself is read from `strategy-core`, never guessed.
 *
 * ## No Korean strings
 *
 * Per the settled ruling this file exists to satisfy, Korean UI copy does not live in domain
 * packages. This module exports `HandCategory` keys (`'STRAIGHT_FLUSH'`, ...) and numbers; the
 * app layer names them.
 */
import { invariant, type Card } from '@gto-self/shared';
import {
  combinationCount,
  evaluateStrength,
  HAND_CATEGORIES,
  HAND_CATEGORY_INDEX,
  type HandCategory,
} from '@gto-self/strategy-core';

/** `C(52, 5)` — every distinct five-card hand that exists, dealt or not. */
export const FIVE_CARD_HAND_COUNT = combinationCount(52, 5);

export interface CategoryFrequency {
  readonly category: HandCategory;
  /** How many of the `FIVE_CARD_HAND_COUNT` five-card hands fall in this category. */
  readonly count: number;
  /** `count / FIVE_CARD_HAND_COUNT`, in `0..1`. A ratio, never money (CLAUDE.md rule 1). */
  readonly probability: number;
  /** 1 = strongest (`STRAIGHT_FLUSH`), 9 = weakest and most common (`HIGH_CARD`). */
  readonly rank: number;
}

/**
 * Total. Enumerates every one of the `C(52,5)` five-card hands exactly once, via the same
 * ascending-index odometer `evaluateExhaustive.test.ts` uses (four nested `for` loops over
 * strictly increasing card indices, so every combination is visited exactly once and none
 * twice), and tallies which of the nine categories each one belongs to.
 *
 * Exported — not buried as a module-private step — so the frozen `CATEGORY_FREQUENCIES`
 * below, the consistency test, and anyone who doubts a number all call the identical code.
 * There is no second implementation anywhere in this file.
 */
export function computeCategoryFrequencies(): readonly CategoryFrequency[] {
  const counts = new Uint32Array(HAND_CATEGORIES.length);
  const hand: Card[] = [0, 0, 0, 0, 0] as Card[];
  let total = 0;

  for (let a = 0; a < 48; a += 1) {
    hand[0] = a as Card;
    for (let b = a + 1; b < 49; b += 1) {
      hand[1] = b as Card;
      for (let c = b + 1; c < 50; c += 1) {
        hand[2] = c as Card;
        for (let d = c + 1; d < 51; d += 1) {
          hand[3] = d as Card;
          for (let e = d + 1; e < 52; e += 1) {
            hand[4] = e as Card;
            const categoryIndex = evaluateStrength(hand) >>> 20;
            counts[categoryIndex] = (counts[categoryIndex] ?? 0) + 1;
            total += 1;
          }
        }
      }
    }
  }

  invariant(
    total === FIVE_CARD_HAND_COUNT,
    `enumerated ${total} five-card hands, expected C(52,5) = ${FIVE_CARD_HAND_COUNT}`,
  );

  return HAND_CATEGORIES.map((category, index) => {
    const count = counts[index] ?? 0;
    return {
      category,
      count,
      probability: count / FIVE_CARD_HAND_COUNT,
      rank: HAND_CATEGORIES.length - HAND_CATEGORY_INDEX[category],
    };
  }).sort((left, right) => left.rank - right.rank);
}

/**
 * Frozen at module load: every caller reads the same computed array, and the ~100-150ms cost
 * is paid once per process rather than once per request. RANK ORDER, strongest (rarest)
 * first, mirroring the convention `strength/dataset.generated.ts` uses for its 169 rows.
 */
export const CATEGORY_FREQUENCIES: readonly CategoryFrequency[] = computeCategoryFrequencies();

const BY_CATEGORY: ReadonlyMap<HandCategory, CategoryFrequency> = new Map(
  CATEGORY_FREQUENCIES.map((entry) => [entry.category, entry]),
);

/** Total. The frequency entry for one of the nine categories. */
export function categoryFrequencyOf(category: HandCategory): CategoryFrequency {
  const entry = BY_CATEGORY.get(category);
  invariant(entry !== undefined, `unknown hand category: ${category}`);
  return entry;
}
