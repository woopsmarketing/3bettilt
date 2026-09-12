/**
 * Hand-story registry barrel — the S1-S3 batches (WP-S3-08) as one array. `HAND_STORY_RECORDS`
 * is spread into `BLOG_RECORDS` by `../index.ts`, so a story is a blog record everywhere
 * (hub, sitemap, search, graph) and a `HandStoryRecord` where the story template needs the
 * hand. `stories.test.ts` is this barrel's gate.
 */
import type { HandStoryRecord } from '../../../types.js';
import { HAND_STORY_S1_RECORDS } from './s1.js';
import { HAND_STORY_S2_RECORDS } from './s2.js';
import { HAND_STORY_S3_RECORDS } from './s3.js';

export { HAND_STORY_S1_RECORDS } from './s1.js';
export { HAND_STORY_S2_RECORDS } from './s2.js';
export { HAND_STORY_S3_RECORDS } from './s3.js';

export const HAND_STORY_RECORDS: readonly HandStoryRecord[] = [
  ...HAND_STORY_S1_RECORDS,
  ...HAND_STORY_S2_RECORDS,
  ...HAND_STORY_S3_RECORDS,
];
