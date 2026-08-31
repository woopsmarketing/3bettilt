/**
 * The gold-standard self-checks for the evaluator, plus an informational micro-benchmark.
 *
 * 1. Enumerate ALL C(52,5) = 2,598,960 five-card hands and assert the exact published
 *    category frequency table. Any bug in the rank/suit mask machinery moves at least one of
 *    these nine numbers, so this single test is worth more than any amount of spot checking.
 * 2. Cross-check the single-pass seven-card path against the naive best-of-21 five-card
 *    reference (`bestFiveOf`) over a seeded, deterministic sample.
 * 3. Time the seven-card path. The timing is LOGGED, never asserted — a hard threshold would
 *    make the suite fail on a busy machine rather than tell us something true.
 */
import { ALL_CARDS, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { bestFiveOf, evaluateStrength, HAND_CATEGORIES } from './evaluate.js';

/** The published frequencies of the nine categories among all 2,598,960 five-card hands. */
const EXPECTED_FIVE_CARD_FREQUENCIES: Readonly<Record<string, number>> = {
  HIGH_CARD: 1302540,
  PAIR: 1098240,
  TWO_PAIR: 123552,
  TRIPS: 54912,
  STRAIGHT: 10200,
  FLUSH: 5108,
  FULL_HOUSE: 3744,
  QUADS: 624,
  STRAIGHT_FLUSH: 40,
};

const TOTAL_FIVE_CARD_HANDS = 2598960;

/**
 * Deterministic 32-bit PRNG (mulberry32). No entropy from the machine, ever.
 *
 * TEST-ONLY, and the one PRNG anywhere in this package. B2's report says "no RNG anywhere",
 * which is true of the SHIPPED path — `equity/sampling.ts` is a pure `(n, k)` golden-ratio Weyl
 * walk with no seed, no clock and no machine entropy — but not of this file, and R1 (MINOR-7)
 * flagged the gap between the two statements. It is recorded here so a reader who greps for
 * `random` finds the explanation next to the code rather than concluding the report was
 * dishonest: this generator only chooses WHICH sample hands to cross-check, it is seeded from
 * a literal, and the same seed produces the same hands on every machine and every run.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dealer(seed: number): () => Card[] {
  const random = seededRandom(seed);
  const deck = [...ALL_CARDS];
  return () => {
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const a = deck[i];
      const b = deck[j];
      if (a === undefined || b === undefined) continue;
      deck[i] = b;
      deck[j] = a;
    }
    return deck.slice(0, 7);
  };
}

describe('exhaustive five-card validation', () => {
  it('reproduces the exact category frequency table over all 2,598,960 hands', () => {
    const counts = new Uint32Array(HAND_CATEGORIES.length);
    const hand: Card[] = [0, 0, 0, 0, 0] as Card[];
    const started = Date.now();
    let total = 0;
    for (let a = 0; a < 48; a += 1) {
      hand[0] = a as Card;
      for (let b = a + 1; b < 49; b += 1) {
        hand[1] = b as Card;
        for (let c = b + 1; c < 50; c += 1) {
          hand[2] = c as Card;
          for (let d = c + 1; d < 51; d += 1) {
            hand[3] = d as Card;
            for (let e = d + 1; e < 52; e += 1) {
              hand[4] = e as Card;
              const category = evaluateStrength(hand) >>> 20;
              counts[category] = (counts[category] ?? 0) + 1;
              total += 1;
            }
          }
        }
      }
    }
    const elapsedMs = Date.now() - started;

    expect(total).toBe(TOTAL_FIVE_CARD_HANDS);
    const observed: Record<string, number> = {};
    for (const [index, category] of HAND_CATEGORIES.entries()) {
      observed[category] = counts[index] ?? 0;
    }
    expect(observed).toEqual(EXPECTED_FIVE_CARD_FREQUENCIES);

    const perSecond = Math.round(TOTAL_FIVE_CARD_HANDS / (elapsedMs / 1000));
    process.stdout.write(
      `\n[bench] 5-card exhaustive: ${TOTAL_FIVE_CARD_HANDS} hands in ${elapsedMs}ms ` +
        `(${perSecond.toLocaleString('en-US')} evals/sec)\n`,
    );
  }, 120_000);
});

describe('seven-card cross-check against the naive best-of-21 reference', () => {
  it('agrees on 5000 seeded random seven-card hands', () => {
    const deal = dealer(0x5eed1234);
    let checked = 0;
    for (let i = 0; i < 5000; i += 1) {
      const cards = deal();
      const fast = evaluateStrength(cards);
      const reference = bestFiveOf(cards).value.strength;
      if (fast !== reference) {
        throw new Error(`mismatch on ${cards.join(',')}: fast ${fast} vs reference ${reference}`);
      }
      checked += 1;
    }
    expect(checked).toBe(5000);
  }, 120_000);

  it('agrees on 2000 seeded random six-card hands', () => {
    const deal = dealer(0xc0ffee01);
    for (let i = 0; i < 2000; i += 1) {
      const cards = deal().slice(0, 6);
      expect(evaluateStrength(cards)).toBe(bestFiveOf(cards).value.strength);
    }
  }, 120_000);
});

describe('seven-card throughput (informational)', () => {
  it('evaluates one million seven-card hands', () => {
    const deal = dealer(0xbeef0007);
    const hands: Card[][] = Array.from({ length: 20000 }, () => deal());
    const rounds = 50;

    // Warm-up so the reported number is steady-state, not JIT tiering.
    let sink = 0;
    for (const cards of hands) sink += evaluateStrength(cards);

    const started = Date.now();
    for (let round = 0; round < rounds; round += 1) {
      for (const cards of hands) sink += evaluateStrength(cards);
    }
    const elapsedMs = Date.now() - started;
    const evaluations = hands.length * rounds;
    const perSecond = Math.round(evaluations / (elapsedMs / 1000));

    process.stdout.write(
      `\n[bench] 7-card: ${evaluations.toLocaleString('en-US')} evals in ${elapsedMs}ms ` +
        `(${perSecond.toLocaleString('en-US')} evals/sec)\n`,
    );
    expect(sink).toBeGreaterThan(0);
    expect(evaluations).toBe(1_000_000);
  }, 120_000);
});
