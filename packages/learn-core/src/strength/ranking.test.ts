/**
 * The frozen ranking: is the committed dataset well-formed, does it still say what it was
 * generated to say, and does the "top X%" cut behave the way the slider needs?
 *
 * ## Why the expensive verification is not in here
 *
 * The dataset is an exact enumeration — every one of the 2,118,760 boards against every one
 * of the 1225 opponent hands, for all 169 classes, which is about 75 seconds of one core per
 * class. Recomputing even one class here would make `pnpm test` unusable. So the offline
 * generator does that work once, writes what it found and what it checked into the dataset,
 * and this file does three cheaper things instead:
 *
 *   1. checks the dataset's structural invariants, which no amount of compute can fake;
 *   2. checks the committed evidence — that every class really was exhaustive, that suit
 *      symmetry held, and that the exact values reproduce the textbook figures they must;
 *   3. RE-RUNS the real measurement for three classes on the CHEAP sampled path and checks
 *      the answers against values the generator committed for that same cheap budget. That
 *      is the link between the committed table and the code that produced it: a hand-typed
 *      dataset would pass 1 and 2 and fail this.
 */
import { describe, expect, it } from 'vitest';
import { unwrap } from '@gto-self/shared';
import {
  COMBO_COUNT,
  handClassByKey,
  HAND_CLASSES,
  HAND_CLASS_COUNT,
} from '@gto-self/strategy-core';
import { measureHandStrength, OPPONENT_HAND_COUNT, PREFLOP_RUNOUT_SPACE_SIZE } from './measure.js';
import { HAND_STRENGTH_SYMMETRY_TOLERANCE } from './model.js';
import {
  HAND_STRENGTH,
  HAND_STRENGTH_BY_RANK,
  handStrengthAt,
  handStrengthForKey,
  handStrengthOf,
  handStrengthTied,
  topHandsByShare,
} from './ranking.js';

const ENTRIES = HAND_STRENGTH_BY_RANK;
const WEAKEST = ENTRIES[ENTRIES.length - 1];

/** A sweep fine enough to land the cut on every class boundary the slider can reach. */
const SHARES = Array.from({ length: 101 }, (_, i) => i / 100);

describe('the frozen dataset', () => {
  it('covers each of the 169 classes exactly once', () => {
    expect(ENTRIES).toHaveLength(HAND_CLASS_COUNT);
    expect(new Set(ENTRIES.map((e) => e.key)).size).toBe(HAND_CLASS_COUNT);
    expect([...ENTRIES].map((e) => e.key).sort()).toEqual(HAND_CLASSES.map((c) => c.key).sort());
  });

  it('is in rank order, strongest first, with no rank out of place', () => {
    ENTRIES.forEach((entry, index) => {
      expect(entry.rank).toBe(index + 1);
      const next = ENTRIES[index + 1];
      if (next !== undefined) expect(entry.equity).toBeGreaterThanOrEqual(next.equity);
    });
  });

  it('accumulates to the whole 1326-combo universe', () => {
    let combos = 0;
    for (const entry of ENTRIES) {
      combos += entry.comboCount;
      expect(entry.cumulativeCombos).toBe(combos);
      expect(entry.cumulativeShare).toBeCloseTo(combos / COMBO_COUNT, 12);
    }
    expect(combos).toBe(COMBO_COUNT);
  });

  it('holds equities that are equity — shares of a pot, strictly inside 0 and 1', () => {
    for (const entry of ENTRIES) {
      expect(entry.equity).toBeGreaterThan(0);
      expect(entry.equity).toBeLessThan(1);
    }
  });
});

