/**
 * Free-text player notes.
 *
 * Notes are APPEND-ONLY. Editing a note never rewrites its body: it appends a new
 * version that points at the one it replaces, so the earlier text is still readable
 * (`CLAUDE.md` rule 3). `rootId` groups every version of one note; `supersedesId` is the
 * immediately previous version, so the chain can be walked in either direction.
 *
 * Nothing here reads the clock or generates an id — both are injected (ADR-0007).
 */
import { ok, type NoteId, type PlayerId } from '@gto-self/shared';
import { playerErr, type PlayerResult } from './errors.js';
import { validateTimestamp, type Timestamp } from './time.js';

/** Longest accepted note body, in code points. */
export const MAX_NOTE_LENGTH = 4000;

export interface PlayerNote {
  readonly id: NoteId;
  readonly playerId: PlayerId;
  /** The text as entered, minus surrounding whitespace. */
  readonly body: string;
  readonly createdAt: Timestamp;
  /** The FIRST version's id. Equal to `id` on an original note. */
  readonly rootId: NoteId;
  /** The version this one replaces, or `null` on an original note. */
  readonly supersedesId: NoteId | null;
}

function validateBody(raw: string): PlayerResult<string> {
  const body = raw.trim();
  if (body === '') {
    return playerErr('INVALID_NOTE_BODY', 'a note body must not be empty', { field: 'body' });
  }
  const length = [...body].length;
  if (length > MAX_NOTE_LENGTH) {
    return playerErr(
      'INVALID_NOTE_BODY',
      `a note body must be at most ${MAX_NOTE_LENGTH} characters`,
      {
        field: 'body',
        actual: length,
        max: MAX_NOTE_LENGTH,
      },
    );
  }
  return ok(body);
}

export interface CreateNoteInput {
  /** Injected by the caller (ADR-0007). */
  readonly id: NoteId;
  readonly playerId: PlayerId;
  readonly body: string;
  readonly createdAt: Timestamp;
}

/** Total. An original note: `rootId === id`, `supersedesId === null`. */
export function createNote(input: CreateNoteInput): PlayerResult<PlayerNote> {
  const body = validateBody(input.body);
  if (!body.ok) return body;
  const createdAt = validateTimestamp(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;
  return ok({
    id: input.id,
    playerId: input.playerId,
    body: body.value,
    createdAt: createdAt.value,
    rootId: input.id,
    supersedesId: null,
  });
}

/**
 * Total. An EDIT is a new version, never a mutation: the returned note carries a new
 * injected id, the previous note's `rootId`, and `supersedesId` pointing at it. The
 * caller keeps the previous record; this function cannot destroy it.
 *
 * `at` must not precede the version being replaced.
 */
export function reviseNote(
  previous: PlayerNote,
  input: { readonly id: NoteId; readonly body: string; readonly createdAt: Timestamp },
): PlayerResult<PlayerNote> {
  const body = validateBody(input.body);
  if (!body.ok) return body;
  const createdAt = validateTimestamp(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;
  if (createdAt.value < previous.createdAt) {
    return playerErr('TIMESTAMP_OUT_OF_ORDER', 'a revision must not predate the note it replaces', {
      field: 'createdAt',
      playerId: previous.playerId,
      actual: createdAt.value,
      min: previous.createdAt,
    });
  }
  return ok({
    id: input.id,
    playerId: previous.playerId,
    body: body.value,
    createdAt: createdAt.value,
    rootId: previous.rootId,
    supersedesId: previous.id,
  });
}

/**
 * Total. Every version of one note, oldest first. Ties on `createdAt` break on the
 * lesser id, which is deterministic rather than meaningful.
 */
export function noteHistory(notes: readonly PlayerNote[], rootId: NoteId): readonly PlayerNote[] {
  return notes
    .filter((note) => note.rootId === rootId)
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Total. The current version of one note — the latest in its chain. */
export function latestNoteVersion(
  notes: readonly PlayerNote[],
  rootId: NoteId,
): PlayerNote | undefined {
  return noteHistory(notes, rootId).at(-1);
}

/**
 * Total. The current version of EVERY note for one player, newest first — what the
 * player profile panel renders. Superseded versions are omitted from this view and
 * remain available through `noteHistory`.
 */
export function currentNotes(
  notes: readonly PlayerNote[],
  playerId: PlayerId,
): readonly PlayerNote[] {
  const mine = notes.filter((note) => note.playerId === playerId);
  const superseded = new Set(
    mine.map((note) => note.supersedesId).filter((id): id is NoteId => id !== null),
  );
  return mine
    .filter((note) => !superseded.has(note.id))
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
