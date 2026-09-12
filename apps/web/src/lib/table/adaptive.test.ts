// @vitest-environment node
/**
 * The composition seam, end to end, against the REAL engine.
 *
 * Every spot below is a real `HandState` played through `poker-core`'s own constructors and
 * evaluated through the real `computeStrategy`. Nothing hand-builds a `StrategyPanelReady`
 * literal for the main cases, deliberately: the whole point of this file is that the facts
 * `strategy.ts` extracts line up with what the engine actually said, and a fixture that
 * asserted against a literal would only prove the literal agrees with itself.
 *
 * The FIRST test is the one that matters most. WP-J design contract §1 and §10 row 1: one
 * `HandState`, two completely different opponent data sets, REFERENCE byte-identical both
 * times, ADAPTIVE different. This is that property at the app layer, where the two calls
 * actually meet.
 */
import { describe, expect, it } from 'vitest';
import { asId, Money, parseCards, sequentialIdFactory, unwrap } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import {
  applyCommands,
  betTo,
  call,
  createTable,
  CP_NL50_6MAX_NO_ANTE,
  dealBoard,
  fold,
  raiseTo,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  setHoleCards,
  startHand,
  type HandCommand,
  type HandState,
  type SeatIndex,
} from '@gto-self/poker-core';
import {
  buildStrategyQuery,
  POT_FRACTION_BUCKETS,
  recommendPostflop,
} from '@gto-self/strategy-core';
import type { AdaptiveStatKey } from '@gto-self/adaptive-core';
import { computeStrategy, type StrategyPanelModel, type StrategyPanelReady } from './strategy.js';
import { buildAdaptiveBaseline, computeAdaptive, opponentInputFromWire } from './adaptive.js';
import type { AdaptiveOpponentInputWire } from './contract.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Six 100 BB stacks, button on seat 0 — the same seating `strategy-core`'s own adapter
 * fixtures use, so a spot named here means the same thing there:
 *
 *   seat 0 = BTN   seat 1 = SB   seat 2 = BB   seat 3 = UTG   seat 4 = HJ   seat 5 = CO
 *
 * Preflop order is UTG(3) -> HJ(4) -> CO(5) -> BTN(0) -> SB(1) -> BB(2); postflop order is
 * SB(1) -> BB(2) -> UTG(3) -> HJ(4) -> CO(5) -> BTN(0).
 */
function sixHanded(heroSeat: SeatIndex, commands: readonly HandCommand[]): HandState {
  let table = unwrap(createTable(CP_NL50_6MAX_NO_ANTE));
  for (const seat of [0, 1, 2, 3, 4, 5] as const) {
    table = unwrap(
      seatPlayer(table, seat, asId<'Player'>(`p${seat}`) as PlayerId, Money.fromBB(100)),
    );
  }
  table = unwrap(setButtonSeat(table, 0));
  table = unwrap(setHeroSeat(table, heroSeat));

  const ids = sequentialIdFactory('e');
  const started = unwrap(startHand(table, { handId: asId<'Hand'>('h1') }, ids));
  if (commands.length === 0) return started.state;
  return unwrap(applyCommands(started, commands, ids)).state;
}

/** `p<seat>` for every seat — the ids `sixHanded` seats, as `computeAdaptive` wants them. */
const SEAT_PLAYER_IDS: ReadonlyMap<number, string> = new Map(
  [0, 1, 2, 3, 4, 5].map((seat) => [seat, `p${seat}`]),
);

/** One learned-model reading for one opponent. Nothing else is supplied, so nothing else moves. */
function opponentWire(
  seatIndex: number,
  readings: readonly (readonly [AdaptiveStatKey, number, number])[],
): AdaptiveOpponentInputWire {
  return {
    playerId: `p${seatIndex}`,
    seatIndex,
    nickname: `nick-${seatIndex}`,
    observations: readings.map(([key, valueBps, sampleN]) => ({
      key,
      source: 'LEARNED_MODEL' as const,
      valueBps,
      sampleN,
      note: null,
    })),
    manualHudSnapshotId: null,
    manualHudRecordedAt: null,
    learnedSnapshotId: `model-p${seatIndex}`,
    learnedModelVersion: 1,
    externalHudSnapshotId: null,
    externalHudRecordedAt: null,
  };
}

