/**
 * `/table/[sessionId]` — the practice table.
 *
 * The server shell: load the session, 404 when it is not there, and hand the whole
 * `TableState` to the client component.
 *
 * The load happens ONCE, here, on the server. Everything after it is a synchronous
 * `poker-core` call inside the client component.
 *
 * `loadPlayerProfileAction`, `updateSeatAutoTopUpAction` and `updateSeatOccupancyAction` are
 * passed DOWN as props rather than imported by the client component: a `'use server'` module
 * reaches `@gto-self/db` and a native SQLite binding, which must never be reachable from a
 * client bundle. They are the table's only async calls, and none is on a hand path — the
 * per-seat top-up preference and the ACTIVE/SITTING_OUT toggle are both applied to the store
 * synchronously and persisted afterwards, unawaited. `persistCompletedHandAction` is the
 * same shape: it fires once a hand has already reached `COMPLETE` in the browser, and nothing
 * waits on it (ADR-0059c).
 */
import { notFound } from 'next/navigation.js';
import { TableRoot } from '../../../components/table/TableRoot.js';
import { loadPlayerProfileAction } from '../../../server/actions/player.js';
import {
  getPlayerModelAction,
  runSessionAnalysisAction,
} from '../../../server/actions/analysis.js';
import { persistCompletedHandAction } from '../../../server/actions/hand-history.js';
import {
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
      nicknames={view.nicknames}
      warnings={view.warnings}
      loadPlayerProfile={loadPlayerProfileAction}
      updateSeatAutoTopUp={updateSeatAutoTopUpAction}
      updateSeatOccupancy={updateSeatOccupancyAction}
      persistCompletedHand={persistCompletedHandAction}
      storedHandCount={view.storedHandCount}
      runSessionAnalysis={runSessionAnalysisAction}
      getPlayerModel={getPlayerModelAction}
    />
  );
}
