/**
 * Glossary batch G3's compiled MDX (베팅·액션 · 기본 액션). One entry per slug the batch owns
 * (`registry/glossary/g3.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Action from '../../../content/glossary/action.mdx';
import Check from '../../../content/glossary/check.mdx';
import Bet from '../../../content/glossary/bet.mdx';
import Call from '../../../content/glossary/call.mdx';
import Raise from '../../../content/glossary/raise.mdx';
import Fold from '../../../content/glossary/fold.mdx';
import AllIn from '../../../content/glossary/all-in.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G3_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  action: Action,
  check: Check,
  bet: Bet,
  call: Call,
  raise: Raise,
  fold: Fold,
  'all-in': AllIn,
};
