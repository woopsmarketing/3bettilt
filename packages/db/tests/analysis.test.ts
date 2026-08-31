/**
 * C1 — persistence for the DERIVED player-learning layer (ADR-0062; prompt §15, §21, §24,
 * §33, §38).
 *
 * The properties under test:
 *
 * 1. A `PlayerModelContent` survives a write and a read BIT-IDENTICALLY. Nothing about a
 *    player model may be lost, re-sorted, rounded or re-derived by the persistence layer —
 *    if it were, a v2 that "differs from v1" might differ only because it was stored.
 * 2. Versions accumulate and never overwrite: v1 stays readable after v2 exists, the latest
 *    query returns v2, and the database itself refuses a duplicate version.
 * 3. A run is atomic. A constraint violation anywhere in it leaves NO run row, NO snapshot
 *    and no orphan child rows — never a half-written model.
 * 4. `PARTIAL` and `FAILED` runs are recorded as such, with a per-player outcome for every
 *    player, and analysis NEVER touches raw history.
 * 5. Every new table is insert-only IN THE DATABASE, by the same standard ADR-0037 set:
 *    a raw Drizzle statement built from the barrel export must be REJECTED.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, isOk, unwrap, type HandId, type PlayerId, type SessionId } from '@gto-self/shared';
import { createPlayer, timestamp, type PlayerModelContent } from '@gto-self/player-core';
import {
  analysisRunPlayers,
  analysisRuns,
  openTestDatabase,
  playerModelBetSizes,
  playerModelShowEvidence,
  playerModelSnapshots,
  playerModelStats,
  playerSpotStats,
  type AnalysisRunId,
  type DatabaseHandle,
  type ModelSnapshotId,
} from '../src/index.js';
import {
  getAnalysisRun,
  getLatestSnapshot,
  getLatestSnapshotIdentity,
  getSnapshot,
  insertAnalysisResults,
  listAnalysisRunsForSession,
  listSnapshotVersions,
  type AnalysisPlayerInput,
} from '../src/repositories/analysis.js';
import { insertCompletedHand } from '../src/repositories/hands.js';
import { insertPlayer } from '../src/repositories/players.js';
import { insertSession } from '../src/repositories/sessions.js';
import {
  buildFixtureHand,
  buildShowdownFixtureHand,
  buildShowdownTable,
  buildTable,
} from './fixture.js';
import { buildModelContent } from './modelFixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const T2 = timestamp(1_700_000_120_000);
const T3 = timestamp(1_700_000_180_000);

const SESSION = asId<'Session'>('sess-1') as SessionId;
/** A second session, only so the two fixture hands can both be hand number 0. */
const SESSION_B = asId<'Session'>('sess-2') as SessionId;
const SEAT = (n: number): PlayerId => asId<'Player'>(`seat-${n}`) as PlayerId;
const HERO = SEAT(0);
const VILLAIN = SEAT(1);
const HAND_A = asId<'Hand'>('hand-fixture-1') as HandId;
const HAND_B = asId<'Hand'>('hand-showdown-1') as HandId;
const RUN = (n: number): AnalysisRunId => asId<'AnalysisRun'>(`run-${n}`) as AnalysisRunId;
const SNAP = (n: number): ModelSnapshotId => asId<'ModelSnapshot'>(`snap-${n}`) as ModelSnapshotId;

/** SQLite reports an aborted trigger with the RAISE message, not a constraint marker. */
const INSERT_ONLY = /is insert-only/u;

