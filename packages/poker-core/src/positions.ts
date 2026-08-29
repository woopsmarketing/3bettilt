/**
 * Blind assignment and the position scheme for 2..6 dealt-in players.
 *
 * Positions are DERIVED on every replay and never persisted. The late positions are
 * anchored to the button (the `NON_BLIND_LADDER` walked backwards) so that 5-handed
 * `CO` is the same structural seat as 6-handed `CO`, which is what solver lookups need.
 *
 * A `BlindSeatOverride` may move the blinds off their default seats (ADR-0031). It is
 * always USER input — nothing here infers a missed blind or a dead button, and the
 * automatic rules for either stay unimplemented.
 */
import { invariant, ok, unwrap } from '@gto-self/shared';
import type { RuleOptions } from './config.js';
import { engineErr, type EngineResult } from './errors.js';
import { makeBySeat, orderClockwise, rotateToSeat, type BySeat, type SeatIndex } from './seat.js';

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

/**
 * A manual SB/BB assignment supplied at hand start (ADR-0031). ALWAYS user input: the
 * engine never derives one, because who owes a blind after sitting out differs per room
 * and no fixture has confirmed CoinPoker's rule.
 *
 * `null`/absent means the ordinary rotation, which is byte-identical to the behaviour
 * before overrides existed.
 */
export interface BlindSeatOverride {
  readonly smallBlindSeat: SeatIndex;
  readonly bigBlindSeat: SeatIndex;
}

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
 *
 * `override` (ADR-0031) names the two blind seats explicitly. It is validated, never
 * trusted:
 *
 * - both seats must be dealt in (`SEAT_NOT_DEALT_IN`);
 * - they must be distinct (`BLIND_OVERRIDE_INVALID`);
 * - with THREE OR MORE dealt in, neither may be the button seat
 *   (`BLIND_OVERRIDE_ON_BUTTON`) — that is the dead-button case, which stays
 *   unimplemented (`docs/POKER_CORE_API.md` assumption 15). Refusing is deliberate:
 *   coping silently would mean inventing a site rule;
 * - the resulting lineup must be labelable by the six-member `Position` union
 *   (`POSITION_LINEUP_UNSUPPORTED`).
 *
 * REACHABILITY, stated honestly: for every input `assignBlinds` currently accepts this
 * refusal cannot fire. With three or more dealt in, the override guarantees BTN, SB and
 * BB are three distinct seats, so the ladder needs at most `n - 3 <= 3` of its three
 * remaining names; heads-up the two labels are always distinct. It is defence in depth
 * for a FUTURE lineup rule (a null small blind, a dead button, a seventh seat), not a
 * gate on anything reachable today. Do not cite it as evidence that a present-day input
 * is handled.
 *
 * PRECEDENCE: heads-up, the override WINS over `rules.headsUpButtonPostsSmallBlind` —
 * an explicit user statement outranks a configured default, and heads-up is the one
 * shape where naming the button as a blind seat is legal (there is no third seat).
 */
