/**
 * Opportunity extraction, against hand-built fixtures played through the real engine.
 *
 * Every denominator asserted here was worked out by hand from the action sequence written
 * directly above it, and the comment states WHY the count is what it is. A test that only
 * asserted "the code returns what the code returns" would prove nothing about the
 * statistic.
 *
 * Seating, six-handed with the button on seat 0:
 *   seat 0 = BTN   seat 1 = SB   seat 2 = BB   seat 3 = UTG   seat 4 = HJ   seat 5 = CO
 * Preflop order UTG(3) HJ(4) CO(5) BTN(0) SB(1) BB(2).
 * Postflop order SB(1) BB(2) UTG(3) HJ(4) CO(5) BTN(0).
 */
import { describe, expect, it } from 'vitest';
import { unwrap, type PlayerId } from '@gto-self/shared';
import type { ModelStatKey } from '@gto-self/player-core';
import { extractHandObservations, type PlayerHandObservations } from './extract.js';
import {
  award,
  BB,
  buildTable,
  fiveHanded,
  flop,
  fourHanded,
  holeCards,
  playHand,
  player,
  river,
  show,
  sixHanded,
  turn,
} from './testing.js';
import type { Hand, SeatIndex } from '@gto-self/poker-core';

const FOLD = { kind: 'FOLD' } as const;
const CHECK = { kind: 'CHECK' } as const;
const CALL = { kind: 'CALL' } as const;
const ALL_IN = { kind: 'ALL_IN' } as const;
const raiseTo = (bb: number) => ({ kind: 'RAISE', toAmount: BB(bb) }) as const;
const betTo = (bb: number) => ({ kind: 'BET', toAmount: BB(bb) }) as const;

/** Throws on an Err — a fixture that will not extract is a bug in the fixture. */
function observe(hand: Hand) {
  return unwrap(extractHandObservations(hand));
}

function seatOf(hand: Hand, seat: SeatIndex): PlayerHandObservations {
  const found = observe(hand).players.find((entry) => entry.seat === seat);
  if (found === undefined) throw new Error(`seat ${seat} produced no observations`);
  return found;
}

/** The stat keys this seat got an OPPORTUNITY for, in the order they were recorded. */
const keysOf = (player: PlayerHandObservations): readonly ModelStatKey[] =>
  player.stats.map((event) => event.key);

/** `true` / `false` when the opportunity exists, `undefined` when it does not. */
const takenOf = (player: PlayerHandObservations, key: ModelStatKey): boolean | undefined =>
  player.stats.find((event) => event.key === key)?.taken;

const spotKeysOf = (player: PlayerHandObservations): readonly string[] =>
  player.spots.map((spot) => spot.spotKey);

/* ========================================================================== */
/* Preflop: RFI, VPIP, PFR, and the defence spots                             */
/* ========================================================================== */

