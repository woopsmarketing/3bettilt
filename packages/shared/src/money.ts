/**
 * Fixed-point money for GTO-SELF.
 *
 * The single internal money unit is the **milliBB**: 1 BB = 1000 milliBB.
 * Every pot, stack, wager, contribution, rake and settlement value in the
 * system is an integer number of milliBB. Floating point is permitted only
 * at the UI/parse boundary (see `fromBB`, `parseBB`, `formatBB`) and for
 * ratios that are not money (e.g. bet-as-fraction-of-pot).
 *
 * Examples: 100 BB = 100_000, 0.5 BB = 500, 0.16 BB = 160, 2.37 BB = 2370.
 */
import { err, ok, type Result } from './result.js';

declare const MILLI_BB: unique symbol;

/** An integer count of milliBB. Construct via `mbb`, `fromBB` or `parseBB`. */
export type MilliBB = number & { readonly [MILLI_BB]: true };

/** milliBB in one big blind. */
export const MBB_PER_BB = 1000;

/** Largest magnitude we accept, keeping every intermediate product exact in a double. */
export const MAX_MILLI_BB = 1_000_000_000; // 1,000,000 BB

export const ZERO = 0 as MilliBB;
export const ONE_BB = MBB_PER_BB as MilliBB;

export type RoundingMode = 'floor' | 'ceil' | 'round' | 'exact';

function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case 'floor':
      return Math.floor(value);
    case 'ceil':
      return Math.ceil(value);
    case 'round':
      // Half away from zero, so rounding is symmetric for negative deltas.
      return value < 0 ? -Math.round(-value) : Math.round(value);
    case 'exact': {
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) > 1e-9) {
        throw new Error(`Non-integral milliBB value ${value} under 'exact' rounding`);
      }
      return rounded;
    }
  }
}

function guard(value: number): MilliBB {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`MilliBB must be a finite integer, got ${value}`);
  }
  if (Math.abs(value) > MAX_MILLI_BB) {
    throw new Error(`MilliBB out of range: ${value}`);
  }
  return value as MilliBB;
}

/** Assert that a raw number is a valid milliBB integer. Throws otherwise. */
export const mbb = (value: number): MilliBB => guard(value);

export const isMilliBB = (value: unknown): value is MilliBB =>
  typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_MILLI_BB;

/**
 * Convert a BB quantity (possibly fractional, e.g. 2.37) into milliBB.
 * Uses `round` by default because float inputs such as 0.16 * 1000 = 159.99999
 * must land on 160.
 */
export function fromBB(bb: number, mode: RoundingMode = 'round'): MilliBB {
  if (!Number.isFinite(bb)) throw new Error(`Cannot convert ${bb} BB to milliBB`);
  return guard(applyRounding(bb * MBB_PER_BB, mode === 'exact' ? 'exact' : mode));
}

/** Exact BB value as a float. Presentation only — never feed this back into math. */
export const toBB = (amount: MilliBB): number => amount / MBB_PER_BB;

// ---------------------------------------------------------------------------
// Arithmetic. All operations stay in integer milliBB space.
// ---------------------------------------------------------------------------

export const add = (a: MilliBB, b: MilliBB): MilliBB => guard(a + b);
export const sub = (a: MilliBB, b: MilliBB): MilliBB => guard(a - b);
export const neg = (a: MilliBB): MilliBB => guard(-a);
export const abs = (a: MilliBB): MilliBB => guard(Math.abs(a));

export const sum = (amounts: readonly MilliBB[]): MilliBB =>
  guard(amounts.reduce<number>((acc, x) => acc + x, 0));

/** Multiply by an integer count (e.g. ante x players). */
export const mulInt = (a: MilliBB, factor: number): MilliBB => {
  if (!Number.isInteger(factor)) throw new Error(`mulInt factor must be an integer, got ${factor}`);
  return guard(a * factor);
};

/**
 * Multiply by an exact rational, e.g. rake 5% -> `mulRatio(pot, 5, 100, 'floor')`,
 * or a 75%-pot bet -> `mulRatio(pot, 3, 4, 'round')`.
 * Rounding is always explicit: money must never round implicitly.
 */
