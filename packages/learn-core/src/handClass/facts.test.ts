import { describe, expect, it } from 'vitest';
import {
  cardsToString,
  isOk,
  parseCards,
  rankOf,
  suitOf,
  unwrap,
  type Card,
} from '@gto-self/shared';
import {
  COMBO_COUNT,
  HAND_CLASSES,
  HAND_CLASS_COUNT,
  comboCards,
  combosOfHandClass,
  handClassOfCombo,
  type HandClassKind,
} from '@gto-self/strategy-core';
import {
  HAND_CLASS_FACTS,
  handClassFacts,
  handClassFactsForKey,
  handClassFactsOfCards,
  type HandClassFactsError,
} from './facts.js';

const cards = (text: string): Card[] => unwrap(parseCards(text));

const errorOfCards = (input: readonly Card[]): HandClassFactsError => {
  const result = handClassFactsOfCards(input);
  if (isOk(result)) throw new Error('expected an error, got a result');
  return result.error;
};

describe('hand class facts — the universe', () => {
  it('covers all 169 classes, in the matrix order strategy-core defines', () => {
    expect(HAND_CLASS_FACTS).toHaveLength(HAND_CLASS_COUNT);
    expect(HAND_CLASS_COUNT).toBe(169);
    HAND_CLASS_FACTS.forEach((facts, index) => {
      expect(facts.handClass.index).toBe(index);
      expect(facts.key).toBe(facts.handClass.key);
      expect(facts.kind).toBe(facts.handClass.kind);
    });
  });

  it('reads 6 / 4 / 12 from strategy-core rather than restating them', () => {
    // The assertion is that this module's number IS strategy-core's number, per class. The
    // literals below then pin what that number is, so a change on either side is visible.
    const byKind = new Map<HandClassKind, Set<number>>();
    for (const facts of HAND_CLASS_FACTS) {
      expect(facts.comboCount).toBe(facts.handClass.comboCount);
      expect(facts.comboCount).toBe(combosOfHandClass(facts.handClass).length);
      const seen = byKind.get(facts.kind) ?? new Set<number>();
      seen.add(facts.comboCount);
      byKind.set(facts.kind, seen);
    }
    expect([...(byKind.get('PAIR') ?? [])]).toEqual([6]);
    expect([...(byKind.get('SUITED') ?? [])]).toEqual([4]);
    expect([...(byKind.get('OFFSUIT') ?? [])]).toEqual([12]);
  });

  it('has the three kinds partition the 1326-combo universe', () => {
    // 13*6 + 78*4 + 78*12 = 78 + 312 + 936 = 1326.
    const counts = { PAIR: 0, SUITED: 0, OFFSUIT: 0 };
    const combos = { PAIR: 0, SUITED: 0, OFFSUIT: 0 };
    for (const facts of HAND_CLASS_FACTS) {
      counts[facts.kind] += 1;
      combos[facts.kind] += facts.comboCount;
    }
    expect(counts).toEqual({ PAIR: 13, SUITED: 78, OFFSUIT: 78 });
    expect(combos).toEqual({ PAIR: 78, SUITED: 312, OFFSUIT: 936 });
    expect(combos.PAIR + combos.SUITED + combos.OFFSUIT).toBe(COMBO_COUNT);
    expect(COMBO_COUNT).toBe(1326);
  });

  it('states each class share of the deal, and the shares sum to one', () => {
    let total = 0;
    for (const facts of HAND_CLASS_FACTS) {
      expect(facts.universeCombos).toBe(COMBO_COUNT);
      expect(facts.universeShare).toBeCloseTo(facts.comboCount / COMBO_COUNT, 15);
      total += facts.universeShare;
    }
    expect(total).toBeCloseTo(1, 12);

    // The two figures a beginner page quotes out loud.
    expect(unwrap(handClassFactsForKey('AA')).universeShare).toBeCloseTo(6 / 1326, 15);
    expect(unwrap(handClassFactsForKey('AKo')).universeShare).toBeCloseTo(12 / 1326, 15);
  });
});

