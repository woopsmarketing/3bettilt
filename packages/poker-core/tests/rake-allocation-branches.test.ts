/**
 * Both `rake.allocation` branches, exercised end to end through the SAME real
 * multi-pot hand, plus the rake cap, the `NO_FLOP_NO_DROP` waiver and a manual fee
 * alongside rake (`docs/STATE.md` known gap: only `PROPORTIONAL` was exercised
 * end-to-end through a real multi-pot hand; `MAIN_POT_FIRST` was unit-tested on
 * `allocateRake` only, in isolation from a real settlement).
 *
 * `existing coverage`: `tests/side-pots.test.ts`'s "classic split" case already
 * exercises `PROPORTIONAL` end to end on a TWO-pot hand; this file's job is
 * `MAIN_POT_FIRST` end to end (not covered anywhere), the two allocations compared on
 * the SAME hand, the rake cap, the fee-alongside-rake interaction, and the
 * ADR-0025 "main pot nets zero" consequence, none of which existing tests cover.
 */
import { describe, expect, it } from 'vitest';
import { Money, type MilliBB } from '@gto-self/shared';
import { allIn, call, dealBoard, fold, raiseTo } from '../src/commands.js';
import type { HandCommand } from '../src/commands.js';
import type { EventOf, HandEvent } from '../src/events.js';
import { foldEvents } from '../src/reduce.js';
import { BB, NO_ANTE_PRESET, buildTable, cards, ids, start } from '../src/testing.js';
import { step } from './_helpers.js';
import type { TableConfig } from '../src/config.js';
import type { SeatIndex } from '../src/seat.js';

/** Narrows a mixed event log down to `POT_AWARDED` events, cleanly typed (no MilliBB/-1 unions). */
function potAwards(events: readonly HandEvent[]): readonly EventOf<'POT_AWARDED'>[] {
  return events.filter((e): e is EventOf<'POT_AWARDED'> => e.kind === 'POT_AWARDED');
}

/**
 * The same three-pot hand as `multiway-awards.test.ts`: UTG 10 BB, HJ 30 BB, CO 60 BB
 * all-in, BTN calls 60 BB, SB/BB fold. Contribution total 161500, laid out as:
 *
 *   pot0 MAIN  41500  eligible [0,3,4,5]
 *   pot1 SIDE  60000  eligible [0,4,5]
 *   pot2 SIDE  60000  eligible [0,5]
 *
 * `config` is threaded through so each test can vary only `rake`/`fee`; nothing about
 * the action sequence or the resulting pot shape depends on it.
 */
function buildThreePotHand(config: TableConfig) {
  const f = ids();
  const table = buildTable({
    config,
    stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(10), 4: BB(30), 5: BB(60) },
    buttonSeat: 0,
  });
  let hand = start(table, f);
  hand = step(hand, allIn(), f); // UTG (3) jams 10 BB
  hand = step(hand, allIn(), f); // HJ (4) jams 30 BB
  hand = step(hand, allIn(), f); // CO (5) jams 60 BB
  hand = step(hand, call(), f); // BTN (0) calls 60 BB
  hand = step(hand, fold(), f); // SB (1)
  hand = step(hand, fold(), f); // BB (2)
  hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
  hand = step(hand, dealBoard(cards('2d')), f);
  hand = step(hand, dealBoard(cards('Js')), f);
  expect(hand.state.phase).toBe('AWAITING_AWARD');
  expect(hand.state.pots.map((p) => p.amount)).toEqual([41500, 60000, 60000]);
  return { hand, f };
}

/** Awards all three pots to the same trivial single-winner set, varying only what settlement does. */
function awardAll(fee: MilliBB | null = null): HandCommand {
  const seat3: SeatIndex = 3;
  const seat4: SeatIndex = 4;
  const seat5: SeatIndex = 5;
  return {
    kind: 'AWARD_POTS',
    awards: [
      { potIndex: 0, winners: [seat3] },
      { potIndex: 1, winners: [seat4] },
      { potIndex: 2, winners: [seat5] },
    ],
    fee,
  };
}

