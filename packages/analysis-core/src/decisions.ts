/**
 * The replay walk: one completed hand's event log becomes an ordered list of DECISIONS,
 * each with the context needed to name the spot it happened in.
 *
 * ## Why `HandState.actions` is the opportunity source of truth
 *
 * `poker-core` maintains `HandState.actions` as a fold of the event log: one
 * `ActionRecord` for every voluntary action any seat actually took, with the engine's own
 * street, position, pot-before and current-bet-before attached. A record exists exactly
 * when the engine put that seat on the clock — which is precisely the definition of an
 * opportunity in prompt §16 and §30:
 *
 * - a seat that folded is never on the clock again, so it produces no further records;
 * - an all-in seat has no chips behind and is skipped by `seatsAbleToAct`, so it produces
 *   no further records;
 * - a sitting-out seat is not in `dealtInSeats` at all, so it produces none, ever;
 * - a seat action never reached (everyone folded in front and the hand ended) produces
 *   none.
 *
 * So opportunities are never guessed from a position: they are read off the actual action
 * flow, which is what the brief demands. Nothing in this file re-implements a poker rule;
 * it only classifies what the engine already decided.
 *
 * Everything here is pure and deterministic: no clock, no RNG, no id generation.
 */
import { type MilliBB, type PlayerId } from '@gto-self/shared';
import type { ActionRecord, HandState, Position, SeatIndex, Street } from '@gto-self/poker-core';
import {
  postflopSizeBucket,
  spotKey,
  type BetSizeBucket,
  type LineupShape,
  type ObservedAction,
  type ObservedActionEffect,
  type ObservedPosition,
  type ObservedStreet,
  type PlayerModelConfig,
  type PositionRelation,
  type PostflopSpot,
  type PotType,
  type PreflopSpot,
  type SpotDescriptor,
} from '@gto-self/player-core';

/**
 * Total. `poker-core`'s `Position` -> `player-core`'s `ObservedPosition`.
 *
 * The two unions are structurally identical and separately declared on purpose:
 * `player-core` must not import `poker-core` (ADR-0021/ADR-0035), so the mapping happens
 * HERE, in the one package allowed to see both. Written as an exhaustive switch rather
 * than a cast so that widening either union breaks the build instead of drifting.
 */
export function toObservedPosition(position: Position): ObservedPosition {
  switch (position) {
    case 'UTG':
      return 'UTG';
    case 'HJ':
      return 'HJ';
    case 'CO':
      return 'CO';
    case 'BTN':
      return 'BTN';
    case 'SB':
      return 'SB';
    case 'BB':
      return 'BB';
  }
}

/** Total. The postflop-only street label, or `null` for preflop. */
export function toObservedStreet(street: Street): ObservedStreet | null {
  switch (street) {
    case 'PREFLOP':
      return null;
    case 'FLOP':
      return 'FLOP';
    case 'TURN':
      return 'TURN';
    case 'RIVER':
      return 'RIVER';
  }
}

/**
 * Total. What the action FUNCTIONED as.
 *
 * Only `ALL_IN` needs deriving: `poker-core` deliberately stores the verb the user pressed
 * and never the effect (`events.ts`). A shove for less than the price to call is a CALL; a
 * shove into an unbet street is a BET; anything else that raises the price is a RAISE.
 * Every numerator in this package is defined over the effect, so a player who shoves
 * instead of pressing "raise" is still counted as having raised.
 */
export function actionEffect(record: ActionRecord): ObservedActionEffect {
  switch (record.kind) {
    case 'FOLD':
      return 'FOLD';
    case 'CHECK':
      return 'CHECK';
    case 'CALL':
      return 'CALL';
    case 'BET':
      return 'BET';
    case 'RAISE':
      return 'RAISE';
    case 'ALL_IN': {
      const to = record.toAmount ?? record.currentBetBefore;
      if (to <= record.currentBetBefore) return 'CALL';
      return record.currentBetBefore === 0 ? 'BET' : 'RAISE';
    }
    default:
      // `HandState.actions` only ever receives the six action kinds; anything else is a
      // poker-core change this package has not been taught about, and a silent default
      // would be a fake implementation (CLAUDE.md rule 5).
      throw new Error(`action record carries a non-action kind: ${record.kind}`);
  }
}

