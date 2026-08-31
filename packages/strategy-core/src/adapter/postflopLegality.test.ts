/**
 * ENGINE-BACKED regression for the postflop legality chain (R1 finding: the postflop policy
 * ignored `legalActions.allIn.effect`).
 *
 * This file lives under `src/adapter/` because it is the one directory allowed to import
 * `@gto-self/poker-core` (ADR-0055's seam, enforced by ESLint). That is the point: the spot
 * below is not a hand-written `StrategyQuery`, it is whatever poker-core actually offers a
 * short hero who is facing a bet larger than the stack behind. `postflop/testQuery.ts` gives
 * every seat the same stack, so it cannot express this shape at all — which is exactly how the
 * defect survived the postflop suite.
 *
 * The spot: 6-max, button on seat 0, hero in the BB with 80 BB against 100 BB stacks. BTN opens
 * 2.5 BB, hero calls, flop `Ah 7d 2c`, hero checks, BTN bets 90 BB. Hero holds `7h 7s` — a set,
 * so the model wants to be aggressive — but has 77.5 BB behind against a 90 BB bet, so the
 * engine offers no wager at all and reports the shove as `effect: 'CALL'`.
 */
import { describe, expect, it } from 'vitest';
import { Money, parseCards } from '@gto-self/shared';
import type { Card } from '@gto-self/shared';
import { recommendPostflop } from '../postflop/policy.js';
import { buildStrategyQuery } from './fromHandState.js';
import { BB, buildTable, playHand } from './testHands.js';

const cards = (text: string): readonly Card[] => {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};

/** Hero (BB, seat 2) is short; everyone else has 100 BB. */
function shortHeroFacingOverBet() {
  const table = buildTable({
    seats: [0, 1, 2, 3, 4, 5],
    buttonSeat: 0,
    heroSeat: 2,
    stacks: { 2: BB(80) },
  });
  const hand = playHand(table, [
    { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('7h 7s'), revealed: false },
    { kind: 'FOLD' }, // UTG
    { kind: 'FOLD' }, // HJ
    { kind: 'FOLD' }, // CO
    { kind: 'RAISE', toAmount: Money.fromBB(2.5) }, // BTN
    { kind: 'FOLD' }, // SB
    { kind: 'CALL' }, // BB, hero
    { kind: 'DEAL_BOARD', cards: cards('Ah 7d 2c') },
    { kind: 'CHECK' }, // BB, hero
    { kind: 'BET', toAmount: Money.fromBB(90) }, // BTN over-bets past hero's stack
  ]);
  const built = buildStrategyQuery(hand.state, { heroSeat: 2 });
  if (!built.ok) throw new Error(`${built.error.code}: ${built.error.message}`);
  return built.value;
}

describe('postflop legality — an all-in the engine classifies as a CALL', () => {
  it('is what the real engine offers: no wager, and a shove whose effect is CALL', () => {
    const query = shortHeroFacingOverBet();
    const legal = query.legalActions;

    // The premise. If poker-core ever stops producing this shape the test must fail loudly
    // rather than quietly assert nothing.
    expect(legal.wager).toBeNull();
    expect(legal.wagerBlockedReason).toBe('INSUFFICIENT_STACK');
    expect(legal.allIn).not.toBeNull();
    expect(legal.allIn?.effect).toBe('CALL');
    expect(legal.call).not.toBeNull();
    expect(legal.call?.isAllIn).toBe(true);
    // Same money, to the milliBB: the shove IS the call.
    expect(legal.allIn?.toAmountMbb).toBe(legal.call?.toAmountMbb);
    expect(legal.allIn?.amountMbb).toBe(legal.call?.amountMbb);
    // And the model genuinely wants to aggress here, so the aggressive bucket is non-empty.
    const rec = recommendPostflop(query);
    if (!rec.ok) throw new Error(rec.error.code);
    expect(rec.value.scoring.mix.aggressiveBps).toBeGreaterThan(0);
  });

  it('emits ONE call row, not a call beside a same-money ALL_IN', () => {
    const query = shortHeroFacingOverBet();
    const rec = recommendPostflop(query);
    if (!rec.ok) throw new Error(rec.error.code);

    const kinds = rec.value.actions.map((action) => action.kind);
    expect(kinds).not.toContain('ALL_IN');
    expect(kinds).toContain('CALL');

    const call = rec.value.actions.find((action) => action.kind === 'CALL');
    expect(call).toBeDefined();
    // The aggressive mass was MERGED into the call, not dropped: the call carries the whole
    // non-fold frequency the model produced.
    const foldBps = rec.value.actions
      .filter((action) => action.kind === 'FOLD')
      .reduce((sum, action) => sum + action.frequencyBps, 0);
    expect(call?.frequencyBps).toBe(10000 - foldBps);
    // The call IS all-in, and the panel is told so.
    expect(call?.isAllIn).toBe(true);
    expect(call?.toAmountMbb).toBe(query.legalActions.call?.toAmountMbb);
  });

  it('reports the fall-through honestly, and keeps ADR-0056 arithmetic intact', () => {
    const query = shortHeroFacingOverBet();
    const rec = recommendPostflop(query);
    if (!rec.ok) throw new Error(rec.error.code);

    // The aggression was suppressed, so the gate rule is named — a reader can see WHY there
    // is no raise row instead of having to notice that there simply is not one.
    expect(rec.value.provenance.ruleIds).toContain('ALL_IN_SPR_GATE');
    expect(rec.value.provenance.ruleIds).toContain('LEGALITY_SUBSTITUTION');
    expect(
      rec.value.provenance.notes.some((note) => note.startsWith('ALL_IN_SPR_GATE:')),
    ).toBe(true);

    // ADR-0056: 5-percentage-point steps, summing to exactly 10000.
    const frequencies = rec.value.actions.map((action) => action.frequencyBps);
    for (const bps of frequencies) expect(bps % 500).toBe(0);
    expect(frequencies.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(rec.value.actions).toContain(rec.value.primaryAction);
  });

  it('still emits ALL_IN when the shove really is aggression', () => {
    // The control: identical spot, but BTN bets 20 BB, which hero's 77.5 BB CAN raise. The
    // engine then reports `effect: 'RAISE'` and the aggressive chain is free to use it.
    const table = buildTable({
      seats: [0, 1, 2, 3, 4, 5],
      buttonSeat: 0,
      heroSeat: 2,
      stacks: { 2: BB(80) },
    });
    const hand = playHand(table, [
      { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('7h 7s'), revealed: false },
      { kind: 'FOLD' },
      { kind: 'FOLD' },
      { kind: 'FOLD' },
      { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
      { kind: 'FOLD' },
      { kind: 'CALL' },
      { kind: 'DEAL_BOARD', cards: cards('Ah 7d 2c') },
      { kind: 'CHECK' },
      { kind: 'BET', toAmount: Money.fromBB(20) },
    ]);
    const built = buildStrategyQuery(hand.state, { heroSeat: 2 });
    if (!built.ok) throw new Error(built.error.code);
    expect(built.value.legalActions.allIn?.effect).toBe('RAISE');
    expect(built.value.legalActions.wager).not.toBeNull();

    const rec = recommendPostflop(built.value);
    if (!rec.ok) throw new Error(rec.error.code);
    const frequencies = rec.value.actions.map((action) => action.frequencyBps);
    for (const bps of frequencies) expect(bps % 500).toBe(0);
    expect(frequencies.reduce((a, b) => a + b, 0)).toBe(10000);
    // A raise-shaped aggression is present and is NOT collapsed into the call.
    expect(rec.value.actions.some((action) => action.kind === 'RAISE')).toBe(true);
  });
});
