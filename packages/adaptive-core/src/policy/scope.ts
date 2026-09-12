/**
 * The `AdaptiveRuleScope` predicates: does hero's spot look like the one a rule describes?
 *
 * These are CONTROL FLOW, not model numbers — each one is a question about the baseline the
 * caller handed over ("does this action set contain an aggressive row?"), never a threshold or
 * a weight. That is why they live beside the logic rather than in `frequencyModel.ts`, and it
 * is the same split `scoreModel.ts` / `score.ts` uses.
 *
 * The record is EXHAUSTIVE over `AdaptiveRuleScope`, so a new scope token cannot be added to
 * the rule table without a predicate being written for it.
 */
import { heroMayAggress, heroMayBet, type AdaptiveBaseline } from '../baseline.js';
import { STEAL_POSITIONS, type AdaptiveRuleScope } from './frequencyModel.js';

/**
 * Every scope's predicate.
 *
 * Note what NONE of them do: none consults poker order, position order, or anything about the
 * hand beyond the baseline's own fields. `PREFLOP_HERO_OPENING` reads the caller-supplied
 * `heroIsPreflopOpener` rather than inferring "opening" from `!heroFacingBet`, because those
 * are not the same thing and guessing would be inventing poker behaviour (CLAUDE.md rule 7).
 */
export const ADAPTIVE_SCOPE_PREDICATES: Readonly<
  Record<AdaptiveRuleScope, (baseline: AdaptiveBaseline) => boolean>
> = {
  HERO_MAY_AGGRESS: (baseline) => heroMayAggress(baseline),
  HERO_MAY_BET: (baseline) => heroMayBet(baseline),
  HERO_FACING_BET: (baseline) => baseline.heroFacingBet,
  PREFLOP_HERO_OPENING: (baseline) => baseline.street === 'PREFLOP' && baseline.heroIsPreflopOpener,
  PREFLOP_HERO_FACING_OPEN: (baseline) => baseline.street === 'PREFLOP' && baseline.heroFacingBet,
  PREFLOP_HERO_STEALING: (baseline) =>
    baseline.street === 'PREFLOP' &&
    baseline.heroIsPreflopOpener &&
    baseline.heroPosition !== null &&
    STEAL_POSITIONS.includes(baseline.heroPosition),
};

/** Total. `true` when the baseline matches the scope a rule is written for. */
export const scopeMatches = (scope: AdaptiveRuleScope, baseline: AdaptiveBaseline): boolean =>
  ADAPTIVE_SCOPE_PREDICATES[scope](baseline);
