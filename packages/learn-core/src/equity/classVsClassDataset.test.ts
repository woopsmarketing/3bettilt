/**
 * Structural checks on the frozen dataset, plus the one expensive check that actually matters:
 * re-deriving a frozen entry with the live `classVsClassEquity` engine and requiring a
 * BIT-IDENTICAL answer. `classVsClassEquity` has no RNG and no sampling on this path — every
 * legal pairing is enumerated exhaustively — so a correct implementation reproduces the frozen
 * numbers exactly, not approximately. This is the same "generator consistency" pattern
 * `strength/ranking.test.ts` uses against `dataset.generated.ts`.
 *
 * The recomputation is genuinely expensive (QQ vs AKs is 24 full preflop pairings, ~2s on the
 * machine this was authored on — see `docs/reports/WP_G3_DOMAIN_FACTS.md` §7), which is
 * exactly why the matchup is frozen rather than computed on every test run of every other
 * file; it is paid here, once, deliberately.
 */
import { describe, expect, it } from 'vitest';
import { handClassByKey } from '@gto-self/strategy-core';
import { classVsClassEquity } from './classVsClass.js';
import {
  CLASS_VS_CLASS_DATASET_META,
  CLASS_VS_CLASS_MATCHUPS,
  classVsClassMatchupFor,
} from './classVsClassDataset.js';

describe('classVsClassDataset — structure', () => {
  it('freezes exactly the two matchups content cites: QQ vs AKs and QQ vs AKo', () => {
    const keys = CLASS_VS_CLASS_MATCHUPS.map((m) => `${m.classAKey} vs ${m.classBKey}`);
    expect(keys).toEqual(['QQ vs AKs', 'QQ vs AKo']);
  });

  it('every frozen matchup is EXACT, preflop, and fully accounted for', () => {
    for (const matchup of CLASS_VS_CLASS_MATCHUPS) {
      expect(matchup.method).toBe('EXACT');
      expect(matchup.board).toEqual([]);
      expect(matchup.skippedPairings).toBe(0);
      expect(matchup.pairingCount).toBe(matchup.totalPairingsConsidered);
      expect(matchup.wins + matchup.ties + matchup.losses).toBe(matchup.runouts);
      expect(matchup.classAWinBps + matchup.tieBps + matchup.classBWinBps).toBe(10000);
    }
  });

  it('QQ has 6 combos and the AK pairing counts follow: 24 vs AKs, 72 vs AKo', () => {
    const vsAKs = CLASS_VS_CLASS_MATCHUPS.find((m) => m.classBKey === 'AKs');
    const vsAKo = CLASS_VS_CLASS_MATCHUPS.find((m) => m.classBKey === 'AKo');
    expect(vsAKs?.pairingCount).toBe(24); // 6 * 4
    expect(vsAKo?.pairingCount).toBe(72); // 6 * 12
  });

  it('carries methodology metadata pointing at this WP\'s report', () => {
    expect(CLASS_VS_CLASS_DATASET_META.methodologyReport).toBe(
      'docs/reports/WP_G3_DOMAIN_FACTS.md',
    );
    expect(typeof CLASS_VS_CLASS_DATASET_META.methodology).toBe('string');
    expect(CLASS_VS_CLASS_DATASET_META.methodology.length).toBeGreaterThan(0);
  });
});

describe('classVsClassDataset — lookup', () => {
  it('classVsClassMatchupFor finds a frozen matchup in its stored order', () => {
    const result = classVsClassMatchupFor('QQ', 'AKs');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.classAKey).toBe('QQ');
      expect(result.value.classBKey).toBe('AKs');
      expect(result.value.equity).toBeGreaterThan(0.5); // QQ is favored over AKs
    }
  });

  it('classVsClassMatchupFor also answers the mirrored order, as the complement', () => {
    const forward = classVsClassMatchupFor('QQ', 'AKo');
    const mirror = classVsClassMatchupFor('AKo', 'QQ');
    expect(forward.ok && mirror.ok).toBe(true);
    if (forward.ok && mirror.ok) {
      expect(mirror.value.classAKey).toBe('AKo');
      expect(mirror.value.classBKey).toBe('QQ');
      expect(mirror.value.wins).toBe(forward.value.losses);
      expect(mirror.value.losses).toBe(forward.value.wins);
      expect(mirror.value.ties).toBe(forward.value.ties);
      expect(mirror.value.equity).toBeCloseTo(1 - forward.value.equity, 15);
    }
  });

  it('an uncited matchup is refused rather than computed on the spot', () => {
    const result = classVsClassMatchupFor('AA', 'KK');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('UNKNOWN_MATCHUP');
  });
});

describe('classVsClassDataset — generator consistency (the expensive one)', () => {
  it(
    're-deriving QQ vs AKs live reproduces the frozen entry bit-for-bit',
    () => {
      const frozen = CLASS_VS_CLASS_MATCHUPS.find((m) => m.classBKey === 'AKs');
      expect(frozen).toBeDefined();
      if (frozen === undefined) return;

      const QQ = handClassByKey('QQ');
      const AKs = handClassByKey('AKs');
      expect(QQ).toBeDefined();
      expect(AKs).toBeDefined();
      if (QQ === undefined || AKs === undefined) return;

      const recomputed = classVsClassEquity(QQ, AKs, []);
      expect(recomputed.ok).toBe(true);
      if (!recomputed.ok) return;

      expect(recomputed.value).toEqual(frozen);
    },
    60_000,
  );
});
