/**
 * Lesson 06's compiled MDX — `poker-range`, authored end to end in WP-G. No batch owns this
 * slug (see `registry/learn/published.ts`), so it sits in its own file rather than inside
 * `h1.ts`/`h2.ts`, where H1/H2 must never touch it.
 */
import type { MDXProps } from 'mdx/types';
import type { ReactElement } from 'react';
import PokerRange from '../../../content/learn/poker-range.mdx';

export type LessonComponent = (props: MDXProps) => ReactElement | null;

export const LEARN_PUBLISHED_MDX: Readonly<Record<string, LessonComponent>> = {
  'poker-range': PokerRange,
};
