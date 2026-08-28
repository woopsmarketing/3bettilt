/**
 * Regression coverage for the Phase 1 review findings. One describe block per finding,
 * each pinning the CORRECTED behaviour plus the counter-case that proves the fix did not
 * over-reach.
 *
 * Expected values are hand-derived from real NLHE rules and docs/POKER_CORE_API.md.
 */
import { describe, expect, it } from 'vitest';
import { Money, asId, type HandId, type PlayerId } from '@gto-self/shared';
import { legalActions } from '../src/betting.js';
import { DEFAULT_RULE_OPTIONS } from '../src/config.js';
import {
  awardPots,
  call,
  composeStartEvents,
  dealBoard,
  fold,
  allIn,
  type RosterEntry,
} from '../src/commands.js';
import { assignBlinds, assignPositions } from '../src/positions.js';
import { CP_NL50_6MAX_NO_ANTE } from '../src/presets.js';
import { allocateRake } from '../src/rake.js';
import { foldEvents } from '../src/reduce.js';
import type { SeatIndex } from '../src/seat.js';
import { wagerToForPotFraction } from '../src/sizing.js';
import { startHand, type Hand } from '../src/hand.js';
import { BB, buildTable, cards, ids, start } from '../src/testing.js';
import { seatPlayer, setSeatStack, createTable } from '../src/table.js';
import { toView } from '../src/view.js';
import type { Pot } from '../src/pots.js';
import { stacks, step } from './_helpers.js';

const NO_ANTE = CP_NL50_6MAX_NO_ANTE;

function tableOf(stackBySeat: Record<number, number>, buttonSeat: SeatIndex) {
  return buildTable({ config: NO_ANTE, stacks: stackBySeat, buttonSeat });
}

function actionKinds(hand: Hand): readonly string[] {
  return hand.state.actions.map((a) => a.kind);
}

// ---------------------------------------------------------------------------
// Finding 1 — a nominal `currentBet` is not an obligation.
// ---------------------------------------------------------------------------

describe('a big blind who cannot cover the blind puts nobody on the clock', () => {
  it('heads-up: the button has already covered the short all-in blind, so the hand runs out', () => {
    // Button/SB posts 500, the big blind is all-in for 400. Nothing is owed either way:
    // 100 comes back to the button and the board must run.
    const hand = start(tableOf({ 0: BB(100), 3: Money.mbb(400) }, 0), ids());

    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.round.currentBet).toBe(900); // 1000 nominal, less the 100 returned
    expect(hand.state.potTotal).toBe(800);
    expect(hand.state.seats[0].stack).toBe(99600);
    expect(hand.state.seats[3].status).toBe('ALL_IN');
    // No decision existed, so no action was recorded and none is offered.
    expect(actionKinds(hand)).toEqual([]);
    expect(legalActions(hand.state).seat).toBeNull();
    expect(legalActions(hand.state).canFold).toBe(false);
  });

  it('heads-up: both blinds short — the big blind is not asked to call its own money', () => {
    // SB all-in for 300, BB posts 400 of which 100 is uncalled and comes straight back.
    // Both seats are then square at 300 and the round is over before anyone acts.
    const hand = start(tableOf({ 0: Money.mbb(300), 3: Money.mbb(400) }, 0), ids());

    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.potTotal).toBe(600);
    expect(hand.state.seats[0].status).toBe('ALL_IN');
    expect(hand.state.seats[3].stack).toBe(100);
    expect(hand.state.seats[3].streetContribution).toBe(300);
    expect(actionKinds(hand)).toEqual([]);
    expect(hand.events.filter((e) => e.kind === 'RETURN_UNCALLED')).toHaveLength(1);
  });

  it('six-handed: the small blind is not put on the clock behind an all-in short blind', () => {
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: Money.mbb(400), 3: BB(100), 4: BB(100), 5: BB(100) }, 0),
      f,
    );

    // Everyone who genuinely faces action still pays the nominal 1 BB price of entry.
    expect(hand.state.actorSeat).toBe(3);
    expect(legalActions(hand.state).call?.amount).toBe(1000);

    hand = step(hand, fold(), f); // UTG
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN

    // The SB's 500 already covers the all-in BB's 400 and nobody can raise it.
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.actorSeat).toBeNull();
    expect(actionKinds(hand)).toEqual(['FOLD', 'FOLD', 'FOLD', 'FOLD']);
    expect(hand.state.seats[1].stack).toBe(99600);
    expect(hand.state.potTotal).toBe(800);
  });

  it('but the small blind DOES act again as soon as a live opponent limps', () => {
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: Money.mbb(400), 3: BB(100), 4: BB(100), 5: BB(100) }, 0),
      f,
    );
    hand = step(hand, call(), f); // UTG limps 1000 — real money ahead of the SB
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN

    expect(hand.state.phase).toBe('BETTING');
    expect(hand.state.actorSeat).toBe(1);
    expect(legalActions(hand.state).call?.amount).toBe(500); // complete to 1 BB
  });

  it('a full big blind still gets its option when everyone limps', () => {
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) }, 0),
      f,
    );
    hand = step(hand, call(), f); // UTG
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, call(), f); // SB completes
    expect(hand.state.actorSeat).toBe(2);
    expect(legalActions(hand.state).canCheck).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Findings 2 / 3 / 6 — an all-in seat may win a pot.
