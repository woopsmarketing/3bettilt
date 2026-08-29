/**
 * `@gto-self/db` — Drizzle + SQLite persistence.
 *
 * **Storage only.** No betting rules, no settlement arithmetic, no rake computation, no
 * strategy: rows go in and come out, and `poker-core` / `player-core` decide what they
 * mean. Money is an integer milliBB in an INTEGER column and is never arithmetic'd here.
 * Ids and timestamps are supplied by the caller (ADR-0007); this package generates neither
 * and never reads the clock.
 *
 * Every row is turned into a domain value through that domain's own validator, never a
 * cast: a row that fails validation is a typed `CORRUPT_ROW`, never a plausible object.
 */
export * from './errors.js';
export * from './client.js';
export * from './schema.js';
export * from './rows.js';
export * from './repositories/presets.js';
export * from './repositories/players.js';
export * from './repositories/hud.js';
export * from './repositories/notes.js';
export * from './repositories/observations.js';
export * from './repositories/sessions.js';
export * from './repositories/hands.js';
