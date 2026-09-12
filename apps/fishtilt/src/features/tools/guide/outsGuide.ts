/**
 * The ×2 / ×4 comparison table under `/tools/outs` (WP-S3-14). Every cell is read from
 * `@gto-self/learn-core`'s `outsOdds` — the exact hypergeometric probability and the
 * shortcut's own claim, with the signed gap the engine already computes. Nothing here is
 * typed as a percentage, and the DIRECTION of the shortcut's error is derived from the sign
 * of that gap (`outsView.ts`'s rule), never described from memory: `outs/page.test.tsx`
 * already proved the old "always overstates" wording wrong.
 */
import { outsOdds, type DrawStreet, type OutsOdds } from '@gto-self/learn-core';
import { DRAW_PRESETS, type DrawPreset } from '../draws.js';
import { shortcutComparisons, type ShortcutComparison } from '../outsView.js';

/** The out counts the table walks: the common draws plus the ends where the gap widens. */
export const OUTS_TABLE_COUNTS: readonly number[] = [2, 4, 6, 8, 9, 12, 15, 20];

export interface OutsTableRow {
  readonly outs: number;
  readonly street: DrawStreet;
  readonly odds: OutsOdds;
  /** One or two comparisons — `shortcutComparisons`' own shape (two on the flop, one on the turn). */
  readonly comparisons: readonly ShortcutComparison[];
  /** The draw preset with exactly this many outs, if one exists — a name for the row. */
  readonly preset: DrawPreset | undefined;
}

export function outsTableRows(street: DrawStreet = 'FLOP'): readonly OutsTableRow[] {
  return OUTS_TABLE_COUNTS.map((outs) => {
    const outcome = outsOdds({ outs, street });
    if (!outcome.ok)
      throw new Error(`outs guide: ${outs} outs on ${street} is not a draw (${outcome.error})`);
    return {
      outs,
      street,
      odds: outcome.value,
      comparisons: shortcutComparisons(outcome.value),
      preset: DRAW_PRESETS.find((preset) => preset.outs === outs),
    };
  });
}

/** The example the prose walks through: the flush draw, the first draw a beginner meets. */
export function outsWalkthrough(): {
  readonly preset: DrawPreset;
  readonly flop: OutsOdds;
  readonly turn: OutsOdds;
} {
  const preset = DRAW_PRESETS.find((candidate) => candidate.id === 'flushDraw');
  if (preset === undefined) throw new Error('outs guide: no flush-draw preset');
  const flop = outsOdds({ outs: preset.outs, street: 'FLOP' });
  const turn = outsOdds({ outs: preset.outs, street: 'TURN' });
  if (!flop.ok || !turn.ok) throw new Error('outs guide: the flush draw did not price');
  return { preset, flop: flop.value, turn: turn.value };
}

/** The preset whose derivation subtracts a double count — the "겹치는 아웃" example. */
export function overlappingDrawPreset(): DrawPreset {
  const preset = DRAW_PRESETS.find((candidate) => candidate.id === 'flushPlusOpenEnded');
  if (preset === undefined) throw new Error('outs guide: no flush+open-ended preset');
  return preset;
}

/**
 * Across the table, on which side the ×4 shortcut lands at the smallest and the largest out
 * count — read from the rows so the sentence "at few outs it is under, at many it is over"
 * is a fact about this table rather than a memory of one.
 */
export function riverShortcutDirections(street: DrawStreet = 'FLOP'): {
  readonly first: ShortcutComparison;
  readonly last: ShortcutComparison;
} {
  const rows = outsTableRows(street);
  const first = rows[0]?.comparisons.find((c) => c.id === 'BY_RIVER');
  const last = rows[rows.length - 1]?.comparisons.find((c) => c.id === 'BY_RIVER');
  if (first === undefined || last === undefined) throw new Error('outs guide: empty table');
  return { first, last };
}
