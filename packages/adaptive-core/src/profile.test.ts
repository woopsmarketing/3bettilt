/**
 * The shrinkage arithmetic, pinned on real numbers.
 *
 * Every expected value in this file was computed from the formula in `profile.ts` by hand
 * and is written as a literal. That is deliberate: a test that recomputes the formula it is
 * testing asserts only that the code is self-consistent, which is exactly the property that
 * survives a wrong formula.
 */
import { describe, expect, it } from 'vitest';
import {
  ADAPTIVE_MAX_SAMPLE_N,
  DUPLICATE_SOURCE_NOTE,
  buildAdjustmentProfile,
  emptyOpponentInput,
  type AdaptiveStatEstimate,
} from './profile.js';
import {
  MANUAL_HUD_MAX_CONFIDENCE_BPS,
  manualHudSampleCap,
  type AdaptiveStatObservation,
} from './inputs.js';
import { ADAPTIVE_PRIORS, ADAPTIVE_STAT_K, EXTERNAL_HUD_CONFIDENCE_BPS } from './priors.js';
import { ADAPTIVE_STAT_KEYS, type AdaptiveStatKey } from './stats.js';
import type { AdaptiveOpponentInput } from './inputs.js';

/** One opponent with exactly the observations a test cares about. No clock, no ids. */
function inputWith(observations: readonly AdaptiveStatObservation[]): AdaptiveOpponentInput {
  return {
    playerId: 'player-1',
    seatIndex: 3,
    nickname: 'Villain',
    observations,
    manualHudSnapshotId: 'hud-7',
    manualHudRecordedAt: 1_700_000_000_000,
    learnedSnapshotId: 'model-9',
    learnedModelVersion: 4,
    externalHudSnapshotId: 'external-3',
    externalHudRecordedAt: 1_700_000_000_000,
  };
}

const learned = (
  key: AdaptiveStatKey,
  valueBps: number,
  sampleN: number,
  note: string | null = null,
): AdaptiveStatObservation => ({ key, source: 'LEARNED_MODEL', valueBps, sampleN, note });

const manual = (
  key: AdaptiveStatKey,
  valueBps: number,
  sampleN: number,
  note: string | null = null,
): AdaptiveStatObservation => ({ key, source: 'MANUAL_HUD', valueBps, sampleN, note });

/** `sampleN` is always 0: an `EXTERNAL_HUD` reading never carries a real opportunity count. */
const external = (
  key: AdaptiveStatKey,
  valueBps: number,
  note: string | null = null,
): AdaptiveStatObservation => ({ key, source: 'EXTERNAL_HUD', valueBps, sampleN: 0, note });

const statOf = (input: AdaptiveOpponentInput, key: AdaptiveStatKey): AdaptiveStatEstimate =>
  buildAdjustmentProfile(input).stats[key];

describe('the model data the formula reads', () => {
  it('anchors FOLD_TO_CBET_FLOP at 4500 bps with K = 40', () => {
    // The two worked examples below are only meaningful against these exact inputs, so they
    // are asserted here rather than assumed.
    expect(ADAPTIVE_PRIORS.FOLD_TO_CBET_FLOP.value).toBe(4500);
    expect(ADAPTIVE_PRIORS.FOLD_TO_CBET_FLOP.provenance).toBe('HEURISTIC');
    expect(ADAPTIVE_STAT_K.FOLD_TO_CBET_FLOP).toBe(40);
  });
});

