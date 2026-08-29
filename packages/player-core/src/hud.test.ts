import { describe, expect, it } from 'vitest';
import { asId, isErr, unwrap, type PlayerId, type SnapshotId } from '@gto-self/shared';
import {
  HUD_STAT_KEYS,
  MAX_HAND_SAMPLE,
  createHudSnapshot,
  hudSnapshotHistory,
  hudStat,
  isHudStatKey,
  latestHudSnapshot,
  type CreateHudSnapshotInput,
  type PlayerHudSnapshot,
} from './hud.js';
import { timestamp } from './time.js';

const snapshotId = (value: string): SnapshotId => asId<'Snapshot'>(value);
const PLAYER = asId<'Player'>('p1') as PlayerId;
const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);

const make = (overrides: Partial<CreateHudSnapshotInput> = {}): PlayerHudSnapshot =>
  unwrap(
    createHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      handSample: 1200,
      stats: [
        { key: 'VPIP', enteredText: '23.5' },
        { key: 'PFR', enteredText: '18' },
      ],
      ...overrides,
    }),
  );

describe('createHudSnapshot', () => {
  it('keeps the entered text verbatim alongside the parsed value', () => {
    const snapshot = make({ stats: [{ key: 'VPIP', enteredText: ' 23.50 % ' }] });
    expect(snapshot.stats[0]?.enteredText).toBe(' 23.50 % ');
    expect(snapshot.stats[0]?.value).toBe(2350);
  });

  it('marks the snapshot as manual HUD testimony', () => {
    expect(make().source).toBe('MANUAL_HUD_ENTRY');
  });

  it('preserves the order the stats were entered in', () => {
    expect(make().stats.map((entry) => entry.key)).toEqual(['VPIP', 'PFR']);
  });

  it('accepts a null hand sample without inventing one', () => {
    expect(make({ handSample: null }).handSample).toBeNull();
    expect(make({ handSample: 0 }).handSample).toBe(0);
  });

  it('rejects an empty stat list', () => {
    const result = createHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      handSample: null,
      stats: [],
    });
    expect(isErr(result) && result.error.code).toBe('EMPTY_SNAPSHOT');
  });

  it('rejects an unknown stat key', () => {
    const result = createHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      handSample: null,
      stats: [{ key: 'AF' as never, enteredText: '2.5' }],
    });
    expect(isErr(result) && result.error.code).toBe('UNKNOWN_STAT');
  });

  it('rejects the same stat twice in one snapshot', () => {
    const result = createHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      handSample: null,
      stats: [
        { key: 'VPIP', enteredText: '23' },
        { key: 'VPIP', enteredText: '24' },
      ],
    });
    expect(isErr(result) && result.error.code).toBe('DUPLICATE_STAT');
    expect(isErr(result) && result.error.context.index).toBe(1);
  });

  it('rejects an unparseable percentage and names the offending entry', () => {
    const result = createHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: T0,
      handSample: null,
      stats: [
        { key: 'VPIP', enteredText: '23' },
        { key: 'PFR', enteredText: '18.555' },
      ],
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_PERCENT');
    expect(isErr(result) && result.error.context.field).toBe('stats[1].PFR');
  });

  it('rejects a negative, fractional or absurd hand sample', () => {
    for (const handSample of [-1, 1.5, MAX_HAND_SAMPLE + 1]) {
      const result = createHudSnapshot({
        id: snapshotId('s1'),
        playerId: PLAYER,
        recordedAt: T0,
        handSample,
        stats: [{ key: 'VPIP', enteredText: '23' }],
      });
      expect(isErr(result) && result.error.code).toBe('INVALID_SAMPLE_SIZE');
    }
  });

  it('rejects an invalid timestamp', () => {
    const result = createHudSnapshot({
      id: snapshotId('s1'),
      playerId: PLAYER,
      recordedAt: -1 as never,
      handSample: null,
      stats: [{ key: 'VPIP', enteredText: '23' }],
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_TIMESTAMP');
  });
});

describe('hudStat', () => {
  it('returns the reading, or undefined for a stat the user did not enter', () => {
    const snapshot = make();
    expect(hudStat(snapshot, 'VPIP')?.value).toBe(2350);
    expect(hudStat(snapshot, 'WTSD')).toBeUndefined();
  });

  it('exposes every accepted key through the guard', () => {
    for (const key of HUD_STAT_KEYS) expect(isHudStatKey(key)).toBe(true);
    expect(isHudStatKey('AF')).toBe(false);
  });
});

describe('snapshot history', () => {
  it('never overwrites: a newer reading is an additional record', () => {
    const first = make();
    const second = make({
      id: snapshotId('s2'),
      recordedAt: T1,
      stats: [{ key: 'VPIP', enteredText: '30' }],
    });
    const all = [first, second];
    expect(all).toHaveLength(2);
    expect(first.stats[0]?.enteredText).toBe('23.5');
    expect(latestHudSnapshot(all)?.id).toBe(second.id);
  });

  it('breaks a same-millisecond tie deterministically on the greater id', () => {
    const a = make({ id: snapshotId('s1') });
    const b = make({ id: snapshotId('s2') });
    expect(latestHudSnapshot([a, b])?.id).toBe(b.id);
    expect(latestHudSnapshot([b, a])?.id).toBe(b.id);
  });

  it('returns undefined for an empty list', () => {
    expect(latestHudSnapshot([])).toBeUndefined();
  });

  it('filters by player and sorts oldest first', () => {
    const other = asId<'Player'>('p2') as PlayerId;
    const mineOld = make({ id: snapshotId('s1'), recordedAt: T0 });
    const mineNew = make({ id: snapshotId('s2'), recordedAt: T1 });
    const theirs = make({ id: snapshotId('s3'), playerId: other, recordedAt: T1 });
    const history = hudSnapshotHistory([mineNew, theirs, mineOld], PLAYER);
    expect(history.map((snapshot) => snapshot.id)).toEqual([mineOld.id, mineNew.id]);
  });
});