// ---------------------------------------------------------------------------

describe('an all-in seat that wins a pot', () => {
  it('a short all-in blind is credited its showdown pot and stays ALL_IN', () => {
    // The reported repro for this finding drove the automatic uncontested award by folding
    // the small blind behind a short all-in big blind. With the finding-1 fix that fold no
    // longer exists (the SB owes nothing), so the same money question now arrives through
    // the ordinary showdown award: the short blind wins while all-in.
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: Money.mbb(400), 3: BB(100), 4: BB(100), 5: BB(100) }, 0),
      f,
    );
    for (let i = 0; i < 4; i += 1) hand = step(hand, fold(), f); // 3, 4, 5, 0
    expect(hand.state.phase).toBe('AWAITING_BOARD');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.pots).toHaveLength(1);
    expect(hand.state.pots[0]).toMatchObject({ amount: 800, eligibleSeats: [1, 2] });

    hand = step(hand, awardPots([{ potIndex: 0, winners: [2] }]), f);

    // gross 800, saw a flop -> rake floor(800 * 5 / 100) = 40, net 760.
    expect(hand.state.totalRake).toBe(40);
    expect(stacks(hand.state)).toEqual({
      0: 100000,
      1: 99600,
      2: 760,
      3: 100000,
      4: 100000,
      5: 100000,
    });
    // The seat committed its whole stack this hand and stays marked ALL_IN; the credit is
    // settlement, not a re-entry into the action.
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    expect(hand.state.seats[2].totalContribution).toBe(400);
    expect(hand.state.phase).toBe('COMPLETE');
  });

  it('the automatic uncontested award still settles an ordinary walk', () => {
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) }, 0),
      f,
    );
    for (let i = 0; i < 5; i += 1) hand = step(hand, fold(), f); // 3, 4, 5, 0, 1
    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.endReason).toBe('ALL_FOLDED');
    expect(hand.state.totalRake).toBe(0); // no flop, no drop
    expect(hand.state.seats[2].stack).toBe(100500); // 99000 behind + the 1500 pot
    expect(hand.state.seats[2].status).toBe('IN_HAND');
  });

  it('is credited an explicitly awarded main pot without reopening a betting round', () => {
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(20), 4: BB(100), 5: BB(100) }, 0),
      f,
    );
    hand = step(hand, allIn(), f); // UTG seat 3 shoves 20000
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB
    hand = step(hand, call(), f); // BB calls 20000
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);

    expect(hand.state.pots).toHaveLength(1);
    expect(hand.state.potTotal).toBe(40500); // 500 dead SB + 20000 + 20000

    const beforeAward = hand.events.length;
    hand = step(hand, awardPots([{ potIndex: 0, winners: [3] }]), f);

    // rake floor(40500 * 5 / 100) = 2025, net 38475.
    expect(hand.state.totalRake).toBe(2025);
    expect(hand.state.seats[3].stack).toBe(38475);
    expect(hand.state.seats[3].status).toBe('ALL_IN');
    expect(hand.state.phase).toBe('COMPLETE');

    // Settlement never passes through a state with a seat on the clock.
    for (let i = beforeAward; i <= hand.events.length; i += 1) {
      const intermediate = foldEvents(hand.events.slice(0, i));
      expect(intermediate.phase).not.toBe('BETTING');
      expect(intermediate.actorSeat).toBeNull();
    }
  });

  it('takes the main pot while the covering stack takes the side pot', () => {
    const f = ids();
    let hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: BB(60), 3: BB(20), 4: BB(100), 5: BB(100) }, 0),
      f,
    );
    hand = step(hand, allIn(), f); // UTG seat 3 all-in 20000
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, allIn(), f); // BTN seat 0 all-in 100000
    hand = step(hand, fold(), f); // SB
    hand = step(hand, allIn(), f); // BB seat 2 all-in 60000
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);

    // Seat 0's 100000 is uncalled above 60000, so 40000 comes back first.
    expect(hand.state.seats[0].stack).toBe(40000);
    // main: 500 dead SB + 20000 x 3 = 60500, eligible {0, 2, 3}
    // side: (60000 - 20000) x 2 = 80000, eligible {0, 2}
    expect(hand.state.pots.map((p) => p.amount)).toEqual([60500, 80000]);

    const beforeAward = hand.events.length;
    hand = step(
      hand,
      awardPots([
        { potIndex: 0, winners: [3] },
        { potIndex: 1, winners: [0] },
      ]),
      f,
    );

    // gross 140500 -> 5% = 7025, under the 8000 cap.
    // PROPORTIONAL: floor(7025 * 60500 / 140500) = 3025, floor(7025 * 80000 / 140500) = 4000.
    expect(hand.state.totalRake).toBe(7025);
    expect(hand.state.seats[3].stack).toBe(60500 - 3025);
    expect(hand.state.seats[0].stack).toBe(40000 + 80000 - 4000);
    expect(hand.state.seats[3].status).toBe('ALL_IN');
    expect(hand.state.seats[2].status).toBe('ALL_IN');

    // The first POT_AWARDED credits an all-in seat while pot 1 is still pending; no state
    // in between may become a betting round.
    for (let i = beforeAward; i <= hand.events.length; i += 1) {
      const intermediate = foldEvents(hand.events.slice(0, i));
      expect(intermediate.phase).not.toBe('BETTING');
    }
  });

  it('leaves a zero-net winner ALL_IN rather than resurrecting it', () => {
    // MAIN_POT_FIRST + a capped rake larger than the main pot: the main pot's winner is
    // credited ZERO, so the seat's committed-everything status must be untouched.
    const config = { ...NO_ANTE, rake: { ...NO_ANTE.rake, allocation: 'MAIN_POT_FIRST' as const } };
    const f = ids();
    let hand = start(
      buildTable({
        config,
        stacks: { 0: BB(300), 1: BB(300), 2: Money.mbb(100), 3: BB(300) },
        buttonSeat: 0,
      }),
      f,
    );
    // Seat 2 is the big blind and could only post 100 of its 1000.
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    hand = step(hand, allIn(), f); // seat 3 shoves
    hand = step(hand, allIn(), f); // seat 0 shoves
    hand = step(hand, fold(), f); // seat 1 (SB)
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);

    const main = hand.state.pots[0];
    expect(main?.eligibleSeats).toEqual([0, 2, 3]);
    expect(main?.amount).toBeLessThan(8000); // smaller than the capped rake

    const awards = hand.state.pots.map((p) => ({
      potIndex: p.index,
      winners: [p.index === 0 ? (2 as SeatIndex) : (3 as SeatIndex)],
    }));
    hand = step(hand, awardPots(awards), f);

    expect(hand.state.awards[0]?.netAmount).toBe(0);
    expect(hand.state.seats[2].stack).toBe(0);
    expect(hand.state.seats[2].status).toBe('ALL_IN');
    expect(hand.state.phase).toBe('COMPLETE');
  });
});

