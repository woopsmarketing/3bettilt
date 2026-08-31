/**
 * The preflop REFERENCE policy — 기본전략 · REFERENCE, never GTO (CLAUDE.md rule 2).
 *
 * Two entry points, one shared core:
 *
 *   `classPolicy(ctx, handClassIndex)`  the table lookup: fold/call/raise frequencies for one
 *                                       of the 169 hand classes in one canonical spot. Pure,
 *                                       total, and the ONLY place a strategy table is read.
 *   `recommendPreflop(query)`           the user-facing answer: the same lookup for hero's
 *                                       actual holding, reconciled with the engine's legal
 *                                       actions, sized, quantized and provenanced.
 *
 * `propagate.ts` calls `classPolicy` for all 169 classes to build villain ranges, so the
 * ranges a later street sees are BY CONSTRUCTION the ones this policy would have produced —
 * there is no second, drifting copy of the strategy.
 *
 * Every table read here lives in `tables.ts`; every rule id and its provenance lives in
 * `rules.ts`. This file contains no numbers of its own except the fold/call/raise mixes,
 * which are all multiples of 500 bps by construction (rule `FREQUENCY_QUANTIZATION`).
 */
import { invariant, Money, ok, type MilliBB } from '@gto-self/shared';
import { asBps, type Bps } from '../bps.js';
import { strategyErr, type StrategyResult } from '../errors.js';
import type { Provenance } from '../provenance.js';
import { comboIndexOf } from '../range/combo.js';
import { handClassOfCombo, type HandClassIndex } from '../range/handClass.js';
import type {
  StrategyActionKind,
  StrategyLegalActions,
  StrategyPosition,
  StrategyQuery,
} from '../types.js';
import { hasHandClass, type HandClassSet } from './notation.js';
import {
  assertClassFrequencies,
  feature,
  pickPrimaryAction,
  quantizeFrequencies,
  sortActions,
  worstProvenance,
  type ClassFrequencies,
  type EnvironmentCompatibility,
  type EnvironmentCompatibilityStatus,
  type EnvironmentFactor,
  type ExplanationFeature,
  type RecommendedAction,
  type RecommendedSizing,
  type StrategyRecommendation,
} from './recommendation.js';
import { preflopRule, type PreflopRuleId } from './rules.js';
import {
  bbVsSbLimpSizing,
  clampSizing,
  fiveBetShoveSizing,
  fourBetSizing,
  isoSizing,
  jamOverAllInSizing,
  rfiSizing,
  squeezeSizing,
  threeBetSizing,
  type SizingRequest,
} from './sizing.js';
import {
  classifyPreflopSpot,
  type HeroRelativePosition,
  type PreflopSpotFamily,
  type PreflopSpotUnsupportedReason,
} from './spot.js';
import {
  ALLIN_CALL_MEDIUM,
  ALLIN_CALL_PREMIUM,
  ALLIN_CALL_TIGHT,
  ALLIN_CALL_WIDE,
  COLD_FOUR_BET_MIXED,
  COLD_FOUR_BET_VALUE,
  DEFEND_MEDIUM,
  DEFEND_TIGHT,
  DEFEND_VERY_WIDE,
  DEFEND_WIDE,
  FALLBACK_CONTINUE,
  FIVE_BET_CALL,
  FIVE_BET_VALUE,
  FOUR_BET_BLUFF,
  FOUR_BET_CALL,
  FOUR_BET_VALUE,
  RFI_HEADS_UP_BUTTON,
  RFI_RANGES,
  SQUEEZE_BLUFF,
  SQUEEZE_CALL,
  SQUEEZE_VALUE,
  THREE_BET_BLUFF,
  THREE_BET_MIXED,
  THREE_BET_VALUE,
} from './tables.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/** The canonical spot, reduced to exactly what a table lookup is allowed to see. */
export interface PreflopPolicyContext {
  readonly family: PreflopSpotFamily | 'UNSUPPORTED';
  readonly unsupportedReason: PreflopSpotUnsupportedReason | null;
  readonly heroPosition: StrategyPosition;
  readonly openerPosition: StrategyPosition | null;
  readonly heroVsAggressor: HeroRelativePosition | null;
  readonly blindVsBlind: boolean;
  readonly limperCount: number;
  readonly coldCallerCount: number;
  readonly lineupSize: number;
  /** `call / (pot + call)` — the equity a call needs. Null when hero is not facing a bet. */
  readonly potOdds: number | null;
  /**
   * The standing aggression is an all-in hero owes chips to. TRUE for `VS_ALLIN` (a collapsed
   * tree) and ALSO for a family that kept its own name because hero can still raise with live
   * players behind — that second case is what `FACING_ALLIN_IN_TREE` answers.
   *
   * REQUIRED. It was introduced optional only so that adding it could not break a constructor
   * outside `src/preflop/**` mid-milestone; every constructor now states it, which is the
   * point — "was there an all-in in front of hero" is not a question a caller should be able
   * to leave unanswered and have defaulted.
   */
  readonly facingAllIn: boolean;
}

/** One class's answer, plus the tokens the explanation needs. */
export interface ClassPolicyOutcome {
  readonly frequencies: ClassFrequencies;
  readonly ruleId: PreflopRuleId;
  /** Which continue tier was consulted, as a stable token. Null when no tier applied. */
  readonly tier: string | null;
  /** Where in that spot's precedence the class landed. */
  readonly membership: 'VALUE' | 'MIXED' | 'BLUFF' | 'CONTINUE' | 'OPEN' | 'OUT_OF_RANGE';
  /**
   * A second rule that ADJUSTED the family's own answer, if any. Reported alongside
   * `ruleId` so a recommendation names every rule that moved a number.
   */
  readonly adjustRuleId?: PreflopRuleId;
}

