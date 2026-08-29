/**
 * Award planning, odd-chip splitting and per-seat results.
 *
 * Rake is computed ONCE on the summed gross of every pot being awarded, with ONE
 * per-hand cap, then allocated across pots — which is why `AWARD_POTS` must cover every
 * unawarded pot in a single command. A splash fee, when one is supplied, is a SECOND and
 * separate deduction handled the same way (ADR-0018/0032): it is validated in `fee.ts`,
 * allocated with each pot's rake already subtracted from its ceiling, and recorded as
 * its own amount everywhere the rake is.
 */
import { invariant, Money, ok, type MilliBB, type PlayerId } from '@gto-self/shared';
import { engineErr, type EngineResult } from './errors.js';
import type { HandEndReason, PotShare } from './events.js';
import { allocateFee, resolveFee } from './fee.js';
import { potTotal, unawardedPots, type Pot } from './pots.js';
import { allocateRake, computeRake } from './rake.js';
import { orderClockwise, type SeatIndex } from './seat.js';
import { contenders, type HandState, type PotAwardRecord } from './state.js';

export interface PotAwardInput {
  readonly potIndex: number;
  /** One or more winners. An empty array is NO_WINNERS; duplicates are DUPLICATE_WINNER. */
  readonly winners: readonly SeatIndex[];
}

export interface SettlementPlan {
  readonly records: readonly PotAwardRecord[];
  readonly totalRake: MilliBB;
  /** ZERO unless a fee was supplied for this hand. Never merged into `totalRake`. */
  readonly totalFees: MilliBB;
  readonly reason: HandEndReason;
}

export interface SeatResult {
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly startingStack: MilliBB;
  readonly endingStack: MilliBB;
  readonly contributed: MilliBB;
  readonly wonGross: MilliBB;
  readonly rakePaid: MilliBB;
  readonly feePaid: MilliBB;
  /** `endingStack - startingStack`. */
  readonly net: MilliBB;
}

export interface HandResult {
  readonly pots: readonly PotAwardRecord[];
  readonly totalRake: MilliBB;
  readonly totalFees: MilliBB;
  readonly reason: HandEndReason;
  readonly seats: readonly SeatResult[];
}

/** Total. True once the board reached three cards. The `'NO_FLOP_NO_DROP'` trigger test. */
export function sawFlop(state: HandState): boolean {
  return state.board.length >= 3;
}

/**
 * Total. `'FIRST_LEFT_OF_BUTTON'` orders the winners clockwise from the seat left of the
 * button (the button itself last); `'LOWEST_SEAT_INDEX'` orders them ascending.
 * Remainder milliBB from `Money.splitEvenly` go one each along this order.
 */
export function oddChipOrder(
  state: HandState,
  winners: readonly SeatIndex[],
): readonly SeatIndex[] {
  if (state.config.rules.oddChipRule === 'LOWEST_SEAT_INDEX') {
    return [...winners].sort((a, b) => a - b);
  }
  return orderClockwise(winners, state.buttonSeat, false);
}

/** Total. `Money.splitEvenly` along `oddChipOrder`. Sum of shares === `netAmount` (asserted). */
export function splitPot(
  state: HandState,
  netAmount: MilliBB,
  winners: readonly SeatIndex[],
): readonly PotShare[] {
  invariant(winners.length > 0, 'splitPot needs at least one winner');
  const order = oddChipOrder(state, winners);
  const { share, remainder } = Money.splitEvenly(netAmount, order.length);
  const shares = order.map((seat, index) => ({
    seat,
    amount: Money.add(share, (index < remainder ? 1 : 0) as MilliBB),
  }));
  invariant(
    Money.sum(shares.map((s) => s.amount)) === netAmount,
    'splitPot shares must sum to the net amount',
  );
  return shares;
}

/**
 * Total. Per-winner deduction attribution for one pot, in the same order as `shares`.
 * The event stores only the pot's total rake and total fee; this is how the reducer
 * reproduces each seat's `rakePaid` and `feePaid` so the standing per-seat chip identity
 * holds. Both use it, so a pot's rake and fee are attributed by the same rule.
 */
export function splitRakeAcrossShares(rake: MilliBB, shareCount: number): readonly MilliBB[] {
  invariant(shareCount > 0, 'splitRakeAcrossShares needs at least one share');
  const { share, remainder } = Money.splitEvenly(rake, shareCount);
  return Array.from({ length: shareCount }, (_unused, index) =>
    Money.add(share, (index < remainder ? 1 : 0) as MilliBB),
  );
}

