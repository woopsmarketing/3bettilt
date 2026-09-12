// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves
// its migrations folder from `import.meta.url`, which is not a `file:` URL under the
// project's default happy-dom environment. The DOM is irrelevant to everything here.
/**
 * `saveExternalHudSnapshot` (WP-3) against a REAL migrated database.
 *
 * The properties worth fixing here are all ADR-0076's, and all of them are properties of the
 * ROWS rather than of the return value:
 *
 * 1. **Append, never update.** A correction leaves TWO snapshots behind, and the earlier text
 *    is still readable. The `player_external_hud_snapshots` insert-only trigger is not worked
 *    around; nothing here even tries.
 * 2. **A blank field is an absent ROW.** Not `0`, not `""`.
 * 3. **`sampleN` is `null`.** No hand count is invented for a typed reading.
 * 4. **ADAPTIVE reads the newest snapshot**, and the returned input already reflects it, so the
 *    panel does not need a second round trip.
 * 5. **A byte-identical re-save writes nothing** — the same rule the bulk import applies.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, sequentialIdFactory } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import {
  insertPlayer,
  latestExternalProfileForPlayer,
  listExternalHudSnapshotsForPlayer,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import {
  MANUAL_EXTERNAL_HUD_BATCH_PREFIX,
  saveExternalHudSnapshot,
} from './external-hud-entry-service.js';
import { loadAdaptiveOpponentInput } from './adaptive-service.js';

const NOW = timestamp(1_700_000_000_000);
const LATER = timestamp(1_700_000_060_000);

describe('saveExternalHudSnapshot', () => {
  let handle: DatabaseHandle;
  const deps = (now = NOW, prefix = 'snap') => ({ ids: sequentialIdFactory(prefix), now });

  beforeEach(() => {
    handle = openTestDatabase();
    return () => handle.close();
  });

  function seedPlayer(nickname = 'Villain'): PlayerId {
    const built = createPlayer({ id: asId<'Player'>('player-1'), nickname, createdAt: NOW });
    if (!built.ok) throw new Error(built.error.message);
    const written = insertPlayer(handle.db, built.value);
    if (!written.ok) throw new Error(written.error.message);
    return built.value.id;
  }

  it('writes one EXTERNAL_HUD snapshot with the verbatim text, no sampleN and a manual batch id', () => {
    const playerId = seedPlayer();
    const result = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 3, stats: { VPIP: '28.5', PFR: '21', WTSD: '30' } },
      deps(),
    );

    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.appended).toBe(true);

    const latest = latestExternalProfileForPlayer(handle.db, playerId);
    expect(latest.ok).toBe(true);
    if (!latest.ok || latest.value === null) return;
    expect(latest.value.source).toBe('EXTERNAL_HUD');
    expect(latest.value.scope).toBe('LIFETIME');
    expect(latest.value.sampleN).toBeNull();
    expect(latest.value.importBatchId.startsWith(MANUAL_EXTERNAL_HUD_BATCH_PREFIX)).toBe(true);
    expect(latest.value.stats.map((stat) => [stat.key, stat.enteredText])).toEqual([
      ['VPIP', '28.5'],
      ['PFR', '21'],
      ['WTSD', '30'],
    ]);
    expect(result.adaptiveInput.seatIndex).toBe(3);
    expect(result.adaptiveInput.nickname).toBe('Villain');
    expect(result.adaptiveInput.externalHudSnapshotId).toBe(latest.value.id);
  });

  it('omits a blank or whitespace-only field instead of storing a zero', () => {
    const playerId = seedPlayer();
    const result = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '28', PFR: '', THREE_BET: '   ', STEAL: '40' } },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);

    const latest = latestExternalProfileForPlayer(handle.db, playerId);
    if (!latest.ok || latest.value === null) return;
    expect(latest.value.stats.map((stat) => stat.key)).toEqual(['VPIP', 'STEAL']);
    // Not present as zero, and not present at all — the two must not be confusable.
    expect(latest.value.stats.some((stat) => stat.key === 'PFR')).toBe(false);
    expect(
      (latest.value.stats as readonly { readonly key: string; readonly value: number }[]).some(
        (stat) => stat.value === 0,
      ),
    ).toBe(false);
  });

  it('APPENDS a correction and never rewrites the earlier snapshot', () => {
    const playerId = seedPlayer();
    expect(
      saveExternalHudSnapshot(
        handle.db,
        { playerId, seatIndex: 0, stats: { VPIP: '28' } },
        deps(NOW, 'first'),
      ).ok,
    ).toBe(true);
    expect(
      saveExternalHudSnapshot(
        handle.db,
        { playerId, seatIndex: 0, stats: { VPIP: '33' } },
        deps(LATER, 'second'),
      ).ok,
    ).toBe(true);

    const history = listExternalHudSnapshotsForPlayer(handle.db, playerId);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.value).toHaveLength(2);
    // Newest first. The ORIGINAL text is still exactly what was typed the first time.
    expect(history.value[0]?.stats[0]?.enteredText).toBe('33');
    expect(history.value[1]?.stats[0]?.enteredText).toBe('28');
    expect(history.value[1]?.recordedAt).toBe(NOW);
  });

  it('makes loadAdaptiveOpponentInput read the NEWEST snapshot after a save', () => {
    const playerId = seedPlayer();
    saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '28' } },
      deps(NOW, 'first'),
    );
    const before = loadAdaptiveOpponentInput(handle.db, playerId, 0, 'Villain');
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(
      before.input.observations.find(
        (observation) => observation.key === 'VPIP' && observation.source === 'EXTERNAL_HUD',
      )?.valueBps,
    ).toBe(2800);

    const saved = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '33' } },
      deps(LATER, 'second'),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const after = loadAdaptiveOpponentInput(handle.db, playerId, 0, 'Villain');
    if (!after.ok) return;
    const vpip = after.input.observations.find(
      (observation) => observation.key === 'VPIP' && observation.source === 'EXTERNAL_HUD',
    );
    expect(vpip?.valueBps).toBe(3300);
    // The action's own return value already says the same thing, so no second trip is needed.
    expect(saved.adaptiveInput.observations).toEqual(after.input.observations);
    expect(saved.adaptiveInput.externalHudRecordedAt).toBe(LATER);
  });

  it('writes nothing when the entry is byte-identical to the latest snapshot', () => {
    const playerId = seedPlayer();
    saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '28', PFR: '21' } },
      deps(NOW, 'first'),
    );

    const again = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '28', PFR: '21', WTSD: '  ' } },
      deps(LATER, 'second'),
    );
    expect(again.ok, JSON.stringify(again)).toBe(true);
    if (!again.ok) return;
    expect(again.appended).toBe(false);
    // Still a usable, refreshed input — "nothing changed" is not "nothing to say".
    expect(again.adaptiveInput.externalHudRecordedAt).toBe(NOW);

    const history = listExternalHudSnapshotsForPlayer(handle.db, playerId);
    if (!history.ok) return;
    expect(history.value).toHaveLength(1);
  });

  it('refuses an entry with nothing in it rather than writing an empty snapshot', () => {
    const playerId = seedPlayer();
    const result = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '', PFR: '   ' } },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT');

    const history = listExternalHudSnapshotsForPlayer(handle.db, playerId);
    if (!history.ok) return;
    expect(history.value).toHaveLength(0);
  });

  it('refuses an unknown stat key rather than silently dropping it', () => {
    const playerId = seedPlayer();
    const result = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '28', VIPP: '9' } },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_INPUT');
      expect(result.message).toContain('VIPP');
    }

    const history = listExternalHudSnapshotsForPlayer(handle.db, playerId);
    if (!history.ok) return;
    expect(history.value).toHaveLength(0);
  });

  it('refuses an out-of-range percentage through player-core and writes nothing', () => {
    const playerId = seedPlayer();
    const result = saveExternalHudSnapshot(
      handle.db,
      { playerId, seatIndex: 0, stats: { VPIP: '250' } },
      deps(),
    );
    expect(result.ok).toBe(false);

    const history = listExternalHudSnapshotsForPlayer(handle.db, playerId);
    if (!history.ok) return;
    expect(history.value).toHaveLength(0);
  });

  it('refuses a player that does not exist, and a malformed seat index', () => {
    seedPlayer();
    const missing = saveExternalHudSnapshot(
      handle.db,
      { playerId: 'nobody', seatIndex: 0, stats: { VPIP: '28' } },
      deps(),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('NOT_FOUND');

    const badSeat = saveExternalHudSnapshot(
      handle.db,
      { playerId: 'player-1', seatIndex: 9, stats: { VPIP: '28' } },
      deps(),
    );
    expect(badSeat.ok).toBe(false);
    if (!badSeat.ok) expect(badSeat.code).toBe('INVALID_INPUT');
  });
});
