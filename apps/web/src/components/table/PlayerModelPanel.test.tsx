import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { asId } from '@gto-self/shared';
import { snapshotConfidence, timestamp } from '@gto-self/player-core';
import type { ModelStatCount, PlayerModelSnapshot, SpotStatCount } from '@gto-self/player-core';
import type {
  GetPlayerModelAction,
  GetPlayerModelResult,
  PlayerModelView,
} from '../../server/analysis-contract.js';
import { PlayerModelPanel } from './PlayerModelPanel.js';

/**
 * The Player Model panel (prompt §28).
 *
 * The properties asserted here are the ones the brief calls out by name: the denominator is
 * always on screen, an `UNKNOWN` sample is never dressed up as a percentage, and the
 * `position: null` headline is never merged with the positional rows.
 */

const stat = (over: Partial<ModelStatCount> & Pick<ModelStatCount, 'key'>): ModelStatCount => ({
  position: null,
  opportunities: 40,
  actions: 10,
  confidence: snapshotConfidence(over.opportunities ?? 40),
  ...over,
});

const spot = (over: Partial<SpotStatCount> = {}): SpotStatCount => {
  const opportunities = over.opportunities ?? 42;
  return {
    spotKey: 'BB_VS_BTN_OPEN',
    spot: {
      phase: 'PREFLOP',
      family: 'VS_OPEN',
      position: 'BB',
      opponentPosition: 'BTN',
      lineup: 'HEADS_UP',
    },
    opportunities,
    effects: { FOLD: 27, CHECK: 0, CALL: 11, BET: 0, RAISE: 4 },
    verbs: { FOLD: 27, CHECK: 0, CALL: 11, BET: 0, RAISE: 4, ALL_IN: 0 },
    confidence: snapshotConfidence(opportunities),
    ...over,
  };
};

function snapshot(over: Partial<PlayerModelSnapshot> = {}): PlayerModelSnapshot {
  return {
    playerId: asId<'Player'>('p1'),
    modelVersion: 3,
    createdAt: timestamp(1_700_000_000_000),
    analysisAlgorithmVersion: 1,
    inputHash: 'abcdef0123456789',
    sourceHandCount: 412,
    sourceObservationCount: 1280,
    sourceShowCount: 14,
    globalStats: [
      stat({ key: 'VPIP', position: null, opportunities: 412, actions: 103 }),
      stat({ key: 'VPIP', position: 'BTN', opportunities: 70, actions: 35 }),
      // Below the LEARNING threshold: counts yes, percentage no.
      stat({ key: 'FOUR_BET', position: null, opportunities: 3, actions: 1 }),
    ],
    spotStats: [
      spot(),
      spot({
        spotKey: 'FLOP_FACING_CBET_BB_OOP_HEADS_UP_SINGLE_RAISED',
        opportunities: 11,
        effects: { FOLD: 8, CHECK: 0, CALL: 2, BET: 0, RAISE: 1 },
        verbs: { FOLD: 8, CHECK: 0, CALL: 2, BET: 0, RAISE: 1, ALL_IN: 0 },
        confidence: snapshotConfidence(11),
      }),
    ],
    showEvidence: [],
    betSizes: [],
    confidence: {
      k: 30,
      learningThreshold: 5,
      knownThreshold: 30,
      overall: snapshotConfidence(412),
    },
    ...over,
  };
}

function view(over: Partial<PlayerModelView> = {}): PlayerModelView {
  return {
    playerId: 'p1',
    nickname: '모카',
    snapshot: snapshot(),
    versions: [
      {
        snapshotId: asId<'ModelSnapshot'>('snap-1'),
        playerId: asId<'Player'>('p1'),
        modelVersion: 1,
        createdAt: timestamp(1_600_000_000_000),
        sourceHandCount: 120,
        analysisRunId: asId<'AnalysisRun'>('run-1'),
      },
      {
        snapshotId: asId<'ModelSnapshot'>('snap-3'),
        playerId: asId<'Player'>('p1'),
        modelVersion: 3,
        createdAt: timestamp(1_700_000_000_000),
        sourceHandCount: 412,
        analysisRunId: asId<'AnalysisRun'>('run-3'),
      },
    ],
    ...over,
  };
}

const loader = (result: GetPlayerModelResult): GetPlayerModelAction => vi.fn(async () => result);

async function renderPanel(result: GetPlayerModelResult): Promise<void> {
  render(<PlayerModelPanel playerId="p1" nickname="모카" getPlayerModel={loader(result)} />);
  await waitFor(() => expect(screen.queryByTestId('model-loading')).toBeNull());
}