describe('preflop opportunities', () => {
  // UTG folds, HJ folds, CO folds, BTN opens to 2.5, SB folds, BB folds.
  // BTN wins uncontested. Every seat except BB is first-in when it acts.
  const handBtnSteal = (): Hand =>
    sixHanded('h-btn-steal', [FOLD, FOLD, FOLD, raiseTo(2.5), FOLD, FOLD]);

  it('gives an RFI opportunity to every seat that faced an unopened pot, and to nobody else', () => {
    const hand = handBtnSteal();
    // Unopened when they acted: UTG(3), HJ(4), CO(5), BTN(0)  -> 4 RFI opportunities.
    // Facing the BTN open: SB(1), BB(2)                       -> 0 RFI opportunities.
    for (const seat of [3, 4, 5, 0] as const) {
      expect(takenOf(seatOf(hand, seat), 'RFI')).toBeDefined();
    }
    for (const seat of [1, 2] as const) {
      expect(takenOf(seatOf(hand, seat), 'RFI')).toBeUndefined();
    }
  });

  it('counts the RFI action only for the seat that actually raised', () => {
    const hand = handBtnSteal();
    expect(takenOf(seatOf(hand, 3), 'RFI')).toBe(false);
    expect(takenOf(seatOf(hand, 4), 'RFI')).toBe(false);
    expect(takenOf(seatOf(hand, 5), 'RFI')).toBe(false);
    expect(takenOf(seatOf(hand, 0), 'RFI')).toBe(true);
  });

  it('names the BB-vs-BTN-open and SB-vs-BTN-open spots', () => {
    const hand = handBtnSteal();
    expect(spotKeysOf(seatOf(hand, 2))).toEqual(['BB_VS_BTN_OPEN']);
    expect(spotKeysOf(seatOf(hand, 1))).toEqual(['SB_VS_BTN_OPEN']);
    expect(spotKeysOf(seatOf(hand, 0))).toEqual(['BTN_RFI']);
  });

  it('counts VPIP and PFR once per player, off the preflop decision they actually faced', () => {
    const hand = handBtnSteal();
    // Six seats, six players who each faced at least one preflop decision:
    // VPIP denominator = 6, VPIP numerator = 1 (only the BTN put money in voluntarily).
    // PFR denominator  = 6, PFR numerator  = 1.
    const players = observe(hand).players;
    expect(players).toHaveLength(6);
    const vpip = players.filter((entry) => takenOf(entry, 'VPIP') === true);
    const pfr = players.filter((entry) => takenOf(entry, 'PFR') === true);
    expect(players.every((entry) => takenOf(entry, 'VPIP') !== undefined)).toBe(true);
    expect(vpip.map((entry) => entry.seat)).toEqual([0]);
    expect(pfr.map((entry) => entry.seat)).toEqual([0]);
  });

  it('does not count a blind posted under duress as VPIP', () => {
    // Folded to the SB, who folds. The BB wins without ever acting; its blind was posted,
    // not chosen, and it never faced a decision.
    const hand = sixHanded('h-walk', [FOLD, FOLD, FOLD, FOLD, FOLD]);
    expect(takenOf(seatOf(hand, 2), 'VPIP')).toBeUndefined();
  });

  it('counts a steal attempt only from CO, BTN and SB', () => {
    const hand = handBtnSteal();
    expect(takenOf(seatOf(hand, 0), 'STEAL_ATTEMPT')).toBe(true); // BTN raised
    expect(takenOf(seatOf(hand, 5), 'STEAL_ATTEMPT')).toBe(false); // CO folded
    expect(takenOf(seatOf(hand, 3), 'STEAL_ATTEMPT')).toBeUndefined(); // UTG: not a steal seat
    // Fold-to-steal is the blinds' side of the same open.
    expect(takenOf(seatOf(hand, 1), 'FOLD_TO_STEAL')).toBe(true);
    expect(takenOf(seatOf(hand, 2), 'FOLD_TO_STEAL')).toBe(true);
  });

  it('records a limp as the RFI opportunity it was, with the action not taken', () => {
    // UTG limps, HJ folds, CO folds, BTN folds, SB folds, BB checks its option.
    // Off-policy (REFERENCE never limps) and preserved exactly as entered: the RFI
    // opportunity is real, the raise did not happen, and VPIP did (prompt §31).
    const hand = sixHanded('h-limp', [
      CALL,
      FOLD,
      FOLD,
      FOLD,
      FOLD,
      CHECK,
      flop(),
      CHECK,
      CHECK,
      turn(),
      CHECK,
      CHECK,
      river(),
      CHECK,
      CHECK,
      award(3),
    ]);
    const utg = seatOf(hand, 3);
    expect(takenOf(utg, 'RFI')).toBe(false);
    expect(takenOf(utg, 'VPIP')).toBe(true);
    expect(takenOf(utg, 'PFR')).toBe(false);
    expect(utg.spots[0]?.spotKey).toBe('UTG_RFI');
    expect(utg.spots[0]?.effect).toBe('CALL');
    // The BB's free option is its own spot, and checking it is not VPIP.
    const bb = seatOf(hand, 2);
    expect(bb.spots[0]?.spotKey).toBe('BB_OPTION');
    expect(takenOf(bb, 'VPIP')).toBe(false);
    // A seat acting after a limp with no raise yet is in a VS_LIMP spot, not an RFI one.
    expect(spotKeysOf(seatOf(hand, 4))[0]).toBe('HJ_VS_LIMP');
    expect(takenOf(seatOf(hand, 4), 'RFI')).toBeUndefined();
  });
});

