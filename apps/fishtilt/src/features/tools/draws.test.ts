import { describe, expect, it } from 'vitest';
import { RANKS, SUITS } from '@gto-self/shared';
import { UNSEEN_AFTER_TURN } from '@gto-self/learn-core';
import { DRAW_PRESETS, drawPresetWithOuts } from './draws.js';

/*
 * These are the only counts in the app that are not returned by `learn-core`, so they get
 * the strictest test in this folder: each one is checked against the count a person would
 * reach by hand, and the derivation sentence shown beside it has to contain that same
 * number — a preset whose prose and value disagree would teach the reader to distrust the
 * page (CLAUDE.md rules 2 and 5).
 */
const OUTS_BY_ID: Readonly<Record<string, number>> = {
  set: 2,
  gutshot: 4,
  overcards: 6,
  openEnded: 8,
  flushDraw: 9,
  flushPlusGutshot: 12,
  flushPlusOpenEnded: 15,
};

describe('DRAW_PRESETS', () => {
  it('covers exactly the draws it claims to, with the counts a beginner can verify', () => {
    expect(DRAW_PRESETS.map((preset) => preset.id)).toEqual(Object.keys(OUTS_BY_ID));
    for (const preset of DRAW_PRESETS) {
      expect(preset.outs, preset.id).toBe(OUTS_BY_ID[preset.id]);
    }
  });

  it('derives every count from the deck, so a 52-card assumption change cannot be silent', () => {
    // Stated as the relationships, not as literals: if `SUITS`/`RANKS` ever changed, these
    // would move together with the presets instead of both being wrong.
    const bySuit = new Map(DRAW_PRESETS.map((preset) => [preset.id, preset.outs]));
    expect(bySuit.get('set')).toBe(SUITS.length - 2);
    expect(bySuit.get('gutshot')).toBe(SUITS.length);
    expect(bySuit.get('overcards')).toBe(2 * (SUITS.length - 1));
    expect(bySuit.get('openEnded')).toBe(2 * SUITS.length);
    expect(bySuit.get('flushDraw')).toBe(RANKS.length - 4);
  });

  it('subtracts the overlap on a combined draw instead of adding the two halves', () => {
    const outsOf = (id: string) => DRAW_PRESETS.find((preset) => preset.id === id)?.outs ?? -1;
    expect(outsOf('flushPlusGutshot')).toBe(outsOf('flushDraw') + outsOf('gutshot') - 1);
    expect(outsOf('flushPlusOpenEnded')).toBe(outsOf('flushDraw') + outsOf('openEnded') - 2);
  });

  it('states the count it shows inside its own derivation sentence', () => {
    for (const preset of DRAW_PRESETS) {
      expect(preset.derivation, preset.id).toContain(String(preset.outs));
      expect(preset.derivation.length, preset.id).toBeGreaterThan(10);
    }
  });

  it('is sorted fewest outs first and has no duplicate count', () => {
    const counts = DRAW_PRESETS.map((preset) => preset.outs);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(new Set(counts).size).toBe(counts.length);
  });

  it('stays inside what the deck can supply on either street', () => {
    for (const preset of DRAW_PRESETS) {
      expect(preset.outs, preset.id).toBeGreaterThan(0);
      // The turn is the tighter bound, so a preset legal there is legal on the flop too.
      expect(preset.outs, preset.id).toBeLessThanOrEqual(UNSEEN_AFTER_TURN);
    }
  });

  it('never says "GTO"', () => {
    for (const preset of DRAW_PRESETS) {
      expect(`${preset.label} ${preset.derivation}`.toUpperCase()).not.toContain('GTO');
    }
  });
});

describe('drawPresetWithOuts', () => {
  it('finds the preset a count corresponds to', () => {
    expect(drawPresetWithOuts(9)?.id).toBe('flushDraw');
    expect(drawPresetWithOuts(15)?.id).toBe('flushPlusOpenEnded');
  });

  it('returns undefined rather than the nearest preset', () => {
    expect(drawPresetWithOuts(7)).toBeUndefined();
    expect(drawPresetWithOuts(0)).toBeUndefined();
  });
});

/*
 * WP-Q2 / P2-m10. The preset was labelled `것샷`; the standard Korean rendering of "gutshot"
 * is 거트샷, and the site uses that spelling nowhere else in `src/**`.
 */
describe('draw preset spelling', () => {
  it('spells gutshot 거트샷 everywhere it appears', () => {
    for (const preset of DRAW_PRESETS) {
      expect(preset.label).not.toContain('것샷');
      expect(preset.derivation).not.toContain('것샷');
    }
    const gutshot = DRAW_PRESETS.find((preset) => preset.id === 'gutshot');
    expect(gutshot?.label).toContain('거트샷');
    expect(DRAW_PRESETS.find((preset) => preset.id === 'flushPlusGutshot')?.label).toContain(
      '거트샷',
    );
  });
});
