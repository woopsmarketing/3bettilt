/**
 * The single error vocabulary for `@gto-self/poker-core`.
 *
 * Every public function that can fail on input the engine did not itself produce
 * returns `EngineResult<T>`. Programmer errors use `invariant()` from
 * `@gto-self/shared` instead and are never represented here.
 */
import type { MilliBB } from '@gto-self/shared';
import { err, type Result } from '@gto-self/shared';
import type { SeatIndex } from './seat.js';

export type EngineErrorCode =
  // configuration / hand start
  | 'INVALID_CONFIG'
  | 'NOT_ENOUGH_PLAYERS'
  | 'TOO_MANY_PLAYERS'
  | 'NO_BUTTON_SEAT'
  | 'BUTTON_SEAT_NOT_DEALT_IN'
  | 'STACK_NOT_POSITIVE'
  | 'DUPLICATE_PLAYER'
  // manual blind assignment / dead blinds (ADR-0031)
  | 'BLIND_OVERRIDE_INVALID'
  | 'BLIND_OVERRIDE_ON_BUTTON'
  | 'POSITION_LINEUP_UNSUPPORTED'
  | 'DUPLICATE_DEAD_BLIND'
  // table mutation
  | 'SEAT_OCCUPIED'
  | 'SEAT_EMPTY'
  | 'STACK_NEGATIVE'
  | 'HAND_NOT_COMPLETE'
  | 'HAND_TABLE_MISMATCH'
  // phase
  | 'HAND_ALREADY_FINISHED'
  | 'NOT_BETTING_PHASE'
  | 'NOT_AWAITING_BOARD'
  | 'NOT_AWAITING_AWARD'
  // actor / seat
  | 'NOT_ACTORS_TURN'
  | 'SEAT_NOT_DEALT_IN'
  | 'SEAT_ALREADY_FOLDED'
  | 'SEAT_ALL_IN'
  // verb legality
  | 'CHECK_NOT_ALLOWED'
  | 'CALL_NOT_ALLOWED'
  | 'BET_NOT_ALLOWED'
  | 'RAISE_NOT_ALLOWED'
  | 'RAISE_NOT_REOPENED'
  | 'NO_OPPONENT_CAN_RESPOND'
  // amounts
  | 'AMOUNT_OUT_OF_RANGE'
  | 'AMOUNT_NOT_INCREASING'
  | 'AMOUNT_BELOW_MINIMUM'
  | 'INSUFFICIENT_STACK'
  // cards
  | 'WRONG_CARD_COUNT'
  | 'DUPLICATE_CARD'
  // settlement
  | 'UNKNOWN_POT'
  | 'AWARDS_INCOMPLETE'
  | 'POT_ALREADY_AWARDED'
  | 'NO_WINNERS'
  | 'DUPLICATE_WINNER'
  | 'WINNER_NOT_ELIGIBLE'
  | 'FEE_NOT_ALLOWED'
  | 'FEE_NEGATIVE'
  | 'FEE_ABOVE_CAP'
  | 'FEE_EXCEEDS_POT'
  // log
  | 'NOTHING_TO_UNDO'
  | 'CORRUPT_LOG';

/** Every field is JSON-serializable so the UI can render an error without re-deriving it. */
export interface EngineErrorContext {
  readonly seat?: SeatIndex;
  readonly min?: MilliBB;
  readonly max?: MilliBB;
  readonly actual?: MilliBB;
  readonly potIndex?: number;
  readonly seq?: number;
  readonly eventKind?: string;
  readonly expected?: string;
  /** Index of the failing command in a `replayCommands` list. */
  readonly commandIndex?: number;
}

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly context: EngineErrorContext;
}

export type EngineResult<T> = Result<T, EngineError>;

/** Build an `EngineError` with an always-present (possibly empty) context. Total. */
export function engineError(
  code: EngineErrorCode,
  message: string,
  context: EngineErrorContext = {},
): EngineError {
  return { code, message, context };
}

/** `err(engineError(...))`, typed for any `T`, so validation sites stay one line. Total. */
export function engineErr<T>(
  code: EngineErrorCode,
  message: string,
  context: EngineErrorContext = {},
): EngineResult<T> {
  return err(engineError(code, message, context));
}