export function assignBlinds(
  dealtIn: readonly SeatIndex[],
  buttonSeat: SeatIndex,
  rules: RuleOptions,
  override: BlindSeatOverride | null = null,
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

  if (override !== null) {
    for (const [role, seat] of [
      ['small blind', override.smallBlindSeat],
      ['big blind', override.bigBlindSeat],
    ] as const) {
      if (!dealtIn.includes(seat)) {
        return engineErr(
          'SEAT_NOT_DEALT_IN',
          `Seat ${seat} is named the ${role} but is not dealt into this hand`,
          { seat },
        );
      }
    }
    if (override.smallBlindSeat === override.bigBlindSeat) {
      return engineErr(
        'BLIND_OVERRIDE_INVALID',
        `Seat ${override.smallBlindSeat} cannot post both blinds`,
        { seat: override.smallBlindSeat },
      );
    }
    if (!headsUp && (override.smallBlindSeat === buttonSeat || override.bigBlindSeat === buttonSeat)) {
      return engineErr(
        'BLIND_OVERRIDE_ON_BUTTON',
        `Seat ${buttonSeat} holds the button and cannot also post a blind with ${order.length} dealt in; the dead button is not modelled`,
        { seat: buttonSeat },
      );
    }
    const assignment: BlindAssignment = {
      buttonSeat,
      smallBlindSeat: override.smallBlindSeat,
      bigBlindSeat: override.bigBlindSeat,
      headsUp,
    };
    // Refuse the hand rather than invent a Position label the union cannot express.
    const labels = derivePositionLabels(dealtIn, assignment, rules);
    if (!labels.ok) return labels;
    return ok(assignment);
  }

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
 *
 * ONE rule, no special cases: ring order starting immediately after the EFFECTIVE big
 * blind, so the big blind always acts last preflop. For the ordinary rotation this is
 * exactly the old `n >= 3` "seat after the big blind" and `n === 2` "the small blind
 * (the button) acts first"; under a `BlindSeatOverride` it follows the override.
 */
export function preflopActionOrder(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
): readonly SeatIndex[] {
  return orderClockwise(dealtIn, blinds.bigBlindSeat, false);
}

/**
 * Total. Postflop action order; index 0 acts first on every street.
 * First live seat left of the button, button last — heads-up this yields `[BB, button]`.
 *
 * Postflop order is a BUTTON rule, not a blind rule: it is anchored to the button in
 * every real rulebook, and anchoring it to the small blind instead would let a seat
 * between the button and an overridden small blind act AFTER the button. So a
 * `BlindSeatOverride` that moves the blinds leaves the postflop SEAT order untouched;
 * only the position labels along it move. Nothing here was invented for the override —
 * this is the same expression as before.
 */
export function postflopActionOrder(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
): readonly SeatIndex[] {
  const order = ringFromButton(dealtIn, blinds.buttonSeat);
  return [...order.slice(1), ...order.slice(0, 1)];
}

/**
 * Result. THE single place a `Position` label is decided, and the reason it returns a
 * Result rather than a map: a lineup the six-member `Position` union cannot describe is
 * REFUSED, never approximated. No label is ever invented, reused for two seats, or
 * defaulted.
 *
 * Labels, anchored to the button in every case:
 *
 * - `n >= 3`: the button is `BTN`, the two EFFECTIVE blind seats are `SB` and `BB`, and
 *   the remaining seats take `NON_BLIND_LADDER` walked BACKWARDS from the button
 *   (`CO`, then `HJ`, then `UTG`), skipping the blind seats. For the ordinary rotation
 *   the blinds sit at ring indices 1 and 2 and this reproduces the old table exactly.
 * - `n === 2`: labels come from `blinds`, never from ring position, so `position` and
 *   `blindRole` always agree — including under `rules.headsUpButtonPostsSmallBlind:
 *   false`, where the button posts the BIG blind and is therefore labelled `'BB'`.
 *
 * ASSUMPTION (ADR-0031). A non-standard blind arrangement — anything a
 * `BlindSeatOverride` produces that the ordinary rotation would not — yields a purely
 * STRUCTURAL labelling: it is derived from the button and the stated blind seats, and it
 * may not correspond to any real solver lineup. `gto-core` must treat such a hand as
 * `UNSUPPORTED` rather than approximating it to the nearest standard lineup. The
 * structural keys (`seatsBeforeButton`, `seatsAfterButton`) stay meaningful; the
 * `Position` NAME does not.
 */
export function derivePositionLabels(
  dealtIn: readonly SeatIndex[],
  blinds: BlindAssignment,
  rules: RuleOptions,
): EngineResult<ReadonlyMap<SeatIndex, Position>> {
  const order = ringFromButton(dealtIn, blinds.buttonSeat);
  const n = order.length;
  const labels = new Map<SeatIndex, Position>();
  const used = new Set<Position>();

  const claim = (seat: SeatIndex, label: Position): EngineResult<null> => {
    if (labels.has(seat)) {
      return engineErr(
        'POSITION_LINEUP_UNSUPPORTED',
        `Seat ${seat} would take two positions (${String(labels.get(seat))} and ${label})`,
        { seat },
      );
    }
    if (used.has(label)) {
      return engineErr(
        'POSITION_LINEUP_UNSUPPORTED',
        `Position ${label} would be given to two seats`,
        { seat },
      );
    }
    labels.set(seat, label);
    used.add(label);
    return ok(null);
  };

  if (n === 2) {
    const btn = order[0];
    const other = order[1];
    if (btn === undefined || other === undefined) {
      return engineErr('POSITION_LINEUP_UNSUPPORTED', 'a heads-up lineup needs two seats');
    }
    const btnLabel: Position = blinds.smallBlindSeat === btn ? rules.headsUpButtonLabel : 'BB';
    const first = claim(btn, btnLabel);
    if (!first.ok) return first;
    const second = claim(other, blinds.smallBlindSeat === other ? 'SB' : 'BB');
    if (!second.ok) return second;
    return ok(labels);
  }

  for (const [seat, label] of [
    [blinds.buttonSeat, 'BTN'],
    [blinds.smallBlindSeat, 'SB'],
    [blinds.bigBlindSeat, 'BB'],
  ] as const) {
    const claimed = claim(seat, label);
    if (!claimed.ok) return claimed;
  }
  // The ladder walked BACKWARDS from the button over the seats that hold no blind:
  // order[n-1] is CO, the next non-blind seat before it is HJ, then UTG. With the blinds
  // in their default seats this is the untouched `n - step` walk.
  let step = 1;
  for (let index = n - 1; index >= 1; index -= 1) {
    const seat = order[index];
    if (seat === undefined) continue;
    if (seat === blinds.smallBlindSeat || seat === blinds.bigBlindSeat) continue;
    const label = NON_BLIND_LADDER[step];
    if (label === undefined) {
      return engineErr(
        'POSITION_LINEUP_UNSUPPORTED',
        `Seat ${seat} is the ${step + 1}th non-blind seat before the button and the Position union has no name for it`,
        { seat },
      );
    }
    const claimed = claim(seat, label);
    if (!claimed.ok) return claimed;
    step += 1;
  }
  return ok(labels);
}

/**
 * Total given a `BlindAssignment` that came from `assignBlinds`. `null` for seats that
 * are not dealt in.
 *
 * Labelling is delegated to `derivePositionLabels`, which is the only place a `Position`
 * is decided and which REFUSES a lineup it cannot name. `assignBlinds` runs that same
 * check before it returns, so an unlabelable assignment cannot reach a started hand;
 * reaching one here means a corrupt log, and the `invariant` is what `loadHand` turns
 * into `CORRUPT_LOG`.
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

  const derived = derivePositionLabels(dealtIn, blinds, rules);
  invariant(
    derived.ok,
    `this lineup has no valid positional labelling: ${derived.ok ? '' : derived.error.message}`,
  );
  const labels = unwrap(derived);

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