describe('rake.allocation on the same three-pot hand', () => {
  // gross 161500. raw = mulRatioQuantized(161500, 5, 100, 20, 'round'):
  //   161500 * 5 / (100 * 20) = 807500 / 2000 = 403.75 -> round -> 404 -> * 20 = 8080.
  // cap 8000, so rake = min(8080, 8000) = 8000 and the rake IS capped (raw > cap):
  // this hand doubles as the "rake caps" case the work package also asks for.
  const EXPECTED_RAKE = 8000;

  it('PROPORTIONAL floors each pot share of the capped total and gives the remainder to the main pot', () => {
    const { hand: base, f } = buildThreePotHand(NO_ANTE_PRESET);
    expect(NO_ANTE_PRESET.rake.allocation).toBe('PROPORTIONAL');
    const hand = step(base, awardAll(), f);

    expect(hand.state.totalRake).toBe(EXPECTED_RAKE);

    // floor(8000 * 41500 / 161500) = floor(332000000 / 161500) = floor(2055.72...) = 2055
    // floor(8000 * 60000 / 161500) = floor(480000000 / 161500) = floor(2972.13...) = 2972 (twice)
    // 2055 + 2972 + 2972 = 7999; the floor remainder of 1 goes to the main pot -> 2056.
    const awards = potAwards(hand.events);
    expect(awards.map((a) => a.rake)).toEqual([2056, 2972, 2972]);
    expect(Money.sum(awards.map((a) => a.rake))).toBe(EXPECTED_RAKE);

    // No pot charged more rake than it holds, and no pot's net goes negative.
    for (const a of awards) {
      expect(a.rake).toBeLessThanOrEqual(a.grossAmount);
      expect(a.netAmount).toBeGreaterThanOrEqual(0);
      expect(a.netAmount).toBe(a.grossAmount - a.rake - a.fee);
    }
    expect(awards.map((a) => a.netAmount)).toEqual([41500 - 2056, 60000 - 2972, 60000 - 2972]);
  });

  it('MAIN_POT_FIRST drains the whole capped rake from the main pot upward', () => {
    const config: TableConfig = {
      ...NO_ANTE_PRESET,
      rake: { ...NO_ANTE_PRESET.rake, allocation: 'MAIN_POT_FIRST' },
    };
    const { hand: base, f } = buildThreePotHand(config);
    const hand = step(base, awardAll(), f);

    expect(hand.state.totalRake).toBe(EXPECTED_RAKE);

    // The main pot (41500) comfortably absorbs the whole 8000; nothing spills to the sides.
    const awards = potAwards(hand.events);
    expect(awards.map((a) => a.rake)).toEqual([8000, 0, 0]);
    expect(Money.sum(awards.map((a) => a.rake))).toBe(EXPECTED_RAKE);
    expect(awards.map((a) => a.netAmount)).toEqual([41500 - 8000, 60000, 60000]);

    for (const a of awards) {
      expect(a.rake).toBeLessThanOrEqual(a.grossAmount);
      expect(a.netAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it('the two allocations charge the same total but different per-pot amounts, both summing exactly', () => {
    const proportional = step(buildThreePotHand(NO_ANTE_PRESET).hand, awardAll(), ids());
    const mainPotFirst = step(
      buildThreePotHand({
        ...NO_ANTE_PRESET,
        rake: { ...NO_ANTE_PRESET.rake, allocation: 'MAIN_POT_FIRST' },
      }).hand,
      awardAll(),
      ids(),
    );
    expect(proportional.state.totalRake).toBe(mainPotFirst.state.totalRake);
    const perPot = (h: typeof proportional) => potAwards(h.events).map((e) => e.rake);
    expect(perPot(proportional)).not.toEqual(perPot(mainPotFirst));
    expect(Money.sum(perPot(proportional))).toBe(EXPECTED_RAKE);
    expect(Money.sum(perPot(mainPotFirst))).toBe(EXPECTED_RAKE);
  });
});

describe('ADR-0025: MAIN_POT_FIRST can zero out the main pot winner', () => {
  it('takes the whole (tiny) main pot and leaves its winner a net of ZERO — this is documented policy, not a bug', () => {
    // A dedicated hand shaped like ADR-0025's own example: UTG is all-in for a sliver
    // (0.6 BB, below even the big blind) while HJ/CO/BTN each commit their WHOLE 100 BB
    // stack, building a huge side pot. Everyone but UTG must go fully all-in (not just
    // call a smaller raise) so that nobody is left with chips behind — otherwise the
    // hand would need real postflop betting instead of the automatic all-in runout.
    //
    // UTG (3) has 600 milliBB and simply calls the big blind for all it has (short
    // call, clamped). HJ (4) shoves its whole 100 BB stack; CO (5) and BTN (0) call it,
    // using their whole stacks too. SB/BB fold.
    //
    // Levels: SB 500 (folded), BB 1000 (folded), UTG 600, HJ/CO/BTN 100000. Layers
    // 500 and 600 share eligible set [0,3,4,5] and merge into the main pot; layers 1000
    // and 100000 share eligible set [0,4,5] and merge into the side pot:
    //   pot0 MAIN  500 + 100*5 + 4*100          = 3500     eligible [0,3,4,5]
    //     (each of the 4 non-folded seats contributes 600 to reach this layer level;
    //     the folded SB's own 500 is capped below 600 and funds it without eligibility.)
    //   pot1 SIDE  (BB's dead 400 to reach 1000) + 3*99000 = 400 + 297000 = 298600
    //     eligible [0,4,5] (UTG is capped out at 600 and is NOT eligible here; BB's
    //     dead money funds the layer but, being folded, confers no eligibility either).
    // Total 302100 == 500 + 1000 + 600 + 100000*3, the sum of every total contribution.
    const config: TableConfig = {
      ...NO_ANTE_PRESET,
      rake: { ...NO_ANTE_PRESET.rake, allocation: 'MAIN_POT_FIRST' },
    };
    const f = ids();
    const table = buildTable({
      config,
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: Money.mbb(600), 4: BB(100), 5: BB(100) },
      buttonSeat: 0,
    });
    let hand = start(table, f);
    hand = step(hand, call(), f); // UTG (3): short call, clamped to its 600 milliBB stack
    hand = step(hand, allIn(), f); // HJ (4) shoves its whole 100 BB stack
    hand = step(hand, call(), f); // CO (5) calls with its whole stack (all-in)
    hand = step(hand, call(), f); // BTN (0) calls with its whole stack (all-in)
    hand = step(hand, fold(), f); // SB (1)
    hand = step(hand, fold(), f); // BB (2)
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    expect(hand.state.phase).toBe('AWAITING_AWARD');

    const pots = hand.state.pots;
    expect(pots).toHaveLength(2);
    const mainPot = pots[0];
    const sidePot = pots[1];
    expect(mainPot).toBeDefined();
    expect(sidePot).toBeDefined();
    if (mainPot === undefined || sidePot === undefined) return;
    expect(mainPot.amount).toBe(3500);
    expect(sidePot.amount).toBe(298600);
    // Independently re-derived: total contributed is 500+1000+600+100000*3 = 302100.
    expect(mainPot.amount + sidePot.amount).toBe(302100);
    // The main pot is tiny (every seat capped at UTG's 600) next to the huge side pot.
    expect(mainPot.amount).toBeLessThan(4000);
    expect(sidePot.amount).toBeGreaterThan(290000);

    // gross 302100 -> raw = mulRatioQuantized(302100,5,100,20,'round'):
    //   302100 * 5 / (100 * 20) = 1510500 / 2000 = 755.25 -> round -> 755 -> * 20 = 15100.
    // cap 8000, so rake = min(15100, 8000) = 8000. The cap alone already exceeds the
    // main pot's own 3500, which is exactly what makes the ADR-0025 consequence bite.
    const expectedRake = 8000;

    hand = step(
      hand,
      {
        kind: 'AWARD_POTS',
        awards: [
          { potIndex: mainPot.index, winners: [3] },
          { potIndex: sidePot.index, winners: [4] },
        ],
      },
      f,
    );
    expect(hand.state.totalRake).toBe(expectedRake);

    const awards = potAwards(hand.events);
    const mainAward = awards.find((a) => a.potIndex === mainPot.index);
    const sideAward = awards.find((a) => a.potIndex === sidePot.index);
    expect(mainAward).toBeDefined();
    expect(sideAward).toBeDefined();
    if (mainAward === undefined || sideAward === undefined) return;

    // MAIN_POT_FIRST drains the whole rake from pot0 upward. Since expectedRake
    // (8000) exceeds the main pot's own amount (3500), the main pot's entire amount is
    // taken as rake and its winner nets ZERO; the remainder (4500) spills into the side
    // pot, which comfortably absorbs it out of its 298600.
    expect(mainAward.rake).toBe(mainAward.grossAmount);
    expect(mainAward.netAmount).toBe(0);
    expect(mainAward.shares).toEqual([{ seat: 3, amount: 0 }]);
    expect(sideAward.rake).toBe(expectedRake - mainAward.grossAmount);
    expect(sideAward.netAmount).toBe(sideAward.grossAmount - sideAward.rake);
    expect(sideAward.netAmount).toBeGreaterThan(0);

    // UTG staked its entire 600 milliBB stack and walks away with exactly ZERO net —
    // it loses its whole (tiny) stack to rake even though it never lost a hand. This
    // is `allocateRake`'s stated MAIN_POT_FIRST consequence (ADR-0025 / rake.ts
    // comment), asserted here as intended behaviour, not patched around.
    expect(hand.state.seats[3].stack).toBe(0);
    expect(hand.state.seats[3].stack - hand.state.seats[3].startingStack).toBe(-600);

    // Invariants still hold even in this degenerate allocation.
    expect(Money.sum([mainAward.rake, sideAward.rake])).toBe(expectedRake);
    expect(mainAward.rake).toBeLessThanOrEqual(mainAward.grossAmount);
    expect(sideAward.rake).toBeLessThanOrEqual(sideAward.grossAmount);
  });
});

describe('NO_FLOP_NO_DROP waives the rake entirely', () => {
  it('produces an all-zero allocation on a preflop fold-out, and every invariant still holds', () => {
    // The waiver can only be observed on a hand that ends WITHOUT a flop, which in
    // this engine means everyone folds to one contender preflop (any hand that reaches
    // a multi-way showdown has, by construction, already had the board dealt). So this
    // case is necessarily single-pot; the multi-pot cases above already cover
    // allocation across several pots with a non-zero rake.
    expect(NO_ANTE_PRESET.rake.triggerPolicy).toBe('NO_FLOP_NO_DROP');
    const f = ids();
    const hand0 = start(
      buildTable({
        config: NO_ANTE_PRESET,
        stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
        buttonSeat: 0,
      }),
      f,
    );
    let hand = step(hand0, raiseTo(BB(3)), f); // UTG opens to 3 BB
    hand = step(hand, fold(), f); // HJ
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB
    hand = step(hand, fold(), f); // BB folds too: UTG wins uncontested, preflop only

    expect(hand.state.phase).toBe('COMPLETE');
    expect(hand.state.board).toHaveLength(0); // no flop was ever dealt
    expect(hand.state.totalRake).toBe(0);

    // UTG's raise to 3 BB is unmatched: the top current-street contribution (3000) minus
    // the second-highest (BB's own 1000, counted even though BB later folds) is returned
    // uncalled before the pot is ever formed, per `computeUncalledReturn`.
    const returned = hand.events.find((e) => e.kind === 'RETURN_UNCALLED');
    expect(returned).toMatchObject({ seat: 3, amount: 2000 });

    const award = hand.events.find((e) => e.kind === 'POT_AWARDED');
    expect(award?.kind).toBe('POT_AWARDED');
    if (award?.kind !== 'POT_AWARDED') return;
    expect(award.rake).toBe(0);
    expect(award.fee).toBe(0);
    // 500 (SB) + 1000 (BB) + 1000 (UTG's raise, net of the 2000 returned uncalled) =
    // 2500, entirely net since rake is waived.
    expect(award.grossAmount).toBe(2500);
    expect(award.netAmount).toBe(2500);

    for (let length = 1; length <= hand.events.length; length += 1) {
      const s = foldEvents(hand.events.slice(0, length));
      const seats = s.dealtInSeats;
      const started = seats.reduce<number>((sum, seat) => sum + s.seats[seat].startingStack, 0);
      const behind = seats.reduce<number>((sum, seat) => sum + s.seats[seat].stack, 0);
      const live = s.pots.filter((p) => !p.awarded).reduce((sum, p) => sum + p.amount, 0);
      expect(behind + live + s.totalRake + s.totalFees).toBe(started);
    }
  });
});

describe('a manual fee alongside rake, recorded separately, on the same three-pot hand', () => {
  it('splits rake and fee independently, each summing exactly, with no pot over-charged', () => {
    const config: TableConfig = {
      ...NO_ANTE_PRESET,
      fee: { triggerPolicy: 'MANUAL', cap: Money.mbb(8000), allocation: 'PROPORTIONAL' },
    };
    const { hand: base, f } = buildThreePotHand(config);
    const FEE = Money.mbb(1000);
    const hand = step(base, awardAll(FEE), f);

    // Rake is exactly as in the plain PROPORTIONAL case above: 8000 total,
    // [2056, 2972, 2972] per pot.
    expect(hand.state.totalRake).toBe(8000);
    expect(hand.state.totalFees).toBe(1000);

    // Fee is allocated with the SAME proportional algorithm, weighted by the pots'
    // GROSS amounts (not their rake-reduced ceilings):
    //   floor(1000 * 41500 / 161500) = floor(41500000 / 161500) = floor(256.96...) = 256
    //   floor(1000 * 60000 / 161500) = floor(60000000 / 161500) = floor(371.51...) = 371 (twice)
    // 256 + 371 + 371 = 998; the remainder of 2 goes to the main pot -> 258.
    const awards = potAwards(hand.events);
    expect(awards.map((a) => a.fee)).toEqual([258, 371, 371]);
    expect(Money.sum(awards.map((a) => a.fee))).toBe(1000);
    expect(awards.map((a) => a.rake)).toEqual([2056, 2972, 2972]);

    for (const a of awards) {
      // rake and fee are two SEPARATE deductions; neither pot is charged more than it
      // holds by their sum, and net is exactly gross - rake - fee.
      expect(a.rake + a.fee).toBeLessThanOrEqual(a.grossAmount);
      expect(a.netAmount).toBe(a.grossAmount - a.rake - a.fee);
      expect(a.netAmount).toBeGreaterThanOrEqual(0);
    }
    // 41500 - 2056 - 258 = 39186; 60000 - 2972 - 371 = 56657 (twice).
    expect(awards.map((a) => a.netAmount)).toEqual([39186, 56657, 56657]);
    expect(Money.sum(awards.map((a) => a.netAmount))).toBe(161500 - 8000 - 1000);
  });
});
