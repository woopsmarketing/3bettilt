/**
 * The shape of a preflop reference answer, and the mechanics that keep it honest.
 *
 * USER-FACING NAME: 기본전략 · REFERENCE. Never GTO — not in a type name, an id, a note or a
 * rendered string (CLAUDE.md rule 2).
 *
 * Three invariants this module owns, all enforced here rather than trusted to each policy:
 *
 *  1. QUANTIZATION. Every emitted frequency is a multiple of 500 bps — 5 percentage points —
 *     and the emitted set sums to EXACTLY 10000. The policy tables are authored in 5-point
 *     steps already; running everything through `quantizeFrequencies` anyway means a merge,
 *     a substitution or a future table can never leak a 3-decimal frequency that would read
 *     as solver output. Rule `FREQUENCY_QUANTIZATION`.
 *  2. PRIMARY ACTION. Highest frequency wins; a tie goes to the LEAST committing action
 *     (FOLD < CHECK < CALL < RAISE < ALL_IN), so a genuine 50/50 is never displayed as if
 *     the aggressive line were the recommendation. Rule `PRIMARY_ACTION_TIE_BREAK`.
 *  3. EXPLANATION IS STRUCTURED. `ExplanationFeature` carries an id, a stable token and
 *     numbers. It never carries a generated sentence, and nothing in this package writes
 *     prose or calls a model — the UI renders (and localizes) from the ids.
 */
import { invariant, type MilliBB } from '@gto-self/shared';
import { apportion, asBps, BPS_TOTAL, type Bps } from '../bps.js';
import type { Provenance } from '../provenance.js';
import type { HandClass } from '../range/handClass.js';
import type { StackBucketClassification } from '../stackBucket.js';
import type { StrategyActionKind, StrategyPosition } from '../types.js';
import type { PreflopSpotFamily, PreflopSpotUnsupportedReason } from './spot.js';
import type { PreflopRuleId } from './rules.js';

/** 5 percentage points. The finest frequency this package is willing to state. */
export const FREQUENCY_STEP_BPS = 500;

/** 10000 / 500 — the number of whole steps a normalized frequency set is divided into. */
export const FREQUENCY_STEP_COUNT = BPS_TOTAL / FREQUENCY_STEP_BPS;

/**
 * The six voluntary actions, ordered LEAST to MOST committing. This order is the tie-break for
 * the primary action and the canonical output order, on EVERY street.
 *
 * `BET` never occurs preflop (the blinds are already a bet), so preflop simply never looks it
 * up; its presence here does not change the relative order of the five preflop members and
 * therefore cannot change any preflop tie-break. It is listed once, here, so the postflop
 * policy shares the tie-break rather than authoring a second one that could drift.
 */
export const ACTION_COMMITMENT_ORDER: readonly StrategyActionKind[] = [
  'FOLD',
  'CHECK',
  'CALL',
  'BET',
  'RAISE',
  'ALL_IN',
];

function commitmentRank(kind: StrategyActionKind): number {
  const index = ACTION_COMMITMENT_ORDER.indexOf(kind);
  invariant(index >= 0, `${kind} is not a voluntary action`);
  return index;
}

/** How a requested size was reconciled with the engine's legal bounds. */
export type SizingClampKind = 'NONE' | 'RAISED_TO_MINIMUM' | 'LOWERED_TO_MAXIMUM';

/**
 * `RuleId` defaults to `PreflopRuleId`, so every preflop use of these three types is written
 * exactly as before. The parameter exists only so the postflop policy can reuse the same
 * shapes with its own rule vocabulary instead of copying them.
 */
export interface RecommendedSizing<RuleId extends string = PreflopRuleId> {
  readonly ruleId: RuleId;
  /**
   * What the sizing rule asked for, BEFORE clamping. Retained even when it was illegal:
   * a normalized value never replaces what the rule actually said (CLAUDE.md rule 3).
   */
  readonly requestedToAmountMbb: MilliBB;
  /** The legal raise-TO actually recommended. Always inside the engine's bounds. */
  readonly toAmountMbb: MilliBB;
  readonly clamp: SizingClampKind;
  /** Degraded one step by `LEGALITY_CLAMP` when `clamp !== 'NONE'`. */
  readonly provenance: Provenance;
  readonly minToAmountMbb: MilliBB;
  readonly maxToAmountMbb: MilliBB;
}

export interface RecommendedAction<RuleId extends string = PreflopRuleId> {
  readonly kind: StrategyActionKind;
  /** A multiple of 500. The set sums to exactly 10000. */
  readonly frequencyBps: Bps;
  /** Raise-TO semantics — hero's street contribution AFTER acting. `null` for fold/check. */
  readonly toAmountMbb: MilliBB | null;
  /** Chips this action puts in. `null` for fold/check. */
  readonly amountMbb: MilliBB | null;
  readonly isAllIn: boolean;
  /** Present only on a BET / RAISE / aggressive ALL_IN that a sizing rule produced. */
  readonly sizing: RecommendedSizing<RuleId> | null;
}

