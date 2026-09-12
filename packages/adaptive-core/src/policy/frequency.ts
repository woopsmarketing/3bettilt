/**
 * The frequency pass: opponent profile + REFERENCE mix -> ADAPTIVE mix.
 *
 * CONTROL FLOW AND INTEGER ARITHMETIC ONLY. Every gain, ceiling, gate and cap comes from
 * `frequencyModel.ts`; the quantizer, the primary-action tie-break and the apportionment all
 * come from `@gto-self/strategy-core`. Nothing in this file is a policy number and nothing in
 * it re-implements a REFERENCE mechanism.
 *
 * ---------------------------------------------------------------------------------------
 * THE PIPELINE (WP-J design contract §4.2 and §4.3), integer basis points end to end
 *
 *  1. EVALUATE. Walk the twelve rules in table order. A rule is skipped unless the street, the
 *     spot scope and the hand-strength band all match, the stat resolves on this street, the
 *     stat's confidence clears `FREQUENCY_MIN_CONFIDENCE_BPS`, and the deviation is on the side
 *     the rule fires from. Then:
 *         raw    = floor(|dev| * gainBps / 10000)
 *         scaled = floor(raw * confidenceBps / 10000)
 *         capped = min(scaled, rule.maxBps)
 *     A rule whose `capped` is 0 is DROPPED — an explanation line that moved nothing is noise.
 *
 *  2. LIMIT, in a fixed order, each limiter recorded in `cappedBy`:
 *         TARGET_ABSENT             the baseline has no row on one side of the transfer
 *         AGGRESSIVE_PLAYER_BEHIND  the §9 guard refuses POSITIVE aggression
 *         TOTAL_SHIFT               the whole set is scaled to fit the global cap
 *     A rule zeroed by a limiter is KEPT, unlike one dropped in step 1: "we wanted to bet more
 *     and refused because of the player behind you" is the single most useful thing this layer
 *     can say, and it is unsayable if the rule vanishes.
 *
 *  3. APPLY. Sum the surviving contributions per target and move that much mass onto the
 *     target's actions, taking it PRO RATA from the other targets' actions. Each transfer is
 *     zero-sum, so the set still totals 10000 however many targets fired.
 *
 *  4. NORMALIZE. Floor every action at 0 and re-apportion to exactly 10000.
 *
 *  5. QUANTIZE with `quantizeFrequenciesToGrid` at ADAPTIVE's own 1%/100-bps grid (WP-K §5 —
 *     finer than REFERENCE's 5%, using the same apportionment logic, not a copy of it) — and
 *     re-pick the primary with `pickPrimaryAction`, so the ADAPTIVE answer is a real percentage.
 *
 *  6. TRIM. Quantization can round a set that was inside the global cap to one just outside it
 *     (every rounding is under 100 bps, but they can accumulate across rows). If that happens,
 *     move whole 100-bps units back from the most-increased row to the most-decreased row until
 *     the cap holds. Each move reduces the shift by exactly 100 and preserves both the grid and
 *     the sum, so it terminates, and it cannot introduce a kind that did not already move.
 *
 * ---------------------------------------------------------------------------------------
 * TWO HARD INVARIANTS, BOTH STRUCTURAL RATHER THAN CHECKED
 *
 * ADAPTIVE NEVER INTRODUCES AN ACTION KIND THE BASELINE DOES NOT CONTAIN. The working vector is
 * indexed by the baseline's own rows and no row is ever appended, so a kind REFERENCE gave no
 * row at all stays absent. (MVP limitation: it also means ADAPTIVE cannot turn a 0%-frequency
 * FOLD into a real fold if REFERENCE omitted the row entirely. Recorded in the report.)
 *
 * NO AMOUNT IS EVER PRODUCED FOR A ROW THAT HAD NONE. `toAmountMbb` and `isAllIn` are echoed
 * from the baseline row, never computed here; the size pass is separate and moves only the
 * sizing record.
 * ---------------------------------------------------------------------------------------
 */
