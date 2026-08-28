/**
 * Derived table metrics: effective stack, SPR, pot odds, committed fraction, dead cards.
 * `poker-core` supplies raw numbers here and deliberately defines no sizing convention.
 */
import { Money, type Card, type MilliBB } from '@gto-self/shared';
import { callAmount } from './betting.js';
import { potBeforeAction } from './pots.js';
import type { SeatIndex } from './seat.js';
import { contenders, type HandState } from './state.js';

export type StackBasis = 'STARTING' | 'REMAINING';

/** Total. Chips still behind for `seat`. */
export function remainingStack(state: HandState, seat: SeatIndex): MilliBB {
  return state.seats[seat].stack;
}

function basisStack(state: HandState, seat: SeatIndex, basis: StackBasis): MilliBB {
  const s = state.seats[seat];
  return basis === 'STARTING' ? s.startingStack : s.stack;
}

/**
 * Total. `Money.min` of the two seats' stacks on the chosen basis — the unambiguous
 * pairwise definition. `'STARTING'` is what gto-core buckets, `'REMAINING'` is what the
 * table displays.
 */
export function effectiveStackBetween(
  state: HandState,
  a: SeatIndex,
  b: SeatIndex,
  basis: StackBasis,
): MilliBB {
  return Money.min(basisStack(state, a, basis), basisStack(state, b, basis));
}

/**
 * Total. Documented multiway convention: `min(own, max over the OTHER contenders)` —
 * "versus the deepest live opponent". ZERO when no other contender remains.
 */
export function effectiveStackFor(state: HandState, seat: SeatIndex, basis: StackBasis): MilliBB {
  const others = contenders(state).filter((other) => other !== seat);
  if (others.length === 0) return Money.ZERO;
  const deepest = others.reduce<MilliBB>(
    (best, other) => Money.max(best, basisStack(state, other, basis)),
    Money.ZERO,
  );
  return Money.min(basisStack(state, seat, basis), deepest);
}

/**
 * Total. `ratio(effectiveStackFor(seat, 'REMAINING'), potTotal)` — a plain number, never
 * money (CLAUDE.md rule 1 permits floats for non-money ratios); null on a zero pot.
 */
export function spr(state: HandState, seat: SeatIndex): number | null {
  return Money.ratio(effectiveStackFor(state, seat, 'REMAINING'), state.potTotal);
}

/** Total. `ratio(callAmount, potBeforeAction + callAmount)`. Null on a zero denominator. */
export function potOdds(state: HandState, seat: SeatIndex): number | null {
  const call = callAmount(state, seat);
  return Money.ratio(call, Money.add(potBeforeAction(state), call));
}

/** Total. `ratio(totalContribution, startingStack)`. Null when the starting stack is zero. */
export function committedFraction(state: HandState, seat: SeatIndex): number | null {
  const s = state.seats[seat];
  return Money.ratio(s.totalContribution, s.startingStack);
}

/**
 * Total. Board plus every known holding. The palette disables exactly this set, so
 * duplicate cards are impossible by construction (`docs/UX.md`).
 */
export function deadCards(state: HandState): readonly Card[] {
  const out: Card[] = [...state.board];
  for (const seat of state.dealtInSeats) {
    out.push(...state.seats[seat].holeCards);
  }
  return out;
}
