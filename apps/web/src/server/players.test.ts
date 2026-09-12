// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves
// its migrations folder from `import.meta.url`, which is not a `file:` URL under the
// project's default happy-dom environment. The DOM is irrelevant to everything here.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asId, sequentialIdFactory } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import {
  insertExternalHudSnapshot,
  insertPlayer,
  listHudSnapshotsForPlayer,
  listPlayers,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import { createExternalHudSnapshot } from '@gto-self/player-core';
import { addPlayerNote, saveHudSnapshot } from './players.js';

const NOW = timestamp(1_700_000_000_000);

describe('saveHudSnapshot / addPlayerNote', () => {
  let handle: DatabaseHandle;

  beforeEach(() => {
    handle = openTestDatabase();
  });
  afterEach(() => {
    handle.close();
  });

  function seedPlayer(nickname = 'Hero'): PlayerId {
    const built = createPlayer({ id: asId<'Player'>('player-1'), nickname, createdAt: NOW });
    if (!built.ok) throw new Error(built.error.message);
    const written = insertPlayer(handle.db, built.value);
    if (!written.ok) throw new Error(written.error.message);
    return built.value.id;
  }

  it('saveHudSnapshot: happy path writes a snapshot and the profile reflects it', () => {
    const playerId = seedPlayer();
    const result = saveHudSnapshot(
      handle.db,
      {
        playerId,
        stats: [
          { key: 'VPIP', enteredText: '23.5' },
          { key: 'PFR', enteredText: '18' },
        ],
        handSample: 500,
      },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );

    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.profile.hud).not.toBeNull();
    expect(result.profile.hud?.stats).toEqual([
      { key: 'VPIP', enteredText: '23.5' },
      { key: 'PFR', enteredText: '18' },
    ]);
    expect(result.profile.hud?.handSample).toBe(500);

    const stored = listHudSnapshotsForPlayer(handle.db, playerId);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value).toHaveLength(1);
  });

  it('saveHudSnapshot: an out-of-range percentage fails validation and writes nothing', () => {
    const playerId = seedPlayer();
    const result = saveHudSnapshot(
      handle.db,
      {
        playerId,
        stats: [{ key: 'VPIP', enteredText: '250' }],
        handSample: 500,
      },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );

    expect(result.ok).toBe(false);

    const stored = listHudSnapshotsForPlayer(handle.db, playerId);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value).toHaveLength(0);
  });

  it('saveHudSnapshot: an unknown stat key fails validation and writes nothing', () => {
    const playerId = seedPlayer();
    const result = saveHudSnapshot(
      handle.db,
      {
        playerId,
        stats: [{ key: 'NOT_A_REAL_STAT', enteredText: '23.5' }],
        handSample: null,
      },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );

    expect(result.ok).toBe(false);
    const stored = listHudSnapshotsForPlayer(handle.db, playerId);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value).toHaveLength(0);
  });

  it('saveHudSnapshot: reuses the existing player id, never creates a new players row', () => {
    const playerId = seedPlayer();
    const before = listPlayers(handle.db);
    expect(before.ok).toBe(true);
    const beforeCount = before.ok ? before.value.length : -1;

    const result = saveHudSnapshot(
      handle.db,
      { playerId, stats: [{ key: 'VPIP', enteredText: '23.5' }], handSample: null },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );
    expect(result.ok).toBe(true);

    const after = listPlayers(handle.db);
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value).toHaveLength(beforeCount);
      expect(after.value.map((p) => p.id)).toEqual([playerId]);
    }
  });

  it('addPlayerNote: happy path writes a note and the profile reflects it', () => {
    const playerId = seedPlayer();
    const result = addPlayerNote(
      handle.db,
      { playerId, body: 'plays tight, folds to 3bet a lot' },
      { ids: sequentialIdFactory('note'), now: NOW },
    );

    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.profile.notes).toHaveLength(1);
    expect(result.profile.notes[0]?.body).toBe('plays tight, folds to 3bet a lot');
  });

  it('addPlayerNote: an empty body fails validation and writes nothing', () => {
    const playerId = seedPlayer();
    const result = addPlayerNote(
      handle.db,
      { playerId, body: '   ' },
      { ids: sequentialIdFactory('note'), now: NOW },
    );

    expect(result.ok).toBe(false);
    const notesResult = addPlayerNote(
      handle.db,
      { playerId, body: 'a follow-up note' },
      { ids: sequentialIdFactory('note'), now: NOW },
    );
    expect(notesResult.ok).toBe(true);
    if (notesResult.ok) expect(notesResult.profile.notes).toHaveLength(1);
  });

  it('fails cleanly for a player id that does not exist, for both writes', () => {
    const missing = asId<'Player'>('nonexistent-player');
    const hudResult = saveHudSnapshot(
      handle.db,
      { playerId: missing, stats: [{ key: 'VPIP', enteredText: '23.5' }], handSample: null },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );
    expect(hudResult.ok).toBe(false);

    const noteResult = addPlayerNote(
      handle.db,
      { playerId: missing, body: 'a note' },
      { ids: sequentialIdFactory('note'), now: NOW },
    );
    expect(noteResult.ok).toBe(false);
  });

  it('the profile view carries the latest EXTERNAL_HUD snapshot, nulls preserved as absent rows (WP-K)', () => {
    const playerId = seedPlayer();
    const snapshot = createExternalHudSnapshot({
      id: asId<'Snapshot'>('external-1'),
      playerId,
      recordedAt: NOW,
      importBatchId: 'import-1',
      stats: [
        { key: 'VPIP', enteredText: '29' },
        { key: 'FOLD_TO_CBET_ANY_STREET', enteredText: '26' },
        // WTSD/WSD omitted entirely — never a stored `null` row (CLAUDE.md rule 3).
      ],
    });
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    const written = insertExternalHudSnapshot(handle.db, snapshot.value);
    if (!written.ok) throw new Error(written.error.message);

    // Round-trip through a write action, the only exported way to read `buildProfileView`.
    const result = saveHudSnapshot(
      handle.db,
      { playerId, stats: [{ key: 'PFR', enteredText: '20' }], handSample: 100 },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.externalHud).not.toBeNull();
    expect(result.profile.externalHud?.sampleN).toBeNull();
    expect(result.profile.externalHud?.stats).toEqual([
      { key: 'VPIP', enteredText: '29' },
      { key: 'FOLD_TO_CBET_ANY_STREET', enteredText: '26' },
    ]);
  });

  it('a player never bulk-imported has externalHud: null', () => {
    const playerId = seedPlayer();
    const result = saveHudSnapshot(
      handle.db,
      { playerId, stats: [{ key: 'VPIP', enteredText: '20' }], handSample: 50 },
      { ids: sequentialIdFactory('snap'), now: NOW },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.externalHud).toBeNull();
  });
});
