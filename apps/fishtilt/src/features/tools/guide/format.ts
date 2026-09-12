/**
 * Formatting shared by the six tool GUIDES (`src/components/tools/*Guide.tsx`).
 *
 * The calculators print one decimal (`features/tools/format.ts`, `PERCENT_FRACTION_DIGITS`),
 * because a live readout that a reader watches move should not jitter in its last digit. The
 * guides underneath them quote FROZEN worked examples — a table of eight out counts, four
 * boards for one matchup — and those follow the convention every `<Fact>` in the site's
 * articles already uses (`src/content/facts.ts`, "Rounding"): two decimals, so two datasets
 * that sit close together (53.95% vs 56.76%) do not collapse into the same printed number.
 *
 * Nothing here computes a poker fact. Every value arriving here was produced by
 * `@gto-self/learn-core` or `@gto-self/strategy-core`.
 */

const KOREAN = 'ko-KR';

/** `0.8264` -> `"82.64%"`. The two-decimal form the site's articles use for a quoted figure. */
export function guidePercent(proportion: number): string {
  if (!Number.isFinite(proportion)) {
    throw new Error(`Cannot format a non-finite proportion: ${proportion}`);
  }
  return `${(proportion * 100).toFixed(2)}%`;
}

/** `1712304` -> `"1,712,304"`. Korean digit grouping, as everywhere else on the site. */
export function guideCount(count: number): string {
  if (!Number.isInteger(count)) {
    throw new Error(`Cannot format a non-integer count: ${count}`);
  }
  return count.toLocaleString(KOREAN);
}
