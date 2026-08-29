/**
 * Manual HUD snapshots and player notes — the two APPEND-ONLY records.
 *
 * These are the BEHAVIOURAL tests: history survives an insert, a revision is a new row,
 * and a corrupted reading is reported rather than served. The STRUCTURAL guarantee — that
 * no UPDATE or DELETE can reach these tables at all, whoever issues it — is proved in
 * `insert-only.test.ts` against the database itself (`CLAUDE.md` rule 3).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, unwrap, type NoteId, type PlayerId, type SnapshotId } from '@gto-self/shared';
import {
  createHudSnapshot,
  createNote,
  createPlayer,
  hudStat,
  parsePercent,
  reviseNote,
  timestamp,
} from '@gto-self/player-core';
import * as hudRepository from '../src/repositories/hud.js';
import * as noteRepository from '../src/repositories/notes.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { playerHudSnapshotStats } from '../src/schema.js';
import { withoutInsertOnlyGuards } from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const T2 = timestamp(1_700_000_120_000);
const DAN = asId<'Player'>('p1') as PlayerId;

describe('HUD snapshots', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    unwrap(
      insertPlayer(handle.db, unwrap(createPlayer({ id: DAN, nickname: 'Dan', createdAt: T0 }))),
    );
    return () => handle.close();
  });

  const snapshotAt = (id: string, at: typeof T0, vpip: string, pfr: string) =>
    unwrap(
      createHudSnapshot({
        id: asId<'Snapshot'>(id) as SnapshotId,
        playerId: DAN,
        recordedAt: at,
        handSample: 1_240,
        stats: [
          { key: 'VPIP', enteredText: vpip },
          { key: 'PFR', enteredText: pfr },
        ],
      }),
    );

  it('round-trips a reading with its VERBATIM entered text, and re-parsing reproduces the value', () => {
    const snapshot = snapshotAt('s1', T0, '23.5 %', '18');
    unwrap(hudRepository.insertHudSnapshot(handle.db, snapshot));

    const loaded = hudRepository.getHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok && loaded.value).toEqual(snapshot);
    if (!loaded.ok || loaded.value === null) return;

    const vpip = hudStat(loaded.value, 'VPIP');
    expect(vpip?.enteredText).toBe('23.5 %');
    expect(vpip?.value).toBe(2_350);
    // The stored text is the source of truth for the stored integer.
    expect(unwrap(parsePercent(vpip?.enteredText ?? ''))).toBe(vpip?.value);

    // Both are real, separate columns.
    const rows = handle.db.select().from(playerHudSnapshotStats).all();
    const vpipRow = rows.find((row) => row.statKey === 'VPIP');
    expect(vpipRow?.enteredText).toBe('23.5 %');
    expect(vpipRow?.valueCentipercent).toBe(2_350);
  });

  it('keeps a NULL hand sample null — an unknown sample is not zero', () => {
    const snapshot = unwrap(
      createHudSnapshot({
        id: asId<'Snapshot'>('s1') as SnapshotId,
        playerId: DAN,
        recordedAt: T0,
        handSample: null,
        stats: [{ key: 'VPIP', enteredText: '23' }],
      }),
    );
    unwrap(hudRepository.insertHudSnapshot(handle.db, snapshot));
    const loaded = hudRepository.getHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok && loaded.value?.handSample).toBeNull();
  });

  it('is INSERT-ONLY: a newer reading adds a row and the older one stays readable', () => {
    const first = snapshotAt('s1', T0, '23.5', '18');
    const second = snapshotAt('s2', T1, '26', '21');
    unwrap(hudRepository.insertHudSnapshot(handle.db, first));
    unwrap(hudRepository.insertHudSnapshot(handle.db, second));

    const history = hudRepository.listHudSnapshotsForPlayer(handle.db, DAN);
    expect(history.ok && history.value).toHaveLength(2);
    expect(history.ok && history.value[0]?.id).toBe(second.id);
    expect(history.ok && history.value[1]?.id).toBe(first.id);

    const oldest = hudRepository.getHudSnapshot(handle.db, first.id);
    expect(oldest.ok && hudStat(oldest.value!, 'VPIP')?.enteredText).toBe('23.5');

    const latest = hudRepository.latestHudSnapshotForPlayer(handle.db, DAN);
    expect(latest.ok && latest.value?.id).toBe(second.id);
  });

  // A convention on top of the trigger, not the guarantee itself — `insert-only.test.ts`
  // proves the guarantee. Pinned as an EXACT list rather than a name regex, because a
  // regex over exported names would pass for `saveSnapshot` or `amendSnapshot`.
  it('exposes exactly four functions, none of which writes over an existing snapshot', () => {
    expect(Object.keys(hudRepository).sort()).toEqual([
      'getHudSnapshot',
      'insertHudSnapshot',
      'latestHudSnapshotForPlayer',
      'listHudSnapshotsForPlayer',
    ]);
  });

  it('reports a corrupt row when the stored value is not what its entered text parses to', () => {
    const snapshot = snapshotAt('s1', T0, '23.5', '18');
    unwrap(hudRepository.insertHudSnapshot(handle.db, snapshot));
    // The insert-only trigger refuses this write, so the row can only become inconsistent
    // by means outside this package — a hand-edited file, another tool. That is exactly the
    // situation the read-time re-parse check exists for, so the guards come off to reach it.
    withoutInsertOnlyGuards(handle, () => {
      handle.sqlite
        .prepare(
          `update player_hud_snapshot_stats set value_centipercent = 9999 where stat_key = 'VPIP'`,
        )
        .run();
    });
    const loaded = hudRepository.getHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });
});

describe('player notes', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    unwrap(
      insertPlayer(handle.db, unwrap(createPlayer({ id: DAN, nickname: 'Dan', createdAt: T0 }))),
    );
    return () => handle.close();
  });

  const original = () =>
    unwrap(
      createNote({
        id: asId<'Note'>('n1') as NoteId,
        playerId: DAN,
        body: 'Overfolds the river.',
        createdAt: T0,
      }),
    );

  it('is INSERT-ONLY: a revision is a new row and the old body is still readable', () => {
    const first = original();
    unwrap(noteRepository.insertNote(handle.db, first));
    const second = unwrap(
      reviseNote(first, {
        id: asId<'Note'>('n2') as NoteId,
        body: 'Overfolds the river, but never the turn.',
        createdAt: T1,
      }),
    );
    unwrap(noteRepository.insertNote(handle.db, second));

    const history = unwrap(noteRepository.listNoteHistory(handle.db, first.rootId));
    expect(history.map((note) => note.body)).toEqual([
      'Overfolds the river.',
      'Overfolds the river, but never the turn.',
    ]);
    expect(history[1]?.supersedesId).toBe(first.id);
    expect(history[1]?.rootId).toBe(first.id);

    const current = unwrap(noteRepository.listCurrentNotes(handle.db, DAN));
    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBe(second.id);

    // The superseded version is still individually retrievable.
    const old = noteRepository.getNote(handle.db, first.id);
    expect(old.ok && old.value?.body).toBe('Overfolds the river.');
  });

  // As above: the exact export list, with the real guarantee in `insert-only.test.ts`.
  it('exposes exactly four functions, none of which writes over an existing note body', () => {
    expect(Object.keys(noteRepository).sort()).toEqual([
      'getNote',
      'insertNote',
      'listCurrentNotes',
      'listNoteHistory',
    ]);
  });

  it('refuses a FORKED version chain: two revisions of the same version', () => {
    const first = original();
    unwrap(noteRepository.insertNote(handle.db, first));
    const a = unwrap(
      reviseNote(first, { id: asId<'Note'>('n2') as NoteId, body: 'Branch A', createdAt: T1 }),
    );
    const b = unwrap(
      reviseNote(first, { id: asId<'Note'>('n3') as NoteId, body: 'Branch B', createdAt: T2 }),
    );
    unwrap(noteRepository.insertNote(handle.db, a));
    const forked = noteRepository.insertNote(handle.db, b);
    expect(forked.ok).toBe(false);
    if (!forked.ok) expect(forked.error.code).toBe('CONSTRAINT_VIOLATION');
  });

  it('refuses a note for a player that does not exist', () => {
    const orphan = unwrap(
      createNote({
        id: asId<'Note'>('n9') as NoteId,
        playerId: asId<'Player'>('ghost') as PlayerId,
        body: 'nobody',
        createdAt: T0,
      }),
    );
    const written = noteRepository.insertNote(handle.db, orphan);
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.code).toBe('CONSTRAINT_VIOLATION');
  });
});