/** Narrows to READY, failing the test rather than the type system when the engine refused. */
function ready(model: StrategyPanelModel): StrategyPanelReady {
  if (model.kind !== 'READY') {
    throw new Error(`expected a READY model, got ${model.kind}`);
  }
  return model;
}

/**
 * Hero on the flop as the preflop raiser, OUT OF POSITION, heads-up against the big blind.
 *
 * SB(1) is hero and opens; BB(2) calls; the flop comes A K 7 rainbow and hero holds two more
 * aces. Hero acts FIRST postflop, so the big blind is live, acts after hero, and is therefore
 * the PRIMARY villain — the arrangement every rule in the table is written about.
 */
const HERO_SB_FLOP_SET: SeatIndex = 1;
const heroSbFlopSet = (): HandState =>
  sixHanded(HERO_SB_FLOP_SET, [
    setHoleCards(HERO_SB_FLOP_SET, unwrap(parseCards('Ac Ad')), false),
    fold(), // UTG
    fold(), // HJ
    fold(), // CO
    fold(), // BTN
    raiseTo(Money.fromBB(3)), // SB — hero
    call(), // BB
    dealBoard(unwrap(parseCards('Ah Kd 7s'))),
  ]);

/**
 * Hero on the flop THREE-HANDED, facing a bet, with one live opponent still to act behind.
 *
 * CO(5) is hero and opens; BTN(0) calls; BB(2) calls; the big blind leads out on the flop.
 * Postflop order is BB(2)=1, CO(5)=4, BTN(0)=5, so the ordering facts have all three shapes in
 * one spot: a live seat behind hero, a live seat that already acted and made the last bet, and
 * three folded seats.
 */
const HERO_CO_FLOP_FACING_BET: SeatIndex = 5;
const heroCoFlopFacingBet = (): HandState =>
  sixHanded(HERO_CO_FLOP_FACING_BET, [
    setHoleCards(HERO_CO_FLOP_FACING_BET, unwrap(parseCards('Qh Jh')), false),
    fold(), // UTG
    fold(), // HJ
    raiseTo(Money.fromBB(3)), // CO — hero
    call(), // BTN
    fold(), // SB
    call(), // BB
    dealBoard(unwrap(parseCards('Th 9c 2d'))),
    betTo(Money.fromBB(4)), // BB leads
  ]);

/* -------------------------------------------------------------------------- */
/* §1 — the invariant this whole work package exists to protect                */
/* -------------------------------------------------------------------------- */

