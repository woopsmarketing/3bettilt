'use server';

/**
 * The session-setup server actions.
 *
 * A server action is a public endpoint, so its input is untrusted and is re-validated from
 * scratch — `startSession` re-parses every entered stack with `Money.parseBB` and never
 * accepts a money number the client computed.
 *
 * These are the ONLY async calls in the session-setup flow, and neither is on a poker hot
 * path: nothing between a keypress and a visible table update ever awaits (`prompt` D1).
 */
import { cryptoIdFactory } from '@gto-self/shared';
import type { SearchPlayersResult, StartSessionResult } from '../../lib/session-setup/contract.js';
import { database } from '../db.js';
import {
  nowTimestamp,
  searchPlayers as searchPlayersIn,
  startSession as startSessionIn,
} from '../session-service.js';

/** Validate, resolve players, build the table through the engine, and write it all once. */
export async function startSessionAction(input: unknown): Promise<StartSessionResult> {
  return startSessionIn(database(), input, { ids: cryptoIdFactory, now: nowTimestamp() });
}

/** Nickname autocomplete over the players that already exist. */
export async function searchPlayersAction(query: string): Promise<SearchPlayersResult> {
  return searchPlayersIn(database(), query);
}
