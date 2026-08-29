/**
 * The single error vocabulary for `@gto-self/db`.
 *
 * Mirrors `poker-core/src/errors.ts` and `player-core/src/errors.ts` deliberately: every
 * repository function that can fail on data it did not itself produce returns
 * `DbResult<T>`. A row that fails validation is a TYPED ERROR — never a silently coerced
 * object, and never a plausible-looking default (`CLAUDE.md` rule 5).
 */
import { err, type Result } from '@gto-self/shared';
import type { EngineError } from '@gto-self/poker-core';
import type { PlayerError } from '@gto-self/player-core';

export type DbErrorCode =
  /** The row the caller named does not exist. */
  | 'NOT_FOUND'
  /** A unique key, a natural key, or an append-order precondition was violated. */
  | 'CONFLICT'
  /** A stored row exists but does not decode into a valid domain value. */
  | 'CORRUPT_ROW'
  /** The caller supplied a value the domain rejects, before anything was written. */
  | 'INVALID_INPUT'
  /** SQLite refused the write (foreign key, CHECK, NOT NULL, ...). */
  | 'CONSTRAINT_VIOLATION'
  /** Anything else the driver threw. */
  | 'STORAGE_FAILURE';

/** Every field is JSON-serializable so the UI can render an error without re-deriving it. */
export interface DbErrorContext {
  readonly table?: string;
  readonly id?: string;
  readonly field?: string;
  readonly expected?: string;
  readonly actual?: string;
  /** The domain error code this wraps, when a `poker-core`/`player-core` validator rejected. */
  readonly domainCode?: string;
  /** The driver's message, when one exists. */
  readonly cause?: string;
}

export interface DbError {
  readonly code: DbErrorCode;
  readonly message: string;
  readonly context: DbErrorContext;
}

export type DbResult<T> = Result<T, DbError>;

/** Build a `DbError` with an always-present (possibly empty) context. Total. */
export function dbError(code: DbErrorCode, message: string, context: DbErrorContext = {}): DbError {
  return { code, message, context };
}

/** `err(dbError(...))`, typed for any `T`, so validation sites stay one line. Total. */
export function dbErr<T>(
  code: DbErrorCode,
  message: string,
  context: DbErrorContext = {},
): DbResult<T> {
  return err(dbError(code, message, context));
}

/** A `player-core` rejection of a stored row, preserved verbatim rather than flattened. */
export function fromPlayerError<T>(error: PlayerError, context: DbErrorContext = {}): DbResult<T> {
  return dbErr('CORRUPT_ROW', error.message, {
    ...context,
    domainCode: error.code,
    ...(error.context.field === undefined ? {} : { field: error.context.field }),
  });
}

/** A `poker-core` rejection of a stored row (a corrupt log, an invalid config). */
export function fromEngineError<T>(error: EngineError, context: DbErrorContext = {}): DbResult<T> {
  return dbErr('CORRUPT_ROW', error.message, { ...context, domainCode: error.code });
}

const CONSTRAINT_MARKERS = [
  'FOREIGN KEY constraint failed',
  'UNIQUE constraint failed',
  'CHECK constraint failed',
  'NOT NULL constraint failed',
];

/**
 * Total. Runs a write and converts a driver throw into a typed error. SQLite's constraint
 * failures are the DB doing its job, so they map to `CONSTRAINT_VIOLATION` rather than
 * escaping as an exception; anything else is `STORAGE_FAILURE`.
 */
export function attempt<T>(context: DbErrorContext, run: () => T): DbResult<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const constraint = CONSTRAINT_MARKERS.some((marker) => message.includes(marker));
    return dbErr(constraint ? 'CONSTRAINT_VIOLATION' : 'STORAGE_FAILURE', message, {
      ...context,
      cause: message,
    });
  }
}
