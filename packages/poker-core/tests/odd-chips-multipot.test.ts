/**
 * Simultaneous odd-chip splits across SEVERAL pots in one `AWARD_POTS` (`docs/STATE.md`
 * known gap: `splitPot` / `oddChipOrder` were only tested on a single pot in
 * `tests/settlement-config.test.ts`; the multi-pot interaction — several pots each
 * splitting with their own remainder, in the same command, under both `oddChipRule`
 * values — was untested).
 *
 * `existing coverage`: `tests/settlement-config.test.ts` already covers `oddChipOrder`
 * and `splitPot` as pure functions and one single-pot two-way split end to end. This
 * file adds: two pots splitting AT ONCE (a 3-way split with remainder 2, and a 2-way
 * split with remainder 1), under BOTH `oddChipRule` values, with the exact recipient
 * seat pinned for every remainder — not merely the sum.
 *
 * Rake is switched OFF (`rake.numerator: 0`) so every milliBB in a pot's `netAmount`
 * is pure gross, keeping the odd-chip arithmetic uncontaminated by rake rounding
 * (rake-in-the-mix is `rake-allocation-branches.test.ts`'s job).
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS, type TableConfig } from '../src/config.js';
import { allIn, call, dealBoard, fold } from '../src/commands.js';
import type { HandCommand } from '../src/commands.js';
import { BB, NO_ANTE_PRESET, buildTable, cards, ids, start } from '../src/testing.js';
import { step } from './_helpers.js';
import type { SeatIndex } from '../src/seat.js';

const RAKE_OFF: TableConfig = {
  ...NO_ANTE_PRESET,
  rake: { ...NO_ANTE_PRESET.rake, numerator: 0 },
};

/**
 * Six-handed, button on seat 0. UTG (3) jams 11 BB, HJ (4) jams 18.001 BB, CO (5) jams
 * 30 BB, BTN (0) calls 30 BB; SB (1) and BB (2) fold having posted their blinds. The
 * odd milliBB amounts (11000 / 18001 / 30000) are chosen so the resulting pots do NOT
 * divide evenly by seat count — the whole point of this file.
 *
 * Contribution levels: SB 500 (folded), BB 1000 (folded), UTG 11000, HJ 18001,
 * CO/BTN 30000. Levels 500/1000/11000 share the eligible set [0,3,4,5] and merge:
 *
 *   pot0 MAIN  500 + 1000 + 4*11000              = 45500  eligible [0,3,4,5]
 *   pot1 SIDE  3 * (18001 - 11000) = 3*7001       = 21003  eligible [0,4,5]
 *   pot2 SIDE  2 * (30000 - 18001) = 2*11999      = 23998  eligible [0,5]
 *
 * Total 90501 == 500 + 1000 + 11000 + 18001 + 30000 + 30000.
 */
function buildAwaitingAward(config: TableConfig) {
  const f = ids();
  const table = buildTable({
    config,
    stacks: {
      0: BB(100),
      1: BB(100),
      2: BB(100),
      3: Money.mbb(11000),
      4: Money.mbb(18001),
      5: BB(30),
    },
    buttonSeat: 0,
  });
  let hand = start(table, f);
  hand = step(hand, allIn(), f); // UTG (3) jams 11000
  hand = step(hand, allIn(), f); // HJ (4) jams 18001
  hand = step(hand, allIn(), f); // CO (5) jams 30000
  hand = step(hand, call(), f); // BTN (0) calls 30000
  hand = step(hand, fold(), f); // SB (1)
  hand = step(hand, fold(), f); // BB (2)
  hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
  hand = step(hand, dealBoard(cards('2d')), f);
  hand = step(hand, dealBoard(cards('Js')), f);
  expect(hand.state.phase).toBe('AWAITING_AWARD');
  expect(hand.state.pots.map((p) => ({ amount: p.amount, eligibleSeats: p.eligibleSeats }))).toEqual([
    { amount: 45500, eligibleSeats: [0, 3, 4, 5] },
    { amount: 21003, eligibleSeats: [0, 4, 5] },
    { amount: 23998, eligibleSeats: [0, 5] },
  ]);
  return { hand, f };
}

