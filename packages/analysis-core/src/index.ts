/**
 * `@gto-self/analysis-core` — the deterministic event-log -> player-observation
 * interpreter (ADR-0061).
 *
 * It exists because the layering forbids anyone else from doing this job: `player-core`
 * may not import `poker-core` and `poker-core` may not import `player-core` (ADR-0021), so
 * the package that reads a hand's event log and produces player-domain facts can live in
 * neither. It may import `@gto-self/shared`, `@gto-self/poker-core` and
 * `@gto-self/player-core` and NOTHING else — never `strategy-core` or `gto-core` (a player
 * model must not read or influence the REFERENCE baseline; that is C2's problem and it has
 * no import path today), never `@gto-self/db`, never React or Next. ESLint enforces every
 * one of those, in both directions.
 *
 * Deterministic by construction: no clock, no RNG, no id generation. The same hands under
 * the same `ANALYSIS_ALGORITHM_VERSION` produce byte-identical output, which is what makes
 * a repeated analysis run report `NO_CHANGES` instead of doubling every count (ADR-0062).
 *
 * Everything here computes FACTS — opportunity counts, actions, actual milliBB amounts,
 * explicitly revealed cards. It produces no adjectives and no strategy comparison.
 */
export * from './version.js';
export * from './errors.js';
export * from './hash.js';
export * from './decisions.js';
export * from './extract.js';
export * from './aggregate.js';
