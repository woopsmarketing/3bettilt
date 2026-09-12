/**
 * Hands batch K4's compiled MDX (`kqs`, `kjs`, `qjs`, `jts`, `t9s`). See `k1.ts`.
 */
import type { HandArticleComponent } from './k1.js';
import Kqs from '../../../content/hands/kqs.mdx';
import Kjs from '../../../content/hands/kjs.mdx';
import Qjs from '../../../content/hands/qjs.mdx';
import Jts from '../../../content/hands/jts.mdx';
import T9s from '../../../content/hands/t9s.mdx';

export const HAND_K4_MDX: Readonly<Record<string, HandArticleComponent>> = {
  kqs: Kqs,
  kjs: Kjs,
  qjs: Qjs,
  jts: Jts,
  t9s: T9s,
};
