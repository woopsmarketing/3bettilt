/**
 * Server-side player reads for the table's profile panel. Server-only, like everything
 * under `src/server/`.
 *
 * A missing HUD snapshot or an unreadable note is NOT a failed profile: the panel must
 * render a player who has no data yet, cleanly. Only the player row itself is fatal.
 */
import { asId, type IdFactory } from '@gto-self/shared';
import {
  findPlayerById,
  insertHudSnapshot,
  insertNote,
  latestExternalProfileForPlayer,
  latestHudSnapshotForPlayer,
  listCurrentNotes,
} from '@gto-self/db';
import type { GtoDatabase } from '@gto-self/db';
import type { PlayerId } from '@gto-self/shared';
import { createHudSnapshot, createNote, type HudStatKey, type Timestamp } from '@gto-self/player-core';
import type {
  AddPlayerNoteInput,
  AddPlayerNoteResult,
  PlayerProfileResult,
  SaveHudSnapshotInput,
  SaveHudSnapshotResult,
} from '../lib/table/contract.js';
import { database } from './db.js';

/**
 * Internal. Assembles the view for one player, given an explicit `db` — the shared
 * building block for the read action and both write actions below, so "what a profile
 * looks like" is defined in exactly one place.
 */
function buildProfileView(db: GtoDatabase, playerId: PlayerId): PlayerProfileResult {
  const player = findPlayerById(db, playerId);
  if (!player.ok) return { ok: false, message: player.error.message };
  if (player.value === null) return { ok: false, message: 'That player no longer exists.' };

  const warnings: string[] = [];

  const snapshot = latestHudSnapshotForPlayer(db, playerId);
  if (!snapshot.ok) warnings.push(`HUD could not be read: ${snapshot.error.message}`);

  const external = latestExternalProfileForPlayer(db, playerId);
  if (!external.ok) warnings.push(`external HUD could not be read: ${external.error.message}`);

  const notes = listCurrentNotes(db, playerId);
  if (!notes.ok) warnings.push(`notes could not be read: ${notes.error.message}`);

  return {
    ok: true,
    profile: {
      playerId: player.value.id,
      nickname: player.value.nickname,
      displayAlias: player.value.displayAlias,
      archived: player.value.archived,
      hud:
        snapshot.ok && snapshot.value !== null
          ? {
              recordedAt: snapshot.value.recordedAt,
              handSample: snapshot.value.handSample,
              // `enteredText`, not the parsed value: the panel shows what the user typed.
              stats: snapshot.value.stats.map((stat) => ({
                key: stat.key,
                enteredText: stat.enteredText,
              })),
            }
          : null,
      externalHud:
        external.ok && external.value !== null
          ? {
              recordedAt: external.value.recordedAt,
              sampleN: null,
              stats: external.value.stats.map((stat) => ({
                key: stat.key,
                enteredText: stat.enteredText,
              })),
            }
          : null,
      notes: notes.ok
        ? notes.value.map((note) => ({
            id: note.id,
            body: note.body,
            createdAt: note.createdAt,
          }))
        : [],
      warnings,
    },
  };
}

export function loadPlayerProfile(playerIdText: string): PlayerProfileResult {
  return buildProfileView(database(), asId<'Player'>(playerIdText));
}

export interface PlayerWriteDeps {
  /** Injected by the caller (ADR-0007) — this module never mints an id or reads the clock. */
  readonly ids: IdFactory;
  readonly now: Timestamp;
}

/**
 * Validates and appends one manual HUD snapshot, then returns the refreshed profile view.
 *
 * Validation runs through `createHudSnapshot` — the one validating constructor
 * (`@gto-self/player-core`) — so a bad reading never reaches the database and the
 * caller sees `{ ok: false, message }` instead of a thrown error.
 */
export function saveHudSnapshot(
  db: GtoDatabase,
  input: SaveHudSnapshotInput,
  deps: PlayerWriteDeps,
): SaveHudSnapshotResult {
  const playerId = asId<'Player'>(input.playerId);
  const player = findPlayerById(db, playerId);
  if (!player.ok) return { ok: false, message: player.error.message };
  if (player.value === null) return { ok: false, message: 'That player no longer exists.' };

  const built = createHudSnapshot({
    id: asId<'Snapshot'>(deps.ids.next()),
    playerId,
    recordedAt: deps.now,
    handSample: input.handSample,
    stats: input.stats.map((stat) => ({
      key: stat.key as HudStatKey,
      enteredText: stat.enteredText,
    })),
  });
  if (!built.ok) return { ok: false, message: built.error.message };

  const written = insertHudSnapshot(db, built.value);
  if (!written.ok) return { ok: false, message: written.error.message };

  return buildProfileView(db, playerId);
}

/**
 * Validates and appends a NEW note (never a mutation of an existing one — `createNote`,
 * not `reviseNote`), then returns the refreshed profile view.
 */
export function addPlayerNote(
  db: GtoDatabase,
  input: AddPlayerNoteInput,
  deps: PlayerWriteDeps,
): AddPlayerNoteResult {
  const playerId = asId<'Player'>(input.playerId);
  const player = findPlayerById(db, playerId);
  if (!player.ok) return { ok: false, message: player.error.message };
  if (player.value === null) return { ok: false, message: 'That player no longer exists.' };

  const built = createNote({
    id: asId<'Note'>(deps.ids.next()),
    playerId,
    body: input.body,
    createdAt: deps.now,
  });
  if (!built.ok) return { ok: false, message: built.error.message };

  const written = insertNote(db, built.value);
  if (!written.ok) return { ok: false, message: written.error.message };

  return buildProfileView(db, playerId);
}
