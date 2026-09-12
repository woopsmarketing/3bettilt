/**
 * Glossary batch G8's compiled MDX (확률·수학). One entry per slug the batch owns
 * (`registry/glossary/g8.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Draw from '../../../content/glossary/draw.mdx';
import Outs from '../../../content/glossary/outs.mdx';
import Equity from '../../../content/glossary/equity.mdx';
import PotOdds from '../../../content/glossary/pot-odds.mdx';
import Gutshot from '../../../content/glossary/gutshot.mdx';
import OpenEnded from '../../../content/glossary/open-ended.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G8_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  draw: Draw,
  outs: Outs,
  equity: Equity,
  'pot-odds': PotOdds,
  gutshot: Gutshot,
  'open-ended': OpenEnded,
};
