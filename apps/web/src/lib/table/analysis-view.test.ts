import { describe, expect, it } from 'vitest';

import { snapshotConfidence } from '@gto-self/player-core';
import type { ModelStatCount, SpotStatCount } from '@gto-self/player-core';
import type {
  AnalysisPlayerSummary,
  AnalysisSummary,
  AnalysisSummaryStatus,
} from '../../server/analysis-contract.js';
import {
  ANALYSIS_GATE_REASON_LABEL,
  STRATEGY_UNCHANGED_SENTENCE,
  analysisDisclaimer,
  countOrDash,
  observedRateLabel,
  overallStats,
  positionalStats,
  sessionAnalysisGate,
  topSpots,
} from './analysis-view.js';

const player = (over: Partial<AnalysisPlayerSummary> = {}): AnalysisPlayerSummary => ({
  playerId: 'p1',
  nickname: '모카',
  outcome: 'SNAPSHOT_CREATED',
  modelVersion: 1,
  totalHands: 10,
  addedSinceLastSnapshot: null,
  spotGroupCount: 4,
  showCount: 1,
  errorCode: null,
  errorMessage: null,
  ...over,
});

const summary = (
  status: AnalysisSummaryStatus,
  players: readonly AnalysisPlayerSummary[],
): AnalysisSummary => ({
  runId: status === 'NO_ELIGIBLE_HANDS' ? null : 'run-1',
  sessionId: 's1',
  status,
  algorithmVersion: 1,
  startedAt: 0,
  finishedAt: 5,
  durationMs: 5,
  sessionHandCount: 10,
  playerCount: players.length,
  observationCount: 40,
  showCount: 1,
  players,
});

const stat = (over: Partial<ModelStatCount> = {}): ModelStatCount => ({
  key: 'VPIP',
  position: null,
  opportunities: 40,
  actions: 10,
  confidence: snapshotConfidence(40),
  ...over,
});

const spot = (spotKey: string, opportunities: number): SpotStatCount => ({
  spotKey,
  spot: {
    phase: 'PREFLOP',
    family: 'RFI',
    position: 'BTN',
    opponentPosition: null,
    lineup: 'MULTIWAY',
  },
  opportunities,
  effects: { FOLD: opportunities, CHECK: 0, CALL: 0, BET: 0, RAISE: 0 },
  verbs: { FOLD: opportunities, CHECK: 0, CALL: 0, BET: 0, RAISE: 0, ALL_IN: 0 },
  confidence: snapshotConfidence(opportunities),
});

