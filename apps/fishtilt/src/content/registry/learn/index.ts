/**
 * The learn curriculum barrel — recombines the per-batch registry files into one
 * `LEARN_RECORDS` array, in curriculum order.
 *
 * WP-G2 split the single `registry/learn.ts` into one file per authoring batch
 * (`h1.ts` lessons 01-05, `h2.ts` 07-10, `h3.ts` 11-15) plus `published.ts` for lesson 06,
 * which is already `PUBLISHED` and belongs to no batch — so three lesson agents (H1, H2,
 * H3) can write in parallel without sharing a writable file. `../index.ts` and everything
 * downstream (`graph.ts`, `content.test.ts`) import `LEARN_RECORDS` exactly as before; this
 * split changes no external API (CLAUDE.md: no scope expansion beyond the split itself).
 *
 * Sorted by `order` here (not merely concatenated) so this array is gapless-in-order on its
 * own — `graph.ts`'s `LEARN_ROADMAP` re-sorts anyway, but a reader of this file should not
 * have to know the batch boundaries to see the curriculum's real order.
 */
import type { LearnRecord } from '../../types.js';
import { LEARN_H1_RECORDS } from './h1.js';
import { LEARN_H2_RECORDS } from './h2.js';
import { LEARN_H3_RECORDS } from './h3.js';
import { LEARN_PUBLISHED_RECORDS } from './published.js';

export { LEARN_H1_RECORDS } from './h1.js';
export { LEARN_H2_RECORDS } from './h2.js';
export { LEARN_H3_RECORDS } from './h3.js';
export { LEARN_PUBLISHED_RECORDS } from './published.js';

export const LEARN_RECORDS: readonly LearnRecord[] = [
  ...LEARN_H1_RECORDS,
  ...LEARN_PUBLISHED_RECORDS,
  ...LEARN_H2_RECORDS,
  ...LEARN_H3_RECORDS,
].toSorted((a, b) => a.order - b.order);