describe('3-bet, fold-to-3-bet and 4-bet', () => {
  // UTG folds, HJ folds, CO opens to 2.5, BTN folds, SB folds, BB 3-bets to 9, CO folds.
  const hand3Bet = (): Hand =>
    sixHanded('h-3bet', [FOLD, FOLD, raiseTo(2.5), FOLD, FOLD, raiseTo(9), FOLD]);

  it('gives a 3-bet opportunity to every seat that faced exactly one raise', () => {
    const hand = hand3Bet();
    // Facing the CO open when they acted: BTN(0), SB(1), BB(2) -> 3 opportunities.
    // Not facing a raise: UTG(3), HJ(4), CO(5)                 -> 0 opportunities.
    expect(takenOf(seatOf(hand, 0), 'THREE_BET')).toBe(false);
    expect(takenOf(seatOf(hand, 1), 'THREE_BET')).toBe(false);
    expect(takenOf(seatOf(hand, 2), 'THREE_BET')).toBe(true);
    expect(takenOf(seatOf(hand, 3), 'THREE_BET')).toBeUndefined();
    expect(takenOf(seatOf(hand, 4), 'THREE_BET')).toBeUndefined();
    expect(takenOf(seatOf(hand, 5), 'THREE_BET')).toBeUndefined();
  });

  it('gives fold-to-3-bet only to the opener who actually faced the re-raise', () => {
    const hand = hand3Bet();
    expect(takenOf(seatOf(hand, 5), 'FOLD_TO_THREE_BET')).toBe(true);
    expect(takenOf(seatOf(hand, 5), 'FOUR_BET')).toBe(false);
    expect(spotKeysOf(seatOf(hand, 5))).toEqual(['CO_RFI', 'CO_OPEN_FACING_BB_3BET']);
    // Everyone who folded before the 3-bet arrived never faced it (prompt §30).
    for (const seat of [0, 1, 3, 4] as const) {
      expect(takenOf(seatOf(hand, seat), 'FOLD_TO_THREE_BET')).toBeUndefined();
    }
  });

  it('counts a 4-bet on the same opportunity as fold-to-3-bet', () => {
    // CO opens 2.5, BB 3-bets to 9, CO 4-bets to 21, BB folds.
    const hand = sixHanded('h-4bet', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      raiseTo(9),
      raiseTo(21),
      FOLD,
    ]);
    const co = seatOf(hand, 5);
    expect(takenOf(co, 'FOUR_BET')).toBe(true);
    expect(takenOf(co, 'FOLD_TO_THREE_BET')).toBe(false);
    const bb = seatOf(hand, 2);
    expect(spotKeysOf(bb)).toEqual(['BB_VS_CO_OPEN', 'BB_3BET_FACING_CO_4BET']);
  });

  it('names a squeeze spot when a caller is already in', () => {
    // CO opens 2.5, BTN cold-calls, SB folds, BB raises to 12, CO folds, BTN folds.
    const hand = sixHanded('h-squeeze', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      CALL,
      FOLD,
      raiseTo(12),
      FOLD,
      FOLD,
    ]);
    expect(spotKeysOf(seatOf(hand, 2))).toEqual(['BB_SQUEEZE_VS_CO']);
    // The cold-caller now faces two raises and is neither the opener nor the 3-bettor.
    expect(spotKeysOf(seatOf(hand, 0))).toEqual(['BTN_VS_CO_OPEN', 'BTN_VS_MULTI_RAISE']);
    // A squeeze IS a 3-bet: the denominator is "faced exactly one raise".
    expect(takenOf(seatOf(hand, 2), 'THREE_BET')).toBe(true);
  });
});

/* ========================================================================== */
/* Postflop                                                                   */
/* ========================================================================== */

