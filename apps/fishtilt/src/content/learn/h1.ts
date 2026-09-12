/**
 * Learn batch H1's compiled MDX — lessons 01-05
 * (`holdem-basics`, `poker-hand-rankings`, `starting-hands`, `starting-hand-ranking`,
 * `hand-matrix`). Empty until H1 writes the five files this batch owns
 * (`apps/fishtilt/content/learn/{holdem-basics,poker-hand-rankings,starting-hands,
 * starting-hand-ranking,hand-matrix}.mdx`) and adds one entry per slug here, alongside
 * flipping that lesson's registry record to `PUBLISHED`
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "H1").
 *
 * Each import must be named explicitly, never built from a template string — see
 * `learn/index.ts` for why (the same reason `content/lessons.ts` gave before this split).
 *
 * Keyed by SLUG, not id — lesson 02's id is `hand-rankings` but its slug (and MDX filename)
 * is `poker-hand-rankings` (`docs/FISHTILT_STATE.md` ruling 11); `lessonComponent(slug)` in
 * `learn/index.ts` looks this map up by the URL segment, which is always the slug.
 */
import HoldemBasics from '../../../content/learn/holdem-basics.mdx';
import PokerHandRankings from '../../../content/learn/poker-hand-rankings.mdx';
import StartingHands from '../../../content/learn/starting-hands.mdx';
import StartingHandRanking from '../../../content/learn/starting-hand-ranking.mdx';
import HandMatrix from '../../../content/learn/hand-matrix.mdx';
import type { LessonComponent } from './published.js';

export const LEARN_H1_MDX: Readonly<Record<string, LessonComponent>> = {
  'holdem-basics': HoldemBasics,
  'poker-hand-rankings': PokerHandRankings,
  'starting-hands': StartingHands,
  'starting-hand-ranking': StartingHandRanking,
  'hand-matrix': HandMatrix,
};
