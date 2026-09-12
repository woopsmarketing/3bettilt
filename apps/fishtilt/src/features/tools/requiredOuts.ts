/**
 * The bridge between the two calculators: "필요 승률이 25%라면, 아웃이 몇 개나 있어야
 * 하나요?"
 *
 * A beginner who has just been told they need to win 25% of the time has no way to act on
 * that number until it is expressed in the units they can actually count at the table —
 * cards. So the pot-odds page answers its own question in outs, by asking `outsOdds` for
 * every legal out count on the street and reporting the first one that reaches the price.
 * It is a search over the domain, not a formula of this module's own: every probability
 * compared here was computed by `learn-core`.
 *
 * ## Why a linear scan is the right implementation
 *
 * `byRiverProb` is monotonically increasing in `outs`, so a binary search would work. There
 * are at most 48 candidates and the scan runs once per keystroke on a page with no other
 * work to do; the readable version is the correct one to ship, and it stays obviously
 * correct if `outs.ts`'s decomposition ever changes shape.
 *
 * ## The honest caveat this function cannot express
 *
 * Comparing a draw's by-the-river probability against the price of ONE call assumes no
 * further betting — no turn bet to fold to, no extra money won when the draw lands. That
 * assumption is a real simplification, and the page that renders this result says so in
 * words. It is not encoded here because it is not arithmetic; it is the reason the
 * arithmetic is not the whole answer.
 */
import { outsOdds, type DrawStreet } from '@gto-self/learn-core';
import { unseenCardsOn } from './outsView.js';

/** Which horizon the required-outs question is being asked over. */
export const DRAW_HORIZONS = ['NEXT_CARD', 'BY_RIVER'] as const;

export type DrawHorizon = (typeof DRAW_HORIZONS)[number];

export interface MinimumOuts {
  readonly street: DrawStreet;
  readonly horizon: DrawHorizon;
  /** The fewest outs that reach `requiredEquity`. */
  readonly outs: number;
  /** What that many outs actually gives — always at or above the price, never rounded to it. */
  readonly probability: number;
}

/**
 * The fewest outs whose probability reaches `requiredEquity` on this street and horizon, or
 * `null` when even a draw to every unseen card would not get there.
 *
 * `null` is unreachable from `potOdds`, whose required equity can never exceed 1/2 (the
 * caller must put in at most what the bettor did, so the final pot is at least twice the
 * call). It is still returned rather than assumed, because a function that silently cannot
 * fail is a function whose caller stops checking.
 */
export function minimumOutsFor(
  requiredEquity: number,
  street: DrawStreet,
  horizon: DrawHorizon,
): MinimumOuts | null {
  if (!Number.isFinite(requiredEquity)) return null;

  const unseen = unseenCardsOn(street);
  for (let outs = 0; outs <= unseen; outs += 1) {
    const result = outsOdds({ outs, street });
    // Unreachable: every integer in `0..unseen` is a legal out count by construction. Bailing
    // out rather than continuing means a future change to `outs.ts`'s validation surfaces as
    // "we cannot answer" instead of as a silently skipped candidate (CLAUDE.md rule 5).
    if (!result.ok) return null;
    const probability =
      horizon === 'NEXT_CARD' ? result.value.nextCardProb : result.value.byRiverProb;
    if (probability >= requiredEquity) return { street, horizon, outs, probability };
  }
  return null;
}