const freq = (foldBps: number, callBps: number, raiseBps: number): ClassFrequencies =>
  assertClassFrequencies({ foldBps, callBps, raiseBps });

const ALL_FOLD = freq(10000, 0, 0);
const ALL_CALL = freq(0, 10000, 0);
const ALL_RAISE = freq(0, 0, 10000);

interface TierChoice {
  readonly set: HandClassSet;
  readonly token: string;
}

/**
 * The continue tier for a spot where hero faces a single open.
 *
 * HEURISTIC (rule `VS_OPEN_MIX` / `BLIND_VS_BLIND_MIX`). The ONLY sourced input is the
 * direction: S14's pot-odds relationship says the cheapest continue defends widest, which is
 * the big blind closing the action; an out-of-position continue that must act first on every
 * later street is the most expensive and defends tightest.
 */
function defendTier(ctx: PreflopPolicyContext): TierChoice {
  if (ctx.heroPosition === 'BB') return { set: DEFEND_VERY_WIDE, token: 'DEFEND_VERY_WIDE' };
  if (ctx.heroPosition === 'SB') {
    return ctx.family === 'BLIND_VS_BLIND'
      ? { set: DEFEND_MEDIUM, token: 'DEFEND_MEDIUM' }
      : { set: DEFEND_TIGHT, token: 'DEFEND_TIGHT' };
  }
  if (ctx.heroVsAggressor === 'IP') {
    const lateOpener =
      ctx.openerPosition === 'CO' || ctx.openerPosition === 'BTN' || ctx.openerPosition === 'SB';
    return lateOpener
      ? { set: DEFEND_WIDE, token: 'DEFEND_WIDE' }
      : { set: DEFEND_MEDIUM, token: 'DEFEND_MEDIUM' };
  }
  return { set: DEFEND_TIGHT, token: 'DEFEND_TIGHT' };
}

function defendMix(
  ctx: PreflopPolicyContext,
  index: HandClassIndex,
  ruleId: PreflopRuleId,
): ClassPolicyOutcome {
  const tier = defendTier(ctx);
  if (hasHandClass(THREE_BET_VALUE, index)) {
    return { frequencies: ALL_RAISE, ruleId, tier: tier.token, membership: 'VALUE' };
  }
  const inTier = hasHandClass(tier.set, index);
  if (inTier && hasHandClass(THREE_BET_MIXED, index)) {
    return { frequencies: freq(0, 5000, 5000), ruleId, tier: tier.token, membership: 'MIXED' };
  }
  if (inTier && hasHandClass(THREE_BET_BLUFF, index)) {
    return { frequencies: freq(3500, 3500, 3000), ruleId, tier: tier.token, membership: 'BLUFF' };
  }
  if (inTier) {
    return { frequencies: ALL_CALL, ruleId, tier: tier.token, membership: 'CONTINUE' };
  }
  return { frequencies: ALL_FOLD, ruleId, tier: tier.token, membership: 'OUT_OF_RANGE' };
}

/**
 * HEURISTIC (rule `VS_ALLIN_POT_ODDS`). The TIER is chosen by the pot odds the engine already
 * computed — that relationship is the one thing anchor 6 verifies (S14). The four calling
 * ranges themselves are authored, because no public source states which range clears a given
 * equity threshold. Frequencies are 100/0: a mixed call frequency against a shove would be
 * fake precision.
 */
function allInCallTier(potOdds: number | null): TierChoice {
  if (potOdds === null) return { set: ALLIN_CALL_PREMIUM, token: 'ALLIN_CALL_PREMIUM' };
  if (potOdds <= 0.25) return { set: ALLIN_CALL_WIDE, token: 'ALLIN_CALL_WIDE' };
  if (potOdds <= 0.35) return { set: ALLIN_CALL_MEDIUM, token: 'ALLIN_CALL_MEDIUM' };
  if (potOdds <= 0.45) return { set: ALLIN_CALL_TIGHT, token: 'ALLIN_CALL_TIGHT' };
  return { set: ALLIN_CALL_PREMIUM, token: 'ALLIN_CALL_PREMIUM' };
}

function membershipOnly(
  set: HandClassSet,
  index: HandClassIndex,
  hit: ClassFrequencies,
  ruleId: PreflopRuleId,
  token: string,
): ClassPolicyOutcome {
  return hasHandClass(set, index)
    ? { frequencies: hit, ruleId, tier: token, membership: hit === ALL_RAISE ? 'OPEN' : 'CONTINUE' }
    : { frequencies: ALL_FOLD, ruleId, tier: token, membership: 'OUT_OF_RANGE' };
}

/**
 * HEURISTIC (rule `FACING_ALLIN_IN_TREE`). Applied when the standing aggression is an all-in
 * hero owes chips to, but the tree has NOT collapsed — hero can still raise and someone is
 * still behind, so `spot.ts` kept the underlying family.
 *
 * Deterministic, and it never touches the raise bucket:
 *
 *   RAISE  kept exactly as the family assigned it. A premium that would 3-bet, 4-bet or
 *          squeeze here still does; this is the half of the fix that stops AA flatting a
 *          short shove with players still to act.
 *   CALL   kept only when the class also clears the pot-odds tier the price selects. Calling
 *          off against a committed stack is a pure equity question — there are no later
 *          streets to win — and that relationship is the one sourced input available (S14).
 *   FOLD   receives whatever left CALL.
 *
 * Every family mix is already a multiple of 500 bps, and moving one whole bucket into another
 * preserves that, so the result still satisfies `assertClassFrequencies`.
 */