describe('postflop opportunities', () => {
  /**
   * CO opens 2.5, BB calls. Pot 5.5 BB.
   * Flop: BB checks, CO bets 3, BB calls.       pot 11.5 BB
   * Turn: BB checks, CO bets 8, BB calls.       pot 27.5 BB
   * River: BB checks, CO bets 20, BB calls.     pot 67.5 BB
   * Showdown, CO wins.
   */
  const triple = (): Hand =>
    sixHanded('h-triple', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(3),
      CALL,
      turn(),
      CHECK,
      betTo(8),
      CALL,
      river(),
      CHECK,
      betTo(20),
      CALL,
      award(5),
    ]);

  it('gives the preflop raiser a c-bet opportunity on each street it reached with the lead', () => {
    const co = seatOf(triple(), 5);
    expect(takenOf(co, 'CBET_FLOP')).toBe(true);
    expect(takenOf(co, 'CBET_TURN')).toBe(true);
    expect(takenOf(co, 'CBET_RIVER')).toBe(true);
    expect(spotKeysOf(co)).toEqual([
      'CO_RFI',
      'FLOP_CBET_CO_IP_HEADS_UP_SINGLE_RAISED',
      'TURN_CBET_CO_IP_HEADS_UP_SINGLE_RAISED',
      'RIVER_CBET_CO_IP_HEADS_UP_SINGLE_RAISED',
    ]);
  });

  it('counts a turn barrel only after a flop c-bet, and a river barrel only after a turn one', () => {
    const co = seatOf(triple(), 5);
    expect(takenOf(co, 'TURN_BARREL')).toBe(true);
    expect(takenOf(co, 'RIVER_BARREL')).toBe(true);
  });

  it('gives no barrel opportunity when the previous street was not c-bet', () => {
    // CO opens, BB calls; flop checks through; CO bets the turn. There was no flop c-bet,
    // so the turn bet is a delayed c-bet and NOT a barrel: no TURN_BARREL denominator.
    const hand = sixHanded('h-delayed', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      CHECK,
      turn(),
      CHECK,
      betTo(4),
      FOLD,
    ]);
    const co = seatOf(hand, 5);
    expect(takenOf(co, 'CBET_FLOP')).toBe(false);
    expect(takenOf(co, 'CBET_TURN')).toBe(true);
    expect(takenOf(co, 'TURN_BARREL')).toBeUndefined();
  });

  it('gives no barrel opportunity when the next street never arrived', () => {
    // CO c-bets the flop and BB folds. Betting the flop and winning is not a missed
    // barrel; there was no turn decision at all.
    const hand = sixHanded('h-cbet-wins', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(3),
      FOLD,
    ]);
    const co = seatOf(hand, 5);
    expect(takenOf(co, 'CBET_FLOP')).toBe(true);
    expect(takenOf(co, 'CBET_TURN')).toBeUndefined();
    expect(takenOf(co, 'TURN_BARREL')).toBeUndefined();
  });

  it('counts fold-to-c-bet on the street the player faced the c-bet, and never elsewhere', () => {
    const hand = sixHanded('h-fold-turn', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(3),
      CALL,
      turn(),
      CHECK,
      betTo(8),
      FOLD,
    ]);
    const bb = seatOf(hand, 2);
    expect(takenOf(bb, 'FOLD_TO_CBET_FLOP')).toBe(false); // called it
    expect(takenOf(bb, 'FOLD_TO_CBET_TURN')).toBe(true); // folded to it
    expect(takenOf(bb, 'FOLD_TO_CBET_RIVER')).toBeUndefined(); // never saw a river
    // The c-bettor is not given a fold-to-c-bet opportunity against its own bet.
    expect(takenOf(seatOf(hand, 5), 'FOLD_TO_CBET_FLOP')).toBeUndefined();
  });

  it('counts a check-raise opportunity only for a player who checked and then faced a bet', () => {
    // Flop: BB checks, CO bets 3, BB raises to 10, CO folds.
    const hand = sixHanded('h-xr', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(3),
      raiseTo(10),
      FOLD,
    ]);
    const bb = seatOf(hand, 2);
    expect(takenOf(bb, 'CHECK_RAISE_FLOP')).toBe(true);
    // It is the SAME decision as the fold-to-c-bet one; both questions are asked of it.
    expect(takenOf(bb, 'FOLD_TO_CBET_FLOP')).toBe(false);
    // The c-bettor never checked, so it has no check-raise opportunity.
    expect(takenOf(seatOf(hand, 5), 'CHECK_RAISE_FLOP')).toBeUndefined();
  });

  it('does not give a check-raise opportunity to a player who checked and was checked back', () => {
    const hand = sixHanded('h-checked-through', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      CHECK,
      turn(),
      CHECK,
      CHECK,
      river(),
      CHECK,
      CHECK,
      award(5),
    ]);
    expect(takenOf(seatOf(hand, 2), 'CHECK_RAISE_FLOP')).toBeUndefined();
  });

  it('gives no c-bet opportunity in a limped pot, because nobody holds the initiative', () => {
    // UTG limps, everyone folds to the BB, BB checks. Flop is played with no preflop
    // aggressor: a bet by either player is a lead, not a continuation of anything.
    const hand = sixHanded('h-limped-flop', [
      CALL,
      FOLD,
      FOLD,
      FOLD,
      FOLD,
      CHECK,
      flop(),
      CHECK,
      betTo(2),
      FOLD,
    ]);
    expect(takenOf(seatOf(hand, 3), 'CBET_FLOP')).toBeUndefined();
    expect(takenOf(seatOf(hand, 2), 'CBET_FLOP')).toBeUndefined();
    expect(takenOf(seatOf(hand, 2), 'FOLD_TO_CBET_FLOP')).toBeUndefined();
    expect(spotKeysOf(seatOf(hand, 2))[1]).toBe('FLOP_DONK_LEAD_BB_OOP_HEADS_UP_LIMPED');
  });

  it('marks multiway and heads-up lineups from the live count at the decision', () => {
    // CO opens to 2.5, BTN calls, SB folds, BB calls -> three-way flop, pot 8 BB.
    // Flop order is BB(2) -> CO(5) -> BTN(0): BB checks, CO c-bets 4 (50% of pot),
    // BTN calls, BB folds.
    const hand = sixHanded('h-multiway', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      CALL,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(4),
      CALL,
      FOLD,
      turn(),
      CHECK,
      CHECK,
      river(),
      CHECK,
      CHECK,
      award(5),
    ]);
    expect(spotKeysOf(seatOf(hand, 2))[1]).toBe('FLOP_DONK_LEAD_BB_OOP_MULTIWAY_SINGLE_RAISED');
    // The CO is OOP even though it opened: the BTN acts after it.
    expect(spotKeysOf(seatOf(hand, 5))[1]).toBe('FLOP_CBET_CO_OOP_MULTIWAY_SINGLE_RAISED');
    expect(spotKeysOf(seatOf(hand, 0))[1]).toBe(
      'FLOP_FACING_CBET_BTN_IP_MULTIWAY_SINGLE_RAISED_SMALL',
    );
    // The turn is heads-up: the BB folded.
    expect(spotKeysOf(seatOf(hand, 5))[2]).toBe('TURN_CBET_CO_OOP_HEADS_UP_SINGLE_RAISED');
  });

  it('classifies a bet by a player without initiative who was checked to', () => {
    // CO opens, BTN calls, BB calls; flop checks to the BTN, which bets.
    const hand = sixHanded('h-checked-to', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      CALL,
      FOLD,
      CALL,
      flop(),
      CHECK,
      CHECK,
      betTo(4),
      FOLD,
      FOLD,
    ]);
    expect(spotKeysOf(seatOf(hand, 0))[1]).toBe('FLOP_CHECKED_TO_BTN_IP_MULTIWAY_SINGLE_RAISED');
    // The CO checked its c-bet opportunity away rather than never having one.
    expect(takenOf(seatOf(hand, 5), 'CBET_FLOP')).toBe(false);
  });
});

