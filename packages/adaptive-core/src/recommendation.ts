/**
 * The shape of an ADAPTIVE answer, and the evidence that has to travel with it.
 *
 * USER-FACING NAME: 상대 적응 · ADAPTIVE. Never GTO, never "solved", never presented as
 * anything but this project's own authored exploit (CLAUDE.md rule 2). `provenance` is fixed at
 * `'HEURISTIC'` at the type level so that cannot drift.
 *
 * ---------------------------------------------------------------------------------------
 * EVERY NUMBER CARRIES ITS DERIVATION
 *
 * An ADAPTIVE answer is a claim about a person, made from a small sample, by rules we wrote.
 * The user has to be able to disagree with it — which means the output cannot be "BET 75%", it
 * has to be "BET 75%, up from 55%, because this opponent folds to 71% of flop c-bets over 42
 * observations, which we are 51% confident in, through rule FOLD_TO_CBET_HIGH, contributing
 * 612 of a permitted 1000 bps". Every one of those numbers is a field below.
 *
 * That is also what makes a stored trace worth storing: `adaptive_strategy_traces` keeps the
 * whole `AdaptiveAdjustment[]`, so a hand reviewed six months later can be re-argued from the
 * evidence that was actually available at the time.
 *
 * THE BASELINE IS ECHOED, NOT REBUILT. `AdaptiveRecommendation.baseline` is the exact
 * `AdaptiveBaseline` value that was passed in. Two compositions over the same baseline with
 * different opponents echo deep-equal baselines — that is the REFERENCE-is-untouched property,
 * observable at this layer without a `HandState` anywhere in sight.
 * ---------------------------------------------------------------------------------------
 */
import type { MilliBB } from '@gto-self/shared';
import type { SnapshotConfidenceState } from '@gto-self/player-core';
import type { Bps, SizingClampKind, StrategyActionKind } from '@gto-self/strategy-core';
import type { AdaptiveBaseline, AdaptiveTarget } from './baseline.js';
import type { AdaptiveStatSourceRef } from './profile.js';
import type { AdaptiveStatKey } from './stats.js';
import type { AdaptiveOpponentRoleKind } from './multiway.js';
import type { AdaptiveFrequencyRuleId } from './policy/frequencyModel.js';
import type { AdaptiveSizingRuleId } from './policy/sizingModel.js';
import type { AdaptiveCapId, AdaptiveNote, AdaptiveReasonKey } from './policy/reasons.js';

/** Every rule id in the package, across both passes. */
export type AdaptiveRuleId = AdaptiveFrequencyRuleId | AdaptiveSizingRuleId;

/** Which pass produced an adjustment. Frequency moves mass; sizing moves a rung. */
export type AdaptiveRuleKind = 'FREQUENCY' | 'SIZING';

/**
 * ONE rule's whole story: what it read, how sure it was, what it asked for, and what it got.
 *
 * `rawContributionBps` -> `contributionBps` is the audit trail of every limiter, in order:
 *
 * ```
 *   raw     = floor(|deviationBps| * gainBps / 10000)      // rawContributionBps (signed)
 *   scaled  = floor(raw * confidenceBps / 10000)
 *   capped  = min(scaled, rule.maxBps)                     // cappedBy 'RULE_MAX'
 *   guarded = capped, or 0 if the §9 guard refused it      // cappedBy 'AGGRESSIVE_PLAYER_BEHIND'
 *   final   = guarded scaled by the global cap ratio       // cappedBy 'TOTAL_SHIFT'
 * ```
 *
 * `contributionBps` is the SIGNED final number: negative when the rule's effect is `DECREASE`.
 * A reader can reproduce every intermediate from the fields on this record alone, which is the
 * property that makes the stored trace self-contained.
 *
 * ON A SIZING RULE, `contributionBps` IS 0 AND THAT IS NOT A PLACEHOLDER. A sizing rule moves
 * no frequency mass whatsoever — it moves a rung, reported in `sizingSteps`. Reporting 0 bps of
 * frequency contribution for it is the literal truth, and it is what keeps `totalShiftBps`
 * meaning exactly "how far the MIX moved".
 */
export interface AdaptiveAdjustment {
  readonly ruleId: AdaptiveRuleId;
  readonly ruleKind: AdaptiveRuleKind;
  readonly stat: AdaptiveStatKey;
  readonly priorBps: number;
  readonly observedBps: number;
  readonly estimateBps: number;
  /** `estimateBps - priorBps`. Signed. The only quantity a rule is allowed to read. */
  readonly deviationBps: number;
  readonly sampleN: number;
  readonly confidenceBps: number;
  readonly confidenceState: SnapshotConfidenceState;
  /** Every contributing source with its own value, sample and caveat. Never pooled away. */
  readonly sources: readonly AdaptiveStatSourceRef[];
  readonly target: AdaptiveTarget;
  /** Signed. Gain applied to the deviation, before confidence scaling and every cap. */
  readonly rawContributionBps: number;
  /** Signed. After confidence scaling, the rule ceiling, the §9 guard and the global cap. */
  readonly contributionBps: number;
  /** SIZING rules only: the signed rung offset the rule asked for. `null` on a FREQUENCY rule. */
  readonly sizingSteps: number | null;
  readonly cappedBy: AdaptiveCapId | null;
  readonly reasonKey: AdaptiveReasonKey;
  /** The rule's own authored note, copied verbatim so a stored trace explains itself. */
  readonly note: string;
  readonly opponentPlayerId: string;
}

