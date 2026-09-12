/**
 * Structured facts about a starting hand — "what IS `AKs`, exactly?"
 *
 * A beginner page about one hand has to answer a handful of concrete, checkable questions
 * before it says anything at all about how to play it: which of the 169 classes the two
 * cards belong to, whether that class is a pocket pair / suited / offsuit, how many of the
 * 1326 possible starting hands it accounts for, what share of the deal that is, and what
 * the cards actually look like on screen.
 *
 * ## Data, never copy
 *
 * Nothing here returns a Korean string, or any presentation string beyond the standard
 * Latin poker key (`'AA'`, `'AKs'`, `'72o'`) that `strategy-core` already defines. FishTilt
 * is Korean-first but standard poker notation stays Latin (ADR-0053), and the app layer owns
 * every word the user reads. This module owns only the facts under those words.
 *
 * ## Nothing here is re-derived
 *
 * The 169-class model, the `6 / 4 / 12` combo counts, the 1326-combo universe and the
 * combo→class mapping all live in `@gto-self/strategy-core`'s `range/handClass.ts` and
 * `range/combo.ts`, and are READ from there. Restating "a suited hand has 4 combos" as a
 * literal in this file would create a second source of truth for a number the chart, the
 * range model and the equity engine all already agree on. `universeShare` is the one
 * arithmetic step taken here, and it divides two numbers that both came from `strategy-core`.
 *
 * ## The example combo
 *
 * Each class exposes ONE representative combo, chosen as the lowest `ComboIndex` in the
 * class. That is deterministic by construction — combo indices are a fixed bijection
 * (`high * (high - 1) / 2 + low` over card indices), so the same class yields the same
 * example on every machine, forever, with no ordering assumption about how the table was
 * built. It also happens to land on the representative a chart would print by hand, because
 * card indices order suits `s, h, d, c`: `AA` gives `A♠A♥`, `AKs` gives `A♠K♠`, `AKo` gives
 * `A♠K♥`. That last sentence is an observation about the index scheme, not a promise this
 * module enforces; what IS guaranteed, and tested, is determinism and class membership.
 *
 * `exampleCards` is the same pair sorted higher-rank-first (`sortCardsDesc`), because that is
 * how a hand is written and rendered — `comboCards` alone returns them ascending by card
 * index, which puts the KING first in `AKs`.
 */

import { ok, err, isCard, sortCardsDesc, type Card, type Result } from '@gto-self/shared';
import {
  ALL_COMBOS,
  COMBO_COUNT,
  comboCards,
  comboIndexOf,
  HAND_CLASSES,
  HAND_CLASS_COUNT,
  handClassAt,
  handClassByKey,
  handClassIndexOfCombo,
  handClassOfCombo,
  type ComboIndex,
  type HandClass,
  type HandClassIndex,
  type HandClassKind,
} from '@gto-self/strategy-core';

/** Every way a request for hand-class facts can fail. */
export const HAND_CLASS_FACTS_ERRORS = [
  'NOT_TWO_CARDS',
  'NOT_A_CARD',
  'DUPLICATE_CARD',
  'UNKNOWN_HAND_CLASS',
] as const;

export type HandClassFactsError = (typeof HAND_CLASS_FACTS_ERRORS)[number];

export interface HandClassFacts {
  /** The class definition itself, straight from `strategy-core`. */
  readonly handClass: HandClass;
  /** `handClass.key` — `'AA'`, `'AKs'`, `'72o'`. Latin notation, ADR-0053. */
  readonly key: string;
  /** `handClass.kind` — `'PAIR' | 'SUITED' | 'OFFSUIT'`. Read, not re-derived. */
  readonly kind: HandClassKind;
  /** `handClass.comboCount` — 6 for a pair, 4 suited, 12 offsuit. Read, not re-derived. */
  readonly comboCount: number;
  /** 1326, `strategy-core`'s `COMBO_COUNT`. The denominator, stated so the page can show it. */
  readonly universeCombos: number;
  /**
   * `comboCount / 1326`, in `0..1` — how often this exact class is dealt. A ratio, never
   * money (CLAUDE.md rule 1). `AA` is 6/1326 ~ 0.45%; `AKo` is 12/1326 ~ 0.90%.
   */
  readonly universeShare: number;
  /** The lowest `ComboIndex` in the class. Deterministic; see the note at the top. */
  readonly exampleCombo: ComboIndex;
  /**
   * The example combo's two cards, HIGHER RANK FIRST — the order a hand is written and the
   * order a card pair is rendered. Ties on rank (a pocket pair) fall back to suit order
   * `s, h, d, c`, so this is a total order and the pair is deterministic.
   */
  readonly exampleCards: readonly [Card, Card];
}

