/**
 * Server-side player reads for the table's profile panel. Server-only, like everything
 * under `src/server/`.
 *
 * A missing HUD snapshot or an unreadable note is NOT a failed profile: the panel must
 * render a player who has no data yet, cleanly. Only the player row itself is fatal.
 */
import { asId } from '@gto-self/shared';
import { findPlayerById, latestHudSnapshotForPlayer, listCurrentNotes } from '@gto-self/db';
import type { PlayerId } from '@gto-self/shared';
import type { PlayerProfileResult } from '../lib/table/contract.js';
import { database } from './db.js';

export function loadPlayerProfile(playerIdText: string): PlayerProfileResult {
  const db = database();
  const playerId: PlayerId = asId<'Player'>(playerIdText);

  const player = findPlayerById(db, playerId);
  if (!player.ok) return { ok: false, message: player.error.message };
  if (player.value === null) return { ok: false, message: 'That player no longer exists.' };

  const warnings: string[] = [];

  const snapshot = latestHudSnapshotForPlayer(db, playerId);
  if (!snapshot.ok) warnings.push(`HUD could not be read: ${snapshot.error.message}`);

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
