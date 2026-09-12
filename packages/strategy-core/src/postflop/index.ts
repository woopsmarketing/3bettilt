/**
 * The postflop REFERENCE policy's public surface.
 *
 * `src/index.ts` (the package barrel) is the orchestrator's file and was not touched, so
 * nothing here is re-exported from `@gto-self/strategy-core` yet — consumers inside the
 * package import from `./postflop/index.js` relatively, exactly as `equity/` does.
 *
 * `testQuery.ts` is deliberately ABSENT: it is a test fixture builder, mirroring
 * `preflop/testQuery.ts` and `adapter/testHands.ts`.
 */
export { recommendPostflop, type PostflopBudget } from './policy.js';

export {
  classifyPostflopSpot,
  potTypeOf,
  previousStreetOf,
  type PostflopSpot,
  type PostflopSpotClassification,
  type PostflopSpotFamily,
  type PostflopUnsupportedReason,
  type UnsupportedPostflopSpot,
  // HeroRelativePosition is re-exported by the package barrel via preflop/spot.js already.
} from './spot.js';

export {
  buildPostflopRanges,
  primaryVillainOf,
  type PostflopRangeModel,
  type PostflopSeatRange,
} from './ranges.js';

export {
  buildPostflopContext,
  shareCutoffStrength,
  type NutShares,
  type PostflopContext,
} from './context.js';

export {
  scorePostflop,
  aggressionBandFor,
  continueBandFor,
  raiseShareBandFor,
  applyMultiwayScale,
  aggressionComponents,
  continueComponents,
  handStrengthPoints,
  drawQualityPoints,
  blockerPoints,
  multiwayScaleBpsFor,
  multiwayContinuePenaltyBpsFor,
  type ModelScore,
  type PostflopMix,
  type PostflopScoring,
  type ScoreComponent,
} from './score.js';

export {
  selectSizing,
  sizingRequestFor,
  potFractionToAmount,
  clampPostflopSizing,
  type PostflopSizingRequest,
  type PotFractionAmountInput,
  type SizingModifier,
  type SizingSelection,
} from './sizing.js';

export {
  POSTFLOP_REFERENCE_LABEL,
  type PostflopAction,
  type PostflopExplanation,
  type PostflopExplanationFeature,
  type PostflopExplanationFeatureId,
  type PostflopMetrics,
  type PostflopProvenance,
  type PostflopRecommendation,
  type PostflopSizing,
} from './recommendation.js';

export { POSTFLOP_RULES, postflopRule, type PostflopRule, type PostflopRuleId } from './rules.js';

export * from './scoreModel.js';
