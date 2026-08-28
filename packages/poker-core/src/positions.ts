/**
 * Blind assignment and the position scheme for 2..6 dealt-in players.
 *
 * Positions are DERIVED on every replay and never persisted. The late positions are
 * anchored to the button (the `NON_BLIND_LADDER` walked backwards) so that 5-handed
 * `CO` is the same structural seat as 6-handed `CO`, which is what solver lookups need.
 */
import { ok } from '@gto-self/shared';
import type { RuleOptions } from './config.js';
import { engineErr, type EngineResult } from './errors.js';
import { makeBySeat, rotateToSeat, type BySeat, type SeatIndex } from './seat.js';

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export const POSITIONS: readonly ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] = [
  'UTG',
  'HJ',
  'CO',
  'BTN',
  'SB',
  'BB',
];

/** Walked BACKWARDS from the button over the non-blind dealt-in seats. */
export const NON_BLIND_LADDER: readonly ['BTN', 'CO', 'HJ', 'UTG'] = ['BTN', 'CO', 'HJ', 'UTG'];

export interface BlindAssignment {
  readonly buttonSeat: SeatIndex;
  readonly smallBlindSeat: SeatIndex;
  readonly bigBlindSeat: SeatIndex;
  readonly headsUp: boolean;
}

export interface SeatPosition {
  readonly seat: SeatIndex;
  readonly position: Position;
  /** 0 = button, 1 = SB, 2 = BB, ... clockwise over dealt-in seats. */
  readonly seatsAfterButton: number;
  /**
   * 0 = button, 1 = CO, 2 = HJ, 3 = UTG, ... counter-clockwise over dealt-in seats.
   * The STRUCTURAL lineup key gto-core matches on (ARCHITECTURE.md #3/#4).
   */
  readonly seatsBeforeButton: number;
  /** 0 = first to act preflop. */
  readonly preflopOrder: number;
  /** 0 = first to act on every postflop street. */
  readonly postflopOrder: number;
  readonly isButton: boolean;
  readonly blindRole: 'SB' | 'BB' | null;
}

export type PositionMap = BySeat<SeatPosition | null>;

/** Total. The dealt-in seats in ring order with the button first. */
function ringFromButton(
  dealtIn: readonly SeatIndex[],
  buttonSeat: SeatIndex,
): readonly SeatIndex[] {
  return rotateToSeat(dealtIn, buttonSeat);
}

/**
 * Result. `dealtIn` must be ascending, distinct, length 2..6 and contain `buttonSeat`.
 *
 * `n >= 3`: SB is the seat after the button, BB the one after that.
 * `n === 2`: with `rules.headsUpButtonPostsSmallBlind` (the default and universal rule)
 * the button posts the small blind; otherwise the roles are swapped.
 */
export function assignBlinds(
  dealtIn: readonly SeatIndex[],
  buttonSeat: SeatIndex,
  rules: RuleOptions,
): EngineResult<BlindAssignment> {
  if (dealtIn.length < 2) {
    return engineErr('NOT_ENOUGH_PLAYERS', 'A hand needs at least two dealt-in seats');
  }
  if (dealtIn.length > 6) {
    return engineErr('TOO_MANY_PLAYERS', 'A 6-max table cannot deal in more than six seats');
  }
  for (let i = 1; i < dealtIn.length; i += 1) {
    const prev = dealtIn[i - 1];
    const cur = dealtIn[i];
    if (prev === undefined || cur === undefined || cur <= prev) {
      return engineErr(
        'CORRUPT_LOG',
        `dealt-in seats must be ascending and distinct, got [${dealtIn.join(',')}]`,
      );
    }
  }
  if (!dealtIn.includes(buttonSeat)) {
    return engineErr(
      'BUTTON_SEAT_NOT_DEALT_IN',
      `Seat ${buttonSeat} holds the button but is not dealt in`,
      { seat: buttonSeat },
    );
  }

  const order = ringFromButton(dealtIn, buttonSeat);
  const headsUp = order.length === 2;
  const at = (i: number): SeatIndex => {
    const seat = order[i];
    if (seat === undefined) throw new Error(`ring index ${i} out of range`);
    return seat;
  };

  if (headsUp) {
    const buttonPostsSb = rules.headsUpButtonPostsSmallBlind;
    return ok({
      buttonSeat,
      smallBlindSeat: buttonPostsSb ? at(0) : at(1),
      bigBlindSeat: buttonPostsSb ? at(1) : at(0),
      headsUp: true,
    });
  }
  return ok({
    buttonSeat,
    smallBlindSeat: at(1),
    bigBlindSeat: at(2),
    headsUp: false,
  });
}

