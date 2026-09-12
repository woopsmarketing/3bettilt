/**
 * The differential tests here are the point of this file.
 *
 * `@gto-self/strategy-core`'s `equityVsRange` is an INDEPENDENT implementation of the same
 * question — different enumeration order (runout-outer over a weighted 1326-combo range,
 * with colexicographic unranking and basis-point weights), different card-removal strategy
 * (it carries the villain's cards in the deck and discards colliding runouts; this module
 * removes them up front), and a different tally (weighted sums, not counts). On a FLOP and a
 * TURN it reports `EXACT` for a single-combo villain range, so the two answers must be equal,
 * not merely close. That makes it a real oracle rather than a self-check.
 *
 * Preflop it reports `SUBSAMPLED` — 100,000 of 2,118,760 runouts — so there the assertion is
 * an agreement bound, with the tolerance derived below.
 */
import { describe, expect, it } from 'vitest';
import { invariant, isOk, parseCards, unwrap, type Card } from '@gto-self/shared';
import {
  apportion,
  binomial,
  BPS_FULL,
  BPS_TOTAL,
  comboIndexOf,
  equityVsRange,
  rangeFromEntries,
  type EquityMethod,
  type RangeWeights,
} from '@gto-self/strategy-core';
import { exactHeadsUpEquity, type ExactEquityError } from './exact.js';

const cards = (text: string): Card[] => (text === '' ? [] : unwrap(parseCards(text)));

/** A villain RANGE that contains exactly the one combo villain actually holds. */
function singleComboRange(villain: readonly Card[]): RangeWeights {
  const [a, b] = villain;
  if (a === undefined || b === undefined) throw new Error('a villain hand is two cards');
  return unwrap(rangeFromEntries([[comboIndexOf(a, b), BPS_FULL]]));
}

function differential(heroText: string, villainText: string, boardText: string) {
  const hero = cards(heroText);
  const villain = cards(villainText);
  const board = cards(boardText);
  return {
    mine: unwrap(exactHeadsUpEquity(hero, villain, board)),
    theirs: unwrap(equityVsRange(hero, board, singleComboRange(villain))),
  };
}

const errorOf = (
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[],
): ExactEquityError => {
  const result = exactHeadsUpEquity(hero, villain, board);
  if (isOk(result)) throw new Error('expected an error, got a result');
  return result.error;
};

/** hero, villain, flop — every card distinct, chosen to cover made hands, draws and chops. */
const FLOP_SPOTS: ReadonlyArray<readonly [string, string, string]> = [
  ['AsKs', 'QdQc', '7h2c9d'],
  ['JhTh', '9d9c', '8s2cQd'],
  ['AhAd', 'KsQs', '2c7d9h'],
  ['5c5d', 'AsKh', '5s8d2h'],
  ['AsQh', 'KdJc', 'TsJh9c'],
  ['AsKd', 'AhKc', '2s7h9d'],
];

/** The preflop matchups the sanity bound is measured on: dominated, race, flip, coinflip. */
const PREFLOP_SPOTS: ReadonlyArray<readonly [string, string]> = [
  ['AsAh', 'KsKh'],
  ['AsKs', 'QdQc'],
  ['7h2d', 'AcAd'],
  ['JsTs', '9d9c'],
  ['AhKd', 'AsQs'],
  ['5s5h', '6d7d'],
  ['AsQh', 'KdJc'],
  ['2s2h', '3d4c'],
];

/**
 * The agreement bound for the preflop sanity check, in equity share.
 *
 * `equityVsRange` scores ~80,800 of the 1,712,304 live runouts preflop (100,000 sampled from
 * the 2,118,760-runout space, minus the ~19% that collide with villain's two cards). The
 * binomial standard error of a proportion at that sample size is at most
 * `sqrt(0.25 / 80800) = 0.00176`, so 0.005 is ~2.8 sigma. The engine's Weyl walk is
 * low-discrepancy rather than random and does better than that in practice: the largest
 * disagreement measured across the eight matchups above is 0.0013. Both sides are fully
 * deterministic, so this is a fixed bound and not a flakiness allowance — it is set by the
 * oracle's stated sampling error, not tuned to the numbers.
 */