describe('analysis runs and player model snapshots', () => {
  let handle: DatabaseHandle;

  const content = (overrides: Partial<Parameters<typeof buildModelContent>[0]> = {}) =>
    buildModelContent({ playerId: HERO, handIds: [HAND_A, HAND_B], ...overrides });

  const snapshotPlayer = (
    snapshotId: ModelSnapshotId,
    document: PlayerModelContent,
    createdAt = T2,
  ): AnalysisPlayerInput => ({
    outcome: 'SNAPSHOT_CREATED',
    playerId: document.playerId,
    snapshotId,
    content: document,
    createdAt,
  });

  const run = (
    id: AnalysisRunId,
    players: readonly AnalysisPlayerInput[],
    overrides: Partial<Parameters<typeof insertAnalysisResults>[1]> = {},
  ) =>
    insertAnalysisResults(handle.db, {
      runId: id,
      sessionId: SESSION,
      startedAt: T1,
      finishedAt: T2,
      algorithmVersion: 1,
      status: 'SUCCESS',
      handCount: 2,
      observationCount: 41,
      showCount: 2,
      players,
      ...overrides,
    });

  const rawHistoryCounts = () =>
    handle.sqlite
      .prepare(
        `select (select count(*) from hands) as hands,
                (select count(*) from hand_events) as events,
                (select count(*) from hand_players) as lineup,
                (select count(*) from player_observations) as observations`,
      )
      .get();

  const derivedCounts = () =>
    handle.sqlite
      .prepare(
        `select (select count(*) from analysis_runs) as runs,
                (select count(*) from analysis_run_players) as outcomes,
                (select count(*) from player_model_snapshots) as snapshots,
                (select count(*) from player_model_stats) as stats,
                (select count(*) from player_spot_stats) as spots,
                (select count(*) from player_model_bet_sizes) as bets,
                (select count(*) from player_model_show_evidence) as shows`,
      )
      .get();

  beforeEach(() => {
    handle = openTestDatabase();
    for (const seat of [0, 1, 2, 3] as const) {
      unwrap(
        insertPlayer(
          handle.db,
          unwrap(createPlayer({ id: SEAT(seat), nickname: `Seat ${seat}`, createdAt: T0 })),
        ),
      );
    }
    for (const id of [SESSION, SESSION_B] as const) {
      unwrap(
        insertSession(handle.db, {
          id,
          label: null,
          presetId: null,
          table: buildShowdownTable(),
          createdAt: T0,
          updatedAt: T0,
          closedAt: null,
          autoTopUp: null,
          seatAutoTopUp: {},
        }),
      );
    }
    // Two REAL completed hands, so the derived rows' foreign keys point at real history.
    unwrap(
      insertCompletedHand(handle.db, {
        sessionId: SESSION,
        hand: buildFixtureHand(buildTable(), 'hand-fixture-1'),
        startedAt: T0,
        finishedAt: T1,
      }),
    );
    unwrap(
      insertCompletedHand(handle.db, {
        sessionId: SESSION_B,
        hand: buildShowdownFixtureHand(buildShowdownTable(), 'hand-showdown-1'),
        startedAt: T1,
        finishedAt: T2,
      }),
    );
    return () => handle.close();
  });

  /* ------------------------------------------------------------------ */
  /* Lossless round trip                                                 */
  /* ------------------------------------------------------------------ */

  it('reloads a model document BIT-IDENTICALLY — every stat, spot, bet size and reveal', () => {
    const document = content();
    const written = unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), document)]));
    expect(written.players).toEqual([
      { playerId: HERO, outcome: 'SNAPSHOT_CREATED', snapshotId: SNAP(1), modelVersion: 1 },
    ]);

    const loaded = unwrap(getSnapshot(handle.db, SNAP(1)));
    expect(loaded).not.toBeNull();
    const { modelVersion, createdAt, ...reloaded } = loaded!;
    expect(modelVersion).toBe(1);
    expect(createdAt).toBe(T2);
    // Deep equality first (a readable failure), then byte equality of the serialization —
    // key ORDER matters too, because a snapshot is compared for equality across runs.
    expect(reloaded).toEqual(document);
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(document));
  });

  it('keeps the shapes a lazier encoding would have destroyed', () => {
    const document = content();
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), document)]));
    const loaded = unwrap(getSnapshot(handle.db, SNAP(1)))!;

    // The `null`-position bucket and the six positional rows are BOTH present, and separate.
    const vpip = loaded.globalStats.filter((row) => row.key === 'VPIP');
    expect(vpip).toHaveLength(7);
    expect(vpip.filter((row) => row.position === null)).toHaveLength(1);
    expect(new Set(vpip.map((row) => row.position)).size).toBe(7);

    // A one-card reveal on a hand with NO board survived as one card and no board.
    const partial = loaded.showEvidence.find((row) => row.handId === HAND_B)!;
    expect(partial.cards).toHaveLength(1);
    expect(partial.board).toEqual([]);
    expect(partial.lastStreet).toBe('PREFLOP');

    // Every preflop family and every postflop street is still distinguishable.
    const preflop = loaded.spotStats.filter((row) => row.spot.phase === 'PREFLOP');
    expect(new Set(preflop.map((row) => row.spot.family)).size).toBe(8);
    const postflop = loaded.spotStats.filter((row) => row.spot.phase === 'POSTFLOP');
    expect(
      new Set(postflop.map((row) => row.spot.phase === 'POSTFLOP' && row.spot.street)).size,
    ).toBe(3);

    // Raw money is intact, and an ALL_IN verb is still visible under a RAISE effect.
    expect(loaded.betSizes.map((row) => row.amount)).toEqual([2_500, 3_000, 8_000, 13_000, 45_000]);
    const rfi = loaded.spotStats.find((row) => row.spotKey === 'BTN_RFI')!;
    expect(rfi.verbs.ALL_IN).toBe(1);
    expect(rfi.effects.RAISE).toBe(7);
  });

  it('reproduces per-row confidence from the stored sample and the stored config', () => {
    const document = content();
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), document)]));
    const loaded = unwrap(getSnapshot(handle.db, SNAP(1)))!;
    // n = 30 is exactly K, so the weight is exactly half — a value hand-derivable from the
    // config the snapshot itself carries, not from a number this layer stored.
    expect(loaded.confidence.k).toBe(30);
    for (const row of loaded.globalStats) {
      const original = document.globalStats.find(
        (candidate) => candidate.key === row.key && candidate.position === row.position,
      )!;
      expect(row.confidence).toEqual(original.confidence);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Versioning                                                          */
  /* ------------------------------------------------------------------ */

  it('assigns v1 then v2 for the same player and never overwrites v1', () => {
    const first = content({ inputHash: 'hash-one', sourceHandCount: 2 });
    const second = content({ inputHash: 'hash-two', sourceHandCount: 9 });
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), first)]));
    const later = unwrap(run(RUN(2), [snapshotPlayer(SNAP(2), second, T3)]));
    expect(later.players[0]?.modelVersion).toBe(2);

    const versions = unwrap(listSnapshotVersions(handle.db, HERO));
    expect(versions.map((header) => header.modelVersion)).toEqual([1, 2]);
    expect(versions.map((header) => header.sourceHandCount)).toEqual([2, 9]);
    expect(versions.map((header) => header.analysisRunId)).toEqual([RUN(1), RUN(2)]);

    // v1 is still readable, and still says what it said.
    expect(unwrap(getSnapshot(handle.db, SNAP(1)))!.inputHash).toBe('hash-one');
    const latest = unwrap(getLatestSnapshot(handle.db, HERO))!;
    expect(latest.modelVersion).toBe(2);
    expect(latest.inputHash).toBe('hash-two');
    expect(latest.sourceHandCount).toBe(9);
  });

  it('REFUSES a duplicate version for one player, whoever writes it', () => {
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), content())]));
    expect(() =>
      handle.db
        .insert(playerModelSnapshots)
        .values({
          id: 'snap-clone',
          playerId: HERO,
          modelVersion: 1,
          analysisRunId: RUN(1),
          algorithmVersion: 1,
          inputHash: 'whatever',
          sourceHandCount: 2,
          sourceObservationCount: 2,
          sourceShowCount: 0,
          createdAt: T2,
          confidenceK: 30,
          confidenceLearningThreshold: 5,
          confidenceKnownThreshold: 30,
          confidenceOverallOpportunities: 2,
        })
        .run(),
    ).toThrow(/UNIQUE constraint failed/u);
  });

  it('versions each player independently', () => {
    const heroDoc = content();
    const villainDoc = content({ playerId: VILLAIN });
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), heroDoc), snapshotPlayer(SNAP(2), villainDoc)]));
    const second = unwrap(run(RUN(2), [snapshotPlayer(SNAP(3), content({ inputHash: 'x' }), T3)]));
    expect(second.players[0]?.modelVersion).toBe(2);
    expect(unwrap(getLatestSnapshot(handle.db, VILLAIN))!.modelVersion).toBe(1);
  });

  it('reports the NO_CHANGES gate identity, and null before any snapshot exists', () => {
    expect(unwrap(getLatestSnapshotIdentity(handle.db, HERO))).toBeNull();
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), content({ inputHash: 'hash-one' }))]));
    unwrap(
      run(RUN(2), [
        snapshotPlayer(SNAP(2), content({ inputHash: 'hash-two', algorithmVersion: 2 }), T3),
      ]),
    );
    expect(unwrap(getLatestSnapshotIdentity(handle.db, HERO))).toEqual({
      algorithmVersion: 2,
      inputHash: 'hash-two',
      modelVersion: 2,
    });
  });

  /* ------------------------------------------------------------------ */
  /* Atomicity                                                           */
  /* ------------------------------------------------------------------ */

  it('writes NOTHING when any child row is refused — no run, no snapshot, no orphans', () => {
    const document = content();
    const broken: PlayerModelContent = {
      ...document,
      betSizes: [
        ...document.betSizes,
        // A bet size about a hand that is not in raw history: the FK refuses it, and it is
        // the LAST child row written for this player, so everything before it must roll back.
        { ...document.betSizes[0]!, handId: asId<'Hand'>('no-such-hand') as HandId },
      ],
    };
    const result = run(RUN(1), [snapshotPlayer(SNAP(1), broken)]);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) expect(result.error.code).toBe('CONSTRAINT_VIOLATION');
    expect(derivedCounts()).toEqual({
      runs: 0,
      outcomes: 0,
      snapshots: 0,
      stats: 0,
      spots: 0,
      bets: 0,
      shows: 0,
    });
  });

  it('rolls the WHOLE run back when a later player fails, including the earlier snapshot', () => {
    const good = content();
    const bad: PlayerModelContent = {
      ...content({ playerId: VILLAIN }),
      showEvidence: [
        {
          ...content({ playerId: VILLAIN }).showEvidence[0]!,
          handId: asId<'Hand'>('no-such-hand') as HandId,
        },
      ],
    };
    const result = run(RUN(1), [snapshotPlayer(SNAP(1), good), snapshotPlayer(SNAP(2), bad)]);
    expect(isOk(result)).toBe(false);
    expect(derivedCounts()).toEqual({
      runs: 0,
      outcomes: 0,
      snapshots: 0,
      stats: 0,
      spots: 0,
      bets: 0,
      shows: 0,
    });
    expect(unwrap(getLatestSnapshot(handle.db, HERO))).toBeNull();
  });

  it('REFUSES a document that disagrees with itself, before writing anything', () => {
    const document = content();
    const mislabelled: PlayerModelContent = {
      ...document,
      spotStats: document.spotStats.map((spot, index) =>
        index === 0 ? { ...spot, spotKey: 'NOT_THE_DERIVED_KEY' } : spot,
      ),
    };
    const badKey = run(RUN(1), [snapshotPlayer(SNAP(1), mislabelled)]);
    expect(isOk(badKey)).toBe(false);
    if (!isOk(badKey)) expect(badKey.error.code).toBe('INVALID_INPUT');

    const wrongPlayer = run(RUN(2), [
      {
        outcome: 'SNAPSHOT_CREATED',
        playerId: VILLAIN,
        snapshotId: SNAP(2),
        content: document,
        createdAt: T2,
      },
    ]);
    expect(isOk(wrongPlayer)).toBe(false);
    if (!isOk(wrongPlayer)) expect(wrongPlayer.error.code).toBe('INVALID_INPUT');

    const twice = run(RUN(3), [
      snapshotPlayer(SNAP(3), document),
      { outcome: 'NO_CHANGES', playerId: HERO },
    ]);
    expect(isOk(twice)).toBe(false);
    if (!isOk(twice)) expect(twice.error.code).toBe('INVALID_INPUT');

    expect(derivedCounts()).toEqual({
      runs: 0,
      outcomes: 0,
      snapshots: 0,
      stats: 0,
      spots: 0,
      bets: 0,
      shows: 0,
    });
  });

  /* ------------------------------------------------------------------ */
  /* Run status and per-player outcomes                                  */
  /* ------------------------------------------------------------------ */

  it('records a PARTIAL run with an explicit outcome for EVERY player', () => {
    const before = rawHistoryCounts();
    unwrap(
      run(
        RUN(1),
        [
          snapshotPlayer(SNAP(1), content()),
          { outcome: 'NO_CHANGES', playerId: VILLAIN },
          { outcome: 'FAILED', playerId: SEAT(2), errorJson: '{"code":"INVALID_INPUT"}' },
        ],
        { status: 'PARTIAL' },
      ),
    );

    const report = unwrap(getAnalysisRun(handle.db, RUN(1)))!;
    expect(report.run.status).toBe('PARTIAL');
    expect(report.run.playerCount).toBe(3);
    expect(report.run.errorJson).toBeNull();
    expect(report.players).toEqual([
      {
        runId: RUN(1),
        playerId: HERO,
        outcome: 'SNAPSHOT_CREATED',
        snapshotId: SNAP(1),
        errorJson: null,
      },
      {
        runId: RUN(1),
        playerId: VILLAIN,
        outcome: 'NO_CHANGES',
        snapshotId: null,
        errorJson: null,
      },
      {
        runId: RUN(1),
        playerId: SEAT(2),
        outcome: 'FAILED',
        snapshotId: null,
        errorJson: '{"code":"INVALID_INPUT"}',
      },
    ]);

    // ANALYSIS NEVER TOUCHES RAW HISTORY, and never writes `player_observations`.
    expect(rawHistoryCounts()).toEqual(before);
  });

  it('records a FAILED run that produced no snapshot at all', () => {
    unwrap(
      run(
        RUN(1),
        [{ outcome: 'FAILED', playerId: HERO, errorJson: '{"code":"HAND_NOT_COMPLETE"}' }],
        {
          status: 'FAILED',
          errorJson: '{"code":"HAND_NOT_COMPLETE","hands":1}',
        },
      ),
    );
    const report = unwrap(getAnalysisRun(handle.db, RUN(1)))!;
    expect(report.run.status).toBe('FAILED');
    expect(report.run.errorJson).toBe('{"code":"HAND_NOT_COMPLETE","hands":1}');
    expect(report.players[0]?.outcome).toBe('FAILED');
    expect(unwrap(getLatestSnapshot(handle.db, HERO))).toBeNull();
  });

  it('REFUSES a per-player row that claims a snapshot it does not have', () => {
    // The repository's union makes this unrepresentable; the DATABASE refuses it too.
    unwrap(run(RUN(1), [{ outcome: 'NO_CHANGES', playerId: HERO }]));
    expect(() =>
      handle.db
        .insert(analysisRunPlayers)
        .values({
          runId: RUN(1),
          playerId: VILLAIN,
          outcome: 'SNAPSHOT_CREATED',
          snapshotId: null,
          errorJson: null,
        })
        .run(),
    ).toThrow(/CHECK constraint failed/u);
  });

  it('lists a session runs oldest first, each with its outcomes', () => {
    unwrap(run(RUN(1), [{ outcome: 'NO_CHANGES', playerId: HERO }]));
    unwrap(
      run(RUN(2), [snapshotPlayer(SNAP(1), content(), T3)], { startedAt: T2, finishedAt: T3 }),
    );
    const reports = unwrap(listAnalysisRunsForSession(handle.db, SESSION));
    expect(reports.map((report) => report.run.id)).toEqual([RUN(1), RUN(2)]);
    expect(reports.map((report) => report.players.length)).toEqual([1, 1]);
    expect(unwrap(getAnalysisRun(handle.db, RUN(9)))).toBeNull();
    expect(unwrap(getSnapshot(handle.db, SNAP(9)))).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /* Insert-only, enforced by the database                               */
  /* ------------------------------------------------------------------ */

  it('REFUSES every UPDATE and DELETE on every derived table, through the barrel export', () => {
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), content())]));
    const before = derivedCounts();

    expect(() => handle.db.update(analysisRuns).set({ status: 'SUCCESS' }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.db.delete(analysisRuns).run()).toThrow(INSERT_ONLY);
    expect(() => handle.db.update(analysisRunPlayers).set({ outcome: 'FAILED' }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.db.delete(analysisRunPlayers).run()).toThrow(INSERT_ONLY);
    expect(() => handle.db.update(playerModelSnapshots).set({ inputHash: 'x' }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.db.delete(playerModelSnapshots).run()).toThrow(INSERT_ONLY);
    expect(() => handle.db.update(playerModelStats).set({ actions: 0 }).run()).toThrow(INSERT_ONLY);
    expect(() => handle.db.delete(playerModelStats).run()).toThrow(INSERT_ONLY);
    expect(() => handle.db.update(playerSpotStats).set({ opportunities: 0 }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.db.delete(playerSpotStats).run()).toThrow(INSERT_ONLY);
    expect(() => handle.db.update(playerModelBetSizes).set({ amount: 1 }).run()).toThrow(
      INSERT_ONLY,
    );
    expect(() => handle.db.delete(playerModelBetSizes).run()).toThrow(INSERT_ONLY);
    expect(() =>
      handle.db.update(playerModelShowEvidence).set({ cardsText: '2c 3c' }).run(),
    ).toThrow(INSERT_ONLY);
    expect(() => handle.db.delete(playerModelShowEvidence).run()).toThrow(INSERT_ONLY);

    // Raw SQL is refused the same way, and nothing changed.
    expect(() =>
      handle.sqlite.prepare(`update player_model_snapshots set model_version = 9`).run(),
    ).toThrow(INSERT_ONLY);
    expect(derivedCounts()).toEqual(before);
    expect(unwrap(getSnapshot(handle.db, SNAP(1)))!.modelVersion).toBe(1);
  });

  it('REJECTS a fractional or out-of-vocabulary derived value at the constraint', () => {
    unwrap(run(RUN(1), [snapshotPlayer(SNAP(1), content())]));
    expect(() =>
      handle.sqlite
        .prepare(`insert into player_model_stats values ('snap-1', 999, 'VPIP', null, 10.5, 1, 10)`)
        .run(),
    ).toThrow(/CHECK constraint failed/u);
    expect(() =>
      handle.sqlite
        .prepare(
          `insert into player_model_stats values ('snap-1', 998, 'NOT_A_STAT', null, 10, 1, 10)`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u);
    // An effect distribution that does not account for every opportunity is refused.
    expect(() =>
      handle.sqlite
        .prepare(
          `insert into player_spot_stats values ('snap-1', 997, 'BTN_RFI_2', 'PREFLOP', 'RFI', 'BTN', null,
             'HEADS_UP', null, null, null, null, 5, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 5)`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/u);
  });
});