/**
 * The lowest combo index of each class, found in one ascending pass over the 1326 combos.
 *
 * `-1` would mean a class with no combo, which cannot happen — `13*6 + 78*4 + 78*12 = 1326`
 * covers the universe exactly — so the build below asserts every entry was filled.
 */
const EXAMPLE_COMBO: readonly ComboIndex[] = (() => {
  const found = new Int32Array(HAND_CLASS_COUNT).fill(-1);
  for (const combo of ALL_COMBOS) {
    const classIndex: HandClassIndex = handClassIndexOfCombo(combo);
    if ((found[classIndex] ?? -1) < 0) found[classIndex] = combo;
  }
  return Array.from({ length: HAND_CLASS_COUNT }, (_, index) => {
    const combo = found[index] ?? -1;
    if (combo < 0) throw new Error(`hand class ${index} has no combo, which is impossible`);
    return combo as ComboIndex;
  });
})();

function buildFacts(handClass: HandClass): HandClassFacts {
  const exampleCombo = EXAMPLE_COMBO[handClass.index];
  if (exampleCombo === undefined) {
    throw new Error(`hand class index out of range: ${handClass.index}`);
  }
  const [high, low] = sortCardsDesc(comboCards(exampleCombo));
  if (high === undefined || low === undefined) {
    throw new Error(`combo ${exampleCombo} did not yield two cards`);
  }
  return {
    handClass,
    key: handClass.key,
    kind: handClass.kind,
    comboCount: handClass.comboCount,
    universeCombos: COMBO_COUNT,
    universeShare: handClass.comboCount / COMBO_COUNT,
    exampleCombo,
    exampleCards: [high, low],
  };
}

/**
 * All 169 classes' facts, in the 13x13 matrix order `row * 13 + col` that
 * `strategy-core`'s `HAND_CLASSES` uses — so a grid page can index this array with the same
 * arithmetic it uses to lay out the chart.
 *
 * Frozen values, computed once at module load: every function below is a lookup into this
 * array, so two calls for the same class return the identical object.
 */
export const HAND_CLASS_FACTS: readonly HandClassFacts[] = HAND_CLASSES.map(buildFacts);

/** Total. The facts for a class you already hold. */
export function handClassFacts(handClass: HandClass): HandClassFacts {
  const facts = HAND_CLASS_FACTS[handClass.index];
  if (facts === undefined) throw new Error(`hand class index out of range: ${handClass.index}`);
  return facts;
}

/** Total. The facts for a matrix index in `0..168`. Throws only on a corrupt index. */
export function handClassFactsAt(index: HandClassIndex): HandClassFacts {
  return handClassFacts(handClassAt(index));
}

/**
 * Result. The facts for a `'AKs'`-style key — the shape a hand page's route parameter takes.
 * An unknown key is refused rather than guessed at: `'AKx'` is not one of the 169.
 */
export function handClassFactsForKey(key: string): Result<HandClassFacts, HandClassFactsError> {
  const handClass = handClassByKey(key);
  if (handClass === undefined) return err('UNKNOWN_HAND_CLASS');
  return ok(handClassFacts(handClass));
}

/**
 * Result. The facts for two concrete hole cards — `A♠K♠` answers with `AKs`.
 *
 * Two identical cards are refused rather than collapsed onto a pocket pair: a hand holding
 * the same physical card twice is not a hand, and silently answering `'AA'` for `A♠A♠` would
 * be exactly the kind of plausible-looking invention CLAUDE.md rule 5 forbids.
 */
export function handClassFactsOfCards(
  cards: readonly Card[],
): Result<HandClassFacts, HandClassFactsError> {
  if (cards.length !== 2) return err('NOT_TWO_CARDS');
  const [a, b] = cards;
  if (a === undefined || b === undefined || !isCard(a) || !isCard(b)) return err('NOT_A_CARD');
  if (a === b) return err('DUPLICATE_CARD');
  return ok(handClassFacts(handClassOfCombo(comboIndexOf(a, b))));
}
