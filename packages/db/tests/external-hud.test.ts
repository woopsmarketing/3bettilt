/**
 * External (third-party, lifetime) HUD profiles — `player_external_hud_snapshots`.
 *
 * Behavioural tests mirroring `hud-and-notes.test.ts`'s manual-HUD coverage. The
 * STRUCTURAL insert-only guarantee is proved separately in `insert-only.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, unwrap, type PlayerId, type SnapshotId } from '@gto-self/shared';
import {
  createExternalHudSnapshot,
  createPlayer,
  externalHudStat,
  parsePercent,
  timestamp,
} from '@gto-self/player-core';
import * as externalHudRepository from '../src/repositories/external-hud.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { playerExternalHudSnapshotStats } from '../src/schema.js';
import { withoutInsertOnlyGuards } from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const DAN = asId<'Player'>('p1') as PlayerId;

describe('external HUD snapshots', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    unwrap(
      insertPlayer(handle.db, unwrap(createPlayer({ id: DAN, nickname: 'Dan', createdAt: T0 }))),
    );
    return () => handle.close();
  });

  const snapshotAt = (id: string, at: typeof T0, batch: string, vpip: string, pfr: string) =>
    unwrap(
      createExternalHudSnapshot({
        id: asId<'Snapshot'>(id) as SnapshotId,
        playerId: DAN,
        recordedAt: at,
        importBatchId: batch,
        stats: [
          { key: 'VPIP', enteredText: vpip },
          { key: 'PFR', enteredText: pfr },
        ],
      }),
    );

  it('round-trips a reading with its VERBATIM entered text, and re-parsing reproduces the value', () => {
    const snapshot = snapshotAt('s1', T0, 'batch-1', '29', '20');
    unwrap(externalHudRepository.insertExternalHudSnapshot(handle.db, snapshot));

    const loaded = externalHudRepository.getExternalHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok && loaded.value).toEqual(snapshot);
    if (!loaded.ok || loaded.value === null) return;

    const vpip = externalHudStat(loaded.value, 'VPIP');
    expect(vpip?.enteredText).toBe('29');
    expect(vpip?.value).toBe(2_900);
    expect(unwrap(parsePercent(vpip?.enteredText ?? ''))).toBe(vpip?.value);

    const rows = handle.db.select().from(playerExternalHudSnapshotStats).all();
    const vpipRow = rows.find((row) => row.statKey === 'VPIP');
    expect(vpipRow?.enteredText).toBe('29');
    expect(vpipRow?.valueCentipercent).toBe(2_900);
  });

  it('never fabricates a sample count: sampleN stays null through a round trip', () => {
    const snapshot = snapshotAt('s1', T0, 'batch-1', '29', '20');
    unwrap(externalHudRepository.insertExternalHudSnapshot(handle.db, snapshot));
    const loaded = externalHudRepository.getExternalHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok && loaded.value?.sampleN).toBeNull();
  });

  it('a stat the source did not report round-trips as ABSENT, never as 0%', () => {
    const snapshot = unwrap(
      createExternalHudSnapshot({
        id: asId<'Snapshot'>('s1') as SnapshotId,
        playerId: DAN,
        recordedAt: T0,
        importBatchId: 'batch-1',
        stats: [{ key: 'VPIP', enteredText: '35' }],
      }),
    );
    unwrap(externalHudRepository.insertExternalHudSnapshot(handle.db, snapshot));
    const loaded = externalHudRepository.getExternalHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok && externalHudStat(loaded.value!, 'WTSD')).toBeUndefined();
  });

  it('is INSERT-ONLY: a re-import adds a row and the older one stays readable', () => {
    const first = snapshotAt('s1', T0, 'batch-1', '29', '20');
    const second = snapshotAt('s2', T1, 'batch-2', '31', '22');
    unwrap(externalHudRepository.insertExternalHudSnapshot(handle.db, first));
    unwrap(externalHudRepository.insertExternalHudSnapshot(handle.db, second));

    const history = externalHudRepository.listExternalHudSnapshotsForPlayer(handle.db, DAN);
    expect(history.ok && history.value).toHaveLength(2);
    expect(history.ok && history.value[0]?.id).toBe(second.id);
    expect(history.ok && history.value[1]?.id).toBe(first.id);

    const oldest = externalHudRepository.getExternalHudSnapshot(handle.db, first.id);
    expect(oldest.ok && externalHudStat(oldest.value!, 'VPIP')?.enteredText).toBe('29');

    const latest = externalHudRepository.latestExternalProfileForPlayer(handle.db, DAN);
    expect(latest.ok && latest.value?.id).toBe(second.id);
  });

  // A convention on top of the trigger, not the guarantee itself — `insert-only.test.ts`
  // proves the guarantee. Pinned as an EXACT list, same discipline as `hud-and-notes.test.ts`.
  it('exposes exactly five functions, none of which writes over an existing snapshot', () => {
    expect(Object.keys(externalHudRepository).sort()).toEqual([
      'getExternalHudSnapshot',
      'insertExternalHudSnapshot',
      'latestExternalProfileForPlayer',
      'listExternalHudSnapshotsForPlayer',
      // A read: `selectDistinct` over the snapshot table's player column. It is on this
      // list because the list is exhaustive by design, not because it writes.
      'playerIdsWithExternalHud',
    ]);
  });

  it('reports a corrupt row when the stored value is not what its entered text parses to', () => {
    const snapshot = snapshotAt('s1', T0, 'batch-1', '29', '20');
    unwrap(externalHudRepository.insertExternalHudSnapshot(handle.db, snapshot));
    withoutInsertOnlyGuards(handle, () => {
      handle.sqlite
        .prepare(
          `update player_external_hud_snapshot_stats set value_centipercent = 9999 where stat_key = 'VPIP'`,
        )
        .run();
    });
    const loaded = externalHudRepository.getExternalHudSnapshot(handle.db, snapshot.id);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });
});