const PREFLOP_SAMPLING_TOLERANCE = 0.005;

describe('exactHeadsUpEquity — differential against strategy-core', () => {
  it('matches equityVsRange exactly on a flop, where that engine is also EXACT', () => {
    for (const [hero, villain, board] of FLOP_SPOTS) {
      const { mine, theirs } = differential(hero, villain, board);

      // If the oracle ever stopped being exhaustive this comparison would silently become a
      // sampling comparison, so its exactness is asserted, not assumed.
      expect(theirs.method).toBe('EXACT');
      expect(theirs.evaluatedTrials).toBe(mine.runouts);

      expect(mine.winProb).toBeCloseTo(theirs.winProb, 12);
      expect(mine.tieProb).toBeCloseTo(theirs.tieProb, 12);
      expect(mine.loseProb).toBeCloseTo(theirs.loseProb, 12);
      expect(mine.equity).toBeCloseTo(theirs.equity, 12);
    }
  });

  it('matches equityVsRange exactly on a turn', () => {
    for (const [hero, villain, board] of FLOP_SPOTS) {
      // One more community card, drawn from a rank/suit that none of the spots above use.
      const { mine, theirs } = differential(hero, villain, `${board}4c`);

      expect(theirs.method).toBe('EXACT');
      expect(theirs.evaluatedTrials).toBe(mine.runouts);
      expect(mine.runouts).toBe(44);

      expect(mine.winProb).toBeCloseTo(theirs.winProb, 12);
      expect(mine.tieProb).toBeCloseTo(theirs.tieProb, 12);
      expect(mine.loseProb).toBeCloseTo(theirs.loseProb, 12);
      expect(mine.equity).toBeCloseTo(theirs.equity, 12);
    }
  });

  it('is a decided 1 / 0 / chop on a river, and strategy-core agrees', () => {
    // Nothing is left to come, so every probability is 0 or 1 (or 1 on the tie).
    const won = differential('AsKd', '7h2c', 'AdKh9s3c4d');
    expect(won.mine.runouts).toBe(1);
    expect([won.mine.wins, won.mine.ties, won.mine.losses]).toEqual([1, 0, 0]);
    expect(won.mine.equity).toBe(1);
    expect(won.theirs.equity).toBeCloseTo(1, 12);

    const lost = differential('AsKd', '2h2c', '2d7h9sJc4d');
    expect([lost.mine.wins, lost.mine.ties, lost.mine.losses]).toEqual([0, 0, 1]);
    expect(lost.mine.equity).toBe(0);
    expect(lost.theirs.equity).toBeCloseTo(0, 12);

    // Both players play the board's 6-high straight: an exact chop, worth exactly half.
    const chopped = differential('AsKd', 'AhKc', '2s3h4d5c6s');
    expect([chopped.mine.wins, chopped.mine.ties, chopped.mine.losses]).toEqual([0, 1, 0]);
    expect(chopped.mine.equity).toBe(0.5);
    expect(chopped.theirs.equity).toBeCloseTo(0.5, 12);
  });

  it('sits inside the sampled engine sampling error preflop, where it alone is exact', () => {
    for (const [hero, villain] of PREFLOP_SPOTS) {
      const { mine, theirs } = differential(hero, villain, '');

      // The oracle is an ESTIMATE here and says so. That asymmetry is the reason this
      // module exists, so it is asserted rather than tolerated.
      expect(theirs.method).toBe('SUBSAMPLED');
      expect(mine.method).toBe('EXACT');
      expect(mine.runouts).toBe(1_712_304);
      expect(theirs.evaluatedRunouts).toBeLessThan(mine.runouts);

      expect(Math.abs(mine.equity - theirs.equity)).toBeLessThan(PREFLOP_SAMPLING_TOLERANCE);
      expect(Math.abs(mine.winProb - theirs.winProb)).toBeLessThan(PREFLOP_SAMPLING_TOLERANCE);
    }
  });
});