describe('PlayerModelPanel', () => {
  it('shows the headline the brief asks for: hands, version, last analysed, SHOW', async () => {
    await renderPanel({ ok: true, value: view() });

    expect(screen.getByTestId('model-hand-count')).toHaveTextContent('412');
    expect(screen.getByTestId('model-version')).toHaveTextContent('v3');
    expect(screen.getByTestId('model-analyzed-at')).toHaveTextContent('2023-11-14');
    expect(screen.getByTestId('model-observation-count')).toHaveTextContent('1280');
    expect(screen.getByTestId('model-show-count')).toHaveTextContent('14');
  });

  it('renders every global stat with its denominator beside the rate', async () => {
    await renderPanel({ ok: true, value: view() });

    const vpip = screen.getByTestId('model-stat-VPIP');
    expect(vpip).toHaveTextContent('기회 412');
    expect(vpip).toHaveTextContent('103/412');
    expect(screen.getByTestId('model-rate-VPIP')).toHaveTextContent('25%');
  });

  it('shows counts but NO percentage for an UNKNOWN sample', async () => {
    await renderPanel({ ok: true, value: view() });

    const fourBet = screen.getByTestId('model-stat-FOUR_BET');
    expect(fourBet).toHaveTextContent('기회 3');
    expect(fourBet).toHaveTextContent('1/3');
    expect(screen.getByTestId('model-rate-FOUR_BET')).toHaveTextContent('—');
    expect(fourBet).toHaveTextContent('신뢰도 미확인');
    expect(within(fourBet).getByTitle('UNKNOWN')).toBeInTheDocument();
  });

  it('keeps the positional row out of the headline list entirely', async () => {
    await renderPanel({ ok: true, value: view() });

    const overall = screen.getByTestId('model-overall-stats');
    // The BTN row exists...
    expect(screen.getByTestId('model-stat-VPIP-BTN')).toHaveTextContent('기회 70');
    // ...and is NOT inside the null-position list, so nothing can add 412 and 70.
    expect(within(overall).queryByTestId('model-stat-VPIP-BTN')).toBeNull();
    expect(within(overall).getAllByTestId(/^model-stat-/u)).toHaveLength(2);
    expect(screen.getByTestId('model-positional')).toHaveTextContent('합산하지 않습니다');
  });

  it('renders a situation with its opportunity count and per-action rates', async () => {
    await renderPanel({ ok: true, value: view() });

    const bucket = screen.getByTestId('model-spot-BB_VS_BTN_OPEN');
    expect(bucket).toHaveTextContent('기회 42');
    expect(bucket).toHaveTextContent('FOLD 27/42 64%');
    expect(bucket).toHaveTextContent('CALL 11/42 26%');
    expect(bucket).toHaveTextContent('RAISE 4/42 10%');
    expect(bucket).toHaveTextContent('신뢰도 파악됨');
    // An effect that never happened is not rendered as a 0% row.
    expect(bucket).not.toHaveTextContent('CHECK');
  });

  it('labels a mid-sized sample 학습중 and still shows it', async () => {
    await renderPanel({ ok: true, value: view() });
    const learning = screen.getByTestId(
      'model-spot-FLOP_FACING_CBET_BB_OOP_HEADS_UP_SINGLE_RAISED',
    );
    expect(learning).toHaveTextContent('기회 11');
    expect(learning).toHaveTextContent('신뢰도 학습중');
    expect(within(learning).getByTitle('LEARNING')).toBeInTheDocument();
  });

  it('lists the version history with each version’s hand count', async () => {
    await renderPanel({ ok: true, value: view() });
    expect(screen.getByTestId('model-version-1')).toHaveTextContent('v1 · 120핸드');
    expect(screen.getByTestId('model-version-3')).toHaveTextContent('v3 · 412핸드');
  });

  it('treats a player with no snapshot as a state, not an error', async () => {
    await renderPanel({ ok: true, value: view({ snapshot: null, versions: [] }) });
    expect(screen.getByTestId('model-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('model-error')).toBeNull();
  });

  it('shows the refusing layer’s own code and message verbatim', async () => {
    await renderPanel({ ok: false, code: 'NOT_FOUND', message: 'no such player' });
    const error = screen.getByTestId('model-error');
    expect(error).toHaveTextContent('NOT_FOUND');
    expect(error).toHaveTextContent('no such player');
  });
});
