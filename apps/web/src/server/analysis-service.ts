/**
 * "세션 분석 및 반영" — the post-session analysis run, as one function over a database
 * handle (ADR-0062).
 *
 * Kept separate from `actions/analysis.ts` for the same reason `session-service.ts` and
 * `hand-history-service.ts` are: so it can be exercised against a real in-memory database,
 * and so the ids and the clock are INJECTED (ADR-0007, ADR-0040) rather than reached for.
 * The `'use server'` wrapper adds nothing but the real handle, the real clock and
 * `cryptoIdFactory`.
 *
 * ## The shape of a run
 *
 * ```
 * session scope ──> which PLAYERS were dealt in here          (discovery only)
 *        └─ per player ─> that player's COMPLETE eligible history, all sessions
 *                          └─ inputIdentityHash + ANALYSIS_ALGORITHM_VERSION
 *                              ├─ equal to their latest snapshot ─> NO_CHANGES (no compute)
 *                              └─ otherwise ─> computePlayerModel ─> a new snapshot
 *        └─ ONE insertAnalysisResults call, all-or-nothing
 * ```
 *
 * The session scope only DISCOVERS who is affected. Each affected player's snapshot is a
 * full recomputation from every completed hand they were ever dealt into (ADR-0062b,
 * prompt §25), which is what makes multi-session accumulation fall out for free and what
 * makes a repeated click converge instead of doubling (prompt §14, §38).
 *
 * ## Why the FULL hand set every time
 *
 * `inputIdentityHash` is taken over the ids that were actually passed to
 * `computePlayerModel`. If a run ever passed a narrower set — this session's hands only,
 * say — the hash would differ from the previous run's for reasons that have nothing to do
 * with new history, and the `NO_CHANGES` gate would break in the worst possible direction:
 * a new snapshot on every click, each computed from less history than the last. The set is
 * `listCompletedHandIdsForPlayer`, unfiltered, in the order that repository defines.
 *
 * ## Raw history
 *
 * Never written, never read for anything but input, never deleted — including when the run
 * fails (prompt §33). This module has no write path other than `insertAnalysisResults`.
 *
 * ## Not a hot path
 *
 * The user pressed a button and is waiting for a summary. Nothing about a live hand is on
 * this path, and the run is synchronous work over a synchronous database (ADR-0043 is about
 * the ACTION path, which this is not).
 */
import { asId } from '@gto-self/shared';
import type { IdFactory, PlayerId } from '@gto-self/shared';
import type { PlayerModelContent } from '@gto-self/player-core';
import type { Timestamp } from '@gto-self/player-core';
import {
  ANALYSIS_ALGORITHM_VERSION,
  computePlayerModel,
  inputIdentityHash,
} from '@gto-self/analysis-core';
import {
  findPlayerById,
  getLatestSnapshot,
  getSession,
  insertAnalysisResults,
  getLatestSnapshotIdentity,
  listCompletedHandIdsForPlayer,
  listCompletedHandsForSession,
  listPlayerIdsWithCompletedHandsInSession,
  listSnapshotVersions,
  loadCompletedHands,
  type AnalysisPlayerInput,
  type AnalysisRunStatus,
  type GtoDatabase,
} from '@gto-self/db';
import type { ModelSnapshotId } from '@gto-self/db';
import {
  playerModelQuerySchema,
  runSessionAnalysisSchema,
  type AnalysisPlayerSummary,
  type AnalysisSummary,
  type GetPlayerModelResult,
  type RunSessionAnalysisResult,
} from './analysis-contract.js';

export interface RunSessionAnalysisDeps {
  readonly ids: IdFactory;
  /**
   * The clock, as a FUNCTION rather than a fixed reading — unlike every other service in
   * this directory. A run has a DURATION that prompt §35 asks to be measured, so
   * `startedAt` and `finishedAt` must be two separate readings taken around the work. A
   * test injects a stepping counter and gets a deterministic pair.
   */
  readonly now: () => Timestamp;
}

const fail = (code: string, message: string): RunSessionAnalysisResult => ({
  ok: false,
  code,
  message,
});

/** Internal. Failure metadata, stored verbatim and echoed to the UI unchanged. */
interface PlayerFailure {
  readonly code: string;
  readonly message: string;
}