// ---------------------------------------------------------------------------
// Finding 4 — rake allocation never charges a pot more than it holds.
// ---------------------------------------------------------------------------

describe('allocateRake', () => {
  const pot = (index: number, amount: number): Pot => ({
    index,
    kind: index === 0 ? 'MAIN' : 'SIDE',
    amount: Money.mbb(amount),
    capLevel: Money.mbb(amount),
    eligibleSeats: [],
    awarded: false,
  });

  it('MAIN_POT_FIRST can take a whole small main pot — the stated policy consequence', () => {
    const pots = [pot(0, 600), pot(1, 300000)];
    expect(allocateRake(pots, Money.mbb(8000), 'MAIN_POT_FIRST')).toEqual([600, 7400]);
  });

  it('PROPORTIONAL charges the same pots far less and leaves the main pot a net', () => {
    const pots = [pot(0, 600), pot(1, 300000)];
    expect(allocateRake(pots, Money.mbb(8000), 'PROPORTIONAL')).toEqual([16, 7984]);
  });

  it('PROPORTIONAL spills the floor remainder past a main pot that cannot hold it', () => {
    // gross 301, rake 300 -> floors 0 / 99 / 99 / 99, remainder 3. Loading all 3 onto the
    // 1-milliBB main pot would make its netAmount -2.
    const pots = [pot(0, 1), pot(1, 100), pot(2, 100), pot(3, 100)];
    const shares = allocateRake(pots, Money.mbb(300), 'PROPORTIONAL');
    expect(shares).toEqual([1, 100, 100, 99]);
    expect(Money.sum(shares)).toBe(300);
    shares.forEach((share, index) => {
      expect(share).toBeLessThanOrEqual(pots[index]?.amount ?? 0);
    });
  });
});

