/**
 * One completed hand -> per-player FACTS.
 *
 * Facts only (prompt §12): had an opportunity, took an action, bet this many milliBB,
 * showed these cards. No adjective, no interpretation, no strategy comparison. An
 * off-policy line is recorded exactly as it happened — the strategy model does not get to
 * rewrite history (prompt §31).
 *
 * ## The opportunity rules, stated once
 *
 * Every denominator below is a count of decisions that ACTUALLY REACHED the player, read
 * off `poker-core`'s own action log (see `decisions.ts`). Concretely, and by construction
 * rather than by a special case:
 *
 * - a player who folded gets no later opportunity on any street;
 * - a player who is all-in gets no later betting opportunity;
 * - a sitting-out player is not in `dealtInSeats` and gets nothing at all;
 * - a player action never reached gets nothing;
 * - a seat with no `playerId` is skipped for attribution but still counts as lineup
 *   context (it changes `HEADS_UP` vs `MULTIWAY` and the position ladder).
 *
 * Nothing here is deduced from a position alone.
 */
import { ok, type Card, type HandId, type PlayerId } from '@gto-self/shared';
import type { Hand, SeatIndex } from '@gto-self/poker-core';
import {
  isVoluntaryEffect,
  preflopSizeBucket,
  postflopSizeBucket,
  DEFAULT_PLAYER_MODEL_CONFIG,
  type BetSizeObservation,
  type ModelStatKey,
  type ObservedAction,
  type ObservedActionEffect,
  type ObservedPosition,
  type ObservedStreet,
  type PlayerModelConfig,
  type ShowEvidence,
  type ShowOutcome,
  type SpotDescriptor,
} from '@gto-self/player-core';
import { analysisErr, type AnalysisResult } from './errors.js';
import { bigBlindOf, decisionsOf, toObservedPosition, type Decision } from './decisions.js';

/** One opportunity and whether the player took the action that names the stat. */
export interface StatEvent {
  readonly key: ModelStatKey;
  /** True when the player took the action; false when the opportunity went unused. */
  readonly taken: boolean;
}

/** One decision, reduced to the spot it happened in and what the player did. */
export interface SpotObservation {
  readonly spotKey: string;
  readonly spot: SpotDescriptor;
  /** The verb the player used — `ALL_IN` stays `ALL_IN` (CLAUDE.md rule 3). */
  readonly verb: ObservedAction;
  /** What it functioned as. Every numerator is defined over this. */
  readonly effect: ObservedActionEffect;
}

/** Everything one hand says about one identified player. */
export interface PlayerHandObservations {
  readonly playerId: PlayerId;
  readonly seat: SeatIndex;
  readonly position: ObservedPosition;
  /** Decisions this player actually faced, in order. */
  readonly decisionCount: number;
  readonly sawFlop: boolean;
  readonly reachedShowdown: boolean;
  /** Gross chips won this hand, before rake and fee attribution, in milliBB. */
  readonly wonGross: number;
  /** One entry per real opportunity. Never a hand count standing in for a situation. */
  readonly stats: readonly StatEvent[];
  readonly spots: readonly SpotObservation[];
  readonly betSizes: readonly BetSizeObservation[];
  /** Present only when this player EXPLICITLY showed (ADR-0052). A muck yields null. */
  readonly show: ShowEvidence | null;
}

export interface HandObservations {
  readonly handId: HandId;
  readonly handNumber: number;
  /** The actual dealt-in lineup for THIS hand — never a six-handed assumption (§32). */
  readonly dealtInSeats: readonly SeatIndex[];
  /** Dealt-in seats with no player identity: lineup context, no attribution. */
  readonly unattributedSeats: readonly SeatIndex[];
  readonly endedInShowdown: boolean;
  /** Sorted by seat. */
  readonly players: readonly PlayerHandObservations[];
}

const facingBet = (decision: Decision): boolean => decision.record.currentBetBefore > 0;

/**
 * Internal. Is this decision facing the initiative holder's FIRST bet on this street?
 *
 * Deliberately derived from the raw context rather than from the spot family, so that the
 * fold-to-c-bet and check-raise denominators stay independent questions asked of the SAME
 * decision: a player who checked and then faces the continuation bet is counted in both.
 */
