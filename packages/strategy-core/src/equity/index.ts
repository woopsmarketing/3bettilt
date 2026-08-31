/**
 * The equity surface. `src/index.ts` (the package barrel) is the orchestrator's file, so
 * nothing here is re-exported from it yet — consumers inside the package import from
 * `./equity/index.js` relatively.
 */
export {
  EQUITY_METHODS,
  DEFAULT_EQUITY_BUDGET,
  MAX_VILLAIN_RANGES,
  type EquityMethod,
  type EquityResult,
  type EquityBudget,
} from './model.js';

export {
  equityVsRange,
  equityVsRanges,
  validateBoard,
  validateHeroCards,
  type EquityOptions,
} from './equity.js';

export {
  rangeVsRangeEquity,
  equityDistribution,
  equityQuantile,
  DEFAULT_RANGE_EQUITY_MAX_OPS,
  type ComboEquity,
  type RangeEquityResult,
  type RangeEquityOptions,
  type EquityDistribution,
} from './rangeEquity.js';

export {
  buildStrengthDistribution,
  strengthPercentile,
  comboStrengthPercentile,
  weightAtOrAboveBps,
  weightAtBps,
  nutDensity,
  type StrengthDistribution,
  type StrengthDistributionOptions,
  type StrengthEntry,
} from './strength.js';

export {
  createEquityCache,
  rangeDigest,
  cardsKey,
  DEFAULT_EQUITY_CACHE_CAPACITY,
  type EquityCache,
} from './cache.js';

export {
  binomial,
  combinationCount,
  unrankColex,
  weylIndices,
  indexSample,
  WEYL_RATIO,
} from './sampling.js';