describe('exactHeadsUpEquity — structure', () => {
  const SPOTS: ReadonlyArray<readonly [string, string, string]> = [
    ['AsAh', 'KsKh', ''],
    ['AsKs', 'QdQc', '7h2c9d'],
    ['JhTh', '9d9c', '8s2cQd4c'],
    ['AsKd', 'AhKc', '2s3h4d5c6s'],
  ];

  it('accounts for every runout exactly once', () => {
    for (const [hero, villain, board] of SPOTS) {
      const result = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), cards(board)));
      expect(result.wins + result.ties + result.losses).toBe(result.runouts);
      expect(result.runouts).toBeGreaterThan(0);
    }
  });

  it('walks C(unseen, cards-to-come) runouts on every board length', () => {
    // Four known cards are gone before the board is dealt, so the unseen count is
    // 48 - board.length and the exponent is 5 - board.length.
    for (const [hero, villain, board] of SPOTS) {
      const boardCards = cards(board);
      const result = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), boardCards));
      expect(result.unseenCards).toBe(48 - boardCards.length);
      expect(result.runouts).toBe(binomial(48 - boardCards.length, 5 - boardCards.length));
    }
    // The four concrete sizes, stated so a change to the enumeration cannot pass silently.
    expect(binomial(48, 5)).toBe(1_712_304);
    expect(binomial(45, 2)).toBe(990);
    expect(binomial(44, 1)).toBe(44);
    expect(binomial(43, 0)).toBe(1);
  });

  it('has probabilities that sum to 1 and an equity share of win + tie/2', () => {
    for (const [hero, villain, board] of SPOTS) {
      const r = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), cards(board)));

      // Every share is a ratio of two integers computed here, so the float sum can differ
      // from 1 by at most one ulp; anything larger is an arithmetic bug, not rounding.
      expect(Math.abs(r.winProb + r.tieProb + r.loseProb - 1)).toBeLessThanOrEqual(Number.EPSILON);
      // The share, recomputed from the raw counts by a different route than the field was.
      expect(r.equity).toBeCloseTo((r.wins + r.ties / 2) / r.runouts, 12);
      expect(r.equity).toBeGreaterThanOrEqual(r.winProb);
      expect(r.equity).toBeLessThanOrEqual(r.winProb + r.tieProb);
    }
  });

  it('is symmetric: swapping the two hands complements every count', () => {
    for (const [hero, villain, board] of SPOTS) {
      const boardCards = cards(board);
      const a = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), boardCards));
      const b = unwrap(exactHeadsUpEquity(cards(villain), cards(hero), boardCards));

      // The exact statement: hero's wins are villain's losses and the ties are shared.
      expect(b.wins).toBe(a.losses);
      expect(b.losses).toBe(a.wins);
      expect(b.ties).toBe(a.ties);
      expect(b.runouts).toBe(a.runouts);
      // The shares are exact rationals, so their float sum is 1 to within one ulp.
      expect(Math.abs(a.equity + b.equity - 1)).toBeLessThanOrEqual(Number.EPSILON);
    }
  });

  it('labels itself EXACT in the same method vocabulary strategy-core uses', () => {
    const r = unwrap(exactHeadsUpEquity(cards('AsKs'), cards('QdQc'), cards('7h2c9d')));
    // A compile-time check that the literal stays inside `EquityMethod`, so one renderer can
    // present this result and `EquityResult` side by side.
    const method: EquityMethod = r.method;
    expect(method).toBe('EXACT');
  });

  it('reproduces the published preflop figure for AA against KK', () => {
    // 82.36% / 0.54% / 17.09% is the combinatorial fact every equity calculator and poker
    // text prints. It is arithmetic over the 1,712,304 runouts, not a strategy claim.
    const r = unwrap(exactHeadsUpEquity(cards('AsAh'), cards('KsKh'), []));

    expect(r.runouts).toBe(1_712_304);
    expect(r.wins + r.ties + r.losses).toBe(1_712_304);
    expect(r.winProb).toBeCloseTo(0.8236, 4);
    expect(r.tieProb).toBeCloseTo(0.0054, 4);
    expect(r.equity).toBeCloseTo(0.8264, 4);
  });
});

