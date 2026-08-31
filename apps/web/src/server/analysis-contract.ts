/**
 * The wire shape of "세션 분석 및 반영" — the post-session analysis run (ADR-0062).
 *
 * This module holds TYPES and one zod shape and NOTHING else: no database import, no
 * `poker-core` call, no clock. It lives under `src/server/` because that is the directory
 * that owns the analysis surface, but it is deliberately free of every server-only
 * dependency so WP C1-D can `import type` from it in a client component without dragging
 * `better-sqlite3` into a browser bundle (ADR-0044). Nothing here is a value the client
 * executes; the ACTION itself is still passed down as a prop, never imported.
 *
 * Every field below is either a count the server computed or a code/message a domain layer
 * produced verbatim. Nothing is an adjective, and nothing implies that strategy has changed
 * (prompt §27): the UI must say, in words, that the model does not yet affect 기본전략.
 */
import { z } from 'zod';
// Type-only, and that is load-bearing: `import type` is erased, so a client component that
// imports this module for its types never gains a runtime edge to `@gto-self/db` and its
// native binding. `@gto-self/player-core` is a pure domain package and is client-safe anyway.
import type { PlayerModelSnapshot } from '@gto-self/player-core';
import type { ModelSnapshotHeader } from '@gto-self/db';

/**
 * What a whole run did.
 *
 * `NO_ELIGIBLE_HANDS` is NOT a database status — `analysis_runs.status` only knows
 * `SUCCESS | PARTIAL | FAILED`. It is the typed answer for "there was nothing to analyse",
 * and no run row is written for it (see `runSessionAnalysis`), because a run with no input
 * has no input identity and would be an unauditable row claiming an act that did not happen.
 */
export type AnalysisSummaryStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NO_ELIGIBLE_HANDS';

/** The per-player outcome vocabulary, identical to `analysis_run_players.outcome`. */
export type AnalysisPlayerOutcomeView = 'SNAPSHOT_CREATED' | 'NO_CHANGES' | 'FAILED';

/**
 * One player's line in the summary (prompt §27).
 *
 * Every optional number is `null` rather than `0` when it is genuinely unknown, so the UI can
 * render "—" instead of claiming a zero it did not measure (`CLAUDE.md` rule 3).
 */
export interface AnalysisPlayerSummary {
  readonly playerId: string;
  /** `null` when the `players` row could not be read. The id is still shown. */
  readonly nickname: string | null;
  readonly outcome: AnalysisPlayerOutcomeView;
  /**
   * `SNAPSHOT_CREATED`: the version the repository ASSIGNED (never one this layer picked).
   * `NO_CHANGES`: the existing latest version, which is what the UI should keep showing.
   * `FAILED`: `null`.
   */
  readonly modelVersion: number | null;
  /**
   * The player's COMPLETE eligible history behind the current model — every completed hand
   * they were dealt into, across every session (ADR-0062b). Not this session's count.
   */
  readonly totalHands: number | null;
  /**
   * `totalHands` minus the previous snapshot's `sourceHandCount`. `0` for `NO_CHANGES`.
   * `null` when there is no previous snapshot to subtract from — a first snapshot has
   * nothing to be "added" to, and reporting `totalHands` there would read as growth.
   */
  readonly addedSinceLastSnapshot: number | null;
  /** Distinct spot buckets with at least one opportunity — prompt §27's "주요 상황". */
  readonly spotGroupCount: number | null;
  /** Hands in which this player explicitly showed cards (ADR-0062f). */
  readonly showCount: number | null;
  /** Set only on `FAILED`, carried verbatim from whatever layer refused. */
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

/** The whole run, as the UI renders it. */
export interface AnalysisSummary {
  /** `null` exactly when no run row was written (`NO_ELIGIBLE_HANDS`). */
  readonly runId: string | null;
  readonly sessionId: string;
  readonly status: AnalysisSummaryStatus;
  readonly algorithmVersion: number;
  readonly startedAt: number;
  readonly finishedAt: number;
  /** `finishedAt - startedAt`, in ms. Measured, not estimated (prompt §35). */
  readonly durationMs: number;
  /** COMPLETED hands stored for THIS session — the scope the button named. */
  readonly sessionHandCount: number;
  /** Players the run recomputed or skipped. Equals `players.length`. */
  readonly playerCount: number;
  /**
   * Opportunities counted across the snapshots this run CREATED. A `NO_CHANGES` player
   * contributes nothing: its numbers were not recomputed, so claiming them here would report
   * work that did not happen.
   */
  readonly observationCount: number;
  /** SHOW-evidence entries across the snapshots this run created, on the same rule. */
  readonly showCount: number;
  readonly players: readonly AnalysisPlayerSummary[];
}

export type RunSessionAnalysisResult =
  | { readonly ok: true; readonly summary: AnalysisSummary }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type RunSessionAnalysisAction = (input: {
  readonly sessionId: string;
}) => Promise<RunSessionAnalysisResult>;

/**
 * The run request. A server action is a public endpoint, so even a one-field input is parsed
 * rather than trusted.
 */
export const runSessionAnalysisSchema = z.object({
  sessionId: z.string().min(1).max(200),
});

export type RunSessionAnalysisValue = z.infer<typeof runSessionAnalysisSchema>;

/** The player-profile read request. */
export const playerModelQuerySchema = z.object({
  playerId: z.string().min(1).max(200),
});

export type GetPlayerModelAction = (input: {
  readonly playerId: string;
}) => Promise<GetPlayerModelResult>;

/**
 * The read surface WP C1-D renders a player profile from.
 *
 * `snapshot` is the FULL latest content document (`PlayerModelSnapshot` from
 * `@gto-self/player-core`); `versions` is headers only, because a version list must not pay
 * for four child tables per version. `snapshot === null` means the player has never been
 * analysed — a real state, not an error.
 */
export interface PlayerModelView {
  readonly playerId: string;
  readonly nickname: string | null;
  readonly snapshot: PlayerModelSnapshot | null;
  /** Oldest version first. */
  readonly versions: readonly ModelSnapshotHeader[];
}

export type GetPlayerModelResult =
  | { readonly ok: true; readonly value: PlayerModelView }
  | { readonly ok: false; readonly code: string; readonly message: string };
