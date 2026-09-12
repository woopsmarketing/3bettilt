/**
 * Glossary batch G2's compiled MDX (게임 구조 · 스트리트와 보드). One entry per slug the batch owns
 * (`registry/glossary/g2.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import Preflop from '../../../content/glossary/preflop.mdx';
import Flop from '../../../content/glossary/flop.mdx';
import Turn from '../../../content/glossary/turn.mdx';
import River from '../../../content/glossary/river.mdx';
import Board from '../../../content/glossary/board.mdx';
import CommunityCards from '../../../content/glossary/community-cards.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G2_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  preflop: Preflop,
  flop: Flop,
  turn: Turn,
  river: River,
  board: Board,
  'community-cards': CommunityCards,
};