/** Total. The verb, unchanged — user input is preserved alongside the derived effect. */
export function actionVerb(record: ActionRecord): ObservedAction {
  switch (record.kind) {
    case 'FOLD':
    case 'CHECK':
    case 'CALL':
    case 'BET':
    case 'RAISE':
    case 'ALL_IN':
      return record.kind;
    default:
      throw new Error(`action record carries a non-action kind: ${record.kind}`);
  }
}

const isAggressive = (effect: ObservedActionEffect): boolean =>
  effect === 'BET' || effect === 'RAISE';

/**
 * One decision a player actually faced, with everything needed to classify it.
 *
 * `spot` is the classification; the raw `record` is kept beside it so nothing downstream
 * has to re-derive a number the engine already computed, and so an off-policy line is
 * recorded exactly as it happened (prompt §31).
 */
export interface Decision {
  /** Index in `HandState.actions`; the deterministic order key within a hand. */
  readonly index: number;
  readonly seat: SeatIndex;
  readonly playerId: PlayerId | null;
  readonly position: ObservedPosition;
  readonly street: Street;
  readonly verb: ObservedAction;
  readonly effect: ObservedActionEffect;
  readonly spot: SpotDescriptor;
  readonly spotKey: string;
  readonly record: ActionRecord;

  /** Contenders still in the pot when this decision was faced, this seat included. */
  readonly liveCountBefore: number;
  readonly lineup: LineupShape;
  /** Preflop raises made before this decision. 0 means the pot is unopened. */
  readonly raisesBefore: number;
  /** Preflop calls at the blind level made before this decision. */
  readonly limpersBefore: number;
  /** Preflop calls of a raise made before this decision. */
  readonly coldCallersBefore: number;
  /** Aggressive actions on THIS street before this decision. */
  readonly streetAggressionBefore: number;
  /** Seat of the last aggressor on this street, or null when nobody has bet. */
  readonly streetAggressorBefore: SeatIndex | null;
  /** Seat of the previous street's last aggressor — who holds the initiative. */
  readonly initiativeSeat: SeatIndex | null;
  /** True when this seat has already checked on this street. */
  readonly hasCheckedThisStreet: boolean;
  /** The pot type this street is being played in. */
  readonly potType: PotType;
}

interface StreetScratch {
  aggressionCount: number;
  aggressorSeat: SeatIndex | null;
  /** The last aggressive record on this street, for sizing the bet being faced. */
  lastAggression: ActionRecord | null;
  checked: Set<SeatIndex>;
  decisionCount: number;
}

const freshStreet = (): StreetScratch => ({
  aggressionCount: 0,
  aggressorSeat: null,
  lastAggression: null,
  checked: new Set(),
  decisionCount: 0,
});

/** Total. LIMPED / SINGLE_RAISED / THREE_BET / FOUR_BET_PLUS from the preflop raise count. */
export function potTypeForRaises(raises: number): PotType {
  if (raises <= 0) return 'LIMPED';
  if (raises === 1) return 'SINGLE_RAISED';
  if (raises === 2) return 'THREE_BET';
  return 'FOUR_BET_PLUS';
}

/**
 * Internal. Is this seat last to act among the seats still contesting the pot?
 *
 * `postflopOrder` is `poker-core`'s own postflop action index (0 = first to act), so IP
 * and OOP come from the engine's action order and not from a position-name heuristic.
 * Multiway is reduced to the same binary: the seat acting last among the live players is
 * IP, everyone else is OOP. That is a deliberate simplification — a three-way pot has a
 * middle position that this dimension does not name — and it keeps the bucket count
 * bounded (prompt §18).
 */
function relationFor(
  state: HandState,
  seat: SeatIndex,
  live: ReadonlySet<SeatIndex>,
): PositionRelation {
  const own = state.positions[seat]?.postflopOrder ?? 0;
  for (const other of live) {
    if (other === seat) continue;
    const order = state.positions[other]?.postflopOrder ?? 0;
    if (order > own) return 'OOP';
  }
  return 'IP';
}

