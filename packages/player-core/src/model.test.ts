import { describe, expect, it } from 'vitest';
import { asId, type HandId, type PlayerId } from '@gto-self/shared';
import {
  betFractionOfPot,
  isAggressiveEffect,
  isVoluntaryEffect,
  MODEL_STAT_KEYS,
  modelStatRate,
  OBSERVED_ACTION_EFFECTS,
  OBSERVED_ACTIONS,
  spotEffectRate,
  spotKey,
  toAmountInBigBlinds,
  type BetSizeObservation,
  type ModelStatCount,
  type PostflopSpot,
  type PreflopSpot,
  type SpotStatCount,
} from './model.js';
import { snapshotConfidence } from './modelConfig.js';

const preflop = (spot: Partial<PreflopSpot>): PreflopSpot => ({
  phase: 'PREFLOP',
  family: 'RFI',
  position: 'BTN',
  opponentPosition: null,
  lineup: 'MULTIWAY',
  ...spot,
});

const postflop = (spot: Partial<PostflopSpot>): PostflopSpot => ({
  phase: 'POSTFLOP',
  street: 'FLOP',
  family: 'CBET',
  position: 'BTN',
  relation: 'IP',
  lineup: 'HEADS_UP',
  potType: 'SINGLE_RAISED',
  facingSize: 'NONE',
  ...spot,
});

describe('spotKey', () => {
  it('names the preflop spots the brief uses', () => {
    expect(spotKey(preflop({ family: 'RFI', position: 'BTN' }))).toBe('BTN_RFI');
    expect(spotKey(preflop({ family: 'VS_OPEN', position: 'BB', opponentPosition: 'BTN' }))).toBe(
      'BB_VS_BTN_OPEN',
    );
    expect(spotKey(preflop({ family: 'VS_OPEN', position: 'SB', opponentPosition: 'BTN' }))).toBe(
      'SB_VS_BTN_OPEN',
    );
    expect(
      spotKey(preflop({ family: 'VS_THREE_BET', position: 'HJ', opponentPosition: 'BTN' })),
    ).toBe('HJ_OPEN_FACING_BTN_3BET');
    expect(
      spotKey(preflop({ family: 'VS_FOUR_BET', position: 'BTN', opponentPosition: 'HJ' })),
    ).toBe('BTN_3BET_FACING_HJ_4BET');
    expect(spotKey(preflop({ family: 'SQUEEZE', position: 'BB', opponentPosition: 'CO' }))).toBe(
      'BB_SQUEEZE_VS_CO',
    );
    expect(spotKey(preflop({ family: 'VS_LIMP', position: 'CO' }))).toBe('CO_VS_LIMP');
    expect(spotKey(preflop({ family: 'BB_OPTION', position: 'BB' }))).toBe('BB_OPTION');
    expect(spotKey(preflop({ family: 'VS_MULTI_RAISE', position: 'SB' }))).toBe(
      'SB_VS_MULTI_RAISE',
    );
  });

  it('omits the size segment when the player is not facing a bet', () => {
    expect(spotKey(postflop({}))).toBe('FLOP_CBET_BTN_IP_HEADS_UP_SINGLE_RAISED');
  });

  it('includes the size bucket when the player is facing a bet', () => {
    expect(
      spotKey(
        postflop({
          street: 'TURN',
          family: 'FACING_CBET',
          position: 'BB',
          relation: 'OOP',
          potType: 'THREE_BET',
          facingSize: 'MEDIUM',
        }),
      ),
    ).toBe('TURN_FACING_CBET_BB_OOP_HEADS_UP_THREE_BET_MEDIUM');
  });

  it('is stable and distinct across the dimensions it carries', () => {
    const a = spotKey(postflop({ relation: 'IP' }));
    const b = spotKey(postflop({ relation: 'OOP' }));
    expect(a).not.toBe(b);
    expect(spotKey(postflop({ relation: 'IP' }))).toBe(a);
  });
});

describe('vocabulary', () => {
  it('lists every action verb and effect exactly once', () => {
    expect(new Set(OBSERVED_ACTIONS).size).toBe(OBSERVED_ACTIONS.length);
    expect(new Set(OBSERVED_ACTION_EFFECTS).size).toBe(OBSERVED_ACTION_EFFECTS.length);
    expect(new Set(MODEL_STAT_KEYS).size).toBe(MODEL_STAT_KEYS.length);
  });

  it('classifies effects', () => {
    expect(OBSERVED_ACTION_EFFECTS.filter(isVoluntaryEffect)).toEqual(['CALL', 'BET', 'RAISE']);
    expect(OBSERVED_ACTION_EFFECTS.filter(isAggressiveEffect)).toEqual(['BET', 'RAISE']);
  });
});

describe('derived rates', () => {
  const count = (opportunities: number, actions: number): ModelStatCount => ({
    key: 'VPIP',
    position: null,
    opportunities,
    actions,
    confidence: snapshotConfidence(opportunities),
  });

  it('is null rather than zero when nothing was observed', () => {
    expect(modelStatRate(count(0, 0))).toBeNull();
  });

  it('divides actions by opportunities', () => {
    expect(modelStatRate(count(40, 10))).toBe(0.25);
  });

  it('reads one effect out of a spot bucket', () => {
    const spot: SpotStatCount = {
      spotKey: 'BB_VS_BTN_OPEN',
      spot: preflop({ family: 'VS_OPEN', position: 'BB', opponentPosition: 'BTN' }),
      opportunities: 4,
      effects: { FOLD: 2, CHECK: 0, CALL: 1, BET: 0, RAISE: 1 },
      verbs: { FOLD: 2, CHECK: 0, CALL: 1, BET: 0, RAISE: 0, ALL_IN: 1 },
      confidence: snapshotConfidence(4),
    };
    expect(spotEffectRate(spot, 'FOLD')).toBe(0.5);
    expect(spot.confidence.state).toBe('UNKNOWN');
  });
});

describe('bet size observations keep raw milliBB as the truth', () => {
  const observation: BetSizeObservation = {
    handId: asId<'Hand'>('h1') as HandId,
    playerId: asId<'Player'>('p1') as PlayerId,
    kind: 'POSTFLOP_BET',
    spotKey: 'FLOP_CBET_BTN_IP_HEADS_UP_SINGLE_RAISED',
    toAmount: 3_000,
    amount: 3_000,
    potBefore: 6_000,
    currentBetBefore: 0,
    bigBlind: 1_000,
    bucket: 'SMALL',
  };

  it('derives the pot fraction without storing it', () => {
    expect(betFractionOfPot(observation)).toBe(0.5);
    expect(toAmountInBigBlinds(observation)).toBe(3);
  });

  it('returns null rather than dividing by zero', () => {
    expect(betFractionOfPot({ ...observation, potBefore: 0 })).toBeNull();
    expect(toAmountInBigBlinds({ ...observation, bigBlind: 0 })).toBeNull();
  });
});
