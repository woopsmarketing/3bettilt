import { describe, expect, it } from 'vitest';
import { exactHeadsUpEquity } from '@gto-self/learn-core';
import { parseCards } from '@gto-self/shared';
import {
  EQUITY_BOARD_SPECS,
  EQUITY_MATCHUP_SPECS,
  equityBoardExamples,
  equityMatchupExamples,
  equityTieExample,
} from './equityGuide.js';

function cards(text: string) {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

describe('equityGuide', () => {
  it('computes every example with exactHeadsUpEquity, nothing typed', () => {
    for (const example of [...equityMatchupExamples(), ...equityBoardExamples()]) {
      const outcome = exactHeadsUpEquity(
        cards(example.hero),
        cards(example.villain),
        example.board === '' ? [] : cards(example.board),
      );
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expect(example.result.equity).toBe(outcome.value.equity);
      expect(example.result.runouts).toBe(outcome.value.runouts);
      expect(example.result.method).toBe('EXACT');
    }
    // Eight exhaustive enumerations (four of them preflop, 1.7M runouts each): well over the
    // default 5s when the whole suite runs in parallel.
  }, 60_000);

  it('keeps the engine semantics: equity = win + tie / 2, and the three sum to one', () => {
    for (const example of [...equityMatchupExamples(), ...equityBoardExamples()]) {
      const { winProb, tieProb, equity, wins, ties, losses, runouts } = example.result;
      expect(equity).toBeCloseTo(winProb + tieProb / 2, 12);
      expect(wins + ties + losses).toBe(runouts);
    }
  }, 60_000);

  it('has the four matchup lessons the prose describes', () => {
    const byId = new Map(equityMatchupExamples().map((e) => [e.id, e]));
    const aaKk = byId.get('aa-kk');
    const akVs72 = byId.get('ak-72');
    const jtsVs22 = byId.get('jts-22');
    const mirror = byId.get('mirror');
    expect(aaKk && akVs72 && jtsVs22 && mirror).toBeTruthy();
    if (!aaKk || !akVs72 || !jtsVs22 || !mirror) return;
    // "a big favourite" / "close to a coin flip" / "AK still loses near 30%" / "a mirror"
    expect(aaKk.result.equity).toBeGreaterThan(0.75);
    expect(Math.abs(jtsVs22.result.equity - 0.5)).toBeLessThan(0.1);
    expect(1 - akVs72.result.equity).toBeGreaterThan(0.25);
    expect(mirror.result.equity).toBeCloseTo(0.5, 12);
    expect(mirror.result.tieProb).toBeGreaterThan(0.5);
  });

  it('the tie example is the mirror matchup', () => {
    expect(equityTieExample().id).toBe('mirror');
    expect(equityTieExample().result.winProb).toBeCloseTo(
      1 - equityTieExample().result.winProb - equityTieExample().result.tieProb,
      12,
    );
  });

  it('walks the same two hands from preflop to the turn, runouts shrinking each step', () => {
    const boards = equityBoardExamples();
    expect(boards.length).toBe(EQUITY_BOARD_SPECS.length);
    expect(boards[0]?.board).toBe('');
    const heroes = new Set(boards.map((b) => b.hero));
    const villains = new Set(boards.map((b) => b.villain));
    expect(heroes.size).toBe(1);
    expect(villains.size).toBe(1);
    const lengths = boards.map((b) => b.boardCards.length);
    expect(lengths).toEqual([0, 3, 3, 4]);
    expect(boards[0]?.result.runouts).toBeGreaterThan(boards[1]?.result.runouts ?? Infinity);
    expect(boards[1]?.result.runouts).toBeGreaterThan(boards[3]?.result.runouts ?? Infinity);
  });

  it('every spec has a title in Korean and no verdict', () => {
    for (const spec of [...EQUITY_MATCHUP_SPECS, ...EQUITY_BOARD_SPECS]) {
      expect(spec.title).toMatch(/[가-힣]/u);
      expect(spec.title).not.toMatch(/콜|폴드|레이즈/u);
    }
  });
});