/** Internal. The bucket for the bet this seat is being asked to match. */
function facingSizeFor(
  record: ActionRecord,
  lastAggression: ActionRecord | null,
  config: PlayerModelConfig,
): BetSizeBucket {
  if (record.currentBetBefore <= 0 || lastAggression === null) return 'NONE';
  return postflopSizeBucket(lastAggression.amount, lastAggression.potBefore, config.postflopSizes);
}

/** Internal. Which preflop family this decision belongs to, plus who created it. */
function classifyPreflop(
  position: ObservedPosition,
  seat: SeatIndex,
  raisesBefore: number,
  limpersBefore: number,
  coldCallersBefore: number,
  openerSeat: SeatIndex | null,
  threeBettorSeat: SeatIndex | null,
  lastRaiserSeat: SeatIndex | null,
  positionOf: (seat: SeatIndex | null) => ObservedPosition | null,
): { family: PreflopSpot['family']; opponentPosition: ObservedPosition | null } {
  if (raisesBefore === 0) {
    // The big blind acts last in an unraised pot and is already in for a full blind: its
    // decision is the OPTION, not a first-in open and not a defence.
    if (position === 'BB') return { family: 'BB_OPTION', opponentPosition: null };
    if (limpersBefore === 0) return { family: 'RFI', opponentPosition: null };
    return { family: 'VS_LIMP', opponentPosition: null };
  }
  if (raisesBefore === 1) {
    const opener = positionOf(openerSeat);
    if (coldCallersBefore > 0) return { family: 'SQUEEZE', opponentPosition: opener };
    return { family: 'VS_OPEN', opponentPosition: opener };
  }
  if (raisesBefore === 2 && seat === openerSeat) {
    return { family: 'VS_THREE_BET', opponentPosition: positionOf(threeBettorSeat) };
  }
  if (raisesBefore === 3 && seat === threeBettorSeat) {
    return { family: 'VS_FOUR_BET', opponentPosition: positionOf(lastRaiserSeat) };
  }
  // Everything else — a cold 4-bet spot, a 5-bet war, a blind who called and then faced a
  // re-raise. Real, rare, and deliberately not given its own bucket: naming every one of
  // them would make the taxonomy unbounded for situations we have almost no samples of.
  return { family: 'VS_MULTI_RAISE', opponentPosition: positionOf(lastRaiserSeat) };
}

/** Internal. Which postflop family this decision belongs to. */
function classifyPostflop(
  seat: SeatIndex,
  record: ActionRecord,
  scratch: StreetScratch,
  initiativeSeat: SeatIndex | null,
): PostflopSpot['family'] {
  if (record.currentBetBefore > 0) {
    // "Already checked" is NOT a family of its own: see `PostflopSpotFamily`. The
    // check-raise question is answered by its own global stat, off `hasCheckedThisStreet`.
    if (scratch.aggressionCount === 1) {
      return scratch.aggressorSeat === initiativeSeat && initiativeSeat !== null
        ? 'FACING_CBET'
        : 'FACING_BET';
    }
    return 'FACING_RAISE';
  }
  if (seat === initiativeSeat) return 'CBET';
  return scratch.decisionCount === 0 ? 'DONK_LEAD' : 'CHECKED_TO';
}

/**
 * Total (throws only on a hand whose action log contains a non-action kind, which would
 * be a `poker-core` change, not user data).
 *
 * Walks `state.actions` once, in log order, maintaining the contender set, the preflop
 * raise ladder, and per-street aggression — the same quantities the engine used, tracked
 * here only to NAME the situation. Returns one `Decision` per real opportunity, in order.
 */
