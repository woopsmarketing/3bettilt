/**
 * Postflop spot classification and the range model.
 *
 * `classifyPostflopSpot` contains no strategy, so these tests are all about whether the line is
 * described correctly. `buildPostflopRanges` is the seam onto A3's propagation, so its tests are
 * about reuse (a preflop table edit must move the postflop ranges), card removal, and the
 * honesty flags.
 */
import { describe, expect, it } from 'vitest';
import { classifyPostflopSpot, potTypeOf, previousStreetOf } from './spot.js';
import { buildPostflopRanges, primaryVillainOf, type PostflopSeatRange } from './ranges.js';
import {
  bet,
  call,
  check,
  fold,
  makePostflopQuery,
  pfCall,
  pfFold,
  pfRaise,
  raise,
  shove,
  type PostflopActionSpec,
} from './testQuery.js';
import { emptyRange, totalWeightBps, weightAt } from '../range/weights.js';
import { comboIndexOf } from '../range/combo.js';
import { parseCards } from '@gto-self/shared';
import { policyRangeFor } from '../preflop/propagate.js';

/** BTN opens, BB calls: the reference single-raised pot every fixture below starts from. */
const SRP: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfFold('SB'),
  pfCall('BB', 2.5),
];

/** BTN opens, SB and BB both call: the three-way version. */
const SRP_3WAY: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfCall('SB', 2.5),
  pfCall('BB', 2.5),
];

const flop = (
  hero: 'BTN' | 'BB' | 'SB',
  actions: readonly PostflopActionSpec[],
  heroCards = 'AcQs',
  base: readonly PostflopActionSpec[] = SRP,
) =>
  makePostflopQuery({
    hero,
    street: 'FLOP',
    board: 'Ah7d2c',
    heroCards,
    actions: [...base, ...actions],
  });

