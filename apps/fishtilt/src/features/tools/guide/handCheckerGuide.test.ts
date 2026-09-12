import { describe, expect, it } from 'vitest';
import { categoryFrequencyOf, FIVE_CARD_HAND_COUNT } from '@gto-self/learn-core';
import {
  bestFiveOf,
  compareHands,
  evaluateStrength,
  HAND_CATEGORIES,
} from '@gto-self/strategy-core';
import { parseCards } from '@gto-self/shared';
import {
  bestFiveExample,
  boardPlaysExample,
  categoryFrequencyRows,
  FIVE_CARD_HANDS_TOTAL,
  showdownExamples,
} from './handCheckerGuide.js';

function cards(text: string) {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

describe('handCheckerGuide', () => {
  it('best-five example: seven cards, five used, two left out — by bestFiveOf', () => {
    const example = bestFiveExample();
    expect(example.holeCards.length + example.boardCards.length).toBe(7);
    expect(example.result.bestFive).toHaveLength(5);
    expect(example.unusedCards).toHaveLength(2);
    const expected = bestFiveOf([...cards(example.hole), ...cards(example.board)]).cards;
    expect(new Set(example.result.bestFive)).toEqual(new Set(expected));
    // The e2e default reading is 에이스와 킹 투페어; the guide's example must not be that hand.
    expect(example.result.reading).not.toBe('에이스와 킹 투페어');
  });

  it('board-plays example: neither hole card is in the best five', () => {
    const example = boardPlaysExample();
    expect(example.unusedCards).toHaveLength(2);
    expect(new Set(example.unusedCards)).toEqual(new Set(example.holeCards));
    expect(new Set(example.result.bestFive)).toEqual(new Set(example.boardCards));
  });

  it('showdowns: one kicker win and two genuine ties, judged by compareHands', () => {
    const examples = showdownExamples();
    expect(examples.map((e) => e.id)).toEqual(['kicker', 'straight-tie', 'same-two-pair']);
    for (const example of examples) {
      const board = cards(example.board);
      const a = bestFiveOf([...cards(example.a.hole), ...board]).cards;
      const b = bestFiveOf([...cards(example.b.hole), ...board]).cards;
      expect(example.verdict).toBe(compareHands(evaluateStrength(a), evaluateStrength(b)));
    }
    const byId = new Map(examples.map((e) => [e.id, e]));
    expect(byId.get('kicker')?.verdict).toBe(1);
    expect(byId.get('kicker')?.a.category).toBe(byId.get('kicker')?.b.category);
    expect(byId.get('straight-tie')?.verdict).toBe(0);
    expect(byId.get('straight-tie')?.a.category).toBe('STRAIGHT');
    expect(byId.get('same-two-pair')?.verdict).toBe(0);
    expect(byId.get('same-two-pair')?.a.category).toBe('TWO_PAIR');
  });

  it('category rows: nine, strongest first, counts from learn-core summing to every five-card hand', () => {
    const rows = categoryFrequencyRows();
    expect(rows).toHaveLength(HAND_CATEGORIES.length);
    expect(rows.map((row) => row.rankFromTop)).toEqual(rows.map((_, i) => i + 1));
    let total = 0;
    for (const row of rows) {
      const fact = categoryFrequencyOf(row.category);
      expect(row.count).toBe(fact.count);
      expect(row.probability).toBe(fact.probability);
      total += row.count;
    }
    expect(total).toBe(FIVE_CARD_HAND_COUNT);
    expect(FIVE_CARD_HANDS_TOTAL).toBe(FIVE_CARD_HAND_COUNT);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]?.count ?? 0).toBeGreaterThan(rows[i - 1]?.count ?? Infinity);
    }
  });
});
