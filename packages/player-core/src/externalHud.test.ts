import { describe, expect, it } from 'vitest';
import { asId, isErr, unwrap, type PlayerId, type SnapshotId } from '@gto-self/shared';
import {
  EXTERNAL_HUD_STAT_KEYS,
  createExternalHudSnapshot,
  externalHudSnapshotHistory,
  externalHudStat,
  isExternalHudStatKey,
  latestExternalHudSnapshot,
  type CreateExternalHudSnapshotInput,
  type PlayerExternalHudSnapshot,
} from './externalHud.js';
import { timestamp } from './time.js';

const snapshotId = (value: string): SnapshotId => asId<'Snapshot'>(value);
const PLAYER = asId<'Player'>('p1') as PlayerId;
const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);

const make = (
  overrides: Partial<CreateExternalHudSnapshotInput> = {},
): PlayerExternalHudSnapshot =>
  unwrap(
    createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      importBatchId: 'batch-1',
      stats: [
        { key: 'VPIP', enteredText: '29' },
        { key: 'PFR', enteredText: '20' },
      ],
      ...overrides,
    }),
  );

describe('createExternalHudSnapshot', () => {
  it('keeps the entered text verbatim alongside the parsed value', () => {
    const snapshot = make({ stats: [{ key: 'VPIP', enteredText: '29%' }] });
    expect(snapshot.stats[0]?.enteredText).toBe('29%');
    expect(snapshot.stats[0]?.value).toBe(2900);
  });

  it('marks the snapshot as external, lifetime, established testimony', () => {
    const snapshot = make();
    expect(snapshot.source).toBe('EXTERNAL_HUD');
    expect(snapshot.scope).toBe('LIFETIME');
    expect(snapshot.reliability).toBe('ESTABLISHED');
  });

  it('never fabricates a sample count: sampleN is always null', () => {
    expect(make().sampleN).toBeNull();
  });

  it('preserves the order the stats were supplied in', () => {
    expect(make().stats.map((entry) => entry.key)).toEqual(['VPIP', 'PFR']);
  });

  it('a stat the source did not report is simply absent, never a 0% row', () => {
    const snapshot = make({ stats: [{ key: 'VPIP', enteredText: '35' }] });
    expect(externalHudStat(snapshot, 'WTSD')).toBeUndefined();
    expect(snapshot.stats).toHaveLength(1);
  });

  it('rejects an empty import batch id', () => {
    const result = createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      importBatchId: '',
      stats: [{ key: 'VPIP', enteredText: '29' }],
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_IMPORT_BATCH');
  });

  it('rejects an empty stat list', () => {
    const result = createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      importBatchId: 'batch-1',
      stats: [],
    });
    expect(isErr(result) && result.error.code).toBe('EMPTY_SNAPSHOT');
  });

  it('rejects an unknown stat key', () => {
    const result = createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      importBatchId: 'batch-1',
      stats: [{ key: 'CBET_FLOP' as never, enteredText: '65' }],
    });
    expect(isErr(result) && result.error.code).toBe('UNKNOWN_STAT');
  });

  it('rejects the same stat twice in one snapshot', () => {
    const result = createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      importBatchId: 'batch-1',
      stats: [
        { key: 'VPIP', enteredText: '29' },
        { key: 'VPIP', enteredText: '30' },
      ],
    });
    expect(isErr(result) && result.error.code).toBe('DUPLICATE_STAT');
    expect(isErr(result) && result.error.context.index).toBe(1);
  });

  it('rejects an unparseable percentage and names the offending entry', () => {
    const result = createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      importBatchId: 'batch-1',
      stats: [
        { key: 'VPIP', enteredText: '29' },
        { key: 'PFR', enteredText: '18.555' },
      ],
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_PERCENT');
    expect(isErr(result) && result.error.context.field).toBe('stats[1].PFR');
  });

  it('rejects an invalid timestamp', () => {
    const result = createExternalHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: -1 as never,
      importBatchId: 'batch-1',
      stats: [{ key: 'VPIP', enteredText: '29' }],
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_TIMESTAMP');
  });
});

describe('externalHudStat', () => {
  it('returns the reading, or undefined for a stat the source did not report', () => {
    const snapshot = make();
    expect(externalHudStat(snapshot, 'VPIP')?.value).toBe(2900);
    expect(externalHudStat(snapshot, 'WTSD')).toBeUndefined();
  });

  it('exposes every accepted key through the guard, including the generic street-blind ones', () => {
    for (const key of EXTERNAL_HUD_STAT_KEYS) expect(isExternalHudStatKey(key)).toBe(true);
    expect(isExternalHudStatKey('CBET_FLOP')).toBe(false);
    expect(isExternalHudStatKey('AF')).toBe(false);
  });
});

describe('snapshot history', () => {
  it('never overwrites: a re-import is an additional record', () => {
    const first = make();
    const second = make({
      id: snapshotId('s2'),
      recordedAt: T1,
      stats: [{ key: 'VPIP', enteredText: '35' }],
    });
    const all = [first, second];
    expect(all).toHaveLength(2);
    expect(first.stats[0]?.enteredText).toBe('29');
    expect(latestExternalHudSnapshot(all)?.id).toBe(second.id);
  });

  it('breaks a same-millisecond tie deterministically on the greater id', () => {
    const a = make({ id: snapshotId('s1') });
    const b = make({ id: snapshotId('s2') });
    expect(latestExternalHudSnapshot([a, b])?.id).toBe(b.id);
    expect(latestExternalHudSnapshot([b, a])?.id).toBe(b.id);
  });

  it('returns undefined for an empty list', () => {
    expect(latestExternalHudSnapshot([])).toBeUndefined();
  });

  it('filters by player and sorts oldest first', () => {
    const other = asId<'Player'>('p2') as PlayerId;
    const mineOld = make({ id: snapshotId('s1'), recordedAt: T0 });
    const mineNew = make({ id: snapshotId('s2'), recordedAt: T1 });
    const theirs = make({ id: snapshotId('s3'), playerId: other, recordedAt: T1 });
    const history = externalHudSnapshotHistory([mineNew, theirs, mineOld], PLAYER);
    expect(history.map((snapshot) => snapshot.id)).toEqual([mineOld.id, mineNew.id]);
  });
});
