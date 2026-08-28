/**
 * Effective stack, SPR and pot odds (§7.14), and rake as configuration (§7.13).
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { allocateRake, computeRake } from '../src/rake.js';
import { effectiveStackBetween, effectiveStackFor, potOdds, spr } from '../src/metrics.js';
import { betTo, call, dealBoard, fold, raiseTo } from '../src/commands.js';
import { NO_ANTE_PRESET, buildTable, cards, ids, start } from '../src/testing.js';
import { step } from './_helpers.js';

const RAKE = NO_ANTE_PRESET.rake; // 5 / 100, cap 8000, floor, no-flop-no-drop
const FLOPPED = { sawFlop: true, contenderCount: 2 };

describe('rake', () => {
  it('takes 5% floored below the cap', () => {
    expect(computeRake(Money.mbb(20000), RAKE, FLOPPED)).toMatchObject({
      gross: 20000,
      rake: 1000,
      net: 19000,
      capped: false,
      waived: false,
    });
    // 19000 * 5 / 100 = 950 exactly.
    expect(computeRake(Money.mbb(19000), RAKE, FLOPPED).rake).toBe(950);
    // 19999 * 5 / 100 = 999.95 -> floors to 999, never rounds up.
    expect(computeRake(Money.mbb(19999), RAKE, FLOPPED).rake).toBe(999);
    // 19 * 5 / 100 = 0.95 -> 0.
    expect(computeRake(Money.mbb(19), RAKE, FLOPPED).rake).toBe(0);
  });

  it('caps at 8 BB on a big pot', () => {
    // 200000 * 5% = 10000, above the 8000 cap.
    expect(computeRake(Money.mbb(200000), RAKE, FLOPPED)).toMatchObject({
      rake: 8000,
      net: 192000,
      capped: true,
    });
    // 400000 * 5% = 20000, still exactly the cap.
    expect(computeRake(Money.mbb(400000), RAKE, FLOPPED).rake).toBe(8000);
    // Just below the cap threshold (159999 * 5% = 7999.95 -> 7999).
    expect(computeRake(Money.mbb(159_999), RAKE, FLOPPED).rake).toBe(7999);
  });

  it('waives the rake when the board never reached three cards', () => {
    expect(
      computeRake(Money.mbb(20000), RAKE, { sawFlop: false, contenderCount: 2 }),
    ).toMatchObject({ rake: 0, net: 20000, waived: true });
    // With the flag off, the same pot is raked.
    expect(
      computeRake(
        Money.mbb(20000),
        { ...RAKE, noFlopNoDrop: false },
        {
          sawFlop: false,
          contenderCount: 2,
        },
      ).rake,
    ).toBe(1000);
  });

  it('allocates one capped total across side pots so the parts sum exactly', () => {
    const pots = [
      {
        index: 0,
        kind: 'MAIN' as const,
        amount: Money.mbb(600),
        capLevel: Money.mbb(100),
        eligibleSeats: [],
        awarded: false,
      },
      {
        index: 1,
        kind: 'SIDE' as const,
        amount: Money.mbb(300),
        capLevel: Money.mbb(160),
        eligibleSeats: [],
        awarded: false,
      },
      {
        index: 2,
        kind: 'SIDE' as const,
        amount: Money.mbb(1000),
        capLevel: Money.mbb(660),
        eligibleSeats: [],
        awarded: false,
      },
    ];
    const parts = allocateRake(pots, Money.mbb(95), 'PROPORTIONAL');
    expect(parts).toEqual([30, 15, 50]); // 95*600/1900, 95*300/1900, 95*1000/1900
    expect(Money.sum(parts)).toBe(95);

    const drained = allocateRake(pots, Money.mbb(95), 'MAIN_POT_FIRST');
    expect(drained).toEqual([95, 0, 0]);
    expect(Money.sum(drained)).toBe(95);
  });

  it('gives the floor remainder to the main pot under PROPORTIONAL', () => {
    const pots = [
      {
        index: 0,
        kind: 'MAIN' as const,
        amount: Money.mbb(1000),
        capLevel: Money.mbb(1000),
        eligibleSeats: [],
        awarded: false,
      },
      {
        index: 1,
        kind: 'SIDE' as const,
        amount: Money.mbb(1000),
        capLevel: Money.mbb(2000),
        eligibleSeats: [],
        awarded: false,
      },
      {
        index: 2,
        kind: 'SIDE' as const,
        amount: Money.mbb(1000),
        capLevel: Money.mbb(3000),
        eligibleSeats: [],
        awarded: false,
      },
    ];
    // 100/3 floors to 33 each = 99; the remaining 1 must land on pot 0.
    const parts = allocateRake(pots, Money.mbb(100), 'PROPORTIONAL');
    expect(Money.sum(parts)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });
});

describe('effective stack and SPR', () => {
  // UTG 100 BB opens, the 40 BB button calls, the 250 BB big blind calls.
  const setup = () => {
    const f = ids();
    const t = buildTable({
      stacks: {
        0: Money.mbb(40_000),
        1: Money.mbb(100_000),
        2: Money.mbb(250_000),
        3: Money.mbb(100_000),
        4: Money.mbb(100_000),
        5: Money.mbb(100_000),
      },
      buttonSeat: 0,
    });
    let hand = start(t, f);
    hand = step(hand, raiseTo(Money.mbb(5000)), f); // UTG (3)
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, call(), f); // BTN (0), the shorter stack
    hand = step(hand, fold(), f); // SB
    hand = step(hand, call(), f); // BB (2), the deeper stack
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    return { hand, f };
  };

  it('is the pairwise minimum on both bases', () => {
    const { hand } = setup();
    const st = hand.state;
    expect(st.potTotal).toBe(15500); // 500 dead SB + 3 x 5000
    expect(st.seats[0].stack).toBe(35000);
    expect(st.seats[2].stack).toBe(245000);
    expect(st.seats[3].stack).toBe(95000);

    // Against the SHORTER opponent.
    expect(effectiveStackBetween(st, 3, 0, 'REMAINING')).toBe(35000);
    expect(effectiveStackBetween(st, 3, 0, 'STARTING')).toBe(40000);
    // Against the DEEPER opponent.
    expect(effectiveStackBetween(st, 3, 2, 'REMAINING')).toBe(95000);
    expect(effectiveStackBetween(st, 3, 2, 'STARTING')).toBe(100000);
    // Symmetric.
    expect(effectiveStackBetween(st, 0, 3, 'REMAINING')).toBe(35000);
  });

  it('uses "versus the deepest live opponent" multiway', () => {
    const st = setup().hand.state;
    expect(effectiveStackFor(st, 0, 'REMAINING')).toBe(35000); // min(35000, 245000)
    expect(effectiveStackFor(st, 3, 'REMAINING')).toBe(95000); // min(95000, 245000)
    expect(effectiveStackFor(st, 2, 'REMAINING')).toBe(95000); // min(245000, 95000)
    expect(effectiveStackFor(st, 0, 'STARTING')).toBe(40000);
    expect(effectiveStackFor(st, 2, 'STARTING')).toBe(100000);
  });

  it('reports SPR as effective-remaining over the pot', () => {
    const st = setup().hand.state;
    expect(spr(st, 0)).toBeCloseTo(35000 / 15500, 12);
    expect(spr(st, 2)).toBeCloseTo(95000 / 15500, 12);
    expect(spr(st, 3)).toBeCloseTo(95000 / 15500, 12);
  });

  it('reports pot odds as call over pot-after-call', () => {
    const { hand, f } = setup();
    // Postflop the big blind is first; it leads 10 BB into 15.5 BB.
    expect(hand.state.actorSeat).toBe(2);
    const bet = step(hand, betTo(Money.mbb(10_000)), f);
    expect(bet.state.potTotal).toBe(25500);
    expect(bet.state.actorSeat).toBe(3);
    expect(potOdds(bet.state, 3)).toBeCloseTo(10000 / 35500, 12);
    // The 35 BB button can only call 10 BB too, so its odds match.
    expect(potOdds(bet.state, 0)).toBeCloseTo(10000 / 35500, 12);
  });

  it('sees a shorter opponent shrink the effective stack once it is all-in', () => {
    const { hand, f } = setup();
    let h = step(hand, betTo(Money.mbb(10_000)), f); // BB leads
    h = step(h, call(), f); // UTG calls
    h = step(h, { kind: 'ALL_IN' }, f); // the 35 BB button jams
    expect(h.state.seats[0].status).toBe('ALL_IN');
    // Only the button is out of chips; the other two are still 85/235 deep.
    expect(effectiveStackFor(h.state, 0, 'REMAINING')).toBe(0);
    expect(effectiveStackFor(h.state, 3, 'REMAINING')).toBe(85000);
  });
});
