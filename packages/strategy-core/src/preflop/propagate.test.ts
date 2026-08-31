/**
 * Range propagation: replaying a preflop line through the same policy the recommendation
 * uses, and the invariants a later street depends on.
 */
import { describe, expect, it } from 'vitest';
import { parseCombo, type ComboIndex } from '../range/combo.js';
import { rangePercentage, weightAt } from '../range/weights.js';
import { percentageOf } from './notation.js';
import type { PreflopPolicyContext } from './policy.js';
import { policyRangeFor, propagatePreflopRanges } from './propagate.js';
import { RFI_RANGES } from './tables.js';
import { call, fold, makeQuery, raise, type QuerySpec } from './testQuery.js';

const combo = (text: string): ComboIndex => {
  const parsed = parseCombo(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};

/** BTN opens, SB folds, BB calls — the canonical single-raised pot. */
const BTN_OPEN_BB_CALL: QuerySpec = {
  hero: 'BTN',
  heroCards: 'AsKs',
  actions: [fold('UTG'), fold('HJ'), fold('CO'), raise('BTN', 2.5), fold('SB'), call('BB', 2.5)],
};

function assignment(spec: QuerySpec) {
  const result = propagatePreflopRanges(makeQuery(spec));
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.code}`);
  return result.value;
}

function rangeOfSeat(spec: QuerySpec, position: string) {
  const seat = assignment(spec).seats.find((entry) => entry.position === position);
  if (seat === undefined) throw new Error(`no seat ${position}`);
  return seat;
}

describe('a single-raised pot', () => {
  it('gives the opener its positional opening range', () => {
    const btn = rangeOfSeat(BTN_OPEN_BB_CALL, 'BTN');
    expect(btn.status).toBe('IN_HAND');
    expect(weightAt(btn.range, combo('AhKh'))).toBe(10000);
    expect(weightAt(btn.range, combo('7h2d'))).toBe(0);
  });

  it('never removes hero s own cards from hero s own range', () => {
    const btn = rangeOfSeat(BTN_OPEN_BB_CALL, 'BTN');
    expect(weightAt(btn.range, combo('AsKs'))).toBe(10000);
  });

  it('excludes from the caller s range every hand the policy 3-bets at 100%', () => {
    const bb = rangeOfSeat(BTN_OPEN_BB_CALL, 'BB');
    for (const hand of ['QhQd', 'KhKd', 'AhAd', 'AhKh', 'AhKd']) {
      expect(weightAt(bb.range, combo(hand))).toBe(0);
    }
  });

  it('keeps a pure calling hand at full weight and a mixed one at its mixed weight', () => {
    const bb = rangeOfSeat(BTN_OPEN_BB_CALL, 'BB');
    expect(weightAt(bb.range, combo('9h8h'))).toBe(10000);
    // KQs is a 50/50 3-bet in the big blind's tier, so half its weight survives a call.
    expect(weightAt(bb.range, combo('KhQh'))).toBe(5000);
  });

  it('applies card removal to every seat but hero', () => {
    const bb = rangeOfSeat(BTN_OPEN_BB_CALL, 'BB');
    // Hero holds the King of spades, so the villain cannot have KsQs at all.
    expect(weightAt(bb.range, combo('KsQs'))).toBe(0);
    expect(assignment(BTN_OPEN_BB_CALL).removedCards).toHaveLength(2);
  });

  it('gives folded seats their folding branch', () => {
    const utg = rangeOfSeat(BTN_OPEN_BB_CALL, 'UTG');
    expect(utg.status).toBe('FOLDED');
    // UTG opens aces 100% of the time, so a fold cannot contain one.
    expect(weightAt(utg.range, combo('AhAd'))).toBe(0);
    expect(weightAt(utg.range, combo('7h2d'))).toBe(10000);
  });

  it('records the action each seat took', () => {
    const btn = rangeOfSeat(BTN_OPEN_BB_CALL, 'BTN');
    expect(btn.actionKinds).toEqual(['RAISE']);
    expect(rangeOfSeat(BTN_OPEN_BB_CALL, 'BB').actionKinds).toEqual(['CALL']);
  });

  it('never exceeds the basis-point ceiling', () => {
    for (const seat of assignment(BTN_OPEN_BB_CALL).seats) {
      for (let index = 0; index < 1326; index += 1) {
        expect(seat.range.bps[index] ?? 0).toBeLessThanOrEqual(10000);
      }
    }
  });

  it('is deterministic', () => {
    expect(assignment(BTN_OPEN_BB_CALL)).toEqual(assignment(BTN_OPEN_BB_CALL));
  });
});

describe('a limped pot', () => {
  const spec: QuerySpec = {
    hero: 'BB',
    heroCards: '7h2d',
    actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN'), call('SB', 1)],
  };

  it('flags an SB limp as off-policy and refuses to narrow the range', () => {
    const sb = rangeOfSeat(spec, 'SB');
    // The reference SB is raise-or-fold, so a limp has zero frequency in every class.
    // Conditioning would claim the SB can hold nothing; instead the range is untouched.
    expect(sb.offPolicy).toBe(true);
    expect(weightAt(sb.range, combo('AhAd'))).toBe(10000);
    expect(weightAt(sb.range, combo('3h2c'))).toBe(10000);
  });

  it('does not flag seats that stayed inside the policy', () => {
    expect(rangeOfSeat(BTN_OPEN_BB_CALL, 'BTN').offPolicy).toBe(false);
    expect(rangeOfSeat(BTN_OPEN_BB_CALL, 'BB').offPolicy).toBe(false);
  });
});

describe('a 3-bet pot', () => {
  const spec: QuerySpec = {
    hero: 'CO',
    heroCards: 'AsKs',
    actions: [
      fold('UTG'),
      fold('HJ'),
      raise('CO', 2.5),
      raise('BTN', 7.5),
      fold('SB'),
      fold('BB'),
      call('CO', 7.5),
    ],
  };

  it('leaves the 3-bettor with its 3-betting range and the opener with its calling range', () => {
    const btn = rangeOfSeat(spec, 'BTN');
    expect(weightAt(btn.range, combo('AhAd'))).toBe(10000);
    expect(weightAt(btn.range, combo('7h2d'))).toBe(0);

    const co = rangeOfSeat(spec, 'CO');
    // The opener 4-bets aces at 100%, so calling the 3-bet cannot contain one.
    expect(weightAt(co.range, combo('AhAd'))).toBe(0);
    // AKo is the opener's flat, and hero's own cards are never removed from hero's range.
    expect(weightAt(co.range, combo('AsKh'))).toBe(10000);
  });
});

describe('refusals and vacuum ranges', () => {
  it('refuses a later street', () => {
    const query = makeQuery({ hero: 'CO', heroCards: 'AsKs' });
    const result = propagatePreflopRanges({ ...query, street: 'FLOP' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_DECISION_POINT');
  });

  it('produces exactly the table when asked for an RFI raise range in a vacuum', () => {
    const ctx: PreflopPolicyContext = {
      family: 'RFI',
      unsupportedReason: null,
      heroPosition: 'CO',
      openerPosition: null,
      heroVsAggressor: null,
      blindVsBlind: false,
      limperCount: 0,
      coldCallerCount: 0,
      lineupSize: 6,
      potOdds: null,
      facingAllIn: false,
    };
    const table = RFI_RANGES.CO;
    expect(table).not.toBeNull();
    if (table === null) return;
    const range = policyRangeFor(ctx, 'RAISE');
    expect(rangePercentage(range)).toBeCloseTo(percentageOf(table), 10);
  });

  it('leaves hero cards in place when card removal is switched off', () => {
    const result = propagatePreflopRanges(makeQuery(BTN_OPEN_BB_CALL), {
      applyHeroCardRemoval: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bb = result.value.seats.find((seat) => seat.position === 'BB');
    expect(bb).toBeDefined();
    if (bb === undefined) return;
    expect(weightAt(bb.range, combo('KsQs'))).toBe(5000);
    expect(result.value.removedCards).toHaveLength(0);
  });
});