/* ========================================================================== */
/* Showdown statistics                                                        */
/* ========================================================================== */

describe('WTSD and WSD', () => {
  const showdown = (): Hand =>
    sixHanded('h-showdown', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      CHECK,
      turn(),
      CHECK,
      CHECK,
      river(),
      CHECK,
      CHECK,
      award(5),
    ]);

  it('counts WTSD against the players who saw the flop, not against every dealt-in seat', () => {
    const hand = showdown();
    // Saw the flop: CO(5) and BB(2). The four seats that folded preflop did not.
    for (const seat of [5, 2] as const) {
      expect(takenOf(seatOf(hand, seat), 'WTSD')).toBe(true);
    }
    for (const seat of [0, 1, 3, 4] as const) {
      expect(takenOf(seatOf(hand, seat), 'WTSD')).toBeUndefined();
    }
  });

  it('counts WSD only among the players who actually reached the showdown', () => {
    const hand = showdown();
    expect(takenOf(seatOf(hand, 5), 'WSD')).toBe(true); // CO was awarded the pot
    expect(takenOf(seatOf(hand, 2), 'WSD')).toBe(false); // BB reached it and won nothing
    expect(takenOf(seatOf(hand, 0), 'WSD')).toBeUndefined();
  });

  it('gives a WTSD opportunity but no WSD one when the hand ends without a showdown', () => {
    // CO c-bets the flop, BB folds: both saw the flop, neither reached a showdown.
    const hand = sixHanded('h-no-sd', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(3),
      FOLD,
    ]);
    expect(takenOf(seatOf(hand, 5), 'WTSD')).toBe(false);
    expect(takenOf(seatOf(hand, 2), 'WTSD')).toBe(false);
    expect(takenOf(seatOf(hand, 5), 'WSD')).toBeUndefined();
  });

  it('splits a pot without either player being recorded as having lost it', () => {
    const hand = sixHanded('h-split', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      CHECK,
      turn(),
      CHECK,
      CHECK,
      river(),
      CHECK,
      CHECK,
      award(5, 2),
    ]);
    expect(takenOf(seatOf(hand, 5), 'WSD')).toBe(true);
    expect(takenOf(seatOf(hand, 2), 'WSD')).toBe(true);
    expect(seatOf(hand, 5).wonGross).toBe(seatOf(hand, 2).wonGross);
  });
});