/**
 * Total. Preflop action order over the dealt-in seats; index 0 acts first.
 * `n >= 3`: first to act is the seat after the big blind. `n === 2`: the button acts first.
 */
export function preflopActionOrder(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
): readonly SeatIndex[] {
  const order = ringFromButton(dealtIn, blinds.buttonSeat);
  if (order.length === 2) return blinds.smallBlindSeat === order[0] ? order : [...order].reverse();
  return [...order.slice(3), ...order.slice(0, 3)];
}

/**
 * Total. Postflop action order; index 0 acts first on every street.
 * First live seat left of the button, button last — heads-up this yields `[BB, button]`.
 */
export function postflopActionOrder(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
): readonly SeatIndex[] {
  const order = ringFromButton(dealtIn, blinds.buttonSeat);
  return [...order.slice(1), ...order.slice(0, 1)];
}

/**
 * Total given a valid `BlindAssignment`. `null` for seats that are not dealt in.
 * Labels: `order[0]` is the button; for `n >= 3` seats 1 and 2 are SB and BB and the
 * remaining seats take `NON_BLIND_LADDER` walked backwards from the button.
 *
 * `n === 2` labels from `blinds`, never from ring position, so `position` and `blindRole`
 * always agree — including under `rules.headsUpButtonPostsSmallBlind: false`, where the
 * button posts the BIG blind and is therefore labelled `'BB'`.
 */
export function assignPositions(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
  rules: RuleOptions,
): PositionMap {
  const order = ringFromButton(dealtIn, blinds.buttonSeat);
  const n = order.length;
  const preflop = preflopActionOrder(dealtIn, blinds);
  const postflop = postflopActionOrder(dealtIn, blinds);

  const labels = new Map<SeatIndex, Position>();
  if (n === 2) {
    // Heads-up labels are derived from `blinds`, not from ring position, so `position`
    // can never contradict `blindRole`. Under the default
    // `rules.headsUpButtonPostsSmallBlind` this is the button + BB pair; with the flag
    // off `assignBlinds` swaps the roles, and the labels swap with them.
    const btn = order[0];
    const other = order[1];
    if (btn !== undefined) {
      labels.set(btn, blinds.smallBlindSeat === btn ? rules.headsUpButtonLabel : 'BB');
    }
    if (other !== undefined) {
      labels.set(other, blinds.smallBlindSeat === other ? 'SB' : 'BB');
    }
  } else {
    order.forEach((seat, index) => {
      if (index === 0) labels.set(seat, 'BTN');
      else if (index === 1) labels.set(seat, 'SB');
      else if (index === 2) labels.set(seat, 'BB');
    });
    // Ladder backwards from the button: order[n-1] = CO, order[n-2] = HJ, order[n-3] = UTG.
    for (let step = 1; step < NON_BLIND_LADDER.length; step += 1) {
      const index = n - step;
      if (index <= 2) break;
      const seat = order[index];
      const label = NON_BLIND_LADDER[step];
      if (seat !== undefined && label !== undefined) labels.set(seat, label);
    }
  }

  return makeBySeat<SeatPosition | null>((seat) => {
    const seatsAfterButton = order.indexOf(seat);
    if (seatsAfterButton < 0) return null;
    const position = labels.get(seat);
    if (position === undefined) return null;
    return {
      seat,
      position,
      seatsAfterButton,
      seatsBeforeButton: (n - seatsAfterButton) % n,
      preflopOrder: preflop.indexOf(seat),
      postflopOrder: postflop.indexOf(seat),
      isButton: seat === blinds.buttonSeat,
      blindRole: seat === blinds.smallBlindSeat ? 'SB' : seat === blinds.bigBlindSeat ? 'BB' : null,
    };
  });
}

/** Total. Orders by full-ring preflop action order (UTG earliest, BB latest). */
export function comparePositions(a: Position, b: Position): number {
  return POSITIONS.indexOf(a) - POSITIONS.indexOf(b);
}