describe('hand class facts — the example combo', () => {
  it('belongs to the class it is offered for', () => {
    for (const facts of HAND_CLASS_FACTS) {
      expect(handClassOfCombo(facts.exampleCombo).index).toBe(facts.handClass.index);
      expect(combosOfHandClass(facts.handClass)).toContain(facts.exampleCombo);
    }
  });

  it('is deterministic and distinct across the 169 classes', () => {
    const seen = new Set<number>();
    for (const handClass of HAND_CLASSES) {
      const first = handClassFacts(handClass);
      const second = handClassFacts(handClass);
      expect(second.exampleCombo).toBe(first.exampleCombo);
      expect(second.exampleCards).toEqual(first.exampleCards);
      // The table is built once, so repeat lookups are the identical object.
      expect(second).toBe(first);
      seen.add(first.exampleCombo);
    }
    expect(seen.size).toBe(HAND_CLASS_COUNT);
  });

  it('renders as two real, distinct cards with the higher rank first', () => {
    for (const facts of HAND_CLASS_FACTS) {
      const [high, low] = facts.exampleCards;
      expect(high).not.toBe(low);
      // `highRank`/`lowRank` come from strategy-core; the rendered pair must match them.
      expect(rankOf(high)).toBe(facts.handClass.highRank);
      expect(rankOf(low)).toBe(facts.handClass.lowRank);
      // A pocket pair is two ranks the same and two suits necessarily different; only the
      // non-pair classes make a claim about the suits matching.
      if (facts.kind === 'PAIR') expect(rankOf(high)).toBe(rankOf(low));
      else expect(suitOf(high) === suitOf(low)).toBe(facts.kind === 'SUITED');
    }
  });

  it('picks the representative a chart would print', () => {
    // Not a promise the module makes — it promises determinism and membership — but the
    // concrete values are pinned so a silent change to the combo index scheme is visible.
    expect(cardsToString(unwrap(handClassFactsForKey('AA')).exampleCards)).toBe('As Ah');
    expect(cardsToString(unwrap(handClassFactsForKey('AKs')).exampleCards)).toBe('As Ks');
    expect(cardsToString(unwrap(handClassFactsForKey('AKo')).exampleCards)).toBe('As Kh');
    expect(cardsToString(unwrap(handClassFactsForKey('72o')).exampleCards)).toBe('7s 2h');
    expect(cardsToString(unwrap(handClassFactsForKey('22')).exampleCards)).toBe('2s 2h');
  });
});

describe('hand class facts — lookup', () => {
  it('classifies two concrete hole cards', () => {
    const suited = unwrap(handClassFactsOfCards(cards('AsKs')));
    expect(suited.key).toBe('AKs');
    expect(suited.kind).toBe('SUITED');
    expect(suited.comboCount).toBe(4);

    const offsuit = unwrap(handClassFactsOfCards(cards('AsKh')));
    expect(offsuit.key).toBe('AKo');
    expect(offsuit.kind).toBe('OFFSUIT');
    expect(offsuit.comboCount).toBe(12);

    const pair = unwrap(handClassFactsOfCards(cards('AsAh')));
    expect(pair.key).toBe('AA');
    expect(pair.kind).toBe('PAIR');
    expect(pair.comboCount).toBe(6);
  });

  it('does not care which order the two cards arrive in', () => {
    const forward = unwrap(handClassFactsOfCards(cards('7c2d')));
    const backward = unwrap(handClassFactsOfCards(cards('2d7c')));
    expect(forward).toBe(backward);
    expect(forward.key).toBe('72o');
  });

  it('round-trips all 1326 combos back to the class that lists them', () => {
    // Every concrete two-card hand there is, in both card orders, through the public entry
    // point — so the class of a hand is checked against strategy-core's own class listing
    // rather than against this module's own example.
    let checked = 0;
    for (const handClass of HAND_CLASSES) {
      for (const combo of combosOfHandClass(handClass)) {
        const [a, b] = comboCards(combo);
        expect(unwrap(handClassFactsOfCards([a, b])).key).toBe(handClass.key);
        expect(unwrap(handClassFactsOfCards([b, a])).key).toBe(handClass.key);
        checked += 1;
      }
    }
    expect(checked).toBe(COMBO_COUNT);
  });

  it('resolves a hand key, and refuses one that is not among the 169', () => {
    expect(unwrap(handClassFactsForKey('AKs')).key).toBe('AKs');
    expect(unwrap(handClassFactsForKey('72o')).key).toBe('72o');

    for (const bad of ['AKx', 'KAs', 'AK', 'aks', 'AAs', '', 'AKss']) {
      const result = handClassFactsForKey(bad);
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) expect(result.error).toBe('UNKNOWN_HAND_CLASS');
    }
  });

  it('refuses input that is not two distinct cards', () => {
    expect(errorOfCards(cards('As'))).toBe('NOT_TWO_CARDS');
    expect(errorOfCards(cards('AsKsQs'))).toBe('NOT_TWO_CARDS');
    expect(errorOfCards([])).toBe('NOT_TWO_CARDS');

    // A hand cannot hold the same physical card twice, so `AsAs` is refused rather than
    // silently answered with 'AA'.
    const ace = cards('As')[0];
    if (ace === undefined) throw new Error('As must parse');
    expect(errorOfCards([ace, ace])).toBe('DUPLICATE_CARD');

    // Smuggled past the brand on purpose: the runtime guard exists for outside data.
    const notACard = 52 as unknown as Card;
    expect(errorOfCards([notACard, ace])).toBe('NOT_A_CARD');
  });
});
