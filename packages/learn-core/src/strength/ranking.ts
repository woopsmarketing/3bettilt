/**
 * The ranking API the Starting Hand Explorer's "상위 X%" slider reads.
 *
 * Three questions, and nothing else:
 *
 *   1. how strong is this class, and where does it sit?   `handStrengthOf` / `...At` / `...ForKey`
 *   2. are these two classes actually equal?              `handStrengthTied`
 *   3. which hands are the top X% of the deal?            `topHandsByShare`
 *
 * The numbers themselves are frozen in `dataset.generated.ts` and are never computed here.
 * What this module adds is the arithmetic that follows from them — cumulative combo counts,
 * lookups, and the cut.
 *
 * ## The dataset is exact, so there is no error bar to carry
 *
 * An earlier version of this ranking was sampled, and it carried tie bands: pairs of classes
 * whose measured equities sat inside the sampling error, which the dataset refused to order.
 * The shipped dataset enumerates every board against every opponent hand, so that machinery
 * is gone. Two classes are equal only when their equities are BIT-IDENTICAL, and otherwise
 * one really is stronger than the other. `handStrengthTied` is now exact equality, and the
 * cut below is simply the first N classes by rank.
 *
 * ## "Top X%" is a share of the DEAL, not of the labels
 *
 * There are 169 labels but 1326 hands, and they are not evenly sized: `AA` is one label and
 * 6 combos, `AKo` is one label and 12. The classes at the top of this ranking are mostly
 * pairs and suited hands — the SMALL ones — so cutting the ranked list at
 * `0.15 * 169 = 25` labels hands back only about 12.5% of the hands actually dealt while
 * calling itself 15%. The cut is therefore taken over CUMULATIVE COMBOS: `cumulativeShare`
 * is `cumulativeCombos / 1326`, and a request for 15% is answered against that.
 * `POKER_EDUCATIONAL_DATA_AUDIT.md` §4 item 5.
 *
 * The selection is the smallest prefix of the ranking whose share of the 1326 combos is AT
 * LEAST the requested share, so it can overshoot by up to one class — a class is atomic and
 * `AKo` is 0.9% of the deal on its own. `actualShare` reports what the caller actually got,
 * and a UI showing "상위 15%" must show that number rather than the request, otherwise the
 * label lies. `>=` rather than `<=` was chosen so the answer to "top 15%" always CONTAINS
 * 15% of hands and never comes back empty for a small positive request; both rules nest, so
 * dragging the slider only ever adds hands.
 */

import { err, invariant, ok, type Result } from '@gto-self/shared';
import {
  COMBO_COUNT,
  handClassAt,
  handClassByKey,
  HAND_CLASS_COUNT,
  type HandClass,
  type HandClassIndex,
} from '@gto-self/strategy-core';
import { HAND_STRENGTH_SOURCE } from './dataset.generated.js';
import type { HandStrengthDataset, HandStrengthEntry, HandStrengthError } from './model.js';

const { rows: MEASURED_ROWS, ...METADATA } = HAND_STRENGTH_SOURCE;

/**
 * The generated rows expanded into entries, in rank order.
 *
 * Everything the generated file does NOT carry is rebuilt here from `strategy-core`: the
 * matrix index, the 6/4/12 combo count, and the cumulative combo totals that "top X%" cuts
 * on. The expansion doubles as a load-time audit — an unknown key, a repeat, a missing
 * class or a combo total that does not land on 1326 throws at IMPORT rather than producing
 * a ranking with a hole in it. A corrupt dataset must fail loudly (CLAUDE.md rule 5).
 */
const ENTRIES: readonly HandStrengthEntry[] = (() => {
  invariant(
    MEASURED_ROWS.length === HAND_CLASS_COUNT,
    `strength dataset has ${MEASURED_ROWS.length} rows, expected ${HAND_CLASS_COUNT}`,
  );
  const seen = new Set<string>();
  let cumulativeCombos = 0;
  const entries = MEASURED_ROWS.map(([key, equity], index) => {
    const handClass = handClassByKey(key);
    invariant(handClass !== undefined, `strength dataset names an unknown hand class: ${key}`);
    invariant(!seen.has(key), `strength dataset repeats hand class ${key}`);
    seen.add(key);
    cumulativeCombos += handClass.comboCount;
    return {
      key,
      classIndex: handClass.index,
      equity,
      rank: index + 1,
      comboCount: handClass.comboCount,
      cumulativeCombos,
      cumulativeShare: cumulativeCombos / COMBO_COUNT,
    };
  });
  invariant(
    cumulativeCombos === COMBO_COUNT,
    `strength dataset covers ${cumulativeCombos} combos, not ${COMBO_COUNT}`,
  );
  return entries;
})();

/**
 * The frozen dataset, with the rows expanded. Exposed so a caller can read `method`,
 * `trialCount`, `generatedAt` and the symmetry record and put them on screen — this one is
 * `EXACT`, so it is shown plainly, with no 추정 label and no sample count
 * (`POKER_EDUCATIONAL_DATA_AUDIT.md` §3).
 */
