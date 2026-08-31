/**
 * `analysis_runs`, `analysis_run_players`, `player_model_snapshots` and the snapshot's four
 * child tables — the DERIVED player-learning layer (ADR-0062).
 *
 * Three properties this module exists to guarantee:
 *
 * 1. **One transaction per run.** The run row, every per-player outcome, and every snapshot
 *    with all of its child rows are written together or not at all. A constraint violation
 *    on the last bet-size row of the last player leaves NO run, NO snapshot and NO
 *    half-written model — a partially written snapshot would be a plausible-looking lie
 *    about a player (`CLAUDE.md` rule 5).
 * 2. **Versions are assigned here, monotonically, inside that transaction.** The engine is
 *    clock-free and id-free (ADR-0040) and therefore cannot know a player's latest version;
 *    the repository reads `max(model_version)` for the player and writes `+ 1`. An earlier
 *    version is never overwritten — `UNIQUE(player_id, model_version)` plus the insert-only
 *    triggers make that structurally impossible, not merely unimplemented (prompt §24).
 * 3. **Raw history is never touched.** Nothing in this file writes `hands`, `hand_events`,
 *    `hand_players` or `player_observations`. Derived data is rebuildable; raw history is
 *    not, and it outranks it (prompt §33).
 *
 * This module reads no clock and generates no id: `runId`, every `snapshotId`, `startedAt`
 * and `createdAt` are caller-supplied (ADR-0040).
 */
import { asc, desc, eq, inArray, max } from 'drizzle-orm';
import { cardToString, ok, type Card, type PlayerId, type SessionId } from '@gto-self/shared';
import {
  spotKey,
  type PlayerModelContent,
  type PlayerModelSnapshot,
  type Timestamp,
} from '@gto-self/player-core';
import type { GtoDatabase } from '../client.js';
import { attempt, dbErr, type DbResult } from '../errors.js';
import {
  analysisRunPlayers,
  analysisRuns,
  playerModelBetSizes,
  playerModelShowEvidence,
  playerModelSnapshots,
  playerModelStats,
  playerSpotStats,
  type AnalysisRunId,
  type AnalysisRunStatus,
  type ModelSnapshotId,
} from '../schema.js';
import {
  collect,
  decodeAnalysisRunPlayerRow,
  decodeAnalysisRunRow,
  decodeModelSnapshot,
  decodeModelSnapshotHeader,
  type AnalysisRunReport,
  type ModelSnapshotHeader,
} from '../rows.js';

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the run did for ONE player. A discriminated union, so "created a snapshot" cannot be
 * claimed without a snapshot id and a content document, and a failure cannot be recorded
 * without its metadata. The database CHECKs the same invariant independently.
 */
export type AnalysisPlayerInput =
  | {
      readonly outcome: 'SNAPSHOT_CREATED';
      readonly playerId: PlayerId;
      /** Caller-supplied (ADR-0040). */
      readonly snapshotId: ModelSnapshotId;
      readonly content: PlayerModelContent;
      /** Caller-supplied (ADR-0040). */
      readonly createdAt: Timestamp;
    }
  | { readonly outcome: 'NO_CHANGES'; readonly playerId: PlayerId }
  | {
      readonly outcome: 'FAILED';
      readonly playerId: PlayerId;
      /** Verbatim failure metadata. Stored as given; this layer never re-interprets it. */
      readonly errorJson: string;
    };

export interface InsertAnalysisResultsInput {
  readonly runId: AnalysisRunId;
  /** The session whose completed hands defined the run's scope (ADR-0062b). */
  readonly sessionId: SessionId;
  readonly startedAt: Timestamp;
  readonly finishedAt: Timestamp;
  readonly algorithmVersion: number;
  readonly status: AnalysisRunStatus;
  /** Eligible completed hands the run read. */
  readonly handCount: number;
  readonly observationCount: number;
  readonly showCount: number;
  /** Run-level failure metadata, or omitted when the run did not fail overall. */
  readonly errorJson?: string | null;
  readonly players: readonly AnalysisPlayerInput[];
}

export interface AnalysisPlayerResult {
  readonly playerId: PlayerId;
  readonly outcome: AnalysisPlayerInput['outcome'];
  /** Present exactly when a snapshot was written. */
  readonly snapshotId?: ModelSnapshotId;
  /** The version the repository assigned. Present exactly when a snapshot was written. */
  readonly modelVersion?: number;
}

