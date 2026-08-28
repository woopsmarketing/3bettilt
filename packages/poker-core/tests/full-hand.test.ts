/**
 * A full 6-handed NL50 hand played to the river, asserting the pot, every stack and
 * every contribution after EVERY action.
 *
 * All expected numbers are hand-computed in milliBB from the NL50 preset
 * (SB 500 / BB 1000 / minBet 1000 / no ante / rake 5% floored, cap 8000, no-flop-no-drop)
 * and from the raise-TO semantics in docs/POKER_CORE_API.md §7.3.
 *
 * Seating: button seat 0, six 100 BB (100000) stacks.
 *   seat 0 BTN, seat 1 SB, seat 2 BB, seat 3 UTG, seat 4 HJ, seat 5 CO
 *   preflop order  3 4 5 0 1 2
 *   postflop order 1 2 3 4 5 0
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { betTo, call, check, dealBoard, fold, raiseTo } from '../src/commands.js';
import { minWagerToAmount } from '../src/betting.js';
import { potTotal } from '../src/pots.js';
import { handResult } from '../src/settlement.js';
import { cards, ids, sixHanded, start } from '../src/testing.js';
import { awardAllTo, seatMoney, stacks, step } from './_helpers.js';

const S0 = 0;
const S1 = 1;
const S2 = 2;
const S3 = 3;
const S4 = 4;
const S5 = 5;

describe('a full 6-handed hand to the river', () => {
  it('tracks pot, stacks and contributions exactly after every single action', () => {
    const f = ids();
    let hand = start(sixHanded(), f);

    // --- after the blinds -------------------------------------------------
    // SB 500, BB 1000. Nothing else is in.
    expect(hand.state.potTotal).toBe(1500);
    expect(seatMoney(hand.state, S0)).toEqual({ stack: 100000, street: 0, total: 0 });
    expect(seatMoney(hand.state, S1)).toEqual({ stack: 99500, street: 500, total: 500 });
    expect(seatMoney(hand.state, S2)).toEqual({ stack: 99000, street: 1000, total: 1000 });
    expect(seatMoney(hand.state, S3)).toEqual({ stack: 100000, street: 0, total: 0 });
    expect(hand.state.actorSeat).toBe(S3); // UTG opens the action
    expect(hand.state.round.currentBet).toBe(1000);
    expect(hand.state.round.fullRaiseCount).toBe(1); // the BB is the bring-in
    // Preflop minimum raise-TO is BB + BB.
    expect(minWagerToAmount(hand.state, S3)).toBe(2000);

    // --- 1. UTG folds -----------------------------------------------------
    hand = step(hand, fold(), f);
    expect(hand.state.potTotal).toBe(1500);
    expect(seatMoney(hand.state, S3)).toEqual({ stack: 100000, street: 0, total: 0 });
    expect(hand.state.actorSeat).toBe(S4);

    // --- 2. HJ raises to 3000 (a full raise: +2000 >= 1000) ---------------
    hand = step(hand, raiseTo(Money.mbb(3000)), f);
    expect(hand.state.potTotal).toBe(4500); // 500 + 1000 + 3000
    expect(seatMoney(hand.state, S4)).toEqual({ stack: 97000, street: 3000, total: 3000 });
    expect(hand.state.round.currentBet).toBe(3000);
    expect(hand.state.round.lastFullRaiseSize).toBe(2000); // 3000 - 1000
    expect(hand.state.round.fullRaiseCount).toBe(2);
    expect(hand.state.actorSeat).toBe(S5);
    expect(minWagerToAmount(hand.state, S5)).toBe(5000); // 3000 + 2000

    // --- 3. CO folds ------------------------------------------------------
    hand = step(hand, fold(), f);
    expect(hand.state.potTotal).toBe(4500);
    expect(hand.state.actorSeat).toBe(S0);

    // --- 4. BTN calls 3000 ------------------------------------------------
    hand = step(hand, call(), f);
    expect(hand.state.potTotal).toBe(7500);
    expect(seatMoney(hand.state, S0)).toEqual({ stack: 97000, street: 3000, total: 3000 });
    expect(hand.state.actorSeat).toBe(S1);

    // --- 5. SB folds (its 500 stays in the pot) ---------------------------
    hand = step(hand, fold(), f);
    expect(hand.state.potTotal).toBe(7500);
    expect(seatMoney(hand.state, S1)).toEqual({ stack: 99500, street: 500, total: 500 });
    expect(hand.state.actorSeat).toBe(S2);

    // --- 6. BB completes for 2000 more ------------------------------------
    hand = step(hand, call(), f);
    expect(hand.state.potTotal).toBe(9500); // 500 + 3000 + 3000 + 3000
    expect(seatMoney(hand.state, S2)).toEqual({ stack: 97000, street: 3000, total: 3000 });
    // Three seats share the top street contribution, so nothing is uncalled.
    expect(hand.state.pendingUncalled).toBeNull();
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('FLOP');
    expect(hand.state.actorSeat).toBeNull();

    // --- 7. flop ----------------------------------------------------------
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    expect(hand.state.street).toBe('FLOP');
    expect(hand.state.potTotal).toBe(9500);
    expect(hand.state.round.currentBet).toBe(0);
    expect(hand.state.round.fullRaiseCount).toBe(0);
    // Street contributions are rolled away; totals survive.
    expect(seatMoney(hand.state, S2)).toEqual({ stack: 97000, street: 0, total: 3000 });
    expect(hand.state.seats[S2].contributionByStreet.PREFLOP).toBe(3000);
    // SB folded, so the BB is first to act postflop.
    expect(hand.state.actorSeat).toBe(S2);
    expect(minWagerToAmount(hand.state, S2)).toBe(1000); // config.minBet

    // --- 8. BB checks -----------------------------------------------------
    hand = step(hand, check(), f);
    expect(hand.state.potTotal).toBe(9500);
    expect(hand.state.actorSeat).toBe(S4);

    // --- 9. HJ bets 5000 --------------------------------------------------
    hand = step(hand, betTo(Money.mbb(5000)), f);
    expect(hand.state.potTotal).toBe(14500);
    expect(seatMoney(hand.state, S4)).toEqual({ stack: 92000, street: 5000, total: 8000 });
    expect(hand.state.round.currentBet).toBe(5000);
    expect(hand.state.round.lastFullRaiseSize).toBe(5000);
    expect(hand.state.round.fullRaiseCount).toBe(1);
    expect(hand.state.actorSeat).toBe(S0);
    expect(minWagerToAmount(hand.state, S0)).toBe(10000); // 5000 + 5000

    // --- 10. BTN calls 5000 ----------------------------------------------
    hand = step(hand, call(), f);
    expect(hand.state.potTotal).toBe(19500);
    expect(seatMoney(hand.state, S0)).toEqual({ stack: 92000, street: 5000, total: 8000 });
    expect(hand.state.actorSeat).toBe(S2); // the BB's check-raise seat

    // --- 11. BB check-raises to 15000 ------------------------------------
    hand = step(hand, raiseTo(Money.mbb(15000)), f);
    expect(hand.state.potTotal).toBe(34500);
    expect(seatMoney(hand.state, S2)).toEqual({ stack: 82000, street: 15000, total: 18000 });
    expect(hand.state.round.currentBet).toBe(15000);
    expect(hand.state.round.lastFullRaiseSize).toBe(10000); // 15000 - 5000
    expect(hand.state.round.fullRaiseCount).toBe(2);
    expect(hand.state.actorSeat).toBe(S4);

    // --- 12. HJ folds -----------------------------------------------------
    hand = step(hand, fold(), f);
    expect(hand.state.potTotal).toBe(34500);
    expect(seatMoney(hand.state, S4)).toEqual({ stack: 92000, street: 5000, total: 8000 });
    expect(hand.state.actorSeat).toBe(S0);

    // --- 13. BTN calls 10000 more ----------------------------------------
    hand = step(hand, call(), f);
    expect(hand.state.potTotal).toBe(44500);
    expect(seatMoney(hand.state, S0)).toEqual({ stack: 82000, street: 15000, total: 18000 });
    expect(hand.state.pendingUncalled).toBeNull();
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('TURN');

    // --- 14. turn ---------------------------------------------------------
    hand = step(hand, dealBoard(cards('2d')), f);
    expect(hand.state.street).toBe('TURN');
    expect(hand.state.board).toHaveLength(4);
    expect(hand.state.potTotal).toBe(44500);
    expect(hand.state.actorSeat).toBe(S2);

    // --- 15/16. checked through -------------------------------------------
    hand = step(hand, check(), f);
    expect(hand.state.actorSeat).toBe(S0);
    hand = step(hand, check(), f);
    expect(hand.state.potTotal).toBe(44500);
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('RIVER');

    // --- 17. river --------------------------------------------------------
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.street).toBe('RIVER');
    expect(hand.state.board).toHaveLength(5);
    expect(hand.state.actorSeat).toBe(S2);

    // --- 18. BB leads 20000 ----------------------------------------------
    hand = step(hand, betTo(Money.mbb(20000)), f);
    expect(hand.state.potTotal).toBe(64500);
    expect(seatMoney(hand.state, S2)).toEqual({ stack: 62000, street: 20000, total: 38000 });
    expect(minWagerToAmount(hand.state, S0)).toBe(40000); // 20000 + 20000

    // --- 19. BTN raises to 60000 -----------------------------------------
    hand = step(hand, raiseTo(Money.mbb(60000)), f);
    expect(hand.state.potTotal).toBe(124500);
    expect(seatMoney(hand.state, S0)).toEqual({ stack: 22000, street: 60000, total: 78000 });
    expect(hand.state.round.lastFullRaiseSize).toBe(40000);
    expect(hand.state.actorSeat).toBe(S2);

    // --- 20. BB calls 40000 more -----------------------------------------
    hand = step(hand, call(), f);
    expect(hand.state.potTotal).toBe(164500);
    expect(seatMoney(hand.state, S2)).toEqual({ stack: 22000, street: 60000, total: 78000 });
    expect(hand.state.pendingUncalled).toBeNull();
    expect(hand.state.phase).toBe('AWAITING_AWARD');

    // Every layer of the pot is contested by exactly the two remaining players.
    expect(potTotal(hand.state.pots)).toBe(164500);
    for (const pot of hand.state.pots) expect(pot.eligibleSeats).toEqual([S0, S2]);
    expect(
      Money.sum(hand.state.dealtInSeats.map((s) => hand.state.seats[s].totalContribution)),
    ).toBe(164500);

    // --- 21. BTN is awarded the pot --------------------------------------
    // gross 164500 -> 5% = 8225 -> capped at 8000 -> net 156500.
    hand = step(hand, awardAllTo(hand.state, S0), f);
    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.endReason).toBe('SHOWDOWN');
    expect(hand.state.totalRake).toBe(8000);
    expect(stacks(hand.state)).toEqual({
      0: 178500, // 22000 + 164500 - 8000
      1: 99500,
      2: 22000,
      3: 100000,
      4: 92000,
      5: 100000,
    });

    const result = handResult(hand.state);
    expect(result).not.toBeNull();
    expect(Money.sum((result?.seats ?? []).map((s) => s.net))).toBe(-8000);
    expect(Money.sum((result?.seats ?? []).map((s) => s.net)) + (result?.totalRake ?? 0)).toBe(0);
  });
});
