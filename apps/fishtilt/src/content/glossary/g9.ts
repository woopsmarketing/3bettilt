/**
 * Glossary batch G9's compiled MDX (시작 핸드·레인지). One entry per slug the batch owns
 * (`registry/glossary/g9.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Hand from '../../../content/glossary/hand.mdx';
import Suited from '../../../content/glossary/suited.mdx';
import Offsuit from '../../../content/glossary/offsuit.mdx';
import PocketPair from '../../../content/glossary/pocket-pair.mdx';
import Combo from '../../../content/glossary/combo.mdx';
import Range from '../../../content/glossary/range.mdx';
import HandMatrix from '../../../content/glossary/hand-matrix.mdx';
import Broadway from '../../../content/glossary/broadway.mdx';
import Connector from '../../../content/glossary/connector.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G9_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  hand: Hand,
  suited: Suited,
  offsuit: Offsuit,
  'pocket-pair': PocketPair,
  combo: Combo,
  range: Range,
  'hand-matrix': HandMatrix,
  broadway: Broadway,
  connector: Connector,
};
