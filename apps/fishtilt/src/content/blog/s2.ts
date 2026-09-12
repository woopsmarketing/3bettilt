/**
 * Slug -> compiled MDX for hand-story batch S2 (WP-S3-08). Import each story's
 * `content/blog/<slug>.mdx` and map it by slug here — the same shape as `i1.ts`.
 */
import QqThreeBetFrustration from '../../../content/blog/qq-three-bet-frustration.mdx';
import RiverChangesEverything from '../../../content/blog/river-changes-everything.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_S2_MDX: Readonly<Record<string, ArticleComponent>> = {
  'qq-three-bet-frustration': QqThreeBetFrustration,
  'river-changes-everything': RiverChangesEverything,
};
