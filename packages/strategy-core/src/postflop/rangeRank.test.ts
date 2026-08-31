/**
 * `rangeRank`'s BASIS: what gets ranked, and inside which distribution.
 *
 * R1 MINOR-2 measured the defect these tests pin. The old code ranked
 * `heroEntry?.equity ?? heroEquityResult.value.equity`: hero's combo vs the PRIMARY VILLAIN
 * when hero's combo had weight in hero's own range, and hero's pooled equity vs the WHOLE
 * FIELD when it did not — inside the same pairwise distribution either way. The two quantities
 * coincide only heads-up, so multiway the fallback ranked one distribution's number inside
 * another's, understating hero's rank by enough to cross a scoring band.
 *
 * Every fixture below is built through the real machinery, and the counterexample numbers are
 * R1's own, recomputed here from the equity engine rather than pasted in.
 */
import { describe, expect, it } from 'vitest';
import { buildPostflopContext } from './context.js';
import { buildPostflopRanges } from './ranges.js';
import { recommendPostflop } from './policy.js';
import { equityVsRange, equityVsRanges } from '../equity/equity.js';
import { equityQuantile } from '../equity/rangeEquity.js';
import {
  check,
  makePostflopQuery,
  pfCall,
  pfFold,
  pfRaise,
  type PostflopActionSpec,
  type PostflopQuerySpec,
} from './testQuery.js';

/** BTN opens, both blinds call: BTN, SB and BB to the flop. R1's measured lineup. */
const THREE_WAY: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfCall('SB', 2.5),
  pfCall('BB', 2.5),
];

/** BTN opens, BB calls. */
const HEADS_UP: readonly PostflopActionSpec[] = [
  pfFold('UTG'),
  pfFold('HJ'),
  pfFold('CO'),
  pfRaise('BTN', 2.5),
  pfFold('SB'),
  pfCall('BB', 2.5),
];

function threeWaySpot(heroCards: string): PostflopQuerySpec {
  return {
    hero: 'BTN',
    street: 'FLOP',
    board: 'Ah7d2c',
    heroCards,
    actions: [...THREE_WAY, check('FLOP', 'SB'), check('FLOP', 'BB')],
  };
}

function headsUpSpot(heroCards: string): PostflopQuerySpec {
  return {
    hero: 'BTN',
    street: 'FLOP',
    board: 'Ah7d2c',
    heroCards,
    actions: [...HEADS_UP, check('FLOP', 'BB')],
  };
}

function contextOf(spec: PostflopQuerySpec) {
  const built = buildPostflopContext(makePostflopQuery(spec));
  expect(built.ok, JSON.stringify(built)).toBe(true);
  if (!built.ok) throw new Error('unreachable');
  return built.value;
}

/** Hero's combo against the primary villain alone — the quantity the distribution is made of. */
function pairwiseEquityOf(spec: PostflopQuerySpec): number {
  const query = makePostflopQuery(spec);
  const ranges = buildPostflopRanges(query);
  if (!ranges.ok) throw new Error('ranges');
  const result = equityVsRange(query.heroCards, query.board, ranges.value.primaryVillain.range);
  if (!result.ok) throw new Error('equity');
  expect(result.value.method).toBe('EXACT');
  return result.value.equity;
}

/** Hero's pooled equity against every live villain — the quantity the OLD fallback ranked. */
function wholeFieldEquityOf(spec: PostflopQuerySpec): number {
  const query = makePostflopQuery(spec);
  const ranges = buildPostflopRanges(query);
  if (!ranges.ok) throw new Error('ranges');
  const result = equityVsRanges(
    query.heroCards,
    query.board,
    ranges.value.villains.map((seat) => seat.range),
  );
  if (!result.ok) throw new Error('equity');
  return result.value.equity;
}

describe('rangeRank basis — R1 MINOR-2 three-way counterexample', () => {
  // Both combos are outside BTN's own opening range, which is exactly when the old fallback
  // fired. If a range edit ever puts them back in, these tests stop testing the fallback and
  // this assertion says so instead of passing vacuously.
  it.each(['2h2s', '8c4d'])('%s is not in hero’s own propagated range', (hand) => {
    expect(contextOf(threeWaySpot(hand)).heroComboInRange).toBe(false);
  });

  it.each([
    // hand, pairwise-basis rank (coherent), whole-field-basis rank (the R1 defect)
    ['2h2s', 0.9882, 0.9467],
    ['8c4d', 0.073, 0.0],
  ])('%s ranks the pairwise equity, not the pooled one', (hand, coherent, defect) => {
    const spec = threeWaySpot(hand as string);
    const context = contextOf(spec);

    // The basis is the exact single-combo probe against the PRIMARY villain...
    expect(context.rangeRankBasis).toBe('EXACT_PAIRWISE_PROBE');
    expect(context.rangeRankEquity).toBe(pairwiseEquityOf(spec));
    // ...and NOT hero's pooled equity against the whole field, which is what it used to be.
    expect(context.rangeRankEquity).not.toBe(wholeFieldEquityOf(spec));
    expect(context.rangeRankEquity).toBeGreaterThan(context.heroEquity);

    // R1's measured numbers, to four places.
    expect(context.rangeRank).toBeCloseTo(coherent as number, 4);
    expect(context.rangeRank).not.toBeCloseTo(defect as number, 3);

    // And the rank really is that value's quantile in the distribution it is ranked in.
    expect(context.rangeRank).toBe(
      1 - equityQuantile(context.rangeEquityDistribution, context.rangeRankEquity),
    );
  });

  it('reports the direction of the correction: the defect ranked hero too low', () => {
    const spec = threeWaySpot('2h2s');
    const context = contextOf(spec);
    const defectRank = 1 - equityQuantile(context.rangeEquityDistribution, context.heroEquity);
    expect(defectRank).toBeLessThan(context.rangeRank);
  });

  it('the ordinary path still reads its value straight off the distribution', () => {
    const spec = threeWaySpot('AcQs');
    const context = contextOf(spec);
    expect(context.heroComboInRange).toBe(true);
    expect(context.rangeRankBasis).toBe('RANGE_DISTRIBUTION');
    const entry = context.rangeEquityDistribution.aggregate.perCombo.find(
      (combo) => combo.combo === context.heroCombo,
    );
    expect(entry).toBeDefined();
    expect(context.rangeRankEquity).toBe(entry?.equity);
  });
});

