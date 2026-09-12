/**
 * Hands batch K2's compiled MDX (`99`, `88`, `77`, `22`, `a5s`). See `k1.ts`.
 */
import type { HandArticleComponent } from './k1.js';
import N99 from '../../../content/hands/99.mdx';
import N88 from '../../../content/hands/88.mdx';
import N77 from '../../../content/hands/77.mdx';
import N22 from '../../../content/hands/22.mdx';
import A5s from '../../../content/hands/a5s.mdx';

export const HAND_K2_MDX: Readonly<Record<string, HandArticleComponent>> = {
  '99': N99,
  '88': N88,
  '77': N77,
  '22': N22,
  a5s: A5s,
};