function adjustForAllInInTree(
  ctx: PreflopPolicyContext,
  index: HandClassIndex,
  outcome: ClassPolicyOutcome,
): ClassPolicyOutcome {
  if (outcome.frequencies.callBps === 0) return outcome;
  const tier = allInCallTier(ctx.potOdds);
  if (hasHandClass(tier.set, index)) return outcome;
  return {
    ...outcome,
    frequencies: freq(
      outcome.frequencies.foldBps + outcome.frequencies.callBps,
      0,
      outcome.frequencies.raiseBps,
    ),
    adjustRuleId: 'FACING_ALLIN_IN_TREE',
  };
}

/**
 * Total. The table lookup. Pure in `(ctx, handClassIndex)`, so the same spot always produces
 * the same mix and `propagate.ts` can replay it over all 169 classes.
 */
export function classPolicy(ctx: PreflopPolicyContext, index: HandClassIndex): ClassPolicyOutcome {
  const outcome = familyPolicy(ctx, index);
  // `VS_ALLIN` already IS the collapsed-tree answer; the fallback never authors a raise and
  // must not be second-guessed either.
  if (!ctx.facingAllIn || ctx.family === 'VS_ALLIN' || ctx.family === 'UNSUPPORTED') {
    return outcome;
  }
  return adjustForAllInInTree(ctx, index, outcome);
}

function familyPolicy(ctx: PreflopPolicyContext, index: HandClassIndex): ClassPolicyOutcome {
  switch (ctx.family) {
    case 'RFI': {
      // Heads-up, the only seat that can be first in IS the button — whichever of the two
      // labels `headsUpButtonLabel` gives it. It has nobody behind it, so it opens its own
      // widened table rather than a 6-max seat's list (rule `RFI_HEADS_UP_BUTTON`).
      if (ctx.lineupSize === 2) {
        return membershipOnly(
          RFI_HEADS_UP_BUTTON,
          index,
          ALL_RAISE,
          'RFI_HEADS_UP_BUTTON',
          'RFI_HEADS_UP_BUTTON',
        );
      }
      const table = RFI_RANGES[ctx.heroPosition];
      // The BB has no first-in range: folded to the BB, the hand is over. Reaching here means
      // the line is outside the modelled tree, so the fallback answers instead of another
      // seat's table being borrowed.
      if (table === null) return fallbackOutcome(ctx, index);
      return membershipOnly(table, index, ALL_RAISE, 'RFI_TABLE', `RFI_${ctx.heroPosition}`);
    }
    case 'VS_LIMP': {
      if (ctx.blindVsBlind && ctx.heroPosition === 'BB') {
        const sb = RFI_RANGES.SB;
        invariant(sb !== null, 'the SB raise-only table is always present');
        return membershipOnly(sb, index, ALL_RAISE, 'VS_LIMP_BB_VS_SB', 'RFI_SB');
      }
      // HEURISTIC: iso-raise the hands this seat opens first-in, give up the rest. The BB has
      // no first-in range, so a BB facing limpers uses the tight continue tier instead.
      const table = RFI_RANGES[ctx.heroPosition] ?? DEFEND_TIGHT;
      const token =
        RFI_RANGES[ctx.heroPosition] === null ? 'DEFEND_TIGHT' : `RFI_${ctx.heroPosition}`;
      return membershipOnly(table, index, ALL_RAISE, 'VS_LIMP_ISO', token);
    }
    case 'VS_OPEN':
      return defendMix(ctx, index, 'VS_OPEN_MIX');
    case 'BLIND_VS_BLIND':
      return defendMix(ctx, index, 'BLIND_VS_BLIND_MIX');
    case 'SQUEEZE': {
      const ruleId: PreflopRuleId = 'SQUEEZE_MIX';
      if (hasHandClass(SQUEEZE_VALUE, index)) {
        return { frequencies: ALL_RAISE, ruleId, tier: 'SQUEEZE_VALUE', membership: 'VALUE' };
      }
      if (hasHandClass(SQUEEZE_BLUFF, index)) {
        return {
          frequencies: freq(7000, 0, 3000),
          ruleId,
          tier: 'SQUEEZE_BLUFF',
          membership: 'BLUFF',
        };
      }
      // Cold-calling a raise with callers already in is reserved for position (or for the BB,
      // which closes the action). HEURISTIC.
      const mayCall = ctx.heroVsAggressor === 'IP' || ctx.heroPosition === 'BB';
      if (mayCall && hasHandClass(SQUEEZE_CALL, index)) {
        return { frequencies: ALL_CALL, ruleId, tier: 'SQUEEZE_CALL', membership: 'CONTINUE' };
      }
      return { frequencies: ALL_FOLD, ruleId, tier: 'SQUEEZE_VALUE', membership: 'OUT_OF_RANGE' };
    }
    case 'OPEN_PLUS_CALLER': {
      const ruleId: PreflopRuleId = 'OPEN_PLUS_CALLER_CONTINUE';
      if (hasHandClass(THREE_BET_VALUE, index)) {
        return { frequencies: ALL_RAISE, ruleId, tier: 'THREE_BET_VALUE', membership: 'VALUE' };
      }
      if (hasHandClass(DEFEND_TIGHT, index)) {
        return { frequencies: ALL_CALL, ruleId, tier: 'DEFEND_TIGHT', membership: 'CONTINUE' };
      }
      return { frequencies: ALL_FOLD, ruleId, tier: 'DEFEND_TIGHT', membership: 'OUT_OF_RANGE' };
    }
    case 'OPENER_VS_3BET': {
      const ruleId: PreflopRuleId = 'OPENER_VS_3BET_MIX';
      if (hasHandClass(FOUR_BET_VALUE, index)) {
        return { frequencies: ALL_RAISE, ruleId, tier: 'FOUR_BET_VALUE', membership: 'VALUE' };
      }
      if (hasHandClass(FOUR_BET_BLUFF, index)) {
        return {
          frequencies: freq(5000, 0, 5000),
          ruleId,
          tier: 'FOUR_BET_BLUFF',
          membership: 'BLUFF',
        };
      }
      if (hasHandClass(FOUR_BET_CALL, index)) {
        return { frequencies: ALL_CALL, ruleId, tier: 'FOUR_BET_CALL', membership: 'CONTINUE' };
      }
      return { frequencies: ALL_FOLD, ruleId, tier: 'FOUR_BET_VALUE', membership: 'OUT_OF_RANGE' };
    }
    case 'COLD_4BET': {
      const ruleId: PreflopRuleId = 'COLD_4BET_MIX';
      if (hasHandClass(COLD_FOUR_BET_VALUE, index)) {
        return { frequencies: ALL_RAISE, ruleId, tier: 'COLD_FOUR_BET_VALUE', membership: 'VALUE' };
      }
      if (hasHandClass(COLD_FOUR_BET_MIXED, index)) {
        return {
          frequencies: freq(5000, 0, 5000),
          ruleId,
          tier: 'COLD_FOUR_BET_MIXED',
          membership: 'MIXED',
        };
      }
      return {
        frequencies: ALL_FOLD,
        ruleId,
        tier: 'COLD_FOUR_BET_VALUE',
        membership: 'OUT_OF_RANGE',
      };
    }
    case 'VS_4BET': {
      const ruleId: PreflopRuleId = 'VS_4BET_MIX';
      if (hasHandClass(FIVE_BET_VALUE, index)) {
        return { frequencies: ALL_RAISE, ruleId, tier: 'FIVE_BET_VALUE', membership: 'VALUE' };
      }
      if (hasHandClass(FIVE_BET_CALL, index)) {
        return { frequencies: ALL_CALL, ruleId, tier: 'FIVE_BET_CALL', membership: 'CONTINUE' };
      }
      return { frequencies: ALL_FOLD, ruleId, tier: 'FIVE_BET_VALUE', membership: 'OUT_OF_RANGE' };
    }
    case 'VS_ALLIN': {
      const tier = allInCallTier(ctx.potOdds);
      return membershipOnly(tier.set, index, ALL_CALL, 'VS_ALLIN_POT_ODDS', tier.token);
    }
    case 'UNSUPPORTED':
      return fallbackOutcome(ctx, index);
  }
}