describe('classifyPostflopSpot — families', () => {
  it('calls it a CBET when hero raised preflop and the flop is checked to hero', () => {
    const spot = classifyPostflopSpot(flop('BTN', [check('FLOP', 'BB')]));
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('CBET');
    expect(spot.heroHadInitiative).toBe(true);
    expect(spot.checksBeforeHero).toBe(1);
    expect(spot.previousStreetAggressor).toBe('BTN');
  });

  it('calls it a PROBE when hero did not have the initiative', () => {
    const spot = classifyPostflopSpot(flop('BB', [], 'KdQd'));
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('PROBE');
    expect(spot.heroHadInitiative).toBe(false);
    expect(spot.previousStreetAggressor).toBe('BTN');
  });

  it('calls it a PROBE, not a DELAYED_CBET, once the initiative was given up on a whole street', () => {
    // BTN raised preflop but checked the flop back, so the TURN's previous street (the flop)
    // has no aggressor at all and nobody holds the initiative into it.
    const query = makePostflopQuery({
      hero: 'BTN',
      street: 'TURN',
      board: 'Ah7d2c9s',
      heroCards: 'AcQs',
      actions: [
        ...SRP,
        check('FLOP', 'BB'),
        check('FLOP', 'BTN'),
        check('TURN', 'BB'),
        check('TURN', 'BTN'),
      ],
    });
    const spot = classifyPostflopSpot(query);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    // The previous street (the flop) had no aggressor, so hero does not hold the initiative.
    expect(spot.previousStreetAggressor).toBeNull();
    expect(spot.family).toBe('PROBE');
    expect(spot.heroHasActedThisStreet).toBe(true);
  });

  it('calls it a DELAYED_CBET when hero holds the initiative and has already acted', () => {
    const query = makePostflopQuery({
      hero: 'BTN',
      street: 'TURN',
      board: 'Ah7d2c9s',
      heroCards: 'AcQs',
      actions: [
        ...SRP,
        check('FLOP', 'BB'),
        bet('FLOP', 'BTN', 2),
        call('FLOP', 'BB', 2),
        check('TURN', 'BB'),
        check('TURN', 'BTN'),
      ],
    });
    const spot = classifyPostflopSpot(query);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.previousStreetAggressor).toBe('BTN');
    expect(spot.family).toBe('DELAYED_CBET');
  });

  it('calls it FACING_BET when exactly one aggression stands this street', () => {
    const spot = classifyPostflopSpot(flop('BTN', [bet('FLOP', 'BB', 2.75)]));
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('FACING_BET');
    expect(spot.streetAggressionCount).toBe(1);
    expect(spot.currentStreetAggressor).toBe('BB');
    expect(spot.facingBet).toBe(true);
  });

  it('calls it FACING_RAISE when two aggressions stand this street', () => {
    const spot = classifyPostflopSpot(
      flop('BTN', [check('FLOP', 'BB'), bet('FLOP', 'BTN', 2), raise('FLOP', 'BB', 7)]),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('FACING_RAISE');
    expect(spot.streetAggressionCount).toBe(2);
    expect(spot.heroIsCurrentStreetAggressor).toBe(false);
  });

  it('calls it FACING_ALL_IN when the standing aggression is a shove', () => {
    const spot = classifyPostflopSpot(flop('BTN', [shove('FLOP', 'BB', 97.5)]));
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('FACING_ALL_IN');
    expect(spot.facingAllIn).toBe(true);
  });

  it('reports IP / OOP from the live opponents, not from the seat name', () => {
    const ip = classifyPostflopSpot(flop('BTN', [check('FLOP', 'BB')]));
    const oop = classifyPostflopSpot(flop('BB', [], 'KdQd'));
    expect(ip.kind === 'SPOT' && ip.heroRelativePosition).toBe('IP');
    expect(oop.kind === 'SPOT' && oop.heroRelativePosition).toBe('OOP');
  });

  it('counts only the checks that came after the last aggression', () => {
    const spot = classifyPostflopSpot(flop('BTN', [check('FLOP', 'BB')], 'AcQs', SRP_3WAY));
    expect(spot.kind === 'SPOT' && spot.checksBeforeHero).toBe(1);
    const both = classifyPostflopSpot(
      flop('BTN', [check('FLOP', 'SB'), check('FLOP', 'BB')], 'AcQs', SRP_3WAY),
    );
    expect(both.kind === 'SPOT' && both.checksBeforeHero).toBe(2);
  });

  it('measures the faced bet as a fraction of the pot BEFORE that bet', () => {
    // SRP pot is 5.5bb (2.5 + 2.5 + the folded SB's 0.5). A 2.75bb bet is exactly half of it.
    const spot = classifyPostflopSpot(flop('BTN', [bet('FLOP', 'BB', 2.75)]));
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.facedBetFractionOfPot).toBeCloseTo(0.5, 10);
  });

  // R1B MAJOR-4(b): `callAmount / (potBeforeDecision - callAmount)` is the faced bet only when
  // hero has nothing in on the street AND nobody has called between the bettor and hero. The
  // two cases below are the review's counterexamples, rebuilt on this file's fixtures.
  it('measures a RAISE over hero own bet against the pot before the raise, not hero price', () => {
    // SRP pot 5500. Hero (BTN) bets 3000; BB raises to 9000 into a pot of 8500 = 1.06x pot.
    // The old formula read hero's 6000 call against 11500 = 0.52 and called it SMALL.
    const spot = classifyPostflopSpot(
      flop('BTN', [check('FLOP', 'BB'), bet('FLOP', 'BTN', 3), raise('FLOP', 'BB', 9)]),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('FACING_RAISE');
    expect(spot.facedBetFractionOfPot).toBeCloseTo(9000 / 8500, 10);
    expect(spot.facedBetFractionOfPot ?? 0).toBeGreaterThan(1);
  });

  it('measures a bet that has already been called against the pot before the bet', () => {
    // 3-way SRP pot 7500. SB bets 5000 (0.667x pot), BB calls, hero (BTN) is last to act. The
    // old formula diluted the bet by the caller's chips: 5000 / 12500 = 0.4.
    const spot = classifyPostflopSpot(
      flop('BTN', [bet('FLOP', 'SB', 5), call('FLOP', 'BB', 5)], 'AcQs', SRP_3WAY),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.facedBetFractionOfPot).toBeCloseTo(5000 / 7500, 10);
  });

  it('reports no faced fraction when hero is not facing a bet', () => {
    const spot = classifyPostflopSpot(flop('BTN', [check('FLOP', 'BB')]));
    expect(spot.kind === 'SPOT' && spot.facedBetFractionOfPot).toBeNull();
  });
});

describe('classifyPostflopSpot — pot type', () => {
  it('reads the pot type off the preflop aggression count', () => {
    expect(potTypeOf([])).toBe('LIMPED');
    const q = flop('BTN', [check('FLOP', 'BB')]);
    expect(potTypeOf(q.actions)).toBe('SINGLE_RAISED');
  });

  it('names a 3-bet pot and a 4-bet pot', () => {
    const threeBet = makePostflopQuery({
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [
        pfFold('UTG'),
        pfFold('HJ'),
        pfFold('CO'),
        pfRaise('BTN', 2.5),
        pfFold('SB'),
        pfRaise('BB', 10),
        pfCall('BTN', 10),
        check('FLOP', 'BB'),
      ],
    });
    expect(potTypeOf(threeBet.actions)).toBe('THREE_BET');
    const fourBet = makePostflopQuery({
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [
        pfFold('UTG'),
        pfFold('HJ'),
        pfFold('CO'),
        pfRaise('BTN', 2.5),
        pfFold('SB'),
        pfRaise('BB', 10),
        pfRaise('BTN', 23),
        pfCall('BB', 23),
        check('FLOP', 'BB'),
      ],
    });
    expect(potTypeOf(fourBet.actions)).toBe('FOUR_BET_PLUS');
  });
});

