/**
 * `features/quiz` — the reusable quiz engine (WP-L1). See `types.ts` for the question/
 * session model, `engine.ts` for scoring/retry/the `UNSUPPORTED`-safe seam, `rng.ts` for the
 * seeded shuffle, and `hub.ts` for what `/practice` lists. This barrel is the only import
 * surface a component or a later quiz's generator should reach through — the same rule
 * `features/range/index.ts` and `features/tools/index.ts` state for their own facades.
 */
export * from './engine.js';
export * from './hub.js';
export * from './rng.js';
export * from './types.js';
