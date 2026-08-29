/**
 * The single error vocabulary for `@gto-self/player-core`.
 *
 * Mirrors `poker-core/src/errors.ts` deliberately: every public function that can fail
 * on data the package did not itself produce returns `PlayerResult<T>`; programmer
 * errors use `invariant()` from `@gto-self/shared` and are never represented here.
 */
import { err, type Result } from '@gto-self/shared';

export type PlayerErrorCode =
  // identity
  | 'INVALID_NICKNAME'
  | 'DUPLICATE_NICKNAME'
  | 'INVALID_ALIAS'
  // time
  | 'INVALID_TIMESTAMP'
  | 'TIMESTAMP_OUT_OF_ORDER'
  // manual HUD snapshots
  | 'INVALID_PERCENT'
  | 'UNKNOWN_STAT'
  | 'DUPLICATE_STAT'
  | 'EMPTY_SNAPSHOT'
  | 'INVALID_SAMPLE_SIZE'
  // our own observations
  | 'UNKNOWN_METRIC'
  | 'INVALID_COUNT'
  | 'ACTIONS_EXCEED_OPPORTUNITIES'
  | 'OBSERVATION_MISMATCH'
  // notes
  | 'INVALID_NOTE_BODY'
  | 'NOTE_PLAYER_MISMATCH'
  // confidence
  | 'INVALID_CONFIDENCE_CONFIG';

/** Every field is JSON-serializable so the UI can render an error without re-deriving it. */
export interface PlayerErrorContext {
  /** The record or field the failure is about, e.g. `'nickname'`, `'stats[2].value'`. */
  readonly field?: string;
  /** The offending value, already stringified so the context stays serializable. */
  readonly value?: string;
  readonly expected?: string;
  readonly min?: number;
  readonly max?: number;
  readonly actual?: number;
  /** Id of an existing record that caused the conflict (duplicate nickname, etc.). */
  readonly conflictingId?: string;
  readonly playerId?: string;
  readonly stat?: string;
  readonly metric?: string;
  /** Index of the failing element in a supplied list. */
  readonly index?: number;
}

export interface PlayerError {
  readonly code: PlayerErrorCode;
  readonly message: string;
  readonly context: PlayerErrorContext;
}

export type PlayerResult<T> = Result<T, PlayerError>;

/** Build a `PlayerError` with an always-present (possibly empty) context. Total. */
export function playerError(
  code: PlayerErrorCode,
  message: string,
  context: PlayerErrorContext = {},
): PlayerError {
  return { code, message, context };
}

/** `err(playerError(...))`, typed for any `T`, so validation sites stay one line. Total. */
export function playerErr<T>(
  code: PlayerErrorCode,
  message: string,
  context: PlayerErrorContext = {},
): PlayerResult<T> {
  return err(playerError(code, message, context));
}
