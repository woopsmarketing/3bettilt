/**
 * Hands batch K3's compiled MDX (`aks`, `ako`, `aqs`, `aqo`, `ajs`). See `k1.ts`.
 */
import type { HandArticleComponent } from './k1.js';
import Aks from '../../../content/hands/aks.mdx';
import Ako from '../../../content/hands/ako.mdx';
import Aqs from '../../../content/hands/aqs.mdx';
import Aqo from '../../../content/hands/aqo.mdx';
import Ajs from '../../../content/hands/ajs.mdx';

export const HAND_K3_MDX: Readonly<Record<string, HandArticleComponent>> = {
  aks: Aks,
  ako: Ako,
  aqs: Aqs,
  aqo: Aqo,
  ajs: Ajs,
};