export function mulRatio(
  a: MilliBB,
  numerator: number,
  denominator: number,
  mode: RoundingMode,
): MilliBB {
  if (denominator === 0) throw new Error('mulRatio denominator must be non-zero');
  return guard(applyRounding((a * numerator) / denominator, mode));
}

function assertQuantum(quantum: number): void {
  if (!Number.isSafeInteger(quantum) || quantum <= 0) {
    throw new Error(`quantum must be a positive safe integer, got ${quantum}`);
  }
}

/**
 * Round `amount` to the nearest multiple of `quantum` under `mode`. Total (throws only
 * on a bad `quantum`, an out-of-range result, or `'exact'` given a non-multiple).
 *
 * `quantum` is a SETTLEMENT granularity, not a display choice: `quantize(x, 1, mode)` is
 * the identity for every mode because `x` is already an integer milliBB.
 *
 * Half-way and negative behaviour, stated because money must never round implicitly —
 * this is exactly what `applyRounding` does, applied to `amount / quantum`:
 *  - `'floor'` — toward -Infinity. `quantize(-30, 20, 'floor') === -40`.
 *  - `'ceil'`  — toward +Infinity. `quantize(-30, 20, 'ceil') === -20`.
 *  - `'round'` — nearest, ties away from zero, symmetric about zero.
 *    `quantize(30, 20, 'round') === 40` and `quantize(-30, 20, 'round') === -40`.
 *  - `'exact'` — throws unless `amount` is already a multiple of `quantum`.
 */
export function quantize(amount: MilliBB, quantum: number, mode: RoundingMode): MilliBB {
  assertQuantum(quantum);
  return guard(applyRounding(amount / quantum, mode) * quantum);
}

/**
 * `amount * numerator / denominator`, rounded ONCE to a multiple of `quantum`.
 *
 * This is NOT `quantize(mulRatio(...))`. That rounds twice, and the first rounding can
 * push the value across the half-way point of the second, landing a WHOLE QUANTUM away
 * from the exact product: with `amount = 4190`, `5/100` and `quantum = 20` the exact
 * value is 209.5, whose nearest multiple of 20 is 200 — the two-step form returns 220.
 * Rake is computed with this function for exactly that reason (ADR-0027).
 *
 * `quantum === 1` is an exact identity with `mulRatio`. The half-way and negative
 * behaviour of each `mode` is the one documented on `quantize`.
 *
 * Throws when the exact product `amount * numerator` is not representable, so a silent
 * loss of precision can never reach a settlement amount.
 */
export function mulRatioQuantized(
  amount: MilliBB,
  numerator: number,
  denominator: number,
  quantum: number,
  mode: RoundingMode,
): MilliBB {
  if (denominator === 0) throw new Error('mulRatioQuantized denominator must be non-zero');
  assertQuantum(quantum);
  const product = amount * numerator;
  if (!Number.isSafeInteger(product)) {
    throw new Error(
      `mulRatioQuantized product ${amount} * ${numerator} is not exactly representable`,
    );
  }
  const divisor = denominator * quantum;
  if (!Number.isSafeInteger(divisor)) {
    throw new Error(
      `mulRatioQuantized divisor ${denominator} * ${quantum} is not exactly representable`,
    );
  }
  return guard(applyRounding(product / divisor, mode) * quantum);
}

/**
 * Multiply by an arbitrary (float) fraction such as a solver sizing 0.33.
 * Rounding is explicit for the same reason as `mulRatio`.
 */
export const mulFraction = (a: MilliBB, fraction: number, mode: RoundingMode): MilliBB =>
  guard(applyRounding(a * fraction, mode));

/** Integer split with the remainder returned separately (odd-chip handling). */
export function splitEvenly(
  amount: MilliBB,
  parts: number,
): { readonly share: MilliBB; readonly remainder: MilliBB } {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error(`splitEvenly parts must be a positive integer, got ${parts}`);
  }
  const share = Math.floor(amount / parts);
  return { share: guard(share), remainder: guard(amount - share * parts) };
}

