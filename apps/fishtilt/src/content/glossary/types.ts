/**
 * The shared MDX component type every glossary batch's map file imports. Kept in its own
 * file, owned by no batch, so J1 and J2 each depend only on this, never on each other's
 * file.
 */
import type { MDXProps } from 'mdx/types';
import type { ReactElement } from 'react';

export type GlossaryEntryComponent = (props: MDXProps) => ReactElement | null;