/**
 * Awards all three pots in ONE command: pot0 three ways among [0, 3, 4] (a subset of
 * its four eligible seats — seat 5 is eligible but simply loses), pot1 two ways among
 * [4, 5] (a subset of its three eligible seats), pot2 entirely to seat 5.
 */
function awardAll(): HandCommand {
  const w0: readonly SeatIndex[] = [0, 3, 4];
  const w1: readonly SeatIndex[] = [4, 5];
  const w2: readonly SeatIndex[] = [5];
  return {
    kind: 'AWARD_POTS',
    awards: [
      { potIndex: 0, winners: w0 },
      { potIndex: 1, winners: w1 },
      { potIndex: 2, winners: w2 },
    ],
  };
}

describe('simultaneous odd-chip splits, FIRST_LEFT_OF_BUTTON (the shipped default)', () => {
  it('pins the exact remainder recipient in two pots awarded in the same command', () => {
    expect(DEFAULT_RULE_OPTIONS.oddChipRule).toBe('FIRST_LEFT_OF_BUTTON');
    const { hand: base, f } = buildAwaitingAward(RAKE_OFF);
    const hand = step(base, awardAll(), f);

    const awards = hand.events.filter((e) => e.kind === 'POT_AWARDED');
    expect(awards).toHaveLength(3);

    // pot0: winners [0,3,4], button-clockwise order excluding the button itself is
    // [3, 4, 0] (orderClockwise([0,3,4], buttonSeat=0, includeFrom=false)). Base share
    // floor(45500/3) = 15166, remainder 2 -> the FIRST TWO in that order (3 and 4) get
    // one extra milliBB each; seat 0 gets the bare share. This is the "three-way split
    // leaving a remainder of 2" case: two seats are bumped, not just one.
    const pot0 = awards.find((e) => e.kind === 'POT_AWARDED' && e.potIndex === 0);
    expect(pot0?.kind).toBe('POT_AWARDED');
    if (pot0?.kind !== 'POT_AWARDED') return;
    expect(pot0.netAmount).toBe(45500);
    expect(pot0.shares).toEqual([
      { seat: 3, amount: 15167 },
      { seat: 4, amount: 15167 },
      { seat: 0, amount: 15166 },
    ]);
    expect(Money.sum(pot0.shares.map((s) => s.amount))).toBe(pot0.netAmount);

    // pot1: winners [4,5], button-clockwise order [4, 5]. Base share
    // floor(21003/2) = 10501, remainder 1 -> seat 4 (first in order) gets the extra.
    const pot1 = awards.find((e) => e.kind === 'POT_AWARDED' && e.potIndex === 1);
    expect(pot1?.kind).toBe('POT_AWARDED');
    if (pot1?.kind !== 'POT_AWARDED') return;
    expect(pot1.netAmount).toBe(21003);
    expect(pot1.shares).toEqual([
      { seat: 4, amount: 10502 },
      { seat: 5, amount: 10501 },
    ]);
    expect(Money.sum(pot1.shares.map((s) => s.amount))).toBe(pot1.netAmount);

    // pot2: single winner, no split.
    const pot2 = awards.find((e) => e.kind === 'POT_AWARDED' && e.potIndex === 2);
    expect(pot2?.kind).toBe('POT_AWARDED');
    if (pot2?.kind !== 'POT_AWARDED') return;
    expect(pot2.shares).toEqual([{ seat: 5, amount: 23998 }]);

    // Seat 4 wins a remainder chip in BOTH pot0 and pot1 — the same seat benefiting
    // from the odd-chip rule twice in one settlement.
    expect(pot0.shares.find((s) => s.seat === 4)?.amount).toBe(15167); // base 15166 + 1
    expect(pot1.shares.find((s) => s.seat === 4)?.amount).toBe(10502); // base 10501 + 1

    // Every pot's shares sum to its own net amount; all shares across the hand sum to
    // the total awarded; and the awarded total matches the pot total (no rake/fee here).
    const allShares = awards.flatMap((e) => (e.kind === 'POT_AWARDED' ? e.shares : []));
    expect(Money.sum(allShares.map((s) => s.amount))).toBe(45500 + 21003 + 23998);
    expect(hand.state.totalRake).toBe(0);
    expect(hand.state.totalFees).toBe(0);

    // Conservation: every dealt-in seat's stack matches its ledger identity, and the
    // sum of net changes across seats is zero.
    const st = hand.state;
    for (const seat of st.dealtInSeats) {
      const s = st.seats[seat];
      expect(s.stack).toBe(s.startingStack - s.totalContribution + s.wonGross - s.rakePaid - s.feePaid);
    }
    const netSum = st.dealtInSeats.reduce<number>(
      (sum, seat) => sum + (st.seats[seat].stack - st.seats[seat].startingStack),
      0,
    );
    expect(netSum).toBe(0);
  });
});

