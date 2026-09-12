/**
 * Engine-level tests for `classVsClassEquity`. Deliberately uses RIVER boards (5 known cards)
 * rather than the empty preflop board content actually needs: at a fixed board length every
 * legal pairing enumerates the same number of runouts (see `classVsClass.ts`'s header), and at
 * the river that number is exactly 1 — one deterministic showdown per pairing — so these tests
 * exercise the real pairing/blocker logic in milliseconds instead of the tens of seconds a
 * full preflop matchup costs. The two real preflop matchups content needs are exercised
 * separately by `classVsClassDataset.test.ts`'s consistency check.
 */
import { describe, expect, it } from 'vitest';
import { unwrap, parseCards } from '@gto-self/shared';
import { handClassByKey } from '@gto-self/strategy-core';
import { classVsClassEquity, combosOf } from './classVsClass.js';

const board = (text: string) => unwrap(parseCards(text));
const classOf = (key: string) => {
  const found = handClassByKey(key);
  if (found === undefined) throw new Error(`unknown hand class key in test fixture: ${key}`);
  return found;
};

describe('classVsClassEquity — input validation', () => {
  it('refuses a board that is not 0, 3, 4 or 5 cards', () => {
    const result = classVsClassEquity(classOf('AA'), classOf('72o'), board('2c 4h'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_BOARD_LENGTH');
  });
});

describe('classVsClassEquity — combo buckets', () => {
  it('matches the 6/4/12 combo counts strategy-core defines for pair/suited/offsuit', () => {
    expect(combosOf(classOf('AA'))).toHaveLength(6);
    expect(combosOf(classOf('AKs'))).toHaveLength(4);
    expect(combosOf(classOf('AKo'))).toHaveLength(12);
  });
});

describe('classVsClassEquity — a class against itself is exactly 50/50', () => {
  /**
   * Board carries three spades so that the ONE suited combo of `JTs` sharing that spade suit
   * completes a flush while the other three combos do not — a non-degenerate case (real wins
   * and real losses on both sides), not merely a tie-everywhere board. `wins === losses`
   * exactly is the real claim (see the file header's mirror-pairing argument: for every
   * ordered pair (i, j) the mirror (j, i) is also enumerated, so class-vs-itself always
   * balances exactly); `equity === 0.5` is what follows from that.
   */
  it('JTs vs JTs: wins equal losses exactly, equity is exactly 0.5', () => {
    const JTs = classOf('JTs');
    const result = unwrap(classVsClassEquity(JTs, JTs, board('2s 5s 9s 4h 7d')));
    expect(result.pairingCount).toBe(12); // 4*4 - 4 self-pairs
    expect(result.wins).toBe(result.losses);
    expect(result.wins).toBeGreaterThan(0); // non-degenerate: this board does NOT tie every pairing
    expect(result.equity).toBe(0.5);
  });
});

describe('classVsClassEquity — a strictly dominating matchup lands the right side of 50%', () => {
  /**
   * Board `4c 6h 9d Jc Kd` has no pair, no 2/7 (so it never conflicts with a 72o combo) and no
   * ace, and no straight or flush is reachable by either hand on it. AA is therefore always a
   * bare overpair against 72o's bare high card: every one of the 72 legal pairings is a win.
   */
  it('AA vs 72o: every legal pairing is a win, equity is exactly 1', () => {
    const result = unwrap(classVsClassEquity(classOf('AA'), classOf('72o'), board('4c 6h 9d Jc Kd')));
    expect(result.pairingCount).toBe(72); // 6 * 12, no card conflicts possible (A never = 7 or 2)
    expect(result.wins).toBe(72);
    expect(result.ties).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.equity).toBe(1);
  });
});

describe('classVsClassEquity — blocker-awareness on a real card conflict', () => {
  /**
   * Hand-derived expectation: AA has 6 combos, each using 2 of the deck's 4 aces. AKs has 4
   * combos, one per suit, each pairing one specific ace with the same-suit king. For a given
   * AA combo, exactly 2 of the 4 aces are "its" aces, so exactly 2 of the 4 AKs combos share
   * one of them and must be skipped; the other 2 are legal. `6 hero combos * 2 legal villain
   * combos = 12` — half of the raw `6 * 4 = 24` product, not the full product.
   */
  it('AA vs AKs: exactly 12 of 24 raw pairings survive, matching the hand-derived count', () => {
    const result = unwrap(
      classVsClassEquity(classOf('AA'), classOf('AKs'), board('2c 4h 6d 8s Tc')),
    );
    expect(result.totalPairingsConsidered).toBe(24); // 6 * 4
    expect(result.pairingCount).toBe(12);
    expect(result.skippedPairings).toBe(12);
  });
});
