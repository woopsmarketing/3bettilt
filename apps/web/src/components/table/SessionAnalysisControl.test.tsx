import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AnalysisPlayerSummary,
  AnalysisSummary,
  AnalysisSummaryStatus,
  GetPlayerModelAction,
  RunSessionAnalysisAction,
  RunSessionAnalysisResult,
} from '../../server/analysis-contract.js';
import { SessionAnalysisControl } from './SessionAnalysisControl.js';

/**
 * The button, its boundary and the summary it opens (prompt §26-§27).
 *
 * `sessionAnalysisGate` has its own tests; what is asserted here is that the BUTTON obeys it,
 * that a second click cannot start a second run, and that every summary shape renders the
 * numbers the server actually sent — a `null` as a dash, never as a zero or a total.
 */

const player = (over: Partial<AnalysisPlayerSummary> = {}): AnalysisPlayerSummary => ({
  playerId: 'p1',
  nickname: '모카',
  outcome: 'SNAPSHOT_CREATED',
  modelVersion: 6,
  totalHands: 412,
  addedSinceLastSnapshot: 127,
  spotGroupCount: 23,
  showCount: 14,
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
  finishedAt: 12,
  durationMs: 12,
  sessionHandCount: 127,
  playerCount: players.length,
  observationCount: 900,
  showCount: 14,
  players,
});

const noModel: GetPlayerModelAction = async () => ({
  ok: false,
  code: 'NOT_CALLED',
  message: 'not called in this test',
});

interface Options {
  readonly handPhase?:
    'SETUP' | 'AWAITING_ACTION' | 'AWAITING_BOARD' | 'AWAITING_AWARD' | 'COMPLETE' | null;
  readonly savesInFlight?: number;
  readonly unsavedHandCount?: number;
  readonly run?: RunSessionAnalysisAction;
  readonly getPlayerModel?: GetPlayerModelAction;
}

function renderControl(options: Options = {}) {
  const run =
    options.run ??
    (vi.fn(async () => ({
      ok: true,
      summary: summary('SUCCESS', [player()]),
    })) as unknown as RunSessionAnalysisAction);
  render(
    <SessionAnalysisControl
      sessionId="s1"
      handPhase={options.handPhase === undefined ? null : options.handPhase}
      savesInFlight={options.savesInFlight ?? 0}
      unsavedHandCount={options.unsavedHandCount}
      runSessionAnalysis={run}
      getPlayerModel={options.getPlayerModel ?? noModel}
    />,
  );
  return run;
}

const button = () => screen.getByTestId('run-analysis');

const runReturning = (result: RunSessionAnalysisResult): RunSessionAnalysisAction =>
  vi.fn(async () => result);

describe('SessionAnalysisControl — the safe boundary', () => {
  it('is enabled between hands and carries the prompt’s own label', () => {
    renderControl({ handPhase: null });
    expect(button()).toBeEnabled();
    expect(button()).toHaveTextContent('세션 분석 및 반영');
    expect(screen.queryByTestId('analysis-gate-reason')).toBeNull();
  });

  it('is enabled once the hand is COMPLETE', () => {
    renderControl({ handPhase: 'COMPLETE' });
    expect(button()).toBeEnabled();
  });

  it('is disabled mid-hand, and says why in words as well as in the tooltip', () => {
    renderControl({ handPhase: 'AWAITING_ACTION' });
    expect(button()).toBeDisabled();
    expect(button()).toHaveAttribute('title', '진행 중인 핸드가 끝나면 분석할 수 있습니다.');
    expect(screen.getByTestId('analysis-gate-reason')).toHaveTextContent('진행 중인 핸드가 끝나면');
  });

  it('is disabled while a completed hand is still being stored', () => {
    renderControl({ handPhase: 'COMPLETE', savesInFlight: 1 });
    expect(button()).toBeDisabled();
    expect(screen.getByTestId('analysis-gate-reason')).toHaveTextContent('핸드 저장이 끝나면');
  });

  it('does not fire a run at all while it is disabled', () => {
    const run = renderControl({ handPhase: 'AWAITING_BOARD' });
    fireEvent.click(button());
    expect(run).not.toHaveBeenCalled();
  });
});

