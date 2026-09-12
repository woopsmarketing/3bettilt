'use server';

/**
 * The table's between-hands seat-state server actions (WP-2 / WP-5).
 *
 * A server action is a public endpoint, so both inputs are untrusted and are re-validated from
 * scratch by `seat-state-service.ts` — the parameters are typed for the CALLER's convenience
 * only, and nothing here trusts a money value, a seat index or a player id because it arrived
 * in the right-looking shape.
 *
 * Deliberately NOT on a hand path. The store applies a stack correction, a seat change and a
 * player replacement synchronously in the browser; these calls are the persistence that follows
 * and nothing about a hand transition awaits them (ADR-0043, ADR-0075's "unawaited, a failure
 * never reverts what is on screen and is never hidden").
 */
import { cryptoIdFactory } from '@gto-self/shared';
import type {
  ReplaceSeatPlayerResult,
  ReplaceSeatPlayerValue,
  SyncSessionSeatsResult,
  SyncSessionSeatsValue,
} from '../../lib/table/contract.js';
import { database } from '../db.js';
import { nowTimestamp } from '../session-service.js';
import { replaceSeatPlayer, syncSessionSeats } from '../seat-state-service.js';

/** Persist the current seat state and the button. Best-effort: never blocks or reverts play. */
export async function syncSessionSeatsAction(
  input: SyncSessionSeatsValue,
): Promise<SyncSessionSeatsResult> {
  return syncSessionSeats(database(), input, { ids: cryptoIdFactory, now: nowTimestamp() });
}

/** Put a different player in one seat, optionally with the HUD numbers just typed for them. */
export async function replaceSeatPlayerAction(
  input: ReplaceSeatPlayerValue,
): Promise<ReplaceSeatPlayerResult> {
  return replaceSeatPlayer(database(), input, { ids: cryptoIdFactory, now: nowTimestamp() });
}
