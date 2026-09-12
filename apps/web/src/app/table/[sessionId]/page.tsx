/**
 * `/table/[sessionId]` — the practice table.
 *
 * The server shell: load the session, 404 when it is not there, and hand the whole
 * `TableState` to the client component.
 *
 * The load happens ONCE, here, on the server. Everything after it is a synchronous
 * `poker-core` call inside the client component.
 *
 * Every server action is passed DOWN as a prop rather than imported by the client component: a
 * `'use server'` module reaches `@gto-self/db` and a native SQLite binding, which must never be
 * reachable from a client bundle. They are the table's only async calls, and none is on a hand
 * path — the per-seat top-up preference, the ACTIVE/SITTING_OUT toggle, a stack correction and a
 * player replacement are all applied to the store synchronously and persisted afterwards,
 * unawaited (ADR-0043, ADR-0075). `persistCompletedHandAction` is the same shape: it fires once
 * a hand has already reached `COMPLETE` in the browser, and nothing waits on it (ADR-0059c).
 *
 * `seatStackUnverified` travels with the seats for the same reason the stacks do: the 확인 필요
 * mark is persisted state (ADR-0078b), so the table is seeded with it here and a reload never
 * renders an unconfirmed number as a confirmed one.
 */
import { notFound } from 'next/navigation.js';
import { TableRoot } from '../../../components/table/TableRoot.js';
import {
  addPlayerNoteAction,
  loadPlayerProfileAction,
  saveHudSnapshotAction,
} from '../../../server/actions/player.js';
import {
  getPlayerModelAction,
  runSessionAnalysisAction,
} from '../../../server/actions/analysis.js';
import { loadAdaptiveInputsAction } from '../../../server/actions/adaptive.js';
import { saveExternalHudSnapshotAction } from '../../../server/actions/external-hud.js';
import {
  replaceSeatPlayerAction,
  syncSessionSeatsAction,
} from '../../../server/actions/seat-state.js';
import { persistCompletedHandAction } from '../../../server/actions/hand-history.js';
import { logSkippedHandAction } from '../../../server/actions/skip-hand.js';
import {
  searchPlayersAction,
  updateSeatAutoTopUpAction,
  updateSeatOccupancyAction,
} from '../../../server/actions/session.js';
import { loadSessionView } from '../../../server/sessions.js';

export default async function TablePage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  const view = loadSessionView(sessionId);
  if (view === null) notFound();

  return (
    <TableRoot
      sessionId={view.record.id}
      label={view.record.label}
      table={view.record.table}
      autoTopUp={view.record.autoTopUp}
      seatAutoTopUp={view.seatAutoTopUp}
      seatStackUnverified={view.seatStackUnverified}
      nicknames={view.nicknames}
      warnings={view.warnings}
      loadPlayerProfile={loadPlayerProfileAction}
      saveHudSnapshot={saveHudSnapshotAction}
      addPlayerNote={addPlayerNoteAction}
      loadAdaptiveInputs={loadAdaptiveInputsAction}
      updateSeatAutoTopUp={updateSeatAutoTopUpAction}
      updateSeatOccupancy={updateSeatOccupancyAction}
      syncSessionSeats={syncSessionSeatsAction}
      replaceSeatPlayer={replaceSeatPlayerAction}
      searchPlayers={searchPlayersAction}
      saveExternalHudSnapshot={saveExternalHudSnapshotAction}
      persistCompletedHand={persistCompletedHandAction}
      logSkippedHand={logSkippedHandAction}
      storedHandCount={view.storedHandCount}
      runSessionAnalysis={runSessionAnalysisAction}
      getPlayerModel={getPlayerModelAction}
    />
  );
}