/* ========================================================================== */
/* Counterexamples A - F (prompt §37)                                          */
/* ========================================================================== */

describe('counterexamples', () => {
  it('A. a player who folded gets no opportunity on any later street', () => {
    // UTG folds preflop. The hand runs to the river between CO and BB.
    const hand = sixHanded('h-ce-a', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      betTo(3),
      CALL,
      turn(),
      CHECK,
      betTo(8),
      CALL,
      river(),
      CHECK,
      betTo(20),
      CALL,
      award(5),
    ]);
    const utg = seatOf(hand, 3);
    expect(utg.decisionCount).toBe(1);
    // Exactly three: the preflop decision it faced, asked as VPIP, PFR and RFI.
    expect(keysOf(utg)).toEqual(['VPIP', 'PFR', 'RFI']);
    expect(takenOf(utg, 'CBET_FLOP')).toBeUndefined();
    expect(takenOf(utg, 'FOLD_TO_CBET_FLOP')).toBeUndefined();
    expect(takenOf(utg, 'WTSD')).toBeUndefined();
  });

  it('B. a sitting-out player gets nothing, and the lineup is the real one', () => {
    // Five-handed: seat 5 is not dealt in. Seat 3 is HJ and seat 4 is CO.
    const hand = fiveHanded('h-ce-b', [FOLD, FOLD, raiseTo(2.5), FOLD, FOLD]);
    const observed = observe(hand);
    expect(observed.dealtInSeats).toEqual([0, 1, 2, 3, 4]);
    expect(observed.players.map((entry) => entry.seat)).toEqual([0, 1, 2, 3, 4]);
    expect(observed.players.some((entry) => entry.playerId === player(5))).toBe(false);
    // Never fabricate a six-handed lineup for a five-handed hand (prompt §32).
    expect(observed.players.map((entry) => entry.position)).toEqual([
      'BTN',
      'SB',
      'BB',
      'HJ',
      'CO',
    ]);
  });

  it('C. an all-in player gets no later betting opportunity', () => {
    // The BB has 10 BB. CO opens to 2.5, BB shoves, CO calls. The board runs out with
    // nobody able to act, and the BB never faces a postflop decision.
    const table = buildTable({ seats: [0, 1, 2, 3, 4, 5], stacks: { 2: BB(10) } });
    const hand = playHand(table, 'h-ce-c', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      ALL_IN,
      CALL,
      flop(),
      turn(),
      river(),
      award(5),
    ]);
    const bb = seatOf(hand, 2);
    expect(bb.decisionCount).toBe(1);
    expect(bb.spots.map((spot) => spot.verb)).toEqual(['ALL_IN']);
    // The shove functioned as a raise over the open, so it IS a 3-bet.
    expect(takenOf(bb, 'THREE_BET')).toBe(true);
    expect(takenOf(bb, 'CBET_FLOP')).toBeUndefined();
    expect(takenOf(bb, 'FOLD_TO_CBET_FLOP')).toBeUndefined();
    expect(takenOf(bb, 'CHECK_RAISE_FLOP')).toBeUndefined();
    // It still reached a showdown: WTSD and WSD are about the hand, not about acting.
    expect(takenOf(bb, 'WTSD')).toBe(true);
    // The caller has no c-bet opportunity either: no opponent could respond.
    expect(takenOf(seatOf(hand, 5), 'CBET_FLOP')).toBeUndefined();
  });

  it('D. a player action never reached gets no opportunity at all', () => {
    // Folded round to the SB, who folds. The BB wins the pot and never acts.
    const hand = sixHanded('h-ce-d', [FOLD, FOLD, FOLD, FOLD, FOLD]);
    const bb = seatOf(hand, 2);
    expect(bb.decisionCount).toBe(0);
    expect(bb.stats).toEqual([]);
    expect(bb.spots).toEqual([]);
    expect(bb.wonGross).toBeGreaterThan(0);
  });

  it('E. a SHOW contributes card evidence', () => {
    const hand = sixHanded('h-ce-e', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop('Ah 7d 2c'),
      CHECK,
      CHECK,
      turn('Ks'),
      CHECK,
      CHECK,
      river('3h'),
      CHECK,
      CHECK,
      show(5, 'Ac Kd'),
      award(5),
    ]);
    const co = seatOf(hand, 5);
    expect(co.show).not.toBeNull();
    expect(co.show?.cards).toHaveLength(2);
    expect(co.show?.outcome).toBe('WON');
    expect(co.show?.board).toHaveLength(5);
    expect(co.show?.lastStreet).toBe('RIVER');
    expect(co.show?.spotKeys[0]).toBe('CO_RFI');
    expect(co.show?.playerId).toBe(player(5) as PlayerId);
  });

  it('F. a MUCK contributes no card evidence, and neither does a private hero entry', () => {
    const hand = sixHanded('h-ce-f', [
      holeCards(2, 'Qs Qh'), // the hero's OWN cards: revealed: false
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      CALL,
      flop(),
      CHECK,
      CHECK,
      turn(),
      CHECK,
      CHECK,
      river(),
      CHECK,
      CHECK,
      show(5, 'Ac Kd'),
      award(5),
    ]);
    // Seat 2 mucked. A muck emits no event at all (ADR-0052), so there is nothing to
    // read, and the private entry it made for itself is not evidence about an opponent.
    expect(seatOf(hand, 2).show).toBeNull();
    expect(seatOf(hand, 5).show).not.toBeNull();
    // The seats that folded preflop showed nothing either.
    expect(seatOf(hand, 3).show).toBeNull();
  });
});

