/**
 * Glossary batch G1's compiled MDX (게임 구조 · 판과 돈). One entry per slug the batch owns
 * (`registry/glossary/g1.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Ante from '../../../content/glossary/ante.mdx';
import Blind from '../../../content/glossary/blind.mdx';
import BigBlind from '../../../content/glossary/big-blind.mdx';
import SmallBlind from '../../../content/glossary/small-blind.mdx';
import Stack from '../../../content/glossary/stack.mdx';
import Pot from '../../../content/glossary/pot.mdx';
import HeadsUp from '../../../content/glossary/heads-up.mdx';
import Showdown from '../../../content/glossary/showdown.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G1_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  ante: Ante,
  blind: Blind,
  'big-blind': BigBlind,
  'small-blind': SmallBlind,
  stack: Stack,
  pot: Pot,
  'heads-up': HeadsUp,
  showdown: Showdown,
};
