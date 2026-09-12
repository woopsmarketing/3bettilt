import { describe, expect, it } from 'vitest';
import { outsOdds } from '@gto-self/learn-core';
import { DRAW_PRESETS } from '../draws.js';
import { shortcutComparisons } from '../outsView.js';
import {
  OUTS_TABLE_COUNTS,
  outsTableRows,
  outsWalkthrough,
  overlappingDrawPreset,
  riverShortcutDirections,
} from './outsGuide.js';

describe('outsGuide', () => {
  it("every table row is outsOdds() and the tool's own shortcutComparisons", () => {
    for (const street of ['FLOP', 'TURN'] as const) {
      const rows = outsTableRows(street);
      expect(rows.map((row) => row.outs)).toEqual([...OUTS_TABLE_COUNTS]);
      for (const row of rows) {
        const odds = outsOdds({ outs: row.outs, street });
        expect(odds.ok).toBe(true);
        if (!odds.ok) continue;
        expect(row.odds).toEqual(odds.value);
        expect(row.comparisons).toEqual(shortcutComparisons(odds.value));
        expect(row.preset?.outs ?? row.outs).toBe(row.outs);
      }
    }
  });

  it('names a row after a preset only when a preset has exactly that many outs', () => {
    const presetOuts = new Set(DRAW_PRESETS.map((preset) => preset.outs));
    for (const row of outsTableRows('FLOP')) {
      expect(row.preset !== undefined).toBe(presetOuts.has(row.outs));
    }
  });

  it('the ×4 shortcut runs under the exact value at the smallest count and over at the largest', () => {
    const { first, last } = riverShortcutDirections('FLOP');
    expect(first.id).toBe('BY_RIVER');
    expect(last.id).toBe('BY_RIVER');
    expect(first.direction).toBe('UNDER');
    expect(last.direction).toBe('OVER');
    expect(first.error).toBeLessThan(0);
    expect(last.error).toBeGreaterThan(0);
  });

  it('walks the flush draw preset on both streets', () => {
    const walk = outsWalkthrough();
    expect(walk.preset.id).toBe('flushDraw');
    expect(walk.flop.street).toBe('FLOP');
    expect(walk.turn.street).toBe('TURN');
    expect(walk.flop.outs).toBe(walk.preset.outs);
    expect(walk.flop.unseenCards).toBe(47);
    expect(walk.turn.unseenCards).toBe(46);
    expect(walk.flop.byRiverProb).toBeCloseTo(
      walk.flop.nextCardProb + walk.flop.missThenHitProb,
      12,
    );
  });

  it('the overlapping preset counts fewer outs than the sum of its parts', () => {
    const overlap = overlappingDrawPreset();
    const flush = DRAW_PRESETS.find((p) => p.id === 'flushDraw');
    const open = DRAW_PRESETS.find((p) => p.id === 'openEnded');
    expect(flush && open).toBeTruthy();
    if (!flush || !open) return;
    expect(overlap.outs).toBeLessThan(flush.outs + open.outs);
    expect(overlap.outs).toBeGreaterThan(flush.outs);
  });
});