/**
 * The four runout counts `exactHeadsUpEquity` can EVER produce — one per legal board
 * length (0/3/4/5) — since `runouts` is always `C(48 - board.length, 5 - board.length)`.
 * The apportionment property below is checked against every one of them, not a sample.
 */
const REAL_RUNOUTS = [1, 44, 990, 1_712_304] as const;

/**
 * The exact rational share, computed independently of `apportion`'s integer arithmetic, so
 * the "within 1 bps" assertion is not just comparing the function to itself.
 */
function exactShareBps(count: number, runouts: number): number {
  return (count * BPS_TOTAL) / runouts;
}

/** Runs the two invariants any basis-point apportionment of a win/tie/loss split must obey. */
function checkApportionment(wins: number, ties: number, losses: number): void {
  const runouts = wins + ties + losses;
  const parts = unwrap(apportion([wins, ties, losses], BPS_TOTAL));
  const [heroWinBps, tieBps, villainWinBps] = parts;
  invariant(
    heroWinBps !== undefined && tieBps !== undefined && villainWinBps !== undefined,
    `apportion([${wins}, ${ties}, ${losses}], ${BPS_TOTAL}) returned ${parts.length} parts, not 3`,
  );

  // 1. The three parts sum to EXACTLY 10000, always — never 9999, never 10001.
  expect(heroWinBps + tieBps + villainWinBps).toBe(BPS_TOTAL);

  // 2. Each part is within 1 bps of its exact rational value (it is that value's floor or
  //    its ceiling, by construction of the largest-remainder method — never anything else).
  expect(Math.abs(heroWinBps - exactShareBps(wins, runouts))).toBeLessThan(1);
  expect(Math.abs(tieBps - exactShareBps(ties, runouts))).toBeLessThan(1);
  expect(Math.abs(villainWinBps - exactShareBps(losses, runouts))).toBeLessThan(1);
}

