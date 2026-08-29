/**
 * The pure fold. `HandState` is exactly `events.reduce(applyEvent, initialHandState(e0))`.
 *
 * Everything here THROWS via `invariant()` rather than returning a Result: it is only
 * ever fed events the engine just produced, or events a replay entry point
 * (`replayHand` / `loadHand`) has gated, so a throw means a bug or a corrupt log.
 * The assertions are deliberately restricted to ARITHMETIC identities and structural
 * impossibilities, never rule policy — a corrected poker rule must never make stored
 * history unloadable (ADR-0009 in spirit).
 */
import { invariant, Money, unwrap, type Card, type MilliBB } from '@gto-self/shared';
import { isBettingRoundClosed, nextActor } from './betting.js';
import { validateTableConfig } from './config.js';
import type { EventOf, HandEvent } from './events.js';
import { effectiveStackFor } from './metrics.js';
import {
  assignBlinds,
  assignPositions,
  preflopActionOrder,
  postflopActionOrder,
} from './positions.js';
import {
  assertPotsConserveContributions,
  computePots,
  computeUncalledReturn,
  potTotal,
  unawardedPots,
} from './pots.js';
import { assertSettlementBalances, splitRakeAcrossShares } from './settlement.js';
import { makeBySeat, updateBySeat, type SeatIndex } from './seat.js';
import {
  contenders,
  emptySeatHandState,
  ZERO_BY_STREET,
  type ActionRecord,
  type BettingRound,
  type HandState,
  type SeatHandState,
} from './state.js';
import { boardCardsForStreet, nextStreet, type Street } from './street.js';

const MAX_BOARD_SIZES: readonly number[] = [0, 3, 4, 5];

function withSeat(
  state: HandState,
  seat: SeatIndex,
  f: (s: SeatHandState) => SeatHandState,
): HandState {
  return { ...state, seats: updateBySeat(state.seats, seat, f) };
}

function addToStreet(
  byStreet: Readonly<Record<Street, MilliBB>>,
  street: Street,
  delta: MilliBB,
): Readonly<Record<Street, MilliBB>> {
  return { ...byStreet, [street]: Money.add(byStreet[street], delta) };
}

/**
 * Throws only on an invalid embedded config. Produces the SETUP state: empty roster,
 * PREFLOP, empty board, empty pots, placeholder blinds and round (both replaced by
 * `finalizeRoster` once the roster is complete).
 */
export function initialHandState(started: EventOf<'HAND_STARTED'>): HandState {
  const validated = validateTableConfig(started.config);
  invariant(validated.ok, `HAND_STARTED carries an invalid TableConfig: ${started.handId}`);
  const config = started.config;
  return {
    handId: started.handId,
    handNumber: started.handNumber,
    config,
    buttonSeat: started.buttonSeat,
    heroSeat: started.heroSeat,
    blindOverride: started.blindOverride,
    blinds: {
      buttonSeat: started.buttonSeat,
      smallBlindSeat: started.buttonSeat,
      bigBlindSeat: started.buttonSeat,
      headsUp: false,
    },
    dealtInSeats: [],
    positions: makeBySeat(() => null),
    seats: makeBySeat(emptySeatHandState),
    street: 'PREFLOP',
    board: [],
    phase: 'SETUP',
    round: {
      street: 'PREFLOP',
      currentBet: Money.ZERO,
      lastFullRaiseSize: config.blinds.bigBlind,
      lastFullRaiseTo: Money.ZERO,
      fullRaiseCount: 1,
      lastAggressorSeat: null,
      lastActedSeat: null,
      actionOrder: [],
      closed: false,
    },
    actorSeat: null,
    pendingUncalled: null,
    pendingStreet: null,
    pots: [],
    potTotal: Money.ZERO,
    awards: [],
    totalRake: Money.ZERO,
    totalFees: Money.ZERO,
    endReason: null,
    actions: [],
    eventCount: 1,
    commandCount: 1,
  };
}