import {
  BPS_TOTAL,
  apportion,
  clampBps,
  pickPrimaryAction,
  quantizeFrequenciesToGrid,
  type Bps,
} from '@gto-self/strategy-core';
import {
  ADAPTIVE_TARGETS,
  strengthCategoryFor,
  targetForKind,
  type AdaptiveBaseline,
  type AdaptiveTarget,
} from '../baseline.js';
import type { AdaptiveStatEstimate, PlayerAdjustmentProfile } from '../profile.js';
import type { BehindAggressionFinding } from '../multiway.js';
import type { AdaptiveAction, AdaptiveAdjustment } from '../recommendation.js';
import type { AdaptiveStatKey } from '../stats.js';
import {
  ADAPTIVE_FREQUENCY_RULES,
  FREQUENCY_MIN_CONFIDENCE_BPS,
  maxTotalShiftBpsFor,
  resolveStat,
  type AdaptiveFrequencyRule,
} from './frequencyModel.js';
import { adaptiveNote, type AdaptiveCapId, type AdaptiveNote } from './reasons.js';
import { scopeMatches } from './scope.js';

/* -------------------------------------------------------------------------- */
/* Result shape                                                                */
/* -------------------------------------------------------------------------- */

export interface FrequencyAdaptation {
  readonly actions: readonly AdaptiveAction[];
  readonly primaryAction: AdaptiveAction | null;
  readonly adjustments: readonly AdaptiveAdjustment[];
  readonly totalShiftBps: number;
  readonly capApplied: boolean;
  readonly notes: readonly AdaptiveNote[];
}

/** Internal. One rule that survived evaluation, with its running contribution and limiter. */
interface Candidate {
  readonly rule: AdaptiveFrequencyRule;
  readonly stat: AdaptiveStatKey;
  readonly estimate: AdaptiveStatEstimate;
  /** Signed, before confidence scaling and every cap. */
  readonly rawSigned: number;
  /** Signed, mutated as each limiter is applied. */
  contributionSigned: number;
  cappedBy: AdaptiveCapId | null;
}

/* -------------------------------------------------------------------------- */
/* Small integer helpers                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Total. `floor(value * factorBps / 10000)` for a NON-NEGATIVE value.
 *
 * Floor, never round, and the design contract says so twice: an exploit that rounds up is an
 * exploit that overstates itself, and doing it at two consecutive steps would compound.
 */
const scaleDownBps = (value: number, factorBps: number): number =>
  Math.floor((value * factorBps) / BPS_TOTAL);

/**
 * Total. The same scaling for a SIGNED value, truncating toward zero so the magnitude can only
 * shrink. `Math.floor` on a negative number moves AWAY from zero, which would make the global
 * cap increase a de-escalating contribution.
 */
const scaleDownSigned = (value: number, factorBps: number): number =>
  Math.trunc((value * factorBps) / BPS_TOTAL);

/** Total. `sum(|a - b|) / 2`. Both vectors are the same length and sum to the same total. */
function shiftBetween(a: readonly number[], b: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return Math.floor(total / 2);
}

/**
 * Total. Splits `amount` over `indices` in proportion to `weights`, exactly, as integers.
 *
 * Falls back to an EQUAL split when every weight is zero. That case is real: REFERENCE can emit
 * a row with a 0% frequency (the action is legal, the policy simply never takes it), and a
 * target made entirely of such rows has no proportion to divide by. An equal split is the only
 * distribution the input supports, and it still cannot introduce a kind — every index it writes
 * to was already a baseline row.
 */
function distribute(
  amount: number,
  indices: readonly number[],
  weights: readonly number[],
): readonly number[] {
  if (indices.length === 0 || amount <= 0) return indices.map(() => 0);
  const proportional = apportion(weights, amount);
  if (proportional.ok) return proportional.value;
  const equal = apportion(
    indices.map(() => 1),
    amount,
  );
  return equal.ok ? equal.value : indices.map(() => 0);
}

/* -------------------------------------------------------------------------- */
/* 1. Evaluating the rule table                                                */
/* -------------------------------------------------------------------------- */

/** Total. `true` when the deviation is on the side the rule fires from. Zero never fires. */
function directionMatches(rule: AdaptiveFrequencyRule, deviationBps: number): boolean {
  return rule.direction === 'ABOVE_PRIOR' ? deviationBps > 0 : deviationBps < 0;
}

/** Total. `true` when the rule's band condition is satisfied by the baseline's own band. */
function bandMatches(rule: AdaptiveFrequencyRule, baseline: AdaptiveBaseline): boolean {
  if (rule.bands === null) return true;
  const category = strengthCategoryFor(baseline.aggressionBand);
  return category !== null && rule.bands.includes(category);
}

