/**
 * `features/range` — the typed, testable layer between 3BetTilt's UI and
 * `@gto-self/strategy-core`'s range data. See `types.ts`, `resolve.ts`, `notation.ts` and
 * `copy.ts` for the pieces; this barrel is the only import surface a component or page
 * should reach through.
 */
export * from './types.js';
export * from './resolve.js';
export * from './notation.js';
export * from './copy.js';
export * from './url.js';
