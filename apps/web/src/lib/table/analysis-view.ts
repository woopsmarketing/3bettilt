/**
 * Pure view logic and Korean copy for 세션 분석 및 반영 (prompt §26-§28, ADR-0062).
 *
 * Nothing here renders and nothing here reaches a server. It exists so the two things this
 * feature must never get wrong are testable on their own:
 *
 * 1. **The safe boundary.** `sessionAnalysisGate` is the only place that decides whether the
 *    button may be pressed. Analysis must never run while a hand is live (prompt §26), and —
 *    a boundary the brief does not name but the same argument demands — never while a
 *    completed hand is still on its way to the database, because the run would then report a
 *    session hand count that is one short of what the user just played.
 * 2. **Honest numbers.** Every rate below is DERIVED from the two counts the snapshot stores
 *    and is rounded explicitly (`centiPercent` + `formatPercent`, the same half-away-from-zero
 *    rule `observedRatePercent` uses). A rate is never shown without its denominator, and a
 *    bucket whose confidence is `UNKNOWN` is never shown as a percentage at all: too small a
 *    sample to have a frequency is a state, not a low number (WP C1-A, prompt §22, §28).
 *
 * The copy is Korean-first (ADR-0053). Latin short names — VPIP, RFI, `BB_VS_BTN_OPEN` — are
 * kept verbatim: they are the notation a Korean player reads directly, and they are also the
 * exact keys the snapshot stores, so nothing is lost in translation on the way to the screen.
 */
import type { ViewPhase } from '@gto-self/poker-core';
import {
  centiPercent,
  formatPercent,
  type ModelStatCount,
  type SnapshotConfidenceState,
  type SpotStatCount,
} from '@gto-self/player-core';
import type {
  AnalysisPlayerOutcomeView,
  AnalysisSummary,
  AnalysisSummaryStatus,
} from '../../server/analysis-contract.js';

/* -------------------------------------------------------------------------- */
/* The safe boundary                                                           */
/* -------------------------------------------------------------------------- */

/** Why the button is not pressable right now. `null` when it is. */
export type AnalysisGateReason = 'RUNNING' | 'HAND_IN_PROGRESS' | 'SAVE_IN_FLIGHT';

export interface AnalysisGate {
  readonly enabled: boolean;
  readonly reason: AnalysisGateReason | null;
}

export interface AnalysisGateInput {
  /** The live hand's phase, or `null` when no hand has been dealt (or one was discarded). */
  readonly phase: ViewPhase['kind'] | null;
  /** Completed hands whose persist has not yet come back. */
  readonly savesInFlight: number;
  /** A run this browser started and is still waiting for. */
  readonly running: boolean;
}

/**
 * Total. The one decision behind the button's `disabled` attribute.
 *
 * `COMPLETE` is a safe boundary and `null` (no hand at all) is the safest one; every other
 * phase — including `AWAITING_AWARD`, where the pot has not been given to anybody yet — is a
 * live hand and is refused. The precedence of the reasons is the order the user can act on
 * them: a run they started, then a hand they are playing, then a write they can only wait for.
 */
export function sessionAnalysisGate(input: AnalysisGateInput): AnalysisGate {
  if (input.running) return { enabled: false, reason: 'RUNNING' };
  if (input.phase !== null && input.phase !== 'COMPLETE') {
    return { enabled: false, reason: 'HAND_IN_PROGRESS' };
  }
  if (input.savesInFlight > 0) return { enabled: false, reason: 'SAVE_IN_FLIGHT' };
  return { enabled: true, reason: null };
}

export const ANALYSIS_GATE_REASON_LABEL: Readonly<Record<AnalysisGateReason, string>> = {
  RUNNING: '분석 중입니다…',
  HAND_IN_PROGRESS: '진행 중인 핸드가 끝나면 분석할 수 있습니다.',
  SAVE_IN_FLIGHT: '핸드 저장이 끝나면 분석할 수 있습니다.',
};

export const RUN_ANALYSIS_LABEL = '세션 분석 및 반영';

/* -------------------------------------------------------------------------- */
/* Summary copy (prompt §27)                                                   */
/* -------------------------------------------------------------------------- */

export const ANALYSIS_OUTCOME_LABEL: Readonly<Record<AnalysisPlayerOutcomeView, string>> = {
  SNAPSHOT_CREATED: '반영 완료',
  NO_CHANGES: '변경 없음',
  FAILED: '실패',
};

/** Modest, and never green-for-everything: an unchanged player is not a success story. */
export const ANALYSIS_OUTCOME_CLASS: Readonly<Record<AnalysisPlayerOutcomeView, string>> = {
  SNAPSHOT_CREATED: 'text-good-500',
  NO_CHANGES: 'text-ink-500',
  FAILED: 'text-danger-500',
};

export const ANALYSIS_STATUS_LABEL: Readonly<Record<AnalysisSummaryStatus, string>> = {
  SUCCESS: '완료',
  PARTIAL: '일부 실패',
  FAILED: '실패',
  NO_ELIGIBLE_HANDS: '분석할 핸드 없음',
};