/**
 * Total. Preflop seeding (spec 7.5). `currentBet` is the nominal big blind under
 * `rules.shortBlindSetsFullLevel` even when the poster could not cover it, so a short
 * blind never lowers the price of entry; `fullRaiseCount` starts at 1 because the big
 * blind is the bring-in.
 */
export function seedPreflopRound(state: HandState): BettingRound {
  const posted = state.dealtInSeats.reduce<MilliBB>(
    (best, seat) => Money.max(best, state.seats[seat].streetContribution),
    Money.ZERO,
  );
  const currentBet = state.config.rules.shortBlindSetsFullLevel
    ? Money.max(state.config.blinds.bigBlind, posted)
    : posted;
  return {
    street: 'PREFLOP',
    currentBet,
    lastFullRaiseSize: state.config.blinds.bigBlind,
    lastFullRaiseTo: currentBet,
    fullRaiseCount: 1,
    lastAggressorSeat: state.blinds.bigBlindSeat,
    lastActedSeat: null,
    actionOrder: preflopActionOrder(state.dealtInSeats, state.blinds),
    closed: false,
  };
}

/**
 * Total. A fresh postflop round: no bet, `lastFullRaiseSize` back to `config.minBet`,
 * `fullRaiseCount` 0 and the postflop action order.
 *
 * NOTE: the per-seat side of a street transition (rolling `streetContribution` into
 * `contributionByStreet`, zeroing it and clearing `actedAtFullRaiseCount`) is performed
 * by `applyEvent` on the board-deal event, because this function returns only the round.
 */
export function openBettingRound(state: HandState, street: Street): BettingRound {
  return {
    street,
    currentBet: Money.ZERO,
    lastFullRaiseSize: state.config.minBet,
    lastFullRaiseTo: Money.ZERO,
    fullRaiseCount: 0,
    lastAggressorSeat: null,
    lastActedSeat: null,
    actionOrder: postflopActionOrder(state.dealtInSeats, state.blinds),
    closed: false,
  };
}

/**
 * Throws. Runs `assignBlinds` + `assignPositions` over the accumulated roster and seeds
 * the preflop round. `applyEvent` invokes it the first time it sees an event outside
 * `{ HAND_STARTED, PLAYER_DEALT_IN }` — in practice POST_ANTE, POST_DEAD_BLIND or
 * POST_SB. Exported so the transition is directly testable rather than an implicit side
 * effect.
 *
 * `state.blindOverride` (from `HAND_STARTED`) is fed straight to `assignBlinds`, so a
 * replay reaches exactly the blinds the hand was played with. An override the engine
 * would refuse today therefore throws here and surfaces as `CORRUPT_LOG` from
 * `loadHand` — the same shape as a `HAND_STARTED` whose button is not dealt in.
 */
export function finalizeRoster(state: HandState): HandState {
  invariant(state.phase === 'SETUP', 'finalizeRoster must run exactly once, from SETUP');
  const blindsResult = assignBlinds(
    state.dealtInSeats,
    state.buttonSeat,
    state.config.rules,
    state.blindOverride,
  );
  invariant(
    blindsResult.ok,
    `roster cannot be finalized: ${blindsResult.ok ? '' : blindsResult.error.message}`,
  );
  const blinds = unwrap(blindsResult);
  const positions = assignPositions(state.dealtInSeats, blinds, state.config.rules);
  const seeded: HandState = { ...state, blinds, positions, phase: 'BETTING' };
  return { ...seeded, round: seedPreflopRound(seeded) };
}

function assertBoardArity(board: readonly Card[]): void {
  invariant(
    MAX_BOARD_SIZES.includes(board.length),
    `board length ${board.length} is not one of 0, 3, 4, 5`,
  );
}

function knownCards(state: HandState, exceptSeat: SeatIndex | null): readonly Card[] {
  const out: Card[] = [...state.board];
  for (const seat of state.dealtInSeats) {
    if (seat === exceptSeat) continue;
    out.push(...state.seats[seat].holeCards);
  }
  return out;
}

