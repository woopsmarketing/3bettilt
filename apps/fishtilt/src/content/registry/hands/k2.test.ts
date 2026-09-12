/**
 * @vitest-environment node
 *
 * Hands batch K2 gate (`99`, `88`, `77`, `22`, `a5s`) — see `k1.test.ts` for why the
 * comparative claims below are executable assertions rather than prose (ruling 28).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handStrengthOf, HAND_STRENGTH_BY_RANK } from '@gto-self/learn-core';
import { handClassByKey, HAND_CLASS_COUNT } from '@gto-self/strategy-core';
import { factValue } from '../../facts.js';
import { describeHandBatch, equity, rank } from './batchGate.js';
import { HAND_K2_RECORDS } from './k2.js';

const OWNED_SLUGS = ['99', '88', '77', '22', 'a5s'] as const;

describeHandBatch({
  batch: 'K2',
  records: HAND_K2_RECORDS,
  ownedSlugs: OWNED_SLUGS,
  mdxMapSource: readFileSync(fileURLToPath(new URL('../../hands/k2.ts', import.meta.url)), 'utf8'),
  mdxMapExport: 'HAND_K2_MDX',
});

describe('hands batch K2 — comparative claims are evaluator-verified, not reasoned (ruling 28)', () => {
  it('AKs outranks 77, and JJ outranks AKs (jj.mdx / 77.mdx)', () => {
    expect(rank('AKs')).toBeLessThan(rank('77'));
    expect(rank('JJ')).toBeLessThan(rank('AKs'));
  });

  it('A5s ranks and plays below KQs — an ace with a low, gapped kicker does not always win (a5s.mdx)', () => {
    expect(rank('A5s')).toBeGreaterThan(rank('KQs'));
    expect(equity('A5s')).toBeLessThan(equity('KQs'));
  });

  it('the top 7 ranks are all pocket pairs, and rank 8 is the first non-pair, AKs (99.mdx / 77.mdx, audit #2/#3)', () => {
    for (let r = 1; r <= 7; r += 1) {
      const key = factValue('HAND_AT_RANK', String(r));
      expect(handClassByKey(key)?.kind, `rank ${r} (${key})`).toBe('PAIR');
    }
    const eighth = factValue('HAND_AT_RANK', '8');
    expect(eighth).toBe('AKs');
    expect(handClassByKey(eighth)?.kind).toBe('SUITED');
  });

  it('22 is "반반에 가깝다" as a pot share, and its top-share is over dealt combos, not 169 labels (22.mdx, WP-S3-19)', () => {
    const twos = handClassByKey('22');
    if (twos === undefined) throw new Error('22 is not a hand class');
    const entry = handStrengthOf(twos);
    // "반반에 가깝다": the expected pot share (ties split) is within 5pp of one half.
    expect(Math.abs(entry.equity - 0.5)).toBeLessThan(0.05);
    // `HAND_TOP_SHARE` is cumulative COMBOS / 1326 — not rank / 169 — so the prose must not
    // frame it as "169가지 중 상위 X%". The two ratios differ for 22 by more than a point.
    expect(entry.cumulativeShare).toBe(entry.cumulativeCombos / 1326);
    expect(Math.abs(entry.cumulativeShare - entry.rank / HAND_CLASS_COUNT)).toBeGreaterThan(0.01);
    expect(HAND_STRENGTH_BY_RANK[entry.rank - 1]?.key).toBe('22');
  });

  it('22’s RFI range membership is narrow but not empty (ruling 48 correction, 22.mdx)', () => {
    const positions = factValue('RFI_POSITIONS_WITH', '22');
    expect(positions).not.toBe('한 자리도 없습니다');
    expect(positions.split('·').map((s) => s.trim())).toEqual(['SB']);
  });

  it('A5s’s RFI range membership is every position this site tracks (ruling 48 correction, a5s.mdx)', () => {
    const positions = factValue('RFI_POSITIONS_WITH', 'A5s');
    expect(positions).not.toBe('한 자리도 없습니다');
    expect(positions.split('·').map((s) => s.trim())).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB']);
  });
});
