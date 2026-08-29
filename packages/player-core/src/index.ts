/**
 * `@gto-self/player-core` — player identity, manual HUD snapshots, our own observations,
 * notes, and context-scoped confidence.
 *
 * Pure domain: no React, no Next.js, no persistence, no `poker-core`, no `gto-core`
 * (ADR-0021). Every id and every timestamp is injected by the caller (ADR-0007); nothing
 * here reads a clock, a random source, or storage.
 *
 * Player identity is a MANUALLY ENTERED nickname plus what we ourselves counted. It is
 * never derived from a poker client or a hand-history id (ADR-0033).
 *
 * The two kinds of stat are permanently separate types and are never merged:
 *
 * - `PlayerHudSnapshot` — testimony about what a third-party HUD displayed, typed in by
 *   the user, never auto-overwritten, kept as history. Its `handSample` may be fed to
 *   `assessConfidence` by a caller, but a HUD reading and an observation are never
 *   averaged into one number.
 * - `PlayerObservation` — counts we recorded ourselves. Rates are derived on demand
 *   (`observedRate`), never stored.
 */
export * from './errors.js';
export * from './time.js';
export * from './percent.js';
export * from './player.js';
export * from './hud.js';
export * from './observation.js';
export * from './notes.js';
export * from './confidence.js';