function recordAction(
  before: HandState,
  after: HandState,
  event: HandEvent,
  seat: SeatIndex,
  toAmount: MilliBB | null,
  amount: MilliBB,
  isFullRaise: boolean,
): HandState {
  const record: ActionRecord = {
    seq: event.seq,
    commandSeq: event.commandSeq,
    street: before.street,
    seat,
    position: before.positions[seat]?.position ?? null,
    kind: event.kind,
    toAmount,
    amount,
    isAllIn: Money.isZero(after.seats[seat].stack) && after.seats[seat].status !== 'FOLDED',
    isFullRaise,
    currentBetBefore: before.round.currentBet,
    fullRaiseCountAfter: after.round.fullRaiseCount,
    potBefore: before.potTotal,
    potAfter: Money.sum(after.dealtInSeats.map((s) => after.seats[s].totalContribution)),
    effectiveStackBefore: effectiveStackFor(before, seat, 'REMAINING'),
  };
  return { ...after, actions: [...after.actions, record] };
}

/** Internal. Applies a wager's effect on the betting round (spec 7.3 / 7.4). */
function advanceRoundForWager(
  state: HandState,
  seat: SeatIndex,
  toAmount: MilliBB,
): { readonly round: BettingRound; readonly isFullRaise: boolean } {
  const round = state.round;
  const currentBetBefore = round.currentBet;
  if (toAmount <= currentBetBefore) {
    return {
      round: { ...round, lastActedSeat: seat },
      isFullRaise: false,
    };
  }
  const increment = Money.sub(toAmount, currentBetBefore);
  const isFullRaise = Money.isZero(currentBetBefore)
    ? toAmount >= state.config.minBet
    : increment >= round.lastFullRaiseSize;
  if (!isFullRaise) {
    // A short all-in raises the price to call but does NOT reopen the betting.
    return {
      round: { ...round, currentBet: toAmount, lastActedSeat: seat },
      isFullRaise: false,
    };
  }
  return {
    round: {
      ...round,
      currentBet: toAmount,
      lastFullRaiseSize: increment,
      lastFullRaiseTo: toAmount,
      fullRaiseCount: round.fullRaiseCount + 1,
      lastAggressorSeat: seat,
      lastActedSeat: seat,
    },
    isFullRaise: true,
  };
}

function applyWager(
  state: HandState,
  event: HandEvent & {
    readonly seat: SeatIndex;
    readonly toAmount: MilliBB;
    readonly amount: MilliBB;
  },
): HandState {
  const seat = event.seat;
  const s = state.seats[seat];
  invariant(state.phase === 'BETTING', `${event.kind} outside a betting round`);
  invariant(s.status === 'IN_HAND', `${event.kind} from seat ${seat} with status ${s.status}`);
  invariant(
    event.amount === Money.sub(event.toAmount, s.streetContribution),
    `${event.kind} amount ${event.amount} != toAmount ${event.toAmount} - street contribution ${s.streetContribution}`,
  );
  invariant(event.amount >= 0, `${event.kind} moves a negative amount`);
  invariant(
    event.amount <= s.stack,
    `${event.kind} of ${event.amount} exceeds seat ${seat}'s stack ${s.stack}`,
  );
  if (event.kind === 'ALL_IN') {
    invariant(event.amount === s.stack, 'ALL_IN must move the seat’s whole stack');
  }

  const { round, isFullRaise } = advanceRoundForWager(state, seat, event.toAmount);
  const staged = withSeat({ ...state, round }, seat, (seatState) => {
    const stack = Money.sub(seatState.stack, event.amount);
    return {
      ...seatState,
      stack,
      status: Money.isZero(stack) ? 'ALL_IN' : 'IN_HAND',
      streetContribution: event.toAmount,
      totalContribution: Money.add(seatState.totalContribution, event.amount),
      contributionByStreet: addToStreet(seatState.contributionByStreet, state.street, event.amount),
      actedAtFullRaiseCount: round.fullRaiseCount,
      lastAction: event.kind,
    };
  });
  return recordAction(state, staged, event, seat, event.toAmount, event.amount, isFullRaise);
}