const facingContinuationBet = (decision: Decision): boolean =>
  facingBet(decision) &&
  decision.streetAggressionBefore === 1 &&
  decision.initiativeSeat !== null &&
  decision.streetAggressorBefore === decision.initiativeSeat;

/** Internal. Has initiative and nobody has bet this street yet. */
const canContinuationBet = (decision: Decision): boolean =>
  !facingBet(decision) &&
  decision.initiativeSeat !== null &&
  decision.seat === decision.initiativeSeat;

/** Internal. Already checked this street and is now facing a bet. */
const canCheckRaise = (decision: Decision): boolean =>
  facingBet(decision) && decision.hasCheckedThisStreet;

const first = <T>(items: readonly T[], match: (item: T) => boolean): T | undefined =>
  items.find(match);

const CBET_KEYS: Readonly<Record<ObservedStreet, ModelStatKey>> = {
  FLOP: 'CBET_FLOP',
  TURN: 'CBET_TURN',
  RIVER: 'CBET_RIVER',
};

const FOLD_TO_CBET_KEYS: Readonly<Record<ObservedStreet, ModelStatKey>> = {
  FLOP: 'FOLD_TO_CBET_FLOP',
  TURN: 'FOLD_TO_CBET_TURN',
  RIVER: 'FOLD_TO_CBET_RIVER',
};

const CHECK_RAISE_KEYS: Readonly<Record<ObservedStreet, ModelStatKey>> = {
  FLOP: 'CHECK_RAISE_FLOP',
  TURN: 'CHECK_RAISE_TURN',
  RIVER: 'CHECK_RAISE_RIVER',
};

const POSTFLOP_STREETS: readonly ObservedStreet[] = ['FLOP', 'TURN', 'RIVER'];

/** Positions a first-in raise is conventionally called a steal from. A LABEL, not a claim. */
const STEAL_POSITIONS: readonly ObservedPosition[] = ['CO', 'BTN', 'SB'];

/** Positions that can be stolen from: the blinds. */
const STEAL_DEFENDER_POSITIONS: readonly ObservedPosition[] = ['SB', 'BB'];

