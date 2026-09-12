/**
 * `features/search` — the typed, testable layer between 3BetTilt's UI and its content graph
 * + route registry. See `types.ts`, `buildIndex.ts`, `match.ts`, `copy.ts` and `url.ts` for
 * the pieces; this barrel is the only import surface a component or page should reach
 * through.
 */
export * from './types.js';
export * from './buildIndex.js';
export * from './match.js';
export * from './copy.js';
export * from './url.js';
export * from './aliases.js';
export * from './group.js';
export * from './highlight.js';
