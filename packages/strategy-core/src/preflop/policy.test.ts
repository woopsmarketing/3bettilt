/**
 * The preflop REFERENCE policy end to end: one canonical spot per family, the invariants that
 * must hold on EVERY recommendation, the legality policy in both directions, provenance
 * degradation, and a property-style sweep over positions and hand classes.
 */
import { describe, expect, it } from 'vitest';
import { BPS_TOTAL } from '../bps.js';
import { HAND_CLASSES } from '../range/handClass.js';
import type { StrategyActionKind } from '../types.js';
import { recommendPreflop } from './policy.js';
import { FREQUENCY_STEP_BPS, type StrategyRecommendation } from './recommendation.js';
import { call, fold, makeQuery, raise, shove, type QuerySpec } from './testQuery.js';

function recommend(spec: QuerySpec): StrategyRecommendation {
  const result = recommendPreflop(makeQuery(spec));
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.code}`);
  return result.value;
}

function frequencyOf(rec: StrategyRecommendation, kind: StrategyActionKind): number {
  return rec.actions.find((action) => action.kind === kind)?.frequencyBps ?? 0;
}

/** The three invariants every reached recommendation must satisfy. */
function expectWellFormed(rec: StrategyRecommendation, spec: QuerySpec): void {
  const total = rec.actions.reduce((sum, action) => sum + action.frequencyBps, 0);
  expect(total).toBe(BPS_TOTAL);
  for (const action of rec.actions) {
    expect(action.frequencyBps % FREQUENCY_STEP_BPS).toBe(0);
    expect(action.frequencyBps).toBeGreaterThan(0);
  }
  expect(rec.actions).toContain(rec.primaryAction);
  const query = makeQuery(spec);
  for (const action of rec.actions) {
    switch (action.kind) {
      case 'FOLD':
        expect(query.legalActions.canFold).toBe(true);
        break;
      case 'CHECK':
        expect(query.legalActions.canCheck).toBe(true);
        break;
      case 'CALL':
        expect(query.legalActions.call).not.toBeNull();
        break;
      case 'ALL_IN':
        expect(query.legalActions.allIn).not.toBeNull();
        break;
      case 'RAISE': {
        const wager = query.legalActions.wager;
        expect(wager).not.toBeNull();
        if (wager === null) break;
        expect(action.toAmountMbb).not.toBeNull();
        expect(action.toAmountMbb ?? 0).toBeGreaterThanOrEqual(wager.minToAmountMbb);
        expect(action.toAmountMbb ?? 0).toBeLessThanOrEqual(wager.maxToAmountMbb);
        expect(action.sizing).not.toBeNull();
        break;
      }
      case 'BET':
        throw new Error('BET is not a preflop action');
    }
  }
}

const cardsFor = (key: string): string => {
  const high = key[0] ?? 'A';
  const low = key[1] ?? 'A';
  return key.endsWith('s') ? `${high}s${low}s` : `${high}s${low}d`;
};

// ---------------------------------------------------------------------------
// RFI
// ---------------------------------------------------------------------------

describe('RFI', () => {
  it('opens AKs from every seat that has a first-in range', () => {
    for (const hero of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const) {
      const before = (['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const).slice(
        0,
        (['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const).indexOf(hero),
      );
      const rec = recommend({ hero, actions: before.map(fold), heroCards: 'AsKs' });
      expect(rec.family).toBe('RFI');
      expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
      expect(rec.primaryAction.kind).toBe('RAISE');
    }
  });

  it('folds a junk UTG hand outright', () => {
    const rec = recommend({ hero: 'UTG', heroCards: 'As7d' });
    expect(rec.family).toBe('RFI');
    expect(frequencyOf(rec, 'FOLD')).toBe(BPS_TOTAL);
    expect(rec.primaryAction.kind).toBe('FOLD');
    expect(rec.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'RANGE_MEMBERSHIP', token: 'OUT_OF_RANGE' }),
    );
  });

  it('opens to 2.5bb, and to 3bb from the small blind', () => {
    const co = recommend({ hero: 'CO', actions: [fold('UTG'), fold('HJ')], heroCards: 'AsKs' });
    expect(co.primaryAction.toAmountMbb).toBe(2500);
    expect(co.primaryAction.sizing?.ruleId).toBe('SIZE_RFI');
    const sb = recommend({
      hero: 'SB',
      actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN')],
      heroCards: 'AsKs',
    });
    expect(sb.primaryAction.toAmountMbb).toBe(3000);
    expect(sb.provenance.ruleIds).toContain('RFI_SB_RAISE_ONLY_TRIM');
  });

  it('opens a hand the BTN plays but UTG does not, only from the BTN', () => {
    const utg = recommend({ hero: 'UTG', heroCards: 'Ts6s' });
    const btn = recommend({
      hero: 'BTN',
      actions: [fold('UTG'), fold('HJ'), fold('CO')],
      heroCards: 'Ts6s',
    });
    expect(frequencyOf(utg, 'FOLD')).toBe(BPS_TOTAL);
    expect(frequencyOf(btn, 'RAISE')).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// VS_LIMP / BLIND_VS_BLIND
// ---------------------------------------------------------------------------

describe('VS_LIMP', () => {
  const spec: QuerySpec = {
    hero: 'CO',
    actions: [call('UTG', 1), fold('HJ')],
    heroCards: 'AsKs',
  };

  it('iso-raises with the position s own opening range, sized +1bb per limper', () => {
    const rec = recommend(spec);
    expect(rec.family).toBe('VS_LIMP');
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
    expect(rec.primaryAction.toAmountMbb).toBe(3500);
    expect(rec.primaryAction.sizing?.ruleId).toBe('SIZE_ISO_VS_LIMP');
  });

  it('raises an SB limp from the BB to 3.5bb and checks the rest', () => {
    const base: QuerySpec = {
      hero: 'BB',
      actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN'), call('SB', 1)],
    };
    const strong = recommend({ ...base, heroCards: 'AsKs' });
    expect(strong.family).toBe('VS_LIMP');
    expect(strong.primaryAction.kind).toBe('RAISE');
    expect(strong.primaryAction.toAmountMbb).toBe(3500);
    expect(strong.provenance.ruleIds).toContain('VS_LIMP_BB_VS_SB');

    const junk = recommend({ ...base, heroCards: '7s2d' });
    // Continuing is free, so the fold bucket must surface as a CHECK, never a fold.
    expect(frequencyOf(junk, 'CHECK')).toBe(BPS_TOTAL);
    expect(frequencyOf(junk, 'FOLD')).toBe(0);
    expect(junk.provenance.ruleIds).toContain('LEGALITY_SUBSTITUTION');
  });
});

describe('BLIND_VS_BLIND', () => {
  const base: QuerySpec = {
    hero: 'BB',
    actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN'), raise('SB', 3)],
  };

  it('3-bets the value core to 3x the open, in position on the SB', () => {
    const rec = recommend({ ...base, heroCards: 'AsAd' });
    expect(rec.family).toBe('BLIND_VS_BLIND');
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
    expect(rec.primaryAction.toAmountMbb).toBe(9000);
    expect(rec.primaryAction.sizing?.ruleId).toBe('SIZE_THREE_BET_IP');
  });

  it('defends widest of any spot from the big blind', () => {
    const rec = recommend({ ...base, heroCards: '9s8d' });
    expect(frequencyOf(rec, 'CALL')).toBe(BPS_TOTAL);
    expect(rec.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'CONTINUE_TIER', token: 'DEFEND_VERY_WIDE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// VS_OPEN
// ---------------------------------------------------------------------------

describe('VS_OPEN — BTN facing a CO open', () => {
  const base: QuerySpec = {
    hero: 'BTN',
    actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
  };

  it('3-bets the value core 100% to 3x in position', () => {
    const rec = recommend({ ...base, heroCards: 'AsKs' });
    expect(rec.family).toBe('VS_OPEN');
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
    expect(rec.primaryAction.toAmountMbb).toBe(7500);
  });

  it('mixes the middle of the range in 5-point steps, primary going to the calmer line', () => {
    const rec = recommend({ ...base, heroCards: 'KsQs' });
    expect(frequencyOf(rec, 'RAISE')).toBe(5000);
    expect(frequencyOf(rec, 'CALL')).toBe(5000);
    // The tie-break is documented: a 50/50 shows the least committing action first.
    expect(rec.primaryAction.kind).toBe('CALL');
  });

  it('splits a bluff class three ways and still sums to 10000', () => {
    const rec = recommend({ ...base, heroCards: 'JsTs' });
    expect(frequencyOf(rec, 'FOLD')).toBe(3500);
    expect(frequencyOf(rec, 'CALL')).toBe(3500);
    expect(frequencyOf(rec, 'RAISE')).toBe(3000);
    expect(rec.primaryAction.kind).toBe('FOLD');
  });

  it('folds outright below the continue tier', () => {
    const rec = recommend({ ...base, heroCards: '7s2d' });
    expect(frequencyOf(rec, 'FOLD')).toBe(BPS_TOTAL);
  });

  it('defends tighter from the SB than from the BB against the same open', () => {
    const sb = recommend({
      hero: 'SB',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), fold('BTN')],
      heroCards: '9s8d',
    });
    const bb = recommend({
      hero: 'BB',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), fold('BTN'), fold('SB')],
      heroCards: '9s8d',
    });
    expect(frequencyOf(sb, 'FOLD')).toBe(BPS_TOTAL);
    expect(frequencyOf(bb, 'CALL')).toBe(BPS_TOTAL);
  });

  it('3-bets out of position to 4x', () => {
    const rec = recommend({
      hero: 'SB',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), fold('BTN')],
      heroCards: 'AsAd',
    });
    expect(rec.primaryAction.toAmountMbb).toBe(10000);
    expect(rec.primaryAction.sizing?.ruleId).toBe('SIZE_THREE_BET_OOP');
  });
});

// ---------------------------------------------------------------------------
// SQUEEZE / OPEN_PLUS_CALLER
// ---------------------------------------------------------------------------

describe('SQUEEZE', () => {
  const base: QuerySpec = {
    hero: 'BTN',
    actions: [raise('UTG', 2.5), call('HJ', 2.5), fold('CO')],
  };

  it('squeezes the value core to 4x the open in position', () => {
    const rec = recommend({ ...base, heroCards: 'AsAd' });
    expect(rec.family).toBe('SQUEEZE');
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
    expect(rec.primaryAction.toAmountMbb).toBe(10000);
    expect(rec.primaryAction.sizing?.ruleId).toBe('SIZE_SQUEEZE');
  });

  it('squeezes the bluff core 30% of the time and folds the rest', () => {
    const rec = recommend({ ...base, heroCards: 'As5s' });
    expect(frequencyOf(rec, 'RAISE')).toBe(3000);
    expect(frequencyOf(rec, 'FOLD')).toBe(7000);
    expect(rec.primaryAction.kind).toBe('FOLD');
  });

  it('cold-calls only in position', () => {
    const ip = recommend({ ...base, heroCards: 'AsQs' });
    expect(frequencyOf(ip, 'CALL')).toBe(BPS_TOTAL);
    const oop = recommend({
      hero: 'SB',
      actions: [raise('UTG', 2.5), call('HJ', 2.5), fold('CO'), fold('BTN')],
      heroCards: 'AsQs',
    });
    expect(frequencyOf(oop, 'FOLD')).toBe(BPS_TOTAL);
  });
});

describe('OPEN_PLUS_CALLER', () => {
  it('continues only with the tight tier once hero has already invested', () => {
    const spec: QuerySpec = {
      hero: 'UTG',
      actions: [call('UTG', 1), raise('HJ', 4), call('CO', 4), fold('BTN')],
    };
    const strong = recommend({ ...spec, heroCards: 'AsAd' });
    expect(strong.family).toBe('OPEN_PLUS_CALLER');
    expect(frequencyOf(strong, 'RAISE')).toBe(BPS_TOTAL);
    const medium = recommend({ ...spec, heroCards: 'AsTs' });
    expect(frequencyOf(medium, 'CALL')).toBe(BPS_TOTAL);
    const weak = recommend({ ...spec, heroCards: '7s6s' });
    expect(frequencyOf(weak, 'FOLD')).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// 3-bet / 4-bet trees
// ---------------------------------------------------------------------------

describe('OPENER_VS_3BET', () => {
  const base: QuerySpec = {
    hero: 'CO',
    actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), raise('BTN', 7.5)],
  };

  it('4-bets the value core to 2.5x the 3-bet out of position', () => {
    const rec = recommend({ ...base, heroCards: 'AsAd' });
    expect(rec.family).toBe('OPENER_VS_3BET');
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
    expect(rec.primaryAction.toAmountMbb).toBe(18750);
    expect(rec.primaryAction.sizing?.ruleId).toBe('SIZE_FOUR_BET_OOP');
  });

  it('4-bet bluffs at an even mix and calls the middle', () => {
    const bluff = recommend({ ...base, heroCards: 'As5s' });
    expect(frequencyOf(bluff, 'RAISE')).toBe(5000);
    expect(frequencyOf(bluff, 'FOLD')).toBe(5000);
    expect(bluff.primaryAction.kind).toBe('FOLD');
    const flat = recommend({ ...base, heroCards: 'AsKd' });
    expect(frequencyOf(flat, 'CALL')).toBe(BPS_TOTAL);
    const junk = recommend({ ...base, heroCards: '7s2d' });
    expect(frequencyOf(junk, 'FOLD')).toBe(BPS_TOTAL);
  });
});

describe('COLD_4BET', () => {
  it('is the tightest table in the package', () => {
    const base: QuerySpec = {
      hero: 'BTN',
      actions: [raise('UTG', 2.5), raise('HJ', 8), fold('CO')],
    };
    const best = recommend({ ...base, heroCards: 'AsAd' });
    expect(best.family).toBe('COLD_4BET');
    expect(frequencyOf(best, 'RAISE')).toBe(BPS_TOTAL);
    const mixed = recommend({ ...base, heroCards: 'QsQd' });
    expect(frequencyOf(mixed, 'RAISE')).toBe(5000);
    expect(frequencyOf(mixed, 'FOLD')).toBe(5000);
    const strongButNotEnough = recommend({ ...base, heroCards: 'JsJd' });
    expect(frequencyOf(strongButNotEnough, 'FOLD')).toBe(BPS_TOTAL);
  });
});

describe('VS_4BET', () => {
  const base: QuerySpec = {
    hero: 'BTN',
    actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), raise('BTN', 7.5), raise('CO', 18)],
  };

  it('shoves the top of the range and calls just under it', () => {
    const shoveRec = recommend({ ...base, heroCards: 'AsAd' });
    expect(shoveRec.family).toBe('VS_4BET');
    expect(frequencyOf(shoveRec, 'RAISE')).toBe(BPS_TOTAL);
    expect(shoveRec.primaryAction.toAmountMbb).toBe(100000);
    expect(shoveRec.primaryAction.isAllIn).toBe(true);
    expect(shoveRec.primaryAction.sizing?.ruleId).toBe('SIZE_FIVE_BET_SHOVE');

    const flat = recommend({ ...base, heroCards: 'QsQd' });
    expect(frequencyOf(flat, 'CALL')).toBe(BPS_TOTAL);
    const gone = recommend({ ...base, heroCards: 'AsJs' });
    expect(frequencyOf(gone, 'FOLD')).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// VS_ALLIN and the fallback
// ---------------------------------------------------------------------------

describe('VS_ALLIN', () => {
  it('tightens as the price gets worse', () => {
    const expensive: QuerySpec = {
      hero: 'BB',
      actions: [shove('UTG', 100), fold('HJ'), fold('CO'), fold('BTN'), fold('SB')],
      noWager: true,
    };
    const cheap: QuerySpec = {
      hero: 'BB',
      actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN'), shove('SB', 3)],
      noWager: true,
    };
    const bigCall = recommend({ ...expensive, heroCards: 'AsAd' });
    expect(bigCall.family).toBe('VS_ALLIN');
    expect(frequencyOf(bigCall, 'CALL')).toBe(BPS_TOTAL);
    const bigFold = recommend({ ...expensive, heroCards: '7s7d' });
    expect(frequencyOf(bigFold, 'FOLD')).toBe(BPS_TOTAL);

    // The same 77 continues against a small shove: the pot-odds tier widens.
    const smallCall = recommend({ ...cheap, heroCards: '7s7d' });
    expect(frequencyOf(smallCall, 'CALL')).toBe(BPS_TOTAL);
    expect(smallCall.metrics.requiredEquity).not.toBeNull();
    expect(smallCall.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'FACING_ALL_IN' }),
    );
  });

  it('never emits a raise when facing a shove', () => {
    const rec = recommend({
      hero: 'BB',
      actions: [shove('UTG', 100), fold('HJ'), fold('CO'), fold('BTN'), fold('SB')],
      noWager: true,
      heroCards: 'AsAd',
    });
    expect(rec.actions.some((action) => action.kind === 'RAISE')).toBe(false);
  });
});

describe('UNSUPPORTED fallback', () => {
  const base: QuerySpec = {
    hero: 'UTG',
    actions: [call('UTG', 1), raise('HJ', 4), raise('CO', 12), fold('BTN')],
  };

  it('answers a caller facing a 3-bet rather than refusing', () => {
    const rec = recommend({ ...base, heroCards: 'AsAd' });
    expect(rec.family).toBe('UNSUPPORTED');
    expect(rec.unsupportedReason).toBe('CALLER_FACING_THREE_BET');
    expect(rec.provenance.ruleIds).toContain('UNSUPPORTED_SPOT_FALLBACK');
    expect(rec.provenance.quality).toBe('HEURISTIC');
    expect(rec.provenance.notes.length).toBeGreaterThan(0);
    expect(frequencyOf(rec, 'CALL')).toBe(BPS_TOTAL);
  });

  it('never authors a raise in a line the package does not model', () => {
    for (const cards of ['AsAd', 'AsKs', '7s2d']) {
      const rec = recommend({ ...base, heroCards: cards });
      expect(rec.actions.some((action) => action.kind === 'RAISE')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Legality
// ---------------------------------------------------------------------------

describe('legality', () => {
  it('raises a too-small open to the engine minimum and says so', () => {
    const rec = recommend({
      hero: 'CO',
      actions: [fold('UTG'), fold('HJ')],
      heroCards: 'AsKs',
      wagerMinToBB: 9,
    });
    expect(rec.primaryAction.toAmountMbb).toBe(9000);
    expect(rec.primaryAction.sizing?.clamp).toBe('RAISED_TO_MINIMUM');
    expect(rec.primaryAction.sizing?.requestedToAmountMbb).toBe(2500);
    expect(rec.provenance.ruleIds).toContain('LEGALITY_CLAMP');
    expect(rec.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'SIZING_CLAMPED', token: 'RAISED_TO_MINIMUM' }),
    );
  });

  it('lowers a too-large open to the engine maximum', () => {
    const rec = recommend({
      hero: 'BTN',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
      heroCards: 'AsKs',
      startingStackBB: 100,
      wagerMaxToBB: 5,
      wagerMinToBB: 5,
    });
    expect(rec.primaryAction.toAmountMbb).toBe(5000);
    expect(rec.primaryAction.sizing?.clamp).toBe('LOWERED_TO_MAXIMUM');
    expect(rec.primaryAction.sizing?.requestedToAmountMbb).toBe(7500);
  });

  it('substitutes an all-in when a plain raise is not offered', () => {
    const rec = recommend({
      hero: 'BTN',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
      heroCards: 'AsKs',
      wagerOnlyAllIn: true,
    });
    expect(rec.actions.some((action) => action.kind === 'ALL_IN')).toBe(true);
    expect(rec.provenance.ruleIds).toContain('LEGALITY_SUBSTITUTION');
  });

  it('substitutes a call when no aggression at all is offered', () => {
    const rec = recommend({
      hero: 'BTN',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
      heroCards: 'AsKs',
      noWager: true,
      legalOverrides: { allIn: null },
    });
    expect(rec.actions.some((action) => action.kind === 'RAISE')).toBe(false);
    expect(frequencyOf(rec, 'CALL')).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

describe('provenance', () => {
  const rfi: QuerySpec = { hero: 'CO', actions: [fold('UTG'), fold('HJ')], heroCards: 'AsKs' };

  it('is DERIVED at the reference bucket for an RFI', () => {
    const rec = recommend(rfi);
    expect(rec.provenance.quality).toBe('DERIVED');
    expect(rec.provenance.ruleIds).toContain('RFI_TABLE');
    expect(rec.provenance.ruleIds).toContain('SIZE_RFI');
    expect(rec.provenance.ruleIds).not.toContain('STACK_BUCKET_NEARBY');
  });

  it('degrades one step in a neighbouring stack bucket', () => {
    const rec = recommend({ ...rfi, startingStackBB: 65 });
    expect(rec.provenance.ruleIds).toContain('STACK_BUCKET_NEARBY');
    expect(rec.provenance.quality).toBe('HEURISTIC');
  });

  it('forces HEURISTIC in a distant bucket and below the modelled minimum', () => {
    const distant = recommend({ ...rfi, startingStackBB: 200 });
    expect(distant.provenance.ruleIds).toContain('STACK_BUCKET_DISTANT');
    expect(distant.provenance.quality).toBe('HEURISTIC');

    const shortStack = recommend({ ...rfi, startingStackBB: 30 });
    expect(shortStack.provenance.ruleIds).toContain('STACK_BUCKET_OUT_OF_RANGE');
    expect(shortStack.provenance.quality).toBe('HEURISTIC');
    expect(shortStack.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'UNMODELLED_STACK_DEPTH' }),
    );
  });

  it('degrades short-handed and forces HEURISTIC three-handed', () => {
    const fiveHanded = recommend({
      hero: 'CO',
      dealtInCount: 5,
      actions: [fold('HJ')],
      heroCards: 'AsKs',
    });
    expect(fiveHanded.provenance.ruleIds).toContain('LINEUP_SHORT_HANDED');

    const threeHanded = recommend({ hero: 'BTN', dealtInCount: 3, heroCards: 'AsKs' });
    expect(threeHanded.provenance.ruleIds).toContain('LINEUP_VERY_SHORT_HANDED');
    expect(threeHanded.provenance.quality).toBe('HEURISTIC');
  });

  it('never claims an exact environment match, and flags an ante as divergent', () => {
    const plain = recommend(rfi);
    expect(plain.provenance.environmentCompatibility.status).toBe('APPROXIMATE');
    const anted = recommend({ ...rfi, anteEnabled: true });
    expect(anted.provenance.environmentCompatibility.status).toBe('DIVERGENT');
    expect(anted.provenance.environmentCompatibility.factors).toContainEqual(
      expect.objectContaining({ id: 'ANTE', status: 'DIVERGENT' }),
    );
  });

  it('carries a note whenever the answer is HEURISTIC', () => {
    const rec = recommend({ ...rfi, startingStackBB: 30 });
    expect(rec.provenance.notes.length).toBeGreaterThan(0);
  });

  it('is labelled REFERENCE and never GTO', () => {
    const rec = recommend(rfi);
    expect(rec.label).toBe('REFERENCE');
    expect(JSON.stringify(rec)).not.toMatch(/\bGTO\b/);
  });
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

describe('refusals', () => {
  it('refuses a later street and an unknown holding', () => {
    const query = makeQuery({ hero: 'CO', heroCards: 'AsKs' });
    const later = recommendPreflop({ ...query, street: 'FLOP' });
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.error.code).toBe('NOT_A_DECISION_POINT');

    const unknown = recommendPreflop(makeQuery({ hero: 'CO', heroCards: '' }));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('INVALID_HERO_CARDS');
  });
});

// ---------------------------------------------------------------------------
// Determinism and the property sweep
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('returns the identical answer for the identical query', () => {
    const spec: QuerySpec = {
      hero: 'BTN',
      actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
      heroCards: 'KsQs',
    };
    expect(recommend(spec)).toEqual(recommend(spec));
  });
});

describe('property sweep', () => {
  const sample = HAND_CLASSES.filter((_, index) => index % 7 === 0);

  const spots: readonly (readonly [string, (cards: string) => QuerySpec])[] = [
    ['RFI UTG', (heroCards) => ({ hero: 'UTG', heroCards })],
    [
      'RFI BTN',
      (heroCards) => ({ hero: 'BTN', actions: [fold('UTG'), fold('HJ'), fold('CO')], heroCards }),
    ],
    [
      'RFI SB',
      (heroCards) => ({
        hero: 'SB',
        actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN')],
        heroCards,
      }),
    ],
    [
      'VS_OPEN BTN',
      (heroCards) => ({
        hero: 'BTN',
        actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
        heroCards,
      }),
    ],
    [
      'VS_OPEN BB',
      (heroCards) => ({
        hero: 'BB',
        actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), fold('BTN'), fold('SB')],
        heroCards,
      }),
    ],
    [
      'SQUEEZE BTN',
      (heroCards) => ({
        hero: 'BTN',
        actions: [raise('UTG', 2.5), call('HJ', 2.5), fold('CO')],
        heroCards,
      }),
    ],
    [
      'OPENER_VS_3BET CO',
      (heroCards) => ({
        hero: 'CO',
        actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), raise('BTN', 7.5)],
        heroCards,
      }),
    ],
    [
      'VS_4BET BTN',
      (heroCards) => ({
        hero: 'BTN',
        actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5), raise('BTN', 7.5), raise('CO', 18)],
        heroCards,
      }),
    ],
    [
      'BLIND_VS_BLIND BB',
      (heroCards) => ({
        hero: 'BB',
        actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN'), raise('SB', 3)],
        heroCards,
      }),
    ],
    [
      'VS_ALLIN BB',
      (heroCards) => ({
        hero: 'BB',
        actions: [shove('UTG', 100), fold('HJ'), fold('CO'), fold('BTN'), fold('SB')],
        noWager: true,
        heroCards,
      }),
    ],
  ];

  it.each(spots)('%s is legal and normalized for every sampled class', (_name, build) => {
    for (const handClass of sample) {
      const spec = build(cardsFor(handClass.key));
      const rec = recommend(spec);
      expectWellFormed(rec, spec);
      expect(rec.handClass.key).toBe(handClass.key);
    }
  });

  it('covers a tight-bounds engine without ever emitting an illegal size', () => {
    for (const handClass of sample) {
      const spec: QuerySpec = {
        hero: 'BTN',
        actions: [fold('UTG'), fold('HJ'), raise('CO', 2.5)],
        heroCards: cardsFor(handClass.key),
        wagerMinToBB: 6,
        wagerMaxToBB: 6.5,
      };
      expectWellFormed(recommend(spec), spec);
    }
  });
});
