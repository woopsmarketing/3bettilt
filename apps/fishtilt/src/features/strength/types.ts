/**
 * `features/strength` — the typed, testable layer between `/tools/starting-hand` and
 * `@gto-self/learn-core`'s frozen starting-hand strength ranking
 * (`docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md`).
 *
 * This module holds only the two-value vocabulary of the page's mode toggle. Everything
 * else the page needs — the slider bounds, the cut itself, Korean copy — lives in
 * `viewModel.ts` and `copy.ts`.
 */

/**
 * `RANK` — browse all 169 classes in strength order with no highlight, the plain "click a
 * cell, read its rank" mode. `TOP_SHARE` — highlight the strongest hands making up at least
 * the slider's requested share of the 1326-combo deal (`topHandsByShare`).
 */
export const STARTING_HAND_VIEWS = ['RANK', 'TOP_SHARE'] as const;

export type StartingHandView = (typeof STARTING_HAND_VIEWS)[number];