describe('the two worked examples of the design contract', () => {
  // prior 4500, K 40, observed 10000 over n = 2:
  //   conf     = round(10000 * 2 / 42)                          = 476
  //   estimate = round((4500 * 9524 + 10000 * 476) / 10000)
  //            = round((42858000 + 4760000) / 10000) = round(4761.8) = 4762
  it('barely moves the anchor on a two-observation sample', () => {
    const stat = statOf(inputWith([learned('FOLD_TO_CBET_FLOP', 10000, 2)]), 'FOLD_TO_CBET_FLOP');
    expect(stat.priorBps).toBe(4500);
    expect(stat.observedBps).toBe(10000);
    expect(stat.sampleN).toBe(2);
    expect(stat.confidenceBps).toBe(476);
    expect(stat.estimateBps).toBe(4762);
    expect(stat.deviationBps).toBe(262);
    expect(stat.confidenceState).toBe('UNKNOWN');
    expect(stat.available).toBe(true);
  });

  // prior 4500, K 40, observed 7500 over n = 100:
  //   conf     = round(10000 * 100 / 140)                        = 7143
  //   estimate = round((4500 * 2857 + 7500 * 7143) / 10000)
  //            = round((12856500 + 53572500) / 10000) = round(6642.9) = 6643
  it('mostly follows the reading on a hundred-observation sample', () => {
    const stat = statOf(inputWith([learned('FOLD_TO_CBET_FLOP', 7500, 100)]), 'FOLD_TO_CBET_FLOP');
    expect(stat.observedBps).toBe(7500);
    expect(stat.sampleN).toBe(100);
    expect(stat.confidenceBps).toBe(7143);
    expect(stat.estimateBps).toBe(6643);
    expect(stat.deviationBps).toBe(2143);
    expect(stat.confidenceState).toBe('KNOWN');
  });

  it('moves strictly further on the larger sample despite the smaller raw reading', () => {
    const small = statOf(inputWith([learned('FOLD_TO_CBET_FLOP', 10000, 2)]), 'FOLD_TO_CBET_FLOP');
    const large = statOf(inputWith([learned('FOLD_TO_CBET_FLOP', 7500, 100)]), 'FOLD_TO_CBET_FLOP');
    // The whole point of the shrinkage: 100% over 2 hands is a worse reason to change the
    // strategy than 75% over 100 hands, even though 100% is the more extreme number.
    expect(large.observedBps).toBeLessThan(small.observedBps);
    expect(Math.abs(large.deviationBps)).toBeGreaterThan(Math.abs(small.deviationBps));
  });
});

describe('pooling two sources', () => {
  // MANUAL_HUD 6000 over 40 and LEARNED_MODEL 8000 over 60:
  //   observed = (6000*40 + 8000*60) / 100 = (240000 + 480000) / 100 = 7200
  //   conf     = round(10000 * 100 / 140) = 7143
  //   estimate = round((4500 * 2857 + 7200 * 7143) / 10000)
  //            = round((12856500 + 51429600) / 10000) = round(6428.61) = 6429
  const pooled = statOf(
    inputWith([
      manual('FOLD_TO_CBET_FLOP', 6000, 40, 'HUD'),
      learned('FOLD_TO_CBET_FLOP', 8000, 60, '자체 관측'),
    ]),
    'FOLD_TO_CBET_FLOP',
  );

  it('pools into the sample-weighted mean', () => {
    expect(pooled.sampleN).toBe(100);
    expect(pooled.observedBps).toBe(7200);
    expect(pooled.confidenceBps).toBe(7143);
    expect(pooled.estimateBps).toBe(6429);
    expect(pooled.deviationBps).toBe(1929);
  });

  it('retains both sources with their own value, sample and caveat', () => {
    // Provenance is never merged away: the pooled 7200 exists alongside, not instead of,
    // the two readings that produced it.
    expect(pooled.sources).toEqual([
      { source: 'MANUAL_HUD', valueBps: 6000, sampleN: 40, note: 'HUD' },
      { source: 'LEARNED_MODEL', valueBps: 8000, sampleN: 60, note: '자체 관측' },
    ]);
  });

  it('emits sources in canonical order whatever order they arrived in', () => {
    const reversed = statOf(
      inputWith([
        learned('FOLD_TO_CBET_FLOP', 8000, 60, '자체 관측'),
        manual('FOLD_TO_CBET_FLOP', 6000, 40, 'HUD'),
      ]),
      'FOLD_TO_CBET_FLOP',
    );
    expect(reversed).toEqual(pooled);
  });

  it('lets the pooled mean sit between the two readings', () => {
    expect(pooled.observedBps).toBeGreaterThan(6000);
    expect(pooled.observedBps).toBeLessThan(8000);
  });
});

describe('an unknown sample size', () => {
  // `handSample === null` reaches this package as `sampleN: 0`. It must carry ZERO weight,
  // not a small one, and the caveat must survive to the UI.
  const stat = statOf(inputWith([manual('VPIP', 3800, 0, 'HUD 표본 수 미입력')]), 'VPIP');

  it('gives the reading no weight at all', () => {
    expect(stat.sampleN).toBe(0);
    expect(stat.confidenceBps).toBe(0);
    expect(stat.observedBps).toBe(ADAPTIVE_PRIORS.VPIP.value);
    expect(stat.estimateBps).toBe(ADAPTIVE_PRIORS.VPIP.value);
    expect(stat.deviationBps).toBe(0);
    expect(stat.confidenceState).toBe('UNKNOWN');
  });

  it('still records that a source supplied it, with the value and the caveat intact', () => {
    expect(stat.available).toBe(true);
    expect(stat.sources).toEqual([
      { source: 'MANUAL_HUD', valueBps: 3800, sampleN: 0, note: 'HUD 표본 수 미입력' },
    ]);
  });
});

