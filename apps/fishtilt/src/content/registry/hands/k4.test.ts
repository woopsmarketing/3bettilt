/**
 * @vitest-environment node
 *
 * Hands batch K4 gate (`kqs`, `kjs`, `qjs`, `jts`, `t9s`) — see `k1.test.ts` for why the
 * comparative claims below are executable assertions rather than prose (ruling 28).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { factValue } from '../../facts.js';
import { HAND_STRENGTH_BY_RANK } from '@gto-self/learn-core';
import { describeHandBatch, rank } from './batchGate.js';
import { HAND_RECORDS } from './index.js';
import { HAND_K4_RECORDS } from './k4.js';

const OWNED_SLUGS = ['kqs', 'kjs', 'qjs', 'jts', 't9s'] as const;

describeHandBatch({
  batch: 'K4',
  records: HAND_K4_RECORDS,
  ownedSlugs: OWNED_SLUGS,
  mdxMapSource: readFileSync(fileURLToPath(new URL('../../hands/k4.ts', import.meta.url)), 'utf8'),
  mdxMapExport: 'HAND_K4_MDX',
});

describe('hands batch K4 — comparative claims are evaluator-verified, not reasoned (ruling 28)', () => {
  it('KQs is the first hand that is neither a pocket pair nor contains an ace (kqs.mdx)', () => {
    const kqsRank = rank('KQs');
    for (let r = 1; r < kqsRank; r += 1) {
      const key = factValue('HAND_AT_RANK', String(r));
      const isPair = key.length === 2;
      const hasAce = key.startsWith('A');
      expect(isPair || hasAce, `rank ${r} = ${key}`).toBe(true);
    }
  });

  it('among the registry’s twenty hands, only 22 ranks below T9s (t9s.mdx)', () => {
    // The claim is about the whole hands registry, not this batch alone — read the barrel.
    const ownedHandKeys = HAND_RECORDS.map((record) => record.handKey);
    const t9sRank = rank('T9s');
    const lowerRanked = ownedHandKeys.filter((key) => key !== 'T9s' && rank(key) > t9sRank);
    expect(lowerRanked).toEqual(['22']);
  });

  it('rank over all 169 classes IS the equity ordering — zero inversions (t9s.mdx FAQ, WP-S3-19)', () => {
    // t9s.mdx used to say rank and 승률 "do not always move together"; the rank is defined as
    // the descending-equity order of every class, so an inversion anywhere would falsify it.
    expect(HAND_STRENGTH_BY_RANK).toHaveLength(169);
    for (let i = 1; i < HAND_STRENGTH_BY_RANK.length; i += 1) {
      const above = HAND_STRENGTH_BY_RANK[i - 1]!;
      const below = HAND_STRENGTH_BY_RANK[i]!;
      expect(above.rank).toBe(i);
      expect(
        above.equity,
        `${above.key} (rank ${above.rank}) vs ${below.key}`,
      ).toBeGreaterThanOrEqual(below.equity);
    }
  });
});
