/**
 * Blog batch I4's compiled MDX. Five slugs, one file each under
 * `apps/fishtilt/content/blog/`, matching `registry/blog/i4.ts`'s five `PUBLISHED` records.
 */
import WhyBlindsExist from '../../../content/blog/why-blinds-exist.mdx';
import WhyCalled3Bet from '../../../content/blog/why-called-3bet.mdx';
import WhyUseRange from '../../../content/blog/why-use-range.mdx';
import PotOddsQuick from '../../../content/blog/pot-odds-quick.mdx';
import OutsNine from '../../../content/blog/outs-nine.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_I4_MDX: Readonly<Record<string, ArticleComponent>> = {
  'why-blinds-exist': WhyBlindsExist,
  'why-called-3bet': WhyCalled3Bet,
  'why-use-range': WhyUseRange,
  'pot-odds-quick': PotOddsQuick,
  'outs-nine': OutsNine,
};
