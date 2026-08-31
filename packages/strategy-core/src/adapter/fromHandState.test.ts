/**
 * Adapter tests. Every fixture is a REAL poker-core hand driven through
 * `createTable`/`seatPlayer`/`startHand`/`applyCommands` — never a hand-written state
 * literal — so a change in the engine breaks these tests instead of silently changing what
 * the strategy layer believes.
 */
import { Money, parseCards, unwrap, type Card } from '@gto-self/shared';
import {
  call,
  callAmount,
  dealBoard,
  fold,
  legalActions,
  potOdds,
  raiseTo,
  setHoleCards,
  spr,
  allIn,
  type SeatIndex,
} from '@gto-self/poker-core';
import { describe, expect, it } from 'vitest';
import { buildStrategyQuery } from './fromHandState.js';
import { BB, buildTable, fiveHanded, playHand, sixHanded } from './testHands.js';

const cards = (text: string): readonly Card[] => unwrap(parseCards(text));

describe('buildStrategyQuery — 6-max RFI on the button', () => {
  const hand = sixHanded(0, [fold(), fold(), fold()]);
  const query = unwrap(buildStrategyQuery(hand.state));

  it('labels the spot from the engine, not from its own arithmetic', () => {
    expect(query.street).toBe('PREFLOP');
    expect(query.heroPosition).toBe('BTN');
    expect(query.heroSeatIndex).toBe(0);
    expect(query.dealtInCount).toBe(6);
    expect(query.positionsInHand).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });

  it('carries the actual money environment', () => {
    expect(query.environment.bigBlindMbb).toBe(BB(1));
    expect(query.environment.smallBlindMbb).toBe(BB(0.5));
    expect(query.environment.anteEnabled).toBe(false);
    expect(query.environment.deadMoneyMbb).toBe(Money.ZERO);
    expect(query.potTotalMbb).toBe(BB(1.5));
    expect(query.potBeforeDecisionMbb).toBe(BB(1.5));
    expect(query.currentBetMbb).toBe(BB(1));
    expect(query.callAmountMbb).toBe(BB(1));
    expect(query.callToAmountMbb).toBe(BB(1));
  });

  it('mirrors the engine legal actions with raise-TO bounds', () => {
    expect(query.legalActions.canFold).toBe(true);
    expect(query.legalActions.canCheck).toBe(false);
    expect(query.legalActions.call?.amountMbb).toBe(BB(1));
    expect(query.legalActions.wager?.kind).toBe('RAISE');
    expect(query.legalActions.wager?.minToAmountMbb).toBe(BB(2));
    expect(query.legalActions.wager?.maxToAmountMbb).toBe(BB(100));
    expect(query.legalActions.wager?.onlyAllIn).toBe(false);
    expect(query.legalActions.allIn?.toAmountMbb).toBe(BB(100));
  });

  it('records the folds as neutral history with positions', () => {
    expect(query.actions.map((action) => action.position)).toEqual(['UTG', 'HJ', 'CO']);
    expect(query.actions.every((action) => action.kind === 'FOLD')).toBe(true);
    expect(query.actions.every((action) => !action.isAggressive)).toBe(true);
    expect(query.aggressionHistory).toHaveLength(0);
    expect(query.lastAggressorByStreet).toEqual({
      PREFLOP: null,
      FLOP: null,
      TURN: null,
      RIVER: null,
    });
  });

  it('reports stacks, buckets, opponents and position', () => {
    expect(query.effectiveStackMbb).toBe(BB(100));
    expect(query.stackBucket.kind).toBe('BUCKET');
    if (query.stackBucket.kind === 'BUCKET') {
      expect(query.stackBucket.bucket.id).toBe('BB_80_119');
    }
    expect(query.activeOpponentCount).toBe(2);
    expect(query.heroInPosition).toBe(true);
    expect(query.seats).toHaveLength(6);
    expect(query.seats.filter((seat) => seat.status === 'FOLDED')).toHaveLength(3);
    expect(query.seats.find((seat) => seat.isHero)?.position).toBe('BTN');
  });

  it('passes SPR and pot odds through from poker-core unchanged', () => {
    expect(query.spr).toBe(spr(hand.state, 0));
    expect(query.potOdds).toBe(potOdds(hand.state, 0));
    expect(query.potOdds).toBeCloseTo(0.4, 12);
    expect(query.callAmountMbb).toBe(callAmount(hand.state, 0));
    expect(query.legalActions.canCheck).toBe(legalActions(hand.state, 0).canCheck);
  });

  it('has no hole cards until the user enters them', () => {
    expect(query.heroCards).toEqual([]);
    expect(query.board).toEqual([]);
  });
});

describe('buildStrategyQuery — facing an open', () => {
  // UTG opens to 2.5 BB, HJ and CO fold, hero is on the button.
  const hand = sixHanded(0, [raiseTo(BB(2.5)), fold(), fold()]);
  const query = unwrap(buildStrategyQuery(hand.state));

  it('records the open as aggression with its raise-TO size', () => {
    expect(query.aggressionHistory).toHaveLength(1);
    expect(query.aggressionHistory[0]?.position).toBe('UTG');
    expect(query.aggressionHistory[0]?.toAmountMbb).toBe(BB(2.5));
    expect(query.lastAggressorByStreet.PREFLOP).toBe('UTG');
    const open = query.actions[0];
    expect(open?.kind).toBe('RAISE');
    expect(open?.isAggressive).toBe(true);
    expect(open?.isFullRaise).toBe(true);
    expect(open?.potBeforeMbb).toBe(BB(1.5));
  });

  it('prices the decision from the engine', () => {
    expect(query.currentBetMbb).toBe(BB(2.5));
    expect(query.callAmountMbb).toBe(BB(2.5));
    expect(query.potBeforeDecisionMbb).toBe(BB(4));
    expect(query.legalActions.wager?.minToAmountMbb).toBe(BB(4));
  });
});