describe('exactHeadsUpEquity — basis points', () => {
  const SPOTS: ReadonlyArray<readonly [string, string, string]> = [
    ['AsAh', 'KsKh', ''],
    ['AsKs', 'QdQc', '7h2c9d'],
    ['JhTh', '9d9c', '8s2cQd4c'],
    ['AsKd', 'AhKc', '2s3h4d5c6s'],
  ];

  it('sums to exactly 10000 and stays within 1 bps of the exact share, on real enumerated spots', () => {
    for (const [hero, villain, board] of SPOTS) {
      const r = unwrap(exactHeadsUpEquity(cards(hero), cards(villain), cards(board)));
      expect(REAL_RUNOUTS).toContain(r.runouts);
      expect(r.heroWinBps + r.tieBps + r.villainWinBps).toBe(BPS_TOTAL);
      expect(Math.abs(r.heroWinBps - exactShareBps(r.wins, r.runouts))).toBeLessThan(1);
      expect(Math.abs(r.tieBps - exactShareBps(r.ties, r.runouts))).toBeLessThan(1);
      expect(Math.abs(r.villainWinBps - exactShareBps(r.losses, r.runouts))).toBeLessThan(1);
      // Derived from the integer counts, not from the floats: reconstructing from winProb
      // instead would multiply an already-rounded float by 10000 and could disagree.
      expect(r.heroWinBps).toBe(unwrap(apportion([r.wins, r.ties, r.losses], BPS_TOTAL))[0]);
    }
  });

  it('reports ~8236 / ~54 / ~1710 bps for AA vs KK preflop, always summing to exactly 10000', () => {
    const r = unwrap(exactHeadsUpEquity(cards('AsAh'), cards('KsKh'), []));
    expect(r.heroWinBps + r.tieBps + r.villainWinBps).toBe(10000);
    expect(r.heroWinBps / 100).toBeCloseTo(82.36, 1);
    expect(r.tieBps / 100).toBeCloseTo(0.54, 1);
    expect(r.villainWinBps / 100).toBeCloseTo(17.09, 1);
  });

  it('reports a clean 10000 / 0 / 0, 0 / 10000 / 0 or 0 / 0 / 10000 on a decided river', () => {
    const won = unwrap(exactHeadsUpEquity(cards('AsKd'), cards('7h2c'), cards('AdKh9s3c4d')));
    expect([won.heroWinBps, won.tieBps, won.villainWinBps]).toEqual([10000, 0, 0]);

    const lost = unwrap(exactHeadsUpEquity(cards('AsKd'), cards('2h2c'), cards('2d7h9sJc4d')));
    expect([lost.heroWinBps, lost.tieBps, lost.villainWinBps]).toEqual([0, 0, 10000]);

    const chopped = unwrap(exactHeadsUpEquity(cards('AsKd'), cards('AhKc'), cards('2s3h4d5c6s')));
    expect([chopped.heroWinBps, chopped.tieBps, chopped.villainWinBps]).toEqual([0, 10000, 0]);
  });

  describe('largest-remainder apportionment property (adversarial win/tie/loss triples)', () => {
    it('holds for EVERY legal split of the two small real runout counts: river (1) and turn (44)', () => {
      for (const runouts of [1, 44] as const) {
        let checked = 0;
        for (let wins = 0; wins <= runouts; wins += 1) {
          for (let ties = 0; ties <= runouts - wins; ties += 1) {
            checkApportionment(wins, ties, runouts - wins - ties);
            checked += 1;
          }
        }
        // river: 3 splits of 1; turn: C(44+2, 2) = 1035 splits of 44. Pinned so a change to
        // the loop bounds cannot silently shrink the coverage.
        expect(checked).toBe(runouts === 1 ? 3 : 1035);
      }
    });

    it('holds over a large deterministic sample of splits of the flop and preflop runout counts', () => {
      // Deterministic 32-bit PRNG (mulberry32), the same generator strategy-core's own
      // exhaustive evaluator tests use, seeded from a literal so the sample is identical on
      // every run and every machine — this is sampling WHICH triples to check, not sampling
      // the equity itself (that stays fully exhaustive in `exactHeadsUpEquity`).
      let state = 0xf1a5_71c7;
      const random = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      for (const runouts of [990, 1_712_304] as const) {
        for (let sample = 0; sample < 4000; sample += 1) {
          const wins = Math.floor(random() * (runouts + 1));
          const ties = Math.floor(random() * (runouts - wins + 1));
          checkApportionment(wins, ties, runouts - wins - ties);
        }
      }
    });

    it('holds for the all-tie / all-win / all-lose extremes, for every real runouts value', () => {
      for (const runouts of REAL_RUNOUTS) {
        checkApportionment(runouts, 0, 0); // hero always wins
        checkApportionment(0, runouts, 0); // always a chop
        checkApportionment(0, 0, runouts); // hero always loses
      }
    });

    it('holds near an even 50/50 split (with and without a remainder), for every real runouts value', () => {
      for (const runouts of REAL_RUNOUTS) {
        const half = Math.floor(runouts / 2);
        checkApportionment(half, 0, runouts - half); // exact or near-exact half
        checkApportionment(half + 1, 0, runouts - half - 1); // one unit off center
        if (runouts >= 3) {
          const third = Math.floor(runouts / 3);
          checkApportionment(third, third, runouts - 2 * third); // three-way near split
        }
      }
    });

    it('holds at the smallest-nonzero-remainder boundary, for every real runouts value where one exists', () => {
      // The smallest positive remainder `wins * 10000 mod runouts` can take is
      // gcd(10000, runouts); searching wins up to a bounded bandwidth is guaranteed to find
      // it (the residues cycle with period `runouts / gcd`), exercising the +1-unit
      // tie-break at its tightest margin without an O(runouts) search.
      //
      // `runouts === 1` is exempt: modulo 1 is always 0, so no split of a single runout ever
      // has a fractional remainder at all — that degenerate case is asserted directly below
      // instead of searched for.
      expect((1 * BPS_TOTAL) % 1).toBe(0);
      checkApportionment(1, 0, 0);

      for (const runouts of [44, 990, 1_712_304] as const) {
        let best: { wins: number; remainder: number } | undefined;
        const bound = Math.min(runouts, 20_000);
        for (let wins = 1; wins < bound; wins += 1) {
          const remainder = (wins * BPS_TOTAL) % runouts;
          if (remainder > 0 && (best === undefined || remainder < best.remainder)) {
            best = { wins, remainder };
          }
        }
        expect(best).toBeDefined();
        if (best === undefined) continue;
        checkApportionment(best.wins, 0, runouts - best.wins);
      }
    });

    it('is deterministic: the same triple always apportions to the same three integers', () => {
      for (const runouts of REAL_RUNOUTS) {
        const a = apportion([1, 1, Math.max(runouts - 2, 0)], BPS_TOTAL);
        const b = apportion([1, 1, Math.max(runouts - 2, 0)], BPS_TOTAL);
        expect(a).toEqual(b);
      }
    });
  });
});

