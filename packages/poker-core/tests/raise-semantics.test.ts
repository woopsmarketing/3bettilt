/**
 * Raise-TO semantics, minimum raises, and the "a short all-in does not reopen the
 * betting" rule (docs/POKER_CORE_API.md §7.3, §7.4).
 *
 * All numbers below are derived from NLHE rules and the NL50 preset, not from src/.
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS } from '../src/config.js';
import { legalActions, mayReopen, minWagerToAmount } from '../src/betting.js';
import { allIn, call, check, fold, raiseTo } from '../src/commands.js';
import { applyCommand } from '../src/hand.js';
import { BB, NO_ANTE_PRESET, buildTable, ids, sixHanded, start } from '../src/testing.js';
import { step } from './_helpers.js';

describe('raise-TO semantics', () => {
  it('records toAmount 9000 as an additional 6500 over an existing 2500 contribution', () => {
    const f = ids();
    let hand = start(sixHanded(), f);

    hand = step(hand, raiseTo(Money.mbb(2500)), f); // UTG (3) opens to 2.5 BB
    expect(hand.state.round.currentBet).toBe(2500);
    expect(hand.state.round.lastFullRaiseSize).toBe(1500); // 2500 - 1000
    expect(minWagerToAmount(hand.state, 4)).toBe(4000); // 2500 + 1500

    hand = step(hand, call(), f); // HJ (4) calls 2500
    expect(hand.state.seats[4].streetContribution).toBe(2500);
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB

    hand = step(hand, raiseTo(Money.mbb(4000)), f); // BB (2) three-bets to 4 BB
    expect(hand.state.round.currentBet).toBe(4000);
    expect(hand.state.round.lastFullRaiseSize).toBe(1500); // 4000 - 2500
    expect(hand.state.round.fullRaiseCount).toBe(3);

    hand = step(hand, call(), f); // UTG calls to 4000
    expect(hand.state.actorSeat).toBe(4);

    // HJ sits on a street contribution of 2500 and raises TO 9000.
    expect(hand.state.seats[4].streetContribution).toBe(2500);
    hand = step(hand, raiseTo(Money.mbb(9000)), f);

    const raise = hand.events[hand.events.length - 1];
    expect(raise?.kind).toBe('RAISE');
    expect(raise).toMatchObject({ seat: 4, toAmount: 9000, amount: 6500 });
    expect(hand.state.seats[4].streetContribution).toBe(9000);
    expect(hand.state.seats[4].stack).toBe(91000); // 100000 - 9000

    // The next player's minimum raise-TO: currentBet 9000 + last full raise 5000.
    expect(hand.state.actorSeat).toBe(2);
    expect(hand.state.round.lastFullRaiseSize).toBe(5000); // 9000 - 4000
    expect(minWagerToAmount(hand.state, 2)).toBe(14000);
    expect(legalActions(hand.state, 2).wager).toMatchObject({
      kind: 'RAISE',
      minToAmount: 14000,
      minAdditional: 10000, // 14000 - 4000 already in
      maxToAmount: 100000,
      onlyAllIn: false,
    });
    // 13999 is one milliBB short of legal.
    expect(applyCommand(hand, raiseTo(Money.mbb(13999)), f)).toMatchObject({
      ok: false,
      error: { code: 'AMOUNT_BELOW_MINIMUM', context: { min: 14000 } },
    });
  });
});

describe('an all-in for less than a full raise does not reopen the betting', () => {
  // The worked example from §7.4: UTG to 3000, CO calls, BTN all-in to 4000.
  const setup = () => {
    const f = ids();
    const table = buildTable({
      stacks: { 0: Money.mbb(4000), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f); // UTG (3)
    hand = step(hand, fold(), f); // HJ (4)
    hand = step(hand, call(), f); // CO (5) calls 3000
    hand = step(hand, allIn(), f); // BTN (0) is all-in for exactly 4000
    return { hand, f };
  };

  it('raises the price to call without raising the full-raise clock', () => {
    const { hand } = setup();
    expect(hand.state.seats[0].status).toBe('ALL_IN');
    expect(hand.state.round.currentBet).toBe(4000); // the price DID go up
    expect(hand.state.round.lastFullRaiseSize).toBe(2000); // unchanged: 3000 - 1000
    expect(hand.state.round.lastFullRaiseTo).toBe(3000); // unchanged
    expect(hand.state.round.fullRaiseCount).toBe(2); // unchanged
  });

  it('still lets a player who has not yet acted raise, from the new current bet', () => {
    const { hand } = setup();
    expect(hand.state.actorSeat).toBe(1); // SB has not acted
    expect(mayReopen(hand.state, 1)).toBe(true);
    expect(minWagerToAmount(hand.state, 1)).toBe(6000); // 4000 + 2000
    expect(legalActions(hand.state, 1).wager).toMatchObject({
      kind: 'RAISE',
      minToAmount: 6000,
      onlyAllIn: false,
    });
    expect(legalActions(hand.state, 1).wagerBlockedBy).toBeNull();
  });

  it('lets a player who already acted only call or fold', () => {
    const { hand: base, f } = setup();
    let hand = step(base, fold(), f); // SB folds
    hand = step(hand, fold(), f); // BB folds
    expect(hand.state.actorSeat).toBe(3); // UTG, who already acted at fullRaiseCount 2

    expect(mayReopen(hand.state, 3)).toBe(false);
    const legal = legalActions(hand.state, 3);
    expect(legal.canFold).toBe(true);
    expect(legal.canCheck).toBe(false);
    expect(legal.call).toMatchObject({ toAmount: 4000, amount: 1000, isAllIn: false });
    expect(legal.wager).toBeNull();
    expect(legal.wagerBlockedBy).toBe('RAISE_NOT_REOPENED');
    expect(applyCommand(hand, raiseTo(Money.mbb(6000)), f)).toMatchObject({
      ok: false,
      error: { code: 'RAISE_NOT_REOPENED' },
    });

    hand = step(hand, call(), f); // UTG calls the extra 1000
    expect(hand.state.actorSeat).toBe(5); // CO, who also already acted
    expect(mayReopen(hand.state, 5)).toBe(false);
    expect(legalActions(hand.state, 5).wager).toBeNull();
  });

  it('measures the re-raise minimum from the last FULL raise under the other basis', () => {
    // Assumption #1: shortAllInMinRaiseBasis === 'LAST_FULL_RAISE' gives 3000 + 2000 = 5000.
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...DEFAULT_RULE_OPTIONS, shortAllInMinRaiseBasis: 'LAST_FULL_RAISE' as const },
    };
    const f = ids();
    const table = buildTable({
      config,
      stacks: { 0: Money.mbb(4000), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f);
    hand = step(hand, fold(), f);
    hand = step(hand, call(), f);
    hand = step(hand, allIn(), f);
    expect(hand.state.actorSeat).toBe(1);
    expect(minWagerToAmount(hand.state, 1)).toBe(5000); // lastFullRaiseTo 3000 + size 2000
    expect(applyCommand(hand, raiseTo(Money.mbb(5000)), f).ok).toBe(true);
  });
});

describe('the big blind option', () => {
  it('keeps the round open for the big blind after everybody limps', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (const seat of [3, 4, 5, 0]) {
      expect(hand.state.actorSeat).toBe(seat);
      hand = step(hand, call(), f); // limp
    }
    hand = step(hand, call(), f); // SB completes
    expect(hand.state.potTotal).toBe(6000);

    // The big blind has not voluntarily acted, so it is still on the clock.
    expect(hand.state.phase).toBe('BETTING');
    expect(hand.state.actorSeat).toBe(2);
    const legal = legalActions(hand.state, 2);
    expect(legal.canCheck).toBe(true);
    expect(legal.call).toBeNull();
    expect(legal.wager).toMatchObject({ kind: 'RAISE', minToAmount: 2000 });

    const checked = step(hand, check(), f);
    expect(checked.state.phase).toBe('AWAITING_BOARD');
    expect(checked.state.pendingStreet).toBe('FLOP');
    expect(checked.state.potTotal).toBe(6000);
  });

  it('reopens the round for every limper when the big blind raises', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f);
    hand = step(hand, call(), f); // SB
    hand = step(hand, raiseTo(Money.mbb(4000)), f); // BB raises its option

    expect(hand.state.round.currentBet).toBe(4000);
    expect(hand.state.round.lastFullRaiseSize).toBe(3000);
    expect(hand.state.round.fullRaiseCount).toBe(2);
    expect(hand.state.actorSeat).toBe(3); // UTG must act again
    expect(mayReopen(hand.state, 3)).toBe(true);
    expect(minWagerToAmount(hand.state, 3)).toBe(7000); // 4000 + 3000
    expect(hand.state.potTotal).toBe(9000); // 6000 + 3000 more from the BB
  });

  it('gives no option when the folds leave the big blind alone', () => {
    const f = ids();
    let hand = start(sixHanded(), f);
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f);
    // Only one contender remains, so the hand is over rather than parked on the BB.
    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.actorSeat).toBeNull();
  });
});

describe('an all-in that is exactly a full raise', () => {
  it('does reopen the betting, unlike a short one', () => {
    const f = ids();
    // The button has exactly 5 BB: raising to 5000 over a 3000 bet is an increment of
    // 2000, which equals the last full raise size, so it is a FULL raise.
    const table = buildTable({
      stacks: { 0: Money.mbb(5000), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f); // UTG
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, call(), f); // CO
    hand = step(hand, allIn(), f); // BTN, all-in for exactly 5000

    expect(hand.state.round.currentBet).toBe(5000);
    expect(hand.state.round.lastFullRaiseSize).toBe(2000);
    expect(hand.state.round.lastFullRaiseTo).toBe(5000);
    expect(hand.state.round.fullRaiseCount).toBe(3); // the clock DID advance

    hand = step(hand, fold(), f); // SB
    hand = step(hand, fold(), f); // BB
    expect(hand.state.actorSeat).toBe(3); // UTG
    expect(mayReopen(hand.state, 3)).toBe(true);
    expect(minWagerToAmount(hand.state, 3)).toBe(7000); // 5000 + 2000
    expect(legalActions(hand.state, 3).wager).toMatchObject({ minToAmount: 7000 });
  });
});

describe('two short all-ins in a row', () => {
  it('raise the price twice without ever reopening for players who acted', () => {
    const f = ids();
    const table = buildTable({
      stacks: {
        0: Money.mbb(4000), // BTN
        1: Money.mbb(4500), // SB
        2: BB(100),
        3: BB(100),
        4: BB(100),
        5: BB(100),
      },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, raiseTo(Money.mbb(3000)), f); // UTG, full: frc 2, size 2000
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, call(), f); // CO
    hand = step(hand, allIn(), f); // BTN short all-in to 4000
    expect(hand.state.round.fullRaiseCount).toBe(2);

    hand = step(hand, allIn(), f); // SB short all-in to 4500 (increment 500 < 2000)
    expect(hand.state.round.currentBet).toBe(4500);
    expect(hand.state.round.lastFullRaiseSize).toBe(2000);
    expect(hand.state.round.fullRaiseCount).toBe(2); // still unmoved

    // The big blind has not acted at all, so it may still raise — from 4500.
    expect(hand.state.actorSeat).toBe(2);
    expect(mayReopen(hand.state, 2)).toBe(true);
    expect(minWagerToAmount(hand.state, 2)).toBe(6500); // 4500 + 2000

    hand = step(hand, fold(), f); // BB folds
    expect(hand.state.actorSeat).toBe(3); // UTG
    expect(mayReopen(hand.state, 3)).toBe(false);
    expect(legalActions(hand.state, 3).call).toMatchObject({ amount: 1500 }); // 4500 - 3000
    expect(legalActions(hand.state, 3).wager).toBeNull();
  });
});

describe('shortBlindSetsFullLevel', () => {
  it('lets a short big blind set the price when the flag is off', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...DEFAULT_RULE_OPTIONS, shortBlindSetsFullLevel: false },
    };
    const table = buildTable({
      config,
      stacks: { 0: BB(100), 1: BB(100), 2: Money.mbb(400), 3: BB(100), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    const st = start(table, ids()).state;
    // Highest LIVE blind posted is the small blind's 500, not the nominal 1000.
    expect(st.round.currentBet).toBe(500);
    expect(legalActions(st, 3).call).toMatchObject({ amount: 500 });
  });
});