describe('sample sizes at the extremes', () => {
  it('never lets confidence exceed 10000 bps and never leaves the safe integer range', () => {
    const stat = statOf(
      inputWith([learned('FOLD_TO_CBET_FLOP', 9900, Number.MAX_SAFE_INTEGER)]),
      'FOLD_TO_CBET_FLOP',
    );
    expect(stat.sampleN).toBe(ADAPTIVE_MAX_SAMPLE_N);
    expect(stat.confidenceBps).toBeLessThanOrEqual(10000);
    expect(stat.confidenceBps).toBe(10000);
    // At full confidence the anchor is released entirely and the estimate IS the reading.
    expect(stat.estimateBps).toBe(9900);
    expect(stat.deviationBps).toBe(5400);
    for (const value of [stat.sampleN, stat.confidenceBps, stat.estimateBps, stat.deviationBps]) {
      expect(Number.isSafeInteger(value)).toBe(true);
    }
  });

  it('does not itself apply the manual HUD cap — that is the caller’s job', () => {
    // `manualHudSampleCap` is applied in `apps/web/src/server/adaptive-service.ts` so the
    // capped number is the one stored and displayed. A profile that re-applied it would
    // make the trace disagree with the arithmetic.
    const stat = statOf(inputWith([manual('VPIP', 3000, 5000)]), 'VPIP');
    expect(stat.sampleN).toBe(5000);
  });

  it('caps a manual HUD reading at a third of full confidence, whatever is typed', () => {
    // Review R1 MAJOR 3: a HUD reports a HAND count, not this stat's OPPORTUNITY count, so
    // it is capped at `floor(K / 2)` — which makes the reachable confidence
    // `(K/2) / ((K/2) + K) = 1/3` for EVERY stat, no matter how many hands are claimed.
    for (const key of ADAPTIVE_STAT_KEYS) {
      const capped = manualHudSampleCap(key);
      const stat = statOf(inputWith([manual(key, 9000, capped)]), key);
      expect(stat.sampleN).toBe(capped);
      expect(stat.confidenceBps).toBeLessThanOrEqual(MANUAL_HUD_MAX_CONFIDENCE_BPS);
    }
  });

  it('leaves a HUD-only reading below the sizing gate but above the frequency gate', () => {
    // The property the cap exists to produce: typed testimony can move a FREQUENCY
    // (gate 2500) but can never on its own move a bet SIZE (gate 5000 heads-up).
    // The cap itself is applied by the caller, so this asserts the CONSEQUENCE of a capped
    // sample reaching the formula. `adaptive-service.test.ts` pins that 40,000 typed hands
    // really are reduced to this number at the mapping boundary.
    const key = 'FOLD_TO_CBET_FLOP';
    const stat = statOf(inputWith([manual(key, 9000, manualHudSampleCap(key))]), key);
    expect(stat.sampleN).toBe(20);
    expect(stat.confidenceBps).toBe(3333);
    expect(stat.confidenceBps).toBeGreaterThan(2500);
    expect(stat.confidenceBps).toBeLessThan(5000);
  });

  it('sanitizes malformed numbers instead of throwing', () => {
    const stat = statOf(
      inputWith([manual('PFR', -400, 12.9), learned('PFR', 99_999, Number.NaN)]),
      'PFR',
    );
    expect(stat.sources).toEqual([
      { source: 'MANUAL_HUD', valueBps: 0, sampleN: 12, note: null },
      { source: 'LEARNED_MODEL', valueBps: 10000, sampleN: 0, note: null },
    ]);
    // Only the manual reading has a denominator, so it alone sets the pooled value.
    expect(stat.sampleN).toBe(12);
    expect(stat.observedBps).toBe(0);
  });
});