export interface InsertAnalysisResultsResult {
  readonly runId: AnalysisRunId;
  /** In the order the caller supplied its players. */
  readonly players: readonly AnalysisPlayerResult[];
}

/* -------------------------------------------------------------------------- */
/* Write                                                                       */
/* -------------------------------------------------------------------------- */

/** Internal. `"As Kd"` — the canonical text a user would read back. */
const cardsToText = (cards: readonly Card[]): string => cards.map(cardToString).join(' ');

/**
 * Internal. Insert in chunks so a large snapshot cannot exceed SQLite's bound-parameter
 * limit. The chunk size is per statement, not per row, and the whole loop is inside the
 * caller's transaction, so a failure in any chunk still rolls the entire run back.
 */
function insertAll<T extends Record<string, unknown>>(
  run: (values: readonly T[]) => void,
  rows: readonly T[],
  chunk: number,
): void {
  for (let index = 0; index < rows.length; index += chunk) {
    run(rows.slice(index, index + chunk));
  }
}

/**
 * Internal. The write-side projection check for a spot bucket: the stored `spot_key` must be
 * the one `player-core` derives from the dimensions stored beside it. Checked on the way IN
 * as well as on the way out, so a disagreement is refused rather than persisted.
 */
function checkedContent(input: AnalysisPlayerInput): DbResult<null> {
  if (input.outcome !== 'SNAPSHOT_CREATED') return ok(null);
  const { content } = input;
  if (content.playerId !== input.playerId) {
    return dbErr('INVALID_INPUT', 'the model content is for a different player', {
      table: 'player_model_snapshots',
      id: input.snapshotId,
      field: 'player_id',
      expected: input.playerId,
      actual: content.playerId,
    });
  }
  for (const spot of content.spotStats) {
    const derived = spotKey(spot.spot);
    if (derived !== spot.spotKey) {
      return dbErr('INVALID_INPUT', 'a spot bucket disagrees with its own descriptor', {
        table: 'player_spot_stats',
        id: input.snapshotId,
        field: 'spot_key',
        expected: derived,
        actual: spot.spotKey,
      });
    }
  }
  for (const evidence of content.showEvidence) {
    if (evidence.cards.length < 1 || evidence.cards.length > 2) {
      return dbErr('INVALID_INPUT', 'revealed cards must be 1 or 2 cards', {
        table: 'player_model_show_evidence',
        id: input.snapshotId,
        field: 'cards',
        actual: String(evidence.cards.length),
      });
    }
  }
  return ok(null);
}

/**
 * Persist one analysis run: the run header, every per-player outcome, and a new versioned
 * snapshot for each player the run recomputed — ALL IN ONE TRANSACTION.
 *
 * `player_count` is the number of per-player rows written; it is a projection of them rather
 * than a separately supplied number, so the header cannot claim a scope the rows contradict.
 *
 * ## Version assignment and concurrency
 *
 * The next version is read as `max(model_version) + 1` for the player INSIDE the
 * transaction. `better-sqlite3` is synchronous and a write transaction holds SQLite's write
 * lock, so two runs cannot interleave the read and the write on one connection; two
 * PROCESSES racing on the same file would have the second blocked by the lock and, in the
 * pathological case, refused by `UNIQUE(player_id, model_version)` — a typed
 * `CONSTRAINT_VIOLATION` with nothing written, never a silently overwritten `v1`. The
 * uniqueness constraint, not the `max()` read, is the guarantee.
 */