describe('sessionAnalysisGate', () => {
  it('enables the button when there is no hand at all', () => {
    expect(sessionAnalysisGate({ phase: null, savesInFlight: 0, running: false })).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it('enables the button on a COMPLETE hand — the between-hands boundary', () => {
    expect(sessionAnalysisGate({ phase: 'COMPLETE', savesInFlight: 0, running: false })).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it('refuses every live phase, including AWAITING_AWARD', () => {
    for (const phase of ['SETUP', 'AWAITING_ACTION', 'AWAITING_BOARD', 'AWAITING_AWARD'] as const) {
      expect(sessionAnalysisGate({ phase, savesInFlight: 0, running: false })).toEqual({
        enabled: false,
        reason: 'HAND_IN_PROGRESS',
      });
    }
  });

  it('refuses while a completed hand is still on its way to the database', () => {
    // Otherwise the run reports a session hand count one short of what was just played.
    expect(sessionAnalysisGate({ phase: 'COMPLETE', savesInFlight: 1, running: false })).toEqual({
      enabled: false,
      reason: 'SAVE_IN_FLIGHT',
    });
  });

  it('refuses while a run this browser started is still in flight', () => {
    expect(sessionAnalysisGate({ phase: null, savesInFlight: 0, running: true })).toEqual({
      enabled: false,
      reason: 'RUNNING',
    });
  });

  it('reports the run before the hand and the hand before the save', () => {
    expect(
      sessionAnalysisGate({ phase: 'AWAITING_ACTION', savesInFlight: 2, running: true }).reason,
    ).toBe('RUNNING');
    expect(
      sessionAnalysisGate({ phase: 'AWAITING_ACTION', savesInFlight: 2, running: false }).reason,
    ).toBe('HAND_IN_PROGRESS');
  });

  it('has a Korean sentence for every reason', () => {
    for (const reason of ['RUNNING', 'HAND_IN_PROGRESS', 'SAVE_IN_FLIGHT'] as const) {
      expect(ANALYSIS_GATE_REASON_LABEL[reason].length).toBeGreaterThan(0);
    }
  });
});

describe('analysisDisclaimer', () => {
  it('says the model was updated, and that strategy is not, verbatim (prompt §27)', () => {
    expect(analysisDisclaimer(summary('SUCCESS', [player()]))).toBe(
      '플레이어 모델이 업데이트되었습니다. 현재 기본전략 추천에는 아직 반영되지 않습니다.',
    );
  });

  it('does NOT claim an update when every player was already up to date', () => {
    const text = analysisDisclaimer(
      summary('SUCCESS', [player({ outcome: 'NO_CHANGES', spotGroupCount: null })]),
    );
    expect(text).not.toContain('업데이트되었습니다.');
    expect(text).toContain('그대로 유지되었습니다');
    expect(text).toContain(STRATEGY_UNCHANGED_SENTENCE);
  });

  it('says only SOME players were updated on a PARTIAL run', () => {
    const text = analysisDisclaimer(
      summary('PARTIAL', [player(), player({ playerId: 'p2', outcome: 'FAILED' })]),
    );
    expect(text).toContain('일부 플레이어');
    expect(text).toContain(STRATEGY_UNCHANGED_SENTENCE);
  });

  it('says nothing was updated on a FAILED run', () => {
    const text = analysisDisclaimer(summary('FAILED', [player({ outcome: 'FAILED' })]));
    expect(text).toContain('업데이트하지 못했습니다');
    expect(text).toContain(STRATEGY_UNCHANGED_SENTENCE);
  });

  it('treats NO_ELIGIBLE_HANDS as information, not as a failure', () => {
    const text = analysisDisclaimer(summary('NO_ELIGIBLE_HANDS', []));
    expect(text).toContain('분석할 완료된 핸드가 아직 없습니다');
    expect(text).not.toContain('실패');
    expect(text).toContain(STRATEGY_UNCHANGED_SENTENCE);
  });

  it('always carries the strategy sentence, whatever happened', () => {
    for (const status of ['SUCCESS', 'PARTIAL', 'FAILED', 'NO_ELIGIBLE_HANDS'] as const) {
      expect(analysisDisclaimer(summary(status, [player()]))).toContain(
        STRATEGY_UNCHANGED_SENTENCE,
      );
    }
  });
});

describe('countOrDash', () => {
  it('renders a measured zero as 0 and an unmeasured value as a dash', () => {
    expect(countOrDash(0)).toBe('0');
    expect(countOrDash(null)).toBe('—');
  });
});

describe('observedRateLabel', () => {
  it('derives a whole percent, rounded half away from zero', () => {
    // 1/3 = 33.33…% -> 33%; 2/3 = 66.66…% -> 67%, not 66% (a truncation would say 66).
    expect(observedRateLabel(1, 3, 'KNOWN')).toBe('33%');
    expect(observedRateLabel(2, 3, 'KNOWN')).toBe('67%');
    expect(observedRateLabel(0, 7, 'KNOWN')).toBe('0%');
    expect(observedRateLabel(7, 7, 'KNOWN')).toBe('100%');
  });

  it('shows a rate for a LEARNING sample', () => {
    expect(observedRateLabel(3, 10, 'LEARNING')).toBe('30%');
  });

  it('never shows a percentage for an UNKNOWN sample', () => {
    expect(observedRateLabel(1, 2, 'UNKNOWN')).toBe('—');
  });

  it('has no denominator to divide by when nothing was observed', () => {
    expect(observedRateLabel(0, 0, 'UNKNOWN')).toBe('—');
  });

  it('refuses an impossible pair instead of throwing and blanking the profile', () => {
    // Only reachable from damaged storage. The counts are still rendered beside the dash.
    expect(observedRateLabel(9, 4, 'KNOWN')).toBe('—');
    expect(observedRateLabel(-1, 4, 'KNOWN')).toBe('—');
  });
});

describe('stat partitioning', () => {
  const stats = [
    stat({ key: 'VPIP', position: null, opportunities: 40, actions: 10 }),
    stat({ key: 'VPIP', position: 'BTN', opportunities: 7, actions: 4 }),
    stat({ key: 'VPIP', position: 'BB', opportunities: 33, actions: 6 }),
  ];

  it('keeps the null-position bucket to itself', () => {
    expect(overallStats(stats)).toHaveLength(1);
    expect(overallStats(stats)[0]?.opportunities).toBe(40);
  });

  it('keeps the positional rows separate, and never sums them into the headline', () => {
    const positional = positionalStats(stats);
    expect(positional).toHaveLength(2);
    // The two lists are disjoint: no row can be counted in both, so nothing can add them.
    expect(positional.some((row) => row.position === null)).toBe(false);
    const summed = positional.reduce((total, row) => total + row.opportunities, 0);
    expect(summed).toBe(40);
    // The headline is its OWN reading of 40, not this sum — same number here, and the code
    // must still never derive one from the other (ADR-0035).
    expect(overallStats(stats).length + positional.length).toBe(stats.length);
  });
});

describe('topSpots', () => {
  it('orders by opportunities, breaks ties by key, and caps the list', () => {
    const spots = [spot('B', 5), spot('A', 5), spot('C', 20)];
    expect(topSpots(spots, 2).map((s) => s.spotKey)).toEqual(['C', 'A']);
    expect(topSpots(spots, 10)).toHaveLength(3);
  });

  it('does not mutate the order the model was stored in', () => {
    const spots = [spot('B', 5), spot('C', 20)];
    topSpots(spots, 2);
    expect(spots.map((s) => s.spotKey)).toEqual(['B', 'C']);
  });

  it('breaks ties by CODE POINT, agreeing with the stored ordering in any locale', () => {
    // `localeCompare` reorders exactly these pairs, and differently per locale/ICU version:
    // it sorts case-insensitively ('a' before 'B'), treats '_' as ignorable punctuation, and
    // in a Swedish collation puts 'Z' before 'Ä'. A display order that depends on the
    // machine's locale contradicts this module's own "stable across runs" claim, and would
    // disagree with `analysis-core`'s `aggregate.ts`, which stores the code-point order
    // (review R1/m6).
    const keys = ['B_a', 'Ba', 'a', 'B', 'Z', 'Ä', 'RFI_BTN', 'RFI_CO'];
    const ordered = topSpots(
      keys.map((key) => spot(key, 5)),
      keys.length,
    ).map((s) => s.spotKey);
    expect(ordered).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    // Stated literally, so the pin does not rest on the very comparator under test.
    expect(ordered).toEqual(['B', 'B_a', 'Ba', 'RFI_BTN', 'RFI_CO', 'Z', 'a', 'Ä']);
    // ... and that is NOT what any of these locales would have produced.
    for (const locale of ['en', 'sv', 'de']) {
      expect([...keys].sort((a, b) => a.localeCompare(b, locale))).not.toEqual(ordered);
    }
  });
});
