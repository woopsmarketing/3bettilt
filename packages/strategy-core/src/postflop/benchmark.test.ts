/**
 * INFORMATIONAL latency benchmark, in the style of B1's and B2's.
 *
 * It asserts almost nothing about time — a CI box is not a stopwatch — and the table it prints
 * is the point. What it does assert is a ceiling per shape, chosen so a failure means a real
 * regression rather than a slow machine.
 *
 * WHICH SHAPE IS WORST (corrected 2026-09-01, R1B MAJOR-2). B3 sampled two lineups, saw the
 * 3-way flop come in faster than the heads-up flop, and concluded that a heads-up flop is the
 * worst shape because the runout enumeration shrinks multiway. It is not: the villain
 * cross-product and the per-runout strength evaluation both GROW with villain count, and a
 * WIDE multiway lineup — a limped six-way flop, where every villain range is the widest the
 * model has — costs more than heads-up. Measured here (Darwin arm64, M-series, 3 runs after a
 * warm-up):
 *
 *     HU flop 89.6 ms | 3-way flop 42.2 | 4-way flop 90.5 | 5-way flop 101.1 | 6-way flop 106.3
 *
 * So the worst shape is a SIX-WAY LIMPED FLOP at ~106 ms (~112 ms on a monotone board), which
 * leaves ~1.8x headroom against the 200 ms interaction budget on this hardware, not the ~2.3x
 * B3 reported for a shape that was not the worst. On a mid-range laptop — routinely 2-4x
 * slower — that shape can exceed 200 ms; nothing here can prove otherwise, so the assertions
 * below do not pretend to.
 *
 * That is also why only the shapes B3 measured keep the 200 ms assertion: applying it to the
 * true worst shape would encode "this machine is fast" as a correctness property. The multiway
 * cases assert a smoke ceiling instead, which catches an order-of-magnitude regression without
 * failing on slow hardware.
 *
 * Timing uses `performance.now()` for MEASUREMENT only. No recommendation depends on it: the
 * policy itself reads no clock, and every budget in `PostflopBudget` bounds an enumeration
 * size rather than wall-clock time, so a slow machine returns the identical answer (B2's rule).
 * The measurement above did NOT lead to a budget change: 106 ms is inside the budget, and
 * tightening a default enumeration to buy headroom that is not needed would trade real
 * accuracy (`EXACT` -> `SUBSAMPLED`, which the UI reports) for nothing.
 */
import { describe, expect, it } from 'vitest';
import { recommendPostflop } from './policy.js';
import {
  bet,
  check,
  makePostflopQuery,
  pfCall,
  pfFold,
  pfRaise,
  type PostflopActionSpec,
  type PostflopQuerySpec,
} from './testQuery.js';

const HU: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfFold('SB'),
  pfCall('BB', 2.5),
];

const THREE_WAY: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfCall('SB', 2.5),
  pfCall('BB', 2.5),
];

/** CO opens, BTN, SB and BB all call: four players to the flop. */
const FOUR_WAY: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfRaise('CO', 2.5),
  pfCall('BTN', 2.5),
  pfCall('SB', 2.5),
  pfCall('BB', 2.5),
];

/** A limped five-way pot: UTG folds, everyone else comes in for one blind. */
const FIVE_WAY_LIMPED: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfCall('HJ', 1),
  pfCall('CO', 1),
  pfCall('BTN', 1),
  pfCall('SB', 1),
  { street: 'PREFLOP', position: 'BB', kind: 'CHECK' },
];

/** A limped six-way pot — the widest lineup the product supports. */
const SIX_WAY_LIMPED: readonly PostflopActionSpec[] = [
  pfCall('UTG', 1),
  pfCall('HJ', 1),
  pfCall('CO', 1),
  pfCall('BTN', 1),
  pfCall('SB', 1),
  { street: 'PREFLOP', position: 'BB', kind: 'CHECK' },
];

