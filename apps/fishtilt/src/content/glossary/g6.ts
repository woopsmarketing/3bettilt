/**
 * Glossary batch G6's compiled MDX (카드·족보 · 아홉 족보). One entry per slug the batch owns
 * (`registry/glossary/g6.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import HandRanking from '../../../content/glossary/hand-ranking.mdx';
import HighCard from '../../../content/glossary/high-card.mdx';
import OnePair from '../../../content/glossary/one-pair.mdx';
import TwoPair from '../../../content/glossary/two-pair.mdx';
import ThreeOfAKind from '../../../content/glossary/three-of-a-kind.mdx';
import SetVsTrips from '../../../content/glossary/set-vs-trips.mdx';
import Straight from '../../../content/glossary/straight.mdx';
import Flush from '../../../content/glossary/flush.mdx';
import FullHouse from '../../../content/glossary/full-house.mdx';
import FourOfAKind from '../../../content/glossary/four-of-a-kind.mdx';
import StraightFlush from '../../../content/glossary/straight-flush.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G6_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  'hand-ranking': HandRanking,
  'high-card': HighCard,
  'one-pair': OnePair,
  'two-pair': TwoPair,
  'three-of-a-kind': ThreeOfAKind,
  'set-vs-trips': SetVsTrips,
  straight: Straight,
  flush: Flush,
  'full-house': FullHouse,
  'four-of-a-kind': FourOfAKind,
  'straight-flush': StraightFlush,
};
