/**
 * Learn batch H3's compiled MDX — lessons 11-15 (`flop-turn-river`, `three-bet`, `equity`,
 * `pot-odds`, `outs`), all five written and their registry records flipped to `PUBLISHED`
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "H3").
 */
import FlopTurnRiver from '../../../content/learn/flop-turn-river.mdx';
import ThreeBet from '../../../content/learn/three-bet.mdx';
import Equity from '../../../content/learn/equity.mdx';
import PotOdds from '../../../content/learn/pot-odds.mdx';
import Outs from '../../../content/learn/outs.mdx';
import type { LessonComponent } from './published.js';

export const LEARN_H3_MDX: Readonly<Record<string, LessonComponent>> = {
  'flop-turn-river': FlopTurnRiver,
  'three-bet': ThreeBet,
  equity: Equity,
  'pot-odds': PotOdds,
  outs: Outs,
};
