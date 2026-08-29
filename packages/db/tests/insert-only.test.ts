/**
 * The INSERT-ONLY guarantee for the three MANUALLY ENTERED tables — `player_notes`,
 * `player_hud_snapshots` and `player_hud_snapshot_stats` (`CLAUDE.md` rule 3).
 *
 * These tests exist because the previous ones did not prove the property. They asserted
 * that no exported name matched a `/update|delete|.../` regex, which would have passed for
 * a function called `saveNote` or `amendNote`, and which says nothing at all about what a
 * consumer can do with the table objects the barrel re-exports.
 *
 * So: every statement below is issued the way a real consumer would issue it — a raw
 * Drizzle `update`/`delete` built from a table object imported THROUGH THE BARREL, and raw
 * SQL through the driver — and every one of them must be REJECTED, with the original row
 * still intact afterwards. The guarantee is a `BEFORE UPDATE` / `BEFORE DELETE` trigger in
 * `drizzle/0001_insert_only_guards.sql`; the repositories exporting no mutator is a
 * convention layered on top of it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, unwrap, type NoteId, type PlayerId, type SnapshotId } from '@gto-self/shared';
import { createHudSnapshot, createNote, createPlayer, timestamp } from '@gto-self/player-core';
// THROUGH THE BARREL, deliberately: this is exactly the import a later phase would write.
import {
  openTestDatabase,
  playerHudSnapshotStats,
  playerHudSnapshots,
  playerNotes,
  type DatabaseHandle,
} from '../src/index.js';
import { insertHudSnapshot } from '../src/repositories/hud.js';
import { insertNote } from '../src/repositories/notes.js';
import { insertPlayer } from '../src/repositories/players.js';

const T0 = timestamp(1_700_000_000_000);
const DAN = asId<'Player'>('p1') as PlayerId;
const NOTE = asId<'Note'>('n1') as NoteId;
const SNAPSHOT = asId<'Snapshot'>('s1') as SnapshotId;

const BODY = 'Overfolds the river.';
const ENTERED_TEXT = '23.5 %';

/** SQLite reports an aborted trigger with the RAISE message, not a constraint marker. */
const INSERT_ONLY = /is insert-only/u;

