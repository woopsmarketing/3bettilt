/**
 * Blog registry barrel — recombines the four authoring batches (I1-I4, five answers each)
 * and the hand-story batches (S1-S3, `./stories/`) into `BLOG_RECORDS`. See `registry/learn/index.ts` for why this split exists; the same
 * reasoning applies here (four blog agents, one writable file each, no serial handoff).
 */
import type { BlogRecord } from '../../types.js';
import { BLOG_I1_RECORDS } from './i1.js';
import { BLOG_I2_RECORDS } from './i2.js';
import { BLOG_I3_RECORDS } from './i3.js';
import { BLOG_I4_RECORDS } from './i4.js';
import { HAND_STORY_RECORDS } from './stories/index.js';

export { BLOG_I1_RECORDS } from './i1.js';
export { BLOG_I2_RECORDS } from './i2.js';
export { BLOG_I3_RECORDS } from './i3.js';
export { BLOG_I4_RECORDS } from './i4.js';
export { HAND_STORY_RECORDS } from './stories/index.js';

export const BLOG_RECORDS: readonly BlogRecord[] = [
  ...BLOG_I1_RECORDS,
  ...BLOG_I2_RECORDS,
  ...BLOG_I3_RECORDS,
  ...BLOG_I4_RECORDS,
  // Hand stories (WP-S3-06 architecture, WP-S3-08 content) — `HandStoryRecord` extends
  // `BlogRecord`, so they are blog records with a hand attached. See `./stories/index.ts`.
  ...HAND_STORY_RECORDS,
];
