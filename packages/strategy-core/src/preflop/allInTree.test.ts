/**
 * R1 BLOCKER B1 and MAJOR M6, and the invariants that keep them fixed.
 *
 * B1: an all-in in front of hero used to collapse EVERY spot to `VS_ALLIN` — a call/fold
 * table — even when hero still had a legal raise and other players were still to act. Hero
 * flat-called AA for 3bb with four live opponents behind the shove. `VS_ALLIN` is now
 * reserved for a tree that has genuinely collapsed; everything else keeps its family and
 * carries `facingAllIn`.
 *
 * M6: heads-up, poker-core labels the button `BTN` (or `SB`) and that seat used to open a
 * 6-max table authored for a seat with four (or one) players behind it.
 *
 * Every test here FAILS on the pre-fix source; the report records which assertion caught what.
 */
import { describe, expect, it } from 'vitest';
import { BPS_TOTAL } from '../bps.js';
import { HAND_CLASSES } from '../range/handClass.js';
import type { StrategyActionKind, StrategyQuery } from '../types.js';
import { recommendPreflop } from './policy.js';
import { percentageOf } from './notation.js';
import type { StrategyRecommendation } from './recommendation.js';
import { classifyPreflopSpot, type PreflopSpotFamily } from './spot.js';
import { RFI_HEADS_UP_BUTTON, RFI_RANGES } from './tables.js';
import { call, fold, makeQuery, raise, shove, type QuerySpec } from './testQuery.js';