const CHECKS_HU: readonly PostflopActionSpec[] = [check('FLOP', 'BB'), check('FLOP', 'BTN')];
const CHECKS_3WAY: readonly PostflopActionSpec[] = [
  check('FLOP', 'SB'),
  check('FLOP', 'BB'),
  check('FLOP', 'BTN'),
];

const CASES: readonly (readonly [string, PostflopQuerySpec])[] = [
  [
    'HU flop',
    {
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [...HU, check('FLOP', 'BB')],
    },
  ],
  [
    'HU turn',
    {
      hero: 'BTN',
      street: 'TURN',
      board: 'Ah7d2c9s',
      heroCards: 'AcQs',
      actions: [...HU, ...CHECKS_HU, check('TURN', 'BB')],
    },
  ],
  [
    'HU river',
    {
      hero: 'BTN',
      street: 'RIVER',
      board: 'Ah7d2c9s3h',
      heroCards: 'AcQs',
      actions: [
        ...HU,
        ...CHECKS_HU,
        check('TURN', 'BB'),
        check('TURN', 'BTN'),
        check('RIVER', 'BB'),
      ],
    },
  ],
  [
    '3-way flop',
    {
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [...THREE_WAY, check('FLOP', 'SB'), check('FLOP', 'BB')],
    },
  ],
  [
    '3-way turn',
    {
      hero: 'BTN',
      street: 'TURN',
      board: 'Ah7d2c9s',
      heroCards: 'AcQs',
      actions: [...THREE_WAY, ...CHECKS_3WAY, check('TURN', 'SB'), check('TURN', 'BB')],
    },
  ],
  [
    '3-way river',
    {
      hero: 'BTN',
      street: 'RIVER',
      board: 'Ah7d2c9s3h',
      heroCards: 'AcQs',
      actions: [
        ...THREE_WAY,
        ...CHECKS_3WAY,
        check('TURN', 'SB'),
        check('TURN', 'BB'),
        check('TURN', 'BTN'),
        check('RIVER', 'SB'),
        check('RIVER', 'BB'),
      ],
    },
  ],
  // 4, 5 and 6 players. B3 measured only the two lineups above and concluded from them that a
  // heads-up flop is the worst shape, because the runout enumeration shrinks multiway. That
  // ignores the other direction: the villain cross-product and the per-runout strength work
  // both GROW with villain count. These three cases exist so the claim is measured rather than
  // extrapolated, and the widest one is the true worst shape (R1B MAJOR-2).
  [
    '4-way flop',
    {
      hero: 'BTN',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [...FOUR_WAY, check('FLOP', 'SB'), check('FLOP', 'BB'), bet('FLOP', 'CO', 3)],
    },
  ],
  [
    '5-way flop',
    {
      hero: 'SB',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [...FIVE_WAY_LIMPED],
    },
  ],
  [
    '6-way flop',
    {
      hero: 'SB',
      street: 'FLOP',
      board: 'Ah7d2c',
      heroCards: 'AcQs',
      actions: [...SIX_WAY_LIMPED],
    },
  ],
];

/** The interaction budget the brief names. Asserted only on the shapes B3 measured. */
const BUDGET_MS = 200;

/**
 * The ceiling for the multiway shapes: an order-of-magnitude alarm, not a stopwatch. The worst
 * shape measures ~106 ms here, so this fires on a real regression and not on slow hardware.
 */
const SMOKE_CEILING_MS = 1000;

/** The shapes added by R1B MAJOR-2, which assert the smoke ceiling rather than the budget. */
const MULTIWAY_SHAPES: ReadonlySet<string> = new Set(['4-way flop', '5-way flop', '6-way flop']);

