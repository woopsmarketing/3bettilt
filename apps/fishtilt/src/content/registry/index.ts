/**
 * The registry barrel — every authored and planned piece of content, in one array.
 *
 * Nothing here computes, resolves or renders: `graph.ts` is the only module that turns these
 * records into links, headings and traversals, and `content.test.ts` is the only thing that
 * decides whether the data is legal. Keeping this file to pure re-export means a new content
 * kind is added by writing one more registry directory and one more line here.
 *
 * Each kind's records live one level deeper than they used to — `./learn/index.ts`,
 * `./blog/index.ts`, `./glossary/index.ts`, `./hands/index.ts` — because WP-G2 additionally
 * split every kind into one file per AUTHORING BATCH (H1/H2/H3, I1-I4, J1/J2, E3), so that
 * several content agents can each own one writable registry file and run in parallel rather
 * than serially. `LEARN_RECORDS`, `BLOG_RECORDS`, `GLOSSARY_RECORDS`, `HAND_RECORDS` and
 * `ALL_CONTENT` are exactly the same shape as before the split — this file's own external
 * API does not change.
 */
import type { AnyContentRecord } from '../types.js';
import { LEARN_RECORDS } from './learn/index.js';
import { BLOG_RECORDS } from './blog/index.js';
import { GLOSSARY_RECORDS } from './glossary/index.js';
import { HAND_RECORDS } from './hands/index.js';

export { LEARN_RECORDS } from './learn/index.js';
export { BLOG_RECORDS } from './blog/index.js';
export { GLOSSARY_RECORDS } from './glossary/index.js';
export { HAND_RECORDS } from './hands/index.js';

export const ALL_CONTENT: readonly AnyContentRecord[] = [
  ...LEARN_RECORDS,
  ...BLOG_RECORDS,
  ...GLOSSARY_RECORDS,
  ...HAND_RECORDS,
];
