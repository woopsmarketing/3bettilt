/**
 * `player_observations` — counts only, and the NULL position bucket.
 *
 * The interesting case is the natural key. `UNIQUE (player_id, metric, position)` alone
 * does NOT stop two rows with `position IS NULL`, because NULLs compare distinct. These
 * tests prove the schema handles that explicitly.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, unwrap, type ObservationId, type PlayerId } from '@gto-self/shared';
import { createObservation, createPlayer, observedRate, timestamp } from '@gto-self/player-core';
import * as observationRepository from '../src/repositories/observations.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { playerObservations } from '../src/schema.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const DAN = asId<'Player'>('p1') as PlayerId;

const observation = (
  id: string,
  position: 'BTN' | 'CO' | null,
  opportunities: number,
  actions: number,
) =>
  unwrap(
    createObservation({
      id: asId<'Observation'>(id) as ObservationId,
      playerId: DAN,
      metric: 'VPIP',
      position,
      opportunities,
      actions,
      observedAt: T0,
    }),
  );

describe('observations', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    unwrap(
      insertPlayer(handle.db, unwrap(createPlayer({ id: DAN, nickname: 'Dan', createdAt: T0 }))),
    );
    return () => handle.close();
  });

  it('stores counts and NO rate column', () => {
    const columns = handle.sqlite
      .prepare(`select name from pragma_table_info('player_observations')`)
      .all() as readonly { readonly name: string }[];
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'player_id',
      'metric',
      'position',
      'opportunities',
      'actions',
      'first_observed_at',
      'last_observed_at',
    ]);
    expect(
      columns.map((column) => column.name).filter((name) => /rate|percent|freq/iu.test(name)),
    ).toEqual([]);
  });

  it('round-trips counts, and the rate is DERIVED on demand', () => {
    const btn = observation('o1', 'BTN', 40, 17);
    unwrap(observationRepository.insertObservation(handle.db, btn));
    const loaded = observationRepository.getObservation(handle.db, btn.id);
    expect(loaded.ok && loaded.value).toEqual(btn);
    expect(loaded.ok && loaded.value !== null && observedRate(loaded.value)).toBeCloseTo(17 / 40);
  });

  it('treats position NULL as its OWN bucket, distinct from every positional one', () => {
    unwrap(observationRepository.insertObservation(handle.db, observation('o1', null, 100, 30)));
    unwrap(observationRepository.insertObservation(handle.db, observation('o2', 'BTN', 40, 17)));
    unwrap(observationRepository.insertObservation(handle.db, observation('o3', 'CO', 35, 12)));

    const anyBucket = observationRepository.findObservationByContext(handle.db, DAN, {
      metric: 'VPIP',
      position: null,
    });
    expect(anyBucket.ok && anyBucket.value?.id).toBe('o1');
    expect(anyBucket.ok && anyBucket.value?.opportunities).toBe(100);

    const btn = observationRepository.findObservationByContext(handle.db, DAN, {
      metric: 'VPIP',
      position: 'BTN',
    });
    expect(btn.ok && btn.value?.id).toBe('o2');

    const all = observationRepository.listObservationsForPlayer(handle.db, DAN);
    expect(all.ok && all.value).toHaveLength(3);
  });

  it('rejects a SECOND row in the NULL-position bucket — at the index, not just the repository', () => {
    unwrap(observationRepository.insertObservation(handle.db, observation('o1', null, 100, 30)));

    const viaRepository = observationRepository.insertObservation(
      handle.db,
      observation('o2', null, 5, 1),
    );
    expect(viaRepository.ok).toBe(false);
    if (!viaRepository.ok) expect(viaRepository.error.code).toBe('CONFLICT');

    // Bypassing the repository must still fail: a plain UNIQUE over a nullable column
    // would have let this through.
    expect(() =>
      handle.db
        .insert(playerObservations)
        .values({
          id: 'o3',
          playerId: DAN,
          metric: 'VPIP',
          position: null,
          opportunities: 5,
          actions: 1,
          firstObservedAt: T0,
          lastObservedAt: T0,
        })
        .run(),
    ).toThrow(/UNIQUE constraint failed/u);
  });

  it('rejects a duplicate positional bucket at the index', () => {
    unwrap(observationRepository.insertObservation(handle.db, observation('o1', 'BTN', 40, 17)));
    expect(() =>
      handle.db
        .insert(playerObservations)
        .values({
          id: 'o2',
          playerId: DAN,
          metric: 'VPIP',
          position: 'BTN',
          opportunities: 1,
          actions: 0,
          firstObservedAt: T0,
          lastObservedAt: T0,
        })
        .run(),
    ).toThrow(/UNIQUE constraint failed/u);
  });

  it('accumulates counts through player-core, creating the context on first sight', () => {
    const first = observationRepository.recordObservationCounts(handle.db, {
      id: asId<'Observation'>('o1') as ObservationId,
      playerId: DAN,
      metric: 'THREE_BET',
      position: 'CO',
      delta: { opportunities: 10, actions: 2 },
      observedAt: T0,
    });
    expect(first.ok && first.value.opportunities).toBe(10);

    const second = observationRepository.recordObservationCounts(handle.db, {
      // A different id is offered but must be IGNORED: the context already exists.
      id: asId<'Observation'>('o2') as ObservationId,
      playerId: DAN,
      metric: 'THREE_BET',
      position: 'CO',
      delta: { opportunities: 5, actions: 3 },
      observedAt: T1,
    });
    expect(second.ok && second.value.id).toBe('o1');
    expect(second.ok && second.value.opportunities).toBe(15);
    expect(second.ok && second.value.actions).toBe(5);
    expect(second.ok && second.value.firstObservedAt).toBe(T0);
    expect(second.ok && second.value.lastObservedAt).toBe(T1);
    expect(handle.db.select().from(playerObservations).all()).toHaveLength(1);
  });

  it('refuses more actions than opportunities at the CHECK constraint', () => {
    expect(() =>
      handle.db
        .insert(playerObservations)
        .values({
          id: 'o1',
          playerId: DAN,
          metric: 'VPIP',
          position: null,
          opportunities: 3,
          actions: 4,
          firstObservedAt: T0,
          lastObservedAt: T0,
        })
        .run(),
    ).toThrow(/CHECK constraint failed/u);
  });
});
