import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  CARD_COUNT,
  cardToString,
  cardsToString,
  hasDuplicates,
  makeCard,
  parseCard,
  parseCards,
  rankOf,
  rankValue,
  sortCardsDesc,
  suitOf,
} from './cards.js';

describe('card indexing', () => {
  it('covers all 52 distinct cards', () => {
    expect(ALL_CARDS).toHaveLength(CARD_COUNT);
    expect(new Set(ALL_CARDS.map(cardToString)).size).toBe(CARD_COUNT);
  });

  it('round-trips rank and suit', () => {
    for (const card of ALL_CARDS) {
      expect(makeCard(rankOf(card), suitOf(card))).toBe(card);
    }
  });

  it('orders ranks from deuce to ace', () => {
    expect(rankValue(makeCard('2', 's'))).toBe(0);
    expect(rankValue(makeCard('A', 'c'))).toBe(12);
    expect(cardToString(makeCard('T', 'd'))).toBe('Td');
  });
});

describe('parsing', () => {
  it('parses single cards case-insensitively', () => {
    expect(parseCard('As')).toEqual({ ok: true, value: makeCard('A', 's') });
    expect(parseCard('td')).toEqual({ ok: true, value: makeCard('T', 'd') });
    expect(parseCard('7C')).toEqual({ ok: true, value: makeCard('7', 'c') });
  });

  it('rejects malformed cards', () => {
    for (const bad of ['', 'A', 'Axs', 'Xs', 'Ax', '10s']) {
      expect(parseCard(bad).ok).toBe(false);
    }
  });

  it('parses card lists with or without separators', () => {
    const spaced = parseCards('Ah 7c 2s');
    const packed = parseCards('Ah7c2s');
    const commas = parseCards('Ah,7c,2s');
    expect(spaced).toEqual(packed);
    expect(spaced).toEqual(commas);
    expect(spaced.ok && cardsToString(spaced.value)).toBe('Ah 7c 2s');
  });

  it('rejects duplicate physical cards', () => {
    expect(parseCards('As As').ok).toBe(false);
    expect(parseCards('As Kd').ok).toBe(true);
  });

  it('rejects odd-length input', () => {
    expect(parseCards('As K').ok).toBe(false);
  });
});

describe('helpers', () => {
  it('sorts descending by rank then suit', () => {
    const cards = parseCards('2s Ah Kd Ac');
    expect(cards.ok && cardsToString(sortCardsDesc(cards.value))).toBe('Ah Ac Kd 2s');
  });

  it('detects duplicates', () => {
    expect(hasDuplicates([makeCard('A', 's'), makeCard('A', 's')])).toBe(true);
    expect(hasDuplicates([makeCard('A', 's'), makeCard('A', 'h')])).toBe(false);
  });
});