export interface RecommendationMetrics {
  /** Passed through from the query, never recomputed. */
  readonly spr: number | null;
  /** `call / (pot + call)`. Null when hero is not facing a bet. */
  readonly potOdds: number | null;
  /** The same number read as "equity hero needs to break even on a call". */
  readonly requiredEquity: number | null;
  readonly potBeforeDecisionMbb: MilliBB;
  readonly callAmountMbb: MilliBB;
  readonly effectiveStackMbb: MilliBB;
  readonly stackBucket: StackBucketClassification;
}

/**
 * How close the live table is to the environment the reference tables were authored for.
 *
 * There is deliberately NO `EXACT` member. The public charts behind `tables.ts` do not state
 * the rake or ante structure they assume, so claiming an exact match would be a claim no
 * source supports (anchor 9). `APPROXIMATE` is the best this package can ever report.
 */
export type EnvironmentCompatibilityStatus = 'APPROXIMATE' | 'DIVERGENT';

export type EnvironmentFactorId = 'ANTE' | 'RAKE' | 'STACK_DEPTH' | 'LINEUP_SIZE' | 'GAME_FORMAT';

export interface EnvironmentFactor {
  readonly id: EnvironmentFactorId;
  readonly status: EnvironmentCompatibilityStatus;
  /** A stable token, not a sentence. */
  readonly token: string;
}

export interface EnvironmentCompatibility {
  readonly status: EnvironmentCompatibilityStatus;
  readonly factors: readonly EnvironmentFactor[];
}

export interface RecommendationProvenance<RuleId extends string = PreflopRuleId> {
  /** The WORST provenance among the rules that contributed. */
  readonly quality: Provenance;
  readonly ruleIds: readonly RuleId[];
  readonly environmentCompatibility: EnvironmentCompatibility;
  /** Mandatory when `quality === 'HEURISTIC'` — an authored rule never surfaces unexplained. */
  readonly notes: readonly string[];
}

export type ExplanationFeatureId =
  | 'SPOT_FAMILY'
  | 'UNSUPPORTED_REASON'
  | 'HERO_POSITION'
  | 'OPENER_POSITION'
  | 'RELATIVE_POSITION'
  | 'HAND_CLASS'
  | 'RANGE_MEMBERSHIP'
  | 'CONTINUE_TIER'
  | 'STACK_BUCKET'
  | 'LINEUP_SIZE'
  | 'LIMPER_COUNT'
  | 'COLD_CALLER_COUNT'
  | 'OPEN_SIZE'
  | 'POT_ODDS'
  | 'SPR'
  | 'SIZING_RULE'
  | 'SIZING_CLAMPED'
  | 'BLIND_VS_BLIND'
  | 'FACING_ALL_IN'
  | 'CALL_COMMITS_STACK'
  | 'HEADS_UP_BUTTON_APPROXIMATION'
  | 'UNMODELLED_STACK_DEPTH';

/**
 * One typed fact that fed the recommendation. `token` is an enum-ish identifier (a position,
 * a family, a range name), never generated prose; the numeric fields carry the value in the
 * unit their name states. The UI renders the sentence.
 */
export interface ExplanationFeature<Id extends string = ExplanationFeatureId> {
  readonly id: Id;
  readonly token: string | null;
  readonly bpsValue: Bps | null;
  readonly mbbValue: MilliBB | null;
  readonly ratioValue: number | null;
  readonly countValue: number | null;
}

export interface StrategyExplanation<Id extends string = ExplanationFeatureId> {
  readonly features: readonly ExplanationFeature<Id>[];
}

/**
 * A preflop reference recommendation. `label` is the user-facing badge and is a constant:
 * this engine has exactly one label and it is not GTO.
 */
export interface StrategyRecommendation {
  readonly kind: 'PreflopRecommendation';
  readonly label: 'REFERENCE';
  readonly street: 'PREFLOP';
  readonly family: PreflopSpotFamily | 'UNSUPPORTED';
  readonly unsupportedReason: PreflopSpotUnsupportedReason | null;
  readonly heroPosition: StrategyPosition;
  readonly handClass: HandClass;
  readonly actions: readonly RecommendedAction[];
  readonly primaryAction: RecommendedAction;
  readonly metrics: RecommendationMetrics;
  readonly provenance: RecommendationProvenance;
  readonly explanation: StrategyExplanation;
}

// ---------------------------------------------------------------------------
// Frequency mechanics
// ---------------------------------------------------------------------------

/** The three buckets every policy table speaks in, before legality is considered. */
export interface ClassFrequencies {
  readonly foldBps: number;
  readonly callBps: number;
  readonly raiseBps: number;
}

/** Throws unless the three buckets are multiples of 500 summing to 10000. */
export function assertClassFrequencies(frequencies: ClassFrequencies): ClassFrequencies {
  const values = [frequencies.foldBps, frequencies.callBps, frequencies.raiseBps];
  for (const value of values) {
    invariant(
      Number.isInteger(value) && value >= 0 && value % FREQUENCY_STEP_BPS === 0,
      `policy frequency ${value} is not a non-negative multiple of ${FREQUENCY_STEP_BPS}`,
    );
  }
  const total = values.reduce((a, b) => a + b, 0);
  invariant(total === BPS_TOTAL, `policy frequencies sum to ${total}, not ${BPS_TOTAL}`);
  return frequencies;
}

