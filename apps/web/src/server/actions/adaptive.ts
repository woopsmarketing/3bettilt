'use server';

/**
 * The ADAPTIVE layer's ONE read action: the opponent facts for a seat lineup.
 *
 * A server action is a public endpoint, so its input is untrusted — `loadAdaptiveOpponentInputs`
 * re-validates the lineup from scratch (seat count, seat index, no player seated twice) before
 * it touches the database, and this wrapper adds nothing but the real handle.
 *
 * It never throws to the client. Every failure, including one raised inside `@gto-self/db`, is
 * already a typed `{ ok: false, message }` by the time it reaches here, and this function adds
 * no code path that could produce anything else.
 *
 * DELIBERATELY NOT ON A HOT PATH. It runs when the seat lineup changes or when a HUD reading is
 * saved — a click, not a keypress. No hand transition awaits it (ADR-0043, `prompt` D1/D3).
 *
 * Read-only by construction: it opens no transaction, mints no id and reads no clock, because
 * every timestamp it returns is one that is already stored on the row it read.
 */
import { loadAdaptiveOpponentInputs } from '../adaptive-service.js';
import { database } from '../db.js';
import type { AdaptiveSeatInput, LoadAdaptiveInputsResult } from '../../lib/table/contract.js';

export async function loadAdaptiveInputsAction(
  seats: readonly AdaptiveSeatInput[],
): Promise<LoadAdaptiveInputsResult> {
  return loadAdaptiveOpponentInputs(database(), seats);
}
