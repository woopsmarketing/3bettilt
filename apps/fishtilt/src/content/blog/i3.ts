/**
 * Blog batch I3's compiled MDX — four answers about showdowns
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "I3", §2.2). `blog-btn-why-wide` was WP-G's seed
 * record for `/blog` + `/blog/[slug]` (see `registry/blog/i3.ts`) — I3 replaced the
 * placeholder file at `apps/fishtilt/content/blog/btn-why-wide.mdx` with the real article
 * and kept this entry. WP-S3-07 merged `same-pair-who-wins` into `what-is-kicker` (audit
 * B12 → B13), so the batch now maps four slugs; every showdown claim is verified against the
 * real evaluator in `registry/blog/i3.test.ts` (ruling 28).
 */
import A2345Wheel from '../../../content/blog/a2345-wheel.mdx';
import BtnWhyWide from '../../../content/blog/btn-why-wide.mdx';
import PlayingTheBoard from '../../../content/blog/playing-the-board.mdx';
import WhatIsKicker from '../../../content/blog/what-is-kicker.mdx';
import type { ArticleComponent } from './types.js';

export const BLOG_I3_MDX: Readonly<Record<string, ArticleComponent>> = {
  'btn-why-wide': BtnWhyWide,
  'what-is-kicker': WhatIsKicker,
  'playing-the-board': PlayingTheBoard,
  'a2345-wheel': A2345Wheel,
};