describe('SessionAnalysisControl — the in-flight guard', () => {
  it('disables the button while a run is in flight and sends exactly one request', async () => {
    let release: (value: RunSessionAnalysisResult) => void = () => {};
    const pending = new Promise<RunSessionAnalysisResult>((resolve) => {
      release = resolve;
    });
    const run = vi.fn(() => pending) as unknown as RunSessionAnalysisAction;
    renderControl({ run });

    fireEvent.click(button());
    fireEvent.click(button());
    fireEvent.click(button());

    expect(run).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button()).toBeDisabled());
    expect(screen.getByTestId('analysis-running')).toBeInTheDocument();

    release({ ok: true, summary: summary('SUCCESS', [player()]) });
    await waitFor(() => expect(screen.getByTestId('analysis-totals')).toBeInTheDocument());
    expect(button()).toBeEnabled();
  });
});

describe('SessionAnalysisControl — the summary (prompt §27)', () => {
  it('shows the run totals and one row per player', async () => {
    renderControl({
      run: runReturning({
        ok: true,
        summary: summary('SUCCESS', [player(), player({ playerId: 'p2', nickname: '감자' })]),
      }),
    });
    fireEvent.click(button());

    await waitFor(() => expect(screen.getByTestId('analysis-totals')).toBeInTheDocument());
    expect(screen.getByTestId('analysis-total-hands')).toHaveTextContent('127');
    expect(screen.getByTestId('analysis-total-players')).toHaveTextContent('2');
    expect(screen.getByTestId('analysis-total-show')).toHaveTextContent('14');

    const row = screen.getByTestId('analysis-player-p1');
    expect(row).toHaveTextContent('모카');
    expect(screen.getByTestId('analysis-total-p1')).toHaveTextContent('412 hands');
    expect(screen.getByTestId('analysis-added-p1')).toHaveTextContent('127 hands');
    expect(screen.getByTestId('analysis-spots-p1')).toHaveTextContent('23 groups');
    expect(screen.getByTestId('analysis-model-p1')).toHaveTextContent('v6');
    expect(screen.getByTestId('analysis-outcome-p1')).toHaveTextContent('반영 완료');
  });

  it('states, in words, that 기본전략 is not yet affected', async () => {
    renderControl({ run: runReturning({ ok: true, summary: summary('SUCCESS', [player()]) }) });
    fireEvent.click(button());

    await waitFor(() =>
      expect(screen.getByTestId('analysis-disclaimer')).toHaveTextContent(
        '플레이어 모델이 업데이트되었습니다. 현재 기본전략 추천에는 아직 반영되지 않습니다.',
      ),
    );
  });

  it('renders a first snapshot’s missing increment as a dash, never as the total', async () => {
    renderControl({
      run: runReturning({
        ok: true,
        summary: summary('SUCCESS', [player({ addedSinceLastSnapshot: null, modelVersion: 1 })]),
      }),
    });
    fireEvent.click(button());

    await waitFor(() => expect(screen.getByTestId('analysis-added-p1')).toHaveTextContent('—'));
    expect(screen.getByTestId('analysis-added-p1')).not.toHaveTextContent('412');
  });

  it('renders a 변경 없음 row without claiming counts this run did not measure', async () => {
    renderControl({
      run: runReturning({
        ok: true,
        summary: summary('SUCCESS', [
          player({
            outcome: 'NO_CHANGES',
            addedSinceLastSnapshot: 0,
            spotGroupCount: null,
            showCount: null,
          }),
        ]),
      }),
    });
    fireEvent.click(button());

    await waitFor(() =>
      expect(screen.getByTestId('analysis-outcome-p1')).toHaveTextContent('변경 없음'),
    );
    expect(screen.getByTestId('analysis-spots-p1')).toHaveTextContent('—');
    expect(screen.getByTestId('analysis-show-p1')).toHaveTextContent('—');
    // The version it keeps showing is the one it already had.
    expect(screen.getByTestId('analysis-model-p1')).toHaveTextContent('v6');
    expect(screen.getByTestId('analysis-disclaimer')).toHaveTextContent('그대로 유지되었습니다');
  });

  it('shows a failed player’s own code and message on a PARTIAL run', async () => {
    renderControl({
      run: runReturning({
        ok: true,
        summary: summary('PARTIAL', [
          player(),
          player({
            playerId: 'p2',
            nickname: '참외',
            outcome: 'FAILED',
            modelVersion: null,
            totalHands: null,
            addedSinceLastSnapshot: null,
            spotGroupCount: null,
            showCount: null,
            errorCode: 'CORRUPT_ROW',
            errorMessage: 'hand_events.payload is not decodable',
          }),
        ]),
      }),
    });
    fireEvent.click(button());

    await waitFor(() => expect(screen.getByTestId('analysis-error-p2')).toBeInTheDocument());
    expect(screen.getByTestId('analysis-error-p2')).toHaveTextContent('CORRUPT_ROW');
    expect(screen.getByTestId('analysis-error-p2')).toHaveTextContent(
      'hand_events.payload is not decodable',
    );
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('일부 실패');
    // The healthy player is still reported as done.
    expect(screen.getByTestId('analysis-outcome-p1')).toHaveTextContent('반영 완료');
  });

  it('presents NO_ELIGIBLE_HANDS as information, with no player list and no alert', async () => {
    renderControl({
      run: runReturning({
        ok: true,
        summary: { ...summary('NO_ELIGIBLE_HANDS', []), sessionHandCount: 0 },
      }),
    });
    fireEvent.click(button());

    await waitFor(() => expect(screen.getByTestId('analysis-no-hands')).toBeInTheDocument());
    expect(screen.queryByTestId('analysis-players')).toBeNull();
    expect(screen.queryByTestId('analysis-failure')).toBeNull();
    expect(screen.getByTestId('analysis-total-hands')).toHaveTextContent('0');
  });

  it('shows the service’s own refusal verbatim when the whole run fails', async () => {
    renderControl({
      run: runReturning({ ok: false, code: 'NOT_FOUND', message: 'no such session' }),
    });
    fireEvent.click(button());

    await waitFor(() => expect(screen.getByTestId('analysis-failure')).toBeInTheDocument());
    expect(screen.getByTestId('analysis-failure')).toHaveTextContent('NOT_FOUND');
    expect(screen.getByTestId('analysis-failure')).toHaveTextContent('no such session');
    expect(screen.queryByTestId('analysis-totals')).toBeNull();
  });

  it('warns that unstored hands were left out of the run', async () => {
    renderControl({
      unsavedHandCount: 2,
      run: runReturning({ ok: true, summary: summary('SUCCESS', [player()]) }),
    });
    fireEvent.click(button());

    await waitFor(() =>
      expect(screen.getByTestId('analysis-unsaved-warning')).toHaveTextContent(
        '저장되지 않은 핸드가 2개',
      ),
    );
  });

  it('opens the player model panel from a summary row', async () => {
    const getPlayerModel = vi.fn(async () => ({
      ok: true as const,
      value: { playerId: 'p1', nickname: '모카', snapshot: null, versions: [] },
    })) as unknown as GetPlayerModelAction;
    renderControl({
      getPlayerModel,
      run: runReturning({ ok: true, summary: summary('SUCCESS', [player()]) }),
    });
    fireEvent.click(button());
    await waitFor(() => expect(screen.getByTestId('analysis-open-profile-p1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('analysis-open-profile-p1'));
    await waitFor(() => expect(screen.getByTestId('player-model')).toBeInTheDocument());
    expect(getPlayerModel).toHaveBeenCalledWith({ playerId: 'p1' });
  });

  it('closes on Esc and can be reopened without re-running the analysis', async () => {
    const run = runReturning({ ok: true, summary: summary('SUCCESS', [player()]) });
    renderControl({ run });
    fireEvent.click(button());
    await waitFor(() => expect(screen.getByTestId('analysis-overlay')).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('analysis-overlay')).toBeNull());

    fireEvent.click(screen.getByTestId('reopen-analysis'));
    expect(screen.getByTestId('analysis-totals')).toBeInTheDocument();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
