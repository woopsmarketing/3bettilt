/**
 * The shared MDX component type every blog batch's map file imports. Kept in its own file,
 * owned by no batch, so I1-I4 each depend only on this and never on each other's file.
 */
import type { MDXProps } from 'mdx/types';
import type { ReactElement } from 'react';

export type ArticleComponent = (props: MDXProps) => ReactElement | null;
