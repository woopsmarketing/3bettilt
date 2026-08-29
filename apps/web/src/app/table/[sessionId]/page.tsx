/**
 * `/table/[sessionId]` — the practice table.
 *
 * The server shell: load the session, 404 when it is not there, and hand the whole
 * `TableState` to the client component.
 *
 * The load happens ONCE, here, on the server. Everything after it is a synchronous
 * `poker-core` call inside the client component.
 *
 * `loadPlayerProfileAction` is passed DOWN as a prop rather than imported by the client
 * component: a `'use server'` module reaches `@gto-self/db` and a native SQLite binding,
 * which must never be reachable from a client bundle. It is the table's only async call
 * and is not on a hand path.
 */
import { notFound } from 'next/navigation.js';
import { TableRoot } from '../../../components/table/TableRoot.js';
import { loadPlayerProfileAction } from '../../../server/actions/player.js';
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
      nicknames={view.nicknames}
      warnings={view.warnings}
      loadPlayerProfile={loadPlayerProfileAction}
    />
  );
}