describe('recommendPostflop latency (informational)', () => {
  const rows: string[] = [];

  for (const [name, spec] of CASES) {
    const ceiling = MULTIWAY_SHAPES.has(name) ? SMOKE_CEILING_MS : BUDGET_MS;
    it(`${name} answers inside its ${ceiling} ms ceiling`, () => {
      const query = makePostflopQuery(spec);
      // One warm-up call so the measurement is of steady-state work, not of JIT warm-up.
      expect(recommendPostflop(query).ok).toBe(true);
      const started = performance.now();
      const runs = 3;
      for (let i = 0; i < runs; i += 1) {
        const result = recommendPostflop(query);
        expect(result.ok).toBe(true);
      }
      const each = (performance.now() - started) / runs;
      rows.push(`${name.padEnd(14)} ${each.toFixed(1)} ms`);
      expect(each).toBeLessThan(ceiling);
    });
  }

  it('names the worst shape by MEASUREMENT, and it is not the heads-up flop', () => {
    // The claim B3 got wrong, pinned: the widest lineup costs more than heads-up on the flop.
    // Both are measured in the same process, so the comparison survives a slow machine.
    // The FASTEST of several runs, not the mean: a minimum is far less noisy than an average
    // under scheduler interference, which is what keeps this comparison from being flaky.
    const timeOf = (spec: PostflopQuerySpec): number => {
      const query = makePostflopQuery(spec);
      expect(recommendPostflop(query).ok).toBe(true);
      let best = Infinity;
      for (let i = 0; i < 5; i += 1) {
        const started = performance.now();
        expect(recommendPostflop(query).ok).toBe(true);
        best = Math.min(best, performance.now() - started);
      }
      return best;
    };
    const caseOf = (name: string): PostflopQuerySpec => {
      const found = CASES.find(([label]) => label === name);
      expect(found).toBeDefined();
      return found![1];
    };
    expect(timeOf(caseOf('6-way flop'))).toBeGreaterThan(timeOf(caseOf('HU flop')));
  }, 60_000);

  it('reports the equity method honestly on the shapes it times', () => {
    // The other half of the corrected claim: multiway is not merely slower, it is also the
    // half that subsamples. `EXACT` vs `SUBSAMPLED` reaches the UI, so it must stay true.
    const methodOf = (spec: PostflopQuerySpec): string => {
      const result = recommendPostflop(makePostflopQuery(spec));
      expect(result.ok).toBe(true);
      return result.ok ? result.value.metrics.heroEquityMethod : 'FAILED';
    };
    const caseOf = (name: string): PostflopQuerySpec => {
      const found = CASES.find(([label]) => label === name);
      expect(found).toBeDefined();
      return found![1];
    };
    expect(methodOf(caseOf('HU flop'))).toBe('EXACT');
    expect(methodOf(caseOf('6-way flop'))).toBe('SUBSAMPLED');
  });

  it('prints the table', () => {
    console.log(['', 'recommendPostflop latency', ...rows].join('\n  '));
    expect(rows.length).toBe(CASES.length);
  });

  it('a reduced budget does not change the ANSWER shape, only the enumeration', () => {
    const query = makePostflopQuery(CASES[0]![1]);
    const full = recommendPostflop(query);
    const cheap = recommendPostflop(query, {
      rangeEquityMaxOps: 200_000,
      rangeEquityMaxRunouts: 32,
    });
    expect(full.ok && cheap.ok).toBe(true);
    if (!full.ok || !cheap.ok) return;
    // Both are legal, quantized answers; the cheaper one is allowed to differ numerically but
    // must never differ structurally.
    for (const rec of [full.value, cheap.value]) {
      expect(rec.actions.reduce((acc, a) => acc + a.frequencyBps, 0)).toBe(10000);
      expect(rec.provenance.quality).not.toBe('SOURCE');
    }
    expect(cheap.value.family).toBe(full.value.family);
  });

  it('is deterministic under a reduced budget too', () => {
    const query = makePostflopQuery(CASES[0]![1]);
    const budget = { rangeEquityMaxOps: 200_000, rangeEquityMaxRunouts: 32 };
    const a = recommendPostflop(query, budget);
    const b = recommendPostflop(query, budget);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
