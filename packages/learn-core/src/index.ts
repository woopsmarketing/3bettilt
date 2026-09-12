/**
 * `@gto-self/learn-core` — the domain layer behind FishTilt, the beginner-facing Texas
 * Hold'em learning site.
 *
 * ## What belongs here
 *
 * Poker facts a beginner tool has to state and that this repository can compute or cite:
 * pot odds, outs probabilities, exact heads-up equity, derived facts about the 169
 * starting-hand classes, and the frozen strength ranking behind the "상위 X%" slider.
 * Everything is pure, deterministic and free of React, Next.js, persistence and any clock,
 * RNG or id generator.
 *
 * ## What does not belong here
 *
 * Strategy. This package never authors a range, a frequency or a recommendation. Where
 * FishTilt shows a range it reads one that already exists in `@gto-self/strategy-core`,
 * carrying that package's own `SOURCE | DERIVED | HEURISTIC` provenance, and where no
 * dataset exists FishTilt says so (CLAUDE.md rule 2 and rule 5; ADR-0056).
 *
 * ## Layering
 *
 * MAY import: `@gto-self/shared`, `@gto-self/strategy-core`.
 * MUST NOT import: React/Next, `@gto-self/db`, `poker-core`, `gto-core`, `player-core`,
 * `analysis-core`, `adaptive-core`, `coinpoker-parser`, `solver-lab`. ESLint enforces it.
 *
 * `strategy-core` is consumed READ-ONLY. FishTilt never edits it.
 */

export * from './potOdds.js';
export * from './outs.js';
export * from './equity/exact.js';
export * from './equity/classVsClass.js';
export * from './equity/classVsClassDataset.js';
export * from './handClass/facts.js';
export * from './handClass/categoryFrequency.js';
export * from './strength/model.js';
export * from './strength/measure.js';
export * from './strength/ranking.js';