function recommend(spec: QuerySpec): StrategyRecommendation {
  const result = recommendPreflop(makeQuery(spec));
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.code}`);
  return result.value;
}

function frequencyOf(rec: StrategyRecommendation, kind: StrategyActionKind): number {
  return rec.actions.find((action) => action.kind === kind)?.frequencyBps ?? 0;
}

/** RAISE and ALL_IN both count: a jam over a shove is aggression, not a call. */
function aggressionBps(rec: StrategyRecommendation): number {
  return frequencyOf(rec, 'RAISE') + frequencyOf(rec, 'ALL_IN');
}

function familyOf(query: StrategyQuery): PreflopSpotFamily | 'UNSUPPORTED' {
  const spot = classifyPreflopSpot(query);
  return spot.kind === 'SPOT' ? spot.family : 'UNSUPPORTED';
}

// ---------------------------------------------------------------------------
// B1 — the reported counterexample
// ---------------------------------------------------------------------------

describe('B1 — a short shove with players behind does not collapse the tree', () => {
  /** The exact scenario from the finding: a 3bb open-shove, hero HJ, four seats behind. */
  const shortShove: QuerySpec = { hero: 'HJ', actions: [shove('UTG', 3)] };

  it('keeps the underlying family and reports facingAllIn', () => {
    const query = makeQuery(shortShove);
    // Preconditions the classification rule turns on — assert them, do not assume them.
    expect(query.legalActions.wager).not.toBeNull();
    expect(query.legalActions.wager?.onlyAllIn).toBe(false);
    expect(query.activeOpponentCount).toBe(5);

    const spot = classifyPreflopSpot(query);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('VS_OPEN');
    expect(spot.facingAllIn).toBe(true);
    expect(spot.allInCollapsedTree).toBe(false);
  });

  it('AA never pure-flats a short open-shove with live players behind', () => {
    const rec = recommend({ ...shortShove, heroCards: 'AsAd' });
    expect(rec.family).toBe('VS_OPEN');
    expect(frequencyOf(rec, 'CALL')).toBeLessThan(BPS_TOTAL);
    expect(aggressionBps(rec)).toBe(BPS_TOTAL);
  });

  it('KK raises too, and the raise is a legal size', () => {
    const rec = recommend({ ...shortShove, heroCards: 'KsKd' });
    const wager = makeQuery(shortShove).legalActions.wager;
    expect(wager).not.toBeNull();
    if (wager === null) return;
    expect(aggressionBps(rec)).toBe(BPS_TOTAL);
    const raiseAction = rec.actions.find((a) => a.kind === 'RAISE' || a.kind === 'ALL_IN');
    expect(raiseAction).toBeDefined();
    expect(raiseAction?.toAmountMbb ?? 0).toBeGreaterThanOrEqual(wager.minToAmountMbb);
    expect(raiseAction?.toAmountMbb ?? 0).toBeLessThanOrEqual(wager.maxToAmountMbb);
  });

  it('reports both the family rule and the all-in adjustment', () => {
    // KJo is inside the continue tier (a call) but outside the pot-odds all-in tier, so the
    // adjustment is what moves it to a fold — and it must say so.
    const rec = recommend({
      hero: 'BTN',
      actions: [shove('UTG', 3), fold('HJ'), fold('CO')],
      heroCards: 'KhJd',
    });
    expect(rec.provenance.ruleIds).toContain('VS_OPEN_MIX');
    expect(rec.provenance.ruleIds).toContain('FACING_ALLIN_IN_TREE');
    expect(rec.provenance.quality).toBe('HEURISTIC');
    expect(rec.provenance.notes.some((note) => note.startsWith('FACING_ALLIN_IN_TREE:'))).toBe(
      true,
    );
    expect(rec.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'FACING_ALL_IN', token: 'RAISE_STILL_AVAILABLE' }),
    );
  });

  it('a marginal hand the price does not justify folds rather than calling off', () => {
    const spec: QuerySpec = {
      hero: 'BTN',
      actions: [shove('UTG', 3), fold('HJ'), fold('CO')],
      heroCards: 'KhJd',
    };
    // Without the all-in adjustment KJo is a pure call here: it is inside the continue tier.
    const rec = recommend(spec);
    expect(frequencyOf(rec, 'CALL')).toBe(0);
    expect(frequencyOf(rec, 'FOLD')).toBe(BPS_TOTAL);
    // The same hand against the same open that is NOT all-in still calls.
    const notAllIn = recommend({ ...spec, actions: [raise('UTG', 3), fold('HJ'), fold('CO')] });
    expect(frequencyOf(notAllIn, 'CALL')).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// B1 — the boundary of the new classification rule, in both directions
// ---------------------------------------------------------------------------

describe('B1 — VS_ALLIN is exactly the collapsed tree', () => {
  it('collapses when hero has no legal aggression', () => {
    const spec: QuerySpec = {
      hero: 'HJ',
      actions: [shove('UTG', 3)],
      noWager: true,
      legalOverrides: { allIn: null },
    };
    expect(familyOf(makeQuery(spec))).toBe('VS_ALLIN');
  });

  it('collapses when hero can only call off the rest of the stack', () => {
    // The engine offers no wager and hero's all-in is a CALL, not a raise.
    const spec: QuerySpec = {
      hero: 'BB',
      actions: [shove('UTG', 100), fold('HJ'), fold('CO'), fold('BTN'), fold('SB')],
      noWager: true,
    };
    const query = makeQuery(spec);
    expect(query.legalActions.allIn?.effect).toBe('CALL');
    expect(familyOf(query)).toBe('VS_ALLIN');
  });

  it('collapses when nobody but the shover is left to act, even with a legal raise', () => {
    const spec: QuerySpec = {
      hero: 'BB',
      actions: [fold('UTG'), fold('HJ'), fold('CO'), fold('BTN'), shove('SB', 3)],
    };
    const query = makeQuery(spec);
    expect(query.legalActions.wager).not.toBeNull();
    expect(familyOf(query)).toBe('VS_ALLIN');
  });

  it('does NOT collapse while a legal raise and a live opponent both remain', () => {
    expect(familyOf(makeQuery({ hero: 'HJ', actions: [shove('UTG', 3)] }))).toBe('VS_OPEN');
  });

  it('an opponent who is already all-in does not count as live', () => {
    // 3-handed: BTN shoves, SB calls all-in, hero BB. Hero can legally raise, but the only
    // two opponents are both committed, so the tree HAS collapsed. Without the all-in-status
    // check this is a SQUEEZE (an open plus a cold caller).
    const spec: QuerySpec = {
      hero: 'BB',
      dealtInCount: 3,
      actions: [shove('BTN', 40), { position: 'SB', kind: 'ALL_IN', toBB: 40, allIn: true }],
    };
    const query = makeQuery(spec);
    expect(query.legalActions.wager).not.toBeNull();
    expect(familyOf(query)).toBe('VS_ALLIN');
  });

  it('keeps the 3-bet family when hero opened and faces an all-in 3-bet with seats behind', () => {
    const spec: QuerySpec = { hero: 'UTG', actions: [raise('UTG', 2.5), shove('HJ', 25)] };
    const query = makeQuery(spec);
    expect(query.legalActions.wager).not.toBeNull();
    expect(familyOf(query)).toBe('OPENER_VS_3BET');
    const rec = recommend({ ...spec, heroCards: 'AsAd' });
    expect(aggressionBps(rec)).toBe(BPS_TOTAL);
  });

  it('keeps the squeeze family when the open was a shove and a caller is in', () => {
    const spec: QuerySpec = {
      hero: 'BTN',
      actions: [shove('UTG', 8), call('HJ', 8), fold('CO')],
    };
    expect(familyOf(makeQuery(spec))).toBe('SQUEEZE');
    const rec = recommend({ ...spec, heroCards: 'AsAd' });
    expect(aggressionBps(rec)).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// B1 — sizing over a shove
// ---------------------------------------------------------------------------

describe('B1 — the raise over a shove is sized legally', () => {
  it('uses the family formula while it leaves a stack behind', () => {
    const rec = recommend({ hero: 'HJ', actions: [shove('UTG', 3)], heroCards: 'AsAd' });
    const sizing = rec.primaryAction.sizing;
    expect(sizing).not.toBeNull();
    // 3-bet sizing off the 3bb open, not a jam: hero keeps a stack to play with.
    // (HJ acts after UTG postflop, so the IP multiplier applies.)
    expect(sizing?.ruleId).toBe('SIZE_THREE_BET_IP');
    expect(rec.primaryAction.isAllIn).toBe(false);
  });

  it('jams once the family formula reaches the commitment midpoint', () => {
    // A 25bb shove: 2.5x the 3-bet is 62.5bb of a 100bb stack, past the midpoint.
    const rec = recommend({
      hero: 'UTG',
      actions: [raise('UTG', 2.5), shove('HJ', 25)],
      heroCards: 'AsAd',
    });
    expect(rec.primaryAction.sizing?.ruleId).toBe('SIZE_FACING_ALLIN_JAM');
    expect(rec.primaryAction.isAllIn).toBe(true);
  });

  it('never emits a raise the engine does not offer', () => {
    const spec: QuerySpec = {
      hero: 'HJ',
      actions: [shove('UTG', 3)],
      wagerOnlyAllIn: true,
      heroCards: 'AsAd',
    };
    const rec = recommend(spec);
    expect(rec.actions.some((a) => a.kind === 'RAISE')).toBe(false);
    expect(frequencyOf(rec, 'ALL_IN')).toBe(BPS_TOTAL);
  });
});

// ---------------------------------------------------------------------------
// B1 — the sweep the reviewer ran, as a standing test
// ---------------------------------------------------------------------------

describe('B1 sweep — no premium hand ever pure-flats a beatable shove', () => {
  const SHOVERS = ['UTG', 'HJ', 'CO', 'BTN'] as const;
  const HEROES = ['HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
  const SHOVE_BB = [2.5, 3, 5, 8, 12, 20, 30];
  const LINEUPS = [6, 5, 4];
  const PREMIUM = ['AsAd', 'KsKd'];

  it('sweeps every reachable short-shove spot', () => {
    let spots = 0;
    let withLiveTree = 0;
    let collapsed = 0;
    for (const lineup of LINEUPS) {
      for (const shover of SHOVERS) {
        for (const hero of HEROES) {
          for (const shoveBB of SHOVE_BB) {
            for (const heroCards of PREMIUM) {
              // `noWager` is the engine's own "hero cannot raise" answer, which is one of the
              // two conditions that collapse the tree — so both branches are swept.
              for (const noWager of [false, true]) {
                const spec: QuerySpec = {
                  hero,
                  dealtInCount: lineup,
                  actions: [shove(shover, shoveBB)],
                  heroCards,
                  noWager,
                  ...(noWager ? { legalOverrides: { allIn: null } } : {}),
                };
                let query: StrategyQuery;
                try {
                  query = makeQuery(spec);
                } catch {
                  continue; // that seat is not dealt in at this lineup size
                }
                if (query.heroPosition === shover) continue;
                const spot = classifyPreflopSpot(query);
                if (spot.kind !== 'SPOT') continue;
                spots += 1;
                const result = recommendPreflop(query);
                expect(result.ok).toBe(true);
                if (!result.ok) continue;
                const rec = result.value;

                // Whatever the spot, the output stays well formed.
                const total = rec.actions.reduce((sum, a) => sum + a.frequencyBps, 0);
                expect(total).toBe(BPS_TOTAL);
                for (const action of rec.actions) expect(action.frequencyBps % 500).toBe(0);

                if (!spot.allInCollapsedTree) {
                  withLiveTree += 1;
                  // THE B1 ASSERTION. A legal raise plus a live opponent behind means a
                  // premium holding must never be a pure call.
                  expect([
                    `${lineup}-handed ${hero} vs ${shover} shove ${shoveBB}bb ${heroCards}`,
                    aggressionBps(rec),
                  ]).toEqual([
                    `${lineup}-handed ${hero} vs ${shover} shove ${shoveBB}bb ${heroCards}`,
                    BPS_TOTAL,
                  ]);
                  expect(rec.family).not.toBe('VS_ALLIN');
                } else {
                  collapsed += 1;
                  // The collapsed branch is unchanged behaviour: call or fold, never a raise.
                  expect(rec.family).toBe('VS_ALLIN');
                  expect(rec.actions.some((a) => a.kind === 'RAISE')).toBe(false);
                }
              }
            }
          }
        }
      }
    }
    expect(spots).toBeGreaterThan(400);
    expect(withLiveTree).toBeGreaterThan(100);
    expect(collapsed).toBeGreaterThan(100);
  });

  it('AA never pure-flats a short shove with two or more live opponents behind', () => {
    for (const shoveBB of [2.5, 3, 4, 6, 10]) {
      const spec: QuerySpec = { hero: 'CO', actions: [shove('UTG', shoveBB)], heroCards: 'AsAd' };
      const query = makeQuery(spec);
      const spot = classifyPreflopSpot(query);
      expect(spot.kind).toBe('SPOT');
      if (spot.kind !== 'SPOT') continue;
      expect(spot.allInCollapsedTree).toBe(false);
      const rec = recommend(spec);
      expect([shoveBB, frequencyOf(rec, 'CALL')]).toEqual([shoveBB, 0]);
      expect([shoveBB, aggressionBps(rec)]).toEqual([shoveBB, BPS_TOTAL]);
    }
  });

  it('every class still lands on a legal, quantized answer facing an in-tree shove', () => {
    for (const handClass of HAND_CLASSES) {
      const cards = classToCards(handClass.key);
      const rec = recommend({ hero: 'BTN', actions: [shove('UTG', 6)], heroCards: cards });
      const total = rec.actions.reduce((sum, a) => sum + a.frequencyBps, 0);
      expect([handClass.key, total]).toEqual([handClass.key, BPS_TOTAL]);
      for (const action of rec.actions) {
        expect([handClass.key, action.frequencyBps % 500]).toEqual([handClass.key, 0]);
      }
    }
  });
});

/** `'AKs'` -> `'AhKh'`, `'AKo'` -> `'AhKd'`, `'AA'` -> `'AhAd'`. */
function classToCards(key: string): string {
  const high = key[0] ?? 'A';
  const low = key[1] ?? 'A';
  if (key.length === 2) return `${high}h${low}d`;
  return key.endsWith('s') ? `${high}h${low}h` : `${high}h${low}d`;
}

// ---------------------------------------------------------------------------
// M6 — the heads-up button
// ---------------------------------------------------------------------------

describe('M6 — the heads-up button opens its own table', () => {
  it('does not reuse the 6-max BTN list when the button is labelled BTN', () => {
    const rec = recommend({ hero: 'BTN', dealtInCount: 2, heroCards: 'Kh7d' });
    expect(rec.family).toBe('RFI');
    expect(rec.provenance.ruleIds).toContain('RFI_HEADS_UP_BUTTON');
    expect(rec.provenance.ruleIds).not.toContain('RFI_TABLE');
    // K7o is outside the 6-max BTN list (`K8o+`) and inside the heads-up table.
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
  });

  it('does the same under the other heads-up button label', () => {
    const rec = recommend({
      hero: 'SB',
      dealtInCount: 2,
      headsUpButtonLabel: 'SB',
      heroCards: 'Kh7d',
    });
    expect(rec.provenance.ruleIds).toContain('RFI_HEADS_UP_BUTTON');
    expect(frequencyOf(rec, 'RAISE')).toBe(BPS_TOTAL);
  });

  it('states its limitation in the structured explanation and stays HEURISTIC', () => {
    const rec = recommend({ hero: 'BTN', dealtInCount: 2, heroCards: 'Kh7d' });
    expect(rec.provenance.quality).toBe('HEURISTIC');
    expect(rec.explanation.features).toContainEqual(
      expect.objectContaining({ id: 'HEADS_UP_BUTTON_APPROXIMATION' }),
    );
    const note = rec.provenance.notes.find((n) => n.startsWith('RFI_HEADS_UP_BUTTON:'));
    expect(note).toBeDefined();
    // The note must SAY it is a floor, not merely be tagged HEURISTIC.
    expect(note).toMatch(/FLOOR/);
    expect(rec.provenance.environmentCompatibility.status).toBe('DIVERGENT');
  });

  it('is wider than the 6-max table it used to borrow', () => {
    const btn = RFI_RANGES.BTN;
    if (btn === null) throw new Error('missing table');
    expect(percentageOf(RFI_HEADS_UP_BUTTON) - percentageOf(btn)).toBeGreaterThan(0.05);
  });

  it('leaves six-handed RFI untouched', () => {
    const rec = recommend({ hero: 'BTN', actions: [fold('UTG'), fold('HJ'), fold('CO')] });
    expect(rec.provenance.ruleIds).toContain('RFI_TABLE');
    expect(rec.provenance.ruleIds).not.toContain('RFI_HEADS_UP_BUTTON');
  });
});

// ---------------------------------------------------------------------------
// MINOR-1 — a short all-in is not a betting round
// ---------------------------------------------------------------------------

describe('MINOR-1 — tree depth counts full raises only', () => {
  const spec: QuerySpec = {
    hero: 'UTG',
    actions: [
      raise('UTG', 2.5),
      // A 3bb all-in over a 2.5bb open raises the price but is NOT a full raise.
      { position: 'HJ', kind: 'ALL_IN', toBB: 3, allIn: true, fullRaise: false },
      fold('CO'),
      raise('BTN', 9),
      fold('SB'),
      fold('BB'),
    ],
  };

  it('calls the reported line a 3-bet spot, not a cold 5-bet', () => {
    const spot = classifyPreflopSpot(makeQuery(spec));
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.raiseCount).toBe(2);
    expect(spot.family).toBe('OPENER_VS_3BET');
  });

  it('answers AA with a 4-bet rather than a flat from the fallback', () => {
    const rec = recommend({ ...spec, heroCards: 'AsAd' });
    expect(rec.family).toBe('OPENER_VS_3BET');
    expect(aggressionBps(rec)).toBe(BPS_TOTAL);
  });

  it('still counts a full-raise all-in as a betting round', () => {
    const spot = classifyPreflopSpot(
      makeQuery({ hero: 'UTG', actions: [raise('UTG', 2.5), shove('HJ', 25)] }),
    );
    expect(spot.kind).toBe('SPOT');
    if (spot.kind === 'SPOT') expect(spot.raiseCount).toBe(2);
  });
});