/**
 * The outcome of walking the table: the rules that fired, and whether ANY rule was even in
 * scope for this spot.
 *
 * The second number is what lets `INSUFFICIENT_DATA` say something true. "No rule cleared the
 * confidence gate" and "no rule in the table is about a spot like this one" are different
 * answers to the user, and reporting the first when the second is the case would send them
 * looking for more hands that would never help.
 */
interface RuleEvaluation {
  readonly candidates: Candidate[];
  readonly inScopeCount: number;
}

/**
 * Total. Every rule that fires against this profile in this spot, in rule-table order.
 *
 * Rules are read ONLY from the PRIMARY villain's profile (design contract §9). No other
 * opponent's numbers reach this function; the others can only ever refuse a contribution
 * through the guard rail, never create one.
 */
function evaluateRules(
  baseline: AdaptiveBaseline,
  profile: PlayerAdjustmentProfile,
): RuleEvaluation {
  const candidates: Candidate[] = [];
  let inScopeCount = 0;
  for (const rule of ADAPTIVE_FREQUENCY_RULES) {
    if (!rule.streets.includes(baseline.street)) continue;
    if (!scopeMatches(rule.appliesWhen, baseline)) continue;
    if (!bandMatches(rule, baseline)) continue;

    const stat = resolveStat(rule.stat, baseline.street);
    if (stat === null) continue;
    inScopeCount += 1;

    const estimate = profile.stats[stat];
    if (estimate.confidenceBps < FREQUENCY_MIN_CONFIDENCE_BPS) continue;
    if (!directionMatches(rule, estimate.deviationBps)) continue;

    const raw = scaleDownBps(Math.abs(estimate.deviationBps), rule.gainBps);
    const scaled = scaleDownBps(raw, estimate.confidenceBps);
    const capped = Math.min(scaled, rule.maxBps);
    // A rule that would move nothing is dropped rather than shown as an empty reason line.
    if (capped === 0) continue;

    const sign = rule.effect === 'INCREASE' ? 1 : -1;
    candidates.push({
      rule,
      stat,
      estimate,
      rawSigned: sign * raw,
      contributionSigned: sign * capped,
      cappedBy: capped < scaled ? 'RULE_MAX' : null,
    });
  }
  return { candidates, inScopeCount };
}

/* -------------------------------------------------------------------------- */
/* 2. Limiters                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Internal. Zeroes every candidate whose target has no baseline row to move mass to, or no
 * other row to take it from. Both halves matter: a `+FOLD` contribution is unusable when hero
 * has no fold row, and equally unusable when FOLD is the ONLY row.
 */
function applyTargetAbsent(
  candidates: readonly Candidate[],
  usable: ReadonlySet<AdaptiveTarget>,
): void {
  for (const candidate of candidates) {
    if (candidate.contributionSigned === 0) continue;
    if (usable.has(candidate.rule.target)) continue;
    candidate.contributionSigned = 0;
    candidate.cappedBy = 'TARGET_ABSENT';
  }
}

/**
 * Internal. THE J9 GUARD RAIL, applied. Zeroes every POSITIVE `AGGRESSION` contribution and
 * leaves everything else — negative aggression, CONTINUE and FOLD — untouched.
 */
function applyBehindGuard(
  candidates: readonly Candidate[],
  finding: BehindAggressionFinding,
): boolean {
  if (!finding.tripped) return false;
  let fired = false;
  for (const candidate of candidates) {
    if (candidate.rule.target !== 'AGGRESSION') continue;
    if (candidate.contributionSigned <= 0) continue;
    candidate.contributionSigned = 0;
    candidate.cappedBy = 'AGGRESSIVE_PLAYER_BEHIND';
    fired = true;
  }
  return fired;
}

/* -------------------------------------------------------------------------- */
/* 3-4. Applying contributions to the mix                                      */
/* -------------------------------------------------------------------------- */

/** Internal. Net signed contribution per target. */
function netsByTarget(candidates: readonly Candidate[]): Readonly<Record<AdaptiveTarget, number>> {
  const nets: Record<AdaptiveTarget, number> = { AGGRESSION: 0, CONTINUE: 0, FOLD: 0 };
  for (const candidate of candidates) {
    nets[candidate.rule.target] += candidate.contributionSigned;
  }
  return nets;
}

