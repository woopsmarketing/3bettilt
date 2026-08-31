/**
 * Integer basis points, the only unit this package expresses a frequency or a range weight
 * in. 10000 bps = 1.0 = 100%.
 *
 * The convention is ADR-0016 item 4's ("frequencies stored as integer ten-thousandths"),
 * applied to in-memory arithmetic as well as storage: float probabilities are never
 * introduced, so a weight that survives a chain of operations is byte-comparable in tests.
 *
 * Two apportionment schemes live here, and every rounding in the range model goes through
 * one of them. Both are the largest-remainder (Hamilton) method with a fully specified
 * tie-break — larger remainder first, then LOWER index — so the output depends on nothing
 * but the input.
 */
import { invariant, ok } from '@gto-self/shared';
import { strategyErr, type StrategyResult } from './errors.js';

declare const BPS: unique symbol;
/** An integer in 0..10000. Constructed only through the guards below. */
export type Bps = number & { readonly [BPS]: true };

/** 100% in basis points. */
export const BPS_TOTAL = 10000;
export const BPS_ZERO = 0 as Bps;
export const BPS_FULL = BPS_TOTAL as Bps;

/** Total. True iff `value` is an integer in 0..10000. */
export function isBps(value: unknown): value is Bps {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= BPS_TOTAL;
}

/** Throws. Programmer / corrupt-data guard; never call it on unvalidated user input. */
export function asBps(value: number): Bps {
  invariant(isBps(value), `basis points out of range: ${value}`);
  return value;
}

/** Result. The user-input door: use this at a parse boundary, `asBps` inside the domain. */
export function parseBps(value: number): StrategyResult<Bps> {
  if (!isBps(value)) {
    return strategyErr('INVALID_BPS', `Expected an integer 0..${BPS_TOTAL}, got ${value}`, {
      value: String(value),
      min: 0,
      max: BPS_TOTAL,
    });
  }
  return ok(value);
}

/** Total. Clamps into 0..10000, rounding a fractional input half away from zero. */
export function clampBps(value: number): Bps {
  if (!Number.isFinite(value)) return BPS_ZERO;
  const rounded = Math.round(value);
  if (rounded <= 0) return BPS_ZERO;
  if (rounded >= BPS_TOTAL) return BPS_FULL;
  return rounded as Bps;
}

/** Total. Basis points as a plain 0..1 fraction. A ratio, never money (CLAUDE.md rule 1). */
export const bpsToFraction = (value: Bps): number => value / BPS_TOTAL;

/**
 * Internal. Adds `extra` single units to the entries with the largest `remainders`,
 * skipping zero remainders, tie-broken by lower index. Mutates and returns `base`.
 */
function distributeRemainders(
  base: number[],
  remainders: readonly number[],
  extra: number,
): number[] {
  if (extra <= 0) return base;
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .filter((entry) => entry.remainder > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const handedOut = Math.min(extra, order.length);
  for (let i = 0; i < handedOut; i += 1) {
    const entry = order[i];
    if (entry === undefined) break;
    base[entry.index] = (base[entry.index] ?? 0) + 1;
  }
  return base;
}

/**
 * Result. Distributes exactly `total` integer units across `values` in proportion to them.
 *
 * `sum(result) === total` ALWAYS — that is the point of the largest-remainder scheme, and
 * why normalization here can never leak or invent a basis point.
 *
 * Refuses (`NORMALIZATION_UNDEFINED`) when every value is zero and `total` is positive:
 * there is no proportion to divide by, and picking one would be inventing a number.
 */
export function apportion(values: readonly number[], total: number): StrategyResult<number[]> {
  if (!Number.isInteger(total) || total < 0) {
    return strategyErr('INVALID_TOTAL', `Total must be a non-negative integer, got ${total}`, {
      value: String(total),
    });
  }
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? 0;
    if (!Number.isInteger(value) || value < 0) {
      return strategyErr(
        'INVALID_BPS',
        `Apportionment input must be a non-negative integer, got ${value}`,
        { index: i, value: String(value) },
      );
    }
  }
  const sum = values.reduce<number>((acc, value) => acc + value, 0);
  if (total === 0) return ok(values.map(() => 0));
  if (sum === 0) {
    return strategyErr(
      'NORMALIZATION_UNDEFINED',
      'Cannot apportion a positive total across an all-zero input',
      { expected: 'at least one positive value' },
    );
  }
  const base: number[] = [];
  const remainders: number[] = [];
  let assigned = 0;
  for (const value of values) {
    const scaled = value * total;
    const share = Math.floor(scaled / sum);
    base.push(share);
    remainders.push(scaled - share * sum);
    assigned += share;
  }
  return ok(distributeRemainders(base, remainders, total - assigned));
}

/**
 * Total. Divides each product by `BPS_TOTAL`, distributing the sub-basis-point residue by
 * largest remainder so that `sum(result) === floor(sum(products) / BPS_TOTAL)` exactly.
 *
 * This is the multiplication step of the range model: `products[i] = weight * P(action)`,
 * both in basis points, so a product is in "bps squared" and one division brings it back.
 * FLOOR of the exact total (never round) is deliberate — a range's mass after an action can
 * be understated by less than one basis point in total, never overstated.
 *
 * Throws on a negative or non-integer product: that is a programmer error, not user input.
 */
export function divideByBpsTotal(products: readonly number[]): number[] {
  const base: number[] = [];
  const remainders: number[] = [];
  let residue = 0;
  let assigned = 0;
  for (const product of products) {
    invariant(
      Number.isInteger(product) && product >= 0,
      `product must be a non-negative integer, got ${product}`,
    );
    const share = Math.floor(product / BPS_TOTAL);
    const remainder = product - share * BPS_TOTAL;
    base.push(share);
    remainders.push(remainder);
    residue += remainder;
    assigned += share;
  }
  const target = assigned + Math.floor(residue / BPS_TOTAL);
  return distributeRemainders(base, remainders, target - assigned);
}