/** Internal. Every stat opportunity this player's decisions created, in a stable order. */
function statsFor(
  own: readonly Decision[],
  context: {
    readonly position: ObservedPosition;
    readonly sawFlop: boolean;
    readonly reachedShowdown: boolean;
    readonly wonGross: number;
  },
): readonly StatEvent[] {
  const out: StatEvent[] = [];
  const preflop = own.filter((decision) => decision.street === 'PREFLOP');

  // VPIP / PFR — denominator: this player faced at least one preflop decision. A blind
  // that was all-in before the action reached it faced none and is not counted.
  if (preflop.length > 0) {
    out.push({
      key: 'VPIP',
      taken: preflop.some((decision) => isVoluntaryEffect(decision.effect)),
    });
    out.push({
      key: 'PFR',
      taken: preflop.some((decision) => decision.effect === 'RAISE' || decision.effect === 'BET'),
    });
  }

  // RFI — denominator: a decision in a pot with no raise and no limp in front. Its first
  // occurrence only; a player cannot be first-in twice in one hand.
  const rfi = first(
    preflop,
    (decision) => decision.spot.phase === 'PREFLOP' && decision.spot.family === 'RFI',
  );
  if (rfi !== undefined) {
    out.push({ key: 'RFI', taken: rfi.effect === 'RAISE' });
    if (STEAL_POSITIONS.includes(context.position)) {
      out.push({ key: 'STEAL_ATTEMPT', taken: rfi.effect === 'RAISE' });
    }
  }

  // FOLD_TO_STEAL — denominator: in a blind, facing a first-in raise from CO/BTN/SB.
  const vsSteal = first(
    preflop,
    (decision) =>
      decision.spot.phase === 'PREFLOP' &&
      decision.spot.family === 'VS_OPEN' &&
      STEAL_DEFENDER_POSITIONS.includes(decision.position) &&
      decision.spot.opponentPosition !== null &&
      STEAL_POSITIONS.includes(decision.spot.opponentPosition),
  );
  if (vsSteal !== undefined) {
    out.push({ key: 'FOLD_TO_STEAL', taken: vsSteal.effect === 'FOLD' });
  }

  // THREE_BET — denominator: a decision facing EXACTLY one preflop raise (a defence or a
  // squeeze spot). First occurrence only.
  const vsOpen = first(preflop, (decision) => decision.raisesBefore === 1);
  if (vsOpen !== undefined) {
    out.push({ key: 'THREE_BET', taken: vsOpen.effect === 'RAISE' });
  }

  // FOLD_TO_THREE_BET / FOUR_BET — denominator: THIS player made the opening raise and is
  // now facing a re-raise. Same decision, two questions. A player who folded before the
  // 3-bet never reaches this decision and is not counted (prompt §30).
  const vsThreeBet = first(
    preflop,
    (decision) => decision.spot.phase === 'PREFLOP' && decision.spot.family === 'VS_THREE_BET',
  );
  if (vsThreeBet !== undefined) {
    out.push({ key: 'FOLD_TO_THREE_BET', taken: vsThreeBet.effect === 'FOLD' });
    out.push({ key: 'FOUR_BET', taken: vsThreeBet.effect === 'RAISE' });
  }

  // Postflop, per street.
  const cbetTaken: Partial<Record<ObservedStreet, boolean>> = {};
  for (const street of POSTFLOP_STREETS) {
    const onStreet = own.filter((decision) => decision.street === street);

    const cbet = first(onStreet, canContinuationBet);
    if (cbet !== undefined) {
      const taken = cbet.effect === 'BET';
      cbetTaken[street] = taken;
      out.push({ key: CBET_KEYS[street], taken });
    }

    const facing = first(onStreet, facingContinuationBet);
    if (facing !== undefined) {
      out.push({ key: FOLD_TO_CBET_KEYS[street], taken: facing.effect === 'FOLD' });
    }

    const checkRaise = first(onStreet, canCheckRaise);
    if (checkRaise !== undefined) {
      out.push({ key: CHECK_RAISE_KEYS[street], taken: checkRaise.effect === 'RAISE' });
    }
  }

  // Barrels — denominator: continuation-bet the PREVIOUS street AND reached a decision on
  // this one with the initiative and no bet in front. Betting the flop and then never
  // getting a turn decision (everybody folded) is not a missed barrel; it is no
  // opportunity at all.
  if (cbetTaken.FLOP === true && cbetTaken.TURN !== undefined) {
    out.push({ key: 'TURN_BARREL', taken: cbetTaken.TURN });
  }
  if (cbetTaken.TURN === true && cbetTaken.RIVER !== undefined) {
    out.push({ key: 'RIVER_BARREL', taken: cbetTaken.RIVER });
  }

  // WTSD — denominator: saw the flop. WSD — denominator: reached a showdown.
  if (context.sawFlop) out.push({ key: 'WTSD', taken: context.reachedShowdown });
  if (context.reachedShowdown) out.push({ key: 'WSD', taken: context.wonGross > 0 });

  return out;
}

/** Internal. Every aggressive action this player took, with the raw milliBB preserved. */
function betSizesFor(
  own: readonly Decision[],
  handId: HandId,
  playerId: PlayerId,
  bigBlind: number,
  config: PlayerModelConfig,
): readonly BetSizeObservation[] {
  const out: BetSizeObservation[] = [];
  for (const decision of own) {
    if (decision.effect !== 'BET' && decision.effect !== 'RAISE') continue;
    const record = decision.record;
    const toAmount = record.toAmount ?? record.amount;
    const preflop = decision.street === 'PREFLOP';
    const kind = preflop
      ? decision.raisesBefore === 0
        ? 'PREFLOP_OPEN'
        : decision.raisesBefore === 1
          ? 'PREFLOP_THREE_BET'
          : 'PREFLOP_FOUR_BET_PLUS'
      : decision.effect === 'BET'
        ? 'POSTFLOP_BET'
        : 'POSTFLOP_RAISE';
    out.push({
      handId,
      playerId,
      kind,
      spotKey: decision.spotKey,
      toAmount,
      amount: record.amount,
      potBefore: record.potBefore,
      currentBetBefore: record.currentBetBefore,
      bigBlind,
      bucket: preflop
        ? preflopSizeBucket(toAmount, bigBlind, config.preflopSizes)
        : postflopSizeBucket(record.amount, record.potBefore, config.postflopSizes),
    });
  }
  return out;
}