/**
 * Total (throws only on an all-zero input, which is a programmer error here, or a
 * `stepBps` that does not divide `BPS_TOTAL` evenly, which is a caller error). Rounds a
 * set of raw weights onto a `stepBps`-point grid so they sum to exactly 10000.
 *
 * Implementation: apportion `BPS_TOTAL / stepBps` whole units by largest remainder (the
 * scheme in `../bps.ts`, tie-broken larger-remainder-first then LOWER index) and multiply
 * back by `stepBps`. Because the emitted action list is ordered least-committing first, the
 * index tie-break is also the conservative one.
 *
 * Idempotent on input that is already a valid `stepBps`-point set.
 *
 * `quantizeFrequencies` (below) is this function pinned to `FREQUENCY_STEP_BPS` — REFERENCE's
 * own 5-point grid — and is the one every REFERENCE call site uses, byte-identical to before
 * this function grew a parameter. `adaptive-core`'s 1-point ADAPTIVE grid (WP-K) is the other
 * caller of `quantizeFrequenciesToGrid` directly; REFERENCE's grid is untouched by that.
 */
export function quantizeFrequenciesToGrid(values: readonly number[], stepBps: number): readonly Bps[] {
  invariant(
    Number.isInteger(stepBps) && stepBps > 0 && BPS_TOTAL % stepBps === 0,
    `stepBps ${stepBps} must be a positive divisor of ${BPS_TOTAL}`,
  );
  const units = apportion(values, BPS_TOTAL / stepBps);
  invariant(units.ok, 'cannot quantize an all-zero frequency set');
  return units.value.map((unit) => asBps(unit * stepBps));
}

/** `quantizeFrequenciesToGrid` pinned to the 5-point grid. See its doc comment above. */
export function quantizeFrequencies(values: readonly number[]): readonly Bps[] {
  return quantizeFrequenciesToGrid(values, FREQUENCY_STEP_BPS);
}

/**
 * Total. The action to show first: highest frequency, ties broken toward the least
 * committing action. `actions` must be non-empty.
 */
export function pickPrimaryAction<
  A extends { readonly kind: StrategyActionKind; readonly frequencyBps: Bps },
>(actions: readonly A[]): A {
  const first = actions[0];
  invariant(first !== undefined, 'a recommendation needs at least one action');
  let best = first;
  for (const action of actions) {
    if (action.frequencyBps > best.frequencyBps) {
      best = action;
      continue;
    }
    if (
      action.frequencyBps === best.frequencyBps &&
      commitmentRank(action.kind) < commitmentRank(best.kind)
    ) {
      best = action;
    }
  }
  return best;
}

/** Total. Sorts into the canonical least-to-most-committing order. */
export function sortActions<A extends { readonly kind: StrategyActionKind }>(
  actions: readonly A[],
): readonly A[] {
  return [...actions].sort((a, b) => commitmentRank(a.kind) - commitmentRank(b.kind));
}

const PROVENANCE_SEVERITY: Readonly<Record<Provenance, number>> = {
  SOURCE: 0,
  DERIVED: 1,
  HEURISTIC: 2,
};

const PROVENANCE_BY_SEVERITY: readonly Provenance[] = ['SOURCE', 'DERIVED', 'HEURISTIC'];

/** Total. The worst (least trustworthy) of the given provenances. Empty input is `SOURCE`. */
export function worstProvenance(values: readonly Provenance[]): Provenance {
  let severity = 0;
  for (const value of values) severity = Math.max(severity, PROVENANCE_SEVERITY[value]);
  const found = PROVENANCE_BY_SEVERITY[severity];
  invariant(found !== undefined, 'provenance severity out of range');
  return found;
}

/** Total. Moves a provenance `steps` toward HEURISTIC, saturating there. */
export function degradeProvenance(value: Provenance, steps: number): Provenance {
  const severity = Math.min(PROVENANCE_SEVERITY[value] + Math.max(0, steps), 2);
  const found = PROVENANCE_BY_SEVERITY[severity];
  invariant(found !== undefined, 'provenance severity out of range');
  return found;
}

/** Total. Convenience constructor keeping every unused field explicitly null. */
export function feature<Id extends string = ExplanationFeatureId>(
  id: Id,
  parts: {
    readonly token?: string;
    readonly bpsValue?: Bps;
    readonly mbbValue?: MilliBB;
    readonly ratioValue?: number;
    readonly countValue?: number;
  } = {},
): ExplanationFeature<Id> {
  return {
    id,
    token: parts.token ?? null,
    bpsValue: parts.bpsValue ?? null,
    mbbValue: parts.mbbValue ?? null,
    ratioValue: parts.ratioValue ?? null,
    countValue: parts.countValue ?? null,
  };
}