// ---------------------------------------------------------------------------
// Finding 5 — the table total is range-checked, not just each seat.
// ---------------------------------------------------------------------------

describe('table chip totals stay inside the milliBB range', () => {
  const HUGE = Money.mbb(170_000_000); // 170,000 BB — individually legal

  it('seatPlayer refuses the seat that would push the table total past the limit', () => {
    const table = createTable(NO_ANTE);
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    let state = table.value;
    for (const seat of [0, 1, 2, 3, 4] as const) {
      const seated = seatPlayer(state, seat, asId<'Player'>(`p${seat}`) as PlayerId, HUGE);
      expect(seated.ok).toBe(true);
      if (!seated.ok) return;
      state = seated.value;
    }
    const sixth = seatPlayer(state, 5, asId<'Player'>('p5') as PlayerId, HUGE);
    expect(sixth.ok).toBe(false);
    if (sixth.ok) return;
    expect(sixth.error.code).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it('setSeatStack refuses the same overflow', () => {
    const table = tableOf({ 0: BB(100), 1: BB(100) }, 0);
    const raised = setSeatStack(table, 0, Money.mbb(Money.MAX_MILLI_BB));
    expect(raised.ok).toBe(false);
    if (raised.ok) return;
    expect(raised.error.code).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it('composeStartEvents returns an Err instead of throwing out of Money.sum', () => {
    const roster: RosterEntry[] = ([0, 1, 2, 3, 4, 5] as const).map((seat) => ({
      seat,
      playerId: asId<'Player'>(`p${seat}`) as PlayerId,
      startingStack: HUGE,
    }));
    const events = composeStartEvents(
      {
        handId: asId<'Hand'>('h1') as HandId,
        handNumber: 0,
        config: NO_ANTE,
        buttonSeat: 0,
        heroSeat: null,
        roster,
      },
      ids(),
    );
    expect(events.ok).toBe(false);
    if (events.ok) return;
    expect(events.error.code).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it('a table built one seat at a time still starts a hand normally', () => {
    const hand = startHand(
      tableOf({ 0: BB(100), 1: BB(100) }, 0),
      { handId: asId<'Hand'>('h1') as HandId },
      ids(),
    );
    expect(hand.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Finding 6 — wagerToForPotFraction honours its Result contract.
// ---------------------------------------------------------------------------

describe('wagerToForPotFraction never throws on user input', () => {
  function utgHand() {
    const hand = start(
      tableOf({ 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) }, 0),
      ids(),
    );
    expect(hand.state.actorSeat).toBe(3);
    return hand;
  }

  it('returns AMOUNT_OUT_OF_RANGE for a fraction whose product leaves the milliBB range', () => {
    const hand = utgHand();
    const result = wagerToForPotFraction(hand.state, 3, 1e9, 'round');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AMOUNT_OUT_OF_RANGE');
    expect(result.error.context.seat).toBe(3);
  });

  it("returns AMOUNT_OUT_OF_RANGE rather than throwing under 'exact' rounding", () => {
    const hand = utgHand();
    // potAfterCall is 2500; 2500 x 0.333 = 832.5, which 'exact' cannot represent.
    const result = wagerToForPotFraction(hand.state, 3, 0.333, 'exact');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it("still accepts an 'exact' fraction that lands on a whole milliBB", () => {
    const hand = utgHand();
    // 1000 + 0.5 x 2500 = 2250, below the 2000 minimum? no: min raise-to is 2000.
    const result = wagerToForPotFraction(hand.state, 3, 0.5, 'exact');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.toAmount).toBe(2250);
    expect(result.value.clampedTo).toBeNull();
  });

  it('rejects a negative fraction as before', () => {
    const hand = utgHand();
    const result = wagerToForPotFraction(hand.state, 3, -1, 'round');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AMOUNT_OUT_OF_RANGE');
  });
});

// ---------------------------------------------------------------------------
// Finding 7 — heads-up labels agree with the blinds.
// ---------------------------------------------------------------------------

describe('heads-up position labels', () => {
  it('agree with blindRole under the default rule', () => {
    const rules = DEFAULT_RULE_OPTIONS;
    const blinds = assignBlinds([2, 5] as SeatIndex[], 5 as SeatIndex, rules);
    expect(blinds.ok).toBe(true);
    if (!blinds.ok) return;
    const pos = assignPositions([2, 5] as SeatIndex[], blinds.value, rules);
    expect(pos[5]).toMatchObject({ position: 'BTN', blindRole: 'SB', isButton: true });
    expect(pos[2]).toMatchObject({ position: 'BB', blindRole: 'BB', isButton: false });
  });

  it('agree with blindRole when the button posts the BIG blind', () => {
    const rules = { ...DEFAULT_RULE_OPTIONS, headsUpButtonPostsSmallBlind: false };
    const blinds = assignBlinds([2, 5] as SeatIndex[], 5 as SeatIndex, rules);
    expect(blinds.ok).toBe(true);
    if (!blinds.ok) return;
    expect(blinds.value).toMatchObject({ smallBlindSeat: 2, bigBlindSeat: 5 });
    const pos = assignPositions([2, 5] as SeatIndex[], blinds.value, rules);
    expect(pos[2]).toMatchObject({ position: 'SB', blindRole: 'SB' });
    expect(pos[5]).toMatchObject({ position: 'BB', blindRole: 'BB', isButton: true });
  });

  it("honours headsUpButtonLabel: 'SB' only for a button that posts the small blind", () => {
    const rules = { ...DEFAULT_RULE_OPTIONS, headsUpButtonLabel: 'SB' as const };
    const blinds = assignBlinds([2, 5] as SeatIndex[], 5 as SeatIndex, rules);
    if (!blinds.ok) return;
    const pos = assignPositions([2, 5] as SeatIndex[], blinds.value, rules);
    expect(pos[5]?.position).toBe('SB');
    expect(pos[2]?.position).toBe('BB');
  });

  it('the read model never shows an SB marker on a seat labelled BB', () => {
    const config = {
      ...NO_ANTE,
      rules: { ...DEFAULT_RULE_OPTIONS, headsUpButtonPostsSmallBlind: false },
    };
    const hand = start(
      buildTable({ config, stacks: { 2: BB(100), 5: BB(100) }, buttonSeat: 5 }),
      ids(),
    );
    const view = toView(hand);
    for (const seat of hand.state.dealtInSeats) {
      const seatView = view.seats[seat];
      if (seatView.isSmallBlind) expect(seatView.position).not.toBe('BB');
      if (seatView.isBigBlind) expect(seatView.position).not.toBe('SB');
    }
    expect(view.seats[2]).toMatchObject({ position: 'SB', isSmallBlind: true, isBigBlind: false });
    expect(view.seats[5]).toMatchObject({ position: 'BB', isBigBlind: true, isSmallBlind: false });
  });
});
