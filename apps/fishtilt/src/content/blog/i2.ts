/**
 * Blog batch I2's compiled MDX. Five slugs, one file each under
 * `apps/fishtilt/content/blog/`, matching `registry/blog/i2.ts`'s five `PUBLISHED` records.
 */
import SmallPocketPairs from '../../../content/blog/small-pocket-pairs.mdx';
import Why72oIsWeak from '../../../content/blog/why-72o-is-weak.mdx';
import WhySuitedMatters from '../../../content/blog/why-suited-matters.mdx';
import FlushVsStraight from '../../../content/blog/flush-vs-straight.mdx';
import FullHouseVsFlush from '../../../content/blog/full-house-vs-flush.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_I2_MDX: Readonly<Record<string, ArticleComponent>> = {
  'small-pocket-pairs': SmallPocketPairs,
  'why-72o-is-weak': Why72oIsWeak,
  'why-suited-matters': WhySuitedMatters,
  'flush-vs-straight': FlushVsStraight,
  'full-house-vs-flush': FullHouseVsFlush,
};
