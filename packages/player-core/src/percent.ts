/**
 * Percentage stats — NOT money, and therefore NOT `MilliBB`.
 *
 * These values are HUD percentages such as `VPIP 23.5`. They are ratios, so `Money` is
 * the wrong type: milliBB carries a currency meaning these numbers do not have, and
 * mixing them would let a percentage reach an arithmetic path that expects chips.
 *
 * They are still stored as INTEGERS, for the same reason money is: a value the user
 * typed must survive a round trip byte-for-byte (`CLAUDE.md` rule 3). The unit is one
 * **hundredth of a percentage point** ("centipercent"):
 *
 * ```
 *   23%     -> 2300
 *   23.5%   -> 2350
 *   23.55%  -> 2355
 *   100%    -> 10000
 * ```
 *
 * Two decimal places is the accepted precision, and `parsePercent` REJECTS a third
 * rather than silently rounding it away — exactly as `Money.parseBB` rejects a fourth
 * milliBB decimal. No HUD in scope displays more. Alongside the parsed integer, every
 * stored reading also keeps the raw text the user typed, so even a rejected-precision
 * question can never be answered by guessing at a float.
 */
import { ok } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';

declare const CENTI_PERCENT: unique symbol;

/** An integer count of hundredths of a percentage point. Construct via `centiPercent`. */
export type CentiPercent = number & { readonly [CENTI_PERCENT]: true };

/** Centipercent in one percentage point. */
export const CENTI_PER_PERCENT = 100;

/** 100.00% — the largest value a frequency stat may take. */
export const MAX_CENTI_PERCENT = 10_000;

export const ZERO_PERCENT = 0 as CentiPercent;

export const isCentiPercent = (value: unknown): value is CentiPercent =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_CENTI_PERCENT;

/** Assert that a raw number is a valid centipercent. Throws — programmer-error guard. */
export function centiPercent(value: number): CentiPercent {
  if (!isCentiPercent(value)) {
    throw new Error(`CentiPercent must be an integer 0..${MAX_CENTI_PERCENT}, got ${value}`);
  }
  return value;
}

/** Exact percentage as a float. Presentation only — never feed this back into a stored value. */
export const toPercentNumber = (value: CentiPercent): number => value / CENTI_PER_PERCENT;

const PERCENT_INPUT = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Parse a percentage the user typed off a HUD: `"23"`, `"23.5"`, `"23.55"`, `"23.5 %"`.
 * Total — returns a Result, never throws.
 *
 * Rejects: empty text, a sign, non-numeric text, more than two decimal places, and any
 * value above 100. Rejection is deliberate: rounding a third decimal away would destroy
 * what the user typed.
 */
export function parsePercent(input: string, field = 'percent'): PlayerResult<CentiPercent> {
  const text = input.trim().replace(/\s*%$/, '').trim();
  if (text === '') {
    return playerErr('INVALID_PERCENT', `${field} is empty`, { field, value: input });
  }
  if (!PERCENT_INPUT.test(text)) {
    return playerErr('INVALID_PERCENT', `${field} is not a non-negative number: "${input}"`, {
      field,
      value: input,
    });
  }
  const [, fraction = ''] = text.split('.');
  if (fraction.length > 2) {
    return playerErr(
      'INVALID_PERCENT',
      `${field} supports at most 2 decimal places, got "${input}"`,
      { field, value: input, expected: 'at most 2 decimal places' },
    );
  }
  // Exact: at most two decimals, so `text * 100` is an integer in double precision once
  // rounded off the parser's representation error (0.1 * 100 = 10.000000000000002).
  const value = Math.round(Number(text) * CENTI_PER_PERCENT);
  if (!isCentiPercent(value)) {
    return playerErr('INVALID_PERCENT', `${field} must be within 0..100, got "${input}"`, {
      field,
      value: input,
      min: 0,
      max: 100,
    });
  }
  return ok(value);
}

export interface FormatPercentOptions {
  /** Minimum decimals to show. Default 0 — "23" not "23.00". */
  readonly minDecimals?: number;
  /** Maximum decimals to show. Default 2 — full centipercent precision. */
  readonly maxDecimals?: number;
  /** Append "%". Default false. */
  readonly unit?: boolean;
}

/**
 * Format a centipercent for display. Never use the output for further math.
 *
 * When `maxDecimals` is below the stored precision the value is ROUNDED, half away from
 * zero — the same rule `Money`'s `'round'` mode uses, and the same direction a reader
 * expects. Truncating instead would under-report every value: `23.55` shown to one decimal
 * is `23.6`, not `23.5`. Rounding may carry into the next whole percent (`99.95` at one
 * decimal is `100`).
 *
 * This is DISPLAY ONLY. The stored `CentiPercent` and the verbatim text the user typed are
 * untouched, and `parsePercent` still refuses to round a third decimal away on input.
 */
export function formatPercent(value: CentiPercent, options: FormatPercentOptions = {}): string {
  const { minDecimals = 0, maxDecimals = 2, unit = false } = options;
  if (maxDecimals < minDecimals) throw new Error('maxDecimals < minDecimals');
  const places = Math.min(maxDecimals, 2);
  // Centipercent per displayed unit: 100 for whole percents, 10 for one decimal, 1 for two.
  const step = CENTI_PER_PERCENT / 10 ** places;
  // `CentiPercent` is non-negative, so `Math.round` (half up) IS half away from zero here.
  const rounded = Math.round(value / step) * step;
  const whole = Math.floor(rounded / CENTI_PER_PERCENT);
  const centi = rounded % CENTI_PER_PERCENT;
  let decimals = String(centi).padStart(2, '0').slice(0, places);
  while (decimals.length > minDecimals && decimals.endsWith('0')) decimals = decimals.slice(0, -1);
  const body = decimals.length > 0 ? `${whole}.${decimals}` : String(whole);
  return `${body}${unit ? '%' : ''}`;
}