export const HAND_STRENGTH: HandStrengthDataset = { ...METADATA, entries: ENTRIES };

/** The 169 entries, strongest first. `HAND_STRENGTH_BY_RANK[0]` is rank 1. */
export const HAND_STRENGTH_BY_RANK: readonly HandStrengthEntry[] = ENTRIES;

/**
 * `BY_CLASS_INDEX[matrixIndex]` — the entry for a 13x13 cell, so a grid page can index this
 * with the same `row * 13 + col` it uses to lay itself out.
 */
const BY_CLASS_INDEX: readonly HandStrengthEntry[] = (() => {
  const slots = new Array<HandStrengthEntry | undefined>(HAND_CLASS_COUNT).fill(undefined);
  for (const entry of ENTRIES) slots[entry.classIndex] = entry;
  return slots.map((entry, index) => {
    invariant(entry !== undefined, `strength dataset is missing hand class index ${index}`);
    return entry;
  });
})();

/** Total. The strength entry for a class you already hold. */
export function handStrengthOf(handClass: HandClass): HandStrengthEntry {
  const entry = BY_CLASS_INDEX[handClass.index];
  invariant(entry !== undefined, `hand class index out of range: ${handClass.index}`);
  return entry;
}

/** Total. The strength entry at a 13x13 matrix index in `0..168`. */
export function handStrengthAt(index: HandClassIndex): HandStrengthEntry {
  return handStrengthOf(handClassAt(index));
}

/**
 * Result. The strength entry for an `'AKs'`-style key — the shape a route parameter takes.
 * An unknown key is refused rather than guessed at, exactly as `handClassFactsForKey` does.
 */
export function handStrengthForKey(key: string): Result<HandStrengthEntry, HandStrengthError> {
  const handClass = handClassByKey(key);
  if (handClass === undefined) return err('UNKNOWN_HAND_CLASS');
  return ok(handStrengthOf(handClass));
}

/**
 * Total. Are these two classes exactly equal in this metric?
 *
 * Exact equality, because the dataset is an exact enumeration: there is no measurement noise
 * for a tolerance to absorb, and a difference of one part in 10^15 is a real difference in
 * the mean over 2.1 billion showdowns, not a rounding artefact. `HAND_STRENGTH.exactTies`
 * lists every adjacent pair for which this returns `true`.
 */
export function handStrengthTied(a: HandStrengthEntry, b: HandStrengthEntry): boolean {
  return a.equity === b.equity;
}

/** What a "top X%" cut returned. */
export interface TopHandSelection {
  /** The share that was asked for, `0..1`. Echoed so a caller can show request vs result. */
  readonly requestedShare: number;
  /** The selected classes, rank order, strongest first. */
  readonly entries: readonly HandStrengthEntry[];
  /** How many of the 169 labels that is. NOT the number to show next to "상위 X%". */
  readonly classCount: number;
  /** How many of the 1326 dealt hands that is. */
  readonly comboCount: number;
  /** `comboCount / 1326` — always `>= requestedShare`. This is the number to display. */
  readonly actualShare: number;
  /** The weakest class included, or `undefined` for an empty selection. */
  readonly weakestIncluded: HandStrengthEntry | undefined;
}

const EMPTY_SELECTION_ENTRIES: readonly HandStrengthEntry[] = [];

/**
 * Result. The strongest hands making up at least `share` of the 1326-combo universe.
 * `share` is a fraction in `0..1` — `0.15`, not `15`.
 *
 * `0` returns the empty selection (a slider at zero selects nothing, which is a real answer,
 * not an error); `1` returns all 169. Anything outside `0..1`, or a non-finite number, is
 * refused rather than clamped: a slider that sends `1.5` is broken, and quietly answering
 * "all of them" would hide that.
 *
 * The loop after the cut is a guard against splitting an EXACT TIE. Two classes with
 * bit-identical equity have equal claim to be included, so taking one and not the other
 * would invent an order the data does not contain. The shipped dataset has no exact ties —
 * `HAND_STRENGTH.exactTies` is empty and a test asserts it — so the guard does nothing
 * today; it exists because a regeneration could produce one, and the cut must not be the
 * place that quietly resolves it.
 */
export function topHandsByShare(share: number): Result<TopHandSelection, HandStrengthError> {
  if (!Number.isFinite(share) || share < 0 || share > 1) return err('SHARE_OUT_OF_RANGE');

  let taken = 0;
  while (taken < ENTRIES.length && (ENTRIES[taken - 1]?.cumulativeShare ?? 0) < share) taken += 1;
  while (
    taken > 0 &&
    taken < ENTRIES.length &&
    ENTRIES[taken]?.equity === ENTRIES[taken - 1]?.equity
  ) {
    taken += 1;
  }

  const selected = taken === 0 ? EMPTY_SELECTION_ENTRIES : ENTRIES.slice(0, taken);
  const comboCount = selected[selected.length - 1]?.cumulativeCombos ?? 0;
  return ok({
    requestedShare: share,
    entries: selected,
    classCount: selected.length,
    comboCount,
    actualShare: comboCount / COMBO_COUNT,
    weakestIncluded: selected[selected.length - 1],
  });
}