describe('duplicate (key, source) readings', () => {
  const stat = statOf(
    inputWith([
      manual('WTSD', 2000, 10, '오래된 값'),
      manual('WTSD', 3400, 80, '최신 값'),
      learned('WTSD', 2900, 50),
    ]),
    'WTSD',
  );

  it('keeps the last one and drops neither source', () => {
    expect(stat.sources).toHaveLength(2);
    expect(stat.sources[0]?.source).toBe('MANUAL_HUD');
    expect(stat.sources[0]?.valueBps).toBe(3400);
    expect(stat.sources[0]?.sampleN).toBe(80);
    expect(stat.sources[1]?.valueBps).toBe(2900);
  });

  it('records the collision in the note without destroying the caveat', () => {
    expect(stat.sources[0]?.note).toBe(`최신 값 · ${DUPLICATE_SOURCE_NOTE} (superseded 1)`);
    expect(stat.sources[1]?.note).toBeNull();
  });

  it('records the collision even when the surviving reading had no caveat', () => {
    const noNote = statOf(inputWith([manual('WSD', 4000, 10), manual('WSD', 4400, 20)]), 'WSD');
    expect(noNote.sources[0]?.note).toBe(`${DUPLICATE_SOURCE_NOTE} (superseded 1)`);
  });

  it('pools only the surviving readings', () => {
    // (3400*80 + 2900*50) / 130 = (272000 + 145000) / 130 = 417000 / 130 = 3207.69 -> 3208
    expect(stat.sampleN).toBe(130);
    expect(stat.observedBps).toBe(3208);
  });
});

describe('an input with nothing in it', () => {
  const profile = buildAdjustmentProfile(emptyOpponentInput('player-1', 3, 'Villain'));

  it('still carries all 20 stats, in the canonical order', () => {
    expect(Object.keys(profile.stats)).toEqual([...ADAPTIVE_STAT_KEYS]);
    expect(ADAPTIVE_STAT_KEYS).toHaveLength(20);
  });

  it('marks every one unavailable and adjusts by exactly nothing', () => {
    for (const key of ADAPTIVE_STAT_KEYS) {
      const stat = profile.stats[key];
      expect(stat.key).toBe(key);
      expect(stat.available).toBe(false);
      expect(stat.sources).toEqual([]);
      expect(stat.sampleN).toBe(0);
      expect(stat.confidenceBps).toBe(0);
      expect(stat.confidenceState).toBe('UNKNOWN');
      // The neutrality property the whole design rests on: no data means the estimate IS
      // the anchor, so every downstream rule reads a deviation of exactly zero.
      expect(stat.priorBps).toBe(ADAPTIVE_PRIORS[key].value);
      expect(stat.observedBps).toBe(stat.priorBps);
      expect(stat.estimateBps).toBe(stat.priorBps);
      expect(stat.deviationBps).toBe(0);
      expect(stat.k).toBe(ADAPTIVE_STAT_K[key]);
    }
    expect(profile.totalObservedSampleN).toBe(0);
  });

  it('carries the identity and provenance through untouched', () => {
    expect(profile.playerId).toBe('player-1');
    expect(profile.seatIndex).toBe(3);
    expect(profile.nickname).toBe('Villain');
    expect(profile.manualHudSnapshotId).toBeNull();
    expect(profile.learnedSnapshotId).toBeNull();
    expect(profile.learnedModelVersion).toBeNull();
  });
});

