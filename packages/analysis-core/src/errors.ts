/**
 * The single error vocabulary for `@gto-self/analysis-core`.
 *
 * Mirrors `poker-core/src/errors.ts` and `player-core/src/errors.ts` deliberately: every
 * public function that can fail on data it did not itself produce returns
 * `AnalysisResult<T>`; a programmer error uses `invariant()` from `@gto-self/shared` and
 * is never represented here.
 */
import { err, type Result } from '@gto-self/shared';

export type AnalysisErrorCode =
  /** The hand has not reached `COMPLETE`; an unfinished hand is not eligible input. */
  | 'HAND_NOT_COMPLETE'
  /** The same hand id appears twice in one input set, which would double-count it. */
  | 'DUPLICATE_HAND'
  /** A structural expectation about the hand or the arguments did not hold. */
  | 'INVALID_INPUT'
  /** The supplied `PlayerModelConfig` is not usable. */
  | 'INVALID_CONFIG';

/** Every field is JSON-serializable so a caller can render the failure verbatim. */
export interface AnalysisErrorContext {
  readonly field?: string;
  readonly handId?: string;
  readonly playerId?: string;
  readonly seat?: number;
  readonly expected?: string;
  readonly actual?: string;
  /** The underlying `player-core` error code, when one was passed through. */
  readonly domainCode?: string;
}

export interface AnalysisError {
  readonly code: AnalysisErrorCode;
  readonly message: string;
  readonly context: AnalysisErrorContext;
}

export type AnalysisResult<T> = Result<T, AnalysisError>;

export function analysisError(
  code: AnalysisErrorCode,
  message: string,
  context: AnalysisErrorContext = {},
): AnalysisError {
  return { code, message, context };
}

/** `err(analysisError(...))`, typed for any `T`, so a validation site stays one line. */
export function analysisErr<T>(
  code: AnalysisErrorCode,
  message: string,
  context: AnalysisErrorContext = {},
): AnalysisResult<T> {
  return err(analysisError(code, message, context));
}