describe('simultaneous odd-chip splits, LOWEST_SEAT_INDEX', () => {
  it('moves the remainder recipient to the lowest eligible seat instead of clockwise from the button', () => {
    const config: TableConfig = {
      ...RAKE_OFF,
      rules: { ...DEFAULT_RULE_OPTIONS, oddChipRule: 'LOWEST_SEAT_INDEX' },
    };
    const { hand: base, f } = buildAwaitingAward(config);
    const hand = step(base, awardAll(), f);

    const awards = hand.events.filter((e) => e.kind === 'POT_AWARDED');

    // pot0: winners [0,3,4] sorted ascending is [0, 3, 4] itself. Remainder 2 -> the
    // FIRST TWO in ascending order (0 and 3) get the extra milliBB; seat 4 gets the
    // bare share this time — the opposite of the FIRST_LEFT_OF_BUTTON case above,
    // where seat 4 was bumped and seat 0 was not.
    const pot0 = awards.find((e) => e.kind === 'POT_AWARDED' && e.potIndex === 0);
    expect(pot0?.kind).toBe('POT_AWARDED');
    if (pot0?.kind !== 'POT_AWARDED') return;
    expect(pot0.shares).toEqual([
      { seat: 0, amount: 15167 },
      { seat: 3, amount: 15167 },
      { seat: 4, amount: 15166 },
    ]);
    expect(Money.sum(pot0.shares.map((s) => s.amount))).toBe(45500);

    // pot1: winners [4,5] ascending is also [4, 5] — the same order as
    // FIRST_LEFT_OF_BUTTON produced for this particular winner set, so the recipient
    // coincides (seat 4), but we still pin it explicitly under this rule.
    const pot1 = awards.find((e) => e.kind === 'POT_AWARDED' && e.potIndex === 1);
    expect(pot1?.kind).toBe('POT_AWARDED');
    if (pot1?.kind !== 'POT_AWARDED') return;
    expect(pot1.shares).toEqual([
      { seat: 4, amount: 10502 },
      { seat: 5, amount: 10501 },
    ]);
    expect(Money.sum(pot1.shares.map((s) => s.amount))).toBe(21003);

    const pot2 = awards.find((e) => e.kind === 'POT_AWARDED' && e.potIndex === 2);
    expect(pot2?.kind).toBe('POT_AWARDED');
    if (pot2?.kind !== 'POT_AWARDED') return;
    expect(pot2.shares).toEqual([{ seat: 5, amount: 23998 }]);

    const allShares = awards.flatMap((e) => (e.kind === 'POT_AWARDED' ? e.shares : []));
    expect(Money.sum(allShares.map((s) => s.amount))).toBe(45500 + 21003 + 23998);

    const st = hand.state;
    for (const seat of st.dealtInSeats) {
      const s = st.seats[seat];
      expect(s.stack).toBe(s.startingStack - s.totalContribution + s.wonGross - s.rakePaid - s.feePaid);
    }
  });
});
