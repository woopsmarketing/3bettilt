// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves its
// migrations folder from `import.meta.url`, which is not a `file:` URL under the project's
// default happy-dom environment.
/**
 * `runSessionAnalysis` against a REAL migrated database, over REAL completed hands stored
 * through the app's own persistence service.
 *
 * What these tests are for, in one sentence each:
 *
 * - **Idempotency** (prompt §38): a second click must report `NO_CHANGES` and change no
 *   number. This is the property the whole design of ADR-0062c exists to provide.
 * - **Multi-session accumulation** (prompt §25): a player's snapshot is built from every
 *   session they played, not from the one whose button was pressed.
 * - **Failure semantics** (prompt §33): one player's failure is reported as `PARTIAL` with
 *   the other players' snapshots still written, and raw history is untouched.
 * - **Determinism** (ADR-0062): identical input, identical content.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, sequentialIdFactory, type PlayerId, type SessionId } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import { ANALYSIS_ALGORITHM_VERSION } from '@gto-self/analysis-core';
import { SEAT_INDEXES } from '@gto-self/poker-core';
import {
  closeSession,
  findPlayerById,
  getAnalysisRun,
  getSession,
  getLatestSnapshot,
  listAnalysisRunsForSession,
  listCompletedHandIdsForPlayer,
  listCompletedHandsForSession,
  listSnapshotVersions,
  loadHandEvents,
  openTestDatabase,
  type DatabaseHandle,
  type GtoDatabase,
} from '@gto-self/db';
import { getPlayerModel, runSessionAnalysis } from './analysis-service.js';
import type { AnalysisSummary } from './analysis-contract.js';
import {
  persistFixtureHands,
  startFixtureSession,
  type SessionFixture,
} from '../../tests/support/analysis-fixture.js';

const NOW = timestamp(1_800_000_000_000);

/** A clock that steps 5 ms per reading, so `startedAt < finishedAt` is observable. */
function steppingClock(start = 1_800_000_000_000): () => ReturnType<typeof timestamp> {
  let value = start;
  return () => {
    const reading = value;
    value += 5;
    return timestamp(reading);
  };
}

let handle: DatabaseHandle;
let db: GtoDatabase;

beforeEach(() => {
  handle = openTestDatabase();
  db = handle.db;
});

function analyse(sessionId: SessionId, prefix = 'run'): AnalysisSummary {
  const result = runSessionAnalysis(
    db,
    { sessionId },
    { ids: sequentialIdFactory(prefix), now: steppingClock() },
  );
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.summary;
}

function fixture(label: string, nicknames: readonly string[], prefix: string): SessionFixture {
  return startFixtureSession(db, {
    label,
    nicknames,
    ids: sequentialIdFactory(prefix),
    now: NOW,
  });
}