describe('REFERENCE is byte-identical whatever the player data is (design contract §1, §10.1)', () => {
  it('computes the same REFERENCE and a different ADAPTIVE for two opponent data sets', () => {
    const state = heroCoFlopFacingBet();

    // Two opponents that could not be more different, on the one stat that is in scope when
    // hero is facing a bet: how often the player who bet actually c-bets.
    const bettorAlwaysCbets = [opponentWire(2, [['CBET_FLOP', 10000, 1000]])];
    const bettorNeverCbets = [opponentWire(2, [['CBET_FLOP', 0, 1000]])];

    const referenceA = computeStrategy(state, HERO_CO_FLOP_FACING_BET);
    const adaptiveA = computeAdaptive(referenceA, bettorAlwaysCbets, SEAT_PLAYER_IDS);
    const referenceB = computeStrategy(state, HERO_CO_FLOP_FACING_BET);
    const adaptiveB = computeAdaptive(referenceB, bettorNeverCbets, SEAT_PLAYER_IDS);

    // REFERENCE: deep-equal AND byte-equal. The second assertion is the stronger one — a
    // reordered key or a `-0` would pass the first and fail this.
    expect(referenceA).toEqual(referenceB);
    expect(JSON.stringify(referenceA)).toBe(JSON.stringify(referenceB));

    // ADAPTIVE: genuinely different, from the same REFERENCE value.
    expect(adaptiveA).not.toBeNull();
    expect(adaptiveB).not.toBeNull();
    expect(JSON.stringify(adaptiveA)).not.toBe(JSON.stringify(adaptiveB));
    expect(adaptiveA?.status).toBe('ADAPTED');
    expect(adaptiveB?.status).toBe('ADAPTED');
    expect(adaptiveA?.adjustments.map((entry) => entry.ruleId)).toEqual(['VILLAIN_CBET_HIGH']);
    expect(adaptiveB?.adjustments.map((entry) => entry.ruleId)).toEqual(['VILLAIN_CBET_LOW']);

    // The mixes really move, and they move in opposite directions: a player who always bets is
    // bluffing more often, so hero continues more; a player who almost never bets has it, so
    // hero folds more.
    const deltaOf = (kind: string, model: typeof adaptiveA): number =>
      model?.actions.find((action) => action.kind === kind)?.deltaBps ?? 0;
    expect(adaptiveA?.changedFromBaseline).toBe(true);
    expect(adaptiveB?.changedFromBaseline).toBe(true);
    expect(deltaOf('FOLD', adaptiveA)).toBeLessThan(0);
    expect(deltaOf('FOLD', adaptiveB)).toBeGreaterThan(0);
    expect(deltaOf('CALL', adaptiveA)).toBeGreaterThan(0);
    expect(deltaOf('CALL', adaptiveB)).toBeLessThan(0);

    // And the baseline each one echoes is the SAME value, which is the invariant restated at
    // the layer where the two calls actually meet.
    expect(JSON.stringify(adaptiveA?.baseline)).toBe(JSON.stringify(adaptiveB?.baseline));
  });

  it('is deterministic: the same inputs produce the same bytes twice', () => {
    const state = heroSbFlopSet();
    const inputs = [opponentWire(2, [['WTSD', 8000, 500]])];
    const model = computeStrategy(state, HERO_SB_FLOP_SET);
    const first = computeAdaptive(model, inputs, SEAT_PLAYER_IDS);
    const second = computeAdaptive(model, inputs, SEAT_PLAYER_IDS);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

/* -------------------------------------------------------------------------- */
/* The facts `strategy.ts` extracts                                             */
/* -------------------------------------------------------------------------- */

describe('adaptiveFacts are READ off the engine, never re-derived', () => {
  it('carries the recommendation’s own scoring.aggressionBand.id', () => {
    const state = heroSbFlopSet();
    const panel = ready(computeStrategy(state, HERO_SB_FLOP_SET));

    // The same spot, straight through the engine, so the comparison is against the engine's
    // own value rather than against a number written into this file.
    const query = unwrap(buildStrategyQuery(state, { heroSeat: HERO_SB_FLOP_SET }));
    const recommendation = unwrap(recommendPostflop(query, {}));

    expect(panel.adaptiveFacts.aggressionBand).toBe(recommendation.scoring.aggressionBand.id);
    expect(panel.adaptiveFacts.aggressionBand).not.toBeNull();
  });

  it('has no aggression band preflop, where the engine authors none', () => {
    const state = sixHanded(3, [setHoleCards(3, unwrap(parseCards('Ac Ad')), false)]);
    const panel = ready(computeStrategy(state, 3));
    expect(panel.street).toBe('PREFLOP');
    expect(panel.adaptiveFacts.aggressionBand).toBeNull();
  });

  it('round-trips bucketIndex through POT_FRACTION_BUCKETS', () => {
    const panel = ready(computeStrategy(heroSbFlopSet(), HERO_SB_FLOP_SET));
    const sizing = panel.sizing;
    const index = panel.adaptiveFacts.bucketIndex;
    if (sizing === null || index === null) throw new Error('the fixture must produce a sizing');

    expect(index).toBeGreaterThanOrEqual(0);
    expect(POT_FRACTION_BUCKETS[index]?.percent).toBe(sizing.potFractionPercent);
    // The legal window travels with the size, so a moved rung can be proven legal.
    expect(sizing.minToAmountMbb).toBeLessThanOrEqual(sizing.toAmountMbb);
    expect(sizing.maxToAmountMbb).toBeGreaterThanOrEqual(sizing.toAmountMbb);
  });

  it('has no pot-fraction rung preflop, where sizing is a raise-TO rule', () => {
    const state = sixHanded(3, [setHoleCards(3, unwrap(parseCards('Ac Ad')), false)]);
    const panel = ready(computeStrategy(state, 3));
    expect(panel.sizing).not.toBeNull();
    expect(panel.sizing?.potFractionPercent).toBeNull();
    expect(panel.adaptiveFacts.bucketIndex).toBeNull();
  });
});

describe('heroIsPreflopOpener comes from the engine’s own PreflopSpotFamily', () => {
  it('is true for a real RFI', () => {
    // UTG, first to act, nobody in front. The canonical raise-first-in.
    const state = sixHanded(3, [setHoleCards(3, unwrap(parseCards('Ac Ad')), false)]);
    const panel = ready(computeStrategy(state, 3));
    expect(panel.family).toBe('RFI');
    expect(panel.adaptiveFacts.heroIsPreflopOpener).toBe(true);
  });

  it('is true for a folded-to small blind, which the engine classes RFI and not BLIND_VS_BLIND', () => {
    const state = sixHanded(1, [
      setHoleCards(1, unwrap(parseCards('Ac Ad')), false),
      fold(), // UTG
      fold(), // HJ
      fold(), // CO
      fold(), // BTN
    ]);
    const panel = ready(computeStrategy(state, 1));
    expect(panel.family).toBe('RFI');
    expect(panel.adaptiveFacts.heroIsPreflopOpener).toBe(true);
  });

  it('is FALSE for a big blind checking behind limpers — the case !heroFacingBet gets wrong', () => {
    const state = sixHanded(2, [
      setHoleCards(2, unwrap(parseCards('7c 2d')), false),
      call(), // UTG limps
      fold(), // HJ
      fold(), // CO
      fold(), // BTN
      fold(), // SB
    ]);
    const panel = ready(computeStrategy(state, 2));

    expect(panel.family).toBe('VS_LIMP');
    // The naive derivation would say "opening" here, because hero owes nothing.
    expect(panel.adaptiveFacts.heroFacingBet).toBe(false);
    expect(panel.adaptiveFacts.heroIsPreflopOpener).toBe(false);
  });

  it('is false postflop, where opening is not a question that exists', () => {
    const panel = ready(computeStrategy(heroSbFlopSet(), HERO_SB_FLOP_SET));
    expect(panel.street).toBe('FLOP');
    expect(panel.adaptiveFacts.heroIsPreflopOpener).toBe(false);
  });
});

describe('opponentOrderings are field reads off StrategyQuery', () => {
  it('names the live seat behind hero, the folded seats, and this street’s last aggressor', () => {
    const panel = ready(computeStrategy(heroCoFlopFacingBet(), HERO_CO_FLOP_FACING_BET));
    const orderings = panel.adaptiveFacts.opponentOrderings;

    // One row per non-hero dealt-in seat, hero excluded, six seats dealt in.
    expect(orderings.map((entry) => entry.seatIndex).sort()).toEqual([0, 1, 2, 3, 4]);

    const at = (seatIndex: number) => {
      const found = orderings.find((entry) => entry.seatIndex === seatIndex);
      if (found === undefined) throw new Error(`no ordering for seat ${seatIndex}`);
      return found;
    };

    // BTN(0) is the ONLY seat that acts after hero on the flop.
    expect(
      orderings.filter((entry) => entry.actsAfterHero).map((entry) => entry.seatIndex),
    ).toEqual([0]);
    expect(at(0).isLive).toBe(true);

    // SB(1), UTG(3) and HJ(4) folded preflop.
    for (const seat of [1, 3, 4]) expect(at(seat).isLive).toBe(false);

    // BB(2) is live, already acted, and made the bet hero is facing.
    expect(at(2).isLive).toBe(true);
    expect(at(2).actsAfterHero).toBe(false);
    expect(
      orderings.filter((entry) => entry.isLastAggressorThisStreet).map((entry) => entry.seatIndex),
    ).toEqual([2]);

    // Postflop action order, straight off `postflopOrder`: SB 0, BB 1, UTG 2, HJ 3, BTN 5.
    expect(at(1).actionOrderIndex).toBe(0);
    expect(at(2).actionOrderIndex).toBe(1);
    expect(at(0).actionOrderIndex).toBe(5);

    expect(panel.adaptiveFacts.heroFacingBet).toBe(true);
    expect(panel.adaptiveFacts.activeOpponentCount).toBe(2);
  });

  it('marks nobody the last aggressor on a street with no aggression yet', () => {
    const panel = ready(computeStrategy(heroSbFlopSet(), HERO_SB_FLOP_SET));
    expect(
      panel.adaptiveFacts.opponentOrderings.some((entry) => entry.isLastAggressorThisStreet),
    ).toBe(false);
    expect(panel.adaptiveFacts.heroFacingBet).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The seam itself                                                              */
/* -------------------------------------------------------------------------- */

describe('buildAdaptiveBaseline', () => {
  it('maps every baseline field off the panel model', () => {
    const panel = ready(computeStrategy(heroSbFlopSet(), HERO_SB_FLOP_SET));
    const built = buildAdaptiveBaseline(panel, SEAT_PLAYER_IDS);
    if (built === null) throw new Error('a supported spot must produce a baseline');

    expect(built.baseline.street).toBe(panel.street);
    expect(built.baseline.heroPosition).toBe(panel.heroPosition);
    expect(built.baseline.primaryKind).toBe(panel.primary.kind);
    expect(built.baseline.aggressionBand).toBe(panel.adaptiveFacts.aggressionBand);
    expect(built.baseline.actions.map((action) => action.kind)).toEqual(
      panel.actions.map((row) => row.kind),
    );
    expect(built.baseline.actions.map((action) => action.frequencyBps)).toEqual(
      panel.actions.map((row) => row.frequencyBps),
    );
    expect(built.baseline.sizing?.bucketIndex).toBe(panel.adaptiveFacts.bucketIndex);
    expect(built.baseline.sizing?.minToAmountMbb).toBe(panel.sizing?.minToAmountMbb);
    expect(built.baseline.sizing?.maxToAmountMbb).toBe(panel.sizing?.maxToAmountMbb);
    expect(built.context.wager).toBe(panel.adaptiveFacts.wager);
  });

  it('drops a seat with no known player from the ordering list', () => {
    const panel = ready(computeStrategy(heroCoFlopFacingBet(), HERO_CO_FLOP_FACING_BET));
    // Only the big blind is named; every other seat is anonymous to the caller.
    const partial: ReadonlyMap<number, string> = new Map([[2, 'p2']]);
    const built = buildAdaptiveBaseline(panel, partial);
    if (built === null) throw new Error('a supported spot must produce a baseline');

    expect(built.context.opponents.map((entry) => entry.seatIndex)).toEqual([2]);
    expect(built.context.opponents[0]?.playerId).toBe('p2');
    // The baseline itself is unaffected: it describes the spot, not the lineup.
    expect(built.baseline.activeOpponentCount).toBe(2);
  });
});

describe('opponentInputFromWire', () => {
  it('carries every field across without conversion', () => {
    const wire = opponentWire(2, [
      ['CBET_FLOP', 6400, 137],
      ['WTSD', 3100, 88],
    ]);
    const input = opponentInputFromWire(wire);
    expect(input).toEqual({
      playerId: 'p2',
      seatIndex: 2,
      nickname: 'nick-2',
      observations: [
        { key: 'CBET_FLOP', source: 'LEARNED_MODEL', valueBps: 6400, sampleN: 137, note: null },
        { key: 'WTSD', source: 'LEARNED_MODEL', valueBps: 3100, sampleN: 88, note: null },
      ],
      manualHudSnapshotId: null,
      manualHudRecordedAt: null,
      learnedSnapshotId: 'model-p2',
      learnedModelVersion: 1,
      externalHudSnapshotId: null,
      externalHudRecordedAt: null,
    });
  });
});

describe('computeAdaptive', () => {
  it('returns null for NO_HAND — ADAPTIVE has no state of its own to report', () => {
    expect(computeAdaptive({ kind: 'NO_HAND' }, [], SEAT_PLAYER_IDS)).toBeNull();
  });

  it('returns null for a REFUSED model, carrying no second refusal of its own', () => {
    // UTG(3) is on the clock; asking about HJ(4) is a real, typed engine refusal, and there
    // is no baseline to adapt behind it.
    const state = sixHanded(3, [setHoleCards(3, unwrap(parseCards('Ac Ad')), false)]);
    const refused = computeStrategy(state, 4);
    expect(refused.kind).toBe('REFUSED');
    if (refused.kind === 'REFUSED') expect(refused.code).toBe('HERO_NOT_ACTOR');
    expect(
      computeAdaptive(refused, [opponentWire(2, [['WTSD', 9000, 500]])], SEAT_PLAYER_IDS),
    ).toBeNull();
  });

  it('reports INSUFFICIENT_DATA and echoes the baseline when no opponent is known', () => {
    const model = computeStrategy(heroSbFlopSet(), HERO_SB_FLOP_SET);
    const adaptive = computeAdaptive(model, [], SEAT_PLAYER_IDS);
    if (adaptive === null) throw new Error('a supported spot must produce a recommendation');

    expect(adaptive.status).toBe('INSUFFICIENT_DATA');
    expect(adaptive.changedFromBaseline).toBe(false);
    expect(adaptive.adjustments).toEqual([]);
    expect(adaptive.actions.map((action) => action.frequencyBps)).toEqual(
      ready(model).actions.map((row) => row.frequencyBps),
    );
  });

  it('keeps an adapted size inside the engine’s own legal window', () => {
    const model = computeStrategy(heroSbFlopSet(), HERO_SB_FLOP_SET);
    const panel = ready(model);
    // A player who reaches showdown far more often than the anchor, on a sample big enough to
    // clear the sizing gate (5000 bps heads-up), while hero holds a set: `SIZE_STATION_VALUE_UP`.
    const station = [opponentWire(2, [['WTSD', 8000, 500]])];
    const adaptive = computeAdaptive(model, station, SEAT_PLAYER_IDS);
    if (adaptive === null || adaptive.sizing === null) {
      throw new Error('the fixture must produce an adaptive sizing');
    }

    // The rule really fired: the size moved exactly one rung UP the engine's own ladder.
    expect(adaptive.status).toBe('ADAPTED');
    expect(adaptive.adjustments.map((entry) => entry.ruleId)).toContain('SIZE_STATION_VALUE_UP');
    expect(adaptive.sizing.bucketDelta).toBe(1);
    expect(adaptive.sizing.toBucketIndex).toBe(adaptive.sizing.fromBucketIndex + 1);
    expect(adaptive.sizing.toPotFractionPercent).toBe(
      POT_FRACTION_BUCKETS[adaptive.sizing.toBucketIndex]?.percent,
    );
    expect(adaptive.sizing.toToAmountMbb).toBeGreaterThan(adaptive.sizing.fromToAmountMbb);

    // And it is still a legal amount, in the engine's own window, carried on the baseline.
    expect(adaptive.sizing.toToAmountMbb).toBeGreaterThanOrEqual(adaptive.sizing.minToAmountMbb);
    expect(adaptive.sizing.toToAmountMbb).toBeLessThanOrEqual(adaptive.sizing.maxToAmountMbb);
    expect(adaptive.sizing.minToAmountMbb).toBe(panel.sizing?.minToAmountMbb);
    expect(adaptive.sizing.maxToAmountMbb).toBe(panel.sizing?.maxToAmountMbb);
    // Never off the ladder, and never more than one rung.
    expect(Math.abs(adaptive.sizing.bucketDelta)).toBeLessThanOrEqual(1);
    expect(adaptive.sizing.toBucketIndex).toBeGreaterThanOrEqual(0);
    expect(adaptive.sizing.toBucketIndex).toBeLessThan(POT_FRACTION_BUCKETS.length);
    // The requested amount is retained beside the clamped one (CLAUDE.md rule 3).
    expect(adaptive.sizing.requestedToAmountMbb).toBeGreaterThan(0);
    expect(adaptive.sizing.clamp).toBe('NONE');
  });

  it('never introduces an action kind REFERENCE did not offer, and always sums to 10000', () => {
    const model = computeStrategy(heroCoFlopFacingBet(), HERO_CO_FLOP_FACING_BET);
    const panel = ready(model);
    const adaptive = computeAdaptive(
      model,
      [opponentWire(2, [['CBET_FLOP', 10000, 1000]])],
      SEAT_PLAYER_IDS,
    );
    if (adaptive === null) throw new Error('a supported spot must produce a recommendation');

    const baselineKinds = new Set(panel.actions.map((row) => row.kind));
    for (const action of adaptive.actions) {
      expect(baselineKinds.has(action.kind)).toBe(true);
      expect(action.frequencyBps % 100).toBe(0);
      expect(action.frequencyBps).toBeGreaterThanOrEqual(0);
    }
    expect(adaptive.actions.reduce((sum, action) => sum + action.frequencyBps, 0)).toBe(10000);
  });
});
