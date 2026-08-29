/**
 * Caller-supplied timestamps.
 *
 * The domain NEVER reads the clock: every record that carries a time takes it as an
 * argument, for the same reason ids are injected (ADR-0007) — replay and tests must be
 * reproducible, and a hidden `Date.now()` makes a pure function untestable.
 *
 * A `Timestamp` is integer milliseconds since the Unix epoch, UTC. It is an integer so
 * that ordering, equality and SQLite storage are exact, and so the DB layer can persist
 * it as an INTEGER column with no timezone ambiguity.
 */
import { playerErr, type PlayerResult } from './errors.js';
import { ok } from '@gto-self/shared';

declare const TIMESTAMP: unique symbol;

/** Integer milliseconds since the Unix epoch (UTC). Construct via `timestamp`. */
export type Timestamp = number & { readonly [TIMESTAMP]: true };

/** Latest accepted instant: 3000-01-01T00:00:00Z. A larger value is a caller bug. */
export const MAX_TIMESTAMP = 32_503_680_000_000;

export const isTimestamp = (value: unknown): value is Timestamp =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMESTAMP;

/** Assert that a raw number is a valid timestamp. Throws — programmer-error guard. */
export function timestamp(value: number): Timestamp {
  if (!isTimestamp(value)) {
    throw new Error(`Timestamp must be an integer 0..${MAX_TIMESTAMP} ms, got ${value}`);
  }
  return value;
}

/** Result-returning form for foreign data (DB rows, user input). Total. */
export function validateTimestamp(value: number, field: string): PlayerResult<Timestamp> {
  if (!isTimestamp(value)) {
    return playerErr('INVALID_TIMESTAMP', `${field} must be an integer 0..${MAX_TIMESTAMP} ms`, {
      field,
      actual: value,
      min: 0,
      max: MAX_TIMESTAMP,
    });
  }
  return ok(value);
}

/** Convert a `Date` at the application boundary. Never called from inside the domain. */
export const fromDate = (date: Date): Timestamp => timestamp(date.getTime());

export const compareTimestamps = (a: Timestamp, b: Timestamp): number =>
  a < b ? -1 : a > b ? 1 : 0;