function applyPost(
  state: HandState,
  event: HandEvent & { readonly seat: SeatIndex; readonly amount: MilliBB },
  dead: boolean,
): HandState {
  const seat = event.seat;
  const s = state.seats[seat];
  // Every post belongs to the hand start. `applyPost` ends by re-seeding the preflop
  // round, which is correct while group 0 is still accumulating blinds and ruinous
  // afterwards: a post spliced into a log after RIVER_DEALT would silently reset the
  // street to PREFLOP and reopen action for every seat. Dead money touches neither
  // `streetContribution` nor `contributionByStreet`, so the ledger and conservation
  // identities stay satisfied and would NOT catch it — this guard is what does.
  // `replayHand` already rejects such a log (its group head is an ENGINE event);
  // `loadHand`, the DB path, reaches here instead and turns this into CORRUPT_LOG.
  invariant(
    event.commandSeq === 0,
    `${event.kind} at seq ${event.seq} is outside command group 0; posts belong to the hand start`,
  );
  invariant(state.dealtInSeats.includes(seat), `${event.kind} for seat ${seat}, not dealt in`);
  invariant(event.amount >= 0, `${event.kind} posts a negative amount`);
  invariant(
    event.amount <= s.stack,
    `${event.kind} of ${event.amount} exceeds seat ${seat}'s stack ${s.stack}`,
  );
  const posted = withSeat(state, seat, (seatState) => {
    const stack = Money.sub(seatState.stack, event.amount);
    return {
      ...seatState,
      stack,
      status: Money.isZero(stack) ? 'ALL_IN' : seatState.status,
      // Antes and dead blinds are DEAD money: they never raise the price to call, but
      // they do count toward the side-pot layering basis.
      streetContribution: dead
        ? seatState.streetContribution
        : Money.add(seatState.streetContribution, event.amount),
      deadContribution: dead
        ? Money.add(seatState.deadContribution, event.amount)
        : seatState.deadContribution,
      totalContribution: Money.add(seatState.totalContribution, event.amount),
      contributionByStreet: dead
        ? seatState.contributionByStreet
        : addToStreet(seatState.contributionByStreet, 'PREFLOP', event.amount),
    };
  });
  return { ...posted, round: seedPreflopRound(posted) };
}

function applyBoard(state: HandState, cards: readonly Card[], street: Street): HandState {
  invariant(
    state.pendingUncalled === null,
    'a board cannot be dealt while an uncalled bet is still owed',
  );
  invariant(state.phase === 'AWAITING_BOARD', `board dealt in phase ${state.phase}`);
  invariant(
    state.pendingStreet === street,
    `expected ${String(state.pendingStreet)} cards, got ${street}`,
  );
  invariant(
    cards.length === boardCardsForStreet(street),
    `${street} needs ${boardCardsForStreet(street)} cards, got ${cards.length}`,
  );
  const known = knownCards(state, null);
  for (const card of cards) {
    invariant(!known.includes(card), `card ${card} is already in play`);
  }
  invariant(new Set(cards).size === cards.length, 'duplicate card in one deal');

  const board = [...state.board, ...cards];
  assertBoardArity(board);

  const rolled: HandState = {
    ...state,
    board,
    street,
    pendingStreet: null,
    seats: makeBySeat((seat) => {
      const s = state.seats[seat];
      return {
        ...s,
        streetContribution: Money.ZERO,
        contributionByStreet: { ...s.contributionByStreet, [street]: Money.ZERO },
        actedAtFullRaiseCount: null,
      };
    }),
  };
  return { ...rolled, round: openBettingRound(rolled, street) };
}