describe('insert-only tables', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    unwrap(
      insertPlayer(handle.db, unwrap(createPlayer({ id: DAN, nickname: 'Dan', createdAt: T0 }))),
    );
    unwrap(
      insertNote(
        handle.db,
        unwrap(createNote({ id: NOTE, playerId: DAN, body: BODY, createdAt: T0 })),
      ),
    );
    unwrap(
      insertHudSnapshot(
        handle.db,
        unwrap(
          createHudSnapshot({
            id: SNAPSHOT,
            playerId: DAN,
            recordedAt: T0,
            handSample: 1_240,
            stats: [{ key: 'VPIP', enteredText: ENTERED_TEXT }],
          }),
        ),
      ),
    );
    return () => handle.close();
  });

  const noteBody = (): string | undefined =>
    (
      handle.sqlite.prepare(`select body from player_notes where id = 'n1'`).get() as
        { readonly body: string } | undefined
    )?.body;

  const reading = () =>
    handle.sqlite
      .prepare(`select entered_text, value_centipercent from player_hud_snapshot_stats`)
      .get() as { readonly entered_text: string; readonly value_centipercent: number } | undefined;

  it('the guards are real database objects, created by the committed migration', () => {
    const triggers = handle.sqlite
      .prepare(`select name from sqlite_master where type = 'trigger' order by name`)
      .all() as readonly { readonly name: string }[];
    expect(triggers.map((row) => row.name)).toEqual([
      'player_hud_snapshot_stats_no_delete',
      'player_hud_snapshot_stats_no_update',
      'player_hud_snapshots_no_delete',
      'player_hud_snapshots_no_update',
      'player_notes_no_delete',
      'player_notes_no_update',
    ]);
  });

  it('REJECTS a raw Drizzle update of a note body, built from the barrel export', () => {
    expect(() => handle.db.update(playerNotes).set({ body: 'destroyed' }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(noteBody()).toBe(BODY);
  });

  it('REJECTS a raw Drizzle delete of a note, built from the barrel export', () => {
    expect(() => handle.db.delete(playerNotes).run()).toThrow(INSERT_ONLY);
    expect(noteBody()).toBe(BODY);
  });

  it('REJECTS raw SQL that rewrites or removes a note', () => {
    expect(() => handle.sqlite.prepare(`update player_notes set body = 'gone'`).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.sqlite.prepare(`delete from player_notes`).run()).toThrow(INSERT_ONLY);
    expect(noteBody()).toBe(BODY);
  });

  it('REJECTS overwriting a HUD reading text and value TOGETHER — the re-parse check alone would not notice', () => {
    // Both columns changed consistently: `decodeHudSnapshotRow` would re-parse "99 %" to
    // 9900, find 9900 stored, and report a perfectly healthy row. The DB refuses instead.
    expect(() =>
      handle.db
        .update(playerHudSnapshotStats)
        .set({ enteredText: '99 %', valueCentipercent: 9_900 })
        .run(),
    ).toThrow(INSERT_ONLY);
    expect(reading()).toEqual({ entered_text: ENTERED_TEXT, value_centipercent: 2_350 });

    expect(() =>
      handle.sqlite
        .prepare(
          `update player_hud_snapshot_stats set entered_text = '99', value_centipercent = 9900`,
        )
        .run(),
    ).toThrow(INSERT_ONLY);
    expect(reading()).toEqual({ entered_text: ENTERED_TEXT, value_centipercent: 2_350 });
  });

  it('REJECTS a raw Drizzle update or delete of a HUD snapshot header', () => {
    expect(() => handle.db.update(playerHudSnapshots).set({ handSample: 1 }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.db.delete(playerHudSnapshots).run()).toThrow(INSERT_ONLY);
    const header = handle.sqlite.prepare(`select hand_sample from player_hud_snapshots`).get() as {
      readonly hand_sample: number;
    };
    expect(header.hand_sample).toBe(1_240);
  });

  it('deleting a snapshot cannot cascade its manually entered readings away', () => {
    expect(() => handle.sqlite.prepare(`delete from player_hud_snapshots`).run()).toThrow(
      INSERT_ONLY,
    );
    // Both the header and the stat rows survive: the cascade never ran.
    expect(handle.db.select().from(playerHudSnapshots).all()).toHaveLength(1);
    expect(handle.db.select().from(playerHudSnapshotStats).all()).toHaveLength(1);
    expect(() => handle.db.delete(playerHudSnapshotStats).run()).toThrow(INSERT_ONLY);
    expect(reading()).toEqual({ entered_text: ENTERED_TEXT, value_centipercent: 2_350 });
  });

  it('a rejected write leaves the surrounding transaction with nothing written', () => {
    expect(() =>
      handle.db.transaction((tx) => {
        tx.insert(playerNotes)
          .values({
            id: 'n2',
            playerId: DAN,
            body: 'a legitimate revision',
            createdAt: T0,
            rootId: 'n1',
            supersedesId: 'n1',
          })
          .run();
        tx.update(playerNotes).set({ body: 'destroyed' }).run();
      }),
    ).toThrow(INSERT_ONLY);
    expect(handle.db.select().from(playerNotes).all()).toHaveLength(1);
    expect(noteBody()).toBe(BODY);
  });

  it('still ACCEPTS the append that the design actually calls for', () => {
    unwrap(
      insertNote(
        handle.db,
        unwrap(
          createNote({
            id: asId<'Note'>('n3') as NoteId,
            playerId: DAN,
            body: 'a second, independent note',
            createdAt: T0,
          }),
        ),
      ),
    );
    expect(handle.db.select().from(playerNotes).all()).toHaveLength(2);
    expect(noteBody()).toBe(BODY);
  });
});