/**
 * Internal. Moves `net` bps onto (or, when negative, off) `target`'s rows, taking it pro rata
 * from the rows of the other two targets. Zero-sum by construction, so the vector's total is
 * unchanged however many targets are applied in sequence.
 */
function applyTransfer(
  working: number[],
  baselineFrequencies: readonly number[],
  targetOf: readonly AdaptiveTarget[],
  target: AdaptiveTarget,
  net: number,
): void {
  if (net === 0) return;
  const inTarget: number[] = [];
  const outTarget: number[] = [];
  for (let i = 0; i < targetOf.length; i += 1) {
    if (targetOf[i] === target) inTarget.push(i);
    else outTarget.push(i);
  }
  if (inTarget.length === 0 || outTarget.length === 0) return;

  const amount = Math.abs(net);
  const gainers = net > 0 ? inTarget : outTarget;
  const givers = net > 0 ? outTarget : inTarget;
  const added = distribute(
    amount,
    gainers,
    gainers.map((i) => baselineFrequencies[i] ?? 0),
  );
  const taken = distribute(
    amount,
    givers,
    givers.map((i) => baselineFrequencies[i] ?? 0),
  );
  for (let k = 0; k < gainers.length; k += 1) {
    const index = gainers[k] ?? 0;
    working[index] = (working[index] ?? 0) + (added[k] ?? 0);
  }
  for (let k = 0; k < givers.length; k += 1) {
    const index = givers[k] ?? 0;
    working[index] = (working[index] ?? 0) - (taken[k] ?? 0);
  }
}

/**
 * Internal. Floors at 0 and re-apportions to exactly 10000.
 *
 * The two fallbacks are for malformed input only: an all-zero adjusted vector falls back to the
 * baseline, and an all-zero baseline falls back to an equal split. The REFERENCE engine cannot
 * produce either, and the entry point is total, so both branches exist rather than a throw.
 */
function normalize(values: readonly number[], baselineFrequencies: readonly number[]): number[] {
  const floored = values.map((value) => (value > 0 ? value : 0));
  const apportioned = apportion(floored, BPS_TOTAL);
  if (apportioned.ok) return apportioned.value;
  const fallback = apportion(
    baselineFrequencies.map((value) => (value > 0 ? value : 0)),
    BPS_TOTAL,
  );
  if (fallback.ok) return fallback.value;
  const equal = apportion(
    values.map(() => 1),
    BPS_TOTAL,
  );
  return equal.ok ? equal.value : values.map(() => 0);
}

/** Internal. Steps 3 and 4 together: the mix implied by the current contributions. */
function project(
  candidates: readonly Candidate[],
  baselineFrequencies: readonly number[],
  targetOf: readonly AdaptiveTarget[],
): number[] {
  const nets = netsByTarget(candidates);
  const working = [...baselineFrequencies];
  for (const target of ADAPTIVE_TARGETS) {
    applyTransfer(working, baselineFrequencies, targetOf, target, nets[target]);
  }
  return normalize(working, baselineFrequencies);
}

/* -------------------------------------------------------------------------- */
/* 6. The post-quantization grid trim                                          */
/* -------------------------------------------------------------------------- */

/**
 * ADAPTIVE's display grid — 1%, finer than REFERENCE's own 5% (WP-K §5) — and the number of
 * whole units in a full mix. Used by both the quantize step and the trim.
 */
const GRID_STEP_BPS = 100;
const GRID_UNIT_COUNT = BPS_TOTAL / GRID_STEP_BPS;

