import { describe, expect, it } from 'vitest';
import { asId, isErr, unwrap, type NoteId, type PlayerId } from '@gto-self/shared';
import {
  MAX_NOTE_LENGTH,
  createNote,
  currentNotes,
  latestNoteVersion,
  noteHistory,
  reviseNote,
  type PlayerNote,
} from './notes.js';
import { timestamp } from './time.js';

const PLAYER = asId<'Player'>('p1') as PlayerId;
const OTHER = asId<'Player'>('p2') as PlayerId;
const noteId = (value: string): NoteId => asId<'Note'>(value);
const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const T2 = timestamp(1_700_000_120_000);

const original = (): PlayerNote =>
  unwrap(
    createNote({ id: noteId('n1'), playerId: PLAYER, body: '  3-bets too wide  ', createdAt: T0 }),
  );

describe('createNote', () => {
  it('trims the body and roots the version chain at itself', () => {
    const note = original();
    expect(note.body).toBe('3-bets too wide');
    expect(note.rootId).toBe(note.id);
    expect(note.supersedesId).toBeNull();
    expect(note.createdAt).toBe(T0);
  });

  it('rejects an empty or whitespace-only body', () => {
    for (const body of ['', '   ']) {
      const result = createNote({ id: noteId('n1'), playerId: PLAYER, body, createdAt: T0 });
      expect(isErr(result) && result.error.code).toBe('INVALID_NOTE_BODY');
    }
  });

  it('rejects a body longer than the limit and accepts one at it', () => {
    const tooLong = createNote({
      id: noteId('n1'),
      playerId: PLAYER,
      body: 'a'.repeat(MAX_NOTE_LENGTH + 1),
      createdAt: T0,
    });
    expect(isErr(tooLong) && tooLong.error.code).toBe('INVALID_NOTE_BODY');
    expect(isErr(tooLong) && tooLong.error.context.actual).toBe(MAX_NOTE_LENGTH + 1);
    const atLimit = createNote({
      id: noteId('n1'),
      playerId: PLAYER,
      body: 'a'.repeat(MAX_NOTE_LENGTH),
      createdAt: T0,
    });
    expect(atLimit.ok).toBe(true);
  });

  it('rejects an invalid timestamp', () => {
    const result = createNote({
      id: noteId('n1'),
      playerId: PLAYER,
      body: 'ok',
      createdAt: -5 as never,
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_TIMESTAMP');
  });
});

describe('reviseNote', () => {
  it('appends a new version instead of destroying the old body', () => {
    const first = original();
    const second = unwrap(
      reviseNote(first, { id: noteId('n2'), body: 'folds to 3-bets', createdAt: T1 }),
    );
    expect(first.body).toBe('3-bets too wide');
    expect(second.body).toBe('folds to 3-bets');
    expect(second.id).toBe(noteId('n2'));
    expect(second.rootId).toBe(first.id);
    expect(second.supersedesId).toBe(first.id);
    expect(second.playerId).toBe(PLAYER);
  });

  it('keeps the root across a chain of revisions', () => {
    const first = original();
    const second = unwrap(reviseNote(first, { id: noteId('n2'), body: 'v2', createdAt: T1 }));
    const third = unwrap(reviseNote(second, { id: noteId('n3'), body: 'v3', createdAt: T2 }));
    expect(third.rootId).toBe(first.id);
    expect(third.supersedesId).toBe(second.id);
  });

  it('rejects an invalid body and a revision that predates its predecessor', () => {
    const first = original();
    expect(isErr(reviseNote(first, { id: noteId('n2'), body: ' ', createdAt: T1 }))).toBe(true);
    const backwards = reviseNote(first, {
      id: noteId('n2'),
      body: 'v2',
      createdAt: timestamp(T0 - 1),
    });
    expect(isErr(backwards) && backwards.error.code).toBe('TIMESTAMP_OUT_OF_ORDER');
  });
});

describe('note selectors', () => {
  const first = original();
  const second = unwrap(reviseNote(first, { id: noteId('n2'), body: 'v2', createdAt: T1 }));
  const third = unwrap(reviseNote(second, { id: noteId('n3'), body: 'v3', createdAt: T2 }));
  const unrelated = unwrap(
    createNote({ id: noteId('n4'), playerId: PLAYER, body: 'other note', createdAt: T1 }),
  );
  const theirs = unwrap(
    createNote({ id: noteId('n5'), playerId: OTHER, body: 'their note', createdAt: T1 }),
  );
  const all = [third, unrelated, first, theirs, second];

  it('returns one chain oldest first', () => {
    expect(noteHistory(all, first.rootId).map((note) => note.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
  });

  it('returns the latest version of one chain', () => {
    expect(latestNoteVersion(all, first.rootId)?.body).toBe('v3');
    expect(latestNoteVersion(all, noteId('missing'))).toBeUndefined();
  });

  it('lists only current versions for one player, newest first', () => {
    expect(currentNotes(all, PLAYER).map((note) => note.id)).toEqual([third.id, unrelated.id]);
    expect(currentNotes(all, OTHER).map((note) => note.id)).toEqual([theirs.id]);
  });
});