function applyAward(state: HandState, event: EventOf<'POT_AWARDED'>): HandState {
  const pot = state.pots.find((candidate) => candidate.index === event.potIndex);
  invariant(pot !== undefined, `POT_AWARDED for unknown pot ${event.potIndex}`);
  invariant(!pot.awarded, `pot ${event.potIndex} awarded twice`);
  invariant(
    event.grossAmount === pot.amount,
    `POT_AWARDED gross ${event.grossAmount} != pot amount ${pot.amount}`,
  );
  invariant(
    event.netAmount === Money.sub(Money.sub(event.grossAmount, event.rake), event.fee),
    'POT_AWARDED net must equal gross - rake - fee',
  );
  invariant(event.rake >= 0 && event.fee >= 0, 'POT_AWARDED rake and fee must not be negative');
  invariant(
    Money.sum(event.shares.map((share) => share.amount)) === event.netAmount,
    'POT_AWARDED shares must sum to the net amount',
  );
  invariant(event.winners.length > 0, 'POT_AWARDED needs at least one winner');
  invariant(
    new Set(event.winners).size === event.winners.length,
    'POT_AWARDED lists a winner twice',
  );
  invariant(event.shares.length === event.winners.length, 'POT_AWARDED needs one share per winner');
  for (const share of event.shares) {
    invariant(event.winners.includes(share.seat), `share for non-winner seat ${share.seat}`);
  }

  const rakeShares = splitRakeAcrossShares(event.rake, event.shares.length);
  const feeShares = splitRakeAcrossShares(event.fee, event.shares.length);
  let next: HandState = state;
  event.shares.forEach((share, index) => {
    const rakePart = rakeShares[index] ?? Money.ZERO;
    const feePart = feeShares[index] ?? Money.ZERO;
    next = withSeat(next, share.seat, (seatState) => ({
      ...seatState,
      stack: Money.add(seatState.stack, share.amount),
      // `wonGross` is what the seat won BEFORE both deductions, so the seat ledger
      // identity stays `stack = start - contributed + wonGross - rakePaid - feePaid`.
      wonGross: Money.add(
        seatState.wonGross,
        Money.add(share.amount, Money.add(rakePart, feePart)),
      ),
      rakePaid: Money.add(seatState.rakePaid, rakePart),
      feePaid: Money.add(seatState.feePaid, feePart),
    }));
  });

  return {
    ...next,
    awards: [
      ...next.awards,
      {
        potIndex: event.potIndex,
        winners: event.winners,
        grossAmount: event.grossAmount,
        rake: event.rake,
        fee: event.fee,
        netAmount: event.netAmount,
        shares: event.shares,
      },
    ],
    totalRake: Money.add(next.totalRake, event.rake),
    totalFees: Money.add(next.totalFees, event.fee),
  };
}

/**
 * Throws (invariant) on any event that cannot apply. Applies the payload, appends to
 * `actions` for voluntary actions, then calls `finalize()`.
 */
