/**
 * `@gto-self/strategy-core` — machinery for the deterministic local REFERENCE strategy
 * engine (user-facing name 기본전략 · REFERENCE). It is NEVER labelled GTO.
 *
 * It supplies the neutral query model, the one documented adapter seam onto `poker-core`,
 * preflop spot canonicalization, stack buckets, the 1326-combo range model, the hand
 * evaluator and board/hero analyzers, and the preflop reference policy. Every strategy
 * number in `preflop/tables.ts` carries a provenance (`SOURCE | DERIVED | HEURISTIC`,
 * ADR-0056) and an anchor citation into `docs/reports/STRATEGY_ANCHORS.md`; frequencies
 * are integer BPS, quantized to 5% steps, summing to exactly 10000.
 *
 * Layering: `@gto-self/shared` everywhere; `@gto-self/poker-core` ONLY inside
 * `src/adapter/`; never `player-core` (player data must not influence the baseline), never
 * `gto-core` (the future solved-GTO provider is separate and mutually unaware), never
 * React/Next/`@gto-self/db`. ESLint enforces every line of that.
 */
export * from './errors.js';
export * from './provenance.js';
export * from './bps.js';
export * from './stackBucket.js';
export * from './types.js';

export * from './range/combo.js';
export * from './range/handClass.js';
export * from './range/weights.js';

export * from './preflop/spot.js';
export * from './preflop/notation.js';
export * from './preflop/tables.js';
export * from './preflop/rules.js';
export * from './preflop/recommendation.js';
export * from './preflop/sizing.js';
export * from './preflop/policy.js';
export * from './preflop/propagate.js';
// `preflop/testQuery.ts` is TEST-ONLY and deliberately not exported.

export * from './analysis/evaluate.js';
export * from './analysis/board.js';
export * from './analysis/heroHand.js';

export * from './equity/index.js';
export * from './postflop/index.js';

// The single seam onto `@gto-self/poker-core` (docs/GTO_DESIGN_NOTES.md note F).
export * from './adapter/fromHandState.js';
