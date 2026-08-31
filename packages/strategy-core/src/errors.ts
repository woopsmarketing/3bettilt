/**
 * The single error vocabulary for `@gto-self/strategy-core`.
 *
 * Mirrors `player-core/src/errors.ts` deliberately (hand-written Result idiom, no zod):
 * every public function that can fail on data the package did not itself produce returns
 * `StrategyResult<T>`; programmer errors use `invariant()` from `@gto-self/shared` and are
 * never represented here.
 *
 * NOTE: a spot this package cannot classify is NOT an error — `classifyPreflopSpot`
 * returns a typed `UNSUPPORTED` spot instead, because "we do not model this line" is data
 * the UI must render, not a failure.
 */
import { err, type Result } from '@gto-self/shared';

export type StrategyErrorCode =
  // adapter: who is asking
  | 'HERO_UNKNOWN'
  | 'HERO_NOT_DEALT_IN'
  | 'HERO_NOT_ACTOR'
  | 'NO_LEGAL_ACTIONS'
  | 'NOT_A_DECISION_POINT'
  // adapter: what we were handed
  | 'UNSUPPORTED_LINEUP'
  | 'POSITION_UNAVAILABLE'
  | 'UNSUPPORTED_ACTION_KIND'
  | 'INVALID_HERO_CARDS'
  | 'INVALID_BOARD'
  // range / basis-point arithmetic
  | 'INVALID_BPS'
  | 'INVALID_COMBO_INDEX'
  | 'INVALID_WEIGHT_LENGTH'
  | 'NORMALIZATION_UNDEFINED'
  | 'INVALID_TOTAL'
  // equity: the enumeration has nothing to enumerate
  | 'ZERO_MASS_RANGE';

/** Every field is JSON-serializable so the UI can render an error without re-deriving it. */
export interface StrategyErrorContext {
  /** The field or input the failure is about, e.g. `'heroSeat'`, `'weights[17]'`. */
  readonly field?: string;
  /** The offending value, already stringified so the context stays serializable. */
  readonly value?: string;
  readonly expected?: string;
  readonly min?: number;
  readonly max?: number;
  readonly actual?: number;
  readonly index?: number;
  readonly seat?: number;
  readonly street?: string;
  readonly phase?: string;
}

export interface StrategyError {
  readonly code: StrategyErrorCode;
  readonly message: string;
  readonly context: StrategyErrorContext;
}

export type StrategyResult<T> = Result<T, StrategyError>;

/** Build a `StrategyError` with an always-present (possibly empty) context. Total. */
export function strategyError(
  code: StrategyErrorCode,
  message: string,
  context: StrategyErrorContext = {},
): StrategyError {
  return { code, message, context };
}

/** `err(strategyError(...))`, typed for any `T`, so validation sites stay one line. Total. */
export function strategyErr<T>(
  code: StrategyErrorCode,
  message: string,
  context: StrategyErrorContext = {},
): StrategyResult<T> {
  return err(strategyError(code, message, context));
}
