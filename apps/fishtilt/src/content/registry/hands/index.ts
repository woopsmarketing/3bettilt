/**
 * Hands registry barrel — the four Stage 3 content batches (`k1`–`k4`, WP-S3-13a) merged
 * back into the ONE order the former single `e3.ts` file had.
 *
 * The batches are grouped by hand family (pairs / small pairs + A5s / ace-highs / broadways
 * + connectors) so four content agents can each own one file, but the registry-wide order
 * is a public surface: the search index, `ALL_CONTENT` iteration and every "registry order"
 * list read it. So `HAND_REGISTRY_ORDER` restates E3's original slug order and this barrel
 * sorts the union by it — `index.test.ts` pins that the order is exactly E3's and that the
 * four batches cover it once each.
 */
import type { HandRecord } from '../../types.js';
import { HAND_K1_RECORDS } from './k1.js';
import { HAND_K2_RECORDS } from './k2.js';
import { HAND_K3_RECORDS } from './k3.js';
import { HAND_K4_RECORDS } from './k4.js';

export { HAND_K1_RECORDS } from './k1.js';
export { HAND_K2_RECORDS } from './k2.js';
export { HAND_K3_RECORDS } from './k3.js';
export { HAND_K4_RECORDS } from './k4.js';

/** The former `e3.ts` insertion order — `docs/FISHTILT_CONTENT_PLAN.md` §4's table order. */
export const HAND_REGISTRY_ORDER: readonly string[] = [
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
];

const BATCHED: readonly HandRecord[] = [
  ...HAND_K1_RECORDS,
  ...HAND_K2_RECORDS,
  ...HAND_K3_RECORDS,
  ...HAND_K4_RECORDS,
];

export const HAND_RECORDS: readonly HandRecord[] = HAND_REGISTRY_ORDER.map((slug) => {
  const record = BATCHED.find((candidate) => candidate.slug === slug);
  if (record === undefined) {
    throw new Error(`hands registry order names "${slug}" but no batch registers it`);
  }
  return record;
});