/**
 * HEURISTIC (rule `UNSUPPORTED_SPOT_FALLBACK`). The catch-all so hero always gets an answer
 * in a line `spot.ts` reports UNSUPPORTED — a caller facing a 3-bet, a cold 5-bet, anything
 * beyond a 4-bet. Narrow and passive by design: it never authors a raise in a line this
 * package does not model. When the price is very cheap (pot odds at or under 20%) it widens
 * one step, which is the only sourced relationship available here (S14).
 */
function fallbackOutcome(ctx: PreflopPolicyContext, index: HandClassIndex): ClassPolicyOutcome {
  const cheap = ctx.potOdds !== null && ctx.potOdds <= 0.2;
  const set = cheap ? ALLIN_CALL_MEDIUM : FALLBACK_CONTINUE;
  const token = cheap ? 'ALLIN_CALL_MEDIUM' : 'FALLBACK_CONTINUE';
  return membershipOnly(set, index, ALL_CALL, 'UNSUPPORTED_SPOT_FALLBACK', token);
}

// ---------------------------------------------------------------------------
// Degradation: stack bucket and lineup size
// ---------------------------------------------------------------------------

interface Degradation {
  readonly steps: number;
  readonly forceHeuristic: boolean;
  readonly ruleIds: readonly PreflopRuleId[];
  readonly tokens: readonly string[];
}

function stackDegradation(query: StrategyQuery): Degradation {
  const bucket = query.stackBucket;
  if (bucket.kind === 'OUT_OF_RANGE') {
    return {
      steps: 0,
      forceHeuristic: true,
      ruleIds: ['STACK_BUCKET_OUT_OF_RANGE'],
      tokens: ['OUT_OF_RANGE'],
    };
  }
  switch (bucket.bucket.id) {
    case 'BB_80_119':
      return { steps: 0, forceHeuristic: false, ruleIds: [], tokens: ['BB_80_119'] };
    case 'BB_60_79':
    case 'BB_120_159':
      return {
        steps: 1,
        forceHeuristic: false,
        ruleIds: ['STACK_BUCKET_NEARBY'],
        tokens: [bucket.bucket.id],
      };
    case 'BB_40_59':
    case 'BB_160_PLUS':
      return {
        steps: 0,
        forceHeuristic: true,
        ruleIds: ['STACK_BUCKET_DISTANT'],
        tokens: [bucket.bucket.id],
      };
  }
}

function lineupDegradation(lineupSize: number): Degradation {
  if (lineupSize >= 6) return { steps: 0, forceHeuristic: false, ruleIds: [], tokens: [] };
  if (lineupSize >= 4) {
    return { steps: 1, forceHeuristic: false, ruleIds: ['LINEUP_SHORT_HANDED'], tokens: [] };
  }
  return { steps: 0, forceHeuristic: true, ruleIds: ['LINEUP_VERY_SHORT_HANDED'], tokens: [] };
}

function applyDegradation(value: Provenance, degradations: readonly Degradation[]): Provenance {
  let severity = value === 'SOURCE' ? 0 : value === 'DERIVED' ? 1 : 2;
  for (const degradation of degradations) {
    if (degradation.forceHeuristic) return 'HEURISTIC';
    severity += degradation.steps;
  }
  if (severity >= 2) return 'HEURISTIC';
  return severity === 1 ? 'DERIVED' : 'SOURCE';
}

