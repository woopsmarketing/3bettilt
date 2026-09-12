/**
 * @vitest-environment node
 *
 * The hands barrel after the WP-S3-13a split: four batches, twenty records, and the SAME
 * registry order the former single `e3.ts` had — so the split changes nothing a build
 * output, a search index or a "registry order" list could observe.
 */
import { describe, expect, it } from 'vitest';
import {
  HAND_K1_RECORDS,
  HAND_K2_RECORDS,
  HAND_K3_RECORDS,
  HAND_K4_RECORDS,
  HAND_RECORDS,
  HAND_REGISTRY_ORDER,
} from './index.js';

/** E3's insertion order, restated here independently of `index.ts` so the pin is a pin. */
const E3_ORDER = [
  'aks',
  'ako',
  'aa',
  'kk',
  'qq',
  'jj',
  'tt',
  '99',
  '88',
  '77',
  '22',
  'aqs',
  'aqo',
  'ajs',
  'kqs',
  'kjs',
  'qjs',
  'jts',
  't9s',
  'a5s',
] as const;

describe('hands registry barrel', () => {
  it('keeps the former e3.ts order exactly', () => {
    expect(HAND_RECORDS.map((record) => record.slug)).toEqual([...E3_ORDER]);
    expect([...HAND_REGISTRY_ORDER]).toEqual([...E3_ORDER]);
  });

  it('the four batches partition the twenty records — five each, no overlap, nothing missing', () => {
    const batches = [HAND_K1_RECORDS, HAND_K2_RECORDS, HAND_K3_RECORDS, HAND_K4_RECORDS];
    for (const batch of batches) expect(batch).toHaveLength(5);
    const ids = batches.flat().map((record) => record.id);
    expect(new Set(ids).size).toBe(20);
    expect(new Set(HAND_RECORDS.map((record) => record.id))).toEqual(new Set(ids));
  });

  it('matches the audit batches (K1 pairs · K2 small pairs + A5s · K3 ace-highs · K4 broadways/connectors)', () => {
    expect(HAND_K1_RECORDS.map((r) => r.slug)).toEqual(['aa', 'kk', 'qq', 'jj', 'tt']);
    expect(HAND_K2_RECORDS.map((r) => r.slug)).toEqual(['99', '88', '77', '22', 'a5s']);
    expect(HAND_K3_RECORDS.map((r) => r.slug)).toEqual(['aks', 'ako', 'aqs', 'aqo', 'ajs']);
    expect(HAND_K4_RECORDS.map((r) => r.slug)).toEqual(['kqs', 'kjs', 'qjs', 'jts', 't9s']);
  });
});