export function applyEvent(state: HandState, event: HandEvent): HandState {
  invariant(event.kind !== 'HAND_STARTED', 'HAND_STARTED may only be the first event');

  let base = state;
  if (base.phase === 'SETUP' && event.kind !== 'PLAYER_DEALT_IN') {
    base = finalizeRoster(base);
  }

  const counted = <T extends HandState>(next: T): HandState => ({
    ...next,
    eventCount: state.eventCount + 1,
    commandCount: Math.max(state.commandCount, event.commandSeq + 1),
  });

  switch (event.kind) {
    case 'PLAYER_DEALT_IN': {
      invariant(base.phase === 'SETUP', 'PLAYER_DEALT_IN after the roster was finalized');
      invariant(!base.dealtInSeats.includes(event.seat), `seat ${event.seat} is dealt in twice`);
      const last = base.dealtInSeats[base.dealtInSeats.length - 1];
      invariant(
        last === undefined || event.seat > last,
        'PLAYER_DEALT_IN events must be in ascending seat order',
      );
      invariant(event.startingStack > 0, `seat ${event.seat} needs a positive starting stack`);
      const withRoster: HandState = {
        ...base,
        dealtInSeats: [...base.dealtInSeats, event.seat],
        seats: updateBySeat(base.seats, event.seat, (s) => ({
          ...s,
          playerId: event.playerId,
          status: 'IN_HAND',
          startingStack: event.startingStack,
          stack: event.startingStack,
          streetContribution: Money.ZERO,
          deadContribution: Money.ZERO,
          totalContribution: Money.ZERO,
          contributionByStreet: ZERO_BY_STREET,
        })),
      };
      return finalize(counted(withRoster));
    }
    case 'POST_ANTE':
      invariant(base.config.ante.enabled, 'POST_ANTE with the ante disabled');
      return finalize(counted(applyPost(base, event, true)));
    // A dead blind is an ante for accounting purposes and shares its exact path: the
    // SAME `applyPost(dead: true)`, including the case where it takes the whole stack
    // and leaves the seat ALL_IN. There is deliberately no config gate — a dead blind is
    // explicit user input, not a table setting.
    case 'POST_DEAD_BLIND':
      return finalize(counted(applyPost(base, event, true)));
    case 'POST_SB':
      invariant(
        event.seat === base.blinds.smallBlindSeat,
        `POST_SB from seat ${event.seat}, small blind is seat ${base.blinds.smallBlindSeat}`,
      );
      return finalize(counted(applyPost(base, event, false)));
    case 'POST_BB':
      invariant(
        event.seat === base.blinds.bigBlindSeat,
        `POST_BB from seat ${event.seat}, big blind is seat ${base.blinds.bigBlindSeat}`,
      );
      return finalize(counted(applyPost(base, event, false)));
    case 'HOLE_CARDS_SET': {
      invariant(
        base.dealtInSeats.includes(event.seat),
        `HOLE_CARDS_SET for seat ${event.seat}, not dealt in`,
      );
      invariant(
        event.cards.length >= 1 && event.cards.length <= 2,
        `hole cards must be 1 or 2 cards, got ${event.cards.length}`,
      );
      invariant(new Set(event.cards).size === event.cards.length, 'duplicate hole card');
      const known = knownCards(base, event.seat);
      for (const card of event.cards) {
        invariant(!known.includes(card), `card ${card} is already in play`);
      }
      return finalize(
        counted(
          withSeat(base, event.seat, (s) => ({
            ...s,
            holeCards: [...event.cards],
            holeCardsRevealed: event.revealed,
          })),
        ),
      );
    }
    case 'FOLD': {
      const s = base.seats[event.seat];
      invariant(base.phase === 'BETTING', 'FOLD outside a betting round');
      invariant(s.status === 'IN_HAND', `FOLD from seat ${event.seat} with status ${s.status}`);
      const folded = withSeat(
        { ...base, round: { ...base.round, lastActedSeat: event.seat } },
        event.seat,
        (seatState) => ({
          ...seatState,
          status: 'FOLDED',
          actedAtFullRaiseCount: base.round.fullRaiseCount,
          lastAction: 'FOLD',
        }),
      );
      return finalize(
        counted(recordAction(base, folded, event, event.seat, null, Money.ZERO, false)),
      );
    }
    case 'CHECK': {
      const s = base.seats[event.seat];
      invariant(base.phase === 'BETTING', 'CHECK outside a betting round');
      invariant(s.status === 'IN_HAND', `CHECK from seat ${event.seat} with status ${s.status}`);
      invariant(
        s.streetContribution >= base.round.currentBet,
        `seat ${event.seat} cannot check facing a bet`,
      );
      const checked = withSeat(
        { ...base, round: { ...base.round, lastActedSeat: event.seat } },
        event.seat,
        (seatState) => ({
          ...seatState,
          actedAtFullRaiseCount: base.round.fullRaiseCount,
          lastAction: 'CHECK',
        }),
      );
      return finalize(
        counted(recordAction(base, checked, event, event.seat, null, Money.ZERO, false)),
      );
    }
    case 'CALL':
    case 'BET':
    case 'RAISE':
    case 'ALL_IN':
      return finalize(counted(applyWager(base, event)));
    case 'RETURN_UNCALLED': {
      const pending = base.pendingUncalled;
      invariant(pending !== null, 'RETURN_UNCALLED with nothing owed');
      invariant(
        pending.seat === event.seat && pending.amount === event.amount,
        `RETURN_UNCALLED of ${event.amount} to seat ${event.seat} does not match the ${pending.amount} owed to seat ${pending.seat}`,
      );
      const returned = withSeat(base, event.seat, (s) => {
        const stack = Money.add(s.stack, event.amount);
        return {
          ...s,
          stack,
          status: s.status === 'ALL_IN' && !Money.isZero(stack) ? 'IN_HAND' : s.status,
          streetContribution: Money.sub(s.streetContribution, event.amount),
          totalContribution: Money.sub(s.totalContribution, event.amount),
          contributionByStreet: addToStreet(
            s.contributionByStreet,
            base.street,
            Money.sub(Money.ZERO, event.amount),
          ),
          returnedUncalled: Money.add(s.returnedUncalled, event.amount),
        };
      });
      // The uncalled excess was never a real price: lowering `currentBet` by the same
      // amount is what keeps the round closed. Without it the returning seat's street
      // contribution would fall below `currentBet` and `mustAct` would put it back on
      // the clock. `currentBet >= top >= amount + second` always holds, so no seat that
      // was square before the return owes chips after it.
      const settledRound = {
        ...base.round,
        currentBet: Money.sub(base.round.currentBet, event.amount),
      };
      return finalize(counted({ ...returned, round: settledRound, pendingUncalled: null }));
    }
    case 'FLOP_DEALT':
      return finalize(counted(applyBoard(base, event.cards, 'FLOP')));
    case 'TURN_DEALT':
      return finalize(counted(applyBoard(base, [event.card], 'TURN')));
    case 'RIVER_DEALT':
      return finalize(counted(applyBoard(base, [event.card], 'RIVER')));
    case 'POT_AWARDED':
      invariant(base.phase !== 'COMPLETE', 'POT_AWARDED after the hand finished');
      return finalize(counted(applyAward(base, event)));
    case 'HAND_FINISHED': {
      invariant(base.endReason === null, 'HAND_FINISHED twice');
      invariant(unawardedPots(base).length === 0, 'HAND_FINISHED while pots are still unawarded');
      invariant(
        base.totalRake === event.totalRake,
        `HAND_FINISHED rake ${event.totalRake} != accumulated ${base.totalRake}`,
      );
      invariant(
        base.totalFees === event.totalFees,
        `HAND_FINISHED fees ${event.totalFees} != accumulated ${base.totalFees}`,
      );
      return finalize(counted({ ...base, endReason: event.reason }));
    }
  }
}