describe('rangeRank basis — heads-up is unchanged', () => {
  it('an in-range combo ranks its own distribution entry, exactly as before', () => {
    const context = contextOf(headsUpSpot('AcQs'));
    expect(context.heroComboInRange).toBe(true);
    expect(context.rangeRankBasis).toBe('RANGE_DISTRIBUTION');
    const entry = context.rangeEquityDistribution.aggregate.perCombo.find(
      (combo) => combo.combo === context.heroCombo,
    );
    expect(context.rangeRankEquity).toBe(entry?.equity);
    expect(context.rangeRank).toBe(
      1 - equityQuantile(context.rangeEquityDistribution, entry?.equity ?? 0),
    );
  });

  it('an off-range combo ranks the same number the old fallback used', () => {
    // Heads-up the whole field IS the primary villain, so the old substitution was already
    // coherent and the fix must not move the number by so much as a bit.
    const spec = headsUpSpot('8c4d');
    const context = contextOf(spec);
    expect(context.heroComboInRange).toBe(false);
    expect(context.rangeRankBasis).toBe('EXACT_PAIRWISE_PROBE');
    expect(context.rangeRankEquity).toBe(context.heroEquity);
    expect(context.rangeRankEquity).toBe(pairwiseEquityOf(spec));
    expect(context.rangeRank).toBe(
      1 - equityQuantile(context.rangeEquityDistribution, context.heroEquity),
    );
  });
});

describe('rangeRank basis — determinism and reporting', () => {
  it('is bit-identical across repeated builds, on both paths', () => {
    for (const hand of ['2h2s', 'AcQs']) {
      const spec = threeWaySpot(hand);
      const first = contextOf(spec);
      const second = contextOf(spec);
      expect(second.rangeRank).toBe(first.rangeRank);
      expect(second.rangeRankEquity).toBe(first.rangeRankEquity);
      expect(second.rangeRankBasis).toBe(first.rangeRankBasis);
    }
  });

  it('names the unusual basis in the explanation, and stays quiet on the ordinary one', () => {
    const off = recommendPostflop(makePostflopQuery(threeWaySpot('2h2s')));
    expect(off.ok).toBe(true);
    if (!off.ok) throw new Error('unreachable');
    const basis = off.value.explanation.features.find((f) => f.id === 'RANGE_RANK_BASIS');
    expect(basis?.token).toBe('EXACT_PAIRWISE_PROBE');
    expect(basis?.ratioValue).toBe(pairwiseEquityOf(threeWaySpot('2h2s')));

    const ordinary = recommendPostflop(makePostflopQuery(threeWaySpot('AcQs')));
    expect(ordinary.ok).toBe(true);
    if (!ordinary.ok) throw new Error('unreachable');
    expect(ordinary.value.explanation.features.some((f) => f.id === 'RANGE_RANK_BASIS')).toBe(
      false,
    );
  });

  it('carries the ranking distribution’s SUBSAMPLED label with the rank it produced', () => {
    // R1 MINOR-3: on a flop the distribution is subsampled essentially always, and that must be
    // visible next to the number it produced rather than only inside the equity engine.
    const context = contextOf(threeWaySpot('AcQs'));
    expect(context.rangeEquityMethod).toBe('SUBSAMPLED');
    expect(context.anyEquitySubsampled).toBe(true);
    const rec = recommendPostflop(makePostflopQuery(threeWaySpot('AcQs')));
    expect(rec.ok).toBe(true);
    if (!rec.ok) throw new Error('unreachable');
    expect(rec.value.explanation.features.find((f) => f.id === 'EQUITY_METHOD')?.token).toBe(
      `${context.heroEquityMethod}/SUBSAMPLED`,
    );
    expect(rec.value.provenance.ruleIds).toContain('EQUITY_SUBSAMPLED');
  });
});
