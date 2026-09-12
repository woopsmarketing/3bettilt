/**
 * Slug -> compiled MDX component, for `/hands/[hand]`. Four batch maps (`k1`–`k4`, one per
 * Stage 3 content agent, WP-S3-13a) merged into one lookup — the same
 * `registry/<kind>/index.ts` shape `learn/`, `blog/` and `glossary/` use.
 */
import { HAND_K1_MDX } from './k1.js';
import { HAND_K2_MDX } from './k2.js';
import { HAND_K3_MDX } from './k3.js';
import { HAND_K4_MDX } from './k4.js';
import type { HandArticleComponent } from './k1.js';

export type { HandArticleComponent } from './k1.js';

export const HAND_MDX: Readonly<Record<string, HandArticleComponent>> = {
  ...HAND_K1_MDX,
  ...HAND_K2_MDX,
  ...HAND_K3_MDX,
  ...HAND_K4_MDX,
};

/** `undefined` for a slug with no prose yet — the route treats that as a 404. */
export function handComponent(slug: string): HandArticleComponent | undefined {
  return HAND_MDX[slug];
}