describe('runSessionAnalysis — idempotency (prompt §38)', () => {
  it('creates v1 snapshots for every player, then reports NO_CHANGES on a second click', () => {
    const session = fixture('S1', ['모카', '감자', '체리'], 'a');
    persistFixtureHands(db, session, 6, { idPrefix: 'a', now: NOW });

    const first = analyse(session.sessionId, 'r1');
    expect(first.status).toBe('SUCCESS');
    expect(first.sessionHandCount).toBe(6);
    expect(first.playerCount).toBe(3);
    expect(first.players.every((player) => player.outcome === 'SNAPSHOT_CREATED')).toBe(true);
    expect(first.players.every((player) => player.modelVersion === 1)).toBe(true);
    // A first snapshot has no previous count to be "added" to, so the delta is unknown
    // rather than equal to the whole history.
    expect(first.players.every((player) => player.addedSinceLastSnapshot === null)).toBe(true);
    expect(first.algorithmVersion).toBe(ANALYSIS_ALGORITHM_VERSION);
    expect(first.runId).not.toBeNull();
    expect(first.finishedAt).toBeGreaterThan(first.startedAt);
    expect(first.durationMs).toBe(first.finishedAt - first.startedAt);
    // Nicknames come back so the summary can be read by a human.
    expect(first.players.map((player) => player.nickname).sort()).toEqual(['감자', '모카', '체리']);

    const handCounts = new Map(first.players.map((p) => [p.playerId, p.totalHands]));
    const versions = new Map<string, unknown>();
    for (const player of first.players) {
      const model = getLatestSnapshot(db, asId<'Player'>(player.playerId));
      if (!model.ok || model.value === null) throw new Error('no snapshot');
      versions.set(player.playerId, JSON.stringify(model.value));
    }

    const second = analyse(session.sessionId, 'r2');
    expect(second.status).toBe('SUCCESS');
    expect(second.players.every((player) => player.outcome === 'NO_CHANGES')).toBe(true);
    // The counts did NOT double: each player still reports the same total history.
    for (const player of second.players) {
      expect(player.totalHands).toBe(handCounts.get(player.playerId));
      expect(player.addedSinceLastSnapshot).toBe(0);
      expect(player.modelVersion).toBe(1);
    }
    // And no second snapshot exists anywhere.
    for (const player of second.players) {
      const list = listSnapshotVersions(db, asId<'Player'>(player.playerId));
      if (!list.ok) throw new Error(list.error.message);
      expect(list.value.map((header) => header.modelVersion)).toEqual([1]);
      const model = getLatestSnapshot(db, asId<'Player'>(player.playerId));
      if (!model.ok || model.value === null) throw new Error('no snapshot');
      expect(JSON.stringify(model.value)).toBe(versions.get(player.playerId));
    }
    // The RUN is still recorded — a run in which nothing changed is auditable too.
    const runs = listAnalysisRunsForSession(db, session.sessionId);
    if (!runs.ok) throw new Error(runs.error.message);
    expect(runs.value).toHaveLength(2);
    expect(runs.value.map((report) => report.run.status)).toEqual(['SUCCESS', 'SUCCESS']);
  });

  it('creates v2 with the FULL history count after more hands arrive — never a doubled one', () => {
    const session = fixture('S2', ['모카', '감자', '체리'], 'b');
    persistFixtureHands(db, session, 5, { idPrefix: 'b', now: NOW });
    const first = analyse(session.sessionId, 'r1');
    expect(first.players.every((player) => player.totalHands === 5)).toBe(true);

    persistFixtureHands(db, session, 4, { idPrefix: 'b2', now: NOW });
    const second = analyse(session.sessionId, 'r2');

    expect(second.status).toBe('SUCCESS');
    for (const player of second.players) {
      expect(player.outcome).toBe('SNAPSHOT_CREATED');
      expect(player.modelVersion).toBe(2);
      // 9, not 14 (5 + 9) and not 10 (5 + 5): the snapshot is a RECOMPUTATION over the whole
      // eligible set, never `previous + delta`.
      expect(player.totalHands).toBe(9);
      expect(player.addedSinceLastSnapshot).toBe(4);
    }

    for (const player of second.players) {
      const snapshot = getLatestSnapshot(db, asId<'Player'>(player.playerId));
      if (!snapshot.ok || snapshot.value === null) throw new Error('no snapshot');
      expect(snapshot.value.sourceHandCount).toBe(9);
      expect(snapshot.value.modelVersion).toBe(2);
      const list = listSnapshotVersions(db, asId<'Player'>(player.playerId));
      if (!list.ok) throw new Error(list.error.message);
      // v1 was NOT overwritten.
      expect(list.value.map((header) => header.modelVersion)).toEqual([1, 2]);
      expect(list.value[0]?.sourceHandCount).toBe(5);
    }
  });

  it('re-analysing after new hands leaves an UNAFFECTED player on NO_CHANGES', () => {
    // Session A seats 모카 + 감자; session B seats 모카 + 참외. New hands in B must move 모카
    // and 참외 and must not touch 감자 — who is not even in B's scope.
    const sessionA = fixture('A', ['모카', '감자', '체리'], 'p');
    persistFixtureHands(db, sessionA, 4, { idPrefix: 'A', now: NOW });
    analyse(sessionA.sessionId, 'r1');

    const sessionB = fixture('B', ['모카', '참외', '수박'], 'q');
    persistFixtureHands(db, sessionB, 3, { idPrefix: 'B', now: NOW });
    const summary = analyse(sessionB.sessionId, 'r2');

    expect(summary.playerCount).toBe(3);
    expect(summary.players.map((player) => player.nickname).sort()).toEqual([
      '모카',
      '수박',
      '참외',
    ]);
    const mocha = summary.players.find((player) => player.nickname === '모카');
    // 모카 played 4 hands in A and 3 in B: the snapshot is over 7, from BOTH sessions.
    expect(mocha?.outcome).toBe('SNAPSHOT_CREATED');
    expect(mocha?.totalHands).toBe(7);
    expect(mocha?.addedSinceLastSnapshot).toBe(3);
    expect(mocha?.modelVersion).toBe(2);
    // 참외 has never been analysed before: a first snapshot over B's hands alone.
    const chamoe = summary.players.find((player) => player.nickname === '참외');
    expect(chamoe?.modelVersion).toBe(1);
    expect(chamoe?.totalHands).toBe(3);

    // 감자 was never in B's scope and keeps exactly the model A gave them.
    const potato = getPlayerModel(db, { playerId: playerIdOf(db, sessionA, '감자') });
    if (!potato.ok) throw new Error(potato.message);
    expect(potato.value.versions.map((header) => header.modelVersion)).toEqual([1]);
    expect(potato.value.snapshot?.sourceHandCount).toBe(4);
  });
});

