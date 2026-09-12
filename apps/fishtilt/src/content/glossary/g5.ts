/**
 * Glossary batch G5's compiled MDX (포지션). One entry per slug the batch owns
 * (`registry/glossary/g5.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Position from '../../../content/glossary/position.mdx';
import Button from '../../../content/glossary/button.mdx';
import Cutoff from '../../../content/glossary/cutoff.mdx';
import Hijack from '../../../content/glossary/hijack.mdx';
import Utg from '../../../content/glossary/utg.mdx';
import IpOop from '../../../content/glossary/ip-oop.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G5_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  position: Position,
  button: Button,
  cutoff: Cutoff,
  hijack: Hijack,
  utg: Utg,
  'ip-oop': IpOop,
};
