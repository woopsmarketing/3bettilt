/**
 * Seats and the clockwise ring. **Clockwise = ascending physical seat index modulo 6.**
 *
 * Stated once here; every ordering in the engine (action order, ante posting order,
 * position assignment, odd-chip order) is built from `orderClockwise` / `rotateToSeat`
 * and nothing else in the package re-derives it.
 */
import { invariant } from '@gto-self/shared';

/** Physical seats at the table. Widening past 6-max means widening `SeatIndex` too. */
export const SEAT_COUNT = 6;

/**
 * A finite literal union, NOT `number`. Under `noUncheckedIndexedAccess` (ADR-0005),
 * a mapped type keyed by this union yields `T`, never `T | undefined`, so seat access
 * across the engine needs no null checks and no `!`.
 */
export type SeatIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const SEAT_INDEXES: readonly SeatIndex[] = [0, 1, 2, 3, 4, 5];

/** Total per-seat container. All six entries always exist. */
export type BySeat<T> = Readonly<Record<SeatIndex, T>>;

export type SeatOccupancy = 'ACTIVE' | 'SITTING_OUT' | 'EMPTY';

/** Total. True iff `value` is an integer in 0..5. */
export function isSeatIndex(value: number): value is SeatIndex {
  return Number.isInteger(value) && value >= 0 && value < SEAT_COUNT;
}

/** Throws. Programmer / corrupt-data guard; never call it on unvalidated user input. */
export function asSeatIndex(value: number): SeatIndex {
  invariant(isSeatIndex(value), `seat index out of range: ${value}`);
  return value;
}

/** Total. Builds a full six-entry container from a per-seat builder. */
export function makeBySeat<T>(build: (seat: SeatIndex) => T): BySeat<T> {
  return {
    0: build(0),
    1: build(1),
    2: build(2),
    3: build(3),
    4: build(4),
    5: build(5),
  };
}

/** Total. Immutable single-slot replace; returns the same reference when unchanged. */
export function setBySeat<T>(source: BySeat<T>, seat: SeatIndex, value: T): BySeat<T> {
  if (Object.is(source[seat], value)) return source;
  return { ...source, [seat]: value };
}

/** Total. Immutable single-slot update through `f`. */
export function updateBySeat<T>(source: BySeat<T>, seat: SeatIndex, f: (value: T) => T): BySeat<T> {
  return setBySeat(source, seat, f(source[seat]));
}

/** Total. Clockwise successor; wraps 5 -> 0. */
export function nextSeat(seat: SeatIndex): SeatIndex {
  return asSeatIndex((seat + 1) % SEAT_COUNT);
}

/**
 * Total. All six seats in ring order beginning at `start`.
 * `includeStart: false` moves `start` to the END rather than dropping it, so a subset
 * filtered through `orderClockwise` never silently loses a member.
 */
export function seatsClockwiseFrom(start: SeatIndex, includeStart: boolean): readonly SeatIndex[] {
  const offset = includeStart ? 0 : 1;
  const out: SeatIndex[] = [];
  for (let i = 0; i < SEAT_COUNT; i += 1) {
    out.push(asSeatIndex((start + offset + i) % SEAT_COUNT));
  }
  return out;
}

/**
 * Total. Filters a subset into ring order beginning at `from`. THE ordering primitive:
 * every action order, ante order and odd-chip order is built from it.
 */
export function orderClockwise(
  seats: readonly SeatIndex[],
  from: SeatIndex,
  includeFrom: boolean,
): readonly SeatIndex[] {
  const present = new Set<number>(seats);
  return seatsClockwiseFrom(from, includeFrom).filter((seat) => present.has(seat));
}

/**
 * Throws if `target` is absent. Rotates a ring-ordered subset so `target` is first.
 * The one place an array is indexed under `noUncheckedIndexedAccess`, so nothing else
 * in the package needs a non-null assertion.
 */
export function rotateToSeat(seats: readonly SeatIndex[], target: SeatIndex): readonly SeatIndex[] {
  const at = seats.indexOf(target);
  invariant(at >= 0, `rotateToSeat: seat ${target} is not in [${seats.join(',')}]`);
  return [...seats.slice(at), ...seats.slice(0, at)];
}
