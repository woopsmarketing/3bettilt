/**
 * Layered pot derivation. `state.pots` is ALWAYS a list with per-pot eligible sets and
 * is rebuilt from per-seat `totalContribution` on every event, so it can never drift.
 */
import { invariant, Money, type MilliBB } from '@gto-self/shared';
import type { BySeat, SeatIndex } from './seat.js';
import type { HandState, SeatHandState, UncalledReturn } from './state.js';

export interface Pot {
  readonly index: number;
  readonly kind: 'MAIN' | 'SIDE';
  readonly amount: MilliBB;
  /** The per-seat total-contribution level this layer is capped at. */
  readonly capLevel: MilliBB;
  /** Ascending seat order. Non-folded seats whose `totalContribution >= capLevel`. */
  readonly eligibleSeats: readonly SeatIndex[];
  readonly awarded: boolean;
}

interface Layer {
  readonly amount: MilliBB;
  readonly capLevel: MilliBB;
  readonly eligibleSeats: readonly SeatIndex[];
}

function sameSeats(a: readonly SeatIndex[], b: readonly SeatIndex[]): boolean {
  return a.length === b.length && a.every((seat, index) => seat === b[index]);
}

/**
 * Total. Layered decomposition over the distinct ascending `totalContribution` levels.
 *
 * Three merge rules, applied while walking the levels upward:
 *  - a zero-amount layer is dropped;
 *  - a layer whose eligible set would be empty (only folded seats reached that level) is
 *    merged down into the previous pot — folded chips fund a layer but confer no
 *    eligibility, and an empty set can only ever occur above every contender;
 *  - a layer whose eligible set is IDENTICAL to the previous pot's is merged down too.
 *    Two layers with the same eligible set are always won by the same candidates, so
 *    splitting them would be a distinction without a difference — and without this rule
 *    an ordinary hand (one folded blind plus two seats matched at the same level) would
 *    report a main pot and a phantom side pot instead of the single pot the spec
 *    promises. A genuine side pot always changes the eligible set, because it exists
 *    exactly when a contender is capped below the level above it.
 *
 * Indices are renumbered densely with index 0 as `'MAIN'` and the rest `'SIDE'`.
 */
export function computePots(
  seats: BySeat<SeatHandState>,
  dealtInSeats: readonly SeatIndex[],
): readonly Pot[] {
  const levels = Array.from(
    new Set(
      dealtInSeats
        .map((seat) => seats[seat].totalContribution as number)
        .filter((amount) => amount > 0),
    ),
  ).sort((a, b) => a - b);

  const layers: Layer[] = [];
  let previous = Money.ZERO;
  for (const raw of levels) {
    const level = raw as MilliBB;
    const amount = Money.sum(
      dealtInSeats.map((seat) => {
        const total = seats[seat].totalContribution;
        return Money.sub(Money.min(total, level), Money.min(total, previous));
      }),
    );
    const eligibleSeats = dealtInSeats.filter(
      (seat) => seats[seat].totalContribution >= level && seats[seat].status !== 'FOLDED',
    );
    layers.push({ amount, capLevel: level, eligibleSeats });
    previous = level;
  }

  const merged: Layer[] = [];
  for (const layer of layers) {
    if (Money.isZero(layer.amount)) continue;
    const last = merged[merged.length - 1];
    if (layer.eligibleSeats.length === 0) {
      invariant(
        last !== undefined,
        'pot layering: the lowest contribution level has no eligible contender',
      );
      merged[merged.length - 1] = { ...last, amount: Money.add(last.amount, layer.amount) };
      continue;
    }
    if (last !== undefined && sameSeats(last.eligibleSeats, layer.eligibleSeats)) {
      merged[merged.length - 1] = {
        ...last,
        amount: Money.add(last.amount, layer.amount),
        capLevel: layer.capLevel,
      };
      continue;
    }
    merged.push(layer);
  }

  return merged.map((layer, index) => ({
    index,
    kind: index === 0 ? ('MAIN' as const) : ('SIDE' as const),
    amount: layer.amount,
    capLevel: layer.capLevel,
    eligibleSeats: layer.eligibleSeats,
    awarded: false,
  }));
}

/** Total. `Money.sum` of the pot amounts. */
export function potTotal(pots: readonly Pot[]): MilliBB {
  return Money.sum(pots.map((pot) => pot.amount));
}

/** Total. The pots `seat` is eligible to win. */
export function potsEligibleFor(pots: readonly Pot[], seat: SeatIndex): readonly Pot[] {
  return pots.filter((pot) => pot.eligibleSeats.includes(seat));
}

/** Total. Pots that still need a winner. */
export function unawardedPots(state: HandState): readonly Pot[] {
  return state.pots.filter((pot) => !pot.awarded);
}

/**
 * Total. `null` unless exactly one dealt-in seat holds the maximum CURRENT-STREET
 * contribution and that maximum exceeds the second highest. Folded seats are INCLUDED
 * in both maxima: `BTN raises to 3, all fold` returns `3 - 1`, not `3`, so the pot and
 * therefore the rake basis match a real hand history.
 */
export function computeUncalledReturn(state: HandState): UncalledReturn | null {
  let top = Money.ZERO;
  let second = Money.ZERO;
  let topSeat: SeatIndex | null = null;
  let topCount = 0;

  for (const seat of state.dealtInSeats) {
    const contribution = state.seats[seat].streetContribution;
    if (contribution > top) {
      second = top;
      top = contribution;
      topSeat = seat;
      topCount = 1;
    } else if (contribution === top) {
      topCount += 1;
    } else if (contribution > second) {
      second = contribution;
    }
  }

  if (topSeat === null || topCount !== 1) return null;
  if (top <= second) return null;
  return { seat: topSeat, amount: Money.sub(top, second) };
}

/**
 * Total. Everything committed before the seat on the clock acts — the denominator
 * `docs/ARCHITECTURE.md` specifies for postflop sizing normalization.
 */
export function potBeforeAction(state: HandState): MilliBB {
  return state.potTotal;
}

/** Total. `potBeforeAction` + the seat's call amount. Denominator for the 33/50/75 shortcuts. */
export function potAfterCall(state: HandState, seat: SeatIndex): MilliBB {
  const seatState = state.seats[seat];
  const owed = Money.sub(state.round.currentBet, seatState.streetContribution);
  const call = Money.max(Money.ZERO, Money.min(owed, seatState.stack));
  return Money.add(potBeforeAction(state), call);
}

/** Throws. `Money.sum(pot amounts)` must equal `Money.sum(totalContributions)`. */
export function assertPotsConserveContributions(state: HandState): void {
  const contributed = Money.sum(
    state.dealtInSeats.map((seat) => state.seats[seat].totalContribution),
  );
  const inPots = potTotal(state.pots);
  invariant(
    contributed === inPots,
    `pot conservation broken: contributions ${contributed} vs pots ${inPots}`,
  );
}
