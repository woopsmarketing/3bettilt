import { describe, expect, it } from 'vitest';
import {
  DRAW_STREETS,
  OUTS_ERRORS,
  POT_ODDS_ERRORS,
  UNSEEN_AFTER_FLOP,
  UNSEEN_AFTER_TURN,
} from '@gto-self/learn-core';
import { AMOUNT_ERRORS, OUTS_INPUT_ERRORS } from './amount.js';
import {
  AMOUNT_ERROR_LABEL,
  OUTS_INPUT_ERROR_LABEL,
  OUTS_STREETS,
  POT_ODDS_ERROR_LABEL,
  RIVER_HORIZON_LABEL,
  SHORTCUT_DIRECTION_LABEL,
  STREET_LABEL,
  STREET_SHORT_LABEL,
  outsErrorLabel,
} from './copy.js';

/*
 * The compiler already guarantees these maps are exhaustive — that is the point of typing
 * them against the domain's own unions. What the compiler cannot check is that a message is
 * a real Korean sentence rather than a placeholder, and that no error text leaks a domain
 * enum name at a beginner.
 */
const ALL_LABELS = [
  ...Object.values(AMOUNT_ERROR_LABEL),
  ...Object.values(OUTS_INPUT_ERROR_LABEL),
  ...Object.values(POT_ODDS_ERROR_LABEL),
  ...Object.values(STREET_LABEL),
  ...Object.values(STREET_SHORT_LABEL),
  ...Object.values(RIVER_HORIZON_LABEL),
  ...Object.values(SHORTCUT_DIRECTION_LABEL),
  ...DRAW_STREETS.flatMap((street) => OUTS_ERRORS.map((error) => outsErrorLabel(error, street))),
];

describe('calculator copy', () => {
  it('has a message for every domain error, keyed by the domain’s own union', () => {
    expect(Object.keys(POT_ODDS_ERROR_LABEL).sort()).toEqual([...POT_ODDS_ERRORS].sort());
    expect(Object.keys(AMOUNT_ERROR_LABEL).sort()).toEqual([...AMOUNT_ERRORS].sort());
    expect(Object.keys(OUTS_INPUT_ERROR_LABEL).sort()).toEqual([...OUTS_INPUT_ERRORS].sort());
  });

  it('writes every message in Korean, never as a raw enum name', () => {
    for (const label of ALL_LABELS) {
      // "턴" is one syllable and a complete label, so the floor is "not empty", not "long".
      expect(label.length).toBeGreaterThan(0);
      expect(label, label).toMatch(/[가-힣]/u);
      expect(label).not.toMatch(/[A-Z]{3,}_/u);
    }
  });

  it('never says "GTO"', () => {
    for (const label of ALL_LABELS) {
      expect(label.toUpperCase()).not.toContain('GTO');
    }
  });

  it('tells a reader the real unseen-card count for the street they are on', () => {
    expect(outsErrorLabel('OUTS_EXCEED_UNSEEN', 'FLOP')).toContain(String(UNSEEN_AFTER_FLOP));
    expect(outsErrorLabel('OUTS_EXCEED_UNSEEN', 'TURN')).toContain(String(UNSEEN_AFTER_TURN));
    expect(outsErrorLabel('OUTS_EXCEED_UNSEEN', 'FLOP')).not.toContain(String(UNSEEN_AFTER_TURN));
  });

  it('throws for an out error it has no message for, rather than rendering nothing', () => {
    expect(() => outsErrorLabel('NOT_A_REAL_ERROR' as never, 'FLOP')).toThrow();
  });

  it('offers exactly the streets a draw can be priced on', () => {
    expect(OUTS_STREETS).toEqual(DRAW_STREETS);
    expect(OUTS_STREETS).toHaveLength(2);
  });

  it('names the cards still to come in the street label itself', () => {
    expect(STREET_LABEL.FLOP).toContain('2장');
    expect(STREET_LABEL.TURN).toContain('1장');
  });

  it('describes the shortcut’s error in words, not by a sign alone', () => {
    expect(SHORTCUT_DIRECTION_LABEL.OVER).toContain('높게');
    expect(SHORTCUT_DIRECTION_LABEL.UNDER).toContain('낮게');
    expect(SHORTCUT_DIRECTION_LABEL.SAME).toContain('같습니다');
  });
});

/*
 * WP-Q2 / P2-M5. The site canon is 플랍 — every lesson, blog post and hand page uses it. The
 * outs calculator's own street button said 플롭, so a reader who learned 플랍 in lesson 11 met
 * a differently-spelled control on the tool that lesson points at.
 */
describe('street labels use the site’s canonical spelling', () => {
  it('says 플랍, never 플롭', () => {
    for (const label of [...Object.values(STREET_LABEL), ...Object.values(STREET_SHORT_LABEL)]) {
      expect(label).not.toContain('플롭');
    }
    expect(STREET_LABEL.FLOP).toContain('플랍');
    expect(STREET_SHORT_LABEL.FLOP).toBe('플랍');
  });
});
