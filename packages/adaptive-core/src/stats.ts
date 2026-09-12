/**
 * The stat vocabulary the ADAPTIVE layer reasons over, and nothing else.
 *
 * These 17 keys are the ONLY facts about an opponent that can ever reach a rule. That is a
 * deliberate ceiling, not a stage of growth: a closed union means a new opponent fact is a
 * reviewed addition to this file plus an exhaustive-map compile error everywhere it is
 * displayed, never an untyped string that quietly appears in a trace.
 *
 * A key is a NAME, not a number and not a claim. Nothing here says what a value should be;
 * `priors.ts` holds the zero-adjustment anchors and `profile.ts` holds the arithmetic.
 *
 * Display copy (Korean labels, tooltips) lives in `apps/web/src/lib/table/copy.ts` as an
 * exhaustive `Readonly<Record<AdaptiveStatKey, string>>`. This package is copy-free: it is
 * imported by a server module and by tests, and neither should carry a language.
 */

/**
 * The 17 stats of the WP-J design contract §2.1, plus 3 generic street-blind readings
 * added by WP-K (`CBET_ANY_STREET`, `FOLD_TO_CBET_ANY_STREET`, `CHECK_RAISE_ANY_STREET`),
 * in that order.
 *
 * The grouping below is the reading order and is load-bearing for `ADAPTIVE_STAT_KEYS`:
 * preflop entry, blind-vs-steal, betting by street, folding by street, check-raising by
 * street, the two showdown stats, then the three generic readings.
 */
export type AdaptiveStatKey =
  // Preflop entry and preflop aggression
  | 'VPIP'
  | 'PFR'
  | 'THREE_BET'
  | 'FOLD_TO_THREE_BET'
  // Steal and blind defence
  | 'STEAL'
  | 'FOLD_BB_TO_STEAL'
  // Betting as the previous street's aggressor
  | 'CBET_FLOP'
  | 'CBET_TURN'
  | 'CBET_RIVER'
  // Folding to that bet
  | 'FOLD_TO_CBET_FLOP'
  | 'FOLD_TO_CBET_TURN'
  | 'FOLD_TO_CBET_RIVER'
  // Raising it instead
  | 'CHECK_RAISE_FLOP'
  | 'CHECK_RAISE_TURN'
  | 'CHECK_RAISE_RIVER'
  // Showdown
  | 'WTSD'
  | 'WSD'
  // Generic, street-blind readings (WP-K) — an external HUD reports one Cont-Bet /
  // Fold-to-C-Bet / Check-Raise number with no street breakdown. These are deliberately
  // SEPARATE from the six per-street keys above: folding a generic reading onto (say)
  // `CBET_FLOP` would claim a street-specific fact nobody measured. A rule that wants to
  // read "this opponent's continuation-bet tendency, however it was measured" reads both;
  // nothing here merges them into one number.
  | 'CBET_ANY_STREET'
  | 'FOLD_TO_CBET_ANY_STREET'
  | 'CHECK_RAISE_ANY_STREET';

/**
 * Every member of `AdaptiveStatKey`, in declaration order.
 *
 * The order is part of the contract: it fixes the iteration order of
 * `PlayerAdjustmentProfile.stats`, and therefore the key order of its `JSON.stringify`,
 * which the determinism test compares as a string.
 */
export const ADAPTIVE_STAT_KEYS: readonly AdaptiveStatKey[] = [
  'VPIP',
  'PFR',
  'THREE_BET',
  'FOLD_TO_THREE_BET',
  'STEAL',
  'FOLD_BB_TO_STEAL',
  'CBET_FLOP',
  'CBET_TURN',
  'CBET_RIVER',
  'FOLD_TO_CBET_FLOP',
  'FOLD_TO_CBET_TURN',
  'FOLD_TO_CBET_RIVER',
  'CHECK_RAISE_FLOP',
  'CHECK_RAISE_TURN',
  'CHECK_RAISE_RIVER',
  'WTSD',
  'WSD',
  'CBET_ANY_STREET',
  'FOLD_TO_CBET_ANY_STREET',
  'CHECK_RAISE_ANY_STREET',
];

/**
 * Where one reading of a stat came from. All three are PERMANENTLY separate and are never
 * merged in storage, never overwrite each other, and survive individually into
 * `AdaptiveStatEstimate.sources` even after they have been pooled into one estimate.
 *
 * - `MANUAL_HUD`    — testimony the user typed in about what a third-party HUD displayed
 *                     in a SHORT reading. Its sample size is a HAND count, not this stat's
 *                     opportunity count, which is why the caller caps it per stat
 *                     (`manualHudSampleCap` in `inputs.ts`) so a HUD reading alone tops out
 *                     at 3333 bps confidence.
 * - `LEARNED_MODEL` — counts this project derived from its own recorded hands. Its sample
 *                     size is a real OPPORTUNITY count for that specific stat.
 * - `EXTERNAL_HUD`  — a bulk-imported LIFETIME reading from a third-party HUD (WP-K). No
 *                     hand count is ever attached (an unknown `n` is not fabricated), so it
 *                     is not pooled through the `n/(n+K)` formula the other two share — it
 *                     gets a fixed policy confidence (`EXTERNAL_HUD_CONFIDENCE_BPS`,
 *                     `priors.ts`) and, where present for a stat, TAKES PRECEDENCE over
 *                     pooling `MANUAL_HUD`/`LEARNED_MODEL` for that stat (`profile.ts`,
 *                     ADR-0067) rather than being averaged in with them.
 */
export type AdaptiveStatSource = 'MANUAL_HUD' | 'LEARNED_MODEL' | 'EXTERNAL_HUD';

/**
 * Every member of `AdaptiveStatSource`, in the order source references are emitted.
 *
 * `buildAdjustmentProfile` orders `AdaptiveStatEstimate.sources` by THIS array rather than
 * by the order observations arrived in, so two inputs that differ only in observation order
 * produce identical output.
 */
export const ADAPTIVE_STAT_SOURCES: readonly AdaptiveStatSource[] = [
  'EXTERNAL_HUD',
  'MANUAL_HUD',
  'LEARNED_MODEL',
];

/** Total. True for the 20 known members and nothing else. */
export function isAdaptiveStatKey(value: unknown): value is AdaptiveStatKey {
  return typeof value === 'string' && (ADAPTIVE_STAT_KEYS as readonly string[]).includes(value);
}

/** Total. True for the three known members and nothing else. */
export function isAdaptiveStatSource(value: unknown): value is AdaptiveStatSource {
  return value === 'MANUAL_HUD' || value === 'LEARNED_MODEL' || value === 'EXTERNAL_HUD';
}
