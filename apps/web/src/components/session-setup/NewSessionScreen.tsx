'use client';

/**
 * Route glue for `/session/new`: turns a successful Start Session into a navigation.
 *
 * Separate from `SessionSetupForm` so the form itself has no router dependency and can be
 * rendered in a test with plain function props.
 */
import { useRouter } from 'next/navigation.js';
import type { SearchPlayersAction, StartSessionAction } from '../../lib/session-setup/contract.js';
import { SessionSetupForm } from './SessionSetupForm.js';

export interface NewSessionScreenProps {
  readonly startSession: StartSessionAction;
  readonly searchPlayers: SearchPlayersAction;
}

export function NewSessionScreen({ startSession, searchPlayers }: NewSessionScreenProps) {
  const router = useRouter();
  return (
    <SessionSetupForm
      startSession={startSession}
      searchPlayers={searchPlayers}
      onStarted={(sessionId) => router.push(`/table/${encodeURIComponent(sessionId)}`)}
    />
  );
}