/**
 * Throws. The ONLY writer of derived state, and the last statement of `applyEvent`.
 * Recomputes, in order: pots, potTotal, round.closed, actorSeat, pendingUncalled,
 * pendingStreet, phase; then asserts chip and pot conservation.
 */
export function finalize(state: HandState): HandState {
  const awarded = new Set(state.awards.map((award) => award.potIndex));
  const pots = computePots(state.seats, state.dealtInSeats).map((pot) => ({
    ...pot,
    awarded: awarded.has(pot.index),
  }));
  const base: HandState = { ...state, pots, potTotal: potTotal(pots) };

  const settled = ((): HandState => {
    if (base.phase === 'SETUP') {
      return { ...base, actorSeat: null, pendingUncalled: null, pendingStreet: null };
    }
    if (base.endReason !== null) {
      return {
        ...base,
        phase: 'COMPLETE',
        round: { ...base.round, closed: true },
        actorSeat: null,
        pendingUncalled: null,
        pendingStreet: null,
      };
    }
    const closed = isBettingRoundClosed(base);
    const withRound: HandState = { ...base, round: { ...base.round, closed } };
    if (!closed) {
      const actor = nextActor(withRound);
      invariant(actor !== null, 'the betting round is open but no seat is on the clock');
      return {
        ...withRound,
        phase: 'BETTING',
        actorSeat: actor,
        pendingUncalled: null,
        pendingStreet: null,
      };
    }
    const uncalled = computeUncalledReturn(withRound);
    if (uncalled !== null) {
      return {
        ...withRound,
        phase: 'AWAITING_UNCALLED_RETURN',
        actorSeat: null,
        pendingUncalled: uncalled,
        pendingStreet: null,
      };
    }
    const pending = unawardedPots(withRound);
    const awaitingAward: HandState = {
      ...withRound,
      phase: 'AWAITING_AWARD',
      actorSeat: null,
      pendingUncalled: null,
      pendingStreet: null,
    };
    if (pending.length === 0) return awaitingAward;
    if (contenders(withRound).length === 1) return awaitingAward;
    if (withRound.street === 'RIVER') return awaitingAward;
    return {
      ...withRound,
      phase: 'AWAITING_BOARD',
      actorSeat: null,
      pendingUncalled: null,
      pendingStreet: nextStreet(withRound.street),
    };
  })();

  assertBoardArity(settled.board);
  assertSeatLedgers(settled);
  assertPotsConserveContributions(settled);
  assertChipConservation(settled);
  if (settled.phase === 'COMPLETE') assertSettlementBalances(settled);
  return settled;
}

