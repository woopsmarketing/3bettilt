/**
 * Informational latency for the equity engine. Every number is LOGGED and none is asserted:
 * a hard threshold would fail the suite on a busy machine rather than tell us something true
 * (the convention B1's benchmark set). The numbers that end up in the WP report come from
 * here.
 *
 * The only assertions are that each measured call actually succeeded and that the method
 * label matches what the budget should have produced — those ARE facts about the code, not
 * about the machine.
 */
import { parseCards, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { uniformRange } from '../range/weights.js';
import { equityVsRange, equityVsRanges } from './equity.js';
import { rangeVsRangeEquity } from './rangeEquity.js';
import { buildStrengthDistribution } from './strength.js';

function cards(text: string): Card[] {
  const parsed = parseCards(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

interface Measured {
  readonly ms: number;
  readonly method: string;
  readonly runouts: number;
  readonly trials: number;
}

function measure(
  label: string,
  run: () => { method: string; evaluatedRunouts: number; evaluatedTrials: number },
): Measured {
  const started = performance.now();
  const value = run();
  const ms = performance.now() - started;
  const measured: Measured = {
    ms,
    method: value.method,
    runouts: value.evaluatedRunouts,
    trials: value.evaluatedTrials,
  };
  console.log(
    `[bench] ${label.padEnd(34)} ${ms.toFixed(1).padStart(7)} ms  ${measured.method.padEnd(11)} runouts=${String(measured.runouts).padStart(7)} trials=${measured.trials.toLocaleString('en-US')}`,
  );
  return measured;
}

const HERO = cards('Ah Kd');
const FLOP = cards('2c 5d 7s');
const TURN = cards('2c 5d 7s 9h');
const RIVER = cards('2c 5d 7s 9h Jc');

describe('equity latency (informational)', () => {
  it('heads-up against a full 1326-combo uniform range, every street', () => {
    const villain = uniformRange();
    // Warm up so the numbers are steady-state rather than JIT tiering.
    equityVsRange(HERO, TURN, villain);

    const river = measure('HU river (exact)', () => {
      const result = equityVsRange(HERO, RIVER, villain);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    const turn = measure('HU turn (exact)', () => {
      const result = equityVsRange(HERO, TURN, villain);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    const flop = measure('HU flop (exact)', () => {
      const result = equityVsRange(HERO, FLOP, villain);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });

    expect(river.method).toBe('EXACT');
    expect(turn.method).toBe('EXACT');
    expect(flop.method).toBe('EXACT');
    expect(flop.runouts).toBe(1081);
  }, 300_000);

  it('heads-up flop with the runout count bounded', () => {
    const villain = uniformRange();
    for (const samples of [128, 256, 512]) {
      const bounded = measure(`HU flop (subsampled ${samples})`, () => {
        const result = equityVsRange(HERO, FLOP, villain, { maxRunoutSamples: samples });
        if (!result.ok) throw new Error(result.error.message);
        return result.value;
      });
      expect(bounded.method).toBe('SUBSAMPLED');
    }
  }, 300_000);

  it('three-way flop, bounded', () => {
    const threeWay = measure('3-way flop (bounded)', () => {
      const result = equityVsRanges(HERO, FLOP, [uniformRange(), uniformRange()]);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    expect(threeWay.method).toBe('SUBSAMPLED');
  }, 300_000);

  it('preflop, bounded and exact', () => {
    const bounded = measure('preflop HU (bounded)', () => {
      const result = equityVsRange(HERO, [], uniformRange());
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    expect(bounded.method).toBe('SUBSAMPLED');
  }, 300_000);

  it('range versus range', () => {
    const uniform = uniformRange();
    const river = measure('range-vs-range river (exact)', () => {
      const result = rangeVsRangeEquity(uniform, uniform, RIVER);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    const turn = measure('range-vs-range turn', () => {
      const result = rangeVsRangeEquity(uniform, uniform, TURN);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    const flop = measure('range-vs-range flop (bounded)', () => {
      const result = rangeVsRangeEquity(uniform, uniform, FLOP);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    });
    expect(river.method).toBe('EXACT');
    expect(turn.method).toBe('EXACT');
    expect(flop.method).toBe('SUBSAMPLED');
  }, 300_000);

  it('strength distribution over a full range', () => {
    const started = performance.now();
    const dist = buildStrengthDistribution(uniformRange(), FLOP);
    const ms = performance.now() - started;
    if (!dist.ok) throw new Error(dist.error.message);
    console.log(
      `[bench] ${'strength distribution (flop)'.padEnd(34)} ${ms.toFixed(1).padStart(7)} ms  combos=${dist.value.entries.length}`,
    );
    expect(dist.value.entries.length).toBe(1176);
  }, 60_000);
});