/**
 * The player id behind a nickname, read back out of the session's own stored seats. A pure
 * read: it must not itself run an analysis, or the test would be measuring its own probe.
 */
function playerIdOf(database: GtoDatabase, session: SessionFixture, nickname: string): string {
  const stored = getSession(database, session.sessionId);
  if (!stored.ok || stored.value === null) throw new Error('no session');
  for (const seat of SEAT_INDEXES) {
    const playerId = stored.value.table.seats[seat].playerId;
    if (playerId === null) continue;
    const player = findPlayerById(database, playerId);
    if (player.ok && player.value !== null && player.value.nickname === nickname) return playerId;
  }
  throw new Error(`no player ${nickname} in this session`);
}

describe('runSessionAnalysis — multi-session accumulation (prompt §25)', () => {
  it('builds one snapshot from BOTH sessions when the same nickname plays twice', () => {
    const sessionA = fixture('A', ['모카', '감자', '체리'], 'p');
    persistFixtureHands(db, sessionA, 5, { idPrefix: 'A', now: NOW });
    const sessionB = fixture('B', ['모카', '감자', '체리'], 'q');
    persistFixtureHands(db, sessionB, 8, { idPrefix: 'B', now: NOW });

    // The button is pressed on session B only.
    const summary = analyse(sessionB.sessionId, 'r1');
    expect(summary.sessionHandCount).toBe(8);
    for (const player of summary.players) {
      // 13, not 8: the session scope only DISCOVERED the players (ADR-0062b).
      expect(player.totalHands).toBe(13);
      const handIds = listCompletedHandIdsForPlayer(db, asId<'Player'>(player.playerId));
      if (!handIds.ok) throw new Error(handIds.error.message);
      expect(handIds.value).toHaveLength(13);
      const snapshot = getLatestSnapshot(db, asId<'Player'>(player.playerId));
      if (!snapshot.ok || snapshot.value === null) throw new Error('no snapshot');
      expect(snapshot.value.sourceHandCount).toBe(13);
    }

    // And pressing it on session A now says NO_CHANGES: the model already contains A.
    const again = analyse(sessionA.sessionId, 'r2');
    expect(again.players.every((player) => player.outcome === 'NO_CHANGES')).toBe(true);
  });

  it('analyses a CLOSED session — this is post-session analysis', () => {
    const session = fixture('closed', ['모카', '감자', '체리'], 'c');
    persistFixtureHands(db, session, 3, { idPrefix: 'c', now: NOW });
    const closed = closeSession(db, session.sessionId, NOW);
    if (!closed.ok) throw new Error(closed.error.message);

    const summary = analyse(session.sessionId, 'r1');
    expect(summary.status).toBe('SUCCESS');
    expect(summary.players.every((player) => player.outcome === 'SNAPSHOT_CREATED')).toBe(true);
  });
});

