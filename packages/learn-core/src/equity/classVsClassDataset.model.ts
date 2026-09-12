/**
 * The vocabulary of the frozen class-vs-class equity dataset: what one frozen matchup is, and
 * what the dataset is allowed to claim about itself. Mirrors `strength/model.ts`'s role for
 * the 169-class strength dataset, at a much smaller scale — a handful of matchups rather than
 * 169 classes — because there is no cumulative-share arithmetic to redo at load here; every
 * field a caller needs is already on `ClassVsClassEquity` and is stored verbatim.
 */
import type { ClassVsClassEquity } from './classVsClass.js';

/** Every way a lookup against the frozen dataset can fail. */
export const CLASS_VS_CLASS_DATASET_ERRORS = ['UNKNOWN_MATCHUP'] as const;

export type ClassVsClassDatasetError = (typeof CLASS_VS_CLASS_DATASET_ERRORS)[number];

/** Everything the dataset says about itself, independent of which matchups it holds. */
export interface ClassVsClassDatasetMeta {
  /** One sentence naming the method, carried with the data so it travels with it. */
  readonly methodology: string;
  /** Where the long-form reasoning lives. */
  readonly methodologyReport: string;
  readonly generatorVersion: string;
  /** ISO-8601 UTC instant the shipped numbers were produced. */
  readonly generatedAt: string;
}

/** Exactly what `classVsClassDataset.generated.ts` holds: the metadata and the frozen rows. */
export interface ClassVsClassDatasetSource extends ClassVsClassDatasetMeta {
  readonly matchups: readonly ClassVsClassEquity[];
}
