'use server';

/**
 * The table's one server action.
 *
 * A server action is a public endpoint, so `playerId` is untrusted: it is looked up, and
 * a row that is not there is a plain "no such player", never a fabricated profile.
 *
 * Deliberately NOT on a hot path. Opening the profile panel is a click; a hand
 * transition never awaits anything (`prompt` D1/D3).
 */
import { loadPlayerProfile } from '../players.js';
import type { PlayerProfileResult } from '../../lib/table/contract.js';

export async function loadPlayerProfileAction(playerId: string): Promise<PlayerProfileResult> {
  return loadPlayerProfile(playerId);
}