// ---------------------------------------------------------------------------
// Environment compatibility
// ---------------------------------------------------------------------------

/**
 * Rule `ENVIRONMENT_COMPATIBILITY`. There is no `EXACT` status to reach for: the public
 * charts behind `tables.ts` never state the rake or ante structure they assume, so the best
 * this package can honestly report is APPROXIMATE. NO numeric ante adjustment is applied —
 * anchor 9 found no cash-applicable numeric factor in public sources, and inventing one would
 * be exactly the thing CLAUDE.md rule 2 forbids.
 *
 * Exported because `postflop/policy.ts` reports the same environment facts — the two streets
 * must never drift apart on what the environment IS.
 */
export function environmentCompatibility(query: StrategyQuery): EnvironmentCompatibility {
  const factors: EnvironmentFactor[] = [];
  factors.push({
    id: 'GAME_FORMAT',
    status: 'APPROXIMATE',
    token: 'PUBLIC_6MAX_CASH_100BB_CHARTS',
  });
  factors.push(
    query.environment.anteEnabled
      ? { id: 'ANTE', status: 'DIVERGENT', token: 'ANTE_PRESENT_NO_NUMERIC_ADJUSTMENT' }
      : { id: 'ANTE', status: 'APPROXIMATE', token: 'NO_ANTE' },
  );
  factors.push({
    id: 'RAKE',
    status: 'APPROXIMATE',
    token: query.environment.rake.numerator > 0 ? 'RAKE_NOT_STATED_BY_SOURCE' : 'NO_RAKE',
  });
  const bucket = query.stackBucket;
  const depth: EnvironmentFactor =
    bucket.kind === 'OUT_OF_RANGE'
      ? { id: 'STACK_DEPTH', status: 'DIVERGENT', token: 'BELOW_MODELLED_MINIMUM' }
      : bucket.bucket.id === 'BB_80_119'
        ? { id: 'STACK_DEPTH', status: 'APPROXIMATE', token: 'REFERENCE_BUCKET' }
        : bucket.bucket.id === 'BB_60_79' || bucket.bucket.id === 'BB_120_159'
          ? { id: 'STACK_DEPTH', status: 'APPROXIMATE', token: 'NEARBY_BUCKET' }
          : { id: 'STACK_DEPTH', status: 'DIVERGENT', token: 'DISTANT_BUCKET' };
  factors.push(depth);
  const lineup: EnvironmentFactor =
    query.dealtInCount >= 6
      ? { id: 'LINEUP_SIZE', status: 'APPROXIMATE', token: 'SIX_HANDED' }
      : query.dealtInCount >= 4
        ? { id: 'LINEUP_SIZE', status: 'APPROXIMATE', token: 'SHORT_HANDED' }
        : { id: 'LINEUP_SIZE', status: 'DIVERGENT', token: 'VERY_SHORT_HANDED' };
  factors.push(lineup);
  const status: EnvironmentCompatibilityStatus = factors.some((f) => f.status === 'DIVERGENT')
    ? 'DIVERGENT'
    : 'APPROXIMATE';
  return { status, factors };
}

// ---------------------------------------------------------------------------
// Legality
// ---------------------------------------------------------------------------

/**
 * `allIn.effect` is the ENGINE's word for what putting the last chip in actually does here.
 * When hero cannot cover the outstanding bet, the shove does not raise the price: the engine
 * classifies it `'CALL'`, and it is the same money as `legal.call` down to the milliBB.
 *
 * Such a shove is therefore NOT an independent aggressive action, and `canDo` refuses it —
 * `ALL_IN` appears only in the RAISE chain, so one predicate is enough. Without the check a
 * short hero facing an over-raise got `ALL_IN 100%` for a decision that is a CALL, which
 * reads as aggression the model never chose and hides that hero is simply calling off
 * (R1 M7, the same defect the postflop policy carries at `postflop/policy.ts`). With it, the
 * raise bucket falls through to CALL, whose own `isAllIn` flag already says the call commits
 * hero's whole stack.
 */
const canDo = (legal: StrategyLegalActions, kind: StrategyActionKind): boolean => {
  switch (kind) {
    case 'FOLD':
      return legal.canFold;
    case 'CHECK':
      return legal.canCheck;
    case 'CALL':
      return legal.call !== null;
    case 'RAISE':
      return legal.wager !== null && !legal.wager.onlyAllIn;
    case 'ALL_IN':
      return legal.allIn !== null && legal.allIn.effect !== 'CALL';
    case 'BET':
      return false;
  }
};

/**
 * Rule `LEGALITY_SUBSTITUTION`. Fixed, documented fallback chains, first legal candidate wins.
 *
 * The FOLD chain reaches for CHECK FIRST, before FOLD itself: when continuing costs nothing,
 * a free continue strictly dominates folding, so a table that says "this hand is not in the
 * continue range" must render as a check, never as a fold, in an unraised pot.
 */
const SUBSTITUTIONS: Readonly<Record<'FOLD' | 'CALL' | 'RAISE', readonly StrategyActionKind[]>> = {
  RAISE: ['RAISE', 'ALL_IN', 'CALL', 'CHECK', 'FOLD'],
  CALL: ['CALL', 'CHECK', 'FOLD'],
  FOLD: ['CHECK', 'FOLD', 'CALL'],
};

