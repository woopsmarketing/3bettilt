/**
 * Glossary batch G7's compiled MDX (카드·족보 · 승부 판정). One entry per slug the batch owns
 * (`registry/glossary/g7.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Kicker from '../../../content/glossary/kicker.mdx';
import SplitPot from '../../../content/glossary/split-pot.mdx';
import Nuts from '../../../content/glossary/nuts.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G7_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  kicker: Kicker,
  'split-pot': SplitPot,
  nuts: Nuts,
};
