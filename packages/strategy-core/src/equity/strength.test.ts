/**
 * The cheap made-hand-strength distribution. Expectations here are structural (orderings,
 * conservation of weight, the meaning of a percentile) plus a handful of boards where the
 * answer can be reasoned out without any enumeration.
 */
import { parseCards, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { evaluateStrength } from '../analysis/evaluate.js';
import { nutStrengthOnBoard } from '../analysis/heroHand.js';
import { comboIndexOf, type ComboIndex } from '../range/combo.js';
import { emptyRange, rangeFromEntries, uniformRange, type RangeWeights } from '../range/weights.js';
import {
  buildStrengthDistribution,
  comboStrengthPercentile,
  nutDensity,
  strengthPercentile,
  weightAtBps,
  weightAtOrAboveBps,
} from './strength.js';

function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(`bad cards "${text}": ${parsed.error}`);
  return parsed.value;
}

function combo(text: string): ComboIndex {
  const [a, b] = cards(text);
  if (a === undefined || b === undefined) throw new Error(`not two cards: ${text}`);
  return comboIndexOf(a, b);
}

function range(entries: readonly (readonly [string, number])[]): RangeWeights {
  const built = rangeFromEntries(entries.map(([text, weight]) => [combo(text), weight] as const));
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe('buildStrengthDistribution', () => {
  it('is sorted strongest first and conserves the range weight', () => {
    const board = cards('Ah Kh 7c');
    const dist = buildStrengthDistribution(uniformRange(), board);
    if (!dist.ok) throw new Error(dist.error.message);
    // 49 cards remain, so C(49,2) = 1176 combos survive board removal.
    expect(dist.value.entries.length).toBe(1176);
    expect(dist.value.totalWeightBps).toBe(1176 * 10000);
    expect(dist.value.cumulativeBps.at(-1)).toBe(dist.value.totalWeightBps);
    for (let i = 1; i < dist.value.entries.length; i += 1) {
      const previous = dist.value.entries[i - 1];
      const current = dist.value.entries[i];
      expect((previous?.strength ?? 0) >= (current?.strength ?? 0)).toBe(true);
      if (previous?.strength === current?.strength) {
        expect((current?.combo ?? 0) > (previous?.combo ?? 0)).toBe(true);
      }
    }
  });

  it('the strongest entry really is the strongest hand, checked against the evaluator', () => {
    const board = cards('Ah Kh 7c');
    const dist = buildStrengthDistribution(uniformRange(), board);
    if (!dist.ok) throw new Error(dist.error.message);
    const top = dist.value.entries[0];
    if (top === undefined) throw new Error('empty distribution');
    // On a board with no possible flush and no possible straight, the best two cards are a
    // set of aces: Ad Ac (or Ad As / Ac As). All make the same strength.
    expect(top.strength).toBe(evaluateStrength([...board, ...cards('Ad Ac')]));
    expect(top.strength).toBe(dist.value.nutStrength);
  });

  it('reuses nutStrengthOnBoard rather than deriving its own notion of the nuts', () => {
    const board = cards('Th 9h 8h');
    const dist = buildStrengthDistribution(uniformRange(), board);
    if (!dist.ok) throw new Error(dist.error.message);
    expect(dist.value.nutStrength).toBe(nutStrengthOnBoard(board));
  });

  it('accepts a precomputed nut strength (the batch path)', () => {
    const board = cards('Th 9h 8h');
    const nutStrength = nutStrengthOnBoard(board);
    const dist = buildStrengthDistribution(uniformRange(), board, { nutStrength });
    if (!dist.ok) throw new Error(dist.error.message);
    expect(dist.value.nutStrength).toBe(nutStrength);
  });

  it('removes board cards from the range', () => {
    const board = cards('Ah Kh 7c');
    const dist = buildStrengthDistribution(
      range([
        ['Ah Kh', 10000],
        ['Ad Ac', 10000],
      ]),
      board,
    );
    if (!dist.ok) throw new Error(dist.error.message);
    expect(dist.value.entries.length).toBe(1);
    expect(dist.value.entries[0]?.combo).toBe(combo('Ad Ac'));
  });

  it('refuses a preflop board and an empty range with typed errors', () => {
    const preflop = buildStrengthDistribution(uniformRange(), []);
    expect(preflop.ok).toBe(false);
    if (preflop.ok) throw new Error('expected a refusal');
    expect(preflop.error.code).toBe('INVALID_BOARD');

    const empty = buildStrengthDistribution(emptyRange(), cards('Ah Kh 7c'));
    expect(empty.ok).toBe(false);
    if (empty.ok) throw new Error('expected a refusal');
    expect(empty.error.code).toBe('ZERO_MASS_RANGE');
  });
});

describe('percentiles and weights', () => {
  // A K 9 7 2 rainbow-enough: only two hearts, and no five-rank window has three of its
  // ranks on the board, so neither a flush nor a straight is available to any holding. The
  // nuts here is a set of aces, which makes every expectation below checkable by hand.
  const board = cards('Ah Ks 7c 2d 9h');

  it('a hand that beats the whole range scores 1, one that loses to all of it scores 0', () => {
    const villain = range([
      ['9d 9c', 10000],
      ['5h 4h', 10000],
    ]);
    const dist = buildStrengthDistribution(villain, board);
    if (!dist.ok) throw new Error(dist.error.message);
    // Trip aces beat trip nines and beat ace-king-nine-seven-five. Four-three plays the
    // board with a four and loses to both.
    const monster = evaluateStrength([...board, ...cards('Ad Ac')]);
    const trash = evaluateStrength([...board, ...cards('4c 3c')]);
    expect(strengthPercentile(dist.value, monster)).toBe(1);
    expect(strengthPercentile(dist.value, trash)).toBe(0);
  });

  it('a hand that ties the entire range scores exactly 0.5 — the chop convention', () => {
    // On a board that is already a royal flush every holding is the same strength.
    const royal = cards('Ah Kh Qh Jh Th');
    const dist = buildStrengthDistribution(uniformRange(), royal);
    if (!dist.ok) throw new Error(dist.error.message);
    const boardStrength = evaluateStrength([...royal, ...cards('2c 3d')]);
    expect(strengthPercentile(dist.value, boardStrength)).toBe(0.5);
    expect(nutDensity(dist.value)).toBe(1);
  });

  it('weightAtOrAbove and weightAt split the range at a threshold', () => {
    const villain = range([
      ['Ad Ac', 6000],
      ['Kh Kc', 3000],
      ['5h 4h', 1000],
    ]);
    const dist = buildStrengthDistribution(villain, board);
    if (!dist.ok) throw new Error(dist.error.message);
    expect(dist.value.totalWeightBps).toBe(10000);
    const acesFull = evaluateStrength([...board, ...cards('Ad Ac')]);
    const kings = evaluateStrength([...board, ...cards('Kh Kc')]);
    expect(weightAtBps(dist.value, acesFull)).toBe(6000);
    expect(weightAtOrAboveBps(dist.value, acesFull)).toBe(6000);
    expect(weightAtOrAboveBps(dist.value, kings)).toBe(9000);
    // Three of a kind aces beats three of a kind kings, so the top 60% is the aces.
    expect(strengthPercentile(dist.value, kings)).toBeCloseTo((1000 + 3000 / 2) / 10000, 12);
  });

  it('nutDensity is the weighted share of the range holding the actual nuts', () => {
    const villain = range([
      ['Ad Ac', 2500],
      ['Kh Kc', 5000],
      ['5h 4h', 2500],
    ]);
    const dist = buildStrengthDistribution(villain, board);
    if (!dist.ok) throw new Error(dist.error.message);
    // The nuts on A K 9 7 2 with no flush or straight available is a set of aces; exactly
    // one combo of this range holds it.
    expect(dist.value.nutStrength).toBe(evaluateStrength([...board, ...cards('Ad Ac')]));
    expect(nutDensity(dist.value)).toBeCloseTo(0.25, 12);
  });

  it('comboStrengthPercentile answers for a combo and refuses one that is not there', () => {
    const villain = range([
      ['Ad Ac', 5000],
      ['5h 4h', 5000],
    ]);
    const dist = buildStrengthDistribution(villain, board);
    if (!dist.ok) throw new Error(dist.error.message);
    expect(comboStrengthPercentile(dist.value, combo('Ad Ac'))).toBe(0.75);
    expect(comboStrengthPercentile(dist.value, combo('5h 4h'))).toBe(0.25);
    expect(comboStrengthPercentile(dist.value, combo('7d 7s'))).toBeUndefined();
  });

  it('percentiles are monotone in strength across a whole uniform range', () => {
    const dist = buildStrengthDistribution(uniformRange(), cards('Th 9h 8h'));
    if (!dist.ok) throw new Error(dist.error.message);
    let previous = Number.POSITIVE_INFINITY;
    let lastPercentile = Number.POSITIVE_INFINITY;
    for (const entry of dist.value.entries) {
      if (entry.strength === previous) continue;
      const percentile = strengthPercentile(dist.value, entry.strength);
      expect(percentile).toBeLessThanOrEqual(lastPercentile);
      lastPercentile = percentile;
      previous = entry.strength;
    }
  });
});