/* ========================================================================== */
/* Lineup changes, uncalled returns, bet sizes                                */
/* ========================================================================== */

describe('lineup, returns and sizing', () => {
  it('analyses a 6 -> 5 -> 4 session without fabricating an opportunity', () => {
    const six = sixHanded('h-six', [FOLD, FOLD, FOLD, raiseTo(2.5), FOLD, FOLD]);
    const five = fiveHanded('h-five', [FOLD, raiseTo(2.5), FOLD, FOLD, FOLD]);
    const four = fourHanded('h-four', [raiseTo(2.5), FOLD, FOLD, FOLD]);

    expect(observe(six).dealtInSeats).toHaveLength(6);
    expect(observe(five).dealtInSeats).toHaveLength(5);
    expect(observe(four).dealtInSeats).toHaveLength(4);

    // Seat 5 played only the six-handed hand, so it has exactly one hand's worth of facts.
    expect(observe(six).players.some((entry) => entry.seat === 5)).toBe(true);
    expect(observe(five).players.some((entry) => entry.seat === 5)).toBe(false);
    expect(observe(four).players.some((entry) => entry.seat === 4)).toBe(false);

    // Four-handed: seat 0 = BTN, 1 = SB, 2 = BB, 3 = CO. The first to act preflop is CO.
    expect(observe(four).players.map((entry) => entry.position)).toEqual(['BTN', 'SB', 'BB', 'CO']);
  });

  it('handles an uncalled bet being returned', () => {
    // CO opens and everyone folds: 2 BB of the CO's 2.5 BB open is uncalled and returned.
    const hand = sixHanded('h-uncalled', [FOLD, FOLD, raiseTo(2.5), FOLD, FOLD, FOLD]);
    const observed = observe(hand);
    expect(observed.endedInShowdown).toBe(false);
    const co = seatOf(hand, 5);
    // The return does not change what the CO was observed to DO.
    expect(takenOf(co, 'RFI')).toBe(true);
    expect(co.betSizes).toHaveLength(1);
    expect(co.betSizes[0]?.toAmount).toBe(BB(2.5));
  });

  it('keeps the raw milliBB of every aggressive action and buckets it separately', () => {
    const hand = sixHanded('h-sizes', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      raiseTo(9),
      CALL,
      flop(),
      CHECK,
      betTo(6),
      FOLD,
    ]);
    const co = seatOf(hand, 5);
    expect(co.betSizes.map((size) => [size.kind, size.toAmount, size.bucket])).toEqual([
      ['PREFLOP_OPEN', BB(2.5), 'SMALL'], // 2.5 BB open
      // 6 BB into an 18.5 BB pot is 32.4% of pot, just inside the 33% TINY boundary.
      ['POSTFLOP_BET', BB(6), 'TINY'],
    ]);
    const bb = seatOf(hand, 2);
    expect(bb.betSizes.map((size) => [size.kind, size.toAmount, size.bucket])).toEqual([
      ['PREFLOP_THREE_BET', BB(9), 'HUGE'], // 9 BB to
    ]);
    // The bucket is a heuristic label; the amounts are the truth and are exact.
    expect(bb.betSizes[0]?.amount).toBe(BB(8)); // 9 BB to, 1 BB already posted
    expect(bb.betSizes[0]?.bigBlind).toBe(BB(1));
  });

  it('reads a short all-in as the call it functioned as, keeping the verb intact', () => {
    // The BB has 2 BB behind. The CO opens to 2.5 and the BB shoves for 2 — less than the
    // price to call, so it is a CALL in effect and an ALL_IN as a verb. 0.5 BB of the CO's
    // open is uncalled and comes back.
    const table = buildTable({ seats: [0, 1, 2, 3, 4, 5], stacks: { 2: BB(2) } });
    const hand = playHand(table, 'h-short-allin', [
      FOLD,
      FOLD,
      raiseTo(2.5),
      FOLD,
      FOLD,
      ALL_IN,
      flop(),
      turn(),
      river(),
      award(5),
    ]);
    const bb = seatOf(hand, 2);
    expect(bb.spots[0]?.verb).toBe('ALL_IN');
    expect(bb.spots[0]?.effect).toBe('CALL');
    expect(takenOf(bb, 'VPIP')).toBe(true);
    expect(takenOf(bb, 'PFR')).toBe(false);
    expect(takenOf(bb, 'THREE_BET')).toBe(false); // an opportunity it did not take
    expect(bb.betSizes).toEqual([]); // a call is not an aggressive sizing observation
  });

  it('rejects a hand that has not finished', () => {
    const unfinished = sixHanded('h-open', [FOLD, FOLD, raiseTo(2.5)]);
    const result = extractHandObservations(unfinished);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('HAND_NOT_COMPLETE');
  });
});
