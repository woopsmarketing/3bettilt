/**
 * Pure, deterministic NLHE state engine (Phases 1-2).
 *
 * Rules: no React, no database, no GTO. Every money value is milliBB from
 * `@gto-self/shared`. State is rebuilt by replaying events.
 *
 * Phase 0 placeholder — replaced by the implementing phase.
 */
export const POKER_CORE_PLACEHOLDER = 'poker-core' as const;
