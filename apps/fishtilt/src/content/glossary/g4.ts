/**
 * Glossary batch G4's compiled MDX (베팅·액션 · 프리플랍 베팅 이름과 통계). One entry per slug the batch owns
 * (`registry/glossary/g4.ts`). Each import is named explicitly, never built from a
 * template string — see `learn/h1.ts` for why.
 */
import OpenRaise from '../../../content/glossary/open-raise.mdx';
import Limp from '../../../content/glossary/limp.mdx';
import ThreeBet from '../../../content/glossary/three-bet.mdx';
import FourBet from '../../../content/glossary/four-bet.mdx';
import CBet from '../../../content/glossary/c-bet.mdx';
import Bluff from '../../../content/glossary/bluff.mdx';
import Vpip from '../../../content/glossary/vpip.mdx';
import Pfr from '../../../content/glossary/pfr.mdx';
import type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_G4_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  'open-raise': OpenRaise,
  limp: Limp,
  'three-bet': ThreeBet,
  'four-bet': FourBet,
  'c-bet': CBet,
  bluff: Bluff,
  vpip: Vpip,
  pfr: Pfr,
};
