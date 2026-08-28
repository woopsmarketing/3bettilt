/**
 * Helpers for the independent (adversarial) test suite.
 *
 * These deliberately contain NO poker rules. Every expected value in tests/ is
 * hand-derived from docs/POKER_CORE_API.md and real NLHE rules, never copied from
 * packages/poker-core/src.
 */
import type { IdFactory, MilliBB } from '@gto-self/shared';
import { applyCommand, type Hand } from '../src/hand.js';
import type { HandCommand } from '../src/commands.js';
import { awardPots } from '../src/commands.js';
import type { HandState } from '../src/state.js';
import type { SeatIndex } from '../src/seat.js';

/** Applies one command, failing loudly with the engine's own error code. */
export function step(hand: Hand, command: HandCommand, factory: IdFactory): Hand {
  const result = applyCommand(hand, command, factory);
  if (!result.ok) {
    throw new Error(
      `command ${command.kind} was rejected: ${result.error.code} — ${result.error.message}`,
    );
  }
  return result.value;
}

export interface SeatMoney {
  readonly stack: MilliBB;
  readonly street: MilliBB;
  readonly total: MilliBB;
}

/** The three money fields a hand history would print for a seat. */
export function seatMoney(state: HandState, seat: SeatIndex): SeatMoney {
  const s = state.seats[seat];
  return { stack: s.stack, street: s.streetContribution, total: s.totalContribution };
}

/** Every dealt-in seat's stack, keyed by seat. */
export function stacks(state: HandState): Record<number, number> {
  const out: Record<number, number> = {};
  for (const seat of state.dealtInSeats) out[seat] = state.seats[seat].stack;
  return out;
}

/** Awards every still-unawarded pot to one winner. */
export function awardAllTo(state: HandState, winner: SeatIndex): HandCommand {
  return awardPots(
    state.pots.filter((p) => !p.awarded).map((p) => ({ potIndex: p.index, winners: [winner] })),
  );
}

/** Structural deep clone for "the failed command must not have mutated anything". */
export function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
