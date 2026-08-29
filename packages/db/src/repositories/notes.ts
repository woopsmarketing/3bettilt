/**
 * `player_notes` — append-only free-text notes.
 *
 * **INSERT-ONLY BY CONSTRUCTION.** There is no update function in this module and there
 * must never be one. A revision is a NEW row carrying `root_id` and `supersedes_id`; the
 * previous body is never rewritten (`CLAUDE.md` rule 3).
 */
import { asc, eq } from 'drizzle-orm';
import { ok, type NoteId, type PlayerId } from '@gto-self/shared';
import { currentNotes, noteHistory, type PlayerNote } from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, type DbResult } from '../errors.js';
import { playerNotes } from '../schema.js';
import { collect, decodeNoteRow } from '../rows.js';

/**
 * Append a note version built by `createNote` or `reviseNote`.
 *
 * The partial UNIQUE index on `supersedes_id` rejects a second revision of the same
 * version, so a fork of the chain surfaces as a constraint violation rather than a note
 * that quietly disappears from `currentNotes`.
 */
export function insertNote(db: GtoDatabase, note: PlayerNote): DbResult<PlayerNote> {
  const written = attempt({ table: 'player_notes', id: note.id }, () =>
    db
      .insert(playerNotes)
      .values({
        id: note.id,
        playerId: note.playerId,
        body: note.body,
        createdAt: note.createdAt,
        rootId: note.rootId,
        supersedesId: note.supersedesId,
      })
      .run(),
  );
  if (!written.ok) return written;
  return ok(note);
}

/** `null` when absent. */
export function getNote(db: GtoDatabase, id: NoteId): DbResult<PlayerNote | null> {
  const rows = attempt({ table: 'player_notes', id }, () =>
    db.select().from(playerNotes).where(eq(playerNotes.id, id)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  return decodeNoteRow(row);
}

/** Internal. Every stored version for one player, oldest first. */
function allNotesForPlayer(db: GtoDatabase, playerId: PlayerId): DbResult<readonly PlayerNote[]> {
  const rows = attempt({ table: 'player_notes' }, () =>
    db
      .select()
      .from(playerNotes)
      .where(eq(playerNotes.playerId, playerId))
      .orderBy(asc(playerNotes.createdAt), asc(playerNotes.id))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeNoteRow));
}

/**
 * The CURRENT version of every note for one player, newest first — what the profile panel
 * renders. Superseded versions are omitted from this view and stay available through
 * `listNoteHistory`.
 *
 * The "which version is current" rule is `player-core`'s `currentNotes`, not a second
 * definition written in SQL.
 */
export function listCurrentNotes(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<readonly PlayerNote[]> {
  const notes = allNotesForPlayer(db, playerId);
  if (!notes.ok) return notes;
  return ok(currentNotes(notes.value, playerId));
}

/** Every version of ONE note, oldest first. The audit trail an edit must never destroy. */
export function listNoteHistory(db: GtoDatabase, rootId: NoteId): DbResult<readonly PlayerNote[]> {
  const rows = attempt({ table: 'player_notes', id: rootId }, () =>
    db
      .select()
      .from(playerNotes)
      .where(eq(playerNotes.rootId, rootId))
      .orderBy(asc(playerNotes.createdAt), asc(playerNotes.id))
      .all(),
  );
  if (!rows.ok) return rows;
  const decoded = collect(rows.value.map(decodeNoteRow));
  if (!decoded.ok) return decoded;
  if (decoded.value.length === 0) {
    return dbErr('NOT_FOUND', `no note chain with root ${rootId}`, {
      table: 'player_notes',
      id: rootId,
    });
  }
  return ok(noteHistory(decoded.value, rootId));
}