/**
 * Throws. The standing per-seat identity from the spec, checked after every event:
 * `stack === startingStack - totalContribution + wonGross - rakePaid - feePaid`.
 */
export function assertSeatLedgers(state: HandState): void {
  for (const seat of state.dealtInSeats) {
    const s = state.seats[seat];
    const expected = Money.add(
      Money.sub(s.startingStack, s.totalContribution),
      Money.sub(s.wonGross, Money.add(s.rakePaid, s.feePaid)),
    );
    invariant(s.stack === expected, `seat ${seat} ledger broken: stack ${s.stack} != ${expected}`);
    invariant(s.stack >= 0, `seat ${seat} has a negative stack`);
    // ALL_IN means "this seat has committed its ENTIRE starting stack", which is the
    // condition that survives settlement. Testing `stack === ZERO` instead is the same
    // statement only until a pot is awarded: `POT_AWARDED` credits the winner's stack
    // WITHOUT un-committing anything, so an all-in seat that wins legitimately ends the
    // hand ALL_IN with chips behind. (`RETURN_UNCALLED` is the opposite case — it gives
    // back money the seat never really wagered, lowers `totalContribution`, and therefore
    // flips the status back to IN_HAND, which this identity requires.)
    invariant(
      s.status !== 'ALL_IN' || s.totalContribution === s.startingStack,
      `seat ${seat} is ALL_IN without having committed its whole stack`,
    );
    invariant(
      s.streetContribution === s.contributionByStreet[state.street],
      `seat ${seat} street contribution is out of sync with contributionByStreet`,
    );
  }
}

/**
 * Throws. `sum(stacks) + potTotal(unawarded pots) + totalRake + totalFees ===
 * sum(startingStacks)`. Holds after EVERY event, including mid-award with a mix of
 * awarded and unawarded pots, and with a fee charged on some pots but not others.
 */
export function assertChipConservation(state: HandState): void {
  const stacks = Money.sum(state.dealtInSeats.map((seat) => state.seats[seat].stack));
  const live = potTotal(unawardedPots(state));
  const starting = Money.sum(state.dealtInSeats.map((seat) => state.seats[seat].startingStack));
  const deducted = Money.add(state.totalRake, state.totalFees);
  const total = Money.add(Money.add(stacks, live), deducted);
  invariant(
    total === starting,
    `chip conservation broken: ${stacks} behind + ${live} in pots + ${state.totalRake} rake + ${state.totalFees} fees != ${starting} started`,
  );
}

/** Throws. For trusted logs the engine produced itself. */
export function foldEvents(events: readonly HandEvent[]): HandState {
  const first = events[0];
  invariant(first !== undefined, 'an empty event log has no state');
  invariant(first.kind === 'HAND_STARTED', 'the first event must be HAND_STARTED');
  let state = initialHandState(first);
  for (let i = 1; i < events.length; i += 1) {
    const event = events[i];
    invariant(event !== undefined, `missing event at index ${i}`);
    state = applyEvent(state, event);
  }
  return state;
}
