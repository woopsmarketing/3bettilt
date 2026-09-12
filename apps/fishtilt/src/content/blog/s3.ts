/**
 * Slug -> compiled MDX for hand-story batch S3 (WP-S3-08). Import each story's
 * `content/blog/<slug>.mdx` and map it by slug here — the same shape as `i1.ts`.
 */
import AaLoses from '../../../content/blog/aa-loses.mdx';
import AkFlopMiss from '../../../content/blog/ak-flop-miss.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_S3_MDX: Readonly<Record<string, ArticleComponent>> = {
  'aa-loses': AaLoses,
  'ak-flop-miss': AkFlopMiss,
};