function resolveKind(
  bucket: 'FOLD' | 'CALL' | 'RAISE',
  legal: StrategyLegalActions,
  raiseIsSizable: boolean,
): StrategyActionKind | null {
  for (const candidate of SUBSTITUTIONS[bucket]) {
    if (candidate === 'RAISE' && !raiseIsSizable) continue;
    if (canDo(legal, candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sizing selection
// ---------------------------------------------------------------------------

function sizingRequestFor(
  ctx: PreflopPolicyContext,
  query: StrategyQuery,
  openSizeMbb: MilliBB | null,
  lastAggressionToMbb: MilliBB | null,
): SizingRequest | null {
  const bb = query.environment.bigBlindMbb;
  const relative: HeroRelativePosition = ctx.heroVsAggressor ?? 'OOP';
  const wager = query.legalActions.wager;
  switch (ctx.family) {
    case 'RFI':
      return rfiSizing(bb, ctx.heroPosition);
    case 'VS_LIMP':
      return ctx.blindVsBlind && ctx.heroPosition === 'BB'
        ? bbVsSbLimpSizing(bb)
        : isoSizing(bb, ctx.heroPosition, ctx.limperCount);
    case 'VS_OPEN':
    case 'BLIND_VS_BLIND':
      return openSizeMbb === null ? null : threeBetSizing(openSizeMbb, relative);
    case 'SQUEEZE':
    case 'OPEN_PLUS_CALLER':
      return openSizeMbb === null
        ? null
        : squeezeSizing(openSizeMbb, relative, ctx.coldCallerCount);
    case 'OPENER_VS_3BET':
    case 'COLD_4BET':
      return lastAggressionToMbb === null ? null : fourBetSizing(lastAggressionToMbb, relative);
    case 'VS_4BET':
      return wager === null ? null : fiveBetShoveSizing(wager);
    case 'VS_ALLIN':
    case 'UNSUPPORTED':
      // Facing a shove there is nothing to size, and the fallback never authors a raise.
      return null;
  }
}

// ---------------------------------------------------------------------------
// The public entry point
// ---------------------------------------------------------------------------

/**
 * Result. The preflop reference recommendation for hero's actual holding.
 *
 * Refuses only for reasons that are about the QUESTION, never about the spot:
 *  - a non-preflop query (`NOT_A_DECISION_POINT`) — this is the preflop policy;
 *  - hero's holding not entered as exactly two cards (`INVALID_HERO_CARDS`) — a class-level
 *    answer needs a class, and guessing one would be inventing the user's hand.
 *
 * A spot the package does not model is NOT a refusal: `spot.ts` reports it UNSUPPORTED and
 * the documented `UNSUPPORTED_SPOT_FALLBACK` answers, so hero always gets a recommendation.
 */
export function recommendPreflop(query: StrategyQuery): StrategyResult<StrategyRecommendation> {
  if (query.street !== 'PREFLOP') {
    return strategyErr(
      'NOT_A_DECISION_POINT',
      'The preflop reference policy was asked about a later street',
      {
        street: query.street,
      },
    );
  }
  if (query.heroCards.length !== 2) {
    return strategyErr(
      'INVALID_HERO_CARDS',
      `A preflop recommendation needs hero's two cards; got ${query.heroCards.length}`,
      { field: 'heroCards', actual: query.heroCards.length, expected: '2' },
    );
  }
  const [first, second] = query.heroCards;
  invariant(first !== undefined && second !== undefined, 'two hero cards were just checked');
  if (first === second) {
    return strategyErr('INVALID_HERO_CARDS', "Hero's two cards are identical", {
      field: 'heroCards',
    });
  }
  const handClass = handClassOfCombo(comboIndexOf(first, second));

  const spot = classifyPreflopSpot(query);
  const ctx: PreflopPolicyContext =
    spot.kind === 'SPOT'
      ? {
          family: spot.family,
          unsupportedReason: null,
          heroPosition: spot.heroPosition,
          openerPosition: spot.openerPosition,
          heroVsAggressor: spot.heroVsAggressor,
          blindVsBlind: spot.blindVsBlind,
          limperCount: spot.limperCount,
          coldCallerCount: spot.coldCallerCount,
          lineupSize: spot.lineupSize,
          potOdds: query.potOdds,
          facingAllIn: spot.facingAllIn,
        }
      : {
          family: 'UNSUPPORTED',
          unsupportedReason: spot.reason,
          heroPosition: spot.heroPosition,
          openerPosition: null,
          heroVsAggressor: null,
          blindVsBlind: false,
          limperCount: 0,
          coldCallerCount: 0,
          lineupSize: query.dealtInCount,
          potOdds: query.potOdds,
          // An UNSUPPORTED line is answered by the passive fallback, which never raises; the
          // all-in adjustment has nothing to adjust there.
          facingAllIn: false,
        };

  const outcome = classPolicy(ctx, handClass.index);

  const openSizeMbb = spot.kind === 'SPOT' ? spot.openSizeMbb : null;
  const lastAggressionToMbb = spot.kind === 'SPOT' ? spot.lastAggressionToMbb : null;
  const wager = query.legalActions.wager;
  const heroSeat = query.seats.find((seat) => seat.isHero);
  const heroStreetContribution: MilliBB = heroSeat?.streetContributionMbb ?? Money.ZERO;

  const baseRequest =
    outcome.frequencies.raiseBps > 0
      ? sizingRequestFor(ctx, query, openSizeMbb, lastAggressionToMbb)
      : null;
  // Raising OVER an all-in: keep the family's size while it leaves a stack behind, jam once
  // it does not (rule `SIZE_FACING_ALLIN_JAM`).
  const request =
    baseRequest !== null && wager !== null && ctx.facingAllIn && ctx.family !== 'VS_ALLIN'
      ? jamOverAllInSizing(baseRequest, wager, heroStreetContribution)
      : baseRequest;
  const sizing: RecommendedSizing | null =
    request !== null && wager !== null ? clampSizing(request, wager) : null;

  // Assemble the raw buckets, then reconcile with legality (rule LEGALITY_SUBSTITUTION).
  const raw: readonly (readonly ['FOLD' | 'CALL' | 'RAISE', number])[] = [
    ['FOLD', outcome.frequencies.foldBps],
    ['CALL', outcome.frequencies.callBps],
    ['RAISE', outcome.frequencies.raiseBps],
  ];
  const merged = new Map<StrategyActionKind, number>();
  let substituted = false;
  for (const [bucket, bps] of raw) {
    if (bps <= 0) continue;
    const kind = resolveKind(bucket, query.legalActions, sizing !== null);
    invariant(kind !== null, 'the engine offered hero no legal action at all');
    if (kind !== bucket) substituted = true;
    merged.set(kind, (merged.get(kind) ?? 0) + bps);
  }

  const kinds = [...merged.keys()];
  const quantized = quantizeFrequencies(kinds.map((kind) => merged.get(kind) ?? 0));
  const actions: RecommendedAction[] = [];
  for (let i = 0; i < kinds.length; i += 1) {
    const kind = kinds[i];
    const frequencyBps = quantized[i];
    invariant(kind !== undefined && frequencyBps !== undefined, 'quantization changed arity');
    if (frequencyBps <= 0) continue;
    actions.push(
      buildAction(kind, frequencyBps, query.legalActions, sizing, heroStreetContribution),
    );
  }
  invariant(actions.length > 0, 'every action was quantized away');
  const ordered = sortActions(actions);
  const primaryAction = pickPrimaryAction(ordered);

  // Provenance.
  const degradations = [stackDegradation(query), lineupDegradation(query.dealtInCount)];
  const policyRule = preflopRule(outcome.ruleId);
  const usedSizing = ordered.some((action) => action.sizing !== null);
  const qualities: Provenance[] = [applyDegradation(policyRule.provenance, degradations)];
  if (outcome.adjustRuleId !== undefined) {
    qualities.push(applyDegradation(preflopRule(outcome.adjustRuleId).provenance, degradations));
  }
  if (usedSizing && sizing !== null) {
    qualities.push(applyDegradation(sizing.provenance, degradations));
  }
  const quality = worstProvenance(qualities);

  const ruleIds: PreflopRuleId[] = [outcome.ruleId];
  if (outcome.adjustRuleId !== undefined) ruleIds.push(outcome.adjustRuleId);
  if (outcome.ruleId === 'RFI_HEADS_UP_BUTTON') ruleIds.push('RFI_SB_RAISE_ONLY_TRIM');
  if (outcome.ruleId === 'RFI_TABLE' && ctx.heroPosition === 'SB') {
    ruleIds.push('RFI_SB_RAISE_ONLY_TRIM');
  }
  if (outcome.ruleId === 'VS_LIMP_BB_VS_SB') ruleIds.push('RFI_SB_RAISE_ONLY_TRIM');
  if (usedSizing && sizing !== null) {
    ruleIds.push(sizing.ruleId);
    if (sizing.clamp !== 'NONE') ruleIds.push('LEGALITY_CLAMP');
  }
  if (substituted) ruleIds.push('LEGALITY_SUBSTITUTION');
  for (const degradation of degradations) ruleIds.push(...degradation.ruleIds);
  ruleIds.push('FREQUENCY_QUANTIZATION', 'PRIMARY_ACTION_TIE_BREAK', 'ENVIRONMENT_COMPATIBILITY');

  const notes = ruleIds
    .map((id) => preflopRule(id))
    .filter((rule) => rule.provenance === 'HEURISTIC' || rule.provenance === 'DERIVED')
    .map((rule) => `${rule.id}: ${rule.rationale}`);
  // `Provenanced<T>` makes a note mandatory for HEURISTIC; the same guarantee is asserted here
  // because the recommendation carries its own provenance rather than wrapping one value.
  invariant(quality !== 'HEURISTIC' || notes.length > 0, 'a HEURISTIC recommendation needs a note');

  return ok({
    kind: 'PreflopRecommendation',
    label: 'REFERENCE',
    street: 'PREFLOP',
    family: ctx.family,
    unsupportedReason: ctx.unsupportedReason,
    heroPosition: ctx.heroPosition,
    handClass,
    actions: ordered,
    primaryAction,
    metrics: {
      spr: query.spr,
      potOdds: query.potOdds,
      requiredEquity: query.potOdds,
      potBeforeDecisionMbb: query.potBeforeDecisionMbb,
      callAmountMbb: query.callAmountMbb,
      effectiveStackMbb: query.effectiveStackMbb,
      stackBucket: query.stackBucket,
    },
    provenance: {
      quality,
      ruleIds,
      environmentCompatibility: environmentCompatibility(query),
      notes,
    },
    explanation: {
      features: explanationFeatures(ctx, query, outcome, sizing, handClass.key, degradations),
    },
  });
}

function buildAction(
  kind: StrategyActionKind,
  frequencyBps: Bps,
  legal: StrategyLegalActions,
  sizing: RecommendedSizing | null,
  heroStreetContributionMbb: MilliBB,
): RecommendedAction {
  switch (kind) {
    case 'FOLD':
    case 'CHECK':
      return {
        kind,
        frequencyBps,
        toAmountMbb: null,
        amountMbb: null,
        isAllIn: false,
        sizing: null,
      };
    case 'CALL': {
      const call = legal.call;
      invariant(call !== null, 'CALL was selected but the engine offers none');
      return {
        kind,
        frequencyBps,
        toAmountMbb: call.toAmountMbb,
        amountMbb: call.amountMbb,
        isAllIn: call.isAllIn,
        sizing: null,
      };
    }
    case 'ALL_IN': {
      const allIn = legal.allIn;
      invariant(allIn !== null, 'ALL_IN was selected but the engine offers none');
      return {
        kind,
        frequencyBps,
        toAmountMbb: allIn.toAmountMbb,
        amountMbb: allIn.amountMbb,
        isAllIn: true,
        sizing: null,
      };
    }
    case 'RAISE': {
      invariant(sizing !== null, 'RAISE was selected without a sizing');
      const isAllIn = legal.allIn !== null && legal.allIn.toAmountMbb === sizing.toAmountMbb;
      return {
        kind,
        frequencyBps,
        toAmountMbb: sizing.toAmountMbb,
        amountMbb: Money.sub(sizing.toAmountMbb, heroStreetContributionMbb),
        isAllIn,
        sizing,
      };
    }
    case 'BET':
      invariant(false, 'BET is not a preflop action');
  }
}

function explanationFeatures(
  ctx: PreflopPolicyContext,
  query: StrategyQuery,
  outcome: ClassPolicyOutcome,
  sizing: RecommendedSizing | null,
  handClassKey: string,
  degradations: readonly Degradation[],
): readonly ExplanationFeature[] {
  const features: ExplanationFeature[] = [
    feature('SPOT_FAMILY', { token: ctx.family }),
    feature('HERO_POSITION', { token: ctx.heroPosition }),
    feature('HAND_CLASS', { token: handClassKey }),
    feature('RANGE_MEMBERSHIP', { token: outcome.membership }),
    feature('LINEUP_SIZE', { countValue: ctx.lineupSize }),
  ];
  if (ctx.unsupportedReason !== null) {
    features.push(feature('UNSUPPORTED_REASON', { token: ctx.unsupportedReason }));
  }
  if (outcome.tier !== null) features.push(feature('CONTINUE_TIER', { token: outcome.tier }));
  if (ctx.openerPosition !== null) {
    features.push(feature('OPENER_POSITION', { token: ctx.openerPosition }));
  }
  if (ctx.heroVsAggressor !== null) {
    features.push(feature('RELATIVE_POSITION', { token: ctx.heroVsAggressor }));
  }
  if (ctx.blindVsBlind) features.push(feature('BLIND_VS_BLIND', { token: 'TRUE' }));
  if (ctx.limperCount > 0) features.push(feature('LIMPER_COUNT', { countValue: ctx.limperCount }));
  if (ctx.coldCallerCount > 0) {
    features.push(feature('COLD_CALLER_COUNT', { countValue: ctx.coldCallerCount }));
  }
  const bucketToken = degradations[0]?.tokens[0];
  if (bucketToken !== undefined) {
    features.push(
      feature('STACK_BUCKET', {
        token: bucketToken,
        mbbValue: query.stackBucket.effectiveStackMbb,
      }),
    );
    if (bucketToken === 'OUT_OF_RANGE') {
      features.push(
        feature('UNMODELLED_STACK_DEPTH', { mbbValue: query.stackBucket.effectiveStackMbb }),
      );
    }
  }
  if (query.spr !== null) features.push(feature('SPR', { ratioValue: query.spr }));
  if (query.potOdds !== null) features.push(feature('POT_ODDS', { ratioValue: query.potOdds }));
  if (sizing !== null) {
    features.push(feature('SIZING_RULE', { token: sizing.ruleId, mbbValue: sizing.toAmountMbb }));
    if (sizing.clamp !== 'NONE') {
      features.push(
        feature('SIZING_CLAMPED', {
          token: sizing.clamp,
          mbbValue: sizing.requestedToAmountMbb,
        }),
      );
    }
  }
  // Reported for a collapsed shove AND for one hero can still raise over, so the panel never
  // has to infer "there is an all-in in front of me" from the family name alone.
  if (ctx.facingAllIn || ctx.family === 'VS_ALLIN') {
    features.push(
      feature('FACING_ALL_IN', {
        // 'TRUE' is the collapsed shove this feature has always meant; the second token is
        // the new case — an all-in hero can still raise over.
        token: ctx.family === 'VS_ALLIN' ? 'TRUE' : 'RAISE_STILL_AVAILABLE',
      }),
    );
  }
  if (outcome.ruleId === 'RFI_HEADS_UP_BUTTON') {
    features.push(feature('HEADS_UP_BUTTON_APPROXIMATION', { token: 'WIDENED_FLOOR' }));
  }
  // Hero cannot cover the outstanding bet: a call here puts the WHOLE stack in. The engine
  // reports that shove as `effect: 'CALL'`, so it is never emitted as an aggressive ALL_IN
  // row (R1 M7) — the explanation carries the fact instead.
  const call = query.legalActions.call;
  if (call !== null && call.isAllIn) {
    features.push(feature('CALL_COMMITS_STACK', { mbbValue: call.amountMbb }));
  }
  return features;
}

/** Re-exported so callers can build a context without importing the whole policy module. */
export const REFERENCE_LABEL = 'REFERENCE' as const;

/** Total. The frequency, in bps, this policy assigns one action bucket for one class. */
export function classFrequencyBps(
  ctx: PreflopPolicyContext,
  index: HandClassIndex,
  bucket: 'FOLD' | 'CALL' | 'RAISE',
): Bps {
  const outcome = classPolicy(ctx, index);
  const value =
    bucket === 'FOLD'
      ? outcome.frequencies.foldBps
      : bucket === 'CALL'
        ? outcome.frequencies.callBps
        : outcome.frequencies.raiseBps;
  return asBps(value);
}
