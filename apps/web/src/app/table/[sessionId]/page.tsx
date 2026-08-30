/**
 * `/table/[sessionId]` — the practice table.
 *
 * The server shell: load the session, 404 when it is not there, and hand the whole
 * `TableState` to the client component.
 *
 * The load happens ONCE, here, on the server. Everything after it is a synchronous
 * `poker-core` call inside the client component.
 *
 * `loadPlayerProfileAction` and `updateSeatAutoTopUpAction` are passed DOWN as props rather
 * than imported by the client component: a `'use server'` module reaches `@gto-self/db` and
 * a native SQLite binding, which must never be reachable from a client bundle. They are the
 * table's only async calls, and neither is on a hand path — the per-seat top-up preference
 * is applied to the store synchronously and persisted afterwards, unawaited.
 */
import { notFound } from 'next/navigation.js';
import { TableRoot } from '../../../components/table/TableRoot.js';
import { loadPlayerProfileAction } from '../../../server/actions/player.js';
import { updateSeatAutoTopUpAction } from '../../../server/actions/session.js';
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
    />
  );
}
