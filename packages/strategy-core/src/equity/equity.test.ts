/**
 * Correctness of the equity engine.
 *
 * Every expectation is derived INDEPENDENTLY of the engine:
 *
 * - the river cases are enumerated by hand in the comment above each test (a river has one
 *   runout, so "hero's hand against these combos with these weights" is arithmetic anyone can
 *   redo on paper);
 * - the turn case is checked against a naive reference written inside this file, which walks
 *   every river card and picks the best five of seven by `bestFiveOf` (the C(7,5) enumeration
 *   B1 keeps as its own cross-check) — it shares no code path with the engine's runout
 *   machinery;
 * - the preflop case is checked against a five-deep nested loop over all C(48,5) boards,
 *   again written here, which never uses the engine's deck, unranking or sampling;
 * - the subsampling error bounds are the MEASURED ones from the sweep in the WP report, with
 *   roughly a factor of two of margin, so the assertion is a regression guard rather than a
 *   restatement of what the code happens to do today.
 */
import { ALL_CARDS, parseCards, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { bestFiveOf, evaluateStrength } from '../analysis/evaluate.js';
import { comboIndexOf, type ComboIndex } from '../range/combo.js';
import { emptyRange, rangeFromEntries, uniformRange, type RangeWeights } from '../range/weights.js';
import { createEquityCache } from './cache.js';
import { equityVsRange, equityVsRanges } from './equity.js';
import type { EquityResult } from './model.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

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

/** A range from `"AhAs"`-style combos with basis-point weights. */
function range(entries: readonly (readonly [string, number])[]): RangeWeights {
  const built = rangeFromEntries(entries.map(([text, weight]) => [combo(text), weight] as const));
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

function unwrap(result: ReturnType<typeof equityVsRange>): EquityResult {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

// ---------------------------------------------------------------------------
// river: hand-derivable
// ---------------------------------------------------------------------------

describe('river equity — hand-derived', () => {
  const board = cards('2c 5d 7s 9h Jc');

  it('AhAs against exactly KdKc: aces win every time', () => {
    // Board 2 5 7 9 J with no pair, no flush, no straight. Hero holds a pair of aces,
    // villain a pair of kings. Aces beat kings. There is one runout (the river is out) and
    // one villain combo, so: win 1, tie 0, lose 0, equity 1.
    const result = unwrap(equityVsRange(cards('Ah As'), board, range([['Kd Kc', 10000]])));
    expect(result.winProb).toBe(1);
    expect(result.tieProb).toBe(0);
    expect(result.loseProb).toBe(0);
    expect(result.equity).toBe(1);
    expect(result.method).toBe('EXACT');
    expect(result.evaluatedRunouts).toBe(1);
    expect(result.runoutSpaceSize).toBe(1);
    expect(result.assignmentCount).toBe(1);
    expect(result.evaluatedTrials).toBe(1);
    expect(result.villainCount).toBe(1);
    expect(result.scoredWeight).toBe(10000);
  });

  it('the mirror case: KdKc against exactly AhAs loses every time', () => {
    const result = unwrap(equityVsRange(cards('Kd Kc'), board, range([['Ah As', 10000]])));
    expect(result.equity).toBe(0);
    expect(result.loseProb).toBe(1);
  });

  it('a 75/25 two-combo range is exactly 75/25', () => {
    // Hero 8h8s = a pair of eights, kickers J 9 7.
    //   Kd Kc  (75%) -> kings beat eights   -> hero loses
    //   3d 3c  (25%) -> threes lose         -> hero wins
    // equity = 0.25 * 1 + 0.75 * 0 = 0.25, exactly.
    const villain = range([
      ['Kd Kc', 7500],
      ['3d 3c', 2500],
    ]);
    const result = unwrap(equityVsRange(cards('8h 8s'), board, villain));
    expect(result.winProb).toBe(0.25);
    expect(result.loseProb).toBe(0.75);
    expect(result.tieProb).toBe(0);
    expect(result.equity).toBe(0.25);
  });

  it('a three-combo weighted range with a chop in it', () => {
    //   Kd Kc  (50%) -> hero loses
    //   3d 3c  (30%) -> hero wins
    //   8d 8c  (20%) -> pair of eights with the SAME J 9 7 kickers -> chop
    // win 0.30, tie 0.20, lose 0.50; equity = 0.30 + 0.20/2 = 0.40, exactly.
    const villain = range([
      ['Kd Kc', 5000],
      ['3d 3c', 3000],
      ['8d 8c', 2000],
    ]);
    const result = unwrap(equityVsRange(cards('8h 8s'), board, villain));
    expect(result.winProb).toBeCloseTo(0.3, 12);
    expect(result.tieProb).toBeCloseTo(0.2, 12);
    expect(result.loseProb).toBeCloseTo(0.5, 12);
    expect(result.equity).toBeCloseTo(0.4, 12);
    expect(result.winProb + result.tieProb + result.loseProb).toBeCloseTo(1, 12);
  });

  it('the nuts on the river is exactly 1 against ANY range', () => {
    // Jh Th on Ah Kh Qh 2c 3d is a royal flush. Nothing ties it (hero holds two of its
    // cards), nothing beats it.
    const result = unwrap(equityVsRange(cards('Jh Th'), cards('Ah Kh Qh 2c 3d'), uniformRange()));
    expect(result.equity).toBe(1);
    expect(result.winProb).toBe(1);
    expect(result.tieProb).toBe(0);
  });

  it('a board that plays is exactly 0.5 against ANY range', () => {
    // The board IS a royal flush, so every player at showdown holds it and every showdown
    // is a two-way chop. This is the symmetric-tie case: equity is exactly one half, not
    // approximately.
    const result = unwrap(equityVsRange(cards('2c 3d'), cards('Ah Kh Qh Jh Th'), uniformRange()));
    expect(result.equity).toBe(0.5);
    expect(result.tieProb).toBe(1);
    expect(result.winProb).toBe(0);
    expect(result.loseProb).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// card removal
// ---------------------------------------------------------------------------

describe('card removal', () => {
  const board = cards('2c 5d 7s 9h Jc');

  it('a villain combo made of hero cards contributes nothing', () => {
    // The range says "8h8s half the time, KdKc half the time", but hero HOLDS 8h8s, so that
    // half is impossible. What is left is KdKc alone, which beats hero's eights.
    const villain = range([
      ['8h 8s', 5000],
      ['Kd Kc', 5000],
    ]);
    const result = unwrap(equityVsRange(cards('8h 8s'), board, villain));
    expect(result.equity).toBe(0);
    expect(result.assignmentCount).toBe(1);
    expect(result.scoredWeight).toBe(5000);
  });

  it('a villain combo made of board cards contributes nothing', () => {
    const villain = range([
      ['2c 5d', 5000],
      ['3d 3c', 5000],
    ]);
    const result = unwrap(equityVsRange(cards('8h 8s'), board, villain));
    expect(result.equity).toBe(1);
    expect(result.assignmentCount).toBe(1);
  });

  it('a range that is entirely hero cards and board cards is a typed error', () => {
    const villain = range([
      ['8h 8s', 5000],
      ['2c 5d', 5000],
    ]);
    const result = equityVsRange(cards('8h 8s'), board, villain);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.error.code).toBe('ZERO_MASS_RANGE');
  });

  it('an empty range is a typed error, not a NaN', () => {
    const result = equityVsRange(cards('8h 8s'), board, emptyRange());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.error.code).toBe('ZERO_MASS_RANGE');
  });
});

// ---------------------------------------------------------------------------
// turn, against a naive reference written here
// ---------------------------------------------------------------------------

/**
 * The independent reference. Walks every villain combo and every river card, picks the best
 * five of seven by explicit C(7,5) enumeration, and sums. It shares nothing with the engine
 * except the card encoding and `bestFiveOf`, which B1 validates against the 2.6M-hand
 * frequency table.
 */
function naiveTurnEquity(
  hero: readonly Card[],
  board: readonly Card[],
  villain: RangeWeights,
): { winProb: number; tieProb: number; loseProb: number; equity: number } {
  const dead = new Set<Card>([...board, ...hero]);
  const deck = ALL_CARDS.filter((card) => !dead.has(card));
  let win = 0;
  let tie = 0;
  let lose = 0;
  for (let high = 1; high < 52; high += 1) {
    for (let low = 0; low < high; low += 1) {
      const weight = villain.bps[(high * (high - 1)) / 2 + low] ?? 0;
      if (weight === 0) continue;
      const a = low as Card;
      const b = high as Card;
      if (dead.has(a) || dead.has(b)) continue;
      for (const river of deck) {
        if (river === a || river === b) continue;
        const full = [...board, river];
        const heroValue = bestFiveOf([...full, ...hero]).value.strength;
        const villainValue = bestFiveOf([...full, a, b]).value.strength;
        if (heroValue > villainValue) win += weight;
        else if (heroValue === villainValue) tie += weight;
        else lose += weight;
      }
    }
  }
  const total = win + tie + lose;
  return {
    winProb: win / total,
    tieProb: tie / total,
    loseProb: lose / total,
    equity: (win + tie / 2) / total,
  };
}

describe('turn equity against a naive brute-force reference', () => {
  it('matches the naive best-of-21 enumeration over every river, for a full range', () => {
    const hero = cards('Ah Qd');
    const board = cards('2c 5d 7s Kh');
    const villain = uniformRange();
    const engine = unwrap(equityVsRange(hero, board, villain));
    const naive = naiveTurnEquity(hero, board, villain);

    expect(engine.method).toBe('EXACT');
    expect(engine.evaluatedRunouts).toBe(46);
    expect(engine.runoutSpaceSize).toBe(46);
    expect(engine.equity).toBeCloseTo(naive.equity, 12);
    expect(engine.winProb).toBeCloseTo(naive.winProb, 12);
    expect(engine.tieProb).toBeCloseTo(naive.tieProb, 12);
    expect(engine.loseProb).toBeCloseTo(naive.loseProb, 12);
  }, 120_000);

  it('matches the naive reference on a weighted, paired-board turn', () => {
    const hero = cards('Kd Qd');
    const board = cards('9s 9h 4d Td');
    const villain = range([
      ['Ad Jd', 10000],
      ['9c 9d', 6000],
      ['Ts Tc', 3000],
      ['7c 6c', 1500],
      ['Ac Kc', 500],
    ]);
    const engine = unwrap(equityVsRange(hero, board, villain));
    const naive = naiveTurnEquity(hero, board, villain);
    expect(engine.equity).toBeCloseTo(naive.equity, 12);
    expect(engine.winProb).toBeCloseTo(naive.winProb, 12);
    expect(engine.tieProb).toBeCloseTo(naive.tieProb, 12);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// flop
// ---------------------------------------------------------------------------

describe('flop equity', () => {
  it('is EXACT on the flop with the default budget', () => {
    const result = unwrap(equityVsRange(cards('Ah Kd'), cards('2c 5d 7s'), uniformRange()));
    expect(result.method).toBe('EXACT');
    expect(result.evaluatedRunouts).toBe(1081);
    expect(result.runoutSpaceSize).toBe(1081);
    expect(result.winProb + result.tieProb + result.loseProb).toBeCloseTo(1, 12);
  }, 60_000);

  it('subsampled runouts stay inside the measured error bound', () => {
    // Measured over 96 (board, hero) pairs: max |error| 0.0228 at 256 runouts and 0.0195 at
    // 512, RMS 0.0082 / 0.0048, mean ~0. The assertions below carry roughly 2x margin.
    const board = cards('2c 5d 7s');
    const villain = uniformRange();
    for (const heroText of ['Ah Kd', '8h 8s', 'Tc 9c', 'Jd 2d']) {
      const hero = cards(heroText);
      const exact = unwrap(equityVsRange(hero, board, villain));
      expect(exact.method).toBe('EXACT');
      const at256 = unwrap(equityVsRange(hero, board, villain, { maxRunoutSamples: 256 }));
      const at512 = unwrap(equityVsRange(hero, board, villain, { maxRunoutSamples: 512 }));
      expect(at256.method).toBe('SUBSAMPLED');
      expect(at256.evaluatedRunouts).toBe(256);
      expect(Math.abs(at256.equity - exact.equity)).toBeLessThan(0.05);
      expect(Math.abs(at512.equity - exact.equity)).toBeLessThan(0.04);
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// preflop
// ---------------------------------------------------------------------------

/**
 * Every C(48,5) board, by five nested loops. No deck, no unranking, no sampling — this
 * reference is independent of the ENGINE, not of the evaluator: it calls `evaluateStrength`
 * because 3.4 million `bestFiveOf` calls would take minutes, and B1 already cross-validates
 * the two against each other. The turn tests above are the ones that pin the evaluator.
 */
function naivePreflopHeadsUp(
  hero: readonly [Card, Card],
  villainCards: readonly [Card, Card],
): { winProb: number; tieProb: number; loseProb: number; equity: number; boards: number } {
  const dead = new Set<Card>([...hero, ...villainCards]);
  const deck = ALL_CARDS.filter((card) => !dead.has(card));
  const n = deck.length;
  let win = 0;
  let tie = 0;
  let lose = 0;
  let boards = 0;
  const heroHand: Card[] = [0, 0, 0, 0, 0, hero[0], hero[1]] as Card[];
  const villainHand: Card[] = [0, 0, 0, 0, 0, villainCards[0], villainCards[1]] as Card[];
  for (let a = 0; a < n - 4; a += 1) {
    heroHand[0] = deck[a] as Card;
    villainHand[0] = deck[a] as Card;
    for (let b = a + 1; b < n - 3; b += 1) {
      heroHand[1] = deck[b] as Card;
      villainHand[1] = deck[b] as Card;
      for (let c = b + 1; c < n - 2; c += 1) {
        heroHand[2] = deck[c] as Card;
        villainHand[2] = deck[c] as Card;
        for (let d = c + 1; d < n - 1; d += 1) {
          heroHand[3] = deck[d] as Card;
          villainHand[3] = deck[d] as Card;
          for (let e = d + 1; e < n; e += 1) {
            heroHand[4] = deck[e] as Card;
            villainHand[4] = deck[e] as Card;
            boards += 1;
            const heroValue = evaluateStrength(heroHand);
            const villainValue = evaluateStrength(villainHand);
            if (heroValue > villainValue) win += 1;
            else if (heroValue === villainValue) tie += 1;
            else lose += 1;
          }
        }
      }
    }
  }
  const total = win + tie + lose;
  return {
    winProb: win / total,
    tieProb: tie / total,
    loseProb: lose / total,
    equity: (win + tie / 2) / total,
    boards,
  };
}

describe('preflop equity', () => {
  it('AA against exactly KK matches an independent C(48,5) enumeration', () => {
    const hero = cards('Ah As') as [Card, Card];
    const villainCards = cards('Kd Kc') as [Card, Card];
    const engine = unwrap(
      equityVsRange(hero, [], range([['Kd Kc', 10000]]), {
        maxRunoutSamples: 3_000_000,
        maxTrials: 3_000_000,
      }),
    );
    expect(engine.method).toBe('EXACT');
    // The engine deals runouts from the 50 cards hero does not hold and discards the ones
    // that collide with the villain's kings; the reference deals from the 48 cards neither
    // player holds. The two enumerate the same 1,712,304 boards by different routes.
    expect(engine.runoutSpaceSize).toBe(2118760);
    expect(engine.evaluatedTrials).toBe(1712304);

    const naive = naivePreflopHeadsUp(hero, villainCards);
    expect(naive.boards).toBe(1712304);
    expect(engine.equity).toBeCloseTo(naive.equity, 12);
    expect(engine.winProb).toBeCloseTo(naive.winProb, 12);
    expect(engine.tieProb).toBeCloseTo(naive.tieProb, 12);
    // Sanity against the well-known number: aces are a shade over four-to-one against kings.
    expect(engine.equity).toBeGreaterThan(0.8);
    expect(engine.equity).toBeLessThan(0.83);
  }, 600_000);

  it('is SUBSAMPLED by default and lands within the measured bound of the exact answer', () => {
    const hero = cards('Ah As');
    const villain = range([['Kd Kc', 10000]]);
    const exact = unwrap(
      equityVsRange(hero, [], villain, { maxRunoutSamples: 3_000_000, maxTrials: 3_000_000 }),
    );
    const sampled = unwrap(equityVsRange(hero, [], villain));
    expect(sampled.method).toBe('SUBSAMPLED');
    expect(sampled.evaluatedRunouts).toBe(100_000);
    // Measured error at 100k of 2,118,760 runouts: 0.00055. Asserted with an order of margin.
    expect(Math.abs(sampled.equity - exact.equity)).toBeLessThan(0.005);
  }, 600_000);

  it('a full villain range preflop is bounded and labelled', () => {
    const result = unwrap(equityVsRange(cards('Ah Kd'), [], uniformRange()));
    expect(result.method).toBe('SUBSAMPLED');
    expect(result.runoutSpaceSize).toBe(2118760);
    expect(result.equity).toBeGreaterThan(0.6);
    expect(result.equity).toBeLessThan(0.72);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// multiway
// ---------------------------------------------------------------------------

describe('multiway equity', () => {
  const board = cards('2c 5d 7s 9h Jc');

  it('three-way river, hand-derived: one assignment loses, one wins', () => {
    // Hero 8h8s. Villain A is {KdKc 50%, 3h3s 50%}, villain B is {3d3c 100%}.
    // Assignment (KdKc, 3d3c): kings beat hero -> 0.
    // Assignment (3h3s, 3d3c): hero's eights beat both -> 1.
    // Equal weights, so win 0.5, lose 0.5, equity 0.5.
    const result = unwrap(
      equityVsRanges(cards('8h 8s'), board, [
        range([
          ['Kd Kc', 5000],
          ['3h 3s', 5000],
        ]),
        range([['3d 3c', 10000]]),
      ]),
    );
    expect(result.villainCount).toBe(2);
    expect(result.assignmentCount).toBe(2);
    expect(result.winProb).toBe(0.5);
    expect(result.loseProb).toBe(0.5);
    expect(result.tieProb).toBe(0);
    expect(result.equity).toBe(0.5);
    expect(result.method).toBe('EXACT');
  });

  it('a two-way chop inside a three-handed pot pays hero one half', () => {
    // Hero 8h8s ties villain A's 8d8c and beats villain B's 3d3c. Two players share, so
    // hero's share is 1/2 and `tieProb` is 1.
    const result = unwrap(
      equityVsRanges(cards('8h 8s'), board, [range([['8d 8c', 10000]]), range([['3d 3c', 10000]])]),
    );
    expect(result.tieProb).toBe(1);
    expect(result.winProb).toBe(0);
    expect(result.loseProb).toBe(0);
    expect(result.equity).toBe(0.5);
  });

  it('a three-way chop pays hero exactly one third', () => {
    // The board is a royal flush, so all three players hold it and split three ways.
    const result = unwrap(
      equityVsRanges(cards('2c 3d'), cards('Ah Kh Qh Jh Th'), [
        range([['4c 5d', 10000]]),
        range([['6c 7d', 10000]]),
      ]),
    );
    expect(result.tieProb).toBe(1);
    expect(result.equity).toBeCloseTo(1 / 3, 15);
  });

  it('discards assignments in which two villains hold the same card', () => {
    // Villain A can only hold KdKc and so can villain B. There is no legal lineup.
    const result = equityVsRanges(cards('8h 8s'), board, [
      range([['Kd Kc', 10000]]),
      range([['Kd Kc', 10000]]),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.error.code).toBe('ZERO_MASS_RANGE');
  });

  it('partial villain-vs-villain conflicts drop only the impossible assignments', () => {
    // A: {KdKc, 3h3s}. B: {Kd Qd, 3d 3c}. (KdKc, KdQd) shares the Kd and is discarded, so
    // three of the four assignments survive.
    const result = unwrap(
      equityVsRanges(cards('8h 8s'), board, [
        range([
          ['Kd Kc', 10000],
          ['3h 3s', 10000],
        ]),
        range([
          ['Kd Qd', 10000],
          ['3d 3c', 10000],
        ]),
      ]),
    );
    expect(result.assignmentCount).toBe(3);
    // Of the three legal lineups, hero's eights lose only to (KdKc, 3d3c). Against
    // (3h3s, KdQd) and (3h3s, 3d3c) the eights are best — Kd Qd is only king high on this
    // board. So hero wins two of three.
    expect(result.winProb).toBeCloseTo(2 / 3, 12);
    expect(result.loseProb).toBeCloseTo(1 / 3, 12);
  });

  it('an exhaustive multiway answer does not depend on the order of the ranges', () => {
    const a = range([
      ['Kd Kc', 6000],
      ['3h 3s', 4000],
    ]);
    const b = range([
      ['Qd Qc', 10000],
      ['4d 4c', 2000],
    ]);
    const forward = unwrap(equityVsRanges(cards('8h 8s'), board, [a, b]));
    const backward = unwrap(equityVsRanges(cards('8h 8s'), board, [b, a]));
    expect(forward.method).toBe('EXACT');
    expect(forward.equity).toBeCloseTo(backward.equity, 12);
    expect(forward.tieProb).toBeCloseTo(backward.tieProb, 12);
  });

  it('bounds a three-way flop and says so', () => {
    const result = unwrap(
      equityVsRanges(cards('Ah Kd'), cards('2c 5d 7s'), [uniformRange(), uniformRange()]),
    );
    expect(result.method).toBe('SUBSAMPLED');
    expect(result.villainCount).toBe(2);
    expect(result.assignmentSpaceSize).toBeGreaterThan(1_000_000);
    expect(result.assignmentCount).toBeLessThanOrEqual(20_000);
    expect(result.evaluatedRunouts).toBe(192);
    expect(result.winProb + result.tieProb + result.loseProb).toBeCloseTo(1, 12);
    // Three-handed equity is necessarily below the heads-up number on the same spot.
    const headsUp = unwrap(equityVsRange(cards('Ah Kd'), cards('2c 5d 7s'), uniformRange()));
    expect(result.equity).toBeLessThan(headsUp.equity);
  }, 120_000);

  it('refuses more villains than a six-max table can seat', () => {
    const ranges = Array.from({ length: 6 }, () => uniformRange());
    expect(() => equityVsRanges(cards('Ah Kd'), board, ranges)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('an exact answer is identical when recomputed', () => {
    const args = [cards('Ah Kd'), cards('2c 5d 7s'), uniformRange()] as const;
    expect(unwrap(equityVsRange(...args))).toEqual(unwrap(equityVsRange(...args)));
  }, 120_000);

  it('a SUBSAMPLED answer is identical when recomputed — sampling carries no entropy', () => {
    const flop = cards('2c 5d 7s');
    const first = unwrap(
      equityVsRange(cards('Ah Kd'), flop, uniformRange(), { maxRunoutSamples: 128 }),
    );
    const second = unwrap(
      equityVsRange(cards('Ah Kd'), flop, uniformRange(), { maxRunoutSamples: 128 }),
    );
    expect(first.method).toBe('SUBSAMPLED');
    expect(first).toEqual(second);

    const multiway = () =>
      unwrap(equityVsRanges(cards('Ah Kd'), flop, [uniformRange(), uniformRange()]));
    expect(multiway()).toEqual(multiway());

    const preflop = () => unwrap(equityVsRange(cards('Ah Kd'), [], uniformRange()));
    expect(preflop()).toEqual(preflop());
  }, 180_000);
});

// ---------------------------------------------------------------------------
// cache
// ---------------------------------------------------------------------------

describe('the memo cache', () => {
  it('returns the very same object on a hit, and counts it', () => {
    const cache = createEquityCache(8);
    const board = cards('2c 5d 7s 9h Jc');
    const villain = uniformRange();
    const first = equityVsRange(cards('Ah Kd'), board, villain, { cache });
    const second = equityVsRange(cards('Ah Kd'), board, villain, { cache });
    if (!first.ok || !second.ok) throw new Error('expected both to succeed');
    expect(second.value).toBe(first.value);
    expect(cache.stats()).toEqual({ hits: 1, misses: 1 });
  });

  it('a hit is bit-identical to an uncached computation', () => {
    const cache = createEquityCache(8);
    const board = cards('2c 5d 7s');
    const uncached = unwrap(equityVsRange(cards('Ah Kd'), board, uniformRange()));
    equityVsRange(cards('Ah Kd'), board, uniformRange(), { cache });
    const hit = unwrap(equityVsRange(cards('Ah Kd'), board, uniformRange(), { cache }));
    expect(hit).toEqual(uncached);
  }, 120_000);

  it('keys on the budget, so a different budget cannot collide with a cached answer', () => {
    const cache = createEquityCache(8);
    const board = cards('2c 5d 7s');
    const exact = unwrap(equityVsRange(cards('Ah Kd'), board, uniformRange(), { cache }));
    const bounded = unwrap(
      equityVsRange(cards('Ah Kd'), board, uniformRange(), { cache, maxRunoutSamples: 64 }),
    );
    expect(exact.method).toBe('EXACT');
    expect(bounded.method).toBe('SUBSAMPLED');
    expect(cache.size()).toBe(2);
  }, 120_000);

  it('keys on the range contents, so a changed weight is a miss', () => {
    const cache = createEquityCache(8);
    const board = cards('2c 5d 7s 9h Jc');
    const a = range([
      ['Kd Kc', 5000],
      ['3d 3c', 5000],
    ]);
    const b = range([
      ['Kd Kc', 2000],
      ['3d 3c', 8000],
    ]);
    const first = unwrap(equityVsRange(cards('8h 8s'), board, a, { cache }));
    const second = unwrap(equityVsRange(cards('8h 8s'), board, b, { cache }));
    expect(first.equity).toBe(0.5);
    expect(second.equity).toBe(0.8);
    expect(cache.stats().hits).toBe(0);
  });

  it('is bounded — the oldest entry is evicted', () => {
    const cache = createEquityCache(2);
    const board = cards('2c 5d 7s 9h Jc');
    for (const hero of ['Ah Kd', '8h 8s', 'Qc Qd']) {
      equityVsRange(cards(hero), board, uniformRange(), { cache });
    }
    expect(cache.size()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

describe('input validation', () => {
  const villain = uniformRange();

  it('refuses a board that is not 0, 3, 4 or 5 cards', () => {
    for (const text of ['2c', '2c 5d', '2c 5d 7s 9h Jc 3h']) {
      const result = equityVsRange(cards('Ah Kd'), cards(text), villain);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected a refusal');
      expect(result.error.code).toBe('INVALID_BOARD');
    }
  });

  it('refuses a board with a repeated card', () => {
    const board = [...cards('2c 5d'), ...cards('2c')] as Card[];
    const result = equityVsRange(cards('Ah Kd'), board, villain);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.error.code).toBe('INVALID_BOARD');
  });

  it('refuses hero holdings that are not two distinct cards off the board', () => {
    const board = cards('2c 5d 7s');
    const badHands: readonly Card[][] = [
      cards('Ah'),
      cards('Ah Kd Qs'),
      [cards('Ah')[0] as Card, cards('Ah')[0] as Card],
      cards('2c Kd'),
    ];
    for (const hero of badHands) {
      const result = equityVsRange(hero, board, villain);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected a refusal');
      expect(result.error.code).toBe('INVALID_HERO_CARDS');
    }
  });

  it('refuses a nonsensical budget', () => {
    expect(() =>
      equityVsRange(cards('Ah Kd'), cards('2c 5d 7s'), villain, { maxTrials: 0 }),
    ).toThrow();
    expect(() =>
      equityVsRange(cards('Ah Kd'), cards('2c 5d 7s'), villain, { minRunoutSamples: 0 }),
    ).toThrow();
  });
});