describe('the claim that it is EXACT', () => {
  it('says EXACT, and the enumeration it records actually is exhaustive', () => {
    // `method: 'EXACT'` is a claim about how the numbers were produced, so it is checked
    // against the counts rather than taken at its word. If a future regeneration ever
    // sampled, `boardsPerClass` would drop below the board space and this would fail.
    expect(HAND_STRENGTH.method).toBe('EXACT');
    const { enumeration } = HAND_STRENGTH;
    expect(enumeration.boardSpaceSize).toBe(PREFLOP_RUNOUT_SPACE_SIZE);
    expect(enumeration.boardsPerClass).toBe(enumeration.boardSpaceSize);
    expect(enumeration.opponentHands).toBe(OPPONENT_HAND_COUNT);
    // 2,118,760 boards x 990 opponent hands that do not collide with them.
    expect(enumeration.scoredTrialsPerClass).toBe(2_118_760 * 990);
    expect(enumeration.scoredTrialsTotal).toBe(enumeration.scoredTrialsPerClass * HAND_CLASS_COUNT);
    expect(HAND_STRENGTH.trialCount).toBe(enumeration.scoredTrialsTotal);
  });

  it('carries the provenance a UI has to show', () => {
    expect(HAND_STRENGTH.rankBasis).toBe('HEADS_UP_ALLIN_EQUITY_VS_RANDOM_HAND');
    expect(HAND_STRENGTH.methodology.length).toBeGreaterThan(40);
    expect(HAND_STRENGTH.methodologyReport).toBe('docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md');
    expect(HAND_STRENGTH.generatorVersion).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(Number.isNaN(Date.parse(HAND_STRENGTH.generatedAt))).toBe(false);
  });

  it('reproduces the published all-in figures exactly, not approximately', () => {
    // 85.2% for a pair of aces against a random hand and 32.3% for the worst starting hand
    // are the textbook numbers. Nothing was fitted to them: the enumeration walked all
    // 2.1 billion showdowns and this is what came out. The AA value is pinned to the last
    // bit because an exact computation has no excuse for drifting.
    const aces = unwrap(handStrengthForKey('AA'));
    expect(aces.rank).toBe(1);
    expect(aces.equity).toBe(0.8520371330210104);
    expect(WEAKEST?.equity).toBeCloseTo(0.323, 3);
  });

  it('has no error bar, so equality is bit-identity and nothing else', () => {
    const first = ENTRIES[0];
    const second = ENTRIES[1];
    if (first === undefined || second === undefined) throw new Error('empty dataset');
    expect(handStrengthTied(first, first)).toBe(true);
    expect(handStrengthTied(first, second)).toBe(false);
  });

  it('records every exact tie there is, and this dataset has none', () => {
    // A tie in an exact dataset is a real property of the metric, not a measurement
    // artefact. `exactTies` is derived from the same values `handStrengthTied` compares, so
    // the two cannot disagree.
    const adjacentTies: string[] = [];
    ENTRIES.forEach((entry, index) => {
      const next = ENTRIES[index + 1];
      if (next !== undefined && handStrengthTied(entry, next)) {
        adjacentTies.push(`${entry.key} = ${next.key}`);
      }
    });
    expect(adjacentTies).toEqual([...HAND_STRENGTH.exactTies]);
    expect(HAND_STRENGTH.exactTies).toEqual([]);
  });
});

describe('the suit-symmetry check', () => {
  const { symmetry } = HAND_STRENGTH;

  it('passed, across a spread of classes and not just one', () => {
    // The claim that licenses measuring 169 classes instead of 1326 combos. Each check is
    // the same class enumerated exhaustively from a DIFFERENT combo of itself; the two cover
    // the same showdowns, so they must produce the same number.
    expect(symmetry.checks.length).toBeGreaterThanOrEqual(9);
    expect(symmetry.maxAbsoluteDifference).toBeLessThanOrEqual(HAND_STRENGTH_SYMMETRY_TOLERANCE);
    expect(symmetry.passed).toBe(true);
  });

  it('covers the whole strength range, top to bottom', () => {
    const rankOf = new Map(ENTRIES.map((e) => [e.key, e.rank]));
    expect(rankOf.get(symmetry.checks[0]?.key ?? '')).toBe(1);
    expect(rankOf.get(symmetry.checks[symmetry.checks.length - 1]?.key ?? '')).toBe(
      HAND_CLASS_COUNT,
    );
  });

  it('checks the shipped values, not some other run of them', () => {
    for (const check of symmetry.checks) {
      const shipped = unwrap(handStrengthForKey(check.key));
      expect(check.lowestComboEquity, check.key).toBe(shipped.equity);
      expect(check.absoluteDifference, check.key).toBeCloseTo(
        Math.abs(check.lowestComboEquity - check.highestComboEquity),
        18,
      );
    }
    expect(symmetry.maxAbsoluteDifference).toBeCloseTo(
      Math.max(...symmetry.checks.map((c) => c.absoluteDifference)),
      18,
    );
    expect(symmetry.identicalCount).toBe(
      symmetry.checks.filter((c) => c.absoluteDifference === 0).length,
    );
  });
});

describe('sanity signals', () => {
  it('puts AA first', () => {
    expect(ENTRIES[0]?.key).toBe('AA');
  });

  it('puts the unconnected offsuit rags last', () => {
    const bottomTen = ENTRIES.slice(-10).map((e) => e.key);
    expect(bottomTen).toContain('32o');
    expect(bottomTen).toContain('72o');
  });

  it('spans the range all-in preflop equity is known to span', () => {
    expect(ENTRIES[0]?.equity).toBeGreaterThan(0.8);
    expect(WEAKEST?.equity).toBeLessThan(0.4);
  });
});