export function insertAnalysisResults(
  db: GtoDatabase,
  input: InsertAnalysisResultsInput,
): DbResult<InsertAnalysisResultsResult> {
  const seen = new Set<string>();
  for (const player of input.players) {
    if (seen.has(player.playerId)) {
      return dbErr('INVALID_INPUT', `player ${player.playerId} appears twice in one run`, {
        table: 'analysis_run_players',
        id: input.runId,
        field: 'player_id',
        actual: player.playerId,
      });
    }
    seen.add(player.playerId);
    const checked = checkedContent(player);
    if (!checked.ok) return checked;
  }

  return attempt({ table: 'analysis_runs', id: input.runId }, () =>
    db.transaction((tx) => {
      tx.insert(analysisRuns)
        .values({
          id: input.runId,
          sessionId: input.sessionId,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          algorithmVersion: input.algorithmVersion,
          status: input.status,
          handCount: input.handCount,
          playerCount: input.players.length,
          observationCount: input.observationCount,
          showCount: input.showCount,
          errorJson: input.errorJson ?? null,
        })
        .run();

      const results: AnalysisPlayerResult[] = [];
      for (const player of input.players) {
        if (player.outcome !== 'SNAPSHOT_CREATED') {
          tx.insert(analysisRunPlayers)
            .values({
              runId: input.runId,
              playerId: player.playerId,
              outcome: player.outcome,
              snapshotId: null,
              errorJson: player.outcome === 'FAILED' ? player.errorJson : null,
            })
            .run();
          results.push({ playerId: player.playerId, outcome: player.outcome });
          continue;
        }

        const { content, snapshotId } = player;
        const latest = tx
          .select({ version: max(playerModelSnapshots.modelVersion) })
          .from(playerModelSnapshots)
          .where(eq(playerModelSnapshots.playerId, player.playerId))
          .get();
        const modelVersion = (latest?.version ?? 0) + 1;

        tx.insert(playerModelSnapshots)
          .values({
            id: snapshotId,
            playerId: player.playerId,
            modelVersion,
            analysisRunId: input.runId,
            algorithmVersion: content.analysisAlgorithmVersion,
            inputHash: content.inputHash,
            sourceHandCount: content.sourceHandCount,
            sourceObservationCount: content.sourceObservationCount,
            sourceShowCount: content.sourceShowCount,
            createdAt: player.createdAt,
            confidenceK: content.confidence.k,
            confidenceLearningThreshold: content.confidence.learningThreshold,
            confidenceKnownThreshold: content.confidence.knownThreshold,
            confidenceOverallOpportunities: content.confidence.overall.opportunities,
          })
          .run();

        insertAll(
          (values) =>
            tx
              .insert(playerModelStats)
              .values([...values])
              .run(),
          content.globalStats.map((stat, ordinal) => ({
            snapshotId,
            ordinal,
            statKey: stat.key,
            position: stat.position,
            opportunities: stat.opportunities,
            actions: stat.actions,
            confidenceOpportunities: stat.confidence.opportunities,
          })),
          200,
        );

        insertAll(
          (values) =>
            tx
              .insert(playerSpotStats)
              .values([...values])
              .run(),
          content.spotStats.map((spot, ordinal) => ({
            snapshotId,
            ordinal,
            spotKey: spot.spotKey,
            phase: spot.spot.phase,
            family: spot.spot.family,
            position: spot.spot.position,
            opponentPosition: spot.spot.phase === 'PREFLOP' ? spot.spot.opponentPosition : null,
            lineup: spot.spot.lineup,
            street: spot.spot.phase === 'POSTFLOP' ? spot.spot.street : null,
            relation: spot.spot.phase === 'POSTFLOP' ? spot.spot.relation : null,
            potType: spot.spot.phase === 'POSTFLOP' ? spot.spot.potType : null,
            facingSize: spot.spot.phase === 'POSTFLOP' ? spot.spot.facingSize : null,
            opportunities: spot.opportunities,
            effectFold: spot.effects.FOLD,
            effectCheck: spot.effects.CHECK,
            effectCall: spot.effects.CALL,
            effectBet: spot.effects.BET,
            effectRaise: spot.effects.RAISE,
            verbFold: spot.verbs.FOLD,
            verbCheck: spot.verbs.CHECK,
            verbCall: spot.verbs.CALL,
            verbBet: spot.verbs.BET,
            verbRaise: spot.verbs.RAISE,
            verbAllIn: spot.verbs.ALL_IN,
            confidenceOpportunities: spot.confidence.opportunities,
          })),
          100,
        );

        insertAll(
          (values) =>
            tx
              .insert(playerModelBetSizes)
              .values([...values])
              .run(),
          content.betSizes.map((observation, ordinal) => ({
            snapshotId,
            ordinal,
            handId: observation.handId,
            playerId: observation.playerId,
            kind: observation.kind,
            spotKey: observation.spotKey,
            toAmount: observation.toAmount,
            amount: observation.amount,
            potBefore: observation.potBefore,
            currentBetBefore: observation.currentBetBefore,
            bigBlind: observation.bigBlind,
            bucket: observation.bucket,
          })),
          200,
        );

        insertAll(
          (values) =>
            tx
              .insert(playerModelShowEvidence)
              .values([...values])
              .run(),
          content.showEvidence.map((evidence, ordinal) => ({
            snapshotId,
            ordinal,
            handId: evidence.handId,
            playerId: evidence.playerId,
            position: evidence.position,
            cardsText: cardsToText(evidence.cards),
            boardText: cardsToText(evidence.board),
            lastStreet: evidence.lastStreet,
            spotKeysJson: JSON.stringify(evidence.spotKeys),
            outcome: evidence.outcome,
            wonGross: evidence.wonGross,
          })),
          200,
        );

        tx.insert(analysisRunPlayers)
          .values({
            runId: input.runId,
            playerId: player.playerId,
            outcome: 'SNAPSHOT_CREATED',
            snapshotId,
            errorJson: null,
          })
          .run();

        results.push({
          playerId: player.playerId,
          outcome: 'SNAPSHOT_CREATED',
          snapshotId,
          modelVersion,
        });
      }
      return { runId: input.runId, players: results as readonly AnalysisPlayerResult[] };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The identity of a player's latest snapshot — the `NO_CHANGES` gate (ADR-0062c).
 *
 * A caller compares BOTH fields against a freshly computed `PlayerModelContent`: equal
 * `algorithmVersion` and equal `inputHash` mean the recomputation would be identical, so no
 * snapshot is written and the run reports `NO_CHANGES`. Comparing only the hash would miss
 * an algorithm change; comparing only the version would miss new hands.
 */
export interface SnapshotIdentity {
  readonly algorithmVersion: number;
  readonly inputHash: string;
  readonly modelVersion: number;
}

/** `null` when the player has no snapshot yet — which is not an error. */
export function getLatestSnapshotIdentity(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<SnapshotIdentity | null> {
  const rows = attempt({ table: 'player_model_snapshots', id: playerId }, () =>
    db
      .select({
        algorithmVersion: playerModelSnapshots.algorithmVersion,
        inputHash: playerModelSnapshots.inputHash,
        modelVersion: playerModelSnapshots.modelVersion,
      })
      .from(playerModelSnapshots)
      .where(eq(playerModelSnapshots.playerId, playerId))
      .orderBy(desc(playerModelSnapshots.modelVersion))
      .limit(1)
      .all(),
  );
  if (!rows.ok) return rows;
  return ok(rows.value[0] ?? null);
}

/** Internal. The four child tables of one snapshot, each ordered by its `ordinal`. */
function childRowsOf(db: GtoDatabase, snapshotId: string) {
  return attempt({ table: 'player_model_snapshots', id: snapshotId }, () => ({
    stats: db
      .select()
      .from(playerModelStats)
      .where(eq(playerModelStats.snapshotId, snapshotId))
      .orderBy(asc(playerModelStats.ordinal))
      .all(),
    spots: db
      .select()
      .from(playerSpotStats)
      .where(eq(playerSpotStats.snapshotId, snapshotId))
      .orderBy(asc(playerSpotStats.ordinal))
      .all(),
    betSizes: db
      .select()
      .from(playerModelBetSizes)
      .where(eq(playerModelBetSizes.snapshotId, snapshotId))
      .orderBy(asc(playerModelBetSizes.ordinal))
      .all(),
    showEvidence: db
      .select()
      .from(playerModelShowEvidence)
      .where(eq(playerModelShowEvidence.snapshotId, snapshotId))
      .orderBy(asc(playerModelShowEvidence.ordinal))
      .all(),
  }));
}

/** The whole snapshot, content included. `null` when the id is unknown. */
export function getSnapshot(
  db: GtoDatabase,
  snapshotId: ModelSnapshotId,
): DbResult<PlayerModelSnapshot | null> {
  const rows = attempt({ table: 'player_model_snapshots', id: snapshotId }, () =>
    db.select().from(playerModelSnapshots).where(eq(playerModelSnapshots.id, snapshotId)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  const children = childRowsOf(db, snapshotId);
  if (!children.ok) return children;
  return decodeModelSnapshot(row, children.value);
}

/** The player's highest-versioned snapshot, content included. `null` when there is none. */
export function getLatestSnapshot(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<PlayerModelSnapshot | null> {
  const rows = attempt({ table: 'player_model_snapshots', id: playerId }, () =>
    db
      .select()
      .from(playerModelSnapshots)
      .where(eq(playerModelSnapshots.playerId, playerId))
      .orderBy(desc(playerModelSnapshots.modelVersion))
      .limit(1)
      .all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  const children = childRowsOf(db, row.id);
  if (!children.ok) return children;
  return decodeModelSnapshot(row, children.value);
}

/**
 * Every version this player has, oldest first — the `v1 / v2 / v3` history the profile UI
 * shows (prompt §24). Headers only: a version list must not pay for four child tables per
 * version.
 */
export function listSnapshotVersions(
  db: GtoDatabase,
  playerId: PlayerId,
): DbResult<readonly ModelSnapshotHeader[]> {
  const rows = attempt({ table: 'player_model_snapshots', id: playerId }, () =>
    db
      .select()
      .from(playerModelSnapshots)
      .where(eq(playerModelSnapshots.playerId, playerId))
      .orderBy(asc(playerModelSnapshots.modelVersion))
      .all(),
  );
  if (!rows.ok) return rows;
  return collect(rows.value.map(decodeModelSnapshotHeader));
}

/** Internal. Per-player outcomes for a set of runs, grouped by run id, ordered by player. */
function outcomesFor(
  db: GtoDatabase,
  runIds: readonly string[],
): DbResult<ReadonlyMap<string, readonly (typeof analysisRunPlayers.$inferSelect)[]>> {
  if (runIds.length === 0) return ok(new Map());
  const rows = attempt({ table: 'analysis_run_players' }, () =>
    db
      .select()
      .from(analysisRunPlayers)
      .where(inArray(analysisRunPlayers.runId, [...runIds]))
      .orderBy(asc(analysisRunPlayers.runId), asc(analysisRunPlayers.playerId))
      .all(),
  );
  if (!rows.ok) return rows;
  const grouped = new Map<string, (typeof analysisRunPlayers.$inferSelect)[]>();
  for (const row of rows.value) {
    const bucket = grouped.get(row.runId);
    if (bucket === undefined) grouped.set(row.runId, [row]);
    else bucket.push(row);
  }
  return ok(grouped);
}

/** One run with its per-player outcomes. `null` when the id is unknown. */
export function getAnalysisRun(
  db: GtoDatabase,
  runId: AnalysisRunId,
): DbResult<AnalysisRunReport | null> {
  const rows = attempt({ table: 'analysis_runs', id: runId }, () =>
    db.select().from(analysisRuns).where(eq(analysisRuns.id, runId)).all(),
  );
  if (!rows.ok) return rows;
  const row = rows.value[0];
  if (row === undefined) return ok(null);
  const run = decodeAnalysisRunRow(row);
  if (!run.ok) return run;
  const outcomes = outcomesFor(db, [runId]);
  if (!outcomes.ok) return outcomes;
  const players = collect((outcomes.value.get(runId) ?? []).map(decodeAnalysisRunPlayerRow));
  if (!players.ok) return players;
  return ok({ run: run.value, players: players.value });
}

/** Every run whose scope was this session, oldest first. */
export function listAnalysisRunsForSession(
  db: GtoDatabase,
  sessionId: SessionId,
): DbResult<readonly AnalysisRunReport[]> {
  const rows = attempt({ table: 'analysis_runs', id: sessionId }, () =>
    db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.sessionId, sessionId))
      .orderBy(asc(analysisRuns.startedAt), asc(analysisRuns.id))
      .all(),
  );
  if (!rows.ok) return rows;
  const runs = collect(rows.value.map(decodeAnalysisRunRow));
  if (!runs.ok) return runs;
  const outcomes = outcomesFor(
    db,
    rows.value.map((row) => row.id),
  );
  if (!outcomes.ok) return outcomes;
  const reports: AnalysisRunReport[] = [];
  for (const run of runs.value) {
    const players = collect((outcomes.value.get(run.id) ?? []).map(decodeAnalysisRunPlayerRow));
    if (!players.ok) return players;
    reports.push({ run, players: players.value });
  }
  return ok(reports);
}
