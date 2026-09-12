/**
 * Learn batch H2's compiled MDX — lessons 07-10 (`position`, `positions-6max`,
 * `poker-actions`, `preflop`). Lesson 06 (`poker-range`) is not H2's — see
 * `learn/published.ts`.
 */
import Position from '../../../content/learn/position.mdx';
import PositionsSixMax from '../../../content/learn/positions-6max.mdx';
import PokerActions from '../../../content/learn/poker-actions.mdx';
import Preflop from '../../../content/learn/preflop.mdx';
import type { LessonComponent } from './published.js';

export const LEARN_H2_MDX: Readonly<Record<string, LessonComponent>> = {
  position: Position,
  'positions-6max': PositionsSixMax,
  'poker-actions': PokerActions,
  preflop: Preflop,
};
