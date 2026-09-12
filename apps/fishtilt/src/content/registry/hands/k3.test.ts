/**
 * @vitest-environment node
 *
 * Hands batch K3 gate (`aks`, `ako`, `aqs`, `aqo`, `ajs`) — see `k1.test.ts` for why the
 * comparative claims below are executable assertions rather than prose (ruling 28).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { factValue } from '../../facts.js';
import { describeHandBatch, equity, rank } from './batchGate.js';
import { HAND_K3_RECORDS } from './k3.js';

const OWNED_SLUGS = ['aks', 'ako', 'aqs', 'aqo', 'ajs'] as const;

describeHandBatch({
  batch: 'K3',
  records: HAND_K3_RECORDS,
  ownedSlugs: OWNED_SLUGS,
  mdxMapSource: readFileSync(fileURLToPath(new URL('../../hands/k3.ts', import.meta.url)), 'utf8'),
  mdxMapExport: 'HAND_K3_MDX',
});

describe('hands batch K3 — comparative claims are evaluator-verified, not reasoned (ruling 28)', () => {
  it('AKo sits below 77 but above 66, in both rank and equity (ako.mdx’s corrected claim)', () => {
    expect(rank('AKo')).toBeGreaterThan(rank('77'));
    expect(rank('AKo')).toBeLessThan(rank('66'));
    expect(equity('AKo')).toBeLessThan(equity('77'));
    expect(equity('AKo')).toBeGreaterThan(equity('66'));
  });

  it('AKo is the best-ranked offsuit hand of all 169 (ako.mdx)', () => {
    const akoRank = rank('AKo');
    for (let r = 1; r < akoRank; r += 1) {
      const key = factValue('HAND_AT_RANK', String(r));
      expect(key.endsWith('o'), `rank ${r} = ${key}`).toBe(false);
    }
  });

  it('AJs outranks AKo despite looking weaker by s/o notation (ajs.mdx)', () => {
    expect(rank('AJs')).toBeLessThan(rank('AKo'));
  });

  it('AQo outranks KQs despite being offsuit (aqo.mdx)', () => {
    expect(rank('AQo')).toBeLessThan(rank('KQs'));
  });

  it("AKo's immediate rank neighbours are both suited (ako.mdx)", () => {
    const akoRank = rank('AKo');
    expect(factValue('HAND_AT_RANK', String(akoRank - 1))).toMatch(/s$/u);
    expect(factValue('HAND_AT_RANK', String(akoRank + 1))).toMatch(/s$/u);
  });

  it('exactly one class (77) sits between AKs and AQs in rank (aqs.mdx)', () => {
    const aksRank = rank('AKs');
    expect(rank('AQs')).toBe(aksRank + 2);
    expect(factValue('HAND_AT_RANK', String(aksRank + 1))).toBe('77');
  });

  it("AQo's immediate rank neighbours both include an ace (aqo.mdx)", () => {
    const aqoRank = rank('AQo');
    expect(factValue('HAND_AT_RANK', String(aqoRank - 1))).toMatch(/^A/u);
    expect(factValue('HAND_AT_RANK', String(aqoRank + 1))).toMatch(/^A/u);
  });
});
