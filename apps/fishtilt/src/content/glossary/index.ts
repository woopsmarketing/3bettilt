/**
 * Slug -> compiled MDX component, for `/glossary/[slug]`. Split per batch file (g1..g9,
 * mirroring `registry/glossary/`) for the same reason `content/learn/index.ts` is — see
 * that module's doc. A batch's map file and its registry file are the two files a content
 * agent edits to add a term; `batches.test.ts` checks they agree.
 */
import { GLOSSARY_G1_MDX } from './g1.js';
import { GLOSSARY_G2_MDX } from './g2.js';
import { GLOSSARY_G3_MDX } from './g3.js';
import { GLOSSARY_G4_MDX } from './g4.js';
import { GLOSSARY_G5_MDX } from './g5.js';
import { GLOSSARY_G6_MDX } from './g6.js';
import { GLOSSARY_G7_MDX } from './g7.js';
import { GLOSSARY_G8_MDX } from './g8.js';
import { GLOSSARY_G9_MDX } from './g9.js';
import type { GlossaryEntryComponent } from './types.js';

export type { GlossaryEntryComponent } from './types.js';

export const GLOSSARY_MDX: Readonly<Record<string, GlossaryEntryComponent>> = {
  ...GLOSSARY_G1_MDX,
  ...GLOSSARY_G2_MDX,
  ...GLOSSARY_G3_MDX,
  ...GLOSSARY_G4_MDX,
  ...GLOSSARY_G5_MDX,
  ...GLOSSARY_G6_MDX,
  ...GLOSSARY_G7_MDX,
  ...GLOSSARY_G8_MDX,
  ...GLOSSARY_G9_MDX,
};

/** `undefined` for a slug with no prose yet — the route treats that as a 404. */
export function glossaryComponent(slug: string): GlossaryEntryComponent | undefined {
  return GLOSSARY_MDX[slug];
}
