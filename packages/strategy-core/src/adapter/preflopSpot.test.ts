/**
 * Preflop spot classification driven from REAL poker-core hands.
 *
 * It lives in `src/adapter/` because that is the only directory allowed to import
 * `@gto-self/poker-core`; `../preflop/spot.test.ts` covers the neutral edge cases that no
 * legal hand can reach.
 */
import { unwrap } from '@gto-self/shared';
import { allIn, call, fold, raiseTo, type HandCommand, type SeatIndex } from '@gto-self/poker-core';
import { describe, expect, it } from 'vitest';
import { classifyPreflopSpot, type PreflopSpotClassification } from '../preflop/spot.js';
import { buildStrategyQuery } from './fromHandState.js';
import { BB, sixHanded } from './testHands.js';

function spotOf(heroSeat: SeatIndex, commands: readonly HandCommand[]): PreflopSpotClassification {
  const hand = sixHanded(heroSeat, commands);
  return classifyPreflopSpot(unwrap(buildStrategyQuery(hand.state)));
}

/** seat 0 = BTN, 1 = SB, 2 = BB, 3 = UTG, 4 = HJ, 5 = CO. */
const BTN = 0 as SeatIndex;
const BB_SEAT = 2 as SeatIndex;
const UTG = 3 as SeatIndex;
const HJ = 4 as SeatIndex;
const CO = 5 as SeatIndex;

describe('canonical preflop families', () => {
  it('RFI — folded to the button', () => {
    const spot = spotOf(BTN, [fold(), fold(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('RFI');
    expect(spot.heroPosition).toBe('BTN');
    expect(spot.raiseCount).toBe(0);
    expect(spot.limperCount).toBe(0);
    expect(spot.openerPosition).toBeNull();
    expect(spot.aggressorPosition).toBeNull();
    expect(spot.openSizeMbb).toBeNull();
    expect(spot.heroVsAggressor).toBeNull();
    expect(spot.lineupSize).toBe(6);
    expect(spot.playersRemaining).toBe(3);
    expect(spot.facingAllIn).toBe(false);
  });

  it('VS_LIMP — one limper in front', () => {
    const spot = spotOf(BTN, [call(), fold(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('VS_LIMP');
    expect(spot.limperCount).toBe(1);
    expect(spot.raiseCount).toBe(0);
  });

  it('VS_OPEN — one open, no callers', () => {
    const spot = spotOf(BTN, [raiseTo(BB(2.5)), fold(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('VS_OPEN');
    expect(spot.raiseCount).toBe(1);
    expect(spot.openerPosition).toBe('UTG');
    expect(spot.aggressorPosition).toBe('UTG');
    expect(spot.openSizeMbb).toBe(BB(2.5));
    expect(spot.openSizeBB).toBeCloseTo(2.5, 12);
    expect(spot.coldCallerCount).toBe(0);
    expect(spot.heroVsAggressor).toBe('IP');
    expect(spot.heroHasActed).toBe(false);
  });

  it('SQUEEZE — an open, a cold caller, hero not yet in', () => {
    const spot = spotOf(BTN, [raiseTo(BB(2.5)), call(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('SQUEEZE');
    expect(spot.raiseCount).toBe(1);
    expect(spot.coldCallerCount).toBe(1);
    expect(spot.callerCount).toBe(1);
    expect(spot.openerPosition).toBe('UTG');
  });

  it('OPEN_PLUS_CALLER — hero limped, faces a raise plus a caller', () => {
    const spot = spotOf(UTG, [call(), raiseTo(BB(3)), call(), fold(), fold(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('OPEN_PLUS_CALLER');
    expect(spot.heroHasActed).toBe(true);
    expect(spot.limperCount).toBe(1);
    expect(spot.coldCallerCount).toBe(1);
    expect(spot.aggressorPosition).toBe('HJ');
  });

  it('BLIND_VS_BLIND — folded to the small blind, who raises', () => {
    const spot = spotOf(BB_SEAT, [fold(), fold(), fold(), fold(), raiseTo(BB(3))]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('BLIND_VS_BLIND');
    expect(spot.blindVsBlind).toBe(true);
    expect(spot.playersRemaining).toBe(2);
    expect(spot.aggressorPosition).toBe('SB');
    expect(spot.heroVsAggressor).toBe('IP');
  });

  it('OPENER_VS_3BET — hero opened and faces a 3-bet', () => {
    const spot = spotOf(UTG, [raiseTo(BB(2.5)), fold(), fold(), raiseTo(BB(8)), fold(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('OPENER_VS_3BET');
    expect(spot.raiseCount).toBe(2);
    expect(spot.openerPosition).toBe('UTG');
    expect(spot.aggressorPosition).toBe('BTN');
    expect(spot.openSizeMbb).toBe(BB(2.5));
    expect(spot.lastAggressionToMbb).toBe(BB(8));
    expect(spot.heroVsAggressor).toBe('OOP');
    expect(spot.heroHasActed).toBe(true);
  });

  it('COLD_4BET — hero faces an open and a 3-bet without having acted', () => {
    const spot = spotOf(CO, [raiseTo(BB(2.5)), raiseTo(BB(8))]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('COLD_4BET');
    expect(spot.raiseCount).toBe(2);
    expect(spot.heroHasActed).toBe(false);
    expect(spot.openerPosition).toBe('UTG');
    expect(spot.aggressorPosition).toBe('HJ');
  });

  it('VS_4BET — hero 3-bet and faces a 4-bet', () => {
    const spot = spotOf(BTN, [
      raiseTo(BB(2.5)),
      fold(),
      fold(),
      raiseTo(BB(8)),
      fold(),
      fold(),
      raiseTo(BB(20)),
    ]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('VS_4BET');
    expect(spot.raiseCount).toBe(3);
    expect(spot.aggressorPosition).toBe('UTG');
    expect(spot.lastAggressionToMbb).toBe(BB(20));
    expect(spot.heroVsAggressor).toBe('IP');
  });

  it('VS_ALLIN — a shove in front collapses the tree', () => {
    const spot = spotOf(BTN, [allIn(), fold(), fold()]);
    expect(spot.kind).toBe('SPOT');
    if (spot.kind !== 'SPOT') return;
    expect(spot.family).toBe('VS_ALLIN');
    expect(spot.facingAllIn).toBe(true);
    expect(spot.raiseCount).toBe(1);
    expect(spot.aggressorPosition).toBe('UTG');
  });
});

describe('unsupported preflop lines', () => {
  it('a caller facing a 3-bet is refused, not guessed at', () => {
    const spot = spotOf(HJ, [
      raiseTo(BB(2.5)),
      call(),
      raiseTo(BB(9)),
      fold(),
      fold(),
      fold(),
      fold(),
    ]);
    expect(spot.kind).toBe('UNSUPPORTED');
    if (spot.kind !== 'UNSUPPORTED') return;
    expect(spot.reason).toBe('CALLER_FACING_THREE_BET');
    expect(spot.raiseCount).toBe(2);
    expect(spot.heroPosition).toBe('HJ');
  });
});

describe('determinism', () => {
  it('the same line classifies identically every time', () => {
    const line: readonly HandCommand[] = [raiseTo(BB(2.5)), call(), fold()];
    expect(spotOf(BTN, line)).toEqual(spotOf(BTN, line));
  });
});
