/**
 * Slug -> compiled MDX for hand-story batch S1 (WP-S3-08). Import each story's
 * `content/blog/<slug>.mdx` and map it by slug here — the same shape as `i1.ts`.
 */
import FullHouseLoses from '../../../content/blog/full-house-loses.mdx';
import QqVs72oFlop227 from '../../../content/blog/qq-vs-72o-flop-227.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_S1_MDX: Readonly<Record<string, ArticleComponent>> = {
  'qq-vs-72o-flop-227': QqVs72oFlop227,
  'full-house-loses': FullHouseLoses,
};
