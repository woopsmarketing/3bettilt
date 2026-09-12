/**
 * Hands batch K1's compiled MDX (`aa`, `kk`, `qq`, `jj`, `tt`) — one map file per content
 * batch, the same split `registry/hands/k1.ts` has (WP-S3-13a). `k1.test.ts` checks that
 * every owned slug is imported from its own `.mdx` file and that no other slug is here.
 */
import type { MDXProps } from 'mdx/types';
import type { ReactElement } from 'react';
import Aa from '../../../content/hands/aa.mdx';
import Kk from '../../../content/hands/kk.mdx';
import Qq from '../../../content/hands/qq.mdx';
import Jj from '../../../content/hands/jj.mdx';
import Tt from '../../../content/hands/tt.mdx';

export type HandArticleComponent = (props: MDXProps) => ReactElement | null;

export const HAND_K1_MDX: Readonly<Record<string, HandArticleComponent>> = {
  aa: Aa,
  kk: Kk,
  qq: Qq,
  jj: Jj,
  tt: Tt,
};