export function decisionsOf(state: HandState, config: PlayerModelConfig): readonly Decision[] {
  const live = new Set<SeatIndex>(state.dealtInSeats);
  const positionOf = (seat: SeatIndex | null): ObservedPosition | null => {
    if (seat === null) return null;
    const assigned = state.positions[seat];
    return assigned === null ? null : toObservedPosition(assigned.position);
  };

  let raises = 0;
  let limpers = 0;
  let coldCallers = 0;
  let openerSeat: SeatIndex | null = null;
  let threeBettorSeat: SeatIndex | null = null;
  let lastRaiserSeat: SeatIndex | null = null;
  let preflopRaisesTotal = 0;

  let street: Street = 'PREFLOP';
  let scratch = freshStreet();
  /** Who holds the initiative on this street: the previous street's last aggressor. */
  let initiativeSeat: SeatIndex | null = null;

  const out: Decision[] = [];

  state.actions.forEach((record, index) => {
    if (record.street !== street) {
      // A street boundary. Initiative passes to whoever was last aggressive on the street
      // that just ended; if that street was checked through, it STAYS where it was, which
      // is what makes a delayed continuation bet still a continuation bet.
      if (street === 'PREFLOP') preflopRaisesTotal = raises;
      if (scratch.aggressorSeat !== null) initiativeSeat = scratch.aggressorSeat;
      street = record.street;
      scratch = freshStreet();
    }

    const seat = record.seat;
    const assigned = state.positions[seat];
    const position = assigned === null ? null : toObservedPosition(assigned.position);
    const effect = actionEffect(record);
    const verb = actionVerb(record);
    const liveCountBefore = live.size;
    const lineup: LineupShape = liveCountBefore <= 2 ? 'HEADS_UP' : 'MULTIWAY';
    const potType =
      record.street === 'PREFLOP' ? potTypeForRaises(raises) : potTypeForRaises(preflopRaisesTotal);

    if (position !== null) {
      const spot: SpotDescriptor =
        record.street === 'PREFLOP'
          ? {
              phase: 'PREFLOP',
              ...classifyPreflop(
                position,
                seat,
                raises,
                limpers,
                coldCallers,
                openerSeat,
                threeBettorSeat,
                lastRaiserSeat,
                positionOf,
              ),
              position,
              lineup,
            }
          : {
              phase: 'POSTFLOP',
              street: toObservedStreet(record.street) ?? 'FLOP',
              family: classifyPostflop(seat, record, scratch, initiativeSeat),
              position,
              relation: relationFor(state, seat, live),
              lineup,
              potType,
              facingSize: facingSizeFor(record, scratch.lastAggression, config),
            };

      out.push({
        index,
        seat,
        playerId: state.seats[seat].playerId,
        position,
        street: record.street,
        verb,
        effect,
        spot,
        spotKey: spotKey(spot),
        record,
        liveCountBefore,
        lineup,
        raisesBefore: raises,
        limpersBefore: limpers,
        coldCallersBefore: coldCallers,
        streetAggressionBefore: scratch.aggressionCount,
        streetAggressorBefore: scratch.aggressorSeat,
        initiativeSeat,
        hasCheckedThisStreet: scratch.checked.has(seat),
        potType,
      });
    }

    // --- apply this decision to the walking state -------------------------------------
    if (effect === 'FOLD') live.delete(seat);
    // "Has checked this street" means the seat's LAST action here was a check. Once it
    // calls or raises, a later decision on the same street is facing a re-raise, not a
    // check-raise opportunity.
    if (effect === 'CHECK') scratch.checked.add(seat);
    else scratch.checked.delete(seat);
    if (isAggressive(effect)) {
      scratch.aggressionCount += 1;
      scratch.aggressorSeat = seat;
      scratch.lastAggression = record;
      if (record.street === 'PREFLOP') {
        raises += 1;
        lastRaiserSeat = seat;
        if (raises === 1) openerSeat = seat;
        if (raises === 2) threeBettorSeat = seat;
      }
    }
    if (effect === 'CALL' && record.street === 'PREFLOP') {
      if (raises === 0) limpers += 1;
      else coldCallers += 1;
    }
    scratch.decisionCount += 1;
  });

  return out;
}

/** Total. The hand's big blind, in milliBB. */
export const bigBlindOf = (state: HandState): MilliBB => state.config.blinds.bigBlind;
