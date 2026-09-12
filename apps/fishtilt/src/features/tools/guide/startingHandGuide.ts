/**
 * The tables under `/tools/starting-hand` (WP-S3-14). Every rank and percentage is read from
 * `@gto-self/learn-core`'s frozen, EXACT `HAND_STRENGTH` dataset — the same rows the slider
 * above cuts — never restated. The suited/offsuit pair (`AKs` / `AKo`) is looked up, so
 * "why do they rank differently" is answered with the two measured numbers rather than a
 * remembered one.
 */
import {
  HAND_STRENGTH,
  HAND_STRENGTH_BY_RANK,
  handStrengthOf,
  type HandStrengthEntry,
} from '@gto-self/learn-core';
import { handClassByKey, type HandClass } from '@gto-self/strategy-core';
import { handClassReading } from '../../range/index.js';

export interface StrengthRow {
  readonly entry: HandStrengthEntry;
  readonly handClass: HandClass;
  readonly reading: string;
}

function rowOf(entry: HandStrengthEntry): StrengthRow {
  const handClass = handClassByKey(entry.key);
  if (handClass === undefined)
    throw new Error(`starting hand guide: "${entry.key}" is not a class`);
  return { entry, handClass, reading: handClassReading(handClass) };
}

/** The strongest `count` classes, rank 1 first. */
export function strongestRows(count = 5): readonly StrengthRow[] {
  return HAND_STRENGTH_BY_RANK.slice(0, count).map(rowOf);
}

/** The weakest `count` classes, weakest last. */
export function weakestRows(count = 5): readonly StrengthRow[] {
  return HAND_STRENGTH_BY_RANK.slice(-count).map(rowOf);
}

export interface SuitedPair {
  readonly suited: StrengthRow;
  readonly offsuit: StrengthRow;
  /** `suited.equity - offsuit.equity`, `0..1`. */
  readonly equityGap: number;
}

/** The same two ranks, suited and not — the pair the guide compares. */
export function suitedVersusOffsuit(suitedKey = 'AKs', offsuitKey = 'AKo'): SuitedPair {
  const suitedClass = handClassByKey(suitedKey);
  const offsuitClass = handClassByKey(offsuitKey);
  if (suitedClass === undefined || offsuitClass === undefined) {
    throw new Error(`starting hand guide: "${suitedKey}" / "${offsuitKey}" is not a class`);
  }
  if (
    suitedClass.kind !== 'SUITED' ||
    offsuitClass.kind !== 'OFFSUIT' ||
    suitedClass.highRank !== offsuitClass.highRank ||
    suitedClass.lowRank !== offsuitClass.lowRank
  ) {
    throw new Error(
      `starting hand guide: ${suitedKey} and ${offsuitKey} are not the same ranks suited and offsuit`,
    );
  }
  const suited = rowOf(handStrengthOf(suitedClass));
  const offsuit = rowOf(handStrengthOf(offsuitClass));
  return { suited, offsuit, equityGap: suited.entry.equity - offsuit.entry.equity };
}

/** The dataset's own metadata, for the provenance sentence. */
export const STRENGTH_DATASET = HAND_STRENGTH;