export const min = (a: MilliBB, b: MilliBB): MilliBB => (a <= b ? a : b);
export const max = (a: MilliBB, b: MilliBB): MilliBB => (a >= b ? a : b);
export const clamp = (value: MilliBB, low: MilliBB, high: MilliBB): MilliBB => {
  if (low > high) throw new Error(`clamp bounds inverted: ${low} > ${high}`);
  return min(max(value, low), high);
};

export const eq = (a: MilliBB, b: MilliBB): boolean => a === b;
export const lt = (a: MilliBB, b: MilliBB): boolean => a < b;
export const lte = (a: MilliBB, b: MilliBB): boolean => a <= b;
export const gt = (a: MilliBB, b: MilliBB): boolean => a > b;
export const gte = (a: MilliBB, b: MilliBB): boolean => a >= b;
export const isZero = (a: MilliBB): boolean => a === 0;
export const isPositive = (a: MilliBB): boolean => a > 0;
export const compare = (a: MilliBB, b: MilliBB): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Ratio of two money amounts as a plain number (NOT money).
 * Used for sizing comparisons such as bet / potBeforeAction.
 * Returns `null` when the denominator is zero, so callers must decide.
 */
export function ratio(numerator: MilliBB, denominator: MilliBB): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

// ---------------------------------------------------------------------------
// Boundary: parsing and formatting.
// ---------------------------------------------------------------------------

const BB_INPUT = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

/** Parse user text in BB (e.g. "2.37", "100", ".5"). Rejects >3 decimals. */
export function parseBB(input: string): Result<MilliBB, string> {
  const text = input.trim().replace(/,/g, '');
  if (text === '') return err('empty');
  if (!BB_INPUT.test(text)) return err(`not a number: "${input}"`);
  const [, fraction = ''] = text.split('.');
  if (fraction.length > 3) return err('at most 3 decimal places (1 milliBB) are supported');
  const value = Number(text);
  if (!Number.isFinite(value)) return err(`not a number: "${input}"`);
  if (Math.abs(value) * MBB_PER_BB > MAX_MILLI_BB) return err('amount out of range');
  return ok(fromBB(value));
}

export interface FormatBBOptions {
  /** Minimum decimals to show. Default 0 — "100" not "100.00". */
  readonly minDecimals?: number;
  /** Maximum decimals to show. Default 2; use 3 to expose full milliBB precision. */
  readonly maxDecimals?: number;
  /** Append " BB". Default false. */
  readonly unit?: boolean;
}

/** Format milliBB for display. Never use the output for further math. */
export function formatBB(amount: MilliBB, options: FormatBBOptions = {}): string {
  const { minDecimals = 0, maxDecimals = 2, unit = false } = options;
  if (maxDecimals < minDecimals) throw new Error('maxDecimals < minDecimals');
  const negative = amount < 0;
  const magnitude = Math.abs(amount);
  const whole = Math.floor(magnitude / MBB_PER_BB);
  const milli = magnitude % MBB_PER_BB;
  let decimals = String(milli).padStart(3, '0').slice(0, Math.min(maxDecimals, 3));
  while (decimals.length > minDecimals && decimals.endsWith('0')) decimals = decimals.slice(0, -1);
  const body = decimals.length > 0 ? `${whole}.${decimals}` : String(whole);
  return `${negative ? '-' : ''}${body}${unit ? ' BB' : ''}`;
}

/**
 * Convert milliBB into a currency-ish string for a preset whose big blind is
 * worth `bbValue` currency units (NL50 -> 0.5). Presentation only.
 */
export function formatCurrency(
  amount: MilliBB,
  bbValue: number,
  options: { readonly symbol?: string; readonly decimals?: number } = {},
): string {
  const { symbol = '$', decimals = 2 } = options;
  return `${symbol}${((amount / MBB_PER_BB) * bbValue).toFixed(decimals)}`;
}
