/**
 * The 169 hand classes and the 13x13 matrix they are displayed in.
 *
 * MATRIX CONVENTION (the one every poker chart uses):
 *
 *   rows and columns are ranks DESCENDING — 0 = A, 1 = K, ... 12 = 2
 *   row === col   -> pocket pair      (the diagonal)          13 classes,  6 combos each
 *   row  <  col   -> suited           (above the diagonal)    78 classes,  4 combos each
 *   row  >  col   -> offsuit          (below the diagonal)    78 classes, 12 combos each
 *
 *   matrix index = row * 13 + col      (0..168)
 *
 * 13*6 + 78*4 + 78*12 = 78 + 312 + 936 = 1326 — the same universe `combo.ts` enumerates.
 */
import { invariant, RANKS_DESC, rankValue, type Rank } from '@gto-self/shared';
import { comboCards, type ComboIndex } from './combo.js';

export const RANK_GRID_SIZE = 13;
export const HAND_CLASS_COUNT = 169;

export type HandClassKind = 'PAIR' | 'SUITED' | 'OFFSUIT';

declare const HAND_CLASS: unique symbol;
/** An integer in 0..168: `row * 13 + col` over ranks descending. */
export type HandClassIndex = number & { readonly [HAND_CLASS]: true };

export interface HandClass {
  readonly index: HandClassIndex;
  /** `'AA'`, `'AKs'`, `'72o'`. */
  readonly key: string;
  readonly kind: HandClassKind;
  /** Row in the 13x13 grid: 0 = A ... 12 = 2. Always the HIGHER of the two ranks. */
  readonly row: number;
  readonly col: number;
  readonly highRank: Rank;
  readonly lowRank: Rank;
  /** 6 for a pair, 4 suited, 12 offsuit. */
  readonly comboCount: number;
}

function rankAt(descIndex: number): Rank {
  const rank = RANKS_DESC[descIndex];
  invariant(rank !== undefined, `rank grid index out of range: ${descIndex}`);
  return rank;
}

function buildHandClass(row: number, col: number): HandClass {
  const index = (row * RANK_GRID_SIZE + col) as HandClassIndex;
  const high = rankAt(Math.min(row, col));
  const low = rankAt(Math.max(row, col));
  if (row === col) {
    return {
      index,
      key: `${high}${low}`,
      kind: 'PAIR',
      row,
      col,
      highRank: high,
      lowRank: low,
      comboCount: 6,
    };
  }
  const suited = row < col;
  return {
    index,
    key: `${high}${low}${suited ? 's' : 'o'}`,
    kind: suited ? 'SUITED' : 'OFFSUIT',
    row,
    col,
    highRank: high,
    lowRank: low,
    comboCount: suited ? 4 : 12,
  };
}

/** All 169 classes in matrix order (`row * 13 + col`). */
export const HAND_CLASSES: readonly HandClass[] = Array.from(
  { length: HAND_CLASS_COUNT },
  (_, index) => buildHandClass(Math.floor(index / RANK_GRID_SIZE), index % RANK_GRID_SIZE),
);

const HAND_CLASS_BY_KEY = new Map<string, HandClass>(HAND_CLASSES.map((c) => [c.key, c]));

/** Total. The class definition at a matrix index. Throws only on a corrupt index. */
export function handClassAt(index: HandClassIndex): HandClass {
  const found = HAND_CLASSES[index];
  invariant(found !== undefined, `hand class index out of range: ${index}`);
  return found;
}

/** Total. Lookup by `'AKs'`-style key, or `undefined` when the key is not one of the 169. */
export function handClassByKey(key: string): HandClass | undefined {
  return HAND_CLASS_BY_KEY.get(key);
}

/** Precomputed combo -> class, so aggregation is a single array read per combo. */
const CLASS_OF_COMBO = new Uint8Array(1326 * 2);

/** Total. The 13x13 matrix index of a concrete combo. */
export function handClassIndexOfCombo(combo: ComboIndex): HandClassIndex {
  const row = CLASS_OF_COMBO[combo * 2] ?? 0;
  const col = CLASS_OF_COMBO[combo * 2 + 1] ?? 0;
  return (row * RANK_GRID_SIZE + col) as HandClassIndex;
}

function computeClassOfCombo(combo: ComboIndex): { readonly row: number; readonly col: number } {
  const [lowCard, highCard] = comboCards(combo);
  // Card index -> rank descending index: 0 = A, 12 = '2'.
  const a = 12 - rankValue(lowCard);
  const b = 12 - rankValue(highCard);
  const hi = Math.min(a, b);
  const lo = Math.max(a, b);
  if (hi === lo) return { row: hi, col: lo };
  const suited = lowCard % 4 === highCard % 4;
  return suited ? { row: hi, col: lo } : { row: lo, col: hi };
}

for (let combo = 0; combo < 1326; combo += 1) {
  const { row, col } = computeClassOfCombo(combo as ComboIndex);
  CLASS_OF_COMBO[combo * 2] = row;
  CLASS_OF_COMBO[combo * 2 + 1] = col;
}

/** Total. The class of a combo. */
export function handClassOfCombo(combo: ComboIndex): HandClass {
  return handClassAt(handClassIndexOfCombo(combo));
}
