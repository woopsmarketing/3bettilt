import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import { sequentialIdFactory } from '@gto-self/shared';
import type { LoadPlayerProfileAction } from '../../lib/table/contract.js';
import type {
  GetPlayerModelAction,
  RunSessionAnalysisAction,
} from '../../server/analysis-contract.js';
import { makeTestTable, testNicknames, testPlayerId } from '../../lib/table/testTable.js';
import { TableRoot } from './TableRoot.js';

/**
 * The analysis control INSIDE the real table (prompt §26).
 *
 * `SessionAnalysisControl.test.tsx` proves the gate; this proves the table feeds it the right
 * phase, that the control is absent when the page passes no actions, and that the overlay is
 * modal for the keyboard — `S` must not sit a seat out behind a dialog the user is reading.
 */

const noProfile: LoadPlayerProfileAction = async () => ({
  ok: false,
  message: 'not called in this test',
});

const emptySummary = {
  runId: 'run-1',
  sessionId: 'session-1',
  status: 'NO_ELIGIBLE_HANDS' as const,
  algorithmVersion: 1,
  startedAt: 0,
  finishedAt: 1,
  durationMs: 1,
  sessionHandCount: 0,
  playerCount: 0,
  observationCount: 0,
  showCount: 0,
  players: [],
};

const noModel: GetPlayerModelAction = async () => ({
  ok: false,
  code: 'NOT_CALLED',
  message: 'not called in this test',
});

function renderTable(overrides: { readonly withActions?: boolean } = {}) {
  const table = makeTestTable({ seats: [0, 1, 2], heroSeat: 0, buttonSeat: 0 });
  const run = vi.fn(async () => ({
    ok: true as const,
    summary: { ...emptySummary, runId: null },
  })) as unknown as RunSessionAnalysisAction;
  render(
    <TableRoot
      sessionId="session-1"
      label="Test session"
      table={table}
      autoTopUp={null}
      seatAutoTopUp={{}}
      nicknames={testNicknames(SEAT_INDEXES)}
      warnings={[]}
      loadPlayerProfile={noProfile}
      runSessionAnalysis={overrides.withActions === false ? undefined : run}
      getPlayerModel={overrides.withActions === false ? undefined : noModel}
      ids={sequentialIdFactory('test')}
    />,
  );
  return run;
}

describe('the analysis control inside the table', () => {
  it('is not rendered at all when the page passes no analysis actions', () => {
    renderTable({ withActions: false });
    expect(screen.queryByTestId('run-analysis')).toBeNull();
  });

  it('sits beside the stored-hand count and is enabled before the first deal', () => {
    renderTable();
    expect(screen.getByTestId('run-analysis')).toBeEnabled();
    expect(screen.getByTestId('stored-hand-count')).toBeInTheDocument();
  });

  it('is disabled the moment a hand is dealt, and enabled again when it completes', async () => {
    renderTable();
    fireEvent.click(screen.getByTestId('start-hand'));
    expect(screen.getByTestId('run-analysis')).toBeDisabled();
    expect(screen.getByTestId('analysis-gate-reason')).toHaveTextContent('진행 중인 핸드');

    // Three-handed: two folds end the hand uncontested and it reaches COMPLETE.
    fireEvent.click(screen.getByTestId('dock-F'));
    fireEvent.click(screen.getByTestId('dock-F'));

    await waitFor(() => expect(screen.getByTestId('run-analysis')).toBeEnabled());
  });

  it('stands the table’s own hotkeys down while the overlay is open', async () => {
    renderTable();
    // Select a seat first: `S` sits the SELECTED seat out, so this is the state in which the
    // key would do damage if the overlay did not own the keyboard.
    fireEvent.click(screen.getByTestId('seat-1'));
    expect(screen.getByTestId('seat-1-occupancy')).toHaveAttribute('data-sitting-out', 'false');

    fireEvent.click(screen.getByTestId('run-analysis'));
    await waitFor(() => expect(screen.getByTestId('analysis-overlay')).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    expect(screen.getByTestId('seat-1-occupancy')).toHaveAttribute('data-sitting-out', 'false');

    // Esc closes the overlay, and the table's keyboard comes back with it.
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('analysis-overlay')).toBeNull());
    fireEvent.click(screen.getByTestId('seat-1'));
    fireEvent.keyDown(window, { key: 's', code: 'KeyS' });
    expect(screen.getByTestId('seat-1-occupancy')).toHaveAttribute('data-sitting-out', 'true');
  });

  it('sends the session id the page was rendered with', async () => {
    const run = renderTable();
    fireEvent.click(screen.getByTestId('run-analysis'));
    await waitFor(() => expect(run).toHaveBeenCalledWith({ sessionId: 'session-1' }));
    // The nickname map is the page's; the summary carries its own, so nothing is invented.
    expect(testPlayerId(0)).toBe('player-0');
  });
});