/**
 * The half of the disclaimer that is never adapted and never dropped.
 *
 * Prompt §27 and ADR-0062g: a player model exists, and 기본전략 does not use it. That claim is
 * true — `analysis-strategy-unaffected.test.ts` pins it — and it must be said in words on the
 * one screen where a user could reasonably assume otherwise.
 */
export const STRATEGY_UNCHANGED_SENTENCE = '현재 기본전략 추천에는 아직 반영되지 않습니다.';

/**
 * Total. What the run actually did, plus the sentence above.
 *
 * The leading sentence is chosen from what happened, never from the status alone: a `SUCCESS`
 * run in which every player was already up to date updated nothing, and saying it did would
 * be the exact overstatement §27 forbids.
 */
export function analysisDisclaimer(summary: AnalysisSummary): string {
  const created = summary.players.filter((player) => player.outcome === 'SNAPSHOT_CREATED').length;
  const lead = ((): string => {
    switch (summary.status) {
      case 'NO_ELIGIBLE_HANDS':
        return '분석할 완료된 핸드가 아직 없습니다.';
      case 'FAILED':
        return '플레이어 모델을 업데이트하지 못했습니다.';
      case 'PARTIAL':
        return '일부 플레이어의 모델만 업데이트되었습니다.';
      case 'SUCCESS':
        return created === 0
          ? '새로 반영할 내용이 없어 플레이어 모델이 그대로 유지되었습니다.'
          : '플레이어 모델이 업데이트되었습니다.';
    }
  })();
  return `${lead} ${STRATEGY_UNCHANGED_SENTENCE}`;
}

/** Total. A count the server did not measure renders as a dash, never as a zero (rule 3). */
export const countOrDash = (value: number | null): string => (value === null ? '—' : String(value));

/* -------------------------------------------------------------------------- */
/* Profile copy (prompt §28)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The English state is kept in a `title` on the rendered element so the vocabulary the
 * snapshot actually stores stays reachable; the label itself is Korean (ADR-0053).
 */
export const SNAPSHOT_CONFIDENCE_LABEL: Readonly<Record<SnapshotConfidenceState, string>> = {
  UNKNOWN: '미확인',
  LEARNING: '학습중',
  KNOWN: '파악됨',
};

/**
 * Total. A frequency derived from the two counts, or `'—'`.
 *
 * `'—'` in two cases, both of them honest rather than defensive: no opportunity has arisen
 * (there is no denominator), or the sample is `UNKNOWN` (there is a denominator, but it is too
 * small for a frequency to mean anything — prompt §22). The counts are rendered beside this in
 * every caller, so the dash never hides a number the user could have had.
 *
 * Rounding is explicit and half-away-from-zero, the same rule `observedRatePercent` applies.
 */
export function observedRateLabel(
  actions: number,
  opportunities: number,
  state: SnapshotConfidenceState,
): string {
  if (opportunities === 0 || state === 'UNKNOWN') return '—';
  // A numerator above its denominator is impossible in a snapshot the engine produced, so it
  // can only mean damaged storage. The pair is rendered beside this in every caller, so the
  // user still sees exactly what was read; what must NOT happen is a thrown range error
  // blanking the whole profile over one bad row.
  if (actions > opportunities || actions < 0) return '—';
  const value = centiPercent(Math.round((actions / opportunities) * 10_000));
  return formatPercent(value, { maxDecimals: 0, unit: true });
}

/**
 * Total. The headline rows: the `position: null` bucket ONLY.
 *
 * That bucket is its own reading of the stat over every position, not the sum of the six
 * positional rows, and the two are NEVER added (ADR-0035, WP C1-A §10.9). Keeping the split in
 * a named function is what stops a later edit from "tidying" them into one list.
 */
export const overallStats = (stats: readonly ModelStatCount[]): readonly ModelStatCount[] =>
  stats.filter((stat) => stat.position === null);

/** Total. The positional rows, which are displayed separately and summed with nothing. */
export const positionalStats = (stats: readonly ModelStatCount[]): readonly ModelStatCount[] =>
  stats.filter((stat) => stat.position !== null);

/**
 * Total. The situations worth showing first: most-observed, then by `spotKey` so a tie is
 * stable across runs. Nothing is dropped from the model — this is a display order plus a cap.
 *
 * The tie-break compares CODE POINTS (`<`/`>`), not `localeCompare`: the latter's order
 * depends on the runtime's ICU data and the ambient locale, so two environments could show
 * a different set of spots for the same model — which is exactly the "stable across runs"
 * claim this docblock makes. It is the same comparator `analysis-core`'s `aggregate.ts` uses
 * for the STORED ordering, so display order and stored order can never disagree.
 */
export function topSpots(spots: readonly SpotStatCount[], limit: number): readonly SpotStatCount[] {
  return [...spots]
    .sort(
      (a, b) =>
        b.opportunities - a.opportunities ||
        (a.spotKey < b.spotKey ? -1 : a.spotKey > b.spotKey ? 1 : 0),
    )
    .slice(0, limit);
}

/** Total. UTC to the minute, the same format the existing profile panel uses. */
export const formatAnalysisInstant = (epochMs: number): string =>
  new Date(epochMs).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
