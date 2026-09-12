/**
 * Number formatting for 3BetTilt's calculators.
 *
 * Nothing here computes a poker fact — every value arriving at these functions was already
 * produced by `@gto-self/learn-core`. What this module owns is the last step before a
 * reader sees it: how many decimals, which sign, which unit. It exists as its own module
 * because the pot-odds page and the outs page must render the same quantity the same way —
 * "35.0%" on one page and "35%" on the other would read as two different numbers.
 *
 * ## Percent vs percentage point
 *
 * A probability rendered as a percentage uses `%`. The DIFFERENCE between two percentages
 * uses `%p`, because "the shortcut is 1% off" and "the shortcut is 1 percentage point off"
 * are different claims and the outs page makes the second one. Korean technical writing
 * uses `%p` for exactly this distinction, so the unit is not decoration.
 *
 * ## Why `Math.abs` before `toFixed`
 *
 * `(-0.0004).toFixed(1)` is `"-0.0"`, a signed zero a reader has to stop and parse. The
 * signed formatter therefore formats the MAGNITUDE and decides the sign from the ROUNDED
 * result, so the sign a reader sees and the digits they see can never disagree.
 */
import { Money, type MilliBB } from '@gto-self/shared';

/** One decimal everywhere, so the same probability reads identically on both tool pages. */
export const PERCENT_FRACTION_DIGITS = 1;

function fixed(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) {
    // Unreachable from `learn-core`, which returns finite probabilities and finite ratios
    // over a non-zero denominator. Loud rather than plausible (CLAUDE.md rule 5).
    throw new Error(`Cannot format a non-finite number: ${value}`);
  }
  return value.toFixed(fractionDigits);
}

/** `0.25` -> `"25.0%"`. Input is a proportion in `0..1`, never an already-scaled percent. */
export function formatPercent(
  proportion: number,
  fractionDigits: number = PERCENT_FRACTION_DIGITS,
): string {
  return `${fixed(proportion * 100, fractionDigits)}%`;
}

/**
 * A signed difference between two proportions, in percentage points: `0.0588` -> `"+5.9%p"`,
 * `-0.0112` -> `"-1.1%p"`. A difference that rounds away to nothing prints `"0.0%p"` with no
 * sign at all rather than `"+0.0%p"` or `"-0.0%p"`.
 */
export function formatSignedPercentagePoints(
  delta: number,
  fractionDigits: number = PERCENT_FRACTION_DIGITS,
): string {
  const magnitude = fixed(Math.abs(delta) * 100, fractionDigits);
  const sign = Number(magnitude) === 0 ? '' : delta > 0 ? '+' : '-';
  return `${sign}${magnitude}%p`;
}

/** The rounded sign of a percentage-point difference, so words and digits cannot disagree. */
export function signOfPercentagePoints(
  delta: number,
  fractionDigits: number = PERCENT_FRACTION_DIGITS,
): -1 | 0 | 1 {
  const rounded = Number(fixed(delta * 100, fractionDigits));
  if (rounded > 0) return 1;
  if (rounded < 0) return -1;
  return 0;
}

/** A plain ratio such as `oneInN` or `oddsAgainst`: `4` -> `"4.0"`. Not money, not a percent. */
export function formatMultiplier(value: number, fractionDigits = 1): string {
  return fixed(value, fractionDigits);
}

/**
 * Money for display: `5000` -> `"5 BB"`, `1667` -> `"1.667 BB"`.
 *
 * Three decimals, not two: a milliBB is the smallest amount this app can hold, and a pot
 * built from a one-third-pot shortcut lands on values like 1.667 BB. Truncating that to
 * "1.67 BB" would show a number the calculator did not use.
 */
export function formatAmountBB(amount: MilliBB): string {
  return Money.formatBB(amount, { maxDecimals: 3, unit: true });
}

/** The same amount without the unit, for a spot that already says "BB" beside it. */
export function formatAmountValue(amount: MilliBB): string {
  return Money.formatBB(amount, { maxDecimals: 3 });
}