/**
 * Internal. Moves whole grid units back toward the baseline until the shift is inside `cap`.
 *
 * Each iteration takes one 100-bps unit from the most-increased row and gives it to the
 * most-decreased row, which reduces the shift by exactly 100 and leaves both the grid and the
 * 10000 total intact. Ties go to the LOWER index, matching `apportion`'s own tie-break and the
 * canonical least-committing-first action order, so the unit that comes back first is the one
 * on the least aggressive row.
 *
 * TERMINATES, AND NEVER MAKES THINGS WORSE. Each move is taken only if it STRICTLY reduces the
 * measured shift; a move that does not is undone and the loop stops. The loop is additionally
 * bounded by the number of grid units in a whole mix, so it cannot spin either way.
 *
 * THE STRICTNESS CHECK IS A NET FOR AN UNREACHABLE CASE, AND IS LABELLED AS ONE (review R1,
 * MINOR 10). "One 100-bps move reduces the shift by exactly 100" holds only while
 * `baselineFrequencies` sit on the same 100 grid the quantized mix does. Every mix this pass
 * emits does (step 5 quantizes onto it first), and `baseline.ts` deliberately declines to
 * ASSERT it upstream — a caller that hands over a malformed set gets a normalized answer, not
 * an exception. A move can only make the shift WORSE when the chosen row's own |delta| is under
 * 50 on BOTH sides; since the deltas on each side sum to more than the cap (or the loop would
 * not be running), that needs many rows per side to occur — a baseline has at most six
 * (FOLD/CHECK/CALL/BET/RAISE/ALL_IN), so the case cannot occur at this table. It is guarded
 * anyway because the alternative failure is silent, and because the row count is REFERENCE's
 * to change, not this file's. Do not read this branch as a tested path: it is not reachable,
 * and `cap.test.ts` says so rather than pretending to cover it.
 */