/** One action row of the ADAPTIVE answer, beside what REFERENCE said about the same row. */
export interface AdaptiveAction {
  readonly kind: StrategyActionKind;
  /** A multiple of 500. The set sums to exactly 10000. Guaranteed by `quantizeFrequencies`. */
  readonly frequencyBps: Bps;
  /** `frequencyBps - baseline.frequencyBps`. Signed, a multiple of 500. */
  readonly deltaBps: number;
  /** Echoed from the baseline. ADAPTIVE never invents an amount for a row that had none. */
  readonly toAmountMbb: MilliBB | null;
  readonly isAllIn: boolean;
}

/**
 * The ADAPTIVE size, with the baseline's beside it.
 *
 * `requestedToAmountMbb` is what the moved bucket asked for BEFORE the engine's legal window
 * was consulted, retained even when the clamp overrode it (CLAUDE.md rule 3). When no rule
 * fired, every "to" field equals its "from" and `bucketDelta` is 0 — the row is still emitted,
 * so the UI can show the size unchanged rather than showing nothing.
 */
export interface AdaptiveSizing {
  readonly kind: 'BET' | 'RAISE';
  readonly fromBucketIndex: number;
  readonly toBucketIndex: number;
  readonly fromPotFractionPercent: number | null;
  readonly toPotFractionPercent: number | null;
  /** `toBucketIndex - fromBucketIndex`. Always in `[-1, +1]`, 0 when nothing moved. */
  readonly bucketDelta: number;
  readonly fromToAmountMbb: MilliBB;
  readonly toToAmountMbb: MilliBB;
  readonly requestedToAmountMbb: MilliBB;
  readonly clamp: SizingClampKind;
  readonly minToAmountMbb: MilliBB;
  readonly maxToAmountMbb: MilliBB;
}

/**
 * What the UI needs to name an opponent and say how much is known about them.
 *
 * `maxConfidenceBps` and `knownStatCount` summarise the profile without shipping all 17
 * estimates into every trace row: they answer "why is this player driving the recommendation"
 * and "should I trust it", which are the two questions the panel has room for.
 */
export interface AdaptiveOpponentSummary {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly nickname: string | null;
  readonly role: AdaptiveOpponentRoleKind;
  /** Total evidence behind the whole profile: the sum of `sampleN` over all 17 stats. */
  readonly totalObservedSampleN: number;
  /** The highest per-stat confidence in the profile. 0 when nothing is known. */
  readonly maxConfidenceBps: number;
  /** How many of the 17 stats reached `snapshotConfidenceState === 'KNOWN'`. */
  readonly knownStatCount: number;
  readonly manualHudSnapshotId: string | null;
  readonly learnedSnapshotId: string | null;
  readonly learnedModelVersion: number | null;
}

/**
 * `ADAPTED` — at least one rule cleared its gate and is recorded in `adjustments`. The mix or
 * the size may still be unchanged after quantization; the reasoning is shown either way.
 *
 * `INSUFFICIENT_DATA` — no rule cleared its gate. `actions` are the baseline's frequencies
 * VERBATIM (not requantized), `sizing` echoes the baseline unchanged, `adjustments` is empty,
 * and `notes` names the gate that was not met. No adaptive number is fabricated in this state;
 * the panel shows the REFERENCE rows.
 */
export type AdaptiveStatus = 'ADAPTED' | 'INSUFFICIENT_DATA';

/** The composed answer. */
export interface AdaptiveRecommendation {
  /** Structural discriminant, mirroring `PostflopRecommendation.kind`. */
  readonly kind: 'AdaptiveRecommendation';
  /** The user-facing tag. Never 'GTO'. */
  readonly label: 'ADAPTIVE';
  readonly status: AdaptiveStatus;
  /** The exact baseline that was passed in, echoed unchanged. */
  readonly baseline: AdaptiveBaseline;
  readonly actions: readonly AdaptiveAction[];
  /** `null` only when the baseline carried no actions at all, which REFERENCE never does. */
  readonly primaryAction: AdaptiveAction | null;
  readonly sizing: AdaptiveSizing | null;
  /** Every rule that fired, in rule-table order: frequency rules first, then sizing rules. */
  readonly adjustments: readonly AdaptiveAdjustment[];
  /** `sum(|adapted - baseline|) / 2` over the final quantized mix. Never above the cap. */
  readonly totalShiftBps: number;
  /** `true` when the global cap had to scale or trim the contributions. */
  readonly capApplied: boolean;
  /**
   * `true` when this recommendation actually differs from the baseline it was built from —
   * some action's `deltaBps` is non-zero, or the sizing moved a rung.
   *
   * It is deliberately SEPARATE from `status`. `ADAPTED` means "a rule cleared its gate and
   * its reasoning is recorded", which stays true when the multiway guard rail (§9) or the
   * global cap then held the output at the baseline: the user is better served by "we read
   * this opponent and deliberately did not move" than by silence. But the panel must not
   * render that case as an adaptation, and must not badge a `+0%` delta as a change, so the
   * question "did anything move" is answered here as a fact about the OUTPUT rather than
   * inferred from the presence of adjustments.
   *
   * Always `false` when `status === 'INSUFFICIENT_DATA'`.
   */
  readonly changedFromBaseline: boolean;
  /** Every opponent the caller listed, with its role. Ordered as the caller listed them. */
  readonly opponents: readonly AdaptiveOpponentSummary[];
  readonly policyVersion: string;
  readonly provenance: 'HEURISTIC';
  readonly notes: readonly AdaptiveNote[];
}
