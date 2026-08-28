/** Minimal Result type. Domain code returns Results for expected failures and
 *  throws only for programmer errors (invariant violations). */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

/** Unwrap or throw. Only for call sites that have already proven success. */
export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw new Error(`unwrap() on Err: ${JSON.stringify(r.error)}`);
}

export function mapOk<T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/** Programmer-error guard. Never use for user input validation. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invariant violated: ${message}`);
}

/** Exhaustiveness guard for discriminated unions. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