describe('exactHeadsUpEquity — rejected input', () => {
  // Deliberately smuggled past the type system: `Card` is branded precisely so this cannot
  // happen by accident, and the runtime guard exists for data that arrives from outside.
  const NOT_A_CARD = 52 as unknown as Card;

  it('refuses anything but two cards per player', () => {
    expect(errorOf(cards('As'), cards('KsKh'), [])).toBe('HERO_NOT_TWO_CARDS');
    expect(errorOf(cards('AsKsQs'), cards('KhQh'), [])).toBe('HERO_NOT_TWO_CARDS');
    expect(errorOf([], cards('KsKh'), [])).toBe('HERO_NOT_TWO_CARDS');
    expect(errorOf(cards('AsAh'), cards('Ks'), [])).toBe('VILLAIN_NOT_TWO_CARDS');
    expect(errorOf(cards('AsAh'), cards('KsKhQd'), [])).toBe('VILLAIN_NOT_TWO_CARDS');
  });

  it('refuses a board that is not 0, 3, 4 or 5 cards', () => {
    expect(errorOf(cards('AsAh'), cards('KsKh'), cards('2c'))).toBe('INVALID_BOARD_LENGTH');
    expect(errorOf(cards('AsAh'), cards('KsKh'), cards('2c3d'))).toBe('INVALID_BOARD_LENGTH');
    expect(errorOf(cards('AsAh'), cards('KsKh'), cards('2c3d4h5s6d7c'))).toBe(
      'INVALID_BOARD_LENGTH',
    );
  });

  it('refuses a repeated card anywhere across hero, villain and the board', () => {
    // Within one hand — `parseCards` cannot even produce this, so it is built by hand.
    const ace = cards('As')[0] ?? NOT_A_CARD;
    expect(errorOf([ace, ace], cards('KsKh'), [])).toBe('DUPLICATE_CARD');
    expect(errorOf(cards('KsKh'), [ace, ace], [])).toBe('DUPLICATE_CARD');
    // Between the two hands.
    expect(errorOf(cards('AsKd'), cards('AsQh'), [])).toBe('DUPLICATE_CARD');
    // Between a hand and the board.
    expect(errorOf(cards('AsKd'), cards('QhJc'), cards('As7d2c'))).toBe('DUPLICATE_CARD');
    expect(errorOf(cards('AsKd'), cards('QhJc'), cards('Qh7d2c'))).toBe('DUPLICATE_CARD');
    // Within the board itself.
    expect(errorOf(cards('AsKd'), cards('QhJc'), [...cards('7d2c'), ...cards('7d')])).toBe(
      'DUPLICATE_CARD',
    );
  });

  it('refuses a value that is not a card', () => {
    expect(errorOf([NOT_A_CARD, cards('Ks')[0] ?? NOT_A_CARD], cards('QhJc'), [])).toBe(
      'NOT_A_CARD',
    );
    expect(errorOf(cards('AsKd'), [NOT_A_CARD, cards('Qh')[0] ?? NOT_A_CARD], [])).toBe(
      'NOT_A_CARD',
    );
    expect(errorOf(cards('AsKd'), cards('QhJc'), [NOT_A_CARD, ...cards('7d2c')])).toBe(
      'NOT_A_CARD',
    );
  });
});