/**
 * Total. Folds ONE completed hand into per-player facts.
 *
 * Rejects a hand that has not reached `COMPLETE`: an unfinished hand has no settled
 * showdown, no awards and possibly more action to come, and counting it would produce a
 * denominator that changes underneath a snapshot.
 *
 * Deterministic: no clock, no RNG, no id generation. `players` is sorted by seat.
 */
export function extractHandObservations(
  hand: Hand,
  config: PlayerModelConfig = DEFAULT_PLAYER_MODEL_CONFIG,
): AnalysisResult<HandObservations> {
  const state = hand.state;
  if (state.phase !== 'COMPLETE') {
    return analysisErr('HAND_NOT_COMPLETE', `hand ${state.handId} is still ${state.phase}`, {
      handId: state.handId,
      expected: 'COMPLETE',
      actual: state.phase,
    });
  }

  const decisions = decisionsOf(state, config);
  const bigBlind = bigBlindOf(state);
  const endedInShowdown = state.endReason === 'SHOWDOWN';
  const sawFlopStreet = state.board.length >= 3;

  const players: PlayerHandObservations[] = [];
  const unattributed: SeatIndex[] = [];

  for (const seat of state.dealtInSeats) {
    const seatState = state.seats[seat];
    const playerId = seatState.playerId;
    if (playerId === null) {
      unattributed.push(seat);
      continue;
    }
    const assigned = state.positions[seat];
    if (assigned === null) {
      // A dealt-in seat always has a position once the roster is finalized, which a
      // COMPLETE hand guarantees. Refuse rather than invent one.
      return analysisErr('INVALID_INPUT', `dealt-in seat ${seat} has no position`, {
        handId: state.handId,
        seat,
      });
    }
    const own = decisions.filter((decision) => decision.seat === seat);
    const position = toObservedPosition(assigned.position);

    const foldedPreflop = own.some(
      (decision) => decision.street === 'PREFLOP' && decision.effect === 'FOLD',
    );
    const sawFlop = sawFlopStreet && !foldedPreflop;
    const reachedShowdown =
      endedInShowdown && (seatState.status === 'IN_HAND' || seatState.status === 'ALL_IN');
    const wonGross = seatState.wonGross;

    const show: ShowEvidence | null =
      seatState.holeCardsRevealed && seatState.holeCards.length > 0
        ? {
            handId: state.handId,
            playerId,
            position,
            cards: seatState.holeCards as readonly Card[],
            board: state.board,
            lastStreet: lastStreetOf(own),
            spotKeys: own.map((decision) => decision.spotKey),
            outcome: outcomeFor(endedInShowdown, reachedShowdown, wonGross),
            wonGross,
          }
        : null;

    players.push({
      playerId,
      seat,
      position,
      decisionCount: own.length,
      sawFlop,
      reachedShowdown,
      wonGross,
      stats: statsFor(own, { position, sawFlop, reachedShowdown, wonGross }),
      spots: own.map((decision) => ({
        spotKey: decision.spotKey,
        spot: decision.spot,
        verb: decision.verb,
        effect: decision.effect,
      })),
      betSizes: betSizesFor(own, state.handId, playerId, bigBlind, config),
      show,
    });
  }

  return ok({
    handId: state.handId,
    handNumber: state.handNumber,
    dealtInSeats: state.dealtInSeats,
    unattributedSeats: unattributed,
    endedInShowdown,
    players,
  });
}

function lastStreetOf(own: readonly Decision[]): 'PREFLOP' | ObservedStreet {
  const last = own[own.length - 1];
  if (last === undefined) return 'PREFLOP';
  return last.street;
}

/**
 * Internal. A reveal outside a showdown (or by a player who was not contesting it) tells
 * us nothing about who won, and `UNKNOWN` says so rather than guessing.
 */
function outcomeFor(
  endedInShowdown: boolean,
  reachedShowdown: boolean,
  wonGross: number,
): ShowOutcome {
  if (!endedInShowdown || !reachedShowdown) return 'UNKNOWN';
  return wonGross > 0 ? 'WON' : 'LOST';
}