describe('classifyPostflopSpot — refusals', () => {
  it('refuses a preflop query', () => {
    const query = { ...flop('BTN', [check('FLOP', 'BB')]), street: 'PREFLOP' as const };
    const spot = classifyPostflopSpot(query);
    expect(spot.kind === 'UNSUPPORTED' && spot.reason).toBe('NOT_POSTFLOP');
  });

  it('refuses a board with the wrong card count for the street', () => {
    const query = { ...flop('BTN', [check('FLOP', 'BB')]), street: 'TURN' as const };
    const spot = classifyPostflopSpot(query);
    expect(spot.kind === 'UNSUPPORTED' && spot.reason).toBe('BOARD_CARD_COUNT');
  });

  it('refuses a hand with nobody left to play against', () => {
    const query = { ...flop('BTN', [check('FLOP', 'BB')]), activeOpponentCount: 0 };
    const spot = classifyPostflopSpot(query);
    expect(spot.kind === 'UNSUPPORTED' && spot.reason).toBe('NO_ACTIVE_OPPONENT');
  });

  it('refuses a decision point the engine offers no action at', () => {
    const base = flop('BTN', [check('FLOP', 'BB')]);
    const query = {
      ...base,
      legalActions: {
        ...base.legalActions,
        canFold: false,
        canCheck: false,
        call: null,
        wager: null,
        allIn: null,
      },
    };
    const spot = classifyPostflopSpot(query);
    expect(spot.kind === 'UNSUPPORTED' && spot.reason).toBe('NO_LEGAL_ACTION');
  });

  it('names the previous street correctly', () => {
    expect(previousStreetOf('PREFLOP')).toBeNull();
    expect(previousStreetOf('FLOP')).toBe('PREFLOP');
    expect(previousStreetOf('TURN')).toBe('FLOP');
    expect(previousStreetOf('RIVER')).toBe('TURN');
  });
});

