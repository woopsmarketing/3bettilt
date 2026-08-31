/**
 * ENGINE-BACKED regression for the PREFLOP legality chain (R1 M7: the preflop policy ignored
 * `legalActions.allIn.effect`, exactly as the postflop policy did).
 *
 * This file lives under `src/adapter/` because that is the one directory allowed to import
 * `@gto-self/poker-core` (ADR-0055's seam, enforced by ESLint), and because the shape only
 * exists when stacks are ASYMMETRIC: `preflop/testQuery.ts` gives every seat the same stack,
 * so it cannot express a hero who is too short to raise. That is how the defect survived the
 * preflop suite.
 *
 * The spot: 6-max, button on seat 0, hero in the BB with 8 BB against 100 BB stacks. It folds
 * to the BTN, who opens to 20 BB — more than hero's whole stack. Hero holds `As Ad`, which the
 * reference policy 3-bets at 100%, but the engine offers NO wager (hero cannot cover a raise)
 * and reports hero's shove as `effect: 'CALL'` because it is the same money as calling.
 *
 * Before the fix the recommendation was `ALL_IN 100%` — aggression the model never got to
 * choose, and a row that hides the fact that hero is simply calling off.
 */
import { Money, parseCards, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { recommendPreflop } from '../preflop/policy.js';
import { buildStrategyQuery } from './fromHandState.js';
import { BB, buildTable, playHand } from './testHands.js';

const cards = (text: string): readonly Card[] => {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};

/** Hero (BB, seat 2) has 8 BB; everyone else has 100 BB. The BTN opens past hero's stack. */
function shortHeroFacingOverRaise() {
  const table = buildTable({
    seats: [0, 1, 2, 3, 4, 5],
    buttonSeat: 0,
    heroSeat: 2,
    stacks: { 2: BB(8) },
  });
  const hand = playHand(table, [
    { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('As Ad'), revealed: false },
    { kind: 'FOLD' }, // UTG (seat 3)
    { kind: 'FOLD' }, // HJ  (seat 4)
    { kind: 'FOLD' }, // CO  (seat 5)
    { kind: 'RAISE', toAmount: Money.fromBB(20) }, // BTN (seat 0), past hero's 8 BB
    { kind: 'FOLD' }, // SB  (seat 1)
  ]);
  const built = buildStrategyQuery(hand.state, { heroSeat: 2 });
  if (!built.ok) throw new Error(`${built.error.code}: ${built.error.message}`);
  return built.value;
}

describe('preflop legality — an all-in the engine classifies as a CALL (M7)', () => {
  it('is what the real engine offers: no wager, and a shove whose effect is CALL', () => {
    const query = shortHeroFacingOverRaise();
    const legal = query.legalActions;

    // The premise. If poker-core ever stops producing this shape the test must fail loudly
    // rather than quietly assert nothing.
    expect(query.street).toBe('PREFLOP');
    expect(query.heroPosition).toBe('BB');
    expect(legal.wager).toBeNull();
    expect(legal.allIn).not.toBeNull();
    expect(legal.allIn?.effect).toBe('CALL');
    expect(legal.call).not.toBeNull();
    expect(legal.call?.isAllIn).toBe(true);
    // Same money, to the milliBB: the shove IS the call.
    expect(legal.allIn?.toAmountMbb).toBe(legal.call?.toAmountMbb);
    expect(legal.allIn?.amountMbb).toBe(legal.call?.amountMbb);
  });

  it('the policy genuinely wants to raise here, so the substitution is what decides', () => {
    const query = shortHeroFacingOverRaise();
    const rec = recommendPreflop(query);
    if (!rec.ok) throw new Error(rec.error.code);
    // AA is the 3-bet value core: the raise bucket is 100% before legality is consulted.
    expect(rec.value.family).toBe('VS_OPEN');
    expect(rec.value.provenance.ruleIds).toContain('VS_OPEN_MIX');
    expect(rec.value.provenance.ruleIds).toContain('LEGALITY_SUBSTITUTION');
  });

  it('emits ONE call row, never a same-money ALL_IN', () => {
    const query = shortHeroFacingOverRaise();
    const rec = recommendPreflop(query);
    if (!rec.ok) throw new Error(rec.error.code);
    const kinds = rec.value.actions.map((action) => action.kind);
    expect(kinds).not.toContain('ALL_IN');
    expect(kinds).toContain('CALL');
    const callAction = rec.value.actions.find((action) => action.kind === 'CALL');
    expect(callAction?.frequencyBps).toBe(10000);
    // The call commits hero's whole stack, and the action says so rather than a separate row.
    expect(callAction?.isAllIn).toBe(true);
    expect(callAction?.amountMbb).toBe(query.legalActions.call?.amountMbb);
    expect(rec.value.primaryAction.kind).toBe('CALL');
  });

  it('says in the structured explanation that the call is for the whole stack', () => {
    const query = shortHeroFacingOverRaise();
    const rec = recommendPreflop(query);
    if (!rec.ok) throw new Error(rec.error.code);
    expect(rec.value.explanation.features).toContainEqual(
      expect.objectContaining({
        id: 'CALL_COMMITS_STACK',
        mbbValue: query.legalActions.call?.amountMbb,
      }),
    );
  });

  it('still emits ALL_IN when the engine says the shove RAISES the price', () => {
    // Same table, but the BTN opens to 2.5 BB — hero's 8 BB shove is a genuine raise.
    const table = buildTable({
      seats: [0, 1, 2, 3, 4, 5],
      buttonSeat: 0,
      heroSeat: 2,
      stacks: { 2: BB(8) },
    });
    const hand = playHand(table, [
      { kind: 'SET_HOLE_CARDS', seat: 2, cards: cards('As Ad'), revealed: false },
      { kind: 'FOLD' },
      { kind: 'FOLD' },
      { kind: 'FOLD' },
      { kind: 'RAISE', toAmount: Money.fromBB(2.5) },
      { kind: 'FOLD' },
    ]);
    const built = buildStrategyQuery(hand.state, { heroSeat: 2 });
    if (!built.ok) throw new Error(built.error.code);
    const query = built.value;
    expect(query.legalActions.allIn?.effect).toBe('RAISE');

    const rec = recommendPreflop(query);
    if (!rec.ok) throw new Error(rec.error.code);
    const aggressive = rec.value.actions.filter(
      (action) => action.kind === 'RAISE' || action.kind === 'ALL_IN',
    );
    expect(aggressive.reduce((sum, action) => sum + action.frequencyBps, 0)).toBe(10000);
  });
});
