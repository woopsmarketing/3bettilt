/**
 * Blog batch I1's compiled MDX. `blog-aks-vs-ako` was WP-G2's proof record for `/blog` +
 * `/blog/[slug]` (see `registry/blog/i1.ts`) — I1 replaced the placeholder file at
 * `apps/fishtilt/content/blog/aks-vs-ako.mdx` with the real article and kept this entry.
 * The other four slugs (`next-best-after-aa`, `how-often-aa`, `is-ak-good`, `qq-vs-ak`) are
 * I1's remaining four articles, all now written.
 */
import AksVsAko from '../../../content/blog/aks-vs-ako.mdx';
import HowOftenAa from '../../../content/blog/how-often-aa.mdx';
import IsAkGood from '../../../content/blog/is-ak-good.mdx';
import NextBestAfterAa from '../../../content/blog/next-best-after-aa.mdx';
import QqVsAk from '../../../content/blog/qq-vs-ak.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_I1_MDX: Readonly<Record<string, ArticleComponent>> = {
  'aks-vs-ako': AksVsAko,
  'next-best-after-aa': NextBestAfterAa,
  'how-often-aa': HowOftenAa,
  'is-ak-good': IsAkGood,
  'qq-vs-ak': QqVsAk,
};