/** Internal. What one player's pre-write analysis concluded. */
type PlayerPlan =
  | {
      readonly kind: 'SNAPSHOT';
      readonly playerId: PlayerId;
      readonly content: PlayerModelContent;
      /** The previous snapshot's `sourceHandCount`, or `null` when this is the first. */
      readonly previousHandCount: number | null;
    }
  | {
      readonly kind: 'NO_CHANGES';
      readonly playerId: PlayerId;
      readonly modelVersion: number;
      readonly handCount: number;
    }
  | { readonly kind: 'FAILED'; readonly playerId: PlayerId; readonly error: PlayerFailure };

/**
 * Internal. Analyse ONE player, end to end, without writing anything.
 *
 * Total: every failure this can meet — an unreadable hand list, a hand that will not load, a
 * document the engine refuses to produce — comes back as `FAILED` for this player alone, so
 * one bad player degrades the run to `PARTIAL` rather than losing the other five
 * (prompt §33).
 */
function planPlayer(db: GtoDatabase, playerId: PlayerId): PlayerPlan {
  const failed = (error: PlayerFailure): PlayerPlan => ({ kind: 'FAILED', playerId, error });

  // The player's COMPLETE eligible set. See the module docblock: narrowing this breaks the
  // NO_CHANGES gate, it does not merely make it conservative.
  const handIds = listCompletedHandIdsForPlayer(db, playerId);
  if (!handIds.ok) return failed({ code: handIds.error.code, message: handIds.error.message });

  const hash = inputIdentityHash(handIds.value);
  const identity = getLatestSnapshotIdentity(db, playerId);
  if (!identity.ok) return failed({ code: identity.error.code, message: identity.error.message });

  // BOTH halves of the identity, per ADR-0062c: an equal hash under a NEW algorithm version
  // is a different answer to the same question, and an equal version over a new hand set is
  // the same answer to a different one. Either difference must produce a snapshot.
  if (
    identity.value !== null &&
    identity.value.algorithmVersion === ANALYSIS_ALGORITHM_VERSION &&
    identity.value.inputHash === hash
  ) {
    return {
      kind: 'NO_CHANGES',
      playerId,
      modelVersion: identity.value.modelVersion,
      handCount: handIds.value.length,
    };
  }

  const hands = loadCompletedHands(db, handIds.value);
  if (!hands.ok) return failed({ code: hands.error.code, message: hands.error.message });

  // `computePlayerModel` returns a typed result, but `analysis-core` also carries two
  // `invariant`-style throws for an `ActionRecord` that could only come from an engine bug
  // (WP C1-A §10.6). Catching here is what keeps that a PARTIAL run instead of a 500.
  let computed;
  try {
    computed = computePlayerModel(playerId, hands.value);
  } catch (error) {
    return failed({
      code: 'ANALYSIS_THREW',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (!computed.ok) {
    return failed({ code: computed.error.code, message: computed.error.message });
  }

  // Headers only — the version list is cheap, the content documents are not. This is where
  // "이번 추가" comes from: the hand count the PREVIOUS snapshot was built on.
  const versions = listSnapshotVersions(db, playerId);
  if (!versions.ok) return failed({ code: versions.error.code, message: versions.error.message });
  const previous = versions.value.at(-1);

  return {
    kind: 'SNAPSHOT',
    playerId,
    content: computed.value,
    previousHandCount: previous === undefined ? null : previous.sourceHandCount,
  };
}

/** Internal. The nickname for a summary line; a failed read is `null`, never a throw. */
function nicknameOf(db: GtoDatabase, playerId: PlayerId): string | null {
  const found = findPlayerById(db, playerId);
  if (!found.ok || found.value === null) return null;
  return found.value.nickname;
}

/**
 * Discover, recompute and persist one session's analysis run.
 *
 * `input` is untrusted: it arrives over the network at a server action.
 *
 * ### Zero eligible players
 *
 * If the session has no completed hand linked to any player, NOTHING is written and the
 * result carries `status: 'NO_ELIGIBLE_HANDS'` with `runId: null`. A run row exists to make
 * an analysis auditable — scope, input identity, counts, outcomes — and a run over an empty
 * input set has no input identity to record: it would be a row asserting that an analysis
 * happened, with nothing that could ever be checked against it. The user is told plainly
 * instead.
 *
 * ### A CLOSED session is accepted
 *
 * This is POST-session analysis; refusing the very state the feature exists for would be
 * absurd. Nothing about the session row is rewritten either way.
 *
 * ### The write is one call
 *
 * `insertAnalysisResults` is all-or-nothing (WP C1-C §7.2): the run header, every per-player
 * outcome and every snapshot land together or not at all. A failure of that call is reported
 * to the user as a typed error and NOTHING is persisted — deliberately, including no
 * "FAILED run" row: recording that failure would mean succeeding at the write that just
 * failed, and a second attempt over the same broken storage would only add a second way for
 * this function to lie.
 */
export function runSessionAnalysis(
  db: GtoDatabase,
  input: unknown,
  deps: RunSessionAnalysisDeps,
): RunSessionAnalysisResult {
  const shape = runSessionAnalysisSchema.safeParse(input);
  if (!shape.success) {
    const detail = shape.error.issues
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
      .join('; ');
    return fail('INVALID_INPUT', `analysis request is malformed: ${detail}`);
  }
  const sessionId = asId<'Session'>(shape.data.sessionId);

  const session = getSession(db, sessionId);
  if (!session.ok) return fail(session.error.code, session.error.message);
  if (session.value === null) {
    return fail('NOT_FOUND', `session ${shape.data.sessionId} does not exist`);
  }

  const startedAt = deps.now();

  const sessionHands = listCompletedHandsForSession(db, sessionId);
  if (!sessionHands.ok) return fail(sessionHands.error.code, sessionHands.error.message);
  const sessionHandCount = sessionHands.value.length;

  const playerIds = listPlayerIdsWithCompletedHandsInSession(db, sessionId);
  if (!playerIds.ok) return fail(playerIds.error.code, playerIds.error.message);

  if (playerIds.value.length === 0) {
    const finishedAt = deps.now();
    return {
      ok: true,
      summary: {
        runId: null,
        sessionId: shape.data.sessionId,
        status: 'NO_ELIGIBLE_HANDS',
        algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        sessionHandCount,
        playerCount: 0,
        observationCount: 0,
        showCount: 0,
        players: [],
      },
    };
  }

  const plans = playerIds.value.map((playerId) => planPlayer(db, playerId));

  // Ids for the snapshots that will be written. Supplied by this layer, never by `db`
  // (ADR-0040), and taken from the injected factory so a test can pin them.
  const snapshotIds = new Map<PlayerId, ModelSnapshotId>();
  const writes: AnalysisPlayerInput[] = [];
  let observationCount = 0;
  let showCount = 0;
  const finishedAt = deps.now();

  for (const plan of plans) {
    if (plan.kind === 'SNAPSHOT') {
      const snapshotId = asId<'ModelSnapshot'>(deps.ids.next());
      snapshotIds.set(plan.playerId, snapshotId);
      observationCount += plan.content.sourceObservationCount;
      showCount += plan.content.sourceShowCount;
      writes.push({
        outcome: 'SNAPSHOT_CREATED',
        playerId: plan.playerId,
        snapshotId,
        content: plan.content,
        createdAt: finishedAt,
      });
    } else if (plan.kind === 'NO_CHANGES') {
      writes.push({ outcome: 'NO_CHANGES', playerId: plan.playerId });
    } else {
      writes.push({
        outcome: 'FAILED',
        playerId: plan.playerId,
        errorJson: JSON.stringify(plan.error),
      });
    }
  }

  const failedCount = plans.filter((plan) => plan.kind === 'FAILED').length;
  // SUCCESS means every player was accounted for without a failure — a run in which nothing
  // changed is a successful run, not an empty one. PARTIAL and FAILED both mean somebody's
  // model is now older than the history that exists, which the UI must show.
  const status: AnalysisRunStatus =
    failedCount === 0 ? 'SUCCESS' : failedCount === plans.length ? 'FAILED' : 'PARTIAL';

  const runId = asId<'AnalysisRun'>(deps.ids.next());
  const written = insertAnalysisResults(db, {
    runId,
    sessionId,
    startedAt,
    finishedAt,
    algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
    status,
    handCount: sessionHandCount,
    observationCount,
    showCount,
    errorJson:
      status === 'FAILED'
        ? JSON.stringify({ code: 'ALL_PLAYERS_FAILED', playerCount: plans.length })
        : null,
    players: writes,
  });
  if (!written.ok) return fail(written.error.code, written.error.message);

  // `modelVersion` is the repository's answer, not ours (WP C1-C §7.3).
  const assigned = new Map<string, number>();
  for (const result of written.value.players) {
    if (result.modelVersion !== undefined) assigned.set(result.playerId, result.modelVersion);
  }

  const players: AnalysisPlayerSummary[] = plans.map((plan) => {
    const base = {
      playerId: plan.playerId,
      nickname: nicknameOf(db, plan.playerId),
    };
    if (plan.kind === 'SNAPSHOT') {
      return {
        ...base,
        outcome: 'SNAPSHOT_CREATED' as const,
        modelVersion: assigned.get(plan.playerId) ?? null,
        totalHands: plan.content.sourceHandCount,
        addedSinceLastSnapshot:
          plan.previousHandCount === null
            ? null
            : plan.content.sourceHandCount - plan.previousHandCount,
        spotGroupCount: plan.content.spotStats.length,
        showCount: plan.content.sourceShowCount,
        errorCode: null,
        errorMessage: null,
      };
    }
    if (plan.kind === 'NO_CHANGES') {
      return {
        ...base,
        outcome: 'NO_CHANGES' as const,
        modelVersion: plan.modelVersion,
        totalHands: plan.handCount,
        addedSinceLastSnapshot: 0,
        // Not recomputed, so not claimed. The profile view has these numbers; this summary
        // is a report of what THIS run did.
        spotGroupCount: null,
        showCount: null,
        errorCode: null,
        errorMessage: null,
      };
    }
    return {
      ...base,
      outcome: 'FAILED' as const,
      modelVersion: null,
      totalHands: null,
      addedSinceLastSnapshot: null,
      spotGroupCount: null,
      showCount: null,
      errorCode: plan.error.code,
      errorMessage: plan.error.message,
    };
  });

  const summary: AnalysisSummary = {
    runId,
    sessionId: shape.data.sessionId,
    status,
    algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    sessionHandCount,
    playerCount: plans.length,
    observationCount,
    showCount,
    players,
  };
  return { ok: true, summary };
}

/**
 * The player-profile read: the latest snapshot's FULL content plus the version list.
 *
 * The two reads are deliberately separate calls into `@gto-self/db`: `listSnapshotVersions`
 * returns headers only, so a profile that shows `v1 / v2 / v3` does not load three content
 * documents to draw three labels (WP C1-C §7.9).
 *
 * A player who has never been analysed is `{ snapshot: null, versions: [] }` — a state, not
 * an error. An unknown player id IS an error: it means the caller asked about somebody who
 * does not exist, which the UI must not render as "no data yet".
 *
 * `input` is untrusted: it arrives over the network at a server action.
 */
export function getPlayerModel(db: GtoDatabase, input: unknown): GetPlayerModelResult {
  const shape = playerModelQuerySchema.safeParse(input);
  if (!shape.success) {
    return { ok: false, code: 'INVALID_INPUT', message: 'player model request is malformed' };
  }
  const playerId = asId<'Player'>(shape.data.playerId);

  const player = findPlayerById(db, playerId);
  if (!player.ok) return { ok: false, code: player.error.code, message: player.error.message };
  if (player.value === null) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: `player ${shape.data.playerId} does not exist`,
    };
  }

  const snapshot = getLatestSnapshot(db, playerId);
  if (!snapshot.ok)
    return { ok: false, code: snapshot.error.code, message: snapshot.error.message };
  const versions = listSnapshotVersions(db, playerId);
  if (!versions.ok)
    return { ok: false, code: versions.error.code, message: versions.error.message };

  return {
    ok: true,
    value: {
      playerId: shape.data.playerId,
      nickname: player.value.nickname,
      snapshot: snapshot.value,
      versions: versions.value,
    },
  };
}