describe('a profile with several stats supplied', () => {
  const input = inputWith([
    manual('VPIP', 3100, 900),
    manual('PFR', 2200, 900),
    learned('THREE_BET', 1100, 64),
    learned('CHECK_RAISE_TURN', 1500, 18),
    learned('FOLD_BB_TO_STEAL', 7200, 31),
  ]);
  const profile = buildAdjustmentProfile(input);

  it('sums the evidence behind the whole profile', () => {
    expect(profile.totalObservedSampleN).toBe(900 + 900 + 64 + 18 + 31);
  });

  it('leaves the fifteen unsupplied stats at exactly zero deviation', () => {
    const supplied = new Set<AdaptiveStatKey>([
      'VPIP',
      'PFR',
      'THREE_BET',
      'CHECK_RAISE_TURN',
      'FOLD_BB_TO_STEAL',
    ]);
    const untouched = ADAPTIVE_STAT_KEYS.filter((key) => !supplied.has(key));
    expect(untouched).toHaveLength(15);
    for (const key of untouched) {
      expect(profile.stats[key].available).toBe(false);
      expect(profile.stats[key].deviationBps).toBe(0);
    }
  });

  it('produces integers everywhere — there is no float in the profile', () => {
    for (const key of ADAPTIVE_STAT_KEYS) {
      const stat = profile.stats[key];
      for (const value of [
        stat.priorBps,
        stat.observedBps,
        stat.estimateBps,
        stat.deviationBps,
        stat.sampleN,
        stat.confidenceBps,
        stat.k,
      ]) {
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(stat.estimateBps - stat.priorBps).toBe(stat.deviationBps);
      expect(stat.estimateBps).toBeGreaterThanOrEqual(0);
      expect(stat.estimateBps).toBeLessThanOrEqual(10000);
      expect(stat.confidenceBps).toBeGreaterThanOrEqual(0);
      expect(stat.confidenceBps).toBeLessThanOrEqual(10000);
    }
  });

  it('reaches the three confidence display states over the samples given', () => {
    expect(profile.stats.VPIP.confidenceState).toBe('KNOWN'); // n = 900 >= 30
    expect(profile.stats.CHECK_RAISE_TURN.confidenceState).toBe('LEARNING'); // 5 <= 18 < 30
    expect(profile.stats.WSD.confidenceState).toBe('UNKNOWN'); // n = 0
  });
});

describe('determinism', () => {
  const observations: readonly AdaptiveStatObservation[] = [
    manual('VPIP', 3100, 900, 'HUD'),
    learned('VPIP', 2600, 412, null),
    learned('CBET_RIVER', 3100, 9, null),
    learned('WSD', 5200, 77, null),
  ];

  it('produces deep-equal and byte-equal output for equal input', () => {
    const first = buildAdjustmentProfile(inputWith(observations));
    const second = buildAdjustmentProfile(inputWith([...observations]));
    expect(first).toEqual(second);
    // The string form is the stronger claim: it pins key ORDER as well as values, which is
    // what makes a stored trace comparable across runs.
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('has no clock or random source in it — a second call is identical', () => {
    const digest = JSON.stringify(buildAdjustmentProfile(inputWith(observations)));
    expect(JSON.stringify(buildAdjustmentProfile(inputWith(observations)))).toBe(digest);
  });
});

describe('EXTERNAL_HUD precedence (WP-K, ADR-0067)', () => {
  it('uses EXTERNAL_HUD alone, at the fixed confidence, ignoring sampleN entirely', () => {
    const stat = statOf(inputWith([external('VPIP', 3500)]), 'VPIP');
    const prior = ADAPTIVE_PRIORS.VPIP.value;
    expect(stat.confidenceBps).toBe(EXTERNAL_HUD_CONFIDENCE_BPS);
    expect(stat.confidenceState).toBe('KNOWN');
    expect(stat.observedBps).toBe(3500);
    expect(stat.sampleN).toBe(0);
    expect(stat.available).toBe(true);
    expect(stat.sources).toEqual([
      { source: 'EXTERNAL_HUD', valueBps: 3500, sampleN: 0, note: null },
    ]);
    // estimate = round((prior*(10000-9000) + 3500*9000) / 10000)
    expect(stat.estimateBps).toBe(Math.round((prior * 1000 + 3500 * 9000) / 10000));
  });

  it('TAKES PRECEDENCE over MANUAL_HUD and LEARNED_MODEL for the same stat, not pooled with them', () => {
    const input = inputWith([
      external('VPIP', 3500),
      manual('VPIP', 2000, 900),
      learned('VPIP', 1000, 500),
    ]);
    const stat = statOf(input, 'VPIP');
    // Only the external reading is used: observedBps is 3500, not some blend with 2000/1000.
    expect(stat.observedBps).toBe(3500);
    expect(stat.confidenceBps).toBe(EXTERNAL_HUD_CONFIDENCE_BPS);
    expect(stat.sources).toEqual([
      { source: 'EXTERNAL_HUD', valueBps: 3500, sampleN: 0, note: null },
    ]);
  });

  it('falls back to pooling MANUAL_HUD/LEARNED_MODEL for a stat EXTERNAL_HUD does not cover', () => {
    const input = inputWith([
      external('VPIP', 3500),
      manual('PFR', 2200, 900),
      learned('PFR', 1800, 300),
    ]);
    const pfr = statOf(input, 'PFR');
    expect(pfr.sources.map((source) => source.source)).toEqual(['MANUAL_HUD', 'LEARNED_MODEL']);
    expect(pfr.sampleN).toBe(1200);
  });

  it('a player with no EXTERNAL_HUD profile is unaffected: behaves exactly as WP-J did', () => {
    const input = inputWith([manual('VPIP', 3100, 900), learned('VPIP', 2600, 412)]);
    const stat = statOf(input, 'VPIP');
    expect(stat.sources.map((source) => source.source)).toEqual(['MANUAL_HUD', 'LEARNED_MODEL']);
  });
});