function trimToCap(
  quantized: number[],
  baselineFrequencies: readonly number[],
  cap: number,
): boolean {
  let trimmed = false;
  for (let guard = 0; guard <= GRID_UNIT_COUNT; guard += 1) {
    if (shiftBetween(quantized, baselineFrequencies) <= cap) return trimmed;
    let from = -1;
    let fromExcess = 0;
    let to = -1;
    let toDeficit = 0;
    for (let i = 0; i < quantized.length; i += 1) {
      const delta = (quantized[i] ?? 0) - (baselineFrequencies[i] ?? 0);
      if (delta > fromExcess) {
        fromExcess = delta;
        from = i;
      } else if (-delta > toDeficit) {
        toDeficit = -delta;
        to = i;
      }
    }
    if (from < 0 || to < 0) return trimmed;
    const before = shiftBetween(quantized, baselineFrequencies);
    quantized[from] = (quantized[from] ?? 0) - GRID_STEP_BPS;
    quantized[to] = (quantized[to] ?? 0) + GRID_STEP_BPS;
    if (shiftBetween(quantized, baselineFrequencies) >= before) {
      // No progress: undo and stop, rather than keep moving mass around to no effect.
      quantized[from] = (quantized[from] ?? 0) + GRID_STEP_BPS;
      quantized[to] = (quantized[to] ?? 0) - GRID_STEP_BPS;
      return trimmed;
    }
    trimmed = true;
  }
  return trimmed;
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

/** Internal. The baseline mix echoed verbatim, for the INSUFFICIENT_DATA and no-rule paths. */
function echoBaseline(baseline: AdaptiveBaseline): readonly AdaptiveAction[] {
  return baseline.actions.map((action) => ({
    kind: action.kind,
    frequencyBps: clampBps(action.frequencyBps),
    deltaBps: 0,
    toAmountMbb: action.toAmountMbb,
    isAllIn: action.isAllIn,
  }));
}

/** Internal. The unchanged result, used whenever nothing fires. */
function unchanged(
  baseline: AdaptiveBaseline,
  notes: readonly AdaptiveNote[],
): FrequencyAdaptation {
  const actions = echoBaseline(baseline);
  return {
    actions,
    primaryAction: actions.length === 0 ? null : pickPrimaryAction(actions),
    adjustments: [],
    totalShiftBps: 0,
    capApplied: false,
    notes,
  };
}

/**
 * Total. The frequency pass. Never throws for a data-shaped reason: an empty action set, a
 * malformed mix, a missing profile and an all-zero sample all have documented answers.
 *
 * `primary` is the PRIMARY villain's profile, or `null` when no opponent could be named. With
 * no primary there is no rule to fire, and the baseline is echoed.
 */
export function adaptFrequencies(
  baseline: AdaptiveBaseline,
  primary: PlayerAdjustmentProfile | null,
  behindFinding: BehindAggressionFinding,
): FrequencyAdaptation {
  if (baseline.actions.length === 0) {
    return unchanged(baseline, [adaptiveNote('BASELINE_HAS_NO_ACTIONS')]);
  }
  if (primary === null) {
    return unchanged(baseline, [adaptiveNote('NO_PRIMARY_OPPONENT')]);
  }

  const { candidates, inScopeCount } = evaluateRules(baseline, primary);
  if (candidates.length === 0) {
    return unchanged(baseline, [
      inScopeCount === 0
        ? adaptiveNote('NO_RULE_APPLIED_TO_SPOT')
        : adaptiveNote('FREQUENCY_CONFIDENCE_GATE_NOT_MET', String(FREQUENCY_MIN_CONFIDENCE_BPS)),
    ]);
  }

  const baselineFrequencies = baseline.actions.map((action) => Math.max(0, action.frequencyBps));
  const targetOf = baseline.actions.map((action) => targetForKind(action.kind));

  // A target is usable only when the baseline has a row on BOTH sides of the transfer.
  const usableTargets = new Set<AdaptiveTarget>(
    ADAPTIVE_TARGETS.filter(
      (target) =>
        targetOf.some((value) => value === target) && targetOf.some((value) => value !== target),
    ),
  );
  applyTargetAbsent(candidates, usableTargets);
  const guardFired = applyBehindGuard(candidates, behindFinding);

  const notes: AdaptiveNote[] = [];
  if (guardFired) {
    notes.push(adaptiveNote('AGGRESSIVE_PLAYER_BEHIND', behindFinding.stat ?? null));
  }

  const cap = maxTotalShiftBpsFor(baseline.activeOpponentCount);
  let capApplied = false;

  // Step 2's global cap: measure the mix the contributions imply, and if it moved too far,
  // scale EVERY contribution by the same ratio so the mix stays proportional rather than
  // having one rule truncated to make room.
  const firstPass = project(candidates, baselineFrequencies, targetOf);
  const firstShift = shiftBetween(firstPass, baselineFrequencies);
  if (firstShift > cap) {
    const ratioBps = Math.floor((cap * BPS_TOTAL) / firstShift);
    for (const candidate of candidates) {
      const scaledDown = scaleDownSigned(candidate.contributionSigned, ratioBps);
      if (scaledDown !== candidate.contributionSigned) {
        candidate.contributionSigned = scaledDown;
        candidate.cappedBy = 'TOTAL_SHIFT';
      }
    }
    capApplied = true;
  }

  const projected =
    firstShift > cap ? project(candidates, baselineFrequencies, targetOf) : firstPass;
  const quantized: number[] = [...quantizeFrequenciesToGrid(projected, GRID_STEP_BPS)];
  if (trimToCap(quantized, baselineFrequencies, cap)) capApplied = true;
  if (capApplied) notes.push(adaptiveNote('TOTAL_SHIFT_CAP_APPLIED', String(cap)));

  const actions: AdaptiveAction[] = baseline.actions.map((action, index) => {
    const frequencyBps: Bps = clampBps(quantized[index] ?? 0);
    return {
      kind: action.kind,
      frequencyBps,
      deltaBps: frequencyBps - (baselineFrequencies[index] ?? 0),
      toAmountMbb: action.toAmountMbb,
      isAllIn: action.isAllIn,
    };
  });

  const adjustments: AdaptiveAdjustment[] = candidates.map((candidate) => ({
    ruleId: candidate.rule.id,
    ruleKind: 'FREQUENCY',
    stat: candidate.stat,
    priorBps: candidate.estimate.priorBps,
    observedBps: candidate.estimate.observedBps,
    estimateBps: candidate.estimate.estimateBps,
    deviationBps: candidate.estimate.deviationBps,
    sampleN: candidate.estimate.sampleN,
    confidenceBps: candidate.estimate.confidenceBps,
    confidenceState: candidate.estimate.confidenceState,
    sources: candidate.estimate.sources,
    target: candidate.rule.target,
    rawContributionBps: candidate.rawSigned,
    contributionBps: candidate.contributionSigned,
    sizingSteps: null,
    cappedBy: candidate.cappedBy,
    reasonKey: candidate.rule.reasonKey,
    note: candidate.rule.note,
    opponentPlayerId: primary.playerId,
  }));

  return {
    actions,
    primaryAction: pickPrimaryAction(actions),
    adjustments,
    totalShiftBps: shiftBetween(quantized, baselineFrequencies),
    capApplied,
    notes,
  };
}
