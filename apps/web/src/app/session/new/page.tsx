/**
 * `/session/new` — the session-setup screen.
 *
 * A server component whose only job is to hand the client component the two server actions
 * it needs. Nothing is fetched here: the form's own state is the whole of its input.
 */
import { NewSessionScreen } from '../../../components/session-setup/NewSessionScreen.js';
import { searchPlayersAction, startSessionAction } from '../../../server/actions/session.js';

export const metadata = { title: 'New session · GTO-SELF' };

export default function NewSessionPage() {
  return <NewSessionScreen startSession={startSessionAction} searchPlayers={searchPlayersAction} />;
}