describe('looking a class up', () => {
  it('finds every class three ways, and gets the same object each time', () => {
    for (const handClass of HAND_CLASSES) {
      const byClass = handStrengthOf(handClass);
      expect(handStrengthAt(handClass.index)).toBe(byClass);
      expect(unwrap(handStrengthForKey(handClass.key))).toBe(byClass);
      expect(byClass.key).toBe(handClass.key);
      expect(byClass.comboCount).toBe(handClass.comboCount);
    }
  });

  it('refuses a key that is not one of the 169 rather than guessing', () => {
    expect(handStrengthForKey('AKx')).toEqual({ ok: false, error: 'UNKNOWN_HAND_CLASS' });
    expect(handStrengthForKey('')).toEqual({ ok: false, error: 'UNKNOWN_HAND_CLASS' });
  });
});

describe('top X% of the hands actually dealt', () => {
  it('refuses a share outside 0..1 rather than clamping it', () => {
    for (const bad of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(topHandsByShare(bad)).toEqual({ ok: false, error: 'SHARE_OUT_OF_RANGE' });
    }
  });

  it('selects nothing at 0 and everything at 1', () => {
    const none = unwrap(topHandsByShare(0));
    expect(none.entries).toEqual([]);
    expect(none.comboCount).toBe(0);
    expect(none.actualShare).toBe(0);
    expect(none.weakestIncluded).toBeUndefined();

    const all = unwrap(topHandsByShare(1));
    expect(all.classCount).toBe(HAND_CLASS_COUNT);
    expect(all.comboCount).toBe(COMBO_COUNT);
    expect(all.actualShare).toBe(1);
  });

  it('always covers at least what was asked for, and by the smallest prefix that does', () => {
    for (const share of SHARES) {
      const selection = unwrap(topHandsByShare(share));
      expect(selection.actualShare, `share ${share}`).toBeGreaterThanOrEqual(share);
      expect(selection.requestedShare).toBe(share);
      expect(selection.comboCount).toBe(selection.entries.at(-1)?.cumulativeCombos ?? 0);
      // Nothing spare: dropping the weakest class would fall short of the request. (With no
      // exact ties in the dataset the cut is exactly this minimal prefix; the tie guard in
      // `topHandsByShare` would relax it only for classes of bit-identical equity.)
      const previous = ENTRIES[selection.classCount - 2]?.cumulativeShare ?? 0;
      if (selection.classCount > 0) expect(previous, `share ${share}`).toBeLessThan(share);
    }
  });

  it('nests, so dragging the slider only ever adds hands', () => {
    let previous: readonly string[] = [];
    for (const share of SHARES) {
      const keys = unwrap(topHandsByShare(share)).entries.map((e) => e.key);
      expect(keys.slice(0, previous.length)).toEqual([...previous]);
      previous = keys;
    }
  });

  it('cuts by combos, not by the 169 labels — which is the whole point', () => {
    // 15% of the LABELS is 25 classes, and those 25 are pair- and suited-heavy, so they are
    // nowhere near 15% of the hands dealt. A slider built on `rank / 169` would show this
    // smaller set and call it "상위 15%".
    const byLabel = ENTRIES.slice(0, Math.round(0.15 * HAND_CLASS_COUNT));
    const labelShare = (byLabel.at(-1)?.cumulativeCombos ?? 0) / COMBO_COUNT;
    expect(labelShare).toBeLessThan(0.15);

    const honest = unwrap(topHandsByShare(0.15));
    expect(honest.actualShare).toBeGreaterThanOrEqual(0.15);
    expect(honest.classCount).toBeGreaterThan(byLabel.length);
  });
});

describe('the shipped numbers came out of this code', () => {
  it('reproduces the committed cheap-budget values exactly', () => {
    // Same class, same budget, same engine: the sampler has no RNG, so this is not
    // "close enough", it is the same number. The cheap path is what makes this affordable —
    // recomputing the EXACT value would take 75 seconds a class.
    for (const check of HAND_STRENGTH.spotChecks) {
      const handClass = handClassByKey(check.key);
      if (handClass === undefined) throw new Error(`unknown spot-check class ${check.key}`);
      const measured = measureHandStrength(handClass, {
        runoutSamples: HAND_STRENGTH.spotCheckRunoutSamples,
      });
      expect(measured.equity, check.key).toBeCloseTo(check.equity, 12);
      expect(measured.exhaustive, check.key).toBe(false);
    }
  });

  it('lands within the deviation the generator measured for that cheap budget', () => {
    // The link between the cheap check and the exact table. `spotCheckMaxDeviation` is the
    // worst gap the generator saw across all 169 classes between the cheap sampled path and
    // the exact value — a measured tolerance, not a guessed one, and now a genuine accuracy
    // figure for the sampled path because the column it is compared against is the truth.
    for (const check of HAND_STRENGTH.spotChecks) {
      const shipped = unwrap(handStrengthForKey(check.key));
      expect(Math.abs(check.equity - shipped.equity), check.key).toBeLessThanOrEqual(
        HAND_STRENGTH.spotCheckMaxDeviation,
      );
    }
  });
});
