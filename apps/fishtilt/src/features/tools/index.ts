/**
 * `features/tools` — the typed, testable layer between 3BetTilt's calculator pages and
 * `@gto-self/learn-core`. See `amount.ts` (the parse boundary), `format.ts` (how a number
 * is written down), `copy.ts` (Korean messages), `draws.ts` (derived out counts for the
 * common draws), `outsView.ts` (exact-vs-shortcut rows), `potOddsUrl.ts` (the pot-odds
 * calculator's `?pot=&bet=` deep-link contract), `requiredOuts.ts` (the bridge from a
 * required win rate back to a countable number of cards) and `hub.ts` (what `/tools` lists).
 *
 * Nothing in this folder decides a poker fact. Every probability, every pot and every
 * required equity is computed by `learn-core`; this layer parses, arranges and writes down.
 * This barrel is the only import surface a component or page should reach through — the
 * same rule `features/range/index.ts` states for the range facade.
 *
 * WP-4 added two: `faq.ts` (the six tool pages' question-and-answer data — the single array
 * per tool that both the visible FAQ and WP-7's `FAQPage` block read) and `related.ts` (which
 * lessons each tool sends a stuck reader back to). WP-S3-14 added `guideLinks.ts` and
 * `guide/*` — see the note at the foot of this file.
 */
export * from './amount.js';
export * from './copy.js';
export * from './draws.js';
export * from './faq.js';
export * from './format.js';
export * from './hub.js';
export * from './outsView.js';
export * from './potOddsUrl.js';
export * from './related.js';
export * from './requiredOuts.js';
// WP-S3-14: the guides under each tool. `guideLinks.ts` (the onward-link groups under the
// D-S3-16 labels) and `guide/*` (the worked examples and tables, every number computed from
// the engines at render time — never a literal).
export * from './guideLinks.js';
export * from './guide/format.js';
export * from './guide/matrixKinds.js';
export * from './guide/rangeGuide.js';
export * from './guide/equityGuide.js';
export * from './guide/potOddsGuide.js';
export * from './guide/outsGuide.js';
export * from './guide/handCheckerGuide.js';
export * from './guide/startingHandGuide.js';
