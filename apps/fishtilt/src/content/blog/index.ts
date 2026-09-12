/**
 * Slug -> compiled MDX component, for `/blog/[slug]`. Split per authoring batch (I1-I4) for
 * the same reason `content/learn/index.ts` is — see that module's doc.
 */
import { BLOG_I1_MDX } from './i1.js';
import { BLOG_I2_MDX } from './i2.js';
import { BLOG_I3_MDX } from './i3.js';
import { BLOG_I4_MDX } from './i4.js';
import { BLOG_S1_MDX } from './s1.js';
import { BLOG_S2_MDX } from './s2.js';
import { BLOG_S3_MDX } from './s3.js';
import type { ArticleComponent } from './types.js';

export type { ArticleComponent } from './types.js';

export const BLOG_MDX: Readonly<Record<string, ArticleComponent>> = {
  ...BLOG_I1_MDX,
  ...BLOG_I2_MDX,
  ...BLOG_I3_MDX,
  ...BLOG_I4_MDX,
  // Hand-story batches (WP-S3-08) — one map per story agent, see `./s1.ts`.
  ...BLOG_S1_MDX,
  ...BLOG_S2_MDX,
  ...BLOG_S3_MDX,
};

/** `undefined` for a slug with no prose yet — the route treats that as a 404. */
export function blogComponent(slug: string): ArticleComponent | undefined {
  return BLOG_MDX[slug];
}
