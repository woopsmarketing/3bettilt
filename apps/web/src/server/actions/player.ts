'use server';

/**
 * The table's player-profile server actions: one read, two writes.
 *
 * A server action is a public endpoint, so its input is untrusted: `playerId` is looked
 * up (a row that is not there is a plain "no such player", never a fabricated profile),
 * and the write actions re-validate their input through `player-core`'s validating
 * constructors rather than trusting anything the client computed.
 *
 * Deliberately NOT on a hot path. Opening the profile panel is a click, and editing a
 * HUD reading or a note is rarer still; a hand transition never awaits anything
 * (`prompt` D1/D3).
 */
import { cryptoIdFactory } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import { addPlayerNote, loadPlayerProfile, saveHudSnapshot } from '../players.js';
import { database } from '../db.js';
import type {
  AddPlayerNoteInput,
  AddPlayerNoteResult,
  PlayerProfileResult,
  SaveHudSnapshotInput,
  SaveHudSnapshotResult,
} from '../../lib/table/contract.js';

export async function loadPlayerProfileAction(playerId: string): Promise<PlayerProfileResult> {
  return loadPlayerProfile(playerId);
}

export async function saveHudSnapshotAction(
  input: SaveHudSnapshotInput,
): Promise<SaveHudSnapshotResult> {
  return saveHudSnapshot(database(), input, {
    ids: cryptoIdFactory,
    now: timestamp(Date.now()),
  });
}

export async function addPlayerNoteAction(input: AddPlayerNoteInput): Promise<AddPlayerNoteResult> {
  return addPlayerNote(database(), input, {
    ids: cryptoIdFactory,
    now: timestamp(Date.now()),
  });
}