function planFor(
  state: HandState,
  awards: readonly PotAwardInput[],
  reason: HandEndReason,
  suppliedFee: MilliBB | null,
): EngineResult<SettlementPlan> {
  const pending = unawardedPots(state);
  const seen = new Set<number>();
  const targets: { readonly pot: Pot; readonly winners: readonly SeatIndex[] }[] = [];

  for (const award of awards) {
    const pot = state.pots.find((candidate) => candidate.index === award.potIndex);
    if (pot === undefined) {
      return engineErr('UNKNOWN_POT', `There is no pot ${award.potIndex} in this hand`, {
        potIndex: award.potIndex,
      });
    }
    if (pot.awarded || seen.has(pot.index)) {
      return engineErr('POT_ALREADY_AWARDED', `Pot ${pot.index} has already been awarded`, {
        potIndex: pot.index,
      });
    }
    seen.add(pot.index);
    if (award.winners.length === 0) {
      return engineErr('NO_WINNERS', `Pot ${pot.index} needs at least one winner`, {
        potIndex: pot.index,
      });
    }
    if (new Set(award.winners).size !== award.winners.length) {
      return engineErr('DUPLICATE_WINNER', `Pot ${pot.index} lists a winner twice`, {
        potIndex: pot.index,
      });
    }
    for (const winner of award.winners) {
      if (!pot.eligibleSeats.includes(winner)) {
        return engineErr(
          'WINNER_NOT_ELIGIBLE',
          `Seat ${winner} is not eligible for pot ${pot.index}`,
          { potIndex: pot.index, seat: winner },
        );
      }
    }
    targets.push({ pot, winners: award.winners });
  }

  for (const pot of pending) {
    if (!seen.has(pot.index)) {
      return engineErr(
        'AWARDS_INCOMPLETE',
        `Pot ${pot.index} was not covered; every remaining pot must be awarded at once so the rake cap applies exactly once`,
        { potIndex: pot.index },
      );
    }
  }

  targets.sort((a, b) => a.pot.index - b.pot.index);
  const pots = targets.map((target) => target.pot);
  const gross = potTotal(pots);
  const rakeResult = computeRake(gross, state.config.rake, {
    sawFlop: sawFlop(state),
    contenderCount: contenders(state).length,
  });
  const perPotRake = allocateRake(pots, rakeResult.rake, state.config.rake.allocation);

  const fee = resolveFee(suppliedFee, state.config.fee, {
    gross,
    rake: rakeResult.rake,
  });
  if (!fee.ok) return fee;
  const perPotFee = allocateFee(pots, perPotRake, fee.value, state.config.fee.allocation);

  const records: PotAwardRecord[] = targets.map((target, index) => {
    const rake = perPotRake[index] ?? Money.ZERO;
    const potFee = perPotFee[index] ?? Money.ZERO;
    const netAmount = Money.sub(Money.sub(target.pot.amount, rake), potFee);
    return {
      potIndex: target.pot.index,
      winners: [...target.winners],
      grossAmount: target.pot.amount,
      rake,
      fee: potFee,
      netAmount,
      shares: splitPot(state, netAmount, target.winners),
    };
  });

  return ok({ records, totalRake: rakeResult.rake, totalFees: fee.value, reason });
}

/**
 * Result. `awards` must cover EVERY unawarded pot exactly once, each with at least one
 * distinct winner drawn from that pot's `eligibleSeats`. Rake is computed once on the
 * summed gross with one per-hand cap, then allocated. `reason` is SHOWDOWN.
 *
 * `fee` is the whole hand's splash fee as OBSERVED by the user (or, later, the parser).
 * `null` — the normal case — means none was supplied and the hand's fee is ZERO; there
 * is no automatic trigger (ADR-0032). A supplied fee is range-checked by `resolveFee`
 * and then used exactly as entered.
 */
export function planAwards(
  state: HandState,
  awards: readonly PotAwardInput[],
  fee: MilliBB | null = null,
): EngineResult<SettlementPlan> {
  return planFor(state, awards, 'SHOWDOWN', fee);
}

/**
 * Result. Used when `contenders(state).length === 1`: the winner is derived, not asked
 * for. `reason` is ALL_FOLDED. Errors NOT_AWAITING_AWARD when more than one contender
 * remains.
 *
 * `fee` behaves exactly as in `planAwards`. The engine cascade that calls this supplies
 * `null`, because an uncontested pot is awarded with no user command to carry an
 * observed fee — see `drainCascade`. The parameter exists so a caller that HAS observed
 * one (Phase 11) needs no new signature.
 */
export function autoAwardUncontested(
  state: HandState,
  fee: MilliBB | null = null,
): EngineResult<SettlementPlan> {
  const live = contenders(state);
  const winner = live[0];
  if (live.length !== 1 || winner === undefined) {
    return engineErr(
      'NOT_AWAITING_AWARD',
      `Automatic award needs exactly one contender, found ${live.length}`,
    );
  }
  const awards = unawardedPots(state).map((pot) => ({
    potIndex: pot.index,
    winners: [winner] as readonly SeatIndex[],
  }));
  return planFor(state, awards, 'ALL_FOLDED', fee);
}

/** Total. The seat's ledger for this hand; `net` is honest before COMPLETE too. */
export function seatResult(state: HandState, seat: SeatIndex): SeatResult {
  const s = state.seats[seat];
  return {
    seat,
    playerId: s.playerId,
    startingStack: s.startingStack,
    endingStack: s.stack,
    contributed: s.totalContribution,
    wonGross: s.wonGross,
    rakePaid: s.rakePaid,
    feePaid: s.feePaid,
    net: Money.sub(s.stack, s.startingStack),
  };
}

/** Total at any phase after the roster is finalized; null while the hand is still SETUP. */
export function handResult(state: HandState): HandResult | null {
  if (state.dealtInSeats.length === 0) return null;
  return {
    pots: state.awards,
    totalRake: state.totalRake,
    totalFees: state.totalFees,
    reason: state.endReason ?? (contenders(state).length === 1 ? 'ALL_FOLDED' : 'SHOWDOWN'),
    seats: state.dealtInSeats.map((seat) => seatResult(state, seat)),
  };
}

/** Throws. At COMPLETE, `sum(seat net) + totalRake + totalFees === ZERO`. */
export function assertSettlementBalances(state: HandState): void {
  const net = Money.sum(state.dealtInSeats.map((seat) => seatResult(state, seat).net));
  const deducted = Money.add(state.totalRake, state.totalFees);
  invariant(
    Money.add(net, deducted) === Money.ZERO,
    `settlement does not balance: net ${net} + rake ${state.totalRake} + fees ${state.totalFees} != 0`,
  );
}