describe('runSessionAnalysis — empty and invalid scopes', () => {
  it('records NOTHING for a session with no completed hands', () => {
    const session = fixture('empty', ['모카', '감자', '체리'], 'e');

    const summary = analyse(session.sessionId, 'r1');
    expect(summary.status).toBe('NO_ELIGIBLE_HANDS');
    expect(summary.runId).toBeNull();
    expect(summary.playerCount).toBe(0);
    expect(summary.players).toEqual([]);
    expect(summary.sessionHandCount).toBe(0);

    const runs = listAnalysisRunsForSession(db, session.sessionId);
    if (!runs.ok) throw new Error(runs.error.message);
    // No run row: a run over an empty input set has no input identity to be audited against.
    expect(runs.value).toEqual([]);
  });

  it('REFUSES an unknown session and a malformed request', () => {
    const unknown = runSessionAnalysis(
      db,
      { sessionId: 'session-that-never-was' },
      { ids: sequentialIdFactory('x'), now: steppingClock() },
    );
    expect(unknown.ok).toBe(false);
    if (unknown.ok) throw new Error('unreachable');
    expect(unknown.code).toBe('NOT_FOUND');

    for (const input of [null, 'nope', {}, { sessionId: '' }, { sessionId: 7 }]) {
      const result = runSessionAnalysis(db, input, {
        ids: sequentialIdFactory('x'),
        now: steppingClock(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.code).toBe('INVALID_INPUT');
    }
  });
});

describe('runSessionAnalysis — determinism', () => {
  it('produces IDENTICAL snapshot content from identical input, on two databases', () => {
    const first = fixture('D1', ['모카', '감자', '체리'], 'd');
    persistFixtureHands(db, first, 5, { idPrefix: 'd', now: NOW });
    const firstSummary = analyse(first.sessionId, 'r1');

    const otherHandle = openTestDatabase();
    const otherDb = otherHandle.db;
    const second = startFixtureSession(otherDb, {
      label: 'D1',
      nicknames: ['모카', '감자', '체리'],
      ids: sequentialIdFactory('d'),
      now: NOW,
    });
    persistFixtureHands(otherDb, second, 5, { idPrefix: 'd', now: NOW });
    const secondSummary = runSessionAnalysis(
      otherDb,
      { sessionId: second.sessionId },
      { ids: sequentialIdFactory('r1'), now: steppingClock() },
    );
    if (!secondSummary.ok) throw new Error(secondSummary.message);

    // Content only: run ids, snapshot ids, `createdAt` and `modelVersion` are supplied by the
    // caller and the repository, and are deliberately NOT part of what determinism means.
    const contentOf = (database: GtoDatabase, playerId: string): string => {
      const snapshot = getLatestSnapshot(database, asId<'Player'>(playerId));
      if (!snapshot.ok || snapshot.value === null) throw new Error('no snapshot');
      const { modelVersion: _version, createdAt: _created, ...content } = snapshot.value;
      return JSON.stringify(content);
    };
    for (let index = 0; index < firstSummary.players.length; index += 1) {
      const left = firstSummary.players[index];
      const right = secondSummary.summary.players[index];
      if (left === undefined || right === undefined) throw new Error('player count differs');
      expect(left.nickname).toBe(right.nickname);
      expect(contentOf(db, left.playerId)).toBe(contentOf(otherDb, right.playerId));
    }
    otherHandle.close();
  });
});

describe('runSessionAnalysis — failure semantics (prompt §33)', () => {
  /**
   * Simulate a database corrupted BY OTHER MEANS: the insert-only triggers are dropped, one
   * stored event row is mangled, and they are put back exactly as `sqlite_master` held them.
   * Nothing in `src/` may do this; it is the only way to reach the read-time failure paths
   * that exist precisely for a file damaged outside this application.
   */
  function corruptOneEvent(handId: string): void {
    const triggers = handle.sqlite
      .prepare(`select name, sql from sqlite_master where type = 'trigger'`)
      .all() as readonly { readonly name: string; readonly sql: string }[];
    for (const trigger of triggers) handle.sqlite.exec(`drop trigger "${trigger.name}"`);
    try {
      handle.sqlite
        .prepare(
          `update hand_events set payload_json = ?
             where hand_id = ?
               and seq = (select min(seq) from hand_events where hand_id = ?)`,
        )
        .run('{"kind":"NOT_AN_EVENT"}', handId, handId);
    } finally {
      for (const trigger of triggers) handle.sqlite.exec(trigger.sql);
    }
  }

  it('reports PARTIAL, keeps the healthy players’ snapshots, and never touches raw history', () => {
    // 모카 and 감자 also played session A; 참외 played only session B. Corrupting one of
    // session A's hands therefore breaks exactly two of session B's three players.
    const sessionA = fixture('A', ['모카', '감자', '체리'], 'p');
    const storedA = persistFixtureHands(db, sessionA, 3, { idPrefix: 'A', now: NOW });
    const sessionB = fixture('B', ['모카', '감자', '참외'], 'q');
    persistFixtureHands(db, sessionB, 3, { idPrefix: 'B', now: NOW });

    const handsBefore = listCompletedHandsForSession(db, sessionA.sessionId);
    if (!handsBefore.ok) throw new Error(handsBefore.error.message);
    corruptOneEvent(storedA[0] as string);

    const summary = analyse(sessionB.sessionId, 'r1');
    expect(summary.status).toBe('PARTIAL');
    expect(summary.playerCount).toBe(3);

    const failed = summary.players.filter((player) => player.outcome === 'FAILED');
    const created = summary.players.filter((player) => player.outcome === 'SNAPSHOT_CREATED');
    expect(failed.map((player) => player.nickname).sort()).toEqual(['감자', '모카']);
    expect(created.map((player) => player.nickname)).toEqual(['참외']);
    for (const player of failed) {
      expect(player.errorCode).not.toBeNull();
      expect((player.errorMessage ?? '').length).toBeGreaterThan(0);
      expect(player.modelVersion).toBeNull();
    }
    // The healthy player really has a snapshot.
    const healthy = getLatestSnapshot(db, asId<'Player'>(created[0]?.playerId as string));
    if (!healthy.ok || healthy.value === null) throw new Error('the healthy player lost its model');
    expect(healthy.value.sourceHandCount).toBe(3);
    // The failing players have none at all.
    for (const player of failed) {
      const list = listSnapshotVersions(db, asId<'Player'>(player.playerId));
      if (!list.ok) throw new Error(list.error.message);
      expect(list.value).toEqual([]);
    }

    // The run is recorded as PARTIAL with an outcome for EVERY player, and the failure
    // metadata is stored verbatim.
    const run = getAnalysisRun(db, asId<'AnalysisRun'>(summary.runId as string));
    if (!run.ok || run.value === null) throw new Error('the run was not recorded');
    expect(run.value.run.status).toBe('PARTIAL');
    expect(run.value.players).toHaveLength(3);
    const storedFailures = run.value.players.filter((row) => row.outcome === 'FAILED');
    expect(storedFailures).toHaveLength(2);
    for (const row of storedFailures) {
      expect(JSON.parse(row.errorJson as string)).toHaveProperty('code');
    }

    // RAW HISTORY IS UNTOUCHED: analysis deletes nothing and rewrites nothing (prompt §33).
    const handsAfter = listCompletedHandsForSession(db, sessionA.sessionId);
    if (!handsAfter.ok) throw new Error(handsAfter.error.message);
    expect(handsAfter.value).toEqual(handsBefore.value);
    const events = loadHandEvents(db, asId<'Hand'>(storedA[1] as string));
    expect(events.ok).toBe(true);
  });

  it('reports FAILED when EVERY player fails, and writes no snapshot at all', () => {
    const session = fixture('S', ['모카', '감자', '체리'], 'f');
    const stored = persistFixtureHands(db, session, 3, { idPrefix: 'f', now: NOW });
    corruptOneEvent(stored[0] as string);

    const summary = analyse(session.sessionId, 'r1');
    expect(summary.status).toBe('FAILED');
    expect(summary.players.every((player) => player.outcome === 'FAILED')).toBe(true);

    const run = getAnalysisRun(db, asId<'AnalysisRun'>(summary.runId as string));
    if (!run.ok || run.value === null) throw new Error('the run was not recorded');
    expect(run.value.run.status).toBe('FAILED');
    expect(run.value.run.errorJson).not.toBeNull();
    for (const player of summary.players) {
      const list = listSnapshotVersions(db, asId<'Player'>(player.playerId));
      expect(list.ok && list.value).toEqual([]);
    }
  });
});

describe('getPlayerModel — the read surface WP C1-D renders', () => {
  it('returns the latest FULL snapshot plus every version header', () => {
    const session = fixture('S', ['모카', '감자', '체리'], 'g');
    persistFixtureHands(db, session, 4, { idPrefix: 'g', now: NOW });
    const first = analyse(session.sessionId, 'r1');
    persistFixtureHands(db, session, 2, { idPrefix: 'g2', now: NOW });
    analyse(session.sessionId, 'r2');

    const playerId = first.players[0]?.playerId as string;
    const view = getPlayerModel(db, { playerId });
    if (!view.ok) throw new Error(view.message);
    expect(view.value.playerId).toBe(playerId);
    expect(view.value.nickname).toBe(first.players[0]?.nickname);
    expect(view.value.versions.map((header) => header.modelVersion)).toEqual([1, 2]);
    expect(view.value.snapshot?.modelVersion).toBe(2);
    expect(view.value.snapshot?.sourceHandCount).toBe(6);
    // The content document really is loaded, not just its header.
    expect((view.value.snapshot?.globalStats.length ?? 0) > 0).toBe(true);
    expect(view.value.snapshot?.analysisAlgorithmVersion).toBe(ANALYSIS_ALGORITHM_VERSION);
  });

  it('reports an un-analysed player as a STATE, and an unknown player as an ERROR', () => {
    const session = fixture('S', ['모카', '감자', '체리'], 'h');
    persistFixtureHands(db, session, 2, { idPrefix: 'h', now: NOW });
    const summary = analyse(session.sessionId, 'r1');
    const knownPlayer = summary.players[0]?.playerId as PlayerId;

    // Re-open on a second database so the same player id exists with no snapshot.
    const other = openTestDatabase();
    const otherSession = startFixtureSession(other.db, {
      label: 'S',
      nicknames: ['모카', '감자', '체리'],
      ids: sequentialIdFactory('h'),
      now: NOW,
    });
    persistFixtureHands(other.db, otherSession, 1, { idPrefix: 'h', now: NOW });
    const fresh = getPlayerModel(other.db, { playerId: knownPlayer });
    if (!fresh.ok) throw new Error(fresh.message);
    expect(fresh.value.snapshot).toBeNull();
    expect(fresh.value.versions).toEqual([]);
    other.close();

    const missing = getPlayerModel(db, { playerId: 'nobody' });
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error('unreachable');
    expect(missing.code).toBe('NOT_FOUND');

    const malformed = getPlayerModel(db, { playerId: 42 });
    expect(malformed.ok).toBe(false);
    if (malformed.ok) throw new Error('unreachable');
    expect(malformed.code).toBe('INVALID_INPUT');
  });
});