describe('buildStrategyQuery — an all-in in front of hero', () => {
  const hand = sixHanded(0, [allIn(), fold(), fold()]);
  const query = unwrap(buildStrategyQuery(hand.state));

  it('derives aggression for a shove that raised the price', () => {
    const shove = query.actions[0];
    expect(shove?.kind).toBe('ALL_IN');
    expect(shove?.isAllIn).toBe(true);
    expect(shove?.isAggressive).toBe(true);
    expect(query.lastAggressorByStreet.PREFLOP).toBe('UTG');
    expect(query.callAmountMbb).toBe(BB(100));
  });
});

describe('buildStrategyQuery — five-handed', () => {
  // Five-handed drops UTG: seat 3 is HJ and acts first.
  const hand = fiveHanded(4, [fold()]);
  const query = unwrap(buildStrategyQuery(hand.state));

  it('uses the five-handed position ladder', () => {
    expect(query.dealtInCount).toBe(5);
    expect(query.positionsInHand).toEqual(['HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(query.heroPosition).toBe('CO');
    expect(query.actions[0]?.position).toBe('HJ');
    expect(query.heroInPosition).toBe(false); // the button is still to act
  });
});

describe('buildStrategyQuery — postflop', () => {
  // Folds to the button, who opens; SB folds; hero (BB) calls; flop comes.
  const hand = sixHanded(2, [
    setHoleCards(2 as SeatIndex, cards('AsKd'), false),
    fold(),
    fold(),
    fold(),
    raiseTo(BB(2.5)),
    fold(),
    call(),
    dealBoard(cards('Ah7c2d')),
  ]);
  const query = unwrap(buildStrategyQuery(hand.state));

  it('maps the street, the board and hero cards', () => {
    expect(query.street).toBe('FLOP');
    expect(query.board).toHaveLength(3);
    expect(query.heroCards).toHaveLength(2);
    expect(query.heroPosition).toBe('BB');
  });

  it('keeps the preflop aggressor and knows hero is out of position', () => {
    expect(query.lastAggressorByStreet.PREFLOP).toBe('BTN');
    expect(query.lastAggressorByStreet.FLOP).toBeNull();
    expect(query.heroInPosition).toBe(false);
    expect(query.activeOpponentCount).toBe(1);
    expect(query.callAmountMbb).toBe(Money.ZERO);
    expect(query.legalActions.canCheck).toBe(true);
    expect(query.legalActions.wager?.kind).toBe('BET');
  });
});

describe('buildStrategyQuery — refusals', () => {
  it('refuses when the hand carries no hero and none is supplied', () => {
    const hand = playHand(buildTable({ seats: [0, 1, 2, 3, 4, 5], buttonSeat: 0 }), []);
    const result = buildStrategyQuery(hand.state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('HERO_UNKNOWN');
  });

  it('refuses when hero is in the hand but not on the clock', () => {
    const hand = sixHanded(2); // BB, while UTG is the actor
    const result = buildStrategyQuery(hand.state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('HERO_NOT_ACTOR');
      expect(result.error.context.seat).toBe(2);
    }
  });

  it('refuses a hero seat that is not dealt into the hand', () => {
    const hand = playHand(buildTable({ seats: [0, 1, 2], buttonSeat: 0, heroSeat: 0 }), []);
    const result = buildStrategyQuery(hand.state, { heroSeat: 5 as SeatIndex });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('HERO_NOT_DEALT_IN');
  });

  it('refuses a hand where nobody is on the clock', () => {
    const hand = sixHanded(0, [fold(), fold(), fold(), fold(), fold()]);
    expect(hand.state.phase).toBe('COMPLETE');
    const result = buildStrategyQuery(hand.state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_A_DECISION_POINT');
      expect(result.error.context.phase).toBe('COMPLETE');
    }
  });

  it('accepts another seat as hero when explicitly asked', () => {
    const hand = sixHanded(2, [fold(), fold(), fold()]);
    // The actor is the button (seat 0); hero is seat 2, so the default refuses...
    expect(buildStrategyQuery(hand.state).ok).toBe(false);
    // ...but analysing the button's own decision is legitimate and honest.
    const asButton = unwrap(buildStrategyQuery(hand.state, { heroSeat: 0 as SeatIndex }));
    expect(asButton.heroPosition).toBe('BTN');
    expect(asButton.seats.find((seat) => seat.isHero)?.seatIndex).toBe(0);
  });
});

describe('buildStrategyQuery — determinism', () => {
  it('the same hand yields a deeply equal query', () => {
    const a = unwrap(buildStrategyQuery(sixHanded(0, [raiseTo(BB(2.5)), fold(), fold()]).state));
    const b = unwrap(buildStrategyQuery(sixHanded(0, [raiseTo(BB(2.5)), fold(), fold()]).state));
    expect(a).toEqual(b);
  });
});