describe('buildPostflopRanges', () => {
  it('reuses A3 propagation: the villain range is the preflop policy s calling range', () => {
    const model = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    expect(model.ok).toBe(true);
    if (!model.ok) return;
    // The BB called a BTN open, so 100%-3-bet hands (QQ+, AKs, AKo per A3's tables) must be
    // absent from the BB's range. `QhQd` is one of them.
    const cards = parseCards('QhQd');
    expect(cards.ok).toBe(true);
    if (!cards.ok) return;
    const [qh, qd] = cards.value;
    if (qh === undefined || qd === undefined) return;
    const bb = model.value.villains.find((seat) => seat.position === 'BB');
    expect(bb).toBeDefined();
    expect(weightAt(bb?.range ?? model.value.hero.range, comboIndexOf(qh, qd))).toBe(0);
  });

  it("removes the board and hero's cards from every villain range", () => {
    const model = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    expect(model.ok).toBe(true);
    if (!model.ok) return;
    const cards = parseCards('AcQsAh7d2c');
    expect(cards.ok).toBe(true);
    if (!cards.ok) return;
    const bb = model.value.villains[0];
    expect(bb).toBeDefined();
    if (bb === undefined) return;
    for (const known of cards.value) {
      for (const other of cards.value) {
        if (known === other) continue;
        expect(weightAt(bb.range, comboIndexOf(known, other))).toBe(0);
      }
    }
  });

  it("keeps hero's own cards in hero's own range but removes the board from it", () => {
    const model = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    expect(model.ok).toBe(true);
    if (!model.ok) return;
    const cards = parseCards('AcQsAh7d');
    expect(cards.ok).toBe(true);
    if (!cards.ok) return;
    const [ac, qs, ah, sevenD] = cards.value;
    if (ac === undefined || qs === undefined || ah === undefined || sevenD === undefined) return;
    expect(weightAt(model.value.hero.range, comboIndexOf(ac, qs))).toBeGreaterThan(0);
    expect(weightAt(model.value.hero.range, comboIndexOf(ah, sevenD))).toBe(0);
  });

  it("hero's flop range equals the preflop policy's raise range for the spot, minus the board", () => {
    const model = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    expect(model.ok).toBe(true);
    if (!model.ok) return;
    const rfi = policyRangeFor(
      {
        family: 'RFI',
        unsupportedReason: null,
        heroPosition: 'BTN',
        openerPosition: null,
        heroVsAggressor: null,
        blindVsBlind: false,
        limperCount: 0,
        coldCallerCount: 0,
        lineupSize: 6,
        potOdds: null,
        facingAllIn: false,
      },
      'RAISE',
    );
    // Every combo hero can still hold must have exactly the RFI weight; nothing extra appears.
    for (let combo = 0; combo < 1326; combo += 1) {
      const hero = model.value.hero.range.bps[combo] ?? 0;
      const reference = rfi.bps[combo] ?? 0;
      expect(hero === 0 || hero === reference).toBe(true);
    }
    expect(totalWeightBps(model.value.hero.range)).toBeGreaterThan(0);
  });

  it('drops seats that folded, preflop or postflop', () => {
    const threeWay = buildPostflopRanges(
      flop('BTN', [check('FLOP', 'SB'), check('FLOP', 'BB')], 'AcQs', SRP_3WAY),
    );
    expect(threeWay.ok).toBe(true);
    if (!threeWay.ok) return;
    expect(threeWay.value.villains.map((seat) => seat.position)).toEqual(['SB', 'BB']);

    const afterFlopFold = buildPostflopRanges(
      makePostflopQuery({
        hero: 'BTN',
        street: 'TURN',
        board: 'Ah7d2c9s',
        heroCards: 'AcQs',
        actions: [
          ...SRP_3WAY,
          check('FLOP', 'SB'),
          check('FLOP', 'BB'),
          bet('FLOP', 'BTN', 2),
          fold('FLOP', 'SB'),
          call('FLOP', 'BB', 2),
          check('TURN', 'BB'),
        ],
      }),
    );
    expect(afterFlopFold.ok).toBe(true);
    if (!afterFlopFold.ok) return;
    expect(afterFlopFold.value.villains.map((seat) => seat.position)).toEqual(['BB']);
  });

  it('never narrows a range by a postflop action, and says how many it skipped', () => {
    const model = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    const withBet = buildPostflopRanges(flop('BTN', [bet('FLOP', 'BB', 2.75)]));
    expect(model.ok && withBet.ok).toBe(true);
    if (!model.ok || !withBet.ok) return;
    expect(model.value.narrowingApplied).toBe(false);
    expect(withBet.value.narrowingApplied).toBe(false);
    expect(model.value.postflopActionCount).toBe(1);
    expect(model.value.postflopAggressionCount).toBe(0);
    expect(withBet.value.postflopAggressionCount).toBe(1);
    // The BB's range is byte-identical whether the BB checked or bet: that IS the decision.
    const a = model.value.villains[0]?.range.bps ?? new Uint16Array();
    const b = withBet.value.villains[0]?.range.bps ?? new Uint16Array();
    expect([...a]).toEqual([...b]);
  });

  it('refuses a preflop query and a hand with no live opponent', () => {
    const preflop = buildPostflopRanges({
      ...flop('BTN', [check('FLOP', 'BB')]),
      street: 'PREFLOP',
    });
    expect(preflop.ok).toBe(false);
    if (preflop.ok) return;
    expect(preflop.error.code).toBe('NOT_A_DECISION_POINT');

    const alone = buildPostflopRanges({
      ...flop('BTN', [check('FLOP', 'BB')]),
      activeOpponentCount: 0,
    });
    expect(alone.ok).toBe(false);
  });

  it('is deterministic', () => {
    const a = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    const b = buildPostflopRanges(flop('BTN', [check('FLOP', 'BB')]));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect([...(a.value.villains[0]?.range.bps ?? [])]).toEqual([
      ...(b.value.villains[0]?.range.bps ?? []),
    ]);
  });
});

describe('primaryVillainOf', () => {
  const seat = (position: 'SB' | 'BB' | 'CO'): PostflopSeatRange =>
    ({
      position,
      isHero: false,
      status: 'IN_HAND',
      range: emptyRange(),
      totalWeightBps: 0,
      preflopActionKinds: [],
      offPolicy: false,
      degenerate: false,
    }) as PostflopSeatRange;

  it('prefers the current street aggressor', () => {
    expect(primaryVillainOf([seat('SB'), seat('BB')], 'BB', 'SB').position).toBe('BB');
  });

  it('falls back to the previous street aggressor', () => {
    expect(primaryVillainOf([seat('SB'), seat('BB')], null, 'BB').position).toBe('BB');
  });

  it('falls back to the first live opponent in postflop order', () => {
    expect(primaryVillainOf([seat('SB'), seat('BB')], null, null).position).toBe('SB');
  });

  it('ignores an aggressor who is no longer live', () => {
    expect(primaryVillainOf([seat('SB'), seat('BB')], 'CO', null).position).toBe('SB');
  });
});
